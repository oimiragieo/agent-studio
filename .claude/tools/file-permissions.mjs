#!/usr/bin/env node
/**
 * Cross-Platform File Permission Utilities
 * Safely handles file permissions across Windows and Unix systems
 *
 * @module file-permissions
 */

import fs from 'fs';
import os from 'os';

const isWindows = os.platform() === 'win32';

/**
 * Make a file executable (Unix only)
 * No-op on Windows (uses file extension instead)
 *
 * @param {string} filePath - Path to file
 *
 * @example
 * makeExecutable('./scripts/deploy.sh');
 * // On Unix: chmod 755
 * // On Windows: no-op
 */
export function makeExecutable(filePath) {
  if (isWindows) {
    // Windows determines executability by file extension
    return;
  }

  try {
    fs.chmodSync(filePath, 0o755);
  } catch (error) {
    console.warn(`Failed to chmod ${filePath}:`, error.message);
  }
}

/**
 * Set file permissions (Unix only)
 * No-op on Windows
 *
 * @param {string} filePath - Path to file
 * @param {number|string} permissions - Octal permissions (e.g., 0o644 or '644')
 *
 * @example
 * setFilePermissions('./config.json', 0o600); // Owner read/write only
 * setFilePermissions('./script.sh', '755');   // Executable by all
 */
export function setFilePermissions(filePath, permissions) {
  if (isWindows) {
    return;
  }

  try {
    const mode = typeof permissions === 'string'
      ? parseInt(permissions, 8)
      : permissions;
    fs.chmodSync(filePath, mode);
  } catch (error) {
    console.warn(`Failed to chmod ${filePath}:`, error.message);
  }
}

/**
 * Get file permissions (Unix only)
 * Returns null on Windows
 *
 * @param {string} filePath - Path to file
 * @returns {number|null} Octal permissions or null on Windows
 *
 * @example
 * const perms = getFilePermissions('./script.sh');
 * console.log(perms.toString(8)); // '755'
 */
export function getFilePermissions(filePath) {
  if (isWindows) {
    return null;
  }

  try {
    const stats = fs.statSync(filePath);
    return stats.mode & 0o777; // Extract permission bits
  } catch (error) {
    console.warn(`Failed to get permissions for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if file is executable
 * On Windows, checks file extension
 * On Unix, checks execute permission
 *
 * @param {string} filePath - Path to file
 * @returns {boolean} True if executable
 *
 * @example
 * if (isExecutable('./script.sh')) {
 *   console.log('File can be executed');
 * }
 */
export function isExecutable(filePath) {
  if (isWindows) {
    // Windows checks file extension
    const ext = filePath.toLowerCase().split('.').pop();
    const executableExtensions = ['exe', 'cmd', 'bat', 'com', 'ps1'];
    return executableExtensions.includes(ext);
  }

  try {
    const perms = getFilePermissions(filePath);
    if (perms === null) return false;

    // Check if owner has execute permission
    return (perms & 0o100) !== 0;
  } catch (error) {
    return false;
  }
}

/**
 * Set multiple files to be executable
 *
 * @param {string[]} filePaths - Array of file paths
 * @returns {Array<{path: string, success: boolean, error?: string}>} Results
 *
 * @example
 * const results = makeMultipleExecutable([
 *   './scripts/build.sh',
 *   './scripts/deploy.sh'
 * ]);
 * results.forEach(r => console.log(`${r.path}: ${r.success ? 'OK' : r.error}`));
 */
export function makeMultipleExecutable(filePaths) {
  return filePaths.map(filePath => {
    try {
      makeExecutable(filePath);
      return { path: filePath, success: true };
    } catch (error) {
      return {
        path: filePath,
        success: false,
        error: error.message
      };
    }
  });
}

/**
 * Create a file with specific permissions (Unix only)
 *
 * @param {string} filePath - Path to file
 * @param {string} content - File content
 * @param {number} permissions - Octal permissions (default: 0o644)
 *
 * @example
 * createFileWithPermissions('./secret.key', keyData, 0o600);
 * // Creates file readable/writable only by owner
 */
export function createFileWithPermissions(filePath, content, permissions = 0o644) {
  fs.writeFileSync(filePath, content, 'utf8');
  setFilePermissions(filePath, permissions);
}

/**
 * Get human-readable permission string (Unix only)
 *
 * @param {string} filePath - Path to file
 * @returns {string|null} Permission string like 'rwxr-xr-x' or null on Windows
 *
 * @example
 * const perms = getPermissionString('./script.sh');
 * console.log(perms); // 'rwxr-xr-x'
 */
export function getPermissionString(filePath) {
  const perms = getFilePermissions(filePath);
  if (perms === null) return null;

  const chars = 'rwxrwxrwx';
  let result = '';

  for (let i = 0; i < 9; i++) {
    const bit = 1 << (8 - i);
    result += (perms & bit) ? chars[i] : '-';
  }

  return result;
}

export default {
  makeExecutable,
  setFilePermissions,
  getFilePermissions,
  isExecutable,
  makeMultipleExecutable,
  createFileWithPermissions,
  getPermissionString,
  isWindows
};
