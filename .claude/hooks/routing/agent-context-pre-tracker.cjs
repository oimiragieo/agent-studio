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

/**
 * Parse hook input from stdin
 * PreToolUse hooks receive input via stdin as JSON
 */
async function parseHookInput() {
  return new Promise(resolve => {
    let data = '';
    let hasData = false;

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      hasData = true;
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (!hasData || !data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });

    process.stdin.on('error', () => {
      resolve(null);
    });

    // Timeout to prevent hanging on empty input
    setTimeout(() => {
      if (!hasData) resolve(null);
    }, 100);

    process.stdin.resume();
  });
}

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

    // Extract tool input - may come in different formats
    let toolInput = null;
    if (input) {
      if (typeof input.tool_input === 'string') {
        try {
          toolInput = JSON.parse(input.tool_input);
        } catch {
          toolInput = {};
        }
      } else if (input.tool_input) {
        toolInput = input.tool_input;
      } else if (input.input) {
        toolInput = input.input;
      }
    }

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

module.exports = { main, parseHookInput, extractTaskDescription };
