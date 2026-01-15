#!/usr/bin/env node
/**
 * Session State Manager Tests
 *
 * Tests for session-state.mjs including:
 * - Session initialization
 * - Model tracking
 * - Cost tracking
 * - Routing metrics
 * - State persistence
 */

import { strict as assert } from 'assert';
import { unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';
import {
  initSession,
  loadSessionState,
  updateSessionState,
  clearSession,
  recordRoutingDecision,
  updateModelUsage,
  getSessionCosts,
  getRoutingMetrics,
  listSessions,
  cleanupOldSessions,
} from './session-state.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_STATE_DIR = resolveRuntimePath('sessions', { write: true });

// ===========================
// Test Utilities
// ===========================

function cleanupTestSessions() {
  try {
    if (existsSync(SESSION_STATE_DIR)) {
      const files = readdirSync(SESSION_STATE_DIR);
      for (const file of files) {
        if (file.startsWith('test-') || file.endsWith('.lock') || file.endsWith('.tmp')) {
          const filePath = join(SESSION_STATE_DIR, file);
          try {
            unlinkSync(filePath);
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// ===========================
// Tests
// ===========================

console.log('Running Session State Manager Tests...\n');

// Test 1: Session Initialization (Router)
(() => {
  console.log('Test 1: Initialize router session');
  const sessionId = `test-router-${Date.now()}`;

  const state = initSession(sessionId, 'router', {
    initialPrompt: 'Test prompt for router',
  });

  assert.equal(state.session_id, sessionId, 'Session ID should match');
  assert.equal(state.agent_role, 'router', 'Role should be router');
  assert.equal(state.model, 'claude-haiku-4-5', 'Default router model should be Haiku');
  assert.equal(state.initial_prompt, 'Test prompt for router', 'Initial prompt should be stored');
  assert.equal(state.routingDecisions.total, 0, 'Routing decisions should start at 0');
  assert.equal(state.costs.total, 0, 'Total cost should start at 0');
  assert.ok(state.modelHistory.length === 1, 'Model history should have 1 entry');
  assert.equal(
    state.modelHistory[0].model,
    'claude-haiku-4-5',
    'Model history should record initial model'
  );

  clearSession(sessionId);
  console.log('✅ Test 1 passed\n');
})();

// Test 2: Session Initialization (Orchestrator)
(() => {
  console.log('Test 2: Initialize orchestrator session');
  const sessionId = `test-orch-${Date.now()}`;

  const state = initSession(sessionId, 'orchestrator');

  assert.equal(state.session_id, sessionId, 'Session ID should match');
  assert.equal(state.agent_role, 'orchestrator', 'Role should be orchestrator');
  assert.equal(state.model, 'claude-sonnet-4-5', 'Default orchestrator model should be Sonnet');
  assert.equal(state.read_count, 0, 'Read count should start at 0');
  assert.equal(state.violations.length, 0, 'Violations should be empty');

  clearSession(sessionId);
  console.log('✅ Test 2 passed\n');
})();

// Test 3: Load and Update Session State
(() => {
  console.log('Test 3: Load and update session state');
  const sessionId = `test-load-${Date.now()}`;

  // Initialize session
  initSession(sessionId, 'router');

  // Load session
  const loadedState = loadSessionState(sessionId);
  assert.ok(loadedState, 'Session should load successfully');
  assert.equal(loadedState.session_id, sessionId, 'Loaded session ID should match');

  // Update session
  const updatedState = updateSessionState(sessionId, {
    metadata: { testKey: 'testValue' },
  });
  assert.equal(updatedState.metadata.testKey, 'testValue', 'Metadata should be updated');

  // Verify update persisted
  const reloadedState = loadSessionState(sessionId);
  assert.equal(reloadedState.metadata.testKey, 'testValue', 'Updated metadata should persist');

  clearSession(sessionId);
  console.log('✅ Test 3 passed\n');
})();

// Test 4: Record Routing Decision
(() => {
  console.log('Test 4: Record routing decision');
  const sessionId = `test-routing-${Date.now()}`;

  initSession(sessionId, 'router');

  // Record simple routing
  recordRoutingDecision(sessionId, {
    type: 'simple',
    complexity: 0.3,
    confidence: 0.9,
    workflow: null,
  });

  let state = loadSessionState(sessionId);
  assert.equal(state.routingDecisions.total, 1, 'Total routing decisions should be 1');
  assert.equal(state.routingDecisions.simpleHandled, 1, 'Simple handled should be 1');
  assert.equal(
    state.routingDecisions.routedToOrchestrator,
    0,
    'Routed to orchestrator should be 0'
  );
  assert.equal(state.routingDecisions.averageComplexity, 0.3, 'Average complexity should be 0.3');
  assert.equal(state.routingDecisions.averageConfidence, 0.9, 'Average confidence should be 0.9');

  // Record orchestrator routing
  recordRoutingDecision(sessionId, {
    type: 'orchestrator',
    complexity: 0.8,
    confidence: 0.95,
    workflow: '@.claude/workflows/greenfield-fullstack.yaml',
  });

  state = loadSessionState(sessionId);
  assert.equal(state.routingDecisions.total, 2, 'Total routing decisions should be 2');
  assert.equal(state.routingDecisions.simpleHandled, 1, 'Simple handled should still be 1');
  assert.equal(
    state.routingDecisions.routedToOrchestrator,
    1,
    'Routed to orchestrator should be 1'
  );
  assert.ok(state.routingDecisions.averageComplexity > 0.3, 'Average complexity should increase');
  assert.ok(state.metadata.routingHistory.length === 2, 'Routing history should have 2 entries');

  clearSession(sessionId);
  console.log('✅ Test 4 passed\n');
})();

// Test 5: Update Model Usage and Cost Tracking
(() => {
  console.log('Test 5: Update model usage and cost tracking');
  const sessionId = `test-cost-${Date.now()}`;

  initSession(sessionId, 'router');

  // Track Haiku usage
  const cost1 = updateModelUsage(sessionId, 'claude-haiku-4-5', 1000, 500);
  assert.ok(cost1.costUSD > 0, 'Cost should be calculated');
  assert.equal(cost1.modelCategory, 'haiku', 'Model category should be haiku');

  let state = loadSessionState(sessionId);
  assert.equal(state.costs.haiku.inputTokens, 1000, 'Haiku input tokens should be 1000');
  assert.equal(state.costs.haiku.outputTokens, 500, 'Haiku output tokens should be 500');
  assert.ok(state.costs.haiku.costUSD > 0, 'Haiku cost should be tracked');
  assert.equal(state.costs.total, state.costs.haiku.costUSD, 'Total cost should match Haiku cost');

  // Track Sonnet usage (model switch)
  const cost2 = updateModelUsage(sessionId, 'claude-sonnet-4-5', 2000, 1000);
  assert.equal(cost2.modelCategory, 'sonnet', 'Model category should be sonnet');

  state = loadSessionState(sessionId);
  assert.equal(state.costs.sonnet.inputTokens, 2000, 'Sonnet input tokens should be 2000');
  assert.equal(state.costs.sonnet.outputTokens, 1000, 'Sonnet output tokens should be 1000');
  assert.ok(state.costs.total > state.costs.haiku.costUSD, 'Total cost should include both models');
  assert.equal(
    state.modelHistory.length,
    2,
    'Model history should have 2 entries (switch recorded)'
  );
  assert.equal(state.model, 'claude-sonnet-4-5', 'Current model should be Sonnet');

  clearSession(sessionId);
  console.log('✅ Test 5 passed\n');
})();

// Test 6: Get Session Costs
(() => {
  console.log('Test 6: Get session costs');
  const sessionId = `test-get-costs-${Date.now()}`;

  initSession(sessionId, 'router');
  updateModelUsage(sessionId, 'claude-haiku-4-5', 1000, 500);
  updateModelUsage(sessionId, 'claude-sonnet-4-5', 2000, 1000);

  const costs = getSessionCosts(sessionId);
  assert.equal(costs.sessionId, sessionId, 'Session ID should match');
  assert.ok(costs.costs.total > 0, 'Total cost should be tracked');
  assert.ok(costs.costs.haiku.costUSD > 0, 'Haiku cost should be tracked');
  assert.ok(costs.costs.sonnet.costUSD > 0, 'Sonnet cost should be tracked');
  assert.equal(costs.modelHistory.length, 2, 'Model history should be included');

  clearSession(sessionId);
  console.log('✅ Test 6 passed\n');
})();

// Test 7: Get Routing Metrics
(() => {
  console.log('Test 7: Get routing metrics');
  const sessionId = `test-metrics-${Date.now()}`;

  initSession(sessionId, 'router');
  recordRoutingDecision(sessionId, { type: 'simple', complexity: 0.3, confidence: 0.9 });
  recordRoutingDecision(sessionId, { type: 'orchestrator', complexity: 0.8, confidence: 0.95 });

  const metrics = getRoutingMetrics(sessionId);
  assert.equal(metrics.sessionId, sessionId, 'Session ID should match');
  assert.equal(metrics.metrics.total, 2, 'Total routing decisions should be 2');
  assert.equal(metrics.metrics.simpleHandled, 1, 'Simple handled should be 1');
  assert.equal(metrics.metrics.routedToOrchestrator, 1, 'Routed to orchestrator should be 1');
  assert.ok(metrics.routingHistory.length === 2, 'Routing history should have 2 entries');

  clearSession(sessionId);
  console.log('✅ Test 7 passed\n');
})();

// Test 8: List Sessions
(() => {
  console.log('Test 8: List sessions');

  // Create multiple test sessions
  const session1 = `test-list-1-${Date.now()}`;
  const session2 = `test-list-2-${Date.now()}`;

  initSession(session1, 'router');
  initSession(session2, 'router');

  const sessions = listSessions();
  assert.ok(sessions.includes(session1), 'Session 1 should be listed');
  assert.ok(sessions.includes(session2), 'Session 2 should be listed');

  clearSession(session1);
  clearSession(session2);
  console.log('✅ Test 8 passed\n');
})();

// Test 9: Clear Session
(() => {
  console.log('Test 9: Clear session');
  const sessionId = `test-clear-${Date.now()}`;

  initSession(sessionId, 'router');
  let state = loadSessionState(sessionId);
  assert.ok(state, 'Session should exist');

  clearSession(sessionId);
  state = loadSessionState(sessionId);
  assert.equal(state, null, 'Session should be cleared');

  console.log('✅ Test 9 passed\n');
})();

// Test 10: Backward Compatibility (Orchestrator Session)
(() => {
  console.log('Test 10: Backward compatibility with orchestrator session');

  // Initialize orchestrator session (legacy location)
  initSession('orchestrator', 'orchestrator');

  // Load without session ID (should load orchestrator)
  const state = loadSessionState();
  assert.ok(state, 'Should load orchestrator session');
  assert.equal(state.agent_role, 'orchestrator', 'Role should be orchestrator');

  // Load with 'orchestrator' ID
  const state2 = loadSessionState('orchestrator');
  assert.ok(state2, 'Should load with "orchestrator" ID');
  assert.equal(state2.agent_role, 'orchestrator', 'Role should be orchestrator');

  clearSession('orchestrator');
  console.log('✅ Test 10 passed\n');
})();

// Cleanup
cleanupTestSessions();

console.log('\n✅ All tests passed!');
