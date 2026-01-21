#!/usr/bin/env node
/**
 * No Re-Route After Routing Hook (PreToolUse)
 *
 * Problem: Some coordinators (especially under heavy prompts) may attempt to spawn
 * the router again after routing is already completed. This causes repeated routing,
 * huge token usage, and can lead to Claude Code host OOM.
 *
 * Policy:
 * - If routing is already started (even if completion is not persisted yet), block Task
 *   calls that try to spawn the router again. This closes a small race where the host
 *   can schedule the next Task before the PostToolUse routing completion hook runs.
 *
 * Fail-safe:
 * - If state can't be read/parsed, approve (fail-open).
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
  if (!spawnTarget || spawnTarget.toLowerCase() !== 'router') {
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
    const routingStarted = Boolean(state?.routing?.started_at);
    const routingCompleted = Boolean(state?.routing?.completed);
    if (!routingStarted && !routingCompleted) {
      process.stdout.write(JSON.stringify({ decision: 'approve' }));
      return;
    }

    const reason = [
      'ROUTER RE-RUN BLOCKED',
      routingCompleted
        ? 'Routing is already completed for this session.'
        : 'Routing is already in progress for this session.',
      'Do not spawn the router again; proceed with the selected workflow and delegate to step agents.',
      'If you need to re-route, start a new user request/session instead of re-running routing inside a workflow.',
    ].join('\n');

    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  } catch {
    // Fail-open to avoid deadlocks on state parsing issues.
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
}

main();
