'use strict';

/**
 * task-update-tracker.cjs
 *
 * PostToolUse hook that tracks TaskUpdate calls.
 * Records to router-state.cjs so task-completion-guard can verify
 * agents are properly updating task status.
 *
 * Trigger: PostToolUse(TaskUpdate)
 */

const routerState = require('./router-state.cjs');

/**
 * Parse hook input from Claude Code.
 * Input comes as JSON via stdin.
 *
 * @returns {Promise<object|null>} Parsed hook context or null
 */
async function parseHookInput() {
  return new Promise(resolve => {
    let data = '';
    let hasData = false;

    // Set encoding for proper text handling
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

    setTimeout(() => {
      if (!hasData) resolve(null);
    }, 100);

    // Resume stdin if it was paused
    process.stdin.resume();
  });
}

/**
 * Main execution function.
 */
async function main() {
  try {
    const input = await parseHookInput();

    if (!input) {
      process.exit(0);
      return;
    }

    // PostToolUse provides tool_input with the parameters
    const toolInput = input.tool_input || {};

    // Extract taskId and status from TaskUpdate call
    const taskId = toolInput.taskId;
    const status = toolInput.status;

    if (taskId && status) {
      // Record to router-state
      routerState.recordTaskUpdate(taskId, status);

      if (process.env.DEBUG_HOOKS) {
        console.error(
          `[task-update-tracker] Recorded TaskUpdate: taskId=${taskId}, status=${status}`
        );
      }
    }

    // Always allow - this is just tracking, not enforcement
    process.exit(0);
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error('task-update-tracker error:', err.message);
    }
    // Fail open - tracking errors should not block
    process.exit(0);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main, parseHookInput };
