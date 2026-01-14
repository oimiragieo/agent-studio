/**
 * Entity-A2A Converter
 *
 * Converts between entity memory format and A2A DataPart format.
 * Provides schema validation for entity data integrity.
 *
 * Features:
 * - Entity → A2A DataPart conversion
 * - DataPart → Entity extraction
 * - Schema validation
 * - Relationship preservation
 * - Metadata tracking
 *
 * @module entity-a2a-converter
 */

import { randomUUID } from 'crypto';

/**
 * A2A DataPart schema for entities
 */
const ENTITY_DATA_PART_SCHEMA = {
  type: 'object',
  required: ['entities'],
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['entityId', 'entityType', 'name'],
        properties: {
          entityId: { type: 'string' },
          entityType: { type: 'string' },
          name: { type: 'string' },
          attributes: { type: 'object' },
          relationships: { type: 'array' },
          mentions: { type: 'number' },
          metadata: { type: 'object' },
        },
      },
    },
    version: { type: 'string' },
    timestamp: { type: 'string' },
  },
};

/**
 * Entity-A2A Converter
 *
 * Converts entities to/from A2A DataPart format
 */
export class EntityA2AConverter {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.schema = options.schema || ENTITY_DATA_PART_SCHEMA;
    this.version = options.version || '1.0.0';
  }

  /**
   * Convert entities to A2A DataPart
   *
   * @param {Array} entities - Entity objects
   * @returns {Promise<object>} A2A DataPart
   */
  async toA2ADataPart(entities) {
    const startTime = Date.now();

    if (!Array.isArray(entities)) {
      throw new Error('Entities must be an array');
    }

    // Convert entities to A2A format
    const a2aEntities = entities.map(entity => this.convertEntityToA2AFormat(entity));

    // Build DataPart
    const dataPart = {
      data: {
        entities: a2aEntities,
        version: this.version,
        timestamp: new Date().toISOString(),
      },
    };

    // Validate schema
    const validation = this.validateEntityDataPart(dataPart);
    if (!validation.valid) {
      throw new Error(`Entity DataPart validation failed: ${validation.errors.join(', ')}`);
    }

    const duration = Date.now() - startTime;

    console.log(
      `[Entity-A2A Converter] Converted ${entities.length} entities to DataPart in ${duration}ms`
    );

    return dataPart;
  }

  /**
   * Convert A2A DataPart to entities
   *
   * @param {object} dataPart - A2A DataPart
   * @returns {Promise<Array>} Entity objects
   */
  async fromA2ADataPart(dataPart) {
    const startTime = Date.now();

    if (!dataPart || !dataPart.data) {
      throw new Error('Invalid DataPart: data object required');
    }

    // Validate schema
    const validation = this.validateEntityDataPart(dataPart);
    if (!validation.valid) {
      throw new Error(`Entity DataPart validation failed: ${validation.errors.join(', ')}`);
    }

    // Extract entities
    const entities = (dataPart.data.entities || []).map(a2aEntity =>
      this.convertA2AFormatToEntity(a2aEntity)
    );

    const duration = Date.now() - startTime;

    console.log(
      `[Entity-A2A Converter] Converted DataPart to ${entities.length} entities in ${duration}ms`
    );

    return entities;
  }

  /**
   * Convert entity object to A2A format
   *
   * @param {object} entity - Legacy entity object
   * @returns {object} A2A entity format
   */
  convertEntityToA2AFormat(entity) {
    return {
      entityId: entity.entityId || entity.id || randomUUID(),
      entityType: entity.entityType || entity.type || 'unknown',
      name: entity.name || entity.value || '',
      attributes: this.convertAttributes(entity.attributes || {}),
      relationships: this.convertRelationships(entity.relationships || []),
      mentions: entity.mentions || entity.occurrence_count || 1,
      metadata: {
        confidence: entity.confidence || 1.0,
        context: entity.context || null,
        firstSeen: entity.first_seen || entity.created_at,
        lastSeen: entity.last_seen || entity.updated_at,
        isActive: entity.is_active !== undefined ? entity.is_active : true,
      },
    };
  }

  /**
   * Convert A2A format to entity object
   *
   * @param {object} a2aEntity - A2A entity format
   * @returns {object} Legacy entity object
   */
  convertA2AFormatToEntity(a2aEntity) {
    return {
      id: a2aEntity.entityId,
      type: a2aEntity.entityType,
      value: a2aEntity.name,
      attributes: this.convertA2AAttributes(a2aEntity.attributes || {}),
      relationships: this.convertA2ARelationships(a2aEntity.relationships || []),
      occurrence_count: a2aEntity.mentions || 1,
      confidence: a2aEntity.metadata?.confidence || 1.0,
      context: a2aEntity.metadata?.context || null,
      first_seen: a2aEntity.metadata?.firstSeen,
      last_seen: a2aEntity.metadata?.lastSeen,
      is_active: a2aEntity.metadata?.isActive !== undefined ? a2aEntity.metadata.isActive : true,
    };
  }

  /**
   * Convert entity attributes to A2A format
   *
   * @param {object} attributes - Legacy attributes
   * @returns {object} A2A attributes
   */
  convertAttributes(attributes) {
    // Attributes are already key-value pairs
    // Just ensure they're serializable
    const converted = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'object' && value !== null) {
        converted[key] = JSON.stringify(value);
      } else {
        converted[key] = String(value);
      }
    }

    return converted;
  }

  /**
   * Convert A2A attributes to legacy format
   *
   * @param {object} a2aAttributes - A2A attributes
   * @returns {object} Legacy attributes
   */
  convertA2AAttributes(a2aAttributes) {
    const converted = {};

    for (const [key, value] of Object.entries(a2aAttributes)) {
      try {
        // Try to parse JSON strings
        converted[key] = JSON.parse(value);
      } catch {
        // Keep as string if not JSON
        converted[key] = value;
      }
    }

    return converted;
  }

  /**
   * Convert entity relationships to A2A format
   *
   * @param {Array} relationships - Legacy relationships
   * @returns {Array} A2A relationships
   */
  convertRelationships(relationships) {
    return relationships.map(rel => ({
      relatedEntityId: rel.entity_id_2 || rel.relatedEntityId,
      relationshipType: rel.relationship_type || rel.relationshipType,
      strength: rel.strength || 1.0,
      context: rel.context || null,
    }));
  }

  /**
   * Convert A2A relationships to legacy format
   *
   * @param {Array} a2aRelationships - A2A relationships
   * @returns {Array} Legacy relationships
   */
  convertA2ARelationships(a2aRelationships) {
    return a2aRelationships.map(rel => ({
      entity_id_2: rel.relatedEntityId,
      relationship_type: rel.relationshipType,
      strength: rel.strength || 1.0,
      context: rel.context || null,
    }));
  }

  /**
   * Validate entity DataPart against schema
   *
   * @param {object} dataPart - A2A DataPart
   * @returns {object} Validation result { valid: boolean, errors: string[] }
   */
  validateEntityDataPart(dataPart) {
    const errors = [];

    if (!dataPart) {
      return { valid: false, errors: ['DataPart is null or undefined'] };
    }

    if (!dataPart.data) {
      errors.push('Missing required field: data');
      return { valid: false, errors }; // Early return to prevent accessing undefined
    }

    if (!dataPart.data.entities) {
      errors.push('Missing required field: data.entities');
    } else if (!Array.isArray(dataPart.data.entities)) {
      errors.push('data.entities must be an array');
    } else {
      // Validate each entity
      dataPart.data.entities.forEach((entity, index) => {
        if (!entity.entityId) {
          errors.push(`Entity ${index}: missing entityId`);
        }
        if (!entity.entityType) {
          errors.push(`Entity ${index}: missing entityType`);
        }
        if (!entity.name) {
          errors.push(`Entity ${index}: missing name`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Merge entity DataParts
   *
   * Combines multiple DataParts into a single DataPart, deduplicating entities
   *
   * @param {Array} dataParts - Array of A2A DataParts
   * @returns {Promise<object>} Merged DataPart
   */
  async mergeDataParts(dataParts) {
    const startTime = Date.now();

    if (!Array.isArray(dataParts)) {
      throw new Error('dataParts must be an array');
    }

    const entityMap = new Map();

    // Merge entities by ID
    for (const dataPart of dataParts) {
      if (!dataPart.data || !dataPart.data.entities) {
        continue;
      }

      for (const entity of dataPart.data.entities) {
        const existingEntity = entityMap.get(entity.entityId);

        if (existingEntity) {
          // Merge mentions
          existingEntity.mentions += entity.mentions || 1;

          // Merge attributes
          existingEntity.attributes = {
            ...existingEntity.attributes,
            ...entity.attributes,
          };

          // Merge relationships
          const relIds = new Set(existingEntity.relationships.map(r => r.relatedEntityId));
          for (const rel of entity.relationships || []) {
            if (!relIds.has(rel.relatedEntityId)) {
              existingEntity.relationships.push(rel);
              relIds.add(rel.relatedEntityId);
            }
          }
        } else {
          entityMap.set(entity.entityId, { ...entity });
        }
      }
    }

    // Build merged DataPart
    const mergedDataPart = {
      data: {
        entities: Array.from(entityMap.values()),
        version: this.version,
        timestamp: new Date().toISOString(),
      },
    };

    const duration = Date.now() - startTime;

    console.log(
      `[Entity-A2A Converter] Merged ${dataParts.length} DataParts into ${mergedDataPart.data.entities.length} entities in ${duration}ms`
    );

    return mergedDataPart;
  }
}

/**
 * Create Entity-A2A Converter
 *
 * @param {object} options - Configuration options
 * @returns {EntityA2AConverter}
 */
export function createEntityA2AConverter(options = {}) {
  return new EntityA2AConverter(options);
}
