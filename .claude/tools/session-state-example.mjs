#!/usr/bin/env node
/**
 * Session State Manager - Usage Example
 *
 * Demonstrates all key features of the session-state module.
 */

import {
  initSession,
  loadSessionState,
  recordRoutingDecision,
  updateModelUsage,
  getSessionCosts,
  getRoutingMetrics,
  clearSession,
} from './session-state.mjs';

console.log('Session State Manager - Usage Example\n');
console.log('=====================================\n');

// Example 1: Initialize Router Session
console.log('1. Initialize Router Session');
const sessionId = `example-${Date.now()}`;
const session = initSession(sessionId, 'router', {
  initialPrompt: 'Build a full-stack web application with authentication',
});

console.log(`   Session ID: ${session.session_id}`);
console.log(`   Role: ${session.agent_role}`);
console.log(`   Model: ${session.model}`);
console.log(`   Initial Prompt: ${session.initial_prompt}\n`);

// Example 2: Record Simple Routing Decision
console.log('2. Record Simple Routing Decision');
recordRoutingDecision(sessionId, {
  type: 'simple',
  complexity: 0.3,
  confidence: 0.9,
  workflow: null,
});
console.log('   ✅ Simple routing recorded (complexity: 0.3, confidence: 0.9)\n');

// Example 3: Record Orchestrator Routing Decision
console.log('3. Record Orchestrator Routing Decision');
recordRoutingDecision(sessionId, {
  type: 'orchestrator',
  complexity: 0.8,
  confidence: 0.95,
  workflow: '@.claude/workflows/greenfield-fullstack.yaml',
});
console.log('   ✅ Orchestrator routing recorded (complexity: 0.8, confidence: 0.95)\n');

// Example 4: Track Haiku Model Usage
console.log('4. Track Haiku Model Usage');
const cost1 = updateModelUsage(sessionId, 'claude-haiku-4-5', 1000, 500);
console.log(`   Input: 1000 tokens, Output: 500 tokens`);
console.log(`   Cost: $${cost1.costUSD.toFixed(6)}\n`);

// Example 5: Track Sonnet Model Usage (Model Switch)
console.log('5. Track Sonnet Model Usage (Model Switch)');
const cost2 = updateModelUsage(sessionId, 'claude-sonnet-4-5', 2000, 1000);
console.log(`   Input: 2000 tokens, Output: 1000 tokens`);
console.log(`   Cost: $${cost2.costUSD.toFixed(6)}\n`);

// Example 6: Get Routing Metrics
console.log('6. Get Routing Metrics');
const metrics = getRoutingMetrics(sessionId);
console.log('   Metrics:');
console.log(`   - Total Decisions: ${metrics.metrics.total}`);
console.log(`   - Simple Handled: ${metrics.metrics.simpleHandled}`);
console.log(`   - Routed to Orchestrator: ${metrics.metrics.routedToOrchestrator}`);
console.log(`   - Avg Complexity: ${metrics.metrics.averageComplexity.toFixed(2)}`);
console.log(`   - Avg Confidence: ${metrics.metrics.averageConfidence.toFixed(2)}\n`);

// Example 7: Get Cost Summary
console.log('7. Get Cost Summary');
const costs = getSessionCosts(sessionId);
console.log('   Costs by Model:');
console.log(
  `   - Haiku:  $${costs.costs.haiku.costUSD.toFixed(6)} (${costs.costs.haiku.inputTokens} in, ${costs.costs.haiku.outputTokens} out)`
);
console.log(
  `   - Sonnet: $${costs.costs.sonnet.costUSD.toFixed(6)} (${costs.costs.sonnet.inputTokens} in, ${costs.costs.sonnet.outputTokens} out)`
);
console.log(
  `   - Opus:   $${costs.costs.opus.costUSD.toFixed(6)} (${costs.costs.opus.inputTokens} in, ${costs.costs.opus.outputTokens} out)`
);
console.log(`   - TOTAL:  $${costs.costs.total.toFixed(6)}\n`);

// Example 8: Load Session State
console.log('8. Load Session State');
const loadedState = loadSessionState(sessionId);
console.log(`   Current Model: ${loadedState.model}`);
console.log(`   Model History: ${loadedState.modelHistory.length} entries`);
console.log(`   Created: ${loadedState.created_at}`);
console.log(`   Updated: ${loadedState.updated_at}\n`);

// Example 9: Clean Up
console.log('9. Clean Up Session');
clearSession(sessionId);
console.log(`   ✅ Session ${sessionId} cleared\n`);

console.log('=====================================');
console.log('Example completed successfully! ✅');
