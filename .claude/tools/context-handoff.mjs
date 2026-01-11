#!/usr/bin/env node
/**
 * Context Handoff Utility
 *
 * Manages context handoff when context window is exhausted:
 * - Monitor context usage
 * - Trigger handoff when threshold reached
 * - Package context for handoff
 * - Validate context recovery
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Context usage thresholds
const CONTEXT_WARNING_THRESHOLD = 0.8; // 80% usage
const CONTEXT_HANDOFF_THRESHOLD = 0.9; // 90% usage

/**
 * Monitor context usage
 * @param {string} agentName - Name of the agent
 * @param {Object} usage - Current context usage { total, used, available }
 * @returns {Object} Monitoring result with threshold status and recommendations
 */
export function monitorContextUsage(agentName, usage) {
  const percentage = usage.total > 0 ? usage.used / usage.total : 0;

  return {
    percentage,
    thresholdReached: percentage >= CONTEXT_WARNING_THRESHOLD,
    handoffNeeded: percentage >= CONTEXT_HANDOFF_THRESHOLD,
    recommendation:
      percentage >= CONTEXT_HANDOFF_THRESHOLD
        ? 'Immediate handoff required'
        : percentage >= CONTEXT_WARNING_THRESHOLD
          ? 'Prepare for handoff soon'
          : 'Context usage is normal',
    agentName,
  };
}

/**
 * Package context for handoff (FULL IMPLEMENTATION - enumerates all artifacts)
 * @param {string} runId - Run ID (use run-manager for canonical state)
 * @param {string} workflowId - Workflow ID
 * @param {string} currentStep - Current step number
 * @param {Object} context - Current context state
 * @returns {Object} Handoff package
 */
export async function packageContextForHandoff(runId, workflowId, currentStep, context) {
  const { readdir } = await import('fs/promises');
  const { readArtifactRegistry, getRunDirectoryStructure } = await import('./run-manager.mjs');

  // Use run directory structure
  const runDirs = getRunDirectoryStructure(runId);

  // Read artifact registry (authoritative artifact index)
  let artifactRegistry = null;
  try {
    artifactRegistry = await readArtifactRegistry(runId);
  } catch (error) {
    console.warn(`Warning: Could not read artifact registry: ${error.message}`);
  }

  // Enumerate all artifacts from registry
  const artifacts = [];
  if (artifactRegistry && artifactRegistry.artifacts) {
    for (const [artifactName, artifactEntry] of Object.entries(artifactRegistry.artifacts)) {
      artifacts.push({
        name: artifactName,
        path: artifactEntry.path,
        step: artifactEntry.step,
        agent: artifactEntry.agent,
        validation_status: artifactEntry.metadata?.validation_status || 'unknown',
        created_at: artifactEntry.created_at,
      });
    }
  }

  // Enumerate gate files
  const gates = [];
  if (existsSync(runDirs.gates_dir)) {
    try {
      const gateFiles = await readdir(runDirs.gates_dir);
      for (const gateFile of gateFiles) {
        if (gateFile.endsWith('.json')) {
          const gatePath = resolve(runDirs.gates_dir, gateFile);
          try {
            const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
            gates.push({
              file: gateFile,
              path: gatePath,
              step: extractStepFromFilename(gateFile),
              validation_status: gateData.validation_status || 'unknown',
              errors: gateData.errors || [],
            });
          } catch (error) {
            console.warn(`Warning: Could not read gate file ${gateFile}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not enumerate gate files: ${error.message}`);
    }
  }

  // Enumerate reasoning files
  const reasoning = [];
  if (existsSync(runDirs.reasoning_dir)) {
    try {
      const reasoningFiles = await readdir(runDirs.reasoning_dir);
      for (const reasoningFile of reasoningFiles) {
        if (reasoningFile.endsWith('.json')) {
          const reasoningPath = resolve(runDirs.reasoning_dir, reasoningFile);
          reasoning.push({
            file: reasoningFile,
            path: reasoningPath,
            step: extractStepFromFilename(reasoningFile),
            agent: extractAgentFromFilename(reasoningFile),
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not enumerate reasoning files: ${error.message}`);
    }
  }

  // Read plan document from run directory
  let planData = null;
  const planPath = resolve(runDirs.run_dir, 'plans', `plan-${workflowId}.json`);
  if (existsSync(planPath)) {
    try {
      planData = JSON.parse(readFileSync(planPath, 'utf-8'));
    } catch (error) {
      console.warn(`Warning: Could not read plan document: ${error.message}`);
    }
  }

  // Read run record (authoritative state)
  let runRecord = null;
  try {
    const { readRun } = await import('./run-manager.mjs');
    runRecord = await readRun(runId);
  } catch (error) {
    console.warn(`Warning: Could not read run record: ${error.message}`);
  }

  const handoffPackage = {
    run_id: runId,
    workflow_id: workflowId,
    current_step: currentStep,
    timestamp: new Date().toISOString(),
    run_record: runRecord,
    artifact_registry: artifactRegistry,
    context: {
      artifacts: artifacts,
      gates: gates,
      reasoning: reasoning,
      plan: planData,
    },
    next_steps: context.nextSteps || [],
    state: context.state || {},
    open_questions: context.openQuestions || [],
    validation_summary: {
      total_artifacts: artifacts.length,
      validated_artifacts: artifacts.filter(a => a.validation_status === 'pass').length,
      failed_validations: artifacts.filter(a => a.validation_status === 'fail').length,
    },
    what_to_do_next: context.whatToDoNext || [],
  };

  return handoffPackage;
}

/**
 * Extract step number from filename (e.g., "01-analyst.json" -> 1)
 */
function extractStepFromFilename(filename) {
  const match = filename.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract agent name from filename (e.g., "01-analyst.json" -> "analyst")
 */
function extractAgentFromFilename(filename) {
  const match = filename.match(/^\d+-(.+)\.json$/);
  return match ? match[1] : null;
}

/**
 * Save handoff package to file (run-based)
 * @param {Object} handoffPackage - Handoff package to save
 * @param {string} runId - Run ID
 */
export async function saveHandoffPackage(handoffPackage, runId) {
  const { getRunDirectoryStructure } = await import('./run-manager.mjs');
  const runDirs = getRunDirectoryStructure(runId);

  // Save to run directory
  const handoffPath = runDirs.handoff_json;
  writeFileSync(handoffPath, JSON.stringify(handoffPackage, null, 2), 'utf-8');

  return handoffPath;
}

/**
 * Load handoff package from file (run-based)
 * @param {string} runId - Run ID
 * @returns {Object|null} Handoff package or null if not found
 */
export async function loadHandoffPackage(runId) {
  const { readFile } = await import('fs/promises');
  const { getRunDirectoryStructure } = await import('./run-manager.mjs');

  const runDirs = getRunDirectoryStructure(runId);
  const handoffFile = runDirs.handoff_json;

  if (!existsSync(handoffFile)) {
    return null;
  }

  try {
    const handoffContent = await readFile(handoffFile, 'utf-8');
    const handoffPackage = JSON.parse(handoffContent);
    return handoffPackage;
  } catch (error) {
    console.warn(`Warning: Could not load handoff package: ${error.message}`);
    return null;
  }
}

/**
 * Validate context recovery
 * @param {Object} handoffPackage - Handoff package to validate
 * @returns {Object} Validation result
 */
export function validateContextRecovery(handoffPackage) {
  const errors = [];
  const warnings = [];

  if (!handoffPackage.workflow_id) {
    errors.push('Handoff package missing workflow_id');
  }

  if (!handoffPackage.current_step) {
    errors.push('Handoff package missing current_step');
  }

  if (!handoffPackage.context) {
    errors.push('Handoff package missing context');
  } else {
    if (!handoffPackage.context.plan) {
      warnings.push('Handoff package missing plan document');
    }
    if (!handoffPackage.context.artifacts || handoffPackage.context.artifacts.length === 0) {
      warnings.push('Handoff package has no artifacts');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'monitor') {
    const agentName = args[1] || 'unknown';
    const used = parseInt(args[2]) || 0;
    const total = parseInt(args[3]) || 0;

    const result = monitorContextUsage(agentName, { used, total, available: total - used });
    console.log(`Context Usage: ${(result.percentage * 100).toFixed(1)}%`);
    console.log(`Status: ${result.recommendation}`);
    if (result.handoffNeeded) {
      console.log('⚠️  HANDOFF REQUIRED');
      process.exit(2);
    } else if (result.thresholdReached) {
      console.log('⚠️  Prepare for handoff');
      process.exit(1);
    } else {
      process.exit(0);
    }
  } else if (command === 'package') {
    const runId = args[1];
    const workflowId = args[2];
    const currentStep = args[3];

    if (!runId || !workflowId || !currentStep) {
      console.error(
        'Usage: node context-handoff.mjs package <run-id> <workflow-id> <current-step>'
      );
      process.exit(1);
    }

    const context = {
      nextSteps: [],
      state: {},
      openQuestions: [],
      whatToDoNext: [],
    };

    const package = await packageContextForHandoff(runId, workflowId, currentStep, context);
    const path = await saveHandoffPackage(package, runId);
    console.log(`✅ Handoff package saved to: ${path}`);
  } else if (command === 'validate') {
    const runId = args[1];

    if (!runId) {
      console.error('Usage: node context-handoff.mjs validate <run-id>');
      process.exit(1);
    }

    const package = await loadHandoffPackage(runId);
    if (!package) {
      console.error('❌ No handoff package found');
      process.exit(1);
    }

    const result = validateContextRecovery(package);
    if (result.valid) {
      console.log('✅ Handoff package validation: PASSED');
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      process.exit(0);
    } else {
      console.error('❌ Handoff package validation: FAILED');
      console.error('\nErrors:');
      result.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
  } else {
    console.error('Usage:');
    console.error('  node context-handoff.mjs monitor <agent> <used> <total>');
    console.error('  node context-handoff.mjs package <run-id> <workflow-id> <current-step>');
    console.error('  node context-handoff.mjs validate <run-id>');
    process.exit(1);
  }
}
