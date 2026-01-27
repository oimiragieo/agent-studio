#!/usr/bin/env node
/**
 * agent-context-pre-tracker.cjs
 *
 * PreToolUse hook for Task operations.
 * Sets mode='agent' BEFORE the task starts to prevent race conditions
 * where the agent's UserPromptSubmit resets to router mode.
 *
 * Race Condition Fixed:
 *   BEFORE: Router Task() -> Agent starts -> UserPromptSubmit resets to 'router'
 *                         -> PostToolUse sets 'agent' (TOO LATE)
 *
 *   AFTER:  Router Task() -> PreToolUse sets 'agent' -> Agent starts
 *                         -> UserPromptSubmit sees 'agent', skips reset
 *
 * Trigger: PreToolUse(Task)
 *
 * Exit codes:
 * - 0: Always allow (this hook only tracks state)
 */

'use strict';

const routerState = require('./router-state.cjs');

// PERF-006: Use shared hook-input utility instead of duplicated 35-line parseHookInput function
const { parseHookInputAsync, getToolInput } = require('../../lib/utils/hook-input.cjs');

// PERF-006: Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

/**
 * Extract task description from tool input
 */
function extractTaskDescription(toolInput) {
  if (!toolInput) return 'agent task';

  // Try to get description from various possible fields
  if (toolInput.description) return toolInput.description;
  if (toolInput.prompt) {
    // Extract first line or truncate
    const firstLine = toolInput.prompt.split('\n')[0];
    return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
  }
  if (toolInput.subagent_type) return `${toolInput.subagent_type} agent`;

  return 'agent task';
}

/**
 * Main execution
 */
async function main() {
  try {
    const input = await parseHookInput();

    // PERF-006: Extract tool input using shared helper
    const toolInput = getToolInput(input);

    // Extract task description
    const taskDescription = extractTaskDescription(toolInput);

    // Set mode to agent BEFORE task starts
    // This prevents the race condition where UserPromptSubmit resets to router mode
    routerState.enterAgentMode(taskDescription);

    if (process.env.ROUTER_DEBUG === 'true') {
      console.log(`[agent-context-pre-tracker] Pre-set mode=agent for: ${taskDescription}`);
    }

    // Always allow Task to proceed
    process.exit(0);
  } catch (err) {
    if (process.env.DEBUG_HOOKS === 'true') {
      console.error('[agent-context-pre-tracker] Error:', err.message);
    }
    // Fail open - don't block tasks due to hook errors
    process.exit(0);
  }
}

main();

module.exports = { main, extractTaskDescription };
