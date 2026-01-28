#!/usr/bin/env node
/**
 * Routing Guard - Unified Router Enforcement Hook
 * ================================================
 *
 * Consolidates 5 routing hooks into a single guard for 80% spawn reduction:
 *
 * | Original Hook              | Check                                    |
 * |----------------------------|------------------------------------------|
 * | router-self-check.cjs      | Blocks Router from blacklisted tools     |
 * | planner-first-guard.cjs    | Ensures PLANNER spawned for complex tasks|
 * | task-create-guard.cjs      | Blocks TaskCreate without PLANNER        |
 * | security-review-guard.cjs  | Requires security review for impl agents |
 * | router-write-guard.cjs     | Blocks direct writes without Task        |
 *
 * Trigger: PreToolUse (matches: Task|TaskCreate|Edit|Write|NotebookEdit|Glob|Grep|WebSearch)
 *
 * ENFORCEMENT MODES:
 * - ROUTER_SELF_CHECK=block|warn|off (default: block)
 * - PLANNER_FIRST_ENFORCEMENT=block|warn|off (default: block)
 * - SECURITY_REVIEW_ENFORCEMENT=block|warn|off (default: block)
 * - ROUTER_WRITE_GUARD=block|warn|off (default: block)
 *
 * Exit codes:
 * - 0: Allow operation
 * - 2: Block operation (SEC-008: fail-closed on error)
 *
 * Override: Set HOOK_FAIL_OPEN=true for debugging only.
 *
 * @module routing-guard
 */

'use strict';

const path = require('path');
const {
  parseHookInputAsync,
  getToolName,
  getToolInput,
  extractFilePath,
  getEnforcementMode,
  formatResult,
  auditLog,
} = require('../../lib/utils/hook-input.cjs');
const routerState = require('./router-state.cjs');

// =============================================================================
// INTRA-HOOK STATE CACHING (PERF-001)
// =============================================================================

/**
 * Cached router state for single hook invocation.
 * Prevents multiple getState() calls within runAllChecks().
 */
let _cachedRouterState = null;

/**
 * Get cached router state (single read per invocation)
 * PERF-001: Reduces 4 file reads to 1 per routing-guard invocation.
 */
function getCachedRouterState() {
  if (_cachedRouterState === null) {
    _cachedRouterState = routerState.getState();
  }
  return _cachedRouterState;
}

/**
 * Invalidate cached state (call at start of each invocation and for testing)
 */
function invalidateCachedState() {
  _cachedRouterState = null;
  routerState.invalidateStateCache();
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Tools watched by this unified guard
 */
const ALL_WATCHED_TOOLS = [
  // Self-check blacklist (Router shouldn't use these directly)
  'Glob',
  'Grep',
  'WebSearch',
  'Bash', // Added: Router can only use whitelisted git commands
  // Write tools (require agent context)
  'Edit',
  'Write',
  'NotebookEdit',
  // Agent spawning tools (require planning/security checks)
  'Task',
  'TaskCreate',
];

/**
 * Tools that Router should NEVER use directly (must spawn agent)
 * From router-self-check.cjs
 * Note: Bash is CONDITIONALLY blacklisted - only whitelisted git commands are allowed
 */
const BLACKLISTED_TOOLS = ['Glob', 'Grep', 'Edit', 'Write', 'NotebookEdit', 'WebSearch'];

/**
 * Router Bash Whitelist (ADR-030)
 * Router may ONLY use these exact Bash commands. ALL other Bash commands require spawning an agent.
 * Exhaustive list - if it's not here, Router cannot use it.
 */
const ROUTER_BASH_WHITELIST = [
  // Git status commands
  /^git\s+status(\s+-s|\s+--short)?$/,
  // Git log commands (limited output)
  /^git\s+log\s+--oneline\s+-\d{1,2}$/,
  // Git diff name-only
  /^git\s+diff\s+--name-only$/,
  // Git branch listing
  /^git\s+branch$/,
];

/**
 * Tools that are always allowed for Router
 * From router-self-check.cjs
 */
const WHITELISTED_TOOLS = ['TaskUpdate', 'TaskList', 'TaskGet', 'Read', 'AskUserQuestion'];

/**
 * Write tools that require agent context
 * From router-write-guard.cjs
 */
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit'];

/**
 * Agents that need security review before spawning
 * From security-review-guard.cjs
 */
const IMPLEMENTATION_AGENTS = ['developer', 'qa', 'devops'];

/**
 * Patterns to detect PLANNER agent spawns
 * From planner-first-guard.cjs
 */
const PLANNER_PATTERNS = {
  prompt: ['you are planner', 'you are the planner', 'as planner'],
  description: ['planner'],
};

/**
 * Patterns to detect SECURITY-ARCHITECT agent spawns
 */
const SECURITY_PATTERNS = {
  prompt: ['you are security', 'you are the security', 'security-architect', 'security architect'],
  description: ['security'],
};

/**
 * Files that are always allowed for writes (framework internal operations)
 * From router-write-guard.cjs
 */
const ALWAYS_ALLOWED_WRITE_PATTERNS = [
  /\.claude[\/\\]context[\/\\]runtime[\/\\]/,
  /\.claude[\/\\]context[\/\\]memory[\/\\]/,
  /\.gitkeep$/,
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
 * Check if the Task being spawned is a PLANNER agent
 * @param {Object} toolInput - The Task tool input
 * @returns {boolean}
 */
function isPlannerSpawn(toolInput) {
  const prompt = (toolInput.prompt || '').toLowerCase();
  const description = (toolInput.description || '').toLowerCase();

  for (const pattern of PLANNER_PATTERNS.prompt) {
    if (prompt.includes(pattern)) return true;
  }
  for (const pattern of PLANNER_PATTERNS.description) {
    if (description.includes(pattern)) return true;
  }
  return false;
}

/**
 * Check if the Task being spawned is a SECURITY-ARCHITECT agent
 * @param {Object} toolInput - The Task tool input
 * @returns {boolean}
 */
function isSecuritySpawn(toolInput) {
  const prompt = (toolInput.prompt || '').toLowerCase();
  const description = (toolInput.description || '').toLowerCase();

  for (const pattern of SECURITY_PATTERNS.prompt) {
    if (prompt.includes(pattern)) return true;
  }
  for (const pattern of SECURITY_PATTERNS.description) {
    if (description.includes(pattern)) return true;
  }
  return false;
}

/**
 * Check if the Task being spawned is an implementation agent
 * @param {Object} toolInput - The Task tool input
 * @returns {boolean}
 */
function isImplementationAgentSpawn(toolInput) {
  const prompt = (toolInput.prompt || '').toLowerCase();
  return IMPLEMENTATION_AGENTS.some(
    agent => prompt.includes(`you are ${agent}`) || prompt.includes(`you are the ${agent}`)
  );
}

// =============================================================================
// HELPER FUNCTIONS FOR BASH VALIDATION
// =============================================================================

/**
 * Check if a Bash command is in the Router whitelist (ADR-030)
 * @param {string} command - The bash command to check
 * @returns {boolean} True if command is whitelisted for Router
 */
function isWhitelistedBashCommand(command) {
  if (!command || typeof command !== 'string') {
    return false;
  }
  const trimmed = command.trim();
  return ROUTER_BASH_WHITELIST.some(pattern => pattern.test(trimmed));
}

// =============================================================================
// CHECK FUNCTIONS (one per original hook)
// =============================================================================

/**
 * Check 0: Router Bash Check (blocks non-whitelisted Bash commands in router context)
 * ADR-030: Router may ONLY use whitelisted git commands via Bash
 *
 * @param {string} toolName - Tool being used
 * @param {Object} toolInput - Tool input containing command
 * @returns {{ pass: boolean, result?: string, message?: string }}
 */
function checkRouterBash(toolName, toolInput = {}) {
  // Only applies to Bash tool
  if (toolName !== 'Bash') {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('ROUTER_BASH_GUARD', 'block');
  if (enforcement === 'off') {
    auditLog('routing-guard', 'security_override_used', {
      check: 'router-bash',
      override: 'ROUTER_BASH_GUARD=off',
    });
    return { pass: true };
  }

  // PERF-001: Use cached state instead of fresh read
  const state = getCachedRouterState();
  if (state.mode === 'agent' || state.taskSpawned) {
    // Agents can use any Bash commands (they have full tools)
    return { pass: true };
  }

  // In Router context - check if command is whitelisted
  const command = toolInput.command || '';
  if (isWhitelistedBashCommand(command)) {
    return { pass: true };
  }

  // Router is using non-whitelisted Bash command - VIOLATION
  const truncatedCmd = command.length > 50 ? command.slice(0, 47) + '...' : command;
  const message = `
+======================================================================+
|  ROUTER BASH VIOLATION BLOCKED (ADR-030)                             |
+======================================================================+
|  Command: ${truncatedCmd.padEnd(56)}|
|                                                                      |
|  Router can ONLY use these Bash commands:                            |
|    - git status [-s|--short]                                         |
|    - git log --oneline -N (where N is 1-99)                          |
|    - git diff --name-only                                            |
|    - git branch                                                      |
|                                                                      |
|  ALL other Bash commands require spawning an agent:                  |
|    - Test execution (pnpm test, npm test) --> Spawn QA               |
|    - Build commands --> Spawn DEVELOPER                              |
|    - File operations --> Spawn DEVELOPER                             |
|                                                                      |
|  Example:                                                            |
|    Task({                                                            |
|      subagent_type: 'general-purpose',                               |
|      description: 'QA running tests',                                |
|      prompt: 'You are QA. Run tests and analyze results...'          |
|    })                                                                |
|                                                                      |
|  Override: ROUTER_BASH_GUARD=warn or ROUTER_BASH_GUARD=off           |
+======================================================================+
`;

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

/**
 * Check 1: Router Self-Check (blocks blacklisted tools in router context)
 * Original: router-self-check.cjs
 *
 * FIX: For write tools (Edit, Write, NotebookEdit), check if the target file
 * is in the always-allowed list (memory files, runtime files) before blocking.
 * This allows spawned agents to write to memory even if state shows router mode.
 *
 * DEBUG: Set ROUTER_DEBUG=true to enable verbose logging for troubleshooting.
 *
 * @param {string} toolName - Tool being used
 * @param {Object} [toolInput] - Tool input (required for write tools to check file path)
 * @returns {{ pass: boolean, result?: string, message?: string }}
 */
function checkRouterSelfCheck(toolName, toolInput = {}) {
  const DEBUG = process.env.ROUTER_DEBUG === 'true';
  if (DEBUG) console.error(`[DEBUG] checkRouterSelfCheck called: tool=${toolName}`);

  const enforcement = getEnforcementMode('ROUTER_SELF_CHECK', 'block');
  if (DEBUG) console.error(`[DEBUG] enforcement mode: ${enforcement}`);

  if (enforcement === 'off') {
    if (DEBUG) console.error('[DEBUG] EARLY EXIT: enforcement=off');
    return { pass: true };
  }

  // Always allow whitelisted tools
  if (WHITELISTED_TOOLS.includes(toolName)) {
    if (DEBUG) console.error(`[DEBUG] EARLY EXIT: ${toolName} is whitelisted`);
    return { pass: true };
  }

  // If not a blacklisted tool, allow
  if (!BLACKLISTED_TOOLS.includes(toolName)) {
    if (DEBUG) console.error(`[DEBUG] EARLY EXIT: ${toolName} not in blacklist`);
    return { pass: true };
  }

  if (DEBUG) console.error(`[DEBUG] ${toolName} IS in blacklist, checking further...`);

  // FIX: For write tools, check if file is always-allowed (memory, runtime)
  // This allows spawned agents to write to memory files even if state
  // incorrectly shows router mode (race condition / state sync issue)
  if (WRITE_TOOLS.includes(toolName)) {
    const filePath = extractFilePath(toolInput);
    if (isAlwaysAllowedWrite(filePath)) {
      if (DEBUG)
        console.error(`[DEBUG] EARLY EXIT: ${toolName} targeting always-allowed file: ${filePath}`);
      return { pass: true };
    }
  }

  // PERF-001: Use cached state instead of fresh read
  const state = getCachedRouterState();
  if (DEBUG) console.error(`[DEBUG] State: mode=${state.mode}, taskSpawned=${state.taskSpawned}`);

  if (state.mode === 'agent' || state.taskSpawned) {
    if (DEBUG) console.error('[DEBUG] EARLY EXIT: in agent mode or task spawned');
    return { pass: true };
  }

  // Router is using blacklisted tool directly - violation
  if (DEBUG) console.error('[DEBUG] BLOCKING - all checks passed, should block now');
  const message = `[ROUTER SELF-CHECK VIOLATION] Router attempted to use blacklisted tool: ${toolName}
Spawn an agent via Task() tool to perform this operation.
Override: ROUTER_SELF_CHECK=warn or ROUTER_SELF_CHECK=off`;

  if (enforcement === 'block') {
    if (DEBUG) console.error('[DEBUG] Returning BLOCK');
    return { pass: false, result: 'block', message };
  } else {
    if (DEBUG) console.error('[DEBUG] Returning WARN');
    return { pass: true, result: 'warn', message };
  }
}

/**
 * Check 2: Planner-First Guard (requires PLANNER for complex tasks)
 * Original: planner-first-guard.cjs
 *
 * @param {string} toolName - Tool being used
 * @param {Object} toolInput - Tool input
 * @returns {{ pass: boolean, result?: string, message?: string, markPlanner?: boolean }}
 */
function checkPlannerFirst(toolName, toolInput) {
  // Only applies to Task tool
  if (toolName !== 'Task') {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('PLANNER_FIRST_ENFORCEMENT', 'block');
  if (enforcement === 'off') {
    auditLog('routing-guard', 'security_override_used', {
      check: 'planner-first',
      override: 'PLANNER_FIRST_ENFORCEMENT=off',
    });
    return { pass: true };
  }

  // PERF-001: Use cached state for planner checks
  const state = getCachedRouterState();
  const isPlannerRequired = state.requiresPlannerFirst;
  const plannerAlreadySpawned = state.plannerSpawned;

  // If planner not required or already spawned, allow
  if (!isPlannerRequired || plannerAlreadySpawned) {
    return { pass: true };
  }

  // Check if THIS spawn is a PLANNER spawn (breaks the cycle)
  if (isPlannerSpawn(toolInput)) {
    return { pass: true, markPlanner: true };
  }

  // Not a PLANNER spawn, but PLANNER is required - violation
  const complexity = state.complexity || 'unknown';
  const message = `[PLANNER-FIRST VIOLATION] High/Epic complexity (${complexity}) requires PLANNER agent first.
Spawn PLANNER first: Task({ description: 'Planner designing...', prompt: 'You are PLANNER...' })
Override: PLANNER_FIRST_ENFORCEMENT=off`;

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

/**
 * Check 3: TaskCreate Guard (requires PLANNER before creating complex tasks)
 * Original: task-create-guard.cjs
 *
 * @param {string} toolName - Tool being used
 * @returns {{ pass: boolean, result?: string, message?: string }}
 */
function checkTaskCreate(toolName) {
  // Only applies to TaskCreate tool
  if (toolName !== 'TaskCreate') {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('PLANNER_FIRST_ENFORCEMENT', 'block');
  if (enforcement === 'off') {
    auditLog('routing-guard', 'security_override_used', {
      check: 'task-create',
      override: 'PLANNER_FIRST_ENFORCEMENT=off',
    });
    return { pass: true };
  }

  // PERF-001: Use cached state for task-create checks
  const state = getCachedRouterState();
  const isPlannerRequired = state.requiresPlannerFirst;
  const isPlannerSpawned = state.plannerSpawned;

  // If planner not required or already spawned, allow
  if (!isPlannerRequired || isPlannerSpawned) {
    return { pass: true };
  }

  // Violation: trying to create tasks without planner
  const complexity = state.complexity || 'unknown';
  const message = `[TASK-CREATE VIOLATION] Complex task (${complexity}) requires PLANNER agent.
Spawn PLANNER first, then PLANNER will create the tasks.
Override: PLANNER_FIRST_ENFORCEMENT=off`;

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

/**
 * Check 4: Security Review Guard (requires security review for impl agents)
 * Original: security-review-guard.cjs
 *
 * @param {string} toolName - Tool being used
 * @param {Object} toolInput - Tool input
 * @returns {{ pass: boolean, result?: string, message?: string, markSecurity?: boolean }}
 */
function checkSecurityReview(toolName, toolInput) {
  // Only applies to Task tool
  if (toolName !== 'Task') {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('SECURITY_REVIEW_ENFORCEMENT', 'block');
  if (enforcement === 'off') {
    return { pass: true };
  }

  // PERF-001: Use cached state for security review checks
  // Note: getCachedRouterState() handles errors internally via state-cache.cjs
  const state = getCachedRouterState();

  // Check if security review required but not done
  if (!state.requiresSecurityReview || state.securitySpawned) {
    return { pass: true };
  }

  // Check if this is a SECURITY-ARCHITECT spawn (breaks the cycle)
  if (isSecuritySpawn(toolInput)) {
    return { pass: true, markSecurity: true };
  }

  // Check if spawning an implementation agent
  if (!isImplementationAgentSpawn(toolInput)) {
    return { pass: true };
  }

  // Violation: implementation agent without security review
  const message = `[SEC-004] Security review required before implementation.
Spawn SECURITY-ARCHITECT first to review security implications.
Override: SECURITY_REVIEW_ENFORCEMENT=off`;

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

/**
 * Check 5: Router Write Guard (requires agent context for writes)
 * Original: router-write-guard.cjs
 *
 * @param {string} toolName - Tool being used
 * @param {Object} toolInput - Tool input
 * @returns {{ pass: boolean, result?: string, message?: string }}
 */
function checkRouterWrite(toolName, toolInput) {
  // Only applies to write tools
  if (!WRITE_TOOLS.includes(toolName)) {
    return { pass: true };
  }

  const enforcement = getEnforcementMode('ROUTER_WRITE_GUARD', 'block');
  if (enforcement === 'off') {
    auditLog('routing-guard', 'security_override_used', {
      check: 'router-write',
      override: 'ROUTER_WRITE_GUARD=off',
    });
    return { pass: true };
  }

  // Get file path
  const filePath = extractFilePath(toolInput);

  // Check if file is always allowed (framework internal)
  if (isAlwaysAllowedWrite(filePath)) {
    return { pass: true };
  }

  // Check if write is allowed (agent context)
  const { allowed, reason } = routerState.checkWriteAllowed();
  if (allowed) {
    return { pass: true };
  }

  // Violation: write without agent context
  const fileName = filePath ? path.basename(filePath) : 'unknown';
  const message = `[ROUTER WRITE BLOCKED] Tool: ${toolName}, File: ${fileName}
The Router cannot directly edit files. Spawn an agent using the Task tool.
Override: ROUTER_WRITE_GUARD=warn or ROUTER_WRITE_GUARD=off`;

  if (enforcement === 'block') {
    return { pass: false, result: 'block', message };
  } else {
    return { pass: true, result: 'warn', message };
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

/**
 * Run all routing checks
 * @param {string} toolName - Tool being used
 * @param {Object} toolInput - Tool input
 * @returns {{ pass: boolean, result: string, message: string }}
 */
function runAllChecks(toolName, toolInput) {
  // Check 0: Router Bash Check (ADR-030 - must come first for Bash commands)
  const bashCheck = checkRouterBash(toolName, toolInput);
  if (!bashCheck.pass) {
    return { pass: false, result: bashCheck.result, message: bashCheck.message };
  }
  if (bashCheck.result === 'warn') {
    console.warn(bashCheck.message);
  }

  // Check 1: Router Self-Check (now receives toolInput for file path checking)
  const selfCheck = checkRouterSelfCheck(toolName, toolInput);
  if (!selfCheck.pass) {
    return { pass: false, result: selfCheck.result, message: selfCheck.message };
  }
  if (selfCheck.result === 'warn') {
    // Log warning but continue checks
    console.warn(selfCheck.message);
  }

  // Check 2: Planner-First Guard
  const plannerCheck = checkPlannerFirst(toolName, toolInput);
  if (!plannerCheck.pass) {
    return { pass: false, result: plannerCheck.result, message: plannerCheck.message };
  }
  if (plannerCheck.markPlanner) {
    // Mark planner as spawned in state
    routerState.markPlannerSpawned();
  }
  if (plannerCheck.result === 'warn') {
    console.warn(plannerCheck.message);
  }

  // Check 3: TaskCreate Guard
  const taskCreateCheck = checkTaskCreate(toolName);
  if (!taskCreateCheck.pass) {
    return { pass: false, result: taskCreateCheck.result, message: taskCreateCheck.message };
  }
  if (taskCreateCheck.result === 'warn') {
    console.warn(taskCreateCheck.message);
  }

  // Check 4: Security Review Guard
  const securityCheck = checkSecurityReview(toolName, toolInput);
  if (!securityCheck.pass) {
    return { pass: false, result: securityCheck.result, message: securityCheck.message };
  }
  if (securityCheck.markSecurity) {
    // Mark security as spawned in state
    routerState.markSecuritySpawned();
  }
  if (securityCheck.result === 'warn') {
    console.warn(securityCheck.message);
  }

  // Check 5: Router Write Guard
  const writeCheck = checkRouterWrite(toolName, toolInput);
  if (!writeCheck.pass) {
    return { pass: false, result: writeCheck.result, message: writeCheck.message };
  }
  if (writeCheck.result === 'warn') {
    console.warn(writeCheck.message);
  }

  // All checks passed
  return { pass: true, result: 'allow', message: '' };
}

/**
 * Main execution function
 */
async function main() {
  try {
    // PERF-001: Invalidate cache at start of each invocation
    invalidateCachedState();

    // Parse the hook input
    const hookInput = await parseHookInputAsync();

    if (!hookInput) {
      // No input - allow (fail open for missing input)
      process.exit(0);
    }

    // Get tool name and input
    const toolName = getToolName(hookInput);
    const toolInput = getToolInput(hookInput);

    // Skip if not a watched tool
    if (!toolName || !ALL_WATCHED_TOOLS.includes(toolName)) {
      process.exit(0);
    }

    // Run all checks
    const result = runAllChecks(toolName, toolInput);

    if (!result.pass) {
      // HOOK-009: Security audit log for blocked/warned actions
      auditLog('routing-guard', `security_${result.result}`, {
        tool: toolName,
        reason: result.message,
        mode: routerState.getState().mode,
      });

      // Output block/warn result
      console.log(formatResult(result.result, result.message));
      process.exit(result.result === 'block' ? 2 : 0);
    }

    // All checks passed
    process.exit(0);
  } catch (err) {
    // SEC-008: Allow debug override for troubleshooting
    if (process.env.HOOK_FAIL_OPEN === 'true') {
      auditLog('routing-guard', 'fail_open_override', { error: err.message });
      process.exit(0);
    }

    // Audit log the error
    auditLog('routing-guard', 'error_fail_closed', { error: err.message });

    // SEC-008: Fail closed - deny when security state unknown
    process.exit(2);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  main,
  runAllChecks,
  checkRouterBash,
  checkRouterSelfCheck,
  checkPlannerFirst,
  checkTaskCreate,
  checkSecurityReview,
  checkRouterWrite,
  isPlannerSpawn,
  isSecuritySpawn,
  isImplementationAgentSpawn,
  isAlwaysAllowedWrite,
  isWhitelistedBashCommand,
  // PERF-001: Cache management
  getCachedRouterState,
  invalidateCachedState,
  // Constants
  ALL_WATCHED_TOOLS,
  BLACKLISTED_TOOLS,
  WHITELISTED_TOOLS,
  WRITE_TOOLS,
  IMPLEMENTATION_AGENTS,
  ROUTER_BASH_WHITELIST,
};
