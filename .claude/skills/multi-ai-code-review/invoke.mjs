#!/usr/bin/env node
/**
 * Agent Studio Skill Adapter for Codex CLI multi-ai-code-review
 *
 * This adapter bridges Agent Studio skill invocation patterns with the Codex CLI
 * implementation located in codex-skills/multi-ai-code-review/scripts/review.js
 *
 * @module invoke
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build command-line arguments from Agent Studio parameters
 * @param {Object} params - Skill invocation parameters
 * @returns {string[]} Array of CLI arguments
 */
function buildArgs(params) {
  const args = [];

  // Provider selection (default: claude,gemini)
  if (params.providers && Array.isArray(params.providers)) {
    args.push('--providers', params.providers.join(','));
  } else if (params.providers && typeof params.providers === 'string') {
    args.push('--providers', params.providers);
  } else {
    args.push('--providers', 'claude,gemini');
  }

  // Output format (default: json)
  const outputFormat = params.output || 'json';
  args.push('--output', outputFormat);

  // Diff source options
  if (params.staged) {
    args.push('--staged');
  }
  if (params.range) {
    args.push('--range', params.range);
  }
  if (params.diffFile) {
    args.push('--diff-file', params.diffFile);
  }

  // Auth mode (default: session-first)
  if (params.authMode) {
    args.push('--auth-mode', params.authMode);
  }

  // Timeout configuration
  if (params.timeoutMs) {
    args.push('--timeout-ms', String(params.timeoutMs));
  }

  // Synthesis configuration
  if (params.synthesize === false || params.noSynthesis) {
    args.push('--no-synthesis');
  }
  if (params.synthesizeWith) {
    args.push('--synthesize-with', params.synthesizeWith);
  }

  // Max diff characters
  if (params.maxDiffChars) {
    args.push('--max-diff-chars', String(params.maxDiffChars));
  }

  // CI mode
  if (params.ci) {
    args.push('--ci');
  }

  // Strict JSON mode
  if (params.strictJsonOnly) {
    args.push('--strict-json-only');
  }

  // Dry run
  if (params.dryRun) {
    args.push('--dry-run');
  }

  return args;
}

/**
 * Run the Codex CLI script
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Execution result
 */
function runScript(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true, // Windows-friendly
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf8');
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf8');
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        ok: code === 0,
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Format output for Agent Studio consumption
 * @param {Object} result - Codex CLI result
 * @param {string} outputFormat - Desired output format
 * @returns {Object} Formatted output
 */
function formatOutput(result, outputFormat) {
  if (!result.ok) {
    return {
      success: false,
      error: result.stderr || 'Codex CLI execution failed',
      exitCode: result.code,
    };
  }

  // Parse JSON output
  if (outputFormat === 'json') {
    try {
      const parsed = JSON.parse(result.stdout);
      return {
        success: true,
        data: parsed,
        format: 'json',
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse JSON output: ${parseError.message}`,
        rawOutput: result.stdout,
      };
    }
  }

  // Return markdown as-is
  if (outputFormat === 'markdown') {
    return {
      success: true,
      data: result.stdout,
      format: 'markdown',
    };
  }

  // Fallback: return raw output
  return {
    success: true,
    data: result.stdout,
    format: 'text',
  };
}

/**
 * Main skill invocation handler
 * @param {Object} params - Skill invocation parameters
 * @returns {Promise<Object>} Skill execution result
 */
export async function invoke(params = {}) {
  try {
    // Resolve path to Codex CLI script
    const projectRoot = path.resolve(__dirname, '../../..');
    const scriptPath = path.join(
      projectRoot,
      'codex-skills/multi-ai-code-review/scripts/review.js'
    );

    // Build CLI arguments
    const args = buildArgs(params);

    // Execute Codex CLI script
    const result = await runScript('node', [scriptPath, ...args], {
      cwd: projectRoot,
    });

    // Format output for Agent Studio
    const outputFormat = params.output || 'json';
    const formatted = formatOutput(result, outputFormat);

    return formatted;
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error),
      stack: error.stack,
    };
  }
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const testParams = {
    providers: ['claude', 'gemini'],
    output: 'json',
    staged: false,
    range: null,
  };

  console.log('Testing Agent Studio adapter with parameters:', testParams);

  invoke(testParams)
    .then((result) => {
      console.log('Adapter result:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Adapter error:', error);
      process.exit(1);
    });
}
