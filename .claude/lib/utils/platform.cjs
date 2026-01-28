#!/usr/bin/env node
/**
 * Platform Utilities - Cross-platform path and shell handling
 *
 * Provides utilities for handling Windows/Unix path differences, especially
 * for Git Bash on Windows where backslashes break commands.
 *
 * Key Learning (from learnings.md 2026-01-27):
 * Windows paths use backslashes (C:\Users\...) but Git Bash is a Unix shell
 * where backslash is an escape character. This causes EOF errors and path corruption.
 *
 * Solution: Always convert paths to forward slashes before using in Bash commands.
 * Windows APIs officially support forward slashes (documented by Microsoft).
 *
 * @module platform
 */

'use strict';

const path = require('path');

/**
 * Detect if running on Windows
 * @constant {boolean}
 */
const isWindows = process.platform === 'win32';

/**
 * Detect if running on macOS
 * @constant {boolean}
 */
const isMac = process.platform === 'darwin';

/**
 * Detect if running on Linux
 * @constant {boolean}
 */
const isLinux = process.platform === 'linux';

/**
 * Convert a Windows path to a Bash-compatible path.
 *
 * CRITICAL for Git Bash on Windows:
 * - Converts backslashes to forward slashes
 * - Windows APIs support forward slashes (Microsoft documented)
 * - Git Bash REQUIRES forward slashes (Unix shell)
 *
 * @param {string} windowsPath - Path that may contain backslashes
 * @returns {string} Path with forward slashes (safe for Bash)
 *
 * @example
 * bashPath('C:\\Users\\name\\project')
 * // Returns: 'C:/Users/name/project'
 *
 * @example
 * bashPath('/unix/path/already')
 * // Returns: '/unix/path/already' (no change)
 */
function bashPath(windowsPath) {
  if (!windowsPath) return windowsPath;
  // Input validation
  if (typeof windowsPath !== 'string') {
    return windowsPath;
  }
  // SEC-REMEDIATION-002: Sanitize null bytes (command injection prevention)
  // Null bytes can truncate paths or bypass validation
  let sanitized = windowsPath.replace(/\0/g, '');
  // Warn on shell metacharacters that could be dangerous
  const shellMetachars = /[$`!]/;
  if (shellMetachars.test(sanitized) && process.env.PLATFORM_DEBUG === 'true') {
    console.error(
      JSON.stringify({
        type: 'security_warning',
        message: 'Path contains shell metacharacters',
        path: sanitized.substring(0, 100), // Truncate for logging
      })
    );
  }
  // Convert all backslashes to forward slashes
  return sanitized.replace(/\\/g, '/');
}

/**
 * Quote a path for safe use in shell commands.
 * Handles spaces and special characters.
 *
 * @param {string} filepath - Path to quote
 * @returns {string} Quoted path safe for shell use
 *
 * @example
 * shellQuote('C:/Users/My Documents/file.txt')
 * // Returns: '"C:/Users/My Documents/file.txt"' (Windows)
 * // Returns: "'C:/Users/My Documents/file.txt'" (Unix)
 */
function shellQuote(filepath) {
  if (!filepath) return filepath;

  // First normalize to forward slashes for Bash compatibility
  const normalized = bashPath(filepath);

  if (isWindows) {
    // Windows: Use double quotes, escape existing double quotes
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  // Unix: Use single quotes, escape existing single quotes
  return `'${normalized.replace(/'/g, "'\\''")}'`;
}

/**
 * Convert a path to be Bash-safe with proper quoting.
 * Combines bashPath() and shellQuote() for complete safety.
 *
 * Use this when constructing Bash commands with paths.
 *
 * @param {string} filepath - Path to make Bash-safe
 * @returns {string} Quoted, forward-slash path safe for Bash commands
 *
 * @example
 * // In a hook constructing a Bash command:
 * const safePath = bashSafePath('C:\\dev\\project\\file.txt');
 * execSync(`cat ${safePath}`);  // Works in Git Bash on Windows
 */
function bashSafePath(filepath) {
  return shellQuote(bashPath(filepath));
}

/**
 * Normalize path separators to the current platform's convention.
 * Unlike bashPath(), this uses the native separator.
 *
 * @param {string} filepath - Path to normalize
 * @returns {string} Path with platform-native separators
 */
function normalizePath(filepath) {
  if (!filepath) return filepath;
  return filepath.replace(/[/\\]/g, path.sep);
}

/**
 * Check if a path appears to be a Windows absolute path.
 *
 * @param {string} filepath - Path to check
 * @returns {boolean} True if path looks like Windows absolute (C:\... or C:/...)
 */
function isWindowsAbsolutePath(filepath) {
  if (!filepath) return false;
  // Match drive letter followed by : and separator
  return /^[A-Za-z]:[/\\]/.test(filepath);
}

/**
 * Check if a path appears to be a Unix absolute path.
 *
 * @param {string} filepath - Path to check
 * @returns {boolean} True if path starts with /
 */
function isUnixAbsolutePath(filepath) {
  if (!filepath) return false;
  return filepath.startsWith('/');
}

/**
 * Check if a path is absolute (works cross-platform).
 *
 * @param {string} filepath - Path to check
 * @returns {boolean} True if path is absolute
 */
function isAbsolutePath(filepath) {
  return isWindowsAbsolutePath(filepath) || isUnixAbsolutePath(filepath);
}

/**
 * Get the appropriate line ending for the current platform.
 *
 * @returns {string} '\r\n' on Windows, '\n' on Unix
 */
function getLineEnding() {
  return isWindows ? '\r\n' : '\n';
}

/**
 * Normalize line endings in text to Unix style (\n).
 * Useful for consistent file handling across platforms.
 *
 * @param {string} text - Text with potentially mixed line endings
 * @returns {string} Text with Unix line endings
 */
function normalizeLineEndings(text) {
  if (!text) return text;
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = {
  // Platform detection
  isWindows,
  isMac,
  isLinux,

  // Path utilities
  bashPath,
  shellQuote,
  bashSafePath,
  normalizePath,

  // Path checks
  isWindowsAbsolutePath,
  isUnixAbsolutePath,
  isAbsolutePath,

  // Line ending utilities
  getLineEnding,
  normalizeLineEndings,
};
