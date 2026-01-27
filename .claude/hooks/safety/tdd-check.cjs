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
 * - 1: Block operation (when TDD_ENFORCEMENT=block)
 */

const fs = require('fs');
const path = require('path');

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
const ENFORCEMENT_MODE = process.env.TDD_ENFORCEMENT || 'warn';

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

/**
 * Parse hook input from Claude Code
 */
function parseHookInput() {
  try {
    if (process.argv[2]) {
      return JSON.parse(process.argv[2]);
    }
  } catch (e) {
    // Fallback for testing
  }
  return null;
}

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

/**
 * Extract file path from tool input
 */
function getFilePath(toolInput) {
  if (!toolInput) return null;

  // Try common parameter names
  if (toolInput.file_path) return toolInput.file_path;
  if (toolInput.filePath) return toolInput.filePath;
  if (toolInput.path) return toolInput.path;
  if (toolInput.notebook_path) return toolInput.notebook_path;

  return null;
}

/**
 * Main execution
 */
function main() {
  // Skip if enforcement is off
  if (ENFORCEMENT_MODE === 'off') {
    process.exit(0);
  }

  const hookInput = parseHookInput();
  if (!hookInput) {
    process.exit(0);
  }

  // Get tool name and input
  const toolName = hookInput.tool_name || hookInput.tool;
  const toolInput = hookInput.tool_input || hookInput.input || {};

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
      process.exit(1);
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

main();
