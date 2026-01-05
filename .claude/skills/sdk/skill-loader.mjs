#!/usr/bin/env node
/**
 * Skill Loader - Loads and initializes skills with auto-selection and caching
 * Helper for loading skill configurations with intelligent selection
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for skill instructions
const skillCache = new Map();
const skillMetadataCache = new Map();

// Cache file path
const CACHE_DIR = join(__dirname, '../../context/cache');
const CACHE_FILE = join(CACHE_DIR, 'skill-cache.json');

/**
 * Load cache from disk
 */
async function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      const cacheData = await readFile(CACHE_FILE, 'utf8');
      const cache = JSON.parse(cacheData);
      skillCache.clear();
      skillMetadataCache.clear();
      
      for (const [key, value] of Object.entries(cache.skills || {})) {
        skillCache.set(key, value);
      }
      for (const [key, value] of Object.entries(cache.metadata || {})) {
        skillMetadataCache.set(key, value);
      }
    }
  } catch (error) {
    // Cache load failed, continue without cache
  }
}

/**
 * Save cache to disk
 */
async function saveCache() {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const cacheData = {
      skills: Object.fromEntries(skillCache),
      metadata: Object.fromEntries(skillMetadataCache),
      timestamp: new Date().toISOString()
    };
    await writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    // Cache save failed, continue without persistence
  }
}

// Load cache on module load
loadCache().catch(() => {});

/**
 * Load skill metadata (YAML frontmatter)
 */
async function loadSkillMetadata(skillName) {
  // Check cache first
  if (skillMetadataCache.has(skillName)) {
    return skillMetadataCache.get(skillName);
  }
  
  const skillPath = join(__dirname, `../${skillName}/SKILL.md`);
  
  try {
    const content = await readFile(skillPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const metadata = {};
      
      // Simple YAML parsing (for production, use a proper YAML parser)
      for (const line of frontmatter.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2].trim();
          
          // Try to parse as boolean or number
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = Number(value);
          
          metadata[key] = value;
        }
      }
      
      skillMetadataCache.set(skillName, metadata);
      await saveCache();
      return metadata;
    }
    
    return {};
  } catch (error) {
    return {};
  }
}

/**
 * Load skill instructions
 */
export async function loadSkillInstructions(skillName, useCache = true) {
  // Check cache first
  if (useCache && skillCache.has(skillName)) {
    return skillCache.get(skillName);
  }
  
  const skillPath = join(__dirname, `../${skillName}/SKILL.md`);
  
  try {
    const content = await readFile(skillPath, 'utf8');
    // Extract content after YAML frontmatter
    const frontmatterEnd = content.indexOf('---', 3);
    const instructions = frontmatterEnd !== -1
      ? content.substring(frontmatterEnd + 3).trim()
      : content;
    
    // Cache the instructions
    if (useCache) {
      skillCache.set(skillName, instructions);
      await saveCache();
    }
    
    return instructions;
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
    .filter(entry => entry.isDirectory() && entry.name !== 'sdk')
    .map(entry => entry.name);
}

/**
 * Auto-select skills based on query
 */
export async function autoSelectSkills(query, maxResults = 5) {
  const allSkills = await getAllSkillNames();
  const scores = [];
  
  // Load metadata for all skills
  const skillMetadata = await Promise.all(
    allSkills.map(async (skillName) => {
      const metadata = await loadSkillMetadata(skillName);
      return { name: skillName, metadata };
    })
  );
  
  // Score skills based on query
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  for (const { name, metadata } of skillMetadata) {
    let score = 0;
    
    // Check name match
    if (name.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Check description match
    const description = (metadata.description || '').toLowerCase();
    for (const word of queryWords) {
      if (description.includes(word)) {
        score += 5;
      }
    }
    
    // Check allowed-tools match
    const allowedTools = (metadata['allowed-tools'] || '').toLowerCase();
    for (const word of queryWords) {
      if (allowedTools.includes(word)) {
        score += 3;
      }
    }
    
    scores.push({ name, score, metadata });
  }
  
  // Sort by score and return top results
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, maxResults).map(s => s.name);
}

/**
 * Clear skill cache
 */
export async function clearCache() {
  skillCache.clear();
  skillMetadataCache.clear();
  try {
    if (existsSync(CACHE_FILE)) {
      await writeFile(CACHE_FILE, '{}', 'utf8');
    }
  } catch (error) {
    // Ignore cache clear errors
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    skillsCached: skillCache.size,
    metadataCached: skillMetadataCache.size,
    cacheFile: CACHE_FILE
  };
}

export default {
  loadSkillInstructions,
  loadSkillMetadata,
  getAllSkillNames,
  autoSelectSkills,
  clearCache,
  getCacheStats
};

