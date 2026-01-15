#!/usr/bin/env node
/**
 * Subagent Context Loader
 * Lazy loads agent-specific context on activation with caching and unloading
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../config.yaml');
function getCacheFilePath(options = { read: false }) {
  return resolveRuntimePath('cache/loaded-context.json', options);
}
const MAX_CACHE_AGE = 3600000; // 1 hour in milliseconds

const contextCache = new Map();

/**
 * Load context files for an agent
 */
export function loadAgentContext(agentName) {
  // Check cache first
  const cached = getCachedContext(agentName);
  if (cached) {
    return cached;
  }

  // Load config
  const config = loadConfig();
  const agentConfig = config.agent_routing?.[agentName];

  if (!agentConfig || !agentConfig.context_files) {
    return {
      agent: agentName,
      files: [],
      loaded: false,
      message: 'No context files configured for this agent',
    };
  }

  // Load context files
  const contextFiles = [];
  const projectRoot = path.join(__dirname, '../..');

  agentConfig.context_files.forEach(filePath => {
    const fullPath = path.join(projectRoot, filePath);

    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const stats = fs.statSync(fullPath);

        contextFiles.push({
          path: filePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          content: content.substring(0, 1000) + '...', // Preview only
        });
      } catch (error) {
        console.warn(`⚠️  Error reading context file ${filePath}: ${error.message}`);
        console.warn(`   Full path: ${fullPath}`);
      }
    } else {
      console.warn(`⚠️  Context file not found: ${filePath}`);
      console.warn(`   Expected at: ${fullPath}`);
      console.warn(`   Suggestion: Check if the file path is correct in config.yaml`);
    }
  });

  const result = {
    agent: agentName,
    files: contextFiles,
    loaded: true,
    timestamp: new Date().toISOString(),
    totalSize: contextFiles.reduce((sum, f) => sum + f.size, 0),
  };

  // Cache result
  cacheContext(agentName, result);

  return result;
}

/**
 * Unload context for an agent
 */
export function unloadAgentContext(agentName) {
  contextCache.delete(agentName);
  clearCachedContext(agentName);

  return {
    agent: agentName,
    unloaded: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get list of all agents with context files
 */
export function listAgentsWithContext() {
  const config = loadConfig();
  const agents = [];

  Object.entries(config.agent_routing || {}).forEach(([name, config]) => {
    if (config.context_files && config.context_files.length > 0) {
      agents.push({
        name,
        contextFiles: config.context_files,
        strategy: config.context_strategy || 'lazy_load',
      });
    }
  });

  return agents;
}

/**
 * Load config file
 */
function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return yaml.load(content);
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
}

/**
 * Get cached context
 */
function getCachedContext(agentName) {
  // Check in-memory cache
  if (contextCache.has(agentName)) {
    return contextCache.get(agentName);
  }

  // Check file cache
  try {
    const cacheFile = getCacheFilePath({ read: true });
    if (fs.existsSync(cacheFile)) {
      let cache;
      try {
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        cache = JSON.parse(cacheContent);
      } catch (error) {
        console.warn(`⚠️  Invalid JSON in cache file ${cacheFile}: ${error.message}`);
        console.warn(`   Cache file will be regenerated on next save.`);
        return null;
      }

      const cached = cache[agentName];

      if (cached) {
        const age = Date.now() - new Date(cached.timestamp).getTime();
        if (age < MAX_CACHE_AGE) {
          contextCache.set(agentName, cached);
          return cached;
        }
      }
    }
  } catch (error) {
    // Cache file doesn't exist or is invalid
    console.warn(`⚠️  Error reading cache file: ${error.message}`);
  }

  return null;
}

/**
 * Cache context
 */
function cacheContext(agentName, context) {
  // In-memory cache
  contextCache.set(agentName, context);

  // File cache
  try {
    const cacheFile = getCacheFilePath({ read: false });
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let cache = {};
    if (fs.existsSync(cacheFile)) {
      try {
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        cache = JSON.parse(cacheContent);
      } catch (error) {
        console.warn(`⚠️  Invalid JSON in cache file ${cacheFile}: ${error.message}`);
        console.warn(`   Starting with empty cache.`);
        cache = {};
      }
    }

    cache[agentName] = context;

    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error caching context for ${agentName}: ${error.message}`);
    console.error(`   File: ${getCacheFilePath({ read: false })}`);
  }
}

/**
 * Clear cached context
 */
function clearCachedContext(agentName) {
  try {
    const cacheReadFile = getCacheFilePath({ read: true });
    const cacheWriteFile = getCacheFilePath({ read: false });
    if (fs.existsSync(cacheReadFile)) {
      let cache;
      try {
        const cacheContent = fs.readFileSync(cacheReadFile, 'utf8');
        cache = JSON.parse(cacheContent);
      } catch (error) {
        console.warn(`⚠️  Invalid JSON in cache file ${cacheReadFile}: ${error.message}`);
        console.warn(`   Skipping cache clear.`);
        return;
      }

      delete cache[agentName];
      fs.writeFileSync(cacheWriteFile, JSON.stringify(cache, null, 2), 'utf8');
    }
  } catch (error) {
    console.warn(`⚠️  Error clearing cache for ${agentName}: ${error.message}`);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const agentName = process.argv[3];

  if (command === 'load' && agentName) {
    const result = loadAgentContext(agentName);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'unload' && agentName) {
    const result = unloadAgentContext(agentName);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'list') {
    const agents = listAgentsWithContext();
    console.log(JSON.stringify(agents, null, 2));
  } else {
    console.log('Usage: subagent-context-loader.mjs [load|unload|list] [agent-name]');
  }
}
