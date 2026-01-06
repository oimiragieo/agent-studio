#!/usr/bin/env node
/**
 * User-facing CUJ execution wrapper
 * Usage:
 *   node .claude/tools/run-cuj.mjs CUJ-005
 *   node .claude/tools/run-cuj.mjs --list
 *   node .claude/tools/run-cuj.mjs --simulate CUJ-005
 *   node .claude/tools/run-cuj.mjs --validate CUJ-005
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, '../context/cuj-registry.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

function listCUJs() {
  const registry = loadRegistry();
  console.log('\nAvailable CUJs:\n');
  console.log('| ID | Name | Mode | Workflow |');
  console.log('|----|------|------|----------|');
  for (const cuj of registry.cujs) {
    console.log(`| ${cuj.id} | ${cuj.name} | ${cuj.execution_mode} | ${cuj.workflow || '-'} |`);
  }
}

function simulateCUJ(cujId) {
  const registry = loadRegistry();
  const cuj = registry.cujs.find(c => c.id === cujId);
  if (!cuj) {
    console.error(`CUJ ${cujId} not found`);
    process.exit(1);
  }

  console.log(`\nSimulating ${cujId}: ${cuj.name}\n`);

  const child = spawn('node', [
    path.join(__dirname, 'workflow_runner.js'),
    '--cuj-simulation',
    cujId
  ], { stdio: 'inherit' });

  child.on('exit', code => process.exit(code));
}

function validateCUJ(cujId) {
  console.log(`\nValidating ${cujId}...\n`);

  const child = spawn('node', [
    path.join(__dirname, 'validate-cuj-e2e.mjs'),
    '--cuj',
    cujId,
    '--json'
  ], { stdio: 'inherit' });

  child.on('exit', code => process.exit(code));
}

function runCUJ(cujId) {
  const registry = loadRegistry();
  const cuj = registry.cujs.find(c => c.id === cujId);
  if (!cuj) {
    console.error(`CUJ ${cujId} not found`);
    process.exit(1);
  }

  if (!cuj.workflow) {
    console.log(`${cujId} is ${cuj.execution_mode} - no workflow to run`);
    console.log('Use --simulate to test or invoke the skill directly');
    return;
  }

  console.log(`\nRunning ${cujId}: ${cuj.name}`);
  console.log(`Workflow: ${cuj.workflow}\n`);

  const child = spawn('node', [
    path.join(__dirname, 'workflow_runner.js'),
    '--workflow',
    path.join(__dirname, '../workflows', cuj.workflow),
    '--id',
    `${cujId}-${Date.now()}`
  ], { stdio: 'inherit' });

  child.on('exit', code => process.exit(code));
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log(`
CUJ Command Wrapper

Usage:
  run-cuj.mjs <CUJ-ID>           Run a CUJ workflow
  run-cuj.mjs --list             List all available CUJs
  run-cuj.mjs --simulate <ID>    Simulate CUJ execution (dry run)
  run-cuj.mjs --validate <ID>    Validate CUJ structure

Examples:
  node .claude/tools/run-cuj.mjs CUJ-005
  node .claude/tools/run-cuj.mjs --list
  node .claude/tools/run-cuj.mjs --simulate CUJ-034
  `);
  process.exit(0);
}

if (args[0] === '--list') {
  listCUJs();
} else if (args[0] === '--simulate') {
  simulateCUJ(args[1]);
} else if (args[0] === '--validate') {
  validateCUJ(args[1]);
} else {
  runCUJ(args[0]);
}
