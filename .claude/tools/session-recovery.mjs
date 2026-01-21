#!/usr/bin/env node
/**
 * Session Recovery - Detect and resume interrupted workflow sessions
 *
 * Analyzes run records to detect interrupted sessions and offers recovery options.
 * Integrates with snapshot-manager for state restoration.
 *
 * Usage:
 *   node session-recovery.mjs detect
 *   node session-recovery.mjs resume --run-id <id>
 *   node session-recovery.mjs list-interrupted
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readRun, updateRun } from './run-manager.mjs';
import { listSnapshots, getSnapshot } from './snapshot-manager.mjs';
import { getActiveTrack } from '../skills/track-manager/registry.mjs';
import { loadTrack, resumeTrack } from '../skills/track-manager/manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RUNS_DIR = join(__dirname, '../context/runtime/runs');
const TRACKS_DIR = join(__dirname, '../conductor/tracks');
const DEFAULT_STALE_THRESHOLD_MS = 1800000; // 30 minutes

async function tryReadJson(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Detect interrupted sessions
 * @returns {Promise<Array>} Array of interrupted sessions
 */
export async function detectInterruptedSessions() {
  const interrupted = [];

  // Check workflow runs
  if (existsSync(RUNS_DIR)) {
    const runDirs = await readdir(RUNS_DIR, { withFileTypes: true });

    for (const dirent of runDirs) {
      if (!dirent.isDirectory()) continue;

      const runId = dirent.name;

      try {
        let runRecord = null;
        try {
          runRecord = await readRun(runId);
        } catch {
          // Hook-driven runs may only have state.json, not run.json
          const statePath = join(RUNS_DIR, runId, 'state.json');
          runRecord = await tryReadJson(statePath);
        }
        if (!runRecord) continue;

        // Detect interruption: status is 'in_progress' or 'pending' but hasn't been updated recently
        const status = String(runRecord.status || '').toLowerCase();
        const lastUpdated =
          runRecord.updated_at ||
          runRecord.last_event_at ||
          runRecord.last_heartbeat_at ||
          runRecord.timestamps?.last_step_completed_at ||
          null;

        const thresholdMs = Number.isFinite(runRecord.stale_after_ms)
          ? runRecord.stale_after_ms
          : DEFAULT_STALE_THRESHOLD_MS;

        const isStale =
          (status === 'in_progress' || status === 'pending' || status === 'running') &&
          lastUpdated &&
          isStaleTimestamp(lastUpdated, thresholdMs);

        if (isStale) {
          interrupted.push({
            type: 'workflow_run',
            id: runId,
            status: runRecord.status,
            workflow: runRecord.selected_workflow || runRecord.workflow_name,
            current_step: runRecord.current_step,
            last_updated: lastUpdated,
            age_minutes: Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000),
          });
        }
      } catch (error) {
        // Skip invalid run records
        console.warn(`Warning: Failed to read run ${runId}: ${error.message}`);
      }
    }
  }

  // Check tracks
  if (existsSync(TRACKS_DIR)) {
    const trackDirs = await readdir(TRACKS_DIR, { withFileTypes: true });

    for (const dirent of trackDirs) {
      if (!dirent.isDirectory() || dirent.name === 'track-registry.json') continue;

      const trackId = dirent.name;

      try {
        const track = await loadTrack(trackId);

        // Detect interruption: status is 'active' but hasn't been updated recently
        const isStale =
          track.status === 'active' &&
          isStaleTimestamp(track.updated_at, DEFAULT_STALE_THRESHOLD_MS);

        if (isStale) {
          interrupted.push({
            type: 'track',
            id: trackId,
            name: track.name,
            status: track.status,
            progress_percentage: track.progress.percentage,
            last_updated: track.updated_at,
            age_minutes: Math.floor((Date.now() - new Date(track.updated_at)) / 60000),
          });
        }
      } catch (error) {
        // Skip invalid track records
        console.warn(`Warning: Failed to read track ${trackId}: ${error.message}`);
      }
    }
  }

  return interrupted;
}

/**
 * Check if timestamp is stale
 * @param {string} timestamp - ISO timestamp
 * @param {number} thresholdMs - Threshold in milliseconds
 * @returns {boolean} Whether timestamp is stale
 */
function isStaleTimestamp(timestamp, thresholdMs) {
  const age = Date.now() - new Date(timestamp).getTime();
  return age > thresholdMs;
}

/**
 * Resume interrupted workflow session
 * @param {string} runId - Run ID to resume
 * @returns {Promise<Object>} Resume result
 */
export async function resumeWorkflowSession(runId) {
  const runRecord = await readRun(runId);

  // Find latest snapshot for this run
  const snapshots = await listSnapshots({ runId });

  if (snapshots.length === 0) {
    return {
      success: false,
      error: 'No snapshots found for this run. Cannot restore state.',
      suggestion: 'Start workflow from scratch or manually restore state.',
    };
  }

  // Use the most recent snapshot
  const latestSnapshot = snapshots[0];
  const snapshot = await getSnapshot(latestSnapshot.snapshot_id);

  // Update run status to in_progress
  await updateRun(runId, {
    status: 'in_progress',
    recovery_info: {
      recovered_at: new Date().toISOString(),
      recovered_from_snapshot: latestSnapshot.snapshot_id,
      original_status: runRecord.status,
    },
  });

  return {
    success: true,
    run_id: runId,
    resumed_from_step: runRecord.current_step,
    snapshot_used: latestSnapshot.snapshot_id,
    snapshot_created_at: latestSnapshot.created_at,
    state: snapshot.state,
  };
}

/**
 * Resume interrupted track session
 * @param {string} trackId - Track ID to resume
 * @returns {Promise<Object>} Resume result
 */
export async function resumeTrackSession(trackId) {
  try {
    // Check if track is already active
    const activeTrack = await getActiveTrack();
    if (activeTrack && activeTrack.track_id === trackId) {
      return {
        success: true,
        message: 'Track is already active',
        track_id: trackId,
      };
    }

    // Resume track (handles state transitions and checkpoint restoration)
    const track = await resumeTrack(trackId);

    return {
      success: true,
      track_id: trackId,
      track_name: track.name,
      progress_percentage: track.progress.percentage,
      checkpoint_restored: track.last_checkpoint || null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      suggestion: 'Manually activate the track using track-manager',
    };
  }
}

/**
 * Interactive recovery prompt
 */
async function interactiveRecovery() {
  const interrupted = await detectInterruptedSessions();

  if (interrupted.length === 0) {
    console.log('No interrupted sessions detected.');
    return;
  }

  console.log(`\nDetected ${interrupted.length} interrupted session(s):\n`);

  for (const session of interrupted) {
    if (session.type === 'workflow_run') {
      console.log(`- Workflow Run: ${session.id}`);
      console.log(`  Status: ${session.status}`);
      console.log(`  Workflow: ${session.workflow}`);
      console.log(`  Current Step: ${session.current_step}`);
      console.log(`  Last Updated: ${session.last_updated} (${session.age_minutes} minutes ago)`);
    } else if (session.type === 'track') {
      console.log(`- Track: ${session.name} (${session.id})`);
      console.log(`  Status: ${session.status}`);
      console.log(`  Progress: ${session.progress_percentage}%`);
      console.log(`  Last Updated: ${session.last_updated} (${session.age_minutes} minutes ago)`);
    }
    console.log();
  }

  // In a real interactive session, we would prompt user for recovery
  // For now, we just show the options
  console.log('Recovery Options:');
  console.log('1. Resume workflow: node session-recovery.mjs resume --run-id <id>');
  console.log('2. Resume track: node session-recovery.mjs resume --track-id <id>');
  console.log('3. Ignore and start new session');
}

/**
 * Auto-save session state
 * @param {string} runId - Run ID
 * @param {Object} state - State to save
 * @returns {Promise<void>}
 */
export async function autoSaveSessionState(runId, state) {
  const { createSnapshot } = await import('./snapshot-manager.mjs');

  await createSnapshot({
    type: 'auto',
    runId,
    description: 'Auto-save session state',
    trigger: {
      type: 'auto_save',
      reason: 'Step completion',
    },
  });
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'detect') {
      await interactiveRecovery();
    } else if (command === 'list-interrupted') {
      const interrupted = await detectInterruptedSessions();
      console.log(JSON.stringify(interrupted, null, 2));
    } else if (command === 'resume') {
      const runIdIndex = args.indexOf('--run-id');
      const trackIdIndex = args.indexOf('--track-id');

      if (runIdIndex !== -1 && runIdIndex !== args.length - 1) {
        const runId = args[runIdIndex + 1];
        const result = await resumeWorkflowSession(runId);
        console.log(JSON.stringify(result, null, 2));
      } else if (trackIdIndex !== -1 && trackIdIndex !== args.length - 1) {
        const trackId = args[trackIdIndex + 1];
        const result = await resumeTrackSession(trackId);
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error('Usage: node session-recovery.mjs resume --run-id <id> OR --track-id <id>');
        process.exit(1);
      }
    } else {
      console.error('Unknown command. Available: detect, list-interrupted, resume');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  process.argv[1] &&
  (() => {
    const argvPath = String(process.argv[1]).replace(/\\/g, '/');
    return (
      import.meta.url === `file://${process.argv[1]}` ||
      import.meta.url === `file:///${argvPath}` ||
      import.meta.url.endsWith(`/${argvPath}`)
    );
  })();

if (isMainModule) {
  main();
}

export default {
  detectInterruptedSessions,
  resumeWorkflowSession,
  resumeTrackSession,
  autoSaveSessionState,
};
