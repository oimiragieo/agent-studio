#!/usr/bin/env node
/**
 * Security Review Guard Hook
 * Event: PreToolUse(Task)
 * Purpose: Block DEVELOPER/QA spawns when security review required but not done
 * Fixes: SEC-004 vulnerability
 *
 * Environment: SECURITY_REVIEW_ENFORCEMENT=block|warn|off (default: warn)
 *
 * Exit codes:
 * - 0: Allow operation
 * - 2: Block operation (security review required in block mode, or on error - SEC-008 fail-closed)
 *
 * SEC-008: The hook fails CLOSED (exits 2) on errors to prevent security bypass.
 * Set HOOK_FAIL_OPEN=true to override for debugging only.
 */

'use strict';

const routerState = require('../router-state.cjs');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const {
  parseHookInputAsync,
  getToolInput: sharedGetToolInput,
  getToolName: sharedGetToolName,
} = require('../../../lib/utils/hook-input.cjs');

// Agents that need security review before spawning (implementation agents)
const IMPLEMENTATION_AGENTS = ['developer', 'qa', 'devops'];

/**
 * Read current router state
 * @returns {Object} Current state
 *
 * SEC-AUDIT-007 FIX: Fail CLOSED on errors - return restrictive defaults
 * that require security review (defense-in-depth)
 */
function readState() {
  try {
    return routerState.getState();
  } catch (e) {
    // SEC-AUDIT-007 FIX: Fail CLOSED on errors - require security review when state unknown
    console.error(
      JSON.stringify({
        hook: 'security-review-guard',
        event: 'state_read_error_fail_closed',
        error: e.message,
        timestamp: new Date().toISOString(),
      })
    );
    return { requiresSecurityReview: true, securitySpawned: false };
  }
}

/**
 * Validate if Task spawn should be allowed
 * @param {Object} input - Hook input with tool and prompt
 * @returns {Object} { valid: boolean, error?: string }
 */
function validate(input) {
  // Check enforcement mode
  const enforcement = process.env.SECURITY_REVIEW_ENFORCEMENT || 'block';
  if (enforcement === 'off') {
    return { valid: true };
  }

  const state = readState();

  // Check if security review required but not done
  if (state.requiresSecurityReview && !state.securitySpawned) {
    // Check if spawning an implementation agent
    const prompt = (input.prompt || '').toLowerCase();
    const isImplementationAgent = IMPLEMENTATION_AGENTS.some(
      agent => prompt.includes(`you are ${agent}`) || prompt.includes(`you are the ${agent}`)
    );

    if (isImplementationAgent) {
      const action = enforcement === 'block' ? 'BLOCKED' : 'WARNING';
      return {
        valid: enforcement !== 'block',
        error: `[SEC-004] ${action}: Security review required before implementation.

Spawn SECURITY-ARCHITECT first to review security implications.
Set SECURITY_REVIEW_ENFORCEMENT=off to disable (not recommended).`,
      };
    }
  }

  return { valid: true };
}

// PERF-006: parseHookInput is now imported from hook-input.cjs
// Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

/**
 * Main execution function
 */
async function main() {
  try {
    // Parse the hook input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // No input provided - fail open
      process.exit(0);
    }

    // Verify this is a Task tool call
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Task') {
      // Not a Task tool - should not happen but fail open
      process.exit(0);
    }

    // Get tool input
    const toolInput = hookInput.tool_input || hookInput.input || hookInput;

    // Validate
    const result = validate(toolInput);

    if (!result.valid) {
      // Block mode - output error and exit with code 2
      console.error(result.error);
      process.exit(2);
    }

    // Warn mode or allowed - exit with 0
    if (result.error) {
      // Warn mode - show warning but allow
      console.warn(result.error);
    }

    process.exit(0);
  } catch (err) {
    // SEC-008: Allow debug override for troubleshooting
    if (process.env.HOOK_FAIL_OPEN === 'true') {
      console.error(
        JSON.stringify({
          hook: 'security-review-guard',
          event: 'fail_open_override',
          error: err.message,
        })
      );
      process.exit(0);
    }

    // Audit log the error
    console.error(
      JSON.stringify({
        hook: 'security-review-guard',
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
module.exports = { validate, readState };
