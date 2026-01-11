#!/usr/bin/env node
/**
 * Skill Registry - Agent SDK Skills Integration
 * Registers and manages skills using SDK patterns
 * Based on: https://docs.claude.com/en/docs/agent-sdk/skills.md
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const skillsRegistry = new Map();

/**
 * Parse skill from markdown file
 */
function parseSkillMarkdown(content) {
  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Invalid skill format: missing YAML frontmatter');
  }

  const frontmatter = frontmatterMatch[1];
  const instructions = frontmatterMatch[2].trim();

  // Parse YAML (simplified - would use js-yaml in production)
  const metadata = {};
  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''));
      }

      metadata[key] = value;
    }
  }

  return {
    name: metadata.name,
    description: metadata.description,
    instructions,
    allowedTools: metadata['allowed-tools'] || [],
    version: metadata.version || '1.0.0',
    bestPractices: metadata.best_practices || [],
    errorHandling: metadata.error_handling || 'graceful',
    streaming: metadata.streaming === 'supported',
    outputFormats: metadata.output_formats || ['markdown'],
  };
}

/**
 * Load skill from file
 */
async function loadSkillFromFile(skillPath) {
  const content = await readFile(skillPath, 'utf8');
  return parseSkillMarkdown(content);
}

/**
 * Register a skill
 */
export async function registerSkill(skillName) {
  if (skillsRegistry.has(skillName)) {
    return skillsRegistry.get(skillName);
  }

  const skillPath = join(__dirname, `../${skillName}/SKILL.md`);

  try {
    const skill = await loadSkillFromFile(skillPath);
    skillsRegistry.set(skillName, skill);
    return skill;
  } catch (error) {
    throw new Error(`Failed to load skill ${skillName}: ${error.message}`);
  }
}

/**
 * Get all available skills
 */
export async function getAllSkills() {
  const skillsDir = join(__dirname, '../');
  const entries = await readdir(skillsDir, { withFileTypes: true });

  const skillNames = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

  const skills = [];
  for (const skillName of skillNames) {
    try {
      const skill = await registerSkill(skillName);
      skills.push(skill);
    } catch (error) {
      // Skip skills that fail to load
      console.warn(`Failed to load skill ${skillName}: ${error.message}`);
    }
  }

  return skills;
}

/**
 * Get skill by name
 */
export function getSkill(skillName) {
  return skillsRegistry.get(skillName) || null;
}

/**
 * Register skill with SDK
 * Note: Full implementation would use: import { Skill } from '@anthropic-ai/sdk';
 */
export async function registerSkillWithSDK(skillName) {
  const skill = await registerSkill(skillName);

  // In production, this would use SDK Skill class:
  // return new Skill({
  //   name: skill.name,
  //   description: skill.description,
  //   instructions: skill.instructions,
  //   allowed_tools: skill.allowedTools,
  //   version: skill.version
  // });

  // For now, create SDK-compatible skill object
  return {
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    allowed_tools: skill.allowedTools,
    version: skill.version,
    metadata: {
      bestPractices: skill.bestPractices,
      errorHandling: skill.errorHandling,
      streaming: skill.streaming,
      outputFormats: skill.outputFormats,
    },
    registered_at: new Date().toISOString(),
  };
}

/**
 * Initialize all skills on startup
 */
export async function initializeSkills() {
  const skillsDir = join(__dirname, '../');
  const entries = await readdir(skillsDir, { withFileTypes: true });

  const skillDirs = entries
    .filter(entry => entry.isDirectory() && entry.name !== 'sdk')
    .map(entry => entry.name);

  const initialized = [];
  for (const skillName of skillDirs) {
    try {
      const skill = await registerSkillWithSDK(skillName);
      initialized.push(skill);
    } catch (error) {
      console.warn(`Failed to initialize skill ${skillName}: ${error.message}`);
    }
  }

  return initialized;
}

/**
 * Invoke skill with proper context
 */
export async function invokeSkill(skillName, input, context = {}) {
  const skill = await registerSkill(skillName);

  if (!skill) {
    throw new Error(`Skill ${skillName} not found`);
  }

  // In production, this would use SDK skill invocation
  // For now, return skill metadata and instructions
  return {
    skill: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    input: input,
    context: context,
    invoked_at: new Date().toISOString(),
  };
}

/**
 * Create SDK skill instance
 * Note: Full implementation would use SDK Skill class
 */
export function createSDKSkill(skillConfig) {
  return {
    name: skillConfig.name,
    description: skillConfig.description,
    instructions: skillConfig.instructions,
    tools: skillConfig.allowedTools,
    version: skillConfig.version,
    metadata: {
      bestPractices: skillConfig.bestPractices,
      errorHandling: skillConfig.errorHandling,
      streaming: skillConfig.streaming,
      outputFormats: skillConfig.outputFormats,
    },
  };
}

export default {
  registerSkill,
  getAllSkills,
  getSkill,
  createSDKSkill,
  registerSkillWithSDK,
  initializeSkills,
  invokeSkill,
};
