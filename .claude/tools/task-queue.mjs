#!/usr/bin/env node

/**
 * @file task-queue.mjs
 * @description Task queue management system for agent coordination
 *
 * Features:
 * - Concurrency control (max 2 parallel tasks - API limit)
 * - Priority queue (high/medium/low)
 * - Task dependencies
 * - Retry policy
 * - Timeout tracking
 * - Auto-start capabilities
 * - State persistence
 *
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const STATE_DIR = path.join(PROJECT_ROOT, '.claude/context/runtime/runs');

/**
 * Task Queue Manager
 */
class TaskQueue {
  constructor(runId) {
    this.runId = runId;
    this.maxConcurrent = 2; // API limit
    this.queue = [];
    this.running = [];
    this.completed = [];
    this.failed = [];
    this.cancelled = [];
    this.initialized = false;
  }

  /**
   * Initialize task queue
   */
  async init() {
    if (this.initialized) return;

    const queueDir = path.join(STATE_DIR, this.runId);
    await fs.mkdir(queueDir, { recursive: true });

    // Try to load existing queue state
    const statePath = this.getStatePath();
    try {
      const stateData = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData);
      this.loadState(state);
      console.log(`Loaded existing queue state for run: ${this.runId}`);
    } catch (error) {
      // No existing state, start fresh
      console.log(`Initialized new queue for run: ${this.runId}`);
    }

    this.initialized = true;
  }

  /**
   * Get state file path
   */
  getStatePath() {
    return path.join(STATE_DIR, this.runId, 'task-queue.json');
  }

  /**
   * Load state from file
   */
  loadState(state) {
    this.queue = state.queue || [];
    this.running = state.running || [];
    this.completed = state.completed || [];
    this.failed = state.failed || [];
    this.cancelled = state.cancelled || [];
  }

  /**
   * Enqueue a task
   */
  enqueue(taskSpec) {
    if (!this.initialized) {
      throw new Error('TaskQueue not initialized. Call init() first.');
    }

    const task = {
      id: taskSpec.id || randomUUID(),
      ...taskSpec,
      status: 'queued',
      created_at: new Date().toISOString(),
      retry_count: 0,
      priority: taskSpec.priority || 'medium',
      dependencies: taskSpec.dependencies || [],
      timeout_ms: taskSpec.timeout_ms || 120000,
      retry_policy: {
        max_retries: taskSpec.max_retries || 0,
        retry_delay_ms: taskSpec.retry_delay_ms || 0,
        ...taskSpec.retry_policy
      }
    };

    this.queue.push(task);
    this.sortQueue();
    this.persist();
    this.autoStart();

    return task;
  }

  /**
   * Sort queue by priority and creation time
   */
  sortQueue() {
    const priorityScore = { high: 3, medium: 2, low: 1 };

    this.queue.sort((a, b) => {
      // First sort by priority (high → medium → low)
      const priorityDiff = priorityScore[b.priority] - priorityScore[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then sort by creation time (older first)
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  /**
   * Dequeue next task
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    // Find first task whose dependencies are met
    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i];
      if (this.canStart(task)) {
        this.queue.splice(i, 1);
        return task;
      }
    }

    return null;
  }

  /**
   * Check if task can start (dependencies met)
   */
  canStart(task) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId =>
      this.completed.some(t => t.id === depId)
    );
  }

  /**
   * Auto-start tasks when capacity available
   */
  async autoStart() {
    while (this.running.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.dequeue();
      if (!task) break; // No tasks with met dependencies

      await this.start(task);
    }
  }

  /**
   * Start a task
   */
  async start(task) {
    task.status = 'running';
    task.started_at = new Date().toISOString();
    this.running.push(task);
    this.persist();

    console.log(`[QUEUE] Started task: ${task.id} (${task.agent || 'unknown'})`);

    // Note: Actual task execution happens externally
    // This is just state management
    return task;
  }

  /**
   * Mark task as completed
   */
  async complete(taskId, result = {}) {
    const index = this.running.findIndex(t => t.id === taskId);
    if (index < 0) {
      throw new Error(`Task ${taskId} not found in running queue`);
    }

    const task = this.running.splice(index, 1)[0];
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    task.duration_ms = new Date(task.completed_at) - new Date(task.started_at);
    task.result = result;

    this.completed.push(task);
    this.persist();

    console.log(`[QUEUE] Completed task: ${taskId} (${task.duration_ms}ms)`);

    // Start next task if available
    await this.autoStart();

    return task;
  }

  /**
   * Mark task as failed
   */
  async fail(taskId, error) {
    const index = this.running.findIndex(t => t.id === taskId);
    if (index < 0) {
      throw new Error(`Task ${taskId} not found in running queue`);
    }

    const task = this.running.splice(index, 1)[0];
    task.status = 'failed';
    task.failed_at = new Date().toISOString();
    task.duration_ms = new Date(task.failed_at) - new Date(task.started_at);
    task.error = {
      message: error.message,
      stack: error.stack
    };

    // Check if retry is allowed
    if (this.shouldRetry(task)) {
      task.retry_count++;
      task.status = 'queued';
      task.started_at = null;

      console.log(`[QUEUE] Retrying task: ${taskId} (attempt ${task.retry_count})`);

      // Add delay before retry if specified
      if (task.retry_policy.retry_delay_ms > 0) {
        await this.delay(task.retry_policy.retry_delay_ms);
      }

      this.queue.push(task);
      this.sortQueue();
    } else {
      console.log(`[QUEUE] Failed task: ${taskId} (${error.message})`);
      this.failed.push(task);
    }

    this.persist();

    // Start next task
    await this.autoStart();

    return task;
  }

  /**
   * Check if task should be retried
   */
  shouldRetry(task) {
    const maxRetries = task.retry_policy?.max_retries || 0;
    return task.retry_count < maxRetries;
  }

  /**
   * Cancel a task
   */
  async cancel(taskId) {
    // Check if queued
    let index = this.queue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      const task = this.queue.splice(index, 1)[0];
      task.status = 'cancelled';
      task.cancelled_at = new Date().toISOString();
      this.cancelled.push(task);
      this.persist();
      console.log(`[QUEUE] Cancelled queued task: ${taskId}`);
      return task;
    }

    // Check if running
    index = this.running.findIndex(t => t.id === taskId);
    if (index >= 0) {
      const task = this.running.splice(index, 1)[0];
      task.status = 'cancelled';
      task.cancelled_at = new Date().toISOString();
      this.cancelled.push(task);
      this.persist();
      console.log(`[QUEUE] Cancelled running task: ${taskId}`);

      // Start next task
      await this.autoStart();

      return task;
    }

    throw new Error(`Task ${taskId} not found`);
  }

  /**
   * Get task status
   */
  getStatus(taskId) {
    const all = [
      ...this.queue,
      ...this.running,
      ...this.completed,
      ...this.failed,
      ...this.cancelled
    ];

    const task = all.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return {
      id: task.id,
      status: task.status,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      failed_at: task.failed_at,
      cancelled_at: task.cancelled_at,
      duration_ms: task.duration_ms,
      retry_count: task.retry_count,
      priority: task.priority,
      dependencies: task.dependencies,
      error: task.error,
      result: task.result
    };
  }

  /**
   * Wait for task completion
   */
  async waitForCompletion(taskId, timeoutMs = 300000) {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < timeoutMs) {
      const status = this.getStatus(taskId);

      if (status.status === 'completed') {
        return { success: true, result: status.result };
      }

      if (status.status === 'failed') {
        return { success: false, error: status.error };
      }

      if (status.status === 'cancelled') {
        return { success: false, error: { message: 'Task was cancelled' } };
      }

      // Still running or queued, wait
      await this.delay(pollInterval);
    }

    throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      run_id: this.runId,
      max_concurrent: this.maxConcurrent,
      queued: this.queue.length,
      running: this.running.length,
      completed: this.completed.length,
      failed: this.failed.length,
      cancelled: this.cancelled.length,
      total: this.queue.length + this.running.length + this.completed.length +
             this.failed.length + this.cancelled.length,
      success_rate: this.completed.length + this.failed.length > 0
        ? (this.completed.length / (this.completed.length + this.failed.length) * 100).toFixed(2) + '%'
        : 'N/A',
      queue_details: {
        high_priority: this.queue.filter(t => t.priority === 'high').length,
        medium_priority: this.queue.filter(t => t.priority === 'medium').length,
        low_priority: this.queue.filter(t => t.priority === 'low').length
      }
    };
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return {
      queued: [...this.queue],
      running: [...this.running],
      completed: [...this.completed],
      failed: [...this.failed],
      cancelled: [...this.cancelled]
    };
  }

  /**
   * Persist queue state to file
   */
  async persist() {
    const state = {
      run_id: this.runId,
      max_concurrent: this.maxConcurrent,
      queue: this.queue,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
      cancelled: this.cancelled,
      updated_at: new Date().toISOString()
    };

    const statePath = this.getStatePath();
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Delay helper
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear completed tasks
   */
  async clearCompleted() {
    const clearedCount = this.completed.length;
    this.completed = [];
    await this.persist();
    console.log(`[QUEUE] Cleared ${clearedCount} completed tasks`);
    return clearedCount;
  }

  /**
   * Clear failed tasks
   */
  async clearFailed() {
    const clearedCount = this.failed.length;
    this.failed = [];
    await this.persist();
    console.log(`[QUEUE] Cleared ${clearedCount} failed tasks`);
    return clearedCount;
  }

  /**
   * Reset queue (clear all)
   */
  async reset() {
    this.queue = [];
    this.running = [];
    this.completed = [];
    this.failed = [];
    this.cancelled = [];
    await this.persist();
    console.log(`[QUEUE] Reset queue for run: ${this.runId}`);
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    printHelp();
    process.exit(0);
  }

  try {
    const runId = args[args.indexOf('--run-id') + 1];
    if (!runId) {
      console.error('Error: --run-id is required');
      process.exit(1);
    }

    const queue = new TaskQueue(runId);
    await queue.init();

    switch (command) {
      case 'enqueue': {
        const agent = args[args.indexOf('--agent') + 1];
        const task = args[args.indexOf('--task') + 1];
        const priority = args[args.indexOf('--priority') + 1] || 'medium';

        if (!agent || !task) {
          console.error('Error: --agent and --task are required');
          process.exit(1);
        }

        const result = queue.enqueue({
          agent,
          task,
          priority
        });

        console.log('Task enqueued:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'complete': {
        const taskId = args[args.indexOf('--task-id') + 1];
        if (!taskId) {
          console.error('Error: --task-id is required');
          process.exit(1);
        }

        const result = await queue.complete(taskId);
        console.log('Task completed:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'fail': {
        const taskId = args[args.indexOf('--task-id') + 1];
        const errorMsg = args[args.indexOf('--error') + 1] || 'Unknown error';

        if (!taskId) {
          console.error('Error: --task-id is required');
          process.exit(1);
        }

        const result = await queue.fail(taskId, new Error(errorMsg));
        console.log('Task failed:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'status': {
        const taskId = args[args.indexOf('--task-id') + 1];
        if (!taskId) {
          console.error('Error: --task-id is required');
          process.exit(1);
        }

        const status = queue.getStatus(taskId);
        console.log('Task status:');
        console.log(JSON.stringify(status, null, 2));
        break;
      }

      case 'stats': {
        const stats = queue.getQueueStats();
        console.log('Queue statistics:');
        console.log(JSON.stringify(stats, null, 2));
        break;
      }

      case 'list': {
        const tasks = queue.getAllTasks();
        console.log('All tasks:');
        console.log(JSON.stringify(tasks, null, 2));
        break;
      }

      case 'cancel': {
        const taskId = args[args.indexOf('--task-id') + 1];
        if (!taskId) {
          console.error('Error: --task-id is required');
          process.exit(1);
        }

        const result = await queue.cancel(taskId);
        console.log('Task cancelled:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'reset': {
        await queue.reset();
        console.log('Queue reset complete');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Task Queue Manager

Usage:
  node task-queue.mjs <command> --run-id <id> [options]

Commands:
  enqueue --agent <type> --task <desc> [--priority high|medium|low]
    Enqueue a new task

  complete --task-id <id>
    Mark task as completed

  fail --task-id <id> [--error <message>]
    Mark task as failed

  cancel --task-id <id>
    Cancel a queued or running task

  status --task-id <id>
    Get task status

  stats
    Get queue statistics

  list
    List all tasks

  reset
    Reset queue (clear all tasks)

Examples:
  # Enqueue task
  node task-queue.mjs enqueue --run-id run-001 --agent developer --task "Implement feature X" --priority high

  # Complete task
  node task-queue.mjs complete --run-id run-001 --task-id <uuid>

  # Get statistics
  node task-queue.mjs stats --run-id run-001
  `);
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TaskQueue;
