#!/usr/bin/env node
/**
 * Progress Tracker
 * Tracks workflow execution progress and generates progress bars/percentages.
 * Integrates with workflow runner to provide user feedback.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

/**
 * Generate progress bar
 * @param {number} current - Current progress (0-100)
 * @param {number} total - Total steps (optional, for step-based progress)
 * @param {number} width - Width of progress bar (default: 40)
 * @returns {string} Progress bar string
 */
export function generateProgressBar(current, total = null, width = 40) {
  let percentage;
  if (total !== null) {
    percentage = Math.min(100, Math.max(0, (current / total) * 100));
  } else {
    percentage = Math.min(100, Math.max(0, current));
  }

  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

/**
 * Track workflow progress
 * @param {string} workflowId - Workflow ID
 * @param {number} currentStep - Current step number
 * @param {number} totalSteps - Total number of steps
 * @param {string} stepName - Name of current step
 * @param {Object} metadata - Additional metadata
 */
export async function trackProgress(workflowId, currentStep, totalSteps, stepName, metadata = {}) {
  const progressDir = path.join(ROOT, '.claude/context/progress');
  await fs.mkdir(progressDir, { recursive: true });

  const progressFile = path.join(progressDir, `${workflowId}.json`);

  const progress = {
    workflowId,
    currentStep,
    totalSteps,
    stepName,
    percentage: (currentStep / totalSteps) * 100,
    startedAt: metadata.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedSteps: metadata.completedSteps || [],
    ...metadata,
  };

  await fs.writeFile(progressFile, JSON.stringify(progress, null, 2), 'utf-8');

  return progress;
}

/**
 * Get workflow progress
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<Object|null>} Progress data or null if not found
 */
export async function getProgress(workflowId) {
  const progressFile = path.join(ROOT, '.claude/context/progress', `${workflowId}.json`);

  try {
    const content = await fs.readFile(progressFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Display progress to console
 * @param {Object} progress - Progress data
 * @param {boolean} showDetails - Show detailed information
 */
export function displayProgress(progress, showDetails = false) {
  const bar = generateProgressBar(progress.percentage);
  const stepInfo = `Step ${progress.currentStep}/${progress.totalSteps}: ${progress.stepName}`;

  console.log(`\n${bar} ${stepInfo}`);

  if (showDetails && progress.completedSteps) {
    console.log('Completed steps:');
    progress.completedSteps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.name || step}`);
    });
  }

  if (progress.estimatedTimeRemaining) {
    console.log(`Estimated time remaining: ${progress.estimatedTimeRemaining}`);
  }
}

/**
 * Calculate estimated time remaining
 * @param {Object} progress - Progress data
 * @returns {string} Estimated time remaining
 */
export function calculateTimeRemaining(progress) {
  if (!progress.startedAt || progress.currentStep === 0) {
    return 'Calculating...';
  }

  const startTime = new Date(progress.startedAt);
  const now = new Date();
  const elapsed = now - startTime;
  const avgTimePerStep = elapsed / progress.currentStep;
  const remainingSteps = progress.totalSteps - progress.currentStep;
  const estimatedRemaining = avgTimePerStep * remainingSteps;

  if (estimatedRemaining < 60000) {
    return `${Math.round(estimatedRemaining / 1000)}s`;
  } else if (estimatedRemaining < 3600000) {
    return `${Math.round(estimatedRemaining / 60000)}m`;
  } else {
    return `${(estimatedRemaining / 3600000).toFixed(1)}h`;
  }
}

/**
 * Mark step as completed
 * @param {string} workflowId - Workflow ID
 * @param {number} stepNumber - Step number
 * @param {string} stepName - Step name
 */
export async function markStepCompleted(workflowId, stepNumber, stepName) {
  const progress = await getProgress(workflowId);
  if (!progress) {
    return;
  }

  const completedSteps = progress.completedSteps || [];
  if (!completedSteps.find(s => s.number === stepNumber)) {
    completedSteps.push({
      number: stepNumber,
      name: stepName,
      completedAt: new Date().toISOString(),
    });
  }

  await trackProgress(workflowId, progress.currentStep, progress.totalSteps, progress.stepName, {
    ...progress,
    completedSteps,
  });
}

/**
 * Initialize progress tracking for a workflow
 * @param {string} workflowId - Workflow ID
 * @param {number} totalSteps - Total number of steps
 * @param {string} workflowName - Name of workflow
 */
export async function initializeProgress(workflowId, totalSteps, workflowName) {
  return await trackProgress(workflowId, 0, totalSteps, 'Initializing', {
    workflowName,
    startedAt: new Date().toISOString(),
    completedSteps: [],
  });
}

/**
 * Complete workflow progress tracking
 * @param {string} workflowId - Workflow ID
 */
export async function completeProgress(workflowId) {
  const progress = await getProgress(workflowId);
  if (!progress) {
    return;
  }

  await trackProgress(workflowId, progress.totalSteps, progress.totalSteps, 'Completed', {
    ...progress,
    completedAt: new Date().toISOString(),
  });
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'show') {
    const workflowId = process.argv[3];
    if (!workflowId) {
      console.error('Usage: node progress-tracker.mjs show <workflowId>');
      process.exit(1);
    }

    const progress = await getProgress(workflowId);
    if (!progress) {
      console.log(`No progress found for workflow ${workflowId}`);
      process.exit(1);
    }

    displayProgress(progress, true);
  } else if (command === 'bar') {
    const current = parseFloat(process.argv[3]) || 0;
    const total = process.argv[4] ? parseFloat(process.argv[4]) : null;
    console.log(generateProgressBar(current, total));
  } else {
    console.log('Usage:');
    console.log('  node progress-tracker.mjs show <workflowId>  - Show workflow progress');
    console.log('  node progress-tracker.mjs bar <current> [total]  - Generate progress bar');
  }
}
