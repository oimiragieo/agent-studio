/**
 * Cross-Platform Utilities (ESM)
 *
 * Provides platform-aware constants and utilities for Windows/Unix compatibility.
 *
 * Usage:
 *   import { NULL_DEVICE, isWindows, shellQuote } from '../lib/platform.mjs';
 *   execSync(`command 2>${NULL_DEVICE}`);
 */

/**
 * The null device for the current platform.
 * - Windows: 'NUL'
 * - Unix/Linux/macOS: '/dev/null'
 *
 * IMPORTANT: Never hardcode '/dev/null' in shell commands.
 * On Windows, this creates a literal file named 'nul'.
 */
export const NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null';

/**
 * Whether the current platform is Windows.
 */
export const isWindows = process.platform === 'win32';

/**
 * Whether the current platform is macOS.
 */
export const isMacOS = process.platform === 'darwin';

/**
 * Whether the current platform is Linux.
 */
export const isLinux = process.platform === 'linux';

/**
 * Get the appropriate shell for the platform.
 * - Windows: 'cmd.exe' or 'powershell.exe'
 * - Unix: '/bin/sh' or '/bin/bash'
 */
export function getShell() {
  if (isWindows) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/sh';
}

/**
 * Quote a path for shell usage (handles spaces).
 * @param {string} filepath - The path to quote
 * @returns {string} - The quoted path
 */
export function shellQuote(filepath) {
  if (isWindows) {
    // Windows: use double quotes, escape internal quotes
    return `"${filepath.replace(/"/g, '""')}"`;
  }
  // Unix: use single quotes, escape internal single quotes
  return `'${filepath.replace(/'/g, "'\\''")}'`;
}

/**
 * Suppress stderr in a shell command (cross-platform).
 * @param {string} command - The command to modify
 * @returns {string} - Command with stderr suppressed
 */
export function suppressStderr(command) {
  return `${command} 2>${NULL_DEVICE}`;
}

/**
 * Suppress all output in a shell command (cross-platform).
 * @param {string} command - The command to modify
 * @returns {string} - Command with all output suppressed
 */
export function suppressAllOutput(command) {
  return `${command} >${NULL_DEVICE} 2>&1`;
}
