#!/usr/bin/env node
/**
 * Routing Handoff Target Guard (PreToolUse)
 *
 * Problem: After routing completes, some coordinators may attempt to spawn a
 * different coordinator than the required `handoff_target` in routing state.
 * This can lead to loops, unnecessary tokens, and (in extreme cases) Claude Code OOM.
 *
 * Policy:
 * - If routing is completed and a `handoff_target` is set, then Task spawns that
 *   target are always allowed (router-first-enforcer handles handoff completion).
 * - If routing is completed and a different coordinator is spawned, block with a
 *   clear error so the model proceeds with the required target.
 *
 * Notes:
 * - This is intentionally narrow: it only blocks Task spawns that target another
 *   coordinator when a handoff target exists.
 * - Fail-safe: approve on any unexpected error.
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getSessionKeyForHook } from './session-key.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_TMP_DIR = join(__dirname, '..', 'context', 'tmp');
const TMP_DIR =
  process.env.CLAUDE_HOOK_TMP_DIR ||
  process.env.CLAUDE_TMP_DIR ||
  process.env.CLAUDE_CONTEXT_TMP_DIR ||
  DEFAULT_TMP_DIR;
const ROUTING_SESSIONS_DIR = join(TMP_DIR, 'routing-sessions');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function getTaskSpawnTarget(toolName, toolInput) {
  if (normalizeToolName(toolName).toLowerCase() !== 'task') return null;
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    toolInput?.subagent ??
    toolInput?.subagent_name ??
    toolInput?.subagentName ??
    null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

async function getSessionKey(hookInput) {
  return await getSessionKeyForHook({ hookInput, tmpDir: TMP_DIR });
}

function statePathForSessionKey(sessionKey) {
  return join(ROUTING_SESSIONS_DIR, `${safeFileId(sessionKey)}.json`);
}

function isCoordinatorName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase();
  return n === 'orchestrator' || n === 'master-orchestrator';
}

async function main() {
  let hookInput = null;
  try {
    const raw = await readStdin();
    hookInput = raw ? JSON.parse(raw) : {};
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
    return;
  }

  const toolName = hookInput.tool_name ?? hookInput.tool ?? '';
  const toolInput = hookInput.tool_input ?? hookInput.params ?? hookInput.input ?? {};

  const spawnTarget = getTaskSpawnTarget(toolName, toolInput);
  if (!spawnTarget || !isCoordinatorName(spawnTarget)) {
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
    return;
  }

  try {
    const sessionKey = await getSessionKey(hookInput);
    const statePath = statePathForSessionKey(sessionKey);
    if (!existsSync(statePath)) {
      process.stdout.write(JSON.stringify({ decision: 'approve' }));
      return;
    }

    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    const routingCompleted = Boolean(state?.routing?.completed);
    if (!routingCompleted) {
      process.stdout.write(JSON.stringify({ decision: 'approve' }));
      return;
    }

    const handoffTargetRaw =
      typeof state?.routing?.handoff_target === 'string' && state.routing.handoff_target.trim()
        ? state.routing.handoff_target.trim()
        : null;
    if (!handoffTargetRaw) {
      process.stdout.write(JSON.stringify({ decision: 'approve' }));
      return;
    }

    const handoffTarget = handoffTargetRaw.toLowerCase();
    const attempted = spawnTarget.toLowerCase();

    // If a handoff target exists, enforce spawning that target as the coordinator.
    if (isCoordinatorName(handoffTarget) && attempted !== handoffTarget) {
      const reason = [
        '==============================================================',
        'ROUTING HANDOFF TARGET MISMATCH',
        '--------------------------------------------------------------',
        `Routing completed. Required handoff target: ${handoffTargetRaw}`,
        `You attempted to spawn: ${spawnTarget}`,
        '',
        'What to do:',
        `1) Use Task to spawn ${handoffTargetRaw} (subagent_type: "${handoffTargetRaw}")`,
        '2) Continue execution under the routed coordinator (do not re-route)',
        '==============================================================',
      ].join('\n');

      process.stdout.write(JSON.stringify({ decision: 'block', reason }));
      return;
    }

    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
}

main();
