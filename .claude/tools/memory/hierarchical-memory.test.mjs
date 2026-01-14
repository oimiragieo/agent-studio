/**
 * Hierarchical Memory Tests
 *
 * Test 3-tier memory system with automatic promotion
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  HierarchicalMemoryManager,
  MemoryTier,
  createHierarchicalMemory,
} from './hierarchical-memory.mjs';
import { createMemoryDatabase } from './database.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test database path
const TEST_DB_DIR = join(__dirname, 'test-data');
const TEST_DB_PATH = join(TEST_DB_DIR, 'hierarchical-test.db');

/**
 * Test setup and teardown
 */
before(async () => {
  // Ensure test data directory exists
  if (!existsSync(TEST_DB_DIR)) {
    mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  // Remove existing test database
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
});

after(() => {
  // Clean up test database (with retry for Windows EBUSY)
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch (error) {
      // Windows may lock the file - ignore for cleanup
      if (error.code !== 'EBUSY') {
        console.warn(`Warning: Could not delete test database: ${error.message}`);
      }
    }
  }

  // Also cleanup WAL and SHM files
  const walPath = `${TEST_DB_PATH}-wal`;
  const shmPath = `${TEST_DB_PATH}-shm`;

  [walPath, shmPath].forEach(path => {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch (error) {
        // Ignore Windows locking issues
        if (error.code !== 'EBUSY') {
          console.warn(`Warning: Could not delete ${path}: ${error.message}`);
        }
      }
    }
  });
});

/**
 * Helper: Create test memory manager
 */
async function createTestManager(options = {}) {
  const db = createMemoryDatabase(TEST_DB_PATH);
  const manager = new HierarchicalMemoryManager(db, options);
  await manager.initialize();
  return manager;
}

/**
 * Helper: Create test conversation
 */
async function createTestConversation(db) {
  const sessionId = `test-session-${Date.now()}`;
  const conversationId = `test-conv-${Date.now()}`;

  db.createSession({ sessionId, userId: 'test-user', projectId: 'test-project' });
  const convInternalId = db.createConversation({ sessionId, conversationId });

  return { sessionId, conversationId, convInternalId };
}

// ============================================
// Tier Assignment Tests
// ============================================

describe('Hierarchical Memory - Tier Assignment', () => {
  it('should store memory in conversation tier by default', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const result = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User prefers TypeScript for new projects',
      agentId: 'developer',
    });

    assert.ok(result.success);
    assert.equal(result.tier, MemoryTier.CONVERSATION);

    const memory = manager.db.prepare('SELECT * FROM messages WHERE id = ?').get(result.messageId);
    assert.equal(memory.tier, MemoryTier.CONVERSATION);
    assert.equal(memory.reference_count, 0);

    manager.close();
  });

  it('should allow explicit tier assignment', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const result = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Project uses React 18 with TypeScript',
      tier: MemoryTier.PROJECT,
      agentId: 'architect',
    });

    assert.equal(result.tier, MemoryTier.PROJECT);

    const memory = manager.db.prepare('SELECT * FROM messages WHERE id = ?').get(result.messageId);
    assert.equal(memory.tier, MemoryTier.PROJECT);

    manager.close();
  });

  it('should reject invalid tier values', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await assert.rejects(
      async () => {
        await manager.storeMemory({
          conversationId: convInternalId,
          content: 'Test memory',
          tier: 'invalid-tier',
        });
      },
      { message: /Invalid tier/ }
    );

    manager.close();
  });
});

// ============================================
// Reference Tracking Tests
// ============================================

describe('Hierarchical Memory - Reference Tracking', () => {
  it('should increment reference count', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User prefers dark mode',
      agentId: 'developer',
    });

    // Reference the memory 3 times
    for (let i = 0; i < 3; i++) {
      const refResult = await manager.referenceMemory(storeResult.messageId, 'ux-expert');
      assert.ok(refResult.success);
      assert.equal(refResult.referenceCount, i + 1);
    }

    const memory = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);
    assert.equal(memory.reference_count, 3);

    manager.close();
  });

  it('should update last_referenced_at timestamp', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User prefers Tailwind CSS',
      agentId: 'developer',
    });

    const memoryBefore = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);

    // Wait 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    await manager.referenceMemory(storeResult.messageId, 'ux-expert');

    const memoryAfter = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);

    assert.notEqual(memoryAfter.last_referenced_at, memoryBefore.last_referenced_at);

    manager.close();
  });
});

// ============================================
// Automatic Promotion Tests
// ============================================

describe('Hierarchical Memory - Automatic Promotion', () => {
  it('should promote from conversation to agent tier after 3 references', async () => {
    const manager = await createTestManager({
      conversationToAgent: 3,
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User prefers Jest for testing',
      agentId: 'developer',
    });

    // Reference 2 times (no promotion yet)
    for (let i = 0; i < 2; i++) {
      const refResult = await manager.referenceMemory(storeResult.messageId, 'qa');
      assert.equal(refResult.promotion.promoted, false);
    }

    // 3rd reference triggers promotion
    const promotionResult = await manager.referenceMemory(storeResult.messageId, 'qa');
    assert.ok(promotionResult.promotion.promoted);
    assert.equal(promotionResult.promotion.fromTier, MemoryTier.CONVERSATION);
    assert.equal(promotionResult.promotion.toTier, MemoryTier.AGENT);

    const memory = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);
    assert.equal(memory.tier, MemoryTier.AGENT);
    assert.equal(memory.promotion_count, 1);
    assert.ok(memory.tier_promoted_at);

    manager.close();
  });

  it('should promote from agent to project tier after 5 references', async () => {
    const manager = await createTestManager({
      conversationToAgent: 3,
      agentToProject: 5,
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Project uses monorepo with pnpm workspaces',
      agentId: 'architect',
    });

    // Reference 3 times to promote to agent tier
    for (let i = 0; i < 3; i++) {
      await manager.referenceMemory(storeResult.messageId, 'developer');
    }

    let memory = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);
    assert.equal(memory.tier, MemoryTier.AGENT);

    // Reference 2 more times to promote to project tier
    for (let i = 0; i < 2; i++) {
      await manager.referenceMemory(storeResult.messageId, 'devops');
    }

    memory = manager.db.prepare('SELECT * FROM messages WHERE id = ?').get(storeResult.messageId);
    assert.equal(memory.tier, MemoryTier.PROJECT);
    assert.equal(memory.promotion_count, 2); // 2 promotions total

    manager.close();
  });

  it('should not promote if threshold not met', async () => {
    const manager = await createTestManager({
      conversationToAgent: 5,
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User likes inline documentation',
      agentId: 'developer',
    });

    // Reference 3 times (below threshold of 5)
    for (let i = 0; i < 3; i++) {
      const refResult = await manager.referenceMemory(storeResult.messageId, 'technical-writer');
      assert.equal(refResult.promotion.promoted, false);
    }

    const memory = manager.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(storeResult.messageId);
    assert.equal(memory.tier, MemoryTier.CONVERSATION);
    assert.equal(memory.promotion_count, 0);

    manager.close();
  });
});

// ============================================
// Cross-Tier Search Tests
// ============================================

describe('Hierarchical Memory - Cross-Tier Search', () => {
  it('should search across all tiers by default', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create memories in different tiers
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User asked about TypeScript best practices',
      tier: MemoryTier.CONVERSATION,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'TypeScript strict mode enabled in project',
      tier: MemoryTier.AGENT,
      agentId: 'architect',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'TypeScript version 5.x used across all projects',
      tier: MemoryTier.PROJECT,
      agentId: 'architect',
    });

    const searchResult = await manager.searchAcrossTiers('TypeScript');

    assert.ok(searchResult.results.length >= 3);
    assert.ok(searchResult.duration < 200); // Performance target: <200ms

    // Verify tier prioritization (project tier should rank higher)
    const projectMemory = searchResult.results.find(r => r.tier === MemoryTier.PROJECT);
    assert.ok(projectMemory);
    assert.equal(projectMemory.tier_priority, 3);

    manager.close();
  });

  it('should filter by specific tiers', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create memories in different tiers
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'User prefers React hooks',
      tier: MemoryTier.CONVERSATION,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'React 18 concurrent features used',
      tier: MemoryTier.PROJECT,
      agentId: 'architect',
    });

    // Search only project tier
    const searchResult = await manager.searchAcrossTiers('React', {
      tiers: [MemoryTier.PROJECT],
    });

    assert.ok(searchResult.results.length >= 1);
    assert.ok(searchResult.results.every(r => r.tier === MemoryTier.PROJECT));

    manager.close();
  });

  it('should filter by agent ID', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Database uses PostgreSQL 15',
      tier: MemoryTier.AGENT,
      agentId: 'database-architect',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'API uses GraphQL',
      tier: MemoryTier.AGENT,
      agentId: 'api-designer',
    });

    const searchResult = await manager.searchAcrossTiers('database OR API', {
      agentId: 'database-architect',
      tiers: [MemoryTier.AGENT],
    });

    // Should only return database-architect memories (or project-tier if any)
    const agentMemories = searchResult.results.filter(r => r.tier === MemoryTier.AGENT);
    assert.ok(agentMemories.every(r => r.agent_id === 'database-architect'));

    manager.close();
  });

  it('should respect importance threshold', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'High importance memory',
      importanceScore: 0.9,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Low importance memory',
      importanceScore: 0.2,
      agentId: 'developer',
    });

    const searchResult = await manager.searchAcrossTiers('importance', {
      minImportance: 0.5,
    });

    assert.ok(searchResult.results.length >= 1);
    assert.ok(searchResult.results.every(r => r.importance_score >= 0.5));

    manager.close();
  });
});

// ============================================
// Tier Retrieval Tests
// ============================================

describe('Hierarchical Memory - Tier Retrieval', () => {
  it('should retrieve memories by tier', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create 3 project-tier memories
    for (let i = 0; i < 3; i++) {
      await manager.storeMemory({
        conversationId: convInternalId,
        content: `Project memory ${i}`,
        tier: MemoryTier.PROJECT,
        agentId: 'architect',
      });
    }

    // Create 2 conversation-tier memories
    for (let i = 0; i < 2; i++) {
      await manager.storeMemory({
        conversationId: convInternalId,
        content: `Conversation memory ${i}`,
        tier: MemoryTier.CONVERSATION,
        agentId: 'developer',
      });
    }

    const projectMemories = await manager.getMemoriesByTier(MemoryTier.PROJECT, {
      conversationId: convInternalId,
    });
    assert.equal(projectMemories.length, 3);
    assert.ok(projectMemories.every(m => m.tier === MemoryTier.PROJECT));

    const conversationMemories = await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
      conversationId: convInternalId,
    });
    assert.equal(conversationMemories.length, 2);
    assert.ok(conversationMemories.every(m => m.tier === MemoryTier.CONVERSATION));

    manager.close();
  });

  it('should filter agent-tier memories by agent ID', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Developer memory 1',
      tier: MemoryTier.AGENT,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'QA memory 1',
      tier: MemoryTier.AGENT,
      agentId: 'qa',
    });

    const developerMemories = await manager.getMemoriesByTier(MemoryTier.AGENT, {
      agentId: 'developer',
    });

    assert.ok(developerMemories.length >= 1);
    assert.ok(developerMemories.every(m => m.agent_id === 'developer'));

    manager.close();
  });
});

// ============================================
// Memory Expiration Tests
// ============================================

describe('Hierarchical Memory - Expiration', () => {
  it('should expire conversation-tier memories after TTL', async () => {
    const manager = await createTestManager({
      conversationTTL: 0.0001, // 0.36 seconds (for testing)
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Short-lived conversation memory',
      tier: MemoryTier.CONVERSATION,
      agentId: 'developer',
    });

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 400));

    const result = await manager.expireOldMemories();
    assert.ok(result.success);
    assert.ok(result.conversationExpired >= 1);

    manager.close();
  });

  it('should not expire project-tier memories (no TTL)', async () => {
    const manager = await createTestManager({
      conversationTTL: 0.0001,
      agentTTL: 0.0001,
      projectTTL: null, // No expiration
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Permanent project memory',
      tier: MemoryTier.PROJECT,
      agentId: 'architect',
    });

    // Wait
    await new Promise(resolve => setTimeout(resolve, 400));

    await manager.expireOldMemories();

    const projectMemories = await manager.getMemoriesByTier(MemoryTier.PROJECT);
    assert.ok(projectMemories.length >= 1);

    manager.close();
  });
});

// ============================================
// Statistics Tests
// ============================================

describe('Hierarchical Memory - Statistics', () => {
  it('should return tier statistics', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create memories across tiers
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Conversation memory',
      tier: MemoryTier.CONVERSATION,
      importanceScore: 0.5,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Agent memory',
      tier: MemoryTier.AGENT,
      importanceScore: 0.7,
      agentId: 'developer',
    });

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Project memory',
      tier: MemoryTier.PROJECT,
      importanceScore: 0.9,
      agentId: 'architect',
    });

    const stats = await manager.getTierStats();

    assert.ok(stats[MemoryTier.CONVERSATION]);
    assert.ok(stats[MemoryTier.AGENT]);
    assert.ok(stats[MemoryTier.PROJECT]);

    // Use >= since other tests may have created memories in same database
    assert.ok(
      stats[MemoryTier.CONVERSATION].count >= 1,
      'Should have at least 1 conversation memory'
    );
    assert.ok(stats[MemoryTier.AGENT].count >= 1, 'Should have at least 1 agent memory');
    assert.ok(stats[MemoryTier.PROJECT].count >= 1, 'Should have at least 1 project memory');

    manager.close();
  });

  it('should identify promotion candidates', async () => {
    const manager = await createTestManager({
      conversationToAgent: 3,
    });
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Almost promoted memory',
      tier: MemoryTier.CONVERSATION,
      agentId: 'developer',
    });

    // Reference 2 times (1 away from promotion threshold of 3)
    await manager.referenceMemory(storeResult.messageId, 'developer');
    await manager.referenceMemory(storeResult.messageId, 'qa');

    const candidates = await manager.getPromotionCandidates(MemoryTier.CONVERSATION);

    assert.ok(candidates.length >= 1);
    assert.ok(candidates.some(c => c.id === storeResult.messageId));

    manager.close();
  });
});

// ============================================
// Performance Tests
// ============================================

describe('Hierarchical Memory - Performance', () => {
  it('should assign tier in <5ms', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const startTime = Date.now();
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Performance test memory',
      agentId: 'developer',
    });
    const duration = Date.now() - startTime;

    assert.ok(duration < 5, `Tier assignment took ${duration}ms (target: <5ms)`);

    manager.close();
  });

  it('should check promotion in <50ms', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    const storeResult = await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Promotion performance test',
      agentId: 'developer',
    });

    const startTime = Date.now();
    await manager.referenceMemory(storeResult.messageId, 'qa');
    const duration = Date.now() - startTime;

    assert.ok(duration < 50, `Promotion check took ${duration}ms (target: <50ms)`);

    manager.close();
  });

  it('should search across tiers in <200ms', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create 50 memories across tiers
    for (let i = 0; i < 50; i++) {
      const tier =
        i % 3 === 0 ? MemoryTier.PROJECT : i % 3 === 1 ? MemoryTier.AGENT : MemoryTier.CONVERSATION;
      await manager.storeMemory({
        conversationId: convInternalId,
        content: `Test memory ${i} about TypeScript and React`,
        tier,
        agentId: 'developer',
      });
    }

    const searchResult = await manager.searchAcrossTiers('TypeScript React');

    assert.ok(
      searchResult.duration < 200,
      `Search took ${searchResult.duration}ms (target: <200ms)`
    );

    manager.close();
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('Hierarchical Memory - Factory Function', () => {
  it('should create manager via factory function', async () => {
    const manager = createHierarchicalMemory({
      conversationToAgent: 5,
      agentToProject: 10,
    });

    await manager.initialize();

    assert.ok(manager.isInitialized);
    assert.equal(manager.options.conversationToAgent, 5);
    assert.equal(manager.options.agentToProject, 10);

    manager.close();
  });
});

// ============================================
// Security Tests - SEC-001: SQL Injection Prevention
// ============================================

describe('Hierarchical Memory - Security (SEC-001: SQL Injection)', () => {
  it('should reject SQL injection in orderBy parameter', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create a test memory first
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Test memory',
      agentId: 'developer',
    });

    // Attempt SQL injection via orderBy
    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'timestamp; DROP TABLE messages--',
        });
      },
      { message: /Invalid orderBy/ }
    );

    manager.close();
  });

  it('should reject SQL injection with UNION attack', async () => {
    const manager = await createTestManager();

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'id UNION SELECT * FROM messages',
        });
      },
      { message: /Invalid orderBy/ }
    );

    manager.close();
  });

  it('should reject SQL injection with comment bypass', async () => {
    const manager = await createTestManager();

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'created_at /* malicious comment */',
        });
      },
      { message: /Invalid orderBy/ }
    );

    manager.close();
  });

  it('should reject unknown column names in orderBy', async () => {
    const manager = await createTestManager();

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'malicious_column',
        });
      },
      { message: /Invalid orderBy column/ }
    );

    manager.close();
  });

  it('should accept valid orderBy values from allowlist', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    // Create memories
    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Test memory for valid orderBy',
      agentId: 'developer',
    });

    // Valid orderBy values should work
    const validOrderByValues = [
      'created_at DESC',
      'importance_score ASC',
      'reference_count DESC',
      'tier ASC',
      'id DESC',
    ];

    for (const orderBy of validOrderByValues) {
      const memories = await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
        orderBy,
        conversationId: convInternalId,
      });
      // Should not throw
      assert.ok(Array.isArray(memories), `orderBy "${orderBy}" should work`);
    }

    manager.close();
  });

  it('should use safe default for null/undefined orderBy', async () => {
    const manager = await createTestManager();
    const { conversationId, convInternalId } = await createTestConversation(manager.db);

    await manager.storeMemory({
      conversationId: convInternalId,
      content: 'Test memory for default orderBy',
      agentId: 'developer',
    });

    // Should not throw with null/undefined
    const memories1 = await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
      orderBy: null,
    });
    assert.ok(Array.isArray(memories1));

    const memories2 = await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
      orderBy: undefined,
    });
    assert.ok(Array.isArray(memories2));

    const memories3 = await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
      orderBy: '',
    });
    assert.ok(Array.isArray(memories3));

    manager.close();
  });

  it('should reject orderBy with quotes', async () => {
    const manager = await createTestManager();

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: "created_at'; DELETE FROM messages--",
        });
      },
      { message: /Invalid orderBy/ }
    );

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'created_at" OR "1"="1',
        });
      },
      { message: /Invalid orderBy/ }
    );

    manager.close();
  });

  it('should reject invalid direction in orderBy', async () => {
    const manager = await createTestManager();

    await assert.rejects(
      async () => {
        await manager.getMemoriesByTier(MemoryTier.CONVERSATION, {
          orderBy: 'created_at INVALID',
        });
      },
      { message: /Invalid orderBy direction/ }
    );

    manager.close();
  });
});
