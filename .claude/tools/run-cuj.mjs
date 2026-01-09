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
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execPromise = promisify(exec);
const registryPath = path.join(__dirname, '../context/cuj-registry.json');
const projectRoot = path.join(__dirname, '../..');
const analyticsPath = path.join(__dirname, '../context/analytics/cuj-performance.json');

function loadRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

/**
 * Find skill path in both Agent Studio and Codex locations
 * @param {string} skillName - Name of the skill
 * @returns {Object|null} - { path, type } or null if not found
 */
function findSkillPath(skillName) {
  const agentStudioPath = path.join(projectRoot, '.claude/skills', skillName, 'SKILL.md');
  const codexPath = path.join(projectRoot, 'codex-skills', skillName, 'SKILL.md');

  if (fs.existsSync(agentStudioPath)) {
    return { path: agentStudioPath, type: 'agent-studio' };
  }
  if (fs.existsSync(codexPath)) {
    return { path: codexPath, type: 'codex' };
  }
  return null;
}

/**
 * Check if a CLI tool is available
 * @param {string} cli - CLI tool name (e.g., 'claude', 'gemini')
 * @returns {Promise<Object>} - { available: boolean, version?: string, error?: string }
 */
async function checkCliAvailability(cli) {
  try {
    // Windows-friendly: use shell: true to handle .cmd shims
    const result = await execPromise(`${cli} --version`, {
      timeout: 5000,
      shell: true,
      windowsHide: true
    });
    return {
      available: true,
      version: result.stdout.trim() || result.stderr.trim()
    };
  } catch (error) {
    return {
      available: false,
      error: error.code === 'ENOENT'
        ? `${cli} command not found`
        : error.message
    };
  }
}

/**
 * Pre-flight check before CUJ execution
 * Validates workflow, agents, schemas, artifacts, and skills
 */
async function preflightCheck(cuj) {
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

      // 5. Verify skill availability (basic YAML parsing) - check both locations
      const skillMatches = workflowContent.matchAll(/skill:\s+([a-z-]+)/g);
      const skills = [...skillMatches].map(m => m[1]);

      for (const skill of skills) {
        const skillInfo = findSkillPath(skill);
        if (!skillInfo) {
          errors.push(`Skill not found: ${skill} (referenced in workflow ${cuj.workflow}). Expected in .claude/skills/ (Agent Studio) or codex-skills/ (Codex CLI).`);
        } else {
          // Log skill type for informational purposes
          if (skillInfo.type === 'codex') {
            warnings.push(`Skill ${skill} is a Codex CLI skill. Ensure required CLI tools (claude, gemini) are installed.`);
          }
        }
      }
    }
  }

  // For skill-only CUJs, verify primary skill exists - check both locations
  if (cuj.execution_mode === 'skill-only' && cuj.primary_skill) {
    const skillInfo = findSkillPath(cuj.primary_skill);
    if (!skillInfo) {
      errors.push(`Primary skill not found: ${cuj.primary_skill}. Expected in .claude/skills/ (Agent Studio) or codex-skills/ (Codex CLI).`);
    } else if (skillInfo.type === 'codex') {
      warnings.push(`Primary skill ${cuj.primary_skill} is a Codex CLI skill. Ensure required CLI tools (claude, gemini) are installed.`);
    }
  }

  // Check CLI availability for Codex skills
  const usesCodexSkills = cuj.skill_type === 'codex' ||
    cuj.uses_codex_skills ||
    (cuj.primary_skill && findSkillPath(cuj.primary_skill)?.type === 'codex');

  if (usesCodexSkills) {
    const claudeCli = await checkCliAvailability('claude');
    const geminiCli = await checkCliAvailability('gemini');

    if (!claudeCli.available) {
      warnings.push(`⚠️  Claude CLI not available: ${claudeCli.error}. Multi-AI review may fail.`);
      warnings.push(`   Install: npm install -g @anthropic-ai/claude-cli`);
    } else {
      warnings.push(`✓ Claude CLI available: ${claudeCli.version}`);
    }

    if (!geminiCli.available) {
      warnings.push(`⚠️  Gemini CLI not available: ${geminiCli.error}. Multi-AI review may be limited.`);
      warnings.push(`   Install: npm install -g @google/generative-ai-cli`);
    } else {
      warnings.push(`✓ Gemini CLI available: ${geminiCli.version}`);
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

async function runCUJ(cujId) {
  const registry = loadRegistry();
  const cuj = registry.cujs.find(c => c.id === cujId);
  if (!cuj) {
    console.error(`CUJ ${cujId} not found`);
    process.exit(1);
  }

  // Run pre-flight check
  console.log(`\n🔍 Pre-flight check for ${cujId}...\n`);
  const preflightResult = await preflightCheck(cuj);

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
