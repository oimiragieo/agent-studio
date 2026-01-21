#!/usr/bin/env node
/**
 * Validate Latest Integration Artifacts
 *
 * Finds the newest `*-run-results.json` under `.claude/context/artifacts/testing/`
 * and validates:
 * - `<workflow_id>-run-results.json`
 * - `<workflow_id>-agent-smoke/_summary.json` (if present)
 *
 * Uses `.claude/tools/validate-schemas.mjs` for schema auto-detection.
 */

import { spawnSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const PROJECT_ROOT = resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.replace(/^--/, '');
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      i++;
    }
  }
  return args;
}

function findLatestRunResults(dir) {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir, { withFileTypes: true });
  const candidates = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('-run-results.json')) continue;
    const full = join(dir, e.name);
    const st = statSync(full);
    candidates.push({ path: full, mtimeMs: st.mtimeMs });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0].path;
}

function workflowIdFromRunResultsPath(path) {
  const name = path.replace(/\\/g, '/').split('/').at(-1) || '';
  return name.replace(/-run-results\.json$/, '');
}

function runValidateSchemas({ filePath, json }) {
  const toolPath = join(PROJECT_ROOT, '.claude', 'tools', 'validate-schemas.mjs');
  const args = [toolPath, '--auto-detect', filePath, '--require-schema'];
  if (json) args.push('--json');
  const proc = spawnSync(process.execPath, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  const stdout = String(proc.stdout || '').trim();
  const stderr = String(proc.stderr || '').trim();
  const parsed = json && stdout ? safeJsonParse(stdout) : null;
  return {
    ok: proc.status === 0,
    exitCode: proc.status ?? 1,
    stdout,
    stderr,
    parsed,
  };
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const json = Boolean(args.get('json'));
  const requireRun = Boolean(args.get('require-run'));

  const root =
    typeof args.get('root') === 'string'
      ? resolve(String(args.get('root')))
      : join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'testing');

  const latest = findLatestRunResults(root);
  if (!latest) {
    const out = {
      ok: !requireRun,
      reason: 'no-run-results-found',
      root,
    };
    process.stdout.write(json ? JSON.stringify(out, null, 2) : `${out.reason}: ${root}\n`);
    process.exit(requireRun ? 2 : 0);
  }

  const workflowId = workflowIdFromRunResultsPath(latest);
  const smokeSummary = join(root, `${workflowId}-agent-smoke`, '_summary.json');

  const validations = [];
  validations.push({
    kind: 'run-results',
    file: latest,
    result: runValidateSchemas({ filePath: latest, json: true }),
  });

  if (existsSync(smokeSummary)) {
    validations.push({
      kind: 'agent-smoke-summary',
      file: smokeSummary,
      result: runValidateSchemas({ filePath: smokeSummary, json: true }),
    });
  } else {
    validations.push({
      kind: 'agent-smoke-summary',
      file: smokeSummary,
      skipped: true,
      reason: 'missing',
    });
  }

  const ok = validations.every(v => v.skipped || v.result?.ok);
  const out = {
    ok,
    root,
    workflow_id: workflowId,
    validated: validations.map(v => ({
      kind: v.kind,
      file: v.file,
      ok: v.skipped ? null : v.result.ok,
      skipped: Boolean(v.skipped),
      exit_code: v.skipped ? null : v.result.exitCode,
      schema: v.skipped ? null : (v.result.parsed?.schema ?? null),
      errors: v.skipped ? null : (v.result.parsed?.errors ?? null),
    })),
  };

  process.stdout.write(
    json ? JSON.stringify(out, null, 2) : `${ok ? 'OK' : 'FAIL'} ${workflowId}\n`
  );
  process.exit(ok ? 0 : 1);
}

main();
