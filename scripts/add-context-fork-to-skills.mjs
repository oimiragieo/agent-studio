#!/usr/bin/env node
/**
 * Add context:fork field to forkable skills
 *
 * Phase 3 of Claude Code 2.1.2 upgrade plan
 *
 * This script adds `context:fork: true` to skills that should be available
 * in subagent contexts for token optimization (20-40% reduction).
 *
 * Skills with context:fork: true will be injected into subagent prompts.
 * Skills without it (orchestration-only) will only be available in master contexts.
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skills that should be forkable (available in subagent contexts)
const FORKABLE_SKILLS = [
  // Implementation skills
  'scaffolder',
  'test-generator',
  'doc-generator',
  'api-contract-generator',

  // Validation skills
  'rule-auditor',
  'code-style-validator',
  'commit-validator',

  // Analysis skills
  'dependency-analyzer',
  'diagram-generator',

  // Rule skills
  'explaining-rules',
  'fixing-rule-violations',
  'migrating-rules',
  'recommending-rules',

  // Generation skills
  'claude-md-generator',
  'plan-generator',
  'excel-generator',
  'powerpoint-generator',
  'pdf-generator',

  // Analysis/Classification skills
  'summarizer',
  'classifier',
  'text-to-sql',
  'evaluator',

  // Search and discovery
  'repo-rag',
  'tool-search',

  // Code analysis
  'code-analyzer',

  // MCP-converted skills (forkable)
  'git',
  'github',
  'filesystem',
  'puppeteer',
  'chrome-devtools',
  'sequential-thinking',
  'computer-use',
  'cloud-run',

  // Additional forkable skills
  'mcp-converter',
  'rule-selector',
  'skill-manager',
  'memory'
];

// Skills to exclude (orchestration-only, not forkable)
const EXCLUDED_SKILLS = [
  'context-bridge',
  'artifact-publisher',
  'recovery',
  'conflict-resolution',
  'memory-manager',
  'optional-artifact-handler'
];

/**
 * Add context:fork to a skill's frontmatter
 */
function addContextForkToSkill(skillPath, skillName) {
  try {
    let content = readFileSync(skillPath, 'utf-8');

    // Check if context:fork already exists
    if (content.includes('context:fork')) {
      console.log(`  ⏭️  ${skillName}: Already has context:fork field`);
      return false;
    }

    // Find the frontmatter section
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      console.warn(`  ⚠️  ${skillName}: No frontmatter found, skipping`);
      return false;
    }

    // Add context:fork after description line in frontmatter
    // Pattern: description: ... \n
    // Replace with: description: ... \ncontext:fork: true\n
    content = content.replace(
      /(description: .+)\n/,
      '$1\ncontext:fork: true\n'
    );

    // Write updated content
    writeFileSync(skillPath, content, 'utf-8');
    console.log(`  ✅ ${skillName}: Added context:fork: true`);
    return true;

  } catch (error) {
    console.error(`  ❌ ${skillName}: Error - ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Adding context:fork to forkable skills...\n');

  const projectRoot = join(__dirname, '..');
  const skillFiles = await glob('.claude/skills/*/SKILL.md', { cwd: projectRoot });

  let updated = 0;
  let skipped = 0;
  let alreadyHas = 0;
  let excluded = 0;

  console.log(`Found ${skillFiles.length} skill files\n`);

  for (const skillFile of skillFiles) {
    // Handle both Windows backslashes and Unix forward slashes
    const parts = skillFile.split(/[/\\]/);
    const skillName = parts[parts.length - 2]; // Get directory name (second to last part)

    // Skip excluded skills
    if (EXCLUDED_SKILLS.includes(skillName)) {
      console.log(`  ⏭️  ${skillName}: Excluded (orchestration-only)`);
      excluded++;
      continue;
    }

    // Only process forkable skills
    if (!FORKABLE_SKILLS.includes(skillName)) {
      console.log(`  ⏭️  ${skillName}: Not in forkable list, skipping`);
      skipped++;
      continue;
    }

    const skillPath = join(projectRoot, skillFile);
    const result = addContextForkToSkill(skillPath, skillName);

    if (result) {
      updated++;
    } else {
      // Check if already has context:fork
      const content = readFileSync(skillPath, 'utf-8');
      if (content.includes('context:fork')) {
        alreadyHas++;
      } else {
        skipped++;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updated} skills`);
  console.log(`  ⏭️  Already had context:fork: ${alreadyHas} skills`);
  console.log(`  ⏭️  Excluded (orchestration-only): ${excluded} skills`);
  console.log(`  ⏭️  Skipped (not in forkable list): ${skipped} skills`);
  console.log(`\n✨ Total forkable skills configured: ${updated + alreadyHas}`);

  if (updated > 0) {
    console.log('\n✅ Success! Skills updated with context:fork: true');
    console.log('\nNext steps:');
    console.log('  1. Update skill-loader.mjs to parse context:fork field');
    console.log('  2. Update skill-injector.mjs to respect context:fork');
    console.log('  3. Test skill injection with subagents');
  } else {
    console.log('\n✅ All forkable skills already have context:fork field');
  }

  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default main;
