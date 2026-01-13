#!/usr/bin/env node

/**
 * Router Session Handler - Unit Tests
 *
 * Test suite for router-session-handler.mjs
 *
 * Run: node router-session-handler.test.mjs
 */

import {
  initializeRouterSession,
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  trackCosts,
  getCostSummary,
  cleanupOldSessions
} from './router-session-handler.mjs';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, `${message} (expected: ${expected}, got: ${actual})`);
}

async function runTests() {
  console.log('🧪 Running Router Session Handler Tests\n');

  // ===========================
  // Test 1: Intent Classification
  // ===========================

  console.log('Test Suite 1: Intent Classification');

  // Test 1.1: Web App Intent
  {
    const result = await classifyIntent('build an enterprise web application');
    assert(result.intent === 'web_app', 'Classifies web app intent correctly');
    assert(result.confidence > 0.5, 'Has reasonable confidence');
    assert(result.classification_time_ms < 100, 'Classification is fast (<100ms)');
  }

  // Test 1.2: Script Intent
  {
    const result = await classifyIntent('write a python script to backup files');
    assert(result.intent === 'script', 'Classifies script intent correctly');
    assert(result.complexity === 'low' || result.complexity === 'medium', 'Assigns appropriate complexity');
  }

  // Test 1.3: Analysis Intent
  {
    const result = await classifyIntent('analyze this codebase for security issues');
    assert(result.intent === 'analysis', 'Classifies analysis intent correctly');
    assert(result.keywords_detected.length > 0, 'Detects relevant keywords');
  }

  // Test 1.4: Mobile Intent
  {
    const result = await classifyIntent('create an iOS app for task management');
    assert(result.intent === 'mobile', 'Classifies mobile intent correctly');
  }

  // Test 1.5: AI System Intent
  {
    const result = await classifyIntent('build a RAG system with embeddings');
    assert(result.intent === 'ai_system', 'Classifies AI system intent correctly');
  }

  // Test 1.6: Complexity Assessment
  {
    const simple = await classifyIntent('what is this?');
    const complex = await classifyIntent(
      'implement a full-stack enterprise application with authentication, database integration, API design, and deployment to Google Cloud Platform'
    );

    assert(simple.complexity === 'low', 'Detects low complexity');
    assert(complex.complexity === 'high', 'Detects high complexity');
    assert(complex.should_route === true, 'Routes complex tasks to orchestrator');
  }

  // Test 1.7: Cloud Provider Detection
  {
    const gcp = await classifyIntent('deploy to Google Cloud Platform');
    const aws = await classifyIntent('use AWS Lambda for backend');
    const azure = await classifyIntent('store files in Azure Blob Storage');
    const none = await classifyIntent('build a local application');

    assertEquals(gcp.cloud_provider, 'gcp', 'Detects GCP');
    assertEquals(aws.cloud_provider, 'aws', 'Detects AWS');
    assertEquals(azure.cloud_provider, 'azure', 'Detects Azure');
    assertEquals(none.cloud_provider, null, 'No cloud provider detected');
  }

  // ===========================
  // Test 2: Session Management
  // ===========================

  console.log('\nTest Suite 2: Session Management');

  // Test 2.1: Session Initialization
  {
    const sessionId = `test-${Date.now()}`;
    const session = await initializeRouterSession(sessionId, 'test prompt');

    assert(session.session_id === sessionId, 'Session ID matches');
    assert(session.model === 'claude-3-5-haiku-20241022', 'Uses Haiku model by default');
    assert(session.role === 'router', 'Sets router role');
    assert(session.cost_tracking !== undefined, 'Initializes cost tracking');
    assert(session.routing_history !== undefined, 'Initializes routing history');
  }

  // ===========================
  // Test 3: Workflow Selection
  // ===========================

  console.log('\nTest Suite 3: Workflow Selection');

  // Test 3.1: Workflow Mapping
  {
    const workflows = {
      web_app: await selectWorkflow('web_app', 'high'),
      script: await selectWorkflow('script', 'low'),
      analysis: await selectWorkflow('analysis', 'medium'),
      infrastructure: await selectWorkflow('infrastructure', 'high'),
      mobile: await selectWorkflow('mobile', 'medium'),
      ai_system: await selectWorkflow('ai_system', 'high')
    };

    assert(workflows.web_app.includes('greenfield'), 'Maps web_app to greenfield workflow');
    assert(workflows.script.includes('quick-flow'), 'Maps script to quick-flow');
    assert(workflows.analysis.includes('code-quality'), 'Maps analysis to code-quality');
    assert(workflows.mobile.includes('mobile'), 'Maps mobile to mobile workflow');
    assert(workflows.ai_system.includes('ai-system'), 'Maps ai_system to ai-system workflow');
  }

  // ===========================
  // Test 4: Cost Tracking
  // ===========================

  console.log('\nTest Suite 4: Cost Tracking');

  // Test 4.1: Cost Calculation
  {
    const sessionId = `cost-test-${Date.now()}`;
    await initializeRouterSession(sessionId, 'test');

    const costResult = await trackCosts(
      sessionId,
      'claude-3-5-haiku-20241022',
      1000, // input tokens
      500   // output tokens
    );

    assert(costResult.this_request.cost_usd > 0, 'Calculates cost correctly');
    assert(costResult.this_request.input_tokens === 1000, 'Tracks input tokens');
    assert(costResult.this_request.output_tokens === 500, 'Tracks output tokens');

    // Add another request
    await trackCosts(sessionId, 'claude-3-5-haiku-20241022', 2000, 1000);

    const summary = await getCostSummary(sessionId);
    assert(summary.total_input_tokens === 3000, 'Accumulates input tokens');
    assert(summary.total_output_tokens === 1500, 'Accumulates output tokens');
    assert(summary.model_breakdown.length === 2, 'Tracks multiple requests');
  }

  // Test 4.2: Cost Accuracy (Haiku pricing)
  {
    const sessionId = `accuracy-test-${Date.now()}`;
    await initializeRouterSession(sessionId, 'test');

    // Haiku: $1/M input, $5/M output
    const result = await trackCosts(
      sessionId,
      'claude-3-5-haiku-20241022',
      1_000_000, // 1M input tokens
      1_000_000  // 1M output tokens
    );

    // Expected: $1 + $5 = $6
    const expectedCost = 6.0;
    const actualCost = result.this_request.cost_usd;
    const withinTolerance = Math.abs(actualCost - expectedCost) < 0.01;

    assert(withinTolerance, `Cost accuracy: expected ~$${expectedCost}, got $${actualCost.toFixed(2)}`);
  }

  // ===========================
  // Test 5: Orchestrator Routing
  // ===========================

  console.log('\nTest Suite 5: Orchestrator Routing');

  // Test 5.1: Routing Handoff
  {
    const sessionId = `route-test-${Date.now()}`;
    const session = await initializeRouterSession(sessionId, 'complex task');

    const routeResult = await routeToOrchestrator(
      '@.claude/workflows/greenfield-fullstack.yaml',
      'build a complex application',
      { session_id: sessionId, classification: { intent: 'web_app' } }
    );

    assert(routeResult.success === true, 'Routing succeeds');
    assert(routeResult.handoff_data !== undefined, 'Provides handoff data');
    assert(routeResult.handoff_data.workflow.includes('greenfield'), 'Includes workflow in handoff');
    assert(routeResult.handoff_data.routing_metadata.skip_redundant_routing === true, 'Flags to skip redundant routing');
  }

  // ===========================
  // Test 6: Edge Cases
  // ===========================

  console.log('\nTest Suite 6: Edge Cases');

  // Test 6.1: Empty prompt
  {
    const result = await classifyIntent('');
    assert(result.intent !== undefined, 'Handles empty prompt without crashing');
    assert(result.confidence < 0.7, 'Low confidence for empty prompt');
  }

  // Test 6.2: Very long prompt
  {
    const longPrompt = 'build '.repeat(200) + 'a web application';
    const result = await classifyIntent(longPrompt);
    assert(result.complexity === 'high', 'High token count triggers high complexity');
  }

  // Test 6.3: Ambiguous prompt
  {
    const result = await classifyIntent('enterprise');
    assert(result.confidence < 0.8, 'Low confidence for ambiguous single-word prompt');
  }

  // ===========================
  // Test 7: Performance
  // ===========================

  console.log('\nTest Suite 7: Performance');

  // Test 7.1: Classification speed
  {
    const start = Date.now();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      await classifyIntent('build a web application with database');
    }

    const avgTime = (Date.now() - start) / iterations;
    assert(avgTime < 50, `Average classification time < 50ms (actual: ${avgTime.toFixed(2)}ms)`);
  }

  // ===========================
  // Test Summary
  // ===========================

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
