#!/usr/bin/env node
/**
 * Verify Agent Framework Integration Test outputs.
 *
 * Usage:
 *   node .claude/tools/verify-agent-integration.mjs --workflow-id agent-integration-v1-20260119-123456
 *
 * Writes:
 *   .claude/context/artifacts/testing/<workflow_id>-verification.json
 *   .claude/context/reports/testing/<workflow_id>-verification-report.md
 *
 * Exit code:
 *   0 = pass
 *   1 = fail
 *   2 = usage / invalid inputs
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_PROJECT_ROOT = resolve(join(__dirname, '..', '..'));

function parseArgs(argv) {
  const args = {
    workflowId: null,
    projectRoot: null,
    json: false,
    expectedAgents: 'all',
    mode: 'interactive',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--workflow-id') args.workflowId = argv[++i] || null;
    else if (a === '--project-root') args.projectRoot = argv[++i] || null;
    else if (a === '--expected-agents') args.expectedAgents = (argv[++i] || 'all').trim();
    else if (a === '--mode') args.mode = (argv[++i] || 'interactive').trim();
  }
  return args;
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function readText(path) {
  try {
    if (!existsSync(path)) return '';
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function listJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.json'))
      .map(e => join(dir, e.name));
  } catch {
    return [];
  }
}

async function listAgents(projectRoot) {
  const agentsDir = join(projectRoot, '.claude', 'agents');
  const entries = await readdir(agentsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map(e => e.name.replace(/\.md$/i, ''))
    .sort();
}

function expectedAgentSet(mode) {
  const m = String(mode || 'all')
    .trim()
    .toLowerCase();
  if (m === 'core') {
    return new Set([
      'router',
      'orchestrator',
      'developer',
      'qa',
      'analyst',
      'security-architect',
      'performance-engineer',
      'technical-writer',
    ]);
  }
  return null;
}

async function ndjsonHas(path, predicate) {
  const text = await readText(path);
  if (!text) return false;
  const lines = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (predicate(obj)) return true;
    } catch {
      // ignore bad lines
    }
  }
  return false;
}

function extractRunIdFromEventsPath(eventsPath) {
  if (typeof eventsPath !== 'string') return null;
  const normalized = eventsPath.replace(/\\/g, '/');
  const m = normalized.match(/\/runs\/(agent-[^/]+)\/events\.ndjson$/i);
  return m?.[1] ?? null;
}

async function resolveToolEventsFilePath({ toolEventsPath, runId, projectRoot }) {
  if (!toolEventsPath || typeof toolEventsPath !== 'string') return null;

  const resolvedRoot = isAbsolute(projectRoot) ? projectRoot : resolve(projectRoot);
  const p = isAbsolute(toolEventsPath) ? toolEventsPath : resolve(resolvedRoot, toolEventsPath);

  try {
    const st = await stat(p);
    if (st.isFile()) return p;
    if (st.isDirectory() && runId) return join(p, `run-${runId}.ndjson`);
  } catch {
    return null;
  }

  return null;
}

function mdReportHasSections(md, mode = 'interactive') {
  const m = String(mode || 'interactive')
    .trim()
    .toLowerCase();
  const checks = {
    hasPassFail: /pass|fail|overall status/i.test(md),
    hasAgentSmoke: /agent smoke/i.test(md),
    hasSubagentProof:
      /subagentstart|subagentstop|SubagentStart|SubagentStop|AgentStart|AgentStop/i.test(md),
    hasPayloadProof: /payload_ref|payload\.payload_ref|context\\\\payloads|context\/payloads/i.test(
      md
    ),
    hasDenial:
      /denial|denied|read-path-guard|router-glob-guard|failure bundle|failure-bundles/i.test(md),
    hasWorkflowWarnings: /warnings|dry-run|workflow dry/i.test(md),
  };

  // Headless runs (outside Claude Code UI) may not have runtime events/tool-events.
  // Keep the verification focused on artifact existence and smoke receipts.
  if (m === 'headless') {
    checks.hasSubagentProof = true;
    checks.hasPayloadProof = true;
    checks.hasDenial = true;
  }
  return checks;
}

async function validateJsonWithSchema({ dataPath, schemaPath, label }) {
  const result = { label, data_path: dataPath, schema_path: schemaPath, valid: true, errors: [] };
  if (!dataPath || !schemaPath) return result;
  if (!existsSync(dataPath) || !existsSync(schemaPath)) return result;

  const data = await readJson(dataPath);
  const schema = await readJson(schemaPath);
  if (!data || !schema) return result;

  const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  result.valid = Boolean(valid);
  if (!valid) {
    result.errors =
      (validate.errors || []).map(e => `${e.instancePath || 'root'}: ${e.message || 'invalid'}`) ||
      [];
  }
  return result;
}

export async function verifyAgentIntegration({
  projectRoot = DEFAULT_PROJECT_ROOT,
  workflowId,
  mode = 'interactive',
} = {}) {
  const startedAt = new Date().toISOString();
  const root = projectRoot && typeof projectRoot === 'string' ? projectRoot : DEFAULT_PROJECT_ROOT;
  const resolvedRoot = isAbsolute(root) ? root : resolve(root);

  const reportPath = join(
    resolvedRoot,
    '.claude',
    'context',
    'reports',
    'testing',
    `${workflowId}-run-report.md`
  );
  const resultsPath = join(
    resolvedRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-run-results.json`
  );
  const smokeDir = join(
    resolvedRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-agent-smoke`
  );

  const verificationJsonPath = join(
    resolvedRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-verification.json`
  );
  const verificationReportPath = join(
    resolvedRoot,
    '.claude',
    'context',
    'reports',
    'testing',
    `${workflowId}-verification-report.md`
  );

  const failures = [];
  const warn = [];

  if (!workflowId || typeof workflowId !== 'string') {
    return {
      ok: false,
      status: 'FAIL',
      failures: ['Missing --workflow-id'],
      warnings: [],
      outputs: { verificationJsonPath, verificationReportPath },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
  }

  const workflowIdOk = /^agent-integration-v1-\d{8}-\d{6}$/.test(workflowId);
  if (!workflowIdOk) failures.push(`workflow_id does not match expected pattern: ${workflowId}`);

  const reportExists = existsSync(reportPath);
  const resultsExists = existsSync(resultsPath);
  const smokeDirExists = existsSync(smokeDir);

  if (!reportExists) failures.push(`Missing report: ${reportPath}`);
  if (!resultsExists) failures.push(`Missing results JSON: ${resultsPath}`);
  if (!smokeDirExists) failures.push(`Missing agent smoke directory: ${smokeDir}`);

  const agents = await listAgents(resolvedRoot).catch(() => []);
  if (!agents.length) failures.push('No agents found under .claude/agents/*.md');

  const expectedMode = String(process.env.CLAUDE_VERIFY_EXPECTED_AGENTS || 'all')
    .trim()
    .toLowerCase();
  const expectedSet = expectedAgentSet(expectedMode);
  const expectedAgents = expectedSet ? agents.filter(a => expectedSet.has(a)) : agents;
  if (expectedSet && expectedAgents.length === 0) {
    warn.push(
      'Expected agent set (core) did not match any agents in repo; using all agents instead'
    );
  }

  const smokeFilesAll = smokeDirExists ? await listJsonFiles(smokeDir) : [];
  const smokeFiles = smokeFilesAll.filter(p => {
    const name = p.split(/[\\/]/).pop() || '';
    return name && !name.startsWith('_');
  });

  const smokeSummaryPath = join(smokeDir, '_summary.json');
  const smokeSummary = smokeDirExists ? await readJson(smokeSummaryPath) : null;
  if (smokeSummary && typeof smokeSummary === 'object') {
    const declaredTotal = Number(smokeSummary.total);
    if (Number.isFinite(declaredTotal) && declaredTotal !== smokeFiles.length) {
      warn.push(
        `Agent smoke summary total (${declaredTotal}) does not match receipt files found (${smokeFiles.length})`
      );
    }
    if (Array.isArray(smokeSummary.results) && smokeSummary.results.length !== smokeFiles.length) {
      warn.push(
        `Agent smoke summary results length (${smokeSummary.results.length}) does not match receipt files found (${smokeFiles.length})`
      );
    }
  } else if (smokeDirExists && existsSync(smokeSummaryPath)) {
    warn.push('Agent smoke _summary.json exists but is not valid JSON');
  }

  const requiredReceiptCount =
    expectedSet && expectedAgents.length ? expectedAgents.length : agents.length;
  if (requiredReceiptCount && smokeFiles.length < requiredReceiptCount) {
    failures.push(
      `Agent smoke receipts missing: expected >= ${requiredReceiptCount}, got ${smokeFiles.length}`
    );
  }

  const smokeSchemaFailures = [];
  for (const file of smokeFiles) {
    const obj = await readJson(file);
    const name = file.split(/[\\/]/).pop();
    if (!obj || typeof obj !== 'object') {
      smokeSchemaFailures.push(`${name}: not valid JSON`);
      continue;
    }
    const required = ['agent', 'task_summary', 'tool_used', 'ok', 'notes'];
    for (const k of required) {
      if (!(k in obj)) smokeSchemaFailures.push(`${name}: missing ${k}`);
    }
    if (typeof obj.ok !== 'boolean') smokeSchemaFailures.push(`${name}: ok is not boolean`);
    if (typeof obj.agent === 'string' && agents.length && !agents.includes(obj.agent)) {
      smokeSchemaFailures.push(`${name}: agent "${obj.agent}" not in .claude/agents`);
    }
  }
  if (smokeSchemaFailures.length)
    failures.push(
      `Agent smoke receipt schema issues: ${smokeSchemaFailures.slice(0, 10).join('; ')}`
    );

  const reportText = reportExists ? await readText(reportPath) : '';
  const reportChecks = mdReportHasSections(reportText, mode);
  for (const [k, ok] of Object.entries(reportChecks)) {
    if (!ok) warn.push(`Report missing expected signal: ${k}`);
  }

  const results = resultsExists ? await readJson(resultsPath) : null;
  if (!results) {
    failures.push('Results JSON unreadable or invalid JSON');
  } else {
    if (results.workflow_id !== workflowId)
      warn.push('Results JSON workflow_id does not exactly match');
    if (!isIsoDate(results.started_at)) warn.push('Results JSON missing/invalid started_at');
    if (!isIsoDate(results.finished_at)) warn.push('Results JSON missing/invalid finished_at');

    const suite = results.suite_statuses;
    if (!suite || typeof suite !== 'object') failures.push('Results JSON missing suite_statuses');
    else {
      for (const k of ['test', 'tools', 'validate', 'workflow_dryrun']) {
        if (!(k in suite)) failures.push(`suite_statuses missing key: ${k}`);
      }
    }

    if (
      !results.agent_smoke_receipts &&
      !results.agent_smoke_receipts_path &&
      !results.agent_smoke_testing?.receipts_directory &&
      !results.agent_smoke_testing?.summary_file
    ) {
      warn.push(
        'Results JSON missing agent_smoke_receipts (or agent_smoke_receipts_path / agent_smoke_testing.receipts_directory)'
      );
    }

    const obs = results.observability_paths;
    if (!obs || typeof obs !== 'object') {
      warn.push('Results JSON missing observability_paths');
    }
  }

  const modeLower = String(mode || 'interactive')
    .trim()
    .toLowerCase();

  // Observability verification: prefer explicit paths from results JSON when present.
  const obsPaths =
    results && results.observability_paths && typeof results.observability_paths === 'object'
      ? results.observability_paths
      : {};

  const eventsPath = typeof obsPaths.events === 'string' ? obsPaths.events : null;
  const toolEventsPath = typeof obsPaths.tool_events === 'string' ? obsPaths.tool_events : null;
  const bundlesDir = typeof obsPaths.bundles_dir === 'string' ? obsPaths.bundles_dir : null;

  if (eventsPath && existsSync(eventsPath)) {
    const hasAgentStartStop = await ndjsonHas(
      eventsPath,
      e =>
        e?.event_type === 'AgentStart' ||
        e?.phase === 'subagent_start' ||
        e?.event_type === 'AgentStop' ||
        e?.phase === 'subagent_stop'
    );
    const hasSpanStart = await ndjsonHas(
      eventsPath,
      e => e?.event_type === 'SpanStart' || e?.span_state === 'start'
    );
    const hasSpanEnd = await ndjsonHas(
      eventsPath,
      e => e?.event_type === 'SpanEnd' || e?.span_state === 'end'
    );
    const hasPayload = await ndjsonHas(eventsPath, e => Boolean(e?.payload?.payload_ref));

    // Interactive runs should have subagent lifecycle events; headless runs may not.
    if (modeLower !== 'headless') {
      if (!hasAgentStartStop)
        failures.push('Events missing AgentStart/SubagentStart or AgentStop/SubagentStop');
    } else {
      if (!hasSpanStart || !hasSpanEnd)
        warn.push('Headless events missing SpanStart/SpanEnd markers');
    }

    if (!hasPayload) warn.push('Events missing payload.payload_ref (payload storage may be off)');
  } else {
    warn.push(
      'No events path available to verify (set observability_paths.events in results JSON)'
    );
  }

  const runIdForToolEvents = extractRunIdFromEventsPath(eventsPath);
  const toolEventsFile = await resolveToolEventsFilePath({
    toolEventsPath,
    runId: runIdForToolEvents,
    projectRoot: resolvedRoot,
  });

  if (toolEventsFile && existsSync(toolEventsFile)) {
    const hasAnyDenied = await ndjsonHas(toolEventsFile, e => e?.denied === true);
    if (modeLower !== 'headless') {
      if (!hasAnyDenied) {
        failures.push('Tool-events missing denied:true entry');
      } else if (results?.guard_denial_testing?.denied === true) {
        const hasReadPathGuardDenied = await ndjsonHas(
          toolEventsFile,
          e =>
            e?.denied === true &&
            e?.tool === 'Read' &&
            String(e?.denied_by || '').includes('read-path-guard')
        );
        if (!hasReadPathGuardDenied) {
          warn.push(
            'Intentional denial not verified via tool-events (expected a denied Read by read-path-guard; denial may have been triggered via non-Read path)'
          );
        }
      }
    } else {
      // Headless runs may not include an intentional denial; treat denied entries as optional.
      if (!hasAnyDenied)
        warn.push(
          'Headless tool-events has no denied:true entries (expected if denial step skipped)'
        );
    }
  } else {
    warn.push(
      'No tool-events file available to verify (set observability_paths.tool_events to a file, or a directory plus a resolvable run_id)'
    );
  }

  const failureBundlesEnabled = String(process.env.CLAUDE_OBS_FAILURE_BUNDLES || '').trim() === '1';
  if (failureBundlesEnabled) {
    if (bundlesDir && existsSync(bundlesDir)) {
      const files = await listJsonFiles(bundlesDir);
      const any = await (async () => {
        for (const f of files) {
          if (f.toLowerCase().includes('failure-')) return true;
        }
        return false;
      })();
      if (!any) warn.push('Failure bundles enabled but no failure-*.json found');
    } else {
      warn.push('Failure bundles enabled but bundles_dir missing or does not exist');
    }
  }

  // Optional schema checks (warn-only): helps catch drift across runners without breaking older artifacts.
  const schemaRunResults = join(
    resolvedRoot,
    '.claude',
    'schemas',
    'agent-integration-run-results.schema.json'
  );
  const schemaSmokeSummary = join(
    resolvedRoot,
    '.claude',
    'schemas',
    'agent-smoke-summary.schema.json'
  );

  const schemaChecks = [];
  if (resultsExists)
    schemaChecks.push(
      await validateJsonWithSchema({
        dataPath: resultsPath,
        schemaPath: schemaRunResults,
        label: 'run-results',
      })
    );
  if (smokeDirExists && existsSync(smokeSummaryPath)) {
    schemaChecks.push(
      await validateJsonWithSchema({
        dataPath: smokeSummaryPath,
        schemaPath: schemaSmokeSummary,
        label: 'agent-smoke-summary',
      })
    );
  }
  for (const c of schemaChecks) {
    if (!c.valid)
      warn.push(`Schema validation failed (${c.label}): ${c.errors.slice(0, 5).join('; ')}`);
  }

  const ok = failures.length === 0;
  const finishedAt = new Date().toISOString();

  const result = {
    ok,
    status: ok ? 'PASS' : 'FAIL',
    workflow_id: workflowId,
    mode: modeLower,
    started_at: startedAt,
    finished_at: finishedAt,
    checks: {
      file_existence: {
        report: reportExists,
        results: resultsExists,
        agent_smoke_dir: smokeDirExists,
      },
      agent_inventory: {
        expected_agents_mode: expectedSet ? expectedMode : 'all',
        expected_agents: requiredReceiptCount,
        receipts: smokeFiles.length,
      },
      report_signals: reportChecks,
    },
    failures,
    warnings: warn,
    paths: {
      report_path: reportPath,
      results_path: resultsPath,
      agent_smoke_dir: smokeDir,
      events_path: eventsPath,
      tool_events_path: toolEventsFile ?? toolEventsPath,
      bundles_dir: bundlesDir,
    },
    outputs: {
      verification_json: verificationJsonPath,
      verification_report: verificationReportPath,
    },
    schema_checks: schemaChecks,
  };

  await mkdir(dirname(verificationJsonPath), { recursive: true });
  await mkdir(dirname(verificationReportPath), { recursive: true });
  await writeFile(verificationJsonPath, JSON.stringify(result, null, 2), 'utf8');

  const lines = [];
  lines.push(`# Agent Integration Verification: ${workflowId}`);
  lines.push('');
  lines.push(`- Status: ${result.status}`);
  lines.push(`- Report: \`${reportPath}\``);
  lines.push(`- Results: \`${resultsPath}\``);
  lines.push(
    `- Receipts: \`${smokeDir}\` (found ${smokeFiles.length}, expected >= ${requiredReceiptCount})`
  );
  if (eventsPath) lines.push(`- Events: \`${eventsPath}\``);
  if (toolEventsPath) lines.push(`- Tool-events: \`${toolEventsPath}\``);
  if (bundlesDir) lines.push(`- Bundles: \`${bundlesDir}\``);
  lines.push('');
  if (failures.length) {
    lines.push('## Failures');
    for (const f of failures) lines.push(`- ${f}`);
    lines.push('');
  }
  if (warn.length) {
    lines.push('## Warnings');
    for (const w of warn) lines.push(`- ${w}`);
    lines.push('');
  }
  await writeFile(verificationReportPath, lines.join('\n') + '\n', 'utf8');

  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.workflowId) {
    process.stderr.write(
      'Usage: node .claude/tools/verify-agent-integration.mjs --workflow-id <id> [--expected-agents all|core] [--mode interactive|headless] [--project-root <path>] [--json]\n'
    );
    process.exit(2);
  }

  const expected = String(args.expectedAgents || 'all')
    .trim()
    .toLowerCase();
  if (expected !== 'all' && expected !== 'core') {
    process.stderr.write('Invalid --expected-agents. Use: all|core\n');
    process.exit(2);
  }
  process.env.CLAUDE_VERIFY_EXPECTED_AGENTS = expected;

  const mode = String(args.mode || 'interactive')
    .trim()
    .toLowerCase();
  if (mode !== 'interactive' && mode !== 'headless') {
    process.stderr.write('Invalid --mode. Use: interactive|headless\n');
    process.exit(2);
  }

  const res = await verifyAgentIntegration({
    projectRoot: args.projectRoot || DEFAULT_PROJECT_ROOT,
    workflowId: args.workflowId,
    mode,
  });
  if (args.json) process.stdout.write(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

function isCliInvocation() {
  try {
    if (!process.argv[1]) return false;
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isCliInvocation()) {
  main().catch(err => {
    process.stderr.write(`${err?.message || err}\n`);
    process.exit(1);
  });
}
