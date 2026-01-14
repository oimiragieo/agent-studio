/**
 * Task State Manager
 *
 * Implements A2A task lifecycle with 8-state state machine.
 * Manages task creation, state transitions, and history tracking.
 *
 * Features:
 * - 8-state lifecycle: SUBMITTED, WORKING, COMPLETED, FAILED, CANCELLED, REJECTED, INPUT_REQUIRED, AUTH_REQUIRED
 * - Transition validation: Enforces valid state changes
 * - Terminal state detection: COMPLETED, FAILED, CANCELLED, REJECTED
 * - State history tracking: Maintains audit trail
 * - Feature flag integration
 * - Performance target: <5ms state transitions
 *
 * @module task-state-manager
 */

import { randomUUID } from 'crypto';

/**
 * A2A Task States from specification
 */
export const TaskState = Object.freeze({
  UNSPECIFIED: 'TASK_STATE_UNSPECIFIED',
  SUBMITTED: 'TASK_STATE_SUBMITTED',
  WORKING: 'TASK_STATE_WORKING',
  INPUT_REQUIRED: 'TASK_STATE_INPUT_REQUIRED',
  COMPLETED: 'TASK_STATE_COMPLETED',
  CANCELLED: 'TASK_STATE_CANCELLED',
  FAILED: 'TASK_STATE_FAILED',
  REJECTED: 'TASK_STATE_REJECTED',
  AUTH_REQUIRED: 'TASK_STATE_AUTH_REQUIRED',
});

/**
 * Terminal states - no further transitions allowed
 */
export const TERMINAL_STATES = Object.freeze([
  TaskState.COMPLETED,
  TaskState.FAILED,
  TaskState.CANCELLED,
  TaskState.REJECTED,
]);

/**
 * Valid state transitions per A2A specification
 */
export const VALID_TRANSITIONS = Object.freeze({
  [TaskState.SUBMITTED]: [TaskState.WORKING, TaskState.REJECTED, TaskState.CANCELLED],
  [TaskState.WORKING]: [
    TaskState.COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELLED,
    TaskState.INPUT_REQUIRED,
    TaskState.AUTH_REQUIRED,
  ],
  [TaskState.INPUT_REQUIRED]: [TaskState.WORKING, TaskState.CANCELLED, TaskState.FAILED],
  [TaskState.AUTH_REQUIRED]: [TaskState.WORKING, TaskState.CANCELLED, TaskState.FAILED],
  [TaskState.COMPLETED]: [],
  [TaskState.FAILED]: [],
  [TaskState.CANCELLED]: [],
  [TaskState.REJECTED]: [],
});

/**
 * Feature flags for task state manager
 */
const FEATURE_FLAGS = {
  task_state_manager: process.env.TASK_STATE_MANAGER === 'true' || false,
};

/**
 * Task State Manager
 *
 * Manages A2A task lifecycle with 8-state state machine
 */
export class TaskStateManager {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.tasks = new Map(); // In-memory task storage
    this.stateHistory = new Map(); // Task state history
    this.featureFlags = options.featureFlags || FEATURE_FLAGS;
  }

  /**
   * Create a new task
   *
   * @param {object} message - A2A Message
   * @param {object} options - Task options
   * @returns {object} Created task
   */
  createTask(message, options = {}) {
    const startTime = Date.now();

    if (!this.featureFlags.task_state_manager) {
      throw new Error('task_state_manager feature flag is disabled');
    }

    // Generate task ID
    const taskId = options.taskId || `task-${randomUUID()}`;

    // Get session ID
    const sessionId = options.sessionId || message.contextId || `session-${randomUUID()}`;

    // Create task object
    const task = {
      id: taskId,
      session_id: sessionId,
      state: TaskState.SUBMITTED,
      messages: [message],
      artifacts: [],
      metadata: options.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store task
    this.tasks.set(taskId, task);

    // Initialize state history
    this.stateHistory.set(taskId, [
      {
        from_state: null,
        to_state: TaskState.SUBMITTED,
        reason: 'Task created',
        timestamp: task.created_at,
      },
    ]);

    const duration = Date.now() - startTime;

    console.log(`[Task State Manager] Created task ${taskId} in ${duration}ms`);

    return task;
  }

  /**
   * Transition task to new state
   *
   * @param {string} taskId - Task ID
   * @param {string} newState - New state
   * @param {string} reason - Reason for transition
   * @returns {object} Updated task
   */
  transitionState(taskId, newState, reason = '') {
    const startTime = Date.now();

    if (!this.featureFlags.task_state_manager) {
      throw new Error('task_state_manager feature flag is disabled');
    }

    // Get task
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Get current state
    const currentState = task.state;

    // Validate transition
    if (!this.validateTransition(currentState, newState)) {
      throw new Error(
        `Invalid transition: ${currentState} → ${newState}. ` +
          `Valid transitions from ${currentState}: ${VALID_TRANSITIONS[currentState]?.join(', ') || 'none (terminal state)'}`
      );
    }

    // Update task state
    task.state = newState;
    task.updated_at = new Date().toISOString();

    // Add to state history
    const history = this.stateHistory.get(taskId) || [];
    history.push({
      from_state: currentState,
      to_state: newState,
      reason,
      timestamp: task.updated_at,
    });
    this.stateHistory.set(taskId, history);

    // Mark completion time for terminal states
    if (this.isTerminalState(newState)) {
      task.completed_at = task.updated_at;
    }

    const duration = Date.now() - startTime;

    console.log(
      `[Task State Manager] Transitioned ${taskId} from ${currentState} to ${newState} in ${duration}ms`
    );

    return task;
  }

  /**
   * Validate state transition
   *
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} True if valid
   */
  validateTransition(fromState, toState) {
    // Check if transition is allowed
    const validTransitions = VALID_TRANSITIONS[fromState];

    if (!validTransitions) {
      return false; // Unknown state
    }

    return validTransitions.includes(toState);
  }

  /**
   * Check if state is terminal
   *
   * @param {string} state - Task state
   * @returns {boolean} True if terminal
   */
  isTerminalState(state) {
    return TERMINAL_STATES.includes(state);
  }

  /**
   * Get task by ID
   *
   * @param {string} taskId - Task ID
   * @returns {object|null} Task or null if not found
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get state history for task
   *
   * @param {string} taskId - Task ID
   * @returns {Array} State history
   */
  getStateHistory(taskId) {
    return this.stateHistory.get(taskId) || [];
  }

  /**
   * Add message to task
   *
   * @param {string} taskId - Task ID
   * @param {object} message - A2A Message
   * @returns {object} Updated task
   */
  addMessage(taskId, message) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.messages.push(message);
    task.updated_at = new Date().toISOString();

    return task;
  }

  /**
   * Add artifact to task
   *
   * @param {string} taskId - Task ID
   * @param {object} artifact - Task artifact
   * @returns {object} Updated task
   */
  addArtifact(taskId, artifact) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.artifacts.push(artifact);
    task.updated_at = new Date().toISOString();

    return task;
  }

  /**
   * Update task metadata
   *
   * @param {string} taskId - Task ID
   * @param {object} metadata - Metadata to merge
   * @returns {object} Updated task
   */
  updateMetadata(taskId, metadata) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.metadata = { ...task.metadata, ...metadata };
    task.updated_at = new Date().toISOString();

    return task;
  }

  /**
   * List tasks by session
   *
   * @param {string} sessionId - Session ID
   * @param {object} filters - Filter options
   * @returns {Array} Tasks
   */
  listTasks(sessionId, filters = {}) {
    let tasks = Array.from(this.tasks.values()).filter(t => t.session_id === sessionId);

    // Apply state filter
    if (filters.state) {
      tasks = tasks.filter(t => t.state === filters.state);
    }

    // Apply limit
    if (filters.limit) {
      tasks = tasks.slice(0, filters.limit);
    }

    return tasks;
  }

  /**
   * Cancel task
   *
   * @param {string} taskId - Task ID
   * @param {string} reason - Cancellation reason
   * @returns {object} Updated task
   */
  cancelTask(taskId, reason = 'Task cancelled') {
    return this.transitionState(taskId, TaskState.CANCELLED, reason);
  }

  /**
   * Get task status summary
   *
   * @param {string} taskId - Task ID
   * @returns {object} Status summary
   */
  getTaskStatus(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const history = this.getStateHistory(taskId);

    return {
      task_id: taskId,
      state: task.state,
      is_terminal: this.isTerminalState(task.state),
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      message_count: task.messages.length,
      artifact_count: task.artifacts.length,
      state_changes: history.length,
    };
  }

  /**
   * Get all valid transitions from current state
   *
   * @param {string} taskId - Task ID
   * @returns {Array} Valid next states
   */
  getValidTransitions(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return VALID_TRANSITIONS[task.state] || [];
  }

  /**
   * Clear all tasks (for testing)
   */
  clear() {
    this.tasks.clear();
    this.stateHistory.clear();
  }
}

/**
 * Create Task State Manager
 *
 * @param {object} options - Configuration options
 * @returns {TaskStateManager}
 */
export function createTaskStateManager(options = {}) {
  return new TaskStateManager(options);
}
