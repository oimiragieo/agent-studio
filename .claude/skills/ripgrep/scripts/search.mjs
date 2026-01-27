#!/usr/bin/env node
/**
 * Ripgrep Search Wrapper
 * ======================
 *
 * Detects platform/architecture and runs the appropriate ripgrep binary
 * with RIPGREP_CONFIG_PATH set to bin/.ripgreprc.
 *
 * Usage:
 *   node search.mjs "pattern" [options]
 *   node search.mjs "pattern" -tjs
 *   node search.mjs "pattern" -i -C 3
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root (where .claude folder is)
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude'))) {
      return dir;
    }
    if (path.basename(dir) === '.claude') {
      return path.dirname(dir);
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const BIN_DIR = path.join(PROJECT_ROOT, 'bin');
const RIPGREPRC = path.join(BIN_DIR, '.ripgreprc');

// Detect platform and architecture
const platform = os.platform();
const arch = os.arch();

// Determine binary name
let binaryName = 'rg';
if (platform === 'win32') {
  binaryName = 'rg.exe';
}

const RG_BINARY = path.join(BIN_DIR, binaryName);

// Verify binary exists
if (!fs.existsSync(RG_BINARY)) {
  console.error(`❌ Ripgrep binary not found at: ${RG_BINARY}`);
  console.error('   Expected location: C:\\dev\\projects\\agent-studio\\bin\\');
  console.error('   Please ensure ripgrep is installed in the bin/ directory.');
  process.exit(1);
}

// Verify config exists
if (!fs.existsSync(RIPGREPRC)) {
  console.warn(`⚠️  Ripgrep config not found at: ${RIPGREPRC}`);
  console.warn('   Ripgrep will use default settings.');
}

// Get search pattern and args from command line
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node search.mjs "pattern" [options]');
  console.error('');
  console.error('Examples:');
  console.error('  node search.mjs "function" -tjs');
  console.error('  node search.mjs "TaskUpdate" -tjs -tts');
  console.error('  node search.mjs "pattern" -i -C 3');
  process.exit(1);
}

// Set environment variable for config
const env = {
  ...process.env,
  RIPGREP_CONFIG_PATH: RIPGREPRC,
};

// Spawn ripgrep with all args passed through
const rg = spawn(RG_BINARY, args, {
  stdio: 'inherit',
  env,
  shell: false, // SECURITY: Prevent shell interpretation
});

rg.on('error', (error) => {
  console.error(`❌ Failed to execute ripgrep: ${error.message}`);
  process.exit(1);
});

rg.on('close', (code) => {
  process.exit(code);
});
