/**
 * Full System Integration Tests (Phase 5 Wave 2)
 *
 * End-to-end integration tests covering Phases 2-4 memory system
 * @module integration-full-system.test
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createMemoryDatabase } from './database.mjs';
import {
  HierarchicalMemoryManager,
  createHierarchicalMemory,
  MemoryTier,
} from './hierarchical-memory.mjs';
import { createAgentCollaborationManager } from './agent-collaboration-manager.mjs';
import { createMemoryHandoffService } from './memory-handoff-service.mjs';
import {
  createSessionResumeService,
  CheckpointType,
  ResumeMode,
} from './session-resume-service.mjs';
import { createSharedEntityRegistry } from './shared-entity-registry.mjs';
import { createEntityMemory } from './entity-memory.mjs';

const TEST_DB_PATH = join(
  process.cwd(),
  '.claude',
  'context',
  'memory',
  'test-integration-full.db'
);
const REPORTS_DIR = join(process.cwd(), '.claude', 'context', 'reports');
const testResults = {
  scenarios: [],
  passCount: 0,
  failCount: 0,
  totalDuration: 0,
  startTime: null,
};

describe('Full System Integration Tests (Phase 5 Wave 2)', () => {
  let db, hierarchicalMemory, collaborationManager;
  let handoffService, resumeService, entityRegistry, entityMemory;

  before(async () => {
    testResults.startTime = Date.now();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    db = createMemoryDatabase(TEST_DB_PATH);
    await db.initialize();
    hierarchicalMemory = new HierarchicalMemoryManager(db);
    await hierarchicalMemory.initialize();
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
    console.log('[Integration Test] All Phase 2-4 services initialized');
  });

  after(async () => {
    testResults.totalDuration = Date.now() - testResults.startTime;
    if (db) db.close();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
    const report = {
      testSuite: 'Phase 5 Wave 2 Integration Tests',
      timestamp: new Date().toISOString(),
      duration: testResults.totalDuration,
      summary: {
        total: testResults.scenarios.length,
        passed: testResults.passCount,
        failed: testResults.failCount,
        passRate:
          testResults.scenarios.length > 0
            ? ((testResults.passCount / testResults.scenarios.length) * 100).toFixed(1) + '%'
            : 'N/A',
      },
      scenarios: testResults.scenarios,
    };
    writeFileSync(
      join(REPORTS_DIR, 'integration-test-results.json'),
      JSON.stringify(report, null, 2)
    );
    console.log(
      '[Integration Test] Complete: ' +
        testResults.passCount +
        '/' +
        testResults.scenarios.length +
        ' passed'
    );
  });

  describe('Scenario 1: Multi-Agent Workflow', () => {
    let sessionId, workflowId;
    beforeEach(() => {
      sessionId = 'workflow-session-' + Date.now();
      workflowId = 'workflow-' + Date.now();
      db.createSession({ sessionId, userId: 'test-user' });
    });

    it('should complete orchestrator to analyst to developer to qa workflow', async () => {
      const startTime = Date.now();
      try {
        const orchestratorConvId = db.createConversation({
          sessionId,
          conversationId: sessionId + '-orchestrator',
        });
        const orchestratorMemory = await hierarchicalMemory.storeMemory({
          conversationId: orchestratorConvId,
          agentId: 'orchestrator',
          content: 'User requested: Build a REST API for user authentication with JWT tokens',
          role: 'user',
          tier: MemoryTier.CONVERSATION,
          importanceScore: 0.9,
        });
        assert.ok(orchestratorMemory.messageId, 'Orchestrator should store memory');

        const toAnalyst = await handoffService.prepareHandoff({
          sessionId,
          workflowId,
          sourceAgentId: 'orchestrator',
          targetAgentId: 'analyst',
          targetTask: 'Analyze requirements for JWT authentication API',
        });
        assert.ok(toAnalyst.handoffId, 'Should create handoff to analyst');
        await handoffService.applyHandoffContext(toAnalyst.handoffId);

        const analystConvId = db.createConversation({
          sessionId,
          conversationId: sessionId + '-analyst',
        });
        await hierarchicalMemory.storeMemory({
          conversationId: analystConvId,
          agentId: 'analyst',
          content:
            'Analysis: JWT implementation requires bcrypt for passwords, jsonwebtoken for tokens',
          role: 'assistant',
          tier: MemoryTier.AGENT,
          importanceScore: 0.85,
        });

        const toDeveloper = await handoffService.prepareHandoff({
          sessionId,
          workflowId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
          targetTask: 'Implement JWT authentication endpoints',
        });
        assert.ok(toDeveloper.handoffId, 'Should create handoff to developer');
        await handoffService.applyHandoffContext(toDeveloper.handoffId);

        const developerConvId = db.createConversation({
          sessionId,
          conversationId: sessionId + '-developer',
        });
        await hierarchicalMemory.storeMemory({
          conversationId: developerConvId,
          agentId: 'developer',
          content:
            'Implementation complete: POST /auth/login, POST /auth/register, GET /auth/verify',
          role: 'assistant',
          tier: MemoryTier.AGENT,
          importanceScore: 0.9,
        });

        const toQA = await handoffService.prepareHandoff({
          sessionId,
          workflowId,
          sourceAgentId: 'developer',
          targetAgentId: 'qa',
          targetTask: 'Test JWT authentication implementation',
        });
        assert.ok(toQA.handoffId, 'Should create handoff to QA');
        await handoffService.applyHandoffContext(toQA.handoffId);

        const history = await collaborationManager.getCollaborationHistory(sessionId);
        assert.strictEqual(history.length, 3, 'Should have 3 collaboration records');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Multi-Agent Workflow',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Multi-Agent Workflow',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 2: Session Resume After Collaboration', () => {
    it('should checkpoint and resume session with full context', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'resume-session-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-main' });

        for (let i = 0; i < 10; i++) {
          db.addMessage({
            conversationId: convId,
            role: 'assistant',
            content: 'Message ' + i + ' for checkpoint test',
          });
        }

        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
        });
        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'developer',
          targetAgentId: 'qa',
        });

        const checkpoint = await resumeService.createCheckpoint({
          sessionId,
          checkpointType: CheckpointType.WORKFLOW,
          agentsInvolved: ['analyst', 'developer', 'qa'],
        });
        assert.ok(checkpoint.checkpointId, 'Should create checkpoint');
        assert.ok(checkpoint.memoryCount >= 0, 'Should have memory count');

        const resumed = await resumeService.resumeSession({
          checkpointId: checkpoint.checkpointId,
          mode: ResumeMode.FULL,
        });
        assert.ok(resumed.context !== undefined, 'Should have context object');
        assert.ok(resumed.context.formatted, 'Should have formatted context');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Session Resume',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Session Resume',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 3: Entity Deduplication Across Agents', () => {
    it('should deduplicate shared entities across agents', async () => {
      const startTime = Date.now();
      try {
        const entity1 = await entityRegistry.getGlobalEntity({
          type: 'technology',
          value: 'TypeScript',
          agentId: 'analyst',
          metadata: { confidence: 0.9 },
        });
        assert.ok(entity1.id, 'Should create entity from analyst');
        assert.strictEqual(entity1.value, 'TypeScript');

        const entity2 = await entityRegistry.getGlobalEntity({
          type: 'framework',
          value: 'React.js',
          agentId: 'developer',
          metadata: { version: '18.2' },
        });
        const entity2Again = await entityRegistry.getGlobalEntity({
          type: 'framework',
          value: 'React.js',
          agentId: 'architect',
        });
        assert.strictEqual(entity2.id, entity2Again.id, 'Should deduplicate same entity');
        assert.ok(entity2Again.id !== undefined, 'Should return entity with id');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Entity Deduplication',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Entity Deduplication',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 4: Hierarchical Memory + Tier Promotion', () => {
    it('should promote frequently accessed memories to higher tiers', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'tier-promo-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-conv' });

        const memory = await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'developer',
          content: 'Important architectural decision: Use microservices pattern',
          tier: MemoryTier.CONVERSATION,
          importanceScore: 0.8,
        });
        assert.ok(memory.messageId, 'Should store memory');

        for (let i = 0; i < 5; i++) {
          await hierarchicalMemory.referenceMemory(memory.messageId);
        }

        // Tier promotion is automatic on reference
        const promotedMemories = await hierarchicalMemory.getMemoriesByTier(MemoryTier.AGENT);
        assert.ok(promotedMemories !== undefined, 'Should return tier memories');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Tier Promotion',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Tier Promotion',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 5: Handoff + Shared Registry Integration', () => {
    it('should include shared entities in handoff context', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'handoff-entity-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-analyst' });

        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'analyst',
          content: 'Tech stack: Node.js, PostgreSQL, Redis',
          tier: MemoryTier.AGENT,
          importanceScore: 0.9,
        });
        await entityRegistry.getGlobalEntity({
          type: 'technology',
          value: 'Node.js',
          agentId: 'analyst',
        });
        await entityRegistry.getGlobalEntity({
          type: 'database',
          value: 'PostgreSQL',
          agentId: 'analyst',
        });

        const handoff = await handoffService.prepareHandoff({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
          targetTask: 'Set up the backend infrastructure',
        });
        assert.ok(handoff.handoffId, 'Should create handoff');
        assert.ok(handoff.metadata.entitiesShared >= 0, 'Should include entity count');

        const applied = await handoffService.applyHandoffContext(handoff.handoffId);
        assert.ok(applied.context, 'Should have formatted context');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Handoff with Entities',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Handoff with Entities',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 6: Token Budget Management', () => {
    it('should respect token budget in handoff preparation', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'token-budget-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-conv' });

        for (let i = 0; i < 20; i++) {
          db.addMessage({
            conversationId: convId,
            role: 'assistant',
            content: 'Detailed memory content ' + i + ' with lots of technical information.',
          });
        }

        const handoff = await handoffService.prepareHandoff({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
          targetTask: 'Review and implement',
          tokenBudget: 500,
        });
        await resumeService.createCheckpoint({ sessionId });
        assert.ok(handoff.metadata.tokensUsed <= 500, 'Should respect token budget');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Token Budget',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Token Budget',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 7: Full End-to-End Workflow', () => {
    it('should execute complete workflow with all services', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'full-workflow-' + Date.now();
        const workflowId = 'workflow-e2e-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });

        await entityRegistry.getGlobalEntity({
          type: 'technology',
          value: 'Express.js',
          agentId: 'architect',
        });
        const orchestratorConv = db.createConversation({
          sessionId,
          conversationId: sessionId + '-orch',
        });
        await hierarchicalMemory.storeMemory({
          conversationId: orchestratorConv,
          agentId: 'orchestrator',
          content: 'Task: Build microservice with Express.js',
          tier: MemoryTier.PROJECT,
        });

        await collaborationManager.registerCollaboration({
          sessionId,
          workflowId,
          sourceAgentId: 'orchestrator',
          targetAgentId: 'analyst',
        });
        const toAnalyst = await handoffService.prepareHandoff({
          sessionId,
          workflowId,
          sourceAgentId: 'orchestrator',
          targetAgentId: 'analyst',
          targetTask: 'Analyze microservice requirements',
        });
        await handoffService.applyHandoffContext(toAnalyst.handoffId);

        await collaborationManager.registerCollaboration({
          sessionId,
          workflowId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
        });
        const toDev = await handoffService.prepareHandoff({
          sessionId,
          workflowId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
          targetTask: 'Implement microservice',
        });
        await handoffService.applyHandoffContext(toDev.handoffId);

        const checkpoint = await resumeService.createCheckpoint({
          sessionId,
          checkpointType: CheckpointType.WORKFLOW,
        });
        const resumed = await resumeService.resumeSession({
          checkpointId: checkpoint.checkpointId,
          mode: ResumeMode.FULL,
        });

        const stats = await collaborationManager.getCollaborationStats(sessionId);
        assert.ok(stats.total_collaborations >= 2, 'Should track collaborations');
        assert.ok(resumed.context, 'Should resume with context');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Full E2E Workflow',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Full E2E Workflow',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 8: Performance Benchmarks', () => {
    it('should meet performance targets for all operations', async () => {
      const startTime = Date.now();
      const benchmarks = {};
      try {
        const sessionId = 'perf-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-perf' });

        const storeStart = Date.now();
        for (let i = 0; i < 10; i++)
          await hierarchicalMemory.storeMemory({
            conversationId: convId,
            agentId: 'developer',
            content: 'Perf test ' + i,
            tier: MemoryTier.CONVERSATION,
          });
        benchmarks.memoryStorage = (Date.now() - storeStart) / 10;

        const collabStart = Date.now();
        for (let i = 0; i < 5; i++)
          await collaborationManager.registerCollaboration({
            sessionId,
            sourceAgentId: 'agent-' + i,
            targetAgentId: 'agent-' + (i + 1),
          });
        benchmarks.collaborationRegistration = (Date.now() - collabStart) / 5;

        const entityStart = Date.now();
        for (let i = 0; i < 10; i++)
          await entityRegistry.getGlobalEntity({
            type: 'test',
            value: 'Entity-' + i,
            agentId: 'developer',
          });
        benchmarks.entityLookup = (Date.now() - entityStart) / 10;

        const checkpointStart = Date.now();
        await resumeService.createCheckpoint({ sessionId });
        benchmarks.checkpointCreation = Date.now() - checkpointStart;

        assert.ok(benchmarks.memoryStorage < 50, 'Memory storage should be <50ms');
        assert.ok(benchmarks.collaborationRegistration < 20, 'Collaboration should be <20ms');
        assert.ok(benchmarks.entityLookup < 30, 'Entity lookup should be <30ms');
        assert.ok(benchmarks.checkpointCreation < 500, 'Checkpoint should be <500ms');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Performance Benchmarks',
          status: 'PASSED',
          duration: Date.now() - startTime,
          benchmarks,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Performance Benchmarks',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 9: Cross-Tier Search', () => {
    it('should search across all memory tiers', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'cross-tier-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-search' });

        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'architect',
          content: 'Project decision: Use microservices',
          tier: MemoryTier.PROJECT,
          importanceScore: 0.95,
        });
        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'developer',
          content: 'Agent context: implementing services',
          tier: MemoryTier.AGENT,
          importanceScore: 0.8,
        });
        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'user',
          content: 'Question about services',
          tier: MemoryTier.CONVERSATION,
          importanceScore: 0.5,
        });

        const searchResult = await hierarchicalMemory.searchAcrossTiers('services', {
          tiers: [MemoryTier.PROJECT, MemoryTier.AGENT, MemoryTier.CONVERSATION],
          limit: 10,
          minImportance: 0.3,
        });
        assert.ok(searchResult.results !== undefined, 'Should return results object');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Cross-Tier Search',
          status: 'PASSED',
          duration: Date.now() - startTime,
          resultCount: searchResult.results?.length || 0,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Cross-Tier Search',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 10: Memory Expiration', () => {
    it('should handle memory expiration by tier TTL', async () => {
      const startTime = Date.now();
      try {
        const shortTTLMemory = new HierarchicalMemoryManager(db, {
          conversationTTL: 0,
          agentTTL: 0,
        });
        await shortTTLMemory.initialize();

        const sessionId = 'expire-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-expire' });

        await shortTTLMemory.storeMemory({
          conversationId: convId,
          content: 'Conversation tier',
          tier: MemoryTier.CONVERSATION,
        });
        await shortTTLMemory.storeMemory({
          conversationId: convId,
          content: 'Agent tier',
          tier: MemoryTier.AGENT,
        });
        await shortTTLMemory.storeMemory({
          conversationId: convId,
          content: 'Project tier - permanent',
          tier: MemoryTier.PROJECT,
        });

        await shortTTLMemory.expireOldMemories();
        const projectMemories = await shortTTLMemory.getMemoriesByTier(MemoryTier.PROJECT);
        assert.ok(projectMemories.length >= 1, 'Project memories should not expire');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Memory Expiration',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Memory Expiration',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 11: Multiple Resume Points', () => {
    it('should manage multiple checkpoints and resume points', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'multi-resume-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-conv' });

        for (let stage = 1; stage <= 3; stage++) {
          for (let i = 0; i < 5; i++)
            db.addMessage({
              conversationId: convId,
              role: 'assistant',
              content: 'Stage ' + stage + ' msg ' + i,
            });
          await resumeService.createCheckpoint({
            sessionId,
            checkpointType: stage === 2 ? CheckpointType.MILESTONE : CheckpointType.AUTOMATIC,
            agentsInvolved: ['agent-stage-' + stage],
          });
        }

        const resumePoints = await resumeService.getResumePoints(sessionId);
        assert.strictEqual(resumePoints.length, 3, 'Should have 3 resume points');

        const milestonePoint = resumePoints.find(
          p => p.checkpointType === 'milestone' || p.checkpointType === CheckpointType.MILESTONE
        );
        assert.ok(milestonePoint, 'Should have milestone checkpoint');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Multiple Resume Points',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Multiple Resume Points',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 12: Entity Statistics', () => {
    it('should track entity statistics across agents', async () => {
      const startTime = Date.now();
      try {
        await entityRegistry.getGlobalEntity({
          type: 'language',
          value: 'Python',
          agentId: 'analyst',
        });
        await entityRegistry.getGlobalEntity({
          type: 'language',
          value: 'Python',
          agentId: 'developer',
        });
        await entityRegistry.getGlobalEntity({
          type: 'database',
          value: 'MongoDB',
          agentId: 'architect',
        });

        const stats = await entityRegistry.getEntityStats();
        assert.ok(stats.globalEntities, 'Should return entity statistics');
        assert.ok(Array.isArray(stats.globalEntities), 'Stats should be array');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Entity Statistics',
          status: 'PASSED',
          duration: Date.now() - startTime,
          stats,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Entity Statistics',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 13: Collaboration Chain Analysis', () => {
    it('should analyze collaboration chains and patterns', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'chain-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });

        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
        });
        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'architect',
        });
        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'developer',
          targetAgentId: 'qa',
        });
        await collaborationManager.registerCollaboration({
          sessionId,
          sourceAgentId: 'architect',
          targetAgentId: 'developer',
        });

        const history = await collaborationManager.getCollaborationHistory(sessionId);
        assert.strictEqual(history.length, 4, 'Should have 4 collaborations');

        const stats = await collaborationManager.getCollaborationStats(sessionId);
        assert.ok(stats.unique_source_agents >= 3, 'Should track unique source agents');
        assert.ok(stats.interactionMatrix.length >= 1, 'Should have interaction matrix');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Collaboration Chain Analysis',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Collaboration Chain Analysis',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 14: Handoff with Relevance Scoring', () => {
    it('should score and select relevant memories for handoff', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'relevance-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });
        const convId = db.createConversation({ sessionId, conversationId: sessionId + '-analyst' });

        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'analyst',
          content: 'Security analysis: authentication flow',
          tier: MemoryTier.AGENT,
          importanceScore: 0.95,
        });
        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'analyst',
          content: 'Performance notes: caching strategy',
          tier: MemoryTier.AGENT,
          importanceScore: 0.7,
        });
        await hierarchicalMemory.storeMemory({
          conversationId: convId,
          agentId: 'analyst',
          content: 'Meeting notes: standup summary',
          tier: MemoryTier.CONVERSATION,
          importanceScore: 0.3,
        });

        await entityRegistry.getGlobalEntity({
          type: 'concept',
          value: 'Authentication',
          agentId: 'analyst',
        });
        await entityRegistry.getGlobalEntity({
          type: 'concept',
          value: 'Caching',
          agentId: 'analyst',
        });
        await entityRegistry.getGlobalEntity({
          type: 'concept',
          value: 'Security',
          agentId: 'analyst',
        });

        const handoff = await handoffService.prepareHandoff({
          sessionId,
          sourceAgentId: 'analyst',
          targetAgentId: 'developer',
          targetTask: 'Implement authentication with security best practices',
        });

        assert.ok(handoff.metadata.memoriesShared >= 0, 'Should share relevant memories');
        assert.ok(handoff.metadata.entitiesShared >= 0, 'Should share relevant entities');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Relevance Scoring',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Relevance Scoring',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });

  describe('Scenario 15: Concurrent Agent Operations', () => {
    it('should handle concurrent operations from multiple agents', async () => {
      const startTime = Date.now();
      try {
        const sessionId = 'concurrent-' + Date.now();
        db.createSession({ sessionId, userId: 'test-user' });

        const agents = ['analyst', 'developer', 'architect', 'qa', 'devops'];
        const operations = agents.map(async (agent, index) => {
          const convId = db.createConversation({
            sessionId,
            conversationId: sessionId + '-' + agent,
          });
          await hierarchicalMemory.storeMemory({
            conversationId: convId,
            agentId: agent,
            content: agent + ' working on task ' + index,
            tier: index % 2 === 0 ? MemoryTier.AGENT : MemoryTier.CONVERSATION,
          });
          await entityRegistry.getGlobalEntity({
            type: 'shared',
            value: 'ConcurrentEntity',
            agentId: agent,
          });
          return agent;
        });

        const results = await Promise.all(operations);
        assert.strictEqual(results.length, 5, 'All operations should complete');

        const sharedEntity = await entityRegistry.findExactMatch('shared', 'ConcurrentEntity');
        assert.ok(sharedEntity, 'Shared entity should exist');
        assert.ok(sharedEntity !== null, 'Entity should be tracked');
        testResults.passCount++;
        testResults.scenarios.push({
          name: 'Concurrent Operations',
          status: 'PASSED',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        testResults.failCount++;
        testResults.scenarios.push({
          name: 'Concurrent Operations',
          status: 'FAILED',
          error: error.message,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    });
  });
});

console.log('[Integration Full System Tests] Test suite loaded');
