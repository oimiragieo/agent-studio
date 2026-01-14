/**
 * Cross-Agent Memory Sharing Tests (Phase 4)
 *
 * Tests for:
 * - Agent Collaboration Manager
 * - Memory Handoff Service
 * - Session Resume Service
 * - Shared Entity Registry
 *
 * @module cross-agent-memory.test
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createMemoryDatabase } from './database.mjs';
import { createAgentCollaborationManager } from './agent-collaboration-manager.mjs';
import { createMemoryHandoffService } from './memory-handoff-service.mjs';
import { createSessionResumeService } from './session-resume-service.mjs';
import { createSharedEntityRegistry } from './shared-entity-registry.mjs';
import { createEntityMemory } from './entity-memory.mjs';

// Test database path
const TEST_DB_PATH = join(process.cwd(), '.claude', 'context', 'memory', 'test-cross-agent.db');

describe('Cross-Agent Memory Sharing (Phase 4)', () => {
  let db;
  let collaborationManager;
  let handoffService;
  let resumeService;
  let entityRegistry;
  let entityMemory;

  before(async () => {
    // Clean up test database if exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    // Create database
    db = createMemoryDatabase(TEST_DB_PATH);
    await db.initialize();

    // Create services
    collaborationManager = createAgentCollaborationManager(db);
    await collaborationManager.initialize();

    handoffService = createMemoryHandoffService({ database: db });
    await handoffService.initialize();

    resumeService = createSessionResumeService({ database: db });
    await resumeService.initialize();

    entityMemory = createEntityMemory(db);
    await entityMemory.initialize();

    entityRegistry = createSharedEntityRegistry({ database: db, entityMemory });
    await entityRegistry.initialize();

    console.log('[Test Setup] Phase 4 services initialized');
  });

  after(() => {
    // Clean up test database
    db.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    console.log('[Test Cleanup] Complete');
  });

  describe('Agent Collaboration Manager', () => {
    let sessionId;

    beforeEach(() => {
      sessionId = `test-session-${Date.now()}`;
      db.createSession({ sessionId, userId: 'test-user' });
    });

    it('should register collaboration between agents', async () => {
      const collaboration = await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        handoffContext: { memories: [], entities: [] },
      });

      assert.ok(collaboration.handoffId, 'Handoff ID should be generated');
      assert.strictEqual(collaboration.sourceAgentId, 'analyst');
      assert.strictEqual(collaboration.targetAgentId, 'developer');
      assert.strictEqual(collaboration.status, 'pending');
    });

    it('should detect circular handoffs', async () => {
      // Create chain: analyst → developer
      await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
      });

      // Create chain: developer → architect
      await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'developer',
        targetAgentId: 'architect',
      });

      // Attempt to create: architect → analyst (would create cycle)
      const circular = await collaborationManager.detectCircularHandoff(
        sessionId,
        'architect',
        'analyst'
      );

      assert.strictEqual(circular.isCircular, true, 'Should detect circular handoff');
      assert.ok(circular.cycle, 'Should return cycle path');
    });

    it('should track collaboration history', async () => {
      // Create multiple collaborations
      await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
      });

      // Small delay to ensure different timestamps (SQLite timestamp precision is 1 second)
      await new Promise(resolve => setTimeout(resolve, 10));

      await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'developer',
        targetAgentId: 'qa',
      });

      const history = await collaborationManager.getCollaborationHistory(sessionId);

      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].target_agent_id, 'qa'); // Most recent first
    });

    it('should get collaboration statistics', async () => {
      await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
      });

      const stats = await collaborationManager.getCollaborationStats(sessionId);

      assert.strictEqual(stats.total_collaborations, 1);
      assert.strictEqual(stats.unique_source_agents, 1);
    });

    it('should mark handoff as applied', async () => {
      const collaboration = await collaborationManager.registerCollaboration({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
      });

      await collaborationManager.markHandoffApplied(collaboration.handoffId);

      const updated = await collaborationManager.getCollaboration(collaboration.handoffId);
      assert.strictEqual(updated.status, 'applied');
      assert.ok(updated.applied_at);
    });
  });

  describe('Memory Handoff Service', () => {
    let sessionId, conversationId;

    beforeEach(async () => {
      sessionId = `test-session-${Date.now()}`;
      conversationId = `test-conv-${Date.now()}`;

      // Create session and conversation
      db.createSession({ sessionId, userId: 'test-user' });
      const convId = db.createConversation({ sessionId, conversationId });

      // Add some messages from source agent
      for (let i = 0; i < 5; i++) {
        db.addMessage({
          conversationId: convId,
          role: 'assistant',
          content: `Test message ${i} from analyst`,
        });

        // Update source_agent_id
        db.prepare(`
          UPDATE messages
          SET source_agent_id = ?
          WHERE conversation_id = ?
        `).run('analyst', convId);
      }
    });

    it('should prepare handoff context', async () => {
      const result = await handoffService.prepareHandoff({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        targetTask: 'Implement the analysis findings',
      });

      assert.ok(result.handoffId, 'Should generate handoff ID');
      assert.ok(result.context, 'Should have handoff context');
      assert.ok(result.metadata.memoriesShared >= 0, 'Should track memories shared');
    });

    it('should apply handoff context', async () => {
      // Prepare handoff
      const prepared = await handoffService.prepareHandoff({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        targetTask: 'Implement features',
      });

      // Apply handoff
      const applied = await handoffService.applyHandoffContext(prepared.handoffId);

      assert.strictEqual(applied.handoffId, prepared.handoffId);
      assert.strictEqual(applied.sourceAgentId, 'analyst');
      assert.strictEqual(applied.targetAgentId, 'developer');
      assert.ok(applied.context, 'Should have formatted context');
    });

    it('should check for pending handoffs', async () => {
      // Prepare handoff
      await handoffService.prepareHandoff({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        targetTask: 'Build feature',
      });

      // Check for pending handoff
      const pending = await handoffService.checkPendingHandoff(sessionId, 'developer');

      assert.ok(pending, 'Should find pending handoff');
      assert.strictEqual(pending.target_agent_id, 'developer');
    });

    it('should handle token budget constraints', async () => {
      const result = await handoffService.prepareHandoff({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        targetTask: 'Implement',
        tokenBudget: 500, // Small budget
      });

      assert.ok(result.metadata.tokensUsed <= 500, 'Should respect token budget');
    });
  });

  describe('Session Resume Service', () => {
    let sessionId, conversationId;

    beforeEach(async () => {
      sessionId = `test-session-${Date.now()}`;
      conversationId = `test-conv-${Date.now()}`;

      // Create session and conversation
      db.createSession({ sessionId, userId: 'test-user' });
      const convId = db.createConversation({ sessionId, conversationId });

      // Add messages
      for (let i = 0; i < 10; i++) {
        db.addMessage({
          conversationId: convId,
          role: 'user',
          content: `Message ${i}`,
        });
      }
    });

    it('should create checkpoint', async () => {
      const checkpoint = await resumeService.createCheckpoint({
        sessionId,
        checkpointType: 'manual',
        agentsInvolved: ['analyst', 'developer'],
      });

      assert.ok(checkpoint.checkpointId, 'Should generate checkpoint ID');
      assert.strictEqual(checkpoint.checkpointType, 'manual');
      assert.ok(checkpoint.memoryCount > 0, 'Should snapshot memories');
    });

    it('should resume session with full context', async () => {
      // Create checkpoint
      const checkpoint = await resumeService.createCheckpoint({
        sessionId,
        checkpointType: 'workflow',
      });

      // Resume session
      const resumed = await resumeService.resumeSession({
        checkpointId: checkpoint.checkpointId,
        mode: 'full',
      });

      assert.strictEqual(resumed.mode, 'full');
      assert.ok(resumed.context.memories.length > 0, 'Should have memories');
      assert.ok(resumed.context.formatted, 'Should have formatted context');
    });

    it('should resume session with partial context', async () => {
      // Create checkpoint
      const checkpoint = await resumeService.createCheckpoint({
        sessionId,
      });

      // Resume with partial mode
      const resumed = await resumeService.resumeSession({
        checkpointId: checkpoint.checkpointId,
        mode: 'partial',
      });

      assert.strictEqual(resumed.mode, 'partial');
      assert.ok(resumed.context.memories.length <= 50, 'Should limit memories in partial mode');
    });

    it('should get available resume points', async () => {
      // Create multiple checkpoints
      await resumeService.createCheckpoint({ sessionId, checkpointType: 'manual' });
      await resumeService.createCheckpoint({ sessionId, checkpointType: 'automatic' });

      const resumePoints = await resumeService.getResumePoints(sessionId);

      assert.strictEqual(resumePoints.length, 2);
      assert.ok(resumePoints.every(p => p.checkpointId), 'All should have checkpoint IDs');
    });

    it('should update checkpoint stats after resume', async () => {
      const checkpoint = await resumeService.createCheckpoint({ sessionId });

      // Resume multiple times
      await resumeService.resumeSession({ checkpointId: checkpoint.checkpointId, mode: 'full' });
      await resumeService.resumeSession({ checkpointId: checkpoint.checkpointId, mode: 'partial' });

      // Get resume points
      const points = await resumeService.getResumePoints(sessionId);
      const point = points.find(p => p.checkpointId === checkpoint.checkpointId);

      assert.strictEqual(point.resumeCount, 2, 'Should track resume count');
    });
  });

  describe('Shared Entity Registry', () => {
    it('should create global entity', async () => {
      const entity = await entityRegistry.getGlobalEntity({
        type: 'tool',
        value: 'TypeScript',
        agentId: 'analyst',
        metadata: { confidence: 0.9 },
      });

      assert.ok(entity.id, 'Should have entity ID');
      assert.strictEqual(entity.value, 'TypeScript');
      assert.strictEqual(entity.is_global, 1, 'Should be marked as global');
    });

    it('should deduplicate entities', async () => {
      // Create entity from analyst
      const entity1 = await entityRegistry.getGlobalEntity({
        type: 'tool',
        value: 'React',
        agentId: 'analyst',
      });

      // Create same entity from developer
      const entity2 = await entityRegistry.getGlobalEntity({
        type: 'tool',
        value: 'React',
        agentId: 'developer',
      });

      // Should be same entity (deduplicated)
      assert.strictEqual(entity1.id, entity2.id, 'Should return same entity');
      assert.ok(entity2.merge_count > 0, 'Should track merge');
    });

    it('should merge similar entities', async () => {
      // Create entity with slightly different value
      const entity1 = await entityRegistry.getGlobalEntity({
        type: 'person',
        value: 'John Smith',
        agentId: 'analyst',
      });

      const entity2 = await entityRegistry.getGlobalEntity({
        type: 'person',
        value: 'john smith', // Same name, different case
        agentId: 'developer',
      });

      // Should merge into same entity
      assert.strictEqual(entity1.id, entity2.id, 'Should merge similar entities');
    });

    it('should get global entities by type', async () => {
      // Create multiple tool entities
      await entityRegistry.getGlobalEntity({
        type: 'tool',
        value: 'Node.js',
        agentId: 'developer',
      });

      await entityRegistry.getGlobalEntity({
        type: 'tool',
        value: 'PostgreSQL',
        agentId: 'database-architect',
      });

      const tools = await entityRegistry.getGlobalEntitiesByType('tool');

      assert.ok(tools.length >= 2, 'Should return global tool entities');
    });

    it('should get entity statistics', async () => {
      const stats = await entityRegistry.getEntityStats();

      assert.ok(stats.globalEntities, 'Should have global entities stats');
      assert.ok(Array.isArray(stats.globalEntities), 'Should be array');
    });

    it('should track entity version on merge', async () => {
      const entity1 = await entityRegistry.getGlobalEntity({
        type: 'framework',
        value: 'Express',
        agentId: 'developer',
      });

      const initialVersion = entity1.version;

      // Merge with same entity
      const entity2 = await entityRegistry.getGlobalEntity({
        type: 'framework',
        value: 'Express',
        agentId: 'architect',
        metadata: { context: 'Web framework' },
      });

      assert.strictEqual(entity2.version, initialVersion + 1, 'Should increment version on merge');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full handoff workflow', async () => {
      const sessionId = `integration-session-${Date.now()}`;
      const conversationId = `integration-conv-${Date.now()}`;

      // 1. Create session
      db.createSession({ sessionId, userId: 'test-user' });
      const convId = db.createConversation({ sessionId, conversationId });

      // 2. Analyst creates messages
      for (let i = 0; i < 5; i++) {
        db.addMessage({
          conversationId: convId,
          role: 'assistant',
          content: `Analysis finding ${i}`,
        });

        db.prepare(`
          UPDATE messages SET source_agent_id = ? WHERE conversation_id = ?
        `).run('analyst', convId);
      }

      // 3. Prepare handoff to developer
      const handoff = await handoffService.prepareHandoff({
        sessionId,
        sourceAgentId: 'analyst',
        targetAgentId: 'developer',
        targetTask: 'Implement the analysis findings',
      });

      assert.ok(handoff.handoffId, 'Should create handoff');

      // 4. Developer applies handoff
      const applied = await handoffService.applyHandoffContext(handoff.handoffId);

      assert.ok(applied.context, 'Should have context');

      // 5. Check collaboration history
      const history = await collaborationManager.getCollaborationHistory(sessionId);
      assert.strictEqual(history.length, 1, 'Should track collaboration');
    });

    it('should support checkpoint and resume workflow', async () => {
      const sessionId = `checkpoint-session-${Date.now()}`;
      const conversationId = `checkpoint-conv-${Date.now()}`;

      // 1. Create session with messages
      db.createSession({ sessionId, userId: 'test-user' });
      const convId = db.createConversation({ sessionId, conversationId });

      for (let i = 0; i < 10; i++) {
        db.addMessage({
          conversationId: convId,
          role: 'user',
          content: `Message ${i}`,
        });
      }

      // 2. Create checkpoint
      const checkpoint = await resumeService.createCheckpoint({
        sessionId,
        checkpointType: 'workflow',
        agentsInvolved: ['analyst', 'developer'],
      });

      assert.ok(checkpoint.checkpointId, 'Should create checkpoint');

      // 3. Resume session
      const resumed = await resumeService.resumeSession({
        checkpointId: checkpoint.checkpointId,
        mode: 'full',
      });

      assert.ok(resumed.context.memories.length > 0, 'Should restore context');
      assert.strictEqual(resumed.metadata.checkpointType, 'workflow');
    });
  });
});

console.log('[Cross-Agent Memory Tests] Test suite loaded');
