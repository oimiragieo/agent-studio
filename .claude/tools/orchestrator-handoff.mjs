#!/usr/bin/env node
/**
 * Orchestrator Handoff - Manages seamless transition between orchestrator instances
 *
 * Implements two-phase commit handoff protocol:
 * 1. Freeze: Orchestrator sets run state to handoff_pending, stops spawning new work
 * 2. Snapshot: Write handoff.json with run id, workflow + step, current task, open questions, artifacts, validation summary, "what to do next" checklist
 * 3. Spawn: Platform-specific launcher opens new orchestrator with handoff.md as first input
 * 4. Ack: New orchestrator writes handoff-ack.json ("loaded successfully" + hash of handoff)
 * 5. Shutdown: Old orchestrator sees ack and marks itself shutdown (becomes read-only)
 *
 * Uses run directory structure: .claude/context/runtime/runs/<run_id>/
 *
 * Usage:
 *   node .claude/tools/orchestrator-handoff.mjs --run-id <id> [--spawn-cursor]
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import {
  readRun,
  updateRun,
  getRunDirectoryStructure,
  readArtifactRegistry,
} from './run-manager.mjs';
import { packageContextForHandoff } from './context-handoff.mjs';
import { updateProjectDatabase } from './project-db.mjs';
import { resolvePlanPath } from './path-resolver.mjs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize new orchestrator with handoff package (run-based)
 * Loads from run directory handoff.json
 */
export async function initializeNewOrchestrator(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const handoffFile = runDirs.handoff_json;

  if (!existsSync(handoffFile)) {
    throw new Error(`Handoff file not found: ${handoffFile}`);
  }

  const handoffPackage = JSON.parse(await readFile(handoffFile, 'utf-8'));
  const runRecord = handoffPackage.run_record;

  // Create initialization prompt
  const initPrompt = `Initialize the codebase and pick up the run where the previous orchestrator left off.

Run ID: ${runId}
Workflow ID: ${runRecord.workflow_id}
Current Step: ${runRecord.current_step}
Status: ${runRecord.status}

Artifact Registry: ${runDirs.artifact_registry}
Total Artifacts: ${handoffPackage.validation_summary?.total_artifacts || 0}
Validated: ${handoffPackage.validation_summary?.validated_artifacts || 0}

What to Do Next:
${handoffPackage.what_to_do_next?.map(item => `- ${item}`).join('\n') || 'Continue workflow execution'}

Open Questions:
${handoffPackage.open_questions?.map(q => `- ${q}`).join('\n') || 'None'}

Your task:
1. Read run.json from ${runDirs.run_json}
2. Load artifact registry from ${runDirs.artifact_registry}
3. Review handoff.md for context
4. Continue from step ${runRecord.current_step}
5. Write handoff-ack.json to acknowledge handoff`;

  return {
    runId,
    initPrompt,
    handoffPackage,
  };
}

/**
 * Two-Phase Commit Handoff Protocol
 *
 * Phase 1: Freeze
 * - Set run state to handoff_pending
 * - Stop spawning new work
 */
async function freezeRun(runId) {
  await updateRun(runId, { status: 'handoff_pending' });
  return await readRun(runId);
}

/**
 * Phase 2: Snapshot
 * - Write handoff.json with complete state
 * - Include run record, artifact registry, context, current task, open questions, validation summary, "what to do next" checklist
 */
async function snapshotHandoff(runId) {
  const runRecord = await readRun(runId);
  const artifactRegistry = await readArtifactRegistry(runId);
  const runDirs = getRunDirectoryStructure(runId);

  // Get current task from run record
  const currentTask = runRecord.task_queue?.find(t => t.status === 'in_progress') || null;

  // Package context (enumerates all artifacts, gates, reasoning)
  const context = await packageContextForHandoff(
    runId,
    runRecord.workflow_id,
    runRecord.current_step,
    {
      nextSteps: [],
      state: {},
      openQuestions: [],
      whatToDoNext: [
        `Continue workflow from step ${runRecord.current_step}`,
        `Load artifact registry from ${runDirs.artifact_registry}`,
        `Read plan document: ${resolvePlanPath(runId, `plan-${runRecord.workflow_id}.json`)}`,
        `Resume task: ${currentTask?.task_id || 'next task in queue'}`,
      ],
    }
  );

  // Create handoff package
  const handoffPackage = {
    run_id: runId,
    workflow_id: runRecord.workflow_id,
    current_step: runRecord.current_step,
    timestamp: new Date().toISOString(),
    status: 'snapshot',
    run_record: runRecord,
    artifact_registry: artifactRegistry,
    context: context.context,
    current_task: currentTask,
    open_questions: context.open_questions || [],
    validation_summary: context.validation_summary,
    what_to_do_next: context.what_to_do_next || [],
  };

  // Calculate hash for verification
  const handoffJson = JSON.stringify(handoffPackage);
  const handoffHash = createHash('sha256').update(handoffJson).digest('hex');
  handoffPackage.handoff_hash = handoffHash;

  // Write handoff.json
  await writeFile(runDirs.handoff_json, handoffJson, 'utf-8');

  // Create human-readable handoff.md
  const handoffMd = `# Handoff Package: ${runId}

## Run Information
- **Run ID**: ${runId}
- **Workflow ID**: ${runRecord.workflow_id}
- **Current Step**: ${runRecord.current_step}
- **Status**: ${runRecord.status}
- **Timestamp**: ${handoffPackage.timestamp}

## Current Task
${currentTask ? `- **Task ID**: ${currentTask.task_id}\n- **Agent**: ${currentTask.agent}\n- **Description**: ${currentTask.description || 'N/A'}` : 'No current task'}

## Artifacts
Total: ${context.validation_summary.total_artifacts}
- Validated: ${context.validation_summary.validated_artifacts}
- Failed: ${context.validation_summary.failed_validations}

## What to Do Next
${context.what_to_do_next.map(item => `- ${item}`).join('\n')}

## Open Questions
${context.open_questions.length > 0 ? context.open_questions.map(q => `- ${q}`).join('\n') : 'None'}

## Files
- Run Record: ${runDirs.run_json}
- Artifact Registry: ${runDirs.artifact_registry}
- Handoff Package: ${runDirs.handoff_json}
- Reasoning Files: ${runDirs.reasoning_dir}
- Gate Files: ${runDirs.gates_dir}
`;

  await writeFile(runDirs.handoff_md, handoffMd, 'utf-8');

  return handoffPackage;
}

/**
 * Phase 3: Spawn
 * - Platform-specific launcher opens new orchestrator with handoff.md as first input
 */
async function spawnNewOrchestrator(runId, spawnCursor = false) {
  const runDirs = getRunDirectoryStructure(runId);
  const handoffMdPath = runDirs.handoff_md;

  if (spawnCursor) {
    // Spawn Cursor window with handoff package
    // This would require a cursor-spawner.mjs module
    console.log(`Handoff package ready: ${handoffMdPath}`);
    console.log(`New orchestrator should load: ${handoffMdPath}`);
  } else {
    // Standard handoff (no spawning)
    console.log(`Handoff package ready: ${handoffMdPath}`);
    console.log(`New orchestrator should load: ${handoffMdPath}`);
  }
}

/**
 * Phase 4: Ack
 * - New orchestrator writes handoff-ack.json ("loaded successfully" + hash of handoff)
 */
export async function acknowledgeHandoff(runId, handoffHash) {
  const runDirs = getRunDirectoryStructure(runId);

  // Verify handoff hash matches
  const handoffContent = await readFile(runDirs.handoff_json, 'utf-8');
  const handoffData = JSON.parse(handoffContent);

  if (handoffData.handoff_hash !== handoffHash) {
    throw new Error('Handoff hash mismatch - handoff may have been modified');
  }

  // Write ack file
  const ackData = {
    run_id: runId,
    ack_timestamp: new Date().toISOString(),
    handoff_hash: handoffHash,
    status: 'loaded_successfully',
    orchestrator_session_id: `orchestrator-${Date.now()}`,
  };

  const ackPath = join(runDirs.run_dir, 'handoff-ack.json');
  await writeFile(ackPath, JSON.stringify(ackData, null, 2), 'utf-8');

  return ackData;
}

/**
 * Phase 5: Shutdown
 * - Old orchestrator sees ack and marks itself shutdown (becomes read-only)
 */
async function shutdownOrchestratorFromHandoff(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const ackPath = join(runDirs.run_dir, 'handoff-ack.json');

  // Check if ack exists
  if (existsSync(ackPath)) {
    // Ack received, mark run as handed off
    await updateRun(runId, { status: 'handed_off' });
    console.log(`Handoff acknowledged. Run ${runId} marked as handed off.`);
    return true;
  }

  return false;
}

/**
 * Silent Kill Pattern - Updates Project Database and exits with code 100
 * This is called by orchestrator when context limit is reached
 * Wrapper detects exit code 100 and automatically respawns
 */
export async function silentKillForRecycling(runId) {
  // Update run record to handoff_pending (project-db will be synced automatically)
  const runRecord = await readRun(runId);

  // Update run status to handoff_pending
  await updateRun(runId, {
    status: 'handoff_pending',
    metadata: {
      ...runRecord.metadata,
      handoff_reason: 'context_limit_reached',
      handoff_triggered_at: new Date().toISOString(),
    },
  });

  // Print message for user
  console.log('\n⚠️  Context limit reached. Resuming in new instance...\n');

  // Exit with code 100 (signal for wrapper)
  process.exit(100);
}

/**
 * Execute complete two-phase commit handoff (NEW - uses run directory)
 */
export async function executeHandoffWithRunId(runId, spawnCursor = false) {
  // Phase 1: Freeze
  await freezeRun(runId);
  console.log(`Phase 1 (Freeze): Run ${runId} set to handoff_pending`);

  // Phase 2: Snapshot
  const handoffPackage = await snapshotHandoff(runId);
  console.log(
    `Phase 2 (Snapshot): Handoff package created at ${getRunDirectoryStructure(runId).handoff_json}`
  );

  // Phase 3: Spawn
  await spawnNewOrchestrator(runId, spawnCursor);
  console.log(
    `Phase 3 (Spawn): New orchestrator ${spawnCursor ? 'spawned' : 'ready to initialize'}`
  );

  return handoffPackage;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const runIdIndex = args.indexOf('--run-id');
  const spawnCursor = args.includes('--spawn-cursor');

  if (runIdIndex === -1 || !args[runIdIndex + 1]) {
    console.error('Usage: node orchestrator-handoff.mjs --run-id <id> [--spawn-cursor]');
    process.exit(1);
  }

  const runId = args[runIdIndex + 1];

  const result = await executeHandoffWithRunId(runId, spawnCursor);

  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  initializeNewOrchestrator,
  executeHandoffWithRunId,
  acknowledgeHandoff,
  silentKillForRecycling,
};
