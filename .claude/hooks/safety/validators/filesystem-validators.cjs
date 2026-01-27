'use strict';

/**
 * File system validators
 * Converted from Auto-Claude filesystem_validators.py
 *
 * Validators for file system operations (chmod, rm, init scripts).
 * Prevents dangerous deletions and permission changes.
 */

/**
 * Safe chmod modes that can be applied
 * @type {Set<string>}
 */
const SAFE_CHMOD_MODES = new Set([
  '+x',
  'a+x',
  'u+x',
  'g+x',
  'o+x',
  'ug+x',
  '755',
  '644',
  '700',
  '600',
  '775',
  '664',
]);

/**
 * Dangerous rm patterns that should be blocked
 * @type {RegExp[]}
 */
const DANGEROUS_RM_PATTERNS = [
  /^\/$/, // Root
  /^\.\.$/, // Parent directory
  /^~$/, // Home directory
  /^\*$/, // Wildcard only
  /^\/\*$/, // Root wildcard
  /^\.\.\//, // Escaping current directory
  /^\/home$/, // /home
  /^\/usr$/, // /usr
  /^\/etc$/, // /etc
  /^\/var$/, // /var
  /^\/bin$/, // /bin
  /^\/lib$/, // /lib
  /^\/opt$/, // /opt
  // Windows system directories
  /^C:\\Windows/i,
  /^C:\\Program Files/i,
  /^C:\\Users$/i,
];

/**
 * Parse a command string into tokens, handling quotes.
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

  if (inSingleQuote || inDoubleQuote) {
    return null;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if a path contains path traversal patterns
 *
 * @param {string} path - The path to check
 * @returns {boolean} True if path contains traversal patterns
 */
function containsPathTraversal(path) {
  // Check for ../ or ..\ patterns
  return path.includes('../') || path.includes('..\\') || path === '..';
}

/**
 * Validate chmod commands - only allow making files executable with safe modes.
 *
 * @param {string} commandString - The full chmod command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateChmodCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse chmod command' };
  }

  if (tokens.length === 0 || tokens[0] !== 'chmod') {
    return { valid: false, error: 'Not a chmod command' };
  }

  let mode = null;
  const files = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Allow -R/--recursive for +x
    if (token === '-R' || token === '--recursive') {
      continue;
    }

    // Block other flags
    if (token.startsWith('-')) {
      return { valid: false, error: `chmod flag '${token}' is not allowed` };
    }

    // First non-flag is the mode
    if (mode === null) {
      mode = token;
    } else {
      files.push(token);
    }
  }

  if (mode === null) {
    return { valid: false, error: 'chmod requires a mode' };
  }

  if (files.length === 0) {
    return { valid: false, error: 'chmod requires at least one file' };
  }

  // Only allow +x variants (making files executable)
  // Also allow common safe modes like 755, 644
  const isExecutableMode = /^[ugoa]*\+x$/.test(mode);

  if (!SAFE_CHMOD_MODES.has(mode) && !isExecutableMode) {
    return {
      valid: false,
      error: `chmod only allowed with executable modes (+x, 755, etc.), got: ${mode}`,
    };
  }

  return { valid: true, error: '' };
}

/**
 * Validate rm commands - prevent dangerous deletions.
 *
 * @param {string} commandString - The full rm command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateRmCommand(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse rm command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty rm command' };
  }

  // Check for path traversal and dangerous patterns
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Allow flags: -r, -f, -rf, -fr, -v, -i
    if (token.startsWith('-')) {
      continue;
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_RM_PATTERNS) {
      if (pattern.test(token)) {
        return {
          valid: false,
          error: `rm target '${token}' is not allowed for safety`,
        };
      }
    }

    // Check for path traversal
    if (containsPathTraversal(token)) {
      return {
        valid: false,
        error: `rm with path traversal '${token}' is not allowed`,
      };
    }
  }

  return { valid: true, error: '' };
}

/**
 * Validate init.sh script execution - only allow ./init.sh.
 *
 * @param {string} commandString - The full init script command string
 * @returns {{valid: boolean, error: string}} Validation result
 */
function validateInitScript(commandString) {
  const tokens = parseCommand(commandString);

  if (tokens === null) {
    return { valid: false, error: 'Could not parse init script command' };
  }

  if (tokens.length === 0) {
    return { valid: false, error: 'Empty command' };
  }

  const script = tokens[0];

  // Allow ./init.sh or paths ending in /init.sh
  if (script === './init.sh' || script.endsWith('/init.sh')) {
    return { valid: true, error: '' };
  }

  return { valid: false, error: `Only ./init.sh is allowed, got: ${script}` };
}

module.exports = {
  SAFE_CHMOD_MODES,
  DANGEROUS_RM_PATTERNS,
  containsPathTraversal,
  validateChmodCommand,
  validateRmCommand,
  validateInitScript,
};
