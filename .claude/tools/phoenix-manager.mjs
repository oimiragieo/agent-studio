#!/usr/bin/env node
/**
 * Phoenix Manager - Seamless context recycling without window spawning
 *
 * Implements the "Phoenix Pattern" for environments where window spawning isn't possible.
 * Instead of spawning new windows, the orchestrator "resurrects" itself by:
 * 1. Saving snapshot of immediate short-term memory (scratchpad) to State DB
 * 2. Clearing LLM conversation history (via signal protocol)
 * 3. Injecting "Resurrection Prompt" as new first message
 *
 * Signal Protocol:
 * - Exit code 100: Signal to wrapper to clear context and restart
 * - Exit code 101: Signal to wrapper to clear context and inject resurrection prompt
 *
 * Usage:
 *   import { triggerPhoenixReset, createResurrectionPrompt, savePhoenixSnapshot } from './phoenix-manager.mjs';
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  readRun,
  updateRun,
  getRunDirectoryStructure,
  readArtifactRegistry,
} from './run-manager.mjs';
// Note: updateProjectDatabase() is deprecated - all writes go to run.json via updateRun()

/**
 * Phoenix signal codes
 */
export const PHOENIX_SIGNALS = {
  RESET_CONTEXT: 100, // Clear context and restart
  RESET_WITH_PROMPT: 101, // Clear context and inject resurrection prompt
  RESET_COMPLETE: 0, // Normal completion
};

/**
 * Save Phoenix snapshot (short-term memory to State DB)
 * @param {string} runId - Run identifier
 * @param {Object} scratchpad - Short-term memory/scratchpad data
 * @returns {Promise<string>} Path to snapshot file
 */
export async function savePhoenixSnapshot(runId, scratchpad = {}) {
  const runRecord = await readRun(runId);
  const runDirs = getRunDirectoryStructure(runId);

  // Create snapshot directory
  const snapshotDir = join(runDirs.run_dir, 'phoenix-snapshots');
  if (!existsSync(snapshotDir)) {
    await mkdir(snapshotDir, { recursive: true });
  }

  // Read artifact registry for current state
  let artifactRegistry;
  try {
    artifactRegistry = await readArtifactRegistry(runId);
  } catch (error) {
    artifactRegistry = { artifacts: [] };
  }

  // Create snapshot
  const snapshot = {
    runId,
    timestamp: new Date().toISOString(),
    runState: {
      current_step: runRecord.current_step,
      current_phase: runRecord.current_phase || null,
      status: runRecord.status,
      selected_workflow: runRecord.selected_workflow,
    },
    scratchpad: {
      recent_decisions: scratchpad.recentDecisions || [],
      open_questions: scratchpad.openQuestions || [],
      current_task: scratchpad.currentTask || null,
      next_actions: scratchpad.nextActions || [],
      ...scratchpad,
    },
    artifacts: {
      total: artifactRegistry.artifacts?.length || 0,
      recent: artifactRegistry.artifacts?.slice(-5) || [],
    },
    context: {
      last_step_completed: runRecord.timestamps?.last_step_completed_at,
      workflow_progress: {
        current_step: runRecord.current_step,
        total_steps: runRecord.metadata?.total_steps || null,
      },
    },
  };

  // Save snapshot
  const snapshotPath = join(snapshotDir, `snapshot-${Date.now()}.json`);
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Update run record with Phoenix snapshot reference
  await updateRun(runId, {
    metadata: {
      ...runRecord.metadata,
      last_phoenix_snapshot_id: snapshotPath,
      last_phoenix_snapshot_at: snapshot.timestamp,
    },
  });

  // Store phoenix snapshot metadata in run.json (project-db is read-only derived cache)
  await updateRun(runId, {
    metadata: {
      ...runRecord.metadata,
      phoenix_snapshot: {
        snapshot_id: snapshotPath,
        timestamp: snapshot.timestamp,
        scratchpad: snapshot.scratchpad,
      },
    },
  });

  return snapshotPath;
}

/**
 * Load latest Phoenix snapshot
 * @param {string} runId - Run identifier
 * @returns {Promise<Object|null>} Snapshot or null if not found
 */
export async function loadPhoenixSnapshot(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const snapshotDir = join(runDirs.run_dir, 'phoenix-snapshots');

  if (!existsSync(snapshotDir)) {
    return null;
  }

  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(snapshotDir);
    const snapshotFiles = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (snapshotFiles.length === 0) {
      return null;
    }

    const latestSnapshotPath = join(snapshotDir, snapshotFiles[0]);
    const snapshotContent = await readFile(latestSnapshotPath, 'utf-8');
    return JSON.parse(snapshotContent);
  } catch (error) {
    console.warn(`Warning: Could not load Phoenix snapshot: ${error.message}`);
    return null;
  }
}

/**
 * Create resurrection prompt for new orchestrator instance
 * @param {string} runId - Run identifier
 * @param {Object} snapshot - Phoenix snapshot (optional, will load if not provided)
 * @returns {Promise<string>} Resurrection prompt
 */
export async function createResurrectionPrompt(runId, snapshot = null) {
  if (!snapshot) {
    snapshot = await loadPhoenixSnapshot(runId);
  }

  if (!snapshot) {
    // Fallback to run record if no snapshot
    const runRecord = await readRun(runId);
    return `You are the Orchestrator. You have just woken up.

Run ID: ${runId}
Workflow: ${runRecord.selected_workflow || 'Not selected'}
Current Step: ${runRecord.current_step}
Status: ${runRecord.status}

Your task: Read run.json from the run directory and resume workflow execution from step ${runRecord.current_step + 1}.

Load the artifact registry to see what has been completed.
Continue the workflow execution seamlessly.`;
  }

  const { runState, scratchpad, artifacts, context } = snapshot;

  let prompt = `You are the Orchestrator. You have just woken up from a context reset.

## Run State
- **Run ID**: ${runId}
- **Workflow**: ${runState.selected_workflow || 'Not selected'}
- **Current Step**: ${runState.current_step}
- **Status**: ${runState.status}
- **Current Phase**: ${runState.current_phase || 'N/A'}

## Context
- **Last Step Completed**: ${context.last_step_completed || 'N/A'}
- **Workflow Progress**: Step ${context.workflow_progress.current_step}${context.workflow_progress.total_steps ? ` of ${context.workflow_progress.total_steps}` : ''}
- **Total Artifacts**: ${artifacts.total}

## Recent Memory (Scratchpad)
`;

  if (scratchpad.current_task) {
    prompt += `- **Current Task**: ${scratchpad.current_task}\n`;
  }

  if (scratchpad.recent_decisions && scratchpad.recent_decisions.length > 0) {
    prompt += `- **Recent Decisions**:\n`;
    scratchpad.recent_decisions.forEach(decision => {
      prompt += `  - ${decision}\n`;
    });
  }

  if (scratchpad.open_questions && scratchpad.open_questions.length > 0) {
    prompt += `- **Open Questions**:\n`;
    scratchpad.open_questions.forEach(question => {
      prompt += `  - ${question}\n`;
    });
  }

  if (scratchpad.next_actions && scratchpad.next_actions.length > 0) {
    prompt += `- **Next Actions**:\n`;
    scratchpad.next_actions.forEach(action => {
      prompt += `  - ${action}\n`;
    });
  }

  prompt += `\n## Your Task
1. Read run.json from the run directory to get full state
2. Load artifact registry to see completed artifacts
3. Resume workflow execution from step ${runState.current_step + 1}
4. Continue seamlessly - act as if no interruption occurred
5. Update run-summary.md after resuming

**Important**: You are continuing the same run. Do not create a new run or restart the workflow.`;

  return prompt;
}

/**
 * Trigger Phoenix reset (signal to wrapper to clear context)
 * @param {string} runId - Run identifier
 * @param {Object} scratchpad - Short-term memory to save
 * @param {boolean} injectPrompt - Whether to inject resurrection prompt (default: true)
 * @returns {Promise<number>} Exit code to signal wrapper
 */
export async function triggerPhoenixReset(runId, scratchpad = {}, injectPrompt = true) {
  // Save snapshot before reset
  await savePhoenixSnapshot(runId, scratchpad);

  // Update run status
  await updateRun(runId, {
    status: 'phoenix_resetting',
    metadata: {
      phoenix_reset_at: new Date().toISOString(),
      phoenix_reset_reason: 'Context limit reached',
    },
  });

  // Return appropriate exit code
  return injectPrompt ? PHOENIX_SIGNALS.RESET_WITH_PROMPT : PHOENIX_SIGNALS.RESET_CONTEXT;
}

/**
 * Check if Phoenix reset is needed based on context usage
 * @param {string} runId - Run identifier
 * @param {number} contextUsage - Current context usage percentage (0-100)
 * @param {number} threshold - Threshold percentage (default: 90)
 * @returns {boolean} True if reset is needed
 */
export function shouldTriggerPhoenixReset(contextUsage, threshold = 90) {
  return contextUsage >= threshold;
}

/**
 * Resume from Phoenix snapshot
 * @param {string} runId - Run identifier
 * @returns {Promise<Object>} Resume information
 */
export async function resumeFromPhoenix(runId) {
  const snapshot = await loadPhoenixSnapshot(runId);
  const resurrectionPrompt = await createResurrectionPrompt(runId, snapshot);
  const runRecord = await readRun(runId);

  // Update run status back to in_progress
  await updateRun(runId, {
    status: 'in_progress',
    metadata: {
      ...runRecord.metadata,
      phoenix_resumed_at: new Date().toISOString(),
    },
  });

  return {
    runId,
    snapshot,
    resurrectionPrompt,
    runRecord,
  };
}

export default {
  triggerPhoenixReset,
  createResurrectionPrompt,
  savePhoenixSnapshot,
  loadPhoenixSnapshot,
  shouldTriggerPhoenixReset,
  resumeFromPhoenix,
  PHOENIX_SIGNALS,
};
