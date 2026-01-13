/**
 * Memory Injection Manager
 *
 * Coordinates memory retrieval and injection into tool context
 * Implements token budget management and relevance scoring
 *
 * Performance Targets:
 * - Memory injection: <100ms (p95)
 * - Token budget calculation: <1ms
 * - Memory ranking: <50ms
 * - Fail-safe: never block tool execution
 *
 * Phase 2.4 Enhancement:
 * - Combines FTS5 keyword search (60% weight) + semantic search (40% weight)
 * - Merged results ranked by combined score
 */

import { createMemoryDatabase } from './database.mjs';
import { createSemanticMemoryService } from './semantic-memory.mjs';

/**
 * Memory Injection Manager
 */
export class MemoryInjectionManager {
  /**
   * @param {object} database - MemoryDatabase instance
   * @param {object} options - Configuration options
   */
  constructor(database = null, options = {}) {
    this.db = database;
    this.semanticMemory = null; // Will be initialized on demand
    this.options = {
      tokenBudget: options.tokenBudget || 0.2, // 20% of remaining context
      maxMemoryAge: options.maxMemoryAge || 7, // days
      relevanceThreshold: options.relevanceThreshold || 0.7,
      maxTokens: options.maxTokens || 40000, // Hard cap
      latencyBudget: options.latencyBudget || 100, // ms
      semanticSearchEnabled: options.semanticSearchEnabled !== false, // Enable by default
      ftsWeight: options.ftsWeight || 0.6, // FTS5 weight in combined search
      semanticWeight: options.semanticWeight || 0.4, // Semantic weight in combined search
      ...options,
    };

    // Simple in-memory cache for recent queries
    this.cache = new Map();
    this.cacheMaxSize = 100;
    this.cacheTTL = 60000; // 1 minute
  }

  /**
   * Initialize the manager
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

    // Initialize semantic memory if enabled
    if (this.options.semanticSearchEnabled && !this.semanticMemory) {
      try {
        this.semanticMemory = createSemanticMemoryService({ database: this.db });
        await this.semanticMemory.initialize();
        console.log('[Memory Injection] Semantic search enabled');
      } catch (error) {
        console.warn(
          '[Memory Injection] Semantic search initialization failed, using FTS5 only:',
          error.message
        );
        this.options.semanticSearchEnabled = false;
      }
    }
  }

  /**
   * Inject relevant memory before tool execution
   *
   * @param {object} context - Execution context
   * @returns {Promise<object>} Memory injection result
   */
  async injectRelevantMemory(context) {
    const startTime = Date.now();

    try {
      // Ensure initialized
      if (!this.db?.isInitialized) {
        await this.initialize();
      }

      const {
        sessionId,
        toolName,
        toolParams,
        tokenBudget: contextTokenBudget,
        currentConversation,
      } = context;

      // Calculate available token budget
      const tokenBudget =
        contextTokenBudget ||
        this.calculateTokenBudget(context.conversationTokens || 0, context.maxTokens || 200000);

      // Check cache first
      const cacheKey = this.getCacheKey(sessionId, toolName, toolParams);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          duration: Date.now() - startTime,
        };
      }

      // Fetch relevant memory
      const relevantMemory = await this.calculateRelevantMemory(sessionId, toolName, toolParams);

      // Rank by relevance
      const ranked = this.rankMemoryByRelevance(relevantMemory, context);

      // Format for injection (respects token budget)
      const formatted = this.formatMemoryForInjection(ranked, tokenBudget);

      const result = {
        memory: formatted.memory,
        tokensUsed: formatted.tokensUsed,
        sources: formatted.sources,
        duration: Date.now() - startTime,
      };

      // Cache the result
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      console.error('[Memory Injection] Error:', error.message);

      // FAIL-SAFE: Never block tool execution
      return {
        memory: null,
        tokensUsed: 0,
        sources: [],
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Capture tool result for memory storage
   *
   * @param {object} context - Execution context
   * @param {*} toolResult - Tool execution result
   * @returns {Promise<void>}
   */
  async captureToolResult(context, toolResult) {
    try {
      // Ensure initialized
      if (!this.db?.isInitialized) {
        await this.initialize();
      }

      const { sessionId, toolName, toolParams, duration } = context;

      // Store basic execution record
      // Future: Could store more detailed results for pattern learning

      // For now, just track that tool was executed
      // This will be expanded with actual storage in future iterations

      return { captured: true };
    } catch (error) {
      console.error('[Memory Capture] Error:', error.message);
      // Non-blocking: don't throw
      return { captured: false, error: error.message };
    }
  }

  /**
   * Calculate relevant memory for injection
   *
   * @param {string} sessionId - Session ID
   * @param {string} toolName - Tool being executed
   * @param {object} params - Tool parameters
   * @returns {Promise<Array>} Relevant memory snippets
   */
  async calculateRelevantMemory(sessionId, toolName, params) {
    const snippets = [];

    try {
      // 1. Recent messages (last 10)
      const recentMessages = this.db.getRecentMessages(sessionId, 10);
      snippets.push(
        ...recentMessages.map(msg => ({
          type: 'recent_message',
          content: msg.content,
          role: msg.role,
          timestamp: msg.created_at,
          tokenCount: msg.token_count || this.estimateTokens(msg.content),
          score: 0, // Will be scored later
        }))
      );

      // 2. Session context
      const session = this.db.getSession(sessionId);
      if (session?.metadata) {
        const metadata =
          typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;

        if (metadata.context) {
          snippets.push({
            type: 'session_context',
            content: JSON.stringify(metadata.context),
            timestamp: session.created_at,
            tokenCount: this.estimateTokens(JSON.stringify(metadata.context)),
            score: 0,
          });
        }
      }

      // 3. Tool-specific context (if tool requires routing/agent context)
      if (toolName === 'Task' && params?.subagent_type) {
        // For Task tool, include agent interaction history
        // Future: query agent_interactions table
      }

      return snippets;
    } catch (error) {
      console.warn('[Memory Calculation] Error:', error.message);
      return [];
    }
  }

  /**
   * Calculate available token budget for memory injection
   *
   * @param {number} currentTokens - Tokens already in context
   * @param {number} maxTokens - Maximum context window
   * @returns {number} Available tokens for memory
   */
  calculateTokenBudget(currentTokens, maxTokens) {
    const remainingTokens = maxTokens - currentTokens;

    // 20% of remaining tokens, capped at maxTokens option
    const budget = Math.floor(remainingTokens * this.options.tokenBudget);

    return Math.min(budget, this.options.maxTokens);
  }

  /**
   * Rank memory snippets by relevance
   *
   * @param {Array} memorySnippets - Memory snippets to rank
   * @param {object} context - Execution context
   * @returns {Array} Ranked memory snippets
   */
  rankMemoryByRelevance(memorySnippets, context) {
    const now = Date.now();

    return memorySnippets
      .map(snippet => {
        const score = this.calculateRelevanceScore(snippet, context, now);
        return { ...snippet, score };
      })
      .filter(snippet => snippet.score >= this.options.relevanceThreshold)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score for memory snippet
   *
   * Relevance Score = (Recency × 0.4) + (Similarity × 0.3) + (Frequency × 0.2) + (Cost × 0.1)
   *
   * @param {object} snippet - Memory snippet
   * @param {object} context - Execution context
   * @param {number} now - Current timestamp
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(snippet, context, now) {
    // 1. Recency (40%) - newer is better
    const recency = this.calculateRecency(snippet.timestamp, now);

    // 2. Similarity (30%) - based on type matching
    const similarity = this.calculateSimilarity(snippet, context);

    // 3. Frequency (20%) - how often this pattern appears
    const frequency = 0.5; // Default: will be implemented with pattern learning

    // 4. Cost (10%) - inverse of token count (prefer smaller snippets)
    const cost = this.normalizeCost(snippet.tokenCount || 100);

    return recency * 0.4 + similarity * 0.3 + frequency * 0.2 + cost * 0.1;
  }

  /**
   * Calculate recency score
   *
   * @param {string} timestamp - ISO timestamp
   * @param {number} now - Current timestamp
   * @returns {number} Recency score (0-1)
   */
  calculateRecency(timestamp, now) {
    const age = now - new Date(timestamp).getTime();
    const maxAge = this.options.maxMemoryAge * 24 * 60 * 60 * 1000; // days to ms

    // Exponential decay: score = e^(-age/maxAge)
    return Math.exp(-age / maxAge);
  }

  /**
   * Calculate similarity score
   *
   * @param {object} snippet - Memory snippet
   * @param {object} context - Execution context
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(snippet, context) {
    // Simple type-based matching for now
    // Future: semantic similarity via embeddings

    if (snippet.type === 'recent_message') {
      return 0.9; // Recent messages are highly relevant
    }

    if (snippet.type === 'session_context') {
      return 0.8; // Session context is important
    }

    if (snippet.type === 'agent_interaction' && context.toolName === 'Task') {
      return 0.7; // Agent history relevant for Task tool
    }

    return 0.5; // Default moderate relevance
  }

  /**
   * Normalize cost (token count) to score
   *
   * @param {number} tokenCount - Token count
   * @returns {number} Normalized cost score (0-1)
   */
  normalizeCost(tokenCount) {
    // Prefer smaller snippets (less tokens = higher score)
    // Score = 1 - (tokens / 1000), capped at 0
    return Math.max(0, 1 - tokenCount / 1000);
  }

  /**
   * Format memory for injection into tool context
   *
   * @param {Array} rankedMemory - Ranked memory snippets
   * @param {number} tokenBudget - Available tokens
   * @returns {object} Formatted memory
   */
  formatMemoryForInjection(rankedMemory, tokenBudget) {
    const sources = [];
    let tokensUsed = 0;
    const memoryParts = [];

    for (const snippet of rankedMemory) {
      const snippetTokens = snippet.tokenCount || this.estimateTokens(snippet.content);

      // Check if adding this snippet would exceed budget
      if (tokensUsed + snippetTokens > tokenBudget) {
        break;
      }

      memoryParts.push(this.formatSnippet(snippet));
      sources.push({
        type: snippet.type,
        score: snippet.score,
        tokens: snippetTokens,
      });

      tokensUsed += snippetTokens;
    }

    const memory =
      memoryParts.length > 0
        ? `\n## Relevant Context from Memory\n\n${memoryParts.join('\n\n')}\n`
        : null;

    return {
      memory,
      tokensUsed,
      sources,
    };
  }

  /**
   * Format a single memory snippet
   *
   * @param {object} snippet - Memory snippet
   * @returns {string} Formatted snippet
   */
  formatSnippet(snippet) {
    switch (snippet.type) {
      case 'recent_message':
        return `**Recent ${snippet.role} message:**\n${snippet.content}`;

      case 'session_context':
        return `**Session Context:**\n${snippet.content}`;

      case 'agent_interaction':
        return `**Previous Agent Interaction:**\n${snippet.content}`;

      default:
        return snippet.content;
    }
  }

  /**
   * Estimate token count for text
   *
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate cache key
   *
   * @param {string} sessionId - Session ID
   * @param {string} toolName - Tool name
   * @param {object} params - Tool parameters
   * @returns {string} Cache key
   */
  getCacheKey(sessionId, toolName, params) {
    const paramsHash = params ? JSON.stringify(params).substring(0, 50) : '';
    return `${sessionId}:${toolName}:${paramsHash}`;
  }

  /**
   * Get from cache
   *
   * @param {string} key - Cache key
   * @returns {object|null} Cached value
   */
  getFromCache(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
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
    // Enforce max cache size
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Calculate relevant memory with semantic search (Phase 2.4)
   *
   * Combines FTS5 keyword search + semantic similarity search
   *
   * @param {string} sessionId - Session ID
   * @param {string} toolName - Tool being executed
   * @param {object} params - Tool parameters
   * @returns {Promise<Array>} Combined search results
   */
  async calculateRelevantMemoryWithSemantics(sessionId, toolName, params) {
    if (!this.options.semanticSearchEnabled || !this.semanticMemory) {
      // Fallback to FTS5 only
      return await this.calculateRelevantMemory(sessionId, toolName, params);
    }

    const startTime = Date.now();

    try {
      // Build search query from tool parameters
      const query = this.buildSearchQuery(toolName, params);

      if (!query || query.trim().length === 0) {
        return await this.calculateRelevantMemory(sessionId, toolName, params);
      }

      // Parallel search: FTS5 + Semantic
      const [ftsResults, semanticResults] = await Promise.all([
        this.searchWithFTS5(query, sessionId),
        this.searchWithSemantics(query, sessionId),
      ]);

      // Merge and re-rank results
      const mergedResults = this.combineSearchResults(ftsResults, semanticResults);

      const duration = Date.now() - startTime;
      console.log(
        `[Memory Injection] Combined search completed in ${duration}ms (FTS5: ${ftsResults.length}, Semantic: ${semanticResults.length})`
      );

      return mergedResults;
    } catch (error) {
      console.warn(
        '[Memory Injection] Semantic search failed, falling back to FTS5:',
        error.message
      );
      return await this.calculateRelevantMemory(sessionId, toolName, params);
    }
  }

  /**
   * Search using FTS5 keyword search
   *
   * @param {string} query - Search query
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Search results
   */
  async searchWithFTS5(query, sessionId) {
    try {
      const results = this.db.searchMessages(query, 10);

      return results.map(msg => ({
        type: 'fts5_match',
        content: msg.content,
        role: msg.role,
        timestamp: msg.created_at,
        tokenCount: msg.token_count || this.estimateTokens(msg.content),
        score: 0, // Will be rescored
        source: 'fts5',
      }));
    } catch (error) {
      console.warn('[Memory Injection] FTS5 search failed:', error.message);
      return [];
    }
  }

  /**
   * Search using semantic similarity
   *
   * @param {string} query - Search query
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Search results
   */
  async searchWithSemantics(query, sessionId) {
    try {
      const searchResult = await this.semanticMemory.searchRelevantMemory(query, {
        sessionId,
        k: 10,
        minRelevance: this.options.relevanceThreshold,
      });

      return searchResult.results.map(result => ({
        type: 'semantic_match',
        content: result.message?.content || '',
        role: result.message?.role || 'unknown',
        timestamp: result.message?.created_at,
        tokenCount: this.estimateTokens(result.message?.content || ''),
        score: result.combinedScore,
        source: 'semantic',
        similarity: result.similarity,
        recency: result.recency,
      }));
    } catch (error) {
      console.warn('[Memory Injection] Semantic search failed:', error.message);
      return [];
    }
  }

  /**
   * Combine and rank FTS5 + semantic search results
   *
   * Weighted scoring: FTS5 (60%) + Semantic (40%)
   *
   * @param {Array} ftsResults - FTS5 search results
   * @param {Array} semanticResults - Semantic search results
   * @returns {Array} Combined and ranked results
   */
  combineSearchResults(ftsResults, semanticResults) {
    const combined = new Map();

    // Add FTS5 results with weight
    for (const result of ftsResults) {
      const key = this.hashText(result.content);
      combined.set(key, {
        ...result,
        ftsScore: this.options.ftsWeight,
        semanticScore: 0,
        combinedScore: this.options.ftsWeight,
      });
    }

    // Add/merge semantic results with weight
    for (const result of semanticResults) {
      const key = this.hashText(result.content);
      const existing = combined.get(key);

      if (existing) {
        // Both FTS5 and semantic match - boost score
        existing.semanticScore = result.score * this.options.semanticWeight;
        existing.combinedScore = existing.ftsScore + existing.semanticScore;
        existing.source = 'combined';
      } else {
        // Semantic only
        combined.set(key, {
          ...result,
          ftsScore: 0,
          semanticScore: result.score * this.options.semanticWeight,
          combinedScore: result.score * this.options.semanticWeight,
        });
      }
    }

    // Convert to array and sort by combined score
    return Array.from(combined.values()).sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Build search query from tool parameters
   *
   * @param {string} toolName - Tool name
   * @param {object} params - Tool parameters
   * @returns {string} Search query
   */
  buildSearchQuery(toolName, params) {
    if (!params) {
      return '';
    }

    // Extract text from common parameter names
    const textFields = ['description', 'prompt', 'task', 'query', 'message', 'input'];

    for (const field of textFields) {
      if (params[field] && typeof params[field] === 'string') {
        return params[field];
      }
    }

    // Fallback: stringify params
    return JSON.stringify(params).substring(0, 500);
  }

  /**
   * Hash text for deduplication
   *
   * @param {string} text - Text to hash
   * @returns {string} Hash
   */
  hashText(text) {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

/**
 * Create default memory injection manager
 *
 * @param {object} options - Configuration options
 * @returns {MemoryInjectionManager}
 */
export function createMemoryInjectionManager(options = {}) {
  return new MemoryInjectionManager(null, options);
}
