#!/usr/bin/env node
/**
 * Test CUJ-based routing functionality
 *
 * Tests the detectCUJReference and resolveCUJExecutionMode functions
 * to ensure CUJ-based routing works correctly.
 */

import { detectCUJReference, resolveCUJExecutionMode } from './orchestrator-entry.mjs';

console.log('=== CUJ Routing Test Suite ===\n');

// Test 1: detectCUJReference with various formats
console.log('Test 1: CUJ Reference Detection');
const testPrompts = [
  'Run CUJ-004',
  '/cuj-013',
  'Execute CUJ-022 to build the AI system',
  'Test CUJ-027 for recovery',
  'Please implement the feature',
  'cuj-050 test',
  'run cuj-001 please'
];

testPrompts.forEach(prompt => {
  const cujId = detectCUJReference(prompt);
  console.log(`  "${prompt}" → ${cujId || 'null'}`);
});

console.log('\nTest 2: CUJ Execution Mode Resolution');

// Test 2: resolveCUJExecutionMode
const testCUJs = ['CUJ-001', 'CUJ-002', 'CUJ-004', 'CUJ-013', 'CUJ-999'];

for (const cujId of testCUJs) {
  const result = await resolveCUJExecutionMode(cujId);
  console.log(`\n  ${cujId}:`);
  console.log(`    Execution Mode: ${result.executionMode}`);
  console.log(`    Workflow Path: ${result.workflowPath || 'N/A'}`);
  console.log(`    Primary Skill: ${result.primarySkill || 'N/A'}`);
  if (result.error) {
    console.log(`    Error: ${result.error}`);
  }
}

console.log('\n=== Test Complete ===');
