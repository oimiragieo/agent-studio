#!/usr/bin/env node
/**
 * Artifact Cache
 * Dual-purpose caching system:
 * 1. File-based caching: Caches artifacts from disk with TTL to speed up file I/O
 * 2. Workflow-based caching: Caches workflow step outputs to avoid redundant executions
 * Invalidates cache on file changes and supports LRU eviction.
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Dual cache system: file-based + workflow-based
const artifactCache = new Map(); // File path → cached artifact
const workflowCache = new Map(); // Cache key → workflow output

// Default TTL: 5 minutes for files, 1 hour for workflows
const DEFAULT_FILE_TTL = 5 * 60 * 1000;
const DEFAULT_WORKFLOW_TTL = 60 * 60 * 1000;

// Cache limits
const MAX_CACHE_SIZE = 500; // Maximum entries per cache
const MAX_CACHE_MEMORY_MB = 50; // Maximum memory usage in MB per cache

// Cache directory for persistent workflow cache
const CACHE_DIR = path.join(ROOT, '.claude/context/cache');

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists or creation failed
  }
}

/**
 * Estimate size of data in bytes (simplified for performance and accuracy)
 * Uses string length as a proxy to avoid recursion overhead
 * @param {*} data - Data to estimate size of
 * @returns {number} Estimated size in bytes
 */
function estimateSize(data) {
  if (data === null || data === undefined) return 8;

  const type = typeof data;

  // Primitives
  if (type === 'string') return data.length * 2; // UTF-16 encoding
  if (type === 'number') return 8; // 64-bit number
  if (type === 'boolean') return 8; // Boolean + overhead

  // Objects and arrays - use JSON string length as proxy
  // This is faster and more accurate than recursive estimation
  try {
    const str = JSON.stringify(data);
    // Approximate memory: string length + object overhead
    // JSON.stringify gives us character count, multiply by 2 for UTF-16
    return str ? str.length * 2 : 16;
  } catch {
    // Circular reference or other error - return small estimate
    return 16;
  }
}

/**
 * Generate cache key from workflow and inputs
 * @param {string} workflowId - Workflow identifier
 * @param {number} stepNumber - Step number
 * @param {Object} inputs - Input parameters
 * @returns {string} SHA-256 hash key
 */
export function generateKey(workflowId, stepNumber, inputs) {
  const data = JSON.stringify({ workflowId, stepNumber, inputs });
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Prune cache to maintain size limits (LRU eviction)
 * @param {Map} cache - Cache to prune
 * @param {string} cacheName - Name for logging
 * @returns {number} Number of entries removed
 */
function pruneCache(cache, cacheName = 'Cache') {
  // Check if we need to prune based on entry count
  let needsPrune = cache.size > MAX_CACHE_SIZE;

  if (!needsPrune) {
    // Check memory usage
    let totalMemory = 0;
    for (const cached of cache.values()) {
      totalMemory += estimateSize(cached.data || cached.artifact);
    }

    const memoryMB = totalMemory / 1024 / 1024;
    needsPrune = memoryMB > MAX_CACHE_MEMORY_MB;
  }

  if (!needsPrune) {
    return 0;
  }

  // Sort by access time (LRU)
  const entries = Array.from(cache.entries())
    .map(([key, value]) => ({
      key,
      timestamp: value.cachedAt || 0,
      size: estimateSize(value.data || value.artifact),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  let removed = 0;
  let freedMB = 0;
  const targetSize = Math.floor(MAX_CACHE_SIZE * 0.8); // Remove to 80% of max

  for (const entry of entries) {
    if (cache.size <= targetSize) {
      // Check if we've freed enough memory
      let currentMemory = 0;
      for (const cached of cache.values()) {
        currentMemory += estimateSize(cached.data || cached.artifact);
      }
      const currentMemoryMB = currentMemory / 1024 / 1024;
      if (currentMemoryMB <= MAX_CACHE_MEMORY_MB * 0.8) {
        break;
      }
    }

    cache.delete(entry.key);
    removed++;
    freedMB += entry.size / 1024 / 1024;
  }

  if (removed > 0) {
    console.log(
      `[${cacheName}] Pruned ${removed} entries (freed ${freedMB.toFixed(2)}MB), cache size: ${cache.size}`
    );
  }

  return removed;
}

// ============================================================================
// FILE-BASED CACHING (Original Implementation)
// ============================================================================

/**
 * Get cached artifact from file path
 * @param {string} artifactPath - Path to artifact file
 * @returns {Promise<Object|null>} Cached artifact or null if not found/expired
 */
export async function getCachedArtifact(artifactPath) {
  const fullPath = path.resolve(ROOT, artifactPath);
  const cacheKey = fullPath;

  // Check if artifact is in cache
  if (!artifactCache.has(cacheKey)) {
    return null;
  }

  const cached = artifactCache.get(cacheKey);

  // Check if cache is expired
  if (Date.now() > cached.expiresAt) {
    artifactCache.delete(cacheKey);
    return null;
  }

  // Check if file has changed
  try {
    const stats = await fs.stat(fullPath);
    if (stats.mtime.getTime() !== cached.mtime) {
      // File changed, invalidate cache
      artifactCache.delete(cacheKey);
      return null;
    }
  } catch (error) {
    // File doesn't exist, remove from cache
    artifactCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

/**
 * Cache artifact by file path
 * @param {string} artifactPath - Path to artifact file
 * @param {Object} artifactData - Artifact data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 */
export async function cacheArtifact(artifactPath, artifactData, ttl = DEFAULT_FILE_TTL) {
  const fullPath = path.resolve(ROOT, artifactPath);
  const cacheKey = fullPath;

  try {
    const stats = await fs.stat(fullPath);
    const expiresAt = Date.now() + ttl;

    artifactCache.set(cacheKey, {
      data: artifactData,
      mtime: stats.mtime.getTime(),
      expiresAt,
      cachedAt: Date.now(),
    });
  } catch (error) {
    // File doesn't exist yet, cache anyway (might be created later)
    const expiresAt = Date.now() + ttl;
    artifactCache.set(cacheKey, {
      data: artifactData,
      mtime: null,
      expiresAt,
      cachedAt: Date.now(),
    });
  }

  // Prune cache if needed
  pruneCache(artifactCache, 'Artifact Cache');
}

/**
 * Load artifact (with caching)
 * @param {string} artifactPath - Path to artifact file
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<Object>} Artifact data
 */
export async function loadArtifact(artifactPath, ttl = DEFAULT_FILE_TTL) {
  // Check cache first
  const cached = await getCachedArtifact(artifactPath);
  if (cached !== null) {
    return cached;
  }

  // Load from file
  const fullPath = path.resolve(ROOT, artifactPath);
  try {
    // Check file size first
    const stats = await fs.stat(fullPath);
    const sizeMB = stats.size / 1024 / 1024;

    let data;
    if (sizeMB > 1) {
      // Use streaming for files > 1MB
      data = await parseLargeJSON(fullPath, { maxSize: 10 * 1024 * 1024 }); // 10MB limit
    } else {
      // Small files can use regular readFile
      const content = await fs.readFile(fullPath, 'utf-8');
      data = JSON.parse(content);
    }

    await cacheArtifact(artifactPath, data, ttl);
    return data;
  } catch (error) {
    throw new Error(`Failed to load artifact ${artifactPath}: ${error.message}`);
  }
}

/**
 * Invalidate artifact cache
 * @param {string} artifactPath - Path to artifact file (optional, invalidates all if not provided)
 */
export function invalidateArtifact(artifactPath = null) {
  if (artifactPath) {
    const fullPath = path.resolve(ROOT, artifactPath);
    artifactCache.delete(fullPath);
  } else {
    artifactCache.clear();
  }
}

// ============================================================================
// WORKFLOW-BASED CACHING (New Implementation)
// ============================================================================

/**
 * Get cached workflow output
 * @param {string} workflowId - Workflow identifier
 * @param {number} stepNumber - Step number
 * @param {Object} inputs - Input parameters
 * @returns {Promise<Object|null>} Cached artifact or null if not found/expired
 */
export async function getWorkflowCache(workflowId, stepNumber, inputs) {
  const key = generateKey(workflowId, stepNumber, inputs);

  // Check in-memory cache first
  if (workflowCache.has(key)) {
    const cached = workflowCache.get(key);

    // Check if cache is still valid
    if (Date.now() <= cached.timestamp + DEFAULT_WORKFLOW_TTL) {
      return cached.artifact;
    } else {
      // Expired, remove from cache
      workflowCache.delete(key);
    }
  }

  // Check persistent cache
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtime.getTime();

    // Check if cache is still valid (< 1 hour old)
    if (age > DEFAULT_WORKFLOW_TTL) {
      return null;
    }

    const content = await fs.readFile(cachePath, 'utf-8');
    const cached = JSON.parse(content);

    // Restore to in-memory cache
    workflowCache.set(key, {
      workflow_id: cached.workflow_id,
      step: cached.step,
      inputs: cached.inputs,
      artifact: cached.artifact,
      timestamp: cached.timestamp,
    });

    return cached.artifact;
  } catch (error) {
    // Cache file doesn't exist or is invalid
    return null;
  }
}

/**
 * Store workflow output in cache
 * @param {string} workflowId - Workflow identifier
 * @param {number} stepNumber - Step number
 * @param {Object} inputs - Input parameters
 * @param {Object} artifact - Artifact to cache
 * @returns {Promise<void>}
 */
export async function setWorkflowCache(workflowId, stepNumber, inputs, artifact) {
  const key = generateKey(workflowId, stepNumber, inputs);

  const cacheEntry = {
    workflow_id: workflowId,
    step: stepNumber,
    inputs: inputs,
    artifact: artifact,
    timestamp: Date.now(),
  };

  // Store in-memory
  workflowCache.set(key, cacheEntry);

  // Prune if needed
  pruneCache(workflowCache, 'Workflow Cache');

  // Persist to disk
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  try {
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[Workflow Cache] Failed to persist cache: ${error.message}`);
  }
}

/**
 * Clear workflow cache
 * @param {string} workflowId - Workflow identifier (optional, clears all if not provided)
 * @returns {Promise<void>}
 */
export async function clearWorkflowCache(workflowId = null) {
  if (workflowId) {
    // Remove entries for specific workflow
    const keysToRemove = [];
    for (const [key, cached] of workflowCache.entries()) {
      if (cached.workflow_id === workflowId) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      workflowCache.delete(key);

      // Remove from disk
      const cachePath = path.join(CACHE_DIR, `${key}.json`);
      try {
        await fs.unlink(cachePath);
      } catch {
        // File doesn't exist or already deleted
      }
    }
  } else {
    // Clear all workflow cache
    workflowCache.clear();

    // Clear disk cache
    await ensureCacheDir();
    try {
      const files = await fs.readdir(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(CACHE_DIR, file));
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }
  }
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Get cache statistics (combined file + workflow caches)
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const now = Date.now();

  // File cache stats
  let fileValid = 0;
  let fileExpired = 0;
  let fileSize = 0;

  for (const cached of artifactCache.values()) {
    if (now > cached.expiresAt) {
      fileExpired++;
    } else {
      fileValid++;
    }
    if (cached.data) {
      fileSize += estimateSize(cached.data);
    }
  }

  // Workflow cache stats
  let workflowValid = 0;
  let workflowExpired = 0;
  let workflowSize = 0;

  for (const cached of workflowCache.values()) {
    const age = now - cached.timestamp;
    if (age > DEFAULT_WORKFLOW_TTL) {
      workflowExpired++;
    } else {
      workflowValid++;
    }
    if (cached.artifact) {
      workflowSize += estimateSize(cached.artifact);
    }
  }

  return {
    file_cache: {
      total: artifactCache.size,
      valid: fileValid,
      expired: fileExpired,
      memory_bytes: fileSize,
      memory_mb: (fileSize / 1024 / 1024).toFixed(2),
    },
    workflow_cache: {
      total: workflowCache.size,
      valid: workflowValid,
      expired: workflowExpired,
      memory_bytes: workflowSize,
      memory_mb: (workflowSize / 1024 / 1024).toFixed(2),
    },
    combined: {
      total: artifactCache.size + workflowCache.size,
      valid: fileValid + workflowValid,
      expired: fileExpired + workflowExpired,
      memory_bytes: fileSize + workflowSize,
      memory_mb: ((fileSize + workflowSize) / 1024 / 1024).toFixed(2),
    },
  };
}

/**
 * Clean expired entries from both caches
 * @returns {Object} Number of entries removed from each cache
 */
export function cleanExpiredEntries() {
  const now = Date.now();
  let fileRemoved = 0;
  let workflowRemoved = 0;

  // Clean file cache
  for (const [key, cached] of artifactCache.entries()) {
    if (now > cached.expiresAt) {
      artifactCache.delete(key);
      fileRemoved++;
    }
  }

  // Clean workflow cache
  for (const [key, cached] of workflowCache.entries()) {
    const age = now - cached.timestamp;
    if (age > DEFAULT_WORKFLOW_TTL) {
      workflowCache.delete(key);
      workflowRemoved++;
    }
  }

  return {
    file_cache: fileRemoved,
    workflow_cache: workflowRemoved,
    total: fileRemoved + workflowRemoved,
  };
}

// Module-level cleanup interval (single instance)
let cleanupInterval = null;

/**
 * Start automatic cleanup of expired entries
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
 * @returns {void}
 */
export function startAutoCleanup(intervalMs = 5 * 60 * 1000) {
  if (cleanupInterval) {
    console.warn('[Artifact Cache] Auto-cleanup already running');
    return;
  }

  cleanupInterval = setInterval(cleanExpiredEntries, intervalMs);
  console.log(`[Artifact Cache] Auto-cleanup started (interval: ${intervalMs}ms)`);
}

/**
 * Stop automatic cleanup of expired entries
 * @returns {void}
 */
export function stopAutoCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Artifact Cache] Auto-cleanup stopped');
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'clear') {
    const target = process.argv[3]; // 'file', 'workflow', or workflow ID
    if (target === 'file') {
      invalidateArtifact();
      console.log('File cache cleared');
    } else if (target === 'workflow') {
      await clearWorkflowCache();
      console.log('Workflow cache cleared');
    } else if (target) {
      // Clear specific workflow
      await clearWorkflowCache(target);
      console.log(`Workflow cache cleared for: ${target}`);
    } else {
      // Clear both
      invalidateArtifact();
      await clearWorkflowCache();
      console.log('All caches cleared');
    }
  } else if (command === 'stats') {
    const stats = getCacheStats();
    console.log('Artifact Cache Statistics:');
    console.log('\nFile Cache:');
    console.log(`  Total Entries: ${stats.file_cache.total}`);
    console.log(`  Valid: ${stats.file_cache.valid}`);
    console.log(`  Expired: ${stats.file_cache.expired}`);
    console.log(`  Memory Usage: ${stats.file_cache.memory_mb} MB`);
    console.log('\nWorkflow Cache:');
    console.log(`  Total Entries: ${stats.workflow_cache.total}`);
    console.log(`  Valid: ${stats.workflow_cache.valid}`);
    console.log(`  Expired: ${stats.workflow_cache.expired}`);
    console.log(`  Memory Usage: ${stats.workflow_cache.memory_mb} MB`);
    console.log('\nCombined:');
    console.log(`  Total Entries: ${stats.combined.total}`);
    console.log(`  Valid: ${stats.combined.valid}`);
    console.log(`  Expired: ${stats.combined.expired}`);
    console.log(`  Memory Usage: ${stats.combined.memory_mb} MB`);
  } else if (command === 'clean') {
    const removed = cleanExpiredEntries();
    console.log(`Cleaned expired entries:`);
    console.log(`  File Cache: ${removed.file_cache}`);
    console.log(`  Workflow Cache: ${removed.workflow_cache}`);
    console.log(`  Total: ${removed.total}`);
  } else {
    console.log('Artifact Cache - Dual-Purpose Caching System');
    console.log('\nUsage:');
    console.log('  node artifact-cache.mjs clear [file|workflow|<workflowId>]');
    console.log('    Clear cache (file, workflow, specific workflow, or all)');
    console.log('  node artifact-cache.mjs stats');
    console.log('    Show cache statistics');
    console.log('  node artifact-cache.mjs clean');
    console.log('    Clean expired entries');
    console.log('\nCache Types:');
    console.log('  File Cache: Caches artifacts from disk (5 min TTL)');
    console.log('  Workflow Cache: Caches workflow step outputs (1 hour TTL)');
  }
}
