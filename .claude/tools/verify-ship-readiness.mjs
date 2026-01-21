#!/usr/bin/env node
/**
 * verify-ship-readiness.mjs
 *
 * Verifies the artifacts produced by `run-ship-readiness-headless.mjs`.
 *
 * This is intentionally minimal and file-based (enterprise audit friendly).
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = { workflowId: null, projectRoot: process.cwd(), json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--workflow-id') args.workflowId = argv[++i] || null;
    else if (a === '--project-root') args.projectRoot = argv[++i] || args.projectRoot;
  }
  return args;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const workflowId = String(args.workflowId || '').trim();
  if (!workflowId) {
    process.stderr.write('Missing --workflow-id\n');
    process.exit(2);
  }

  const root = isAbsolute(args.projectRoot)
    ? args.projectRoot
    : resolve(process.cwd(), args.projectRoot);
  const report = join(
    root,
    '.claude',
    'context',
    'reports',
    'testing',
    `${workflowId}-run-report.md`
  );
  const results = join(
    root,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-run-results.json`
  );
  const logsDir = join(root, '.claude', 'context', 'artifacts', 'testing', `${workflowId}-logs`);

  const failures = [];
  if (!existsSync(report)) failures.push(`Missing report: ${report}`);
  if (!existsSync(results)) failures.push(`Missing results: ${results}`);
  if (!existsSync(logsDir)) failures.push(`Missing logs dir: ${logsDir}`);

  const resultsObj = existsSync(results) ? await readJson(results) : null;
  if (!resultsObj || typeof resultsObj !== 'object')
    failures.push('Results JSON is not valid JSON');
  if (resultsObj?.workflow_id !== workflowId)
    failures.push(`Results workflow_id mismatch (got ${resultsObj?.workflow_id})`);
  if (!resultsObj?.status) failures.push('Results missing status');
  if (!resultsObj?.baseline) failures.push('Results missing baseline');

  const ok = failures.length === 0;
  const out = {
    ok,
    workflow_id: workflowId,
    failures,
    paths: { report, results, logs_dir: logsDir },
    status: resultsObj?.status || null,
  };

  if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  else {
    process.stdout.write(ok ? 'PASS\n' : 'FAIL\n');
    for (const f of failures) process.stdout.write(`- ${f}\n`);
  }

  process.exit(ok ? 0 : 2);
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
