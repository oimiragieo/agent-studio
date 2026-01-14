/**
 * A2A Test Utilities
 *
 * Provides comprehensive testing utilities for A2A protocol integration.
 * Follows A2A v0.3.0 specification.
 *
 * @module a2a-test-utils
 */

// ============================================================================
// Constants - A2A Protocol v0.3.0
// ============================================================================

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
 * A2A Message Roles from specification
 */
export const Role = Object.freeze({
  UNSPECIFIED: 'ROLE_UNSPECIFIED',
  USER: 'ROLE_USER',
  AGENT: 'ROLE_AGENT',
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

// ============================================================================
// UUID Generator
// ============================================================================

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// AgentCard Mocking
// ============================================================================

/**
 * Create a mock AgentCard
 * @param {Object} overrides - Field overrides
 * @returns {Object} Mock AgentCard
 */
export function mockAgentCard(overrides = {}) {
  const id = generateUUID();
  return {
    protocol_version: '0.3.0',
    name: overrides.name || 'mock-agent-' + id.slice(0, 8),
    description: overrides.description || 'A mock agent for testing',
    version: overrides.version || '1.0.0',
    url: overrides.url || 'https://mock-agent.example.com',
    supported_interfaces: overrides.supported_interfaces || ['a2a'],
    capabilities: overrides.capabilities || {
      streaming: false,
      push_notifications: false,
      state_transition_history: true,
    },
    default_input_modes: overrides.default_input_modes || ['text'],
    default_output_modes: overrides.default_output_modes || ['text'],
    skills: overrides.skills || [
      {
        id: 'skill-' + id.slice(0, 8),
        name: 'Mock Skill',
        description: 'A mock skill for testing',
        tags: ['mock', 'test'],
        examples: ['Example usage'],
      },
    ],
    ...overrides,
  };
}

/**
 * Create an AgentCard from an agent definition file
 * @param {Object} agentDef - Agent definition object
 * @returns {Object} AgentCard
 */
export function mockAgentCardFromDefinition(agentDef) {
  return mockAgentCard({
    name: agentDef.name || 'unknown-agent',
    description: agentDef.goal || agentDef.description || 'No description',
    version: agentDef.version || '1.0.0',
    skills: (agentDef.skills || []).map((skill, idx) => ({
      id: 'skill-' + idx,
      name: typeof skill === 'string' ? skill : skill.name,
      description: typeof skill === 'string' ? skill : skill.description || '',
      tags: typeof skill === 'object' ? skill.tags || [] : [],
    })),
    capabilities: {
      streaming: agentDef.capabilities?.streaming || false,
      push_notifications: agentDef.capabilities?.push_notifications || false,
      state_transition_history: true,
    },
  });
}

// ============================================================================
// Message Mocking
// ============================================================================

/**
 * Create a mock A2A Message
 * @param {Object} overrides - Field overrides
 * @returns {Object} Mock Message
 */
export function mockMessage(overrides = {}) {
  return {
    role: overrides.role || Role.USER,
    parts: overrides.parts || [{ text: 'Hello, agent!' }],
    metadata: overrides.metadata || {},
    ...overrides,
  };
}

/**
 * Create a text message
 * @param {string} text - Message text
 * @param {string} role - Message role
 * @returns {Object} Text message
 */
export function mockTextMessage(text, role = Role.USER) {
  return mockMessage({
    role,
    parts: [{ text }],
  });
}

/**
 * Create a file message
 * @param {string} name - File name
 * @param {string} mimeType - MIME type
 * @param {string} uri - File URI (optional)
 * @param {string} bytes - Base64 bytes (optional)
 * @param {string} role - Message role
 * @returns {Object} File message
 */
export function mockFileMessage(name, mimeType, uri = null, bytes = null, role = Role.USER) {
  const filePart = {
    file: {
      name,
      mime_type: mimeType,
    },
  };
  if (uri) filePart.file.uri = uri;
  if (bytes) filePart.file.bytes = bytes;

  return mockMessage({
    role,
    parts: [filePart],
  });
}

/**
 * Create a data message
 * @param {Object} data - JSON data
 * @param {string} role - Message role
 * @returns {Object} Data message
 */
export function mockDataMessage(data, role = Role.USER) {
  return mockMessage({
    role,
    parts: [{ data }],
  });
}

/**
 * Create a multi-part message
 * @param {Array} parts - Message parts
 * @param {string} role - Message role
 * @returns {Object} Multi-part message
 */
export function mockMultiPartMessage(parts, role = Role.USER) {
  return mockMessage({ role, parts });
}

// ============================================================================
// Task Mocking
// ============================================================================

/**
 * Create a mock A2A Task
 * @param {Object} overrides - Field overrides
 * @returns {Object} Mock Task
 */
export function mockTask(overrides = {}) {
  const id = 'task-' + generateUUID();
  return {
    id: overrides.id || id,
    session_id: overrides.session_id || 'session-' + generateUUID(),
    state: overrides.state || TaskState.SUBMITTED,
    messages: overrides.messages || [],
    artifacts: overrides.artifacts || [],
    metadata: overrides.metadata || {},
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a submitted task
 */
export function mockSubmittedTask(overrides = {}) {
  return mockTask({ ...overrides, state: TaskState.SUBMITTED });
}

/**
 * Create a working task
 */
export function mockWorkingTask(overrides = {}) {
  return mockTask({ ...overrides, state: TaskState.WORKING });
}

/**
 * Create a completed task
 */
export function mockCompletedTask(overrides = {}) {
  return mockTask({ ...overrides, state: TaskState.COMPLETED });
}

/**
 * Create a failed task
 */
export function mockFailedTask(reason = 'Task failed', overrides = {}) {
  return mockTask({
    ...overrides,
    state: TaskState.FAILED,
    metadata: { ...overrides.metadata, failure_reason: reason },
  });
}

/**
 * Create a cancelled task
 */
export function mockCancelledTask(overrides = {}) {
  return mockTask({ ...overrides, state: TaskState.CANCELLED });
}

/**
 * Create a rejected task
 */
export function mockRejectedTask(reason = 'Task rejected', overrides = {}) {
  return mockTask({
    ...overrides,
    state: TaskState.REJECTED,
    metadata: { ...overrides.metadata, rejection_reason: reason },
  });
}

/**
 * Create an input-required task
 */
export function mockInputRequiredTask(prompt = 'Please provide input', overrides = {}) {
  return mockTask({
    ...overrides,
    state: TaskState.INPUT_REQUIRED,
    metadata: { ...overrides.metadata, input_prompt: prompt },
  });
}

/**
 * Create an auth-required task
 */
export function mockAuthRequiredTask(overrides = {}) {
  return mockTask({ ...overrides, state: TaskState.AUTH_REQUIRED });
}

// ============================================================================
// Mock A2A Endpoint
// ============================================================================

/**
 * Create a mock A2A endpoint for testing
 * @param {Object} options - Endpoint options
 * @returns {Object} Mock endpoint with methods
 */
export function createMockA2AEndpoint(options = {}) {
  const tasks = new Map();
  const subscriptions = new Map();
  const agentCard = options.agentCard || mockAgentCard();

  return {
    agentCard,
    tasks,
    subscriptions,

    getAgentCard() {
      return agentCard;
    },

    sendMessage(request) {
      const { message, task_id, session_id } = request;

      let task;
      if (task_id && tasks.has(task_id)) {
        task = tasks.get(task_id);
        task.messages.push(message);
        task.updated_at = new Date().toISOString();

        if (task.state === TaskState.INPUT_REQUIRED || task.state === TaskState.AUTH_REQUIRED) {
          task.state = TaskState.WORKING;
        }
      } else {
        task = mockTask({
          session_id: session_id || 'session-' + generateUUID(),
          messages: [message],
          state: TaskState.SUBMITTED,
        });
        tasks.set(task.id, task);
      }

      if (subscriptions.has(task.id)) {
        subscriptions.get(task.id).forEach(cb => cb(task));
      }

      return task;
    },

    getTask(taskId) {
      return tasks.get(taskId) || null;
    },

    listTasks(filters = {}) {
      let result = Array.from(tasks.values());

      if (filters.session_id) {
        result = result.filter(t => t.session_id === filters.session_id);
      }
      if (filters.state) {
        result = result.filter(t => t.state === filters.state);
      }
      if (filters.limit) {
        result = result.slice(0, filters.limit);
      }

      return result;
    },

    cancelTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found: ' + taskId);
      }
      if (TERMINAL_STATES.includes(task.state)) {
        throw new Error('Cannot cancel terminal task');
      }

      task.state = TaskState.CANCELLED;
      task.updated_at = new Date().toISOString();

      if (subscriptions.has(taskId)) {
        subscriptions.get(taskId).forEach(cb => cb(task));
      }

      return task;
    },

    subscribeToTask(taskId, callback) {
      if (!subscriptions.has(taskId)) {
        subscriptions.set(taskId, []);
      }
      subscriptions.get(taskId).push(callback);

      return () => {
        const subs = subscriptions.get(taskId);
        const idx = subs.indexOf(callback);
        if (idx > -1) subs.splice(idx, 1);
      };
    },

    transitionTask(taskId, newState, metadata = {}) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found: ' + taskId);
      }

      const validNext = VALID_TRANSITIONS[task.state] || [];
      if (!validNext.includes(newState)) {
        throw new Error('Invalid transition: ' + task.state + ' -> ' + newState);
      }

      task.state = newState;
      task.metadata = { ...task.metadata, ...metadata };
      task.updated_at = new Date().toISOString();

      if (subscriptions.has(taskId)) {
        subscriptions.get(taskId).forEach(cb => cb(task));
      }

      return task;
    },

    addArtifact(taskId, artifact) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error('Task not found: ' + taskId);
      }

      task.artifacts.push(artifact);
      task.updated_at = new Date().toISOString();

      return task;
    },

    clear() {
      tasks.clear();
      subscriptions.clear();
    },
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate an AgentCard structure
 */
export function validateA2AAgentCard(card) {
  const errors = [];

  if (!card) {
    return { valid: false, errors: ['AgentCard is null or undefined'] };
  }

  const required = [
    'protocol_version',
    'name',
    'description',
    'version',
    'supported_interfaces',
    'capabilities',
    'default_input_modes',
    'default_output_modes',
    'skills',
  ];

  for (const field of required) {
    if (card[field] === undefined || card[field] === null) {
      errors.push('Missing required field: ' + field);
    }
  }

  if (card.supported_interfaces && !Array.isArray(card.supported_interfaces)) {
    errors.push('supported_interfaces must be an array');
  }
  if (card.skills && !Array.isArray(card.skills)) {
    errors.push('skills must be an array');
  }
  if (card.capabilities && typeof card.capabilities !== 'object') {
    errors.push('capabilities must be an object');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an A2A Message structure
 */
export function validateA2AMessage(message) {
  const errors = [];

  if (!message) {
    return { valid: false, errors: ['Message is null or undefined'] };
  }

  if (!message.role) {
    errors.push('Missing required field: role');
  } else if (!Object.values(Role).includes(message.role)) {
    errors.push('Invalid role: ' + message.role);
  }

  if (!message.parts) {
    errors.push('Missing required field: parts');
  } else if (!Array.isArray(message.parts)) {
    errors.push('parts must be an array');
  } else if (message.parts.length === 0) {
    errors.push('parts must have at least one element');
  } else {
    for (let i = 0; i < message.parts.length; i++) {
      const part = message.parts[i];
      const hasText = 'text' in part;
      const hasFile = 'file' in part;
      const hasData = 'data' in part;

      if (!hasText && !hasFile && !hasData) {
        errors.push('Part ' + i + ' must have text, file, or data');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an A2A Task structure
 */
export function validateA2ATask(task) {
  const errors = [];

  if (!task) {
    return { valid: false, errors: ['Task is null or undefined'] };
  }

  if (!task.id) {
    errors.push('Missing required field: id');
  }

  if (!task.state) {
    errors.push('Missing required field: state');
  } else if (!Object.values(TaskState).includes(task.state)) {
    errors.push('Invalid state: ' + task.state);
  }

  if (task.messages && !Array.isArray(task.messages)) {
    errors.push('messages must be an array');
  }

  if (task.artifacts && !Array.isArray(task.artifacts)) {
    errors.push('artifacts must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate any A2A schema object
 */
export function validateA2ASchema(type, obj) {
  switch (type) {
    case 'agentCard':
      return validateA2AAgentCard(obj);
    case 'message':
      return validateA2AMessage(obj);
    case 'task':
      return validateA2ATask(obj);
    default:
      return { valid: false, errors: ['Unknown type: ' + type] };
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert AgentCard is valid
 */
export function assertAgentCardValid(card) {
  const result = validateA2AAgentCard(card);
  if (!result.valid) {
    throw new Error('Invalid AgentCard: ' + result.errors.join(', '));
  }
}

/**
 * Assert Message is valid
 */
export function assertMessageValid(message) {
  const result = validateA2AMessage(message);
  if (!result.valid) {
    throw new Error('Invalid Message: ' + result.errors.join(', '));
  }
}

/**
 * Assert Task is valid
 */
export function assertTaskValid(task) {
  const result = validateA2ATask(task);
  if (!result.valid) {
    throw new Error('Invalid Task: ' + result.errors.join(', '));
  }
}

/**
 * Assert task is in expected state
 */
export function assertTaskState(task, expectedState) {
  if (task.state !== expectedState) {
    throw new Error('Expected task state ' + expectedState + ', got ' + task.state);
  }
}

/**
 * Assert state transition is valid
 */
export function assertValidTransition(fromState, toState) {
  const valid = VALID_TRANSITIONS[fromState] || [];
  if (!valid.includes(toState)) {
    throw new Error('Invalid transition: ' + fromState + ' -> ' + toState);
  }
}

/**
 * Assert task is in terminal state
 */
export function assertTaskTerminal(task) {
  if (!TERMINAL_STATES.includes(task.state)) {
    throw new Error('Expected terminal state, got ' + task.state);
  }
}

/**
 * Assert task is not in terminal state
 */
export function assertTaskNotTerminal(task) {
  if (TERMINAL_STATES.includes(task.state)) {
    throw new Error('Expected non-terminal state, got ' + task.state);
  }
}

// ============================================================================
// Feature Flags Mocking
// ============================================================================

/**
 * Create a mock feature flags manager
 */
export function mockFeatureFlags(flagOverrides = {}) {
  const defaultFlags = {
    agent_card_generation: false,
    agent_card_discovery: false,
    memory_a2a_bridge: false,
    a2a_message_wrapper: false,
    task_state_manager: false,
    push_notifications: false,
    streaming_support: false,
    external_federation: false,
  };

  const flags = { ...defaultFlags, ...flagOverrides };
  const auditLog = [];

  return {
    isEnabled(flagName, env = 'dev') {
      return flags[flagName] || false;
    },

    getFlags(env = 'dev') {
      return { ...flags };
    },

    validateDependencies(flagName, env = 'dev') {
      const deps = {
        agent_card_discovery: ['agent_card_generation'],
        memory_a2a_bridge: ['agent_card_generation'],
        a2a_message_wrapper: ['agent_card_generation'],
        task_state_manager: ['a2a_message_wrapper'],
        push_notifications: ['task_state_manager'],
        streaming_support: ['a2a_message_wrapper', 'task_state_manager'],
        external_federation: ['agent_card_discovery', 'a2a_message_wrapper', 'task_state_manager'],
      };

      const flagDeps = deps[flagName] || [];
      const missing = flagDeps.filter(d => !flags[d]);

      return { valid: missing.length === 0, missingDependencies: missing };
    },

    getFlagDetails(flagName) {
      return {
        enabled: flags[flagName] || false,
        phase: 'test',
        dependencies: [],
      };
    },

    updateFlag(flagName, enabled, env = null, user = 'test') {
      flags[flagName] = enabled;
      auditLog.push({
        timestamp: new Date().toISOString(),
        flag: flagName,
        action: enabled ? 'enable' : 'disable',
        user,
        env: env || 'global',
      });
    },

    getAuditLog(flagName = null) {
      if (flagName) {
        return auditLog.filter(e => e.flag === flagName);
      }
      return [...auditLog];
    },

    _setFlag(flagName, value) {
      flags[flagName] = value;
    },

    _reset() {
      Object.keys(flags).forEach(k => (flags[k] = defaultFlags[k] || false));
      auditLog.length = 0;
    },
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

/**
 * Wait for a task to reach a specific state
 */
export async function waitForTaskState(endpoint, taskId, state, timeout = 5000) {
  const success = await waitFor(() => {
    const task = endpoint.getTask(taskId);
    return task && task.state === state;
  }, timeout);

  return success ? endpoint.getTask(taskId) : null;
}

/**
 * Wait for a task to complete (reach terminal state)
 */
export async function waitForTaskCompletion(endpoint, taskId, timeout = 5000) {
  const success = await waitFor(() => {
    const task = endpoint.getTask(taskId);
    return task && TERMINAL_STATES.includes(task.state);
  }, timeout);

  return success ? endpoint.getTask(taskId) : null;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Constants
  TaskState,
  Role,
  TERMINAL_STATES,
  VALID_TRANSITIONS,

  // UUID
  generateUUID,

  // AgentCard
  mockAgentCard,
  mockAgentCardFromDefinition,

  // Message
  mockMessage,
  mockTextMessage,
  mockFileMessage,
  mockDataMessage,
  mockMultiPartMessage,

  // Task
  mockTask,
  mockSubmittedTask,
  mockWorkingTask,
  mockCompletedTask,
  mockFailedTask,
  mockCancelledTask,
  mockRejectedTask,
  mockInputRequiredTask,
  mockAuthRequiredTask,

  // Endpoint
  createMockA2AEndpoint,

  // Validation
  validateA2AAgentCard,
  validateA2AMessage,
  validateA2ATask,
  validateA2ASchema,

  // Assertions
  assertAgentCardValid,
  assertMessageValid,
  assertTaskValid,
  assertTaskState,
  assertValidTransition,
  assertTaskTerminal,
  assertTaskNotTerminal,

  // Feature Flags
  mockFeatureFlags,

  // Helpers
  waitFor,
  waitForTaskState,
  waitForTaskCompletion,
};
