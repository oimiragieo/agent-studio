#!/usr/bin/env node
/**
 * Tool Events Dashboard (no-UI, file-based)
 *
 * Summarizes the tool-events artifact stream produced by run-observer:
 *   .claude/context/artifacts/tool-events/run-<runId>.ndjson
 *
 * Usage:
 *   node .claude/tools/tool-events-dashboard.mjs
 *   node .claude/tools/tool-events-dashboard.mjs --run-id <id> --last 80
 *   node .claude/tools/tool-events-dashboard.mjs --denied-only
 *   node .claude/tools/tool-events-dashboard.mjs --json
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeScope } from './runtime-scope.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const RUNTIME_DIR = resolveRuntimeScope({ projectRoot: PROJECT_ROOT }).runtimeDir;
const LAST_RUN_PATH = join(RUNTIME_DIR, 'last-run.json');

const TOOL_EVENTS_DIR = join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'tool-events');

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {
    runId: '',
    last: 60,
    json: false,
    deniedOnly: false,
    agent: '',
    tool: '',
    since: '',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--denied-only') out.deniedOnly = true;
    else if (a === '--run-id') {
      out.runId = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--run-id=')) out.runId = a.slice('--run-id='.length);
    else if (a === '--since') {
      out.since = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--since=')) out.since = a.slice('--since='.length);
    else if (a === '--last') {
      out.last = Number(argv[i + 1] || 60);
      i += 1;
    } else if (a.startsWith('--last=')) out.last = Number(a.slice('--last='.length));
    else if (a === '--agent') {
      out.agent = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--agent=')) out.agent = a.slice('--agent='.length);
    else if (a === '--tool') {
      out.tool = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--tool=')) out.tool = a.slice('--tool='.length);
  }
  if (!Number.isFinite(out.last) || out.last <= 0) out.last = 60;
  out.last = Math.min(out.last, 500);
  return out;
}

function newestRunFile() {
  try {
    if (!existsSync(TOOL_EVENTS_DIR)) return null;
    const files = readdirSync(TOOL_EVENTS_DIR)
      .filter(n => n.startsWith('run-') && n.endsWith('.ndjson'))
      .map(name => ({
        name,
        path: join(TOOL_EVENTS_DIR, name),
        st: existsSync(join(TOOL_EVENTS_DIR, name)) ? null : null,
      }));
    // Sorting by mtime without stat to keep it light; fall back to name ordering.
    files.sort((a, b) => b.name.localeCompare(a.name));
    return files.length ? files[0].path : null;
  } catch {
    return null;
  }
}

function readEvents(path) {
  try {
    if (!existsSync(path)) return [];
    const text = readFileSync(path, 'utf8');
    const lines = text
      .split(/\r?\n/g)
      .map(l => l.trim())
      .filter(Boolean);
    const out = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // ignore
      }
    }
    return out;
  } catch {
    return [];
  }
}

function countBy(events, key) {
  const m = new Map();
  for (const e of events) {
    const k = String(e?.[key] ?? 'unknown');
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function parseSinceMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : NaN;
}

function main() {
  const opts = parseArgs(process.argv);

  const lastRun = readJson(LAST_RUN_PATH);
  const runId = (opts.runId || lastRun?.run_id || '').trim();
  const eventsPath = runId ? join(TOOL_EVENTS_DIR, `run-${runId}.ndjson`) : newestRunFile();

  if (!eventsPath || !existsSync(eventsPath)) {
    process.stdout.write(
      opts.json
        ? JSON.stringify({ error: 'missing_tool_events', tool_events_dir: TOOL_EVENTS_DIR })
        : 'No tool-events file found.\n'
    );
    process.exitCode = 1;
    return;
  }

  let events = readEvents(eventsPath);
  const sinceMs = parseSinceMs(opts.since);
  if (sinceMs != null && !Number.isFinite(sinceMs)) {
    process.stdout.write(
      opts.json
        ? JSON.stringify({ error: 'invalid_since', since: opts.since }, null, 2)
        : `Invalid --since value: ${opts.since}\n`
    );
    process.exitCode = 2;
    return;
  }
  if (sinceMs != null) {
    events = events.filter(e => {
      const ts = String(e?.ts || '').trim();
      const tsMs = Date.parse(ts);
      return Number.isFinite(tsMs) && tsMs >= sinceMs;
    });
  }
  if (opts.deniedOnly) events = events.filter(e => e?.denied === true || e?.ok === false);
  if (opts.agent) events = events.filter(e => String(e?.agent || '') === opts.agent);
  if (opts.tool) events = events.filter(e => String(e?.tool || '') === opts.tool);

  const tail = events.slice(-opts.last);
  const denied = events.filter(e => e?.denied === true).length;
  const failures = events.filter(e => e?.ok === false).length;
  const postEvents = events.filter(e => String(e?.phase || '') === 'post').length;
  const deniedNoPost = events.filter(
    e => e?.denied === true && String(e?.phase || '') !== 'post'
  ).length;
  const toolCalls = postEvents + deniedNoPost;

  const payload = {
    run_id: runId || null,
    tool_events_path: eventsPath,
    since: opts.since || null,
    total_events: events.length,
    tool_calls: toolCalls,
    tool_calls_notes: {
      post_events: postEvents,
      denied_without_post: deniedNoPost,
      definition: 'tool_calls = count(phase="post") + count(denied=true && phase!="post")',
    },
    denied_events: denied,
    failed_events: failures,
    top_tools: countBy(events, 'tool')
      .slice(0, 12)
      .map(([name, count]) => ({ name, count })),
    top_agents: countBy(events, 'agent')
      .slice(0, 12)
      .map(([name, count]) => ({ name, count })),
    tail,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return;
  }

  const lines = [];
  lines.push('TOOL EVENTS');
  lines.push('==========');
  lines.push(`- run_id: ${payload.run_id || '(unknown)'}`);
  lines.push(`- file: ${payload.tool_events_path}`);
  lines.push(
    `- events: ${payload.total_events} (denied ${payload.denied_events}, failed ${payload.failed_events})`
  );
  lines.push('');
  lines.push('Top tools:');
  for (const t of payload.top_tools) lines.push(`- ${t.name}: ${t.count}`);
  lines.push('');
  lines.push('Top agents:');
  for (const a of payload.top_agents) lines.push(`- ${a.name}: ${a.count}`);
  lines.push('');
  lines.push(`Tail (${tail.length}):`);
  for (const e of tail) {
    const ts = e?.ts ? String(e.ts) : '';
    const agent = e?.agent ? String(e.agent) : 'unknown';
    const phase = e?.phase ? String(e.phase) : '';
    const tool = e?.tool ? String(e.tool) : '';
    const ok = e?.ok === false ? 'FAIL' : e?.denied ? 'DENIED' : 'OK';
    const activity = e?.activity ? String(e.activity).replace(/\s+/g, ' ').trim() : '';
    const reason = e?.denied_reason ? ` :: ${String(e.denied_reason).slice(0, 120)}` : '';
    lines.push(`- ${ts} ${ok} ${agent} ${phase} ${tool} :: ${activity}${reason}`.trim());
  }
  process.stdout.write(lines.join('\n') + '\n');
}

main();
