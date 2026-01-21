#!/usr/bin/env node
/**
 * task-concurrency-guard.mjs
 *
 * PreToolUse guard for `Task` to prevent parallel subagent fan-out that can
 * crash Claude Code (Node heap OOM) in debug/heavy orchestration sessions.
 *
 * Default behavior:
 * - Only applies to `orchestrator` / `master-orchestrator` sessions.
 * - Enforces `CLAUDE_MAX_ACTIVE_SUBAGENTS` (default: 1).
 * - Denies additional Task spawns while active >= limit, instructing the agent to wait.
 *
 * Safety:
 * - Fail-open if state cannot be read.
 * - Never blocks router-first initial routing (before the coordinator is active).
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

function respond(obj) {
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

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.floor(x)));
}

function parseLimit() {
  const raw = String(process.env.CLAUDE_MAX_ACTIVE_SUBAGENTS || '').trim();
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return clampInt(n, 1, 50);
}

function getAgentName(hookInput) {
  const fromEnv =
    String(process.env.CLAUDE_AGENT_NAME || '').trim() ||
    String(process.env.CLAUDE_AGENT_ROLE || '').trim() ||
    String(process.env.CLAUDE_ACTIVE_AGENT || '').trim() ||
    String(process.env.CLAUDE_CURRENT_AGENT || '').trim();
  if (fromEnv) return fromEnv;
  const fromCtx =
    hookInput?.agent_name ?? hookInput?.agentName ?? hookInput?.agent ?? hookInput?.role ?? null;
  if (typeof fromCtx === 'string' && fromCtx.trim()) return fromCtx.trim();
  return 'unknown';
}

async function readActiveCount(path) {
  try {
    if (!existsSync(path)) return 0;
    const raw = await readFile(path, 'utf8');
    const obj = JSON.parse(raw);
    const active = clampInt(obj?.active, 0, 200);
    const pending = clampInt(obj?.pending, 0, 200);
    return { active, pending };
  } catch {
    return { active: 0, pending: 0 };
  }
}

async function bumpPending(path) {
  try {
    const { active, pending } = await readActiveCount(path);
    await mkdir(dirname(path), { recursive: true });
    const next = {
      active,
      pending: clampInt(pending + 1, 0, 200),
      updated_at: new Date().toISOString(),
    };
    await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    // fail-open
  }
}

async function main() {
  const hookInput = await readStdinJson();
  const agent = getAgentName(hookInput).toLowerCase();
  if (agent !== 'orchestrator' && agent !== 'master-orchestrator') {
    respond({ decision: 'approve' });
    return;
  }

  const sessionKey = String(
    (await getSessionKeyForHook({ hookInput, tmpDir: TMP_DIR })) || ''
  ).trim();
  if (!sessionKey) {
    respond({ decision: 'approve' });
    return;
  }

  const limit = parseLimit();
  const activePath = join(ACTIVE_DIR, `${sessionKey}.json`);
  const { active, pending } = await readActiveCount(activePath);
  const inFlight = clampInt(active + pending, 0, 200);
  if (inFlight >= limit) {
    respond({
      decision: 'deny',
      reason: `Task concurrency limit reached (active=${active}, pending=${pending}, limit=${limit}). Wait for the current subagent to finish before spawning another.`,
    });
    return;
  }

  // Reserve a slot immediately to prevent burst spawns before SubagentStart events arrive.
  await bumpPending(activePath);
  respond({ decision: 'approve' });
}

main().catch(() => respond({ decision: 'approve' }));
