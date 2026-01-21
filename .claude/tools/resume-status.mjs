#!/usr/bin/env node
/**
 * Resume/Status Summary (no-UI, file-based)
 *
 * Prints a compact, human-readable status summary for:
 * - last observed run (`.claude/context/runtime/last-run.json`)
 * - interrupted runs (via `.claude/tools/session-recovery.mjs list-interrupted`)
 * - durable jobs (`.claude/context/runtime/jobs/*.json`)
 *
 * Usage:
 *   node .claude/tools/resume-status.mjs
 *   node .claude/tools/resume-status.mjs --json
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const LAST_RUN_PATH = join(RUNTIME_DIR, 'last-run.json');
const RUNS_DIR = join(RUNTIME_DIR, 'runs');
const JOBS_DIR = join(RUNTIME_DIR, 'jobs');
const JOB_LOGS_DIR = join(JOBS_DIR, 'logs');

function parseArgs(argv) {
  const args = argv.slice(2);
  const has = f => args.includes(f) || args.includes(`--${f}`);
  return { json: has('json'), help: has('help') || has('h') };
}

function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function listJobStates() {
  try {
    if (!existsSync(JOBS_DIR)) return [];
    const entries = readdirSync(JOBS_DIR, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name);
    return entries
      .map(name => {
        const job = readJsonFile(join(JOBS_DIR, name));
        return {
          job_id: job?.job_id || name.replace(/\.json$/, ''),
          name: job?.name || '',
          status: job?.status || 'unknown',
          exit_code: job?.exit_code ?? null,
          last_heartbeat_at: job?.last_heartbeat_at || null,
          state_path: join(JOBS_DIR, name),
          log_path: join(JOB_LOGS_DIR, `${job?.job_id || name.replace(/\.json$/, '')}.log`),
        };
      })
      .sort((a, b) =>
        String(b.last_heartbeat_at || '').localeCompare(String(a.last_heartbeat_at || ''))
      );
  } catch {
    return [];
  }
}

function getInterruptedRuns() {
  const tool = join(PROJECT_ROOT, '.claude', 'tools', 'session-recovery.mjs');
  if (!existsSync(tool)) return [];
  try {
    const res = spawnSync(process.execPath, [tool, 'list-interrupted'], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = String(res.stdout || '');
    const match = stdout.match(/\{[\s\S]*\}$/m);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed?.interrupted) ? parsed.interrupted : [];
  } catch {
    return [];
  }
}

function summarizeLastRun(lastRun) {
  if (!lastRun) return null;
  return {
    run_id: lastRun.run_id || null,
    status: lastRun.status || null,
    current_agent: lastRun.current_agent || null,
    current_activity: lastRun.current_activity || null,
    last_update_at: lastRun.last_update_at || null,
  };
}

function readTailLines(filePath, maxBytes, maxLines) {
  try {
    if (!existsSync(filePath)) return [];
    const buf = readFileSync(filePath);
    const tail = buf.length <= maxBytes ? buf : buf.subarray(buf.length - maxBytes);
    const lines = tail
      .toString('utf8')
      .split(/\r?\n/g)
      .map(l => l.trim())
      .filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function summarizeRecentEvents(runId) {
  if (!runId) return [];
  const eventsPath = join(RUNS_DIR, runId, 'events.ndjson');
  const lines = readTailLines(eventsPath, 512 * 1024, 6);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }
  return events;
}

function printHuman({ lastRun, interrupted, jobs }) {
  const lines = [];
  lines.push('RESUME / STATUS');
  lines.push('================');
  lines.push('');

  if (lastRun) {
    lines.push('Last Run');
    lines.push(`- run_id: ${lastRun.run_id || 'unknown'}`);
    lines.push(`- status: ${lastRun.status || 'unknown'}`);
    lines.push(`- agent: ${lastRun.current_agent || 'unknown'}`);
    if (lastRun.current_activity) lines.push(`- activity: ${lastRun.current_activity}`);
    if (lastRun.last_update_at) lines.push(`- last_update_at: ${lastRun.last_update_at}`);
  } else {
    lines.push('Last Run');
    lines.push('- none found');
  }

  if (lastRun?.run_id) {
    const recent = summarizeRecentEvents(lastRun.run_id);
    if (recent.length) {
      lines.push('');
      lines.push('Recent Events');
      for (const e of recent) {
        const ts = e?.ts ? String(e.ts) : '';
        const agent = e?.agent ? String(e.agent) : 'unknown';
        const phase = e?.phase ? String(e.phase) : '';
        const tool = e?.tool ? String(e.tool) : '';
        const activity = e?.activity ? String(e.activity) : '';
        const ok = e?.ok === false ? 'FAIL' : 'OK';
        const err = e?.ok === false && e?.error ? ` - ${String(e.error).slice(0, 120)}` : '';
        lines.push(`- ${ts} ${ok} ${agent} ${phase} ${tool} :: ${activity}${err}`);
      }
    }
  }

  lines.push('');
  lines.push('Interrupted Runs');
  if (!interrupted.length) {
    lines.push('- none detected');
  } else {
    for (const r of interrupted.slice(0, 8)) {
      const id = r?.run_id || r?.runId || r?.id || 'unknown';
      const status = r?.status || 'unknown';
      const updated = r?.last_update_at || r?.updated_at || r?.lastEventAt || '';
      lines.push(`- ${id} (${status}) ${updated ? `@ ${updated}` : ''}`.trim());
    }
    if (interrupted.length > 8) lines.push(`- ... and ${interrupted.length - 8} more`);
  }

  lines.push('');
  lines.push('Jobs');
  if (!jobs.length) {
    lines.push('- none');
  } else {
    for (const j of jobs.slice(0, 8)) {
      const name = j.name ? ` "${j.name}"` : '';
      const exit = j.exit_code == null ? '' : ` exit=${j.exit_code}`;
      lines.push(`- ${j.job_id} ${j.status}${exit}${name}`);
    }
    if (jobs.length > 8) lines.push(`- ... and ${jobs.length - 8} more`);
  }

  lines.push('');
  lines.push('Pointers');
  lines.push(`- last-run: ${LAST_RUN_PATH}`);
  if (jobs.length) lines.push(`- jobs dir: ${JOBS_DIR}`);
  process.stdout.write(lines.join('\n'));
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'Resume/Status Summary',
        '',
        'Usage:',
        '  node .claude/tools/resume-status.mjs [--json]',
        '',
      ].join('\n')
    );
    return;
  }

  const lastRun = summarizeLastRun(readJsonFile(LAST_RUN_PATH));
  const interrupted = getInterruptedRuns();
  const jobs = listJobStates();

  const recentEvents = lastRun?.run_id ? summarizeRecentEvents(lastRun.run_id) : [];
  const payload = {
    last_run: lastRun,
    recent_events: recentEvents,
    interrupted_runs: interrupted,
    jobs,
    runtime_dir: RUNTIME_DIR,
  };
  if (opts.json) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return;
  }
  printHuman({ lastRun, interrupted, jobs });
}

main();
