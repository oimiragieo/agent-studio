#!/usr/bin/env node
/**
 * TMPDIR Configuration Script
 *
 * Configures TMPDIR environment variable to prevent Claude Code CLI
 * from creating tmpclaude-* files in the project root.
 *
 * Usage:
 *   node .claude/scripts/configure-tmpdir.mjs [--check|--set|--unset]
 *
 * Options:
 *   --check  - Check current TMPDIR setting (default)
 *   --set    - Set TMPDIR for current session
 *   --unset  - Unset TMPDIR for current session
 */

import { platform, tmpdir, env } from 'os';
import { join } from 'path';

const IS_WINDOWS = platform() === 'win32';
const TEMP_DIR = IS_WINDOWS ? env.TEMP || env.TMP || 'C:\\Windows\\Temp' : tmpdir();

/**
 * Get current TMPDIR value
 */
function getCurrentTmpdir() {
  return env.TMPDIR || env.TEMP || env.TMP || TEMP_DIR;
}

/**
 * Check TMPDIR configuration
 */
function checkTmpdir() {
  const current = getCurrentTmpdir();
  const isSet = !!env.TMPDIR;
  const isCorrect = current === TEMP_DIR;

  console.log('TMPDIR Configuration Status');
  console.log('==========================');
  console.log(`Platform: ${platform()}`);
  console.log(`OS Temp Directory: ${TEMP_DIR}`);
  console.log(`Current TMPDIR: ${current}`);
  console.log(`TMPDIR explicitly set: ${isSet ? 'Yes' : 'No'}`);
  console.log(`Using OS temp: ${isCorrect ? 'Yes ✓' : 'No ✗'}`);
  console.log('');

  if (!isCorrect) {
    console.log('⚠️  TMPDIR is not set to OS temp directory.');
    console.log('   Claude Code CLI may create tmpclaude-* files in project root.');
    console.log('');
    console.log('To fix for current session:');
    if (IS_WINDOWS) {
      console.log('  $env:TMPDIR = $env:TEMP');
    } else {
      console.log('  export TMPDIR=/tmp');
    }
    console.log('');
    console.log('To fix permanently, see: .claude/docs/TMPDIR_CONFIGURATION.md');
  } else {
    console.log('✓ TMPDIR is correctly configured.');
    console.log('  Claude Code CLI will use OS temp directory.');
  }
}

/**
 * Set TMPDIR for current session
 */
function setTmpdir() {
  if (IS_WINDOWS) {
    console.log('For Windows PowerShell:');
    console.log(`  $env:TMPDIR = "${TEMP_DIR}"`);
    console.log('');
    console.log('For Windows CMD:');
    console.log(`  set TMPDIR=${TEMP_DIR}`);
    console.log('');
    console.log('Note: This only affects the current session.');
    console.log('For permanent configuration, see: .claude/docs/TMPDIR_CONFIGURATION.md');
  } else {
    console.log('Run this command in your shell:');
    console.log(`  export TMPDIR="${TEMP_DIR}"`);
    console.log('');
    console.log('To make it permanent, add to your shell profile:');
    console.log(`  echo 'export TMPDIR="${TEMP_DIR}"' >> ~/.bashrc  # or ~/.zshrc`);
    console.log('');
    console.log('For more details, see: .claude/docs/TMPDIR_CONFIGURATION.md');
  }
}

/**
 * Unset TMPDIR
 */
function unsetTmpdir() {
  if (IS_WINDOWS) {
    console.log('For Windows PowerShell:');
    console.log('  Remove-Item Env:\\TMPDIR');
    console.log('');
    console.log('For Windows CMD:');
    console.log('  set TMPDIR=');
  } else {
    console.log('Run this command in your shell:');
    console.log('  unset TMPDIR');
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--check';

  switch (command) {
    case '--check':
      checkTmpdir();
      break;
    case '--set':
      setTmpdir();
      break;
    case '--unset':
      unsetTmpdir();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('');
      console.error('Usage: node .claude/scripts/configure-tmpdir.mjs [--check|--set|--unset]');
      process.exit(1);
  }
}

main();
