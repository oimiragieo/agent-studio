#!/usr/bin/env node

/**
 * Hook Runner - Subprocess Execution
 *
 * Executes hooks in isolated subprocess matching production environment.
 * Handles stdin/stdout communication and timeout enforcement.
 *
 * Features:
 * - Subprocess isolation
 * - stdin/stdout communication
 * - Timeout enforcement
 * - Error handling
 */

import { spawn } from 'child_process';

/**
 * Run a hook in subprocess isolation
 *
 * @param {string} hookPath - Absolute path to hook script
 * @param {object} hookInput - Input data for hook
 * @param {object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @param {boolean} options.verbose - Enable verbose logging
 * @returns {Promise<object>} Hook execution result
 */
export async function runHook(hookPath, hookInput, options = {}) {
  const timeout = options.timeout || 5000;
  const verbose = options.verbose || false;

  return new Promise((resolve, reject) => {
    if (verbose) {
      console.log(`[HookRunner] Executing: ${hookPath}`);
      console.log(`[HookRunner] Input: ${JSON.stringify(hookInput, null, 2)}`);
    }

    // Spawn subprocess
    const child = spawn('node', [hookPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        HOOK_TEST_MODE: 'true',
      },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Setup timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);

    // Capture stdout
    child.stdout.on('data', data => {
      stdout += data.toString();
      if (verbose) {
        console.log(`[HookRunner] stdout: ${data.toString()}`);
      }
    });

    // Capture stderr
    child.stderr.on('data', data => {
      stderr += data.toString();
      if (verbose) {
        console.log(`[HookRunner] stderr: ${data.toString()}`);
      }
    });

    // Handle process completion
    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error(`Hook execution timeout after ${timeout}ms`));
        return;
      }

      const result = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        signal: signal,
        timedOut: false,
      };

      if (verbose) {
        console.log(`[HookRunner] Exit code: ${code}`);
        console.log(`[HookRunner] Result: ${JSON.stringify(result, null, 2)}`);
      }

      resolve(result);
    });

    // Handle process errors
    child.on('error', error => {
      clearTimeout(timeoutId);
      reject(new Error(`Hook execution error: ${error.message}`));
    });

    // Write input to stdin
    try {
      const inputStr = JSON.stringify(hookInput);
      child.stdin.write(inputStr);
      child.stdin.end();

      if (verbose) {
        console.log(`[HookRunner] Wrote ${inputStr.length} bytes to stdin`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      child.kill();
      reject(new Error(`Failed to write hook input: ${error.message}`));
    }
  });
}

/**
 * Run PreToolUse hook
 *
 * @param {string} hookPath - Path to hook script
 * @param {object} toolInput - Tool input to validate
 * @param {object} options - Execution options
 * @returns {Promise<object>} Hook decision
 */
export async function runPreToolUseHook(hookPath, toolInput, options = {}) {
  const hookInput = {
    tool_name: toolInput.tool_name || 'Task',
    tool_input: toolInput.tool_input,
  };

  const result = await runHook(hookPath, hookInput, options);

  // Parse hook decision from stdout
  let decision = 'approve';
  let reason = '';
  let suggestion = '';
  let metadata = {};

  if (result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      decision = parsed.decision || 'approve';
      if (decision === 'allow') decision = 'approve';
      reason = parsed.reason || '';
      suggestion = parsed.suggestion || '';
      metadata = parsed.metadata || {};
    } catch {
      // Handle text-based decision
      if (result.stdout.includes('BLOCKED') || result.stdout.includes('VIOLATION')) {
        decision = 'block';
        reason = result.stdout;
      }
    }
  }

  return {
    decision,
    reason,
    suggestion,
    metadata,
    raw_output: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
  };
}

/**
 * Run PostToolUse hook
 *
 * @param {string} hookPath - Path to hook script
 * @param {object} toolResult - Tool result to analyze
 * @param {object} options - Execution options
 * @returns {Promise<object>} Hook analysis
 */
export async function runPostToolUseHook(hookPath, toolResult, options = {}) {
  const hookInput = {
    tool_name: toolResult.tool_name || 'Task',
    tool_input: toolResult.tool_input,
    tool_result: toolResult.tool_result,
  };

  const result = await runHook(hookPath, hookInput, options);

  // Parse hook analysis from stdout
  let analysis = {
    verification_steps: {},
    verification_verdict: 'UNKNOWN',
    verification_passed: false,
    errors: [],
    warnings: [],
  };

  if (result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      analysis = { ...analysis, ...parsed };
    } catch {
      // Handle text-based analysis
      analysis.raw = result.stdout;

      // Try to extract verdict from text
      if (result.stdout.includes('PASS')) {
        analysis.verification_verdict = 'PASS';
        analysis.verification_passed = true;
      } else if (result.stdout.includes('FAIL')) {
        analysis.verification_verdict = 'FAIL';
        analysis.verification_passed = false;
      } else if (result.stdout.includes('CONCERNS')) {
        analysis.verification_verdict = 'CONCERNS';
        analysis.verification_passed = false;
      }
    }
  }

  return {
    analysis,
    raw_output: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
  };
}

/**
 * Batch run multiple hooks
 *
 * @param {Array<{hookPath: string, hookInput: object}>} hooks - Hooks to run
 * @param {object} options - Execution options
 * @returns {Promise<Array<object>>} Hook results
 */
export async function runHookBatch(hooks, options = {}) {
  const results = [];

  for (const { hookPath, hookInput } of hooks) {
    try {
      const result = await runHook(hookPath, hookInput, options);
      results.push({
        hookPath,
        success: true,
        result,
      });
    } catch (error) {
      results.push({
        hookPath,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Parse hook output to standard format
 *
 * @param {object} rawResult - Raw hook execution result
 * @param {string} hookType - Hook type (pretooluse, posttooluse)
 * @returns {object} Parsed result
 */
export function parseHookOutput(rawResult, hookType) {
  if (!rawResult.stdout) {
    return {
      success: false,
      error: 'No stdout output from hook',
    };
  }

  try {
    const parsed = JSON.parse(rawResult.stdout);

    if (hookType === 'pretooluse') {
      return {
        success: true,
        type: 'pretooluse',
        decision: parsed.decision === 'allow' ? 'approve' : parsed.decision || 'approve',
        reason: parsed.reason || '',
        suggestion: parsed.suggestion || '',
        metadata: parsed.metadata || {},
      };
    } else if (hookType === 'posttooluse') {
      return {
        success: true,
        type: 'posttooluse',
        verification_verdict: parsed.verification_verdict || 'UNKNOWN',
        verification_passed: parsed.verification_passed || false,
        errors: parsed.errors || [],
        warnings: parsed.warnings || [],
        verification_steps: parsed.verification_steps || {},
      };
    }

    return {
      success: true,
      type: 'unknown',
      data: parsed,
    };
  } catch (error) {
    // Fallback to text parsing
    return {
      success: false,
      error: 'Failed to parse JSON output',
      raw_output: rawResult.stdout,
      parse_error: error.message,
    };
  }
}

// Export default
export default {
  runHook,
  runPreToolUseHook,
  runPostToolUseHook,
  runHookBatch,
  parseHookOutput,
};
