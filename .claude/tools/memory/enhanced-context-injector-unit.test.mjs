/**
 * Enhanced Context Injector - Unit Tests (No Dependencies)
 *
 * Tests core algorithms without requiring database or semantic search
 *
 * @module enhanced-context-injector-unit.test
 */

import assert from 'assert';
import { createEnhancedContextInjector } from './enhanced-context-injector.mjs';
import { MemoryTier } from './hierarchical-memory.mjs';

/**
 * Unit test suite (no external dependencies)
 */
async function runUnitTests() {
  console.log('🧪 Running Enhanced Context Injector Unit Tests\n');

  let passedTests = 0;
  let totalTests = 0;

  const test = (name, fn) => {
    totalTests++;
    try {
      fn();
      passedTests++;
      console.log(`✅ ${name}`);
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error.message}`);
    }
  };

  // Test 1: Default configuration
  test('Should initialize with default weights', () => {
    const injector = createEnhancedContextInjector();

    assert.strictEqual(injector.options.weights.semantic, 0.4);
    assert.strictEqual(injector.options.weights.recency, 0.2);
    assert.strictEqual(injector.options.weights.tier, 0.3);
    assert.strictEqual(injector.options.weights.entity, 0.1);
  });

  // Test 2: Custom weights
  test('Should accept custom scoring weights', () => {
    const injector = createEnhancedContextInjector({
      weights: {
        semantic: 0.5,
        recency: 0.1,
        tier: 0.3,
        entity: 0.1,
      },
    });

    assert.strictEqual(injector.options.weights.semantic, 0.5);
    assert.strictEqual(injector.options.weights.recency, 0.1);
  });

  // Test 3: Recency score - recent message
  test('Should calculate high recency score for recent messages', () => {
    const injector = createEnhancedContextInjector();
    const now = Date.now();
    const recentTimestamp = new Date(now - 60 * 60 * 1000).toISOString(); // 1 hour ago

    const score = injector.calculateRecencyScore(recentTimestamp, now);

    assert.ok(score > 0.9, `Expected score >0.9, got ${score}`);
  });

  // Test 4: Recency score - old message
  test('Should calculate low recency score for old messages', () => {
    const injector = createEnhancedContextInjector();
    const now = Date.now();
    const oldTimestamp = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

    const score = injector.calculateRecencyScore(oldTimestamp, now);

    assert.ok(score < 0.5, `Expected score <0.5, got ${score}`);
  });

  // Test 5: Tier scores
  test('Should assign correct tier priority scores', () => {
    const injector = createEnhancedContextInjector();

    const projectScore = injector.calculateTierScore(MemoryTier.PROJECT);
    const agentScore = injector.calculateTierScore(MemoryTier.AGENT);
    const conversationScore = injector.calculateTierScore(MemoryTier.CONVERSATION);

    assert.strictEqual(projectScore, 1.0);
    assert.strictEqual(agentScore, 0.7);
    assert.strictEqual(conversationScore, 0.4);
  });

  // Test 6: Text similarity (Jaccard)
  test('Should calculate text similarity using Jaccard index', () => {
    const injector = createEnhancedContextInjector();

    const text1 = 'React is a JavaScript library for building user interfaces';
    const text2 = 'React is a popular library for user interfaces';

    const similarity = injector.calculateTextSimilarity(text1, text2);

    assert.ok(similarity > 0.5, `Expected similarity >0.5, got ${similarity}`);
    assert.ok(similarity < 1.0, `Expected similarity <1.0, got ${similarity}`);
  });

  // Test 7: Identical text similarity
  test('Should return 1.0 for identical text', () => {
    const injector = createEnhancedContextInjector();

    const text = 'TypeScript is great for React';
    const similarity = injector.calculateTextSimilarity(text, text);

    assert.strictEqual(similarity, 1.0);
  });

  // Test 8: No overlap similarity
  test('Should return 0.0 for completely different text', () => {
    const injector = createEnhancedContextInjector();

    const text1 = 'TypeScript React hooks';
    const text2 = 'Python Django views';

    const similarity = injector.calculateTextSimilarity(text1, text2);

    assert.strictEqual(similarity, 0.0);
  });

  // Test 9: Dynamic token budget - small remaining context
  test('Should enforce minimum token budget', () => {
    const injector = createEnhancedContextInjector({
      tokenBudget: 0.2,
      minTokens: 1000,
      maxTokens: 40000,
    });

    const budget = injector.calculateDynamicTokenBudget(190000, 200000);

    assert.strictEqual(budget, 1000, 'Should hit minimum bound');
  });

  // Test 10: Dynamic token budget - medium remaining context
  test('Should calculate 20% of remaining context', () => {
    const injector = createEnhancedContextInjector({
      tokenBudget: 0.2,
      minTokens: 1000,
      maxTokens: 40000,
    });

    const budget = injector.calculateDynamicTokenBudget(100000, 200000);

    assert.strictEqual(budget, 20000, 'Should be 20% of 100k');
  });

  // Test 11: Dynamic token budget - large remaining context
  test('Should enforce maximum token budget', () => {
    const injector = createEnhancedContextInjector({
      tokenBudget: 0.2,
      minTokens: 1000,
      maxTokens: 40000,
    });

    const budget = injector.calculateDynamicTokenBudget(0, 300000);

    assert.strictEqual(budget, 40000, 'Should hit maximum bound');
  });

  // Test 12: Query building from tool parameters
  test('Should extract query from tool parameters', () => {
    const injector = createEnhancedContextInjector();

    const query1 = injector.buildSearchQuery(null, 'Task', {
      description: 'Implement authentication',
    });
    assert.strictEqual(query1, 'Implement authentication');

    const query2 = injector.buildSearchQuery(null, 'Read', {
      prompt: 'Analyze codebase',
    });
    assert.strictEqual(query2, 'Analyze codebase');
  });

  // Test 13: Explicit query priority
  test('Should prioritize explicit query over tool parameters', () => {
    const injector = createEnhancedContextInjector();

    const query = injector.buildSearchQuery('Explicit query', 'Task', {
      description: 'This should be ignored',
    });

    assert.strictEqual(query, 'Explicit query');
  });

  // Test 14: Deduplication
  test('Should deduplicate memories by message ID', () => {
    const injector = createEnhancedContextInjector();

    const memories = [
      { messageId: 1, content: 'Message 1' },
      { messageId: 2, content: 'Message 2' },
      { messageId: 1, content: 'Duplicate Message 1' },
      { messageId: 3, content: 'Message 3' },
      { content: 'No ID' }, // Should be kept
    ];

    const deduplicated = injector.deduplicateMemories(memories);

    assert.strictEqual(deduplicated.length, 4);
    assert.ok(deduplicated.find(m => m.messageId === 1));
    assert.ok(deduplicated.find(m => m.messageId === 2));
    assert.ok(deduplicated.find(m => m.messageId === 3));
    assert.ok(deduplicated.find(m => !m.messageId));
  });

  // Test 15: Token estimation
  test('Should estimate tokens correctly', () => {
    const injector = createEnhancedContextInjector();

    const text = 'This is a test message with approximately 10 words in it';
    const tokens = injector.estimateTokens(text);

    // ~1 token per 4 chars, so ~14 tokens for 56 chars
    assert.ok(tokens >= 10 && tokens <= 20);
  });

  // Test 16: Cache set/get
  test('Should cache and retrieve results', () => {
    const injector = createEnhancedContextInjector();

    const key = 'session1:test query';
    const value = { memory: 'test', tokensUsed: 100 };

    injector.setCache(key, value);
    const retrieved = injector.getFromCache(key);

    assert.deepStrictEqual(retrieved, value);
  });

  // Test 17: Cache miss
  test('Should return null for cache miss', () => {
    const injector = createEnhancedContextInjector();

    const retrieved = injector.getFromCache('nonexistent-key');

    assert.strictEqual(retrieved, null);
  });

  // Test 18: Cache max size
  test('Should enforce cache max size with LRU eviction', () => {
    const injector = createEnhancedContextInjector();
    injector.cacheMaxSize = 3;

    injector.setCache('key1', { value: 1 });
    injector.setCache('key2', { value: 2 });
    injector.setCache('key3', { value: 3 });
    injector.setCache('key4', { value: 4 }); // Should evict key1

    assert.strictEqual(injector.getFromCache('key1'), null);
    assert.ok(injector.getFromCache('key2'));
    assert.ok(injector.getFromCache('key3'));
    assert.ok(injector.getFromCache('key4'));
  });

  // Test 19: Memory formatting
  test('Should format memory with tier and relevance score', () => {
    const injector = createEnhancedContextInjector();

    const memory = {
      tier: MemoryTier.PROJECT,
      role: 'user',
      content: 'Test message content',
      relevanceScore: 0.85,
    };

    const formatted = injector.formatMemory(memory);

    assert.ok(formatted.includes('[PROJECT]'));
    assert.ok(formatted.includes('(relevance: 0.85)'));
    assert.ok(formatted.includes('Test message content'));
  });

  // Test 20: Format for injection with token budget
  test('Should respect token budget when formatting', () => {
    const injector = createEnhancedContextInjector();

    const memories = [
      {
        content: 'A'.repeat(400), // ~100 tokens
        tier: MemoryTier.PROJECT,
        role: 'user',
        relevanceScore: 0.9,
      },
      {
        content: 'B'.repeat(400), // ~100 tokens
        tier: MemoryTier.AGENT,
        role: 'assistant',
        relevanceScore: 0.8,
      },
    ];

    const result = injector.formatForInjection(memories, 150);

    // Should include first memory (~100 tokens)
    assert.strictEqual(result.sources.length, 1);
    assert.ok(result.tokensUsed <= 150);
  });

  // Test 21: Tier filtering - agent context
  test('Should filter tiers based on agent context', () => {
    const injector = createEnhancedContextInjector();

    const tiers = injector.getTiersToSearch({ agentId: 'developer' });

    assert.deepStrictEqual(tiers, [MemoryTier.PROJECT, MemoryTier.AGENT]);
  });

  // Test 22: Tier filtering - no agent context
  test('Should search all tiers when no agent context', () => {
    const injector = createEnhancedContextInjector();

    const tiers = injector.getTiersToSearch({});

    assert.deepStrictEqual(tiers, [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION]);
  });

  // Test 23: Metrics tracking
  test('Should track performance metrics', () => {
    const injector = createEnhancedContextInjector();

    injector.trackMetric('scoringLatency', 50);
    injector.trackMetric('scoringLatency', 75);
    injector.trackMetric('scoringLatency', 100);

    const metrics = injector.getMetrics();

    assert.strictEqual(metrics.scoring.avg, 75);
    assert.strictEqual(metrics.scoring.p50, 75);
  });

  // Test 24: Metrics limit
  test('Should limit metrics to last 100 entries', () => {
    const injector = createEnhancedContextInjector();

    // Add 150 entries
    for (let i = 0; i < 150; i++) {
      injector.trackMetric('scoringLatency', i);
    }

    assert.strictEqual(injector.metrics.scoringLatency.length, 100);
  });

  // Test 25: Cache key generation
  test('Should generate cache keys from session and query', () => {
    const injector = createEnhancedContextInjector();

    const key = injector.getCacheKey('session123', 'TypeScript best practices');

    assert.ok(key.includes('session123'));
    assert.ok(key.includes('TypeScript'));
  });

  // Print test summary
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`   Pass Rate: ${passRate}%`);

  if (passedTests === totalTests) {
    console.log('\n✅ All unit tests passed!');
  } else {
    console.log(`\n❌ ${totalTests - passedTests} tests failed`);
    process.exit(1);
  }

  return { passedTests, totalTests, passRate: parseFloat(passRate) };
}

// Run tests
runUnitTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
