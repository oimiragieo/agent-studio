#!/usr/bin/env node

/**
 * CUJ Registry Sync Tool
 *
 * Parses all CUJ markdown files and generates a comprehensive registry JSON.
 * This provides a single source of truth for all Customer User Journeys (CUJs).
 *
 * Usage:
 *   node .claude/tools/sync-cuj-registry.mjs
 *   node .claude/tools/sync-cuj-registry.mjs --validate-only
 *   node .claude/tools/sync-cuj-registry.mjs --output path/to/registry.json
 *
 * Features:
 * - Parses all CUJ-*.md files in .claude/docs/cujs/
 * - Extracts metadata (execution mode, agents, skills, schemas, triggers)
 * - Generates comprehensive registry JSON
 * - Validates against cuj-registry.schema.json
 * - Provides statistics and validation report
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CUJ_DOCS_DIR = path.join(__dirname, '..', 'docs', 'cujs');
const REGISTRY_OUTPUT = path.join(__dirname, '..', 'context', 'cuj-registry.json');
const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'cuj-registry.schema.json');

// Categories mapping
const CATEGORIES = {
  'CUJ-001': 'Onboarding & Setup',
  'CUJ-002': 'Onboarding & Setup',
  'CUJ-003': 'Onboarding & Setup',
  'CUJ-004': 'Planning & Architecture',
  'CUJ-005': 'Planning & Architecture',
  'CUJ-006': 'Planning & Architecture',
  'CUJ-007': 'Planning & Architecture',
  'CUJ-008': 'Planning & Architecture',
  'CUJ-009': 'Development',
  'CUJ-010': 'Development',
  'CUJ-011': 'Development',
  'CUJ-012': 'Development',
  'CUJ-013': 'Quality Assurance',
  'CUJ-014': 'Quality Assurance',
  'CUJ-015': 'Quality Assurance',
  'CUJ-016': 'Documentation',
  'CUJ-017': 'Documentation',
  'CUJ-018': 'Documentation',
  'CUJ-019': 'Specialized Workflows',
  'CUJ-020': 'Specialized Workflows',
  'CUJ-021': 'Specialized Workflows',
  'CUJ-022': 'Specialized Workflows',
  'CUJ-023': 'Maintenance & Operations',
  'CUJ-024': 'Maintenance & Operations',
  'CUJ-025': 'Advanced Workflows',
  'CUJ-026': 'Advanced Workflows',
  'CUJ-027': 'Advanced Workflows',
  'CUJ-028': 'Advanced Workflows',
  'CUJ-029': 'Advanced Workflows',
  'CUJ-030': 'Advanced Workflows',
  'CUJ-034': 'Quality Assurance',
  'CUJ-035': 'Testing & Validation',
  'CUJ-036': 'Testing & Validation',
  'CUJ-037': 'Testing & Validation',
  'CUJ-038': 'Testing & Validation',
  'CUJ-039': 'Testing & Validation',
  'CUJ-040': 'Testing & Validation',
  'CUJ-041': 'Testing & Validation',
  'CUJ-042': 'Testing & Validation',
  'CUJ-043': 'Testing & Validation',
  'CUJ-044': 'Testing & Validation',
  'CUJ-045': 'Testing & Validation',
  'CUJ-046': 'Testing & Validation',
  'CUJ-047': 'Testing & Validation',
  'CUJ-048': 'Testing & Validation',
  'CUJ-049': 'Testing & Validation',
  'CUJ-050': 'Testing & Validation',
  'CUJ-051': 'Testing & Validation',
  'CUJ-052': 'Testing & Validation',
  'CUJ-053': 'Testing & Validation',
  'CUJ-054': 'Testing & Validation',
  'CUJ-055': 'Testing & Validation',
  'CUJ-056': 'Testing & Validation',
  'CUJ-057': 'Testing & Validation',
  'CUJ-058': 'Testing & Validation',
  'CUJ-059': 'Testing & Validation',
  'CUJ-060': 'Testing & Validation',
  'CUJ-061': 'Testing & Validation',
  'CUJ-062': 'Testing & Validation',
  'CUJ-063': 'Testing & Validation'
};

/**
 * Parse a CUJ markdown file and extract metadata
 */
async function parseCUJFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');
  const cujId = fileName.match(/^CUJ-\d{3}$/)?.[0];

  if (!cujId) {
    return null; // Skip non-CUJ files
  }

  const metadata = {
    id: cujId,
    name: '',
    description: '',
    category: CATEGORIES[cujId] || 'Unknown',
    execution_mode: 'workflow',
    workflow: null,
    agents: [],
    skills: [],
    primary_skill: null,
    schemas: [],
    triggers: [],
    platform_compatibility: {
      claude: true,
      cursor: true,
      factory: false
    },
    expected_outputs: [],
    estimated_duration: null,
    file_path: path.relative(path.join(__dirname, '..', '..'), filePath).replace(/\\/g, '/')
  };

  // Extract name (first # heading)
  const nameMatch = content.match(/^#\s+(.+)$/m);
  if (nameMatch) {
    metadata.name = nameMatch[1].replace(/^CUJ-\d{3}:\s*/, '');
  }

  // Extract user goal (description)
  const goalMatch = content.match(/##\s+User Goal\s+(.+?)(?=\n##)/s);
  if (goalMatch) {
    metadata.description = goalMatch[1].trim().replace(/\n/g, ' ');
  }

  // Extract execution mode
  const execModeMatch = content.match(/\*\*Execution Mode\*\*:\s*`([^`]+)`/);
  if (execModeMatch) {
    const mode = execModeMatch[1];
    // Normalize execution modes to schema-allowed values
    if (mode === 'skill' || mode.includes('skill')) {
      metadata.execution_mode = 'skill-only';
    } else if (mode.includes('delegated')) {
      metadata.execution_mode = 'delegated-skill';
    } else if (mode.includes('manual') || mode.includes('setup')) {
      metadata.execution_mode = 'manual-setup';
    } else if (mode.includes('workflow') || mode.endsWith('.yaml')) {
      metadata.execution_mode = 'workflow';
      // Extract workflow filename from execution mode if it's a .yaml file
      if (mode.endsWith('.yaml')) {
        metadata.workflow = `.claude/workflows/${mode}`;
      }
    } else {
      metadata.execution_mode = mode;
    }
  }

  // Extract workflow file from various patterns
  // Pattern 1: workflow: `.claude/workflows/file.yaml`
  let workflowMatch = content.match(/workflow:\s*`?\.claude\/workflows\/([^`\s]+\.yaml)`?/i);
  if (workflowMatch) {
    metadata.workflow = `.claude/workflows/${workflowMatch[1]}`;
    metadata.execution_mode = 'workflow';
  }

  // Pattern 2: Uses workflow: file.yaml (in description or anywhere)
  if (!metadata.workflow) {
    workflowMatch = content.match(/Uses workflow:\s*`?([^`\s]+\.yaml)`?/i);
    if (workflowMatch) {
      metadata.workflow = `.claude/workflows/${workflowMatch[1]}`;
      metadata.execution_mode = 'workflow';
    }
  }

  // Pattern 3: **Execution Mode**: `file.yaml` (already handled above)
  // Pattern 4: References to .yaml files in Workflow section
  // IMPORTANT: Only match if the .yaml file actually exists in .claude/workflows/
  // to avoid false positives from skill references (e.g., manifest.yaml)
  if (!metadata.workflow) {
    workflowMatch = content.match(/##\s+Workflow[\s\S]*?`([^`]+\.yaml)`/);
    if (workflowMatch) {
      const yamlFile = workflowMatch[1];
      // Only treat as workflow if file doesn't contain path separators
      // (real workflow references are just filenames like "greenfield-fullstack.yaml")
      if (!yamlFile.includes('/') && !yamlFile.includes('\\')) {
        metadata.workflow = `.claude/workflows/${yamlFile}`;
        metadata.execution_mode = 'workflow';
      }
    }
  }

  // Extract agents
  const agentsSection = content.match(/##\s+Agents Used\s+(.+?)(?=\n##)/s);
  if (agentsSection) {
    const agentMatches = agentsSection[1].matchAll(/[-*]\s+`?([a-z-]+)`?/g);
    for (const match of agentMatches) {
      const agent = match[1].toLowerCase();
      if (agent !== 'none' && !agent.includes('(') && !metadata.agents.includes(agent)) {
        metadata.agents.push(agent);
      }
    }
  }

  // Extract skills
  const skillsSection = content.match(/##\s+Skills Used\s+(.+?)(?=\n##)/s);
  if (skillsSection) {
    const skillMatches = skillsSection[1].matchAll(/[-*]\s+`([^`]+)`/g);
    for (const match of skillMatches) {
      const skill = match[1];
      if (skill !== 'None' && !metadata.skills.includes(skill)) {
        metadata.skills.push(skill);
      }
    }
  }

  // Extract primary skill (for skill-only CUJs)
  if (metadata.execution_mode === 'skill-only' && metadata.skills.length > 0) {
    metadata.primary_skill = metadata.skills[0];
  }

  // Extract schemas
  const schemaMatches = content.matchAll(/\.claude\/schemas\/([^)\s]+\.schema\.json)/g);
  for (const match of schemaMatches) {
    const schema = `.claude/schemas/${match[1]}`;
    if (!metadata.schemas.includes(schema)) {
      metadata.schemas.push(schema);
    }
  }

  // Extract triggers
  const triggerSection = content.match(/##\s+Trigger\s+(.+?)(?=\n##)/s);
  if (triggerSection) {
    const triggerMatches = triggerSection[1].matchAll(/[-*]\s+(.+?)$/gm);
    for (const match of triggerMatches) {
      const trigger = match[1].replace(/^["']|["']$/g, '').trim();
      if (trigger && !metadata.triggers.includes(trigger)) {
        metadata.triggers.push(trigger);
      }
    }
  }

  // Extract expected outputs
  const outputsSection = content.match(/##\s+Expected Outputs\s+(.+?)(?=\n##)/s);
  if (outputsSection) {
    const outputMatches = outputsSection[1].matchAll(/[-*]\s+(.+?)$/gm);
    for (const match of outputMatches) {
      const output = match[1].trim();
      if (output && !metadata.expected_outputs.includes(output)) {
        metadata.expected_outputs.push(output);
      }
    }
  }

  // Platform compatibility (Claude-only skills)
  const claudeOnlySkills = ['recovery', 'optional-artifact-handler', 'conflict-resolution', 'api-contract-generator'];
  const hasClaudeOnlySkill = metadata.skills.some(skill => claudeOnlySkills.includes(skill));

  if (hasClaudeOnlySkill) {
    metadata.platform_compatibility.cursor = false;
  }

  // Cursor-specific CUJs
  if (cujId === 'CUJ-042' || cujId === 'CUJ-049') {
    metadata.platform_compatibility.cursor = true;
    metadata.platform_compatibility.claude = false;
  }

  // Estimated duration - always set to avoid null values
  if (metadata.execution_mode === 'skill-only' || metadata.execution_mode === 'delegated-skill') {
    metadata.estimated_duration = '2-60 seconds';
  } else if (metadata.execution_mode === 'workflow') {
    metadata.estimated_duration = '2-10 minutes';
  } else if (metadata.execution_mode === 'manual-setup') {
    metadata.estimated_duration = 'varies';
  } else {
    // Default fallback
    metadata.estimated_duration = 'varies';
  }

  return metadata;
}

/**
 * Scan all CUJ files and generate registry
 */
async function generateRegistry() {
  console.log('🔍 Scanning CUJ documentation files...\n');

  const files = await fs.readdir(CUJ_DOCS_DIR);
  const cujFiles = files.filter(f => f.match(/^CUJ-\d{3}\.md$/));

  console.log(`Found ${cujFiles.length} CUJ files`);

  const cujs = [];
  const errors = [];

  for (const file of cujFiles) {
    const filePath = path.join(CUJ_DOCS_DIR, file);
    try {
      const metadata = await parseCUJFile(filePath);
      if (metadata) {
        cujs.push(metadata);
        console.log(`✅ Parsed ${metadata.id}: ${metadata.name}`);
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`❌ Error parsing ${file}: ${error.message}`);
    }
  }

  // Sort by CUJ ID
  cujs.sort((a, b) => a.id.localeCompare(b.id));

  const registry = {
    $schema: '../schemas/cuj-registry.schema.json',
    version: '1.0.0',
    generated: new Date().toISOString(),
    total_cujs: cujs.length,
    cujs
  };

  return { registry, errors };
}

/**
 * Validate registry against schema
 */
async function validateRegistry(registry) {
  console.log('\n📋 Validating registry against schema...\n');

  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, verbose: true });

  // Add custom format for date-time if needed
  ajv.addFormat('date-time', {
    validate: (dateTimeString) => {
      return !isNaN(Date.parse(dateTimeString));
    }
  });

  const validate = ajv.compile(schema);
  const valid = validate(registry);

  if (!valid) {
    console.error('❌ Schema validation failed:\n');
    for (const error of validate.errors) {
      console.error(`  - ${error.instancePath}: ${error.message}`);
    }
    return false;
  }

  console.log('✅ Schema validation passed');
  return true;
}

/**
 * Generate statistics
 */
function generateStatistics(registry) {
  const stats = {
    total: registry.total_cujs,
    by_execution_mode: {},
    by_category: {},
    by_platform: {
      claude: 0,
      cursor: 0,
      factory: 0
    },
    agents_used: new Set(),
    skills_used: new Set()
  };

  for (const cuj of registry.cujs) {
    // Execution mode
    stats.by_execution_mode[cuj.execution_mode] =
      (stats.by_execution_mode[cuj.execution_mode] || 0) + 1;

    // Category
    stats.by_category[cuj.category] =
      (stats.by_category[cuj.category] || 0) + 1;

    // Platform compatibility
    if (cuj.platform_compatibility.claude) stats.by_platform.claude++;
    if (cuj.platform_compatibility.cursor) stats.by_platform.cursor++;
    if (cuj.platform_compatibility.factory) stats.by_platform.factory++;

    // Agents and skills
    cuj.agents.forEach(agent => stats.agents_used.add(agent));
    cuj.skills.forEach(skill => stats.skills_used.add(skill));
  }

  stats.agents_used = Array.from(stats.agents_used).sort();
  stats.skills_used = Array.from(stats.skills_used).sort();

  return stats;
}

/**
 * Print statistics
 */
function printStatistics(stats) {
  console.log('\n📊 Registry Statistics\n');
  console.log(`Total CUJs: ${stats.total}`);

  console.log('\nBy Execution Mode:');
  for (const [mode, count] of Object.entries(stats.by_execution_mode)) {
    console.log(`  ${mode}: ${count}`);
  }

  console.log('\nBy Category:');
  for (const [category, count] of Object.entries(stats.by_category)) {
    console.log(`  ${category}: ${count}`);
  }

  console.log('\nPlatform Compatibility:');
  console.log(`  Claude: ${stats.by_platform.claude}`);
  console.log(`  Cursor: ${stats.by_platform.cursor}`);
  console.log(`  Factory: ${stats.by_platform.factory}`);

  console.log(`\nUnique Agents: ${stats.agents_used.length}`);
  console.log(`Unique Skills: ${stats.skills_used.length}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : REGISTRY_OUTPUT;

  console.log('🚀 CUJ Registry Sync Tool\n');

  try {
    // Generate registry
    const { registry, errors } = await generateRegistry();

    if (errors.length > 0) {
      console.error(`\n⚠️  ${errors.length} file(s) had parsing errors`);
    }

    // Generate statistics
    const stats = generateStatistics(registry);
    printStatistics(stats);

    // Validate
    const isValid = await validateRegistry(registry);
    if (!isValid) {
      process.exit(1);
    }

    // Save registry (unless validate-only)
    if (!validateOnly) {
      await fs.writeFile(outputPath, JSON.stringify(registry, null, 2), 'utf-8');
      console.log(`\n✅ Registry saved to: ${outputPath}`);
    } else {
      console.log('\n✅ Validation complete (no file written)');
    }

    console.log('\n🎉 CUJ registry sync complete!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
