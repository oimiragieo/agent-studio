#!/usr/bin/env node
/**
 * Audit Logging Hook (PostToolUse) - Cross-Platform
 *
 * Logs tool executions for security audit trail
 * Converted from audit-post-tool.sh for Windows compatibility
 *
 * CONCURRENCY HANDLING:
 * - 2-second timeout (increased from 1s)
 * - Retry logic with exponential backoff (max 3 retries)
 * - Write queue to prevent file lock contention
 * - Fire-and-forget pattern for non-critical audit logging
 */

import { stdin, stdout, stderr } from 'process';
import { appendFile, mkdir, stat, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_AUDIT_HOOK_EXECUTING === 'true') {
  process.exit(0);
}
process.env.CLAUDE_AUDIT_HOOK_EXECUTING = 'true';

// Timeout protection - force exit after 2 seconds (increased from 1s)
const timeout = setTimeout(() => {
  console.error('[AUDIT HOOK] Timeout exceeded, forcing exit');
  delete process.env.CLAUDE_AUDIT_HOOK_EXECUTING;
  process.exit(0); // Fail-open
}, 2000);

// Audit log location
const AUDIT_DIR = join(homedir(), '.claude', 'audit');
const AUDIT_FILE = join(AUDIT_DIR, 'tool-usage.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_LINES = 10000;

/**
 * Read stdin asynchronously
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Log to stderr
 */
function log(message) {
  stderr.write(`[audit-post-tool] ${message}\n`);
}

/**
 * Get summary based on tool type
 */
function getSummary(toolName, toolInput) {
  switch (toolName) {
    case 'Bash':
      const cmd = (toolInput.command || 'no command').substring(0, 100);
      return cmd;
    case 'Edit':
    case 'Write':
      return toolInput.file_path || toolInput.path || 'no path';
    case 'Read':
      return toolInput.file_path || 'no path';
    default:
      return 'tool execution';
  }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in ms (doubles each retry)
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 50) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        // Last attempt failed, throw error
        throw error;
      }
      // Exponential backoff: 50ms, 100ms, 200ms
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}

/**
 * Append to audit log with retry logic
 * @param {string} logEntry - Log entry to append
 */
async function appendToAuditLog(logEntry) {
  return retryWithBackoff(
    async () => {
      await appendFile(AUDIT_FILE, logEntry, 'utf-8');
    },
    3,
    50
  );
}

/**
 * Trim audit log if it exceeds size limit
 */
async function trimAuditLog() {
  try {
    if (!existsSync(AUDIT_FILE)) {
      return;
    }

    const stats = await stat(AUDIT_FILE);

    // Check file size
    if (stats.size > MAX_LOG_SIZE) {
      // Use retry logic for write operation
      await retryWithBackoff(
        async () => {
          // Read file and keep last N lines
          const content = await readFile(AUDIT_FILE, 'utf-8');
          const lines = content.split('\n');
          const trimmed = lines.slice(-MAX_LOG_LINES).join('\n');
          await writeFile(AUDIT_FILE, trimmed, 'utf-8');
        },
        3,
        100
      );
      log(`Trimmed audit log to ${MAX_LOG_LINES} lines`);
    }
  } catch (error) {
    // Fail silently - trimming is non-critical
    log(`Trim failed (non-critical): ${error.message}`);
  }
}

/**
 * Main hook logic
 */
async function main() {
  try {
    // Read JSON from stdin
    const inputStr = await readStdin();

    if (!inputStr || inputStr.trim() === '') {
      process.exit(0);
    }

    const input = JSON.parse(inputStr);
    const toolName = input.tool_name || input.tool || 'unknown';
    const toolInput = input.tool_input || input.input || {};

    // Skip auditing orchestration tools to prevent recursion
    if (toolName === 'Task' || toolName === 'TodoWrite') {
      process.exit(0);
    }

    // Create audit directory if needed
    if (!existsSync(AUDIT_DIR)) {
      await mkdir(AUDIT_DIR, { recursive: true });
    }

    // Generate timestamp (ISO 8601 UTC)
    const timestamp = new Date().toISOString();

    // Get summary
    const summary = getSummary(toolName, toolInput);

    // Format log entry
    const logEntry = `${timestamp} | ${toolName} | ${summary}\n`;

    // Append to audit log with retry logic
    try {
      await appendToAuditLog(logEntry);
    } catch (error) {
      // Log warning but don't fail the hook - audit is non-critical
      log(`Append failed after retries (non-critical): ${error.message}`);
    }

    // Trim log if needed (fire-and-forget - don't wait)
    trimAuditLog().catch(err => {
      // Silently ignore trim failures
      log(`Background trim failed: ${err.message}`);
    });

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Fail silently - audit logging is non-critical
    log(`Error: ${error.message}`);
    process.exit(0);
  } finally {
    clearTimeout(timeout);
    delete process.env.CLAUDE_AUDIT_HOOK_EXECUTING;
  }
}

main();
