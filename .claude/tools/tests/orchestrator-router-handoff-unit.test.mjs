#!/usr/bin/env node

/**
 * Unit tests for orchestrator-entry.mjs router handoff functionality
 *
 * Tests the router handoff logic WITHOUT executing full workflows
 * (to avoid workflow validation issues)
 */

import { strict as assert } from 'assert';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the module (use file:// URL for Windows compatibility)
import { pathToFileURL } from 'url';
const orchestratorEntryPath = join(__dirname, '..', 'orchestrator-entry.mjs');
const { processUserPrompt } = await import(pathToFileURL(orchestratorEntryPath).href);

// Test utilities
function generateTestSessionId() {
  return `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function generateTestRunId() {
  return `test-run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Test 1: Routing decision parameter acceptance
async function testRoutingDecisionAccepted() {
  console.log('\n[Unit Test 1] Routing decision parameter accepted');

  const sessionId = generateTestSessionId();
  const runId = generateTestRunId();

  const routingDecision = {
    intent: 'web_app',
    workflow: '.claude/workflows/greenfield-fullstack.yaml',
    complexity: 'high',
    confidence: 0.9,
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
    },
  };

  try {
    // Call processUserPrompt - it will fail at workflow execution, but we can check the routing
    await processUserPrompt('Build a web app', { runId, sessionContext }, routingDecision);
  } catch (error) {
    // Expected to fail at workflow execution
    // But we can verify the routing decision was accepted
    console.log('  (Expected workflow execution error - this is OK)');
  }

  // Load run record to verify routing decision was stored
  const runManagerPath = join(__dirname, '..', 'run-manager.mjs');
  const { readRun } = await import(pathToFileURL(runManagerPath).href);

  const runRecord = await readRun(runId);

  // Assertions
  assert.ok(runRecord, 'Run record should exist');
  assert.ok(runRecord.metadata, 'Run metadata should exist');
  assert.ok(runRecord.metadata.routerHandoff, 'Router handoff metadata should exist');
  assert.strictEqual(
    runRecord.metadata.routerHandoff.sessionId,
    sessionId,
    'Session ID should match'
  );
  assert.strictEqual(
    runRecord.metadata.routerHandoff.routerModel,
    'claude-3-5-haiku-20241022',
    'Router model should match'
  );

  console.log('✅ Routing decision parameter test passed');
  console.log(`   - Session ID transferred: ${runRecord.metadata.routerHandoff.sessionId}`);
  console.log(`   - Router model: ${runRecord.metadata.routerHandoff.routerModel}`);
  console.log(`   - Routing decision stored in metadata`);
}

// Test 2: Session context extraction
async function testSessionContextExtraction() {
  console.log('\n[Unit Test 2] Session context extraction');

  const sessionId = generateTestSessionId();
  const runId = generateTestRunId();

  const routingDecision = {
    intent: 'script',
    workflow: '.claude/workflows/quick-flow.yaml',
    complexity: 'low',
    confidence: 0.95,
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
      model_usage: [
        {
          model: 'claude-3-5-haiku-20241022',
          input_tokens: 80,
          output_tokens: 50,
          cost_usd: 0.0002,
        },
      ],
    },
  };

  try {
    await processUserPrompt('Create a script', { runId, sessionContext }, routingDecision);
  } catch (error) {
    // Expected to fail at workflow execution
  }

  // Load run record
  const runManagerPath = join(__dirname, '..', 'run-manager.mjs');
  const { readRun } = await import(pathToFileURL(runManagerPath).href);
  const runRecord = await readRun(runId);

  // Assertions
  assert.ok(runRecord.metadata.routerHandoff.accumulatedCosts, 'Costs should be transferred');
  assert.strictEqual(
    runRecord.metadata.routerHandoff.accumulatedCosts.total_cost_usd,
    0.0002,
    'Cost should match'
  );
  assert.ok(
    runRecord.metadata.routerHandoff.routingDecision,
    'Routing decision should be in metadata'
  );

  console.log('✅ Session context extraction test passed');
  console.log(
    `   - Costs transferred: $${runRecord.metadata.routerHandoff.accumulatedCosts.total_cost_usd.toFixed(6)}`
  );
  console.log(
    `   - Routing decision present: ${JSON.stringify(runRecord.metadata.routerHandoff.routingDecision)}`
  );
}

// Test 3: Backward compatibility
async function testBackwardCompatibility() {
  console.log('\n[Unit Test 3] Backward compatibility (no routing decision)');

  const runId = generateTestRunId();

  try {
    // Call without routing decision
    await processUserPrompt('Build a web app', { runId });
  } catch (error) {
    // Expected to fail at workflow execution (semantic routing)
  }

  // Load run record
  const runManagerPath = join(__dirname, '..', 'run-manager.mjs');
  const { readRun } = await import(pathToFileURL(runManagerPath).href);
  const runRecord = await readRun(runId);

  // Assertions
  assert.ok(runRecord, 'Run record should exist');
  assert.ok(!runRecord.metadata.routerHandoff, 'Router handoff should NOT be in metadata');

  console.log('✅ Backward compatibility test passed');
  console.log('   - Works without routing decision');
  console.log('   - No router handoff metadata (as expected)');
}

// Test 4: Cost aggregation function
async function testCostAggregationFunction() {
  console.log('\n[Unit Test 4] Cost aggregation function');

  // Import the aggregation function (it's not exported, so we'll test via processUserPrompt)
  const sessionId = generateTestSessionId();
  const runId = generateTestRunId();

  const routerCosts = {
    total_cost_usd: 0.0005,
    total_input_tokens: 200,
    total_output_tokens: 150,
    model_usage: [
      {
        model: 'claude-3-5-haiku-20241022',
        input_tokens: 200,
        output_tokens: 150,
        cost_usd: 0.0005,
      },
    ],
  };

  const sessionContext = {
    session_id: sessionId,
    cost_tracking: routerCosts,
  };

  const routingDecision = {
    intent: 'analysis',
    workflow: '.claude/workflows/code-quality-flow.yaml',
    complexity: 'medium',
    confidence: 0.88,
  };

  let result;
  try {
    result = await processUserPrompt('Analyze code', { runId, sessionContext }, routingDecision);
  } catch (error) {
    // Expected to fail at workflow execution
    // But we should still get the costs in the error (if we caught it early enough)
    console.log('  (Expected workflow execution error - checking costs in run record)');
  }

  // Load run record to check if costs were stored
  const runManagerPath = join(__dirname, '..', 'run-manager.mjs');
  const { readRun } = await import(runManagerPath);
  const runRecord = await readRun(runId);

  // Verify costs were transferred to metadata
  assert.ok(runRecord.metadata.routerHandoff.accumulatedCosts, 'Costs should be in metadata');
  assert.strictEqual(
    runRecord.metadata.routerHandoff.accumulatedCosts.total_cost_usd,
    0.0005,
    'Router cost should match'
  );

  console.log('✅ Cost aggregation function test passed');
  console.log(
    `   - Router cost stored: $${runRecord.metadata.routerHandoff.accumulatedCosts.total_cost_usd.toFixed(6)}`
  );
}

// Test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('Orchestrator Router Handoff Unit Tests');
  console.log('(Logic tests without full workflow execution)');
  console.log('='.repeat(60));

  const tests = [
    testRoutingDecisionAccepted,
    testSessionContextExtraction,
    testBackwardCompatibility,
    testCostAggregationFunction,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      console.error(error.stack);
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
