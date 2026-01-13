#!/usr/bin/env node
/**
 * Cursor-Compatible Workflow Recovery
 * Alternative to recovery skill for Cursor platform
 *
 * Provides manual workflow recovery when skill-based recovery is unavailable.
 * Handles checkpoint loading, state reconstruction, and workflow resumption.
 *
 * @usage
 * node .claude/tools/recovery-cursor.mjs --run-id <run_id>
 * node .claude/tools/recovery-cursor.mjs --run-id <run_id> --output json
 * node .claude/tools/recovery-cursor.mjs --run-id <run_id> --verbose
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTEXT_DIR = join(__dirname, '..', 'context');
const RUNS_DIR = join(CONTEXT_DIR, 'runs');
const GATES_DIR = join(CONTEXT_DIR, 'history', 'gates');
const REASONING_DIR = join(CONTEXT_DIR, 'history', 'reasoning');
const ARTIFACTS_DIR = join(CONTEXT_DIR, 'artifacts');

/**
 * Find last successful step from gate files
 * @param {string} runId - Run identifier
 * @param {string} workflowId - Workflow identifier
 * @returns {number} Last completed step number
 */
function findLastSuccessfulStep(runId, workflowId) {
  const gateDir = join(GATES_DIR, workflowId || runId);

  if (!existsSync(gateDir)) {
    console.warn(`Gate directory not found: ${gateDir}`);
    return 0;
  }

  const gateFiles = readdirSync(gateDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      // Extract step numbers from filenames like "01-planner.json"
      const aStep = parseInt(a.split('-')[0], 10);
      const bStep = parseInt(b.split('-')[0], 10);
      return bStep - aStep; // Descending order
    });

  // Find highest step with validation_status === 'pass'
  for (const gateFile of gateFiles) {
    try {
      const gatePath = join(gateDir, gateFile);
      const gate = JSON.parse(readFileSync(gatePath, 'utf8'));

      if (gate.validation_status === 'pass' || gate.allowed === true) {
        const stepNum = parseInt(gateFile.split('-')[0], 10);
        return stepNum;
      }
    } catch (error) {
      console.warn(`Failed to parse gate file ${gateFile}: ${error.message}`);
    }
  }

  return 0; // No successful steps found
}

/**
 * Load checkpoint file if exists
 * @param {string} runId - Run identifier
 * @returns {Object|null} Checkpoint data or null
 */
function loadCheckpoint(runId) {
  const checkpointPath = join(RUNS_DIR, runId, 'checkpoint.json');

  if (!existsSync(checkpointPath)) {
    console.warn(`Checkpoint file not found: ${checkpointPath}`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(checkpointPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to load checkpoint: ${error.message}`);
    return null;
  }
}

/**
 * Load run record
 * @param {string} runId - Run identifier
 * @returns {Object} Run record
 */
function loadRunRecord(runId) {
  const runJsonPath = join(RUNS_DIR, runId, 'run.json');

  if (!existsSync(runJsonPath)) {
    throw new Error(`Run record not found: ${runJsonPath}`);
  }

  try {
    return JSON.parse(readFileSync(runJsonPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load run record: ${error.message}`);
  }
}

/**
 * Load workflow definition
 * @param {string} workflowPath - Path to workflow YAML file
 * @returns {Object} Workflow definition
 */
function loadWorkflowDefinition(workflowPath) {
  if (!existsSync(workflowPath)) {
    throw new Error(`Workflow file not found: ${workflowPath}`);
  }

  try {
    return yaml.load(readFileSync(workflowPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load workflow definition: ${error.message}`);
  }
}

/**
 * Load artifact registry
 * @param {string} runId - Run identifier
 * @returns {Object} Artifact registry
 */
function loadArtifactRegistry(runId) {
  const registryPath = join(RUNS_DIR, runId, 'artifact-registry.json');

  if (!existsSync(registryPath)) {
    console.warn(`Artifact registry not found: ${registryPath}`);
    return { artifacts: {} };
  }

  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (error) {
    console.error(`Failed to load artifact registry: ${error.message}`);
    return { artifacts: {} };
  }
}

/**
 * Load reasoning files for completed steps
 * @param {string} runId - Run identifier
 * @param {string} workflowId - Workflow identifier
 * @param {number} lastStep - Last completed step
 * @returns {Array} Array of reasoning data
 */
function loadReasoningFiles(runId, workflowId, lastStep) {
  const reasoningDir = join(REASONING_DIR, workflowId || runId);

  if (!existsSync(reasoningDir)) {
    console.warn(`Reasoning directory not found: ${reasoningDir}`);
    return [];
  }

  const reasoningFiles = [];
  const files = readdirSync(reasoningDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    try {
      const filePath = join(reasoningDir, file);
      const reasoning = JSON.parse(readFileSync(filePath, 'utf8'));
      reasoningFiles.push({
        filename: file,
        ...reasoning,
      });
    } catch (error) {
      console.warn(`Failed to parse reasoning file ${file}: ${error.message}`);
    }
  }

  return reasoningFiles;
}

/**
 * Get artifacts from completed steps
 * @param {Object} registry - Artifact registry
 * @param {number} lastStep - Last completed step
 * @returns {Object} Artifacts grouped by step
 */
function getCompletedArtifacts(registry, lastStep) {
  const artifacts = {};

  for (const [name, artifact] of Object.entries(registry.artifacts || {})) {
    if (artifact.step <= lastStep && artifact.validationStatus === 'pass') {
      if (!artifacts[artifact.step]) {
        artifacts[artifact.step] = [];
      }
      artifacts[artifact.step].push(artifact);
    }
  }

  return artifacts;
}

/**
 * Determine next step and required inputs
 * @param {Object} workflow - Workflow definition
 * @param {number} lastStep - Last completed step
 * @param {Object} artifacts - Completed artifacts
 * @returns {Object} Next step information
 */
function getNextStepInfo(workflow, lastStep, artifacts) {
  const nextStepNum = lastStep + 1;
  const nextStep = workflow.steps.find(s => s.step === nextStepNum);

  if (!nextStep) {
    return {
      step: null,
      status: 'workflow_complete',
      message: 'All workflow steps completed',
    };
  }

  // Determine required inputs for next step
  const requiredInputs = [];
  const missingInputs = [];

  if (nextStep.inputs) {
    for (const input of nextStep.inputs) {
      const inputName = typeof input === 'string' ? input : input.name;
      const isOptional = typeof input === 'object' && input.optional;

      requiredInputs.push({
        name: inputName,
        optional: isOptional,
        available: checkArtifactAvailable(artifacts, inputName),
      });

      if (!isOptional && !checkArtifactAvailable(artifacts, inputName)) {
        missingInputs.push(inputName);
      }
    }
  }

  return {
    step: nextStepNum,
    agent: nextStep.agent,
    task: nextStep.task,
    description: nextStep.description,
    requiredInputs,
    missingInputs,
    canProceed: missingInputs.length === 0,
    status: missingInputs.length === 0 ? 'ready' : 'blocked',
  };
}

/**
 * Check if artifact is available
 * @param {Object} artifacts - Artifacts map
 * @param {string} artifactName - Name of artifact
 * @returns {boolean} Whether artifact exists
 */
function checkArtifactAvailable(artifacts, artifactName) {
  for (const stepArtifacts of Object.values(artifacts)) {
    if (stepArtifacts.some(a => a.name === artifactName)) {
      return true;
    }
  }
  return false;
}

/**
 * Generate recovery summary
 * @param {Object} recoveryData - Recovery data
 * @returns {string} Formatted summary
 */
function generateRecoverySummary(recoveryData) {
  const lines = [];

  lines.push('='.repeat(80));
  lines.push('WORKFLOW RECOVERY SUMMARY');
  lines.push('='.repeat(80));
  lines.push('');

  lines.push(`Run ID: ${recoveryData.run_id}`);
  lines.push(`Workflow ID: ${recoveryData.workflow_id}`);
  lines.push(`Workflow: ${recoveryData.workflow.name || 'Unknown'}`);
  lines.push('');

  lines.push(`Last Completed Step: ${recoveryData.last_completed_step}`);
  lines.push(`Total Steps: ${recoveryData.workflow.steps?.length || 0}`);
  lines.push('');

  lines.push('Completed Artifacts:');
  const artifactCount = Object.values(recoveryData.artifacts).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  lines.push(`  Total: ${artifactCount}`);

  for (const [step, artifacts] of Object.entries(recoveryData.artifacts)) {
    lines.push(`  Step ${step}: ${artifacts.map(a => a.name).join(', ')}`);
  }
  lines.push('');

  if (recoveryData.next_step.status === 'workflow_complete') {
    lines.push('Status: WORKFLOW COMPLETE');
  } else {
    lines.push(`Next Step: ${recoveryData.next_step.step}`);
    lines.push(`Agent: ${recoveryData.next_step.agent}`);
    lines.push(`Task: ${recoveryData.next_step.task}`);
    lines.push(`Status: ${recoveryData.next_step.status.toUpperCase()}`);

    if (recoveryData.next_step.missingInputs?.length > 0) {
      lines.push('');
      lines.push('Missing Inputs:');
      for (const input of recoveryData.next_step.missingInputs) {
        lines.push(`  - ${input}`);
      }
    }

    if (recoveryData.next_step.requiredInputs?.length > 0) {
      lines.push('');
      lines.push('Required Inputs:');
      for (const input of recoveryData.next_step.requiredInputs) {
        const status = input.available ? '✓' : input.optional ? '○' : '✗';
        const label = input.optional ? '(optional)' : '(required)';
        lines.push(`  ${status} ${input.name} ${label}`);
      }
    }
  }

  if (recoveryData.reasoning_files?.length > 0) {
    lines.push('');
    lines.push(`Reasoning Files Loaded: ${recoveryData.reasoning_files.length}`);
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Recover workflow from run ID
 * @param {string} runId - Run identifier
 * @param {Object} options - Recovery options
 * @returns {Object} Recovery data
 */
export async function recoverWorkflowCursor(runId, options = {}) {
  console.log(`Starting workflow recovery for run: ${runId}`);

  // Load run record
  const runRecord = loadRunRecord(runId);
  console.log(`Loaded run record for workflow: ${runRecord.workflow_id}`);

  // Load checkpoint if exists
  const checkpoint = loadCheckpoint(runId);

  // Determine workflow path
  let workflowPath;
  if (checkpoint?.workflow_file) {
    workflowPath = checkpoint.workflow_file;
  } else if (runRecord.selected_workflow) {
    workflowPath = join(__dirname, '..', 'workflows', runRecord.selected_workflow);
  } else {
    throw new Error('Cannot determine workflow file path');
  }

  // Load workflow definition
  const workflow = loadWorkflowDefinition(workflowPath);
  console.log(`Loaded workflow: ${workflow.name}`);

  // Find last successful step
  const lastStep =
    checkpoint?.last_completed_step || findLastSuccessfulStep(runId, runRecord.workflow_id);
  console.log(`Last completed step: ${lastStep}`);

  // Load artifact registry
  const registry = loadArtifactRegistry(runId);
  const artifacts = getCompletedArtifacts(registry, lastStep);
  console.log(`Loaded ${Object.values(artifacts).flat().length} artifacts from completed steps`);

  // Load reasoning files
  const reasoningFiles =
    options.includeReasoning !== false
      ? loadReasoningFiles(runId, runRecord.workflow_id, lastStep)
      : [];

  // Determine next step
  const nextStepInfo = getNextStepInfo(workflow, lastStep, artifacts);

  // Build recovery data
  const recoveryData = {
    run_id: runId,
    workflow_id: runRecord.workflow_id,
    workflow: {
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps,
      file_path: workflowPath,
    },
    last_completed_step: lastStep,
    next_step: nextStepInfo,
    artifacts,
    reasoning_files: reasoningFiles,
    checkpoint: checkpoint || null,
    recovery_timestamp: new Date().toISOString(),
    run_status: runRecord.status,
    run_metadata: runRecord.metadata || {},
  };

  return recoveryData;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const runIdIndex = args.indexOf('--run-id');
  const outputIndex = args.indexOf('--output');
  const verboseIndex = args.indexOf('--verbose');
  const noReasoningIndex = args.indexOf('--no-reasoning');

  if (runIdIndex === -1 || runIdIndex === args.length - 1) {
    console.error(
      'Usage: node recovery-cursor.mjs --run-id <run_id> [--output json|summary] [--verbose] [--no-reasoning]'
    );
    console.error('');
    console.error('Options:');
    console.error('  --run-id <id>       Run identifier (required)');
    console.error('  --output json       Output format: json or summary (default: summary)');
    console.error('  --verbose           Show verbose output');
    console.error('  --no-reasoning      Skip loading reasoning files');
    process.exit(1);
  }

  const runId = args[runIdIndex + 1];
  const outputFormat =
    outputIndex !== -1 && outputIndex < args.length - 1 ? args[outputIndex + 1] : 'summary';
  const verbose = verboseIndex !== -1;
  const includeReasoning = noReasoningIndex === -1;

  try {
    // Suppress logs if not verbose and output is JSON
    if (!verbose && outputFormat === 'json') {
      console.log = () => {};
      console.warn = () => {};
    }

    const result = await recoverWorkflowCursor(runId, { includeReasoning });

    // Restore console.log for output
    if (!verbose && outputFormat === 'json') {
      console.log = console._stdout.write.bind(console._stdout);
    }

    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(generateRecoverySummary(result));

      if (verbose) {
        console.log('\nFull Recovery Data:');
        console.log(JSON.stringify(result, null, 2));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(`Recovery failed: ${error.message}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
