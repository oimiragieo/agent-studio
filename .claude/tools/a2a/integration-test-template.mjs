/**
 * A2A Integration Test Template
 *
 * Demonstrates the full A2A discovery -> message -> task flow for testing.
 *
 * @module a2a-integration-test-template
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskState,
  Role,
  mockAgentCard,
  mockTextMessage,
  mockDataMessage,
  mockMultiPartMessage,
  createMockA2AEndpoint,
  assertAgentCardValid,
  assertTaskState,
  mockFeatureFlags,
} from './test-utils.mjs';

const TEST_CONFIG = {
  agentName: 'test-integration-agent',
  agentDescription: 'Integration test agent',
  agentVersion: '1.0.0',
  enabledFlags: {
    agent_card_generation: true,
    agent_card_discovery: true,
    a2a_message_wrapper: true,
    task_state_manager: true,
  },
};

describe('A2A Integration Test Template', () => {
  let endpoint;
  let featureFlags;

  before(() => {
    featureFlags = mockFeatureFlags(TEST_CONFIG.enabledFlags);
    endpoint = createMockA2AEndpoint({
      agentCard: mockAgentCard({
        name: TEST_CONFIG.agentName,
        description: TEST_CONFIG.agentDescription,
        version: TEST_CONFIG.agentVersion,
        capabilities: { streaming: true, push_notifications: true, state_transition_history: true },
        skills: [
          {
            id: 'integration-skill',
            name: 'Integration Testing',
            description: 'Test skill',
            tags: ['testing'],
          },
        ],
      }),
    });
  });

  after(() => {
    endpoint.clear();
  });
  beforeEach(() => {
    endpoint.clear();
  });

  describe('Phase 1: Agent Discovery', () => {
    it('should discover agent via AgentCard endpoint', () => {
      const agentCard = endpoint.getAgentCard();
      assertAgentCardValid(agentCard);
      assert.equal(agentCard.name, TEST_CONFIG.agentName);
    });

    it('should verify agent capabilities', () => {
      const agentCard = endpoint.getAgentCard();
      assert.ok(agentCard.capabilities.streaming);
      assert.ok(agentCard.capabilities.push_notifications);
    });

    it('should list agent skills', () => {
      const agentCard = endpoint.getAgentCard();
      assert.ok(agentCard.skills.length > 0);
    });
  });
  describe('Phase 2: Message Exchange', () => {
    it('should send text message and create task', () => {
      const message = mockTextMessage('Execute test');
      const task = endpoint.sendMessage({ message });
      assert.ok(task.id);
      assertTaskState(task, TaskState.SUBMITTED);
    });

    it('should send data message', () => {
      const payload = { test_suite: 'integration', priority: 1 };
      const message = mockDataMessage(payload);
      const task = endpoint.sendMessage({ message });
      assertTaskState(task, TaskState.SUBMITTED);
      assert.deepEqual(task.messages[0].parts[0].data, payload);
    });

    it('should send multi-part message', () => {
      const message = mockMultiPartMessage([
        { text: 'Process config:' },
        { data: { test_count: 10 } },
      ]);
      const task = endpoint.sendMessage({ message });
      assert.equal(task.messages[0].parts.length, 2);
    });

    it('should continue existing task', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Start') });
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.transitionTask(task.id, TaskState.INPUT_REQUIRED);
      const updated = endpoint.sendMessage({
        message: mockTextMessage('Continue'),
        task_id: task.id,
      });
      assertTaskState(updated, TaskState.WORKING);
      assert.equal(updated.messages.length, 2);
    });
  });

  describe('Phase 3: Task Lifecycle', () => {
    it('should follow happy path: SUBMITTED -> WORKING -> COMPLETED', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Happy path') });
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.transitionTask(task.id, TaskState.COMPLETED, { result: 'success' });
      assertTaskState(endpoint.getTask(task.id), TaskState.COMPLETED);
    });

    it('should handle failure path', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Fail') });
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.transitionTask(task.id, TaskState.FAILED, { failure_reason: 'Test failed' });
      assertTaskState(endpoint.getTask(task.id), TaskState.FAILED);
    });

    it('should handle cancellation', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Cancel') });
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.cancelTask(task.id);
      assertTaskState(endpoint.getTask(task.id), TaskState.CANCELLED);
    });

    it('should handle rejection', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Reject') });
      endpoint.transitionTask(task.id, TaskState.REJECTED, { rejection_reason: 'Not allowed' });
      assertTaskState(endpoint.getTask(task.id), TaskState.REJECTED);
    });

    it('should prevent invalid state transitions', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Invalid') });
      assert.throws(
        () => endpoint.transitionTask(task.id, TaskState.COMPLETED),
        /Invalid transition/
      );
    });

    it('should prevent operations on terminal states', () => {
      const task = endpoint.sendMessage({ message: mockTextMessage('Terminal') });
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.transitionTask(task.id, TaskState.COMPLETED);
      assert.throws(() => endpoint.cancelTask(task.id), /Cannot cancel terminal task/);
    });
  });
  describe('Phase 4: Subscriptions', () => {
    it('should subscribe to task updates', () => {
      const updates = [];
      const task = endpoint.sendMessage({ message: mockTextMessage('Subscribe') });
      const unsubscribe = endpoint.subscribeToTask(task.id, t => updates.push(t.state));
      endpoint.transitionTask(task.id, TaskState.WORKING);
      endpoint.transitionTask(task.id, TaskState.COMPLETED);
      assert.equal(updates.length, 2);
      assert.equal(updates[0], TaskState.WORKING);
      assert.equal(updates[1], TaskState.COMPLETED);
      unsubscribe();
    });

    it('should unsubscribe from task updates', () => {
      const updates = [];
      const task = endpoint.sendMessage({ message: mockTextMessage('Unsub') });
      const unsubscribe = endpoint.subscribeToTask(task.id, t => updates.push(t.state));
      endpoint.transitionTask(task.id, TaskState.WORKING);
      unsubscribe();
      endpoint.transitionTask(task.id, TaskState.COMPLETED);
      assert.equal(updates.length, 1);
    });
  });

  describe('Phase 5: Feature Flags', () => {
    it('should verify required flags are enabled', () => {
      assert.ok(featureFlags.isEnabled('agent_card_generation'));
      assert.ok(featureFlags.isEnabled('task_state_manager'));
    });

    it('should validate flag dependencies', () => {
      const result = featureFlags.validateDependencies('agent_card_discovery');
      assert.ok(result.valid);
    });

    it('should track flag changes in audit log', () => {
      featureFlags.updateFlag('streaming_support', true, 'dev', 'test');
      const log = featureFlags.getAuditLog('streaming_support');
      assert.ok(log.length > 0);
      assert.equal(log[0].action, 'enable');
    });
  });

  describe('Phase 6: Error Handling', () => {
    it('should handle task not found', () => {
      assert.equal(endpoint.getTask('non-existent'), null);
    });

    it('should throw error for operations on non-existent task', () => {
      assert.throws(() => endpoint.cancelTask('non-existent'), /Task not found/);
    });
  });
});

export { TEST_CONFIG };
export default { TEST_CONFIG, description: 'A2A Integration Test Template' };
