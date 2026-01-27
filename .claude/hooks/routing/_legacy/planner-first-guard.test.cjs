#!/usr/bin/env node
/**
 * Tests for planner-first-guard.cjs
 *
 * Run with: node .claude/hooks/routing/planner-first-guard.test.cjs
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Import the module under test
const { validate, isPlannerSpawn } = require('./planner-first-guard.cjs');
const routerState = require('../router-state.cjs');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    // Reset state before each test
    routerState.resetToRouterMode();
    // Clear environment
    delete process.env.PLANNER_FIRST_ENFORCEMENT;

    fn();
    console.log(`  PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy value, got ${JSON.stringify(value)}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy value, got ${JSON.stringify(value)}`);
  }
}

// ===========================================
// isPlannerSpawn Tests
// ===========================================

console.log('\n=== isPlannerSpawn Tests ===\n');

test('detects "You are PLANNER" in prompt', () => {
  const result = isPlannerSpawn({
    prompt: 'You are PLANNER. Design the feature...',
    description: '',
  });
  assertTrue(result);
});

test('detects "You are the PLANNER" in prompt', () => {
  const result = isPlannerSpawn({
    prompt: 'You are the PLANNER agent. Read .claude/agents/core/planner.md',
    description: '',
  });
  assertTrue(result);
});

test('detects "as PLANNER" in prompt', () => {
  const result = isPlannerSpawn({ prompt: 'Act as PLANNER for this task', description: '' });
  assertTrue(result);
});

test('detects "planner" in description', () => {
  const result = isPlannerSpawn({
    prompt: 'Design authentication',
    description: 'Planner designing auth',
  });
  assertTrue(result);
});

test('case-insensitive detection', () => {
  const result = isPlannerSpawn({ prompt: 'you are planner', description: '' });
  assertTrue(result);
});

test('does NOT detect DEVELOPER as planner', () => {
  const result = isPlannerSpawn({
    prompt: 'You are DEVELOPER. Fix the bug',
    description: 'Developer fixing bug',
  });
  assertFalse(result);
});

test('does NOT detect QA as planner', () => {
  const result = isPlannerSpawn({
    prompt: 'You are QA. Run tests',
    description: 'QA running tests',
  });
  assertFalse(result);
});

test('does NOT detect SECURITY-ARCHITECT as planner', () => {
  const result = isPlannerSpawn({
    prompt: 'You are SECURITY-ARCHITECT. Review code',
    description: 'Security review',
  });
  assertFalse(result);
});

// ===========================================
// validate Tests - No Planner Required
// ===========================================

console.log('\n=== validate Tests (No Planner Required) ===\n');

test('allows any spawn when planner not required', () => {
  // Default state has planner not required
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid);
});

test('allows planner spawn when planner not required', () => {
  const result = validate({ prompt: 'You are PLANNER', description: 'Planner' });
  assertTrue(result.valid);
});

// ===========================================
// validate Tests - Planner Required
// ===========================================

console.log('\n=== validate Tests (Planner Required) ===\n');

test('allows PLANNER spawn when planner required but not spawned', () => {
  routerState.setComplexity('high');
  const result = validate({
    prompt: 'You are PLANNER. Design the feature',
    description: 'Planner designing',
  });
  assertTrue(result.valid, 'Should allow PLANNER spawn');
  assertTrue(result.isPlannerSpawn, 'Should detect as PLANNER spawn');
});

test('blocks DEVELOPER spawn when planner required but not spawned (block mode)', () => {
  routerState.setComplexity('high');
  process.env.PLANNER_FIRST_ENFORCEMENT = 'block';
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertFalse(result.valid, 'Should block DEVELOPER spawn');
  assertFalse(result.isPlannerSpawn, 'Should not be detected as PLANNER');
  assertTrue(result.error && result.error.includes('PLANNER-FIRST VIOLATION'));
});

test('warns DEVELOPER spawn when planner required but not spawned (warn mode)', () => {
  routerState.setComplexity('high');
  process.env.PLANNER_FIRST_ENFORCEMENT = 'warn';
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid, 'Should allow in warn mode');
  assertTrue(
    result.error && result.error.includes('PLANNER-FIRST VIOLATION'),
    'Should have warning'
  );
});

test('allows DEVELOPER spawn when planner already spawned', () => {
  routerState.setComplexity('high');
  routerState.markPlannerSpawned();
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid, 'Should allow after planner spawned');
});

test('allows any spawn when enforcement is off', () => {
  routerState.setComplexity('epic');
  process.env.PLANNER_FIRST_ENFORCEMENT = 'off';
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid, 'Should allow when enforcement off');
});

// ===========================================
// validate Tests - Epic Complexity
// ===========================================

console.log('\n=== validate Tests (Epic Complexity) ===\n');

test('blocks non-planner spawn for epic complexity', () => {
  routerState.setComplexity('epic');
  process.env.PLANNER_FIRST_ENFORCEMENT = 'block';
  const result = validate({ prompt: 'You are SECURITY-ARCHITECT', description: 'Security review' });
  assertFalse(result.valid, 'Should block non-PLANNER for epic');
  assertTrue(result.error && result.error.includes('epic'));
});

test('allows PLANNER spawn for epic complexity', () => {
  routerState.setComplexity('epic');
  const result = validate({ prompt: 'You are PLANNER', description: 'Planner' });
  assertTrue(result.valid, 'Should allow PLANNER for epic');
  assertTrue(result.isPlannerSpawn);
});

// ===========================================
// validate Tests - Low Complexity
// ===========================================

console.log('\n=== validate Tests (Low Complexity) ===\n');

test('allows any spawn for low complexity', () => {
  routerState.setComplexity('low');
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid, 'Should allow for low complexity');
});

test('allows any spawn for medium complexity', () => {
  routerState.setComplexity('medium');
  const result = validate({ prompt: 'You are DEVELOPER', description: 'Developer' });
  assertTrue(result.valid, 'Should allow for medium complexity');
});

// ===========================================
// Edge Cases
// ===========================================

console.log('\n=== Edge Cases ===\n');

test('handles empty input gracefully', () => {
  const result = validate({});
  assertTrue(result.valid, 'Should allow empty input');
});

test('handles null prompt gracefully', () => {
  const result = validate({ prompt: null, description: null });
  assertTrue(result.valid, 'Should allow null values');
});

test('handles undefined values gracefully', () => {
  const result = validate({ prompt: undefined, description: undefined });
  assertTrue(result.valid, 'Should allow undefined values');
});

// ===========================================
// Summary
// ===========================================

console.log('\n===========================================');
console.log(`Tests completed: ${testsPassed + testsFailed}`);
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('===========================================\n');

// Clean up state
routerState.resetToRouterMode();

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);
