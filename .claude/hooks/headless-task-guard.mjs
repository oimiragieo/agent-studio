#!/usr/bin/env node
/**
 * headless-task-guard.mjs (PreToolUse)
 *
 * Goal: keep "headless" workflows UI-safe by preventing job-runner/coordinators
 * from fanning out into many Task-spawned subagents (a common Claude Code host OOM trigger).
 *
 * Policy:
 * - If routing is NOT completed: approve.
 * - If routing IS completed and selected workflow is *-headless.yaml:
 *   - Allow exactly one Task spawn: the required `handoff_target` while `handoff_completed` is false.
 *   - Deny all other Task spawns for the session once handoff is complete.
 *
 * Fail-safe: approve on any unexpected error.
 *
 * Output schema: { "decision": "approve" | "deny", "reason"?: "..." }
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { getSessionKeyForHook } from './session-key.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

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

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function isTaskToolName(value) {
  const lower = normalizeToolName(value).toLowerCase();
  return lower === 'task' || lower.startsWith('task(');
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function resolveTmpDir() {
  const raw =
    process.env.CLAUDE_HOOK_TMP_DIR ||
    process.env.CLAUDE_TMP_DIR ||
    process.env.CLAUDE_CONTEXT_TMP_DIR ||
    join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  const s = String(raw || '').trim();
  if (!s) return join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  return isAbsolute(s) ? s : resolve(PROJECT_ROOT, s);
}

function getTaskSpawnTarget(toolName, toolInput) {
  if (!isTaskToolName(toolName)) return null;
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

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function getSelectedWorkflowFromState(state) {
  const decision =
    state?.routing?.decision && typeof state.routing.decision === 'object'
      ? state.routing.decision
      : null;
  const candidates = [
    decision?.selected_workflow,
    decision?.selectedWorkflow,
    decision?.workflow_selection,
    decision?.workflowSelection,
    state?.routing?.selected_workflow,
    state?.routing?.workflow_selection,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function isHeadlessWorkflowPath(workflowPath) {
  const s = String(workflowPath || '')
    .trim()
    .toLowerCase();
  if (!s) return false;
  return s.includes('-headless.yaml') || s.includes('-headless.yml');
}

async function main() {
  const hookInput = await readStdinJson();
  if (!hookInput || typeof hookInput !== 'object') {
    respond({ decision: 'approve' });
    return;
  }

  const toolName =
    hookInput.tool_name ?? hookInput.tool ?? hookInput.toolName ?? hookInput.name ?? '';
  const toolInput =
    hookInput.tool_input ?? hookInput.toolInput ?? hookInput.input ?? hookInput.params ?? {};
  if (!isTaskToolName(toolName)) {
    respond({ decision: 'approve' });
    return;
  }

  const tmpDir = resolveTmpDir();
  const sessionKey = String((await getSessionKeyForHook({ hookInput, tmpDir })) || '').trim();
  if (!sessionKey) {
    respond({ decision: 'approve' });
    return;
  }

  const statePath = join(tmpDir, 'routing-sessions', `${safeFileId(sessionKey)}.json`);
  const state = readJson(statePath);
  if (!state) {
    respond({ decision: 'approve' });
    return;
  }

  const routingCompleted = Boolean(state?.routing?.completed);
  if (!routingCompleted) {
    respond({ decision: 'approve' });
    return;
  }

  const selectedWorkflow = getSelectedWorkflowFromState(state);
  if (!isHeadlessWorkflowPath(selectedWorkflow)) {
    respond({ decision: 'approve' });
    return;
  }

  const spawnTarget = getTaskSpawnTarget(toolName, toolInput);
  if (!spawnTarget) {
    respond({ decision: 'approve' });
    return;
  }

  const handoffTarget =
    typeof state?.routing?.handoff_target === 'string' ? state.routing.handoff_target.trim() : '';
  const handoffCompleted = Boolean(state?.routing?.handoff_completed);

  if (!handoffCompleted && handoffTarget) {
    if (spawnTarget.toLowerCase() === handoffTarget.toLowerCase()) {
      respond({ decision: 'approve' });
      return;
    }

    respond({
      decision: 'deny',
      reason: `Headless workflow selected (${selectedWorkflow}). Routing requires handoff to "${handoffTarget}" first; do not spawn "${spawnTarget}".`,
    });
    return;
  }

  respond({
    decision: 'deny',
    reason: `Headless workflow selected (${selectedWorkflow}). Do not spawn subagents via Task after handoff; run the headless runner command instead (e.g. pnpm ship-readiness:headless:json).`,
  });
}

main().catch(() => respond({ decision: 'approve' }));
