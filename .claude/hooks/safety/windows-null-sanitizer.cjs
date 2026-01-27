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

/**
 * Parse hook input from Claude Code.
 * Input comes as JSON via stdin.
 *
 * @returns {Promise<object|null>} Parsed hook context or null
 */
async function parseHookInput() {
  return new Promise(resolve => {
    let input = '';
    let hasData = false;

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      hasData = true;
      input += chunk;
    });

    process.stdin.on('end', () => {
      if (!hasData || !input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (e) {
        resolve(null);
      }
    });

    process.stdin.on('error', () => {
      resolve(null);
    });

    setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, 100);

    process.stdin.resume();
  });
}

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

    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0);
    }

    // Verify this is a Bash tool call
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Bash') {
      process.exit(0);
    }

    // Extract the command
    const toolInput = hookInput.tool_input || hookInput.input || {};
    const command = toolInput.command;

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
      ...toolInput,
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
