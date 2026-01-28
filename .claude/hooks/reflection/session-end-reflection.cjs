#!/usr/bin/env node
/**
 * @deprecated PERF-003: Use unified-reflection-handler.cjs instead
 * This hook has been consolidated into unified-reflection-handler.cjs
 * which handles task-completion, error-recovery, session-end reflection,
 * and memory extraction in a single process.
 *
 * Hook: session-end-reflection.cjs
 * Trigger: SessionEnd event (Stop, SessionEnd)
 * Purpose: Run reflection summary for the session
 *
 * This hook triggers at session end to queue a batch reflection
 * for all unreflected tasks in the session. This ensures no
 * completed work goes without quality assessment.
 *
 * ENFORCEMENT MODES:
 * - block (default): Queue reflection (no blocking behavior for event hooks)
 * - warn: Queue reflection with warning message
 * - off: Disabled, no reflection queued
 *
 * Environment variables:
 *   REFLECTION_ENABLED=false - Disable all reflection
 *   REFLECTION_HOOK_MODE=off - Disable this hook
 *   REFLECTION_HOOK_MODE=warn - Enable with warnings
 */

'use strict';

const fs = require('fs');
const path = require('path');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');
const { parseHookInputAsync, auditLog, debugLog } = require('../../lib/utils/hook-input.cjs');

// PERF-006: Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

// Configuration
let QUEUE_FILE = path.join(PROJECT_ROOT, '.claude', 'context', 'reflection-queue.jsonl');

// Session end event types
const SESSION_END_EVENTS = ['Stop', 'SessionEnd'];

/**
 * Check if reflection is enabled
 * @returns {boolean} True if reflection should run
 */
function isEnabled() {
  // Check REFLECTION_ENABLED (default: true)
  if (process.env.REFLECTION_ENABLED === 'false') {
    return false;
  }

  // Check REFLECTION_HOOK_MODE (default: block, which means enabled)
  const mode = process.env.REFLECTION_HOOK_MODE || 'block';
  if (mode === 'off') {
    return false;
  }

  return true;
}

/**
 * Check if the hook input indicates session end
 * @param {object|null} input - The hook input from Claude Code
 * @returns {boolean} True if this is a session end event
 */
function shouldTriggerReflection(input) {
  if (!input) return false;

  // Support both event field formats
  const eventType = input.event || input.event_type;

  // Check if this is a session end event
  return SESSION_END_EVENTS.includes(eventType);
}

/**
 * Extract session statistics from input
 * @param {object} input - The hook input
 * @returns {object} Session statistics
 */
function getSessionStats(input) {
  const stats = input.stats || {};

  return {
    toolCalls: stats.tool_calls || 0,
    errors: stats.errors || 0,
    tasksCompleted: stats.tasks_completed || 0,
  };
}

/**
 * Create a reflection queue entry for session end
 * @param {object} input - The hook input
 * @returns {object} Reflection entry for the queue
 */
function createReflectionEntry(input) {
  const sessionId = input.session_id || input.sessionId || process.env.CLAUDE_SESSION_ID;
  const stats = getSessionStats(input);

  return {
    context: 'session_end',
    trigger: 'session_end',
    sessionId: sessionId,
    scope: 'all_unreflected_tasks',
    timestamp: new Date().toISOString(),
    priority: 'low',
    stats: stats,
  };
}

/**
 * Queue a reflection entry
 * @param {object} entry - The reflection entry to queue
 * @param {string} queueFile - Path to queue file (for testing)
 */
function queueReflection(entry, queueFile = QUEUE_FILE) {
  // Check if enabled
  if (!isEnabled()) {
    return;
  }

  try {
    // Ensure directory exists
    const queueDir = path.dirname(queueFile);
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    // Append entry as JSON line
    fs.appendFileSync(queueFile, JSON.stringify(entry) + '\n');

    // Log in warn mode
    const mode = process.env.REFLECTION_HOOK_MODE || 'block';
    if (mode === 'warn') {
      auditLog('session-end-reflection', 'queued', {
        sessionId: entry.sessionId,
        trigger: 'session_end',
      });
    }
  } catch (err) {
    // Log error but don't fail the hook
    debugLog('session-end-reflection', 'Error queueing reflection', err);
  }
}

// PERF-006: parseHookInput is now imported from hook-input.cjs at the top of the file
// Removed 50-line duplicated function

/**
 * Main execution
 */
async function main() {
  try {
    // Check if enabled
    if (!isEnabled()) {
      process.exit(0);
    }

    // Parse input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0);
    }

    // Check if this should trigger reflection
    if (!shouldTriggerReflection(hookInput)) {
      process.exit(0);
    }

    // Create and queue the reflection entry
    const entry = createReflectionEntry(hookInput);
    queueReflection(entry);

    // Event hooks always exit 0 (don't block)
    process.exit(0);
  } catch (err) {
    // Fail open
    debugLog('session-end-reflection', 'Hook error during processing', err);
    process.exit(0);
  }
}

// Run if main module
if (require.main === module) {
  main();
}

// Exports for testing
module.exports = {
  isEnabled,
  shouldTriggerReflection,
  createReflectionEntry,
  getSessionStats,
  queueReflection,
  main,
  SESSION_END_EVENTS,
  get QUEUE_FILE() {
    return QUEUE_FILE;
  },
  set QUEUE_FILE(val) {
    QUEUE_FILE = val;
  },
};
