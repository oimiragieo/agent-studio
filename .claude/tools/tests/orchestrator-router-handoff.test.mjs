#!/usr/bin/env node

/**
 * Integration tests for orchestrator-entry.mjs router handoff functionality
 *
 * Tests:
 * - Router session handoff with routing decision
 * - Session context transfer
 * - Cost aggregation
 * - Backward compatibility (no routing decision)
 * - Skip redundant routing when router provides workflow
 */

import { strict as assert } from 'assert';
import { processUserPrompt } from '../orchestrator-entry.mjs';
import { existsSync } from 'fs';
import { readFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test utilities
function generateTestSessionId() {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function generateTestRunId() {
  return `test-run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Cleanup test artifacts
async function cleanupTestRun(runId) {
  const runDir = join(__dirname, '..', '..', 'context', 'runs', runId);
  try {
    if (existsSync(runDir)) {
      await rm(runDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(`Cleanup warning: ${error.message}`);
  }
}

// Test 1: Router handoff with routing decision
async function testRouterHandoff() {
  console.log('\n[Test 1] Router handoff with routing decision');

  const sessionId = generateTestSessionId();
  const runId = generateTestRunId();

  const routingDecision = {
    intent: 'web_app',
    workflow: '.claude/workflows/greenfield-fullstack.yaml',
    selected_workflow: '.claude/workflows/greenfield-fullstack.yaml',
    complexity: 'high',
    confidence: 0.85,
    routing_method: 'classification',
  };

  const sessionContext = {
    session_id: sessionId,
    router_classification: {
      model: 'claude-3-5-haiku-20241022',
    },
    cost_tracking: {
      total_cost_usd: 0.00045,
      total_input_tokens: 150,
      total_output_tokens: 100,
      model_usage: [
        {
          timestamp: new Date().toISOString(),
          model: 'claude-3-5-haiku-20241022',
          input_tokens: 150,
          output_tokens: 100,
          cost_usd: 0.00045,
        },
      ],
    },
  };

  try {
    const result = await processUserPrompt(
      'Build a full-stack web application with React and Node.js',
      { runId, sessionContext },
      routingDecision
    );

    // Assertions
    assert.ok(result.runId, 'runId should be present');
    assert.ok(result.routing, 'routing should be present');
    assert.strictEqual(
      result.routing.routing_method,
      'router_handoff',
      'routing method should be router_handoff'
    );
    assert.ok(result.costs, 'costs should be aggregated');
    assert.ok(result.costs.router, 'router costs should be present');
    assert.strictEqual(result.costs.router.total_cost_usd, 0.00045, 'router cost should match');

    console.log('✅ Router handoff test passed');
    console.log(`   - Run ID: ${result.runId}`);
    console.log(`   - Routing method: ${result.routing.routing_method}`);
    console.log(`   - Aggregated cost: $${result.costs.total.toFixed(6)}`);

    await cleanupTestRun(runId);
  } catch (error) {
    console.error('❌ Router handoff test failed:', error.message);
    await cleanupTestRun(runId);
    throw error;
  }
}

// Test 2: Session context transfer
async function testSessionContextTransfer() {
  console.log('\n[Test 2] Session context transfer');

  const sessionId = generateTestSessionId();
  const runId = generateTestRunId();

  const routingDecision = {
    intent: 'script',
    workflow: '.claude/workflows/quick-flow.yaml',
    complexity: 'low',
    confidence: 0.92,
  };

  const sessionContext = {
    session_id: sessionId,
    router_classification: {
      model: 'claude-3-5-haiku-20241022',
      intent: 'script',
    },
    cost_tracking: {
      total_cost_usd: 0.0002,
      total_input_tokens: 80,
      total_output_tokens: 50,
    },
  };

  try {
    const result = await processUserPrompt(
      'Create a simple automation script',
      { runId, sessionContext },
      routingDecision
    );

    // Verify session context was transferred to run metadata
    const runRecord = result.runRecord;
    assert.ok(runRecord.metadata.routerHandoff, 'routerHandoff should be in metadata');
    assert.strictEqual(
      runRecord.metadata.routerHandoff.sessionId,
      sessionId,
      'session ID should match'
    );
    assert.ok(runRecord.metadata.routerHandoff.accumulatedCosts, 'costs should be transferred');

    console.log('✅ Session context transfer test passed');
    console.log(`   - Session ID transferred: ${runRecord.metadata.routerHandoff.sessionId}`);
    console.log(`   - Router model: ${runRecord.metadata.routerHandoff.routerModel}`);

    await cleanupTestRun(runId);
  } catch (error) {
    console.error('❌ Session context transfer test failed:', error.message);
    await cleanupTestRun(runId);
    throw error;
  }
}

// Test 3: Cost aggregation accuracy
async function testCostAggregation() {
  console.log('\n[Test 3] Cost aggregation accuracy');

  const runId = generateTestRunId();

  const sessionContext = {
    session_id: generateTestSessionId(),
    cost_tracking: {
      total_cost_usd: 0.0015,
      total_input_tokens: 500,
      total_output_tokens: 300,
      model_usage: [
        {
          model: 'claude-3-5-haiku-20241022',
          input_tokens: 500,
          output_tokens: 300,
          cost_usd: 0.0015,
        },
      ],
    },
  };

  const routingDecision = {
    intent: 'analysis',
    workflow: '.claude/workflows/code-quality-flow.yaml',
    complexity: 'medium',
    confidence: 0.88,
  };

  try {
    const result = await processUserPrompt(
      'Analyze code quality',
      { runId, sessionContext },
      routingDecision
    );

    // Verify cost aggregation
    assert.ok(result.costs, 'costs should be aggregated');
    assert.ok(result.costs.router, 'router costs should be present');
    assert.ok(result.costs.orchestrator, 'orchestrator costs should be present');

    const expectedRouterCost = 0.0015;
    assert.strictEqual(
      result.costs.router.total_cost_usd,
      expectedRouterCost,
      'router cost should match'
    );

    console.log('✅ Cost aggregation test passed');
    console.log(`   - Router cost: $${result.costs.router.total_cost_usd.toFixed(6)}`);
    console.log(`   - Orchestrator cost: $${result.costs.orchestrator.total_cost_usd.toFixed(6)}`);
    console.log(`   - Total cost: $${result.costs.total.toFixed(6)}`);

    await cleanupTestRun(runId);
  } catch (error) {
    console.error('❌ Cost aggregation test failed:', error.message);
    await cleanupTestRun(runId);
    throw error;
  }
}

// Test 4: Backward compatibility (no routing decision)
async function testBackwardCompatibility() {
  console.log('\n[Test 4] Backward compatibility (no routing decision)');

  const runId = generateTestRunId();

  try {
    const result = await processUserPrompt(
      'Build a web application',
      { runId }
      // No routingDecision - should use semantic routing
    );

    // Should work normally without routing decision
    assert.ok(result.runId, 'runId should be present');
    assert.ok(result.routing, 'routing should be present');
    assert.notStrictEqual(
      result.routing.routing_method,
      'router_handoff',
      'should not be router_handoff'
    );

    console.log('✅ Backward compatibility test passed');
    console.log(`   - Routing method: ${result.routing.routing_method}`);
    console.log('   - Semantic routing still works without router decision');

    await cleanupTestRun(runId);
  } catch (error) {
    console.error('❌ Backward compatibility test failed:', error.message);
    await cleanupTestRun(runId);
    throw error;
  }
}

// Test 5: Skip redundant routing
async function testSkipRedundantRouting() {
  console.log('\n[Test 5] Skip redundant routing');

  const runId = generateTestRunId();

  const routingDecision = {
    intent: 'infrastructure',
    workflow: '.claude/workflows/automated-enterprise-flow.yaml',
    complexity: 'high',
    confidence: 0.9,
  };

  const sessionContext = {
    session_id: generateTestSessionId(),
    cost_tracking: {
      total_cost_usd: 0.0008,
      total_input_tokens: 300,
      total_output_tokens: 200,
    },
  };

  try {
    const result = await processUserPrompt(
      'Deploy infrastructure',
      { runId, sessionContext },
      routingDecision
    );

    // Verify routing was skipped and workflow from router was used
    assert.strictEqual(
      result.routing.routing_method,
      'router_handoff',
      'routing method should be router_handoff'
    );
    assert.strictEqual(
      result.routing.selected_workflow,
      routingDecision.workflow,
      'workflow should match router decision'
    );

    console.log('✅ Skip redundant routing test passed');
    console.log(`   - Used workflow from router: ${result.routing.selected_workflow}`);
    console.log('   - Semantic routing was skipped');

    await cleanupTestRun(runId);
  } catch (error) {
    console.error('❌ Skip redundant routing test failed:', error.message);
    await cleanupTestRun(runId);
    throw error;
  }
}

// Test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('Orchestrator Router Handoff Integration Tests');
  console.log('='.repeat(60));

  const tests = [
    testRouterHandoff,
    testSessionContextTransfer,
    testCostAggregation,
    testBackwardCompatibility,
    testSkipRedundantRouting,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`Test failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runTests };
