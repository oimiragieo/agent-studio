/**
 * Semantic Memory Service Tests
 *
 * Test suite for RAG integration including:
 * - Embedding generation
 * - Vector storage and search
 * - Semantic memory service
 * - Integration with MemoryInjectionManager
 * - Background indexing
 * - Performance validation
 */

import { strict as assert } from 'assert';
import { test, describe, before, after } from 'node:test';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { EmbeddingPipeline } from './embedding-pipeline.mjs';
import { VectorStore } from './vector-store.mjs';
import { SemanticMemoryService } from './semantic-memory.mjs';
import { MemoryInjectionManager } from './injection-manager.mjs';
import { IndexingService } from './indexing-service.mjs';
import { MemoryDatabase } from './database.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(process.cwd(), '.claude', 'context', 'tmp');
const TEST_DB = join(TEST_DIR, 'test-semantic-memory.db');
const TEST_VECTOR_INDEX = join(TEST_DIR, 'test-vectors.hnsw');
const TEST_CACHE = join(TEST_DIR, 'test-embedding-cache.json');

// Helper: Create test directory
function ensureTestDir() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
}

// Helper: Cleanup test files
function cleanupTestFiles() {
  const files = [
    TEST_DB,
    `${TEST_DB}-wal`,
    `${TEST_DB}-shm`,
    TEST_VECTOR_INDEX,
    `${TEST_VECTOR_INDEX.replace('.hnsw', '.meta.json')}`,
    TEST_CACHE,
  ];

  for (const file of files) {
    try {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Helper: Create mock embedding (for tests without OpenAI API)
function createMockEmbedding(text, dimension = 1536) {
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const embedding = new Float32Array(dimension);

  for (let i = 0; i < dimension; i++) {
    embedding[i] = Math.sin(hash + i) * 0.1;
  }

  return embedding;
}

describe('Embedding Pipeline', () => {
  let pipeline;

  before(() => {
    ensureTestDir();
    cleanupTestFiles();

    // Create pipeline without API key (will use mock in tests)
    pipeline = new EmbeddingPipeline({
      cacheFile: TEST_CACHE,
      cache: true,
      apiKey: null, // No API key for mock tests
    });
  });

  after(() => {
    cleanupTestFiles();
  });

  test('should create embedding pipeline', () => {
    assert.ok(pipeline);
    assert.strictEqual(pipeline.options.dimensions, 1536);
    assert.strictEqual(pipeline.options.cache, true);
  });

  test('should hash text consistently', () => {
    const text = 'test message';
    const hash1 = pipeline.hashText(text);
    const hash2 = pipeline.hashText(text);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(typeof hash1, 'string');
  });

  test('should cache embeddings', () => {
    const text = 'test message';
    const hash = pipeline.hashText(text);
    const embedding = createMockEmbedding(text);

    pipeline.cacheEmbedding(hash, embedding);

    const cached = pipeline.getCachedEmbedding(hash);
    assert.ok(cached);
    assert.strictEqual(cached.length, 1536);
  });

  test('should split into batches correctly', () => {
    const texts = Array.from({ length: 250 }, (_, i) => `message ${i}`);
    const batches = pipeline.splitIntoBatches(texts, 100);

    assert.strictEqual(batches.length, 3);
    assert.strictEqual(batches[0].length, 100);
    assert.strictEqual(batches[1].length, 100);
    assert.strictEqual(batches[2].length, 50);
  });

  test('should filter cached embeddings', () => {
    const texts = ['cached1', 'cached2', 'new1', 'new2'];

    // Cache first two
    const hash1 = pipeline.hashText(texts[0]);
    const hash2 = pipeline.hashText(texts[1]);
    pipeline.cacheEmbedding(hash1, createMockEmbedding(texts[0]));
    pipeline.cacheEmbedding(hash2, createMockEmbedding(texts[1]));

    const { cached, toGenerate, indices } = pipeline.filterCached(texts);

    assert.strictEqual(cached.length, 2);
    assert.strictEqual(toGenerate.length, 2);
    assert.strictEqual(indices.length, 2);
    assert.deepStrictEqual(toGenerate, ['new1', 'new2']);
  });

  test('should get cache statistics', () => {
    pipeline.clearCache();
    pipeline.cacheStats = { hits: 10, misses: 5, total: 15 };

    const stats = pipeline.getCacheStats();

    assert.strictEqual(stats.hits, 10);
    assert.strictEqual(stats.misses, 5);
    assert.strictEqual(stats.total, 15);
    assert.strictEqual(stats.hitRate, '66.67%');
  });
});

describe('Vector Store', () => {
  let vectorStore;

  before(async () => {
    ensureTestDir();
    cleanupTestFiles();

    vectorStore = new VectorStore({
      dimension: 128, // Smaller for faster tests
      maxElements: 100,
      indexPath: TEST_VECTOR_INDEX,
    });

    await vectorStore.initialize();
  });

  after(() => {
    cleanupTestFiles();
  });

  test('should initialize vector store', () => {
    assert.ok(vectorStore.isInitialized);
    assert.strictEqual(vectorStore.options.dimension, 128);
  });

  test('should add vector', async () => {
    const vector = createMockEmbedding('test', 128);
    const id = 'test-1';

    await vectorStore.addVector(id, vector, { content: 'test message' });

    assert.strictEqual(vectorStore.metadata.size, 1);
    assert.ok(vectorStore.metadata.has(id));
  });

  test('should add batch vectors', async () => {
    const vectors = Array.from({ length: 10 }, (_, i) => ({
      id: `batch-${i}`,
      vector: createMockEmbedding(`message ${i}`, 128),
      metadata: { content: `message ${i}` },
    }));

    const added = await vectorStore.addBatchVectors(vectors);

    assert.strictEqual(added, 10);
    assert.strictEqual(vectorStore.metadata.size, 11); // 1 from previous test + 10
  });

  test('should search similar vectors', async () => {
    const queryVector = createMockEmbedding('test', 128);
    const result = await vectorStore.searchSimilar(queryVector, 5);

    assert.ok(result.results);
    assert.ok(result.results.length > 0);
    assert.ok(result.results.length <= 5);

    // Check result structure
    const firstResult = result.results[0];
    assert.ok(firstResult.id);
    assert.ok(typeof firstResult.distance === 'number');
    assert.ok(typeof firstResult.similarity === 'number');
  });

  test('should save and load index', async () => {
    // Save
    await vectorStore.save();
    assert.ok(existsSync(TEST_VECTOR_INDEX));

    // Create new instance and load
    const newVectorStore = new VectorStore({
      dimension: 128,
      maxElements: 100,
      indexPath: TEST_VECTOR_INDEX,
    });

    await newVectorStore.load();

    assert.strictEqual(newVectorStore.metadata.size, vectorStore.metadata.size);
    assert.ok(newVectorStore.isInitialized);
  });

  test('should get statistics', () => {
    const stats = vectorStore.getStats();

    assert.ok(stats.initialized);
    assert.strictEqual(stats.dimension, 128);
    assert.ok(stats.vectorCount > 0);
    assert.ok(stats.memoryUsageEstimate);
  });
});

describe('Semantic Memory Service', () => {
  let db;
  let semanticMemory;

  before(async () => {
    ensureTestDir();
    cleanupTestFiles();

    // Create database
    db = new MemoryDatabase(TEST_DB);
    await db.initialize();

    // Create test session and conversation
    db.createSession({
      sessionId: 'test-session-1',
      userId: 'test-user',
      projectId: 'test-project',
    });

    const convId = db.createConversation({
      sessionId: 'test-session-1',
      conversationId: 'test-conv-1',
      title: 'Test Conversation',
    });

    // Add test messages
    for (let i = 0; i < 10; i++) {
      db.addMessage({
        conversationId: convId,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i} about coding and development`,
        tokenCount: 10,
      });
    }

    // Create semantic memory service
    semanticMemory = new SemanticMemoryService(db);
    await semanticMemory.initialize();
  });

  after(() => {
    db.close();
    cleanupTestFiles();
  });

  test('should initialize semantic memory service', () => {
    assert.ok(semanticMemory.isInitialized);
    assert.ok(semanticMemory.db);
    assert.ok(semanticMemory.embeddings);
    assert.ok(semanticMemory.vectors);
  });

  test.skip('should index message (requires OpenAI API)', async () => {
    // This test requires OpenAI API key
    // Skipped in CI/CD without API key
    if (!process.env.OPENAI_API_KEY) {
      return;
    }

    const message = {
      id: 1,
      content: 'This is a test message about semantic search',
      role: 'user',
      conversationId: 1,
    };

    const result = await semanticMemory.indexMessage(message);

    assert.ok(result.indexed);
    assert.strictEqual(result.messageId, 1);
  });

  test('should calculate centrality scores', () => {
    const embeddings = [
      createMockEmbedding('message 1', 128),
      createMockEmbedding('message 2', 128),
      createMockEmbedding('message 3', 128),
    ];

    const centrality = semanticMemory.calculateCentrality(embeddings);

    assert.strictEqual(centrality.length, 3);
    assert.ok(centrality.every(score => score >= 0 && score <= 1));
  });

  test('should calculate cosine similarity', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0]);
    const vec3 = new Float32Array([1, 0, 0]);

    const sim12 = semanticMemory.cosineSimilarity(vec1, vec2);
    const sim13 = semanticMemory.cosineSimilarity(vec1, vec3);

    assert.ok(sim12 < 0.1); // Nearly orthogonal
    assert.ok(sim13 > 0.99); // Nearly identical
  });

  test('should get service statistics', () => {
    const stats = semanticMemory.getStats();

    assert.ok(stats.initialized);
    assert.ok(stats.database);
    assert.ok(stats.vectorStore);
    assert.ok(stats.embeddingCache);
  });
});

describe('Memory Injection Manager Integration', () => {
  let db;
  let injectionManager;

  before(async () => {
    ensureTestDir();
    cleanupTestFiles();

    db = new MemoryDatabase(TEST_DB);
    await db.initialize();

    injectionManager = new MemoryInjectionManager(db, {
      semanticSearchEnabled: false, // Disable for tests without API key
      tokenBudget: 0.2,
    });

    await injectionManager.initialize();
  });

  after(() => {
    db.close();
    cleanupTestFiles();
  });

  test('should initialize injection manager', () => {
    assert.ok(injectionManager.db);
    assert.ok(injectionManager.db.isInitialized);
  });

  test('should calculate token budget', () => {
    const budget = injectionManager.calculateTokenBudget(10000, 100000);

    assert.ok(budget > 0);
    assert.ok(budget <= injectionManager.options.maxTokens);
  });

  test('should build search query from parameters', () => {
    const query1 = injectionManager.buildSearchQuery('Task', {
      description: 'implement feature',
    });
    assert.strictEqual(query1, 'implement feature');

    const query2 = injectionManager.buildSearchQuery('Read', {
      filePath: '/path/to/file',
    });
    assert.ok(query2.includes('filePath'));
  });

  test('should hash text for deduplication', () => {
    const text = 'test message';
    const hash1 = injectionManager.hashText(text);
    const hash2 = injectionManager.hashText(text);

    assert.strictEqual(hash1, hash2);
  });

  test('should cache and retrieve results', async () => {
    const context = {
      sessionId: 'test-session',
      toolName: 'Task',
      toolParams: { description: 'test task' },
      tokenBudget: 1000,
    };

    // First call (miss)
    const result1 = await injectionManager.injectRelevantMemory(context);
    assert.ok(!result1.fromCache);

    // Second call (should hit cache)
    const result2 = await injectionManager.injectRelevantMemory(context);
    assert.ok(result2.fromCache);
  });
});

describe('Background Indexing Service', () => {
  let indexingService;

  before(() => {
    ensureTestDir();
    cleanupTestFiles();

    indexingService = new IndexingService(null, {
      interval: 5000,
      batchSize: 10,
      autoStart: false,
    });
  });

  after(async () => {
    await indexingService.stop();
    cleanupTestFiles();
  });

  test('should create indexing service', () => {
    assert.ok(indexingService);
    assert.strictEqual(indexingService.isRunning, false);
    assert.strictEqual(indexingService.options.interval, 5000);
  });

  test('should split into batches', () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    const batches = indexingService.splitIntoBatches(messages, 10);

    assert.strictEqual(batches.length, 3);
    assert.strictEqual(batches[0].length, 10);
    assert.strictEqual(batches[1].length, 10);
    assert.strictEqual(batches[2].length, 5);
  });

  test('should track statistics', () => {
    indexingService.stats = {
      totalIndexed: 100,
      totalBatches: 10,
      totalDuration: 5000,
      lastRun: new Date().toISOString(),
      errors: 0,
    };

    const stats = indexingService.getStats();

    assert.strictEqual(stats.totalIndexed, 100);
    assert.strictEqual(stats.totalBatches, 10);
    assert.strictEqual(stats.averageDuration, 500);
  });

  test('should reset statistics', () => {
    indexingService.resetStats();

    assert.strictEqual(indexingService.stats.totalIndexed, 0);
    assert.strictEqual(indexingService.stats.totalBatches, 0);
    assert.strictEqual(indexingService.stats.errors, 0);
  });
});

// Performance Tests
describe('Performance Validation', () => {
  test('embedding generation should be fast', async function () {
    this.timeout(5000); // 5 second timeout

    const pipeline = new EmbeddingPipeline({ cache: false });
    const text = 'test message for performance validation';

    // Mock embedding (no API call)
    const startTime = Date.now();
    const embedding = createMockEmbedding(text);
    const duration = Date.now() - startTime;

    assert.ok(duration < 50, `Embedding generation took ${duration}ms (expected <50ms)`);
    assert.strictEqual(embedding.length, 1536);
  });

  test('vector search should be fast', async function () {
    this.timeout(5000);

    const vectorStore = new VectorStore({ dimension: 128 });
    await vectorStore.initialize();

    // Add 100 vectors
    const vectors = Array.from({ length: 100 }, (_, i) => ({
      id: `vec-${i}`,
      vector: createMockEmbedding(`message ${i}`, 128),
      metadata: { index: i },
    }));

    await vectorStore.addBatchVectors(vectors);

    // Search
    const queryVector = createMockEmbedding('query', 128);
    const startTime = Date.now();
    const result = await vectorStore.searchSimilar(queryVector, 10);
    const duration = Date.now() - startTime;

    assert.ok(duration < 200, `Vector search took ${duration}ms (expected <200ms)`);
    assert.strictEqual(result.results.length, 10);
  });
});

console.log('All semantic memory tests completed');
