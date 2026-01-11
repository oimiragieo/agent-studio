#!/usr/bin/env node
/**
 * Shared Cache Manager - Cross-Process Skill Content Cache
 *
 * Issue 5.3: Provides shared caching across Node.js processes to:
 * - Reduce memory duplication when multiple hook instances run
 * - Speed up skill loading through pre-warming
 * - Persist cache to disk for cross-process access
 *
 * Features:
 * - File-based shared cache with versioning
 * - File locking for concurrent access safety
 * - TTL (time-to-live) for automatic cache invalidation
 * - Pre-warming support for frequently used skills
 * - O(1) size tracking
 *
 * Performance Target: <50MB cache memory usage
 *
 * @module shared-cache-manager
 * @version 1.0.0
 */

import { readFile, writeFile, mkdir, access, stat } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CACHE_DIR = join(__dirname, '../context/tmp');
const CACHE_FILE = join(CACHE_DIR, 'skill-cache-shared.json');
const LOCK_FILE = join(CACHE_DIR, 'skill-cache.lock');
const CACHE_VERSION = '1.0.0';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE_MB = 50; // Maximum shared cache size
const MAX_LOCK_WAIT_MS = 5000; // Maximum time to wait for lock
const LOCK_RETRY_INTERVAL_MS = 50; // Retry interval for lock acquisition

// In-memory cache for current process (hot cache)
let inMemoryCache = new Map();
let inMemoryCacheSize = 0;
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 5000; // Sync with disk every 5 seconds

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Acquire file lock for concurrent access safety
 * Uses exponential backoff with maximum wait time
 * @returns {Promise<boolean>} True if lock acquired
 */
async function acquireLock() {
  const startTime = Date.now();
  let waitTime = LOCK_RETRY_INTERVAL_MS;

  while (Date.now() - startTime < MAX_LOCK_WAIT_MS) {
    try {
      // Check if lock exists and is stale (>10 seconds old)
      if (existsSync(LOCK_FILE)) {
        const lockStat = await stat(LOCK_FILE);
        const lockAge = Date.now() - lockStat.mtimeMs;

        if (lockAge > 10000) {
          // Lock is stale, remove it
          try {
            const { unlink } = await import('fs/promises');
            await unlink(LOCK_FILE);
          } catch {
            // Ignore unlink errors
          }
        } else {
          // Lock is active, wait and retry
          await new Promise(resolve => setTimeout(resolve, waitTime));
          waitTime = Math.min(waitTime * 2, 500); // Exponential backoff
          continue;
        }
      }

      // Try to create lock file
      writeFileSync(
        LOCK_FILE,
        JSON.stringify({
          pid: process.pid,
          timestamp: Date.now(),
          hostname: process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown',
        }),
        { flag: 'wx' }
      ); // wx = exclusive write

      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Lock exists, wait and retry
        await new Promise(resolve => setTimeout(resolve, waitTime));
        waitTime = Math.min(waitTime * 2, 500);
        continue;
      }
      // Other error, fail gracefully
      console.warn(`[shared-cache] Lock acquisition warning: ${error.message}`);
      return false;
    }
  }

  // Timeout - proceed without lock (graceful degradation)
  console.warn('[shared-cache] Lock acquisition timeout, proceeding without lock');
  return false;
}

/**
 * Release file lock
 */
async function releaseLock() {
  try {
    if (existsSync(LOCK_FILE)) {
      const { unlink } = await import('fs/promises');
      await unlink(LOCK_FILE);
    }
  } catch (error) {
    // Ignore unlink errors
  }
}

/**
 * Calculate entry size in MB
 * @param {*} value - Value to measure
 * @returns {number} Size in MB
 */
function calculateEntrySize(value) {
  if (typeof value === 'string') {
    return (value.length * 2) / 1024 / 1024; // UTF-16: 2 bytes per char
  } else if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value).length / 1024 / 1024;
  }
  return 0.001; // 1KB default
}

/**
 * Generate content hash for cache validation
 * @param {string} content - Content to hash
 * @returns {string} Short hash
 */
function generateContentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Read shared cache from disk
 * @returns {Promise<Object>} Cache data
 */
async function readSharedCache() {
  ensureCacheDir();

  try {
    if (!existsSync(CACHE_FILE)) {
      return {
        version: CACHE_VERSION,
        entries: {},
        metadata: {
          created: Date.now(),
          lastModified: Date.now(),
          totalSizeMB: 0,
          entryCount: 0,
        },
      };
    }

    const content = await readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(content);

    // Version check
    if (cache.version !== CACHE_VERSION) {
      console.warn('[shared-cache] Cache version mismatch, starting fresh');
      return {
        version: CACHE_VERSION,
        entries: {},
        metadata: {
          created: Date.now(),
          lastModified: Date.now(),
          totalSizeMB: 0,
          entryCount: 0,
        },
      };
    }

    return cache;
  } catch (error) {
    console.warn(`[shared-cache] Failed to read cache: ${error.message}`);
    return {
      version: CACHE_VERSION,
      entries: {},
      metadata: {
        created: Date.now(),
        lastModified: Date.now(),
        totalSizeMB: 0,
        entryCount: 0,
      },
    };
  }
}

/**
 * Write shared cache to disk with locking
 * @param {Object} cache - Cache data to write
 * @returns {Promise<boolean>} Success status
 */
async function writeSharedCache(cache) {
  ensureCacheDir();

  const lockAcquired = await acquireLock();

  try {
    // Update metadata
    cache.metadata.lastModified = Date.now();
    cache.metadata.entryCount = Object.keys(cache.entries).length;

    // Calculate total size
    let totalSize = 0;
    for (const entry of Object.values(cache.entries)) {
      totalSize += entry.sizeMB || 0;
    }
    cache.metadata.totalSizeMB = totalSize;

    // Write atomically (write to temp file, then rename)
    const tempFile = `${CACHE_FILE}.tmp.${process.pid}`;
    await writeFile(tempFile, JSON.stringify(cache, null, 2), 'utf-8');

    const { rename } = await import('fs/promises');
    await rename(tempFile, CACHE_FILE);

    return true;
  } catch (error) {
    console.warn(`[shared-cache] Failed to write cache: ${error.message}`);
    return false;
  } finally {
    if (lockAcquired) {
      await releaseLock();
    }
  }
}

/**
 * Get entry from shared cache (checks TTL)
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached content or null
 */
export async function getFromSharedCache(key) {
  // Check in-memory cache first (hot cache)
  if (inMemoryCache.has(key)) {
    const memEntry = inMemoryCache.get(key);
    if (Date.now() < memEntry.expiresAt) {
      return memEntry.content;
    }
    // Expired, remove from memory
    inMemoryCacheSize -= memEntry.sizeMB;
    inMemoryCache.delete(key);
  }

  // Check disk cache
  try {
    const cache = await readSharedCache();
    const entry = cache.entries[key];

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      // Entry expired
      return null;
    }

    // Update in-memory cache
    inMemoryCache.set(key, {
      content: entry.content,
      expiresAt: entry.expiresAt,
      sizeMB: entry.sizeMB,
    });
    inMemoryCacheSize += entry.sizeMB;

    return entry.content;
  } catch (error) {
    console.warn(`[shared-cache] Get error: ${error.message}`);
    return null;
  }
}

/**
 * Set entry in shared cache
 * @param {string} key - Cache key
 * @param {string} content - Content to cache
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 30 minutes)
 * @returns {Promise<boolean>} Success status
 */
export async function setInSharedCache(key, content, ttlMs = DEFAULT_TTL_MS) {
  const sizeMB = calculateEntrySize(content);
  const expiresAt = Date.now() + ttlMs;
  const hash = generateContentHash(content);

  // Update in-memory cache
  if (inMemoryCache.has(key)) {
    inMemoryCacheSize -= inMemoryCache.get(key).sizeMB;
  }
  inMemoryCache.set(key, {
    content,
    expiresAt,
    sizeMB,
  });
  inMemoryCacheSize += sizeMB;

  // Debounce disk writes
  const now = Date.now();
  if (now - lastSyncTime > SYNC_INTERVAL_MS) {
    lastSyncTime = now;

    try {
      const cache = await readSharedCache();

      // Check size limit before adding
      const newTotalSize = cache.metadata.totalSizeMB + sizeMB;
      if (newTotalSize > MAX_CACHE_SIZE_MB) {
        // Evict oldest entries to make room
        await evictOldestEntries(cache, sizeMB);
      }

      cache.entries[key] = {
        content,
        expiresAt,
        sizeMB,
        hash,
        createdAt: Date.now(),
      };

      await writeSharedCache(cache);
      return true;
    } catch (error) {
      console.warn(`[shared-cache] Set error: ${error.message}`);
      return false;
    }
  }

  return true; // Cached in memory, will sync later
}

/**
 * Batch set multiple entries efficiently
 * @param {Array<{key: string, content: string, ttlMs?: number}>} entries - Entries to cache
 * @returns {Promise<{success: number, failed: number}>} Results
 */
export async function batchSetInSharedCache(entries) {
  if (!entries || entries.length === 0) {
    return { success: 0, failed: 0 };
  }

  const cache = await readSharedCache();
  let success = 0;
  let failed = 0;
  let addedSize = 0;

  for (const { key, content, ttlMs = DEFAULT_TTL_MS } of entries) {
    try {
      const sizeMB = calculateEntrySize(content);
      const expiresAt = Date.now() + ttlMs;
      const hash = generateContentHash(content);

      // Update in-memory cache
      if (inMemoryCache.has(key)) {
        inMemoryCacheSize -= inMemoryCache.get(key).sizeMB;
      }
      inMemoryCache.set(key, { content, expiresAt, sizeMB });
      inMemoryCacheSize += sizeMB;

      // Add to disk cache
      cache.entries[key] = {
        content,
        expiresAt,
        sizeMB,
        hash,
        createdAt: Date.now(),
      };

      addedSize += sizeMB;
      success++;
    } catch (error) {
      failed++;
    }
  }

  // Check size limit and evict if needed
  if (cache.metadata.totalSizeMB + addedSize > MAX_CACHE_SIZE_MB) {
    await evictOldestEntries(cache, addedSize);
  }

  await writeSharedCache(cache);

  return { success, failed };
}

/**
 * Evict oldest entries to free up space
 * @param {Object} cache - Cache object
 * @param {number} neededMB - Space needed in MB
 */
async function evictOldestEntries(cache, neededMB) {
  // Sort entries by creation time (oldest first)
  const entries = Object.entries(cache.entries)
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => a.createdAt - b.createdAt);

  let freedMB = 0;
  for (const entry of entries) {
    if (freedMB >= neededMB) {
      break;
    }

    freedMB += entry.sizeMB;
    delete cache.entries[entry.key];

    // Also remove from in-memory cache
    if (inMemoryCache.has(entry.key)) {
      inMemoryCacheSize -= inMemoryCache.get(entry.key).sizeMB;
      inMemoryCache.delete(entry.key);
    }
  }

  cache.metadata.totalSizeMB -= freedMB;
  console.log(`[shared-cache] Evicted ${freedMB.toFixed(2)}MB to free space`);
}

/**
 * Pre-warm cache with frequently used skills
 * Issue 1.1a: Load top skills on initialization
 * @param {string[]} skillNames - Skill names to pre-warm
 * @param {Function} loader - Function to load skill content
 * @returns {Promise<{loaded: number, failed: number, timeMs: number}>}
 */
export async function prewarmCache(skillNames, loader) {
  const startTime = Date.now();
  let loaded = 0;
  let failed = 0;

  // Load skills in parallel batches of 5
  const batchSize = 5;
  const batches = [];

  for (let i = 0; i < skillNames.length; i += batchSize) {
    batches.push(skillNames.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async skillName => {
        // Check if already cached
        const cached = await getFromSharedCache(`skill:${skillName}`);
        if (cached) {
          return { skillName, cached: true };
        }

        // Load and cache
        try {
          const content = await loader(skillName);
          if (content) {
            await setInSharedCache(`skill:${skillName}`, content);
            return { skillName, loaded: true };
          }
          return { skillName, empty: true };
        } catch (error) {
          return { skillName, error: error.message };
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.loaded || result.value.cached) {
          loaded++;
        } else if (result.value.error) {
          failed++;
        }
      } else {
        failed++;
      }
    }
  }

  const timeMs = Date.now() - startTime;

  return { loaded, failed, timeMs };
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getSharedCacheStats() {
  const cache = await readSharedCache();

  return {
    version: cache.version,
    entryCount: Object.keys(cache.entries).length,
    totalSizeMB: cache.metadata.totalSizeMB,
    maxSizeMB: MAX_CACHE_SIZE_MB,
    utilization: ((cache.metadata.totalSizeMB / MAX_CACHE_SIZE_MB) * 100).toFixed(1) + '%',
    inMemoryEntries: inMemoryCache.size,
    inMemorySizeMB: inMemoryCacheSize.toFixed(2),
    lastModified: new Date(cache.metadata.lastModified).toISOString(),
    created: new Date(cache.metadata.created).toISOString(),
  };
}

/**
 * Clear all cache entries
 * @returns {Promise<boolean>} Success status
 */
export async function clearSharedCache() {
  inMemoryCache.clear();
  inMemoryCacheSize = 0;

  const cache = {
    version: CACHE_VERSION,
    entries: {},
    metadata: {
      created: Date.now(),
      lastModified: Date.now(),
      totalSizeMB: 0,
      entryCount: 0,
    },
  };

  return await writeSharedCache(cache);
}

/**
 * Remove expired entries from cache
 * @returns {Promise<{removed: number, freedMB: number}>}
 */
export async function cleanupExpiredEntries() {
  const cache = await readSharedCache();
  const now = Date.now();
  let removed = 0;
  let freedMB = 0;

  for (const [key, entry] of Object.entries(cache.entries)) {
    if (now > entry.expiresAt) {
      freedMB += entry.sizeMB;
      delete cache.entries[key];

      if (inMemoryCache.has(key)) {
        inMemoryCacheSize -= inMemoryCache.get(key).sizeMB;
        inMemoryCache.delete(key);
      }

      removed++;
    }
  }

  if (removed > 0) {
    cache.metadata.totalSizeMB -= freedMB;
    await writeSharedCache(cache);
  }

  return { removed, freedMB };
}

/**
 * Force sync in-memory cache to disk
 * @returns {Promise<boolean>} Success status
 */
export async function forceSyncToCache() {
  try {
    const cache = await readSharedCache();

    // Sync all in-memory entries to disk
    for (const [key, entry] of inMemoryCache.entries()) {
      if (!cache.entries[key] || cache.entries[key].expiresAt < entry.expiresAt) {
        cache.entries[key] = {
          content: entry.content,
          expiresAt: entry.expiresAt,
          sizeMB: entry.sizeMB,
          hash: generateContentHash(entry.content),
          createdAt: Date.now(),
        };
      }
    }

    await writeSharedCache(cache);
    lastSyncTime = Date.now();

    return true;
  } catch (error) {
    console.warn(`[shared-cache] Sync error: ${error.message}`);
    return false;
  }
}

// Export default object
export default {
  getFromSharedCache,
  setInSharedCache,
  batchSetInSharedCache,
  prewarmCache,
  getSharedCacheStats,
  clearSharedCache,
  cleanupExpiredEntries,
  forceSyncToCache,
};
