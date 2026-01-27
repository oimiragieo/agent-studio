#!/usr/bin/env node
/**
 * Hook: error-recovery-reflection.cjs
 * Trigger: PostToolUse after errors (Bash exit code != 0, tool errors)
 * Purpose: Queue reflection for error analysis and pattern extraction
 *
 * This hook monitors tool calls and queues errors for reflection,
 * enabling the Reflection Agent to learn from failures and suggest
 * preventive measures.
 *
 * ENFORCEMENT MODES:
 * - block (default): Queue reflection (no blocking behavior for post-hooks)
 * - warn: Queue reflection with warning message
 * - off: Disabled, no reflection queued
 *
 * Environment variables:
 *   REFLECTION_ENABLED=false - Disable all reflection
 *   REFLECTION_HOOK_MODE=off - Disable this hook
 *   REFLECTION_HOOK_MODE=warn - Enable with warnings
 */

'use strict';

const fs = require('fs');
const path = require('path');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');
const {
  parseHookInputAsync,
  getToolName,
  getToolInput,
  getToolOutput,
} = require('../../lib/utils/hook-input.cjs');

// PERF-006: Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

// Configuration
let QUEUE_FILE = path.join(PROJECT_ROOT, '.claude', 'context', 'reflection-queue.jsonl');

/**
 * Check if reflection is enabled
 * @returns {boolean} True if reflection should run
 */
function isEnabled() {
  // Check REFLECTION_ENABLED (default: true)
  if (process.env.REFLECTION_ENABLED === 'false') {
    return false;
  }

  // Check REFLECTION_HOOK_MODE (default: block, which means enabled)
  const mode = process.env.REFLECTION_HOOK_MODE || 'block';
  if (mode === 'off') {
    return false;
  }

  return true;
}

/**
 * Check if the hook input indicates an error that should trigger reflection
 * @param {object|null} input - The hook input from Claude Code
 * @returns {boolean} True if this should trigger reflection
 */
function shouldTriggerReflection(input) {
  if (!input) return false;

  // PERF-006: Use shared helper
  const toolResult = getToolOutput(input) || {};

  // Check for Bash with non-zero exit code
  if (typeof toolResult.exit_code === 'number' && toolResult.exit_code !== 0) {
    return true;
  }

  // Check for error field in tool result
  if (toolResult.error) {
    return true;
  }

  return false;
}

/**
 * Create a reflection queue entry from hook input for error
 * @param {object} input - The hook input
 * @returns {object} Reflection entry for the queue
 */
function createReflectionEntry(input) {
  // PERF-006: Use shared helpers
  const toolName = getToolName(input);
  const toolInput = getToolInput(input);
  const toolResult = getToolOutput(input) || {};

  const entry = {
    context: 'error_recovery',
    trigger: 'error',
    tool: toolName,
    timestamp: new Date().toISOString(),
    priority: 'medium',
  };

  // Add Bash-specific fields
  if (toolName === 'Bash') {
    entry.command = toolInput.command;
    if (toolResult.stderr) {
      entry.error = toolResult.stderr;
    }
    if (typeof toolResult.exit_code === 'number') {
      entry.exitCode = toolResult.exit_code;
    }
  }

  // Add error from tool result
  if (toolResult.error) {
    entry.error = toolResult.error;
  }

  // Include relevant tool input for context
  if (toolInput.file_path) {
    entry.filePath = toolInput.file_path;
  }

  return entry;
}

/**
 * Queue a reflection entry
 * @param {object} entry - The reflection entry to queue
 * @param {string} queueFile - Path to queue file (for testing)
 */
function queueReflection(entry, queueFile = QUEUE_FILE) {
  // Check if enabled
  if (!isEnabled()) {
    return;
  }

  try {
    // Ensure directory exists
    const queueDir = path.dirname(queueFile);
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    // Append entry as JSON line
    fs.appendFileSync(queueFile, JSON.stringify(entry) + '\n');

    // Log in warn mode
    const mode = process.env.REFLECTION_HOOK_MODE || 'block';
    if (mode === 'warn') {
      console.log(`[reflection] Queued error from ${entry.tool} for reflection`);
    }
  } catch (err) {
    // Log error but don't fail the hook
    if (process.env.DEBUG_HOOKS) {
      console.error('[reflection] Error queueing reflection:', err.message);
    }
  }
}

// PERF-006: parseHookInput is now imported from hook-input.cjs at the top of the file
// Removed 50-line duplicated function

/**
 * Main execution
 */
async function main() {
  try {
    // Check if enabled
    if (!isEnabled()) {
      process.exit(0);
    }

    // Parse input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0);
    }

    // Check if this should trigger reflection
    if (!shouldTriggerReflection(hookInput)) {
      process.exit(0);
    }

    // Create and queue the reflection entry
    const entry = createReflectionEntry(hookInput);
    queueReflection(entry);

    // PostToolUse hooks always exit 0 (don't block)
    process.exit(0);
  } catch (err) {
    // Fail open
    if (process.env.DEBUG_HOOKS) {
      console.error('[reflection] Error:', err.message);
    }
    process.exit(0);
  }
}

// Run if main module
if (require.main === module) {
  main();
}

// Exports for testing
module.exports = {
  isEnabled,
  shouldTriggerReflection,
  createReflectionEntry,
  queueReflection,
  main,
  get QUEUE_FILE() {
    return QUEUE_FILE;
  },
  set QUEUE_FILE(val) {
    QUEUE_FILE = val;
  },
};
