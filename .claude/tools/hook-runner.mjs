#!/usr/bin/env node
/**
 * Cross-Platform Hook Runner
 * 
 * Executes hooks in a cross-platform way (Node.js/PowerShell)
 * Replaces Bash/jq dependencies for Windows compatibility
 * 
 * Usage:
 *   node .claude/tools/hook-runner.mjs --hook <hook-name> [--args <json>]
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOOKS_DIR = join(__dirname, '..', 'hooks');

/**
 * Detect platform
 */
function getPlatform() {
  const platform = process.platform;
  if (platform === 'win32') {
    return 'windows';
  } else if (platform === 'darwin') {
    return 'macos';
  } else {
    return 'linux';
  }
}

/**
 * Execute hook (cross-platform)
 * @param {string} hookName - Hook name
 * @param {Object} args - Hook arguments
 * @returns {Promise<Object>} Hook result
 */
export async function executeHook(hookName, args = {}) {
  const platform = getPlatform();
  const hookPath = join(HOOKS_DIR, `${hookName}.mjs`);
  
  // Check if hook exists
  if (!existsSync(hookPath)) {
    // Try platform-specific hook
    const platformHookPath = join(HOOKS_DIR, `${hookName}.${platform}.mjs`);
    if (existsSync(platformHookPath)) {
      return await executePlatformHook(platformHookPath, args, platform);
    }
    
    throw new Error(`Hook not found: ${hookName}`);
  }
  
  // Execute Node.js hook (cross-platform)
  try {
    const hookModule = await import(`file://${hookPath}`);
    
    if (typeof hookModule.default === 'function') {
      return await hookModule.default(args);
    } else if (typeof hookModule.execute === 'function') {
      return await hookModule.execute(args);
    } else {
      throw new Error(`Hook ${hookName} does not export default function or execute function`);
    }
  } catch (error) {
    throw new Error(`Failed to execute hook ${hookName}: ${error.message}`);
  }
}

/**
 * Execute platform-specific hook
 */
async function executePlatformHook(hookPath, args, platform) {
  if (platform === 'windows') {
    // Execute PowerShell hook
    const psScript = await readFile(hookPath, 'utf-8');
    const psArgs = JSON.stringify(args);
    const command = `powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/\$args/g, psArgs)}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        output: stdout,
        error: stderr || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || null
      };
    }
  } else {
    // Execute Node.js hook for other platforms
    const hookModule = await import(`file://${hookPath}`);
    if (typeof hookModule.default === 'function') {
      return await hookModule.default(args);
    } else if (typeof hookModule.execute === 'function') {
      return await hookModule.execute(args);
    }
  }
}

/**
 * List available hooks
 */
export async function listHooks() {
  if (!existsSync(HOOKS_DIR)) {
    return [];
  }
  
  const { readdir } = await import('fs/promises');
  const files = await readdir(HOOKS_DIR);
  
  return files
    .filter(file => file.endsWith('.mjs') || file.endsWith('.ps1'))
    .map(file => file.replace(/\.(mjs|ps1)$/, ''));
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const hookIndex = args.indexOf('--hook');
  const argsIndex = args.indexOf('--args');
  
  if (hookIndex === -1) {
    console.error('Usage: node hook-runner.mjs --hook <hook-name> [--args <json>]');
    console.error('       node hook-runner.mjs --list');
    process.exit(1);
  }
  
  if (args[hookIndex + 1] === '--list' || args.includes('--list')) {
    const hooks = await listHooks();
    console.log(JSON.stringify(hooks, null, 2));
    return;
  }
  
  const hookName = args[hookIndex + 1];
  let hookArgs = {};
  
  if (argsIndex !== -1 && argsIndex < args.length - 1) {
    try {
      hookArgs = JSON.parse(args[argsIndex + 1]);
    } catch (error) {
      console.error(`Invalid JSON in --args: ${error.message}`);
      process.exit(1);
    }
  }
  
  try {
    const result = await executeHook(hookName, hookArgs);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Hook execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  executeHook,
  listHooks
};

