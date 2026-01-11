#!/usr/bin/env node
/**
 * Checkpoint Cleanup Tool
 *
 * Removes old checkpoints based on retention policy:
 * - Failed runs: 7 days
 * - Successful runs: 30 days (archive instead of delete)
 *
 * Usage:
 *   node .claude/tools/checkpoint-cleanup.mjs [--dry-run] [--run-id <id>]
 */

import { readdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { listCheckpoints } from './checkpoint-manager.mjs';
import { readRun } from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RETENTION_DAYS_FAILED = 7;
const RETENTION_DAYS_SUCCESS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cleanup checkpoints for a specific run
 */
async function cleanupRunCheckpoints(runId, dryRun = false) {
  try {
    const runRecord = await readRun(runId);
    const checkpoints = await listCheckpoints(runId);

    if (checkpoints.length === 0) {
      return { deleted: 0, archived: 0, errors: [] };
    }

    const runStatus = runRecord.status || 'unknown';
    const isFailed = runStatus === 'failed' || runStatus === 'error';
    const retentionDays = isFailed ? RETENTION_DAYS_FAILED : RETENTION_DAYS_SUCCESS;
    const cutoffDate = new Date(Date.now() - retentionDays * MS_PER_DAY);

    let deletedCount = 0;
    let archivedCount = 0;
    const errors = [];

    for (const checkpoint of checkpoints) {
      const checkpointDate = new Date(checkpoint.timestamp);

      if (checkpointDate < cutoffDate) {
        if (isFailed) {
          // Delete failed run checkpoints
          if (dryRun) {
            console.log(
              `[DRY-RUN] Would delete checkpoint: ${checkpoint.checkpoint_id} (${checkpointDate.toISOString()})`
            );
          } else {
            try {
              await unlink(checkpoint.path);
              deletedCount++;
              console.log(`Deleted checkpoint: ${checkpoint.checkpoint_id}`);
            } catch (error) {
              errors.push(`Failed to delete ${checkpoint.checkpoint_id}: ${error.message}`);
            }
          }
        } else {
          // Archive successful run checkpoints (for now, just log - could move to archive dir)
          if (dryRun) {
            console.log(
              `[DRY-RUN] Would archive checkpoint: ${checkpoint.checkpoint_id} (${checkpointDate.toISOString()})`
            );
          } else {
            // TODO: Move to archive directory instead of deleting
            archivedCount++;
            console.log(`Archived checkpoint: ${checkpoint.checkpoint_id} (would move to archive)`);
          }
        }
      }
    }

    return { deleted: deletedCount, archived: archivedCount, errors };
  } catch (error) {
    return { deleted: 0, archived: 0, errors: [error.message] };
  }
}

/**
 * Cleanup all runs
 */
async function cleanupAllCheckpoints(dryRun = false) {
  const runsDir = join(__dirname, '..', 'context', 'runs');

  if (!existsSync(runsDir)) {
    return { deleted: 0, archived: 0, errors: [] };
  }

  const runDirs = await readdir(runsDir);
  let totalDeleted = 0;
  let totalArchived = 0;
  const allErrors = [];

  for (const runDir of runDirs) {
    const runId = runDir;
    const result = await cleanupRunCheckpoints(runId, dryRun);
    totalDeleted += result.deleted;
    totalArchived += result.archived;
    allErrors.push(...result.errors);
  }

  return { deleted: totalDeleted, archived: totalArchived, errors: allErrors };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const runIdIndex = args.indexOf('--run-id');
  const runId = runIdIndex !== -1 && args[runIdIndex + 1] ? args[runIdIndex + 1] : null;

  console.log('🧹 Checkpoint Cleanup Tool\n');

  if (dryRun) {
    console.log('🔍 DRY-RUN MODE: No files will be deleted\n');
  }

  let result;
  if (runId) {
    console.log(`Cleaning up checkpoints for run: ${runId}\n`);
    result = await cleanupRunCheckpoints(runId, dryRun);
  } else {
    console.log('Cleaning up checkpoints for all runs\n');
    result = await cleanupAllCheckpoints(dryRun);
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   Deleted: ${result.deleted}`);
  console.log(`   Archived: ${result.archived}`);
  if (result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.error(`     - ${err}`));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
