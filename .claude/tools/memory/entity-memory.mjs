/**
 * Entity Memory Manager
 *
 * Graph-based storage for entities with CRUD operations and relationship tracking
 *
 * Performance Targets:
 * - Entity creation: <5ms
 * - Entity retrieval: <10ms
 * - Relationship creation: <5ms
 * - Search queries: <50ms
 *
 * Features:
 * - Entity CRUD operations
 * - Relationship management (graph edges)
 * - Entity attributes (key-value pairs)
 * - Search and query operations
 * - Occurrence tracking
 * - Temporal tracking (first_seen, last_seen)
 */

import { randomUUID } from 'crypto';
import { ENTITY_TYPES } from './entity-extractor.mjs';

/**
 * Relationship types enumeration
 */
export const RELATIONSHIP_TYPES = {
  WORKED_WITH: 'worked_with', // Person ↔ Person
  DECIDED_ON: 'decided_on', // Person → Decision
  CONTRIBUTED_TO: 'contributed_to', // Person → Project
  USED_IN: 'used_in', // Tool → Project
  DEPENDS_ON: 'depends_on', // Project → Tool
  CREATED: 'created', // Person → Artifact
  BELONGS_TO: 'belongs_to', // Person → Organization
  USES: 'uses', // Person → Tool
};

/**
 * Entity Memory Manager
 */
export class EntityMemory {
  /**
   * @param {object} database - MemoryDatabase instance
   */
  constructor(database) {
    this.db = database;
    this.isInitialized = false;
  }

  /**
   * Initialize entity memory schema
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (!this.db.isInitialized) {
      await this.db.initialize();
    }

    // Create entity tables
    this.initializeSchema();

    this.isInitialized = true;
    console.log('[Entity Memory] Initialized');
  }

  /**
   * Initialize database schema for entities
   */
  initializeSchema() {
    const startTime = Date.now();

    // Entities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        context TEXT,
        metadata TEXT,
        occurrence_count INTEGER DEFAULT 1,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Entity attributes (key-value pairs)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
      );
    `);

    // Entity relationships (graph edges)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id_1 TEXT NOT NULL,
        entity_id_2 TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        strength REAL DEFAULT 1.0,
        context TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id_1) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (entity_id_2) REFERENCES entities(id) ON DELETE CASCADE
      );
    `);

    // Create indices for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_value ON entities(value);
      CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(is_active);
      CREATE INDEX IF NOT EXISTS idx_entity_attributes_entity_id ON entity_attributes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_entity1 ON entity_relationships(entity_id_1);
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_entity2 ON entity_relationships(entity_id_2);
      CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON entity_relationships(relationship_type);
    `);

    const duration = Date.now() - startTime;
    console.log(`[Entity Memory] Schema initialized in ${duration}ms`);
  }

  /**
   * Create a new entity
   *
   * @param {string} type - Entity type
   * @param {string} value - Entity value
   * @param {object} metadata - Additional metadata
   * @returns {Promise<string>} Entity ID
   */
  async createEntity(type, value, metadata = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if entity already exists
    const existing = await this.findEntityByValue(value, type);

    if (existing) {
      // Update occurrence count and last_seen
      await this.updateEntity(existing.id, {
        occurrence_count: existing.occurrence_count + 1,
        last_seen: new Date().toISOString(),
      });

      return existing.id;
    }

    // Create new entity
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO entities (id, type, value, confidence, context, metadata, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      type,
      value,
      metadata.confidence || 1.0,
      metadata.context || null,
      JSON.stringify(metadata),
      now,
      now
    );

    return id;
  }

  /**
   * Find entity by value and type
   *
   * @param {string} value - Entity value
   * @param {string} type - Entity type (optional)
   * @returns {Promise<object|null>} Entity or null
   */
  async findEntityByValue(value, type = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sql = type
      ? `SELECT * FROM entities WHERE value = ? AND type = ? AND is_active = 1`
      : `SELECT * FROM entities WHERE value = ? AND is_active = 1`;

    const params = type ? [value, type] : [value];

    const stmt = this.db.prepare(sql);
    const entity = stmt.get(...params);

    if (entity && entity.metadata) {
      entity.metadata = JSON.parse(entity.metadata);
    }

    return entity || null;
  }

  /**
   * Get entity by ID
   *
   * @param {string} id - Entity ID
   * @returns {Promise<object|null>} Entity with attributes and relationships
   */
  async getEntity(id) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entityStmt = this.db.prepare(`
      SELECT * FROM entities WHERE id = ?
    `);

    const entity = entityStmt.get(id);

    if (!entity) {
      return null;
    }

    // Parse metadata
    if (entity.metadata) {
      entity.metadata = JSON.parse(entity.metadata);
    }

    // Get attributes
    const attributesStmt = this.db.prepare(`
      SELECT key, value FROM entity_attributes WHERE entity_id = ?
    `);

    entity.attributes = attributesStmt.all(id);

    // Get relationships
    entity.relationships = await this.getRelationships(id);

    return entity;
  }

  /**
   * Update entity
   *
   * @param {string} id - Entity ID
   * @param {object} updates - Fields to update
   * @returns {Promise<void>}
   */
  async updateEntity(id, updates) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const fields = [];
    const values = [];

    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context);
    }

    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.occurrence_count !== undefined) {
      fields.push('occurrence_count = ?');
      values.push(updates.occurrence_count);
    }

    if (updates.last_seen !== undefined) {
      fields.push('last_seen = ?');
      values.push(updates.last_seen);
    }

    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE entities SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Delete entity (soft delete)
   *
   * @param {string} id - Entity ID
   * @returns {Promise<void>}
   */
  async deleteEntity(id) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stmt = this.db.prepare(`
      UPDATE entities SET is_active = 0 WHERE id = ?
    `);

    stmt.run(id);
  }

  /**
   * Add entity attribute
   *
   * @param {string} entityId - Entity ID
   * @param {string} key - Attribute key
   * @param {string} value - Attribute value
   * @returns {Promise<void>}
   */
  async addAttribute(entityId, key, value) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stmt = this.db.prepare(`
      INSERT INTO entity_attributes (entity_id, key, value)
      VALUES (?, ?, ?)
    `);

    stmt.run(entityId, key, value);
  }

  /**
   * Add relationship between entities
   *
   * @param {string} entityId1 - First entity ID
   * @param {string} entityId2 - Second entity ID
   * @param {string} relationshipType - Relationship type
   * @param {object} options - Additional options
   * @returns {Promise<number>} Relationship ID
   */
  async addRelationship(entityId1, entityId2, relationshipType, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if relationship already exists
    const existingStmt = this.db.prepare(`
      SELECT id, strength FROM entity_relationships
      WHERE entity_id_1 = ? AND entity_id_2 = ? AND relationship_type = ?
    `);

    const existing = existingStmt.get(entityId1, entityId2, relationshipType);

    if (existing) {
      // Update strength (increment)
      const newStrength = existing.strength + (options.strength || 0.1);

      const updateStmt = this.db.prepare(`
        UPDATE entity_relationships SET strength = ? WHERE id = ?
      `);

      updateStmt.run(newStrength, existing.id);

      return existing.id;
    }

    // Create new relationship
    const stmt = this.db.prepare(`
      INSERT INTO entity_relationships (entity_id_1, entity_id_2, relationship_type, strength, context)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entityId1,
      entityId2,
      relationshipType,
      options.strength || 1.0,
      options.context || null
    );

    return result.lastInsertRowid;
  }

  /**
   * Get relationships for an entity
   *
   * @param {string} entityId - Entity ID
   * @param {string} relationshipType - Filter by relationship type (optional)
   * @returns {Promise<Array>} Relationships
   */
  async getRelationships(entityId, relationshipType = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sql = relationshipType
      ? `
          SELECT r.*, e.type as related_type, e.value as related_value
          FROM entity_relationships r
          JOIN entities e ON (r.entity_id_2 = e.id)
          WHERE r.entity_id_1 = ? AND r.relationship_type = ?
        `
      : `
          SELECT r.*, e.type as related_type, e.value as related_value
          FROM entity_relationships r
          JOIN entities e ON (r.entity_id_2 = e.id)
          WHERE r.entity_id_1 = ?
        `;

    const params = relationshipType ? [entityId, relationshipType] : [entityId];

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Search entities
   *
   * @param {string} query - Search query
   * @param {string} type - Entity type filter (optional)
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Matching entities
   */
  async searchEntities(query, type = null, limit = 10) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sql = type
      ? `
          SELECT * FROM entities
          WHERE value LIKE ? AND type = ? AND is_active = 1
          ORDER BY occurrence_count DESC, last_seen DESC
          LIMIT ?
        `
      : `
          SELECT * FROM entities
          WHERE value LIKE ? AND is_active = 1
          ORDER BY occurrence_count DESC, last_seen DESC
          LIMIT ?
        `;

    const searchPattern = `%${query}%`;
    const params = type ? [searchPattern, type, limit] : [searchPattern, limit];

    const stmt = this.db.prepare(sql);
    const entities = stmt.all(...params);

    // Parse metadata for each entity
    return entities.map(entity => {
      if (entity.metadata) {
        entity.metadata = JSON.parse(entity.metadata);
      }
      return entity;
    });
  }

  /**
   * Get entity history (timeline of mentions)
   *
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array>} History timeline
   */
  async getEntityHistory(entityId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entity = await this.getEntity(entityId);

    if (!entity) {
      return [];
    }

    // Build timeline from entity data
    const timeline = [
      {
        event: 'first_seen',
        timestamp: entity.first_seen,
        details: `First occurrence of ${entity.value}`,
      },
      {
        event: 'last_seen',
        timestamp: entity.last_seen,
        details: `Most recent occurrence (total: ${entity.occurrence_count})`,
      },
    ];

    // Add relationship creation events
    const relationshipsStmt = this.db.prepare(`
      SELECT r.*, e.value as related_value, e.type as related_type
      FROM entity_relationships r
      JOIN entities e ON r.entity_id_2 = e.id
      WHERE r.entity_id_1 = ?
      ORDER BY r.created_at
    `);

    const relationships = relationshipsStmt.all(entityId);

    for (const rel of relationships) {
      timeline.push({
        event: 'relationship_created',
        timestamp: rel.created_at,
        details: `${rel.relationship_type}: ${rel.related_value} (${rel.related_type})`,
        relationship_type: rel.relationship_type,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return timeline;
  }

  /**
   * Get entities by type
   *
   * @param {string} type - Entity type
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Entities of specified type
   */
  async getEntitiesByType(type, limit = 50) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stmt = this.db.prepare(`
      SELECT * FROM entities
      WHERE type = ? AND is_active = 1
      ORDER BY occurrence_count DESC, last_seen DESC
      LIMIT ?
    `);

    const entities = stmt.all(type, limit);

    return entities.map(entity => {
      if (entity.metadata) {
        entity.metadata = JSON.parse(entity.metadata);
      }
      return entity;
    });
  }

  /**
   * Get statistics about entities
   *
   * @returns {Promise<object>} Entity statistics
   */
  async getStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const statsStmt = this.db.prepare(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(occurrence_count) as total_occurrences
      FROM entities
      WHERE is_active = 1
      GROUP BY type
    `);

    const typeStats = statsStmt.all();

    const relationshipStatsStmt = this.db.prepare(`
      SELECT
        relationship_type,
        COUNT(*) as count,
        AVG(strength) as avg_strength
      FROM entity_relationships
      GROUP BY relationship_type
    `);

    const relationshipStats = relationshipStatsStmt.all();

    return {
      entities: typeStats,
      relationships: relationshipStats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create entity with shared registry (Phase 4)
   *
   * Uses SharedEntityRegistry for global entity deduplication
   *
   * @param {string} type - Entity type
   * @param {string} value - Entity value
   * @param {object} metadata - Additional metadata
   * @param {string} agentId - Agent ID creating the entity
   * @returns {Promise<string>} Entity ID
   */
  async createEntityWithRegistry(type, value, metadata = {}, agentId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Use shared entity registry
      const { createSharedEntityRegistry } = await import('./shared-entity-registry.mjs');
      const registry = createSharedEntityRegistry({
        database: this.db,
        entityMemory: this,
      });
      await registry.initialize();

      // Get or create global entity
      const entity = await registry.getGlobalEntity({
        type,
        value,
        agentId,
        metadata,
      });

      return entity.id;
    } catch (error) {
      console.warn('[Entity Memory] Shared registry unavailable, using local creation:', error.message);
      // Fallback to local creation
      return await this.createEntity(type, value, metadata);
    }
  }
}

/**
 * Create entity memory manager
 *
 * @param {object} database - MemoryDatabase instance
 * @returns {EntityMemory}
 */
export function createEntityMemory(database) {
  return new EntityMemory(database);
}
