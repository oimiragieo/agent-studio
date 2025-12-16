#!/usr/bin/env node
/**
 * Skill Loader - Loads and initializes skills
 * Helper for loading skill configurations
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load skill instructions
 */
export async function loadSkillInstructions(skillName) {
  const skillPath = join(__dirname, `../${skillName}/SKILL.md`);
  
  try {
    const content = await readFile(skillPath, 'utf8');
    // Extract content after YAML frontmatter
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
      return content.substring(frontmatterEnd + 3).trim();
    }
    return content;
  } catch (error) {
    throw new Error(`Failed to load skill instructions for ${skillName}: ${error.message}`);
  }
}

/**
 * Get all skill names
 */
export async function getAllSkillNames() {
  const skillsDir = join(__dirname, '../');
  const entries = await readdir(skillsDir, { withFileTypes: true });
  
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

export default {
  loadSkillInstructions,
  getAllSkillNames
};

