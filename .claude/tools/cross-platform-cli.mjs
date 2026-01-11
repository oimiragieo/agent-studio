#!/usr/bin/env node
/**
 * Cross-Platform CLI Command Wrapper
 * Ensures CLI commands work consistently across Windows, macOS, and Linux
 *
 * @module cross-platform-cli
 */

import { spawn } from 'child_process';
import os from 'os';

const isWindows = os.platform() === 'win32';

/**
 * Get the correct CLI command for the current platform
 * Windows requires .cmd or .exe extension for npm binaries
 *
 * @param {string} command - The base command name
 * @returns {string} Platform-specific command
 *
 * @example
 * getCliCommand('claude') // Returns 'claude.cmd' on Windows, 'claude' on Unix
 */
export function getCliCommand(command) {
  if (isWindows && !command.endsWith('.cmd') && !command.endsWith('.exe')) {
    // Try .cmd first (npm scripts), then .exe (native binaries)
    return `${command}.cmd`;
  }
  return command;
}

/**
 * Spawn a CLI command with cross-platform compatibility
 * Automatically handles shell requirements for Windows
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - spawn options
 * @returns {ChildProcess} The spawned process
 *
 * @example
 * const proc = spawnCli('claude', ['--version'], { cwd: '/path/to/dir' });
 * proc.on('close', (code) => console.log(`Exited with code ${code}`));
 */
export function spawnCli(command, args, options = {}) {
  const actualCommand = getCliCommand(command);
  return spawn(actualCommand, args, {
    ...options,
    shell: isWindows || options.shell,
    windowsHide: isWindows, // Hide console window on Windows
  });
}

/**
 * Execute a CLI command and return a promise
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - spawn options
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 *
 * @example
 * const result = await execCli('claude', ['--version']);
 * console.log(result.stdout);
 */
export function execCli(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawnCli(command, args, options);
    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', data => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', data => {
        stderr += data.toString();
      });
    }

    proc.on('error', error => {
      reject(new Error(`Failed to execute ${command}: ${error.message}`));
    });

    proc.on('close', code => {
      resolve({ stdout, stderr, code });
    });
  });
}

/**
 * Check if a CLI command exists on the system
 *
 * @param {string} command - The command to check
 * @returns {Promise<boolean>} True if command exists
 *
 * @example
 * if (await commandExists('claude')) {
 *   console.log('Claude CLI is available');
 * }
 */
export async function commandExists(command) {
  return new Promise(resolve => {
    const checkCommand = isWindows ? 'where' : 'which';
    // Use spawn directly for system commands (where/which)
    const proc = spawn(checkCommand, [command], {
      shell: true,
      windowsHide: isWindows,
      stdio: 'pipe',
    });

    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));
  });
}

export default {
  getCliCommand,
  spawnCli,
  execCli,
  commandExists,
  isWindows,
};
