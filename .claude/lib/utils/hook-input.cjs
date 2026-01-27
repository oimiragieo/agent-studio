#!/usr/bin/env node
/**
 * Hook Input Parser - Shared utility for parsing hook input
 *
 * Eliminates duplicated parseHookInput() function across 40+ hooks.
 * Provides both sync and async parsing, enforcement checking, and audit logging.
 *
 * Usage:
 *   const { parseHookInputSync, parseHookInputAsync, isEnabled, auditLog } = require('../../lib/utils/hook-input.cjs');
 *   const input = parseHookInputSync();  // or await parseHookInputAsync()
 *
 * Input format from Claude Code:
 * - PreToolUse: { tool_name, tool_input, session_id, ... }
 * - PostToolUse: { tool_name, tool_output, tool_input, ... }
 * - UserPromptSubmit: { prompt, session_id, ... }
 *
 * @module hook-input
 */

'use strict';

/**
 * Default timeout for stdin reading in milliseconds
 * @constant {number}
 */
const DEFAULT_TIMEOUT_MS = 100;

/**
 * Keys allowed in hook input objects for SEC-007 sanitization
 * @constant {string[]}
 */
const ALLOWED_HOOK_INPUT_KEYS = [
  'tool_name',
  'tool',
  'tool_input',
  'input',
  'parameters',
  'tool_output',
  'output',
  'result',
  'session_id',
  'prompt',
  'file_path',
  'filePath',
  'path',
  'notebook_path',
  'content',
  'old_string',
  'new_string',
];

/**
 * Valid enforcement modes
 * @constant {string[]}
 */
const VALID_ENFORCEMENT_MODES = ['block', 'warn', 'off'];

/**
 * Keys to strip for prototype pollution prevention (SEC-007)
 * @constant {string[]}
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Sanitize parsed JSON object to prevent prototype pollution
 * @param {Object} parsed - Parsed JSON object
 * @param {boolean} [filterByAllowedKeys=false] - Whether to filter by ALLOWED_HOOK_INPUT_KEYS
 * @returns {Object|null} Sanitized object or null
 */
function sanitizeObject(parsed, filterByAllowedKeys = false) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  // Create clean object without prototype
  const clean = Object.create(null);

  for (const key of Object.keys(parsed)) {
    // Skip dangerous keys (SEC-007)
    if (DANGEROUS_KEYS.includes(key)) {
      continue;
    }

    // Skip unknown keys at top level when filtering is enabled
    if (filterByAllowedKeys && !ALLOWED_HOOK_INPUT_KEYS.includes(key)) {
      continue;
    }

    const value = parsed[key];

    // Deep copy nested objects (don't filter nested objects by allowed keys)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeObject(value, false) || {};
    } else if (Array.isArray(value)) {
      clean[key] = [...value];
    } else {
      clean[key] = value;
    }
  }

  return Object.assign({}, clean);
}

/**
 * Parse hook input synchronously from argv[2]
 *
 * @returns {Object|null} Parsed hook context or null if no input
 */
function parseHookInputSync() {
  if (!process.argv[2]) {
    return null;
  }

  try {
    const parsed = JSON.parse(process.argv[2]);
    return sanitizeObject(parsed);
  } catch (e) {
    return null;
  }
}

/**
 * Parse hook input asynchronously from stdin or argv[2]
 *
 * @param {Object} [options] - Parser options
 * @param {number} [options.timeout=100] - Timeout in ms to wait for stdin
 * @param {boolean} [options.allowEmpty=true] - Return null instead of throwing on empty input
 * @returns {Promise<Object|null>} Parsed hook context or null if no input
 */
async function parseHookInputAsync(options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, allowEmpty = true } = options;

  // Try command line argument first (older hook format, some hooks still use this)
  if (process.argv[2]) {
    try {
      const parsed = JSON.parse(process.argv[2]);
      return sanitizeObject(parsed);
    } catch (e) {
      // Not valid JSON, try stdin
    }
  }

  // Read from stdin (current hook format)
  return new Promise(resolve => {
    let input = '';
    let hasData = false;
    let resolved = false;

    // Helper to resolve only once
    const resolveOnce = value => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

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
        resolveOnce(allowEmpty ? null : undefined);
        return;
      }

      try {
        const parsed = JSON.parse(input);
        resolveOnce(sanitizeObject(parsed));
      } catch (e) {
        // Invalid JSON
        resolveOnce(allowEmpty ? null : undefined);
      }
    });

    // Handle errors
    process.stdin.on('error', () => {
      resolveOnce(allowEmpty ? null : undefined);
    });

    // Set a timeout in case stdin never ends
    setTimeout(() => {
      if (!hasData) {
        resolveOnce(allowEmpty ? null : undefined);
      }
    }, timeout);

    // Resume stdin if it was paused
    process.stdin.resume();
  });
}

/**
 * Alias for backwards compatibility
 */
const parseHookInput = parseHookInputAsync;

/**
 * Validate and sanitize hook input from a JSON string
 * Filters top-level keys by ALLOWED_HOOK_INPUT_KEYS for SEC-007 compliance
 *
 * @param {string} jsonString - JSON string to validate
 * @returns {Object|null} Sanitized hook input or null if invalid
 */
function validateHookInput(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  const trimmed = jsonString.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Arrays are not valid hook input
    if (Array.isArray(parsed)) {
      return null;
    }

    // Filter by allowed keys at top level for security
    return sanitizeObject(parsed, true);
  } catch (e) {
    return null;
  }
}

/**
 * Extract file path from tool input object
 *
 * @param {Object} toolInput - Tool input object
 * @returns {string|null} File path or null
 */
function extractFilePath(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') {
    return null;
  }

  // Priority order: file_path > filePath > path > notebook_path
  return (
    toolInput.file_path || toolInput.filePath || toolInput.path || toolInput.notebook_path || null
  );
}

/**
 * Check if a hook is enabled based on environment variable
 *
 * @param {string} envVar - Environment variable name
 * @param {string} [defaultMode='block'] - Default mode if env var not set
 * @returns {boolean} True if enabled (not 'off')
 */
function isEnabled(envVar, defaultMode = 'block') {
  const mode = process.env[envVar] || defaultMode;
  return mode !== 'off';
}

/**
 * Get enforcement mode from environment variable
 *
 * @param {string} envVar - Environment variable name
 * @param {string} [defaultMode='block'] - Default mode if env var not set
 * @returns {string} Enforcement mode ('block', 'warn', or 'off')
 */
function getEnforcementMode(envVar, defaultMode = 'block') {
  const mode = process.env[envVar] || defaultMode;
  return VALID_ENFORCEMENT_MODES.includes(mode) ? mode : defaultMode;
}

/**
 * Extract tool name from hook input (handles various input formats)
 *
 * @param {Object} input - Hook input object
 * @returns {string|null} Tool name or null
 */
function getToolName(input) {
  if (!input) return null;
  return input.tool_name || input.tool || null;
}

/**
 * Extract tool input/parameters from hook input
 *
 * @param {Object} input - Hook input object
 * @returns {Object} Tool input object (empty object if not found)
 */
function getToolInput(input) {
  if (!input) return {};
  return input.tool_input || input.input || input.parameters || {};
}

/**
 * Extract tool output/result from PostToolUse hook input
 *
 * @param {Object} input - Hook input object
 * @returns {string|Object|null} Tool output or null
 */
function getToolOutput(input) {
  if (!input) return null;
  return input.tool_output || input.output || input.result || null;
}

/**
 * Format a JSON result for hook output
 *
 * @param {'allow'|'block'|'warn'} result - Hook result
 * @param {string} [message] - Optional message
 * @returns {string} JSON string for output
 */
function formatResult(result, message = '') {
  return JSON.stringify({ result, message });
}

/**
 * Audit log helper for security hooks
 *
 * @param {string} hookName - Name of the hook
 * @param {string} event - Event type
 * @param {Object} [extra] - Additional fields to log
 */
function auditLog(hookName, event, extra = {}) {
  process.stderr.write(
    JSON.stringify({
      hook: hookName,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    }) + '\n'
  );
}

module.exports = {
  // Parsing functions
  parseHookInput,
  parseHookInputSync,
  parseHookInputAsync,
  validateHookInput,

  // Extraction functions
  extractFilePath,
  getToolName,
  getToolInput,
  getToolOutput,

  // Enforcement functions
  isEnabled,
  getEnforcementMode,

  // Output functions
  formatResult,
  auditLog,

  // Constants
  DEFAULT_TIMEOUT_MS,
  ALLOWED_HOOK_INPUT_KEYS,
  VALID_ENFORCEMENT_MODES,
};
