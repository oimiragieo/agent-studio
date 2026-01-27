#!/usr/bin/env node
/**
 * TaskCreate Guard Hook
 * PreToolUse hook for TaskCreate
 *
 * Enforces: Complex tasks (HIGH/EPIC) must spawn PLANNER first
 *
 * ENFORCEMENT MODES:
 * - block (default): Violations are blocked with error message
 * - warn: Violations produce warning but are allowed
 * - off: Enforcement disabled (not recommended)
 *
 * Override via environment variable:
 *   PLANNER_FIRST_ENFORCEMENT=warn
 *   PLANNER_FIRST_ENFORCEMENT=off
 *
 * Exit codes:
 * - 0: Allow operation (complexity is low/trivial, planner spawned, or warn mode)
 * - 2: Block operation (high/epic complexity without planner in block mode)
 *
 * SECURITY NOTE (SEC-008 FIX):
 * This hook fails CLOSED on errors (exits 2) to prevent security bypass via induced errors.
 * Override with TASK_CREATE_GUARD_FAIL_OPEN=true for debugging only.
 */

'use strict';

const routerState = require('../router-state.cjs');

// PERF-006: Use shared hook-input utility instead of duplicated 55-line parseHookInput function
const { parseHookInputAsync, getToolName } = require('../../../lib/utils/hook-input.cjs');

/**
 * Format the violation message for output.
 *
 * @param {string} complexity - The current complexity level
 * @returns {string} Formatted violation message
 */
function formatViolationMessage(complexity) {
  return `[ROUTER PROTOCOL VIOLATION] Complex task (${complexity}) requires PLANNER agent.
Spawn PLANNER first: Task({ subagent_type: 'general-purpose', description: '...', prompt: 'You are PLANNER...' })
Then PLANNER will create the tasks.`;
}

/**
 * Main execution function.
 */
async function main() {
  try {
    // Check enforcement mode
    // Default: block. Set PLANNER_FIRST_ENFORCEMENT=warn for dev override
    const enforcement = process.env.PLANNER_FIRST_ENFORCEMENT || 'block';
    if (enforcement === 'off') {
      // SEC-010 FIX: Audit log when security override is used
      console.error(
        JSON.stringify({
          hook: 'task-create-guard',
          event: 'security_override_used',
          override: 'PLANNER_FIRST_ENFORCEMENT=off',
          timestamp: new Date().toISOString(),
          warning: 'Security enforcement disabled - task complexity checks bypassed',
        })
      );
      process.exit(0);
    }

    // PERF-006: Use shared hook-input utility
    const hookInput = await parseHookInputAsync();

    if (!hookInput) {
      // SEC-AUDIT-004 FIX: Fail closed when no input available (security-first approach)
      // Override: Set TASK_CREATE_GUARD_ALLOW_NO_INPUT=true for debugging only
      if (process.env.TASK_CREATE_GUARD_ALLOW_NO_INPUT === 'true') {
        console.error(
          JSON.stringify({
            hook: 'task-create-guard',
            event: 'allow_no_input_override',
            timestamp: new Date().toISOString(),
            warning: 'Allowing TaskCreate without input validation (debugging mode)',
          })
        );
        process.exit(0);
      }

      // Audit log and fail closed
      console.error(
        JSON.stringify({
          hook: 'task-create-guard',
          event: 'no_input_fail_closed',
          timestamp: new Date().toISOString(),
          reason: 'No hook input provided - failing closed for security',
        })
      );
      process.exit(2);
    }

    // Verify this is a TaskCreate tool call using shared helper
    const toolName = getToolName(hookInput);
    if (toolName !== 'TaskCreate') {
      // Not a TaskCreate tool - should not happen but fail open
      process.exit(0);
    }

    // Get current state
    const complexity = routerState.getComplexity();
    const isPlannerRequired = routerState.isPlannerRequired();
    const isPlannerSpawned = routerState.isPlannerSpawned();

    // Check: Is planner required but not spawned?
    if (isPlannerRequired && !isPlannerSpawned) {
      const message = formatViolationMessage(complexity);

      if (enforcement === 'block') {
        console.log(JSON.stringify({ result: 'block', message }));
        process.exit(2);
      } else {
        // Default to warn
        console.log(JSON.stringify({ result: 'warn', message }));
        process.exit(0);
      }
    }

    // All checks passed - allow
    process.exit(0);
  } catch (err) {
    // SEC-008 FIX: Fail closed on errors (defense-in-depth)
    // Security hooks must deny by default when state is unknown
    // Override: Set TASK_CREATE_GUARD_FAIL_OPEN=true for debugging only
    if (process.env.TASK_CREATE_GUARD_FAIL_OPEN === 'true') {
      if (process.env.DEBUG_HOOKS) {
        console.error('TaskCreate guard error (fail-open override):', err.message);
      }
      process.exit(0);
    }

    // Log the error for audit trail
    console.error(
      JSON.stringify({
        hook: 'task-create-guard',
        event: 'error_fail_closed',
        error: err.message,
        timestamp: new Date().toISOString(),
      })
    );

    if (process.env.DEBUG_HOOKS) {
      console.error('TaskCreate guard error:', err.message);
      console.error('Stack trace:', err.stack);
    }

    // Fail closed: block the operation when security state is unknown
    process.exit(2);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { main, parseHookInput: parseHookInputAsync };
