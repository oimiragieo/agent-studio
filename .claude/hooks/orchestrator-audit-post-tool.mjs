#!/usr/bin/env node
/**
 * Orchestrator Audit Post-Tool Hook v2.1 - MEMORY OPTIMIZED
 *
 * Logs all orchestrator tool calls for compliance reporting.
 * Uses async I/O and proper protections.
 */

import { readFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING === 'true') {
  process.exit(0);
}
process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING = 'true';

// Timeout protection - force exit after 2 seconds
const timeout = setTimeout(() => {
  console.error('[ORCHESTRATOR AUDIT] Timeout exceeded, exiting');
  try {
    delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  } finally {
    process.exit(0);
  }
}, 2000);

function safeExit(code = 0) {
  try {
    clearTimeout(timeout);
  } catch {
    // ignore
  }

  try {
    delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  } finally {
    process.exit(code);
  }
}

const SESSION_STATE_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.json'
);
const SESSION_DELTA_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.delta.jsonl'
);
const AUDIT_LOG_PATH = join(__dirname, '..', 'context', 'logs', 'orchestrator-audit.log');

/**
 * Load session state (async)
 */
async function loadSessionState() {
  try {
    if (existsSync(SESSION_STATE_PATH)) {
      const content = await readFile(SESSION_STATE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    // No session state or error reading
  }
  return null;
}

async function readSessionDeltas() {
  try {
    if (!existsSync(SESSION_DELTA_PATH)) return [];
    const content = await readFile(SESSION_DELTA_PATH, 'utf-8');
    if (!content) return [];

    const deltas = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') deltas.push(parsed);
      } catch {
        // ignore malformed line
      }
    }
    return deltas;
  } catch {
    return [];
  }
}

function applySessionDeltas(state, deltas) {
  if (!state || !deltas?.length) return state;

  for (const delta of deltas) {
    if (delta?.agent_role === 'orchestrator') state.agent_role = 'orchestrator';

    if (Number.isFinite(delta?.read_inc) && delta.read_inc !== 0) {
      state.read_count =
        (Number.isFinite(state.read_count) ? state.read_count : 0) + delta.read_inc;
    }

    if (delta?.violation && typeof delta.violation === 'object') {
      state.violations = Array.isArray(state.violations) ? state.violations : [];
      state.violations.push(delta.violation);
    }
  }

  return state;
}

/**
 * Log audit entry (async, non-blocking)
 */
async function logAudit(entry) {
  const logDir = dirname(AUDIT_LOG_PATH);
  const logEntry =
    JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    }) + '\n';

  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(AUDIT_LOG_PATH, logEntry, 'utf-8');
  } catch (e) {
    // Fail silently - audit logging should not block
  }
}

/**
 * Main hook function
 */
async function main() {
  try {
    // Read input from stdin
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }

    let hookInput;
    try {
      hookInput = JSON.parse(input);
    } catch (e) {
      // Invalid input, exit silently
      safeExit(0);
    }

    const tool = hookInput.tool_name || hookInput.tool;
    const toolInput = hookInput.tool_input || {};
    const outcome = hookInput.outcome || 'unknown';

    // Skip auditing orchestration tools to prevent recursion
    if (tool === 'Task' || tool === 'TodoWrite') {
      safeExit(0);
    }

    // Load session state (async) + apply any debounced deltas
    const state = await loadSessionState();
    const effectiveState = state
      ? applySessionDeltas(structuredClone(state), await readSessionDeltas())
      : null;

    if (!effectiveState || effectiveState.agent_role !== 'orchestrator') {
      // Not an orchestrator session, skip audit
      safeExit(0);
    }

    // Log the audit entry
    const auditEntry = {
      session_id: effectiveState.session_id,
      agent_role: 'orchestrator',
      tool,
      tool_input: toolInput,
      outcome,
      read_count_after: effectiveState.read_count || 0,
      violation: null,
    };

    // Check if this was a violation
    if (outcome === 'blocked' || outcome === 'error') {
      const recentViolation = effectiveState.violations?.[effectiveState.violations.length - 1];
      if (recentViolation && recentViolation.tool === tool) {
        auditEntry.violation = {
          type: recentViolation.type,
          message: recentViolation.reason,
          correct_action: `Spawn ${recentViolation.delegate} subagent`,
        };
      }
    }

    // Best-effort audit logging (await so the entry is actually written)
    await logAudit(auditEntry);
  } catch (error) {
    // Fail silently - audit is non-critical
  }
}

main()
  .catch(error => {
    console.error('Audit hook error:', error);
  })
  .finally(() => {
    safeExit(0);
  });
