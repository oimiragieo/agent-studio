#!/usr/bin/env node
/**
 * Hook: task-completion-reflection.cjs
 * Trigger: PostToolUse(TaskUpdate) when status=completed
 * Purpose: Queue reflection for completed tasks
 *
 * This hook monitors TaskUpdate calls and queues completed tasks
 * for reflection by the Reflection Agent.
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

// Find project root
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();

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
 * Check if the hook input should trigger reflection
 * @param {object|null} input - The hook input from Claude Code
 * @returns {boolean} True if this should trigger reflection
 */
function shouldTriggerReflection(input) {
  if (!input) return false;

  // Support both input formats
  const toolName = input.tool_name || input.tool;
  const toolInput = input.tool_input || input.input || {};

  // Only trigger on TaskUpdate with status=completed
  if (toolName !== 'TaskUpdate') return false;
  if (toolInput.status !== 'completed') return false;

  return true;
}

/**
 * Create a reflection queue entry from hook input
 * @param {object} input - The hook input
 * @returns {object} Reflection entry for the queue
 */
function createReflectionEntry(input) {
  const toolInput = input.tool_input || input.input || {};

  const entry = {
    taskId: toolInput.taskId,
    trigger: 'task_completion',
    timestamp: new Date().toISOString(),
    priority: 'high',
  };

  // Extract summary from metadata if present
  if (toolInput.metadata && toolInput.metadata.summary) {
    entry.summary = toolInput.metadata.summary;
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
      console.log(`[reflection] Queued task ${entry.taskId} for reflection`);
    }
  } catch (err) {
    // Log error but don't fail the hook
    if (process.env.DEBUG_HOOKS) {
      console.error('[reflection] Error queueing reflection:', err.message);
    }
  }
}

/**
 * Parse hook input from Claude Code
 * Input comes via stdin as JSON
 * @returns {Promise<object|null>} Parsed input or null
 */
async function parseHookInput() {
  // Try command line argument first (older format)
  if (process.argv[2]) {
    try {
      return JSON.parse(process.argv[2]);
    } catch (e) {
      // Not valid JSON, try stdin
    }
  }

  // Read from stdin
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

    // Timeout in case stdin never ends
    setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, 100);

    process.stdin.resume();
  });
}

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
  parseHookInput,
  main,
  get QUEUE_FILE() {
    return QUEUE_FILE;
  },
  set QUEUE_FILE(val) {
    QUEUE_FILE = val;
  },
};
