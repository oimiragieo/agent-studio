/**
 * Semantic Memory Service
 *
 * Coordinates embedding generation and vector search for semantic memory retrieval
 *
 * Performance Targets:
 * - Index message: <100ms
 * - Batch index (100 messages): <10s
 * - Semantic search: <200ms
 * - Combined search (FTS5 + semantic): <250ms
 *
 * Features:
 * - Message indexing with embeddings
 * - Semantic similarity search
 * - Relevance ranking (similarity + recency)
 * - Integration with FTS5 keyword search
 * - Session summarization
 */

import { createEmbeddingPipeline } from './embedding-pipeline.mjs';
import { createVectorStore } from './vector-store.mjs';
import { createMemoryDatabase } from './database.mjs';

/**
 * Semantic Memory Service Class
 */
export class SemanticMemoryService {
  /**
   * @param {object} database - MemoryDatabase instance
   * @param {object} embeddingPipeline - EmbeddingPipeline instance
   * @param {object} vectorStore - VectorStore instance
   */
  constructor(database = null, embeddingPipeline = null, vectorStore = null) {
    this.db = database;
    this.embeddings = embeddingPipeline;
    this.vectors = vectorStore;
    this.isInitialized = false;
  }

  /**
   * Initialize service
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    const startTime = Date.now();

    try {
      // Initialize database
      if (!this.db) {
        this.db = createMemoryDatabase();
      }
      if (!this.db.isInitialized) {
        await this.db.initialize();
      }

      // Initialize embedding pipeline
      if (!this.embeddings) {
        this.embeddings = createEmbeddingPipeline();
      }

      // Initialize vector store
      if (!this.vectors) {
        this.vectors = createVectorStore();
      }
      if (!this.vectors.isInitialized) {
        await this.vectors.initialize();
      }

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      console.log(`[SemanticMemory] Initialized in ${duration}ms`);

      return { success: true, duration };
    } catch (error) {
      console.error('[SemanticMemory] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Index a message for semantic search
   *
   * @param {object} message - Message to index
   * @returns {Promise<object>} Index result
   */
  async indexMessage(message) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const { id, content, role, conversationId } = message;

      if (!content || content.trim().length === 0) {
        return { indexed: false, reason: 'empty_content' };
      }

      // Generate embedding
      const embedding = await this.embeddings.generateEmbedding(content);

      // Add to vector store
      await this.vectors.addVector(id.toString(), embedding, {
        messageId: id,
        conversationId,
        role,
        contentLength: content.length,
      });

      // Update database with embedding metadata (if message_embeddings table exists)
      // This would be handled by database.mjs in a real implementation

      const duration = Date.now() - startTime;

      return {
        indexed: true,
        messageId: id,
        duration,
        embeddingDimensions: embedding.length,
      };
    } catch (error) {
      console.error('[SemanticMemory] Index message failed:', error.message);
      return {
        indexed: false,
        error: error.message,
      };
    }
  }

  /**
   * Index multiple messages in batch
   *
   * @param {Array} messages - Messages to index
   * @returns {Promise<object>} Batch index result
   */
  async indexBatchMessages(messages) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      if (!messages || messages.length === 0) {
        return { indexed: 0, duration: 0 };
      }

      // Filter out empty messages
      const validMessages = messages.filter(m => m.content && m.content.trim().length > 0);

      if (validMessages.length === 0) {
        return { indexed: 0, duration: 0, skipped: messages.length };
      }

      // Generate embeddings in batch
      const texts = validMessages.map(m => m.content);
      const embeddings = await this.embeddings.generateBatchEmbeddings(texts);

      // Add to vector store
      const vectors = validMessages.map((msg, i) => ({
        id: msg.id.toString(),
        vector: embeddings[i],
        metadata: {
          messageId: msg.id,
          conversationId: msg.conversationId,
          role: msg.role,
          contentLength: msg.content.length,
        },
      }));

      await this.vectors.addBatchVectors(vectors);

      const duration = Date.now() - startTime;
      const avgTime = (duration / validMessages.length).toFixed(1);

      console.log(
        `[SemanticMemory] Indexed ${validMessages.length} messages in ${duration}ms (${avgTime}ms/message)`
      );

      return {
        indexed: validMessages.length,
        skipped: messages.length - validMessages.length,
        duration,
        averageTimePerMessage: parseFloat(avgTime),
      };
    } catch (error) {
      console.error('[SemanticMemory] Batch index failed:', error.message);
      throw error;
    }
  }

  /**
   * Search relevant memory using semantic similarity
   *
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<Array>} Relevant messages
   */
  async searchRelevantMemory(query, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      sessionId = null,
      k = 10,
      minRelevance = 0.7,
      timeRange = null,
      includeContent = true,
    } = options;

    const startTime = Date.now();

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddings.generateEmbedding(query);

      // Vector similarity search
      const searchResult = await this.vectors.searchSimilar(queryEmbedding, k * 2);

      // Filter by relevance threshold
      let results = searchResult.results.filter(r => r.similarity >= minRelevance);

      // Fetch full messages from database if requested
      if (includeContent && results.length > 0) {
        const messageIds = results.map(r => parseInt(r.id));
        const messages = await this.fetchMessages(messageIds, sessionId);

        // Merge with search results
        results = results
          .map(r => {
            const message = messages.find(m => m.id === parseInt(r.id));
            return {
              ...r,
              message: message || null,
            };
          })
          .filter(r => r.message !== null);
      }

      // Rank by combined score (similarity + recency)
      results = this.rankByCombinedScore(results, timeRange);

      // Limit to k results
      results = results.slice(0, k);

      const duration = Date.now() - startTime;

      return {
        results,
        duration,
        query,
        totalMatches: results.length,
      };
    } catch (error) {
      console.error('[SemanticMemory] Search failed:', error.message);
      return {
        results: [],
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Reindex all messages in a session
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<object>} Reindex result
   */
  async reindexSession(sessionId) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Fetch all messages for session
      const messages = this.db
        .prepare(
          `
                SELECT m.id, m.content, m.role, c.id as conversationId
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.session_id = ?
                ORDER BY m.created_at ASC
            `
        )
        .all(sessionId);

      if (messages.length === 0) {
        return {
          reindexed: 0,
          duration: Date.now() - startTime,
        };
      }

      // Index in batch
      const result = await this.indexBatchMessages(messages);

      return {
        ...result,
        sessionId,
        messagesProcessed: messages.length,
      };
    } catch (error) {
      console.error('[SemanticMemory] Reindex session failed:', error.message);
      throw error;
    }
  }

  /**
   * Get semantic summary of session
   *
   * @param {string} sessionId - Session ID
   * @param {number} topK - Number of most important messages
   * @returns {Promise<object>} Session summary
   */
  async getSemanticSummary(sessionId, topK = 5) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Fetch all messages for session
      const messages = this.db
        .prepare(
          `
                SELECT m.*
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.session_id = ?
                ORDER BY m.created_at DESC
                LIMIT 50
            `
        )
        .all(sessionId);

      if (messages.length === 0) {
        return {
          summary: [],
          totalMessages: 0,
        };
      }

      // Get embeddings for all messages
      const messageTexts = messages.map(m => m.content);
      const embeddings = await this.embeddings.generateBatchEmbeddings(messageTexts);

      // Calculate centrality (average similarity to all other messages)
      const centrality = this.calculateCentrality(embeddings);

      // Rank by centrality and importance score
      const rankedMessages = messages
        .map((msg, i) => ({
          ...msg,
          centrality: centrality[i],
          combinedScore: centrality[i] * 0.6 + (msg.importance_score || 0.5) * 0.4,
        }))
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, topK);

      return {
        summary: rankedMessages,
        totalMessages: messages.length,
        topK,
      };
    } catch (error) {
      console.error('[SemanticMemory] Get summary failed:', error.message);
      throw error;
    }
  }

  /**
   * Find similar conversations
   *
   * @param {string} conversationId - Reference conversation ID
   * @param {number} k - Number of similar conversations
   * @returns {Promise<Array>} Similar conversations
   */
  async findSimilarConversations(conversationId, k = 5) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get messages from reference conversation
      const messages = this.db
        .prepare(
          `
                SELECT content FROM messages
                WHERE conversation_id = (SELECT id FROM conversations WHERE conversation_id = ?)
                ORDER BY created_at
            `
        )
        .all(conversationId);

      if (messages.length === 0) {
        return [];
      }

      // Create conversation embedding (average of message embeddings)
      const conversationText = messages.map(m => m.content).join(' ');
      const conversationEmbedding = await this.embeddings.generateEmbedding(conversationText);

      // Search for similar conversations
      const searchResult = await this.vectors.searchSimilar(conversationEmbedding, k * 2);

      // Group by conversation and rank
      const conversationScores = new Map();
      for (const result of searchResult.results) {
        const convId = result.metadata.conversationId;
        if (convId === conversationId) continue; // Skip self

        const currentScore = conversationScores.get(convId) || { count: 0, totalSimilarity: 0 };
        conversationScores.set(convId, {
          count: currentScore.count + 1,
          totalSimilarity: currentScore.totalSimilarity + result.similarity,
        });
      }

      // Rank by average similarity
      const rankedConversations = Array.from(conversationScores.entries())
        .map(([convId, scores]) => ({
          conversationId: convId,
          similarity: scores.totalSimilarity / scores.count,
          matchingMessages: scores.count,
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);

      return rankedConversations;
    } catch (error) {
      console.error('[SemanticMemory] Find similar conversations failed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch messages by IDs
   *
   * @param {number[]} messageIds - Message IDs
   * @param {string} sessionId - Optional session filter
   * @returns {Promise<Array>} Messages
   */
  async fetchMessages(messageIds, sessionId = null) {
    if (messageIds.length === 0) {
      return [];
    }

    try {
      const placeholders = messageIds.map(() => '?').join(',');
      let query = `
                SELECT m.*
                FROM messages m
                ${sessionId ? 'JOIN conversations c ON m.conversation_id = c.id' : ''}
                WHERE m.id IN (${placeholders})
                ${sessionId ? 'AND c.session_id = ?' : ''}
            `;

      const params = sessionId ? [...messageIds, sessionId] : messageIds;
      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.warn('[SemanticMemory] Fetch messages failed:', error.message);
      return [];
    }
  }

  /**
   * Rank results by combined score (similarity + recency)
   *
   * @param {Array} results - Search results
   * @param {object} timeRange - Optional time range filter
   * @returns {Array} Ranked results
   */
  rankByCombinedScore(results, timeRange = null) {
    const now = Date.now();

    return results
      .map(result => {
        const timestamp = result.message?.created_at
          ? new Date(result.message.created_at).getTime()
          : now;

        // Recency score (exponential decay over 7 days)
        const age = now - timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        const recency = Math.exp(-age / maxAge);

        // Combined score: 70% similarity, 30% recency
        const combinedScore = result.similarity * 0.7 + recency * 0.3;

        return {
          ...result,
          recency,
          combinedScore,
        };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Calculate centrality scores for embeddings
   *
   * @param {Float32Array[]} embeddings - Message embeddings
   * @returns {number[]} Centrality scores
   */
  calculateCentrality(embeddings) {
    const n = embeddings.length;
    const centrality = new Array(n).fill(0);

    if (n === 0) return centrality;

    // Calculate pairwise cosine similarities
    for (let i = 0; i < n; i++) {
      let totalSimilarity = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j) {
          totalSimilarity += this.cosineSimilarity(embeddings[i], embeddings[j]);
        }
      }

      centrality[i] = totalSimilarity / (n - 1);
    }

    return centrality;
  }

  /**
   * Calculate cosine similarity between two vectors
   *
   * @param {Float32Array} a - First vector
   * @param {Float32Array} b - Second vector
   * @returns {number} Cosine similarity
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get service statistics
   *
   * @returns {object} Statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      database: this.db?.getStats(),
      vectorStore: this.vectors?.getStats(),
      embeddingCache: this.embeddings?.getCacheStats(),
    };
  }

  /**
   * Save all state to disk
   *
   * @returns {Promise<void>}
   */
  async save() {
    const tasks = [];

    if (this.vectors) {
      tasks.push(this.vectors.save());
    }

    if (this.embeddings) {
      tasks.push(Promise.resolve(this.embeddings.saveCache()));
    }

    await Promise.all(tasks);
    console.log('[SemanticMemory] Saved all state');
  }
}

/**
 * Create default semantic memory service
 *
 * @param {object} options - Configuration options
 * @returns {SemanticMemoryService}
 */
export function createSemanticMemoryService(options = {}) {
  return new SemanticMemoryService(
    options.database || null,
    options.embeddingPipeline || null,
    options.vectorStore || null
  );
}
