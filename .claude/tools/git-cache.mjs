#!/usr/bin/env node
/**
 * Git Diff Caching Module
 *
 * Caches git diff results to avoid redundant git operations.
 * Especially useful for code review and validation workflows that
 * repeatedly query the same diffs.
 *
 * Performance Impact: ~100ms saved per redundant git diff call
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(process.cwd(), '.claude/context/cache/git');
const DEFAULT_TTL_MS = 300000; // 5 minutes (git state changes frequently)

// In-memory cache for faster access within same process
const memoryCache = new Map();

/**
 * Generate cache key from git diff parameters
 * @param {string} baseRef - Base commit/branch reference
 * @param {string} headRef - Head commit/branch reference (optional, defaults to HEAD)
 * @param {Object} options - Additional diff options
 * @returns {string} Cache key
 */
function getCacheKey(baseRef, headRef = 'HEAD', options = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(baseRef);
  hash.update(headRef);
  hash.update(JSON.stringify(options));
  return hash.digest('hex').substring(0, 16); // Shorter key for filename
}

/**
 * Get current HEAD commit hash
 * @returns {string|null} Current HEAD commit hash
 */
export function getCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get commit hash for a reference
 * @param {string} ref - Git reference (branch, tag, commit)
 * @returns {string|null} Resolved commit hash
 */
export function resolveRef(ref) {
  try {
    return execSync(`git rev-parse ${ref}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Check if cached diff is still valid
 * Uses commit hash to detect if git state has changed
 * @param {Object} cached - Cached diff entry
 * @returns {boolean} Whether cache is still valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.baseCommit || !cached.headCommit) {
    return false;
  }

  // Check if commits still exist and match
  const currentBase = resolveRef(cached.baseRef);
  const currentHead = resolveRef(cached.headRef);

  return currentBase === cached.baseCommit && currentHead === cached.headCommit;
}

/**
 * Get cached git diff result
 * @param {string} baseRef - Base commit/branch reference
 * @param {string} headRef - Head commit/branch reference (optional, defaults to HEAD)
 * @param {Object} options - Additional options
 * @param {number} options.ttlMs - TTL in milliseconds (default: 5 minutes)
 * @param {boolean} options.skipValidation - Skip commit hash validation
 * @returns {Object|null} Cached diff result or null if not found/expired
 */
export function getCachedDiff(baseRef, headRef = 'HEAD', options = {}) {
  const { ttlMs = DEFAULT_TTL_MS, skipValidation = false } = options;
  const cacheKey = getCacheKey(baseRef, headRef, options);

  // Check memory cache first
  if (memoryCache.has(cacheKey)) {
    const memoryCached = memoryCache.get(cacheKey);
    const age = Date.now() - memoryCached.timestamp;

    if (age <= ttlMs) {
      if (skipValidation || isCacheValid(memoryCached)) {
        console.log(`[GitCache] Memory cache HIT for ${baseRef}...${headRef}`);
        return memoryCached.diff;
      }
    }

    // Expired or invalid - remove from memory cache
    memoryCache.delete(cacheKey);
  }

  // Check file cache
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  if (!fs.existsSync(cachePath)) {
    console.log(`[GitCache] Cache MISS for ${baseRef}...${headRef}`);
    return null;
  }

  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const age = Date.now() - cached.timestamp;

    if (age > ttlMs) {
      // Expired - delete cache file
      fs.unlinkSync(cachePath);
      console.log(`[GitCache] Cache EXPIRED for ${baseRef}...${headRef}`);
      return null;
    }

    // Validate commit hashes
    if (!skipValidation && !isCacheValid(cached)) {
      fs.unlinkSync(cachePath);
      console.log(`[GitCache] Cache INVALIDATED (commits changed) for ${baseRef}...${headRef}`);
      return null;
    }

    // Cache hit - also store in memory for faster subsequent access
    memoryCache.set(cacheKey, cached);
    console.log(`[GitCache] File cache HIT for ${baseRef}...${headRef}`);

    return cached.diff;
  } catch (error) {
    console.warn(`[GitCache] Error reading cache: ${error.message}`);
    return null;
  }
}

/**
 * Cache git diff result
 * @param {string} baseRef - Base commit/branch reference
 * @param {string} headRef - Head commit/branch reference
 * @param {Object} diff - Diff result to cache
 * @param {Object} options - Additional options
 */
export function setCachedDiff(baseRef, headRef, diff, options = {}) {
  const cacheKey = getCacheKey(baseRef, headRef, options);

  const cacheEntry = {
    baseRef,
    headRef,
    baseCommit: resolveRef(baseRef),
    headCommit: resolveRef(headRef),
    diff,
    timestamp: Date.now(),
    options
  };

  // Store in memory cache
  memoryCache.set(cacheKey, cacheEntry);

  // Store in file cache
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(CACHE_DIR, `${cacheKey}.json`),
      JSON.stringify(cacheEntry, null, 2)
    );
    console.log(`[GitCache] Cached diff for ${baseRef}...${headRef}`);
  } catch (error) {
    console.warn(`[GitCache] Error writing cache: ${error.message}`);
  }
}

/**
 * Execute git diff with caching
 * @param {string} baseRef - Base commit/branch reference
 * @param {string} headRef - Head commit/branch reference (optional, defaults to HEAD)
 * @param {Object} options - Diff options
 * @param {boolean} options.stat - Include stat summary (--stat)
 * @param {boolean} options.nameOnly - Only show file names (--name-only)
 * @param {boolean} options.nameStatus - Show file names with status (--name-status)
 * @param {string} options.path - Limit diff to specific path
 * @param {boolean} options.noCache - Skip caching
 * @returns {Object} Diff result
 */
export function gitDiff(baseRef, headRef = 'HEAD', options = {}) {
  const { stat = false, nameOnly = false, nameStatus = false, path: diffPath = '', noCache = false } = options;

  // Try cache first
  if (!noCache) {
    const cached = getCachedDiff(baseRef, headRef, options);
    if (cached) {
      return cached;
    }
  }

  // Build git diff command
  let cmd = `git diff ${baseRef}...${headRef}`;

  if (stat) cmd += ' --stat';
  if (nameOnly) cmd += ' --name-only';
  if (nameStatus) cmd += ' --name-status';
  if (diffPath) cmd += ` -- ${diffPath}`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const result = {
      baseRef,
      headRef,
      output: output.trim(),
      files: parseFilesFromDiff(output, { nameOnly, nameStatus }),
      stats: stat ? parseStats(output) : null,
      command: cmd,
      executedAt: new Date().toISOString()
    };

    // Cache result
    if (!noCache) {
      setCachedDiff(baseRef, headRef, result, options);
    }

    return result;
  } catch (error) {
    throw new Error(`Git diff failed: ${error.message}`);
  }
}

/**
 * Parse file list from diff output
 */
function parseFilesFromDiff(output, options = {}) {
  const { nameOnly = false, nameStatus = false } = options;

  if (!output) return [];

  if (nameOnly) {
    return output.split('\n').filter(line => line.trim());
  }

  if (nameStatus) {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [status, file] = line.split('\t');
        return { status: status.trim(), file: file?.trim() };
      });
  }

  // Extract files from full diff output
  const files = [];
  const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  let match;

  while ((match = fileRegex.exec(output)) !== null) {
    files.push(match[2]);
  }

  return files;
}

/**
 * Parse stats from diff output
 */
function parseStats(output) {
  const statsMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

  if (statsMatch) {
    return {
      filesChanged: parseInt(statsMatch[1]) || 0,
      insertions: parseInt(statsMatch[2]) || 0,
      deletions: parseInt(statsMatch[3]) || 0
    };
  }

  return null;
}

/**
 * Clear git diff cache
 * @param {string|null} baseRef - Specific base ref to clear, or null for all
 */
export function clearCache(baseRef = null) {
  // Clear memory cache
  if (baseRef) {
    // Clear entries matching baseRef
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.baseRef === baseRef) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.clear();
  }

  // Clear file cache
  if (!fs.existsSync(CACHE_DIR)) {
    return;
  }

  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (baseRef) {
        // Check if file matches baseRef
        const filePath = path.join(CACHE_DIR, file);
        const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (cached.baseRef === baseRef) {
          fs.unlinkSync(filePath);
        }
      } else {
        // Clear all
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
  } catch (error) {
    console.warn(`[GitCache] Error clearing cache: ${error.message}`);
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  const stats = {
    memoryEntries: memoryCache.size,
    fileEntries: 0,
    totalSize: 0,
    oldestEntry: null,
    newestEntry: null
  };

  if (!fs.existsSync(CACHE_DIR)) {
    return stats;
  }

  try {
    const files = fs.readdirSync(CACHE_DIR);
    stats.fileEntries = files.length;

    let oldest = Infinity;
    let newest = 0;

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const fileStat = fs.statSync(filePath);
      stats.totalSize += fileStat.size;

      const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (cached.timestamp < oldest) {
        oldest = cached.timestamp;
        stats.oldestEntry = new Date(oldest).toISOString();
      }
      if (cached.timestamp > newest) {
        newest = cached.timestamp;
        stats.newestEntry = new Date(newest).toISOString();
      }
    }

    stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
  } catch (error) {
    console.warn(`[GitCache] Error getting stats: ${error.message}`);
  }

  return stats;
}

/**
 * Prune expired cache entries
 * @param {number} ttlMs - TTL in milliseconds (default: 5 minutes)
 * @returns {number} Number of entries pruned
 */
export function pruneExpiredCache(ttlMs = DEFAULT_TTL_MS) {
  let pruned = 0;

  // Prune memory cache
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.timestamp > ttlMs) {
      memoryCache.delete(key);
      pruned++;
    }
  }

  // Prune file cache
  if (!fs.existsSync(CACHE_DIR)) {
    return pruned;
  }

  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (now - cached.timestamp > ttlMs) {
        fs.unlinkSync(filePath);
        pruned++;
      }
    }
  } catch (error) {
    console.warn(`[GitCache] Error pruning cache: ${error.message}`);
  }

  return pruned;
}

export default {
  getCachedDiff,
  setCachedDiff,
  gitDiff,
  clearCache,
  getCacheStats,
  pruneExpiredCache,
  getCurrentCommit,
  resolveRef
};
