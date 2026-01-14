/**
 * Entity-A2A Converter Tests
 *
 * Tests for Entity-A2A Converter covering:
 * - Entity → DataPart conversion
 * - DataPart → Entity extraction
 * - Schema validation
 * - Edge cases
 * - Performance
 *
 * @module entity-a2a-converter-tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEntityA2AConverter } from './entity-a2a-converter.mjs';

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_ENTITIES = [
  {
    id: 'entity-1',
    type: 'feature',
    value: 'authentication',
    attributes: { technology: 'JWT', priority: 'high' },
    relationships: [],
    occurrence_count: 5,
    confidence: 0.95,
    context: 'User authentication system',
    first_seen: '2025-01-10T10:00:00Z',
    last_seen: '2025-01-13T10:00:00Z',
    is_active: true,
  },
  {
    id: 'entity-2',
    type: 'api',
    value: 'rate-limiting',
    attributes: { limit: '100/min', strategy: 'sliding-window' },
    relationships: [
      { entity_id_2: 'entity-1', relationship_type: 'depends_on', strength: 0.8 },
    ],
    occurrence_count: 3,
    confidence: 0.88,
    context: 'API rate limiting',
    first_seen: '2025-01-11T10:00:00Z',
    last_seen: '2025-01-13T10:00:00Z',
    is_active: true,
  },
];

// ============================================================================
// Entity → DataPart Conversion Tests
// ============================================================================

describe('Entity-A2A Converter - Entity to DataPart', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should convert entities to DataPart', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.ok(dataPart.data, 'DataPart should have data object');
    assert.ok(Array.isArray(dataPart.data.entities), 'DataPart should have entities array');
    assert.equal(dataPart.data.entities.length, 2, 'Should convert all entities');
  });

  it('should preserve entity ID', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.equal(dataPart.data.entities[0].entityId, 'entity-1', 'Should preserve entity ID');
  });

  it('should preserve entity type', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.equal(dataPart.data.entities[0].entityType, 'feature', 'Should preserve entity type');
  });

  it('should preserve entity name', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.equal(
      dataPart.data.entities[0].name,
      'authentication',
      'Should preserve entity name'
    );
  });

  it('should convert attributes', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.ok(dataPart.data.entities[0].attributes, 'Should have attributes');
    assert.equal(
      dataPart.data.entities[0].attributes.technology,
      'JWT',
      'Should preserve attribute values'
    );
  });

  it('should convert relationships', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.ok(
      Array.isArray(dataPart.data.entities[1].relationships),
      'Should have relationships array'
    );
    assert.equal(dataPart.data.entities[1].relationships.length, 1, 'Should have 1 relationship');
    assert.equal(
      dataPart.data.entities[1].relationships[0].relationshipType,
      'depends_on',
      'Should preserve relationship type'
    );
  });

  it('should convert mentions', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.equal(dataPart.data.entities[0].mentions, 5, 'Should convert occurrence_count to mentions');
  });

  it('should include metadata', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.ok(dataPart.data.entities[0].metadata, 'Should have metadata');
    assert.equal(dataPart.data.entities[0].metadata.confidence, 0.95, 'Should include confidence');
    assert.equal(
      dataPart.data.entities[0].metadata.context,
      'User authentication system',
      'Should include context'
    );
  });

  it('should include version and timestamp', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    assert.ok(dataPart.data.version, 'Should have version');
    assert.ok(dataPart.data.timestamp, 'Should have timestamp');
  });

  it('should validate schema', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    const validation = converter.validateEntityDataPart(dataPart);
    assert.ok(validation.valid, 'DataPart should pass schema validation');
    assert.equal(validation.errors.length, 0, 'Should have no validation errors');
  });

  it('should throw error for non-array input', async () => {
    await assert.rejects(
      async () => await converter.toA2ADataPart('not-an-array'),
      { message: /Entities must be an array/ }
    );
  });
});

// ============================================================================
// DataPart → Entity Extraction Tests
// ============================================================================

describe('Entity-A2A Converter - DataPart to Entity', () => {
  let converter;
  let dataPart;

  beforeEach(async () => {
    converter = createEntityA2AConverter();
    dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
  });

  it('should extract entities from DataPart', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.ok(Array.isArray(entities), 'Should return entities array');
    assert.equal(entities.length, 2, 'Should extract all entities');
  });

  it('should extract entity ID', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities[0].id, 'entity-1', 'Should extract entity ID');
  });

  it('should extract entity type', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities[0].type, 'feature', 'Should extract entity type');
  });

  it('should extract entity value', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities[0].value, 'authentication', 'Should extract entity value');
  });

  it('should extract attributes', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.ok(entities[0].attributes, 'Should have attributes');
    assert.equal(entities[0].attributes.technology, 'JWT', 'Should extract attribute values');
  });

  it('should extract relationships', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.ok(Array.isArray(entities[1].relationships), 'Should have relationships');
    assert.equal(entities[1].relationships.length, 1, 'Should extract relationships');
    assert.equal(
      entities[1].relationships[0].relationship_type,
      'depends_on',
      'Should extract relationship type'
    );
  });

  it('should extract occurrence count', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities[0].occurrence_count, 5, 'Should extract mentions as occurrence_count');
  });

  it('should extract metadata', async () => {
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities[0].confidence, 0.95, 'Should extract confidence');
    assert.equal(
      entities[0].context,
      'User authentication system',
      'Should extract context'
    );
  });

  it('should throw error for invalid DataPart', async () => {
    await assert.rejects(
      async () => await converter.fromA2ADataPart(null),
      { message: /data object required/ }
    );
  });

  it('should throw error for DataPart without entities', async () => {
    const invalidDataPart = { data: {} };

    await assert.rejects(
      async () => await converter.fromA2ADataPart(invalidDataPart),
      { message: /validation failed/ }
    );
  });
});

// ============================================================================
// Round-Trip Consistency Tests
// ============================================================================

describe('Entity-A2A Converter - Round-Trip Consistency', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should preserve entity count in round-trip', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(entities.length, MOCK_ENTITIES.length, 'Entity count should be preserved');
  });

  it('should preserve entity IDs in round-trip', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
    const entities = await converter.fromA2ADataPart(dataPart);

    for (let i = 0; i < MOCK_ENTITIES.length; i++) {
      assert.equal(entities[i].id, MOCK_ENTITIES[i].id, `Entity ${i} ID should be preserved`);
    }
  });

  it('should preserve entity types in round-trip', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
    const entities = await converter.fromA2ADataPart(dataPart);

    for (let i = 0; i < MOCK_ENTITIES.length; i++) {
      assert.equal(entities[i].type, MOCK_ENTITIES[i].type, `Entity ${i} type should be preserved`);
    }
  });

  it('should preserve attributes in round-trip', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(
      entities[0].attributes.technology,
      MOCK_ENTITIES[0].attributes.technology,
      'Attributes should be preserved'
    );
  });

  it('should preserve relationships in round-trip', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.equal(
      entities[1].relationships.length,
      MOCK_ENTITIES[1].relationships.length,
      'Relationship count should be preserved'
    );
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Entity-A2A Converter - Schema Validation', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should validate valid DataPart', () => {
    const validDataPart = {
      data: {
        entities: [
          { entityId: 'e1', entityType: 'test', name: 'Test' },
        ],
      },
    };

    const validation = converter.validateEntityDataPart(validDataPart);
    assert.ok(validation.valid, 'Valid DataPart should pass');
  });

  it('should reject DataPart without data', () => {
    const invalidDataPart = {};

    const validation = converter.validateEntityDataPart(invalidDataPart);
    assert.ok(!validation.valid, 'Should reject DataPart without data');
    assert.ok(validation.errors.length > 0, 'Should have validation errors');
  });

  it('should reject DataPart without entities', () => {
    const invalidDataPart = { data: {} };

    const validation = converter.validateEntityDataPart(invalidDataPart);
    assert.ok(!validation.valid, 'Should reject DataPart without entities');
  });

  it('should reject entity without entityId', () => {
    const invalidDataPart = {
      data: {
        entities: [{ entityType: 'test', name: 'Test' }],
      },
    };

    const validation = converter.validateEntityDataPart(invalidDataPart);
    assert.ok(!validation.valid, 'Should reject entity without entityId');
    assert.ok(
      validation.errors.some(e => e.includes('entityId')),
      'Should report missing entityId'
    );
  });

  it('should reject entity without entityType', () => {
    const invalidDataPart = {
      data: {
        entities: [{ entityId: 'e1', name: 'Test' }],
      },
    };

    const validation = converter.validateEntityDataPart(invalidDataPart);
    assert.ok(!validation.valid, 'Should reject entity without entityType');
  });

  it('should reject entity without name', () => {
    const invalidDataPart = {
      data: {
        entities: [{ entityId: 'e1', entityType: 'test' }],
      },
    };

    const validation = converter.validateEntityDataPart(invalidDataPart);
    assert.ok(!validation.valid, 'Should reject entity without name');
  });
});

// ============================================================================
// Merge DataParts Tests
// ============================================================================

describe('Entity-A2A Converter - Merge DataParts', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should merge multiple DataParts', async () => {
    const dataPart1 = await converter.toA2ADataPart([MOCK_ENTITIES[0]]);
    const dataPart2 = await converter.toA2ADataPart([MOCK_ENTITIES[1]]);

    const merged = await converter.mergeDataParts([dataPart1, dataPart2]);

    assert.equal(merged.data.entities.length, 2, 'Should merge all entities');
  });

  it('should deduplicate entities by ID', async () => {
    const dataPart1 = await converter.toA2ADataPart([MOCK_ENTITIES[0]]);
    const dataPart2 = await converter.toA2ADataPart([MOCK_ENTITIES[0]]);

    const merged = await converter.mergeDataParts([dataPart1, dataPart2]);

    assert.equal(merged.data.entities.length, 1, 'Should deduplicate by ID');
  });

  it('should merge mentions for duplicate entities', async () => {
    const dataPart1 = await converter.toA2ADataPart([MOCK_ENTITIES[0]]);
    const dataPart2 = await converter.toA2ADataPart([MOCK_ENTITIES[0]]);

    const merged = await converter.mergeDataParts([dataPart1, dataPart2]);

    assert.equal(merged.data.entities[0].mentions, 10, 'Should sum mentions (5 + 5)');
  });

  it('should merge attributes', async () => {
    const entity1 = { ...MOCK_ENTITIES[0], attributes: { a: '1' } };
    const entity2 = { ...MOCK_ENTITIES[0], attributes: { b: '2' } };

    const dataPart1 = await converter.toA2ADataPart([entity1]);
    const dataPart2 = await converter.toA2ADataPart([entity2]);

    const merged = await converter.mergeDataParts([dataPart1, dataPart2]);

    assert.ok(merged.data.entities[0].attributes.a, 'Should have attribute a');
    assert.ok(merged.data.entities[0].attributes.b, 'Should have attribute b');
  });

  it('should throw error for non-array input', async () => {
    await assert.rejects(
      async () => await converter.mergeDataParts('not-an-array'),
      { message: /dataParts must be an array/ }
    );
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Entity-A2A Converter - Performance', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should convert to DataPart in <50ms', async () => {
    const startTime = Date.now();
    await converter.toA2ADataPart(MOCK_ENTITIES);
    const duration = Date.now() - startTime;

    assert.ok(duration < 50, `Conversion took ${duration}ms, should be <50ms`);
  });

  it('should convert from DataPart in <50ms', async () => {
    const dataPart = await converter.toA2ADataPart(MOCK_ENTITIES);

    const startTime = Date.now();
    await converter.fromA2ADataPart(dataPart);
    const duration = Date.now() - startTime;

    assert.ok(duration < 50, `Extraction took ${duration}ms, should be <50ms`);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Entity-A2A Converter - Edge Cases', () => {
  let converter;

  beforeEach(() => {
    converter = createEntityA2AConverter();
  });

  it('should handle empty entities array', async () => {
    const dataPart = await converter.toA2ADataPart([]);

    assert.equal(dataPart.data.entities.length, 0, 'Should handle empty array');
  });

  it('should handle entity without attributes', async () => {
    const entity = {
      id: 'e1',
      type: 'test',
      value: 'Test',
      occurrence_count: 1,
    };

    const dataPart = await converter.toA2ADataPart([entity]);

    assert.ok(dataPart.data.entities[0].attributes, 'Should have attributes object');
  });

  it('should handle entity without relationships', async () => {
    const entity = {
      id: 'e1',
      type: 'test',
      value: 'Test',
      occurrence_count: 1,
    };

    const dataPart = await converter.toA2ADataPart([entity]);

    assert.ok(
      Array.isArray(dataPart.data.entities[0].relationships),
      'Should have relationships array'
    );
    assert.equal(dataPart.data.entities[0].relationships.length, 0, 'Should be empty array');
  });

  it('should handle complex attribute values', async () => {
    const entity = {
      id: 'e1',
      type: 'test',
      value: 'Test',
      attributes: { complex: { nested: { value: 'test' } } },
      occurrence_count: 1,
    };

    const dataPart = await converter.toA2ADataPart([entity]);
    const entities = await converter.fromA2ADataPart(dataPart);

    assert.deepEqual(
      entities[0].attributes.complex,
      { nested: { value: 'test' } },
      'Should preserve complex attributes'
    );
  });
});

console.log('✅ Entity-A2A Converter tests complete');
