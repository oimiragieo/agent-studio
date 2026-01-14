/**
 * A2A Test Framework Validation Tests
 *
 * Validates the A2A test utilities and fixtures meet requirements.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskState,
  Role,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  generateUUID,
  mockAgentCard,
  mockAgentCardFromDefinition,
  mockMessage,
  mockTextMessage,
  mockFileMessage,
  mockDataMessage,
  mockMultiPartMessage,
  mockTask,
  mockSubmittedTask,
  mockWorkingTask,
  mockCompletedTask,
  mockFailedTask,
  mockCancelledTask,
  mockRejectedTask,
  mockInputRequiredTask,
  mockAuthRequiredTask,
  createMockA2AEndpoint,
  validateA2AAgentCard,
  validateA2AMessage,
  validateA2ATask,
  validateA2ASchema,
  assertAgentCardValid,
  assertMessageValid,
  assertTaskValid,
  assertTaskState,
  assertValidTransition,
  assertTaskTerminal,
  assertTaskNotTerminal,
  mockFeatureFlags,
  waitFor,
  waitForTaskState,
  waitForTaskCompletion,
} from './test-utils.mjs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fixtures = require('./test-fixtures.json');

describe('A2A Constants', () => {
  it('should define all 9 task states', () => {
    assert.equal(Object.keys(TaskState).length, 9);
  });

  it('should define all 3 message roles', () => {
    assert.equal(Object.keys(Role).length, 3);
  });

  it('should define 4 terminal states', () => {
    assert.equal(TERMINAL_STATES.length, 4);
  });

  it('should define valid transitions for non-terminal states', () => {
    assert.ok(VALID_TRANSITIONS[TaskState.SUBMITTED].length > 0);
    assert.ok(VALID_TRANSITIONS[TaskState.WORKING].length > 0);
  });

  it('should define no transitions for terminal states', () => {
    assert.equal(VALID_TRANSITIONS[TaskState.COMPLETED].length, 0);
    assert.equal(VALID_TRANSITIONS[TaskState.FAILED].length, 0);
  });
});

describe('UUID Generation', () => {
  it('should generate valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.ok(uuidRegex.test(uuid));
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    assert.equal(uuids.size, 100);
  });
});
describe('AgentCard Mocking', () => {
  it('should create valid mock AgentCard with defaults', () => {
    const card = mockAgentCard();
    assertAgentCardValid(card);
    assert.equal(card.protocol_version, '0.3.0');
  });

  it('should allow overriding AgentCard fields', () => {
    const card = mockAgentCard({ name: 'custom-agent', version: '2.0.0' });
    assert.equal(card.name, 'custom-agent');
    assert.equal(card.version, '2.0.0');
  });

  it('should create AgentCard from agent definition', () => {
    const agentDef = { name: 'test-agent', goal: 'Test goal', skills: ['skill1'] };
    const card = mockAgentCardFromDefinition(agentDef);
    assertAgentCardValid(card);
    assert.equal(card.name, 'test-agent');
  });
});

describe('Message Mocking', () => {
  it('should create valid text message', () => {
    const msg = mockTextMessage('Hello, world!');
    assertMessageValid(msg);
    assert.equal(msg.role, Role.USER);
  });

  it('should create valid file message', () => {
    const msg = mockFileMessage('test.pdf', 'application/pdf', 'gs://bucket/test.pdf');
    assertMessageValid(msg);
    assert.equal(msg.parts[0].file.name, 'test.pdf');
  });

  it('should create valid data message', () => {
    const msg = mockDataMessage({ key: 'value' });
    assertMessageValid(msg);
    assert.deepEqual(msg.parts[0].data, { key: 'value' });
  });

  it('should create valid multi-part message', () => {
    const msg = mockMultiPartMessage([
      { text: 'Check:' },
      { file: { name: 'data.json', mime_type: 'application/json' } },
    ]);
    assertMessageValid(msg);
    assert.equal(msg.parts.length, 2);
  });

  it('should support agent role messages', () => {
    const msg = mockTextMessage('Response', Role.AGENT);
    assert.equal(msg.role, Role.AGENT);
  });
});

describe('Task Mocking', () => {
  it('should create task for each state', () => {
    assert.equal(mockSubmittedTask().state, TaskState.SUBMITTED);
    assert.equal(mockWorkingTask().state, TaskState.WORKING);
    assert.equal(mockCompletedTask().state, TaskState.COMPLETED);
    assert.equal(mockFailedTask('Error').state, TaskState.FAILED);
    assert.equal(mockCancelledTask().state, TaskState.CANCELLED);
    assert.equal(mockRejectedTask('No').state, TaskState.REJECTED);
    assert.equal(mockInputRequiredTask('Enter').state, TaskState.INPUT_REQUIRED);
    assert.equal(mockAuthRequiredTask().state, TaskState.AUTH_REQUIRED);
  });

  it('should include failure reason in failed task', () => {
    const task = mockFailedTask('Connection timeout');
    assert.equal(task.metadata.failure_reason, 'Connection timeout');
  });

  it('should include input prompt in input-required task', () => {
    const task = mockInputRequiredTask('Enter API key');
    assert.equal(task.metadata.input_prompt, 'Enter API key');
  });
});
describe('Mock A2A Endpoint', () => {
  let endpoint;
  before(() => {
    endpoint = createMockA2AEndpoint();
  });
  after(() => {
    endpoint.clear();
  });

  it('should return agent card', () => {
    assertAgentCardValid(endpoint.getAgentCard());
  });

  it('should create task on sendMessage', () => {
    const task = endpoint.sendMessage({ message: mockTextMessage('Test') });
    assert.ok(task.id);
    assert.equal(task.state, TaskState.SUBMITTED);
  });

  it('should get task by ID', () => {
    const created = endpoint.sendMessage({ message: mockTextMessage('Another') });
    assert.deepEqual(endpoint.getTask(created.id), created);
  });

  it('should list tasks with filters', () => {
    endpoint.clear();
    const task1 = endpoint.sendMessage({ message: mockTextMessage('T1'), session_id: 'session-a' });
    endpoint.sendMessage({ message: mockTextMessage('T2'), session_id: 'session-b' });
    const filtered = endpoint.listTasks({ session_id: 'session-a' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, task1.id);
  });

  it('should cancel non-terminal task', () => {
    endpoint.clear();
    const task = endpoint.sendMessage({ message: mockTextMessage('Cancel me') });
    assert.equal(endpoint.cancelTask(task.id).state, TaskState.CANCELLED);
  });

  it('should reject cancelling terminal task', () => {
    endpoint.clear();
    const task = endpoint.sendMessage({ message: mockTextMessage('Terminal') });
    endpoint.transitionTask(task.id, TaskState.WORKING);
    endpoint.transitionTask(task.id, TaskState.COMPLETED);
    assert.throws(() => endpoint.cancelTask(task.id), /Cannot cancel terminal task/);
  });

  it('should transition task through valid states', () => {
    endpoint.clear();
    const task = endpoint.sendMessage({ message: mockTextMessage('Workflow') });
    endpoint.transitionTask(task.id, TaskState.WORKING);
    assert.equal(endpoint.getTask(task.id).state, TaskState.WORKING);
    endpoint.transitionTask(task.id, TaskState.COMPLETED);
    assert.equal(endpoint.getTask(task.id).state, TaskState.COMPLETED);
  });

  it('should reject invalid state transitions', () => {
    endpoint.clear();
    const task = endpoint.sendMessage({ message: mockTextMessage('Invalid') });
    assert.throws(
      () => endpoint.transitionTask(task.id, TaskState.COMPLETED),
      /Invalid transition/
    );
  });
});
describe('Validation Functions', () => {
  it('should validate correct AgentCard', () => {
    const result = validateA2AAgentCard(mockAgentCard());
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('should detect missing AgentCard fields', () => {
    const result = validateA2AAgentCard({ name: 'test' });
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
  });

  it('should validate correct Message', () => {
    assert.ok(validateA2AMessage(mockTextMessage('Valid')).valid);
  });

  it('should detect invalid Message role', () => {
    assert.ok(!validateA2AMessage({ role: 'INVALID', parts: [{ text: 'test' }] }).valid);
  });

  it('should validate correct Task', () => {
    assert.ok(validateA2ATask(mockSubmittedTask()).valid);
  });

  it('should detect invalid Task state', () => {
    assert.ok(!validateA2ATask({ id: 'test', state: 'INVALID' }).valid);
  });

  it('should use validateA2ASchema for type dispatch', () => {
    assert.ok(validateA2ASchema('agentCard', mockAgentCard()).valid);
    assert.ok(validateA2ASchema('message', mockTextMessage('test')).valid);
    assert.ok(validateA2ASchema('task', mockSubmittedTask()).valid);
    assert.ok(!validateA2ASchema('unknown', {}).valid);
  });
});

describe('Assertion Helpers', () => {
  it('should pass for valid AgentCard', () => {
    assert.doesNotThrow(() => assertAgentCardValid(mockAgentCard()));
  });

  it('should throw for invalid AgentCard', () => {
    assert.throws(() => assertAgentCardValid({}), /Invalid AgentCard/);
  });

  it('should pass for valid Message', () => {
    assert.doesNotThrow(() => assertMessageValid(mockTextMessage('test')));
  });

  it('should pass for valid Task', () => {
    assert.doesNotThrow(() => assertTaskValid(mockSubmittedTask()));
  });

  it('should assert correct task state', () => {
    const task = mockWorkingTask();
    assert.doesNotThrow(() => assertTaskState(task, TaskState.WORKING));
    assert.throws(() => assertTaskState(task, TaskState.COMPLETED));
  });

  it('should assert valid transition', () => {
    assert.doesNotThrow(() => assertValidTransition(TaskState.SUBMITTED, TaskState.WORKING));
    assert.throws(() => assertValidTransition(TaskState.SUBMITTED, TaskState.COMPLETED));
  });

  it('should assert terminal state', () => {
    assert.doesNotThrow(() => assertTaskTerminal(mockCompletedTask()));
    assert.throws(() => assertTaskTerminal(mockWorkingTask()));
  });

  it('should assert non-terminal state', () => {
    assert.doesNotThrow(() => assertTaskNotTerminal(mockWorkingTask()));
    assert.throws(() => assertTaskNotTerminal(mockCompletedTask()));
  });
});
describe('Feature Flags Mocking', () => {
  it('should create mock with default flags disabled', () => {
    const flags = mockFeatureFlags();
    assert.equal(flags.isEnabled('agent_card_generation'), false);
    assert.equal(flags.isEnabled('external_federation'), false);
  });

  it('should allow enabling flags via overrides', () => {
    const flags = mockFeatureFlags({ agent_card_generation: true });
    assert.equal(flags.isEnabled('agent_card_generation'), true);
  });

  it('should validate dependencies', () => {
    const flags = mockFeatureFlags({ agent_card_generation: true });
    assert.ok(flags.validateDependencies('agent_card_discovery').valid);
    const flags2 = mockFeatureFlags();
    assert.ok(!flags2.validateDependencies('agent_card_discovery').valid);
  });

  it('should track flag updates in audit log', () => {
    const flags = mockFeatureFlags();
    flags.updateFlag('agent_card_generation', true, null, 'test-user');
    const log = flags.getAuditLog('agent_card_generation');
    assert.equal(log.length, 1);
    assert.equal(log[0].action, 'enable');
  });
});

describe('Test Fixtures Validation', () => {
  it('should have at least 5 agent cards', () => {
    assert.ok(fixtures.agentCards.length >= 5);
  });

  it('should have at least 10 messages', () => {
    assert.ok(fixtures.messages.length >= 10);
  });

  it('should have exactly 8 tasks (one per state)', () => {
    assert.equal(fixtures.tasks.length, 8);
  });

  it('should have tasks covering all states', () => {
    const states = new Set(fixtures.tasks.map(t => t.state));
    assert.ok(states.has('TASK_STATE_SUBMITTED'));
    assert.ok(states.has('TASK_STATE_WORKING'));
    assert.ok(states.has('TASK_STATE_COMPLETED'));
    assert.ok(states.has('TASK_STATE_FAILED'));
    assert.ok(states.has('TASK_STATE_CANCELLED'));
    assert.ok(states.has('TASK_STATE_REJECTED'));
    assert.ok(states.has('TASK_STATE_INPUT_REQUIRED'));
    assert.ok(states.has('TASK_STATE_AUTH_REQUIRED'));
  });

  it('should have valid agent cards in fixtures', () => {
    for (const card of fixtures.agentCards) {
      assert.ok(validateA2AAgentCard(card).valid);
    }
  });

  it('should have valid messages in fixtures', () => {
    for (const msg of fixtures.messages) {
      assert.ok(validateA2AMessage(msg).valid);
    }
  });

  it('should have valid tasks in fixtures', () => {
    for (const task of fixtures.tasks) {
      assert.ok(validateA2ATask(task).valid);
    }
  });

  it('should have valid state transitions defined', () => {
    assert.ok(fixtures.stateTransitions.valid.length >= 10);
    assert.ok(fixtures.stateTransitions.invalid.length >= 4);
  });
});

describe('Utility Export Validation', () => {
  it('should export at least 7 utilities', () => {
    const exports = [
      createMockA2AEndpoint,
      mockAgentCard,
      mockMessage,
      mockTask,
      validateA2ASchema,
      assertAgentCardValid,
      mockFeatureFlags,
    ];
    assert.ok(exports.every(e => typeof e === 'function'));
  });
});
