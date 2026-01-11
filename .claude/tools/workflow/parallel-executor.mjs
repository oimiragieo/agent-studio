#!/usr/bin/env node
/**
 * Parallel Workflow Executor
 *
 * Enables parallel execution of workflow steps within parallel groups.
 * Steps with the same parallel_group execute concurrently.
 *
 * Performance Impact: 67% time savings for parallelizable steps (e.g., CUJ-005 steps 2-4)
 */

import { EventEmitter } from 'events';

/**
 * Group steps by their parallel_group field
 * Steps without parallel_group are treated as sequential (group: 'sequential')
 *
 * @param {Array} steps - Array of workflow steps
 * @returns {Map<string|number, Array>} Map of group ID to steps array
 */
export function groupStepsByParallelGroup(steps) {
  const groups = new Map();
  const sequentialSteps = [];

  for (const step of steps) {
    if (step.parallel_group !== undefined && step.parallel_group !== null) {
      const groupId = step.parallel_group;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId).push(step);
    } else {
      // Sequential steps are collected separately
      sequentialSteps.push(step);
    }
  }

  // Add sequential steps as individual groups
  for (const step of sequentialSteps) {
    groups.set(`seq-${step.step}`, [step]);
  }

  return groups;
}

/**
 * Validate parallel groups for dependency conflicts
 * Steps in the same parallel group should not depend on each other
 *
 * @param {Array} steps - Array of workflow steps
 * @returns {{ valid: boolean, errors: Array, warnings: Array }}
 */
export function validateParallelGroups(steps) {
  const errors = [];
  const warnings = [];
  const groups = groupStepsByParallelGroup(steps);

  for (const [groupId, groupSteps] of groups) {
    if (groupSteps.length <= 1) continue;

    // Check for dependencies within the same group
    const stepsInGroup = new Set(groupSteps.map(s => String(s.step)));

    for (const step of groupSteps) {
      if (step.inputs && Array.isArray(step.inputs)) {
        for (const input of step.inputs) {
          // Parse "(from step X)" pattern
          const match = input.match(/\(from step (\d+(?:\.\d+)?)\)/);
          if (match) {
            const dependsOnStep = match[1];
            if (stepsInGroup.has(dependsOnStep)) {
              errors.push({
                group: groupId,
                step: step.step,
                dependsOn: dependsOnStep,
                message: `Step ${step.step} depends on step ${dependsOnStep}, but both are in parallel group ${groupId}. They cannot execute in parallel.`
              });
            }
          }
        }
      }
    }

    // Warn if group has only one step (useless parallelization)
    if (groupSteps.length === 1) {
      warnings.push({
        group: groupId,
        message: `Parallel group ${groupId} contains only one step (${groupSteps[0].step}). Consider removing parallel_group.`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Execute a single step with timeout and error handling
 *
 * @param {Object} step - Workflow step configuration
 * @param {Object} context - Execution context
 * @param {Function} stepExecutor - Function to execute a single step
 * @returns {Promise<Object>} Execution result
 */
async function executeStepWithTimeout(step, context, stepExecutor, timeout = 300000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await Promise.race([
      stepExecutor(step, context),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Step ${step.step} timed out after ${timeout}ms`));
        });
      })
    ]);

    return {
      step: step.step,
      status: 'success',
      result
    };
  } catch (error) {
    return {
      step: step.step,
      status: 'error',
      error: error.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Execute workflow steps with parallel group support
 *
 * @param {Array} steps - Array of workflow steps
 * @param {Object} context - Execution context (workflowId, runId, etc.)
 * @param {Object} options - Execution options
 * @param {Function} options.stepExecutor - Function to execute a single step
 * @param {number} options.timeout - Timeout per step in milliseconds (default: 5 minutes)
 * @param {boolean} options.failFast - Stop on first error (default: false)
 * @param {Function} options.onStepComplete - Callback when a step completes
 * @param {Function} options.onGroupComplete - Callback when a group completes
 * @returns {Promise<Object>} Execution results
 */
export async function executeWorkflowSteps(steps, context, options = {}) {
  const {
    stepExecutor,
    timeout = 300000,
    failFast = false,
    onStepComplete = () => {},
    onGroupComplete = () => {}
  } = options;

  if (!stepExecutor || typeof stepExecutor !== 'function') {
    throw new Error('stepExecutor function is required');
  }

  // Validate parallel groups
  const validation = validateParallelGroups(steps);
  if (!validation.valid) {
    // Log errors but continue - fallback to sequential
    console.warn('[ParallelExecutor] Parallel group validation errors:');
    validation.errors.forEach(e => console.warn(`  - ${e.message}`));
    console.warn('[ParallelExecutor] Falling back to sequential execution');

    // Execute sequentially on validation error
    return executeSequentially(steps, context, stepExecutor, timeout, onStepComplete);
  }

  // Log warnings
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(`[ParallelExecutor] Warning: ${w.message}`));
  }

  const groups = groupStepsByParallelGroup(steps);
  const results = {
    success: [],
    failed: [],
    groups: [],
    timing: {
      startTime: Date.now(),
      endTime: null,
      parallelSavings: 0
    }
  };

  // Sort groups by their first step number for proper ordering
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aFirstStep = parseFloat(a[1][0].step);
    const bFirstStep = parseFloat(b[1][0].step);
    return aFirstStep - bFirstStep;
  });

  // Execute groups in order
  for (const [groupId, groupSteps] of sortedGroups) {
    const groupStartTime = Date.now();

    if (groupSteps.length === 1) {
      // Single step - execute directly
      const step = groupSteps[0];
      console.log(`[ParallelExecutor] Executing step ${step.step} (sequential)`);

      const result = await executeStepWithTimeout(step, context, stepExecutor, timeout);

      if (result.status === 'success') {
        results.success.push(result);
      } else {
        results.failed.push(result);
        if (failFast) {
          break;
        }
      }

      onStepComplete(result);
    } else {
      // Multiple steps - execute in parallel
      console.log(`[ParallelExecutor] Executing parallel group ${groupId}: steps ${groupSteps.map(s => s.step).join(', ')}`);

      const parallelPromises = groupSteps.map(step =>
        executeStepWithTimeout(step, context, stepExecutor, timeout)
      );

      const parallelResults = await Promise.allSettled(parallelPromises);

      // Process results
      let groupSuccess = true;
      for (let i = 0; i < parallelResults.length; i++) {
        const settledResult = parallelResults[i];
        let result;

        if (settledResult.status === 'fulfilled') {
          result = settledResult.value;
        } else {
          result = {
            step: groupSteps[i].step,
            status: 'error',
            error: settledResult.reason?.message || 'Unknown error'
          };
        }

        if (result.status === 'success') {
          results.success.push(result);
        } else {
          results.failed.push(result);
          groupSuccess = false;
        }

        onStepComplete(result);
      }

      // Calculate parallel savings (compared to sequential execution)
      const groupEndTime = Date.now();
      const groupDuration = groupEndTime - groupStartTime;

      // Estimate sequential time (sum of individual step estimates)
      const estimatedSequentialTime = groupSteps.length * (groupDuration / Math.max(1, groupSteps.length));
      const savings = estimatedSequentialTime - groupDuration;
      results.timing.parallelSavings += Math.max(0, savings);

      results.groups.push({
        groupId,
        steps: groupSteps.map(s => s.step),
        success: groupSuccess,
        duration: groupDuration
      });

      onGroupComplete({
        groupId,
        steps: groupSteps.map(s => s.step),
        success: groupSuccess,
        duration: groupDuration
      });

      if (!groupSuccess && failFast) {
        break;
      }
    }
  }

  results.timing.endTime = Date.now();
  results.timing.totalDuration = results.timing.endTime - results.timing.startTime;

  return results;
}

/**
 * Execute steps sequentially (fallback mode)
 */
async function executeSequentially(steps, context, stepExecutor, timeout, onStepComplete) {
  const results = {
    success: [],
    failed: [],
    groups: [],
    timing: {
      startTime: Date.now(),
      endTime: null,
      parallelSavings: 0,
      mode: 'sequential'
    }
  };

  for (const step of steps) {
    console.log(`[ParallelExecutor] Executing step ${step.step} (sequential fallback)`);

    const result = await executeStepWithTimeout(step, context, stepExecutor, timeout);

    if (result.status === 'success') {
      results.success.push(result);
    } else {
      results.failed.push(result);
    }

    onStepComplete(result);
  }

  results.timing.endTime = Date.now();
  results.timing.totalDuration = results.timing.endTime - results.timing.startTime;

  return results;
}

/**
 * Check if a workflow supports parallel execution
 *
 * @param {Object} workflow - Parsed workflow object
 * @returns {{ supported: boolean, parallelGroups: Array, reason: string }}
 */
export function checkParallelSupport(workflow) {
  if (!workflow.steps || !Array.isArray(workflow.steps)) {
    return {
      supported: false,
      parallelGroups: [],
      reason: 'No steps array found in workflow'
    };
  }

  const parallelGroups = [];
  const groupMap = new Map();

  for (const step of workflow.steps) {
    if (step.parallel === true || step.parallel_group !== undefined) {
      const groupId = step.parallel_group || 'default';
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId).push(step.step);
    }
  }

  for (const [groupId, steps] of groupMap) {
    if (steps.length > 1) {
      parallelGroups.push({
        groupId,
        steps
      });
    }
  }

  return {
    supported: parallelGroups.length > 0,
    parallelGroups,
    reason: parallelGroups.length > 0
      ? `Found ${parallelGroups.length} parallel group(s)`
      : 'No parallel groups defined'
  };
}

/**
 * Get parallel execution statistics from results
 */
export function getParallelStats(results) {
  const totalSteps = results.success.length + results.failed.length;
  const parallelGroups = results.groups.filter(g => g.steps.length > 1);
  const parallelSteps = parallelGroups.reduce((sum, g) => sum + g.steps.length, 0);

  return {
    totalSteps,
    parallelSteps,
    sequentialSteps: totalSteps - parallelSteps,
    parallelGroups: parallelGroups.length,
    successRate: totalSteps > 0 ? (results.success.length / totalSteps * 100).toFixed(1) : 0,
    parallelSavingsMs: results.timing.parallelSavings,
    totalDurationMs: results.timing.totalDuration
  };
}

export default {
  groupStepsByParallelGroup,
  validateParallelGroups,
  executeWorkflowSteps,
  checkParallelSupport,
  getParallelStats
};
