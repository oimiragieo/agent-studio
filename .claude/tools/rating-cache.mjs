#!/usr/bin/env node
/**
 * Rating Cache - Plan rating cache with TTL-based expiration
 *
 * Stores plan ratings to prevent redundant re-rating of unchanged plans.
 * Uses TTL-based expiration (default 1 hour) and content hashing for invalidation.
 *
 * Usage:
 *   node .claude/tools/rating-cache.mjs --get <plan-id>
 *   node .claude/tools/rating-cache.mjs --set <plan-id> --score <score> --hash <hash>
 *   node .claude/tools/rating-cache.mjs --invalidate <plan-id>
 *   node .claude/tools/rating-cache.mjs --clear
 *   node .claude/tools/rating-cache.mjs --stats
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = join(__dirname, '..', 'context', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'ratings.json');
const DEFAULT_TTL = 3600000; // 1 hour in milliseconds

/**
 * Load cache from disk
 * @returns {Promise<Object>} Cache object
 */
async function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) {
      return {
        version: '1.0',
        created_at: new Date().toISOString(),
        entries: {}
      };
    }

    const content = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Failed to load cache: ${error.message}`);
    return {
      version: '1.0',
      created_at: new Date().toISOString(),
      entries: {}
    };
  }
}

/**
 * Save cache to disk
 * @param {Object} cache - Cache object
 * @returns {Promise<void>}
 */
async function saveCache(cache) {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }

  cache.updated_at = new Date().toISOString();
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Clean expired entries from cache
 * @param {Object} cache - Cache object
 * @param {number} ttl - TTL in milliseconds
 * @returns {number} Number of expired entries removed
 */
function cleanExpiredEntries(cache, ttl = DEFAULT_TTL) {
  const now = Date.now();
  let removed = 0;

  for (const [planId, entry] of Object.entries(cache.entries)) {
    const createdAt = new Date(entry.created_at).getTime();
    const age = now - createdAt;

    if (age > ttl) {
      delete cache.entries[planId];
      removed++;
    }
  }

  return removed;
}

/**
 * Get rating from cache
 * @param {string} planId - Plan identifier
 * @param {Object} options - Options
 * @returns {Promise<Object|null>} Cached rating or null if not found/expired
 */
export async function getRating(planId, options = {}) {
  const cache = await loadCache();
  const ttl = options.ttl || DEFAULT_TTL;

  const entry = cache.entries[planId];

  if (!entry) {
    return null;
  }

  // Check TTL
  const createdAt = new Date(entry.created_at).getTime();
  const age = Date.now() - createdAt;

  if (age > ttl) {
    // Entry expired
    delete cache.entries[planId];
    await saveCache(cache);
    return null;
  }

  // Verify content hash if provided
  if (options.contentHash && entry.content_hash !== options.contentHash) {
    // Content changed - invalidate
    delete cache.entries[planId];
    await saveCache(cache);
    return null;
  }

  return {
    plan_id: planId,
    score: entry.score,
    rating: entry.rating,
    created_at: entry.created_at,
    age_ms: age,
    ttl_remaining_ms: ttl - age,
    content_hash: entry.content_hash,
    metadata: entry.metadata || {}
  };
}

/**
 * Set rating in cache
 * @param {string} planId - Plan identifier
 * @param {Object} rating - Rating data
 * @param {Object} options - Options
 * @returns {Promise<Object>} Cache entry
 */
export async function setRating(planId, rating, options = {}) {
  const cache = await loadCache();

  const entry = {
    plan_id: planId,
    score: rating.score ?? rating.overall_score ?? rating.rating,
    rating: rating,
    content_hash: options.contentHash || null,
    created_at: new Date().toISOString(),
    metadata: options.metadata || {}
  };

  cache.entries[planId] = entry;

  // Clean expired entries before saving
  cleanExpiredEntries(cache, options.ttl || DEFAULT_TTL);

  await saveCache(cache);

  return entry;
}

/**
 * Invalidate rating in cache
 * @param {string} planId - Plan identifier
 * @returns {Promise<boolean>} True if entry was invalidated
 */
export async function invalidateRating(planId) {
  const cache = await loadCache();

  if (cache.entries[planId]) {
    delete cache.entries[planId];
    await saveCache(cache);
    return true;
  }

  return false;
}

/**
 * Clear all cache entries
 * @returns {Promise<number>} Number of entries cleared
 */
export async function clearCache() {
  const cache = await loadCache();
  const count = Object.keys(cache.entries).length;

  cache.entries = {};
  await saveCache(cache);

  return count;
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getCacheStats() {
  const cache = await loadCache();
  const now = Date.now();

  const stats = {
    total_entries: 0,
    expired_entries: 0,
    valid_entries: 0,
    avg_age_ms: 0,
    oldest_entry_ms: 0,
    newest_entry_ms: 0,
    cache_file: CACHE_FILE,
    cache_exists: existsSync(CACHE_FILE)
  };

  const ages = [];

  for (const entry of Object.values(cache.entries)) {
    stats.total_entries++;

    const createdAt = new Date(entry.created_at).getTime();
    const age = now - createdAt;
    ages.push(age);

    if (age > DEFAULT_TTL) {
      stats.expired_entries++;
    } else {
      stats.valid_entries++;
    }
  }

  if (ages.length > 0) {
    stats.avg_age_ms = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
    stats.oldest_entry_ms = Math.max(...ages);
    stats.newest_entry_ms = Math.min(...ages);
  }

  return stats;
}

/**
 * Compute content hash for plan
 * @param {string} planContent - Plan content (JSON or markdown)
 * @returns {string} SHA-256 hash
 */
export function computeContentHash(planContent) {
  return createHash('sha256').update(planContent).digest('hex');
}

/**
 * Load plan file and compute hash
 * @param {string} planPath - Path to plan file
 * @returns {Promise<string>} Content hash
 */
export async function hashPlanFile(planPath) {
  const content = await readFile(planPath, 'utf-8');
  return computeContentHash(content);
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Rating Cache - Plan rating cache with TTL-based expiration

Usage:
  node rating-cache.mjs --get <plan-id> [--hash <hash>]
  node rating-cache.mjs --set <plan-id> --score <score> [--hash <hash>]
  node rating-cache.mjs --invalidate <plan-id>
  node rating-cache.mjs --clear
  node rating-cache.mjs --stats
  node rating-cache.mjs --clean

Options:
  --get <id>          Get cached rating for plan
  --set <id>          Set cached rating for plan
  --score <n>         Score to cache (required with --set)
  --hash <hash>       Content hash for invalidation detection
  --invalidate <id>   Invalidate cached rating for plan
  --clear             Clear all cache entries
  --stats             Show cache statistics
  --clean             Remove expired entries
  --ttl <ms>          TTL in milliseconds (default: 3600000 = 1 hour)
  --json              Output as JSON
  --help, -h          Show this help

Examples:
  # Get cached rating
  node rating-cache.mjs --get plan-abc123

  # Set rating with content hash
  node rating-cache.mjs --set plan-abc123 --score 8.5 --hash abc123def456

  # Invalidate rating
  node rating-cache.mjs --invalidate plan-abc123

  # Clear all cache
  node rating-cache.mjs --clear

  # Show statistics
  node rating-cache.mjs --stats

Exit codes:
  0 - Success
  1 - Error or not found
`);
    process.exit(0);
  }

  const getArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const hasFlag = (name) => args.includes(`--${name}`);

  try {
    const options = {
      ttl: parseInt(getArg('ttl'), 10) || DEFAULT_TTL,
      contentHash: getArg('hash')
    };

    if (hasFlag('stats')) {
      // Show cache statistics
      const stats = await getCacheStats();

      if (hasFlag('json')) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(`\nCache Statistics:`);
        console.log(`  Total entries: ${stats.total_entries}`);
        console.log(`  Valid entries: ${stats.valid_entries}`);
        console.log(`  Expired entries: ${stats.expired_entries}`);
        if (stats.total_entries > 0) {
          console.log(`  Average age: ${Math.round(stats.avg_age_ms / 1000)}s`);
          console.log(`  Oldest entry: ${Math.round(stats.oldest_entry_ms / 1000)}s`);
          console.log(`  Newest entry: ${Math.round(stats.newest_entry_ms / 1000)}s`);
        }
        console.log(`  Cache file: ${stats.cache_file}`);
      }

      process.exit(0);
    }

    if (hasFlag('clear')) {
      // Clear cache
      const count = await clearCache();

      if (hasFlag('json')) {
        console.log(JSON.stringify({ cleared: count }));
      } else {
        console.log(`\nCleared ${count} cache entries`);
      }

      process.exit(0);
    }

    if (hasFlag('clean')) {
      // Clean expired entries
      const cache = await loadCache();
      const removed = cleanExpiredEntries(cache, options.ttl);
      await saveCache(cache);

      if (hasFlag('json')) {
        console.log(JSON.stringify({ removed }));
      } else {
        console.log(`\nRemoved ${removed} expired entries`);
      }

      process.exit(0);
    }

    if (hasFlag('get')) {
      // Get rating
      const planId = getArg('get');
      if (!planId) {
        console.error('Error: --get requires plan ID');
        process.exit(1);
      }

      const rating = await getRating(planId, options);

      if (!rating) {
        if (!hasFlag('json')) {
          console.log(`\nNo cached rating found for: ${planId}`);
        }
        process.exit(1);
      }

      if (hasFlag('json')) {
        console.log(JSON.stringify(rating, null, 2));
      } else {
        console.log(`\nCached Rating for ${planId}:`);
        console.log(`  Score: ${rating.score}`);
        console.log(`  Created: ${rating.created_at}`);
        console.log(`  Age: ${Math.round(rating.age_ms / 1000)}s`);
        console.log(`  TTL Remaining: ${Math.round(rating.ttl_remaining_ms / 1000)}s`);
        if (rating.content_hash) {
          console.log(`  Content Hash: ${rating.content_hash}`);
        }
      }

      process.exit(0);
    }

    if (hasFlag('set')) {
      // Set rating
      const planId = getArg('set');
      const score = parseFloat(getArg('score'));

      if (!planId || isNaN(score)) {
        console.error('Error: --set requires plan ID and --score <number>');
        process.exit(1);
      }

      const rating = { score };
      const entry = await setRating(planId, rating, options);

      if (hasFlag('json')) {
        console.log(JSON.stringify(entry, null, 2));
      } else {
        console.log(`\nRating cached for ${planId}:`);
        console.log(`  Score: ${entry.score}`);
        console.log(`  Created: ${entry.created_at}`);
        if (entry.content_hash) {
          console.log(`  Content Hash: ${entry.content_hash}`);
        }
      }

      process.exit(0);
    }

    if (hasFlag('invalidate')) {
      // Invalidate rating
      const planId = getArg('invalidate');
      if (!planId) {
        console.error('Error: --invalidate requires plan ID');
        process.exit(1);
      }

      const invalidated = await invalidateRating(planId);

      if (hasFlag('json')) {
        console.log(JSON.stringify({ invalidated }));
      } else {
        if (invalidated) {
          console.log(`\nInvalidated rating for: ${planId}`);
        } else {
          console.log(`\nNo cached rating found for: ${planId}`);
        }
      }

      process.exit(invalidated ? 0 : 1);
    }

    console.error('Error: No valid command specified');
    console.error('Run with --help for usage information');
    process.exit(1);

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  getRating,
  setRating,
  invalidateRating,
  clearCache,
  getCacheStats,
  computeContentHash,
  hashPlanFile
};
