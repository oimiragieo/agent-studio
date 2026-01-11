#!/usr/bin/env node

/**
 * Configuration Validation Tool for CI/CD Integration
 *
 * Validates consistency across:
 * - Agent definitions (config.yaml vs .md files vs routing matrix)
 * - Skill existence (skill references vs actual skill files)
 * - Schema existence (workflow references vs actual schema files)
 * - Workflow completeness (required steps, agents, schemas)
 * - Tool permissions (orchestrator restrictions)
 *
 * Usage:
 *   node .claude/tools/validate-configuration.mjs [--check <category>] [--format <json|table>]
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Orchestrator agents that should only have delegation tools
const ORCHESTRATOR_AGENTS = ['orchestrator', 'master-orchestrator', 'model-orchestrator'];

// Tools that orchestrators should be allowed to use (delegation only)
const ORCHESTRATOR_ALLOWED_TOOLS = ['Task', 'Read', 'Search', 'Grep', 'Glob'];

/**
 * Load and parse YAML configuration file
 */
function loadConfig() {
  const configPath = join(ROOT_DIR, '.claude', 'config.yaml');
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = readFileSync(configPath, 'utf-8');
  return yaml.load(content);
}

/**
 * Load and parse JSON file
 */
function loadJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get all agent names from config.yaml
 */
function getAgentsFromConfig(config) {
  if (!config.agent_routing) {
    return [];
  }

  return Object.keys(config.agent_routing);
}

/**
 * Get all agent .md files in .claude/agents/
 */
function getAgentFiles() {
  const agentsDir = join(ROOT_DIR, '.claude', 'agents');
  if (!existsSync(agentsDir)) {
    return [];
  }

  return readdirSync(agentsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

/**
 * Get all agents from routing matrix
 */
function getAgentsFromRoutingMatrix() {
  const matrixPath = join(ROOT_DIR, '.claude', 'tools', 'agent-routing-matrix.json');
  const matrix = loadJson(matrixPath);

  if (!matrix || !matrix.taskTypes) {
    return [];
  }

  const agents = new Set();

  for (const taskType of Object.values(matrix.taskTypes)) {
    if (taskType.primary) agents.add(taskType.primary);
    if (taskType.supporting) taskType.supporting.forEach(a => agents.add(a));
    if (taskType.review) taskType.review.forEach(a => agents.add(a));
    if (taskType.approval) taskType.approval.forEach(a => agents.add(a));
  }

  return Array.from(agents);
}

/**
 * Get all workflow files
 */
function getWorkflowFiles() {
  const workflowsDir = join(ROOT_DIR, '.claude', 'workflows');
  if (!existsSync(workflowsDir)) {
    return [];
  }

  return readdirSync(workflowsDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => join(workflowsDir, f));
}

/**
 * Get all agents referenced in workflows
 */
function getAgentsFromWorkflows() {
  const workflowFiles = getWorkflowFiles();
  const agents = new Set();

  for (const workflowPath of workflowFiles) {
    const content = readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(content);

    if (workflow.steps) {
      for (const step of workflow.steps) {
        if (step.agent) {
          agents.add(step.agent);
        }
      }
    }
  }

  return Array.from(agents);
}

/**
 * Validate agent consistency across all sources
 */
function validateAgentConsistency() {
  const config = loadConfig();
  const agentsInConfig = getAgentsFromConfig(config);
  const agentFiles = getAgentFiles();
  const agentsInMatrix = getAgentsFromRoutingMatrix();
  const agentsInWorkflows = getAgentsFromWorkflows();

  const missingInConfig = [];
  const missingFiles = [];
  const extraInConfig = [];
  const missingInMatrix = [];

  // Check that all workflow agents exist in config
  for (const agent of agentsInWorkflows) {
    if (!agentsInConfig.includes(agent)) {
      missingInConfig.push({ agent, source: 'workflows' });
    }
  }

  // Check that all routing matrix agents exist in config
  for (const agent of agentsInMatrix) {
    if (!agentsInConfig.includes(agent)) {
      missingInConfig.push({ agent, source: 'routing-matrix' });
    }
  }

  // Check that all config agents have .md files
  for (const agent of agentsInConfig) {
    if (!agentFiles.includes(agent)) {
      missingFiles.push(agent);
    }
  }

  // Check that all workflow agents are in routing matrix
  for (const agent of agentsInWorkflows) {
    if (!agentsInMatrix.includes(agent) && agent !== 'planner') {
      // planner is exempt from routing matrix
      missingInMatrix.push(agent);
    }
  }

  // Check for agents in config but not referenced anywhere
  const allReferencedAgents = new Set([...agentsInWorkflows, ...agentsInMatrix]);
  for (const agent of agentsInConfig) {
    if (!allReferencedAgents.has(agent) && !['router', 'planner'].includes(agent)) {
      // router and planner are special cases
      extraInConfig.push(agent);
    }
  }

  const valid =
    missingInConfig.length === 0 &&
    missingFiles.length === 0 &&
    missingInMatrix.length === 0 &&
    extraInConfig.length === 0;

  return {
    valid,
    category: 'Agent Consistency',
    missingInConfig,
    missingFiles,
    missingInMatrix,
    extraInConfig,
    stats: {
      totalInConfig: agentsInConfig.length,
      totalFiles: agentFiles.length,
      totalInMatrix: agentsInMatrix.length,
      totalInWorkflows: agentsInWorkflows.length,
    },
  };
}

/**
 * Get all skills referenced in documentation
 */
function getReferencedSkills() {
  const skills = new Set();

  // Check CLAUDE.md for skill references
  const claudeMdPath = join(ROOT_DIR, '.claude', 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    const skillMatches = content.match(/`[\w-]+` skill/g);
    if (skillMatches) {
      skillMatches.forEach(match => {
        const skill = match.match(/`([\w-]+)` skill/)[1];
        skills.add(skill);
      });
    }
  }

  return Array.from(skills);
}

/**
 * Get all skill directories
 */
function getSkillDirectories() {
  const skillsDir = join(ROOT_DIR, '.claude', 'skills');
  if (!existsSync(skillsDir)) {
    return [];
  }

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Validate skill existence
 */
function validateSkillExistence() {
  const referencedSkills = getReferencedSkills();
  const skillDirs = getSkillDirectories();

  const missingSkills = [];
  const missingDocs = [];

  // Check that all referenced skills exist
  for (const skill of referencedSkills) {
    if (!skillDirs.includes(skill)) {
      missingSkills.push(skill);
    }
  }

  // Check that all skill directories have SKILL.md
  for (const skillDir of skillDirs) {
    const skillMdPath = join(ROOT_DIR, '.claude', 'skills', skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      missingDocs.push(skillDir);
    }
  }

  const valid = missingSkills.length === 0 && missingDocs.length === 0;

  return {
    valid,
    category: 'Skill Existence',
    missingSkills,
    missingDocs,
    stats: {
      totalReferenced: referencedSkills.length,
      totalSkills: skillDirs.length,
    },
  };
}

/**
 * Get all schemas referenced in workflows
 */
function getSchemasFromWorkflows() {
  const workflowFiles = getWorkflowFiles();
  const schemas = new Set();
  const workflowsAffected = [];

  for (const workflowPath of workflowFiles) {
    const content = readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(content);
    const workflowName = workflowPath.split('/').pop().replace('.yaml', '');

    if (workflow.steps) {
      for (const step of workflow.steps) {
        if (step.validation && step.validation.schema) {
          const schemaPath = step.validation.schema;
          schemas.add(schemaPath);

          const schemaFile = schemaPath.replace('.claude/schemas/', '');
          const fullPath = join(ROOT_DIR, schemaPath);

          if (!existsSync(fullPath)) {
            workflowsAffected.push({
              workflow: workflowName,
              step: step.step,
              schema: schemaFile,
            });
          }
        }
      }
    }
  }

  return {
    schemas: Array.from(schemas),
    workflowsAffected,
  };
}

/**
 * Validate schema existence
 */
function validateSchemaExistence() {
  const { schemas, workflowsAffected } = getSchemasFromWorkflows();

  const missingSchemas = [];

  for (const schemaPath of schemas) {
    const fullPath = join(ROOT_DIR, schemaPath);
    if (!existsSync(fullPath)) {
      const schemaFile = schemaPath.replace('.claude/schemas/', '');
      missingSchemas.push(schemaFile);
    }
  }

  const valid = missingSchemas.length === 0;

  return {
    valid,
    category: 'Schema Existence',
    missingSchemas,
    workflowsAffected,
    stats: {
      totalSchemas: schemas.length,
      totalMissing: missingSchemas.length,
    },
  };
}

/**
 * Validate workflow completeness
 */
function validateWorkflowCompleteness() {
  const workflowFiles = getWorkflowFiles();
  const incompleteWorkflows = [];
  const stepsWithoutAgents = [];
  const stepsWithoutSchemas = [];

  for (const workflowPath of workflowFiles) {
    const content = readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(content);
    const workflowName = workflowPath.split('/').pop().replace('.yaml', '');

    // Check for planner at step 0
    if (workflow.steps && workflow.steps.length > 0) {
      const step0 = workflow.steps[0];
      if (step0.step !== 0 || step0.agent !== 'planner') {
        incompleteWorkflows.push({
          workflow: workflowName,
          issue: 'Missing planner at step 0',
        });
      }
    } else {
      incompleteWorkflows.push({
        workflow: workflowName,
        issue: 'No steps defined',
      });
    }

    // Check that all steps have agents
    if (workflow.steps) {
      for (const step of workflow.steps) {
        if (!step.agent) {
          stepsWithoutAgents.push({
            workflow: workflowName,
            step: step.step,
          });
        }

        // Check that steps with outputs have schemas (unless explicitly exempted)
        if (step.outputs && step.outputs.length > 0 && !step.validation) {
          // Some steps may not need validation (e.g., reasoning files)
          const hasOnlyReasoning = step.outputs.every(o => o.includes('reasoning'));
          if (!hasOnlyReasoning) {
            stepsWithoutSchemas.push({
              workflow: workflowName,
              step: step.step,
              agent: step.agent,
            });
          }
        }
      }
    }
  }

  const valid =
    incompleteWorkflows.length === 0 &&
    stepsWithoutAgents.length === 0 &&
    stepsWithoutSchemas.length === 0;

  return {
    valid,
    category: 'Workflow Completeness',
    incompleteWorkflows,
    stepsWithoutAgents,
    stepsWithoutSchemas,
    stats: {
      totalWorkflows: workflowFiles.length,
      totalIssues:
        incompleteWorkflows.length + stepsWithoutAgents.length + stepsWithoutSchemas.length,
    },
  };
}

/**
 * Validate tool permissions for orchestrator agents
 */
function validateToolPermissions() {
  const config = loadConfig();
  const violations = [];

  if (!config.tool_restrictions) {
    return {
      valid: true,
      category: 'Tool Permissions',
      violations: [],
      stats: { totalAgents: 0 },
    };
  }

  for (const agent of ORCHESTRATOR_AGENTS) {
    const restrictions = config.tool_restrictions[agent];

    if (!restrictions) {
      violations.push({
        agent,
        issue: 'No tool restrictions defined',
        severity: 'high',
      });
      continue;
    }

    // Check allowed tools
    if (restrictions.allowed_tools) {
      const disallowedTools = restrictions.allowed_tools.filter(
        tool => !ORCHESTRATOR_ALLOWED_TOOLS.includes(tool)
      );

      if (disallowedTools.length > 0) {
        violations.push({
          agent,
          issue: `Orchestrator has disallowed tools: ${disallowedTools.join(', ')}`,
          severity: 'critical',
          tools: disallowedTools,
        });
      }
    }

    // Check that Edit, Write, Bash are restricted
    const criticalTools = ['Edit', 'Write', 'Bash'];
    const restrictedTools = restrictions.restricted_tools || [];

    for (const tool of criticalTools) {
      const isRestricted = restrictedTools.some(r => r.includes(tool));
      const isAllowed =
        restrictions.allowed_tools && restrictions.allowed_tools.some(t => t.includes(tool));

      if (!isRestricted || isAllowed) {
        violations.push({
          agent,
          issue: `Orchestrator should not have access to ${tool}`,
          severity: 'critical',
          tool,
        });
      }
    }
  }

  const valid = violations.length === 0;

  return {
    valid,
    category: 'Tool Permissions',
    violations,
    stats: {
      totalAgents: ORCHESTRATOR_AGENTS.length,
      totalViolations: violations.length,
    },
  };
}

/**
 * Format validation result as table
 */
function formatTable(result) {
  const { valid, category } = result;

  const status = valid
    ? `${COLORS.green}✓ PASS${COLORS.reset}`
    : `${COLORS.red}✗ FAIL${COLORS.reset}`;

  console.log(`\n${COLORS.bold}${category}${COLORS.reset}: ${status}`);
  console.log('─'.repeat(80));

  if (valid) {
    console.log(`${COLORS.green}All checks passed${COLORS.reset}`);
    if (result.stats) {
      for (const [key, value] of Object.entries(result.stats)) {
        console.log(`  ${key}: ${value}`);
      }
    }
    return;
  }

  // Display issues
  const issueFields = Object.keys(result).filter(
    k =>
      !['valid', 'category', 'stats'].includes(k) &&
      Array.isArray(result[k]) &&
      result[k].length > 0
  );

  for (const field of issueFields) {
    console.log(`\n${COLORS.yellow}${field}:${COLORS.reset}`);

    const items = result[field];
    if (items.length === 0) continue;

    if (typeof items[0] === 'string') {
      items.forEach(item => console.log(`  - ${item}`));
    } else {
      items.forEach(item => {
        const itemStr = JSON.stringify(item, null, 2)
          .split('\n')
          .map((line, i) => (i === 0 ? `  - ${line}` : `    ${line}`))
          .join('\n');
        console.log(itemStr);
      });
    }
  }

  if (result.stats) {
    console.log(`\n${COLORS.cyan}Statistics:${COLORS.reset}`);
    for (const [key, value] of Object.entries(result.stats)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

/**
 * Format validation result as JSON
 */
function formatJson(result) {
  return JSON.stringify(result, null, 2);
}

/**
 * Run all validations
 */
async function validateAllConfiguration(options = {}) {
  const { check, format = 'table' } = options;

  const validations = {
    agents: validateAgentConsistency,
    skills: validateSkillExistence,
    schemas: validateSchemaExistence,
    workflows: validateWorkflowCompleteness,
    permissions: validateToolPermissions,
  };

  const results = [];
  let allValid = true;

  if (check) {
    // Run specific validation
    if (!validations[check]) {
      console.error(`${COLORS.red}Unknown check: ${check}${COLORS.reset}`);
      console.error(`Available checks: ${Object.keys(validations).join(', ')}`);
      process.exit(1);
    }

    const result = validations[check]();
    results.push(result);
    allValid = result.valid;
  } else {
    // Run all validations
    for (const [name, validator] of Object.entries(validations)) {
      const result = validator();
      results.push(result);
      allValid = allValid && result.valid;
    }
  }

  // Output results
  if (format === 'json') {
    console.log(JSON.stringify({ results, allValid }, null, 2));
  } else {
    console.log(`\n${COLORS.bold}${COLORS.cyan}Configuration Validation Report${COLORS.reset}`);
    console.log('='.repeat(80));

    for (const result of results) {
      formatTable(result);
    }

    console.log('\n' + '='.repeat(80));

    if (allValid) {
      console.log(`${COLORS.bold}${COLORS.green}✓ All validations passed${COLORS.reset}\n`);
    } else {
      console.log(`${COLORS.bold}${COLORS.red}✗ Some validations failed${COLORS.reset}\n`);

      // Summary of failures
      const failedCategories = results.filter(r => !r.valid).map(r => r.category);
      console.log(`${COLORS.red}Failed categories:${COLORS.reset}`);
      failedCategories.forEach(cat => console.log(`  - ${cat}`));
      console.log();
    }
  }

  // Exit with appropriate code for CI/CD
  process.exit(allValid ? 0 : 1);
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--check' && i + 1 < args.length) {
      options.check = args[i + 1];
      i++;
    } else if (arg === '--format' && i + 1 < args.length) {
      options.format = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Configuration Validation Tool

Usage:
  node .claude/tools/validate-configuration.mjs [options]

Options:
  --check <category>    Run specific validation (agents, skills, schemas, workflows, permissions)
  --format <format>     Output format (table, json) [default: table]
  --help, -h            Show this help message

Examples:
  # Run all validations
  node .claude/tools/validate-configuration.mjs

  # Run specific validation
  node .claude/tools/validate-configuration.mjs --check agents

  # Output as JSON
  node .claude/tools/validate-configuration.mjs --format json
      `);
      process.exit(0);
    }
  }

  return options;
}

// Main execution - always run when called directly
const options = parseArgs();
await validateAllConfiguration(options);

export {
  validateAgentConsistency,
  validateSkillExistence,
  validateSchemaExistence,
  validateWorkflowCompleteness,
  validateToolPermissions,
  validateAllConfiguration,
};
