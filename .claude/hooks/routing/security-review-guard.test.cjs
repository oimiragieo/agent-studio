#!/usr/bin/env node
/**
 * Security Review Guard Hook Tests
 * Tests for PreToolUse(Task) security review enforcement
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock router state
const routerState = require('./router-state.cjs');

// Import the hook's validation function
const { validate, readState } = require('./security-review-guard.cjs');

function resetState() {
  const state = {
    mode: 'router',
    lastReset: new Date().toISOString(),
    taskSpawned: false,
    taskSpawnedAt: null,
    taskDescription: null,
    sessionId: null,
    complexity: 'trivial',
    requiresPlannerFirst: false,
    plannerSpawned: false,
    requiresSecurityReview: false,
    securitySpawned: false,
  };

  const stateFile = routerState.STATE_FILE;
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  // Invalidate cache so subsequent reads see the fresh state
  // This was added when state-cache.cjs integration was done
  if (typeof routerState.invalidateStateCache === 'function') {
    routerState.invalidateStateCache();
  }
}

// Test 1: Allow when security review not required
function testAllowWhenSecurityNotRequired() {
  resetState();

  const input = {
    tool: 'Task',
    prompt: 'You are DEVELOPER. Fix the login bug...',
  };

  const result = validate(input);
  assert.strictEqual(result.valid, true, 'Should allow when security review not required');
  console.log('✓ Test 1 passed: Allow when security review not required');
}

// Test 2: Block DEVELOPER when security review required but not done
function testBlockDeveloperWhenSecurityRequired() {
  resetState();

  // Set security required but not spawned
  routerState.setSecurityRequired(true);

  const input = {
    tool: 'Task',
    prompt: 'You are DEVELOPER. Implement auth feature...',
  };

  // Save original env
  const originalEnforcement = process.env.SECURITY_REVIEW_ENFORCEMENT;
  process.env.SECURITY_REVIEW_ENFORCEMENT = 'block';

  const result = validate(input);

  // Restore env
  if (originalEnforcement !== undefined) {
    process.env.SECURITY_REVIEW_ENFORCEMENT = originalEnforcement;
  } else {
    delete process.env.SECURITY_REVIEW_ENFORCEMENT;
  }

  assert.strictEqual(result.valid, false, 'Should block DEVELOPER when security review required');
  assert.ok(result.error.includes('SEC-004'), 'Error should mention SEC-004');
  console.log('✓ Test 2 passed: Block DEVELOPER when security review required');
}

// Test 3: Allow DEVELOPER when security review done
function testAllowDeveloperWhenSecurityDone() {
  resetState();

  // Set security required AND spawned
  routerState.setSecurityRequired(true);
  routerState.markSecuritySpawned();

  const input = {
    tool: 'Task',
    prompt: 'You are DEVELOPER. Implement auth feature...',
  };

  const result = validate(input);
  assert.strictEqual(result.valid, true, 'Should allow DEVELOPER when security review done');
  console.log('✓ Test 3 passed: Allow DEVELOPER when security review done');
}

// Test 4: Block QA when security review required but not done
function testBlockQAWhenSecurityRequired() {
  resetState();

  // Set security required but not spawned
  routerState.setSecurityRequired(true);

  const input = {
    tool: 'Task',
    prompt: 'You are QA. Test the auth feature...',
  };

  // Save original env
  const originalEnforcement = process.env.SECURITY_REVIEW_ENFORCEMENT;
  process.env.SECURITY_REVIEW_ENFORCEMENT = 'block';

  const result = validate(input);

  // Restore env
  if (originalEnforcement !== undefined) {
    process.env.SECURITY_REVIEW_ENFORCEMENT = originalEnforcement;
  } else {
    delete process.env.SECURITY_REVIEW_ENFORCEMENT;
  }

  assert.strictEqual(result.valid, false, 'Should block QA when security review required');
  assert.ok(result.error.includes('SEC-004'), 'Error should mention SEC-004');
  console.log('✓ Test 4 passed: Block QA when security review required');
}

// Test 5: Allow SECURITY-ARCHITECT spawn even when security not done
function testAllowSecurityArchitectSpawn() {
  resetState();

  // Set security required but not spawned
  routerState.setSecurityRequired(true);

  const input = {
    tool: 'Task',
    prompt: 'You are SECURITY-ARCHITECT. Review auth design...',
  };

  const result = validate(input);
  assert.strictEqual(result.valid, true, 'Should allow SECURITY-ARCHITECT spawn');
  console.log('✓ Test 5 passed: Allow SECURITY-ARCHITECT spawn even when security not done');
}

// Test 6: Warn mode should allow but show warning
function testWarnMode() {
  resetState();

  // Set security required but not spawned
  routerState.setSecurityRequired(true);

  const input = {
    tool: 'Task',
    prompt: 'You are DEVELOPER. Implement auth feature...',
  };

  // Save original env
  const originalEnforcement = process.env.SECURITY_REVIEW_ENFORCEMENT;
  process.env.SECURITY_REVIEW_ENFORCEMENT = 'warn';

  const result = validate(input);

  // Restore env
  if (originalEnforcement !== undefined) {
    process.env.SECURITY_REVIEW_ENFORCEMENT = originalEnforcement;
  } else {
    delete process.env.SECURITY_REVIEW_ENFORCEMENT;
  }

  assert.strictEqual(result.valid, true, 'Warn mode should allow operation');
  assert.ok(result.error.includes('WARNING'), 'Should include WARNING in message');
  console.log('✓ Test 6 passed: Warn mode allows but shows warning');
}

// Test 7: Off mode should always allow
function testOffMode() {
  resetState();

  // Set security required but not spawned
  routerState.setSecurityRequired(true);

  const input = {
    tool: 'Task',
    prompt: 'You are DEVELOPER. Implement auth feature...',
  };

  // Save original env
  const originalEnforcement = process.env.SECURITY_REVIEW_ENFORCEMENT;
  process.env.SECURITY_REVIEW_ENFORCEMENT = 'off';

  const result = validate(input);

  // Restore env
  if (originalEnforcement !== undefined) {
    process.env.SECURITY_REVIEW_ENFORCEMENT = originalEnforcement;
  } else {
    delete process.env.SECURITY_REVIEW_ENFORCEMENT;
  }

  assert.strictEqual(result.valid, true, 'Off mode should always allow');
  console.log('✓ Test 7 passed: Off mode always allows');
}

// Run all tests
function runTests() {
  console.log('\n=== Security Review Guard Tests ===\n');

  try {
    testAllowWhenSecurityNotRequired();
    testBlockDeveloperWhenSecurityRequired();
    testAllowDeveloperWhenSecurityDone();
    testBlockQAWhenSecurityRequired();
    testAllowSecurityArchitectSpawn();
    testWarnMode();
    testOffMode();

    console.log('\n✓ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
