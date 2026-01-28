#!/usr/bin/env node
/**
 * Quick Search Presets for Ripgrep
 * =================================
 *
 * Provides preset-based searches for common patterns.
 *
 * Usage:
 *   node quick-search.mjs <preset> "pattern" [extra-options]
 *
 * Presets:
 *   js       - JavaScript files (.js, .mjs, .cjs)
 *   ts       - TypeScript files (.ts, .mts, .cts)
 *   mjs      - ES modules only (.mjs)
 *   cjs      - CommonJS modules only (.cjs)
 *   hooks    - .claude/hooks/ directory
 *   skills   - .claude/skills/ directory
 *   tools    - .claude/tools/ directory
 *   agents   - .claude/agents/ directory
 *   all      - All files (no filter)
 *
 * Examples:
 *   node quick-search.mjs js "function"
 *   node quick-search.mjs hooks "PreToolUse"
 *   node quick-search.mjs ts "interface" -i
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

// Detect platform
const platform = os.platform();
let binaryName = 'rg';
if (platform === 'win32') {
  binaryName = 'rg.exe';
}

const RG_BINARY = path.join(BIN_DIR, binaryName);

// Verify binary exists
if (!fs.existsSync(RG_BINARY)) {
  console.error(`❌ Ripgrep binary not found at: ${RG_BINARY}`);
  console.error('   Expected location: C:\\dev\\projects\\agent-studio\\bin\\');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node quick-search.mjs <preset> "pattern" [extra-options]');
  console.error('');
  console.error('Presets:');
  console.error('  js       - JavaScript files (.js, .mjs, .cjs)');
  console.error('  ts       - TypeScript files (.ts, .mts, .cts)');
  console.error('  mjs      - ES modules only (.mjs)');
  console.error('  cjs      - CommonJS modules only (.cjs)');
  console.error('  hooks    - .claude/hooks/ directory');
  console.error('  skills   - .claude/skills/ directory');
  console.error('  tools    - .claude/tools/ directory');
  console.error('  agents   - .claude/agents/ directory');
  console.error('  all      - All files (no filter)');
  console.error('');
  console.error('Examples:');
  console.error('  node quick-search.mjs js "function"');
  console.error('  node quick-search.mjs hooks "PreToolUse"');
  console.error('  node quick-search.mjs ts "interface" -i');
  process.exit(1);
}

const preset = args[0];
const pattern = args[1];
const extraArgs = args.slice(2);

// Map presets to ripgrep arguments
const presets = {
  js: ['-tjs'],
  ts: ['-tts'],
  mjs: ['-g', '*.mjs'],
  cjs: ['-g', '*.cjs'],
  mts: ['-g', '*.mts'],
  cts: ['-g', '*.cts'],
  hooks: ['-g', '.claude/hooks/**'],
  skills: ['-g', '.claude/skills/**'],
  tools: ['-g', '.claude/tools/**'],
  agents: ['-g', '.claude/agents/**'],
  all: [],
};

if (!presets[preset]) {
  console.error(`❌ Unknown preset: ${preset}`);
  console.error('   Valid presets: ' + Object.keys(presets).join(', '));
  process.exit(1);
}

// Build final args: [pattern, ...preset-args, ...extra-args]
const rgArgs = [pattern, ...presets[preset], ...extraArgs];

// Set environment variable for config
const env = {
  ...process.env,
  RIPGREP_CONFIG_PATH: RIPGREPRC,
};

// Spawn ripgrep
const rg = spawn(RG_BINARY, rgArgs, {
  stdio: 'inherit',
  env,
  shell: false, // SECURITY: Prevent shell interpretation
});

rg.on('error', error => {
  console.error(`❌ Failed to execute ripgrep: ${error.message}`);
  process.exit(1);
});

rg.on('close', code => {
  process.exit(code);
});
