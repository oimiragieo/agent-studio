#!/usr/bin/env node
/**
 * Unit tests for agent-task-template-enforcer.mjs
 */

import { validateTaskTemplate, extractTaskPrompt } from './agent-task-template-enforcer.mjs';

/**
 * Test utilities
 */
let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ ${description}`);
    console.log(`     Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message || `Expected "${haystack}" to include "${needle}"`);
  }
}

/**
 * Test data
 */
const validTaskTemplate = {
  task_id: 'test-task-001',
  objective: 'Test objective',
  context: {
    problem: 'Test problem',
    why_now: 'Test urgency',
  },
  deliverables: [
    {
      type: 'file',
      path: '.claude/context/reports/test.md',
      description: 'Test deliverable',
      format: 'markdown',
      validation: 'Test validation',
    },
  ],
  constraints: {
    max_time_minutes: 30,
    max_file_reads: 10,
    must_validate: true,
  },
  success_criteria: ['Criterion 1'],
  verification: {
    verification_type: 'runtime',
    required_tests: [
      {
        test_name: 'Test',
        command_or_action: 'npm test',
        expected_outcome: 'All tests pass',
      },
    ],
    passing_criteria: {
      errors_allowed: 0,
      tests_passed_minimum: '100%',
    },
    evidence_required: true,
  },
  assigned_agent: 'developer',
};

const freeformPrompt = 'Create a file and implement feature X';

const partialJSON = {
  task_id: 'test-task-001',
  objective: 'Test objective',
  // Missing required fields
};

const invalidContextJSON = {
  ...validTaskTemplate,
  context: {
    problem: 'Test problem',
    // Missing why_now
  },
};

const invalidVerificationJSON = {
  ...validTaskTemplate,
  verification: {
    verification_type: 'runtime',
    // Missing required_tests, passing_criteria, evidence_required
  },
};

/**
 * Run tests
 */
console.log('🧪 Agent Task Template Enforcer - Unit Tests');
console.log('═'.repeat(70));
console.log();

console.log('Test Group: Extract Task Prompt');
test('Extracts string prompt', () => {
  const result = extractTaskPrompt('Test prompt');
  assertEquals(result, 'Test prompt');
});

test('Extracts prompt field', () => {
  const result = extractTaskPrompt({ prompt: 'Test prompt' });
  assertEquals(result, 'Test prompt');
});

test('Extracts task field', () => {
  const result = extractTaskPrompt({ task: 'Test task' });
  assertEquals(result, 'Test task');
});

test('Extracts instruction field', () => {
  const result = extractTaskPrompt({ instruction: 'Test instruction' });
  assertEquals(result, 'Test instruction');
});

console.log();
console.log('Test Group: Validate Task Template');

test('Blocks freeform text prompt', () => {
  const result = validateTaskTemplate(freeformPrompt);
  assertEquals(result.valid, false);
  assertIncludes(result.reason, 'not valid JSON');
});

test('Blocks partial JSON (missing required fields)', () => {
  const result = validateTaskTemplate(JSON.stringify(partialJSON));
  assertEquals(result.valid, false);
  assertIncludes(result.reason, 'Missing required fields');
  assert(result.missingFields.length > 0, 'Should have missing fields');
});

test('Blocks invalid context (missing nested fields)', () => {
  const result = validateTaskTemplate(JSON.stringify(invalidContextJSON));
  assertEquals(result.valid, false);
  assertIncludes(result.reason, 'Missing required context fields');
  assert(
    result.missingFields.includes('context.why_now'),
    'Should identify missing context.why_now'
  );
});

test('Blocks invalid verification (missing nested fields - v2.1.0)', () => {
  const result = validateTaskTemplate(JSON.stringify(invalidVerificationJSON));
  assertEquals(result.valid, false);
  assertIncludes(result.reason, 'Missing required verification fields');
  assert(result.missingFields.length > 0, 'Should have missing verification fields');
});

test('Allows valid JSON template with all required fields', () => {
  const result = validateTaskTemplate(JSON.stringify(validTaskTemplate));
  assertEquals(result.valid, true);
});

test('Warns about missing optimization fields', () => {
  const result = validateTaskTemplate(JSON.stringify(validTaskTemplate));
  assertEquals(result.valid, true);
  assert(result.missingOptimizations.length > 0, 'Should identify missing optimization fields');
  assertEquals(result.hasOptimizations, false, 'Should not have all optimizations');
});

test('Accepts template with optimization fields', () => {
  const optimizedTemplate = {
    ...validTaskTemplate,
    reasoning_style: 'step-by-step',
    examples: [{ input: 'test', output: 'result', explanation: 'why' }],
    uncertainty_permission: true,
    output_format: { structure: 'xml-tagged', sections: [] },
    thinking_budget: 1000,
    validation_schema: { type: 'object' },
  };

  const result = validateTaskTemplate(JSON.stringify(optimizedTemplate));
  assertEquals(result.valid, true);
  assertEquals(result.missingOptimizations.length, 0);
  assertEquals(result.hasOptimizations, true);
});

test('Handles nested JSON object (not stringified)', () => {
  const result = validateTaskTemplate(validTaskTemplate);
  assertEquals(result.valid, true);
});

test('Identifies specific missing fields', () => {
  const result = validateTaskTemplate(JSON.stringify(partialJSON));
  assertEquals(result.valid, false);
  assert(result.missingFields.includes('context'), 'Should identify missing context');
  assert(result.missingFields.includes('deliverables'), 'Should identify missing deliverables');
  assert(result.missingFields.includes('verification'), 'Should identify missing verification');
});

console.log();
console.log('Test Group: Edge Cases');

test('Handles empty object', () => {
  const result = validateTaskTemplate(JSON.stringify({}));
  assertEquals(result.valid, false);
  assert(result.missingFields.length === 8, 'Should have all 8 required fields missing');
});

test('Handles invalid JSON', () => {
  const result = validateTaskTemplate('{ invalid json');
  assertEquals(result.valid, false);
  assertIncludes(result.reason, 'not valid JSON');
});

test('Handles null input', () => {
  const result = validateTaskTemplate(null);
  assertEquals(result.valid, false);
});

console.log();
console.log('═'.repeat(70));
console.log('📊 Test Summary');
console.log(`  Total Passed: ${testsPassed}`);
console.log(`  Total Failed: ${testsFailed}`);
console.log(`  Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
console.log();

if (testsFailed === 0) {
  console.log('✅ All tests passed');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
