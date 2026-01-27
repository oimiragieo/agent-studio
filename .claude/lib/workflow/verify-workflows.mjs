#!/usr/bin/env node
/**
 * Workflow Verification Script
 * Validates all workflows in the .claude/workflows/ directory
 *
 * Checks:
 * - Agent references exist
 * - Skill references exist
 * - Required sections present
 * - Registry alignment
 * - CLAUDE.md references for core workflows
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const WORKFLOWS_DIR = join(PROJECT_ROOT, '.claude', 'workflows');
const AGENTS_DIR = join(PROJECT_ROOT, '.claude', 'agents');
const SKILLS_DIR = join(PROJECT_ROOT, '.claude', 'skills');
const REGISTRY_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'artifacts',
  'creator-registry.json'
);
const CLAUDE_MD_PATH = join(PROJECT_ROOT, '.claude', 'CLAUDE.md');

let errors = [];
let warnings = [];
let info = [];

/**
 * Recursively find all workflow markdown files
 */
function findWorkflows(dir) {
  let workflows = [];

  if (!existsSync(dir)) {
    errors.push(`Workflows directory not found: ${dir}`);
    return workflows;
  }

  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      workflows = workflows.concat(findWorkflows(fullPath));
    } else if (item.name.endsWith('.md')) {
      workflows.push(fullPath);
    }
  }
  return workflows;
}

/**
 * Extract agent references from workflow content
 * Matches patterns like .claude/agents/core/developer.md
 */
function extractAgentRefs(content) {
  const agentPattern = /\.claude\/agents\/[a-z]+\/[a-z0-9-]+\.md/g;
  return [...new Set(content.match(agentPattern) || [])];
}

/**
 * Extract skill references from workflow content
 * Matches patterns like Skill({ skill: "tdd" }) or Skill({ skill: 'debugging' })
 */
function extractSkillRefs(content) {
  const skillPattern = /Skill\(\{\s*skill:\s*["']([^"']+)["']/g;
  const skills = [];
  let match;
  while ((match = skillPattern.exec(content)) !== null) {
    skills.push(match[1]);
  }
  return [...new Set(skills)];
}

/**
 * Extract agent names mentioned in spawn prompts
 * Matches patterns like "You are DEVELOPER" or "You are the PLANNER agent"
 */
function extractAgentMentions(content) {
  const mentionPattern = /You are (?:the )?([A-Z][A-Z0-9-]+)(?: agent)?/g;
  const mentions = [];
  let match;
  while ((match = mentionPattern.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  return [...new Set(mentions)];
}

/**
 * Get workflow category from its path
 */
function getWorkflowCategory(workflowPath) {
  const relativePath = relative(WORKFLOWS_DIR, workflowPath);
  const parts = relativePath.split(/[/\\]/);
  if (parts.length > 1) {
    return parts[0];
  }
  return 'root';
}

/**
 * Validate a single workflow file
 */
function validateWorkflow(workflowPath) {
  const content = readFileSync(workflowPath, 'utf-8');
  const relativePath = relative(PROJECT_ROOT, workflowPath).replace(/\\/g, '/');
  const category = getWorkflowCategory(workflowPath);

  console.log(`\nValidating: ${relativePath}`);
  console.log(`  Category: ${category}`);

  // Check agent references (explicit paths)
  const agentRefs = extractAgentRefs(content);
  if (agentRefs.length > 0) {
    console.log(`  Agent refs: ${agentRefs.length}`);
    for (const ref of agentRefs) {
      const fullPath = join(PROJECT_ROOT, ref);
      if (!existsSync(fullPath)) {
        errors.push(`${relativePath}: Agent not found: ${ref}`);
      }
    }
  }

  // Check agent mentions (spawn prompts)
  const agentMentions = extractAgentMentions(content);
  if (agentMentions.length > 0) {
    console.log(`  Agent mentions: ${agentMentions.join(', ')}`);
  }

  // Check skill references
  const skillRefs = extractSkillRefs(content);
  if (skillRefs.length > 0) {
    console.log(`  Skill refs: ${skillRefs.length}`);
    for (const skill of skillRefs) {
      // Handle nested skills like "scientific-skills/rdkit"
      const skillName = skill.split('/')[0];
      const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');
      if (!existsSync(skillPath)) {
        warnings.push(`${relativePath}: Skill not found: ${skill}`);
      }
    }
  }

  // Check for required sections
  const hasTitle = content.match(/^#\s+.+/m);
  const hasHeaders = content.match(/^##\s+.+/m);

  if (!hasTitle) {
    warnings.push(`${relativePath}: No title (# heading) found`);
  }

  if (!hasHeaders) {
    warnings.push(`${relativePath}: No section headers (## headings) found`);
  }

  // Check for workflow-specific sections
  const hasPhases = content.toLowerCase().includes('phase');
  const hasSteps = content.toLowerCase().includes('step');
  const hasAgentSection = content.toLowerCase().includes('agent');

  if (!hasPhases && !hasSteps) {
    info.push(`${relativePath}: No phases or steps structure detected`);
  }

  if (!hasAgentSection && agentRefs.length === 0 && agentMentions.length === 0) {
    info.push(`${relativePath}: No agent references found - may not be a multi-agent workflow`);
  }

  return {
    path: relativePath,
    category,
    agentRefs,
    agentMentions,
    skillRefs,
    hasPhases,
    hasSteps,
  };
}

/**
 * Check registry alignment with actual workflow files
 */
function checkRegistry(workflowPaths) {
  if (!existsSync(REGISTRY_PATH)) {
    errors.push('creator-registry.json not found');
    return;
  }

  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  const registryCount = registry.summary?.totalWorkflows || 0;
  const actualCount = workflowPaths.length;

  console.log(`\n=== Registry Check ===`);
  console.log(`Registry workflow count: ${registryCount}`);
  console.log(`Actual workflow count: ${actualCount}`);

  if (registryCount !== actualCount) {
    errors.push(
      `Registry workflow count mismatch: registry=${registryCount}, actual=${actualCount}`
    );
  }

  // Check if each workflow is in registry
  const registryWorkflows = (registry.workflows || []).map(w => w.path);

  for (const workflowPath of workflowPaths) {
    const relativePath =
      '.claude/' + relative(join(PROJECT_ROOT, '.claude'), workflowPath).replace(/\\/g, '/');
    if (!registryWorkflows.includes(relativePath)) {
      warnings.push(`Workflow not in registry: ${relativePath}`);
    }
  }

  // Check if registry has workflows that don't exist
  for (const regWorkflow of registryWorkflows) {
    const fullPath = join(PROJECT_ROOT, regWorkflow);
    if (!existsSync(fullPath)) {
      errors.push(`Registry references non-existent workflow: ${regWorkflow}`);
    }
  }
}

/**
 * Check CLAUDE.md references for important workflows
 */
function checkClaudeMd(workflowResults) {
  if (!existsSync(CLAUDE_MD_PATH)) {
    errors.push('CLAUDE.md not found');
    return;
  }

  const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');

  console.log(`\n=== CLAUDE.md Check ===`);

  // Core and enterprise workflows should be referenced
  const importantCategories = ['core', 'enterprise', 'operations'];

  for (const result of workflowResults) {
    if (importantCategories.includes(result.category)) {
      const filename = result.path.split('/').pop();
      const workflowName = filename.replace('.md', '');

      // Check if workflow path or name is mentioned
      if (!content.includes(result.path) && !content.includes(workflowName)) {
        warnings.push(`CLAUDE.md missing reference to ${result.category} workflow: ${filename}`);
      } else {
        console.log(`  Found: ${filename}`);
      }
    }
  }
}

/**
 * Generate summary statistics
 */
function generateSummary(workflowResults) {
  console.log(`\n=== Workflow Summary ===`);

  // Group by category
  const byCategory = {};
  for (const result of workflowResults) {
    byCategory[result.category] = byCategory[result.category] || [];
    byCategory[result.category].push(result);
  }

  for (const [category, workflows] of Object.entries(byCategory)) {
    console.log(`  ${category}: ${workflows.length} workflow(s)`);
  }

  // Count total agent and skill references
  const totalAgentRefs = workflowResults.reduce((sum, r) => sum + r.agentRefs.length, 0);
  const totalSkillRefs = workflowResults.reduce((sum, r) => sum + r.skillRefs.length, 0);
  const withPhases = workflowResults.filter(r => r.hasPhases).length;
  const withSteps = workflowResults.filter(r => r.hasSteps).length;

  console.log(`\n  Total agent path refs: ${totalAgentRefs}`);
  console.log(`  Total skill refs: ${totalSkillRefs}`);
  console.log(`  Workflows with phases: ${withPhases}`);
  console.log(`  Workflows with steps: ${withSteps}`);
}

// Main execution
console.log('=== Workflow Verification Script ===\n');
console.log(`PROJECT_ROOT: ${PROJECT_ROOT}`);
console.log(`WORKFLOWS_DIR: ${WORKFLOWS_DIR}`);

const workflows = findWorkflows(WORKFLOWS_DIR);
console.log(`\nFound ${workflows.length} workflow files`);

const workflowResults = [];
for (const workflow of workflows) {
  const result = validateWorkflow(workflow);
  workflowResults.push(result);
}

checkRegistry(workflows);
checkClaudeMd(workflowResults);
generateSummary(workflowResults);

// Report
console.log('\n=== RESULTS ===\n');

if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  [ERROR] ${e}`));
}

if (warnings.length > 0) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.forEach(w => console.log(`  [WARN] ${w}`));
}

if (info.length > 0) {
  console.log(`\nINFO (${info.length}):`);
  info.forEach(i => console.log(`  [INFO] ${i}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('[OK] All workflows validated successfully!');
}

console.log(`\n=== FINAL SUMMARY ===`);
console.log(`Workflows: ${workflows.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Info: ${info.length}`);

process.exit(errors.length > 0 ? 1 : 0);
