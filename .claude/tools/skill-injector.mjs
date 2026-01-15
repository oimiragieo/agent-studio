#!/usr/bin/env node
/**
 * Skill Injector - Core infrastructure for Phase 2 skill orchestration
 *
 * Reads skill-integration-matrix.json and injects required skills into agent prompts at spawn time.
 * Provides dynamic skill discovery, trigger detection, and prompt generation for agent spawning.
 *
 * Usage:
 *   node .claude/tools/skill-injector.mjs --agent developer --task "Create new UserProfile component"
 *   node .claude/tools/skill-injector.mjs --agent orchestrator --list-skills
 *   node .claude/tools/skill-injector.mjs --help
 *
 * Programmatic:
 *   import { injectSkillsForAgent } from '.claude/tools/skill-injector.mjs';
 *   const injection = await injectSkillsForAgent('developer', 'Create new component');
 */

import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { loadSkillMetadata } from '../skills/sdk/skill-loader.mjs';
import { resolveConfigPath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration paths
const CONTEXT_DIR = join(__dirname, '..', 'context');
const SKILLS_DIR = join(__dirname, '..', 'skills');
const SKILL_MATRIX_PATH = resolveConfigPath('skill-integration-matrix.json', { read: true });

// ======================================================================
// Skill content cache (memory-safe, O(1) size tracking)
// ======================================================================

const skillContentCache = new Map(); // Map<skillName, { content, sizeMB, lastAccess }>
let incrementalCacheSizeMB = 0;

const MAX_CACHE_SIZE_MB = 50;
const MAX_CACHE_ENTRIES = 250;

function estimateEntrySize(content) {
  const bytes = Buffer.byteLength(content || '', 'utf-8');
  return bytes / 1024 / 1024;
}

function estimateCacheSize() {
  return incrementalCacheSizeMB;
}

function cleanCache() {
  if (skillContentCache.size <= MAX_CACHE_ENTRIES && estimateCacheSize() <= MAX_CACHE_SIZE_MB) {
    return;
  }

  const entries = Array.from(skillContentCache.entries()).sort(
    (a, b) => (a[1]?.lastAccess || 0) - (b[1]?.lastAccess || 0)
  );

  for (const [skillName, entry] of entries) {
    if (skillContentCache.size <= MAX_CACHE_ENTRIES && estimateCacheSize() <= MAX_CACHE_SIZE_MB) {
      break;
    }
    skillContentCache.delete(skillName);
    incrementalCacheSizeMB -= entry?.sizeMB || 0;
  }

  if (incrementalCacheSizeMB < 0) incrementalCacheSizeMB = 0;
}

export function clearSkillContentCache() {
  skillContentCache.clear();
  incrementalCacheSizeMB = 0;
}

export function getSkillContentCacheStats() {
  return {
    size: skillContentCache.size,
    estimatedSizeMB: estimateCacheSize().toFixed(2),
    maxSize: MAX_CACHE_ENTRIES,
  };
}

/**
 * Load JSON file safely with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object|null>} Parsed JSON or null on error
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
 * Load the skill integration matrix
 * @returns {Promise<Object|null>} Skill matrix or null on error
 */
export async function loadSkillMatrix() {
  const matrix = await loadJson(SKILL_MATRIX_PATH);

  if (!matrix) {
    throw new Error(`Skill integration matrix not found at ${SKILL_MATRIX_PATH}`);
  }

  if (!matrix.agents || typeof matrix.agents !== 'object') {
    throw new Error('Invalid skill matrix format: missing or invalid "agents" property');
  }

  return matrix;
}

/**
 * Get skills configuration for a specific agent
 * @param {string} agentType - Agent type (e.g., 'developer', 'orchestrator')
 * @returns {Promise<Object>} Skills configuration
 */
export async function getSkillsForAgent(agentType) {
  const matrix = await loadSkillMatrix();

  const agentConfig = matrix.agents[agentType];

  if (!agentConfig) {
    throw new Error(
      `Agent type "${agentType}" not found in skill matrix. Available agents: ${Object.keys(matrix.agents).join(', ')}`
    );
  }

  return {
    agentType,
    requiredSkills: agentConfig.required_skills || [],
    recommendedSkills: agentConfig.recommended_skills || [],
    skillTriggers: agentConfig.skill_triggers || {},
    description: agentConfig.description || '',
    usageNotes: matrix.usage_notes?.[agentType] || matrix.usage_notes?.all_agents || '',
  };
}

/**
 * Load SKILL.md content for a specific skill
 * @param {string} skillName - Skill name
 * @returns {Promise<string|null>} SKILL.md content or null if not found
 */
export async function loadSkillContent(skillName) {
  const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md');

  try {
    const cached = skillContentCache.get(skillName);
    if (cached?.content) {
      cached.lastAccess = Date.now();
      return cached.content;
    }

    // Check if file exists
    await access(skillPath);
    const content = await readFile(skillPath, 'utf-8');

    const sizeMB = estimateEntrySize(content);
    skillContentCache.set(skillName, { content, sizeMB, lastAccess: Date.now() });
    incrementalCacheSizeMB += sizeMB;

    cleanCache();
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Warning: SKILL.md not found for skill "${skillName}" at ${skillPath}`);
      return null;
    }
    throw new Error(`Failed to load SKILL.md for "${skillName}": ${error.message}`);
  }
}

/**
 * Detect triggered skills based on task description
 * @param {Object} skillTriggers - Skill triggers mapping (trigger -> skill)
 * @param {string} taskDescription - Task description to analyze
 * @returns {string[]} Array of triggered skill names
 */
function detectTriggeredSkills(skillTriggers, taskDescription) {
  if (!taskDescription || !skillTriggers) {
    return [];
  }

  const taskLower = taskDescription.toLowerCase();
  const triggeredSkills = new Set();

  // Check each trigger pattern against task description
  for (const [trigger, skillName] of Object.entries(skillTriggers)) {
    // Convert trigger patterns to keywords
    // e.g., "new_component" -> ["new", "component"]
    const keywords = trigger.split('_').map(k => k.toLowerCase());

    // Check if all keywords are in task description
    const allKeywordsMatch = keywords.every(keyword => taskLower.includes(keyword));

    if (allKeywordsMatch) {
      triggeredSkills.add(skillName);
    }
  }

  return Array.from(triggeredSkills);
}

/**
 * Generate skill injection prompt from loaded skills
 * @param {string} agentType - Agent type
 * @param {string[]} requiredSkills - Required skill names
 * @param {string[]} triggeredSkills - Triggered skill names
 * @param {Object} skillContents - Map of skill name to SKILL.md content
 * @param {Object} options - Generation options
 * @returns {string} Formatted skill injection prompt
 */
function generateSkillPrompt(
  agentType,
  requiredSkills,
  triggeredSkills,
  skillContents,
  options = {}
) {
  const { useOptimizer = false, optimizedSkills = null } = options;

  const sections = [];

  sections.push('# Injected Skills');
  sections.push('');
  sections.push(`Skills automatically injected for agent type: **${agentType}**`);
  sections.push('');

  if (useOptimizer && optimizedSkills) {
    // Use optimized content from skill-context-optimizer
    sections.push(`**Optimization Level**: ${optimizedSkills.level}`);
    sections.push(
      `**Token Budget**: ${optimizedSkills.actualTokens} / ${optimizedSkills.maxTokens}`
    );
    sections.push('');

    sections.push('## Required Skills');
    sections.push('');
    sections.push('These skills are MANDATORY for this agent type:');
    sections.push('');

    for (const { skill, content } of optimizedSkills.skills) {
      sections.push(content);
      sections.push('');
      sections.push('---');
      sections.push('');
    }
  } else {
    // Legacy: Use full SKILL.md content
    // Required Skills Section
    if (requiredSkills.length > 0) {
      sections.push('## Required Skills');
      sections.push('');
      sections.push('These skills are MANDATORY for this agent type:');
      sections.push('');

      for (const skillName of requiredSkills) {
        const content = skillContents[skillName];

        if (content) {
          sections.push(`### Skill: ${skillName}`);
          sections.push('');
          sections.push(content);
          sections.push('');
          sections.push('---');
          sections.push('');
        } else {
          sections.push(`### Skill: ${skillName}`);
          sections.push('');
          sections.push(`*Warning: SKILL.md content not available for ${skillName}*`);
          sections.push('');
          sections.push('---');
          sections.push('');
        }
      }
    }

    // Triggered Skills Section
    if (triggeredSkills.length > 0) {
      sections.push('## Triggered Skills');
      sections.push('');
      sections.push('These skills were triggered based on task description:');
      sections.push('');

      for (const skillName of triggeredSkills) {
        const content = skillContents[skillName];

        if (content) {
          sections.push(`### Skill: ${skillName}`);
          sections.push('');
          sections.push(content);
          sections.push('');
          sections.push('---');
          sections.push('');
        } else {
          sections.push(`### Skill: ${skillName}`);
          sections.push('');
          sections.push(`*Warning: SKILL.md content not available for ${skillName}*`);
          sections.push('');
          sections.push('---');
          sections.push('');
        }
      }
    }

    if (requiredSkills.length === 0 && triggeredSkills.length === 0) {
      sections.push('*No skills injected for this agent type.*');
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Main injection function - injects skills for agent based on task
 *
 * @param {string} agentType - Agent type (e.g., 'developer', 'orchestrator')
 * @param {string} taskDescription - Task description for trigger detection (optional)
 * @param {Object} options - Additional options
 * @param {boolean} options.includeRecommended - Include recommended skills (default: false)
 * @param {boolean} options.useOptimizer - Use skill-context-optimizer for context efficiency (default: false)
 * @param {string} options.contextLevel - Optimization level (MINIMAL, ESSENTIAL, STANDARD, FULL)
 * @param {number} options.maxSkillTokens - Maximum token budget for skills (default: 1000)
 * @param {boolean} options.isSubagent - Whether this is a subagent context (default: true)
 * @returns {Promise<Object>} Injection result
 */
export async function injectSkillsForAgent(agentType, taskDescription = '', options = {}) {
  const startTime = Date.now();
  const {
    includeRecommended = false,
    useOptimizer = false,
    contextLevel = 'ESSENTIAL',
    maxSkillTokens = 1000,
    isSubagent = true,
  } = options;

  try {
    // 1. Load skill matrix
    const matrix = await loadSkillMatrix();

    // 2. Get agent's skills configuration
    const agentSkills = await getSkillsForAgent(agentType);

    // 3. Detect triggered skills from task description
    const triggeredSkills = detectTriggeredSkills(agentSkills.skillTriggers, taskDescription);

    // 4. Collect all skills to load
    const skillsToLoad = new Set([...agentSkills.requiredSkills, ...triggeredSkills]);

    // Optionally include recommended skills
    if (includeRecommended) {
      agentSkills.recommendedSkills.forEach(skill => skillsToLoad.add(skill));
    }

    // 5. Load SKILL.md content for all skills OR use optimizer
    let skillContents = {};
    let optimizedSkills = null;
    const loadedSkills = [];
    const failedSkills = [];

    if (useOptimizer) {
      // Use skill-context-optimizer for progressive disclosure
      try {
        const { optimizeSkillContext } = await import('./skill-context-optimizer.mjs');

        optimizedSkills = await optimizeSkillContext(agentSkills.requiredSkills, triggeredSkills, {
          level: contextLevel,
          maxTokens: maxSkillTokens,
          prioritize: 'required',
        });

        // Track loaded skills from optimizer
        loadedSkills.push(...optimizedSkills.skills.map(s => s.skill));
      } catch (error) {
        console.warn(`Warning: Optimizer failed, falling back to full content: ${error.message}`);
        // Fall back to legacy full content loading
        for (const skillName of skillsToLoad) {
          const content = await loadSkillContent(skillName);
          if (content) {
            skillContents[skillName] = content;
            loadedSkills.push(skillName);
          } else {
            failedSkills.push(skillName);
          }
        }
      }
    } else {
      // Legacy: Load full SKILL.md content with context:fork filtering
      for (const skillName of skillsToLoad) {
        // Check if skill has context:fork: true (or if this is master context)
        const metadata = await loadSkillMetadata(skillName);

        // Only inject if context:fork is true OR this is not a subagent context
        if (isSubagent && !metadata.contextFork) {
          console.warn(`⏭️  Skipping ${skillName}: context:fork is false (subagent context)`);
          failedSkills.push(skillName);
          continue;
        }

        const content = await loadSkillContent(skillName);

        if (content) {
          skillContents[skillName] = content;
          loadedSkills.push(skillName);
        } else {
          failedSkills.push(skillName);
        }
      }
    }

    // 6. Generate skill injection prompt
    const skillPrompt = generateSkillPrompt(
      agentType,
      agentSkills.requiredSkills,
      triggeredSkills,
      skillContents,
      {
        useOptimizer,
        optimizedSkills,
      }
    );

    // 7. Return injection result
    const endTime = Date.now();

    return {
      success: true,
      agentType,
      taskDescription,
      requiredSkills: agentSkills.requiredSkills,
      recommendedSkills: agentSkills.recommendedSkills,
      triggeredSkills,
      loadedSkills,
      failedSkills,
      skillPrompt,
      metadata: {
        totalSkills: skillsToLoad.size,
        loadedAt: new Date().toISOString(),
        loadTimeMs: endTime - startTime,
        includeRecommended,
      },
      agentConfig: {
        description: agentSkills.description,
        usageNotes: agentSkills.usageNotes,
      },
    };
  } catch (error) {
    return {
      success: false,
      agentType,
      taskDescription,
      error: error.message,
      requiredSkills: [],
      recommendedSkills: [],
      triggeredSkills: [],
      loadedSkills: [],
      failedSkills: [],
      skillPrompt: '',
      metadata: {
        totalSkills: 0,
        loadedAt: new Date().toISOString(),
        loadTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * List all available agents from skill matrix
 * @returns {Promise<string[]>} Array of agent types
 */
export async function listAvailableAgents() {
  const matrix = await loadSkillMatrix();
  return Object.keys(matrix.agents);
}

/**
 * Get skill categories from matrix
 * @returns {Promise<Object>} Skill categories mapping
 */
export async function getSkillCategories() {
  const matrix = await loadSkillMatrix();
  return matrix.skill_categories || {};
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Help command
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Skill Injector - Core infrastructure for Phase 2 skill orchestration

Usage:
  node skill-injector.mjs --agent <type> [--task "<description>"] [--recommended]
  node skill-injector.mjs --list-agents
  node skill-injector.mjs --list-categories
  node skill-injector.mjs --help

Options:
  --agent <type>          Agent type (e.g., developer, orchestrator)
  --task "<description>"  Task description for trigger detection (optional)
  --recommended           Include recommended skills in addition to required
  --optimize              Use skill-context-optimizer for token efficiency
  --context-level <level> Optimization level (MINIMAL, ESSENTIAL, STANDARD, FULL)
  --max-tokens <n>        Maximum token budget for skills (default: 1000)
  --list-agents           List all available agent types
  --list-categories       List all skill categories
  --json                  Output results as JSON
  --help, -h              Show this help message

Examples:
  # Inject skills for developer with task
  node skill-injector.mjs --agent developer --task "Create new UserProfile component"

  # Inject skills for orchestrator (required only)
  node skill-injector.mjs --agent orchestrator

  # List all available agents
  node skill-injector.mjs --list-agents

  # Get JSON output
  node skill-injector.mjs --agent qa --task "Test authentication flow" --json

  # Use optimizer with ESSENTIAL level
  node skill-injector.mjs --agent developer --optimize --context-level ESSENTIAL

  # Use optimizer with custom token budget
  node skill-injector.mjs --agent orchestrator --optimize --max-tokens 500
`);
    process.exit(0);
  }

  // List agents command
  if (args.includes('--list-agents')) {
    try {
      const agents = await listAvailableAgents();
      console.log('Available agent types:');
      agents.forEach(agent => console.log(`  - ${agent}`));
      process.exit(0);
    } catch (error) {
      console.error('Error listing agents:', error.message);
      process.exit(1);
    }
  }

  // List categories command
  if (args.includes('--list-categories')) {
    try {
      const categories = await getSkillCategories();
      console.log('Skill categories:');
      for (const [category, skills] of Object.entries(categories)) {
        console.log(`\n${category}:`);
        skills.forEach(skill => console.log(`  - ${skill}`));
      }
      process.exit(0);
    } catch (error) {
      console.error('Error listing categories:', error.message);
      process.exit(1);
    }
  }

  // Main injection command
  const agentIndex = args.indexOf('--agent');
  const taskIndex = args.indexOf('--task');
  const includeRecommended = args.includes('--recommended');
  const useOptimizer = args.includes('--optimize');
  const jsonOutput = args.includes('--json');

  const contextLevelIndex = args.indexOf('--context-level');
  const contextLevel =
    contextLevelIndex !== -1 && contextLevelIndex + 1 < args.length
      ? args[contextLevelIndex + 1]
      : 'ESSENTIAL';

  const maxTokensIndex = args.indexOf('--max-tokens');
  const maxSkillTokens =
    maxTokensIndex !== -1 && maxTokensIndex + 1 < args.length
      ? parseInt(args[maxTokensIndex + 1])
      : 1000;

  if (agentIndex === -1 || agentIndex + 1 >= args.length) {
    console.error('Error: --agent <type> is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  const agentType = args[agentIndex + 1];
  const taskDescription =
    taskIndex !== -1 && taskIndex + 1 < args.length ? args[taskIndex + 1] : '';

  try {
    const result = await injectSkillsForAgent(agentType, taskDescription, {
      includeRecommended,
      useOptimizer,
      contextLevel,
      maxSkillTokens,
    });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.success) {
        console.log(`✓ Skills injected for agent: ${result.agentType}`);
        console.log(`\nRequired Skills (${result.requiredSkills.length}):`);
        result.requiredSkills.forEach(skill => console.log(`  - ${skill}`));

        if (result.triggeredSkills.length > 0) {
          console.log(`\nTriggered Skills (${result.triggeredSkills.length}):`);
          result.triggeredSkills.forEach(skill => console.log(`  - ${skill}`));
        }

        if (result.recommendedSkills.length > 0 && includeRecommended) {
          console.log(`\nRecommended Skills (${result.recommendedSkills.length}):`);
          result.recommendedSkills.forEach(skill => console.log(`  - ${skill}`));
        }

        console.log(
          `\nLoaded: ${result.loadedSkills.length}/${result.metadata.totalSkills} skills`
        );

        if (result.failedSkills.length > 0) {
          console.log(`\nWarning: Failed to load ${result.failedSkills.length} skill(s):`);
          result.failedSkills.forEach(skill => console.log(`  - ${skill}`));
        }

        console.log(`\nLoad time: ${result.metadata.loadTimeMs}ms`);
        console.log(`\nSkill prompt generated (${result.skillPrompt.length} characters)`);

        if (!jsonOutput && process.env.VERBOSE === 'true') {
          console.log('\n--- Skill Prompt Preview ---\n');
          console.log(result.skillPrompt.substring(0, 500) + '...');
        }
      } else {
        console.error(`✗ Failed to inject skills: ${result.error}`);
        process.exit(1);
      }
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: error.message,
          },
          null,
          2
        )
      );
    }
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export all functions for programmatic use
export default {
  loadSkillMatrix,
  getSkillsForAgent,
  loadSkillContent,
  injectSkillsForAgent,
  listAvailableAgents,
  getSkillCategories,
};
