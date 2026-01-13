/**
 * Background Indexing Service
 *
 * Automatically indexes new messages asynchronously to avoid blocking
 * critical path operations.
 *
 * Performance Targets:
 * - Background indexing: <10s per 1000 messages
 * - Index interval: 60s (configurable)
 * - Max concurrent batch: 100 messages
 *
 * Features:
 * - Automatic pending message detection
 * - Batch processing with backpressure
 * - Graceful shutdown
 * - Full index rebuilding
 * - Progress tracking
 */

import { createSemanticMemoryService } from './semantic-memory.mjs';
import { createMemoryDatabase } from './database.mjs';

const DEFAULT_INDEX_INTERVAL = 60000; // 60 seconds
const DEFAULT_BATCH_SIZE = 100;

/**
 * Indexing Service Class
 */
export class IndexingService {
  /**
   * @param {object} semanticMemory - SemanticMemoryService instance
   * @param {object} options - Configuration options
   */
  constructor(semanticMemory = null, options = {}) {
    this.semanticMemory = semanticMemory;
    this.options = {
      interval: options.interval || DEFAULT_INDEX_INTERVAL,
      batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
      autoStart: options.autoStart !== false,
      ...options,
    };

    this.isRunning = false;
    this.intervalId = null;
    this.stats = {
      totalIndexed: 0,
      totalBatches: 0,
      totalDuration: 0,
      lastRun: null,
      errors: 0,
    };
  }

  /**
   * Initialize service
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.semanticMemory) {
      this.semanticMemory = createSemanticMemoryService();
      await this.semanticMemory.initialize();
    }

    if (!this.semanticMemory.isInitialized) {
      await this.semanticMemory.initialize();
    }

    console.log('[Indexing Service] Initialized');
  }

  /**
   * Start background indexing loop
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      console.warn('[Indexing Service] Already running');
      return;
    }

    if (!this.semanticMemory) {
      await this.initialize();
    }

    this.isRunning = true;

    // Run immediately
    await this.indexPendingMessages();

    // Schedule periodic runs
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.indexPendingMessages();
      }
    }, this.options.interval);

    console.log(`[Indexing Service] Started (interval: ${this.options.interval}ms)`);
  }

  /**
   * Stop background indexing
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[Indexing Service] Stopped');
  }

  /**
   * Index pending messages (not yet embedded)
   *
   * @returns {Promise<object>} Indexing result
   */
  async indexPendingMessages() {
    if (!this.semanticMemory?.isInitialized) {
      console.warn('[Indexing Service] Semantic memory not initialized');
      return { indexed: 0, duration: 0 };
    }

    const startTime = Date.now();

    try {
      // Find messages without embeddings
      // In a real implementation, this would query the database for messages
      // where message_embeddings.message_id IS NULL
      const pendingMessages = await this.findPendingMessages();

      if (pendingMessages.length === 0) {
        this.stats.lastRun = new Date().toISOString();
        return { indexed: 0, duration: 0, pending: 0 };
      }

      console.log(`[Indexing Service] Found ${pendingMessages.length} pending messages`);

      // Process in batches
      let totalIndexed = 0;
      const batches = this.splitIntoBatches(pendingMessages, this.options.batchSize);

      for (const batch of batches) {
        const result = await this.semanticMemory.indexBatchMessages(batch);
        totalIndexed += result.indexed || 0;
        this.stats.totalBatches++;
      }

      const duration = Date.now() - startTime;

      // Update stats
      this.stats.totalIndexed += totalIndexed;
      this.stats.totalDuration += duration;
      this.stats.lastRun = new Date().toISOString();

      console.log(`[Indexing Service] Indexed ${totalIndexed} messages in ${duration}ms`);

      // Save vector store
      await this.semanticMemory.vectors.save();

      return {
        indexed: totalIndexed,
        duration,
        pending: pendingMessages.length - totalIndexed,
        batches: batches.length,
      };
    } catch (error) {
      this.stats.errors++;
      console.error('[Indexing Service] Indexing failed:', error.message);
      return {
        indexed: 0,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Find messages that need indexing
   *
   * @returns {Promise<Array>} Pending messages
   */
  async findPendingMessages() {
    const db = this.semanticMemory.db;

    try {
      // Query for messages without embeddings
      // This assumes message_embeddings table exists from migration
      const query = `
                SELECT m.id, m.content, m.role, c.id as conversationId
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                LEFT JOIN message_embeddings me ON m.id = me.message_id
                WHERE me.message_id IS NULL
                AND m.is_summarized = 0
                AND length(m.content) > 0
                ORDER BY m.created_at DESC
                LIMIT 1000
            `;

      return db.prepare(query).all();
    } catch (error) {
      // Fallback if message_embeddings table doesn't exist
      console.warn('[Indexing Service] message_embeddings table not found, skipping');
      return [];
    }
  }

  /**
   * Rebuild entire index from scratch
   *
   * @returns {Promise<object>} Rebuild result
   */
  async rebuildIndex() {
    if (!this.semanticMemory?.isInitialized) {
      throw new Error('Semantic memory not initialized');
    }

    const startTime = Date.now();

    try {
      console.log('[Indexing Service] Starting full index rebuild...');

      // Clear existing vector store
      this.semanticMemory.vectors.clear();

      // Get all messages
      const db = this.semanticMemory.db;
      const allMessages = db
        .prepare(
          `
                SELECT m.id, m.content, m.role, c.id as conversationId
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE m.is_summarized = 0
                AND length(m.content) > 0
                ORDER BY m.created_at ASC
            `
        )
        .all();

      if (allMessages.length === 0) {
        return { rebuilt: 0, duration: 0 };
      }

      console.log(`[Indexing Service] Rebuilding index for ${allMessages.length} messages`);

      // Process in batches
      const batches = this.splitIntoBatches(allMessages, this.options.batchSize);
      let totalRebuilt = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const result = await this.semanticMemory.indexBatchMessages(batch);
        totalRebuilt += result.indexed || 0;

        console.log(
          `[Indexing Service] Rebuilt batch ${i + 1}/${batches.length} (${totalRebuilt}/${allMessages.length})`
        );
      }

      // Save index
      await this.semanticMemory.vectors.save();

      const duration = Date.now() - startTime;

      console.log(`[Indexing Service] Index rebuilt: ${totalRebuilt} messages in ${duration}ms`);

      return {
        rebuilt: totalRebuilt,
        duration,
        batches: batches.length,
      };
    } catch (error) {
      console.error('[Indexing Service] Rebuild failed:', error.message);
      throw error;
    }
  }

  /**
   * Get indexing statistics
   *
   * @returns {object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      interval: this.options.interval,
      averageDuration:
        this.stats.totalBatches > 0
          ? Math.round(this.stats.totalDuration / this.stats.totalBatches)
          : 0,
    };
  }

  /**
   * Split messages into batches
   *
   * @param {Array} messages - Messages to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array[]} Batches
   */
  splitIntoBatches(messages, batchSize) {
    const batches = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalIndexed: 0,
      totalBatches: 0,
      totalDuration: 0,
      lastRun: null,
      errors: 0,
    };
  }
}

/**
 * Create default indexing service
 *
 * @param {object} options - Configuration options
 * @returns {IndexingService}
 */
export function createIndexingService(options = {}) {
  return new IndexingService(null, options);
}

/**
 * Create and start indexing service
 *
 * @param {object} options - Configuration options
 * @returns {Promise<IndexingService>}
 */
export async function startIndexingService(options = {}) {
  const service = createIndexingService(options);
  await service.initialize();

  if (options.autoStart !== false) {
    await service.start();
  }

  return service;
}
