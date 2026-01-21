#!/usr/bin/env node
/**
 * Statusline (LLM-RULES)
 *
 * Goal: Always-on, zero-effort observability in the Claude Code UI.
 * Shows:
 * - model
 * - current repo dir
 * - latest run activity (from `.claude/context/runtime/last-run.json`)
 * - latest run timing/error counts (from `.claude/context/runtime/runs/<runId>/state.json`)
 * - running/failed job counts (from `.claude/context/runtime/jobs/*.json`)
 * - context window usage if provided by Claude Code
 *
 * Fail-silent: never break the UI if parsing/files fail.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeScope } from '../tools/runtime-scope.mjs';

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

function readStdin() {
  return new Promise(resolve => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      input += chunk;
      if (input.length > 128 * 1024) {
        try {
          process.stdin.destroy();
        } catch {
          // ignore
        }
      }
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(input), 150);
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return safeJsonParse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text) {
  return color(text, '2');
}

function bold(text) {
  return color(text, '1');
}

function ok(text) {
  return color(text, '32');
}

function warn(text) {
  return color(text, '33');
}

function bad(text) {
  return color(text, '31');
}

function ctxBar(remainingPct) {
  const rem = Math.max(0, Math.min(100, Math.round(Number(remainingPct))));
  const used = 100 - rem;
  const filled = Math.floor(used / 10);
  const empty = 10 - filled;
  const bar = '#'.repeat(filled) + '.'.repeat(empty);

  const label = `${bar} ${used}%`;
  if (used < 50) return ` ${ok(label)}`;
  if (used < 70) return ` ${warn(label)}`;
  return ` ${bad(label)}`;
}

function formatLastRun(lastRun) {
  if (!lastRun || typeof lastRun !== 'object') return '';
  const status = String(lastRun.status || '').toLowerCase();
  const agent = String(lastRun.current_agent || lastRun.agent || 'unknown');
  const activity = String(lastRun.current_activity || '').trim();

  const statusLabel =
    status === 'completed'
      ? ok('completed')
      : status === 'failed'
        ? bad('failed')
        : status === 'running'
          ? warn('running')
          : status
            ? dim(status)
            : dim('unknown');

  const activityShort = activity.length > 42 ? `${activity.slice(0, 39)}...` : activity;
  return `${statusLabel} ${dim(agent)} ${activityShort ? dim(`| ${activityShort}`) : ''}`.trim();
}

function summarizeRunMetrics(lastRun) {
  try {
    const runId = String(lastRun?.run_id || '').trim();
    if (!runId) return null;
    const state = readJsonFile(join(RUNS_DIR, runId, 'state.json'));
    if (!state || typeof state !== 'object') return null;
    const metrics = state.metrics && typeof state.metrics === 'object' ? state.metrics : {};
    const errors = Array.isArray(state.errors) ? state.errors.length : 0;
    const lastMs = Number(metrics.last_tool_duration_ms);
    return {
      errors,
      last_tool: typeof metrics.last_tool === 'string' ? metrics.last_tool : null,
      last_ms: Number.isFinite(lastMs) ? lastMs : null,
    };
  } catch {
    return null;
  }
}

function summarizeJobs() {
  try {
    if (!existsSync(JOBS_DIR))
      return { running: 0, failed: 0, completed: 0, queued: 0, cancelled: 0, retrying: 0 };
    const entries = readdirSync(JOBS_DIR, { withFileTypes: true }).filter(
      e => e.isFile() && e.name.endsWith('.json')
    );
    const counts = { running: 0, failed: 0, completed: 0, queued: 0, cancelled: 0, retrying: 0 };
    for (const entry of entries) {
      const j = readJsonFile(join(JOBS_DIR, entry.name));
      const s = String(j?.status || '').toLowerCase();
      if (s in counts) counts[s] += 1;
    }
    return counts;
  } catch {
    return { running: 0, failed: 0, completed: 0, queued: 0, cancelled: 0, retrying: 0 };
  }
}

function formatJobs(counts) {
  const running = counts.running || 0;
  const retrying = counts.retrying || 0;
  const failed = counts.failed || 0;
  const queued = counts.queued || 0;
  if (running + retrying + failed + queued === 0) return '';
  const parts = [];
  if (running) parts.push(warn(`jobs:${running}`));
  if (retrying) parts.push(warn(`retry:${retrying}`));
  if (queued) parts.push(dim(`queued:${queued}`));
  if (failed) parts.push(bad(`failed:${failed}`));
  return parts.length ? parts.join(' ') : '';
}

async function main() {
  const input = await readStdin();
  const data = safeJsonParse(input) || {};

  const model = String(data.model?.display_name || data.model?.name || 'Claude');
  const dir = String(data.workspace?.current_dir || process.cwd());
  const dirnameOnly = basename(dir);

  const lastRun = readJsonFile(LAST_RUN_PATH);
  const runMetrics = summarizeRunMetrics(lastRun);
  const jobs = summarizeJobs();

  const remaining = data.context_window?.remaining_percentage;
  const ctx = remaining == null ? '' : ctxBar(remaining);

  const left = `${dim(model)} | ${bold(dirnameOnly)}`;
  const midBase = formatLastRun(lastRun);
  const midExtraParts = [];
  if (runMetrics?.last_ms != null) midExtraParts.push(dim(`${Math.round(runMetrics.last_ms)}ms`));
  if (runMetrics?.errors) midExtraParts.push(bad(`err:${runMetrics.errors}`));
  const mid = [midBase, midExtraParts.join(' ')].filter(Boolean).join(' ');
  const right = formatJobs(jobs);

  const chunks = [left, mid, right].filter(Boolean);
  process.stdout.write(`${chunks.join('   ')}${ctx}`);
}

main().catch(() => {
  // fail-silent
});
