/**
 * Shared Entity Registry
 *
 * Global entity storage with deduplication and conflict resolution
 *
 * Features:
 * - Global entity access (cross-agent, cross-session)
 * - Automatic entity deduplication
 * - Conflict resolution for duplicate entities
 * - Entity versioning and merge tracking
 *
 * Performance Targets:
 * - Entity lookup: <10ms
 * - Entity merge: <50ms
 * - Conflict resolution: <100ms
 *
 * Use Cases:
 * - Analyst creates "TypeScript" entity
 * - Developer also creates "TypeScript" entity
 * - Registry merges into single global entity
 *
 * @module shared-entity-registry
 */

/**
 * Merge Strategy for Conflict Resolution
 */
export const MergeStrategy = {
  NEWEST_WINS: 'newest_wins', // Use most recent data
  HIGHEST_CONFIDENCE: 'highest_confidence', // Use data with highest confidence
  MERGE_CONTEXT: 'merge_context', // Combine context from both
  MANUAL: 'manual', // Require manual resolution
};

/**
 * Shared Entity Registry
 *
 * Manages global entity storage with deduplication
 */
export class SharedEntityRegistry {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.db = options.database || null;
    this.entityMemory = options.entityMemory || null;

    this.config = {
      mergeStrategy: options.mergeStrategy || MergeStrategy.MERGE_CONTEXT,
      similarityThreshold: options.similarityThreshold || 0.85,
      enableVersioning: options.enableVersioning !== false,
      maxContextLength: options.maxContextLength || 1000,
      ...options.config,
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the entity registry
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize database
    if (!this.db?.isInitialized) {
      if (!this.db) {
        const { createMemoryDatabase } = await import('./database.mjs');
        this.db = createMemoryDatabase();
      }
      await this.db.initialize();
    }

    // Initialize entity memory
    if (!this.entityMemory) {
      const { createEntityMemory } = await import('./entity-memory.mjs');
      this.entityMemory = createEntityMemory(this.db);
      await this.entityMemory.initialize();
    }

    this.isInitialized = true;
    console.log('[Shared Entity Registry] Initialized');
  }

  /**
   * Get or create global entity
   *
   * Checks if entity exists globally, creates if not, merges if duplicate
   *
   * @param {object} params - Entity parameters
   * @returns {Promise<object>} Entity record
   */
  async getGlobalEntity(params) {
    await this.ensureInitialized();

    const { type, value, agentId, metadata = {} } = params;

    if (!type || !value) {
      throw new Error('type and value are required');
    }

    // 1. Check for exact match
    const exactMatch = await this.findExactMatch(type, value);

    if (exactMatch) {
      // Check if this is from a different agent - if so, treat as merge
      if (agentId && exactMatch.last_updated_by_agent !== agentId) {
        // Different agent accessing - increment merge_count
        await this.updateEntityAccessWithMerge(exactMatch.id, agentId);
      } else {
        // Same agent or no agent - just update access
        await this.updateEntityAccess(exactMatch.id, agentId);
      }
      // Refetch to get updated counts
      return await this.entityMemory.getEntity(exactMatch.id);
    }

    // 2. Check for similar entities (fuzzy match)
    const similarEntities = await this.findSimilarEntities(type, value);

    if (similarEntities.length > 0) {
      // Merge with most similar entity
      const bestMatch = similarEntities[0];
      return await this.mergeEntities(bestMatch, { type, value, agentId, metadata });
    }

    // 3. Create new global entity
    return await this.createGlobalEntity({ type, value, agentId, metadata });
  }

  /**
   * Find exact match for entity
   *
   * @param {string} type - Entity type
   * @param {string} value - Entity value
   * @returns {Promise<object|null>} Entity if found
   */
  async findExactMatch(type, value) {
    const stmt = this.db.prepare(`
      SELECT * FROM entities
      WHERE type = ?
      AND value = ?
      AND is_active = 1
      LIMIT 1
    `);

    const entity = stmt.get(type, value);

    if (!entity) {
      return null;
    }

    return {
      ...entity,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : {},
    };
  }

  /**
   * Find similar entities using fuzzy matching
   *
   * @param {string} type - Entity type
   * @param {string} value - Entity value
   * @returns {Promise<Array>} Similar entities
   */
  async findSimilarEntities(type, value) {
    // Get all entities of same type
    const stmt = this.db.prepare(`
      SELECT * FROM entities
      WHERE type = ?
      AND is_active = 1
    `);

    const candidates = stmt.all(type);

    // Calculate similarity scores
    const scored = candidates.map(entity => ({
      ...entity,
      similarity: this.calculateSimilarity(value, entity.value),
      metadata: entity.metadata ? JSON.parse(entity.metadata) : {},
    }));

    // Filter by threshold and sort by similarity
    return scored
      .filter(e => e.similarity >= this.config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate similarity between two strings
   *
   * Uses Levenshtein distance normalized to [0, 1]
   *
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match
    if (s1 === s2) {
      return 1.0;
    }

    // Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance
   *
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Create new global entity
   *
   * @param {object} params - Entity parameters
   * @returns {Promise<object>} Created entity
   */
  async createGlobalEntity(params) {
    const { type, value, agentId, metadata } = params;

    // Create entity via entity memory
    const entityId = await this.entityMemory.createEntity(type, value, metadata);

    // Mark as global
    const stmt = this.db.prepare(`
      UPDATE entities
      SET is_global = TRUE,
          last_updated_by_agent = ?
      WHERE id = ?
    `);

    stmt.run(agentId, entityId);

    console.log(`[Shared Entity Registry] Created global entity: ${value} (${type})`);

    return await this.entityMemory.getEntity(entityId);
  }

  /**
   * Merge entities
   *
   * Combines data from existing entity and new entity data
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {Promise<object>} Merged entity
   */
  async mergeEntities(existingEntity, newEntityData) {
    const { agentId, metadata: newMetadata } = newEntityData;

    // Resolve conflicts based on strategy
    const mergedData = this.resolveConflict(existingEntity, newEntityData);

    // Increment version and merge count FIRST
    const stmt = this.db.prepare(`
      UPDATE entities
      SET version = version + 1,
          merge_count = merge_count + 1,
          last_updated_by_agent = ?,
          occurrence_count = occurrence_count + 1,
          last_seen = ?
      WHERE id = ?
    `);

    stmt.run(agentId, new Date().toISOString(), existingEntity.id);

    // Update entity with merged data
    const updates = {
      context: mergedData.context,
      metadata: mergedData.metadata,
      confidence: mergedData.confidence,
    };

    await this.entityMemory.updateEntity(existingEntity.id, updates);

    console.log(
      `[Shared Entity Registry] Merged entity: ${existingEntity.value} (version ${existingEntity.version + 1})`
    );

    return await this.entityMemory.getEntity(existingEntity.id);
  }

  /**
   * Resolve conflict between existing and new entity data
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {object} Resolved data
   */
  resolveConflict(existingEntity, newEntityData) {
    const strategy = this.config.mergeStrategy;

    switch (strategy) {
      case MergeStrategy.NEWEST_WINS:
        return this.newestWinsStrategy(existingEntity, newEntityData);

      case MergeStrategy.HIGHEST_CONFIDENCE:
        return this.highestConfidenceStrategy(existingEntity, newEntityData);

      case MergeStrategy.MERGE_CONTEXT:
        return this.mergeContextStrategy(existingEntity, newEntityData);

      case MergeStrategy.MANUAL:
        return this.manualStrategy(existingEntity, newEntityData);

      default:
        return this.mergeContextStrategy(existingEntity, newEntityData);
    }
  }

  /**
   * Newest wins strategy - Use new data
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {object} Resolved data
   */
  newestWinsStrategy(existingEntity, newEntityData) {
    return {
      context: newEntityData.metadata?.context || existingEntity.context,
      metadata: { ...existingEntity.metadata, ...newEntityData.metadata },
      confidence: newEntityData.metadata?.confidence || existingEntity.confidence,
    };
  }

  /**
   * Highest confidence strategy - Use data with highest confidence
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {object} Resolved data
   */
  highestConfidenceStrategy(existingEntity, newEntityData) {
    const existingConfidence = existingEntity.confidence || 0.5;
    const newConfidence = newEntityData.metadata?.confidence || 0.5;

    if (newConfidence > existingConfidence) {
      return this.newestWinsStrategy(existingEntity, newEntityData);
    }

    return {
      context: existingEntity.context,
      metadata: existingEntity.metadata,
      confidence: existingConfidence,
    };
  }

  /**
   * Merge context strategy - Combine context from both
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {object} Resolved data
   */
  mergeContextStrategy(existingEntity, newEntityData) {
    const existingContext = existingEntity.context || '';
    const newContext = newEntityData.metadata?.context || '';

    // Combine contexts, deduplicate
    const combinedContext = [existingContext, newContext]
      .filter(c => c && c.trim().length > 0)
      .join('. ')
      .substring(0, this.config.maxContextLength);

    return {
      context: combinedContext,
      metadata: { ...existingEntity.metadata, ...newEntityData.metadata },
      confidence: Math.max(
        existingEntity.confidence || 0.5,
        newEntityData.metadata?.confidence || 0.5
      ),
    };
  }

  /**
   * Manual strategy - Require manual resolution
   *
   * @param {object} existingEntity - Existing entity
   * @param {object} newEntityData - New entity data
   * @returns {object} Resolved data
   */
  manualStrategy(existingEntity, newEntityData) {
    // Log conflict for manual review
    console.warn('[Shared Entity Registry] Manual conflict resolution required:', {
      existing: existingEntity,
      new: newEntityData,
    });

    // Default to merge context for now
    return this.mergeContextStrategy(existingEntity, newEntityData);
  }

  /**
   * Update entity access tracking
   *
   * @param {string} entityId - Entity ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async updateEntityAccess(entityId, agentId) {
    await this.entityMemory.updateEntity(entityId, {
      last_seen: new Date().toISOString(),
      occurrence_count: (await this.entityMemory.getEntity(entityId)).occurrence_count + 1,
    });

    // Update last_updated_by_agent
    const stmt = this.db.prepare(`
      UPDATE entities
      SET last_updated_by_agent = ?
      WHERE id = ?
    `);

    stmt.run(agentId, entityId);
  }

  /**
   * Update entity access with merge tracking (different agent accessing)
   *
   * @param {string} entityId - Entity ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async updateEntityAccessWithMerge(entityId, agentId) {
    // Increment merge_count and version when accessed by different agent
    const stmt = this.db.prepare(`
      UPDATE entities
      SET version = version + 1,
          merge_count = merge_count + 1,
          last_updated_by_agent = ?,
          occurrence_count = occurrence_count + 1,
          last_seen = ?
      WHERE id = ?
    `);

    stmt.run(agentId, new Date().toISOString(), entityId);
  }

  /**
   * Get global entities by type
   *
   * @param {string} type - Entity type
   * @param {object} options - Query options
   * @returns {Promise<Array>} Global entities
   */
  async getGlobalEntitiesByType(type, options = {}) {
    await this.ensureInitialized();

    const { limit = 50, minOccurrence = 1 } = options;

    const stmt = this.db.prepare(`
      SELECT * FROM entities
      WHERE type = ?
      AND is_global = TRUE
      AND is_active = TRUE
      AND occurrence_count >= ?
      ORDER BY occurrence_count DESC, last_seen DESC
      LIMIT ?
    `);

    const entities = stmt.all(type, minOccurrence, limit);

    return entities.map(entity => ({
      ...entity,
      metadata: entity.metadata ? JSON.parse(entity.metadata) : {},
    }));
  }

  /**
   * Get entity statistics
   *
   * @returns {Promise<object>} Statistics
   */
  async getEntityStats() {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(occurrence_count) as total_occurrences,
        SUM(merge_count) as total_merges,
        AVG(version) as avg_version
      FROM entities
      WHERE is_global = TRUE
      AND is_active = TRUE
      GROUP BY type
    `);

    const stats = stmt.all();

    return {
      globalEntities: stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Ensure initialized
   *
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

/**
 * Create shared entity registry
 *
 * @param {object} options - Configuration options
 * @returns {SharedEntityRegistry}
 */
export function createSharedEntityRegistry(options = {}) {
  return new SharedEntityRegistry(options);
}
