#!/usr/bin/env node
/**
 * Artifact Cache
 * Caches artifacts in memory with TTL to speed up artifact passing between workflow steps.
 * Invalidates cache on file changes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// In-memory artifact cache
const artifactCache = new Map();

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

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
    const content = await fs.readFile(fullPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Cache it
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
      totalSize += Buffer.byteLength(JSON.stringify(cached.data), 'utf-8');
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

// Auto-clean expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanExpiredEntries, 5 * 60 * 1000);
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

