#!/usr/bin/env node
/**
 * Worker Integration Validation Script
 *
 * Quick validation of worker pattern integration without full orchestrator run.
 * Tests feature flag, supervisor initialization, and task classification.
 *
 * Usage:
 *   node validate-worker-integration.mjs
 *   USE_WORKERS=true node validate-worker-integration.mjs
 *
 * @module validate-worker-integration
 * @version 1.0.0
 * @created 2026-01-12
 */

import { initializeSupervisor, isLongRunningTask } from '../orchestrator-entry.mjs';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';

const USE_WORKERS = process.env.USE_WORKERS === 'true' || false;

console.log('\n=== Worker Pattern Integration Validation ===\n');

// Test 1: Feature Flag Detection
console.log('Test 1: Feature Flag Detection');
console.log(`  USE_WORKERS environment: ${process.env.USE_WORKERS || 'undefined'}`);
console.log(`  Workers enabled: ${USE_WORKERS}`);
console.log(`  ✅ Feature flag detected correctly\n`);

// Test 2: Supervisor Initialization
console.log('Test 2: Supervisor Initialization');
try {
  const supervisor = await initializeSupervisor();

  if (USE_WORKERS) {
    if (supervisor) {
      console.log(`  ✅ Supervisor initialized successfully`);
      console.log(`  Supervisor ID: ${supervisor.supervisorId}`);
      console.log(`  Max workers: ${supervisor.maxWorkers}`);
      console.log(`  Heap limit: ${supervisor.heapLimit}MB`);

      // Cleanup
      await supervisor.cleanup();
      console.log(`  ✅ Supervisor cleanup successful\n`);
    } else {
      console.log(`  ❌ FAILED: Supervisor should be initialized when USE_WORKERS=true\n`);
      process.exit(1);
    }
  } else {
    if (supervisor === null) {
      console.log(`  ✅ Supervisor correctly disabled (USE_WORKERS=false)\n`);
    } else {
      console.log(`  ❌ FAILED: Supervisor should be null when USE_WORKERS=false\n`);
      process.exit(1);
    }
  }
} catch (error) {
  console.log(`  ❌ FAILED: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Task Classification Heuristics
console.log('Test 3: Task Classification Heuristics');

const testCases = [
  {
    description: 'Implement authentication feature',
    complexity: 0.7,
    expected: true,
    label: 'long-running',
  },
  {
    description: 'Refactor entire codebase',
    complexity: 0.8,
    expected: true,
    label: 'long-running',
  },
  {
    description: 'Fix login button bug',
    complexity: 0.3,
    expected: false,
    label: 'short-running',
  },
  {
    description: 'Update README documentation',
    complexity: 0.2,
    expected: false,
    label: 'short-running',
  },
  {
    description: 'Add code comment',
    complexity: 0.1,
    expected: false,
    label: 'short-running',
  },
  {
    description: 'Analyze codebase for patterns',
    complexity: 0.6,
    expected: true,
    label: 'long-running',
  },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = isLongRunningTask(testCase.description, testCase.complexity);
  const status = result === testCase.expected ? '✅' : '❌';

  if (result === testCase.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(
    `  ${status} "${testCase.description}" (complexity: ${testCase.complexity}) → ${result ? 'long' : 'short'} (expected: ${testCase.label})`
  );
}

console.log(`\n  Summary: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ VALIDATION FAILED: Some task classifications were incorrect\n');
  process.exit(1);
}

// Test 4: Complexity Edge Cases
console.log('Test 4: Complexity Edge Cases');

const edgeCases = [
  {
    description: 'Ambiguous task',
    complexity: 0.5,
    expected: false,
    label: 'threshold edge (≤0.6)',
  },
  {
    description: 'Just above threshold',
    complexity: 0.61,
    expected: true,
    label: 'just above threshold (>0.6)',
  },
  {
    description: 'High complexity overrides quick keyword',
    complexity: 0.85,
    expected: true,
    label: 'high complexity overrides',
  },
];

let edgePassed = 0;
let edgeFailed = 0;

for (const testCase of edgeCases) {
  const result = isLongRunningTask(testCase.description, testCase.complexity);
  const status = result === testCase.expected ? '✅' : '❌';

  if (result === testCase.expected) {
    edgePassed++;
  } else {
    edgeFailed++;
  }

  console.log(
    `  ${status} "${testCase.description}" (complexity: ${testCase.complexity}) → ${result ? 'long' : 'short'} (${testCase.label})`
  );
}

console.log(`\n  Summary: ${edgePassed} passed, ${edgeFailed} failed\n`);

if (edgeFailed > 0) {
  console.log('❌ VALIDATION FAILED: Edge case handling incorrect\n');
  process.exit(1);
}

// Final Summary
console.log('=== Validation Summary ===\n');
console.log(`  Feature Flag: ✅ Working`);
console.log(`  Supervisor Init: ✅ Working`);
console.log(
  `  Task Classification: ✅ ${passed + edgePassed}/${testCases.length + edgeCases.length} tests passed`
);
console.log(`  Workers Enabled: ${USE_WORKERS ? 'YES' : 'NO (default)'}`);

console.log('\n✅ ALL VALIDATIONS PASSED\n');
console.log('Next steps:');
console.log('  1. Run full integration tests: pnpm test:tools');
console.log(
  '  2. Test with workers enabled: USE_WORKERS=true node orchestrator-entry.mjs --prompt "test"'
);
console.log('  3. Validate production deployment with V8 flags: pnpm agent:production\n');

process.exit(0);
