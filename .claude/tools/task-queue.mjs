#!/usr/bin/env node
/**
 * Task Queue (minimal)
 *
 * This module exists to provide a stable interface for `ClaudeCodeAdapter` in
 * `.claude/tools/agent-executor.mjs`.
 *
 * The primary goal is to avoid hard failures (for example in workflow dry-runs)
 * when the executor is imported, while still enabling real execution paths when
 * worker infrastructure is available.
 */

import { AgentSupervisor } from './workers/supervisor.mjs';

function makeId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * A lightweight queue API:
 * - `init()`
 * - `enqueue({ agent, task, priority, metadata }) -> { id }`
 * - `waitForCompletion(id, timeoutMs) -> { success, result?, error? }`
 */
export default class TaskQueue {
  constructor(runId, options = {}) {
    this.runId = runId || 'run-unknown';
    this.options = options;
    this.supervisor = null;
    this.initialized = false;
    this.tasks = new Map(); // taskId -> { sessionId, createdAt, ... }
  }

  async init() {
    if (this.initialized) return;
    const maxWorkers =
      Number.isFinite(Number(process.env.CLAUDE_MAX_ACTIVE_SUBAGENTS)) &&
      Number(process.env.CLAUDE_MAX_ACTIVE_SUBAGENTS) > 0
        ? Number(process.env.CLAUDE_MAX_ACTIVE_SUBAGENTS)
        : 1;

    this.supervisor = new AgentSupervisor({
      maxWorkers,
      timeout: Number(this.options.timeoutMs) || 600_000,
    });
    await this.supervisor.initialize();
    this.initialized = true;
  }

  enqueue({ agent, task, priority = 'medium', metadata = {} }) {
    if (!this.initialized || !this.supervisor) {
      throw new Error('TaskQueue not initialized. Call init() first.');
    }

    const taskId = makeId('task');
    const description =
      typeof task === 'string' && task.trim() ? task.trim() : `Execute ${agent || 'agent'} task`;

    const sessionId = makeId('session');
    const payload = {
      runId: this.runId,
      taskId,
      agent,
      priority,
      metadata,
    };

    // We use supervisor worker threads for execution isolation. The worker
    // adapter is responsible for interpreting payloads.
    // Note: `spawnWorker` returns the actual sessionId. We pass ours as a hint
    // through payload, but always trust the returned id.
    const spawnedSessionId = this.supervisor.spawnWorker(
      agent || 'developer',
      description,
      payload
    );

    this.tasks.set(taskId, {
      id: taskId,
      sessionId: spawnedSessionId,
      createdAt: Date.now(),
      agent,
      priority,
    });

    return { id: taskId };
  }

  async waitForCompletion(taskId, timeoutMs = 300_000) {
    if (!this.initialized || !this.supervisor) {
      return { success: false, error: 'TaskQueue not initialized' };
    }

    const task = this.tasks.get(taskId);
    if (!task) return { success: false, error: `Unknown task id: ${taskId}` };

    try {
      const session = await this.supervisor.waitForCompletion(task.sessionId, {
        timeout: timeoutMs,
      });

      return {
        success: true,
        result: session?.result ?? session,
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  }
}
