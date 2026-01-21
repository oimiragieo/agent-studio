#!/usr/bin/env node
/**
 * Snapshot Manager - State management and smart revert capability
 *
 * Creates compressed snapshots of workflow state for error recovery and rollback
 * Supports multiple snapshot types: manual, auto, checkpoint, milestone, recovery
 *
 * Usage:
 *   node .claude/tools/snapshot-manager.mjs create --type manual --description "Before refactoring"
 *   node .claude/tools/snapshot-manager.mjs create --run-id <id> --type auto
 *   node .claude/tools/snapshot-manager.mjs list [--run-id <id>]
 *   node .claude/tools/snapshot-manager.mjs get --snapshot-id <id>
 *   node .claude/tools/snapshot-manager.mjs delete --snapshot-id <id>
 *   node .claude/tools/snapshot-manager.mjs prune [--keep-count 10]
 */

import { readFile, writeFile, mkdir, unlink, readdir, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import {
  readRun,
  readArtifactRegistry,
  getRunDirectoryStructure,
  registerArtifact,
} from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Snapshot storage location
const SNAPSHOTS_DIR = join(__dirname, '../conductor/context/snapshots');
const DEFAULT_KEEP_COUNT = 10;
const COMPRESSION_ENABLED = true;

/**
 * Ensure snapshots directory exists
 */
async function ensureSnapshotsDir() {
  if (!existsSync(SNAPSHOTS_DIR)) {
    await mkdir(SNAPSHOTS_DIR, { recursive: true });
  }
}

/**
 * Generate unique snapshot ID
 * @param {string} type - Snapshot type
 * @returns {string} Snapshot ID
 */
function generateSnapshotId(type) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `snap-${type}-${timestamp}-${random}`;
}

/**
 * Compute SHA256 checksum of data
 * @param {Object} data - Data to checksum
 * @returns {string} Hex checksum
 */
function computeChecksum(data) {
  const dataString = JSON.stringify(data);
  return createHash('sha256').update(dataString).digest('hex');
}

/**
 * Validate snapshot integrity using checksum
 * @param {Object} snapshot - Snapshot object
 * @returns {Object} Validation result
 */
function validateChecksum(snapshot) {
  if (!snapshot.validation?.checksum) {
    return { valid: false, error: 'Snapshot missing checksum' };
  }

  // Recompute checksum from state data
  const computedChecksum = computeChecksum(snapshot.state);

  if (computedChecksum !== snapshot.validation.checksum) {
    return {
      valid: false,
      error: 'Checksum mismatch - snapshot may be corrupted',
    };
  }

  return { valid: true };
}

/**
 * Get git information for snapshot
 * @returns {Promise<Object>} Git state
 */
async function getGitState() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // Get current commit SHA
    const { stdout: gitRef } = await execAsync('git rev-parse HEAD', {
      cwd: join(__dirname, '../..'),
    });

    // Check if working tree is dirty
    const { stdout: gitStatus } = await execAsync('git status --porcelain', {
      cwd: join(__dirname, '../..'),
    });

    return {
      git_ref: gitRef.trim(),
      git_dirty: gitStatus.trim().length > 0,
    };
  } catch (error) {
    // Git not available or not a git repository
    return {
      git_ref: null,
      git_dirty: false,
    };
  }
}

/**
 * Capture current project state
 * @param {string|null} runId - Optional run ID to capture run-specific state
 * @returns {Promise<Object>} State object
 */
async function captureState(runId = null) {
  const state = {
    version: '1.0.0',
  };

  // Project state
  const gitState = await getGitState();
  state.project = {
    root_path: join(__dirname, '../..'),
    analysis_id: null,
    ...gitState,
  };

  // Workflow state (if run ID provided)
  if (runId) {
    try {
      const runRecord = await readRun(runId);
      const artifactRegistry = await readArtifactRegistry(runId);

      state.workflows = {
        active_runs: [runId],
        completed_runs: runRecord.status === 'completed' ? [runId] : [],
        run_summaries: {
          [runId]: {
            workflow_name: runRecord.selected_workflow || 'unknown',
            status: runRecord.status,
            current_step: runRecord.current_step,
            total_steps: runRecord.task_queue?.length || 0,
          },
        },
      };

      // Artifacts state
      const artifacts = Object.values(artifactRegistry.artifacts || {});
      state.artifacts = {
        count: artifacts.length,
        recent: artifacts
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20)
          .map(a => ({
            path: a.path,
            type: a.metadata?.type || a.type || 'unknown',
            created_at: a.created_at,
            size_bytes: a.metadata?.size || 0,
          })),
      };
    } catch (error) {
      console.warn(`Warning: Failed to capture workflow state: ${error.message}`);
    }
  }

  // Context state (placeholder - can be extended)
  state.context = {
    tokens_used: 0,
    tokens_limit: 200000,
    compression_level: 0,
    files_in_context: [],
  };

  return state;
}

/**
 * Calculate snapshot size (excluding compression)
 * @param {Object} snapshot - Snapshot object
 * @returns {number} Size in bytes
 */
function calculateSnapshotSize(snapshot) {
  return Buffer.byteLength(JSON.stringify(snapshot), 'utf-8');
}

/**
 * Compress snapshot data using gzip
 * @param {string} inputPath - Path to uncompressed JSON
 * @param {string} outputPath - Path to compressed output
 * @returns {Promise<Object>} Compression stats
 */
async function compressSnapshot(inputPath, outputPath) {
  const startTime = Date.now();
  const inputStats = await stat(inputPath);
  const originalSize = inputStats.size;

  await pipeline(createReadStream(inputPath), createGzip(), createWriteStream(outputPath));

  const outputStats = await stat(outputPath);
  const compressedSize = outputStats.size;
  const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

  return {
    original_size: originalSize,
    compressed_size: compressedSize,
    compression_ratio: parseFloat(compressionRatio),
    compression_time_ms: Date.now() - startTime,
  };
}

/**
 * Decompress snapshot data
 * @param {string} inputPath - Path to compressed file
 * @param {string} outputPath - Path to decompressed output
 * @returns {Promise<void>}
 */
async function decompressSnapshot(inputPath, outputPath) {
  await pipeline(createReadStream(inputPath), createGunzip(), createWriteStream(outputPath));
}

/**
 * Create a new snapshot
 * @param {Object} options - Snapshot creation options
 * @param {string} options.type - Snapshot type (auto, manual, checkpoint, etc.)
 * @param {string} [options.runId] - Run ID to capture
 * @param {string} [options.name] - Human-readable name
 * @param {string} [options.description] - Description
 * @param {Object} [options.trigger] - Trigger information
 * @param {Object} [options.retention] - Retention policy
 * @returns {Promise<Object>} Created snapshot
 */
export async function createSnapshot(options = {}) {
  await ensureSnapshotsDir();

  const {
    type = 'manual',
    runId = null,
    name = null,
    description = null,
    trigger = null,
    retention = null,
  } = options;

  const snapshotId = generateSnapshotId(type);
  const timestamp = new Date().toISOString();

  // Capture current state
  const state = await captureState(runId);

  // Compute checksum
  const checksum = computeChecksum(state);

  // Build snapshot object
  const snapshot = {
    snapshot_id: snapshotId,
    type,
    created_at: timestamp,
    ...(name && { name }),
    ...(description && { description }),
    ...(trigger && { trigger }),
    state,
    restore_info: {
      restorable: true,
      restore_type: 'full',
      dependencies: [],
      git_operations_required: [],
      estimated_restore_time_ms: 1000,
      warnings: [],
    },
    validation: {
      is_valid: true,
      validated_at: timestamp,
      checksum,
      errors: [],
    },
    retention: retention || {
      policy: type === 'milestone' ? 'keep-forever' : 'auto',
      priority: type === 'milestone' ? 100 : type === 'manual' ? 50 : 10,
      pinned: type === 'milestone',
    },
    metadata: {
      manager_version: '1.0.0',
      compression: COMPRESSION_ENABLED ? 'gzip' : 'none',
      size_bytes: 0, // Will be updated after compression
      tags: [],
    },
  };

  // Save uncompressed snapshot temporarily
  const tempPath = join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  await writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Compress if enabled
  let finalPath = tempPath;
  let compressionStats = null;

  if (COMPRESSION_ENABLED) {
    const compressedPath = join(SNAPSHOTS_DIR, `${snapshotId}.json.gz`);
    compressionStats = await compressSnapshot(tempPath, compressedPath);

    // Delete uncompressed temp file
    await unlink(tempPath);
    finalPath = compressedPath;

    // Update snapshot metadata with compression info
    snapshot.metadata.size_bytes = compressionStats.compressed_size;
    snapshot.metadata.compression_stats = compressionStats;
  } else {
    const stats = await stat(tempPath);
    snapshot.metadata.size_bytes = stats.size;
  }

  // Register snapshot in artifact registry if run ID provided
  if (runId) {
    try {
      await registerArtifact(runId, {
        name: `${snapshotId}.json${COMPRESSION_ENABLED ? '.gz' : ''}`,
        step: -1, // Snapshots are not tied to specific steps
        agent: 'snapshot-manager',
        path: finalPath,
        dependencies: [],
        type: 'snapshot',
        validationStatus: 'pass',
        size: snapshot.metadata.size_bytes,
        metadata: {
          snapshot_id: snapshotId,
          snapshot_type: type,
          compression: snapshot.metadata.compression,
        },
      });
    } catch (error) {
      console.warn(`Warning: Failed to register snapshot in artifact registry: ${error.message}`);
    }
  }

  return {
    snapshot_id: snapshotId,
    type,
    created_at: timestamp,
    size_mb: (snapshot.metadata.size_bytes / (1024 * 1024)).toFixed(2),
    compression_ratio: compressionStats?.compression_ratio || 0,
    path: finalPath,
  };
}

/**
 * List all snapshots
 * @param {Object} options - List options
 * @param {string} [options.runId] - Filter by run ID
 * @param {string} [options.type] - Filter by snapshot type
 * @returns {Promise<Array>} List of snapshot metadata
 */
export async function listSnapshots(options = {}) {
  await ensureSnapshotsDir();

  const files = await readdir(SNAPSHOTS_DIR);
  const snapshots = [];

  for (const file of files) {
    if (file.endsWith('.json') || file.endsWith('.json.gz')) {
      const snapshotPath = join(SNAPSHOTS_DIR, file);
      const isCompressed = file.endsWith('.gz');

      try {
        let snapshotData;

        if (isCompressed) {
          // Decompress to temp file
          const tempPath = join(SNAPSHOTS_DIR, `temp-${Date.now()}.json`);
          await decompressSnapshot(snapshotPath, tempPath);
          snapshotData = JSON.parse(await readFile(tempPath, 'utf-8'));
          await unlink(tempPath);
        } else {
          snapshotData = JSON.parse(await readFile(snapshotPath, 'utf-8'));
        }

        // Apply filters
        if (options.runId && !snapshotData.state?.workflows?.active_runs?.includes(options.runId)) {
          continue;
        }
        if (options.type && snapshotData.type !== options.type) {
          continue;
        }

        snapshots.push({
          snapshot_id: snapshotData.snapshot_id,
          type: snapshotData.type,
          created_at: snapshotData.created_at,
          name: snapshotData.name || null,
          description: snapshotData.description || null,
          size_mb: (snapshotData.metadata.size_bytes / (1024 * 1024)).toFixed(2),
          compression: snapshotData.metadata.compression,
          pinned: snapshotData.retention?.pinned || false,
          path: snapshotPath,
        });
      } catch (error) {
        console.warn(`Warning: Failed to read snapshot ${file}: ${error.message}`);
      }
    }
  }

  return snapshots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Get a specific snapshot by ID
 * @param {string} snapshotId - Snapshot ID
 * @returns {Promise<Object>} Snapshot object
 */
export async function getSnapshot(snapshotId) {
  await ensureSnapshotsDir();

  const compressedPath = join(SNAPSHOTS_DIR, `${snapshotId}.json.gz`);
  const uncompressedPath = join(SNAPSHOTS_DIR, `${snapshotId}.json`);

  let snapshotPath;
  let isCompressed;

  if (existsSync(compressedPath)) {
    snapshotPath = compressedPath;
    isCompressed = true;
  } else if (existsSync(uncompressedPath)) {
    snapshotPath = uncompressedPath;
    isCompressed = false;
  } else {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  let snapshot;

  if (isCompressed) {
    // Decompress to temp file
    const tempPath = join(SNAPSHOTS_DIR, `temp-${Date.now()}.json`);
    await decompressSnapshot(snapshotPath, tempPath);
    snapshot = JSON.parse(await readFile(tempPath, 'utf-8'));
    await unlink(tempPath);
  } else {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf-8'));
  }

  // Validate checksum
  const validation = validateChecksum(snapshot);
  if (!validation.valid) {
    throw new Error(`Snapshot integrity check failed: ${validation.error}`);
  }

  return snapshot;
}

/**
 * Delete a snapshot
 * @param {string} snapshotId - Snapshot ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteSnapshot(snapshotId) {
  await ensureSnapshotsDir();

  const compressedPath = join(SNAPSHOTS_DIR, `${snapshotId}.json.gz`);
  const uncompressedPath = join(SNAPSHOTS_DIR, `${snapshotId}.json`);

  let snapshotPath;
  let deleted = false;

  if (existsSync(compressedPath)) {
    snapshotPath = compressedPath;
  } else if (existsSync(uncompressedPath)) {
    snapshotPath = uncompressedPath;
  } else {
    throw new Error(`Snapshot not found: ${snapshotId}`);
  }

  // Check if snapshot is pinned
  try {
    const snapshot = await getSnapshot(snapshotId);
    if (snapshot.retention?.pinned) {
      throw new Error(
        `Cannot delete pinned snapshot: ${snapshotId}. Unpin first or use --force flag.`
      );
    }
  } catch (error) {
    if (!error.message.includes('Cannot delete pinned')) {
      console.warn(`Warning: Could not verify snapshot status: ${error.message}`);
    } else {
      throw error;
    }
  }

  await unlink(snapshotPath);
  deleted = true;

  return {
    snapshot_id: snapshotId,
    deleted,
    path: snapshotPath,
  };
}

/**
 * Prune old snapshots, keeping the most recent ones
 * @param {Object} options - Prune options
 * @param {number} [options.keepCount] - Number of snapshots to keep
 * @param {boolean} [options.respectPinned] - Don't delete pinned snapshots
 * @returns {Promise<Object>} Prune result
 */
export async function pruneSnapshots(options = {}) {
  const { keepCount = DEFAULT_KEEP_COUNT, respectPinned = true } = options;

  const allSnapshots = await listSnapshots();

  // Separate pinned and unpinned
  const pinnedSnapshots = allSnapshots.filter(s => s.pinned);
  const unpinnedSnapshots = allSnapshots.filter(s => !s.pinned);

  // Calculate how many to delete
  const totalCount = respectPinned ? unpinnedSnapshots.length : allSnapshots.length;
  const deleteCount = Math.max(0, totalCount - keepCount);

  if (deleteCount === 0) {
    return {
      deleted_count: 0,
      kept_count: allSnapshots.length,
      message: `No snapshots to prune. Current count: ${allSnapshots.length}, keep count: ${keepCount}`,
    };
  }

  // Sort by created_at (oldest first) and select candidates for deletion
  const candidatesForDeletion = respectPinned ? unpinnedSnapshots : allSnapshots;
  const sortedCandidates = candidatesForDeletion.sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const toDelete = sortedCandidates.slice(0, deleteCount);

  let deletedCount = 0;
  const deletedIds = [];
  const errors = [];

  for (const snapshot of toDelete) {
    try {
      await deleteSnapshot(snapshot.snapshot_id);
      deletedCount++;
      deletedIds.push(snapshot.snapshot_id);
    } catch (error) {
      errors.push({
        snapshot_id: snapshot.snapshot_id,
        error: error.message,
      });
    }
  }

  return {
    deleted_count: deletedCount,
    deleted_snapshots: deletedIds,
    kept_count: allSnapshots.length - deletedCount,
    errors,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'create') {
    const typeIndex = args.indexOf('--type');
    const runIdIndex = args.indexOf('--run-id');
    const descIndex = args.indexOf('--description');

    if (typeIndex === -1) {
      console.error(
        'Usage: node snapshot-manager.mjs create --type <type> [--run-id <id>] [--description <text>]'
      );
      process.exit(1);
    }

    const type = args[typeIndex + 1];
    const runId = runIdIndex !== -1 ? args[runIdIndex + 1] : null;
    const description = descIndex !== -1 ? args[descIndex + 1] : null;

    const result = await createSnapshot({ type, runId, description });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'list') {
    const runIdIndex = args.indexOf('--run-id');
    const typeIndex = args.indexOf('--type');

    const runId = runIdIndex !== -1 ? args[runIdIndex + 1] : null;
    const type = typeIndex !== -1 ? args[typeIndex + 1] : null;

    const snapshots = await listSnapshots({ runId, type });
    console.log(JSON.stringify(snapshots, null, 2));
  } else if (command === 'get') {
    const snapshotIdIndex = args.indexOf('--snapshot-id');

    if (snapshotIdIndex === -1) {
      console.error('Usage: node snapshot-manager.mjs get --snapshot-id <id>');
      process.exit(1);
    }

    const snapshotId = args[snapshotIdIndex + 1];
    const snapshot = await getSnapshot(snapshotId);
    console.log(JSON.stringify(snapshot, null, 2));
  } else if (command === 'delete') {
    const snapshotIdIndex = args.indexOf('--snapshot-id');

    if (snapshotIdIndex === -1) {
      console.error('Usage: node snapshot-manager.mjs delete --snapshot-id <id>');
      process.exit(1);
    }

    const snapshotId = args[snapshotIdIndex + 1];
    const result = await deleteSnapshot(snapshotId);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'prune') {
    const keepCountIndex = args.indexOf('--keep-count');
    const keepCount = keepCountIndex !== -1 ? parseInt(args[keepCountIndex + 1], 10) : undefined;

    const result = await pruneSnapshots({ keepCount });
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error('Unknown command. Available: create, list, get, delete, prune');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export default {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  pruneSnapshots,
};
