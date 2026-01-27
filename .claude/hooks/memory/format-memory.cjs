#!/usr/bin/env node
/**
 * Memory File Formatter Hook
 *
 * Runs on PostToolUse to format memory files after they're written.
 * Ensures consistent formatting across all memory files.
 *
 * Trigger: PostToolUse (after Edit/Write to memory files)
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

// Memory paths to watch
const MEMORY_PATHS = ['.claude/context/memory', '.claude/context/reports', '.claude/context/plans'];

/**
 * Parse hook input from Claude Code
 */
function parseHookInput() {
  try {
    if (process.argv[2]) {
      return JSON.parse(process.argv[2]);
    }
  } catch (e) {
    // Handle parse errors gracefully
  }
  return null;
}

/**
 * Check if file is in a memory directory
 */
function isMemoryFile(filePath) {
  if (!filePath) return false;

  const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');

  return MEMORY_PATHS.some(memPath => {
    const fullMemPath = path.join(PROJECT_ROOT, memPath).replace(/\\/g, '/');
    return normalizedPath.startsWith(fullMemPath) || normalizedPath.includes(memPath);
  });
}

/**
 * Check if file is a markdown file
 */
function isMarkdownFile(filePath) {
  return filePath && filePath.endsWith('.md');
}

/**
 * SEC-009 FIX: Sanitize file path to prevent command injection
 * Only allows alphanumeric, hyphens, underscores, dots, and path separators
 * @param {string} filePath - File path to validate
 * @returns {boolean} True if path is safe
 */
function isPathSafe(filePath) {
  // Reject paths with dangerous characters that could enable injection
  // Allow: alphanumeric, hyphens, underscores, dots, colons (drive letters), slashes
  const safePattern = /^[a-zA-Z0-9_\-.\\/:\s]+$/;
  if (!safePattern.test(filePath)) {
    return false;
  }

  // Reject paths with shell metacharacters
  const dangerousChars = [
    '$',
    '`',
    '|',
    '&',
    ';',
    '(',
    ')',
    '<',
    '>',
    '!',
    '*',
    '?',
    '[',
    ']',
    '{',
    '}',
    '"',
    "'",
    '\n',
    '\r',
  ];
  return !dangerousChars.some(char => filePath.includes(char));
}

/**
 * Format file using pnpm format or prettier directly
 * SEC-009 FIX: Uses spawnSync with array args to prevent command injection
 */
function formatFile(filePath) {
  // SEC-009 FIX: Validate file path before use
  if (!isPathSafe(filePath)) {
    if (process.env.DEBUG_HOOKS) {
      console.error('[format-memory] Rejected unsafe file path:', filePath);
    }
    return false;
  }

  try {
    // SEC-009 FIX: Use spawnSync with array args instead of string interpolation
    // This prevents command injection via shell metacharacters
    const pnpmResult = spawnSync('pnpm', ['format', filePath], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      timeout: 10000,
      shell: false, // CRITICAL: Disable shell to prevent injection
    });

    if (pnpmResult.status === 0) {
      return true;
    }

    // pnpm format failed, try prettier directly
    const prettierResult = spawnSync('npx', ['prettier', '--write', filePath], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      timeout: 10000,
      shell: false, // CRITICAL: Disable shell to prevent injection
    });

    if (prettierResult.status === 0) {
      return true;
    }

    // Prettier also failed, skip formatting
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  const input = parseHookInput();
  if (!input) {
    process.exit(0);
  }

  // Get tool info
  const toolName = input.tool_name || input.tool;
  const toolInput = input.tool_input || input.input || {};

  // Only process Edit/Write tools
  if (toolName !== 'Edit' && toolName !== 'Write') {
    process.exit(0);
  }

  // Get file path
  const filePath = toolInput.file_path || toolInput.filePath || toolInput.path;
  if (!filePath) {
    process.exit(0);
  }

  // Check if it's a memory markdown file
  if (!isMemoryFile(filePath) || !isMarkdownFile(filePath)) {
    process.exit(0);
  }

  // Format the file
  const formatted = formatFile(filePath);
  if (formatted) {
    const fileName = path.basename(filePath);
    console.log(`[MEMORY] Formatted: ${fileName}`);
  }

  process.exit(0);
}

main();
