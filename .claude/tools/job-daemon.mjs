#!/usr/bin/env node
/**
 * Job Daemon (durable long-running commands)
 *
 * Why:
 * - Claude Code sessions can stall/crash, but long-running tasks (tests/builds)
 *   should be able to continue and persist status to disk.
 * - This tool starts detached worker processes that write job state + logs under
 *   `.claude/context/runtime/jobs/`.
 *
 * Usage:
 *   node .claude/tools/job-daemon.mjs start --name "pnpm test" -- "pnpm test"
 *   node .claude/tools/job-daemon.mjs status --job-id <id>
 *   node .claude/tools/job-daemon.mjs stop --job-id <id>
 *   node .claude/tools/job-daemon.mjs list
 *
 * Notes:
 * - Commands run through a platform shell (`cmd.exe /c` on Windows, `bash -lc` otherwise).
 * - State is JSON; logs are plain text.
 */

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { resolveRuntimeScope } from './runtime-scope.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

const RUNTIME_DIR = resolveRuntimeScope({ projectRoot: PROJECT_ROOT }).runtimeDir;
const JOBS_DIR = join(RUNTIME_DIR, 'jobs');
const JOB_LOGS_DIR = join(JOBS_DIR, 'logs');

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || '';
  const hasFlag = name => args.includes(`--${name}`);
  const getArg = name => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : null;
  };
  const getNum = (name, fallback) => {
    const raw = getArg(name);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const dashDash = args.indexOf('--');
  const trailing = dashDash >= 0 ? args.slice(dashDash + 1) : [];
  return {
    command,
    jobId: getArg('job-id'),
    name: getArg('name') || '',
    cwd: getArg('cwd') || '',
    shellCommand: getArg('command') || (trailing.length ? trailing.join(' ') : ''),
    retries: getNum('retries', 0),
    retryDelayMs: getNum('retry-delay-ms', 2000),
    backoffMultiplier: getNum('backoff-mult', 2),
    maxRetryDelayMs: getNum('max-retry-delay-ms', 30_000),
    help: hasFlag('help') || hasFlag('h'),
  };
}

function ensureDirs() {
  mkdirSync(JOB_LOGS_DIR, { recursive: true });
}

function jobPath(jobId) {
  return join(JOBS_DIR, `${jobId}.json`);
}

function logPath(jobId) {
  return join(JOB_LOGS_DIR, `${jobId}.log`);
}

function readJson(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(p, value) {
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  try {
    renameSync(tmp, p);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw error;
  }
}

function appendLog(jobId, line) {
  mkdirSync(dirname(logPath(jobId)), { recursive: true });
  appendFileSync(logPath(jobId), line.endsWith('\n') ? line : `${line}\n`, 'utf8');
}

function platformShell(commandString) {
  if (process.platform === 'win32') {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', commandString] };
  }
  return { cmd: 'bash', args: ['-lc', commandString] };
}

function listJobs() {
  if (!existsSync(JOBS_DIR)) return [];
  const entries = readdirSync(JOBS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.json'))
    .map(e => e.name.replace(/\.json$/, ''))
    .sort();
}

function stopJob(jobId, state) {
  const pid = Number(state?.pid || 0);
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, reason: 'No pid recorded' };

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message ?? String(error) };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clampRetryConfig(state) {
  const retries = Number(state?.retries ?? 0);
  const retryDelayMs = Number(state?.retry_delay_ms ?? 2000);
  const backoffMultiplier = Number(state?.retry_backoff_mult ?? 2);
  const maxRetryDelayMs = Number(state?.max_retry_delay_ms ?? 30_000);

  return {
    retries: Number.isFinite(retries) && retries > 0 ? Math.floor(retries) : 0,
    retryDelayMs: Number.isFinite(retryDelayMs) && retryDelayMs > 0 ? retryDelayMs : 2000,
    backoffMultiplier:
      Number.isFinite(backoffMultiplier) && backoffMultiplier >= 1 ? backoffMultiplier : 2,
    maxRetryDelayMs:
      Number.isFinite(maxRetryDelayMs) && maxRetryDelayMs > 0 ? maxRetryDelayMs : 30_000,
  };
}

function computeBackoffMs({ retryDelayMs, backoffMultiplier, maxRetryDelayMs }, attemptIndex) {
  const raw = retryDelayMs * Math.pow(backoffMultiplier, Math.max(0, attemptIndex));
  return Math.min(maxRetryDelayMs, Math.floor(raw));
}

async function runWorker(jobId) {
  ensureDirs();

  const path = jobPath(jobId);
  const state = readJson(path);
  if (!state) {
    process.exitCode = 2;
    return;
  }

  if (!state.command || typeof state.command !== 'string') {
    state.status = 'failed';
    state.error = 'Missing command';
    state.ended_at = nowIso();
    writeJsonAtomic(path, state);
    process.exitCode = 2;
    return;
  }

  state.status = 'running';
  state.started_at = state.started_at || nowIso();
  state.worker_pid = process.pid;
  state.last_heartbeat_at = nowIso();
  state.attempts = Array.isArray(state.attempts) ? state.attempts : [];
  writeJsonAtomic(path, state);
  appendLog(jobId, `[${nowIso()}] worker started (pid=${process.pid})`);

  const retryCfg = clampRetryConfig(state);
  const maxAttempts = retryCfg.retries + 1;
  let finalExitCode = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const latest = readJson(path) || state;
    if (String(latest.status) === 'cancelled') {
      appendLog(jobId, `[${nowIso()}] worker stopping: job cancelled`);
      process.exitCode = 1;
      return;
    }

    const attemptStartedAt = nowIso();
    const shell = platformShell(latest.command);
    const cwd = latest.cwd && String(latest.cwd).trim() ? String(latest.cwd).trim() : PROJECT_ROOT;

    latest.status = attempt === 1 ? 'running' : 'retrying';
    latest.current_attempt = attempt;
    latest.max_attempts = maxAttempts;
    latest.attempts = Array.isArray(latest.attempts) ? latest.attempts : [];
    latest.attempts.push({ attempt, started_at: attemptStartedAt });
    latest.attempts = latest.attempts.slice(-50);
    latest.last_heartbeat_at = nowIso();
    writeJsonAtomic(path, latest);
    appendLog(jobId, `[${nowIso()}] attempt ${attempt}/${maxAttempts} starting`);

    const child = spawn(shell.cmd, shell.args, {
      cwd,
      windowsHide: true,
      env: process.env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    latest.pid = child.pid;
    latest.last_heartbeat_at = nowIso();
    writeJsonAtomic(path, latest);
    appendLog(jobId, `[${nowIso()}] command started (pid=${child.pid})`);

    const heartbeat = setInterval(() => {
      const current = readJson(path) || latest;
      if (!['running', 'retrying'].includes(String(current.status))) return;
      current.last_heartbeat_at = nowIso();
      writeJsonAtomic(path, current);
    }, 10_000);

    child.stdout.on('data', chunk => appendLog(jobId, chunk.toString('utf8')));
    child.stderr.on('data', chunk => appendLog(jobId, chunk.toString('utf8')));

    await new Promise(resolve => child.on('close', resolve));
    clearInterval(heartbeat);

    const exitCode = typeof child.exitCode === 'number' ? child.exitCode : null;
    finalExitCode = exitCode;
    appendLog(jobId, `[${nowIso()}] command finished (exit=${exitCode})`);

    const post = readJson(path) || latest;
    post.exit_code = exitCode;
    post.last_heartbeat_at = nowIso();
    post.attempts = Array.isArray(post.attempts) ? post.attempts : [];
    const idx = post.attempts.findIndex(a => a && a.attempt === attempt && !a.ended_at);
    if (idx >= 0) {
      post.attempts[idx] = { ...post.attempts[idx], ended_at: nowIso(), exit_code: exitCode };
    }

    if (exitCode === 0) {
      post.status = 'completed';
      post.ended_at = nowIso();
      post.last_heartbeat_at = post.ended_at;
      writeJsonAtomic(path, post);
      process.exitCode = 0;
      return;
    }

    if (attempt >= maxAttempts) {
      post.status = 'failed';
      post.ended_at = nowIso();
      post.last_heartbeat_at = post.ended_at;
      writeJsonAtomic(path, post);
      process.exitCode = 1;
      return;
    }

    const delayMs = computeBackoffMs(retryCfg, attempt - 1);
    post.next_retry_at = new Date(Date.now() + delayMs).toISOString();
    writeJsonAtomic(path, post);
    appendLog(jobId, `[${nowIso()}] scheduling retry in ${delayMs}ms`);
    await sleep(delayMs);
  }

  // Should never reach, but fail closed.
  const finished = readJson(path) || state;
  finished.exit_code = finalExitCode;
  finished.ended_at = nowIso();
  finished.last_heartbeat_at = finished.ended_at;
  finished.status = finalExitCode === 0 ? 'completed' : 'failed';
  writeJsonAtomic(path, finished);
  process.exitCode = finalExitCode === 0 ? 0 : 1;
}

async function main() {
  const opts = parseArgs(process.argv);
  ensureDirs();

  if (opts.help || !opts.command) {
    process.stdout.write(
      [
        'Job Daemon',
        '',
        'Usage:',
        '  node .claude/tools/job-daemon.mjs start --name "<label>" -- "<shell command>"',
        '  node .claude/tools/job-daemon.mjs status --job-id <id>',
        '  node .claude/tools/job-daemon.mjs stop --job-id <id>',
        '  node .claude/tools/job-daemon.mjs list',
        '',
        'Options:',
        '  --name <label>       Optional label for the job',
        '  --cwd <dir>          Working directory for the command',
        '  --command <string>   Command string (alternative to -- <command...>)',
        '  --retries <n>        Retry failed commands up to N times',
        '  --retry-delay-ms <n> Base delay before retry (default: 2000)',
        '  --backoff-mult <n>   Backoff multiplier (default: 2)',
        '  --max-retry-delay-ms <n> Max delay between retries (default: 30000)',
        '',
      ].join('\n')
    );
    return;
  }

  if (opts.command === 'run') {
    if (!opts.jobId) throw new Error('Missing --job-id');
    await runWorker(opts.jobId);
    return;
  }

  if (opts.command === 'list') {
    process.stdout.write(JSON.stringify({ jobs: listJobs() }));
    return;
  }

  if (opts.command === 'status') {
    if (!opts.jobId) throw new Error('Missing --job-id');
    const state = readJson(jobPath(opts.jobId));
    process.stdout.write(JSON.stringify({ job_id: opts.jobId, state }));
    return;
  }

  if (opts.command === 'stop') {
    if (!opts.jobId) throw new Error('Missing --job-id');
    const path = jobPath(opts.jobId);
    const state = readJson(path);
    if (!state) {
      process.stdout.write(JSON.stringify({ ok: false, error: 'Job not found' }));
      process.exitCode = 1;
      return;
    }
    const res = stopJob(opts.jobId, state);
    const next = { ...state };
    next.status = res.ok ? 'cancelled' : next.status;
    next.ended_at = res.ok ? nowIso() : next.ended_at;
    next.last_heartbeat_at = nowIso();
    writeJsonAtomic(path, next);
    process.stdout.write(
      JSON.stringify({ ok: res.ok, job_id: opts.jobId, reason: res.reason || null })
    );
    process.exitCode = res.ok ? 0 : 1;
    return;
  }

  if (opts.command === 'start') {
    if (!opts.shellCommand)
      throw new Error('Missing command. Use `-- <command...>` or `--command "<cmd>"`.');

    const jobId = randomUUID();
    const cwd = opts.cwd && String(opts.cwd).trim() ? String(opts.cwd).trim() : PROJECT_ROOT;
    const state = {
      job_id: jobId,
      name: opts.name || '',
      status: 'queued',
      created_at: nowIso(),
      cwd,
      command: opts.shellCommand,
      retries: Math.max(0, Math.floor(Number(opts.retries || 0))),
      retry_delay_ms: Number.isFinite(opts.retryDelayMs) ? opts.retryDelayMs : 2000,
      retry_backoff_mult: Number.isFinite(opts.backoffMultiplier) ? opts.backoffMultiplier : 2,
      max_retry_delay_ms: Number.isFinite(opts.maxRetryDelayMs) ? opts.maxRetryDelayMs : 30_000,
      pid: null,
      worker_pid: null,
      started_at: null,
      ended_at: null,
      exit_code: null,
      attempts: [],
      current_attempt: 0,
      max_attempts: Math.max(0, Math.floor(Number(opts.retries || 0))) + 1,
      last_heartbeat_at: nowIso(),
    };

    writeJsonAtomic(jobPath(jobId), state);
    appendLog(jobId, `[${nowIso()}] job created`);

    const worker = spawn(process.execPath, [__filename, 'run', '--job-id', jobId], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: process.env,
    });
    worker.unref();

    process.stdout.write(
      JSON.stringify({
        ok: true,
        job_id: jobId,
        state_path: jobPath(jobId),
        log_path: logPath(jobId),
      })
    );
    return;
  }

  throw new Error(`Unknown command: ${opts.command}`);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ ok: false, error: err?.message ?? String(err) }));
  process.exitCode = 1;
});
