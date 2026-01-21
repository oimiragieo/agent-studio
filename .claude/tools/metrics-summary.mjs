#!/usr/bin/env node
/**
 * Metrics Summary (run-observer)
 *
 * CrewAI-inspired: quick insight into what's slow/noisy without requiring a dashboard.
 *
 * Usage:
 *   node .claude/tools/metrics-summary.mjs
 *   node .claude/tools/metrics-summary.mjs --run-id <id>
 *   node .claude/tools/metrics-summary.mjs --json
 */

import { existsSync, readFileSync } from 'node:fs';
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
  const out = { runId: '', json: false, help: false, top: 10 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--json') out.json = true;
    else if (a === '--run-id') {
      out.runId = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--run-id=')) out.runId = a.slice('--run-id='.length);
    else if (a === '--top') {
      out.top = Number(argv[i + 1] || 10);
      i += 1;
    } else if (a.startsWith('--top=')) out.top = Number(a.slice('--top='.length));
  }
  if (!Number.isFinite(out.top) || out.top <= 0) out.top = 10;
  out.top = Math.min(out.top, 50);
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

function ms(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

function topByTotal(obj, topN) {
  const entries = Object.entries(obj || {}).map(([k, v]) => [k, v]);
  entries.sort((a, b) => Number(b[1]?.total_ms || 0) - Number(a[1]?.total_ms || 0));
  return entries.slice(0, topN);
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'metrics-summary',
        '',
        'Usage:',
        '  node .claude/tools/metrics-summary.mjs [--run-id <id>] [--top <n>] [--json]',
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

  const statePath = join(RUNS_DIR, runId, 'state.json');
  const state = readJson(statePath);
  if (!state) {
    process.stdout.write(
      opts.json
        ? JSON.stringify({ error: 'missing_state', run_id: runId })
        : `Missing ${statePath}\n`
    );
    process.exitCode = 1;
    return;
  }

  const metrics = state.metrics && typeof state.metrics === 'object' ? state.metrics : {};
  const tools = metrics.tools && typeof metrics.tools === 'object' ? metrics.tools : {};
  const agents = metrics.agents && typeof metrics.agents === 'object' ? metrics.agents : {};

  const payload = {
    run_id: runId,
    state_path: statePath,
    status: state.status || null,
    total_tool_calls: metrics.total_tool_calls ?? 0,
    total_tool_duration_ms: metrics.total_tool_duration_ms ?? 0,
    last_tool: metrics.last_tool ?? null,
    last_tool_agent: metrics.last_tool_agent ?? null,
    last_tool_duration_ms: metrics.last_tool_duration_ms ?? null,
    errors: Array.isArray(state.errors) ? state.errors.slice(-5) : [],
    top_tools: topByTotal(tools, opts.top).map(([name, v]) => ({
      name,
      count: v?.count ?? 0,
      total_ms: ms(v?.total_ms) ?? 0,
      max_ms: ms(v?.max_ms) ?? 0,
      last_ms: ms(v?.last_ms),
    })),
    top_agents: topByTotal(agents, opts.top).map(([name, v]) => ({
      name,
      count: v?.count ?? 0,
      total_ms: ms(v?.total_ms) ?? 0,
      max_ms: ms(v?.max_ms) ?? 0,
      last_ms: ms(v?.last_ms),
    })),
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return;
  }

  const lines = [];
  lines.push(`METRICS (${runId})`);
  lines.push(`- status: ${payload.status || 'unknown'}`);
  lines.push(`- tool calls: ${payload.total_tool_calls}`);
  lines.push(`- tool time: ${ms(payload.total_tool_duration_ms) ?? 0}ms`);
  if (payload.last_tool) {
    lines.push(
      `- last: ${payload.last_tool} (${payload.last_tool_agent || 'unknown'}) ${ms(payload.last_tool_duration_ms) ?? ''}ms`.trim()
    );
  }
  if (payload.errors.length) {
    lines.push('- recent errors:');
    for (const e of payload.errors) {
      lines.push(
        `  - ${e?.at || ''} ${e?.agent || ''} ${e?.tool || ''}: ${String(e?.message || '').slice(0, 160)}`.trim()
      );
    }
  }
  lines.push('');
  lines.push(`TOP TOOLS (by total_ms)`);
  for (const t of payload.top_tools)
    lines.push(`- ${t.name}: ${t.total_ms}ms (${t.count} calls, max ${t.max_ms}ms)`);
  lines.push('');
  lines.push(`TOP AGENTS (by total_ms)`);
  for (const a of payload.top_agents)
    lines.push(`- ${a.name}: ${a.total_ms}ms (${a.count} calls, max ${a.max_ms}ms)`);
  process.stdout.write(lines.join('\n') + '\n');
}

main();
