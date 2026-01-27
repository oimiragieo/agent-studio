#!/usr/bin/env node
/**
 * TDD Safety Guard Hook
 *
 * Runs on PreToolUse to enforce Test-Driven Development:
 * 1. Parses hook input from Claude Code
 * 2. Detects Edit/Write operations on production code
 * 3. Warns if no corresponding test file exists
 * 4. Can be configured to block or warn only
 *
 * Environment:
 *   TDD_ENFORCEMENT=block|warn|off (default: warn)
 *
 * Exit codes:
 * - 0: Allow operation
 * - 2: Block operation (when TDD_ENFORCEMENT=block)
 *
 * PERF-006: Uses shared hook-input utility to eliminate code duplication.
 * PERF-007: Uses shared project-root utility to eliminate findProjectRoot duplication.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// PERF-006/PERF-007: Use shared utilities instead of duplicated code
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');
const {
  parseHookInputSync,
  getToolName,
  getToolInput,
  extractFilePath,
  getEnforcementMode,
} = require('../../lib/utils/hook-input.cjs');

const ENFORCEMENT_MODE = getEnforcementMode('TDD_ENFORCEMENT', 'warn');

// Tools that modify files
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit'];

// File patterns that are tests
const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.[jt]sx?$/,
  /_spec\.[jt]sx?$/,
  /test_.*\.[jt]sx?$/,
  /spec_.*\.[jt]sx?$/,
  /\.test\.py$/,
  /_test\.py$/,
  /test_.*\.py$/,
  /\.spec\.rb$/,
  /_spec\.rb$/,
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.claude/,
  /dist/,
  /build/,
  /coverage/,
  /\.md$/,
  /\.json$/,
  /\.yaml$/,
  /\.yml$/,
  /\.config\./,
  /\.lock$/,
  /package-lock/,
  /yarn\.lock/,
  /pnpm-lock/,
];

// PERF-006: parseHookInput is now imported from hook-input.cjs
// Alias for backward compatibility with exports
const parseHookInput = parseHookInputSync;

/**
 * Check if a file is a test file
 */
function isTestFile(filePath) {
  const fileName = path.basename(filePath);
  return TEST_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Find corresponding test file for a source file
 */
function findTestFile(sourceFile) {
  const dir = path.dirname(sourceFile);
  const ext = path.extname(sourceFile);
  const basename = path.basename(sourceFile, ext);

  // Common test file naming conventions
  const testPatterns = [
    path.join(dir, `${basename}.test${ext}`),
    path.join(dir, `${basename}.spec${ext}`),
    path.join(dir, `${basename}_test${ext}`),
    path.join(dir, '__tests__', `${basename}.test${ext}`),
    path.join(dir, '__tests__', `${basename}${ext}`),
    path.join(dir, 'tests', `${basename}.test${ext}`),
    path.join(dir, 'test', `${basename}.test${ext}`),
    // Go up one level and check tests directory
    path.join(path.dirname(dir), 'tests', `${basename}.test${ext}`),
    path.join(path.dirname(dir), '__tests__', `${basename}.test${ext}`),
  ];

  // Python conventions
  if (ext === '.py') {
    testPatterns.push(
      path.join(dir, `test_${basename}.py`),
      path.join(dir, 'tests', `test_${basename}.py`),
      path.join(path.dirname(dir), 'tests', `test_${basename}.py`)
    );
  }

  for (const testPath of testPatterns) {
    const fullPath = path.resolve(PROJECT_ROOT, testPath);
    if (fs.existsSync(fullPath)) {
      return testPath;
    }
  }

  return null;
}

// PERF-006: getFilePath is now extractFilePath from hook-input.cjs
// Alias for backward compatibility
const getFilePath = extractFilePath;

/**
 * Main execution
 */
function main() {
  // Skip if enforcement is off
  if (ENFORCEMENT_MODE === 'off') {
    process.exit(0);
  }

  // PERF-006: Use shared utility for parsing
  const hookInput = parseHookInputSync();
  if (!hookInput) {
    process.exit(0);
  }

  // PERF-006: Get tool name and input using shared utilities
  const toolName = getToolName(hookInput);
  const toolInput = getToolInput(hookInput);

  // Only check write tools
  if (!WRITE_TOOLS.includes(toolName)) {
    process.exit(0);
  }

  // Get the file being modified
  const filePath = getFilePath(toolInput);
  if (!filePath) {
    process.exit(0);
  }

  // Normalize path
  const normalizedPath = path.normalize(filePath);

  // Skip ignored files
  if (shouldIgnore(normalizedPath)) {
    process.exit(0);
  }

  // Skip if this IS a test file
  if (isTestFile(normalizedPath)) {
    process.exit(0);
  }

  // Check for corresponding test file
  const testFile = findTestFile(normalizedPath);

  if (!testFile) {
    const fileName = path.basename(normalizedPath);

    if (ENFORCEMENT_MODE === 'block') {
      console.log('\n┌─────────────────────────────────────────────────┐');
      console.log('│ 🛑 TDD VIOLATION - OPERATION BLOCKED            │');
      console.log('├─────────────────────────────────────────────────┤');
      console.log(`│ File: ${fileName.slice(0, 42).padEnd(42)} │`);
      console.log('│                                                 │');
      console.log('│ No test file found for this source file.       │');
      console.log('│ TDD requires tests BEFORE implementation.      │');
      console.log('│                                                 │');
      console.log('│ Create a test file first:                      │');
      console.log(
        `│   ${fileName
          .replace(/\.[^.]+$/, '.test$&')
          .slice(0, 46)
          .padEnd(46)} │`
      );
      console.log('│                                                 │');
      console.log('│ Set TDD_ENFORCEMENT=warn to allow anyway.      │');
      console.log('└─────────────────────────────────────────────────┘\n');
      process.exit(2); // Exit 2 = block operation (convention: 0=allow, 2=block)
    } else {
      console.log('\n┌─────────────────────────────────────────────────┐');
      console.log('│ ⚠️  TDD WARNING                                  │');
      console.log('├─────────────────────────────────────────────────┤');
      console.log(`│ Editing: ${fileName.slice(0, 39).padEnd(39)} │`);
      console.log('│                                                 │');
      console.log('│ No test file found. Consider TDD:              │');
      console.log('│  1. Write a failing test first                 │');
      console.log('│  2. Implement to make it pass                  │');
      console.log('│  3. Refactor                                   │');
      console.log('└─────────────────────────────────────────────────┘\n');
      process.exit(0);
    }
  }

  // Test file exists - all good
  process.exit(0);
}

// Export functions for testing
module.exports = {
  isTestFile,
  shouldIgnore,
  findTestFile,
  parseHookInput, // Alias for parseHookInputSync from hook-input.cjs
};

// Only run main if executed directly (not when required for testing)
if (require.main === module) {
  main();
}
