/**
 * Memory Injection Manager Test Suite
 *
 * Tests for memory injection, token budgets, relevance scoring, and fail-safe behavior
 */

import { MemoryInjectionManager } from './injection-manager.mjs';
import { MemoryDatabase } from './database.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test database path (use unique path per test run to avoid locks)
const TEST_DB_PATH = join(__dirname, `../../context/memory/test-sessions-${Date.now()}.db`);

/**
 * Test helper: Create test database
 */
async function createTestDatabase(testName = '') {
  // Use unique path for each test to avoid file locks on Windows
  const testDbPath = join(__dirname, `../../context/memory/test-${testName}-${Date.now()}.db`);

  // Remove existing test database
  if (existsSync(testDbPath)) {
    try {
      unlinkSync(testDbPath);
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  const db = new MemoryDatabase(testDbPath);
  await db.initialize();
  return db;
}

/**
 * Test helper: Populate test data
 */
function populateTestData(db) {
  // Create session
  db.createSession({
    sessionId: 'test-session-001',
    userId: 'test-user',
    projectId: 'test-project',
    metadata: {
      context: { currentTask: 'Testing memory system' },
    },
  });

  // Create conversation
  const conversationId = db.createConversation({
    sessionId: 'test-session-001',
    conversationId: 'test-conv-001',
    title: 'Test Conversation',
  });

  // Add messages
  db.addMessage({
    conversationId,
    role: 'user',
    content: 'Can you help me implement the memory system?',
    tokenCount: 10,
  });

  db.addMessage({
    conversationId,
    role: 'assistant',
    content: 'I will help you implement the Phase 2 memory system with SQLite and hooks.',
    tokenCount: 15,
  });

  db.addMessage({
    conversationId,
    role: 'user',
    content: 'What are the performance targets?',
    tokenCount: 7,
  });

  db.addMessage({
    conversationId,
    role: 'assistant',
    content:
      'Memory injection must complete in <100ms, with token budget of 20% of remaining context.',
    tokenCount: 18,
  });

  return { conversationId };
}

/**
 * Test Suite
 */
async function runTests() {
  console.log('🧪 Memory Injection Manager Test Suite\n');
  console.log('═'.repeat(60) + '\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Test 1: Token Budget Calculation
  console.log('Test 1: Token Budget Calculation');
  try {
    const manager = new MemoryInjectionManager();

    // Scenario 1: 50,000 tokens used, 200,000 max
    const budget1 = manager.calculateTokenBudget(50000, 200000);
    const expected1 = Math.floor(150000 * 0.2); // 20% of remaining = 30,000

    if (budget1 === expected1) {
      console.log(`  ✅ 50k/200k tokens → budget ${budget1} (expected ${expected1})`);
      results.passed++;
    } else {
      console.log(`  ❌ 50k/200k tokens → budget ${budget1} (expected ${expected1})`);
      results.failed++;
    }

    // Scenario 2: 180,000 tokens used, 200,000 max (near limit)
    const budget2 = manager.calculateTokenBudget(180000, 200000);
    const expected2 = Math.floor(20000 * 0.2); // 20% of remaining = 4,000

    if (budget2 === expected2) {
      console.log(`  ✅ 180k/200k tokens → budget ${budget2} (expected ${expected2})`);
      results.passed++;
    } else {
      console.log(`  ❌ 180k/200k tokens → budget ${budget2} (expected ${expected2})`);
      results.failed++;
    }

    // Scenario 3: Budget capped at 40k
    const budget3 = manager.calculateTokenBudget(0, 200000);
    const maxBudget = 40000; // Hard cap

    if (budget3 === maxBudget) {
      console.log(`  ✅ 0/200k tokens → budget capped at ${budget3} (max ${maxBudget})`);
      results.passed++;
    } else {
      console.log(`  ❌ 0/200k tokens → budget ${budget3} (expected ${maxBudget})`);
      results.failed++;
    }

    results.tests.push({ name: 'Token Budget Calculation', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Token Budget Calculation', passed: false, error: error.message });
  }

  console.log('');

  // Test 2: Relevance Scoring
  console.log('Test 2: Relevance Scoring');
  try {
    const manager = new MemoryInjectionManager();
    const now = Date.now();

    // Recent message (1 minute ago)
    const snippet1 = {
      type: 'recent_message',
      content: 'Recent message',
      timestamp: new Date(now - 60000).toISOString(),
      tokenCount: 10,
    };

    const score1 = manager.calculateRelevanceScore(snippet1, {}, now);

    // Should be high score (recent + important type)
    if (score1 > 0.8) {
      console.log(`  ✅ Recent message score: ${score1.toFixed(2)} (>0.8)`);
      results.passed++;
    } else {
      console.log(`  ❌ Recent message score: ${score1.toFixed(2)} (expected >0.8)`);
      results.failed++;
    }

    // Old message (7 days ago)
    const snippet2 = {
      type: 'recent_message',
      content: 'Old message',
      timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      tokenCount: 10,
    };

    const score2 = manager.calculateRelevanceScore(snippet2, {}, now);

    // Should be lower score (old)
    if (score2 < score1) {
      console.log(`  ✅ Old message score: ${score2.toFixed(2)} (< recent ${score1.toFixed(2)})`);
      results.passed++;
    } else {
      console.log(
        `  ❌ Old message score: ${score2.toFixed(2)} (should be < ${score1.toFixed(2)})`
      );
      results.failed++;
    }

    results.tests.push({ name: 'Relevance Scoring', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Relevance Scoring', passed: false, error: error.message });
  }

  console.log('');

  // Test 3: Memory Ranking
  console.log('Test 3: Memory Ranking');
  try {
    const manager = new MemoryInjectionManager();
    const now = Date.now();

    const snippets = [
      {
        type: 'recent_message',
        content: 'Recent',
        timestamp: new Date(now - 60000).toISOString(),
        tokenCount: 10,
      },
      {
        type: 'session_context',
        content: 'Session',
        timestamp: new Date(now - 3600000).toISOString(),
        tokenCount: 50,
      },
      {
        type: 'recent_message',
        content: 'Very recent',
        timestamp: new Date(now - 10000).toISOString(),
        tokenCount: 5,
      },
    ];

    const ranked = manager.rankMemoryByRelevance(snippets, {});

    // Should be sorted by relevance score (descending)
    const scoresDescending = ranked.every(
      (snippet, i) => i === 0 || snippet.score <= ranked[i - 1].score
    );

    if (scoresDescending) {
      console.log(`  ✅ Memory ranked by relevance (descending scores)`);
      console.log(`     Scores: ${ranked.map(s => s.score.toFixed(2)).join(', ')}`);
      results.passed++;
    } else {
      console.log(`  ❌ Memory ranking failed`);
      results.failed++;
    }

    results.tests.push({ name: 'Memory Ranking', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Memory Ranking', passed: false, error: error.message });
  }

  console.log('');

  // Test 4: Memory Formatting (Token Budget Respect)
  console.log('Test 4: Memory Formatting (Token Budget Respect)');
  try {
    const manager = new MemoryInjectionManager();

    const rankedMemory = [
      { type: 'recent_message', content: 'A'.repeat(100), tokenCount: 25, score: 0.9 },
      { type: 'recent_message', content: 'B'.repeat(100), tokenCount: 25, score: 0.8 },
      { type: 'recent_message', content: 'C'.repeat(100), tokenCount: 25, score: 0.7 },
      { type: 'recent_message', content: 'D'.repeat(100), tokenCount: 25, score: 0.6 },
    ];

    const formatted = manager.formatMemoryForInjection(rankedMemory, 60);

    // Should include only first 2 snippets (25 + 25 = 50 < 60, but 75 > 60)
    if (formatted.tokensUsed <= 60 && formatted.sources.length === 2) {
      console.log(
        `  ✅ Token budget respected: ${formatted.tokensUsed}/60 tokens, ${formatted.sources.length} snippets`
      );
      results.passed++;
    } else {
      console.log(
        `  ❌ Token budget violated: ${formatted.tokensUsed}/60 tokens, ${formatted.sources.length} snippets`
      );
      results.failed++;
    }

    results.tests.push({ name: 'Memory Formatting', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Memory Formatting', passed: false, error: error.message });
  }

  console.log('');

  // Test 5: Memory Injection (Integration)
  console.log('Test 5: Memory Injection (Integration)');
  try {
    const db = await createTestDatabase('injection');
    populateTestData(db);

    const manager = new MemoryInjectionManager(db);
    await manager.initialize();

    const startTime = Date.now();

    const result = await manager.injectRelevantMemory({
      sessionId: 'test-session-001',
      toolName: 'Bash',
      toolParams: { command: 'npm test' },
      tokenBudget: 1000,
    });

    const duration = Date.now() - startTime;

    // Check latency
    if (duration < 100) {
      console.log(`  ✅ Injection latency: ${duration}ms (<100ms)`);
      results.passed++;
    } else {
      console.log(`  ❌ Injection latency: ${duration}ms (target <100ms)`);
      results.failed++;
    }

    // Check result structure
    if (result.tokensUsed !== undefined && result.sources !== undefined) {
      console.log(
        `  ✅ Result structure valid (tokens: ${result.tokensUsed}, sources: ${result.sources.length})`
      );
      results.passed++;
    } else {
      console.log(`  ❌ Result structure invalid`);
      results.failed++;
    }

    db.close();

    results.tests.push({ name: 'Memory Injection', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Memory Injection', passed: false, error: error.message });
  }

  console.log('');

  // Test 6: Fail-Safe Behavior
  console.log('Test 6: Fail-Safe Behavior');
  try {
    // Create manager with broken database (will fail on query)
    const brokenDb = await createTestDatabase('failsafe');
    brokenDb.close(); // Close immediately to make it unusable

    const manager = new MemoryInjectionManager(brokenDb);

    const result = await manager.injectRelevantMemory({
      sessionId: 'test-session',
      toolName: 'Bash',
      toolParams: {},
      tokenBudget: 1000,
    });

    // Should return safe defaults on error (either error or empty result)
    if ((result.error || result.tokensUsed === 0) && result.memory === null) {
      console.log(`  ✅ Fail-safe: returned safe defaults on error`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
      results.passed++;
    } else {
      console.log(`  ❌ Fail-safe failed: threw exception or invalid result`);
      console.log(`     Result: ${JSON.stringify(result)}`);
      results.failed++;
    }

    results.tests.push({ name: 'Fail-Safe Behavior', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Fail-Safe Behavior', passed: false, error: error.message });
  }

  console.log('');

  // Test 7: Memory Capture
  console.log('Test 7: Memory Capture');
  try {
    const db = await createTestDatabase('capture');
    const manager = new MemoryInjectionManager(db);
    await manager.initialize();

    const result = await manager.captureToolResult(
      {
        sessionId: 'test-session-001',
        toolName: 'Bash',
        toolParams: { command: 'npm test' },
        duration: 1234,
      },
      { success: true }
    );

    // Should not throw
    if (result.captured) {
      console.log(`  ✅ Memory capture completed`);
      results.passed++;
    } else {
      console.log(`  ❌ Memory capture failed`);
      results.failed++;
    }

    db.close();

    results.tests.push({ name: 'Memory Capture', passed: true });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Memory Capture', passed: false, error: error.message });
  }

  console.log('');

  // Summary
  console.log('═'.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`  Total Passed: ${results.passed}`);
  console.log(`  Total Failed: ${results.failed}`);
  console.log(
    `  Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`
  );
  console.log('');

  // Cleanup test database files
  try {
    const testDbDir = join(__dirname, '../../context/memory');
    const fs = await import('fs');
    const files = fs.readdirSync(testDbDir);
    for (const file of files) {
      if (file.startsWith('test-')) {
        const filePath = join(testDbDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Ignore errors during cleanup (Windows file locks)
        }
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }

  if (results.failed === 0) {
    console.log('✅ All tests passed\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
