#!/usr/bin/env node
/**
 * Bash Tool - Native Agent SDK Implementation
 * Executes bash commands with security validation, timeout handling, and structured output
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/bash-tool.md
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SECURITY_HOOK = join(__dirname, '../../hooks/security-pre-tool.sh');

/**
 * Validate command using security hook
 */
async function validateCommand(command) {
  try {
    const input = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command },
      timestamp: new Date().toISOString(),
    });

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const result = await execFileAsync('bash', [SECURITY_HOOK], {
      input,
      maxBuffer: 1024 * 1024,
    });

    const decision = JSON.parse(result.stdout);
    return decision;
  } catch (error) {
    // If hook fails, default to blocking for safety
    return { decision: 'block', reason: 'Security hook validation failed' };
  }
}

/**
 * Generate unique tool call ID
 */
function generateToolCallId() {
  return `tool_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute bash command with timeout and security validation (with streaming support)
 */
export async function* executeBashCommand(input, context = {}) {
  const toolCallId = context.tool_call_id || generateToolCallId();
  const {
    command,
    workingDirectory = process.cwd(),
    timeout = 30000,
    captureOutput = true,
  } = input;

  // Yield start event
  yield {
    type: 'tool_call_start',
    tool_name: 'bash',
    tool_call_id: toolCallId,
    input: { command, workingDirectory },
  };

  try {
    // Yield progress: validating
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'validating', message: 'Validating command through security hook...' },
    };

    // Validate command through security hook
    const validation = await validateCommand(command);
    if (validation.decision === 'block') {
      yield {
        type: 'tool_call_error',
        tool_call_id: toolCallId,
        error: { message: `Command blocked: ${validation.reason}`, code: 'BLOCKED' },
      };
      return;
    }

    // Yield progress: executing
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'executing', message: `Executing command: ${command}` },
    };

    // Execute command with timeout
    const startTime = Date.now();
    const options = {
      cwd: workingDirectory,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, ...context.env },
    };

    const { stdout, stderr } = await execAsync(command, options);
    const executionTime = Date.now() - startTime;

    // Yield completion
    yield {
      type: 'tool_call_complete',
      tool_call_id: toolCallId,
      output: {
        success: true,
        stdout: captureOutput ? stdout : '',
        stderr: captureOutput ? stderr : '',
        exitCode: 0,
        command,
        workingDirectory,
        executionTime,
      },
    };
  } catch (error) {
    // Yield error
    yield {
      type: 'tool_call_error',
      tool_call_id: toolCallId,
      error: {
        message: error.message,
        code: error.code || 'EXECUTION_ERROR',
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      },
      output: {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        command,
        workingDirectory,
        error: error.message,
        executionTime: Date.now(),
      },
    };
  }
}

/**
 * Tool definition for Agent SDK
 */
export const bashTool = {
  name: 'bash',
  description: 'Execute bash commands with security validation and timeout handling',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to execute',
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory for command execution',
        default: process.cwd(),
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000,
      },
      captureOutput: {
        type: 'boolean',
        description: 'Whether to capture stdout/stderr',
        default: true,
      },
    },
    required: ['command'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the command executed successfully',
      },
      stdout: {
        type: 'string',
        description: 'Standard output from the command',
      },
      stderr: {
        type: 'string',
        description: 'Standard error from the command',
      },
      exitCode: {
        type: 'number',
        description: 'Exit code from the command',
      },
      command: {
        type: 'string',
        description: 'The command that was executed',
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory where command was executed',
      },
      executionTime: {
        type: 'number',
        description: 'Execution time in milliseconds',
      },
      error: {
        type: 'string',
        description: 'Error message if execution failed',
      },
    },
    required: ['success', 'exitCode', 'command'],
  },
  execute: executeBashCommand,
};

export default bashTool;
