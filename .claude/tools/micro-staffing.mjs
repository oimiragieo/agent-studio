#!/usr/bin/env node
/**
 * Micro-Staffing - Parallel Agent Execution Manager
 *
 * Manages parallel execution of task-specific agents
 * Enables "staffing on demand" with parallel execution
 *
 * Usage:
 *   node .claude/tools/micro-staffing.mjs execute-parallel --run-id <id> --tasks <json>
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { addActiveTask, completeTask, readProjectDatabase } from './project-db.mjs';
import { delegateTask } from './orchestrator-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Task-specific agent mapping
 * Maps task types to specialized agents
 */
const TASK_AGENT_MAP = {
  'react-component': 'react-component-developer',
  'api-endpoint': 'api-developer',
  'database-schema': 'database-architect',
  'database-migration': 'database-architect',
  'frontend-login': 'react-component-developer',
  'api-auth': 'api-developer',
  'db-setup': 'database-architect',
  'ui-component': 'react-component-developer',
  'backend-service': 'api-developer',
  'data-model': 'database-architect',
};

/**
 * Determine task-specific agent for a task
 * @param {Object} task - Task object
 * @returns {string} Agent name
 */
export function getTaskSpecificAgent(task) {
  // Check if task has explicit agent
  if (task.agent) {
    return task.agent;
  }

  // Try to match task type
  const taskType = task.type || task.category || '';
  const taskDescription = (task.description || '').toLowerCase();

  // Check task-specific mapping
  for (const [key, agent] of Object.entries(TASK_AGENT_MAP)) {
    if (taskType.includes(key) || taskDescription.includes(key)) {
      return agent;
    }
  }

  // Fallback to generic agent
  return task.generic_agent || 'developer';
}

/**
 * Execute tasks in parallel
 * @param {string} runId - Run ID
 * @param {Array} tasks - Array of tasks to execute
 * @returns {Promise<Array>} Task results
 */
export async function executeParallel(runId, tasks) {
  // Validate tasks are independent (no dependencies on each other)
  const independentTasks = tasks.filter(task => {
    const deps = task.dependencies || [];
    // Check if any dependency is in the tasks array
    return !deps.some(dep => tasks.some(t => t.task_id === dep));
  });

  if (independentTasks.length !== tasks.length) {
    throw new Error('Cannot execute tasks in parallel - some tasks depend on others in the batch');
  }

  // Add all tasks as active
  for (const task of tasks) {
    const taskSpecificAgent = getTaskSpecificAgent(task);
    await addActiveTask(runId, {
      ...task,
      agent: taskSpecificAgent,
    });
  }

  // Execute all tasks in parallel using Promise.all
  const taskPromises = tasks.map(async task => {
    const taskSpecificAgent = getTaskSpecificAgent(task);

    try {
      // Delegate task to agent
      const delegation = await delegateTask(task, [], null);

      // In real implementation, this would spawn actual subagent
      // For now, simulate execution
      const result = {
        task_id: task.task_id,
        status: 'completed',
        agent: taskSpecificAgent,
        output: `Task ${task.task_id} completed by ${taskSpecificAgent}`,
        artifacts: [],
      };

      // Complete task
      await completeTask(runId, task.task_id, result);

      return result;
    } catch (error) {
      // Task failed
      await completeTask(runId, task.task_id, {
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  });

  // Wait for all tasks to complete
  const results = await Promise.allSettled(taskPromises);

  // Process results
  const completed = [];
  const failed = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      completed.push(result.value);
    } else {
      failed.push({
        error: result.reason.message,
        task: result.reason.task,
      });
    }
  }

  return {
    completed: completed,
    failed: failed,
    total: tasks.length,
    success_count: completed.length,
    failure_count: failed.length,
  };
}

/**
 * Check if tasks can execute in parallel
 * @param {Array} tasks - Array of tasks
 * @returns {boolean} True if tasks can execute in parallel
 */
export function canExecuteInParallel(tasks) {
  // Check for dependencies between tasks
  for (const task of tasks) {
    const deps = task.dependencies || [];
    for (const dep of deps) {
      if (tasks.some(t => t.task_id === dep)) {
        return false; // Task depends on another task in the batch
      }
    }
  }

  return true;
}

/**
 * Group tasks for parallel execution
 * @param {Array} tasks - Array of tasks
 * @returns {Array<Array>} Groups of tasks that can execute in parallel
 */
export function groupTasksForParallel(tasks) {
  const groups = [];
  const remaining = [...tasks];
  const completed = new Set();

  while (remaining.length > 0) {
    const parallelGroup = [];

    // Find tasks with no dependencies on remaining tasks
    for (let i = remaining.length - 1; i >= 0; i--) {
      const task = remaining[i];
      const deps = task.dependencies || [];
      const allDepsCompleted = deps.every(dep => completed.has(dep));
      const noDepsInRemaining = !deps.some(dep => remaining.some(t => t.task_id === dep));

      if (allDepsCompleted && noDepsInRemaining) {
        parallelGroup.push(task);
        remaining.splice(i, 1);
      }
    }

    if (parallelGroup.length === 0) {
      // Circular dependency or error - add remaining tasks sequentially
      parallelGroup.push(remaining.shift());
    }

    groups.push(parallelGroup);

    // Mark as completed
    for (const task of parallelGroup) {
      completed.add(task.task_id);
    }
  }

  return groups;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'execute-parallel') {
    const runIdIndex = args.indexOf('--run-id');
    const tasksIndex = args.indexOf('--tasks');

    if (runIdIndex === -1 || tasksIndex === -1) {
      console.error('Usage: node micro-staffing.mjs execute-parallel --run-id <id> --tasks <json>');
      process.exit(1);
    }

    const runId = args[runIdIndex + 1];
    let tasks;

    try {
      tasks = JSON.parse(args[tasksIndex + 1]);
    } catch (error) {
      console.error(`Invalid JSON in --tasks: ${error.message}`);
      process.exit(1);
    }

    if (!Array.isArray(tasks)) {
      console.error('Tasks must be an array');
      process.exit(1);
    }

    const result = await executeParallel(runId, tasks);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'check-parallel') {
    const tasksIndex = args.indexOf('--tasks');

    if (tasksIndex === -1) {
      console.error('Usage: node micro-staffing.mjs check-parallel --tasks <json>');
      process.exit(1);
    }

    let tasks;
    try {
      tasks = JSON.parse(args[tasksIndex + 1]);
    } catch (error) {
      console.error(`Invalid JSON in --tasks: ${error.message}`);
      process.exit(1);
    }

    const canParallel = canExecuteInParallel(tasks);
    const groups = groupTasksForParallel(tasks);

    console.log(
      JSON.stringify(
        {
          can_execute_in_parallel: canParallel,
          parallel_groups: groups,
          total_groups: groups.length,
        },
        null,
        2
      )
    );
  } else {
    console.error('Unknown command. Available: execute-parallel, check-parallel');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  executeParallel,
  canExecuteInParallel,
  groupTasksForParallel,
  getTaskSpecificAgent,
};
