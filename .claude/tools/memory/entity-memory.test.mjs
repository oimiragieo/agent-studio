/**
 * Entity Memory System Tests
 *
 * Comprehensive test suite for entity extraction and graph storage
 *
 * Test Coverage:
 * - Entity extraction from text
 * - Entity extraction from JSON
 * - Entity classification
 * - Entity CRUD operations
 * - Relationship management
 * - Search and query operations
 * - Entity history tracking
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { EntityExtractor, ENTITY_TYPES, createEntityExtractor } from './entity-extractor.mjs';
import { EntityMemory, RELATIONSHIP_TYPES, createEntityMemory } from './entity-memory.mjs';
import { MemoryDatabase } from './database.mjs';

// Test database path
const TEST_DB_PATH = join(process.cwd(), '.claude', 'context', 'tmp', 'test-entity-memory.db');

// Clean up test database
function cleanupTestDB() {
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch (error) {
      // Ignore errors
    }
  }
}

describe('Entity Extractor', () => {
  let extractor;

  before(() => {
    extractor = new EntityExtractor();
  });

  describe('extractFromText', () => {
    it('should extract person entities from text', () => {
      const text = 'John Smith worked with Jane Doe on the React project';
      const entities = extractor.extractFromText(text);

      const persons = entities.filter(e => e.type === ENTITY_TYPES.PERSON);
      assert(persons.length >= 2, 'Should extract at least 2 person entities');

      const names = persons.map(p => p.value);
      assert(
        names.some(name => name.includes('John') || name.includes('Smith')),
        'Should extract John Smith'
      );
      assert(
        names.some(name => name.includes('Jane') || name.includes('Doe')),
        'Should extract Jane Doe'
      );
    });

    it('should extract tool entities from text', () => {
      const text = 'We use React, Node.js, and PostgreSQL for the backend';
      const entities = extractor.extractFromText(text);

      const tools = entities.filter(e => e.type === ENTITY_TYPES.TOOL);
      assert(tools.length >= 3, 'Should extract at least 3 tool entities');

      const toolNames = tools.map(t => t.value.toLowerCase());
      assert(toolNames.some(name => name.includes('react')), 'Should extract React');
      assert(toolNames.some(name => name.includes('node')), 'Should extract Node.js');
      assert(toolNames.some(name => name.includes('postgresql')), 'Should extract PostgreSQL');
    });

    it('should extract GitHub usernames', () => {
      const text = '@alice and @bob contributed to the project';
      const entities = extractor.extractFromText(text);

      const usernames = entities.filter(
        e => e.type === ENTITY_TYPES.PERSON && e.value.startsWith('alice') || e.value.startsWith('bob')
      );

      assert(usernames.length >= 1, 'Should extract at least one GitHub username');
    });

    it('should extract project entities', () => {
      const text = 'The LLM-RULES project and openai/gpt-4 repository';
      const entities = extractor.extractFromText(text);

      const projects = entities.filter(e => e.type === ENTITY_TYPES.PROJECT);
      assert(projects.length >= 1, 'Should extract at least 1 project entity');
    });

    it('should extract artifact entities', () => {
      const text = 'Please review README.md and package.json files';
      const entities = extractor.extractFromText(text);

      const artifacts = entities.filter(e => e.type === ENTITY_TYPES.ARTIFACT);
      assert(artifacts.length >= 2, 'Should extract at least 2 artifact entities');
    });

    it('should deduplicate entities', () => {
      const text = 'React is great. I love React. React is amazing.';
      const entities = extractor.extractFromText(text);

      const reactEntities = entities.filter(
        e => e.type === ENTITY_TYPES.TOOL && e.value.toLowerCase() === 'react'
      );

      assert.strictEqual(reactEntities.length, 1, 'Should deduplicate React mentions');
    });

    it('should include context for entities', () => {
      const text = 'Alice decided to use TypeScript for the new microservice architecture';
      const entities = extractor.extractFromText(text);

      assert(entities.length > 0, 'Should extract entities');
      assert(entities[0].context, 'Should include context');
      assert(typeof entities[0].context === 'string', 'Context should be string');
    });
  });

  describe('extractFromJSON', () => {
    it('should extract entities from JSON data', () => {
      const data = {
        author: 'Alice Johnson',
        project: 'LLM-RULES',
        tool: 'Node.js',
        repository: 'anthropic/claude',
      };

      const entities = extractor.extractFromJSON(data);

      assert(entities.length >= 4, 'Should extract at least 4 entities');

      const types = new Set(entities.map(e => e.type));
      assert(types.has(ENTITY_TYPES.PERSON), 'Should extract person entity');
      assert(types.has(ENTITY_TYPES.PROJECT), 'Should extract project entity');
      assert(types.has(ENTITY_TYPES.TOOL), 'Should extract tool entity');
    });

    it('should extract from nested JSON', () => {
      const data = {
        user: {
          name: 'Bob Smith',
          team: 'Engineering Team',
        },
        project: {
          name: 'API Gateway',
          framework: 'FastAPI',
        },
      };

      const entities = extractor.extractFromJSON(data);

      assert(entities.length >= 4, 'Should extract entities from nested structure');
    });

    it('should extract from JSON arrays', () => {
      const data = {
        developers: ['Alice', 'Bob', 'Charlie'],
        tools: ['React', 'Vue', 'Angular'],
      };

      const entities = extractor.extractFromJSON(data);

      assert(entities.length >= 6, 'Should extract entities from arrays');
    });

    it('should handle null and undefined values', () => {
      const data = {
        author: 'Alice',
        project: null,
        tool: undefined,
      };

      const entities = extractor.extractFromJSON(data);

      assert(entities.length >= 1, 'Should extract non-null entities');
    });
  });

  describe('classifyEntity', () => {
    it('should classify known tools correctly', () => {
      const classification = extractor.classifyEntity('React');

      assert.strictEqual(classification.type, ENTITY_TYPES.TOOL);
      assert(classification.confidence >= 0.8, 'Should have high confidence for known tools');
    });

    it('should classify org/repo patterns as projects', () => {
      const classification = extractor.classifyEntity('facebook/react');

      assert.strictEqual(classification.type, ENTITY_TYPES.PROJECT);
      assert(classification.confidence >= 0.8);
    });

    it('should classify capitalized names as persons', () => {
      const classification = extractor.classifyEntity('John Smith');

      assert.strictEqual(classification.type, ENTITY_TYPES.PERSON);
      assert(classification.confidence >= 0.7);
    });

    it('should classify URLs as artifacts', () => {
      const classification = extractor.classifyEntity('https://example.com/docs');

      assert.strictEqual(classification.type, ENTITY_TYPES.ARTIFACT);
      assert(classification.confidence >= 0.8);
    });

    it('should classify files as artifacts', () => {
      const classification = extractor.classifyEntity('README.md');

      assert.strictEqual(classification.type, ENTITY_TYPES.ARTIFACT);
      assert(classification.confidence >= 0.7);
    });
  });

  describe('calculateConfidence', () => {
    it('should give high confidence to known tools', () => {
      const confidence = extractor.calculateConfidence(
        ENTITY_TYPES.TOOL,
        'react',
        /React/gi
      );

      assert(confidence >= 0.9, 'Known tools should have high confidence');
    });

    it('should penalize very short values', () => {
      const shortConfidence = extractor.calculateConfidence(
        ENTITY_TYPES.TOOL,
        'js',
        /\w+/g
      );

      assert(shortConfidence < 0.7, 'Short values should have lower confidence');
    });

    it('should penalize very long values', () => {
      const longValue = 'a'.repeat(100);
      const longConfidence = extractor.calculateConfidence(
        ENTITY_TYPES.TOOL,
        longValue,
        /\w+/g
      );

      assert(longConfidence < 0.8, 'Very long values should have lower confidence');
    });
  });
});

describe('Entity Memory', () => {
  let db;
  let entityMemory;

  before(async () => {
    cleanupTestDB();
    db = new MemoryDatabase(TEST_DB_PATH);
    await db.initialize();

    entityMemory = new EntityMemory(db);
    await entityMemory.initialize();
  });

  after(() => {
    if (db) {
      db.close();
    }
    cleanupTestDB();
  });

  describe('CRUD Operations', () => {
    it('should create a new entity', async () => {
      const entityId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'John Doe', {
        role: 'developer',
        confidence: 0.95,
      });

      assert(entityId, 'Should return entity ID');
      assert(typeof entityId === 'string', 'Entity ID should be string');
    });

    it('should retrieve entity by ID', async () => {
      const entityId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'React', {
        version: '18.0',
      });

      const entity = await entityMemory.getEntity(entityId);

      assert(entity, 'Should retrieve entity');
      assert.strictEqual(entity.id, entityId);
      assert.strictEqual(entity.type, ENTITY_TYPES.TOOL);
      assert.strictEqual(entity.value, 'React');
      assert.strictEqual(entity.metadata.version, '18.0');
    });

    it('should update entity metadata', async () => {
      const entityId = await entityMemory.createEntity(ENTITY_TYPES.PROJECT, 'API Gateway');

      await entityMemory.updateEntity(entityId, {
        confidence: 0.99,
        metadata: { status: 'active' },
      });

      const updated = await entityMemory.getEntity(entityId);

      assert.strictEqual(updated.confidence, 0.99);
      assert.strictEqual(updated.metadata.status, 'active');
    });

    it('should soft delete entity', async () => {
      const entityId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'deprecated-lib');

      await entityMemory.deleteEntity(entityId);

      const deleted = await entityMemory.getEntity(entityId);

      assert(deleted, 'Entity should still exist');
      assert.strictEqual(deleted.is_active, 0, 'Entity should be marked inactive');
    });

    it('should increment occurrence count for duplicate entities', async () => {
      const firstId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Alice Smith');
      const secondId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Alice Smith');

      assert.strictEqual(firstId, secondId, 'Should return same ID for duplicate');

      const entity = await entityMemory.getEntity(firstId);
      assert.strictEqual(entity.occurrence_count, 2, 'Occurrence count should increment');
    });
  });

  describe('Entity Attributes', () => {
    it('should add attributes to entity', async () => {
      const entityId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Bob Developer');

      await entityMemory.addAttribute(entityId, 'email', 'bob@example.com');
      await entityMemory.addAttribute(entityId, 'team', 'Engineering');

      const entity = await entityMemory.getEntity(entityId);

      assert(entity.attributes, 'Should have attributes');
      assert.strictEqual(entity.attributes.length, 2);

      const emailAttr = entity.attributes.find(a => a.key === 'email');
      assert.strictEqual(emailAttr.value, 'bob@example.com');
    });
  });

  describe('Relationships', () => {
    it('should create relationship between entities', async () => {
      const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Charlie Dev');
      const projectId = await entityMemory.createEntity(ENTITY_TYPES.PROJECT, 'Mobile App');

      const relId = await entityMemory.addRelationship(
        personId,
        projectId,
        RELATIONSHIP_TYPES.CONTRIBUTED_TO
      );

      assert(relId, 'Should return relationship ID');
    });

    it('should retrieve relationships for entity', async () => {
      const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Diana Engineer');
      const tool1Id = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'TypeScript');
      const tool2Id = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'Python');

      await entityMemory.addRelationship(personId, tool1Id, RELATIONSHIP_TYPES.USES);
      await entityMemory.addRelationship(personId, tool2Id, RELATIONSHIP_TYPES.USES);

      const relationships = await entityMemory.getRelationships(personId);

      assert.strictEqual(relationships.length, 2, 'Should have 2 relationships');
      assert(relationships.every(r => r.relationship_type === RELATIONSHIP_TYPES.USES));
    });

    it('should filter relationships by type', async () => {
      const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Eve Developer');
      const projectId = await entityMemory.createEntity(ENTITY_TYPES.PROJECT, 'Dashboard');
      const toolId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'Vue');

      await entityMemory.addRelationship(personId, projectId, RELATIONSHIP_TYPES.CONTRIBUTED_TO);
      await entityMemory.addRelationship(personId, toolId, RELATIONSHIP_TYPES.USES);

      const contributedRels = await entityMemory.getRelationships(
        personId,
        RELATIONSHIP_TYPES.CONTRIBUTED_TO
      );

      assert.strictEqual(contributedRels.length, 1);
      assert.strictEqual(contributedRels[0].relationship_type, RELATIONSHIP_TYPES.CONTRIBUTED_TO);
    });

    it('should increment relationship strength for duplicates', async () => {
      const person1Id = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Frank Dev');
      const person2Id = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Grace Dev');

      const firstRelId = await entityMemory.addRelationship(
        person1Id,
        person2Id,
        RELATIONSHIP_TYPES.WORKED_WITH
      );

      const secondRelId = await entityMemory.addRelationship(
        person1Id,
        person2Id,
        RELATIONSHIP_TYPES.WORKED_WITH,
        { strength: 0.1 }
      );

      assert.strictEqual(firstRelId, secondRelId, 'Should return same relationship ID');

      const relationships = await entityMemory.getRelationships(person1Id);
      const rel = relationships[0];

      assert(rel.strength > 1.0, 'Strength should have increased');
    });
  });

  describe('Search and Query', () => {
    it('should search entities by value', async () => {
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'React Native');
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'React Router');

      const results = await entityMemory.searchEntities('React');

      assert(results.length >= 2, 'Should find multiple React-related entities');
      assert(results.every(e => e.value.includes('React')));
    });

    it('should filter search by entity type', async () => {
      await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Test Developer');
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'Test Framework');

      const personResults = await entityMemory.searchEntities('Test', ENTITY_TYPES.PERSON);

      assert(personResults.length >= 1, 'Should find person entities');
      assert(personResults.every(e => e.type === ENTITY_TYPES.PERSON));
    });

    it('should limit search results', async () => {
      // Create many entities
      for (let i = 0; i < 20; i++) {
        await entityMemory.createEntity(ENTITY_TYPES.TOOL, `Tool-${i}`);
      }

      const results = await entityMemory.searchEntities('Tool', null, 5);

      assert.strictEqual(results.length, 5, 'Should respect limit parameter');
    });

    it('should sort results by occurrence count and recency', async () => {
      const oldId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'OldTool');
      const newId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'NewTool');

      // Create duplicate of NewTool to increase occurrence
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'NewTool');

      const results = await entityMemory.searchEntities('Tool');

      // NewTool should come first (higher occurrence count)
      assert.strictEqual(results[0].value, 'NewTool');
    });
  });

  describe('Entity History', () => {
    it('should track entity history timeline', async () => {
      const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'History Test');
      const toolId = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'History Tool');

      await entityMemory.addRelationship(personId, toolId, RELATIONSHIP_TYPES.USES);

      const history = await entityMemory.getEntityHistory(personId);

      assert(history.length >= 3, 'Should have at least 3 history events');

      const events = history.map(h => h.event);
      assert(events.includes('first_seen'));
      assert(events.includes('last_seen'));
      assert(events.includes('relationship_created'));
    });

    it('should sort history by timestamp', async () => {
      const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Timeline Test');

      const history = await entityMemory.getEntityHistory(personId);

      // Verify chronological order
      for (let i = 1; i < history.length; i++) {
        const prev = new Date(history[i - 1].timestamp);
        const curr = new Date(history[i].timestamp);
        assert(prev <= curr, 'History should be in chronological order');
      }
    });
  });

  describe('Utility Functions', () => {
    it('should get entities by type', async () => {
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'ByType Tool 1');
      await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'ByType Tool 2');
      await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'ByType Person');

      const tools = await entityMemory.getEntitiesByType(ENTITY_TYPES.TOOL);

      assert(tools.length >= 2, 'Should find tool entities');
      assert(tools.every(e => e.type === ENTITY_TYPES.TOOL));
    });

    it('should generate entity statistics', async () => {
      const stats = await entityMemory.getStats();

      assert(stats.entities, 'Should have entity stats');
      assert(Array.isArray(stats.entities), 'Entity stats should be array');

      assert(stats.relationships, 'Should have relationship stats');
      assert(Array.isArray(stats.relationships), 'Relationship stats should be array');

      assert(stats.timestamp, 'Should have timestamp');
    });
  });
});

describe('Integration Tests', () => {
  let db;
  let entityMemory;
  let extractor;

  before(async () => {
    cleanupTestDB();
    db = new MemoryDatabase(TEST_DB_PATH);
    await db.initialize();

    entityMemory = new EntityMemory(db);
    await entityMemory.initialize();

    extractor = new EntityExtractor();
  });

  after(() => {
    if (db) {
      db.close();
    }
    cleanupTestDB();
  });

  it('should extract and store entities from text', async () => {
    const text = 'Alice decided to use React and TypeScript for the Dashboard project';

    const entities = extractor.extractFromText(text);

    // Store all extracted entities
    const entityIds = [];
    for (const entity of entities) {
      const id = await entityMemory.createEntity(entity.type, entity.value, {
        confidence: entity.confidence,
        context: entity.context,
      });
      entityIds.push(id);
    }

    assert(entityIds.length > 0, 'Should store extracted entities');

    // Verify stored entities
    for (const id of entityIds) {
      const stored = await entityMemory.getEntity(id);
      assert(stored, 'Stored entity should be retrievable');
    }
  });

  it('should build knowledge graph from conversation', async () => {
    // Simulate conversation
    const messages = [
      'Bob joined the Engineering Team',
      'Bob uses Python and FastAPI for backend development',
      'Bob contributed to the API Gateway project',
    ];

    // Extract and store entities
    const personId = await entityMemory.createEntity(ENTITY_TYPES.PERSON, 'Bob');
    const orgId = await entityMemory.createEntity(ENTITY_TYPES.ORGANIZATION, 'Engineering Team');
    const tool1Id = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'Python');
    const tool2Id = await entityMemory.createEntity(ENTITY_TYPES.TOOL, 'FastAPI');
    const projectId = await entityMemory.createEntity(ENTITY_TYPES.PROJECT, 'API Gateway');

    // Create relationships
    await entityMemory.addRelationship(personId, orgId, RELATIONSHIP_TYPES.BELONGS_TO);
    await entityMemory.addRelationship(personId, tool1Id, RELATIONSHIP_TYPES.USES);
    await entityMemory.addRelationship(personId, tool2Id, RELATIONSHIP_TYPES.USES);
    await entityMemory.addRelationship(personId, projectId, RELATIONSHIP_TYPES.CONTRIBUTED_TO);

    // Verify graph structure
    const bob = await entityMemory.getEntity(personId);
    assert.strictEqual(bob.relationships.length, 4, 'Bob should have 4 relationships');

    const history = await entityMemory.getEntityHistory(personId);
    assert(history.length >= 6, 'Should have comprehensive history');
  });

  it('should handle cross-session entity retrieval', async () => {
    // Session 1: Create entities
    const sessionId = await entityMemory.createEntity(ENTITY_TYPES.PROJECT, 'Cross Session Test');

    // Session 2: Retrieve by search
    const results = await entityMemory.searchEntities('Cross Session');

    assert(results.length >= 1, 'Should find entity across sessions');
    assert.strictEqual(results[0].id, sessionId);
  });
});
