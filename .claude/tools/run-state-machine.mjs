#!/usr/bin/env node
/**
 * Run State Machine - Manages state transitions with validation and retry logic
 *
 * Implements:
 * - State transition validation
 * - Intelligent retries with feedback loops
 * - Idempotency rules
 * - awaiting_approval state for human-in-the-loop
 *
 * Usage:
 *   import { transitionState, canTransition, getRetryPolicy } from './run-state-machine.mjs';
 */

import { readRun, updateRun } from './run-manager.mjs';
import { logEvent, EVENT_TYPES } from './audit-logger.mjs';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_approval', 'handoff_pending', 'paused', 'completed', 'failed'],
  awaiting_approval: ['in_progress', 'cancelled', 'failed'],
  handoff_pending: ['handed_off', 'in_progress', 'failed'],
  handed_off: ['in_progress', 'completed', 'failed'],
  paused: ['in_progress', 'cancelled'],
  completed: [], // Terminal state
  failed: ['in_progress', 'cancelled'], // Can retry from failed
  cancelled: [], // Terminal state
};

/**
 * Check if a state transition is valid
 * @param {string} fromState - Current state
 * @param {string} toState - Target state
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function canTransition(fromState, toState) {
  if (fromState === toState) {
    return { valid: true, reason: 'No state change' };
  }

  const allowedTransitions = VALID_TRANSITIONS[fromState] || [];

  if (!allowedTransitions.includes(toState)) {
    return {
      valid: false,
      reason: `Invalid transition from ${fromState} to ${toState}. Allowed: ${allowedTransitions.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Transition run state with validation
 * @param {string} runId - Run identifier
 * @param {string} newState - Target state
 * @param {Object} options - Transition options
 * @param {string} options.reason - Reason for transition
 * @param {Object} options.metadata - Additional metadata
 * @param {boolean} options.force - Force transition (skip validation)
 * @returns {Promise<Object>} Updated run record
 */
export async function transitionState(runId, newState, options = {}) {
  const { reason, metadata = {}, force = false } = options;

  const runRecord = await readRun(runId);
  const currentState = runRecord.status;

  // Validate transition
  if (!force) {
    const validation = canTransition(currentState, newState);
    if (!validation.valid) {
      throw new Error(`State transition validation failed: ${validation.reason}`);
    }
  }

  // Prepare update
  const updates = {
    status: newState,
    updated_at: new Date().toISOString(),
  };

  // Add transition metadata
  if (!runRecord.state_transitions) {
    runRecord.state_transitions = [];
  }

  runRecord.state_transitions.push({
    from: currentState,
    to: newState,
    timestamp: new Date().toISOString(),
    reason: reason || `Transition from ${currentState} to ${newState}`,
    metadata,
  });

  updates.state_transitions = runRecord.state_transitions;

  // Update timestamps based on state
  if (newState === 'in_progress' && !runRecord.timestamps.started_at) {
    updates.timestamps = {
      ...runRecord.timestamps,
      started_at: new Date().toISOString(),
    };
  }

  if (newState === 'awaiting_approval') {
    if (!updates.timestamps) {
      updates.timestamps = { ...runRecord.timestamps };
    }
    updates.timestamps.awaiting_approval_at = new Date().toISOString();
  }

  if (newState === 'completed') {
    if (!updates.timestamps) {
      updates.timestamps = { ...runRecord.timestamps };
    }
    updates.timestamps.completed_at = new Date().toISOString();
  }

  if (newState === 'failed') {
    if (!updates.timestamps) {
      updates.timestamps = { ...runRecord.timestamps };
    }
    updates.timestamps.failed_at = new Date().toISOString();
  }

  // Merge metadata
  if (Object.keys(metadata).length > 0) {
    updates.metadata = {
      ...runRecord.metadata,
      ...metadata,
    };
  }

  const updatedRecord = await updateRun(runId, updates);

  // Log state transition
  await logEvent(
    runId,
    EVENT_TYPES.STATE_TRANSITION,
    {
      from_state: currentState,
      to_state: newState,
      step: metadata.step || null,
    },
    metadata
  );

  return updatedRecord;
}

/**
 * Get retry policy for a failed step
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @returns {Object} Retry policy
 */
export async function getRetryPolicy(runId, step) {
  const runRecord = await readRun(runId);

  // Get step retry history
  const stepRetries = (runRecord.step_retries || {})[step] || {
    count: 0,
    last_error: null,
    last_attempt: null,
    feedback_injected: false,
  };

  const maxRetries = runRecord.metadata?.max_retries_per_step || 3;
  const canRetry = stepRetries.count < maxRetries;

  return {
    canRetry,
    remainingRetries: Math.max(0, maxRetries - stepRetries.count),
    count: stepRetries.count,
    lastError: stepRetries.last_error,
    lastAttempt: stepRetries.last_attempt,
    feedbackInjected: stepRetries.feedback_injected,
    maxRetries,
  };
}

/**
 * Record step retry attempt
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} error - Error information
 * @param {Object} feedback - Feedback to inject on retry
 * @returns {Promise<Object>} Updated retry record
 */
export async function recordStepRetry(runId, step, error, feedback = null) {
  const runRecord = await readRun(runId);

  if (!runRecord.step_retries) {
    runRecord.step_retries = {};
  }

  if (!runRecord.step_retries[step]) {
    runRecord.step_retries[step] = {
      count: 0,
      last_error: null,
      last_attempt: null,
      feedback_injected: false,
      errors: [],
    };
  }

  const retryRecord = runRecord.step_retries[step];
  retryRecord.count += 1;
  retryRecord.last_error = {
    message: error.message || String(error),
    timestamp: new Date().toISOString(),
    stack: error.stack,
  };
  retryRecord.last_attempt = new Date().toISOString();
  retryRecord.errors.push(retryRecord.last_error);

  if (feedback) {
    retryRecord.feedback_injected = true;
    retryRecord.feedback = feedback;
  }

  await updateRun(runId, {
    step_retries: runRecord.step_retries,
  });

  return retryRecord;
}

/**
 * Get feedback message for retry (intelligent retry with feedback loop)
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @returns {string|null} Feedback message to inject, or null if no feedback
 */
export async function getRetryFeedback(runId, step) {
  const retryPolicy = await getRetryPolicy(runId, step);

  if (!retryPolicy.canRetry || !retryPolicy.lastError) {
    return null;
  }

  const error = retryPolicy.lastError;
  const feedback = retryPolicy.feedbackInjected ? retryPolicy.feedback : null;

  // Build feedback message
  let feedbackMessage = `Your previous attempt at step ${step} failed with the following error:\n\n`;
  feedbackMessage += `Error: ${error.message || String(error)}\n\n`;

  if (feedback) {
    feedbackMessage += `Additional feedback: ${JSON.stringify(feedback, null, 2)}\n\n`;
  }

  feedbackMessage += `Please review the error, fix the issues, and retry. This is attempt ${retryPolicy.count + 1} of ${retryPolicy.maxRetries}.\n\n`;
  feedbackMessage += `Common fixes:\n`;
  feedbackMessage += `- Check that all required inputs are present\n`;
  feedbackMessage += `- Verify schema validation passes\n`;
  feedbackMessage += `- Ensure gate validation criteria are met\n`;
  feedbackMessage += `- Review artifact dependencies\n`;

  return feedbackMessage;
}

/**
 * Check idempotency rules for a step
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} options - Idempotency options
 * @param {'overwrite' | 'version' | 'skip'} options.mode - Idempotency mode
 * @returns {Object} { canExecute: boolean, reason?: string, existingArtifact?: string }
 */
export async function checkIdempotency(runId, step, options = {}) {
  const { mode = 'overwrite' } = options;
  const runRecord = await readRun(runId);

  // Check if step was already completed
  if (runRecord.completed_steps && runRecord.completed_steps.includes(step)) {
    if (mode === 'skip') {
      return {
        canExecute: false,
        reason: `Step ${step} already completed. Skipping (idempotency mode: skip).`,
        existingArtifact: runRecord.step_artifacts?.[step],
      };
    }

    if (mode === 'version') {
      // Version the artifact
      const artifactName = runRecord.step_artifacts?.[step];
      return {
        canExecute: true,
        reason: `Step ${step} already completed. Will create new version (idempotency mode: version).`,
        existingArtifact: artifactName,
        version: true,
      };
    }

    // mode === 'overwrite'
    return {
      canExecute: true,
      reason: `Step ${step} already completed. Will overwrite (idempotency mode: overwrite).`,
      existingArtifact: runRecord.step_artifacts?.[step],
    };
  }

  return {
    canExecute: true,
    reason: `Step ${step} not yet completed. Proceeding.`,
  };
}

/**
 * Mark step as completed (idempotent)
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {string} artifactPath - Path to artifact created by step
 * @returns {Promise<Object>} Updated run record
 */
export async function markStepCompleted(runId, step, artifactPath) {
  const runRecord = await readRun(runId);

  if (!runRecord.completed_steps) {
    runRecord.completed_steps = [];
  }

  if (!runRecord.completed_steps.includes(step)) {
    runRecord.completed_steps.push(step);
  }

  if (!runRecord.step_artifacts) {
    runRecord.step_artifacts = {};
  }

  runRecord.step_artifacts[step] = artifactPath;

  await updateRun(runId, {
    completed_steps: runRecord.completed_steps,
    step_artifacts: runRecord.step_artifacts,
    current_step: step,
  });

  return runRecord;
}

/**
 * Request approval for a step (transition to awaiting_approval)
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} approvalRequest - Approval request details
 * @param {string} approvalRequest.reason - Reason approval is needed
 * @param {string} approvalRequest.artifact - Artifact requiring approval
 * @param {Object} approvalRequest.metadata - Additional metadata
 * @returns {Promise<Object>} Updated run record
 */
export async function requestApproval(runId, step, approvalRequest) {
  const { reason, artifact, metadata = {} } = approvalRequest;

  // Log approval request
  await logEvent(
    runId,
    EVENT_TYPES.APPROVAL_REQUEST,
    {
      step,
      reason,
      artifact,
    },
    metadata
  );

  return await transitionState(runId, 'awaiting_approval', {
    reason: `Approval required for step ${step}: ${reason}`,
    metadata: {
      approval_request: {
        step,
        reason,
        artifact,
        requested_at: new Date().toISOString(),
        ...metadata,
      },
    },
  });
}

/**
 * Approve step (transition from awaiting_approval to in_progress)
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} approval - Approval details
 * @param {string} approval.approved_by - Who approved (user/system)
 * @param {string} approval.notes - Approval notes
 * @returns {Promise<Object>} Updated run record
 */
export async function approveStep(runId, step, approval) {
  const { approved_by = 'user', notes = '' } = approval;

  return await transitionState(runId, 'in_progress', {
    reason: `Step ${step} approved by ${approved_by}`,
    metadata: {
      approval: {
        step,
        approved_by,
        approved_at: new Date().toISOString(),
        notes,
      },
    },
  });
}

export default {
  canTransition,
  transitionState,
  getRetryPolicy,
  recordStepRetry,
  getRetryFeedback,
  checkIdempotency,
  markStepCompleted,
  requestApproval,
  approveStep,
};
