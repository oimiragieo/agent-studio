#!/usr/bin/env node
/**
 * run-ship-readiness-headless.mjs
 *
 * UI-safe ship-readiness audit runner intended for use from Claude Code via a single Bash command.
 *
 * Goals:
 * - Avoid Claude Code host OOM by running deterministic CLI steps with logs redirected to files.
 * - Produce auditable deliverables under `.claude/context/`.
 *
 * Deliverables:
 * - `.claude/context/reports/testing/<workflow_id>-run-report.md`
 * - `.claude/context/artifacts/testing/<workflow_id>-run-results.json`
 * - `.claude/context/artifacts/testing/<workflow_id>-logs/*`
 * - `.claude/context/artifacts/testing/<workflow_id>-denial.json` (optional)
 * - `.claude/context/reports/observability/<workflow_id>-report.md` + bundle (optional)
 *
 * Note: This tool does not require Claude Code subagents; it is designed to run as a single process.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

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
    timeoutMs: 30 * 60 * 1000,
    skipBaseline: false,
    skipObservability: false,
    denialTest: false,
    json: false,
    quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--skip-baseline') args.skipBaseline = true;
    else if (a === '--skip-observability') args.skipObservability = true;
    else if (a === '--denial-test') args.denialTest = true;
    else if (a === '--workflow-id') args.workflowId = argv[++i] || null;
    else if (a === '--project-root') args.projectRoot = argv[++i] || null;
    else if (a === '--debug-log') args.debugLog = argv[++i] || null;
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i] || '0') || 0;
  }
  return args;
}

function resolveRoot(projectRoot) {
  const root = projectRoot && typeof projectRoot === 'string' ? projectRoot : process.cwd();
  return isAbsolute(root) ? root : resolve(root);
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

function defaultBaselineSpec() {
  return [
    { key: 'test', name: 'pnpm test', cmd: 'pnpm', args: ['test'], log: 'pnpm-test.log' },
    {
      key: 'tools',
      name: 'pnpm test:tools',
      cmd: 'pnpm',
      args: ['test:tools'],
      log: 'pnpm-test-tools.log',
    },
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

async function runNodeJson({ cwd, args, timeoutMs }) {
  const res = await runCommandToLog({
    cmd: process.execPath,
    args,
    cwd,
    logPath: join(
      cwd,
      '.claude',
      'context',
      'tmp',
      `tmp-run-${Date.now()}-${Math.random().toString(16).slice(2)}.log`
    ),
    timeoutMs,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(String(res.stdout || '').trim() || '{}');
  } catch {
    parsed = null;
  }
  return { ...res, parsed };
}

function mdEscape(s) {
  return String(s || '').replace(/`/g, '\\`');
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = resolveRoot(args.projectRoot);
  const workflowId = args.workflowId || `ship-readiness-v1-${nowStamp()}`;

  const logsDir = join(
    projectRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-logs`
  );
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
  const denialPath = join(
    projectRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-denial.json`
  );

  await mkdir(logsDir, { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });

  const log = makeProgressLogger({ quiet: args.quiet });
  const startedAt = new Date().toISOString();

  const baselineSpec = readBaselineOverrideFromEnv() || defaultBaselineSpec();
  const baselineResults = [];
  let status = 'PASS';

  if (!args.skipBaseline) {
    for (const step of baselineSpec) {
      const logPath = join(logsDir, step.log || `${step.key}.log`);
      log(`baseline: start ${step.name}`, { key: step.key });
      const r = await runCommandToLog({
        cmd: step.cmd,
        args: step.args,
        cwd: projectRoot,
        logPath,
        timeoutMs: args.timeoutMs,
      });
      baselineResults.push({ ...step, ...r });
      log(`baseline: end ${step.name}`, { ok: r.ok, code: r.code, ms: r.duration_ms });
      if (!r.ok) {
        status = 'FAIL';
        break;
      }
    }
  } else {
    log('baseline: skipped');
  }

  let denial = null;
  if (args.denialTest) {
    log('denial: start');
    const denialRes = await runNodeJson({
      cwd: projectRoot,
      args: [
        '.claude/tools/run-guard-denial-headless.mjs',
        '--workflow-id',
        workflowId,
        '--project-root',
        projectRoot,
      ],
      timeoutMs: Math.min(args.timeoutMs || 0, 60_000) || 60_000,
    });
    denial = denialRes.parsed;
    await writeFile(denialPath, JSON.stringify(denial || {}, null, 2), 'utf8');
    log('denial: end', { ok: Boolean(denial?.ok) });
    if (denial && denial.ok !== true) status = 'FAIL';
  }

  let observability = null;
  if (!args.skipObservability) {
    const obsArgs = [
      '.claude/tools/observability-bundle.mjs',
      '--id',
      workflowId,
      '--output-root',
      join(projectRoot, '.claude', 'context'),
      '--testing-run',
      workflowId,
    ];
    if (args.debugLog && String(args.debugLog).trim()) {
      obsArgs.push('--debug-log', String(args.debugLog).trim());
    }
    log('observability: start');
    const obsRes = await runCommandToLog({
      cmd: process.execPath,
      args: obsArgs,
      cwd: projectRoot,
      logPath: join(logsDir, 'observability-bundle.log'),
      timeoutMs: Math.min(args.timeoutMs || 0, 120_000) || 120_000,
    });
    observability = {
      ok: obsRes.ok,
      code: obsRes.code,
      log_path: obsRes.log_path,
      report_path: join(
        projectRoot,
        '.claude',
        'context',
        'reports',
        'observability',
        `${workflowId}-report.md`
      ),
      bundle_path: join(
        projectRoot,
        '.claude',
        'context',
        'artifacts',
        'observability',
        workflowId,
        'bundle.json'
      ),
    };
    log('observability: end', { ok: obsRes.ok });
  } else {
    log('observability: skipped');
  }

  const finishedAt = new Date().toISOString();

  const results = {
    workflow_id: workflowId,
    started_at: startedAt,
    finished_at: finishedAt,
    status,
    baseline: {
      skipped: args.skipBaseline,
      steps: baselineResults.map(r => ({
        key: r.key,
        name: r.name,
        ok: r.ok,
        exit_code: r.code,
        duration_ms: r.duration_ms,
        log_path: r.log_path,
      })),
    },
    denial_test: args.denialTest ? { path: denialPath, summary: denial || null } : null,
    observability: observability,
    output_paths: {
      logs_dir: logsDir,
      report_path: reportPath,
      results_path: resultsPath,
    },
  };

  await writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf8');

  const firstFail = baselineResults.find(r => r.ok === false);
  const reportLines = [];
  reportLines.push(`# Ship Readiness Audit (Headless)`);
  reportLines.push('');
  reportLines.push(`- Workflow ID: \`${mdEscape(workflowId)}\``);
  reportLines.push(`- Status: **${status}**`);
  reportLines.push(`- Started: \`${startedAt}\``);
  reportLines.push(`- Finished: \`${finishedAt}\``);
  reportLines.push('');
  reportLines.push('## Commands');
  reportLines.push('');
  for (const r of baselineResults) {
    reportLines.push(
      `- ${mdEscape(r.name)} → ${r.ok ? 'PASS' : 'FAIL'} (exit=${r.code}, ms=${r.duration_ms}) log: \`${mdEscape(
        r.log_path
      )}\``
    );
  }
  if (args.denialTest) reportLines.push(`- denial test log: \`${mdEscape(denialPath)}\``);
  if (observability)
    reportLines.push(`- observability bundle log: \`${mdEscape(observability.log_path)}\``);
  reportLines.push('');
  if (firstFail) {
    reportLines.push('## First Failure');
    reportLines.push('');
    reportLines.push(`- Step: \`${mdEscape(firstFail.name)}\``);
    reportLines.push(`- Log: \`${mdEscape(firstFail.log_path)}\``);
    reportLines.push('');
  }
  reportLines.push('## Outputs');
  reportLines.push('');
  reportLines.push(`- Report: \`${mdEscape(reportPath)}\``);
  reportLines.push(`- Results JSON: \`${mdEscape(resultsPath)}\``);
  reportLines.push(`- Logs dir: \`${mdEscape(logsDir)}\``);
  if (observability) {
    reportLines.push(`- Observability report: \`${mdEscape(observability.report_path)}\``);
    reportLines.push(`- Observability bundle: \`${mdEscape(observability.bundle_path)}\``);
  }

  await writeFile(reportPath, reportLines.join('\n') + '\n', 'utf8');

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: status === 'PASS',
          workflow_id: workflowId,
          status,
          report_path: reportPath,
          results_path: resultsPath,
          logs_dir: logsDir,
          denial_path: args.denialTest ? denialPath : null,
          observability_report: observability?.report_path || null,
        },
        null,
        2
      )
    );
  } else {
    process.stdout.write(`${reportPath}\n${resultsPath}\n`);
  }

  process.exit(status === 'PASS' ? 0 : 2);
}

main().catch(err => die(err?.stack || err?.message || String(err), 1));
