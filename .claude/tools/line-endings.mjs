#!/usr/bin/env node
/**
 * Line Ending Normalization Utilities
 * Ensures consistent line endings across platforms
 *
 * @module line-endings
 */

import fs from 'fs';
import os from 'os';

/**
 * Normalize text to LF (Unix) line endings
 * Use this for internal processing and git storage
 *
 * @param {string} text - Text with any line ending format
 * @returns {string} Text with LF endings
 *
 * @example
 * const normalized = normalizeToLF('Hello\r\nWorld\r\n'); // 'Hello\nWorld\n'
 */
export function normalizeToLF(text) {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Normalize text to CRLF (Windows) line endings
 *
 * @param {string} text - Text with any line ending format
 * @returns {string} Text with CRLF endings
 *
 * @example
 * const windows = normalizeToCRLF('Hello\nWorld\n'); // 'Hello\r\nWorld\r\n'
 */
export function normalizeToCRLF(text) {
  return normalizeToLF(text).replace(/\n/g, '\r\n');
}

/**
 * Normalize text to system-specific line endings
 * Use this when writing files for local consumption
 *
 * @param {string} text - Text with any line ending format
 * @returns {string} Text with system-appropriate endings
 *
 * @example
 * const systemText = normalizeToSystem('Hello\nWorld\n');
 * // Returns CRLF on Windows, LF on Unix
 */
export function normalizeToSystem(text) {
  const isWindows = os.platform() === 'win32';
  return isWindows ? normalizeToCRLF(text) : normalizeToLF(text);
}

/**
 * Read a text file with normalized LF line endings
 * Always returns LF regardless of file's actual line endings
 *
 * @param {string} filePath - Path to file
 * @returns {string} File content with LF endings
 *
 * @example
 * const content = readTextFile('./README.md');
 * // Always has LF endings, regardless of platform
 */
export function readTextFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return normalizeToLF(content);
}

/**
 * Write a text file with system-appropriate line endings
 * Automatically converts to CRLF on Windows, LF on Unix
 *
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write (any line ending format)
 *
 * @example
 * writeTextFile('./output.txt', 'Hello\nWorld');
 * // Writes with CRLF on Windows, LF on Unix
 */
export function writeTextFile(filePath, content) {
  const normalizedContent = normalizeToSystem(content);
  fs.writeFileSync(filePath, normalizedContent, 'utf8');
}

/**
 * Read a text file and preserve its original line endings
 * Use this when you need to detect the file's line ending style
 *
 * @param {string} filePath - Path to file
 * @returns {{content: string, lineEnding: 'LF'|'CRLF'|'mixed'}} Content and detected line ending
 *
 * @example
 * const { content, lineEnding } = readTextFilePreserve('./file.txt');
 * console.log(`File uses ${lineEnding} line endings`);
 */
export function readTextFilePreserve(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const hasCRLF = content.includes('\r\n');
  const hasLF = content.includes('\n');
  const lfCount = (content.match(/\n/g) || []).length;
  const crlfCount = (content.match(/\r\n/g) || []).length;

  let lineEnding;
  if (crlfCount > 0 && crlfCount === lfCount) {
    lineEnding = 'CRLF';
  } else if (hasLF && !hasCRLF) {
    lineEnding = 'LF';
  } else if (hasCRLF && hasLF && crlfCount < lfCount) {
    lineEnding = 'mixed';
  } else {
    lineEnding = 'LF'; // Default
  }

  return { content, lineEnding };
}

/**
 * Convert between line ending styles
 *
 * @param {string} text - Text to convert
 * @param {'LF'|'CRLF'|'system'} toStyle - Target line ending style
 * @returns {string} Converted text
 *
 * @example
 * const unix = convertLineEndings('Hello\r\nWorld', 'LF');
 * const windows = convertLineEndings('Hello\nWorld', 'CRLF');
 */
export function convertLineEndings(text, toStyle) {
  switch (toStyle) {
    case 'LF':
      return normalizeToLF(text);
    case 'CRLF':
      return normalizeToCRLF(text);
    case 'system':
      return normalizeToSystem(text);
    default:
      throw new Error(`Unknown line ending style: ${toStyle}`);
  }
}

export default {
  normalizeToLF,
  normalizeToCRLF,
  normalizeToSystem,
  readTextFile,
  writeTextFile,
  readTextFilePreserve,
  convertLineEndings
};
