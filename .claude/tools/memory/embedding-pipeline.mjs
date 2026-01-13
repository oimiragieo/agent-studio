/**
 * Embedding Pipeline
 *
 * Generates embeddings for text using OpenAI's text-embedding-3-small model
 * with caching and batch processing support.
 *
 * Performance Targets:
 * - Single embedding: <50ms
 * - Batch embedding (100 texts): <5s
 * - Cache hit rate: >80%
 *
 * Features:
 * - LRU caching with 1-hour TTL
 * - Batch processing (100 texts/batch)
 * - Automatic retry with exponential backoff
 * - Fail-safe error handling
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_BATCH_SIZE = 100;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Embedding Pipeline Class
 */
export class EmbeddingPipeline {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.options = {
      model: options.model || EMBEDDING_MODEL,
      dimensions: options.dimensions || EMBEDDING_DIMENSIONS,
      batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
      cache: options.cache !== false,
      cacheFile: options.cacheFile || null,
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options,
    };

    // Initialize OpenAI client
    if (this.options.apiKey) {
      this.client = new OpenAI({ apiKey: this.options.apiKey });
    } else {
      this.client = null;
    }

    // In-memory cache
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      total: 0,
    };

    // Load persistent cache if enabled
    if (this.options.cache && this.options.cacheFile) {
      this.loadCache();
    }
  }

  /**
   * Generate embedding for single text
   *
   * @param {string} text - Text to embed
   * @returns {Promise<Float32Array>} Embedding vector
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const startTime = Date.now();

    try {
      // Check cache first
      const hash = this.hashText(text);
      const cached = this.getCachedEmbedding(hash);
      if (cached) {
        this.cacheStats.hits++;
        this.cacheStats.total++;
        return cached;
      }

      this.cacheStats.misses++;
      this.cacheStats.total++;

      // Ensure client is initialized
      if (!this.client) {
        throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY environment variable.');
      }

      // Generate embedding with retry
      const embedding = await this.retryWithBackoff(async () => {
        const response = await this.client.embeddings.create({
          model: this.options.model,
          input: text,
          dimensions: this.options.dimensions,
        });

        return new Float32Array(response.data[0].embedding);
      });

      // Cache the result
      this.cacheEmbedding(hash, embedding);

      const duration = Date.now() - startTime;
      if (duration > 100) {
        console.warn(`[Embedding] Slow embedding generation: ${duration}ms`);
      }

      return embedding;
    } catch (error) {
      console.error('[Embedding] Generation failed:', error.message);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * @param {string[]} texts - Texts to embed
   * @returns {Promise<Float32Array[]>} Embedding vectors
   */
  async generateBatchEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const startTime = Date.now();

    try {
      // Split into batches
      const batches = this.splitIntoBatches(texts, this.options.batchSize);
      const allEmbeddings = [];

      for (const batch of batches) {
        // Check which texts need embedding (not cached)
        const { cached, toGenerate, indices } = this.filterCached(batch);

        // Add cached embeddings in original order
        const batchEmbeddings = new Array(batch.length);
        for (const { index, embedding } of cached) {
          batchEmbeddings[index] = embedding;
        }

        // Generate embeddings for non-cached texts
        if (toGenerate.length > 0) {
          if (!this.client) {
            throw new Error(
              'OpenAI client not initialized. Set OPENAI_API_KEY environment variable.'
            );
          }

          const response = await this.retryWithBackoff(async () => {
            return await this.client.embeddings.create({
              model: this.options.model,
              input: toGenerate,
              dimensions: this.options.dimensions,
            });
          });

          // Convert to Float32Array and cache
          for (let i = 0; i < toGenerate.length; i++) {
            const embedding = new Float32Array(response.data[i].embedding);
            const hash = this.hashText(toGenerate[i]);
            this.cacheEmbedding(hash, embedding);

            // Place in original order
            batchEmbeddings[indices[i]] = embedding;
          }
        }

        allEmbeddings.push(...batchEmbeddings);
      }

      const duration = Date.now() - startTime;
      console.log(
        `[Embedding] Generated ${texts.length} embeddings in ${duration}ms (${(duration / texts.length).toFixed(1)}ms/embedding)`
      );

      return allEmbeddings;
    } catch (error) {
      console.error('[Embedding] Batch generation failed:', error.message);
      throw new Error(`Batch embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Embed a message with metadata
   *
   * @param {object} message - Message object
   * @returns {Promise<object>} Embedding result with metadata
   */
  async embedMessage(message) {
    const { id, content, role, timestamp } = message;

    if (!content) {
      throw new Error('Message content is required');
    }

    const embedding = await this.generateEmbedding(content);

    return {
      messageId: id,
      embedding,
      metadata: {
        role,
        timestamp,
        model: this.options.model,
        dimensions: this.options.dimensions,
        contentHash: this.hashText(content),
      },
    };
  }

  /**
   * Get cached embedding
   *
   * @param {string} textHash - Hash of text
   * @returns {Float32Array|null} Cached embedding
   */
  getCachedEmbedding(textHash) {
    if (!this.options.cache) {
      return null;
    }

    const entry = this.cache.get(textHash);
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(textHash);
      return null;
    }

    return entry.embedding;
  }

  /**
   * Cache embedding
   *
   * @param {string} textHash - Hash of text
   * @param {Float32Array} embedding - Embedding vector
   */
  cacheEmbedding(textHash, embedding) {
    if (!this.options.cache) {
      return;
    }

    this.cache.set(textHash, {
      embedding,
      timestamp: Date.now(),
    });

    // Save to persistent cache if enabled
    if (this.options.cacheFile && this.cache.size % 10 === 0) {
      this.saveCache();
    }
  }

  /**
   * Load cache from file
   */
  loadCache() {
    if (!this.options.cacheFile) {
      return;
    }

    try {
      if (existsSync(this.options.cacheFile)) {
        const data = JSON.parse(readFileSync(this.options.cacheFile, 'utf-8'));

        for (const [hash, entry] of Object.entries(data.embeddings || {})) {
          // Convert array back to Float32Array
          this.cache.set(hash, {
            embedding: new Float32Array(entry.embedding),
            timestamp: new Date(entry.timestamp).getTime(),
          });
        }

        console.log(`[Embedding] Loaded ${this.cache.size} embeddings from cache`);
      }
    } catch (error) {
      console.warn('[Embedding] Failed to load cache:', error.message);
    }
  }

  /**
   * Save cache to file
   */
  saveCache() {
    if (!this.options.cacheFile) {
      return;
    }

    try {
      const cacheDir = dirname(this.options.cacheFile);
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      const data = {
        cache_version: '1.0.0',
        model: this.options.model,
        dimensions: this.options.dimensions,
        embeddings: {},
      };

      // Convert Map to object (limit to recent entries)
      const entries = Array.from(this.cache.entries()).slice(-1000);
      for (const [hash, entry] of entries) {
        data.embeddings[hash] = {
          embedding: Array.from(entry.embedding),
          timestamp: new Date(entry.timestamp).toISOString(),
          model: this.options.model,
        };
      }

      writeFileSync(this.options.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('[Embedding] Failed to save cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    const hitRate =
      this.cacheStats.total > 0
        ? ((this.cacheStats.hits / this.cacheStats.total) * 100).toFixed(2)
        : '0.00';

    return {
      size: this.cache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      total: this.cacheStats.total,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0, total: 0 };
  }

  /**
   * Hash text for caching
   *
   * @param {string} text - Text to hash
   * @returns {string} Hash string
   */
  hashText(text) {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Split texts into batches
   *
   * @param {string[]} texts - Texts to batch
   * @param {number} batchSize - Size of each batch
   * @returns {string[][]} Batches
   */
  splitIntoBatches(texts, batchSize) {
    const batches = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Filter cached embeddings from batch
   *
   * @param {string[]} texts - Texts to check
   * @returns {object} Cached and to-generate texts
   */
  filterCached(texts) {
    const cached = [];
    const toGenerate = [];
    const indices = [];

    for (let i = 0; i < texts.length; i++) {
      const hash = this.hashText(texts[i]);
      const embedding = this.getCachedEmbedding(hash);

      if (embedding) {
        cached.push({ index: i, embedding });
        this.cacheStats.hits++;
      } else {
        toGenerate.push(texts[i]);
        indices.push(i);
        this.cacheStats.misses++;
      }
      this.cacheStats.total++;
    }

    return { cached, toGenerate, indices };
  }

  /**
   * Retry operation with exponential backoff
   *
   * @param {Function} operation - Async operation to retry
   * @returns {Promise<*>} Operation result
   */
  async retryWithBackoff(operation) {
    let lastError;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on non-retryable errors
        if (error.code === 'invalid_api_key' || error.status === 401) {
          throw error;
        }

        const delay = this.options.retryDelay * Math.pow(2, attempt);
        console.warn(
          `[Embedding] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
          error.message
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

/**
 * Create default embedding pipeline
 *
 * @param {object} options - Configuration options
 * @returns {EmbeddingPipeline}
 */
export function createEmbeddingPipeline(options = {}) {
  const defaultCacheFile = join(
    process.cwd(),
    '.claude',
    'context',
    'memory',
    'embedding-cache.json'
  );

  return new EmbeddingPipeline({
    cacheFile: defaultCacheFile,
    ...options,
  });
}
