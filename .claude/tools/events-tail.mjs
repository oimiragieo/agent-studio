#!/usr/bin/env node
/**
 * Events Tail (run-observer)
 *
 * CrewAI-inspired ergonomics: quickly inspect the last N runtime events without a separate watcher.
 *
 * Usage:
 *   node .claude/tools/events-tail.mjs
 *   node .claude/tools/events-tail.mjs --run-id <id> --lines 50
 *   node .claude/tools/events-tail.mjs --json
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
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

function parseArgs(argv) {
  const out = { runId: '', lines: 30, json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--json') out.json = true;
    else if (a === '--run-id') {
      out.runId = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--run-id=')) out.runId = a.slice('--run-id='.length);
    else if (a === '--lines') {
      out.lines = Number(argv[i + 1] || 30);
      i += 1;
    } else if (a.startsWith('--lines=')) out.lines = Number(a.slice('--lines='.length));
  }
  if (!Number.isFinite(out.lines) || out.lines <= 0) out.lines = 30;
  out.lines = Math.min(out.lines, 500);
  return out;
}

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readTail(path, maxBytes = 1024 * 1024) {
  try {
    const st = statSync(path);
    if (!st.isFile()) return '';
    const buf = readFileSync(path);
    if (buf.length <= maxBytes) return buf.toString('utf8');
    return buf.subarray(buf.length - maxBytes).toString('utf8');
  } catch {
    return '';
  }
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'events-tail',
        '',
        'Usage:',
        '  node .claude/tools/events-tail.mjs [--run-id <id>] [--lines <n>] [--json]',
        '',
      ].join('\n')
    );
    return;
  }

  const lastRun = readJson(LAST_RUN_PATH);
  const runId = (opts.runId || lastRun?.run_id || '').trim();
  if (!runId) {
    process.stdout.write(
      opts.json ? JSON.stringify({ error: 'no_run_id' }) : 'No active run found.\n'
    );
    process.exitCode = 1;
    return;
  }

  const eventsPath = join(RUNS_DIR, runId, 'events.ndjson');
  if (!existsSync(eventsPath)) {
    const payload = {
      run_id: runId,
      events_path: eventsPath,
      events: [],
      error: 'missing_events_file',
    };
    process.stdout.write(
      opts.json ? JSON.stringify(payload, null, 2) : `No events file found for ${runId}.\n`
    );
    process.exitCode = 1;
    return;
  }

  const text = readTail(eventsPath, 1024 * 1024);
  const lines = text
    .split(/\r?\n/g)
    .map(l => l.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // ignore partial lines
    }
  }

  const tail = parsed.slice(-opts.lines);
  const last = tail.length ? tail[tail.length - 1] : null;
  const lastError = [...tail].reverse().find(e => e && e.ok === false && e.error) || null;

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          run_id: runId,
          events_path: eventsPath,
          count: tail.length,
          last_event: last,
          last_error: lastError,
          events: tail,
        },
        null,
        2
      )
    );
    return;
  }

  process.stdout.write(`RUN EVENTS (${runId})\n`);
  process.stdout.write(`Events file: ${eventsPath}\n\n`);
  for (const e of tail) {
    const ts = e?.ts ? String(e.ts) : '';
    const agent = e?.agent ? String(e.agent) : 'unknown';
    const phase = e?.phase ? String(e.phase) : '';
    const tool = e?.tool ? String(e.tool) : '';
    const activity = e?.activity ? String(e.activity) : '';
    const ok = e?.ok === false ? 'FAIL' : 'OK';
    const err = e?.ok === false && e?.error ? ` - ${String(e.error).slice(0, 160)}` : '';
    process.stdout.write(`- ${ts} ${ok} ${agent} ${phase} ${tool} :: ${activity}${err}\n`);
  }
}

main();
