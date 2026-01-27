#!/usr/bin/env node
/**
 * Bash Command Validator Hook
 *
 * PreToolUse hook that validates bash commands using the validator registry.
 * Blocks dangerous commands that could harm the system or data.
 *
 * Exit codes:
 * - 0: Allow operation (command is safe or no validator exists)
 * - 2: Block operation (command is dangerous)
 *
 * The hook fails open (exits 0) on errors to avoid blocking legitimate work.
 */

'use strict';

const { validateCommand } = require('./validators/registry.cjs');

/**
 * Parse hook input from Claude Code.
 * Input comes as JSON via stdin or command line argument.
 *
 * @returns {Promise<object|null>} Parsed hook context or null
 */
async function parseHookInput() {
  // Try command line argument first (older hook format)
  if (process.argv[2]) {
    try {
      return JSON.parse(process.argv[2]);
    } catch (e) {
      // Not valid JSON, try stdin
    }
  }

  // Read from stdin (current hook format)
  return new Promise(resolve => {
    let input = '';
    let hasData = false;

    // Set encoding for proper text handling
    process.stdin.setEncoding('utf8');

    // Handle stdin data
    process.stdin.on('data', chunk => {
      hasData = true;
      input += chunk;
    });

    // Handle end of input
    process.stdin.on('end', () => {
      if (!hasData || !input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (e) {
        // Invalid JSON
        resolve(null);
      }
    });

    // Handle errors
    process.stdin.on('error', () => {
      resolve(null);
    });

    // Set a timeout in case stdin never ends
    setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, 100);

    // Resume stdin if it was paused
    process.stdin.resume();
  });
}

/**
 * Extract the bash command from hook input.
 *
 * @param {object} hookInput - The parsed hook context
 * @returns {string|null} The command string or null if not found
 */
function extractCommand(hookInput) {
  if (!hookInput) return null;

  // Try different input structures
  const toolInput = hookInput.tool_input || hookInput.input || {};

  // The Bash tool uses 'command' parameter
  if (toolInput.command && typeof toolInput.command === 'string') {
    return toolInput.command;
  }

  return null;
}

/**
 * Format a blocked command message for display.
 *
 * @param {string} command - The blocked command
 * @param {string} reason - The reason for blocking
 * @returns {string} Formatted message
 */
function formatBlockedMessage(command, reason) {
  const truncatedCmd = command.length > 50 ? command.slice(0, 47) + '...' : command;

  return `
+--------------------------------------------------+
| BLOCKED: Dangerous Command Detected              |
+--------------------------------------------------+
| Command: ${truncatedCmd.padEnd(40)} |
|                                                  |
| Reason: ${reason.slice(0, 41).padEnd(41)}|
|                                                  |
| This command was blocked by the safety hook.     |
| If you believe this is a false positive, review  |
| the command and try a safer alternative.         |
+--------------------------------------------------+
`;
}

/**
 * Main execution function.
 */
async function main() {
  try {
    // Parse the hook input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // No input provided - fail open
      process.exit(0);
    }

    // Verify this is a Bash tool call
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Bash') {
      // Not a Bash tool - should not happen but fail open
      process.exit(0);
    }

    // Extract the command
    const command = extractCommand(hookInput);

    if (!command) {
      // No command to validate - allow
      process.exit(0);
    }

    // Validate the command using the registry
    const result = validateCommand(command);

    if (!result.valid) {
      // Command is dangerous - block it
      console.error(formatBlockedMessage(command, result.error || 'Unknown safety violation'));
      process.exit(2);
    }

    // Command is safe - allow
    process.exit(0);
  } catch (err) {
    // SECURITY FIX: Fail CLOSED on errors to prevent bypass attacks
    // An attacker could craft input that triggers errors to bypass validation
    // Defense-in-depth principle: deny by default when security state is unknown
    console.error('Bash command validator error - BLOCKING for safety:', err.message);
    if (process.env.DEBUG_HOOKS) {
      console.error('Stack trace:', err.stack);
    }
    process.exit(2);
  }
}

// Run main function
main();

// Export for testing
module.exports = { main, extractCommand, formatBlockedMessage };
