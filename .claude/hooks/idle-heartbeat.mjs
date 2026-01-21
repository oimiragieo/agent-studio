#!/usr/bin/env node
/**
 * Idle Heartbeat Hook (Notification)
 *
 * Claude Code can emit Notification hooks like `idle_prompt`. Without a hook,
 * long-running/blocked sessions appear dead with no new events, which hurts UX.
 *
 * This hook updates the most-recent active run in
 * `.claude/context/runtime/runs/<runId>/state.json` and appends an event to
 * `events.ndjson` whenever an idle notification fires.
 *
 * Notes:
 * - Notification hook payloads typically do not include agent/session context.
 * - We choose the most recently updated run with status=running.
 * - Fail-open: never blocks anything.
 */

import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { basename, dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

const RUNTIME_DIR = resolveDirEnv(
  'CLAUDE_RUNTIME_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'runtime')
);
const RUNS_DIR = join(RUNTIME_DIR, 'runs');

let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function respondOk() {
  // Claude Code 2.1.11 validates Notification hook stdout against the generic hook schema
  // (no hookSpecificOutput variant for Notification). Return an approve decision to satisfy schema.
  safeRespond({ decision: 'approve' });
}

if (process.env.CLAUDE_IDLE_HEARTBEAT_EXECUTING === 'true') {
  respondOk();
  process.exit(0);
}
process.env.CLAUDE_IDLE_HEARTBEAT_EXECUTING = 'true';

const timeout = setTimeout(() => {
  respondOk();
  delete process.env.CLAUDE_IDLE_HEARTBEAT_EXECUTING;
  process.exit(0);
}, 700);

function makeTempPath(targetPath) {
  const dir = dirname(targetPath);
  const name = `.${basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return join(dir, name);
}

async function atomicWriteJson(targetPath, data) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmpPath = makeTempPath(targetPath);
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function readStdinJson() {
  const input = await new Promise(resolve => {
    const chunks = [];
    let bytes = 0;
    const MAX = 128 * 1024;
    process.stdin.on('data', chunk => {
      if (!chunk) return;
      bytes += chunk.length;
      if (bytes <= MAX) chunks.push(chunk);
      if (bytes > MAX) {
        try {
          process.stdin.destroy();
        } catch {
          // ignore
        }
      }
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(chunks.length ? Buffer.concat(chunks).toString('utf-8') : ''), 200);
  });

  if (!input || !input.trim()) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

async function listRunDirs() {
  try {
    if (!existsSync(RUNS_DIR)) return [];
    const { readdir } = await import('fs/promises');
    const entries = await readdir(RUNS_DIR, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

async function pickActiveRunId() {
  const dirs = await listRunDirs();
  const candidates = [];
  for (const runId of dirs) {
    const state = await readJson(join(RUNS_DIR, runId, 'state.json'));
    if (!state) continue;
    if (String(state.status || '').toLowerCase() !== 'running') continue;
    const last =
      Date.parse(state.last_event_at || state.last_heartbeat_at || state.started_at || '') || 0;
    candidates.push({ runId, last });
  }
  candidates.sort((a, b) => b.last - a.last);
  return candidates[0]?.runId || null;
}

async function appendEvent(runId, event) {
  const eventsPath = join(RUNS_DIR, runId, 'events.ndjson');
  await appendFile(eventsPath, JSON.stringify(event) + '\n', 'utf-8');
}

async function main() {
  const hookInput = await readStdinJson();
  const notificationType =
    hookInput?.notification_type ??
    hookInput?.notificationType ??
    hookInput?.type ??
    hookInput?.name ??
    'notification';

  // Only heartbeat on idle notifications (keep noise down).
  if (String(notificationType).toLowerCase() !== 'idle_prompt') {
    respondOk();
    return;
  }

  const runId = await pickActiveRunId();
  if (!runId) {
    respondOk();
    return;
  }

  const statePath = join(RUNS_DIR, runId, 'state.json');
  const state = (await readJson(statePath)) || {};
  const now = new Date().toISOString();

  const next = { ...state };
  next.last_heartbeat_at = now;
  next.last_event_at = now;
  next.current_activity = 'Idle (awaiting input)';
  next.events_count = Number.isFinite(next.events_count) ? next.events_count + 1 : 1;

  await atomicWriteJson(statePath, next);
  await appendEvent(runId, {
    ts: now,
    phase: 'notification',
    run_id: runId,
    agent: next.current_agent || 'unknown',
    tool: 'Notification',
    activity: 'idle_prompt',
    ok: true,
  }).catch(() => {});

  respondOk();
}

main()
  .catch(() => respondOk())
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_IDLE_HEARTBEAT_EXECUTING;
  });
