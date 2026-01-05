/**
 * File Size Validator Tool
 * Validates individual files or directories against defined size limits.
 * Enforces micro-services principles: max 1000 lines, target 200-500 lines.
 */

import { readFile, stat } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

const MAX_LINES = 1000;
const WARN_LINES = 500;
const MIN_LINES = 50;

// File extensions to validate (code files)
const CODE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj',
  '.vue', '.svelte', '.mjs', '.cjs'
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.claude',
  'vendor',
  'target',
  '*.min.js',
  '*.bundle.js'
];

/**
 * Validate a single file
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} Validation result
 */
export async function validateFile(filePath) {
  if (!existsSync(filePath)) {
    return { status: 'ERROR', message: `File not found: ${filePath}` };
  }

  const stats = await stat(filePath);
  if (!stats.isFile()) {
    return { status: 'ERROR', message: `Path is not a file: ${filePath}` };
  }

  const ext = extname(filePath).toLowerCase();
  if (!CODE_EXTENSIONS.includes(ext)) {
    return { status: 'SKIP', message: `Not a code file: ${filePath}` };
  }

  // Check if file should be ignored
  const shouldIgnore = IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });

  if (shouldIgnore) {
    return { status: 'SKIP', message: `File matches ignore pattern: ${filePath}` };
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').length;

    if (lines > MAX_LINES) {
      return {
        status: 'REJECT',
        message: `File exceeds hard limit of ${MAX_LINES} lines (${lines} lines).`,
        filePath,
        lines,
        maxLines: MAX_LINES
      };
    } else if (lines > WARN_LINES) {
      return {
        status: 'WARN',
        message: `File exceeds recommended limit of ${WARN_LINES} lines (${lines} lines). Consider refactoring.`,
        filePath,
        lines,
        warnLines: WARN_LINES
      };
    } else if (lines < MIN_LINES && lines > 0) {
      return {
        status: 'WARN',
        message: `File is very small (${lines} lines). Consider consolidating if it lacks a clear single responsibility.`,
        filePath,
        lines,
        minLines: MIN_LINES
      };
    } else {
      return {
        status: 'APPROVE',
        message: `File size is within recommended limits (${lines} lines).`,
        filePath,
        lines
      };
    }
  } catch (error) {
    return {
      status: 'ERROR',
      message: `Error reading file: ${error.message}`,
      filePath
    };
  }
}

/**
 * Validate all files in a directory
 * @param {string} dirPath - Path to directory
 * @param {boolean} recursive - Whether to recurse into subdirectories
 * @returns {Promise<Object>} Validation results
 */
export async function validateDirectory(dirPath, recursive = true) {
  if (!existsSync(dirPath)) {
    return { status: 'ERROR', message: `Directory not found: ${dirPath}` };
  }

  const stats = await stat(dirPath);
  if (!stats.isDirectory()) {
    return { status: 'ERROR', message: `Path is not a directory: ${dirPath}` };
  }

  const results = {
    total: 0,
    approved: 0,
    warnings: 0,
    rejections: 0,
    errors: 0,
    skipped: 0,
    files: []
  };

  async function processDirectory(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      // Skip ignored patterns
      const shouldIgnore = IGNORE_PATTERNS.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(fullPath);
        }
        return fullPath.includes(pattern);
      });

      if (shouldIgnore) {
        continue;
      }

      if (entry.isDirectory() && recursive) {
        await processDirectory(fullPath);
      } else if (entry.isFile()) {
        results.total++;
        const validation = await validateFile(fullPath);

        if (validation.status === 'APPROVE') {
          results.approved++;
        } else if (validation.status === 'WARN') {
          results.warnings++;
        } else if (validation.status === 'REJECT') {
          results.rejections++;
        } else if (validation.status === 'ERROR') {
          results.errors++;
        } else if (validation.status === 'SKIP') {
          results.skipped++;
          continue;
        }

        results.files.push(validation);
      }
    }
  }

  await processDirectory(dirPath);

  // Determine overall status
  if (results.rejections > 0) {
    results.status = 'REJECT';
    results.message = `${results.rejections} file(s) exceed hard limit of ${MAX_LINES} lines.`;
  } else if (results.warnings > 0) {
    results.status = 'WARN';
    results.message = `${results.warnings} file(s) exceed recommended limit of ${WARN_LINES} lines.`;
  } else {
    results.status = 'APPROVE';
    results.message = `All ${results.approved} file(s) are within recommended limits.`;
  }

  return results;
}

/**
 * Get file line count
 * @param {string} filePath - Path to file
 * @returns {Promise<number>} Line count
 */
export async function getLineCount(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
}

