/**
 * Enhanced Context Injector
 *
 * Phase 3: Query-aware memory retrieval with multi-factor relevance scoring
 *
 * Algorithm: Multi-factor scoring with weighted components:
 * score = (0.4 × semantic_similarity) + (0.2 × recency) + (0.3 × tier_priority) + (0.1 × entity_overlap)
 *
 * Performance Targets:
 * - Scoring: <100ms (p95)
 * - Injection: <500ms (p95)
 * - Dynamic token budget: respects context limits
 * - Backward compatible via USE_ENHANCED_INJECTION flag
 *
 * @module enhanced-context-injector
 */

import { createMemoryDatabase } from './database.mjs';
import { createSemanticMemoryService } from './semantic-memory.mjs';
import { createHierarchicalMemory, MemoryTier } from './hierarchical-memory.mjs';
import { createEntityMemory } from './entity-memory.mjs';

/**
 * Scoring weights for multi-factor relevance
 */
const DEFAULT_WEIGHTS = {
  semantic: 0.4, // Semantic similarity to query
  recency: 0.2, // How recent the memory is
  tier: 0.3, // Hierarchical tier priority
  entity: 0.1, // Entity overlap with query
};

/**
 * Tier priority scores
 */
const TIER_PRIORITY = {
  [MemoryTier.PROJECT]: 1.0, // Highest priority
  [MemoryTier.AGENT]: 0.7, // Medium priority
  [MemoryTier.CONVERSATION]: 0.4, // Lowest priority
};

/**
 * Enhanced Context Injector
 *
 * Implements intelligent memory retrieval with multi-factor scoring
 */
export class EnhancedContextInjector {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.db = options.database || null;
    this.semanticMemory = options.semanticMemory || null;
    this.hierarchicalMemory = options.hierarchicalMemory || null;
    this.entityMemory = options.entityMemory || null;

    this.options = {
      // Scoring weights
      weights: { ...DEFAULT_WEIGHTS, ...options.weights },

      // Token budget settings
      tokenBudget: options.tokenBudget || 0.2, // 20% of remaining context
      maxTokens: options.maxTokens || 40000, // Hard cap
      minTokens: options.minTokens || 1000, // Minimum to inject

      // Relevance thresholds
      minRelevance: options.minRelevance || 0.5,
      tierFiltering: options.tierFiltering !== false, // Enable by default

      // Performance settings
      scoringTimeout: options.scoringTimeout || 100, // ms
      injectionTimeout: options.injectionTimeout || 500, // ms
      cacheEnabled: options.cacheEnabled !== false,

      // Feature flags
      entityExtractionEnabled: options.entityExtractionEnabled !== false,
      semanticSearchEnabled: options.semanticSearchEnabled !== false,

      ...options,
    };

    // Cache for scored results
    this.scoredCache = new Map();
    this.cacheTTL = 60000; // 1 minute
    this.cacheMaxSize = 100;

    // Performance tracking
    this.metrics = {
      scoringLatency: [],
      injectionLatency: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Initialize the injector
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.db) {
      this.db = createMemoryDatabase();
      await this.db.initialize();
    }

    if (!this.db.isInitialized) {
      await this.db.initialize();
    }

    // Initialize semantic memory
    if (this.options.semanticSearchEnabled && !this.semanticMemory) {
      try {
        this.semanticMemory = createSemanticMemoryService({ database: this.db });
        await this.semanticMemory.initialize();
        console.log('[Enhanced Injection] Semantic search enabled');
      } catch (error) {
        console.warn('[Enhanced Injection] Semantic search disabled:', error.message);
        this.options.semanticSearchEnabled = false;
      }
    }

    // Initialize hierarchical memory
    if (!this.hierarchicalMemory) {
      try {
        this.hierarchicalMemory = createHierarchicalMemory(this.db);
        await this.hierarchicalMemory.initialize();
        console.log('[Enhanced Injection] Hierarchical memory enabled');
      } catch (error) {
        console.warn('[Enhanced Injection] Hierarchical memory disabled:', error.message);
      }
    }

    // Initialize entity memory
    if (this.options.entityExtractionEnabled && !this.entityMemory) {
      try {
        this.entityMemory = createEntityMemory(this.db);
        await this.entityMemory.initialize();
        console.log('[Enhanced Injection] Entity extraction enabled');
      } catch (error) {
        console.warn('[Enhanced Injection] Entity extraction disabled:', error.message);
        this.options.entityExtractionEnabled = false;
      }
    }
  }

  /**
   * Inject relevant memory with enhanced scoring
   *
   * @param {object} context - Execution context
   * @returns {Promise<object>} Injection result
   */
  async injectEnhancedMemory(context) {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const {
        sessionId,
        conversationId,
        toolName,
        toolParams,
        tokenBudget: contextTokenBudget,
        query,
      } = context;

      // Build query from context
      const searchQuery = this.buildSearchQuery(query, toolName, toolParams);

      if (!searchQuery || searchQuery.trim().length === 0) {
        return this.emptyResult(startTime);
      }

      // Check cache
      const cacheKey = this.getCacheKey(sessionId, searchQuery);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return {
          ...cached,
          fromCache: true,
          duration: Date.now() - startTime,
        };
      }

      this.metrics.cacheMisses++;

      // Calculate dynamic token budget
      const tokenBudget = this.calculateDynamicTokenBudget(
        context.conversationTokens || 0,
        context.maxTokens || 200000,
        contextTokenBudget
      );

      // Extract entities from query
      const queryEntities = this.options.entityExtractionEnabled
        ? await this.extractQueryEntities(searchQuery)
        : [];

      // Retrieve candidate memories
      const candidates = await this.retrieveCandidateMemories(
        searchQuery,
        sessionId,
        conversationId,
        context
      );

      // Score candidates with multi-factor algorithm
      const scoringStart = Date.now();
      const scored = await this.scoreMemories(candidates, searchQuery, queryEntities, context);
      const scoringDuration = Date.now() - scoringStart;
      this.trackMetric('scoringLatency', scoringDuration);

      // Filter by relevance threshold
      const relevant = scored.filter(m => m.relevanceScore >= this.options.minRelevance);

      // Sort by relevance score (descending)
      const ranked = relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Format for injection (respects token budget)
      const formatted = this.formatForInjection(ranked, tokenBudget);

      const result = {
        memory: formatted.memory,
        tokensUsed: formatted.tokensUsed,
        sources: formatted.sources,
        relevanceScores: formatted.relevanceScores,
        scoringDuration,
        duration: Date.now() - startTime,
        queryEntities: queryEntities.map(e => e.value),
      };

      // Cache result
      this.setCache(cacheKey, result);

      this.trackMetric('injectionLatency', result.duration);

      return result;
    } catch (error) {
      console.error('[Enhanced Injection] Error:', error.message);

      return {
        memory: null,
        tokensUsed: 0,
        sources: [],
        relevanceScores: [],
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve candidate memories from all sources
   *
   * @param {string} query - Search query
   * @param {string} sessionId - Session ID
   * @param {number} conversationId - Conversation ID
   * @param {object} context - Execution context
   * @returns {Promise<Array>} Candidate memories
   */
  async retrieveCandidateMemories(query, sessionId, conversationId, context) {
    const candidates = [];

    try {
      // 1. Semantic search (if enabled)
      if (this.options.semanticSearchEnabled && this.semanticMemory) {
        const semanticResults = await this.semanticMemory.searchRelevantMemory(query, {
          sessionId,
          k: 20,
          minRelevance: 0.3, // Lower threshold, we'll re-score
        });

        candidates.push(
          ...semanticResults.results.map(r => ({
            type: 'semantic_match',
            content: r.message?.content || '',
            role: r.message?.role || 'unknown',
            timestamp: r.message?.created_at,
            messageId: r.message?.id,
            conversationId: r.message?.conversation_id,
            semanticScore: r.similarity,
            recencyScore: r.recency,
            tier: r.message?.tier || MemoryTier.CONVERSATION,
            agentId: r.message?.agent_id,
          }))
        );
      }

      // 2. Hierarchical tier search (if enabled)
      if (this.hierarchicalMemory) {
        const tierResults = await this.hierarchicalMemory.searchAcrossTiers(query, {
          tiers: this.getTiersToSearch(context),
          limit: 20,
          minImportance: 0.3,
        });

        candidates.push(
          ...tierResults.results.map(r => ({
            type: 'tier_match',
            content: r.content,
            role: r.role,
            timestamp: r.created_at,
            messageId: r.id,
            conversationId: r.conversation_id,
            tier: r.tier,
            tierPriority: r.tier_priority,
            importanceScore: r.importance_score,
            agentId: r.agent_id,
          }))
        );
      }

      // 3. Recent messages (fallback)
      if (conversationId) {
        const recentMessages = this.db.getRecentMessages(sessionId, 10);
        candidates.push(
          ...recentMessages.map(msg => ({
            type: 'recent_message',
            content: msg.content,
            role: msg.role,
            timestamp: msg.created_at,
            messageId: msg.id,
            conversationId: msg.conversation_id,
            tier: msg.tier || MemoryTier.CONVERSATION,
            agentId: msg.agent_id,
          }))
        );
      }

      // Deduplicate by message ID
      return this.deduplicateMemories(candidates);
    } catch (error) {
      console.warn('[Enhanced Injection] Candidate retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Score memories using multi-factor algorithm
   *
   * score = (0.4 × semantic) + (0.2 × recency) + (0.3 × tier) + (0.1 × entity)
   *
   * @param {Array} memories - Candidate memories
   * @param {string} query - Search query
   * @param {Array} queryEntities - Entities extracted from query
   * @param {object} context - Execution context
   * @returns {Promise<Array>} Scored memories
   */
  async scoreMemories(memories, query, queryEntities, context) {
    const now = Date.now();
    const weights = this.options.weights;

    return Promise.all(
      memories.map(async memory => {
        // 1. Semantic similarity (0.4 weight)
        const semanticScore = await this.calculateSemanticScore(memory, query);

        // 2. Recency (0.2 weight)
        const recencyScore = this.calculateRecencyScore(memory.timestamp, now);

        // 3. Tier priority (0.3 weight)
        const tierScore = this.calculateTierScore(memory.tier);

        // 4. Entity overlap (0.1 weight)
        const entityScore = await this.calculateEntityScore(memory, queryEntities);

        // Combined relevance score
        const relevanceScore =
          weights.semantic * semanticScore +
          weights.recency * recencyScore +
          weights.tier * tierScore +
          weights.entity * entityScore;

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
  }

  /**
   * Calculate semantic similarity score
   *
   * @param {object} memory - Memory object
   * @param {string} query - Search query
   * @returns {Promise<number>} Semantic score (0-1)
   */
  async calculateSemanticScore(memory, query) {
    // If memory already has semantic score from search, use it
    if (memory.semanticScore !== undefined) {
      return memory.semanticScore;
    }

    // If semantic memory not available, use simple text similarity
    if (!this.semanticMemory) {
      return this.calculateTextSimilarity(memory.content, query);
    }

    // Use semantic memory service
    try {
      const result = await this.semanticMemory.calculateSimilarity(memory.content, query);
      return result.similarity;
    } catch (error) {
      return this.calculateTextSimilarity(memory.content, query);
    }
  }

  /**
   * Calculate text similarity (fallback when semantic search unavailable)
   *
   * Uses Jaccard similarity on word sets
   *
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate recency score
   *
   * Exponential decay: score = e^(-age/maxAge)
   *
   * @param {string} timestamp - ISO timestamp
   * @param {number} now - Current timestamp
   * @returns {number} Recency score (0-1)
   */
  calculateRecencyScore(timestamp, now) {
    const age = now - new Date(timestamp).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    // Exponential decay
    return Math.exp(-age / maxAge);
  }

  /**
   * Calculate tier priority score
   *
   * @param {string} tier - Memory tier
   * @returns {number} Tier score (0-1)
   */
  calculateTierScore(tier) {
    return TIER_PRIORITY[tier] || 0.5;
  }

  /**
   * Calculate entity overlap score
   *
   * @param {object} memory - Memory object
   * @param {Array} queryEntities - Entities from query
   * @returns {Promise<number>} Entity score (0-1)
   */
  async calculateEntityScore(memory, queryEntities) {
    if (!this.options.entityExtractionEnabled || !this.entityMemory || queryEntities.length === 0) {
      return 0;
    }

    try {
      // Extract entities from memory content
      const memoryEntities = await this.extractEntitiesFromText(memory.content);

      if (memoryEntities.length === 0) {
        return 0;
      }

      // Calculate overlap (Jaccard similarity)
      const queryEntityValues = new Set(queryEntities.map(e => e.value.toLowerCase()));
      const memoryEntityValues = new Set(memoryEntities.map(e => e.value.toLowerCase()));

      const intersection = new Set([...queryEntityValues].filter(e => memoryEntityValues.has(e)));
      const union = new Set([...queryEntityValues, ...memoryEntityValues]);

      return union.size > 0 ? intersection.size / union.size : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Extract entities from query
   *
   * @param {string} query - Search query
   * @returns {Promise<Array>} Extracted entities
   */
  async extractQueryEntities(query) {
    if (!this.entityMemory) {
      return [];
    }

    try {
      return await this.extractEntitiesFromText(query);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract entities from text
   *
   * @param {string} text - Text to extract from
   * @returns {Promise<Array>} Extracted entities
   */
  async extractEntitiesFromText(text) {
    // Import entity extractor dynamically
    const { EntityExtractor } = await import('./entity-extractor.mjs');
    const extractor = new EntityExtractor();
    return extractor.extractFromText(text);
  }

  /**
   * Calculate dynamic token budget
   *
   * Adjusts based on context usage and limits
   *
   * @param {number} currentTokens - Tokens already in context
   * @param {number} maxTokens - Maximum context window
   * @param {number} explicitBudget - Explicitly specified budget
   * @returns {number} Available tokens
   */
  calculateDynamicTokenBudget(currentTokens, maxTokens, explicitBudget) {
    if (explicitBudget) {
      return Math.min(explicitBudget, this.options.maxTokens);
    }

    const remainingTokens = maxTokens - currentTokens;

    // 20% of remaining tokens, with min/max bounds
    let budget = Math.floor(remainingTokens * this.options.tokenBudget);
    budget = Math.max(budget, this.options.minTokens);
    budget = Math.min(budget, this.options.maxTokens);

    return budget;
  }

  /**
   * Format memories for injection
   *
   * @param {Array} rankedMemories - Ranked memories
   * @param {number} tokenBudget - Available tokens
   * @returns {object} Formatted result
   */
  formatForInjection(rankedMemories, tokenBudget) {
    const sources = [];
    const relevanceScores = [];
    let tokensUsed = 0;
    const memoryParts = [];

    for (const memory of rankedMemories) {
      const memoryTokens = this.estimateTokens(memory.content);

      // Check if adding this memory exceeds budget
      if (tokensUsed + memoryTokens > tokenBudget) {
        break;
      }

      memoryParts.push(this.formatMemory(memory));
      sources.push({
        type: memory.type,
        tier: memory.tier,
        relevanceScore: memory.relevanceScore,
        tokens: memoryTokens,
      });

      relevanceScores.push({
        content: memory.content.substring(0, 100) + '...',
        score: memory.relevanceScore,
        breakdown: memory.scoringBreakdown,
      });

      tokensUsed += memoryTokens;
    }

    const memory =
      memoryParts.length > 0
        ? `\n## Relevant Context from Memory\n\n${memoryParts.join('\n\n')}\n`
        : null;

    return {
      memory,
      tokensUsed,
      sources,
      relevanceScores,
    };
  }

  /**
   * Format a single memory
   *
   * @param {object} memory - Memory object
   * @returns {string} Formatted memory
   */
  formatMemory(memory) {
    const tierLabel = memory.tier ? `[${memory.tier.toUpperCase()}]` : '';
    const scoreLabel = `(relevance: ${memory.relevanceScore.toFixed(2)})`;

    return `**${tierLabel} ${memory.role} message** ${scoreLabel}\n${memory.content}`;
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
   * Build search query from context
   *
   * @param {string} explicitQuery - Explicit query
   * @param {string} toolName - Tool name
   * @param {object} toolParams - Tool parameters
   * @returns {string} Search query
   */
  buildSearchQuery(explicitQuery, toolName, toolParams) {
    if (explicitQuery) {
      return explicitQuery;
    }

    if (!toolParams) {
      return '';
    }

    // Extract text from common parameter names
    const textFields = ['description', 'prompt', 'task', 'query', 'message', 'input', 'objective'];

    for (const field of textFields) {
      if (toolParams[field] && typeof toolParams[field] === 'string') {
        return toolParams[field];
      }
    }

    return '';
  }

  /**
   * Get tiers to search based on context
   *
   * @param {object} context - Execution context
   * @returns {Array} Tiers to search
   */
  getTiersToSearch(context) {
    if (!this.options.tierFiltering) {
      return [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION];
    }

    // For agent-specific queries, prioritize agent and project tiers
    if (context.agentId) {
      return [MemoryTier.PROJECT, MemoryTier.AGENT];
    }

    // Default: search all tiers
    return [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION];
  }

  /**
   * Deduplicate memories by message ID
   *
   * @param {Array} memories - Memories to deduplicate
   * @returns {Array} Deduplicated memories
   */
  deduplicateMemories(memories) {
    const seen = new Set();
    return memories.filter(memory => {
      if (!memory.messageId) {
        return true;
      }
      if (seen.has(memory.messageId)) {
        return false;
      }
      seen.add(memory.messageId);
      return true;
    });
  }

  /**
   * Get cache key
   *
   * @param {string} sessionId - Session ID
   * @param {string} query - Search query
   * @returns {string} Cache key
   */
  getCacheKey(sessionId, query) {
    const queryHash = query.substring(0, 50);
    return `${sessionId}:${queryHash}`;
  }

  /**
   * Get from cache
   *
   * @param {string} key - Cache key
   * @returns {object|null} Cached value
   */
  getFromCache(key) {
    if (!this.options.cacheEnabled) {
      return null;
    }

    const entry = this.scoredCache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.scoredCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cache entry
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  setCache(key, value) {
    if (!this.options.cacheEnabled) {
      return;
    }

    // Enforce max cache size
    if (this.scoredCache.size >= this.cacheMaxSize) {
      const firstKey = this.scoredCache.keys().next().value;
      this.scoredCache.delete(firstKey);
    }

    this.scoredCache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.scoredCache.clear();
  }

  /**
   * Track performance metric
   *
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   */
  trackMetric(metric, value) {
    if (!this.metrics[metric]) {
      this.metrics[metric] = [];
    }

    this.metrics[metric].push(value);

    // Keep last 100 entries
    if (this.metrics[metric].length > 100) {
      this.metrics[metric].shift();
    }
  }

  /**
   * Get performance metrics
   *
   * @returns {object} Performance metrics
   */
  getMetrics() {
    const calculateStats = values => {
      if (values.length === 0) {
        return { avg: 0, p50: 0, p95: 0, p99: 0 };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      return { avg, p50, p95, p99 };
    };

    return {
      scoring: calculateStats(this.metrics.scoringLatency),
      injection: calculateStats(this.metrics.injectionLatency),
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate:
          this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
            : 0,
      },
    };
  }

  /**
   * Empty result helper
   *
   * @param {number} startTime - Start timestamp
   * @returns {object} Empty result
   */
  emptyResult(startTime) {
    return {
      memory: null,
      tokensUsed: 0,
      sources: [],
      relevanceScores: [],
      duration: Date.now() - startTime,
    };
  }

  /**
   * Ensure initialized
   *
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.db?.isInitialized) {
      await this.initialize();
    }
  }
}

/**
 * Create enhanced context injector
 *
 * @param {object} options - Configuration options
 * @returns {EnhancedContextInjector}
 */
export function createEnhancedContextInjector(options = {}) {
  return new EnhancedContextInjector(options);
}
