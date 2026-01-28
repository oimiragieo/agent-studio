#!/usr/bin/env node
/**
 * Router Mode Reset Hook
 *
 * Trigger: UserPromptSubmit
 *
 * Resets the router state to "router" mode on each new user prompt.
 * This ensures that every new prompt cycle starts with writes blocked
 * until a Task agent is spawned.
 *
 * Exit codes:
 * - 0: Always allow (this hook only resets state)
 */

const routerState = require('./router-state.cjs');

// PERF-006/PERF-007: Use shared hook-input.cjs utility
const { parseHookInputSync } = require('../../lib/utils/hook-input.cjs');

/**
 * Main execution
 */
function main() {
  // PERF-006/PERF-007: Use shared hook-input.cjs utility
  const hookInput = parseHookInputSync();

  // Get the user prompt for logging
  let userPrompt = '';
  if (hookInput) {
    userPrompt = hookInput.prompt || hookInput.message || '';
  }

  // Skip for very short prompts or slash commands (handled elsewhere)
  if (userPrompt && userPrompt.trim().startsWith('/')) {
    process.exit(0);
  }

  // Bug fix: Check if we're in an active agent context before resetting
  // Subagents also trigger UserPromptSubmit, so we need to skip reset
  // if a task was spawned recently (within 30 minutes)
  const currentState = routerState.getState();
  if (currentState.mode === 'agent' && currentState.taskSpawned) {
    const taskSpawnedAt = currentState.taskSpawnedAt
      ? new Date(currentState.taskSpawnedAt).getTime()
      : 0;
    const isRecentTask = Date.now() - taskSpawnedAt < 30 * 60 * 1000; // 30 minutes
    if (isRecentTask) {
      // Skip reset - we're in an active agent context
      if (process.env.ROUTER_DEBUG === 'true') {
        console.log('[router-mode-reset] Skipping reset - active agent context detected');
        console.log('[router-mode-reset] Task spawned at: ' + currentState.taskSpawnedAt);
      }
      process.exit(0);
    }
  }

  // Reset state to router mode
  const state = routerState.resetToRouterMode();

  // Optional: Show state reset message in verbose mode
  if (process.env.ROUTER_DEBUG === 'true') {
    console.log('[router-mode-reset] State reset to router mode');
    console.log('[router-mode-reset] Session: ' + (state.sessionId || 'unknown'));
  }

  // Always allow - this hook only manages state
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
main();
