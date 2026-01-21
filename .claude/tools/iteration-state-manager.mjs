#!/usr/bin/env node
/**
 * Iteration State Manager
 *
 * Purpose:
 * - Persist state for iterative "self-healing" loops (rate → fix → retest → rerate)
 * - Provide deterministic completion checks for workflows/agents that must loop
 *
 * This tool is intentionally lightweight and file-based so it works in:
 * - Claude Code sessions (multiple processes)
 * - CI / headless execution
 */

import { existsSync } from 'fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_STATE_DIR = join(__dirname, '..', 'context', 'iterations');

function makeTempPath(targetPath) {
  const dir = dirname(targetPath);
  const name = `.${basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return join(dir, name);
}

async function atomicWriteJson(targetPath, data) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmpPath = makeTempPath(targetPath);
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

function sanitizeWorkflowId(workflowId) {
  const raw = String(workflowId || '').trim();
  if (!raw) throw new Error('workflowId is required');
  // Keep conservative filename chars.
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getIterationStatePath(workflowId, { stateDir = DEFAULT_STATE_DIR } = {}) {
  const safe = sanitizeWorkflowId(workflowId);
  return join(stateDir, `${safe}.json`);
}

export async function loadIterationState(workflowId, options = {}) {
  const statePath = getIterationStatePath(workflowId, options);
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(await readFile(statePath, 'utf-8'));
  } catch (error) {
    // Preserve corrupt state for forensics, then treat as missing.
    try {
      await rename(statePath, `${statePath}.corrupt-${Date.now()}`);
    } catch {
      // ignore
    }
    return null;
  }
}

export async function initIterationState(workflowId, { targetRating = 9.0, stateDir } = {}) {
  const now = new Date().toISOString();
  const state = {
    workflow_id: sanitizeWorkflowId(workflowId),
    iteration_count: 0,
    target_rating: Number(targetRating),
    status: 'initialized',
    completion_status: false,
    component_ratings: {},
    fix_history: [],
    created_at: now,
    updated_at: now,
  };
  await saveIterationState(workflowId, state, { stateDir });
  return state;
}

export async function saveIterationState(workflowId, state, { stateDir } = {}) {
  const statePath = getIterationStatePath(workflowId, { stateDir });
  const now = new Date().toISOString();
  const next = { ...(state || {}), updated_at: now };
  await atomicWriteJson(statePath, next);
  return next;
}

export function checkCompletion(state, targetRating = 9.0) {
  const ratings = state?.component_ratings ? Object.values(state.component_ratings) : [];
  if (!Array.isArray(ratings) || ratings.length === 0) return false;
  return ratings.every(r => typeof r?.score === 'number' && r.score >= targetRating);
}

export function getComponentsBelowTarget(state, targetRating = 9.0) {
  const entries = state?.component_ratings ? Object.entries(state.component_ratings) : [];
  return entries
    .map(([name, rating]) => ({ name, ...(rating || {}) }))
    .filter(r => typeof r.score === 'number' && r.score < targetRating);
}

function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = new Map();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
    args.set(key, value);
  }

  const workflowId = args.get('id') || args.get('workflow') || args.get('workflow_id');
  const stateDir = args.get('stateDir') || args.get('state_dir') || undefined;
  const targetRating = Number(args.get('target') || args.get('targetRating') || 9);

  if (!command) {
    process.stderr.write(
      [
        'Iteration State Manager',
        '',
        'Usage:',
        '  node .claude/tools/iteration-state-manager.mjs init --id <workflowId> [--target 9]',
        '  node .claude/tools/iteration-state-manager.mjs get --id <workflowId>',
        '  node .claude/tools/iteration-state-manager.mjs bump --id <workflowId>',
        '  node .claude/tools/iteration-state-manager.mjs set-status --id <workflowId> --status <status>',
        '  node .claude/tools/iteration-state-manager.mjs complete --id <workflowId>',
        '',
      ].join('\n')
    );
    process.exit(1);
  }

  if (!workflowId) {
    process.stderr.write('Error: --id <workflowId> is required\n');
    process.exit(1);
  }

  if (command === 'init') {
    const state = await initIterationState(workflowId, { targetRating, stateDir });
    printJson({ ok: true, state_path: getIterationStatePath(workflowId, { stateDir }), state });
    return;
  }

  let state = await loadIterationState(workflowId, { stateDir });
  if (!state) state = await initIterationState(workflowId, { targetRating, stateDir });

  if (command === 'get') {
    printJson({ ok: true, state_path: getIterationStatePath(workflowId, { stateDir }), state });
    return;
  }

  if (command === 'bump') {
    const next = {
      ...state,
      iteration_count: Number(state.iteration_count || 0) + 1,
      status: 'iterating',
    };
    const saved = await saveIterationState(workflowId, next, { stateDir });
    printJson({
      ok: true,
      state_path: getIterationStatePath(workflowId, { stateDir }),
      state: saved,
    });
    return;
  }

  if (command === 'set-status') {
    const status = String(args.get('status') || '').trim();
    if (!status) {
      process.stderr.write('Error: --status <status> is required\n');
      process.exit(1);
    }
    const saved = await saveIterationState(workflowId, { ...state, status }, { stateDir });
    printJson({
      ok: true,
      state_path: getIterationStatePath(workflowId, { stateDir }),
      state: saved,
    });
    return;
  }

  if (command === 'complete') {
    const saved = await saveIterationState(
      workflowId,
      { ...state, completion_status: true, status: 'completed' },
      { stateDir }
    );
    printJson({
      ok: true,
      state_path: getIterationStatePath(workflowId, { stateDir }),
      state: saved,
    });
    return;
  }

  process.stderr.write(`Error: Unknown command "${command}"\n`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  });
}
