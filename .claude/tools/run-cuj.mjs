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
const projectRoot = path.join(__dirname, '../..');
const analyticsPath = path.join(__dirname, '../context/analytics/cuj-performance.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

/**
 * Pre-flight check before CUJ execution
 * Validates workflow, agents, schemas, artifacts, and skills
 */
function preflightCheck(cuj) {
  const errors = [];
  const warnings = [];

  // 1. Verify workflow file exists (if workflow mode)
  if (cuj.workflow) {
    let workflowPath;
    if (cuj.workflow.startsWith('.claude/workflows/')) {
      workflowPath = path.join(projectRoot, cuj.workflow);
    } else {
      workflowPath = path.join(projectRoot, '.claude/workflows', cuj.workflow);
    }

    if (!fs.existsSync(workflowPath)) {
      errors.push(`Workflow file not found: ${workflowPath}`);
    } else {
      // Parse workflow YAML to check for referenced agents
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

      // Extract agents from workflow (basic YAML parsing)
      const agentMatches = workflowContent.matchAll(/agent:\s+([a-z-]+)/g);
      const agents = [...agentMatches].map(m => m[1]);

      // 2. Check all referenced agents exist
      for (const agent of agents) {
        const agentPath = path.join(projectRoot, '.claude/agents', `${agent}.md`);
        if (!fs.existsSync(agentPath)) {
          errors.push(`Agent not found: ${agent} (referenced in workflow ${cuj.workflow})`);
        }
      }

      // 3. Validate all schemas exist (basic YAML parsing)
      const schemaMatches = workflowContent.matchAll(/schema:\s+([a-z-_.]+\.schema\.json)/g);
      const schemas = [...schemaMatches].map(m => m[1]);

      for (const schema of schemas) {
        const schemaPath = path.join(projectRoot, '.claude/schemas', schema);
        if (!fs.existsSync(schemaPath)) {
          errors.push(`Schema not found: ${schema} (referenced in workflow ${cuj.workflow})`);
        }
      }

      // 4. Check artifact dependencies (basic YAML parsing)
      const artifactMatches = workflowContent.matchAll(/input:\s+([a-z-_]+\.json)/g);
      const artifacts = [...artifactMatches].map(m => m[1]);

      for (const artifact of artifacts) {
        // Artifacts don't exist until runtime, so just warn
        if (artifact !== 'null' && artifact !== 'none') {
          warnings.push(`Workflow requires artifact: ${artifact} (ensure it exists or will be created)`);
        }
      }

      // 5. Verify skill availability (basic YAML parsing)
      const skillMatches = workflowContent.matchAll(/skill:\s+([a-z-]+)/g);
      const skills = [...skillMatches].map(m => m[1]);

      for (const skill of skills) {
        const skillPath = path.join(projectRoot, '.claude/skills', skill, 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          errors.push(`Skill not found: ${skill} (referenced in workflow ${cuj.workflow})`);
        }
      }
    }
  }

  // For skill-only CUJs, verify primary skill exists
  if (cuj.execution_mode === 'skill-only' && cuj.primary_skill) {
    const skillPath = path.join(projectRoot, '.claude/skills', cuj.primary_skill, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      errors.push(`Primary skill not found: ${cuj.primary_skill}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Load performance metrics from analytics file
 */
function loadPerformanceMetrics() {
  if (!fs.existsSync(analyticsPath)) {
    return { runs: [] };
  }
  return JSON.parse(fs.readFileSync(analyticsPath, 'utf-8'));
}

/**
 * Save performance metrics to analytics file
 */
function savePerformanceMetrics(metrics) {
  const dir = path.dirname(analyticsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(analyticsPath, JSON.stringify(metrics, null, 2));
}

/**
 * Record CUJ execution performance
 */
function recordPerformance(cujId, status, duration, agents = [], warnings = []) {
  const metrics = loadPerformanceMetrics();

  metrics.runs.push({
    cuj_id: cujId,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    status,
    agents_used: agents,
    warnings
  });

  savePerformanceMetrics(metrics);
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

  // Run pre-flight check
  console.log(`\n🔍 Pre-flight check for ${cujId}...\n`);
  const preflightResult = preflightCheck(cuj);

  if (preflightResult.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    preflightResult.warnings.forEach(w => console.log(`  - ${w}`));
    console.log('');
  }

  if (!preflightResult.valid) {
    console.error('❌ Pre-flight check failed:\n');
    preflightResult.errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nFix these issues before running the CUJ.');
    process.exit(1);
  }

  console.log('✅ Pre-flight check passed\n');

  if (!cuj.workflow) {
    console.log(`${cujId} is ${cuj.execution_mode} - no workflow to run`);
    console.log('Use --simulate to test or invoke the skill directly');
    return;
  }

  console.log(`\nRunning ${cujId}: ${cuj.name}`);
  console.log(`Workflow: ${cuj.workflow}\n`);

  // Normalize workflow path - avoid double .claude/workflows/ prefix
  let workflowPath;
  if (cuj.workflow.startsWith('.claude/workflows/')) {
    // Already has full path, use as-is
    workflowPath = path.join(__dirname, '..', cuj.workflow.replace('.claude/workflows/', 'workflows/'));
  } else {
    // Just filename, prepend workflows directory
    workflowPath = path.join(__dirname, '../workflows', cuj.workflow);
  }

  // Track execution time
  const startTime = Date.now();

  // Generate unique run ID for this CUJ execution
  const runId = `${cujId}-${Date.now()}`;

  const child = spawn('node', [
    path.join(__dirname, 'workflow_runner.js'),
    '--workflow',
    workflowPath,
    '--run-id',
    runId,
    '--id',
    runId  // Keep --id for backward compatibility
  ], { stdio: 'inherit' });

  child.on('exit', code => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Record performance metrics
    const status = code === 0 ? 'success' : 'failure';
    const warnings = preflightResult.warnings;

    // Extract agents from workflow (basic parsing)
    let agents = [];
    if (fs.existsSync(workflowPath)) {
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const agentMatches = workflowContent.matchAll(/agent:\s+([a-z-]+)/g);
      agents = [...new Set([...agentMatches].map(m => m[1]))]; // Deduplicate
    }

    recordPerformance(cujId, status, duration, agents, warnings);

    console.log(`\n⏱️  Execution completed in ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Performance data saved to ${analyticsPath}`);

    process.exit(code);
  });
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
