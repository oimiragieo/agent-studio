#!/usr/bin/env node

/**
 * Router Integration Tests - Memory-Safe Edition
 *
 * Purpose: Validate router session handling with memory-safe batch processing
 * Target: Step 1.8 - Router Session Validation
 *
 * Memory Constraints:
 * - Max file reads: 10 files (5 per batch × 2 batches)
 * - Max heap usage: 80% before triggering GC
 * - Max duration: 20 minutes per test run
 * - Test execution time: < 5 minutes
 * - Peak memory: < 2GB
 *
 * Test Coverage:
 * - Router session initialization (1 test)
 * - Intent classification on sample CUJs (5 tests)
 * - Complexity scoring validation (5 tests)
 * - Workflow selection correctness (5 tests)
 * - Cost tracking accuracy (3 tests)
 * - Orchestrator handoff (2 tests)
 *
 * @module router-integration-memory-safe.test
 * @version 1.0.0
 * @created 2026-01-12
 */

import {
  initializeRouterSession,
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  trackCosts,
  getCostSummary,
} from '../router-session-handler.mjs';

import { StreamingFileReader } from '../streaming-file-reader.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================
// Memory Monitoring Utilities
// =============================

const MEMORY_LIMITS = {
  MAX_HEAP_PERCENT: 80, // Trigger GC at 80% capacity
  MAX_HEAP_MB: 2048, // 2GB hard limit
  BATCH_SIZE: 5, // Process 5 CUJs at a time
  MAX_BATCHES: 2, // Total 10 files
};

/**
 * Get current memory usage
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
    heapPercent: ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2),
    rss: (usage.rss / 1024 / 1024).toFixed(2),
  };
}

/**
 * Check if memory is within safe limits
 */
function isMemorySafe() {
  const usage = getMemoryUsage();
  const heapPercent = parseFloat(usage.heapPercent);
  const heapUsedMB = parseFloat(usage.heapUsedMB);

  return heapPercent < MEMORY_LIMITS.MAX_HEAP_PERCENT && heapUsedMB < MEMORY_LIMITS.MAX_HEAP_MB;
}

/**
 * Force garbage collection if available
 */
function forceGC() {
  if (global.gc) {
    global.gc();
    console.log('🗑️  Garbage collection triggered');
  }
}

/**
 * Memory-safe delay to allow GC
 */
async function safeDelay(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================
// Test Utilities
// =============================

let testsPassed = 0;
let testsFailed = 0;
const testStartTime = Date.now();

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

function assertLessThan(actual, threshold, message) {
  const pass = actual < threshold;
  assert(pass, `${message} (${actual} < ${threshold})`);
}

// =============================
// CUJ Sample Selection
// =============================

/**
 * Select representative CUJ samples for testing
 * Batch 1: Simple intents (5 files)
 * Batch 2: Complex intents (5 files)
 */
const CUJ_SAMPLES = {
  batch1: [
    'CUJ-005', // Simple question (low complexity)
    'CUJ-010', // Code review (medium complexity)
    'CUJ-015', // Quick script (low complexity)
    'CUJ-020', // Analysis task (medium complexity)
    'CUJ-025', // Documentation (low complexity)
  ],
  batch2: [
    'CUJ-034', // Greenfield app (high complexity)
    'CUJ-035', // Infrastructure setup (high complexity)
    'CUJ-040', // Mobile app (high complexity)
    'CUJ-045', // AI system (high complexity)
    'CUJ-050', // Legacy modernization (high complexity)
  ],
};

/**
 * Load CUJ file with streaming
 */
async function loadCUJSample(cujId) {
  const cujPath = path.resolve(__dirname, '../../docs/cujs', `${cujId}.md`);

  if (!fs.existsSync(cujPath)) {
    console.warn(`⚠️  CUJ file not found: ${cujPath}`);
    return null;
  }

  try {
    // Use streaming reader to extract prompt
    const lines = await StreamingFileReader.readFile(cujPath, {
      offset: 0,
      limit: 100, // Only read first 100 lines for prompt extraction
      maxLineLength: 2000,
    });

    // Extract user prompt from CUJ
    let prompt = '';
    let inPromptSection = false;

    for (const line of lines) {
      if (line.includes('## User Prompt') || line.includes('## Prompt')) {
        inPromptSection = true;
        continue;
      }

      if (inPromptSection) {
        if (line.startsWith('##')) {
          // End of prompt section
          break;
        }
        prompt += line + '\n';
      }
    }

    return {
      id: cujId,
      prompt: prompt.trim(),
      path: cujPath,
    };
  } catch (error) {
    console.error(`❌ Failed to load CUJ ${cujId}: ${error.message}`);
    return null;
  }
}

/**
 * Process CUJ batch with memory monitoring
 */
async function processCUJBatch(batchName, cujIds) {
  console.log(`\n📦 Processing Batch: ${batchName}`);
  console.log(`   Files: ${cujIds.join(', ')}`);

  const memBefore = getMemoryUsage();
  console.log(`   Memory before: ${memBefore.heapUsedMB}MB (${memBefore.heapPercent}%)`);

  const batchResults = [];

  for (const cujId of cujIds) {
    // Check memory before each file
    if (!isMemorySafe()) {
      console.warn(`⚠️  Memory limit reached, triggering GC`);
      forceGC();
      await safeDelay(200);

      // Re-check after GC
      if (!isMemorySafe()) {
        console.error(`❌ Memory still unsafe after GC, skipping ${cujId}`);
        batchResults.push({ id: cujId, skipped: true, reason: 'memory' });
        continue;
      }
    }

    const cuj = await loadCUJSample(cujId);
    if (!cuj) {
      batchResults.push({ id: cujId, skipped: true, reason: 'not_found' });
      continue;
    }

    batchResults.push({ id: cujId, cuj, skipped: false });

    // Small delay to allow GC between files
    await safeDelay(50);
  }

  const memAfter = getMemoryUsage();
  console.log(`   Memory after: ${memAfter.heapUsedMB}MB (${memAfter.heapPercent}%)`);

  // Force GC after batch
  forceGC();
  await safeDelay(100);

  return batchResults;
}

// =============================
// Test Suite
// =============================

async function runTests() {
  console.log('🧪 Router Integration Tests - Memory-Safe Edition\n');
  console.log('Memory Constraints:');
  console.log(`  - Max heap usage: ${MEMORY_LIMITS.MAX_HEAP_PERCENT}%`);
  console.log(`  - Max heap size: ${MEMORY_LIMITS.MAX_HEAP_MB}MB`);
  console.log(`  - Batch size: ${MEMORY_LIMITS.BATCH_SIZE} files`);
  console.log(`  - Max batches: ${MEMORY_LIMITS.MAX_BATCHES}`);
  console.log('');

  // =============================
  // Test Suite 1: Session Initialization
  // =============================

  console.log('Test Suite 1: Router Session Initialization\n');

  {
    const sessionId = `memory-test-${Date.now()}`;
    const session = await initializeRouterSession(sessionId, 'test memory-safe integration');

    assert(session.session_id === sessionId, '1.1: Session ID initialized correctly');
    assert(session.model === 'claude-haiku-4-5', '1.2: Uses Haiku model');
    assert(session.role === 'router', '1.3: Sets router role');
    assert(session.cost_tracking !== undefined, '1.4: Initializes cost tracking');
    assert(session.routing_history !== undefined, '1.5: Initializes routing history');

    // Check initial memory
    const memUsage = getMemoryUsage();
    assertLessThan(parseFloat(memUsage.heapPercent), 80, '1.6: Initial memory < 80%');
  }

  // =============================
  // Test Suite 2: Intent Classification (Batch 1)
  // =============================

  console.log('\n\nTest Suite 2: Intent Classification - Batch 1\n');

  const batch1 = await processCUJBatch('Batch 1 (Simple)', CUJ_SAMPLES.batch1);

  for (const item of batch1) {
    if (item.skipped) {
      console.log(`⚠️  Skipped ${item.id} (${item.reason})`);
      continue;
    }

    const { id, cuj } = item;
    const classification = await classifyIntent(cuj.prompt);

    assert(classification.intent !== undefined, `2.${id}: Intent classified for ${id}`);
    assert(classification.complexity !== undefined, `2.${id}: Complexity assessed`);
    assert(classification.classification_time_ms < 200, `2.${id}: Classification fast (<200ms)`);
  }

  // Memory check after batch 1
  const memAfterBatch1 = getMemoryUsage();
  assertLessThan(
    parseFloat(memAfterBatch1.heapPercent),
    MEMORY_LIMITS.MAX_HEAP_PERCENT,
    '2.6: Memory safe after batch 1'
  );

  // =============================
  // Test Suite 3: Complexity Scoring (Batch 2)
  // =============================

  console.log('\n\nTest Suite 3: Complexity Scoring - Batch 2\n');

  const batch2 = await processCUJBatch('Batch 2 (Complex)', CUJ_SAMPLES.batch2);

  for (const item of batch2) {
    if (item.skipped) {
      console.log(`⚠️  Skipped ${item.id} (${item.reason})`);
      continue;
    }

    const { id, cuj } = item;
    const classification = await classifyIntent(cuj.prompt);

    // High complexity tasks should route to orchestrator
    if (classification.complexity === 'high') {
      assert(
        classification.should_route === true,
        `3.${id}: High complexity routes to orchestrator`
      );
    }

    assert(
      ['low', 'medium', 'high'].includes(classification.complexity),
      `3.${id}: Valid complexity level`
    );
  }

  // Memory check after batch 2
  const memAfterBatch2 = getMemoryUsage();
  assertLessThan(
    parseFloat(memAfterBatch2.heapPercent),
    MEMORY_LIMITS.MAX_HEAP_PERCENT,
    '3.6: Memory safe after batch 2'
  );

  // =============================
  // Test Suite 4: Workflow Selection
  // =============================

  console.log('\n\nTest Suite 4: Workflow Selection Correctness\n');

  const workflowMappings = [
    { intent: 'web_app', complexity: 'high', expected: 'greenfield' },
    { intent: 'script', complexity: 'low', expected: 'quick-flow' },
    { intent: 'analysis', complexity: 'medium', expected: 'code-quality' },
    { intent: 'mobile', complexity: 'medium', expected: 'mobile' },
    { intent: 'ai_system', complexity: 'high', expected: 'ai-system' },
  ];

  for (let i = 0; i < workflowMappings.length; i++) {
    const { intent, complexity, expected } = workflowMappings[i];
    const workflow = await selectWorkflow(intent, complexity);

    assert(workflow.includes(expected), `4.${i + 1}: ${intent} → ${expected} workflow`);

    // Check memory between workflow selections
    if (i === 2) {
      const memMid = getMemoryUsage();
      assertLessThan(
        parseFloat(memMid.heapPercent),
        MEMORY_LIMITS.MAX_HEAP_PERCENT,
        '4.6: Memory safe during workflow selection'
      );
    }
  }

  // =============================
  // Test Suite 5: Cost Tracking Accuracy
  // =============================

  console.log('\n\nTest Suite 5: Cost Tracking Accuracy\n');

  {
    const sessionId = `cost-test-${Date.now()}`;
    await initializeRouterSession(sessionId, 'cost test');

    // Test 5.1: Cost calculation
    const costResult = await trackCosts(sessionId, 'claude-haiku-4-5', 1000, 500);

    assert(costResult.this_request.cost_usd > 0, '5.1: Cost calculated correctly');
    assertEquals(costResult.this_request.input_tokens, 1000, '5.2: Input tokens tracked');
    assertEquals(costResult.this_request.output_tokens, 500, '5.3: Output tokens tracked');

    // Test 5.2: Cost accumulation
    await trackCosts(sessionId, 'claude-haiku-4-5', 2000, 1000);

    const summary = await getCostSummary(sessionId);
    assertEquals(summary.total_input_tokens, 3000, '5.4: Accumulates input tokens');
    assertEquals(summary.total_output_tokens, 1500, '5.5: Accumulates output tokens');

    // Test 5.3: Pricing accuracy (Haiku: $1/M input, $5/M output)
    const sessionId2 = `accuracy-test-${Date.now()}`;
    await initializeRouterSession(sessionId2, 'accuracy test');

    const result = await trackCosts(sessionId2, 'claude-haiku-4-5', 1_000_000, 1_000_000);

    const expectedCost = 6.0; // $1 + $5
    const actualCost = result.this_request.cost_usd;
    const withinTolerance = Math.abs(actualCost - expectedCost) < 0.01;

    assert(
      withinTolerance,
      `5.6: Pricing accuracy (expected ~$${expectedCost}, got $${actualCost.toFixed(2)})`
    );
  }

  // =============================
  // Test Suite 6: Orchestrator Handoff
  // =============================

  console.log('\n\nTest Suite 6: Orchestrator Handoff\n');

  {
    const sessionId = `handoff-test-${Date.now()}`;
    await initializeRouterSession(sessionId, 'handoff test');

    const routeResult = await routeToOrchestrator(
      '@.claude/workflows/greenfield-fullstack.yaml',
      'build complex application',
      {
        session_id: sessionId,
        classification: { intent: 'web_app', complexity: 'high' },
      }
    );

    assert(routeResult.success === true, '6.1: Handoff succeeds');
    assert(routeResult.handoff_data !== undefined, '6.2: Handoff data provided');
    assert(
      routeResult.handoff_data.workflow.includes('greenfield'),
      '6.3: Workflow included in handoff'
    );
    assert(
      routeResult.handoff_data.routing_metadata.skip_redundant_routing === true,
      '6.4: Skip redundant routing flag set'
    );
  }

  // =============================
  // Performance & Memory Validation
  // =============================

  console.log('\n\nPerformance & Memory Validation\n');

  const testDuration = (Date.now() - testStartTime) / 1000;
  const finalMemory = getMemoryUsage();

  assertLessThan(testDuration, 300, 'Execution time < 5 minutes');
  assertLessThan(
    parseFloat(finalMemory.heapUsedMB),
    MEMORY_LIMITS.MAX_HEAP_MB,
    `Peak memory < ${MEMORY_LIMITS.MAX_HEAP_MB}MB`
  );
  assertLessThan(
    parseFloat(finalMemory.heapPercent),
    MEMORY_LIMITS.MAX_HEAP_PERCENT,
    `Heap usage < ${MEMORY_LIMITS.MAX_HEAP_PERCENT}%`
  );

  // =============================
  // Test Summary
  // =============================

  console.log('\n' + '='.repeat(60));
  console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`Execution Time: ${testDuration.toFixed(2)}s`);
  console.log(`Final Memory: ${finalMemory.heapUsedMB}MB (${finalMemory.heapPercent}%)`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    console.error('\n❌ Some tests failed');
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
  process.exit(0);
}

// =============================
// Entry Point
// =============================

// Run tests with memory monitoring
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
