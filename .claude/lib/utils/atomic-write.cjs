#!/usr/bin/env node
/**
 * Atomic File Write Utility
 *
 * Prevents data corruption by writing to a temp file first, then renaming.
 * This is critical for state files that must not be corrupted if the process
 * crashes mid-write.
 *
 * Pattern: Write to .tmp-<random> -> Atomic rename to target
 *
 * Why this matters:
 * - fs.writeFileSync can leave partial/corrupted files on crash
 * - fs.renameSync is atomic on most filesystems (POSIX guarantee)
 * - Temp file in same directory ensures same filesystem (required for atomic rename)
 *
 * Usage:
 *   const { atomicWriteSync, atomicWriteJSONSync } = require('./atomic-write.cjs');
 *
 *   // Write text/binary content
 *   atomicWriteSync('/path/to/file.txt', 'content');
 *
 *   // Write JSON with pretty printing
 *   atomicWriteJSONSync('/path/to/state.json', { mode: 'agent' });
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Write file atomically (write to temp, then rename)
 * Prevents data corruption on crash/power failure
 *
 * @param {string} filePath - Absolute path to target file
 * @param {string|Buffer} content - Content to write
 * @param {Object|string} [options] - fs.writeFileSync options (encoding, mode, flag)
 * @throws {Error} If write or rename fails
 */
function atomicWriteSync(filePath, content, options = {}) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.tmp-${crypto.randomBytes(4).toString('hex')}`);

  try {
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temp file
    fs.writeFileSync(tempFile, content, options);

    // Atomic rename
    fs.renameSync(tempFile, filePath);
  } catch (e) {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw e;
  }
}

/**
 * Write JSON atomically with pretty printing
 *
 * @param {string} filePath - Absolute path to target file
 * @param {*} data - Data to serialize to JSON
 * @throws {Error} If serialization, write, or rename fails
 */
function atomicWriteJSONSync(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  atomicWriteSync(filePath, content, 'utf8');
}

module.exports = { atomicWriteSync, atomicWriteJSONSync };
