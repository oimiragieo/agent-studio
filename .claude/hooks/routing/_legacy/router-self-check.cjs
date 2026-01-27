'use strict';

/**
 * router-self-check.cjs
 *
 * Proactive enforcement of Router self-check protocol.
 * Prevents Router from using exploration/modification tools directly.
 *
 * FIX: Writes to memory/runtime files (.claude/context/memory/*, .claude/context/runtime/*)
 * are always allowed even when not in agent context. This allows spawned agents to write
 * to memory files without being blocked by state sync issues.
 *
 * ENFORCEMENT MODES (via ROUTER_SELF_CHECK env var):
 * - block (default): Prevents the action and returns error
 * - warn: Allows action but prints warning
 * - off: Disables enforcement
 */

const path = require('path');
const routerState = require('../router-state.cjs');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const {
  parseHookInputAsync,
  getToolName: sharedGetToolName,
  extractFilePath,
  getToolInput,
} = require('../../../lib/utils/hook-input.cjs');

// Tools that Router should NEVER use directly (must spawn agent)
const BLACKLISTED_TOOLS = ['Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'WebSearch'];

// Write tools that need file path checking
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit'];

// Tools that are always allowed for Router
const WHITELISTED_TOOLS = [
  'Task',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'Read',
  'AskUserQuestion',
];

/**
 * Files that are always allowed for writes (framework internal operations)
 * These should be writable by any agent regardless of router state
 */
const ALWAYS_ALLOWED_WRITE_PATTERNS = [
  /\.claude[\/\\]context[\/\\]runtime[\/\\]/, // Runtime state files
  /\.claude[\/\\]context[\/\\]memory[\/\\]/, // Memory files (learnings, decisions, issues)
  /\.gitkeep$/, // Git keep files
];

/**
 * Check if a file path is always allowed for writes
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function isAlwaysAllowedWrite(filePath) {
  if (!filePath) return false;
  const normalizedPath = path.normalize(filePath);
  return ALWAYS_ALLOWED_WRITE_PATTERNS.some(pattern => pattern.test(normalizedPath));
}

/**
 * Get enforcement mode from environment
 * @returns {'block' | 'warn' | 'off'}
 */
function getEnforcementMode() {
  const mode = process.env.ROUTER_SELF_CHECK || 'block';
  return ['block', 'warn', 'off'].includes(mode) ? mode : 'block';
}

/**
 * Format block message
 * @param {string} toolName - The tool that was blocked
 * @returns {string} Formatted message
 */
function formatBlockMessage(toolName) {
  return `
========================================================================
  ROUTER SELF-CHECK VIOLATION
========================================================================
  Router attempted to use blacklisted tool: ${toolName}

  REQUIRED ACTION:
  Spawn an agent via Task() tool to perform this operation.

  Example:
  Task({
    subagent_type: 'general-purpose',
    description: 'Search codebase',
    prompt: '...'
  });

  Override: ROUTER_SELF_CHECK=warn or ROUTER_SELF_CHECK=off
========================================================================
`;
}

/**
 * Format warning message
 * @param {string} toolName - The tool that triggered warning
 * @returns {string} Formatted message
 */
function formatWarnMessage(toolName) {
  return `
WARNING: ROUTER SELF-CHECK
Tool: ${toolName}
Router should spawn an agent for exploration/modification tasks.
Override: ROUTER_SELF_CHECK=off to disable this warning.
`;
}

/**
 * Validate whether a tool should be allowed in current context
 * @param {string} toolName - Name of the tool being used
 * @param {Object} [toolInput] - Tool input (for checking file paths on write tools)
 * @returns {{ allowed: boolean, message: string }}
 */
function validate(toolName, toolInput = {}) {
  const enforcement = getEnforcementMode();

  // If enforcement is off, always allow
  if (enforcement === 'off') {
    return { allowed: true, message: '' };
  }

  // Handle null/undefined/empty tool names gracefully
  if (!toolName) {
    return { allowed: true, message: '' };
  }

  // Always allow whitelisted tools
  if (WHITELISTED_TOOLS.includes(toolName)) {
    return { allowed: true, message: '' };
  }

  // If not a blacklisted tool, allow it
  if (!BLACKLISTED_TOOLS.includes(toolName)) {
    return { allowed: true, message: '' };
  }

  // FIX: For write tools, check if file is always-allowed (memory, runtime)
  // This allows spawned agents to write to memory files even if state
  // incorrectly shows router mode (race condition / state sync issue)
  if (WRITE_TOOLS.includes(toolName)) {
    const filePath = extractFilePath(toolInput);
    if (isAlwaysAllowedWrite(filePath)) {
      return { allowed: true, message: '' };
    }
  }

  // Check if we're in agent context (Task has been spawned)
  const state = routerState.getState();
  if (state.mode === 'agent' || state.taskSpawned) {
    return { allowed: true, message: '' };
  }

  // Router is using blacklisted tool directly - violation!
  if (enforcement === 'block') {
    return {
      allowed: false,
      message: formatBlockMessage(toolName),
    };
  } else {
    // warn mode
    return {
      allowed: true,
      message: formatWarnMessage(toolName),
    };
  }
}

// PERF-006: parseHookInput is now imported from hook-input.cjs
// Alias for backward compatibility with exports
const parseHookInput = parseHookInputAsync;

/**
 * Main execution for hook
 */
async function main() {
  const enforcement = getEnforcementMode();

  // Early exit if enforcement is off
  if (enforcement === 'off') {
    process.exit(0);
    return;
  }

  const input = await parseHookInput();
  if (!input || !input.tool_name) {
    process.exit(0);
    return;
  }

  const toolName = input.tool_name;
  const toolInput = getToolInput(input) || {};
  const result = validate(toolName, toolInput);

  if (!result.allowed) {
    console.error(result.message);
    process.exit(2); // Block
  } else if (result.message) {
    // Has warning message
    console.error(result.message);
    process.exit(0); // Allow with warning
  } else {
    process.exit(0); // Allow silently
  }
}

// Run as hook if called directly
if (require.main === module) {
  main().catch(err => {
    if (process.env.DEBUG_HOOKS) {
      console.error('Router self-check error:', err.message);
    }
    process.exit(0); // Fail open
  });
}

module.exports = {
  main,
  validate,
  isAlwaysAllowedWrite,
  BLACKLISTED_TOOLS,
  WHITELISTED_TOOLS,
  WRITE_TOOLS,
  ALWAYS_ALLOWED_WRITE_PATTERNS,
};
