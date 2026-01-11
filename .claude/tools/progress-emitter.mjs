#!/usr/bin/env node
/**
 * Progress Event Emitter
 * Provides real-time progress updates for CUJ and workflow executions
 * Uses Node.js EventEmitter for lightweight event streaming
 *
 * Usage:
 *   import { progressEmitter, emitProgress, subscribeToProgress } from './progress-emitter.mjs';
 *
 *   // Subscribe to progress events
 *   subscribeToProgress((event) => {
 *     console.log(`Progress: ${event.percentage}% - ${event.message}`);
 *   });
 *
 *   // Emit progress
 *   emitProgress({
 *     runId: 'run-001',
 *     step: 1,
 *     status: 'running',
 *     percentage: 25,
 *     message: 'Analyzing code'
 *   });
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const progressLogFile = path.join(projectRoot, '.claude/context/logs/progress.jsonl');

/**
 * Global progress event emitter
 */
export const progressEmitter = new EventEmitter();

// Increase max listeners for long-running workflows
progressEmitter.setMaxListeners(100);

/**
 * Emit a progress event
 * @param {Object} event - Progress event
 * @param {string} event.runId - Run ID
 * @param {number} event.step - Current step number
 * @param {string} event.status - Status (pending, running, completed, failed, skipped)
 * @param {number} event.percentage - Progress percentage (0-100)
 * @param {string} event.message - Progress message
 * @param {Object} event.metadata - Additional metadata
 */
export function emitProgress(event) {
  const progressEvent = {
    timestamp: Date.now(),
    iso_timestamp: new Date().toISOString(),
    run_id: event.runId || null,
    step: event.step || null,
    status: event.status || 'running',
    percentage: Math.min(100, Math.max(0, event.percentage || 0)),
    message: event.message || '',
    metadata: event.metadata || {},
  };

  // Emit to subscribers
  progressEmitter.emit('progress', progressEvent);

  // Also log to file for persistence
  logProgressToFile(progressEvent);
}

/**
 * Log progress to JSONL file
 * @private
 */
function logProgressToFile(event) {
  try {
    const dir = path.dirname(progressLogFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(progressLogFile, JSON.stringify(event) + '\n');
  } catch (error) {
    // Silent fail - don't disrupt execution for logging errors
  }
}

/**
 * Subscribe to progress events
 * @param {Function} callback - Callback function (event) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeToProgress(callback) {
  progressEmitter.on('progress', callback);

  // Return unsubscribe function
  return () => {
    progressEmitter.off('progress', callback);
  };
}

/**
 * Subscribe to progress events for a specific run
 * @param {string} runId - Run ID to filter
 * @param {Function} callback - Callback function (event) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRun(runId, callback) {
  const wrappedCallback = event => {
    if (event.run_id === runId) {
      callback(event);
    }
  };

  progressEmitter.on('progress', wrappedCallback);

  return () => {
    progressEmitter.off('progress', wrappedCallback);
  };
}

/**
 * Get progress history from log file
 * @param {string|null} runId - Filter by run ID (optional)
 * @param {number|null} limit - Limit number of results (optional)
 * @returns {Array<Object>} Progress events
 */
export function getProgressHistory(runId = null, limit = null) {
  if (!fs.existsSync(progressLogFile)) {
    return [];
  }

  const lines = fs
    .readFileSync(progressLogFile, 'utf-8')
    .split('\n')
    .filter(l => l.trim());
  const events = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      // Filter by run ID
      if (runId && event.run_id !== runId) continue;

      events.push(event);

      // Apply limit
      if (limit && events.length >= limit) break;
    } catch (error) {
      // Skip malformed lines
      continue;
    }
  }

  return events;
}

/**
 * Get current progress for a run
 * @param {string} runId - Run ID
 * @returns {Object|null} Latest progress event or null
 */
export function getCurrentProgress(runId) {
  const history = getProgressHistory(runId);
  return history.length > 0 ? history[history.length - 1] : null;
}

/**
 * Progress tracker for workflows
 * Simplifies progress tracking with automatic percentage calculation
 */
export class ProgressTracker {
  /**
   * Create a progress tracker
   * @param {string} runId - Run ID
   * @param {number} totalSteps - Total number of steps
   */
  constructor(runId, totalSteps) {
    this.runId = runId;
    this.totalSteps = totalSteps;
    this.currentStep = 0;
  }

  /**
   * Start tracking
   */
  start() {
    emitProgress({
      runId: this.runId,
      step: 0,
      status: 'pending',
      percentage: 0,
      message: 'Starting workflow',
    });
  }

  /**
   * Update progress for current step
   * @param {string} message - Progress message
   * @param {Object} metadata - Additional metadata
   */
  updateStep(message, metadata = {}) {
    const percentage = (this.currentStep / this.totalSteps) * 100;

    emitProgress({
      runId: this.runId,
      step: this.currentStep,
      status: 'running',
      percentage: Math.round(percentage),
      message,
      metadata,
    });
  }

  /**
   * Complete current step and move to next
   * @param {string} message - Completion message
   */
  completeStep(message) {
    this.currentStep++;
    const percentage = (this.currentStep / this.totalSteps) * 100;

    emitProgress({
      runId: this.runId,
      step: this.currentStep - 1,
      status: 'completed',
      percentage: Math.round(percentage),
      message,
    });
  }

  /**
   * Mark current step as failed
   * @param {string} message - Failure message
   * @param {Error} error - Error object
   */
  failStep(message, error = null) {
    emitProgress({
      runId: this.runId,
      step: this.currentStep,
      status: 'failed',
      percentage: (this.currentStep / this.totalSteps) * 100,
      message,
      metadata: { error: error ? error.message : null },
    });
  }

  /**
   * Skip current step
   * @param {string} message - Skip reason
   */
  skipStep(message) {
    this.currentStep++;
    const percentage = (this.currentStep / this.totalSteps) * 100;

    emitProgress({
      runId: this.runId,
      step: this.currentStep - 1,
      status: 'skipped',
      percentage: Math.round(percentage),
      message,
    });
  }

  /**
   * Complete entire workflow
   * @param {string} message - Completion message
   */
  complete(message = 'Workflow completed') {
    emitProgress({
      runId: this.runId,
      step: this.totalSteps,
      status: 'completed',
      percentage: 100,
      message,
    });
  }
}

/**
 * Create a progress tracker for a workflow
 * @param {string} runId - Run ID
 * @param {number} totalSteps - Total number of steps
 * @returns {ProgressTracker}
 */
export function createProgressTracker(runId, totalSteps) {
  return new ProgressTracker(runId, totalSteps);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'history') {
    const runId = args[1] || null;
    const limit = args[2] ? parseInt(args[2]) : null;
    const history = getProgressHistory(runId, limit);
    console.log(JSON.stringify(history, null, 2));
  } else if (command === 'current') {
    const runId = args[1];
    if (!runId) {
      console.error('Error: Run ID required');
      process.exit(1);
    }
    const current = getCurrentProgress(runId);
    console.log(JSON.stringify(current, null, 2));
  } else if (command === 'watch') {
    const runId = args[1] || null;

    console.log(`Watching progress${runId ? ` for run ${runId}` : ''}...`);
    console.log('Press Ctrl+C to stop\n');

    const callback = event => {
      const time = new Date(event.iso_timestamp).toLocaleTimeString();
      const runInfo = event.run_id ? `[${event.run_id}]` : '';
      const stepInfo = event.step !== null ? `Step ${event.step}` : '';
      const status = event.status.toUpperCase().padEnd(10);
      const percentage = `${event.percentage}%`.padEnd(5);

      console.log(`${time} ${runInfo} ${stepInfo} ${status} ${percentage} ${event.message}`);
    };

    if (runId) {
      subscribeToRun(runId, callback);
    } else {
      subscribeToProgress(callback);
    }

    // Keep process alive
    process.stdin.resume();
  } else {
    console.log(`
Progress Emitter CLI

Usage:
  node progress-emitter.mjs history [runId] [limit]
  node progress-emitter.mjs current <runId>
  node progress-emitter.mjs watch [runId]

Examples:
  node progress-emitter.mjs history run-001 50
  node progress-emitter.mjs current run-001
  node progress-emitter.mjs watch run-001
    `);
  }
}
