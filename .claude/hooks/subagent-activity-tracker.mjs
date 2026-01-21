#!/usr/bin/env node
/**
 * subagent-activity-tracker.mjs
 *
 * Fail-open helper to track active subagent count per session.
 *
 * Purpose:
 * - Enables `task-concurrency-guard.mjs` to deny Task spawns when too many subagents
 *   are already active (prevents Claude Code UI OOM from parallel subagents).
 *
 * Hook types:
 * - SubagentStart
 * - SubagentStop
 *
 * Output schema:
 * - Must remain `{ "decision": "approve" | "deny", "reason"?: "..." }` compatible.
 * - This hook never blocks; it always returns `approve`.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

import { getSessionKeyForHook } from './session-key.mjs';

const PROJECT_ROOT = resolve(join(dirname(new URL(import.meta.url).pathname), '..', '..'));
const TMP_DIR = (() => {
  const raw =
    process.env.CLAUDE_HOOK_TMP_DIR ||
    process.env.CLAUDE_TMP_DIR ||
    process.env.CLAUDE_CONTEXT_TMP_DIR ||
    join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  const s = String(raw || '').trim();
  if (!s) return join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  return isAbsolute(s) ? s : resolve(PROJECT_ROOT, s);
})();

const ACTIVE_DIR = join(TMP_DIR, 'active-subagents');

let responded = false;
function respond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // ignore
  }
}

async function readStdinJson() {
  try {
    const chunks = [];
    for await (const c of process.stdin)
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sanitizeAgentName(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  return s.replace(/[^\w.-]+/g, '_').slice(0, 80);
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.floor(x)));
}

async function loadState(path) {
  try {
    if (!existsSync(path)) return { active: 0, agents: [] };
    const raw = await readFile(path, 'utf8');
    const obj = JSON.parse(raw);
    return {
      active: clampInt(obj?.active, 0, 200),
      pending: clampInt(obj?.pending, 0, 200),
      agents: Array.isArray(obj?.agents) ? obj.agents.map(String) : [],
      updated_at: typeof obj?.updated_at === 'string' ? obj.updated_at : null,
    };
  } catch {
    return { active: 0, agents: [] };
  }
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const next = {
    active: clampInt(state.active, 0, 200),
    pending: clampInt(state.pending, 0, 200),
    agents: Array.isArray(state.agents) ? state.agents : [],
    updated_at: new Date().toISOString(),
  };
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

async function main() {
  const mode = String(process.argv[2] || '')
    .trim()
    .toLowerCase();
  const hookInput = await readStdinJson();
  const sessionKey = String(
    (await getSessionKeyForHook({ hookInput, tmpDir: TMP_DIR })) || ''
  ).trim();
  if (!sessionKey) return;

  const statePath = join(ACTIVE_DIR, `${sessionKey}.json`);
  const state = await loadState(statePath);

  const hintedAgent =
    sanitizeAgentName(
      hookInput?.delegated_agent ??
        hookInput?.delegatedAgent ??
        hookInput?.subagent_type ??
        hookInput?.subagentType ??
        hookInput?.subagent ??
        hookInput?.agent ??
        null
    ) ?? 'unknown';

  if (mode === 'start' || mode === 'subagent-start' || mode === 'subagentstart') {
    // Move one pending Task spawn into active (best-effort) to avoid burst spawns.
    if (!Number.isFinite(state.pending)) state.pending = 0;
    if (state.pending > 0) state.pending = clampInt(state.pending - 1, 0, 200);

    state.active = clampInt(state.active + 1, 0, 200);
    state.agents = [...(state.agents || []), hintedAgent].slice(-200);
    await saveState(statePath, state);
  } else if (mode === 'stop' || mode === 'subagent-stop' || mode === 'subagentstop') {
    state.active = clampInt(state.active - 1, 0, 200);
    if (Array.isArray(state.agents) && state.agents.length)
      state.agents = state.agents.slice(0, -1);
    await saveState(statePath, state);
  }
}

main()
  .catch(() => {})
  .finally(() => respond({ decision: 'approve' }));
