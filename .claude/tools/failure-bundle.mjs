#!/usr/bin/env node
/**
 * Failure Bundle Generator (trace-linked, file-based)
 *
 * Produces a self-contained JSON bundle on failures (tool error, deny/block, timeout).
 * Intended to be called from hooks (fail-open) and by humans for troubleshooting.
 *
 * Default output:
 *   .claude/context/artifacts/failure-bundles/<bundle_id>.json
 *
 * Env overrides:
 * - CLAUDE_FAILURE_BUNDLES_DIR
 * - CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR
 * - CLAUDE_RUNTIME_DIR (used via runtime-scope)
 * - CLAUDE_FAILURE_BUNDLE_TAIL_LINES (default 80)
 * - CLAUDE_FAILURE_BUNDLE_TAIL_BYTES (default 131072)
 */

import { existsSync } from 'node:fs';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
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

function parseIntEnv(name, fallback) {
  const raw = Number.parseInt(String(process.env[name] || '').trim(), 10);
  return Number.isFinite(raw) ? raw : fallback;
}

const DEFAULT_TAIL_LINES = parseIntEnv('CLAUDE_FAILURE_BUNDLE_TAIL_LINES', 80);
const DEFAULT_TAIL_BYTES = parseIntEnv('CLAUDE_FAILURE_BUNDLE_TAIL_BYTES', 128 * 1024);

const DEFAULT_TOOL_EVENTS_ARTIFACTS_DIR = resolveDirEnv(
  'CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'tool-events')
);

const DEFAULT_FAILURE_BUNDLES_DIR = resolveDirEnv(
  'CLAUDE_FAILURE_BUNDLES_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'failure-bundles')
);

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function tailText(path, { maxBytes = DEFAULT_TAIL_BYTES } = {}) {
  try {
    if (!existsSync(path)) return '';
    const info = await stat(path);
    const size = Number(info.size || 0);
    const readSize = Math.max(0, Math.min(size, maxBytes));
    const start = Math.max(0, size - readSize);
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, start);
      return buf.toString('utf8');
    } finally {
      await fh.close();
    }
  } catch {
    return '';
  }
}

async function tailNdjson(
  path,
  { maxLines = DEFAULT_TAIL_LINES, maxBytes = DEFAULT_TAIL_BYTES } = {}
) {
  const text = await tailText(path, { maxBytes });
  if (!text) return [];
  const lines = text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  const slice = lines.slice(-maxLines);
  const out = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line));
    } catch {
      out.push({ _parse_error: true, line });
    }
  }
  return out;
}

export async function generateFailureBundle({
  traceId,
  spanId,
  runId = null,
  sessionKey = null,
  failureType = 'error',
  triggerEvent = null,
  debugLogPath = null,
  eventsPath: overrideEventsPath = null,
  toolEventsPath: overrideToolEventsPath = null,
  statePath: overrideStatePath = null,
  bundlesDir = DEFAULT_FAILURE_BUNDLES_DIR,
  toolEventsDir = DEFAULT_TOOL_EVENTS_ARTIFACTS_DIR,
  tailLines = DEFAULT_TAIL_LINES,
  tailBytes = DEFAULT_TAIL_BYTES,
} = {}) {
  const now = new Date().toISOString();
  const bundleId = `failure-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const runtimeScope = resolveRuntimeScope({ projectRoot: PROJECT_ROOT });
  const runtimeDir = runtimeScope.runtimeDir;
  const runsDir = join(runtimeDir, 'runs');

  const runDir = runId ? join(runsDir, runId) : null;
  const statePath = overrideStatePath || (runDir ? join(runDir, 'state.json') : null);
  const eventsPath = overrideEventsPath || (runDir ? join(runDir, 'events.ndjson') : null);
  const toolEventsPath =
    overrideToolEventsPath || (runId ? join(toolEventsDir, `run-${runId}.ndjson`) : null);

  const state = statePath ? await readJson(statePath) : null;
  const eventsTail = eventsPath
    ? await tailNdjson(eventsPath, { maxLines: tailLines, maxBytes: tailBytes })
    : [];
  const toolEventsTail = toolEventsPath
    ? await tailNdjson(toolEventsPath, { maxLines: tailLines, maxBytes: tailBytes })
    : [];

  const debugTail =
    debugLogPath && existsSync(debugLogPath)
      ? await tailText(debugLogPath, { maxBytes: tailBytes })
      : null;

  const bundle = {
    $schema: '../schemas/failure-bundle.schema.json',
    schema_version: 1,
    bundle_id: bundleId,
    triggered_at: now,
    failure_type: failureType,
    trace_id: traceId || null,
    trigger_span_id: spanId || null,
    run_id: runId,
    session_key: sessionKey,
    trigger_event: triggerEvent,
    refs: {
      runtime_dir: runtimeDir,
      run_dir: runDir,
      state_path: statePath,
      events_path: eventsPath,
      tool_events_path: toolEventsPath,
      debug_log_path: debugLogPath || null,
    },
    state_snapshot: state
      ? {
          run_id: state.run_id ?? null,
          status: state.status ?? null,
          current_agent: state.current_agent ?? null,
          current_step: state.current_step ?? null,
          errors: Array.isArray(state.errors) ? state.errors.slice(-10) : [],
          metrics: state.metrics ?? null,
        }
      : null,
    tails: {
      events_tail: eventsTail,
      tool_events_tail: toolEventsTail,
      debug_log_tail: debugTail,
      tail_lines: tailLines,
      tail_bytes: tailBytes,
    },
  };

  const outPath = join(bundlesDir, `${bundleId}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(bundle, null, 2), 'utf8');
  return { bundle_id: bundleId, bundle_path: outPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Minimal CLI:
  //   node .claude/tools/failure-bundle.mjs --run <runId> --trace <traceId> --span <spanId> --type error
  //   node .claude/tools/failure-bundle.mjs --trace <traceId> --span <spanId> --type error --events <events.ndjson> --tool-events <tool-events.ndjson>
  const args = process.argv.slice(2);
  const get = name => {
    const idx = args.indexOf(name);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };

  const res = await generateFailureBundle({
    runId: get('--run'),
    traceId: get('--trace'),
    spanId: get('--span'),
    failureType: get('--type') || 'error',
    sessionKey: get('--session'),
    debugLogPath: get('--debug-log'),
    eventsPath: get('--events'),
    toolEventsPath: get('--tool-events'),
    statePath: get('--state'),
  });

  process.stdout.write(JSON.stringify({ ok: true, ...res }, null, 2));
}
