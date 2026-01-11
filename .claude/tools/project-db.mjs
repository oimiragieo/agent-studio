#!/usr/bin/env node
/**
 * Project Database - Hot-Swappable Memory Core
 *
 * External state manager for workflow execution state
 * Provides centralized Project Database that persists outside chat context
 * Enables seamless orchestrator recycling without state loss
 *
 * Usage:
 *   node .claude/tools/project-db.mjs read --run-id <id>
 *   node .claude/tools/project-db.mjs update --run-id <id> --field <field> --value <value>
 *   node .claude/tools/project-db.mjs get-current-phase --run-id <id>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { getRunDirectoryStructure, readRun, readArtifactRegistry } from './run-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get Project Database path for a run
 * @param {string} runId - Run identifier
 * @returns {string} Path to project database file
 */
function getProjectDbPath(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  return join(runDirs.run_dir, 'project-db.json');
}

/**
 * Sync Project Database from run.json (derived cache)
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Synced project database
 */
export async function syncProjectDbFromRun(runId) {
  try {
    const runRecord = await readRun(runId);
    const artifactRegistry = await readArtifactRegistry(runId);

    // Derive project-db state from run.json and artifact-registry.json
    const projectDb = {
      run_id: runId,
      created_at: runRecord.created_at,
      last_updated: new Date().toISOString(),
      derived_from_run_updated_at: runRecord.updated_at,
      derived_hash: createHash('sha256').update(JSON.stringify(runRecord)).digest('hex'),
      current_phase: runRecord.current_phase || null,
      current_step: runRecord.current_step || 0,
      active_tasks: (runRecord.task_queue || []).filter(t => t.status === 'in_progress'),
      completed_tasks: (runRecord.task_queue || []).filter(t => t.status === 'completed'),
      completed_artifacts: Object.values(artifactRegistry.artifacts || {}).filter(
        a => a.validationStatus === 'pass'
      ),
      workflow_state: {
        status: runRecord.status,
        selected_workflow: runRecord.selected_workflow,
        task_queue: runRecord.task_queue || [],
      },
      document_approvals: runRecord.metadata?.approvals || {},
      blockers: runRecord.metadata?.blockers || [],
      next_steps: runRecord.metadata?.next_steps || [],
      metadata: {
        workflow_id: runRecord.workflow_id,
        selected_workflow: runRecord.selected_workflow,
        user_request: runRecord.metadata?.user_request || '',
        status: runRecord.status,
        ...runRecord.metadata,
      },
    };

    const dbPath = getProjectDbPath(runId);
    await writeFile(dbPath, JSON.stringify(projectDb, null, 2), 'utf-8');

    return projectDb;
  } catch (error) {
    console.error(`Error syncing project-db from run.json for ${runId}: ${error.message}`);
    throw error;
  }
}

/**
 * Read Project Database (derived cache from run.json)
 * @param {string} runId - Run identifier
 * @param {boolean} forceSync - Force sync from run.json even if cache exists
 * @returns {Promise<Object>} Project database state
 */
export async function readProjectDatabase(runId, forceSync = false) {
  const dbPath = getProjectDbPath(runId);

  // If force sync or cache doesn't exist, sync from run.json
  if (forceSync || !existsSync(dbPath)) {
    return await syncProjectDbFromRun(runId);
  }

  // Read cached version
  const content = await readFile(dbPath, 'utf-8');
  const cachedDb = JSON.parse(content);

  // Check if cache is stale (run.json updated since last sync)
  try {
    const runRecord = await readRun(runId);
    if (cachedDb.derived_from_run_updated_at !== runRecord.updated_at) {
      // Cache is stale, resync
      return await syncProjectDbFromRun(runId);
    }
  } catch (error) {
    // If can't read run.json, return cached version
    console.warn(`Warning: Could not verify cache freshness for ${runId}: ${error.message}`);
  }

  return cachedDb;
}

/**
 * Initialize Project Database
 * @param {string} runId - Run identifier
 * @param {Object} initialData - Initial data
 * @returns {Promise<Object>} Initialized project database
 */
export async function initializeProjectDatabase(runId, initialData = {}) {
  const dbPath = getProjectDbPath(runId);
  const runDirs = getRunDirectoryStructure(runId);

  // Ensure run directory exists
  if (!existsSync(runDirs.run_dir)) {
    await mkdir(runDirs.run_dir, { recursive: true });
  }

  const now = new Date().toISOString();
  const projectDb = {
    run_id: runId,
    created_at: now,
    last_updated: now,
    current_phase: initialData.current_phase || null,
    current_step: initialData.current_step || 0,
    active_tasks: initialData.active_tasks || [],
    completed_tasks: initialData.completed_tasks || [],
    completed_artifacts: initialData.completed_artifacts || [],
    workflow_state: initialData.workflow_state || {},
    document_approvals: initialData.document_approvals || {},
    blockers: initialData.blockers || [],
    next_steps: initialData.next_steps || [],
    metadata: {
      workflow_id: initialData.workflow_id || null,
      selected_workflow: initialData.selected_workflow || null,
      user_request: initialData.user_request || '',
      status: initialData.status || 'pending',
    },
  };

  await writeFile(dbPath, JSON.stringify(projectDb, null, 2), 'utf-8');
  return projectDb;
}

/**
 * Update Project Database
 * DEPRECATED: Project-db is now a derived cache. Updates should go to run.json via run-manager.mjs
 * This function now syncs from run.json instead of writing directly.
 * @param {string} runId - Run identifier
 * @param {Object} updates - Fields to update (ignored - for backward compatibility only)
 * @returns {Promise<Object>} Synced project database
 */
export async function updateProjectDatabase(runId, updates) {
  // Project-db is now read-only derived cache
  // All updates should go through run-manager.mjs which will update run.json
  // Then sync project-db from run.json
  console.warn(
    `⚠️  Warning: updateProjectDatabase() is deprecated. Updates should go to run.json via run-manager.mjs. Syncing from run.json instead.`
  );
  return await syncProjectDbFromRun(runId);
}

/**
 * Add active task
 * @param {string} runId - Run identifier
 * @param {Object} task - Task to add
 * @returns {Promise<Object>} Updated project database
 */
export async function addActiveTask(runId, task) {
  const projectDb = await readProjectDatabase(runId);

  if (!projectDb.active_tasks) {
    projectDb.active_tasks = [];
  }

  projectDb.active_tasks.push({
    task_id: task.task_id || `task-${Date.now()}`,
    description: task.description,
    agent: task.agent,
    step: task.step || projectDb.current_step,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    ...task,
  });

  return await updateProjectDatabase(runId, { active_tasks: projectDb.active_tasks });
}

/**
 * Complete task
 * @param {string} runId - Run identifier
 * @param {string} taskId - Task identifier
 * @param {Object} result - Task result
 * @returns {Promise<Object>} Updated project database
 */
export async function completeTask(runId, taskId, result = {}) {
  const projectDb = await readProjectDatabase(runId);

  // Find and remove from active tasks
  const taskIndex = projectDb.active_tasks.findIndex(t => t.task_id === taskId);
  if (taskIndex === -1) {
    throw new Error(`Task ${taskId} not found in active tasks`);
  }

  const task = projectDb.active_tasks[taskIndex];
  projectDb.active_tasks.splice(taskIndex, 1);

  // Add to completed tasks
  if (!projectDb.completed_tasks) {
    projectDb.completed_tasks = [];
  }

  projectDb.completed_tasks.push({
    ...task,
    status: 'completed',
    completed_at: new Date().toISOString(),
    result: result,
  });

  return await updateProjectDatabase(runId, {
    active_tasks: projectDb.active_tasks,
    completed_tasks: projectDb.completed_tasks,
  });
}

/**
 * Register completed artifact
 * @param {string} runId - Run identifier
 * @param {Object} artifact - Artifact information
 * @returns {Promise<Object>} Updated project database
 */
export async function registerCompletedArtifact(runId, artifact) {
  const projectDb = await readProjectDatabase(runId);

  if (!projectDb.completed_artifacts) {
    projectDb.completed_artifacts = [];
  }

  projectDb.completed_artifacts.push({
    name: artifact.name,
    path: artifact.path,
    step: artifact.step,
    agent: artifact.agent,
    created_at: new Date().toISOString(),
    validation_status: artifact.validation_status || 'pending',
    ...artifact,
  });

  return await updateProjectDatabase(runId, { completed_artifacts: projectDb.completed_artifacts });
}

/**
 * Approve document
 * @param {string} runId - Run identifier
 * @param {string} documentName - Document name (e.g., "ARCHITECTURE.md")
 * @param {string} approvedBy - Agent that approved
 * @returns {Promise<Object>} Updated project database
 */
export async function approveDocument(runId, documentName, approvedBy) {
  const projectDb = await readProjectDatabase(runId);

  if (!projectDb.document_approvals) {
    projectDb.document_approvals = {};
  }

  projectDb.document_approvals[documentName] = {
    approved: true,
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  };

  return await updateProjectDatabase(runId, { document_approvals: projectDb.document_approvals });
}

/**
 * Check document approval
 * @param {string} runId - Run identifier
 * @param {string} documentName - Document name
 * @returns {Promise<boolean>} True if approved
 */
export async function isDocumentApproved(runId, documentName) {
  const projectDb = await readProjectDatabase(runId);
  return projectDb.document_approvals?.[documentName]?.approved === true;
}

/**
 * Get current phase
 * @param {string} runId - Run identifier
 * @returns {Promise<string|null>} Current phase ID
 */
export async function getCurrentPhase(runId) {
  const projectDb = await readProjectDatabase(runId);
  return projectDb.current_phase;
}

/**
 * Get current step
 * @param {string} runId - Run identifier
 * @returns {Promise<number>} Current step number
 */
export async function getCurrentStep(runId) {
  const projectDb = await readProjectDatabase(runId);
  return projectDb.current_step || 0;
}

/**
 * Add blocker
 * @param {string} runId - Run identifier
 * @param {Object} blocker - Blocker information
 * @returns {Promise<Object>} Updated project database
 */
export async function addBlocker(runId, blocker) {
  const projectDb = await readProjectDatabase(runId);

  if (!projectDb.blockers) {
    projectDb.blockers = [];
  }

  projectDb.blockers.push({
    id: blocker.id || `blocker-${Date.now()}`,
    description: blocker.description,
    severity: blocker.severity || 'medium',
    created_at: new Date().toISOString(),
    ...blocker,
  });

  return await updateProjectDatabase(runId, { blockers: projectDb.blockers });
}

/**
 * Remove blocker
 * @param {string} runId - Run identifier
 * @param {string} blockerId - Blocker identifier
 * @returns {Promise<Object>} Updated project database
 */
export async function removeBlocker(runId, blockerId) {
  const projectDb = await readProjectDatabase(runId);

  if (!projectDb.blockers) {
    return projectDb;
  }

  projectDb.blockers = projectDb.blockers.filter(b => b.id !== blockerId);

  return await updateProjectDatabase(runId, { blockers: projectDb.blockers });
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'read') {
    const runIdIndex = args.indexOf('--run-id');

    if (runIdIndex === -1 || runIdIndex === args.length - 1) {
      console.error('Usage: node project-db.mjs read --run-id <id>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const projectDb = await readProjectDatabase(runId);
    console.log(JSON.stringify(projectDb, null, 2));
  } else if (command === 'update') {
    const runIdIndex = args.indexOf('--run-id');
    const fieldIndex = args.indexOf('--field');
    const valueIndex = args.indexOf('--value');

    if (runIdIndex === -1 || fieldIndex === -1 || valueIndex === -1) {
      console.error(
        'Usage: node project-db.mjs update --run-id <id> --field <field> --value <value>'
      );
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const field = args[fieldIndex + 1];
    let value = args[valueIndex + 1];

    // Try to parse as JSON if it looks like JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Not JSON, use as string
      }
    }

    const updates = { [field]: value };
    const projectDb = await updateProjectDatabase(runId, updates);
    console.log(JSON.stringify(projectDb, null, 2));
  } else if (command === 'get-current-phase') {
    const runIdIndex = args.indexOf('--run-id');

    if (runIdIndex === -1 || runIdIndex === args.length - 1) {
      console.error('Usage: node project-db.mjs get-current-phase --run-id <id>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const phase = await getCurrentPhase(runId);
    console.log(phase || 'null');
  } else if (command === 'get-current-step') {
    const runIdIndex = args.indexOf('--run-id');

    if (runIdIndex === -1 || runIdIndex === args.length - 1) {
      console.error('Usage: node project-db.mjs get-current-step --run-id <id>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    const step = await getCurrentStep(runId);
    console.log(step);
  } else {
    console.error('Unknown command. Available: read, update, get-current-phase, get-current-step');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  readProjectDatabase,
  initializeProjectDatabase,
  updateProjectDatabase,
  addActiveTask,
  completeTask,
  registerCompletedArtifact,
  approveDocument,
  isDocumentApproved,
  getCurrentPhase,
  getCurrentStep,
  addBlocker,
  removeBlocker,
};
