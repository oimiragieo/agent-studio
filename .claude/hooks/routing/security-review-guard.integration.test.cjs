#!/usr/bin/env node
/**
 * Security Review Guard Integration Test
 * Verifies the hook works end-to-end with the router state system
 */

'use strict';

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const routerState = require('./router-state.cjs');

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
}

function runHook(hookInput, env = {}) {
  const hookPath = path.join(__dirname, 'security-review-guard.cjs');
  const input = JSON.stringify(hookInput);

  try {
    const result = execSync(`node "${hookPath}"`, {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { exitCode: 0, stdout: result, stderr: '' };
  } catch (error) {
    return {
      exitCode: error.status,
      stdout: (error.stdout || '').toString(),
      stderr: (error.stderr || '').toString(),
    };
  }
}

// Test 1: State file location is correct
function testStateFileLocation() {
  resetState();

  const stateFile = routerState.STATE_FILE;
  assert.ok(fs.existsSync(stateFile), `State file should exist at ${stateFile}`);

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.strictEqual(
    state.requiresSecurityReview,
    false,
    'Default requiresSecurityReview should be false'
  );

  console.log('✓ Test 1 passed: State file location is correct');
}

// Test 2: Hook blocks DEVELOPER when security required (block mode)
function testHookBlocksDeveloper() {
  resetState();
  routerState.setSecurityRequired(true);

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement auth...',
    },
  };

  const result = runHook(hookInput, { SECURITY_REVIEW_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 2, 'Should exit with code 2 (block)');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('SEC-004'), 'Should mention SEC-004');

  console.log('✓ Test 2 passed: Hook blocks DEVELOPER when security required');
}

// Test 3: Hook allows DEVELOPER when security done
function testHookAllowsDeveloperWhenSecurityDone() {
  resetState();
  routerState.setSecurityRequired(true);
  routerState.markSecuritySpawned();

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement auth...',
    },
  };

  const result = runHook(hookInput, { SECURITY_REVIEW_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow)');

  console.log('✓ Test 3 passed: Hook allows DEVELOPER when security done');
}

// Test 4: Hook allows SECURITY-ARCHITECT even when security not done
function testHookAllowsSecurityArchitect() {
  resetState();
  routerState.setSecurityRequired(true);

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are SECURITY-ARCHITECT. Review auth...',
    },
  };

  const result = runHook(hookInput, { SECURITY_REVIEW_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow)');

  console.log('✓ Test 4 passed: Hook allows SECURITY-ARCHITECT even when security not done');
}

// Test 5: Warn mode allows operation (warning functionality verified in unit tests)
function testWarnModeAllows() {
  resetState();
  routerState.setSecurityRequired(true);

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement auth...',
    },
  };

  const result = runHook(hookInput, { SECURITY_REVIEW_ENFORCEMENT: 'warn' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow in warn mode)');
  // Note: Warning output is tested in unit tests. Integration test verifies exit code only.

  console.log('✓ Test 5 passed: Warn mode allows operation');
}

// Test 6: Off mode always allows
function testOffModeAlwaysAllows() {
  resetState();
  routerState.setSecurityRequired(true);

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement auth...',
    },
  };

  const result = runHook(hookInput, { SECURITY_REVIEW_ENFORCEMENT: 'off' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow)');

  console.log('✓ Test 6 passed: Off mode always allows');
}

// Run all tests
function runTests() {
  console.log('\n=== Security Review Guard Integration Tests ===\n');

  try {
    testStateFileLocation();
    testHookBlocksDeveloper();
    testHookAllowsDeveloperWhenSecurityDone();
    testHookAllowsSecurityArchitect();
    testWarnModeAllows();
    testOffModeAlwaysAllows();

    console.log('\n✓ All integration tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
