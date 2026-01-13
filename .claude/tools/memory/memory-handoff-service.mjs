/**
 * Memory Handoff Service
 *
 * Prepares and applies memory handoffs between agents in multi-agent workflows
 *
 * Features:
 * - Select relevant memories for handoff based on relevance scoring
 * - Prepare handoff context with memories + entities
 * - Apply handoff context to target agent
 * - Token budget management for handoff context
 *
 * Performance Targets:
 * - Handoff preparation: <200ms
 * - Handoff application: <100ms
 * - Relevance scoring: <100ms
 *
 * Algorithm:
 * 1. Query source agent's recent memories (last N messages)
 * 2. Extract entities from memories
 * 3. Score memories by relevance to target task
 * 4. Select top K memories within token budget
 * 5. Format handoff context for injection
 *
 * @module memory-handoff-service
 */

import { createAgentCollaborationManager } from './agent-collaboration-manager.mjs';
import { createEntityMemory } from './entity-memory.mjs';

/**
 * Default handoff configuration
 */
const DEFAULT_HANDOFF_CONFIG = {
  maxMemories: 10, // Maximum memories to share
  tokenBudget: 5000, // Maximum tokens for handoff context
  relevanceThreshold: 0.5, // Minimum relevance score
  includeEntities: true, // Whether to include entity context
  maxEntities: 20, // Maximum entities to share
};

/**
 * Memory Handoff Service
 *
 * Manages memory transfer between agents
 */
export class MemoryHandoffService {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.db = options.database || null;
    this.collaborationManager = options.collaborationManager || null;
    this.entityMemory = options.entityMemory || null;
    this.enhancedInjector = options.enhancedInjector || null; // Phase 3 injector

    this.config = {
      ...DEFAULT_HANDOFF_CONFIG,
      ...options.config,
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the handoff service
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

    // Initialize collaboration manager
    if (!this.collaborationManager) {
      this.collaborationManager = createAgentCollaborationManager(this.db);
      await this.collaborationManager.initialize();
    }

    // Initialize entity memory
    if (this.config.includeEntities && !this.entityMemory) {
      try {
        this.entityMemory = createEntityMemory(this.db);
        await this.entityMemory.initialize();
      } catch (error) {
        console.warn('[Memory Handoff] Entity memory unavailable:', error.message);
        this.config.includeEntities = false;
      }
    }

    this.isInitialized = true;
    console.log('[Memory Handoff] Service initialized');
  }

  /**
   * Prepare handoff context from source agent to target agent
   *
   * @param {object} params - Handoff parameters
   * @returns {Promise<object>} Handoff result
   */
  async prepareHandoff(params) {
    const startTime = Date.now();
    await this.ensureInitialized();

    const {
      sessionId,
      workflowId = null,
      sourceAgentId,
      targetAgentId,
      targetTask = '',
      tokenBudget = this.config.tokenBudget,
      maxMemories = this.config.maxMemories,
    } = params;

    // Validate parameters
    if (!sessionId || !sourceAgentId || !targetAgentId) {
      throw new Error('sessionId, sourceAgentId, and targetAgentId are required');
    }

    try {
      // 1. Retrieve source agent's memories
      const sourceMemories = await this.getSourceAgentMemories(sessionId, sourceAgentId, maxMemories);

      // 2. Extract entities from memories
      const entities = this.config.includeEntities
        ? await this.extractEntitiesFromMemories(sourceMemories)
        : [];

      // 3. Score memories by relevance to target task
      const scoredMemories = await this.scoreMemoriesToShare(sourceMemories, targetTask, entities);

      // 4. Select memories within token budget
      const selectedMemories = this.selectMemoriesWithinBudget(scoredMemories, tokenBudget);

      // 5. Format handoff context
      const handoffContext = this.formatHandoffContext(selectedMemories, entities);

      // 6. Register collaboration
      const collaboration = await this.collaborationManager.registerCollaboration({
        sessionId,
        workflowId,
        sourceAgentId,
        targetAgentId,
        handoffContext: {
          memories: selectedMemories.map(m => ({
            id: m.id,
            content: m.content,
            role: m.role,
            relevanceScore: m.relevanceScore,
          })),
          entities: entities.slice(0, this.config.maxEntities).map(e => ({
            id: e.id,
            type: e.type,
            value: e.value,
          })),
          metadata: {
            totalMemories: sourceMemories.length,
            selectedMemories: selectedMemories.length,
            totalEntities: entities.length,
            tokensUsed: handoffContext.tokensUsed,
            tokenBudget,
          },
        },
        handoffType: 'sequential',
      });

      const duration = Date.now() - startTime;

      console.log(
        `[Memory Handoff] Prepared handoff ${sourceAgentId} → ${targetAgentId}: ${selectedMemories.length} memories, ${entities.length} entities in ${duration}ms`
      );

      return {
        handoffId: collaboration.handoffId,
        context: handoffContext,
        metadata: {
          sourceAgentId,
          targetAgentId,
          memoriesShared: selectedMemories.length,
          entitiesShared: entities.length,
          tokensUsed: handoffContext.tokensUsed,
          duration,
        },
      };
    } catch (error) {
      console.error('[Memory Handoff] Preparation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get source agent's recent memories
   *
   * @param {string} sessionId - Session ID
   * @param {string} agentId - Agent ID
   * @param {number} limit - Maximum memories to retrieve
   * @returns {Promise<Array>} Memories
   */
  async getSourceAgentMemories(sessionId, agentId, limit) {
    const stmt = this.db.prepare(`
      SELECT m.*
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      AND m.source_agent_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `);

    return stmt.all(sessionId, agentId, limit);
  }

  /**
   * Extract entities from memories
   *
   * @param {Array} memories - Memory objects
   * @returns {Promise<Array>} Extracted entities
   */
  async extractEntitiesFromMemories(memories) {
    if (!this.entityMemory) {
      return [];
    }

    const entityIds = new Set();
    const entities = [];

    for (const memory of memories) {
      try {
        // Import entity extractor dynamically
        const { EntityExtractor } = await import('./entity-extractor.mjs');
        const extractor = new EntityExtractor();
        const extracted = await extractor.extractFromText(memory.content);

        for (const entity of extracted) {
          // Store entity and track ID
          const entityId = await this.entityMemory.createEntity(entity.type, entity.value, {
            confidence: entity.confidence,
            context: memory.content,
          });

          if (!entityIds.has(entityId)) {
            entityIds.add(entityId);
            entities.push(await this.entityMemory.getEntity(entityId));
          }
        }
      } catch (error) {
        console.warn('[Memory Handoff] Entity extraction failed for memory:', error.message);
      }
    }

    return entities;
  }

  /**
   * Score memories for relevance to target task
   *
   * Uses Phase 3 enhanced scoring if available, falls back to simple scoring
   *
   * @param {Array} memories - Memories to score
   * @param {string} targetTask - Target task description
   * @param {Array} entities - Extracted entities
   * @returns {Promise<Array>} Scored memories
   */
  async scoreMemoriesToShare(memories, targetTask, entities) {
    // Use Phase 3 enhanced injector if available
    if (this.enhancedInjector) {
      try {
        const queryEntities = entities.map(e => ({ value: e.value, type: e.type }));

        return await Promise.all(
          memories.map(async memory => {
            const semanticScore = await this.enhancedInjector.calculateSemanticScore(memory, targetTask);

            const recencyScore = this.enhancedInjector.calculateRecencyScore(
              memory.created_at,
              Date.now()
            );

            const tierScore = memory.tier ? this.enhancedInjector.calculateTierScore(memory.tier) : 0.5;

            const entityScore = await this.enhancedInjector.calculateEntityScore(memory, queryEntities);

            const relevanceScore =
              0.4 * semanticScore + 0.2 * recencyScore + 0.3 * tierScore + 0.1 * entityScore;

            return {
              ...memory,
              relevanceScore,
              scoringBreakdown: {
                semantic: semanticScore,
                recency: recencyScore,
                tier: tierScore,
                entity: entityScore,
              },
            };
          })
        );
      } catch (error) {
        console.warn('[Memory Handoff] Enhanced scoring failed, using fallback:', error.message);
      }
    }

    // Fallback: simple text-based scoring
    return memories.map(memory => {
      const relevanceScore = this.calculateSimpleRelevance(memory.content, targetTask);

      return {
        ...memory,
        relevanceScore,
      };
    });
  }

  /**
   * Calculate simple text relevance (fallback)
   *
   * @param {string} text - Memory content
   * @param {string} query - Target task
   * @returns {number} Relevance score (0-1)
   */
  calculateSimpleRelevance(text, query) {
    if (!query || query.trim().length === 0) {
      return 0.5; // Neutral score
    }

    const textWords = new Set(text.toLowerCase().split(/\s+/));
    const queryWords = new Set(query.toLowerCase().split(/\s+/));

    const intersection = new Set([...textWords].filter(w => queryWords.has(w)));
    const union = new Set([...textWords, ...queryWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Select memories within token budget
   *
   * @param {Array} scoredMemories - Scored memories
   * @param {number} tokenBudget - Available tokens
   * @returns {Array} Selected memories
   */
  selectMemoriesWithinBudget(scoredMemories, tokenBudget) {
    // Sort by relevance score (descending)
    const ranked = scoredMemories
      .filter(m => m.relevanceScore >= this.config.relevanceThreshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const selected = [];
    let tokensUsed = 0;

    for (const memory of ranked) {
      const memoryTokens = this.estimateTokens(memory.content);

      if (tokensUsed + memoryTokens > tokenBudget) {
        break;
      }

      selected.push(memory);
      tokensUsed += memoryTokens;
    }

    return selected;
  }

  /**
   * Format handoff context for injection
   *
   * @param {Array} memories - Selected memories
   * @param {Array} entities - Extracted entities
   * @returns {object} Formatted handoff context
   */
  formatHandoffContext(memories, entities) {
    const memoryParts = memories.map(memory =>
      this.formatMemory(memory)
    );

    const entityParts = entities.slice(0, this.config.maxEntities).map(entity =>
      this.formatEntity(entity)
    );

    const tokensUsed =
      memories.reduce((sum, m) => sum + this.estimateTokens(m.content), 0) +
      entities.reduce((sum, e) => sum + this.estimateTokens(this.formatEntity(e)), 0);

    const context = `
## Handoff Context from Previous Agent

${memoryParts.length > 0 ? '### Shared Memories\n\n' + memoryParts.join('\n\n') : ''}

${entityParts.length > 0 ? '### Known Entities\n\n' + entityParts.join('\n') : ''}
`.trim();

    return {
      context,
      tokensUsed,
      memoriesShared: memories.length,
      entitiesShared: entities.length,
    };
  }

  /**
   * Format a single memory
   *
   * @param {object} memory - Memory object
   * @returns {string} Formatted memory
   */
  formatMemory(memory) {
    const scoreLabel = memory.relevanceScore
      ? `(relevance: ${memory.relevanceScore.toFixed(2)})`
      : '';

    return `**${memory.role} message** ${scoreLabel}\n${memory.content}`;
  }

  /**
   * Format a single entity
   *
   * @param {object} entity - Entity object
   * @returns {string} Formatted entity
   */
  formatEntity(entity) {
    return `- **${entity.value}** (${entity.type})`;
  }

  /**
   * Estimate token count for text
   *
   * @param {string} text - Text to estimate
   * @returns {number} Estimated tokens
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Apply handoff context to target agent
   *
   * Marks handoff as applied and returns formatted context for injection
   *
   * @param {string} handoffId - Handoff ID
   * @returns {Promise<object>} Applied handoff context
   */
  async applyHandoffContext(handoffId) {
    await this.ensureInitialized();

    // Get collaboration record
    const collaboration = await this.collaborationManager.getCollaboration(handoffId);

    if (!collaboration) {
      throw new Error(`Handoff ${handoffId} not found`);
    }

    // Mark as applied
    await this.collaborationManager.markHandoffApplied(handoffId);

    // Return formatted context
    return {
      handoffId,
      sourceAgentId: collaboration.source_agent_id,
      targetAgentId: collaboration.target_agent_id,
      context: this.formatHandoffContext(
        collaboration.handoffContext.memories || [],
        collaboration.handoffContext.entities || []
      ),
      metadata: collaboration.handoffContext.metadata || {},
    };
  }

  /**
   * Check if handoff context exists for target agent
   *
   * @param {string} sessionId - Session ID
   * @param {string} targetAgentId - Target agent ID
   * @returns {Promise<object|null>} Pending handoff if exists
   */
  async checkPendingHandoff(sessionId, targetAgentId) {
    await this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT * FROM agent_collaborations
      WHERE session_id = ?
      AND target_agent_id = ?
      AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const handoff = stmt.get(sessionId, targetAgentId);

    if (!handoff) {
      return null;
    }

    return {
      ...handoff,
      handoffContext: handoff.handoff_context ? JSON.parse(handoff.handoff_context) : {},
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
 * Create memory handoff service
 *
 * @param {object} options - Configuration options
 * @returns {MemoryHandoffService}
 */
export function createMemoryHandoffService(options = {}) {
  return new MemoryHandoffService(options);
}
