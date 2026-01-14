/**
 * Tests for Task State Manager
 *
 * Comprehensive test suite covering:
 * - Task creation
 * - All 8 state transitions
 * - Invalid transition rejection
 * - Terminal state detection
 * - State history tracking
 * - Performance benchmarks
 * - Error handling
 *
 * @module task-state-manager.test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskStateManager,
  TaskState,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  createTaskStateManager,
} from './task-state-manager.mjs';

describe('Task State Manager', () => {
  let manager;

  beforeEach(() => {
    manager = createTaskStateManager({
      featureFlags: { task_state_manager: true },
    });
  });

  describe('Task Creation', () => {
    it('should create task in SUBMITTED state', () => {
      const message = {
        messageId: 'msg-123',
        role: 'ROLE_USER',
        parts: [{ text: 'Implement feature X' }],
      };

      const task = manager.createTask(message);

      assert.ok(task.id);
      assert.ok(task.session_id);
      assert.strictEqual(task.state, TaskState.SUBMITTED);
      assert.strictEqual(task.messages.length, 1);
      assert.ok(task.created_at);
      assert.ok(task.updated_at);
    });

    it('should support custom task ID', () => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message, { taskId: 'task-custom-123' });

      assert.strictEqual(task.id, 'task-custom-123');
    });

    it('should support custom session ID', () => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message, { sessionId: 'session-custom-456' });

      assert.strictEqual(task.session_id, 'session-custom-456');
    });

    it('should support custom metadata', () => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const metadata = { priority: 'high', agentId: 'developer' };
      const task = manager.createTask(message, { metadata });

      assert.deepStrictEqual(task.metadata, metadata);
    });

    it('should initialize state history', () => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);

      const history = manager.getStateHistory(task.id);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].from_state, null);
      assert.strictEqual(history[0].to_state, TaskState.SUBMITTED);
      assert.strictEqual(history[0].reason, 'Task created');
    });

    it('should throw if feature flag disabled', () => {
      const disabledManager = createTaskStateManager({
        featureFlags: { task_state_manager: false },
      });

      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      assert.throws(() => {
        disabledManager.createTask(message);
      }, /feature flag is disabled/);
    });

    it('should complete in <20ms', () => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      const start = Date.now();
      manager.createTask(message);
      const duration = Date.now() - start;

      assert.ok(duration < 20, `Expected <20ms, got ${duration}ms`);
    });
  });

  describe('State Transitions', () => {
    let taskId;

    beforeEach(() => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);
      taskId = task.id;
    });

    it('should transition SUBMITTED → WORKING', () => {
      const task = manager.transitionState(taskId, TaskState.WORKING, 'Agent started processing');

      assert.strictEqual(task.state, TaskState.WORKING);
    });

    it('should transition SUBMITTED → REJECTED', () => {
      const task = manager.transitionState(taskId, TaskState.REJECTED, 'Task rejected');

      assert.strictEqual(task.state, TaskState.REJECTED);
    });

    it('should transition SUBMITTED → CANCELLED', () => {
      const task = manager.transitionState(taskId, TaskState.CANCELLED, 'User cancelled');

      assert.strictEqual(task.state, TaskState.CANCELLED);
    });

    it('should transition WORKING → COMPLETED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      const task = manager.transitionState(taskId, TaskState.COMPLETED, 'Task completed');

      assert.strictEqual(task.state, TaskState.COMPLETED);
      assert.ok(task.completed_at);
    });

    it('should transition WORKING → FAILED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      const task = manager.transitionState(taskId, TaskState.FAILED, 'Task failed');

      assert.strictEqual(task.state, TaskState.FAILED);
      assert.ok(task.completed_at);
    });

    it('should transition WORKING → CANCELLED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      const task = manager.transitionState(taskId, TaskState.CANCELLED, 'User cancelled');

      assert.strictEqual(task.state, TaskState.CANCELLED);
    });

    it('should transition WORKING → INPUT_REQUIRED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      const task = manager.transitionState(taskId, TaskState.INPUT_REQUIRED, 'Awaiting user input');

      assert.strictEqual(task.state, TaskState.INPUT_REQUIRED);
    });

    it('should transition WORKING → AUTH_REQUIRED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      const task = manager.transitionState(
        taskId,
        TaskState.AUTH_REQUIRED,
        'Awaiting authentication'
      );

      assert.strictEqual(task.state, TaskState.AUTH_REQUIRED);
    });

    it('should transition INPUT_REQUIRED → WORKING', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.INPUT_REQUIRED);
      const task = manager.transitionState(taskId, TaskState.WORKING, 'Input provided');

      assert.strictEqual(task.state, TaskState.WORKING);
    });

    it('should transition AUTH_REQUIRED → WORKING', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.AUTH_REQUIRED);
      const task = manager.transitionState(taskId, TaskState.WORKING, 'Authenticated');

      assert.strictEqual(task.state, TaskState.WORKING);
    });

    it('should update state history', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.INPUT_REQUIRED);
      manager.transitionState(taskId, TaskState.WORKING);

      const history = manager.getStateHistory(taskId);

      assert.strictEqual(history.length, 4); // Created + 3 transitions
      assert.strictEqual(history[1].from_state, TaskState.SUBMITTED);
      assert.strictEqual(history[1].to_state, TaskState.WORKING);
      assert.strictEqual(history[2].from_state, TaskState.WORKING);
      assert.strictEqual(history[2].to_state, TaskState.INPUT_REQUIRED);
      assert.strictEqual(history[3].from_state, TaskState.INPUT_REQUIRED);
      assert.strictEqual(history[3].to_state, TaskState.WORKING);
    });

    it('should complete in <5ms', () => {
      const start = Date.now();
      manager.transitionState(taskId, TaskState.WORKING);
      const duration = Date.now() - start;

      assert.ok(duration < 5, `Expected <5ms, got ${duration}ms`);
    });
  });

  describe('Invalid Transitions', () => {
    let taskId;

    beforeEach(() => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);
      taskId = task.id;
    });

    it('should reject SUBMITTED → COMPLETED', () => {
      assert.throws(() => {
        manager.transitionState(taskId, TaskState.COMPLETED);
      }, /Invalid transition/);
    });

    it('should reject SUBMITTED → FAILED', () => {
      assert.throws(() => {
        manager.transitionState(taskId, TaskState.FAILED);
      }, /Invalid transition/);
    });

    it('should reject SUBMITTED → INPUT_REQUIRED', () => {
      assert.throws(() => {
        manager.transitionState(taskId, TaskState.INPUT_REQUIRED);
      }, /Invalid transition/);
    });

    it('should reject transitions from COMPLETED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.COMPLETED);

      assert.throws(() => {
        manager.transitionState(taskId, TaskState.WORKING);
      }, /Invalid transition/);
    });

    it('should reject transitions from FAILED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.FAILED);

      assert.throws(() => {
        manager.transitionState(taskId, TaskState.WORKING);
      }, /Invalid transition/);
    });

    it('should reject transitions from CANCELLED', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.CANCELLED);

      assert.throws(() => {
        manager.transitionState(taskId, TaskState.WORKING);
      }, /Invalid transition/);
    });

    it('should reject transitions from REJECTED', () => {
      manager.transitionState(taskId, TaskState.REJECTED);

      assert.throws(() => {
        manager.transitionState(taskId, TaskState.WORKING);
      }, /Invalid transition/);
    });

    it('should provide helpful error message', () => {
      try {
        manager.transitionState(taskId, TaskState.COMPLETED);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('TASK_STATE_SUBMITTED'));
        assert.ok(error.message.includes('TASK_STATE_COMPLETED'));
        assert.ok(error.message.includes('Valid transitions'));
      }
    });
  });

  describe('Terminal States', () => {
    let taskId;

    beforeEach(() => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);
      taskId = task.id;
    });

    it('should detect COMPLETED as terminal', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.transitionState(taskId, TaskState.COMPLETED);

      assert.strictEqual(manager.isTerminalState(TaskState.COMPLETED), true);
    });

    it('should detect FAILED as terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.FAILED), true);
    });

    it('should detect CANCELLED as terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.CANCELLED), true);
    });

    it('should detect REJECTED as terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.REJECTED), true);
    });

    it('should detect SUBMITTED as non-terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.SUBMITTED), false);
    });

    it('should detect WORKING as non-terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.WORKING), false);
    });

    it('should detect INPUT_REQUIRED as non-terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.INPUT_REQUIRED), false);
    });

    it('should detect AUTH_REQUIRED as non-terminal', () => {
      assert.strictEqual(manager.isTerminalState(TaskState.AUTH_REQUIRED), false);
    });
  });

  describe('Task Operations', () => {
    let taskId;

    beforeEach(() => {
      const message = { messageId: 'msg-123', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);
      taskId = task.id;
    });

    it('should get task by ID', () => {
      const task = manager.getTask(taskId);

      assert.ok(task);
      assert.strictEqual(task.id, taskId);
    });

    it('should return null for unknown task', () => {
      const task = manager.getTask('unknown-task-id');

      assert.strictEqual(task, null);
    });

    it('should add message to task', () => {
      const message = { messageId: 'msg-456', role: 'ROLE_AGENT', parts: [{ text: 'Reply' }] };

      manager.addMessage(taskId, message);

      const task = manager.getTask(taskId);
      assert.strictEqual(task.messages.length, 2);
      assert.strictEqual(task.messages[1].messageId, 'msg-456');
    });

    it('should add artifact to task', () => {
      const artifact = { name: 'output.txt', mime_type: 'text/plain' };

      manager.addArtifact(taskId, artifact);

      const task = manager.getTask(taskId);
      assert.strictEqual(task.artifacts.length, 1);
      assert.strictEqual(task.artifacts[0].name, 'output.txt');
    });

    it('should update metadata', () => {
      manager.updateMetadata(taskId, { progress: 50 });
      manager.updateMetadata(taskId, { status: 'processing' });

      const task = manager.getTask(taskId);
      assert.strictEqual(task.metadata.progress, 50);
      assert.strictEqual(task.metadata.status, 'processing');
    });

    it('should cancel task', () => {
      manager.transitionState(taskId, TaskState.WORKING);

      const task = manager.cancelTask(taskId, 'User requested cancellation');

      assert.strictEqual(task.state, TaskState.CANCELLED);
    });

    it('should get task status', () => {
      manager.transitionState(taskId, TaskState.WORKING);
      manager.addMessage(taskId, { messageId: 'msg-2', parts: [] });
      manager.addArtifact(taskId, { name: 'file.txt' });

      const status = manager.getTaskStatus(taskId);

      assert.strictEqual(status.task_id, taskId);
      assert.strictEqual(status.state, TaskState.WORKING);
      assert.strictEqual(status.is_terminal, false);
      assert.strictEqual(status.message_count, 2);
      assert.strictEqual(status.artifact_count, 1);
      assert.strictEqual(status.state_changes, 2); // Created + WORKING
    });
  });

  describe('Task Listing', () => {
    it('should list tasks by session', () => {
      const sessionId = 'session-123';
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      manager.createTask(message, { sessionId });
      manager.createTask(message, { sessionId });
      manager.createTask(message, { sessionId: 'other-session' });

      const tasks = manager.listTasks(sessionId);

      assert.strictEqual(tasks.length, 2);
    });

    it('should filter tasks by state', () => {
      const sessionId = 'session-123';
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      const task1 = manager.createTask(message, { sessionId });
      const task2 = manager.createTask(message, { sessionId });
      manager.transitionState(task1.id, TaskState.WORKING);

      const tasks = manager.listTasks(sessionId, { state: TaskState.SUBMITTED });

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].id, task2.id);
    });

    it('should limit task results', () => {
      const sessionId = 'session-123';
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      for (let i = 0; i < 5; i++) {
        manager.createTask(message, { sessionId });
      }

      const tasks = manager.listTasks(sessionId, { limit: 3 });

      assert.strictEqual(tasks.length, 3);
    });
  });

  describe('Transition Validation', () => {
    it('should validate valid transition', () => {
      const valid = manager.validateTransition(TaskState.SUBMITTED, TaskState.WORKING);

      assert.strictEqual(valid, true);
    });

    it('should reject invalid transition', () => {
      const valid = manager.validateTransition(TaskState.SUBMITTED, TaskState.COMPLETED);

      assert.strictEqual(valid, false);
    });

    it('should get valid transitions for task', () => {
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const task = manager.createTask(message);

      const validTransitions = manager.getValidTransitions(task.id);

      assert.deepStrictEqual(validTransitions, [
        TaskState.WORKING,
        TaskState.REJECTED,
        TaskState.CANCELLED,
      ]);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should create 100 tasks in <2000ms', () => {
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        manager.createTask(message);
      }

      const duration = Date.now() - start;

      assert.ok(duration < 2000, `Expected <2000ms for 100 tasks, got ${duration}ms`);
    });

    it('should perform 100 state transitions in <500ms', () => {
      const message = { messageId: 'msg-1', role: 'ROLE_USER', parts: [{ text: 'Test' }] };
      const tasks = Array.from({ length: 100 }, () => manager.createTask(message));

      const start = Date.now();

      for (const task of tasks) {
        manager.transitionState(task.id, TaskState.WORKING);
      }

      const duration = Date.now() - start;

      assert.ok(duration < 500, `Expected <500ms for 100 transitions, got ${duration}ms`);
    });
  });

  describe('Constants', () => {
    it('should have correct TERMINAL_STATES', () => {
      assert.strictEqual(TERMINAL_STATES.length, 4);
      assert.ok(TERMINAL_STATES.includes(TaskState.COMPLETED));
      assert.ok(TERMINAL_STATES.includes(TaskState.FAILED));
      assert.ok(TERMINAL_STATES.includes(TaskState.CANCELLED));
      assert.ok(TERMINAL_STATES.includes(TaskState.REJECTED));
    });

    it('should have correct VALID_TRANSITIONS', () => {
      assert.ok(Array.isArray(VALID_TRANSITIONS[TaskState.SUBMITTED]));
      assert.ok(Array.isArray(VALID_TRANSITIONS[TaskState.WORKING]));
      assert.strictEqual(VALID_TRANSITIONS[TaskState.COMPLETED].length, 0);
    });
  });
});
