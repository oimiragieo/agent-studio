#!/usr/bin/env node
/**
 * Windows Null Device Sanitizer Hook
 *
 * PreToolUse hook that sanitizes bash commands on Windows by replacing
 * Unix-style /dev/null with Windows NUL device.
 *
 * Problem: When Claude generates bash commands with "/dev/null" on Windows,
 * it creates a literal file named "nul" in the working directory instead of
 * discarding output.
 *
 * Solution: This hook intercepts Bash commands and replaces /dev/null with NUL
 * before execution.
 *
 * Exit codes:
 * - 0: Allow operation (outputs modified command if on Windows)
 *
 * Output (when modifying):
 * - JSON with tool_input containing the sanitized command
 */

'use strict';

const isWindows = process.platform === 'win32';

// PERF-006/PERF-007: Use shared hook-input.cjs utility
const {
  parseHookInputAsync,
  getToolName,
  getToolInput,
} = require('../../lib/utils/hook-input.cjs');

/**
 * Sanitize a command by replacing /dev/null with NUL on Windows.
 *
 * Handles various patterns:
 * - > /dev/null
 * - 2>/dev/null
 * - &>/dev/null
 * - 2>&1 >/dev/null
 * - >/dev/null 2>&1
 *
 * @param {string} command - The command to sanitize
 * @returns {string} Sanitized command
 */
function sanitizeNullDevice(command) {
  if (!isWindows) {
    return command;
  }

  // Replace all instances of /dev/null with NUL
  // Handle various redirect patterns
  let sanitized = command;

  // Pattern: /dev/null (the actual device reference)
  sanitized = sanitized.replace(/\/dev\/null/g, 'NUL');

  return sanitized;
}

/**
 * Main execution function.
 */
async function main() {
  try {
    // Skip on non-Windows platforms
    if (!isWindows) {
      process.exit(0);
    }

    // PERF-006/PERF-007: Use shared hook-input.cjs utility
    const hookInput = await parseHookInputAsync();

    if (!hookInput) {
      process.exit(0);
    }

    // Verify this is a Bash tool call using shared helper
    const toolName = getToolName(hookInput);
    if (toolName !== 'Bash') {
      process.exit(0);
    }

    // Extract the command using shared helper
    const toolInputData = getToolInput(hookInput);
    const command = toolInputData.command;

    if (!command || typeof command !== 'string') {
      process.exit(0);
    }

    // Check if command contains /dev/null
    if (!command.includes('/dev/null')) {
      process.exit(0);
    }

    // Sanitize the command
    const sanitizedCommand = sanitizeNullDevice(command);

    // Output the modified tool_input to update the command
    const modifiedInput = {
      ...toolInputData,
      command: sanitizedCommand,
    };

    // Output JSON to modify the command
    console.log(JSON.stringify({ tool_input: modifiedInput }));
    process.exit(0);
  } catch (err) {
    // On any error, fail open
    if (process.env.DEBUG_HOOKS) {
      console.error('Windows null sanitizer error:', err.message);
    }
    process.exit(0);
  }
}

main();

module.exports = { sanitizeNullDevice, main };
