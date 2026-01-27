#!/usr/bin/env node
/**
 * Planner-First Guard Hook
 * Event: PreToolUse(Task)
 * Purpose: Enforce that PLANNER is spawned first for high/epic complexity tasks
 *
 * This hook solves the chicken-egg problem:
 * - If plannerRequired && !plannerSpawned: check if this Task IS a PLANNER
 *   - If IS PLANNER spawn: ALLOW (this breaks the cycle)
 *   - If NOT PLANNER spawn: BLOCK
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
 * - 0: Allow operation
 * - 2: Block operation (in block mode, or on error - SEC-008 fail-closed)
 *
 * SEC-008: The hook fails CLOSED (exits 2) on errors to prevent security bypass.
 * Set HOOK_FAIL_OPEN=true to override for debugging only.
 */

'use strict';

const routerState = require('./router-state.cjs');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const {
  parseHookInputAsync,
  getToolInput: sharedGetToolInput,
} = require('../../lib/utils/hook-input.cjs');

/**
 * Patterns to detect PLANNER agent spawns
 */
const PLANNER_PATTERNS = {
  prompt: ['you are planner', 'you are the planner', 'as planner'],
  description: ['planner'],
};

/**
 * Check if the Task being spawned is a PLANNER agent
 * @param {Object} toolInput - The Task tool input
 * @returns {boolean} True if this is a PLANNER spawn
 */
function isPlannerSpawn(toolInput) {
  const prompt = (toolInput.prompt || '').toLowerCase();
  const description = (toolInput.description || '').toLowerCase();

  // Check prompt patterns
  for (const pattern of PLANNER_PATTERNS.prompt) {
    if (prompt.includes(pattern)) {
      return true;
    }
  }

  // Check description patterns
  for (const pattern of PLANNER_PATTERNS.description) {
    if (description.includes(pattern)) {
      return true;
    }
  }

  return false;
}

// PERF-006: parseHookInput is now imported from hook-input.cjs
// Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

/**
 * Format the violation message for output.
 *
 * @param {string} complexity - The current complexity level
 * @returns {string} Formatted violation message
 */
function formatViolationMessage(complexity) {
  return `[PLANNER-FIRST VIOLATION] High/Epic complexity (${complexity}) requires PLANNER agent first.

You must spawn PLANNER before spawning implementation agents:
  Task({ subagent_type: 'general-purpose', description: 'Planner designing...', prompt: 'You are PLANNER...' })

After PLANNER completes planning, you may spawn other agents.
Set PLANNER_FIRST_ENFORCEMENT=off to disable (not recommended).`;
}

/**
 * Validate if Task spawn should be allowed
 * @param {Object} toolInput - The Task tool input
 * @returns {Object} { valid: boolean, isPlannerSpawn: boolean, error?: string }
 */
function validate(toolInput) {
  // Check enforcement mode
  const enforcement = process.env.PLANNER_FIRST_ENFORCEMENT || 'block';
  if (enforcement === 'off') {
    return { valid: true, isPlannerSpawn: false };
  }

  // Get current state
  const isPlannerRequired = routerState.isPlannerRequired();
  const plannerAlreadySpawned = routerState.isPlannerSpawned();

  // If planner not required, allow everything
  if (!isPlannerRequired) {
    return { valid: true, isPlannerSpawn: false };
  }

  // If planner already spawned, allow everything
  if (plannerAlreadySpawned) {
    return { valid: true, isPlannerSpawn: false };
  }

  // Planner is required but not yet spawned
  // Check if THIS spawn is a PLANNER spawn
  const isPlanner = isPlannerSpawn(toolInput);

  if (isPlanner) {
    // This IS a PLANNER spawn - allow it (breaks the cycle)
    return { valid: true, isPlannerSpawn: true };
  }

  // Not a PLANNER spawn, but PLANNER is required
  const complexity = routerState.getComplexity();
  const message = formatViolationMessage(complexity);

  return {
    valid: enforcement !== 'block',
    isPlannerSpawn: false,
    error: message,
  };
}

/**
 * Main execution function.
 */
async function main() {
  try {
    // Check enforcement mode early
    const enforcement = process.env.PLANNER_FIRST_ENFORCEMENT || 'block';
    if (enforcement === 'off') {
      // SEC-AUDIT-008 FIX: Audit log when security enforcement is disabled
      console.error(
        JSON.stringify({
          hook: 'planner-first-guard',
          event: 'security_override_used',
          override: 'PLANNER_FIRST_ENFORCEMENT=off',
          timestamp: new Date().toISOString(),
          warning: 'Security enforcement disabled - planner-first checks bypassed',
        })
      );
      console.log(JSON.stringify({ result: 'allow', message: 'PLANNER_FIRST_ENFORCEMENT=off' }));
      process.exit(0);
    }

    // Parse the hook input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // No input provided - fail open
      console.log(JSON.stringify({ result: 'allow', message: 'No input provided' }));
      process.exit(0);
    }

    // Verify this is a Task tool call
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Task') {
      // Not a Task tool - should not happen but fail open
      console.log(JSON.stringify({ result: 'allow', message: 'Not a Task tool call' }));
      process.exit(0);
    }

    // Get tool input
    const toolInput = hookInput.tool_input || hookInput.input || hookInput;

    // Validate
    const result = validate(toolInput);

    if (result.isPlannerSpawn) {
      // Mark planner as spawned in state (so subsequent checks pass)
      routerState.markPlannerSpawned();
      console.log(
        JSON.stringify({ result: 'allow', message: 'PLANNER spawn detected - allowing' })
      );
      process.exit(0);
    }

    if (!result.valid) {
      // Block mode - output error and exit with code 2
      console.log(JSON.stringify({ result: 'block', message: result.error }));
      process.exit(2);
    }

    // Warn mode or allowed
    if (result.error) {
      // Warn mode - show warning but allow
      console.log(JSON.stringify({ result: 'warn', message: result.error }));
    } else {
      console.log(JSON.stringify({ result: 'allow', message: 'Planner check passed' }));
    }

    process.exit(0);
  } catch (err) {
    // SEC-008: Allow debug override for troubleshooting
    if (process.env.HOOK_FAIL_OPEN === 'true') {
      console.error(
        JSON.stringify({
          hook: 'planner-first-guard',
          event: 'fail_open_override',
          error: err.message,
        })
      );
      process.exit(0);
    }

    // Audit log the error
    console.error(
      JSON.stringify({
        hook: 'planner-first-guard',
        event: 'error_fail_closed',
        error: err.message,
        timestamp: new Date().toISOString(),
      })
    );

    // SEC-008: Fail closed - deny when security state unknown
    process.exit(2);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { validate, isPlannerSpawn, main };
