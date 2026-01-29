#!/usr/bin/env node
/**
 * Task Tool Mock
 * ==============
 *
 * Mocks the Task tool for orchestrator integration tests.
 * Captures spawned agents without executing them.
 */

'use strict';

class TaskToolMock {
  constructor() {
    this.spawnedAgents = [];
    this.taskList = new Map();
    this.taskIdCounter = 1;
    this.spawnDelay = 0; // Simulate spawn time
    this.failureMode = null; // { agentIndex: 0, error: "message" }
  }

  /**
   * Mock Task tool - spawn an agent
   */
  async spawn(config) {
    // Validate required fields
    if (!config.subagent_type) {
      throw new Error('subagent_type is required');
    }
    if (!config.description) {
      throw new Error('description is required');
    }
    if (!config.prompt) {
      throw new Error('prompt is required');
    }

    const taskId = `task-${this.taskIdCounter++}`;

    const agent = {
      id: taskId,
      type: config.subagent_type,
      model: config.model || 'sonnet',
      description: config.description,
      prompt: config.prompt,
      allowed_tools: config.allowed_tools || [],
      status: 'pending',
      spawnedAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      error: null,
    };

    this.spawnedAgents.push(agent);
    this.taskList.set(taskId, agent);

    // Simulate spawn delay
    if (this.spawnDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.spawnDelay));
    }

    // Simulate failure if configured
    const agentIndex = this.spawnedAgents.length - 1;
    if (this.failureMode && this.failureMode.agentIndex === agentIndex) {
      agent.status = 'failed';
      agent.error = this.failureMode.error;
      throw new Error(this.failureMode.error);
    }

    // Auto-complete agent (simulate successful execution)
    agent.status = 'running';

    return { taskId, agent };
  }

  /**
   * Mock TaskList
   */
  list() {
    return Array.from(this.taskList.values()).map(task => ({
      id: task.id,
      subject: task.description,
      status: task.status,
      owner: task.type,
      blockedBy: [],
    }));
  }

  /**
   * Mock TaskUpdate
   */
  update(taskId, updates) {
    const task = this.taskList.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (updates.status) {
      task.status = updates.status;
    }
    if (updates.metadata) {
      task.metadata = { ...task.metadata, ...updates.metadata };
    }

    if (updates.status === 'completed') {
      task.completedAt = new Date().toISOString();
    }

    return { success: true, taskId };
  }

  /**
   * Mock TaskGet
   */
  get(taskId) {
    const task = this.taskList.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return task;
  }

  /**
   * Configure failure mode for testing error handling
   */
  setFailureMode(agentIndex, error) {
    this.failureMode = { agentIndex, error };
  }

  /**
   * Clear failure mode
   */
  clearFailureMode() {
    this.failureMode = null;
  }

  /**
   * Set spawn delay (ms) for timeout testing
   */
  setSpawnDelay(ms) {
    this.spawnDelay = ms;
  }

  /**
   * Reset mock state
   */
  reset() {
    this.spawnedAgents = [];
    this.taskList.clear();
    this.taskIdCounter = 1;
    this.spawnDelay = 0;
    this.failureMode = null;
  }

  /**
   * Get spawn history for assertions
   */
  getSpawnHistory() {
    return this.spawnedAgents;
  }

  /**
   * Get specific spawned agent
   */
  getSpawnedAgent(index) {
    return this.spawnedAgents[index];
  }

  /**
   * Count spawned agents by type
   */
  countByType(type) {
    return this.spawnedAgents.filter(a => a.type === type).length;
  }

  /**
   * Get all failed agents
   */
  getFailedAgents() {
    return this.spawnedAgents.filter(a => a.status === 'failed');
  }
}

module.exports = { TaskToolMock };
