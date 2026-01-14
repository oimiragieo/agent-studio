/**
 * Memory-A2A Bridge Tests
 *
 * Comprehensive tests for Memory-A2A Bridge covering:
 * - Legacy → A2A conversion
 * - A2A → Legacy conversion
 * - Round-trip consistency
 * - Feature flags
 * - Performance benchmarks
 * - Error handling
 *
 * @module memory-a2a-bridge-tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryA2ABridge } from './memory-a2a-bridge.mjs';
import { createEntityA2AConverter } from './entity-a2a-converter.mjs';

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_MEMORIES = [
  {
    id: 'mem-1',
    role: 'user',
    content: 'Implement authentication feature',
    timestamp: '2025-01-13T10:00:00Z',
    tier: 'conversation',
    relevanceScore: 0.95,
  },
  {
    id: 'mem-2',
    role: 'assistant',
    content: 'I will implement JWT authentication',
    timestamp: '2025-01-13T10:01:00Z',
    tier: 'agent',
    relevanceScore: 0.92,
  },
  {
    id: 'mem-3',
    role: 'user',
    content: 'Add rate limiting to the API',
    timestamp: '2025-01-13T10:05:00Z',
    tier: 'project',
    relevanceScore: 0.88,
  },
];

const MOCK_ENTITIES = [
  {
    entityId: 'entity-1',
    entityType: 'feature',
    name: 'authentication',
    attributes: { technology: 'JWT', security: 'high' },
    relationships: [],
    mentions: 5,
  },
  {
    entityId: 'entity-2',
    entityType: 'api',
    name: 'rate-limiting',
    attributes: { limit: '100/min' },
    relationships: [{ relatedEntityId: 'entity-1', relationshipType: 'depends_on', strength: 0.8 }],
    mentions: 3,
  },
];

const MOCK_HANDOFF = {
  handoffId: 'handoff-123',
  memories: MOCK_MEMORIES,
  entities: MOCK_ENTITIES,
  relevanceScore: 0.92,
  tokenBudget: 2000,
  sourceAgentId: 'developer',
  targetAgentId: 'qa',
};

// ============================================================================
// Legacy → A2A Conversion Tests
// ============================================================================

describe('Memory-A2A Bridge - Legacy to A2A Conversion', () => {
  let bridge;
  let entityConverter;

  beforeEach(() => {
    entityConverter = createEntityA2AConverter();
    bridge = createMemoryA2ABridge({
      entityConverter,
      featureFlags: { memory_a2a_bridge: true },
    });
  });

  it('should convert legacy handoff to A2A Artifact', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);

    assert.ok(artifact.artifactId, 'Artifact should have ID');
    assert.equal(artifact.name, 'memory-handoff', 'Artifact name should be memory-handoff');
    assert.ok(Array.isArray(artifact.parts), 'Artifact should have parts array');
    assert.ok(artifact.metadata, 'Artifact should have metadata');
  });

  it('should convert memories to TextPart', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const textParts = artifact.parts.filter(p => p.text);

    assert.equal(textParts.length, 1, 'Should have 1 TextPart');
    assert.ok(textParts[0].text.includes('user'), 'TextPart should contain user role');
    assert.ok(textParts[0].text.includes('assistant'), 'TextPart should contain assistant role');
    assert.ok(
      textParts[0].text.includes('Implement authentication'),
      'TextPart should contain memory content'
    );
  });

  it('should convert entities to DataPart', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const dataParts = artifact.parts.filter(p => p.data);

    assert.equal(dataParts.length, 1, 'Should have 1 DataPart');
    assert.ok(dataParts[0].data.entities, 'DataPart should have entities');
    assert.equal(
      dataParts[0].data.entities.length,
      2,
      'DataPart should have 2 entities'
    );
  });

  it('should include metadata in artifact', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);

    assert.equal(artifact.metadata.relevanceScore, 0.92, 'Should preserve relevanceScore');
    assert.equal(artifact.metadata.tokenBudget, 2000, 'Should preserve tokenBudget');
    assert.equal(artifact.metadata.sourceAgentId, 'developer', 'Should preserve sourceAgentId');
    assert.equal(artifact.metadata.targetAgentId, 'qa', 'Should preserve targetAgentId');
    assert.equal(artifact.metadata.format, 'a2a', 'Should set format to a2a');
  });

  it('should handle handoff without entities', async () => {
    const handoff = { ...MOCK_HANDOFF, entities: [] };
    const artifact = await bridge.toA2AArtifact(handoff);

    const dataParts = artifact.parts.filter(p => p.data);
    assert.equal(dataParts.length, 0, 'Should have no DataParts when entities empty');
  });

  it('should throw error if memories missing', async () => {
    const invalidHandoff = { handoffId: 'test' };

    await assert.rejects(
      async () => await bridge.toA2AArtifact(invalidHandoff),
      { message: /memories required/ },
      'Should reject if memories missing'
    );
  });

  it('should throw error if feature flag disabled', async () => {
    const disabledBridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: false },
    });

    await assert.rejects(
      async () => await disabledBridge.toA2AArtifact(MOCK_HANDOFF),
      { message: /feature flag is disabled/ },
      'Should reject if feature flag disabled'
    );
  });
});

// ============================================================================
// A2A → Legacy Conversion Tests
// ============================================================================

describe('Memory-A2A Bridge - A2A to Legacy Conversion', () => {
  let bridge;
  let entityConverter;

  beforeEach(() => {
    entityConverter = createEntityA2AConverter();
    bridge = createMemoryA2ABridge({
      entityConverter,
      featureFlags: { memory_a2a_bridge: true },
    });
  });

  it('should convert A2A Artifact to legacy handoff', async () => {
    // First convert to A2A
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);

    // Then convert back to legacy
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.ok(handoff.handoffId, 'Handoff should have ID');
    assert.ok(Array.isArray(handoff.memories), 'Handoff should have memories array');
    assert.ok(Array.isArray(handoff.entities), 'Handoff should have entities array');
  });

  it('should extract memories from TextPart', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(handoff.memories.length, 3, 'Should extract 3 memories');
    assert.equal(handoff.memories[0].role, 'user', 'Should extract role');
    assert.equal(handoff.memories[0].tier, 'conversation', 'Should extract tier');
    assert.ok(handoff.memories[0].content, 'Should extract content');
  });

  it('should extract entities from DataPart', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(handoff.entities.length, 2, 'Should extract 2 entities');
    assert.equal(handoff.entities[0].type, 'feature', 'Should extract entity type');
    assert.equal(handoff.entities[0].value, 'authentication', 'Should extract entity name');
  });

  it('should preserve metadata', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(handoff.relevanceScore, 0.92, 'Should preserve relevanceScore');
    assert.equal(handoff.tokenBudget, 2000, 'Should preserve tokenBudget');
    assert.equal(handoff.sourceAgentId, 'developer', 'Should preserve sourceAgentId');
    assert.equal(handoff.targetAgentId, 'qa', 'Should preserve targetAgentId');
  });

  it('should handle artifact without DataPart', async () => {
    const artifact = {
      artifactId: 'test-123',
      name: 'memory-handoff',
      parts: [{ text: '[user] [conversation] [2025-01-13T10:00:00Z]\nTest content' }],
      metadata: {},
    };

    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(handoff.entities.length, 0, 'Should return empty entities array');
  });

  it('should throw error if artifact invalid', async () => {
    const invalidArtifact = { artifactId: 'test' };

    await assert.rejects(
      async () => await bridge.fromA2AArtifact(invalidArtifact),
      { message: /parts array required/ },
      'Should reject if parts missing'
    );
  });
});

// ============================================================================
// Round-Trip Consistency Tests
// ============================================================================

describe('Memory-A2A Bridge - Round-Trip Consistency', () => {
  let bridge;
  let entityConverter;

  beforeEach(() => {
    entityConverter = createEntityA2AConverter();
    bridge = createMemoryA2ABridge({
      entityConverter,
      featureFlags: { memory_a2a_bridge: true },
    });
  });

  it('should preserve memory count in round-trip', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(
      handoff.memories.length,
      MOCK_HANDOFF.memories.length,
      'Memory count should be preserved'
    );
  });

  it('should preserve entity count in round-trip', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(
      handoff.entities.length,
      MOCK_HANDOFF.entities.length,
      'Entity count should be preserved'
    );
  });

  it('should preserve memory content in round-trip', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    for (let i = 0; i < MOCK_HANDOFF.memories.length; i++) {
      assert.ok(
        handoff.memories[i].content.includes(MOCK_HANDOFF.memories[i].content),
        `Memory ${i} content should be preserved`
      );
    }
  });

  it('should preserve metadata in round-trip', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    const handoff = await bridge.fromA2AArtifact(artifact);

    assert.equal(handoff.relevanceScore, MOCK_HANDOFF.relevanceScore, 'relevanceScore preserved');
    assert.equal(handoff.tokenBudget, MOCK_HANDOFF.tokenBudget, 'tokenBudget preserved');
    assert.equal(handoff.sourceAgentId, MOCK_HANDOFF.sourceAgentId, 'sourceAgentId preserved');
    assert.equal(handoff.targetAgentId, MOCK_HANDOFF.targetAgentId, 'targetAgentId preserved');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Memory-A2A Bridge - Performance', () => {
  let bridge;
  let entityConverter;

  beforeEach(() => {
    entityConverter = createEntityA2AConverter();
    bridge = createMemoryA2ABridge({
      entityConverter,
      featureFlags: { memory_a2a_bridge: true },
    });
  });

  it('should convert to A2A in <200ms', async () => {
    const startTime = Date.now();
    await bridge.toA2AArtifact(MOCK_HANDOFF);
    const duration = Date.now() - startTime;

    assert.ok(duration < 200, `Conversion took ${duration}ms, should be <200ms`);
  });

  it('should convert from A2A in <200ms', async () => {
    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);

    const startTime = Date.now();
    await bridge.fromA2AArtifact(artifact);
    const duration = Date.now() - startTime;

    assert.ok(duration < 200, `Conversion took ${duration}ms, should be <200ms`);
  });

  it('should convert memories in <100ms', async () => {
    const startTime = Date.now();
    await bridge.convertMemoriesToParts(MOCK_MEMORIES);
    const duration = Date.now() - startTime;

    assert.ok(duration < 100, `Memory conversion took ${duration}ms, should be <100ms`);
  });

  it('should convert entities in <50ms', async () => {
    const startTime = Date.now();
    await bridge.convertEntitiesToDataPart(MOCK_ENTITIES);
    const duration = Date.now() - startTime;

    assert.ok(duration < 50, `Entity conversion took ${duration}ms, should be <50ms`);
  });
});

// ============================================================================
// Feature Flag Tests
// ============================================================================

describe('Memory-A2A Bridge - Feature Flags', () => {
  it('should respect feature flag for toA2AArtifact', async () => {
    const bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: false },
    });

    await assert.rejects(
      async () => await bridge.toA2AArtifact(MOCK_HANDOFF),
      { message: /feature flag is disabled/ }
    );
  });

  it('should respect feature flag for fromA2AArtifact', async () => {
    const bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: false },
    });

    const artifact = { artifactId: 'test', parts: [] };

    await assert.rejects(
      async () => await bridge.fromA2AArtifact(artifact),
      { message: /feature flag is disabled/ }
    );
  });

  it('should work when feature flag enabled', async () => {
    const bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: true },
    });

    const artifact = await bridge.toA2AArtifact(MOCK_HANDOFF);
    assert.ok(artifact, 'Should work when flag enabled');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Memory-A2A Bridge - Edge Cases', () => {
  let bridge;

  beforeEach(() => {
    bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: true },
    });
  });

  it('should handle empty memories array', async () => {
    const handoff = { ...MOCK_HANDOFF, memories: [] };

    // Should not throw, but produce empty TextPart
    await assert.doesNotReject(async () => await bridge.toA2AArtifact(handoff));
  });

  it('should handle memories without relevanceScore', async () => {
    const memories = [{ role: 'user', content: 'Test', timestamp: new Date().toISOString() }];
    const handoff = { ...MOCK_HANDOFF, memories };

    const artifact = await bridge.toA2AArtifact(handoff);
    assert.ok(artifact, 'Should handle memories without relevanceScore');
  });

  it('should handle entities without relationships', async () => {
    const entities = [{ entityId: 'e1', entityType: 'test', name: 'Test', relationships: [] }];
    const handoff = { ...MOCK_HANDOFF, entities };

    const artifact = await bridge.toA2AArtifact(handoff);
    const dataPart = artifact.parts.find(p => p.data);
    assert.equal(dataPart.data.entities[0].relationships.length, 0);
  });

  it('should handle malformed TextPart during conversion', async () => {
    const artifact = {
      artifactId: 'test',
      parts: [{ text: 'Malformed text without structure' }],
      metadata: {},
    };

    const handoff = await bridge.fromA2AArtifact(artifact);
    assert.ok(handoff.memories.length > 0, 'Should fallback parse malformed text');
  });
});

// ============================================================================
// Integration with Memory Handoff Service
// ============================================================================

describe('Memory-A2A Bridge - Memory Handoff Service Integration', () => {
  it('should throw error if memoryHandoffService not configured', async () => {
    const bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: true },
    });

    await assert.rejects(
      async () => await bridge.prepareA2AHandoff({}),
      { message: /memoryHandoffService not configured/ }
    );
  });

  it('should throw error if applyA2AHandoff called without service', async () => {
    const bridge = createMemoryA2ABridge({
      featureFlags: { memory_a2a_bridge: true },
    });

    const artifact = { artifactId: 'test', parts: [], metadata: {} };

    await assert.rejects(
      async () => await bridge.applyA2AHandoff(artifact),
      { message: /memoryHandoffService not configured/ }
    );
  });
});

console.log('✅ Memory-A2A Bridge tests complete');
