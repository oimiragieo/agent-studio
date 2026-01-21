#!/usr/bin/env node
/**
 * cleanup-headless-runs.mjs
 *
 * Retention cleanup for headless runtime runs + related observability artifacts.
 *
 * Targets:
 * - `.claude/context/runtime/headless/runs/*` (directories)
 * - `.claude/context/artifacts/observability/*-otlp.json` (optional)
 *
 * Usage:
 *   node .claude/tools/cleanup-headless-runs.mjs --dry-run
 *   node .claude/tools/cleanup-headless-runs.mjs --execute --yes
 *
 * Options:
 *   --retention-days <n> (default 7)
 *   --project-root <path> (default cwd)
 *   --include-otlp (also clean otlp exports)
 */

import { existsSync } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    mode: null,
    yes: false,
    retentionDays: 7,
    projectRoot: null,
    includeOtlp: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.mode = 'dry-run';
    else if (a === '--execute') args.mode = 'execute';
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--retention-days') args.retentionDays = Number(argv[++i] || '0');
    else if (a === '--project-root') args.projectRoot = argv[++i] || null;
    else if (a === '--include-otlp') args.includeOtlp = true;
  }
  return args;
}

function resolveRoot(projectRoot) {
  const root = projectRoot && typeof projectRoot === 'string' ? projectRoot : process.cwd();
  return isAbsolute(root) ? root : resolve(root);
}

function isOlderThanDays(mtimeMs, days) {
  const ageMs = Date.now() - Number(mtimeMs || 0);
  return ageMs > Math.max(0, days) * 24 * 60 * 60 * 1000;
}

async function listHeadlessRunDirs(headlessRunsDir) {
  try {
    const entries = await readdir(headlessRunsDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => join(headlessRunsDir, e.name));
  } catch {
    return [];
  }
}

async function listOtlpExports(observabilityDir) {
  try {
    const entries = await readdir(observabilityDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && /-otlp\.json$/i.test(e.name))
      .map(e => join(observabilityDir, e.name));
  } catch {
    return [];
  }
}

export async function cleanupHeadlessRuns({
  projectRoot,
  mode,
  retentionDays = 7,
  includeOtlp = false,
} = {}) {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('--retention-days must be at least 1 day (safety)');
  }
  const root = resolveRoot(projectRoot);
  const runsDir = join(root, '.claude', 'context', 'runtime', 'headless', 'runs');
  const observabilityDir = join(root, '.claude', 'context', 'artifacts', 'observability');

  const candidates = [];

  for (const dir of await listHeadlessRunDirs(runsDir)) {
    let info;
    try {
      info = await stat(dir);
    } catch {
      continue;
    }
    if (isOlderThanDays(info.mtimeMs, retentionDays)) {
      candidates.push({ kind: 'headless_run', path: dir, mtimeMs: info.mtimeMs });
    }
  }

  if (includeOtlp) {
    for (const file of await listOtlpExports(observabilityDir)) {
      let info;
      try {
        info = await stat(file);
      } catch {
        continue;
      }
      if (isOlderThanDays(info.mtimeMs, retentionDays)) {
        candidates.push({ kind: 'otlp_export', path: file, mtimeMs: info.mtimeMs });
      }
    }
  }

  const deleted = [];
  const errors = [];

  if (mode === 'execute') {
    for (const c of candidates) {
      try {
        await rm(c.path, { recursive: true, force: true });
        deleted.push(c);
      } catch (e) {
        errors.push({ path: c.path, error: e?.message || String(e) });
      }
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    retention_days: retentionDays,
    include_otlp: includeOtlp,
    paths: {
      headless_runs_dir: runsDir,
      observability_dir: observabilityDir,
    },
    candidates,
    deleted,
    errors,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.mode) {
    die(
      'Usage: node .claude/tools/cleanup-headless-runs.mjs --dry-run|--execute [--yes] [--retention-days <n>] [--include-otlp]'
    );
  }
  if (args.mode === 'execute' && !args.yes) {
    die('Refusing to execute without --yes (safety).');
  }
  if (!Number.isFinite(args.retentionDays) || args.retentionDays < 1) {
    die('--retention-days must be at least 1 day (safety)');
  }

  const res = await cleanupHeadlessRuns({
    projectRoot: args.projectRoot,
    mode: args.mode,
    retentionDays: args.retentionDays,
    includeOtlp: args.includeOtlp,
  });

  process.stdout.write(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => die(err?.stack || err?.message || String(err), 1));
}
