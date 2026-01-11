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
  delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  process.exit(0);
}, 2000);

const SESSION_STATE_PATH = join(__dirname, '..', 'context', 'tmp', 'orchestrator-session-state.json');
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

/**
 * Log audit entry (async, non-blocking)
 */
async function logAudit(entry) {
  const logDir = dirname(AUDIT_LOG_PATH);
  const logEntry = JSON.stringify({
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
      return;
    }

    const tool = hookInput.tool_name || hookInput.tool;
    const toolInput = hookInput.tool_input || {};
    const outcome = hookInput.outcome || 'unknown';

    // Skip auditing orchestration tools to prevent recursion
    if (tool === 'Task' || tool === 'TodoWrite') {
      return;
    }

    // Load session state (async)
    const state = await loadSessionState();

    if (!state || state.agent_role !== 'orchestrator') {
      // Not an orchestrator session, skip audit
      return;
    }

    // Log the audit entry
    const auditEntry = {
      session_id: state.session_id,
      agent_role: 'orchestrator',
      tool,
      tool_input: toolInput,
      outcome,
      read_count_after: state.read_count || 0,
      violation: null,
    };

    // Check if this was a violation
    if (outcome === 'blocked' || outcome === 'error') {
      const recentViolation = state.violations?.[state.violations.length - 1];
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
    clearTimeout(timeout);
    delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  });
