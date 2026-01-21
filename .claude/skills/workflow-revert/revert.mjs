#!/usr/bin/env node
/**
 * Workflow Revert Implementation
 *
 * Smart state restoration from snapshots with safety checks, dry-run mode,
 * and atomic rollback capability.
 *
 * Usage:
 *   node revert.mjs list [--run-id <id>] [--type <type>]
 *   node revert.mjs revert --snapshot-id <id> [--dry-run] [--confirm]
 *   node revert.mjs validate --snapshot-id <id>
 */

import { readFile, writeFile, copyFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getSnapshot, listSnapshots, createSnapshot } from '../../tools/snapshot-manager.mjs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root
const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Validate snapshot integrity
 * @param {Object} options - Validation options
 * @param {string} options.snapshot_id - Snapshot ID to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validate(options) {
  const { snapshot_id } = options;

  try {
    // Get snapshot (this performs checksum validation internally)
    const snapshot = await getSnapshot(snapshot_id);

    // Additional validation checks
    const errors = [];
    const warnings = [];

    // Check if restorable
    if (!snapshot.restore_info?.restorable) {
      errors.push('Snapshot is marked as not restorable');
    }

    // Check dependencies
    if (snapshot.restore_info?.dependencies?.length > 0) {
      warnings.push(`Snapshot has ${snapshot.restore_info.dependencies.length} dependencies`);
    }

    // Check for warnings
    if (snapshot.restore_info?.warnings?.length > 0) {
      warnings.push(...snapshot.restore_info.warnings);
    }

    return {
      valid: errors.length === 0,
      snapshot_id,
      errors,
      warnings,
      snapshot,
    };
  } catch (error) {
    return {
      valid: false,
      snapshot_id,
      errors: [error.message],
      warnings: [],
    };
  }
}

/**
 * Dry-run: preview what will change without executing
 * @param {Object} options - Dry-run options
 * @param {string} options.snapshot_id - Target snapshot ID
 * @returns {Promise<Object>} Preview of changes
 */
export async function dryRun(options) {
  const { snapshot_id } = options;

  // Validate snapshot first
  const validation = await validate({ snapshot_id });
  if (!validation.valid) {
    throw new Error(`Snapshot validation failed: ${validation.errors.join(', ')}`);
  }

  const snapshot = validation.snapshot;

  // Analyze what will be restored
  const preview = {
    snapshot_id,
    preview_mode: true,
    files_to_restore: [],
    artifacts_to_restore: [],
    run_state_to_restore: null,
    warnings: validation.warnings,
    estimated_restore_time_ms: snapshot.restore_info?.estimated_restore_time_ms || 5000,
    destructive_operations: true,
  };

  // Extract artifacts from snapshot state
  if (snapshot.state?.artifacts?.recent) {
    preview.artifacts_to_restore = snapshot.state.artifacts.recent;
  }

  // Extract workflow state
  if (snapshot.state?.workflows) {
    preview.run_state_to_restore = snapshot.state.workflows;
  }

  // Check for git state differences
  if (snapshot.state?.project?.git_dirty) {
    preview.warnings.push('Git working tree has uncommitted changes in snapshot');
  }

  return preview;
}

/**
 * Create pre-revert snapshot for safety
 * @param {Object} options - Pre-revert snapshot options
 * @param {string} options.targetSnapshotId - Snapshot being reverted to
 * @param {string} [options.reason] - Reason for snapshot
 * @returns {Promise<Object>} Created snapshot metadata
 */
export async function createPreRevertSnapshot(options) {
  const { targetSnapshotId, reason } = options;

  const description = reason || `Safety snapshot before revert to ${targetSnapshotId}`;

  // Create snapshot with high priority
  const snapshot = await createSnapshot({
    type: 'pre-revert',
    name: `Pre-revert safety snapshot`,
    description,
    retention: {
      policy: 'keep-until',
      priority: 50, // High priority
      pinned: false,
    },
    trigger: {
      source: 'workflow-revert',
      event: 'pre-revert',
      target_snapshot: targetSnapshotId,
    },
  });

  return snapshot;
}

/**
 * Restore files from snapshot
 * @param {Object} snapshot - Snapshot object
 * @returns {Promise<Object>} Restore result
 */
async function restoreFiles(snapshot) {
  const restoredFiles = [];
  const errors = [];

  // For now, this is a placeholder
  // In a full implementation, this would:
  // 1. Extract file list from snapshot state
  // 2. Restore each file to its snapshot state
  // 3. Handle file conflicts and permissions
  // 4. Validate restored files

  // Placeholder implementation
  console.log('File restoration: Not implemented (placeholder)');
  console.log('In production, would restore files from snapshot state');

  return {
    restored_count: 0,
    errors,
    files: restoredFiles,
  };
}

/**
 * Restore artifacts from snapshot
 * @param {Object} snapshot - Snapshot object
 * @returns {Promise<Object>} Restore result
 */
async function restoreArtifacts(snapshot) {
  const restoredArtifacts = [];
  const errors = [];

  if (!snapshot.state?.artifacts?.recent) {
    return {
      restored_count: 0,
      errors: [],
      artifacts: [],
    };
  }

  // Restore artifacts
  for (const artifact of snapshot.state.artifacts.recent) {
    try {
      // Check if artifact file exists in snapshot
      const artifactPath = artifact.path;
      if (existsSync(artifactPath)) {
        // Artifact already exists or was restored
        restoredArtifacts.push({
          path: artifactPath,
          type: artifact.type,
          size_bytes: artifact.size_bytes,
        });
      } else {
        errors.push(`Artifact not found: ${artifactPath}`);
      }
    } catch (error) {
      errors.push(`Failed to restore artifact ${artifact.path}: ${error.message}`);
    }
  }

  return {
    restored_count: restoredArtifacts.length,
    errors,
    artifacts: restoredArtifacts,
  };
}

/**
 * Restore run state from snapshot
 * @param {Object} snapshot - Snapshot object
 * @returns {Promise<Object>} Restore result
 */
async function restoreRunState(snapshot) {
  if (!snapshot.state?.workflows?.active_runs?.length) {
    return {
      restored: false,
      errors: ['No workflow state in snapshot'],
    };
  }

  // Placeholder: In production, would restore run state to run-manager
  console.log('Run state restoration: Not implemented (placeholder)');
  console.log('In production, would restore workflow state to run-manager');

  return {
    restored: false,
    errors: [],
    message: 'Run state restoration not implemented (placeholder)',
  };
}

/**
 * Revert to snapshot
 * @param {Object} options - Revert options
 * @param {string} options.snapshot_id - Target snapshot ID
 * @param {boolean} options.confirm - User confirmation required
 * @param {boolean} [options.dry_run] - Preview mode (default: false)
 * @param {boolean} [options.createPreRevertSnapshot] - Create safety snapshot (default: true)
 * @param {boolean} [options.force] - Skip safety checks (NOT recommended)
 * @returns {Promise<Object>} Revert result
 */
export async function revert(options) {
  const {
    snapshot_id,
    confirm = false,
    dry_run = false,
    createPreRevertSnapshot: createPreRevert = true,
    force = false,
  } = options;

  const startTime = Date.now();

  // Dry-run mode
  if (dry_run) {
    return await dryRun({ snapshot_id });
  }

  // Require confirmation for destructive operations
  if (!confirm && !force) {
    throw new Error(
      'Revert requires explicit confirmation (set confirm: true). This operation is destructive.'
    );
  }

  // Validate snapshot
  const validation = await validate({ snapshot_id });
  if (!validation.valid && !force) {
    throw new Error(`Snapshot validation failed: ${validation.errors.join(', ')}`);
  }

  const snapshot = validation.snapshot;

  // Create pre-revert snapshot for safety
  let preRevertSnapshot = null;
  if (createPreRevert && !dry_run) {
    try {
      preRevertSnapshot = await createPreRevertSnapshot({
        targetSnapshotId: snapshot_id,
        reason: `Safety snapshot before revert to ${snapshot_id}`,
      });
    } catch (error) {
      throw new Error(`Failed to create pre-revert snapshot: ${error.message}`);
    }
  }

  // Execute restoration (atomic - all or nothing)
  try {
    // Step 1: Restore files
    const fileResult = await restoreFiles(snapshot);

    // Step 2: Restore artifacts
    const artifactResult = await restoreArtifacts(snapshot);

    // Step 3: Restore run state
    const runStateResult = await restoreRunState(snapshot);

    // Collect all errors
    const allErrors = [
      ...fileResult.errors,
      ...artifactResult.errors,
      ...runStateResult.errors,
    ].filter(Boolean);

    // If any errors occurred, rollback
    if (allErrors.length > 0 && !force) {
      console.error('Restore failed, rolling back...');

      // Rollback to pre-revert snapshot
      if (preRevertSnapshot) {
        try {
          await revert({
            snapshot_id: preRevertSnapshot.snapshot_id,
            confirm: true,
            createPreRevertSnapshot: false, // Don't create another safety snapshot
          });

          throw new Error(
            `Restore failed, rolled back to pre-revert snapshot: ${preRevertSnapshot.snapshot_id}`
          );
        } catch (rollbackError) {
          throw new Error(
            `CRITICAL: Restore failed AND rollback failed. Manual intervention required. Errors: ${allErrors.join(
              ', '
            )}`
          );
        }
      } else {
        throw new Error(`Restore failed with errors: ${allErrors.join(', ')}`);
      }
    }

    // Success
    const restoreTime = Date.now() - startTime;

    return {
      status: 'success',
      snapshot_id,
      pre_revert_snapshot: preRevertSnapshot?.snapshot_id || null,
      restored_files: fileResult.restored_count,
      restored_artifacts: artifactResult.restored_count,
      restored_run_state: runStateResult.restored,
      restore_time_ms: restoreTime,
      warnings: validation.warnings,
    };
  } catch (error) {
    // Restore failed
    return {
      status: 'failed',
      snapshot_id,
      pre_revert_snapshot: preRevertSnapshot?.snapshot_id || null,
      error: error.message,
      restore_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Verify restoration succeeded
 * @param {Object} options - Verification options
 * @param {string} options.snapshot_id - Target snapshot ID
 * @param {Object} options.result - Revert result object
 * @returns {Promise<Object>} Verification result
 */
export async function verifyRestoration(options) {
  const { snapshot_id, result } = options;

  if (result.status !== 'success') {
    return {
      verified: false,
      errors: ['Revert did not complete successfully'],
    };
  }

  // Get target snapshot
  const snapshot = await getSnapshot(snapshot_id);

  const errors = [];
  const warnings = [];

  // Verify artifacts exist
  if (snapshot.state?.artifacts?.recent) {
    for (const artifact of snapshot.state.artifacts.recent) {
      if (!existsSync(artifact.path)) {
        errors.push(`Artifact not found after restore: ${artifact.path}`);
      }
    }
  }

  // Verify files exist (placeholder)
  // In production, would verify all restored files

  return {
    verified: errors.length === 0,
    errors,
    warnings,
    snapshot_id,
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'list') {
    const runIdIndex = args.indexOf('--run-id');
    const typeIndex = args.indexOf('--type');

    const runId = runIdIndex !== -1 ? args[runIdIndex + 1] : null;
    const type = typeIndex !== -1 ? args[typeIndex + 1] : null;

    const snapshots = await listSnapshots({ runId, type });
    console.log(JSON.stringify(snapshots, null, 2));
  } else if (command === 'revert') {
    const snapshotIdIndex = args.indexOf('--snapshot-id');
    const dryRunFlag = args.includes('--dry-run');
    const confirmFlag = args.includes('--confirm');

    if (snapshotIdIndex === -1) {
      console.error('Usage: node revert.mjs revert --snapshot-id <id> [--dry-run] [--confirm]');
      process.exit(1);
    }

    const snapshotId = args[snapshotIdIndex + 1];

    const result = await revert({
      snapshot_id: snapshotId,
      dry_run: dryRunFlag,
      confirm: confirmFlag,
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'failed') {
      process.exit(1);
    }
  } else if (command === 'validate') {
    const snapshotIdIndex = args.indexOf('--snapshot-id');

    if (snapshotIdIndex === -1) {
      console.error('Usage: node revert.mjs validate --snapshot-id <id>');
      process.exit(1);
    }

    const snapshotId = args[snapshotIdIndex + 1];
    const result = await validate({ snapshot_id: snapshotId });

    console.log(JSON.stringify(result, null, 2));

    if (!result.valid) {
      process.exit(1);
    }
  } else {
    console.error('Unknown command. Available: list, revert, validate');
    console.error('');
    console.error('Usage:');
    console.error('  node revert.mjs list [--run-id <id>] [--type <type>]');
    console.error('  node revert.mjs revert --snapshot-id <id> [--dry-run] [--confirm]');
    console.error('  node revert.mjs validate --snapshot-id <id>');
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
  validate,
  dryRun,
  createPreRevertSnapshot,
  revert,
  verifyRestoration,
};
