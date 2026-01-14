/**
 * Federation Manager Tests
 *
 * Integration tests for external agent federation, task execution, and coordination.
 *
 * Coverage:
 * - End-to-end external task execution
 * - Federated agent discovery and selection
 * - Streaming and push notification integration
 * - Error handling and recovery
 * - Federation statistics
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  FederationManager,
  createFederationManager,
  getFederationManager,
  resetInstance,
} from './federation-manager.mjs';
import {
  mockAgentCard,
  mockMessage,
  mockTask,
  mockFeatureFlags,
  TaskState,
} from './test-utils.mjs';

// Mock fetch globally
const originalFetch = global.fetch;
let fetchMock = null;

function setupFetchMock() {
  fetchMock = {
    calls: [],
    responses: new Map(),
  };

  global.fetch = async (url, options) => {
    fetchMock.calls.push({ url, options });

    const response = fetchMock.responses.get(url);
    if (!response) {
      // Default response
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      };
    }

    return response;
  };
}

function teardownFetchMock() {
  global.fetch = originalFetch;
  fetchMock = null;
}

describe('FederationManager', () => {
  let manager;
  let flags;

  beforeEach(() => {
    setupFetchMock();
    flags = mockFeatureFlags({
      external_federation: true,
      streaming_support: true,
      push_notifications: true,
    });
    manager = createFederationManager({ featureFlags: flags });
  });

  afterEach(() => {
    teardownFetchMock();
    resetInstance();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const m = new FederationManager();
      assert.ok(m instanceof FederationManager);
      assert.ok(m.discovery);
      assert.ok(m.pushHandler);
      assert.ok(m.streamingHandler);
    });

    it('should accept custom component instances', () => {
      const customDiscovery = { test: 'discovery' };
      const m = new FederationManager({ discovery: customDiscovery });
      assert.strictEqual(m.discovery, customDiscovery);
    });
  });

  describe('isFederationEnabled()', () => {
    it('should return true when enabled', () => {
      assert.equal(manager.isFederationEnabled(), true);
    });

    it('should return false when disabled', () => {
      manager.featureFlags.external_federation = false;
      assert.equal(manager.isFederationEnabled(), false);
    });
  });

  describe('executeExternalTask()', () => {
    it('should execute task on external agent', async () => {
      const agentUrl = 'https://external-agent.com';
      const agentCard = mockAgentCard({
        name: 'external-agent',
        capabilities: {
          streaming: false,
          push_notifications: false,
        },
      });

      const task = mockTask({ id: 'task-123', state: TaskState.SUBMITTED });
      const message = mockMessage();

      // Mock AgentCard discovery
      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      // Mock SendMessage response
      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task }),
      });

      const result = await manager.executeExternalTask(agentUrl, message);

      assert.equal(result.id, 'task-123');
      assert.ok(fetchMock.calls.some(c => c.url.includes('agent-card.json')));
      assert.ok(fetchMock.calls.some(c => c.url.includes('sendMessage')));
    });

    it('should throw when federation disabled', async () => {
      manager.featureFlags.external_federation = false;

      await assert.rejects(
        async () => {
          await manager.executeExternalTask('https://test.com', mockMessage());
        },
        { message: /external_federation feature flag is disabled/ }
      );
    });

    it('should throw when agent does not support A2A', async () => {
      const agentUrl = 'https://non-a2a.com';
      const agentCard = mockAgentCard({
        supported_interfaces: ['other-protocol'],
      });

      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      await assert.rejects(
        async () => {
          await manager.executeExternalTask(agentUrl, mockMessage());
        },
        { message: /does not support A2A interface/ }
      );
    });

    it('should set up streaming when supported', async () => {
      const agentUrl = 'https://streaming-agent.com';
      const agentCard = mockAgentCard({
        capabilities: {
          streaming: true,
          push_notifications: false,
        },
      });

      const task = mockTask();

      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task }),
      });

      await manager.executeExternalTask(agentUrl, mockMessage());

      const federatedTask = manager.getFederatedTask(task.id);
      assert.equal(federatedTask.capabilities_used.streaming, true);
    });

    it('should set up push notifications when supported and callback provided', async () => {
      const agentUrl = 'https://push-agent.com';
      const agentCard = mockAgentCard({
        capabilities: {
          streaming: false,
          push_notifications: true,
        },
      });

      const task = mockTask();

      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task }),
      });

      fetchMock.responses.set(`${agentUrl}/subscribeToTask`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ subscribed: true }),
      });

      await manager.executeExternalTask(agentUrl, mockMessage(), {
        callbackUrl: 'https://callback.com/webhook',
      });

      const federatedTask = manager.getFederatedTask(task.id);
      assert.equal(federatedTask.capabilities_used.push_notifications, true);
    });

    it('should track federated tasks', async () => {
      const agentUrl = 'https://tracking-agent.com';
      const agentCard = mockAgentCard({
        name: 'tracking-agent',
        capabilities: {
          streaming: false,
          push_notifications: false,
        },
      });

      const task = mockTask({ id: 'tracked-task' });

      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task }),
      });

      await manager.executeExternalTask(agentUrl, mockMessage());

      const tracked = manager.getFederatedTask('tracked-task');
      assert.ok(tracked);
      assert.equal(tracked.task_id, 'tracked-task');
      assert.equal(tracked.agent_url, agentUrl);
      assert.equal(tracked.agent_name, 'tracking-agent');
    });
  });

  describe('sendMessageToExternalAgent()', () => {
    it('should send message to external agent', async () => {
      const agentUrl = 'https://external.com';
      const agentCard = mockAgentCard({ url: agentUrl });
      const message = mockMessage();
      const task = mockTask();

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task }),
      });

      const result = await manager.sendMessageToExternalAgent(agentUrl, agentCard, message);

      assert.equal(result.id, task.id);

      const call = fetchMock.calls.find(c => c.url.includes('sendMessage'));
      assert.ok(call);
      assert.equal(call.options.method, 'POST');
    });

    it('should throw when external agent returns error', async () => {
      const agentUrl = 'https://error.com';
      const agentCard = mockAgentCard({ url: agentUrl });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await assert.rejects(
        async () => {
          await manager.sendMessageToExternalAgent(agentUrl, agentCard, mockMessage());
        },
        { message: /External agent returned HTTP 500/ }
      );
    });

    it('should throw when response invalid', async () => {
      const agentUrl = 'https://invalid.com';
      const agentCard = mockAgentCard({ url: agentUrl });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ invalid: 'response' }), // No task
      });

      await assert.rejects(
        async () => {
          await manager.sendMessageToExternalAgent(agentUrl, agentCard, mockMessage());
        },
        { message: /Invalid task response/ }
      );
    });
  });

  describe('getFederatedAgents()', () => {
    it('should list federated agents', async () => {
      const agentUrls = ['https://a1.com', 'https://a2.com'];

      for (const url of agentUrls) {
        const agentCard = mockAgentCard({ name: `agent-${url}` });

        fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => agentCard,
        });

        await manager.discovery.discoverAgent(url);
      }

      const agents = manager.getFederatedAgents();
      assert.equal(agents.length, 2);
    });

    it('should filter agents by capability', async () => {
      const agentCard = mockAgentCard({
        capabilities: { streaming: true, push_notifications: false },
      });

      const url = 'https://streaming.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      await manager.discovery.discoverAgent(url);

      const agents = manager.getFederatedAgents({ capability: 'streaming' });
      assert.equal(agents.length, 1);
    });
  });

  describe('listFederatedTasks()', () => {
    beforeEach(async () => {
      // Create federated tasks
      for (let i = 1; i <= 3; i++) {
        const agentUrl = `https://agent-${i}.com`;
        const agentCard = mockAgentCard({
          name: `agent-${i}`,
          capabilities: { streaming: false, push_notifications: false },
        });

        const task = mockTask({ id: `task-${i}` });

        fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => agentCard,
        });

        fetchMock.responses.set(`${agentUrl}/sendMessage`, {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ task }),
        });

        await manager.executeExternalTask(agentUrl, mockMessage());
      }
    });

    it('should list all federated tasks', () => {
      const tasks = manager.listFederatedTasks();
      assert.equal(tasks.length, 3);
    });

    it('should filter by agent URL', () => {
      const tasks = manager.listFederatedTasks({
        agent_url: 'https://agent-1.com',
      });

      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].task_id, 'task-1');
    });

    it('should apply limit', () => {
      const tasks = manager.listFederatedTasks({ limit: 2 });
      assert.equal(tasks.length, 2);
    });
  });

  describe('getFederationStats()', () => {
    it('should return federation statistics', async () => {
      // Discover agent
      const agentCard = mockAgentCard({ capabilities: { streaming: true } });
      const url = 'https://stats-agent.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      fetchMock.responses.set(`${url}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task: mockTask() }),
      });

      await manager.executeExternalTask(url, mockMessage());

      const stats = manager.getFederationStats();

      assert.ok(stats.total_external_agents >= 1);
      assert.ok(stats.total_federated_tasks >= 1);
      assert.ok(stats.discovery_cache_size >= 1);
    });
  });

  describe('executeOnBestAgent()', () => {
    it('should select best agent based on criteria', async () => {
      const agentUrls = [
        'https://basic-agent.com',
        'https://streaming-agent.com',
        'https://full-featured-agent.com',
      ];

      // Basic agent
      fetchMock.responses.set(`${agentUrls[0]}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () =>
          mockAgentCard({
            name: 'basic-agent',
            capabilities: { streaming: false, push_notifications: false },
          }),
      });

      // Streaming agent
      fetchMock.responses.set(`${agentUrls[1]}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () =>
          mockAgentCard({
            name: 'streaming-agent',
            capabilities: { streaming: true, push_notifications: false },
          }),
      });

      // Full-featured agent
      fetchMock.responses.set(`${agentUrls[2]}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () =>
          mockAgentCard({
            name: 'full-featured-agent',
            capabilities: { streaming: true, push_notifications: true },
          }),
      });

      // Mock sendMessage for selected agent
      fetchMock.responses.set(`${agentUrls[2]}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task: mockTask() }),
      });

      const result = await manager.executeOnBestAgent(agentUrls, mockMessage(), {
        streaming: true,
        push_notifications: true,
      });

      assert.equal(result.selected_agent.name, 'full-featured-agent');
      assert.equal(result.candidates, 3);
    });

    it('should throw when no agents discovered', async () => {
      const agentUrls = ['https://error1.com', 'https://error2.com'];

      agentUrls.forEach(url => {
        fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
          ok: false,
          status: 500,
        });
      });

      await assert.rejects(
        async () => {
          await manager.executeOnBestAgent(agentUrls, mockMessage());
        },
        { message: /No agents discovered successfully/ }
      );
    });
  });

  describe('clearFederation()', () => {
    it('should clear all federation state', async () => {
      // Create federated task
      const agentUrl = 'https://clear-test.com';
      const agentCard = mockAgentCard({
        capabilities: { streaming: false, push_notifications: false },
      });

      fetchMock.responses.set(`${agentUrl}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      fetchMock.responses.set(`${agentUrl}/sendMessage`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ task: mockTask() }),
      });

      await manager.executeExternalTask(agentUrl, mockMessage());

      manager.clearFederation();

      assert.equal(manager.federatedTasks.size, 0);
      assert.equal(manager.discovery.cache.size, 0);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance', () => {
      const instance1 = getFederationManager();
      const instance2 = getFederationManager();

      assert.strictEqual(instance1, instance2);
    });

    it('should reset instance', () => {
      const instance1 = getFederationManager();
      resetInstance();
      const instance2 = getFederationManager();

      assert.notStrictEqual(instance1, instance2);
    });
  });
});
