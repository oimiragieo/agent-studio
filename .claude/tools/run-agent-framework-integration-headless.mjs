#!/usr/bin/env node
/**
 * run-agent-framework-integration-headless.mjs
 *
 * Workflow-level, process-isolated integration runner intended to avoid Claude Code UI OOM.
 *
 * It executes the same core phases as @.claude/workflows/agent-framework-integration.yaml,
 * but as a standalone CLI tool:
 * - Baseline suites (with logs redirected to files)
 * - Agent smoke via separate `claude -p` processes (delegated to run-agent-smoke-headless.mjs)
 * - Optional observability bundle generation (debug-log based)
 * - Produces standardized deliverables:
 *   - .claude/context/reports/testing/<workflow_id>-run-report.md
 *   - .claude/context/artifacts/testing/<workflow_id>-run-results.json
 *   - .claude/context/artifacts/testing/<workflow_id>-verification.json (via verifier)
 *
 * This tool is designed to be run in a normal terminal (PowerShell/CI), not inside Claude Code UI.
 */

import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

import { TraceContext } from './trace-context.mjs';
import { storePayload } from './payload-store.mjs';
import { generateFailureBundle } from './failure-bundle.mjs';

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function parseArgs(argv) {
  const args = {
    workflowId: null,
    projectRoot: null,
    debugLog: null,
    claudeBin: null,
    model: null,
    expectedAgents: 'all',
    timeoutMs: 180000,
    skipBaseline: false,
    skipSmoke: false,
    skipObservability: false,
    storePayloads: false,
    denialTest: false,
    quiet: false,
    json: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--skip-baseline') args.skipBaseline = true;
    else if (a === '--skip-smoke') args.skipSmoke = true;
    else if (a === '--skip-observability') args.skipObservability = true;
    else if (a === '--store-payloads') args.storePayloads = true;
    else if (a === '--denial-test') args.denialTest = true;
    else if (a === '--workflow-id') args.workflowId = argv[++i] || null;
    else if (a === '--project-root') args.projectRoot = argv[++i] || null;
    else if (a === '--debug-log') args.debugLog = argv[++i] || null;
    else if (a === '--claude-bin') args.claudeBin = argv[++i] || null;
    else if (a === '--model') args.model = argv[++i] || null;
    else if (a === '--expected-agents') args.expectedAgents = (argv[++i] || 'all').trim();
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i] || '0') || 0;
  }
  return args;
}

function resolveRoot(projectRoot) {
  const root = projectRoot && typeof projectRoot === 'string' ? projectRoot : process.cwd();
  return isAbsolute(root) ? root : resolve(root);
}

function defaultBaselineSpec() {
  return [
    {
      key: 'tools',
      name: 'pnpm test:tools',
      cmd: 'pnpm',
      args: ['test:tools'],
      log: 'pnpm-test-tools.log',
    },
    { key: 'test', name: 'pnpm test', cmd: 'pnpm', args: ['test'], log: 'pnpm-test.log' },
    {
      key: 'validate',
      name: 'pnpm validate',
      cmd: 'pnpm',
      args: ['validate'],
      log: 'pnpm-validate.log',
    },
    {
      key: 'validate_workflow',
      name: 'pnpm validate:workflow',
      cmd: 'pnpm',
      args: ['validate:workflow'],
      log: 'pnpm-validate-workflow.log',
    },
    {
      key: 'validate_references',
      name: 'pnpm validate:references',
      cmd: 'pnpm',
      args: ['validate:references'],
      log: 'pnpm-validate-references.log',
    },
    {
      key: 'validate_docs_links',
      name: 'pnpm validate:docs-links',
      cmd: 'pnpm',
      args: ['validate:docs-links'],
      log: 'pnpm-validate-docs-links.log',
    },
    {
      key: 'validate_agents',
      name: 'pnpm validate:agents',
      cmd: 'pnpm',
      args: ['validate:agents'],
      log: 'pnpm-validate-agents.log',
    },
    {
      key: 'workflow_dryrun',
      name: 'workflow-dryrun-suite',
      cmd: process.execPath,
      args: ['.claude/tools/workflow-dryrun-suite.mjs'],
      log: 'workflow-dryrun-suite.json',
    },
  ];
}

function readBaselineOverrideFromEnv() {
  const raw = String(process.env.LLM_RULES_HEADLESS_BASELINE_JSON || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(e => e && typeof e === 'object')
      .map(e => ({
        key: String(e.key || e.name || 'baseline'),
        name: String(e.name || e.key || 'baseline'),
        cmd: String(e.cmd || ''),
        args: Array.isArray(e.args) ? e.args.map(String) : [],
        log: String(e.log || 'baseline.log'),
      }))
      .filter(e => e.cmd);
  } catch {
    return null;
  }
}

async function writeNdjsonLine(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(obj) + '\n', 'utf8');
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(Math.max(0, Number(ms || 0)) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${totalSeconds}s`;
  return `${minutes}m ${seconds}s`;
}

function makeProgressLogger({ quiet }) {
  return (msg, extra = null) => {
    if (quiet) return;
    const ts = new Date().toISOString();
    const suffix = extra && typeof extra === 'object' ? ` ${JSON.stringify(extra)}` : '';
    try {
      process.stderr.write(`[headless] ${ts} ${msg}${suffix}\n`);
    } catch {
      // ignore
    }
  };
}

async function withHeartbeat({ label, log, intervalMs = 15_000 }, fn) {
  const started = Date.now();
  const t =
    intervalMs > 0
      ? setInterval(() => {
          log(`${label} still running`, { elapsed: formatElapsed(Date.now() - started) });
        }, intervalMs)
      : null;
  try {
    return await fn();
  } finally {
    if (t) clearInterval(t);
  }
}

async function listAgentNames(agentDir) {
  try {
    const entries = await readdir(agentDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.replace(/\.md$/i, ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function runCommandToLog({ cmd, args, cwd, logPath, timeoutMs }) {
  return await new Promise(resolveRun => {
    const useCmdShim =
      process.platform === 'win32' &&
      typeof cmd === 'string' &&
      !/[\\/]/.test(cmd) &&
      !/\.[a-z0-9]+$/i.test(cmd) &&
      cmd !== process.execPath;

    const child = useCmdShim
      ? spawn('cmd.exe', ['/d', '/s', '/c', cmd, ...(args || [])], {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsVerbatimArguments: true,
        })
      : spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    const start = Date.now();

    const killTimer =
      timeoutMs > 0
        ? setTimeout(() => {
            try {
              child.kill('SIGTERM');
            } catch {
              // ignore
            }
          }, timeoutMs)
        : null;

    child.stdout.on('data', c => (stdout += c));
    child.stderr.on('data', c => (stderr += c));
    child.on('error', err => {
      if (killTimer) clearTimeout(killTimer);
      resolveRun({
        ok: false,
        code: 1,
        duration_ms: Date.now() - start,
        stdout,
        stderr: `${stderr}\n${err?.message || err}`.trim(),
      });
    });
    child.on('close', code => {
      if (killTimer) clearTimeout(killTimer);
      resolveRun({
        ok: code === 0,
        code: code ?? 1,
        duration_ms: Date.now() - start,
        stdout,
        stderr,
      });
    });
  }).then(async res => {
    const combined = `${res.stdout || ''}${res.stderr ? `\n${res.stderr}` : ''}`;
    await mkdir(dirname(logPath), { recursive: true });
    await writeFile(logPath, combined, 'utf8');
    return { ...res, log_path: logPath };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = resolveRoot(args.projectRoot);
  const workflowId = args.workflowId || `agent-integration-v1-${nowStamp()}`;
  const startedAt = new Date().toISOString();
  const runId = `headless-${randomUUID()}`;
  const storePayloads =
    args.storePayloads || String(process.env.CLAUDE_OBS_STORE_PAYLOADS || '').trim() === '1';
  const log = makeProgressLogger({ quiet: args.quiet });

  const headlessRunDir = join(
    projectRoot,
    '.claude',
    'context',
    'runtime',
    'headless',
    'runs',
    runId
  );
  const eventsPath = join(headlessRunDir, 'events.ndjson');
  const toolEventsPath = join(headlessRunDir, 'tool-events.ndjson');
  const statePath = join(headlessRunDir, 'state.json');

  const rootTrace = new TraceContext({
    baggage: { workflow_id: workflowId, run_id: runId, mode: 'headless' },
  });

  await mkdir(headlessRunDir, { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify(
      {
        schema_version: 1,
        run_id: runId,
        workflow_id: workflowId,
        mode: 'headless',
        status: 'running',
        started_at: startedAt,
      },
      null,
      2
    ),
    'utf8'
  );

  await writeNdjsonLine(eventsPath, {
    ts: startedAt,
    trace_id: rootTrace.trace_id,
    span_id: rootTrace.span_id,
    parent_span_id: null,
    traceparent: rootTrace.traceparent,
    tracestate: null,
    baggage: rootTrace.baggage,
    span_kind: 'chain',
    event_type: 'SpanStart',
    span_state: 'start',
    span_name: 'headless:integration',
    phase: 'start',
    run_id: runId,
    session_key: workflowId,
    agent: 'headless-runner',
    tool: null,
    activity: 'headless integration start',
    ok: true,
  });

  if (!/^agent-integration-v1-\d{8}-\d{6}$/.test(workflowId)) {
    die(`workflow_id must match agent-integration-v1-<YYYYMMDD-HHMMSS> (got: ${workflowId})`);
  }

  if (!existsSync(join(projectRoot, 'package.json'))) {
    die(`project root does not look valid (missing package.json): ${projectRoot}`);
  }

  const logsDir = join(
    projectRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-logs`
  );
  await mkdir(logsDir, { recursive: true });

  const baselineSpec = readBaselineOverrideFromEnv() || defaultBaselineSpec();
  const baselineResults = [];
  let baselineOk = true;
  let firstFailure = null;
  let failureBundle = null;

  if (!args.skipBaseline) {
    log('Starting baseline suites', { workflow_id: workflowId, run_id: runId });
    for (const s of baselineSpec) {
      const span = rootTrace.childSpan({ step: s.key || s.name, kind: 'baseline' });
      const spanStart = new Date().toISOString();
      await writeNdjsonLine(eventsPath, {
        ts: spanStart,
        trace_id: span.trace_id,
        span_id: span.span_id,
        parent_span_id: span.parent_span_id,
        traceparent: span.traceparent,
        tracestate: null,
        baggage: { ...rootTrace.baggage, step: s.key || s.name },
        span_kind: 'tool',
        event_type: 'ToolCallStart',
        span_state: 'start',
        span_name: `tool:${s.name}`,
        phase: 'pre',
        run_id: runId,
        session_key: workflowId,
        agent: 'headless-runner',
        tool: s.cmd,
        activity: s.name,
        ok: true,
      });

      const logPath = join(logsDir, s.log);
      log(`Running ${s.name}`, { log: logPath });
      const res = await withHeartbeat({ label: s.name, log }, async () => {
        return await runCommandToLog({
          cmd: s.cmd,
          args: s.args,
          cwd: projectRoot,
          logPath,
          timeoutMs: 0,
        });
      });
      baselineResults.push({ key: s.key, name: s.name, ...res });
      log(`Finished ${s.name}`, {
        ok: res.ok,
        exit_code: res.code,
        duration: formatElapsed(res.duration_ms),
      });

      const spanEnd = new Date().toISOString();
      let payloadMeta = null;
      if (storePayloads) {
        payloadMeta = await storePayload({
          traceId: span.trace_id,
          spanId: span.span_id,
          runId,
          sessionKey: workflowId,
          spanName: `tool:${s.name}`,
          eventType: 'ToolCallStop',
          inputs: { cmd: s.cmd, args: s.args, cwd: projectRoot },
          outputs: { ok: res.ok, exit_code: res.code, log_path: res.log_path },
        }).catch(() => null);
      }

      await writeNdjsonLine(eventsPath, {
        ts: spanEnd,
        trace_id: span.trace_id,
        span_id: span.span_id,
        parent_span_id: span.parent_span_id,
        traceparent: span.traceparent,
        tracestate: null,
        baggage: { ...rootTrace.baggage, step: s.key || s.name },
        span_kind: 'tool',
        event_type: 'ToolCallStop',
        span_state: 'end',
        span_name: `tool:${s.name}`,
        phase: 'post',
        run_id: runId,
        session_key: workflowId,
        agent: 'headless-runner',
        tool: s.cmd,
        activity: s.name,
        ok: res.ok,
        duration_ms: res.duration_ms,
        ...(res.ok
          ? {}
          : { error: String(res.stderr || res.stdout || 'command failed').slice(0, 400) }),
        ...(payloadMeta ? { payload: payloadMeta } : {}),
      });

      await writeNdjsonLine(toolEventsPath, {
        ts: spanEnd,
        trace_id: span.trace_id,
        span_id: span.span_id,
        parent_span_id: span.parent_span_id,
        run_id: runId,
        session_key: workflowId,
        agent: 'headless-runner',
        tool: s.cmd,
        activity: s.name,
        ok: res.ok,
        denied: false,
        exit_code: res.code,
        log_path: res.log_path,
      });

      if (!res.ok) {
        baselineOk = false;
        firstFailure = { step: s, result: res };
        if (String(process.env.CLAUDE_OBS_FAILURE_BUNDLES || '').trim() === '1') {
          failureBundle = await generateFailureBundle({
            traceId: span.trace_id,
            spanId: span.span_id,
            runId: null,
            sessionKey: workflowId,
            failureType: 'baseline_failed',
            triggerEvent: { step: s.key || s.name, cmd: s.cmd, args: s.args, exit_code: res.code },
            debugLogPath: args.debugLog,
            eventsPath,
            toolEventsPath,
            statePath,
          }).catch(() => null);
        }
        break;
      }
    }
  }

  let smoke = null;
  let smokeOk = true;
  if (!args.skipSmoke && baselineOk) {
    log('Starting agent smoke (headless)', { expected_agents: args.expectedAgents || 'all' });
    const smokeSpan = rootTrace.childSpan({ step: 'agent_smoke', kind: 'smoke' });
    const smokeStart = new Date().toISOString();
    await writeNdjsonLine(eventsPath, {
      ts: smokeStart,
      trace_id: smokeSpan.trace_id,
      span_id: smokeSpan.span_id,
      parent_span_id: smokeSpan.parent_span_id,
      traceparent: smokeSpan.traceparent,
      tracestate: null,
      baggage: { ...rootTrace.baggage, step: 'agent_smoke' },
      span_kind: 'chain',
      event_type: 'SpanStart',
      span_state: 'start',
      span_name: 'headless:agent-smoke',
      phase: 'pre',
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'claude',
      activity: 'agent smoke (headless)',
      ok: true,
    });

    const smokeArgs = [
      '.claude/tools/run-agent-smoke-headless.mjs',
      '--workflow-id',
      workflowId,
      '--expected-agents',
      args.expectedAgents || 'all',
      '--timeout-ms',
      String(args.timeoutMs || 180000),
    ];
    if (args.claudeBin) smokeArgs.push('--claude-bin', args.claudeBin);
    if (args.model) smokeArgs.push('--model', args.model);

    const smokeMode = String(args.expectedAgents || 'all')
      .trim()
      .toLowerCase();
    const agentDir = join(projectRoot, '.claude', 'agents');
    const allAgents = await listAgentNames(agentDir);
    const expectedAgentCount =
      smokeMode === 'core'
        ? allAgents.filter(a =>
            new Set([
              'router',
              'orchestrator',
              'developer',
              'qa',
              'analyst',
              'security-architect',
              'performance-engineer',
              'technical-writer',
            ]).has(a)
          ).length
        : allAgents.length;

    // Global smoke timeout should be generous: claude startup + per-agent timeouts stack up.
    // Default `pnpm integration:headless:json` uses `--timeout-ms 30000` per agent, but real runs
    // can take ~60-90s per agent. Use a higher multiplier and a sane minimum.
    const smokeProcessTimeoutMs =
      args.timeoutMs > 0
        ? Math.max(10 * 60_000, args.timeoutMs * Math.max(1, expectedAgentCount) * 3)
        : 0;

    const smokeLogPath = join(logsDir, 'agent-smoke-headless.log');
    log('Running run-agent-smoke-headless.mjs', {
      log: smokeLogPath,
      expected_agents: expectedAgentCount,
      per_agent_timeout_ms: args.timeoutMs || 0,
      timeout_ms: smokeProcessTimeoutMs,
    });
    const smokeRun = await withHeartbeat({ label: 'agent smoke (headless)', log }, async () => {
      return await runCommandToLog({
        cmd: process.execPath,
        args: smokeArgs,
        cwd: projectRoot,
        logPath: smokeLogPath,
        timeoutMs: smokeProcessTimeoutMs,
      });
    });

    try {
      smoke = JSON.parse(String(smokeRun.stdout || '').trim() || '{}');
    } catch {
      smoke = null;
    }
    smokeOk = smokeRun.ok && smoke && typeof smoke === 'object' && smoke.failed === 0;

    // Emit per-agent receipt summary events without embedding full transcript.
    const smokeSummaryPath =
      smoke && typeof smoke.summary_file === 'string'
        ? smoke.summary_file
        : join(
            projectRoot,
            '.claude',
            'context',
            'artifacts',
            'testing',
            `${workflowId}-agent-smoke`,
            '_summary.json'
          );

    await writeNdjsonLine(eventsPath, {
      ts: new Date().toISOString(),
      trace_id: smokeSpan.trace_id,
      span_id: smokeSpan.span_id,
      parent_span_id: smokeSpan.parent_span_id,
      traceparent: smokeSpan.traceparent,
      tracestate: null,
      baggage: { ...rootTrace.baggage, step: 'agent_smoke' },
      span_kind: 'chain',
      event_type: 'SpanEnd',
      span_state: 'end',
      span_name: 'headless:agent-smoke',
      phase: 'post',
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'claude',
      activity: 'agent smoke (headless)',
      ok: smokeOk,
      duration_ms: smokeRun.duration_ms,
      ...(smoke ? { metrics: { smoke_total: smoke.total, smoke_failed: smoke.failed } } : {}),
      observability_ref: { smoke_summary_path: smokeSummaryPath },
    });

    await writeNdjsonLine(toolEventsPath, {
      ts: new Date().toISOString(),
      trace_id: smokeSpan.trace_id,
      span_id: smokeSpan.span_id,
      parent_span_id: smokeSpan.parent_span_id,
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'claude',
      activity: 'agent smoke (headless)',
      ok: smokeOk,
      denied: false,
      log_path: smokeLogPath,
    });

    if (!smokeOk) {
      baselineOk = false;
      firstFailure = firstFailure || { step: { name: 'agent smoke headless' }, result: smokeRun };
      if (!failureBundle && String(process.env.CLAUDE_OBS_FAILURE_BUNDLES || '').trim() === '1') {
        failureBundle = await generateFailureBundle({
          traceId: smokeSpan.trace_id,
          spanId: smokeSpan.span_id,
          runId: null,
          sessionKey: workflowId,
          failureType: 'agent_smoke_failed',
          triggerEvent: {
            failed: smoke?.failed ?? null,
            total: smoke?.total ?? null,
            log_path: smokeRun.log_path,
          },
          debugLogPath: args.debugLog,
          eventsPath,
          toolEventsPath,
          statePath,
        }).catch(() => null);
      }
    }
  }

  let denial = null;
  if (args.denialTest && baselineOk) {
    log('Starting denial test (headless)', {});
    const denialSpan = rootTrace.childSpan({ step: 'denial_test', kind: 'denial' });
    const denialStart = new Date().toISOString();
    await writeNdjsonLine(eventsPath, {
      ts: denialStart,
      trace_id: denialSpan.trace_id,
      span_id: denialSpan.span_id,
      parent_span_id: denialSpan.parent_span_id,
      traceparent: denialSpan.traceparent,
      tracestate: null,
      baggage: { ...rootTrace.baggage, step: 'denial_test' },
      span_kind: 'guard',
      event_type: 'GuardDecision',
      span_state: 'start',
      span_name: 'headless:denial-test',
      phase: 'pre',
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'claude',
      activity: 'denial test (headless)',
      ok: true,
    });

    const denialArgs = [
      '.claude/tools/run-guard-denial-headless.mjs',
      '--workflow-id',
      workflowId,
      '--timeout-ms',
      String(args.timeoutMs || 180000),
    ];
    if (args.claudeBin) denialArgs.push('--claude-bin', args.claudeBin);

    const denialLogPath = join(logsDir, 'guard-denial-headless.log');
    const denialRun = await withHeartbeat({ label: 'denial test (headless)', log }, async () => {
      return await runCommandToLog({
        cmd: process.execPath,
        args: denialArgs,
        cwd: projectRoot,
        logPath: denialLogPath,
        timeoutMs: args.timeoutMs > 0 ? Math.max(15_000, args.timeoutMs + 30_000) : 0,
      });
    });

    try {
      denial = JSON.parse(String(denialRun.stdout || '').trim() || '{}');
    } catch {
      denial = null;
    }

    const denied = Boolean(denial && typeof denial === 'object' && denial.denied === true);
    await writeNdjsonLine(eventsPath, {
      ts: new Date().toISOString(),
      trace_id: denialSpan.trace_id,
      span_id: denialSpan.span_id,
      parent_span_id: denialSpan.parent_span_id,
      traceparent: denialSpan.traceparent,
      tracestate: null,
      baggage: { ...rootTrace.baggage, step: 'denial_test' },
      span_kind: 'guard',
      event_type: 'GuardDecision',
      span_state: 'end',
      span_name: 'headless:denial-test',
      phase: 'post',
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'claude',
      activity: 'denial test (headless)',
      ok: denied,
      duration_ms: denialRun.duration_ms,
      ...(denied
        ? {}
        : { error: 'denial not observed (hook may be disabled or claude not configured)' }),
    });

    await writeNdjsonLine(toolEventsPath, {
      ts: new Date().toISOString(),
      trace_id: denialSpan.trace_id,
      span_id: denialSpan.span_id,
      parent_span_id: denialSpan.parent_span_id,
      run_id: runId,
      session_key: workflowId,
      agent: 'headless-runner',
      tool: 'Read',
      activity: 'denial test (headless)',
      ok: denied,
      denied: denied,
      denied_by: denied ? String(denial.denied_by || 'read-path-guard') : null,
      exit_code: denialRun.code,
      log_path: denialLogPath,
    });
  }

  let observability = null;
  if (!args.skipObservability && baselineOk) {
    log('Generating observability bundle', {});
    const obsArgs = [
      '.claude/tools/observability-bundle.mjs',
      '--id',
      workflowId,
      '--output-root',
      '.claude/context',
    ];
    if (args.debugLog) obsArgs.push('--debug-log', args.debugLog);
    const obsLogPath = join(logsDir, 'observability-bundle.log');
    const obsRun = await withHeartbeat({ label: 'observability bundle', log }, async () => {
      return await runCommandToLog({
        cmd: process.execPath,
        args: obsArgs,
        cwd: projectRoot,
        logPath: obsLogPath,
        timeoutMs: 300000,
      });
    });
    try {
      observability = JSON.parse(String(obsRun.stdout || '').trim() || '{}');
    } catch {
      observability = null;
    }
  }

  const status = baselineOk ? 'PASS' : 'FAIL';
  const finishedAt = new Date().toISOString();

  const resultsPath = join(
    projectRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-run-results.json`
  );
  const reportPath = join(
    projectRoot,
    '.claude',
    'context',
    'reports',
    'testing',
    `${workflowId}-run-report.md`
  );

  const suiteStatuses = {
    test: baselineResults.find(r => r.key === 'test')
      ? { exit_code: baselineResults.find(r => r.key === 'test').code }
      : { exit_code: args.skipBaseline ? 0 : 1 },
    tools: baselineResults.find(r => r.key === 'tools')
      ? { exit_code: baselineResults.find(r => r.key === 'tools').code }
      : { exit_code: args.skipBaseline ? 0 : 1 },
    validate: baselineResults.find(r => r.key === 'validate')
      ? { exit_code: baselineResults.find(r => r.key === 'validate').code }
      : { exit_code: args.skipBaseline ? 0 : 1 },
    workflow_dryrun: baselineResults.find(r => r.key === 'workflow_dryrun')
      ? { exit_code: baselineResults.find(r => r.key === 'workflow_dryrun').code }
      : { exit_code: args.skipBaseline ? 0 : 1 },
  };

  const payload = {
    workflow_id: workflowId,
    started_at: startedAt,
    finished_at: finishedAt,
    status,
    run_id: runId,
    baseline: {
      ok: args.skipBaseline ? null : baselineOk,
      logs_dir: logsDir,
      steps: baselineResults.map(r => ({
        key: r.key,
        name: r.name,
        ok: r.ok,
        exit_code: r.code,
        duration_ms: r.duration_ms,
        log_path: r.log_path,
      })),
      first_failure: firstFailure
        ? {
            name: firstFailure.step?.name || firstFailure.step?.key || 'unknown',
            log_path: firstFailure.result?.log_path || null,
            exit_code: firstFailure.result?.code ?? null,
          }
        : null,
    },
    agent_smoke_testing: smoke,
    observability_bundle: observability,
    suite_statuses: suiteStatuses,
    agent_smoke_receipts_path: join(
      projectRoot,
      '.claude',
      'context',
      'artifacts',
      'testing',
      `${workflowId}-agent-smoke`
    ),
    denial_test: denial,
    observability_paths: {
      events: eventsPath,
      tool_events: toolEventsPath,
      state: statePath,
      bundles_dir: join(projectRoot, '.claude', 'context', 'artifacts', 'failure-bundles'),
    },
    failure_bundle: failureBundle,
  };

  await mkdir(dirname(resultsPath), { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(resultsPath, JSON.stringify(payload, null, 2), 'utf8');

  const lines = [];
  lines.push(`# Agent Framework Integration (Headless): ${workflowId}`);
  lines.push('');
  lines.push(`- Status: ${status}`);
  lines.push(`- Results JSON: \`${resultsPath}\``);
  lines.push(`- Logs dir: \`${logsDir}\``);
  lines.push(`- Smoke receipts: \`${payload.agent_smoke_receipts_path}\``);
  if (args.debugLog) lines.push(`- Debug log: \`${args.debugLog}\``);
  lines.push('');
  lines.push('## Baseline');
  if (args.skipBaseline) lines.push('- Skipped');
  else {
    for (const r of baselineResults) {
      lines.push(`- ${r.name}: ${r.ok ? 'PASS' : 'FAIL'} (exit ${r.code}) \`${r.log_path}\``);
    }
    const dryrun = baselineResults.find(r => r.key === 'workflow_dryrun');
    if (dryrun && typeof dryrun.log_path === 'string' && existsSync(dryrun.log_path)) {
      try {
        const dryrunJson = JSON.parse(await readFile(dryrun.log_path, 'utf8'));
        const warningsTotal = Number(dryrunJson?.warnings_total ?? 0);
        lines.push(
          `- Workflow dry-run warnings: ${Number.isFinite(warningsTotal) ? warningsTotal : 0}`
        );
      } catch {
        lines.push('- Workflow dry-run warnings: (unavailable)');
      }
    }
  }
  lines.push('');
  if (smoke) {
    lines.push('## Agent Smoke (Headless)');
    lines.push(`- Total: ${smoke.total} | Passed: ${smoke.passed} | Failed: ${smoke.failed}`);
    lines.push(
      `- Summary: \`${smoke.summary_file || join(payload.agent_smoke_receipts_path, '_summary.json')}\``
    );
    lines.push('');
  }

  if (denial) {
    lines.push('## Denial Test (Headless)');
    lines.push(
      `- Denied: ${denial.denied ? 'true' : 'false'} | denied_by: ${denial.denied_by || 'unknown'}`
    );
    lines.push('');
  }

  if (storePayloads) {
    lines.push('## Payload Proof');
    lines.push('- payload_ref present in headless events (payload storage enabled)');
    lines.push('');
  }

  await writeFile(reportPath, lines.join('\n') + '\n', 'utf8');

  // Verification: run verifier in headless mode so it doesn't require runtime events/tool-events.
  log('Running verify-agent-integration (headless mode)', {});
  const verifyArgs = [
    '.claude/tools/verify-agent-integration.mjs',
    '--workflow-id',
    workflowId,
    '--expected-agents',
    args.expectedAgents || 'all',
    '--mode',
    'headless',
    '--json',
  ];
  const verifyRun = await runCommandToLog({
    cmd: process.execPath,
    args: verifyArgs,
    cwd: projectRoot,
    logPath: join(logsDir, 'verify-agent-integration.log'),
    timeoutMs: 60000,
  });
  log('Finished verify-agent-integration', { exit_code: verifyRun.code });

  const out = {
    ok: status === 'PASS',
    workflow_id: workflowId,
    report_path: reportPath,
    results_path: resultsPath,
    logs_dir: logsDir,
    verification_log: verifyRun.log_path,
  };

  await writeFile(
    statePath,
    JSON.stringify(
      {
        schema_version: 1,
        run_id: runId,
        workflow_id: workflowId,
        mode: 'headless',
        status: status.toLowerCase(),
        started_at: startedAt,
        finished_at: finishedAt,
        results_path: resultsPath,
        report_path: reportPath,
      },
      null,
      2
    ),
    'utf8'
  );

  await writeNdjsonLine(eventsPath, {
    ts: finishedAt,
    trace_id: rootTrace.trace_id,
    span_id: rootTrace.span_id,
    parent_span_id: null,
    traceparent: rootTrace.traceparent,
    tracestate: null,
    baggage: rootTrace.baggage,
    span_kind: 'chain',
    event_type: 'SpanEnd',
    span_state: 'end',
    span_name: 'headless:integration',
    phase: 'stop',
    run_id: runId,
    session_key: workflowId,
    agent: 'headless-runner',
    tool: null,
    activity: 'headless integration stop',
    ok: status === 'PASS',
  });

  if (args.json) process.stdout.write(JSON.stringify(out, null, 2));
  else process.stdout.write(JSON.stringify(out));
  process.exit(status === 'PASS' ? 0 : 1);
}

main().catch(err => die(err?.stack || err?.message || String(err), 1));
