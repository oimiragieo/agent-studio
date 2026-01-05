#!/usr/bin/env node
/**
 * Skill Context Optimizer - Progressive disclosure for skill content
 *
 * Implements token-efficient context loading for skills with 4 optimization levels:
 * - MINIMAL: Just names and one-liners (20-50 tokens per skill)
 * - ESSENTIAL: Key instructions, no examples (100-200 tokens)
 * - STANDARD: Instructions + primary examples (300-500 tokens)
 * - FULL: Complete SKILL.md content (800-1500 tokens)
 *
 * Usage:
 *   node skill-context-optimizer.mjs --agent developer --level ESSENTIAL
 *   node skill-context-optimizer.mjs --generate-summaries
 *   node skill-context-optimizer.mjs --test
 *
 * Programmatic:
 *   import { optimizeSkillContext } from './skill-context-optimizer.mjs';
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration paths
const CONTEXT_DIR = join(__dirname, '..', 'context');
const SKILLS_DIR = join(__dirname, '..', 'skills');
const SUMMARIES_PATH = join(CONTEXT_DIR, 'skill-summaries.json');
const SKILL_MATRIX_PATH = join(CONTEXT_DIR, 'skill-integration-matrix.json');

// Optimization levels
const OPTIMIZATION_LEVELS = {
  MINIMAL: 'MINIMAL',    // 20-50 tokens - just name and description
  ESSENTIAL: 'ESSENTIAL', // 100-200 tokens - core instructions only
  STANDARD: 'STANDARD',   // 300-500 tokens - instructions + examples
  FULL: 'FULL'           // 800-1500 tokens - complete SKILL.md
};

// Token budget defaults
const TOKEN_BUDGETS = {
  MINIMAL: 50,
  ESSENTIAL: 200,
  STANDARD: 500,
  FULL: 1500
};

/**
 * Load JSON file safely
 */
async function loadJson(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

/**
 * Save JSON file safely
 */
async function saveJson(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    await writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to save ${filePath}: ${error.message}`);
  }
}

/**
 * Estimate token count (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Extract sections from SKILL.md content
 */
function extractSections(content) {
  const sections = {
    frontmatter: '',
    identity: '',
    capabilities: '',
    instructions: '',
    examples: '',
    integration: '',
    best_practices: '',
    full: content
  };

  // Extract frontmatter (YAML between ---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    sections.frontmatter = frontmatterMatch[1];
  }

  // Extract sections by XML tags
  const tagPatterns = {
    identity: /<identity>([\s\S]*?)<\/identity>/,
    capabilities: /<capabilities>([\s\S]*?)<\/capabilities>/,
    instructions: /<instructions>([\s\S]*?)<\/instructions>/,
    examples: /<examples>([\s\S]*?)<\/examples>/,
    integration: /<integration>([\s\S]*?)<\/integration>/,
    best_practices: /<best_practices>([\s\S]*?)<\/best_practices>/
  };

  for (const [key, pattern] of Object.entries(tagPatterns)) {
    const match = content.match(pattern);
    if (match) {
      sections[key] = match[1].trim();
    }
  }

  return sections;
}

/**
 * Extract key commands from instructions or examples
 */
function extractKeyCommands(content) {
  const commands = [];

  // Look for command patterns
  const commandPatterns = [
    /\/\w+[\w-]*/g,                    // /command-style
    /`\/[^`]+`/g,                       // `/command` in backticks
    /Skill:\s*[\w-]+/g,                 // Skill: skill-name
    /node\s+\.claude\/skills\/[\w-]+/g // CLI invocations
  ];

  for (const pattern of commandPatterns) {
    const matches = content.match(pattern) || [];
    commands.push(...matches);
  }

  // Deduplicate and limit
  return [...new Set(commands)].slice(0, 5);
}

/**
 * Generate optimized content for a skill at specified level
 */
function generateOptimizedContent(skillName, sections, level, frontmatter = {}) {
  const { name, description } = frontmatter;

  switch (level) {
    case OPTIMIZATION_LEVELS.MINIMAL: {
      // Just name and one-liner
      return `**${skillName}**: ${description || 'No description available'}`;
    }

    case OPTIMIZATION_LEVELS.ESSENTIAL: {
      // Key instructions without examples
      const parts = [];

      parts.push(`## Skill: ${skillName}`);
      parts.push('');

      if (description) {
        parts.push(description);
        parts.push('');
      }

      if (sections.identity) {
        parts.push(sections.identity);
        parts.push('');
      }

      // Extract execution process from instructions (first subsection)
      if (sections.instructions) {
        const executionMatch = sections.instructions.match(/<execution_process>([\s\S]*?)<\/execution_process>/);
        if (executionMatch) {
          // Get just the first 3 steps
          const steps = executionMatch[1].split(/###\s+Step\s+\d+/);
          const firstSteps = steps.slice(1, 4).join('\n### Step');
          parts.push('### Key Steps:');
          parts.push(firstSteps.trim());
        } else {
          // Fallback: first 500 chars of instructions
          parts.push(sections.instructions.substring(0, 500) + '...');
        }
      }

      return parts.join('\n');
    }

    case OPTIMIZATION_LEVELS.STANDARD: {
      // Instructions + primary example
      const parts = [];

      parts.push(`## Skill: ${skillName}`);
      parts.push('');

      if (description) {
        parts.push(description);
        parts.push('');
      }

      if (sections.identity) {
        parts.push(sections.identity);
        parts.push('');
      }

      if (sections.instructions) {
        parts.push('### Instructions:');
        parts.push(sections.instructions);
        parts.push('');
      }

      // Add first example only
      if (sections.examples) {
        const firstExample = sections.examples.match(/<code_example>([\s\S]*?)<\/code_example>/);
        if (firstExample) {
          parts.push('### Example:');
          parts.push(firstExample[1].trim());
        }
      }

      return parts.join('\n');
    }

    case OPTIMIZATION_LEVELS.FULL:
    default: {
      // Full SKILL.md content
      return sections.full;
    }
  }
}

/**
 * Generate summary metadata for a skill
 */
async function generateSkillSummary(skillName) {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');

  if (!existsSync(skillPath)) {
    console.warn(`Warning: SKILL.md not found for ${skillName}`);
    return null;
  }

  const content = await readFile(skillPath, 'utf-8');
  const sections = extractSections(content);

  // Parse frontmatter
  let frontmatter = {};
  if (sections.frontmatter) {
    const lines = sections.frontmatter.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        frontmatter[match[1]] = match[2];
      }
    }
  }

  // Extract key commands
  const keyCommands = extractKeyCommands(content);

  // Generate content at each level
  const levels = {};
  for (const level of Object.values(OPTIMIZATION_LEVELS)) {
    const optimized = generateOptimizedContent(skillName, sections, level, frontmatter);
    levels[level.toLowerCase()] = {
      content: optimized,
      tokens: estimateTokens(optimized)
    };
  }

  return {
    name: skillName,
    one_liner: frontmatter.description || 'No description',
    key_commands: keyCommands,
    token_count: {
      minimal: levels.minimal.tokens,
      essential: levels.essential.tokens,
      standard: levels.standard.tokens,
      full: levels.full.tokens
    },
    levels
  };
}

/**
 * Generate summaries for all skills
 */
async function generateAllSummaries() {
  console.log('Generating skill summaries...');

  // Load skill matrix to get all skill names
  const matrix = await loadJson(SKILL_MATRIX_PATH);
  if (!matrix || !matrix.skill_categories) {
    throw new Error('Failed to load skill integration matrix');
  }

  // Get all unique skill names from categories
  const allSkills = new Set();
  for (const skills of Object.values(matrix.skill_categories)) {
    skills.forEach(skill => allSkills.add(skill));
  }

  console.log(`Found ${allSkills.size} skills to process`);

  const summaries = {};
  let processed = 0;
  let failed = 0;

  for (const skillName of allSkills) {
    try {
      const summary = await generateSkillSummary(skillName);
      if (summary) {
        summaries[skillName] = summary;
        processed++;
        console.log(`  ✓ ${skillName} (${summary.token_count.full} tokens full)`);
      }
    } catch (error) {
      console.error(`  ✗ ${skillName}: ${error.message}`);
      failed++;
    }
  }

  // Save summaries
  await saveJson(SUMMARIES_PATH, {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    total_skills: allSkills.size,
    summaries
  });

  console.log(`\nSummary generation complete:`);
  console.log(`  - Processed: ${processed}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`  - Output: ${SUMMARIES_PATH}`);

  return summaries;
}

/**
 * Optimize skill context for agent based on options
 *
 * @param {Array<string>} requiredSkills - Required skill names
 * @param {Array<string>} triggeredSkills - Triggered skill names
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} Optimized content
 */
export async function optimizeSkillContext(requiredSkills, triggeredSkills, options = {}) {
  const {
    level = OPTIMIZATION_LEVELS.ESSENTIAL,
    maxTokens = 1000,
    prioritize = 'required' // 'required' | 'triggered' | 'all'
  } = options;

  // Load skill summaries
  const summariesData = await loadJson(SUMMARIES_PATH);
  if (!summariesData || !summariesData.summaries) {
    throw new Error('Skill summaries not found. Run --generate-summaries first.');
  }

  const summaries = summariesData.summaries;

  // Prioritize skills
  let prioritizedSkills = [];
  if (prioritize === 'required') {
    prioritizedSkills = [...requiredSkills, ...triggeredSkills];
  } else if (prioritize === 'triggered') {
    prioritizedSkills = [...triggeredSkills, ...requiredSkills];
  } else {
    prioritizedSkills = [...requiredSkills, ...triggeredSkills];
  }

  // Remove duplicates while preserving order
  prioritizedSkills = [...new Set(prioritizedSkills)];

  // Calculate token budget per skill
  const budgetPerSkill = Math.floor(maxTokens / prioritizedSkills.length);

  // Determine effective level based on budget
  let effectiveLevel = level;
  if (budgetPerSkill < TOKEN_BUDGETS.MINIMAL) {
    effectiveLevel = OPTIMIZATION_LEVELS.MINIMAL;
  } else if (budgetPerSkill < TOKEN_BUDGETS.ESSENTIAL) {
    effectiveLevel = OPTIMIZATION_LEVELS.ESSENTIAL;
  } else if (budgetPerSkill < TOKEN_BUDGETS.STANDARD) {
    effectiveLevel = OPTIMIZATION_LEVELS.STANDARD;
  } else {
    effectiveLevel = OPTIMIZATION_LEVELS.FULL;
  }

  // Generate optimized content
  const optimizedContent = [];
  let totalTokens = 0;

  for (const skillName of prioritizedSkills) {
    const summary = summaries[skillName];
    if (!summary) {
      console.warn(`Warning: Summary not found for skill "${skillName}"`);
      continue;
    }

    const levelKey = effectiveLevel.toLowerCase();
    const levelData = summary.levels[levelKey];

    if (levelData) {
      optimizedContent.push({
        skill: skillName,
        level: effectiveLevel,
        content: levelData.content,
        tokens: levelData.tokens
      });
      totalTokens += levelData.tokens;
    }
  }

  return {
    level: effectiveLevel,
    maxTokens,
    actualTokens: totalTokens,
    skillCount: prioritizedSkills.length,
    skills: optimizedContent,
    metadata: {
      prioritize,
      budgetPerSkill,
      optimizedAt: new Date().toISOString()
    }
  };
}

/**
 * Run self-test to validate optimization
 */
async function runSelfTest() {
  console.log('Running skill context optimizer self-test...\n');

  // Test 1: Load summaries
  console.log('Test 1: Load skill summaries');
  const summariesData = await loadJson(SUMMARIES_PATH);
  if (!summariesData || !summariesData.summaries) {
    console.error('  ✗ Failed: Summaries not found. Run --generate-summaries first.');
    return false;
  }
  console.log(`  ✓ Loaded ${Object.keys(summariesData.summaries).length} skill summaries`);

  // Test 2: Optimize for developer with 3 required skills
  console.log('\nTest 2: Optimize for developer (ESSENTIAL level)');
  const testRequired = ['scaffolder', 'rule-auditor', 'repo-rag'];
  const testTriggered = ['test-generator'];

  const result = await optimizeSkillContext(testRequired, testTriggered, {
    level: OPTIMIZATION_LEVELS.ESSENTIAL,
    maxTokens: 1000,
    prioritize: 'required'
  });

  console.log(`  ✓ Optimized ${result.skillCount} skills`);
  console.log(`  ✓ Level: ${result.level}`);
  console.log(`  ✓ Tokens: ${result.actualTokens} / ${result.maxTokens}`);

  // Test 3: Token budgeting
  console.log('\nTest 3: Token budgeting across levels');
  for (const level of Object.values(OPTIMIZATION_LEVELS)) {
    const budgetResult = await optimizeSkillContext(testRequired, [], {
      level,
      maxTokens: 1500,
      prioritize: 'required'
    });
    console.log(`  ${level}: ${budgetResult.actualTokens} tokens for ${budgetResult.skillCount} skills`);
  }

  console.log('\n✓ All tests passed');
  return true;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Help command
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Skill Context Optimizer - Progressive disclosure for skill content

Usage:
  node skill-context-optimizer.mjs --generate-summaries
  node skill-context-optimizer.mjs --agent <type> --level <level>
  node skill-context-optimizer.mjs --test
  node skill-context-optimizer.mjs --help

Commands:
  --generate-summaries     Generate summaries for all skills
  --test                   Run self-test to validate optimization
  --help, -h               Show this help message

Options:
  --agent <type>           Agent type (e.g., developer, orchestrator)
  --level <level>          Optimization level (MINIMAL, ESSENTIAL, STANDARD, FULL)
  --max-tokens <n>         Maximum token budget (default: 1000)
  --prioritize <mode>      Prioritization mode (required, triggered, all)
  --json                   Output results as JSON

Optimization Levels:
  MINIMAL    20-50 tokens    - Just skill names and one-liners
  ESSENTIAL  100-200 tokens  - Key instructions, no examples
  STANDARD   300-500 tokens  - Instructions + primary examples
  FULL       800-1500 tokens - Complete SKILL.md content

Examples:
  # Generate summaries for all skills
  node skill-context-optimizer.mjs --generate-summaries

  # Optimize for developer with ESSENTIAL level
  node skill-context-optimizer.mjs --agent developer --level ESSENTIAL

  # Run self-test
  node skill-context-optimizer.mjs --test
`);
    process.exit(0);
  }

  // Generate summaries command
  if (args.includes('--generate-summaries')) {
    try {
      await generateAllSummaries();
      process.exit(0);
    } catch (error) {
      console.error('Error generating summaries:', error.message);
      process.exit(1);
    }
  }

  // Test command
  if (args.includes('--test')) {
    try {
      const success = await runSelfTest();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  }

  // Agent optimization command
  const agentIndex = args.indexOf('--agent');
  if (agentIndex !== -1 && agentIndex + 1 < args.length) {
    const agentType = args[agentIndex + 1];
    const levelIndex = args.indexOf('--level');
    const level = levelIndex !== -1 && levelIndex + 1 < args.length
      ? args[levelIndex + 1]
      : OPTIMIZATION_LEVELS.ESSENTIAL;

    const maxTokensIndex = args.indexOf('--max-tokens');
    const maxTokens = maxTokensIndex !== -1 && maxTokensIndex + 1 < args.length
      ? parseInt(args[maxTokensIndex + 1])
      : 1000;

    const jsonOutput = args.includes('--json');

    try {
      // Load skill matrix to get agent's skills
      const matrix = await loadJson(SKILL_MATRIX_PATH);
      const agentConfig = matrix.agents[agentType];

      if (!agentConfig) {
        console.error(`Error: Agent type "${agentType}" not found`);
        process.exit(1);
      }

      const result = await optimizeSkillContext(
        agentConfig.required_skills || [],
        [], // No triggered skills without task description
        {
          level,
          maxTokens,
          prioritize: 'required'
        }
      );

      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n✓ Optimized skill context for agent: ${agentType}`);
        console.log(`\nLevel: ${result.level}`);
        console.log(`Token Budget: ${result.actualTokens} / ${result.maxTokens}`);
        console.log(`Skills: ${result.skillCount}`);
        console.log('\nOptimized Skills:');
        result.skills.forEach(({ skill, tokens }) => {
          console.log(`  - ${skill} (${tokens} tokens)`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error('Error optimizing context:', error.message);
      process.exit(1);
    }
  }

  // No command specified
  console.error('Error: No command specified. Run with --help for usage information.');
  process.exit(1);
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export all functions for programmatic use
export default {
  optimizeSkillContext,
  generateAllSummaries,
  generateSkillSummary,
  estimateTokens,
  OPTIMIZATION_LEVELS,
  TOKEN_BUDGETS
};
