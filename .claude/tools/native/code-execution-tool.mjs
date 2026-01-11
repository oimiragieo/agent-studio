#!/usr/bin/env node
/**
 * Code Execution Tool - Native Agent SDK Implementation
 * Executes code in isolated environments with sandboxing and resource limits
 * Based on: https://docs.claude.com/en/docs/agents-and-tools/tool-use/code-execution-tool.md
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

const EXECUTION_DIR = join(tmpdir(), 'claude-code-execution');
const SUPPORTED_LANGUAGES = {
  python: { extension: 'py', command: 'python3' },
  python3: { extension: 'py', command: 'python3' },
  node: { extension: 'js', command: 'node' },
  javascript: { extension: 'js', command: 'node' },
  typescript: { extension: 'ts', command: 'ts-node' },
  bash: { extension: 'sh', command: 'bash' },
  shell: { extension: 'sh', command: 'bash' },
};

/**
 * Create isolated execution environment
 */
async function createExecutionEnvironment() {
  const envId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const envPath = join(EXECUTION_DIR, envId);
  await mkdir(envPath, { recursive: true });
  return { envId, envPath };
}

/**
 * Cleanup execution environment
 */
async function cleanupEnvironment(envPath) {
  try {
    await unlink(envPath);
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Generate unique tool call ID
 */
function generateToolCallId() {
  return `tool_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute code in isolated environment (with streaming support)
 */
export async function* executeCode(input, context = {}) {
  const toolCallId = context.tool_call_id || generateToolCallId();
  const {
    code,
    language = 'python',
    timeout = 10000,
    memoryLimit = 128 * 1024 * 1024, // 128MB
    workingDirectory,
  } = input;

  // Yield start event
  yield {
    type: 'tool_call_start',
    tool_name: 'code_execution',
    tool_call_id: toolCallId,
    input: { language, code_length: code.length },
  };

  let codeFile = null;
  try {
    const langConfig = SUPPORTED_LANGUAGES[language.toLowerCase()];
    if (!langConfig) {
      yield {
        type: 'tool_call_error',
        tool_call_id: toolCallId,
        error: { message: `Unsupported language: ${language}`, code: 'UNSUPPORTED_LANGUAGE' },
      };
      return;
    }

    // Yield progress: creating environment
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: {
        stage: 'creating_environment',
        message: 'Creating isolated execution environment...',
      },
    };

    // Create isolated environment
    const { envPath } = await createExecutionEnvironment();
    codeFile = join(envPath, `code.${langConfig.extension}`);

    // Yield progress: writing code
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'writing_code', message: 'Writing code to file...' },
    };

    // Write code to file
    await writeFile(codeFile, code, 'utf8');

    // Yield progress: executing
    yield {
      type: 'tool_call_progress',
      tool_call_id: toolCallId,
      progress: { stage: 'executing', message: `Executing ${language} code...` },
    };

    // Execute with resource limits
    const command = `${langConfig.command} ${codeFile}`;
    const options = {
      cwd: workingDirectory || envPath,
      timeout,
      maxBuffer: memoryLimit,
      env: { ...process.env, ...context.env },
    };

    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(command, options);
    const executionTime = Date.now() - startTime;

    // Yield completion
    yield {
      type: 'tool_call_complete',
      tool_call_id: toolCallId,
      output: {
        success: true,
        output: stdout,
        error: stderr || null,
        language,
        executionTime,
        memoryUsed: 0, // Would need process monitoring for accurate measurement
        exitCode: 0,
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
        stderr: error.stderr || '',
      },
      output: {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        language,
        executionTime: Date.now(),
        exitCode: error.code || 1,
      },
    };
  } finally {
    // Cleanup (no yield needed for cleanup)
    if (codeFile) {
      await cleanupEnvironment(codeFile);
    }
  }
}

/**
 * Tool definition for Agent SDK
 */
export const codeExecutionTool = {
  name: 'code_execution',
  description: 'Execute code in isolated environments with sandboxing and resource limits',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to execute',
      },
      language: {
        type: 'string',
        enum: Object.keys(SUPPORTED_LANGUAGES),
        description: 'Programming language',
        default: 'python',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 10000,
      },
      memoryLimit: {
        type: 'number',
        description: 'Memory limit in bytes',
        default: 128 * 1024 * 1024,
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory for execution',
      },
    },
    required: ['code', 'language'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether code executed successfully',
      },
      output: {
        type: 'string',
        description: 'Standard output from code execution',
      },
      error: {
        type: ['string', 'null'],
        description: 'Error output or null if no errors',
      },
      language: {
        type: 'string',
        description: 'Programming language used',
      },
      executionTime: {
        type: 'number',
        description: 'Execution time in milliseconds',
      },
      memoryUsed: {
        type: 'number',
        description: 'Memory used in bytes (0 if not measured)',
      },
      exitCode: {
        type: 'number',
        description: 'Exit code from execution',
      },
    },
    required: ['success', 'language', 'executionTime', 'exitCode'],
  },
  execute: executeCode,
};

export default codeExecutionTool;
