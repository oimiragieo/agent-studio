#!/usr/bin/env node
/**
 * Workflow Checkpoint System
 * Saves workflow state periodically to allow resumption
 */

import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCheckpointPath(workflowId, options = { read: false }) {
  return resolveRuntimePath(`checkpoints/${workflowId}.json`, options);
}

/**
 * Save workflow checkpoint
 * @param {string} workflowId - Workflow identifier
 * @param {number|string} step - Current step number
 * @param {Object} state - Workflow state to save
 * @returns {Promise<string>} Path to saved checkpoint file
 */
export async function saveCheckpoint(workflowId, step, state) {
  const checkpointPath = getCheckpointPath(workflowId, { read: false });
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  const checkpoint = {
    workflowId,
    step,
    state,
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
  };

  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  return checkpointPath;
}

/**
 * Load workflow checkpoint
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<Object|null>} Checkpoint data or null if not found
 */
export async function loadCheckpoint(workflowId) {
  const checkpointPath = getCheckpointPath(workflowId, { read: true });

  if (!existsSync(checkpointPath)) {
    return null;
  }

  const content = await readFile(checkpointPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Delete workflow checkpoint
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<void>}
 */
export async function deleteCheckpoint(workflowId) {
  const checkpointPath = getCheckpointPath(workflowId, { read: true });

  if (existsSync(checkpointPath)) {
    await unlink(checkpointPath);
  }
}
