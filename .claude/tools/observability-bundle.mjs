#!/usr/bin/env node
/**
 * Observability Bundle (enterprise snapshot)
 *
 * Creates a single, auditable snapshot of:
 * - Claude Code debug log analysis (optional)
 * - run-observer runtime events tail
 * - run-observer metrics summary
 * - resume/status summary (runs + jobs)
 * - tool-events dashboard summary
 * - active project context (runtime scope)
 *
 * Writes:
 * - JSON bundle:  <outputRoot>/artifacts/observability/<id>/bundle.json
 * - Markdown report: <outputRoot>/reports/observability/<id>-report.md
 *
 * Usage:
 *   node .claude/tools/observability-bundle.mjs --debug-log "C:\\Users\\you\\.claude\\debug\\<id>.txt"
 *   node .claude/tools/observability-bundle.mjs --id obs-20260119-010203 --output-root .claude/context
 *   node .claude/tools/observability-bundle.mjs --output-root .tmp/obs --debug-log .tmp/sample-debug.txt
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function nowId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `obs-${y}${m}${day}-${hh}${mm}${ss}`;
}

function resolvePath(p) {
  const raw = String(p || '').trim();
  if (!raw) return '';
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

function parseArgs(argv) {
  const out = {
    id: '',
    debugLog: '',
    testingRun: '',
    outputRoot: join(PROJECT_ROOT, '.claude', 'context'),
    eventsLines: 80,
    toolEventsLast: 120,
    top: 12,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--id') {
      out.id = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--id=')) out.id = a.slice('--id='.length);
    else if (a === '--debug-log') {
      out.debugLog = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--debug-log=')) out.debugLog = a.slice('--debug-log='.length);
    else if (a === '--testing-run') {
      out.testingRun = String(argv[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--testing-run=')) out.testingRun = a.slice('--testing-run='.length);
    else if (a === '--output-root') {
      out.outputRoot = resolvePath(argv[i + 1]);
      i += 1;
    } else if (a.startsWith('--output-root='))
      out.outputRoot = resolvePath(a.slice('--output-root='.length));
    else if (a === '--events-lines') {
      out.eventsLines = Number(argv[i + 1] || 80);
      i += 1;
    } else if (a.startsWith('--events-lines='))
      out.eventsLines = Number(a.slice('--events-lines='.length));
    else if (a === '--tool-events-last') {
      out.toolEventsLast = Number(argv[i + 1] || 120);
      i += 1;
    } else if (a.startsWith('--tool-events-last='))
      out.toolEventsLast = Number(a.slice('--tool-events-last='.length));
    else if (a === '--top') {
      out.top = Number(argv[i + 1] || 12);
      i += 1;
    } else if (a.startsWith('--top=')) out.top = Number(a.slice('--top='.length));
  }

  if (!Number.isFinite(out.eventsLines) || out.eventsLines <= 0) out.eventsLines = 80;
  out.eventsLines = Math.min(out.eventsLines, 500);

  if (!Number.isFinite(out.toolEventsLast) || out.toolEventsLast <= 0) out.toolEventsLast = 120;
  out.toolEventsLast = Math.min(out.toolEventsLast, 500);

  if (!Number.isFinite(out.top) || out.top <= 0) out.top = 12;
  out.top = Math.min(out.top, 50);

  out.id = String(out.id || '').trim() || nowId();
  out.debugLog = String(out.debugLog || '').trim();
  out.testingRun = String(out.testingRun || '').trim();
  return out;
}

function usage() {
  process.stdout.write(
    [
      'observability-bundle',
      '',
      'Usage:',
      '  node .claude/tools/observability-bundle.mjs [options]',
      '',
      'Options:',
      '  --id <id>                   Bundle id (default: obs-YYYYMMDD-HHMMSS)',
      '  --debug-log <path>          Claude Code debug log path (optional)',
      '  --testing-run <workflow_id> Include a testing run results/logs summary (optional)',
      '  --output-root <dir>         Root output dir (default: .claude/context)',
      '  --events-lines <n>          events-tail lines (default: 80)',
      '  --tool-events-last <n>      tool-events-dashboard tail size (default: 120)',
      '  --top <n>                   top tools/agents in summaries (default: 12)',
      '',
      'Outputs:',
      '  <outputRoot>/artifacts/observability/<id>/bundle.json',
      '  <outputRoot>/reports/observability/<id>-report.md',
      '',
    ].join('\n')
  );
}

function runNode(scriptRel, args, { timeoutMs = 20000 } = {}) {
  const script = resolvePath(scriptRel);
  const proc = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    cwd: PROJECT_ROOT,
    env: { ...process.env },
  });

  return {
    ok: proc.status === 0,
    exitCode: proc.status ?? null,
    timedOut: Boolean(proc.error && String(proc.error).includes('ETIMEDOUT')),
    stdout: String(proc.stdout || ''),
    stderr: String(proc.stderr || ''),
    error: proc.error ? String(proc.error.message || proc.error) : null,
    cmd: [process.execPath, script, ...args],
  };
}

function tryJson(text) {
  try {
    return JSON.parse(String(text || '').trim());
  } catch {
    return null;
  }
}

async function tryJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function writeUtf8(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    usage();
    process.exit(0);
  }

  const outputRoot = resolvePath(opts.outputRoot);
  const artifactsDir = join(outputRoot, 'artifacts', 'observability', opts.id);
  const reportsDir = join(outputRoot, 'reports', 'observability');
  const bundlePath = join(artifactsDir, 'bundle.json');
  const reportPath = join(reportsDir, `${opts.id}-report.md`);

  const startedAt = new Date().toISOString();
  const runs = [];

  // Always include project scope context (runtime namespace + active project)
  const projectCurrent = runNode('.claude/tools/project.mjs', ['current'], { timeoutMs: 8000 });
  runs.push({ name: 'project.current', ...projectCurrent });

  const eventsTail = runNode(
    '.claude/tools/events-tail.mjs',
    ['--lines', String(opts.eventsLines), '--json'],
    {
      timeoutMs: 12000,
    }
  );
  runs.push({ name: 'events.tail', ...eventsTail });

  const metricsSummary = runNode(
    '.claude/tools/metrics-summary.mjs',
    ['--json', '--top', String(opts.top)],
    {
      timeoutMs: 12000,
    }
  );
  runs.push({ name: 'metrics.summary', ...metricsSummary });

  const resumeStatus = runNode('.claude/tools/resume-status.mjs', ['--json'], { timeoutMs: 12000 });
  runs.push({ name: 'resume.status', ...resumeStatus });

  const toolEvents = runNode(
    '.claude/tools/tool-events-dashboard.mjs',
    ['--json', '--last', String(opts.toolEventsLast)],
    { timeoutMs: 12000 }
  );
  runs.push({ name: 'tool-events.dashboard', ...toolEvents });

  let debugAnalysis = null;
  let debugLogUsed = '';
  if (opts.debugLog) {
    const debugPath = resolvePath(opts.debugLog);
    debugLogUsed = debugPath;
    if (existsSync(debugPath)) {
      const analyzed = runNode('scripts/analyze-claude-debug.mjs', ['--json', debugPath], {
        timeoutMs: 20000,
      });
      runs.push({ name: 'debug.analyze', ...analyzed });
      debugAnalysis = tryJson(analyzed.stdout);
    } else {
      runs.push({
        name: 'debug.analyze',
        ok: false,
        exitCode: 2,
        timedOut: false,
        stdout: '',
        stderr: '',
        error: `Debug log not found: ${debugPath}`,
        cmd: ['(read)', debugPath],
      });
    }
  }

  let testingRun = null;
  if (opts.testingRun) {
    const workflowId = opts.testingRun;
    const resultsPath = join(outputRoot, 'artifacts', 'testing', `${workflowId}-run-results.json`);
    const reportPathForRun = join(outputRoot, 'reports', 'testing', `${workflowId}-run-report.md`);
    const logsDir = join(outputRoot, 'artifacts', 'testing', `${workflowId}-logs`);
    const denialPath = join(outputRoot, 'artifacts', 'testing', `${workflowId}-denial.json`);

    const results = existsSync(resultsPath) ? await tryJsonFile(resultsPath) : null;
    const denial = existsSync(denialPath) ? await tryJsonFile(denialPath) : null;

    testingRun = {
      workflow_id: workflowId,
      status: results?.status ?? null,
      results_path: resultsPath,
      report_path: reportPathForRun,
      logs_dir: logsDir,
      denial_path: existsSync(denialPath) ? denialPath : null,
      baseline: results?.baseline ?? null,
      denial_summary: denial?.summary ?? denial ?? null,
    };
  }

  const parsed = {
    project: tryJson(projectCurrent.stdout),
    events_tail: tryJson(eventsTail.stdout),
    metrics_summary: tryJson(metricsSummary.stdout),
    resume_status: tryJson(resumeStatus.stdout),
    tool_events: tryJson(toolEvents.stdout),
    debug_analysis: debugAnalysis,
    testing_run: testingRun,
  };

  // Cross-check counts so reports don't silently disagree.
  // - metrics_summary.total_tool_calls: incremented by run-observer on successful PostToolUse duration tracking
  // - tool_events.tool_calls: derived from the tool-events stream (post events + denied-without-post)
  try {
    const toolCallsFromMetrics = Number(parsed.metrics_summary?.total_tool_calls ?? NaN);
    const toolCallsFromToolEvents = Number(parsed.tool_events?.tool_calls ?? NaN);
    if (Number.isFinite(toolCallsFromMetrics) && Number.isFinite(toolCallsFromToolEvents)) {
      parsed.counts = {
        tool_calls_metrics: toolCallsFromMetrics,
        tool_calls_tool_events: toolCallsFromToolEvents,
        mismatch: toolCallsFromMetrics !== toolCallsFromToolEvents,
      };
    }
  } catch {
    // ignore
  }

  const bundle = {
    $schema: '../schemas/observability-bundle.schema.json',
    id: opts.id,
    created_at: startedAt,
    project_root: PROJECT_ROOT,
    inputs: {
      debug_log_path: debugLogUsed || null,
      testing_run_id: opts.testingRun || null,
    },
    outputs: {
      bundle_json: bundlePath,
      report_md: reportPath,
    },
    runs: runs.map(r => ({
      name: r.name,
      ok: r.ok,
      exit_code: r.exitCode,
      timed_out: r.timedOut,
      error: r.error,
      cmd: r.cmd,
      stderr_tail:
        String(r.stderr || '')
          .trim()
          .slice(-2000) || null,
    })),
    data: parsed,
  };

  const findings = [];
  const errors = [];

  const debug = bundle.data.debug_analysis;
  if (debug?.totals?.error > 0) {
    findings.push(`Debug log errors: ${debug.totals.error}`);
  }
  if (debug?.streaming?.stallCount > 0) {
    findings.push(
      `Streaming stalls: ${debug.streaming.stallCount} (max ${debug.derived?.maxStallSeconds?.toFixed?.(1) ?? '?'}s)`
    );
  }
  if (debug?.reads?.maxFileReadTokenExceededCount > 0) {
    findings.push(`Read token cap errors: ${debug.reads.maxFileReadTokenExceededCount}`);
  }

  const runFailures = bundle.runs.filter(r => r.ok === false);
  if (runFailures.length) {
    for (const f of runFailures) errors.push(`${f.name} failed (exit=${f.exit_code ?? 'n/a'})`);
  }

  const lines = [];
  lines.push(`# Observability Bundle: ${opts.id}`);
  lines.push('');
  lines.push(`- Created: ${startedAt}`);
  lines.push(`- Workspace: \`${PROJECT_ROOT}\``);
  lines.push(`- Bundle JSON: \`${bundlePath}\``);
  lines.push(`- Debug log: ${debugLogUsed ? `\`${debugLogUsed}\`` : '(none)'}`);
  if (opts.testingRun) lines.push(`- Testing run: \`${opts.testingRun}\``);
  lines.push('');

  if (testingRun) {
    lines.push('## Testing Run Summary');
    lines.push(`- workflow_id: \`${testingRun.workflow_id}\``);
    lines.push(`- status: **${testingRun.status || 'unknown'}**`);
    lines.push(`- results: \`${testingRun.results_path}\``);
    lines.push(`- report: \`${testingRun.report_path}\``);
    lines.push(`- logs: \`${testingRun.logs_dir}\``);
    if (testingRun.denial_path) lines.push(`- denial: \`${testingRun.denial_path}\``);
    lines.push('');
  }

  if (errors.length) {
    lines.push('## Errors');
    for (const e of errors) lines.push(`- ${e}`);
    lines.push('');
  }

  if (findings.length) {
    lines.push('## Key Findings');
    for (const f of findings) lines.push(`- ${f}`);
    lines.push('');
  } else {
    lines.push('## Key Findings');
    lines.push('- No major signals detected in bundled summaries.');
    lines.push('');
  }

  const metrics = bundle.data.metrics_summary;
  if (metrics && !metrics.error) {
    lines.push('## Metrics');
    lines.push(`- run_id: \`${metrics.run_id || '(unknown)'}\``);
    lines.push(`- total_tool_calls: ${metrics.total_tool_calls ?? 0}`);
    const counts = bundle.data.counts;
    if (counts && counts.mismatch) {
      lines.push(
        `- mismatch: metrics=${counts.tool_calls_metrics} vs tool-events=${counts.tool_calls_tool_events} (tool-events may include denials and calls not duration-tracked)`
      );
    }
    lines.push(`- total_tool_duration_ms: ${metrics.total_tool_duration_ms ?? 0}`);
    lines.push('');
  }

  const toolEventsJson = bundle.data.tool_events;
  if (toolEventsJson && !toolEventsJson.error) {
    lines.push('## Tool Events');
    lines.push(`- file: \`${toolEventsJson.tool_events_path || '(unknown)'}\``);
    lines.push(
      `- events: ${toolEventsJson.total_events ?? 0} (denied ${toolEventsJson.denied_events ?? 0}, failed ${toolEventsJson.failed_events ?? 0})`
    );
    if (typeof toolEventsJson.tool_calls === 'number') {
      lines.push(
        `- tool_calls: ${toolEventsJson.tool_calls} (${toolEventsJson.tool_calls_notes?.definition || 'derived'})`
      );
    }
    lines.push('');
  }

  await writeUtf8(bundlePath, JSON.stringify(bundle, null, 2));
  await writeUtf8(reportPath, lines.join('\n') + '\n');

  process.stdout.write(
    JSON.stringify({ ok: true, id: opts.id, bundle: bundlePath, report: reportPath }, null, 2)
  );
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err?.message || err) + '\n');
  process.exit(1);
});
