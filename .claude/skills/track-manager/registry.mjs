#!/usr/bin/env node
/**
 * Track Registry - Single source of truth for all tracks
 *
 * Provides O(1) indexed access to tracks with TTL-based caching
 * Enforces single active track constraint through file locking
 *
 * Usage:
 *   node registry.mjs list [--status <status>] [--type <type>]
 *   node registry.mjs get-active
 *   node registry.mjs update --track-id <id> --field <field> --value <value>
 *   node registry.mjs stats
 */

import { readFile, writeFile, mkdir, unlink, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TRACKS_DIR = join(__dirname, '../../conductor/tracks');
const REGISTRY_PATH = join(TRACKS_DIR, 'track-registry.json');
const LOCK_PATH = join(TRACKS_DIR, 'track-registry.lock');
const CACHE_TTL = 5000; // 5 seconds
const STALE_LOCK_THRESHOLD = 30000; // 30 seconds

// Registry cache
let registryCache = null;
let cacheTimestamp = 0;

/**
 * Ensure tracks directory exists
 */
async function ensureTracksDir() {
  if (!existsSync(TRACKS_DIR)) {
    await mkdir(TRACKS_DIR, { recursive: true });
  }
}

/**
 * Acquire lock on registry with stale lock detection
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Function>} Unlock function
 */
export async function acquireRegistryLock(timeout = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Check for stale lock
      if (existsSync(LOCK_PATH)) {
        try {
          const lockStat = await stat(LOCK_PATH);
          const lockAge = Date.now() - lockStat.mtimeMs;
          if (lockAge > STALE_LOCK_THRESHOLD) {
            // Stale lock - remove it
            await unlink(LOCK_PATH);
          }
        } catch (statError) {
          // If stat fails, try to remove lock anyway
          try {
            await unlink(LOCK_PATH);
          } catch (unlinkError) {
            // Ignore - will try to create new lock
          }
        }
      }

      // Try to create lock file exclusively
      await writeFile(
        LOCK_PATH,
        JSON.stringify({
          pid: process.pid,
          timestamp: new Date().toISOString(),
        }),
        { flag: 'wx' }
      );

      // Lock acquired - return unlock function
      return async () => {
        try {
          await unlink(LOCK_PATH);
        } catch (error) {
          // Ignore errors when releasing lock
        }
      };
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Lock exists, wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to acquire registry lock within ${timeout}ms`);
}

/**
 * Atomic write: write to temp file, then rename
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 */
async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;

  try {
    await writeFile(tempPath, content, 'utf-8');
    const { rename } = await import('fs/promises');
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Track Registry with O(1) indexing and caching
 */
export class TrackRegistry {
  constructor() {
    this.registryPath = REGISTRY_PATH;
    this._cache = null;
    this._cacheTTL = CACHE_TTL;
    this._cacheTimestamp = 0;
  }

  /**
   * Load registry with caching
   * @returns {Promise<Object>} Registry object
   */
  async load() {
    const now = Date.now();

    // Check cache first
    if (registryCache && now - cacheTimestamp < this._cacheTTL) {
      return registryCache;
    }

    await ensureTracksDir();

    if (!existsSync(this.registryPath)) {
      return await this._initializeRegistry();
    }

    const content = await readFile(this.registryPath, 'utf-8');
    const registry = JSON.parse(content);

    // Update cache
    registryCache = registry;
    cacheTimestamp = now;

    return registry;
  }

  /**
   * Initialize empty registry
   * @returns {Promise<Object>} Registry object
   */
  async _initializeRegistry() {
    const registry = {
      version: '1.0',
      active_track: null,
      tracks: {},
      metadata: {
        total_tracks: 0,
        active_count: 0,
        completed_count: 0,
        last_updated: new Date().toISOString(),
      },
    };

    await this._save(registry);
    return registry;
  }

  /**
   * Save registry with atomic write
   * @param {Object} registry - Registry object
   */
  async _save(registry) {
    registry.metadata.last_updated = new Date().toISOString();
    await atomicWrite(this.registryPath, JSON.stringify(registry, null, 2));

    // Update cache
    registryCache = registry;
    cacheTimestamp = Date.now();
  }

  /**
   * Register new track
   * @param {Object} track - Track object
   * @returns {Promise<Object>} Updated registry
   */
  async registerTrack(track) {
    const unlock = await acquireRegistryLock();

    try {
      const registry = await this.load();

      registry.tracks[track.track_id] = {
        track_id: track.track_id,
        name: track.name,
        type: track.type,
        status: track.status,
        priority: track.priority,
        created_at: track.created_at,
        updated_at: track.updated_at || track.created_at,
        path: track.track_id,
        progress: track.progress || { percentage: 0, completed_steps: 0, total_steps: 0 },
      };

      registry.metadata.total_tracks++;

      await this._save(registry);
      return registry;
    } finally {
      await unlock();
    }
  }

  /**
   * Update track in registry
   * @param {string} trackId - Track ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated registry
   */
  async updateTrack(trackId, updates) {
    const unlock = await acquireRegistryLock();

    try {
      const registry = await this.load();

      if (!registry.tracks[trackId]) {
        throw new Error(`Track not found in registry: ${trackId}`);
      }

      Object.assign(registry.tracks[trackId], updates);
      registry.tracks[trackId].updated_at = new Date().toISOString();

      // Update active track if status changed to active
      if (updates.status === 'active') {
        registry.active_track = trackId;
        registry.metadata.active_count = 1;
      } else if (updates.status === 'paused' || updates.status === 'completed') {
        if (registry.active_track === trackId) {
          registry.active_track = null;
          registry.metadata.active_count = 0;
        }
        if (updates.status === 'completed') {
          registry.metadata.completed_count++;
        }
      }

      await this._save(registry);
      return registry;
    } finally {
      await unlock();
    }
  }

  /**
   * Get active track
   * @returns {Promise<Object|null>} Active track or null
   */
  async getActiveTrack() {
    const registry = await this.load();

    if (!registry.active_track) {
      return null;
    }

    return registry.tracks[registry.active_track];
  }

  /**
   * List tracks with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of tracks
   */
  async listTracks(filters = {}) {
    const registry = await this.load();
    let tracks = Object.values(registry.tracks);

    if (filters.status) {
      tracks = tracks.filter(t => t.status === filters.status);
    }

    if (filters.type) {
      tracks = tracks.filter(t => t.type === filters.type);
    }

    if (filters.priority) {
      tracks = tracks.filter(t => t.priority === filters.priority);
    }

    // Sort by updated_at descending
    tracks.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return tracks;
  }

  /**
   * Get registry statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    const registry = await this.load();
    const tracks = Object.values(registry.tracks);

    const stats = {
      total_tracks: tracks.length,
      active_count: tracks.filter(t => t.status === 'active').length,
      paused_count: tracks.filter(t => t.status === 'paused').length,
      completed_count: tracks.filter(t => t.status === 'completed').length,
      failed_count: tracks.filter(t => t.status === 'failed').length,
      by_type: {},
      by_priority: {},
      active_track: registry.active_track,
    };

    // Count by type
    for (const track of tracks) {
      stats.by_type[track.type] = (stats.by_type[track.type] || 0) + 1;
      stats.by_priority[track.priority] = (stats.by_priority[track.priority] || 0) + 1;
    }

    return stats;
  }

  /**
   * Invalidate cache
   */
  static invalidateCache() {
    registryCache = null;
    cacheTimestamp = 0;
  }
}

/**
 * Get active track (convenience function)
 * @returns {Promise<Object|null>} Active track or null
 */
export async function getActiveTrack() {
  const registry = new TrackRegistry();
  return await registry.getActiveTrack();
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const registry = new TrackRegistry();

    if (command === 'list') {
      const statusIndex = args.indexOf('--status');
      const typeIndex = args.indexOf('--type');

      const status = statusIndex !== -1 ? args[statusIndex + 1] : undefined;
      const type = typeIndex !== -1 ? args[typeIndex + 1] : undefined;

      const tracks = await registry.listTracks({ status, type });
      console.log(JSON.stringify(tracks, null, 2));
    } else if (command === 'get-active') {
      const activeTrack = await registry.getActiveTrack();
      console.log(JSON.stringify(activeTrack, null, 2));
    } else if (command === 'update') {
      const trackIdIndex = args.indexOf('--track-id');
      const fieldIndex = args.indexOf('--field');
      const valueIndex = args.indexOf('--value');

      if (trackIdIndex === -1 || fieldIndex === -1 || valueIndex === -1) {
        console.error(
          'Usage: node registry.mjs update --track-id <id> --field <field> --value <value>'
        );
        process.exit(1);
      }

      const trackId = args[trackIdIndex + 1];
      const field = args[fieldIndex + 1];
      const value = args[valueIndex + 1];

      const updated = await registry.updateTrack(trackId, { [field]: value });
      console.log(JSON.stringify(updated, null, 2));
    } else if (command === 'stats') {
      const stats = await registry.getStats();
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.error('Unknown command. Available: list, get-active, update, stats');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TrackRegistry;
