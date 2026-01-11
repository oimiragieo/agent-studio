#!/usr/bin/env node
/**
 * Workflow Preview
 * Shows workflow steps before execution and allows user confirmation.
 * Integrates with orchestrator to preview workflow selection.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

/**
 * Load workflow definition
 * @param {string} workflowName - Name of workflow file (without .yaml extension)
 * @returns {Promise<Object>} Workflow definition
 */
export async function loadWorkflow(workflowName) {
  const workflowFile = path.join(ROOT, '.claude/workflows', `${workflowName}.yaml`);

  try {
    const content = await fs.readFile(workflowFile, 'utf-8');
    return yaml.load(content);
  } catch (error) {
    throw new Error(`Failed to load workflow ${workflowName}: ${error.message}`);
  }
}

/**
 * Generate workflow preview
 * @param {Object} workflow - Workflow definition
 * @returns {string} Formatted preview text
 */
export function generatePreview(workflow) {
  const lines = [];

  lines.push('='.repeat(60));
  lines.push(`Workflow: ${workflow.name || 'Unnamed Workflow'}`);
  lines.push('='.repeat(60));

  if (workflow.description) {
    lines.push(`\nDescription: ${workflow.description}`);
  }

  if (workflow.trigger_keywords && workflow.trigger_keywords.length > 0) {
    lines.push(`\nTrigger Keywords: ${workflow.trigger_keywords.join(', ')}`);
  }

  if (workflow.steps && workflow.steps.length > 0) {
    lines.push(`\nSteps (${workflow.steps.length}):`);
    lines.push('-'.repeat(60));

    workflow.steps.forEach((step, index) => {
      const stepNum = step.step || index;
      const stepName = step.name || 'Unnamed Step';
      const agent = step.agent || 'N/A';

      lines.push(`\n${stepNum}. ${stepName}`);
      lines.push(`   Agent: ${agent}`);

      if (step.inputs && step.inputs.length > 0) {
        lines.push(`   Inputs: ${step.inputs.join(', ')}`);
      }

      if (step.outputs && step.outputs.length > 0) {
        lines.push(`   Outputs: ${step.outputs.join(', ')}`);
      }

      if (step.description) {
        lines.push(`   Description: ${step.description.split('\n')[0]}`);
      }

      if (step.validation) {
        lines.push(`   Validation: ${step.validation.schema || step.validation.gate || 'Yes'}`);
      }
    });
  }

  if (workflow.completion_criteria && workflow.completion_criteria.length > 0) {
    lines.push(`\nCompletion Criteria:`);
    workflow.completion_criteria.forEach(criterion => {
      lines.push(`  - ${criterion}`);
    });
  }

  lines.push('\n' + '='.repeat(60));

  return lines.join('\n');
}

/**
 * Display workflow preview
 * @param {Object} workflow - Workflow definition
 */
export function displayPreview(workflow) {
  console.log(generatePreview(workflow));
}

/**
 * Estimate workflow duration
 * @param {Object} workflow - Workflow definition
 * @returns {string} Estimated duration
 */
export function estimateDuration(workflow) {
  if (!workflow.steps || workflow.steps.length === 0) {
    return 'Unknown';
  }

  // Rough estimate: 2-5 minutes per step
  const avgMinutesPerStep = 3;
  const totalMinutes = workflow.steps.length * avgMinutesPerStep;

  if (totalMinutes < 60) {
    return `~${totalMinutes} minutes`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `~${hours}h ${minutes}m`;
  }
}

/**
 * Preview multiple workflows
 * @param {Array<string>} workflowNames - Array of workflow names
 * @returns {Promise<Array<Object>>} Array of workflow previews
 */
export async function previewWorkflows(workflowNames) {
  const previews = [];

  for (const workflowName of workflowNames) {
    try {
      const workflow = await loadWorkflow(workflowName);
      previews.push({
        name: workflowName,
        workflow,
        preview: generatePreview(workflow),
        estimatedDuration: estimateDuration(workflow),
      });
    } catch (error) {
      console.warn(`Warning: Could not load workflow ${workflowName}: ${error.message}`);
    }
  }

  return previews;
}

/**
 * Prompt user for confirmation (CLI)
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} True if confirmed
 */
export async function promptConfirmation(message) {
  // In a real implementation, this would use readline or similar
  // For now, return true (auto-confirm)
  console.log(`${message} (auto-confirmed in non-interactive mode)`);
  return true;
}

/**
 * Show workflow selection preview
 * @param {string} selectedWorkflow - Selected workflow name
 * @param {Array<string>} alternativeWorkflows - Alternative workflow names
 */
export async function showSelectionPreview(selectedWorkflow, alternativeWorkflows = []) {
  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW SELECTION PREVIEW');
  console.log('='.repeat(60));

  try {
    const workflow = await loadWorkflow(selectedWorkflow);
    displayPreview(workflow);

    console.log(`\nEstimated Duration: ${estimateDuration(workflow)}`);

    if (alternativeWorkflows.length > 0) {
      console.log(`\nAlternative Workflows: ${alternativeWorkflows.join(', ')}`);
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error(`Error loading workflow: ${error.message}`);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'preview') {
    const workflowName = process.argv[3];
    if (!workflowName) {
      console.error('Usage: node workflow-preview.mjs preview <workflowName>');
      process.exit(1);
    }

    loadWorkflow(workflowName)
      .then(workflow => {
        displayPreview(workflow);
        console.log(`\nEstimated Duration: ${estimateDuration(workflow)}`);
      })
      .catch(error => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  } else if (command === 'list') {
    const workflowsDir = path.join(ROOT, '.claude/workflows');
    fs.readdir(workflowsDir)
      .then(files => {
        const workflowFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        console.log('Available Workflows:');
        workflowFiles.forEach(file => {
          console.log(`  - ${file.replace(/\.(yaml|yml)$/, '')}`);
        });
      })
      .catch(error => {
        console.error(`Error reading workflows directory: ${error.message}`);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node workflow-preview.mjs preview <workflowName>  - Preview a workflow');
    console.log('  node workflow-preview.mjs list                   - List available workflows');
  }
}
