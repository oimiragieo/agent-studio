#!/usr/bin/env node
/**
 * CLI Installer
 * Automatically installs and verifies Cursor, Gemini, and Codex CLI tools
 * 
 * Usage:
 *   node scripts/cli-installer.mjs [--cursor] [--gemini] [--codex] [--all]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Check if command exists
 */
async function commandExists(command) {
  try {
    await execAsync(`which ${command}`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install Cursor CLI
 */
async function installCursorCLI() {
  console.log('Checking Cursor CLI...');
  
  if (await commandExists('cursor-agent')) {
    console.log('✓ Cursor CLI already installed');
    return { installed: true, version: await getCursorVersion() };
  }
  
  console.log('Installing Cursor CLI...');
  
  try {
    // Installation instructions vary by platform
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows installation
      console.log('Please install Cursor CLI manually on Windows:');
      console.log('1. Download from https://cursor.sh/docs/cli');
      console.log('2. Add to PATH');
    } else if (platform === 'darwin') {
      // macOS installation
      await execAsync('brew install cursor-agent', { timeout: 60000 });
    } else {
      // Linux installation
      await execAsync('npm install -g @cursor/cli', { timeout: 60000 });
    }
    
    console.log('✓ Cursor CLI installed');
    return { installed: true, version: await getCursorVersion() };
  } catch (error) {
    console.error('✗ Failed to install Cursor CLI:', error.message);
    return { installed: false, error: error.message };
  }
}

/**
 * Get Cursor CLI version
 */
async function getCursorVersion() {
  try {
    const { stdout } = await execAsync('cursor-agent --version', { timeout: 5000 });
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Install Gemini CLI
 */
async function installGeminiCLI() {
  console.log('Checking Gemini CLI...');
  
  if (await commandExists('gemini')) {
    console.log('✓ Gemini CLI already installed');
    return { installed: true, version: await getGeminiVersion() };
  }
  
  console.log('Installing Gemini CLI...');
  
  try {
    // Installation via npm
    await execAsync('npm install -g @google/generative-ai-cli', { timeout: 60000 });
    
    console.log('✓ Gemini CLI installed');
    return { installed: true, version: await getGeminiVersion() };
  } catch (error) {
    console.error('✗ Failed to install Gemini CLI:', error.message);
    return { installed: false, error: error.message };
  }
}

/**
 * Get Gemini CLI version
 */
async function getGeminiVersion() {
  try {
    const { stdout } = await execAsync('gemini --version', { timeout: 5000 });
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Install Codex CLI
 */
async function installCodexCLI() {
  console.log('Checking Codex CLI...');
  
  if (await commandExists('codex')) {
    console.log('✓ Codex CLI already installed');
    return { installed: true, version: await getCodexVersion() };
  }
  
  console.log('Installing Codex CLI...');
  
  try {
    // Installation via npm
    await execAsync('npm install -g @openai/codex-cli', { timeout: 60000 });
    
    console.log('✓ Codex CLI installed');
    return { installed: true, version: await getCodexVersion() };
  } catch (error) {
    console.error('✗ Failed to install Codex CLI:', error.message);
    return { installed: false, error: error.message };
  }
}

/**
 * Get Codex CLI version
 */
async function getCodexVersion() {
  try {
    const { stdout } = await execAsync('codex --version', { timeout: 5000 });
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Verify all CLI tools
 */
async function verifyAllCLIs() {
  const results = {
    cursor: await installCursorCLI(),
    gemini: await installGeminiCLI(),
    codex: await installCodexCLI()
  };
  
  const allInstalled = Object.values(results).every(r => r.installed);
  
  return {
    allInstalled,
    results
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const installAll = args.includes('--all');
  const installCursor = args.includes('--cursor') || installAll;
  const installGemini = args.includes('--gemini') || installAll;
  const installCodex = args.includes('--codex') || installAll;
  
  if (!installCursor && !installGemini && !installCodex) {
    console.log('Usage: node cli-installer.mjs [--cursor] [--gemini] [--codex] [--all]');
    console.log('Verifying all CLI tools...');
    const verification = await verifyAllCLIs();
    console.log('\nVerification Results:');
    console.log(JSON.stringify(verification, null, 2));
    process.exit(verification.allInstalled ? 0 : 1);
  }
  
  const results = {};
  
  if (installCursor) {
    results.cursor = await installCursorCLI();
  }
  
  if (installGemini) {
    results.gemini = await installGeminiCLI();
  }
  
  if (installCodex) {
    results.codex = await installCodexCLI();
  }
  
  console.log('\nInstallation Results:');
  console.log(JSON.stringify(results, null, 2));
  
  const allInstalled = Object.values(results).every(r => r.installed);
  process.exit(allInstalled ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  installCursorCLI,
  installGeminiCLI,
  installCodexCLI,
  verifyAllCLIs
};

