#!/usr/bin/env node
/**
 * Lazy Context Loader
 * Implements lazy loading for agent context files to reduce initial context usage.
 * Loads context files only when agents activate, caches them, and clears cache after completion.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// In-memory cache for loaded contexts
const contextCache = new Map();

/**
 * Load context files for an agent
 * @param {string} agentName - Name of the agent
 * @param {Array<string>} contextFiles - Array of context file paths
 * @returns {Promise<Object>} Loaded context content
 */
export async function loadAgentContext(agentName, contextFiles = []) {
  const cacheKey = `${agentName}:${contextFiles.join(',')}`;

  // Check cache first
  if (contextCache.has(cacheKey)) {
    const cached = contextCache.get(cacheKey);
    // Check if cache is still valid (files haven't changed)
    const isValid = await validateCache(cached, contextFiles);
    if (isValid) {
      return cached.content;
    }
    // Cache invalid, remove it
    contextCache.delete(cacheKey);
  }

  // Load context files
  const loadedContexts = {};
  const fileStats = {};

  for (const filePath of contextFiles) {
    const fullPath = path.join(ROOT, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      loadedContexts[filePath] = content;
      fileStats[filePath] = {
        mtime: stats.mtime.getTime(),
        size: stats.size,
      };
    } catch (error) {
      console.warn(`Warning: Could not load context file ${filePath}: ${error.message}`);
      loadedContexts[filePath] = null;
    }
  }

  // Cache the loaded contexts
  contextCache.set(cacheKey, {
    content: loadedContexts,
    fileStats,
    timestamp: Date.now(),
  });

  return loadedContexts;
}

/**
 * Validate cache is still valid (files haven't changed)
 * @param {Object} cached - Cached data
 * @param {Array<string>} contextFiles - Context file paths
 * @returns {Promise<boolean>} True if cache is valid
 */
async function validateCache(cached, contextFiles) {
  for (const filePath of contextFiles) {
    const fullPath = path.join(ROOT, filePath);
    try {
      const stats = await fs.stat(fullPath);
      const cachedStats = cached.fileStats[filePath];

      if (!cachedStats || stats.mtime.getTime() !== cachedStats.mtime) {
        return false;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
      return false;
    }
  }
  return true;
}

/**
 * Clear context cache for an agent
 * @param {string} agentName - Name of the agent (optional, clears all if not provided)
 */
export function clearAgentContext(agentName = null) {
  if (agentName) {
    // Clear cache for specific agent
    const keysToDelete = [];
    for (const key of contextCache.keys()) {
      if (key.startsWith(`${agentName}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => contextCache.delete(key));
  } else {
    // Clear all cache
    contextCache.clear();
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: contextCache.size,
    agents: Array.from(contextCache.keys()).map(key => key.split(':')[0]),
    memoryUsage: estimateMemoryUsage(),
  };
}

/**
 * Estimate memory usage of cache
 * @returns {number} Estimated memory usage in bytes
 */
function estimateMemoryUsage() {
  let total = 0;
  for (const value of contextCache.values()) {
    if (value.content) {
      for (const content of Object.values(value.content)) {
        if (content) {
          total += Buffer.byteLength(content, 'utf-8');
        }
      }
    }
  }
  return total;
}

/**
 * Load agent context based on config.yaml settings
 * @param {string} agentName - Name of the agent
 * @param {Object} agentConfig - Agent configuration from config.yaml
 * @returns {Promise<Object>} Loaded context content
 */
export async function loadAgentContextFromConfig(agentName, agentConfig) {
  const contextStrategy = agentConfig.context_strategy || 'eager';

  // Only lazy load if strategy is lazy_load
  if (contextStrategy !== 'lazy_load') {
    return {};
  }

  const contextFiles = agentConfig.context_files || [];

  if (contextFiles.length === 0) {
    return {};
  }

  return await loadAgentContext(agentName, contextFiles);
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'clear') {
    const agentName = process.argv[3];
    clearAgentContext(agentName);
    console.log(`Cache cleared${agentName ? ` for ${agentName}` : ' (all)'}`);
  } else if (command === 'stats') {
    const stats = getCacheStats();
    console.log('Context Cache Statistics:');
    console.log(`  Size: ${stats.size} entries`);
    console.log(`  Agents: ${stats.agents.join(', ')}`);
    console.log(`  Memory Usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
  } else {
    console.log('Usage:');
    console.log('  node lazy-context-loader.mjs clear [agentName]  - Clear cache');
    console.log('  node lazy-context-loader.mjs stats              - Show cache statistics');
  }
}
