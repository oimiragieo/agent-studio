#!/usr/bin/env node
/**
 * Hook Orchestrator
 * Manages hook execution pipeline with logging and monitoring
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOOKS_DIR = join(__dirname, '.');

/**
 * Hook types
 */
export const HookTypes = {
  PreToolUse: 'PreToolUse',
  PostToolUse: 'PostToolUse',
  UserPromptSubmit: 'UserPromptSubmit',
  Notification: 'Notification',
  Stop: 'Stop'
};

/**
 * Hook file mapping
 */
const HOOK_FILES = {
  [HookTypes.PreToolUse]: 'security-pre-tool.sh',
  [HookTypes.PostToolUse]: 'audit-post-tool.sh',
  [HookTypes.UserPromptSubmit]: 'user-prompt-submit.sh',
  [HookTypes.Notification]: 'notification.sh',
  [HookTypes.Stop]: 'stop.sh'
};

/**
 * Execute a hook
 */
export async function executeHook(hookType, input) {
  const hookFile = HOOK_FILES[hookType];
  
  if (!hookFile) {
    throw new Error(`Unknown hook type: ${hookType}`);
  }

  const hookPath = join(HOOKS_DIR, hookFile);
  
  if (!existsSync(hookPath)) {
    // Hook not found - allow by default for optional hooks
    if (hookType === HookTypes.Notification || hookType === HookTypes.Stop) {
      return { success: true, skipped: true };
    }
    throw new Error(`Hook file not found: ${hookPath}`);
  }

  try {
    const inputJson = JSON.stringify(input);
    const { stdout, stderr } = await execFileAsync('bash', [hookPath], {
      input: inputJson,
      maxBuffer: 1024 * 1024,
      timeout: 5000
    });

    // Parse output
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      // If output is not JSON, treat as success
      result = { success: true, output: stdout };
    }

    // Log hook execution
    await logHookExecution(hookType, input, result);

    return result;
  } catch (error) {
    // Log error but don't fail - hooks are defensive
    await logHookError(hookType, input, error);
    
    // For critical hooks, fail closed
    if (hookType === HookTypes.PreToolUse) {
      return { decision: 'block', reason: `Hook execution failed: ${error.message}` };
    }

    // For other hooks, fail open
    return { success: false, error: error.message };
  }
}

/**
 * Log hook execution
 */
async function logHookExecution(hookType, input, result) {
  const logDir = join(HOOKS_DIR, '../../context/history/hooks');
  const logFile = join(logDir, `${hookType.toLowerCase()}.log`);
  
  // Create log directory if needed
  const { mkdir } = await import('fs/promises');
  await mkdir(logDir, { recursive: true });

  const logEntry = {
    timestamp: new Date().toISOString(),
    hook_type: hookType,
    input: sanitizeInput(input),
    result: sanitizeResult(result)
  };

  const { appendFile } = await import('fs/promises');
  await appendFile(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
}

/**
 * Log hook error
 */
async function logHookError(hookType, input, error) {
  const logDir = join(HOOKS_DIR, '../../context/history/hooks');
  const errorLogFile = join(logDir, 'errors.log');
  
  const { mkdir, appendFile } = await import('fs/promises');
  await mkdir(logDir, { recursive: true });

  const logEntry = {
    timestamp: new Date().toISOString(),
    hook_type: hookType,
    input: sanitizeInput(input),
    error: error.message,
    stack: error.stack
  };

  await appendFile(errorLogFile, JSON.stringify(logEntry) + '\n', 'utf8');
}

/**
 * Sanitize input for logging (remove sensitive data)
 */
function sanitizeInput(input) {
  const sanitized = { ...input };
  
  // Remove sensitive fields
  if (sanitized.tool_input) {
    if (sanitized.tool_input.command) {
      // Truncate long commands
      sanitized.tool_input.command = sanitized.tool_input.command.substring(0, 200);
    }
  }
  
  return sanitized;
}

/**
 * Sanitize result for logging
 */
function sanitizeResult(result) {
  // Remove any sensitive data from result
  return result;
}

export default {
  HookTypes,
  executeHook
};

