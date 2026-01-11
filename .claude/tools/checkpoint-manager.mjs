#!/usr/bin/env node
/**
 * Checkpoint Manager - Automatic step boundary artifacts for long-running tasks
 *
 * Creates checkpoints at step boundaries to enable recovery from interruption
 * Checkpoints are automatic artifacts created after each workflow step
 *
 * Usage:
 *   node .claude/tools/checkpoint-manager.mjs create --run-id <id> --step <number>
 *   node .claude/tools/checkpoint-manager.mjs restore --run-id <id> --checkpoint-id <id>
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import {
  readRun,
  readArtifactRegistry,
  getRunDirectoryStructure,
  registerArtifact,
} from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Compute SHA256 checksum of checkpoint data
 * @param {Object} data - Checkpoint data
 * @returns {string} Hex checksum
 */
function _computeChecksum(data) {
  const dataString = JSON.stringify(data);
  return createHash('sha256').update(dataString).digest('hex');
}

/**
 * Validate checkpoint integrity using checksum
 * @param {Object} checkpoint - Checkpoint object
 * @returns {Object} Validation result
 */
function _validateChecksum(checkpoint) {
  if (!checkpoint.metadata?.checksum) {
    return { valid: false, error: 'Checkpoint missing checksum' };
  }

  // Recompute checksum from checkpoint data (excluding metadata.checksum)
  const { metadata, ...checkpointData } = checkpoint;
  const { checksum, ...metadataWithoutChecksum } = metadata || {};
  const dataToCheck = { ...checkpointData, metadata: metadataWithoutChecksum };
  const computedChecksum = _computeChecksum(dataToCheck);

  if (computedChecksum !== checksum) {
    return { valid: false, error: 'Checksum mismatch - checkpoint may be corrupted' };
  }

  return { valid: true };
}

/**
 * Prune old checkpoints, keeping only the last 5
 * @param {string} runId - Run ID
 * @returns {Promise<number>} Number of checkpoints deleted
 */
async function _pruneOldCheckpoints(runId) {
  const checkpoints = await listCheckpoints(runId);

  if (checkpoints.length <= 5) {
    return 0; // No pruning needed
  }

  // Sort by timestamp (newest first) and keep last 5
  const sorted = checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const toKeep = sorted.slice(0, 5);
  const toDelete = sorted.slice(5);

  let deletedCount = 0;
  for (const checkpoint of toDelete) {
    try {
      await unlink(checkpoint.path);
      deletedCount++;
    } catch (error) {
      console.warn(
        `Warning: Failed to delete checkpoint ${checkpoint.checkpoint_id}: ${error.message}`
      );
    }
  }

  return deletedCount;
}

/**
 * Create checkpoint at step boundary
 * @param {string} runId - Run ID
 * @param {number} step - Step number
 * @param {Object} stepState - Current step state
 * @returns {Promise<Object>} Checkpoint data
 */
export async function createCheckpoint(runId, step, stepState = {}) {
  const runRecord = await readRun(runId);
  const artifactRegistry = await readArtifactRegistry(runId);
  const runDirs = getRunDirectoryStructure(runId);

  // Ensure checkpoints directory exists
  const checkpointsDir = join(runDirs.run_dir, 'checkpoints');
  if (!existsSync(checkpointsDir)) {
    await mkdir(checkpointsDir, { recursive: true });
  }

  const checkpointId = `checkpoint-step-${step}-${Date.now()}`;
  const checkpointPath = join(checkpointsDir, `${checkpointId}.json`);

  // Create checkpoint data (without checksum first)
  const checkpointData = {
    checkpoint_id: checkpointId,
    run_id: runId,
    workflow_id: runRecord.workflow_id,
    step: step,
    timestamp: new Date().toISOString(),
    run_record: runRecord,
    artifact_registry: artifactRegistry,
    step_state: stepState,
    artifacts_at_checkpoint: Object.keys(artifactRegistry.artifacts || {}),
    validation_summary: {
      total_artifacts: Object.keys(artifactRegistry.artifacts || {}).length,
      validated_artifacts: Object.values(artifactRegistry.artifacts || {}).filter(
        a => a.metadata?.validation_status === 'pass'
      ).length,
      failed_validations: Object.values(artifactRegistry.artifacts || {}).filter(
        a => a.metadata?.validation_status === 'fail'
      ).length,
    },
    recovery_instructions: [
      `Resume workflow from step ${step + 1}`,
      `Load artifact registry from ${runDirs.artifact_registry}`,
      `Read run record from ${runDirs.run_json}`,
      `Verify all artifacts from step ${step} are present`,
    ],
  };

  // Compute checksum and add to metadata
  const checksum = _computeChecksum(checkpointData);
  const checkpoint = {
    ...checkpointData,
    metadata: {
      checksum: checksum,
      created_by: 'checkpoint-manager',
      version: '1.0',
    },
  };

  // Save checkpoint
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

  // Register checkpoint as artifact
  await registerArtifact(runId, {
    name: `${checkpointId}.json`,
    step: step,
    agent: 'checkpoint-manager',
    path: checkpointPath,
    dependencies: [],
    type: 'checkpoint',
    validationStatus: 'pass',
    size: JSON.stringify(checkpoint).length,
  });

  // Prune old checkpoints (keep last 5)
  const deletedCount = await _pruneOldCheckpoints(runId);
  if (deletedCount > 0) {
    console.log(`   ℹ️  Pruned ${deletedCount} old checkpoint(s), keeping last 5`);
  }

  return checkpoint;
}

/**
 * Restore from checkpoint
 * @param {string} runId - Run ID
 * @param {string} checkpointId - Checkpoint ID
 * @returns {Promise<Object>} Restored state
 */
export async function restoreFromCheckpoint(runId, checkpointId) {
  const runDirs = getRunDirectoryStructure(runId);
  const checkpointsDir = join(runDirs.run_dir, 'checkpoints');
  const checkpointPath = join(checkpointsDir, `${checkpointId}.json`);

  if (!existsSync(checkpointPath)) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  const checkpointContent = await readFile(checkpointPath, 'utf-8');
  const checkpoint = JSON.parse(checkpointContent);

  // Validate checksum before restoration
  const checksumValidation = _validateChecksum(checkpoint);
  if (!checksumValidation.valid) {
    throw new Error(`Checkpoint integrity check failed: ${checksumValidation.error}`);
  }

  // Restore run record
  const { updateRun } = await import('./run-manager.mjs');
  await updateRun(runId, {
    current_step: checkpoint.step,
    status: 'in_progress',
    ...checkpoint.run_record,
  });

  // Restore artifact registry
  const registryPath = getRunDirectoryStructure(runId).artifact_registry;
  await writeFile(registryPath, JSON.stringify(checkpoint.artifact_registry, null, 2), 'utf-8');

  return {
    checkpoint: checkpoint,
    restored_step: checkpoint.step,
    artifacts_restored: checkpoint.artifacts_at_checkpoint.length,
    recovery_instructions: checkpoint.recovery_instructions,
  };
}

/**
 * List checkpoints for a run
 * @param {string} runId - Run ID
 * @returns {Promise<Array>} List of checkpoints
 */
export async function listCheckpoints(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const checkpointsDir = join(runDirs.run_dir, 'checkpoints');

  if (!existsSync(checkpointsDir)) {
    return [];
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(checkpointsDir);
  const checkpoints = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      const checkpointPath = join(checkpointsDir, file);
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);
      checkpoints.push({
        checkpoint_id: checkpoint.checkpoint_id,
        step: checkpoint.step,
        timestamp: checkpoint.timestamp,
        path: checkpointPath,
      });
    }
  }

  return checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'create') {
    const runIdIndex = args.indexOf('--run-id');
    const stepIndex = args.indexOf('--step');

    if (runIdIndex === -1 || stepIndex === -1) {
      console.error('Usage: node checkpoint-manager.mjs create --run-id <id> --step <number>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const step = parseInt(args[stepIndex + 1], 10);

    const checkpoint = await createCheckpoint(runId, step);
    console.log(JSON.stringify(checkpoint, null, 2));
  } else if (command === 'restore') {
    const runIdIndex = args.indexOf('--run-id');
    const checkpointIndex = args.indexOf('--checkpoint-id');

    if (runIdIndex === -1 || checkpointIndex === -1) {
      console.error(
        'Usage: node checkpoint-manager.mjs restore --run-id <id> --checkpoint-id <id>'
      );
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const checkpointId = args[checkpointIndex + 1];

    const restored = await restoreFromCheckpoint(runId, checkpointId);
    console.log(JSON.stringify(restored, null, 2));
  } else if (command === 'list') {
    const runIdIndex = args.indexOf('--run-id');

    if (runIdIndex === -1) {
      console.error('Usage: node checkpoint-manager.mjs list --run-id <id>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const checkpoints = await listCheckpoints(runId);
    console.log(JSON.stringify(checkpoints, null, 2));
  } else {
    console.error('Unknown command. Available: create, restore, list');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  createCheckpoint,
  restoreFromCheckpoint,
  listCheckpoints,
};
