#!/usr/bin/env node
/**
 * Track Manager - Track lifecycle operations
 *
 * Manages track creation, activation, suspension, resume, and completion.
 * Enforces single active track constraint and context isolation.
 *
 * Usage:
 *   node manager.mjs create --name "Feature Name" --type feature --goal "..." [--priority P1]
 *   node manager.mjs activate --track-id <id>
 *   node manager.mjs pause --track-id <id> --reason "..."
 *   node manager.mjs resume --track-id <id>
 *   node manager.mjs complete --track-id <id>
 *   node manager.mjs switch --to <id>
 *   node manager.mjs next --track-id <id>
 *   node manager.mjs step --track-id <id> --step-id <step>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { TrackRegistry, getActiveTrack, acquireRegistryLock } from './registry.mjs';
import { createSnapshot } from '../../tools/snapshot-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TRACKS_DIR = join(__dirname, '../../conductor/tracks');

/**
 * Custom error classes
 */
export class TrackExistsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrackExistsError';
  }
}

export class InvalidStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class ActiveTrackExistsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActiveTrackExistsError';
  }
}

export class TrackNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrackNotFoundError';
  }
}

/**
 * Generate track ID from name
 * @param {string} name - Track name
 * @returns {string} Track ID
 */
function generateTrackId(name) {
  const timestamp = Date.now();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `track-${slug}-${timestamp}`;
}

/**
 * Ensure tracks directory exists
 */
async function ensureTracksDir() {
  if (!existsSync(TRACKS_DIR)) {
    await mkdir(TRACKS_DIR, { recursive: true });
  }
}

/**
 * Get track directory path
 */
function getTrackDir(trackId) {
  return join(TRACKS_DIR, trackId);
}

/**
 * Initialize track directory structure
 * @param {string} trackId - Track ID
 */
async function initializeTrackDirectory(trackId) {
  const trackDir = getTrackDir(trackId);
  await mkdir(trackDir, { recursive: true });
  await mkdir(join(trackDir, 'context'), { recursive: true });
  await mkdir(join(trackDir, 'context', 'artifacts'), { recursive: true });
  await mkdir(join(trackDir, 'workflows'), { recursive: true });
  await mkdir(join(trackDir, 'checkpoints'), { recursive: true });

  // Initialize empty context files
  await writeFile(
    join(trackDir, 'context', 'decisions.json'),
    JSON.stringify([], null, 2),
    'utf-8'
  );
  await writeFile(
    join(trackDir, 'context', 'assumptions.json'),
    JSON.stringify([], null, 2),
    'utf-8'
  );
}

/**
 * Load track definition
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Track object
 */
export async function loadTrack(trackId) {
  const trackPath = join(getTrackDir(trackId), 'track.json');

  if (!existsSync(trackPath)) {
    throw new TrackNotFoundError(`Track not found: ${trackId}`);
  }

  const content = await readFile(trackPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save track definition
 * @param {Object} track - Track object
 */
export async function saveTrack(track) {
  const trackPath = join(getTrackDir(track.track_id), 'track.json');
  await writeFile(trackPath, JSON.stringify(track, null, 2), 'utf-8');
}

/**
 * Find track by name
 * @param {string} name - Track name
 * @returns {Promise<Object|null>} Track or null
 */
async function findTrackByName(name) {
  const registry = new TrackRegistry();
  const tracks = await registry.listTracks();
  return tracks.find(t => t.name === name) || null;
}

/**
 * Create new track
 * @param {Object} options - Track creation options
 * @returns {Promise<Object>} Created track
 */
export async function createTrack(options = {}) {
  await ensureTracksDir();

  const { name, type = 'feature', goal = '', priority = 'P2', successCriteria = [] } = options;

  if (!name) {
    throw new Error('Track name is required');
  }

  // Check for existing track with same name
  const existing = await findTrackByName(name);
  if (existing) {
    throw new TrackExistsError(`Track "${name}" already exists`);
  }

  const trackId = generateTrackId(name);
  const timestamp = new Date().toISOString();

  const track = {
    track_id: trackId,
    name,
    type,
    status: 'draft',
    priority,
    created_at: timestamp,
    updated_at: timestamp,
    context: {
      goal,
      success_criteria: successCriteria,
      target_files: [],
      prerequisites: [],
    },
    steps: [],
    progress: {
      current_step: 0,
      completed_steps: 0,
      total_steps: 0,
      percentage: 0,
    },
    execution: {
      mode: 'interactive',
      auto_advance: false,
      pause_on_failure: true,
    },
  };

  // Initialize directory structure
  await initializeTrackDirectory(trackId);

  // Save track definition
  await saveTrack(track);

  // Register in track registry
  const registry = new TrackRegistry();
  await registry.registerTrack(track);

  return track;
}

/**
 * Activate track (ready → active)
 * @param {string} trackId - Track ID
 * @param {Object} options - Activation options
 * @returns {Promise<Object>} Activated track
 */
export async function activateTrack(trackId, options = {}) {
  const unlock = await acquireRegistryLock();

  try {
    const track = await loadTrack(trackId);
    const registry = new TrackRegistry();

    // Validate state
    if (track.status !== 'ready' && track.status !== 'draft') {
      throw new InvalidStateError(`Cannot activate track in ${track.status} status`);
    }

    // Check for active track
    const activeTrack = await getActiveTrack();
    if (activeTrack && activeTrack.track_id !== trackId && !options.force) {
      throw new ActiveTrackExistsError(
        `Track "${activeTrack.name}" is already active. Use --force to override or 'switch' command.`
      );
    }

    // Suspend other active track if force
    if (activeTrack && options.force && activeTrack.track_id !== trackId) {
      await suspendTrack(activeTrack.track_id, `Suspended for new track activation: ${trackId}`);
    }

    // Transition to active
    track.status = 'active';
    track.started_at = new Date().toISOString();
    track.updated_at = track.started_at;

    await saveTrack(track);
    await registry.updateTrack(trackId, { status: 'active', started_at: track.started_at });

    return track;
  } finally {
    await unlock();
  }
}

/**
 * Suspend track (active → paused)
 * @param {string} trackId - Track ID
 * @param {string} reason - Suspension reason
 * @returns {Promise<Object>} Suspended track with checkpoint
 */
export async function suspendTrack(trackId, reason = 'Manual suspension') {
  const track = await loadTrack(trackId);

  if (track.status !== 'active') {
    throw new InvalidStateError(`Cannot suspend track in ${track.status} status`);
  }

  // Create checkpoint before suspending
  let checkpoint = null;
  try {
    checkpoint = await createSnapshot({
      type: 'checkpoint',
      runId: trackId,
      description: `Pre-suspension checkpoint: ${reason}`,
    });
  } catch (error) {
    console.warn(`Warning: Failed to create checkpoint: ${error.message}`);
  }

  track.status = 'paused';
  track.paused_at = new Date().toISOString();
  track.pause_reason = reason;
  if (checkpoint) {
    track.last_checkpoint = checkpoint.snapshot_id;
  }
  track.updated_at = track.paused_at;

  await saveTrack(track);

  const registry = new TrackRegistry();
  await registry.updateTrack(trackId, { status: 'paused' });

  return { track, checkpoint };
}

/**
 * Resume track (paused → active)
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} Resumed track
 */
export async function resumeTrack(trackId) {
  const unlock = await acquireRegistryLock();

  try {
    const track = await loadTrack(trackId);

    if (track.status !== 'paused') {
      throw new InvalidStateError(`Cannot resume track in ${track.status} status`);
    }

    // Check if another track is active
    const activeTrack = await getActiveTrack();
    if (activeTrack && activeTrack.track_id !== trackId) {
      throw new ActiveTrackExistsError(
        `Track "${activeTrack.name}" is active. Suspend it first before resuming.`
      );
    }

    track.status = 'active';
    track.resumed_at = new Date().toISOString();
    track.updated_at = track.resumed_at;
    delete track.paused_at;
    delete track.pause_reason;

    await saveTrack(track);

    const registry = new TrackRegistry();
    await registry.updateTrack(trackId, { status: 'active' });

    return track;
  } finally {
    await unlock();
  }
}

/**
 * Complete track (active → completed)
 * @param {string} trackId - Track ID
 * @param {Object} outcomes - Track outcomes
 * @returns {Promise<Object>} Completed track
 */
export async function completeTrack(trackId, outcomes = {}) {
  const track = await loadTrack(trackId);

  if (track.status !== 'active') {
    throw new InvalidStateError(`Cannot complete track in ${track.status} status`);
  }

  track.status = 'completed';
  track.completed_at = new Date().toISOString();
  track.updated_at = track.completed_at;
  track.outcomes = {
    result: 'success',
    artifacts_created: outcomes.artifactsCreated || [],
    files_modified: outcomes.filesModified || [],
    suggestions_generated: outcomes.suggestionsGenerated || [],
    next_tracks: outcomes.nextTracks || [],
    summary: outcomes.summary || '',
    lessons_learned: outcomes.lessonsLearned || [],
    ...outcomes,
  };

  await saveTrack(track);

  const registry = new TrackRegistry();
  await registry.updateTrack(trackId, {
    status: 'completed',
    completed_at: track.completed_at,
  });

  return track;
}

/**
 * Switch from one track to another (with checkpoint)
 * @param {string} fromTrackId - Source track ID (active track)
 * @param {string} toTrackId - Target track ID (paused or ready track)
 * @returns {Promise<Object>} Switch result
 */
export async function switchTrack(fromTrackId, toTrackId) {
  const fromTrack = await loadTrack(fromTrackId);
  const toTrack = await loadTrack(toTrackId);

  // Validate source track
  if (fromTrack.status !== 'active') {
    throw new InvalidStateError(`Source track must be active. Current status: ${fromTrack.status}`);
  }

  // Validate target track
  if (toTrack.status !== 'paused' && toTrack.status !== 'ready') {
    throw new InvalidStateError(
      `Target track must be paused or ready. Current status: ${toTrack.status}`
    );
  }

  // Suspend current track (creates checkpoint)
  const { checkpoint } = await suspendTrack(fromTrackId, `Switched to ${toTrackId}`);

  // Activate target track
  const activatedTrack = await activateTrack(toTrackId);

  return {
    suspended: fromTrackId,
    activated: toTrackId,
    checkpoint: checkpoint?.snapshot_id || null,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'create') {
      const nameIndex = args.indexOf('--name');
      const typeIndex = args.indexOf('--type');
      const goalIndex = args.indexOf('--goal');
      const priorityIndex = args.indexOf('--priority');

      if (nameIndex === -1 || nameIndex === args.length - 1) {
        console.error(
          'Usage: node manager.mjs create --name <name> [--type <type>] [--goal <goal>] [--priority <priority>]'
        );
        process.exit(1);
      }

      const name = args[nameIndex + 1];
      const type = typeIndex !== -1 ? args[typeIndex + 1] : undefined;
      const goal = goalIndex !== -1 ? args[goalIndex + 1] : undefined;
      const priority = priorityIndex !== -1 ? args[priorityIndex + 1] : undefined;

      const track = await createTrack({ name, type, goal, priority });
      console.log(JSON.stringify(track, null, 2));
    } else if (command === 'activate') {
      const trackIdIndex = args.indexOf('--track-id');
      const force = args.includes('--force');

      if (trackIdIndex === -1 || trackIdIndex === args.length - 1) {
        console.error('Usage: node manager.mjs activate --track-id <id> [--force]');
        process.exit(1);
      }

      const trackId = args[trackIdIndex + 1];
      const track = await activateTrack(trackId, { force });
      console.log(JSON.stringify(track, null, 2));
    } else if (command === 'pause') {
      const trackIdIndex = args.indexOf('--track-id');
      const reasonIndex = args.indexOf('--reason');

      if (trackIdIndex === -1 || trackIdIndex === args.length - 1) {
        console.error('Usage: node manager.mjs pause --track-id <id> --reason <reason>');
        process.exit(1);
      }

      const trackId = args[trackIdIndex + 1];
      const reason = reasonIndex !== -1 ? args[reasonIndex + 1] : 'Manual pause';

      const result = await suspendTrack(trackId, reason);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'resume') {
      const trackIdIndex = args.indexOf('--track-id');

      if (trackIdIndex === -1 || trackIdIndex === args.length - 1) {
        console.error('Usage: node manager.mjs resume --track-id <id>');
        process.exit(1);
      }

      const trackId = args[trackIdIndex + 1];
      const track = await resumeTrack(trackId);
      console.log(JSON.stringify(track, null, 2));
    } else if (command === 'complete') {
      const trackIdIndex = args.indexOf('--track-id');

      if (trackIdIndex === -1 || trackIdIndex === args.length - 1) {
        console.error('Usage: node manager.mjs complete --track-id <id>');
        process.exit(1);
      }

      const trackId = args[trackIdIndex + 1];
      const track = await completeTrack(trackId);
      console.log(JSON.stringify(track, null, 2));
    } else if (command === 'switch') {
      const toIndex = args.indexOf('--to');

      if (toIndex === -1 || toIndex === args.length - 1) {
        console.error('Usage: node manager.mjs switch --to <track-id>');
        process.exit(1);
      }

      const toTrackId = args[toIndex + 1];

      // Get active track
      const activeTrack = await getActiveTrack();
      if (!activeTrack) {
        console.error('No active track to switch from');
        process.exit(1);
      }

      const result = await switchTrack(activeTrack.track_id, toTrackId);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(
        'Unknown command. Available: create, activate, pause, resume, complete, switch'
      );
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

export default {
  createTrack,
  activateTrack,
  suspendTrack,
  resumeTrack,
  completeTrack,
  switchTrack,
  loadTrack,
  saveTrack,
};
