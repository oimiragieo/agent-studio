#!/usr/bin/env node
/**
 * Artifact Cache
 * Caches artifacts in memory with TTL to speed up artifact passing between workflow steps.
 * Invalidates cache on file changes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// In-memory artifact cache
const artifactCache = new Map();

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// Cache limits
const MAX_CACHE_SIZE = 500; // Maximum entries
const MAX_CACHE_MEMORY_MB = 50; // Maximum memory usage in MB

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
 * Get cached artifact
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
 * Prune cache to maintain size limits (LRU eviction)
 * @returns {number} Number of entries removed
 */
function pruneCache() {
  // Check if we need to prune based on entry count
  let needsPrune = artifactCache.size > MAX_CACHE_SIZE;
  
  if (!needsPrune) {
    // Check memory usage
    let totalMemory = 0;
    for (const cached of artifactCache.values()) {
      totalMemory += estimateSize(cached.data);
    }
    
    const memoryMB = totalMemory / 1024 / 1024;
    needsPrune = memoryMB > MAX_CACHE_MEMORY_MB;
  }

  if (!needsPrune) {
    return 0;
  }

  // Sort by access time (LRU)
  const entries = Array.from(artifactCache.entries())
    .map(([key, value]) => ({
      key,
      timestamp: value.cachedAt || 0,
      size: estimateSize(value.data)
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  let removed = 0;
  let freedMB = 0;
  const targetSize = Math.floor(MAX_CACHE_SIZE * 0.8); // Remove to 80% of max

  for (const entry of entries) {
    if (artifactCache.size <= targetSize) {
      // Check if we've freed enough memory
      let currentMemory = 0;
      for (const cached of artifactCache.values()) {
        currentMemory += estimateSize(cached.data);
      }
      const currentMemoryMB = currentMemory / 1024 / 1024;
      if (currentMemoryMB <= MAX_CACHE_MEMORY_MB * 0.8) {
        break;
      }
    }
    
    artifactCache.delete(entry.key);
    removed++;
    freedMB += entry.size / 1024 / 1024;
  }

  if (removed > 0) {
    console.log(`[Artifact Cache] Pruned ${removed} entries (freed ${freedMB.toFixed(2)}MB), cache size: ${artifactCache.size}`);
  }

  return removed;
}

/**
 * Cache artifact
 * @param {string} artifactPath - Path to artifact file
 * @param {Object} artifactData - Artifact data to cache
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 */
export async function cacheArtifact(artifactPath, artifactData, ttl = DEFAULT_TTL) {
  const fullPath = path.resolve(ROOT, artifactPath);
  const cacheKey = fullPath;
  
  try {
    const stats = await fs.stat(fullPath);
    const expiresAt = Date.now() + ttl;
    
    artifactCache.set(cacheKey, {
      data: artifactData,
      mtime: stats.mtime.getTime(),
      expiresAt,
      cachedAt: Date.now()
    });
  } catch (error) {
    // File doesn't exist yet, cache anyway (might be created later)
    const expiresAt = Date.now() + ttl;
    artifactCache.set(cacheKey, {
      data: artifactData,
      mtime: null,
      expiresAt,
      cachedAt: Date.now()
    });
  }
  
  // Prune cache if needed
  pruneCache();
}

/**
 * Load artifact (with caching)
 * @param {string} artifactPath - Path to artifact file
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<Object>} Artifact data
 */
export async function loadArtifact(artifactPath, ttl = DEFAULT_TTL) {
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

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;
  
  for (const cached of artifactCache.values()) {
    if (now > cached.expiresAt) {
      expiredEntries++;
    } else {
      validEntries++;
    }

    if (cached.data) {
      totalSize += estimateSize(cached.data);
    }
  }
  
  return {
    total: artifactCache.size,
    valid: validEntries,
    expired: expiredEntries,
    memoryUsage: totalSize
  };
}

/**
 * Clean expired entries from cache
 * @returns {number} Number of entries removed
 */
export function cleanExpiredEntries() {
  const now = Date.now();
  let removed = 0;

  for (const [key, cached] of artifactCache.entries()) {
    if (now > cached.expiresAt) {
      artifactCache.delete(key);
      removed++;
    }
  }

  return removed;
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

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'clear') {
    const artifactPath = process.argv[3];
    invalidateArtifact(artifactPath);
    console.log(`Cache cleared${artifactPath ? ` for ${artifactPath}` : ' (all)'}`);
  } else if (command === 'stats') {
    const stats = getCacheStats();
    console.log('Artifact Cache Statistics:');
    console.log(`  Total Entries: ${stats.total}`);
    console.log(`  Valid: ${stats.valid}`);
    console.log(`  Expired: ${stats.expired}`);
    console.log(`  Memory Usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
  } else if (command === 'clean') {
    const removed = cleanExpiredEntries();
    console.log(`Cleaned ${removed} expired entries`);
  } else {
    console.log('Usage:');
    console.log('  node artifact-cache.mjs clear [artifactPath]  - Clear cache');
    console.log('  node artifact-cache.mjs stats                 - Show cache statistics');
    console.log('  node artifact-cache.mjs clean                - Clean expired entries');
  }
}

