/**
 * External Agent Discovery Tests
 *
 * Tests for external agent discovery, caching, validation, and performance.
 *
 * Coverage:
 * - AgentCard fetching from external URLs
 * - Cache management (30-minute TTL)
 * - AgentCard validation (A2A v0.3.0)
 * - Error handling and recovery
 * - Performance benchmarks (<100ms)
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ExternalAgentDiscovery,
  createExternalAgentDiscovery,
  getExternalAgentDiscovery,
  resetInstance,
} from './external-agent-discovery.mjs';
import { mockAgentCard, mockFeatureFlags } from './test-utils.mjs';

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
      throw new Error(`No mock response for ${url}`);
    }

    return response;
  };
}

function teardownFetchMock() {
  global.fetch = originalFetch;
  fetchMock = null;
}

describe('ExternalAgentDiscovery', () => {
  let discovery;
  let flags;

  beforeEach(() => {
    setupFetchMock();
    flags = mockFeatureFlags({ external_federation: true });
    discovery = createExternalAgentDiscovery({ featureFlags: flags });
  });

  afterEach(() => {
    teardownFetchMock();
    resetInstance();
  });

  describe('Constructor', () => {
    it('should create instance with default options', () => {
      const d = new ExternalAgentDiscovery();
      assert.ok(d instanceof ExternalAgentDiscovery);
      assert.ok(d.cache instanceof Map);
    });

    it('should use custom timeout', () => {
      const d = new ExternalAgentDiscovery({ timeout: 10000 });
      assert.equal(d.timeout, 10000);
    });
  });

  describe('discoverAgent()', () => {
    it('should discover external agent from URL', async () => {
      const agentCard = mockAgentCard({ name: 'external-agent-1' });
      const url = 'https://external-agent.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      const result = await discovery.discoverAgent(url);

      assert.equal(result.name, 'external-agent-1');
      assert.ok(result._discovery);
      assert.equal(result._discovery.source_url, url);
      assert.ok(fetchMock.calls.length > 0);
    });

    it('should cache discovered AgentCards', async () => {
      const agentCard = mockAgentCard({ name: 'cached-agent' });
      const url = 'https://cached.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      // First call - should fetch
      await discovery.discoverAgent(url);
      const firstCallCount = fetchMock.calls.length;

      // Second call - should use cache
      const cached = await discovery.discoverAgent(url);
      const secondCallCount = fetchMock.calls.length;

      assert.equal(cached.name, 'cached-agent');
      assert.equal(secondCallCount, firstCallCount); // No new fetch
    });

    it('should force refresh cache when requested', async () => {
      const agentCard = mockAgentCard({ name: 'refresh-agent' });
      const url = 'https://refresh.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      // First call
      await discovery.discoverAgent(url);
      const firstCallCount = fetchMock.calls.length;

      // Force refresh
      await discovery.discoverAgent(url, { forceRefresh: true });
      const refreshCallCount = fetchMock.calls.length;

      assert.ok(refreshCallCount > firstCallCount); // New fetch occurred
    });

    it('should throw when feature flag disabled', async () => {
      discovery.featureFlags.external_federation = false;

      await assert.rejects(
        async () => {
          await discovery.discoverAgent('https://test.com');
        },
        { message: /external_federation feature flag is disabled/ }
      );
    });

    it('should throw when HTTP error occurs', async () => {
      const url = 'https://error.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await assert.rejects(
        async () => {
          await discovery.discoverAgent(url);
        },
        { message: /Failed to fetch AgentCard: HTTP 404/ }
      );
    });

    it('should throw when invalid content type', async () => {
      const url = 'https://invalid.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
      });

      await assert.rejects(
        async () => {
          await discovery.discoverAgent(url);
        },
        { message: /Invalid content type/ }
      );
    });

    it('should throw when AgentCard validation fails', async () => {
      const invalidCard = { name: 'invalid' }; // Missing required fields
      const url = 'https://invalid-card.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => invalidCard,
      });

      await assert.rejects(
        async () => {
          await discovery.discoverAgent(url);
        },
        { message: /Invalid AgentCard/ }
      );
    });

    it('should complete discovery within performance target (<100ms)', async () => {
      const agentCard = mockAgentCard();
      const url = 'https://fast.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      const startTime = Date.now();
      await discovery.discoverAgent(url);
      const duration = Date.now() - startTime;

      assert.ok(duration < 100, `Discovery took ${duration}ms (target: <100ms)`);
    });
  });

  describe('getCachedAgentCard()', () => {
    it('should return cached AgentCard', async () => {
      const agentCard = mockAgentCard({ name: 'test-agent' });
      const url = 'https://test.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      await discovery.discoverAgent(url);
      const cached = discovery.getCachedAgentCard(url);

      assert.ok(cached);
      assert.equal(cached.name, 'test-agent');
    });

    it('should return null for non-existent cache entry', () => {
      const cached = discovery.getCachedAgentCard('https://nonexistent.com');
      assert.equal(cached, null);
    });

    it('should return null for expired cache entry', async () => {
      const agentCard = mockAgentCard();
      const url = 'https://expired.com';

      // Cache manually with expired timestamp
      discovery.cache.set(url, {
        agentCard,
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago
      });

      const cached = discovery.getCachedAgentCard(url);
      assert.equal(cached, null);
    });
  });

  describe('validateExternalAgentCard()', () => {
    it('should validate valid AgentCard', () => {
      const agentCard = mockAgentCard();
      const result = discovery.validateExternalAgentCard(agentCard);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should reject null AgentCard', () => {
      const result = discovery.validateExternalAgentCard(null);

      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('should detect missing required fields', () => {
      const invalidCard = { name: 'test' }; // Missing many fields
      const result = discovery.validateExternalAgentCard(invalidCard);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Missing required field')));
    });

    it('should detect invalid array fields', () => {
      const invalidCard = mockAgentCard({
        supported_interfaces: 'not-an-array',
      });
      const result = discovery.validateExternalAgentCard(invalidCard);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('must be an array')));
    });

    it('should detect unsupported protocol version', () => {
      const invalidCard = mockAgentCard({ protocol_version: '0.1.0' });
      const result = discovery.validateExternalAgentCard(invalidCard);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Unsupported protocol version')));
    });
  });

  describe('listExternalAgents()', () => {
    beforeEach(async () => {
      // Discover multiple agents
      for (let i = 1; i <= 3; i++) {
        const agentCard = mockAgentCard({
          name: `agent-${i}`,
          capabilities: {
            streaming: i % 2 === 0,
            push_notifications: i > 1,
          },
          skills: [{ id: `skill-${i}`, name: `Skill ${i}` }],
        });

        const url = `https://agent-${i}.com`;

        fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => agentCard,
        });

        await discovery.discoverAgent(url);
      }
    });

    it('should list all discovered agents', () => {
      const agents = discovery.listExternalAgents();
      assert.equal(agents.length, 3);
    });

    it('should filter by capability', () => {
      const agents = discovery.listExternalAgents({ capability: 'streaming' });
      assert.equal(agents.length, 1);
      assert.equal(agents[0].name, 'agent-2');
    });

    it('should apply limit', () => {
      const agents = discovery.listExternalAgents({ limit: 2 });
      assert.equal(agents.length, 2);
    });
  });

  describe('discoverMultipleAgents()', () => {
    it('should discover multiple agents in parallel', async () => {
      const urls = ['https://a1.com', 'https://a2.com', 'https://a3.com'];

      urls.forEach(url => {
        const agentCard = mockAgentCard({ name: `agent-${url}` });
        fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => agentCard,
        });
      });

      const result = await discovery.discoverMultipleAgents(urls);

      assert.equal(result.discovered.length, 3);
      assert.equal(result.failed.length, 0);
    });

    it('should handle partial failures', async () => {
      const urls = ['https://success.com', 'https://fail.com'];

      fetchMock.responses.set('https://success.com/.well-known/agent-card.json', {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockAgentCard(),
      });

      fetchMock.responses.set('https://fail.com/.well-known/agent-card.json', {
        ok: false,
        status: 500,
      });

      const result = await discovery.discoverMultipleAgents(urls);

      assert.equal(result.discovered.length, 1);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0].url, 'https://fail.com');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const agentCard = mockAgentCard();
      const url = 'https://test.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      await discovery.discoverAgent(url);
      assert.equal(discovery.cache.size, 1);

      discovery.clearCache();
      assert.equal(discovery.cache.size, 0);
    });

    it('should provide cache statistics', async () => {
      const agentCard = mockAgentCard();
      const url = 'https://test.com';

      fetchMock.responses.set(`${url}/.well-known/agent-card.json`, {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => agentCard,
      });

      await discovery.discoverAgent(url);
      const stats = discovery.getCacheStats();

      assert.equal(stats.size, 1);
      assert.ok(stats.entries.length > 0);
      assert.ok(stats.ttl_ms > 0);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance', () => {
      const instance1 = getExternalAgentDiscovery();
      const instance2 = getExternalAgentDiscovery();

      assert.strictEqual(instance1, instance2);
    });

    it('should reset instance', () => {
      const instance1 = getExternalAgentDiscovery();
      resetInstance();
      const instance2 = getExternalAgentDiscovery();

      assert.notStrictEqual(instance1, instance2);
    });
  });
});
