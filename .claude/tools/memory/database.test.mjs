/**
 * Memory Database Test Suite
 *
 * Tests for Phase 2 Memory System database functionality
 *
 * Run with: node .claude/tools/memory/database.test.mjs
 */

import { MemoryDatabase, createMemoryDatabase } from './database.mjs';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test database path
const TEST_DB_PATH = join(__dirname, 'test-memory.db');

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n=== Memory Database Test Suite ===\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.failed++;
        console.error(`❌ ${test.name}`);
        console.error(`   Error: ${error.message}`);
      }
    }

    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.tests.length}`);

    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (actual <= threshold) {
    throw new Error(message || `Expected ${actual} to be greater than ${threshold}`);
  }
}

// Cleanup function
function cleanup() {
  const files = [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`];

  files.forEach(file => {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
}

// Test suite
const runner = new TestRunner();

// ============================================
// Database Initialization Tests
// ============================================

runner.test('Database initialization completes in <100ms', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  const startTime = Date.now();
  await db.initialize();
  const duration = Date.now() - startTime;

  assertGreaterThan(100, duration, `Initialization took ${duration}ms (target <100ms)`);
  assert(db.isInitialized, 'Database should be initialized');

  db.close();
  cleanup();
});

runner.test('Database creates all required tables', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const tables = db
    .prepare(
      `
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `
    )
    .all();

  const expectedTables = [
    'agent_interactions',
    'cleanup_log',
    'conversations',
    'cost_tracking',
    'learned_patterns',
    'memory_metrics',
    'message_embeddings',
    'messages',
    'routing_decisions',
    'schema_version',
    'session_handoffs',
    'sessions',
    'user_preferences',
  ];

  const tableNames = tables.map(t => t.name);

  expectedTables.forEach(expectedTable => {
    assert(tableNames.includes(expectedTable), `Table ${expectedTable} should exist`);
  });

  db.close();
  cleanup();
});

runner.test('WAL mode is enabled', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const journalMode = db.db.pragma('journal_mode', { simple: true });
  assertEqual(journalMode, 'wal', 'Journal mode should be WAL');

  db.close();
  cleanup();
});

runner.test('Foreign keys are enabled', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const foreignKeys = db.db.pragma('foreign_keys', { simple: true });
  assertEqual(foreignKeys, 1, 'Foreign keys should be enabled');

  db.close();
  cleanup();
});

runner.test('Schema version is tracked', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const version = db.getSchemaVersion();
  assertEqual(version, 1, 'Schema version should be 1');

  db.close();
  cleanup();
});

// ============================================
// Session Management Tests
// ============================================

runner.test('Can create and retrieve session', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const sessionId = 'test-session-001';
  db.createSession({
    sessionId,
    userId: 'user-1',
    projectId: 'project-1',
    metadata: { test: true },
  });

  const session = db.getSession(sessionId);

  assert(session, 'Session should exist');
  assertEqual(session.session_id, sessionId);
  assertEqual(session.user_id, 'user-1');
  assertEqual(session.project_id, 'project-1');
  assert(session.metadata.test, 'Metadata should be preserved');

  db.close();
  cleanup();
});

runner.test('Can update session status', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const sessionId = 'test-session-002';
  db.createSession({ sessionId, userId: 'user-1' });

  db.updateSession(sessionId, { status: 'paused' });

  const session = db.getSession(sessionId);
  assertEqual(session.status, 'paused');

  db.close();
  cleanup();
});

runner.test('Can get active sessions for user', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Create multiple sessions
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  db.createSession({ sessionId: 'session-2', userId: 'user-1' });
  db.createSession({ sessionId: 'session-3', userId: 'user-2' }); // Different user

  // Pause one session
  db.updateSession('session-2', { status: 'paused' });

  const activeSessions = db.getActiveSessions('user-1');

  assertEqual(activeSessions.length, 1, 'Should have 1 active session');
  assertEqual(activeSessions[0].session_id, 'session-1');

  db.close();
  cleanup();
});

// ============================================
// Message Management Tests
// ============================================

runner.test('Can create conversation and add messages', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Create session
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });

  // Create conversation
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
    title: 'Test Conversation',
  });

  // Add messages
  const messageId1 = db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Hello, world!',
    tokenCount: 3,
  });

  const messageId2 = db.addMessage({
    conversationId: conversationDbId,
    role: 'assistant',
    content: 'Hello! How can I help you?',
    tokenCount: 7,
  });

  assert(messageId1 > 0, 'Message ID should be positive');
  assert(messageId2 > messageId1, 'Second message ID should be greater');

  db.close();
  cleanup();
});

runner.test('Can retrieve recent messages', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Setup
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
  });

  // Add messages
  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Message 1',
  });
  db.addMessage({
    conversationId: conversationDbId,
    role: 'assistant',
    content: 'Message 2',
  });
  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Message 3',
  });

  const messages = db.getRecentMessages('session-1', 10);

  assertEqual(messages.length, 3);
  assertEqual(messages[0].content, 'Message 1'); // Chronological order
  assertEqual(messages[2].content, 'Message 3');

  db.close();
  cleanup();
});

// ============================================
// Full-Text Search Tests
// ============================================

runner.test('FTS5 index is created and searchable', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Setup
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
  });

  // Add messages
  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'How do I implement authentication in React?',
  });
  db.addMessage({
    conversationId: conversationDbId,
    role: 'assistant',
    content: 'To implement authentication, use JWT tokens...',
  });
  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Tell me about database optimization',
  });

  // Search
  const results = db.searchMessages('authentication', 10);

  assertGreaterThan(results.length, 0, 'Should find messages with "authentication"');
  assert(results[0].content.includes('authentication'), 'Result should contain search term');

  db.close();
  cleanup();
});

runner.test('FTS5 search completes in <10ms for 1000 messages', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Setup
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
  });

  // Add 1000 messages
  for (let i = 0; i < 1000; i++) {
    db.addMessage({
      conversationId: conversationDbId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `This is test message number ${i} with some random content about programming and databases`,
    });
  }

  // Benchmark search
  const startTime = Date.now();
  const results = db.searchMessages('programming', 10);
  const duration = Date.now() - startTime;

  assertGreaterThan(10, duration, `FTS5 search took ${duration}ms (target <10ms)`);
  assertGreaterThan(results.length, 0, 'Should find results');

  db.close();
  cleanup();
});

// ============================================
// Foreign Key Constraint Tests
// ============================================

runner.test('Foreign key constraints are enforced', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Try to create conversation without session (should fail)
  let errorThrown = false;

  try {
    db.createConversation({
      sessionId: 'non-existent-session',
      conversationId: 'conv-1',
    });
  } catch (error) {
    errorThrown = true;
  }

  assert(errorThrown, 'Should throw error for invalid foreign key');

  db.close();
  cleanup();
});

runner.test('Cascade delete works for sessions', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Create session and conversation
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
  });

  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Test message',
  });

  // Delete session
  db.prepare('DELETE FROM sessions WHERE session_id = ?').run('session-1');

  // Conversation and messages should be deleted
  const conversations = db
    .prepare('SELECT * FROM conversations WHERE session_id = ?')
    .all('session-1');

  assertEqual(conversations.length, 0, 'Conversations should be deleted');

  db.close();
  cleanup();
});

// ============================================
// Performance Tests
// ============================================

runner.test('Single row insert completes in <1ms', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  db.createSession({ sessionId: 'session-1', userId: 'user-1' });
  const conversationDbId = db.createConversation({
    sessionId: 'session-1',
    conversationId: 'conv-1',
  });

  // Benchmark insert
  const startTime = Date.now();
  db.addMessage({
    conversationId: conversationDbId,
    role: 'user',
    content: 'Test message',
  });
  const duration = Date.now() - startTime;

  assertGreaterThan(1, duration, `Insert took ${duration}ms (target <1ms)`);

  db.close();
  cleanup();
});

runner.test('Vacuum operation completes in <5s', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  // Add some data
  db.createSession({ sessionId: 'session-1', userId: 'user-1' });

  // Benchmark vacuum
  const result = await db.vacuum();

  assertGreaterThan(5000, result.duration, `Vacuum took ${result.duration}ms (target <5s)`);
  assert(result.success, 'Vacuum should succeed');

  db.close();
  cleanup();
});

runner.test('Database stats are accurate', async () => {
  cleanup();

  const db = new MemoryDatabase(TEST_DB_PATH);
  await db.initialize();

  const stats = db.getStats();

  assertEqual(stats.version, 1);
  assertEqual(stats.journalMode, 'wal');
  assertEqual(stats.foreignKeys, 1);
  assert(stats.pageSize > 0);
  assert(stats.pageCount > 0);
  assertGreaterThan(stats.sizeBytes, 0);

  db.close();
  cleanup();
});

// ============================================
// Concurrent Access Tests (WAL mode)
// ============================================

runner.test('Multiple connections can read simultaneously', async () => {
  cleanup();

  // Create and populate database
  const db1 = new MemoryDatabase(TEST_DB_PATH);
  await db1.initialize();
  db1.createSession({ sessionId: 'session-1', userId: 'user-1' });

  // Open second connection
  const db2 = new MemoryDatabase(TEST_DB_PATH);
  await db2.initialize();

  // Both should be able to read
  const session1 = db1.getSession('session-1');
  const session2 = db2.getSession('session-1');

  assert(session1, 'First connection should read session');
  assert(session2, 'Second connection should read session');
  assertEqual(session1.session_id, session2.session_id);

  db1.close();
  db2.close();
  cleanup();
});

// ============================================
// Run Tests
// ============================================

(async () => {
  const success = await runner.run();
  process.exit(success ? 0 : 1);
})();
