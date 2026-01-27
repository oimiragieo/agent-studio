#!/usr/bin/env node
/**
 * TaskCreate Guard Hook - Test Suite
 *
 * Tests the TaskCreate guard that enforces:
 * - Complex tasks (HIGH/EPIC) must spawn PLANNER first
 *
 * Environment: PLANNER_FIRST_ENFORCEMENT=block|warn|off (default: block)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Find project root dynamically
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const HOOK_PATH = path.join(PROJECT_ROOT, '.claude', 'hooks', 'routing', 'task-create-guard.cjs');
const STATE_MODULE_PATH = path.join(
  PROJECT_ROOT,
  '.claude',
  'hooks',
  'routing',
  'router-state.cjs'
);
const STATE_FILE_PATH = path.join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'runtime',
  'router-state.json'
);

// Test utilities
let testsFailed = 0;
let testsPass = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    testsFailed++;
    return false;
  }
  console.log(`PASS: ${message}`);
  testsPass++;
  return true;
}

/**
 * Clean up state file before/after tests
 */
function cleanupState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      fs.unlinkSync(STATE_FILE_PATH);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Run the hook with given input and environment
 * @param {object} input - Hook input (JSON)
 * @param {object} env - Additional environment variables
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runHook(input, env = {}) {
  return new Promise(resolve => {
    const child = spawn('node', [HOOK_PATH], {
      env: { ...process.env, ...env },
      cwd: PROJECT_ROOT,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', exitCode => {
      resolve({ exitCode, stdout, stderr });
    });

    // Send input via stdin
    if (input) {
      child.stdin.write(JSON.stringify(input));
    }
    child.stdin.end();
  });
}

/**
 * Test 1: Module exports required functions
 */
function testModuleExports() {
  console.log('\nTest 1: Module exports required functions');

  delete require.cache[require.resolve(HOOK_PATH)];

  let mod;
  try {
    mod = require(HOOK_PATH);
  } catch (e) {
    assert(false, `Module should be loadable: ${e.message}`);
    return;
  }

  assert(typeof mod.main === 'function', 'Should export main function');
  assert(typeof mod.parseHookInput === 'function', 'Should export parseHookInput function');
}

/**
 * Test 2: Hook allows when enforcement is off
 */
async function testEnforcementOff() {
  console.log('\nTest 2: Hook allows when enforcement is off');

  cleanupState();

  // Set up state with high complexity, planner required but not spawned
  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high'); // This auto-sets requiresPlannerFirst

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Test task',
      description: 'Test description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'off' });
  assert(result.exitCode === 0, 'Should exit 0 when enforcement is off');
}

/**
 * Test 3: Hook allows TaskCreate for trivial complexity
 */
async function testTrivialComplexityAllowed() {
  console.log('\nTest 3: Hook allows TaskCreate for trivial complexity');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('trivial');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Simple task',
      description: 'Simple description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 0, 'Should exit 0 for trivial complexity');
}

/**
 * Test 4: Hook allows TaskCreate for low complexity
 */
async function testLowComplexityAllowed() {
  console.log('\nTest 4: Hook allows TaskCreate for low complexity');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('low');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Low complexity task',
      description: 'Description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 0, 'Should exit 0 for low complexity');
}

/**
 * Test 5: Hook warns for high complexity without planner
 */
async function testHighComplexityWarns() {
  console.log('\nTest 5: Hook warns for high complexity without planner');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Complex task',
      description: 'Complex description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'warn' });
  assert(result.exitCode === 0, 'Should exit 0 in warn mode (allow but warn)');
  assert(result.stdout.includes('warn'), 'Should output warning JSON');
  assert(result.stdout.includes('PLANNER'), 'Warning should mention PLANNER');
}

/**
 * Test 6: Hook blocks for high complexity without planner in block mode
 */
async function testHighComplexityBlocks() {
  console.log('\nTest 6: Hook blocks for high complexity without planner in block mode');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Complex task',
      description: 'Complex description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 2, 'Should exit 2 in block mode');
  assert(result.stdout.includes('block'), 'Should output block JSON');
}

/**
 * Test 7: Hook allows high complexity when planner was spawned
 */
async function testHighComplexityWithPlannerAllowed() {
  console.log('\nTest 7: Hook allows high complexity when planner was spawned');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high');
  routerState.markPlannerSpawned();

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Complex task after planner',
      description: 'Description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 0, 'Should exit 0 when planner was spawned');
}

/**
 * Test 8: Hook blocks for epic complexity without planner
 */
async function testEpicComplexityBlocks() {
  console.log('\nTest 8: Hook blocks for epic complexity without planner');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('epic');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Epic task',
      description: 'Epic description',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 2, 'Should exit 2 for epic complexity without planner');
}

/**
 * Test 9: Hook ignores non-TaskCreate tools
 */
async function testIgnoresOtherTools() {
  console.log('\nTest 9: Hook ignores non-TaskCreate tools');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high');

  const input = {
    tool_name: 'Task', // Different tool
    tool_input: {
      prompt: 'Some prompt',
    },
  };

  const result = await runHook(input, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 0, 'Should exit 0 for non-TaskCreate tools');
}

/**
 * Test 10: Hook fails closed with empty input (SEC-008 fix)
 */
async function testEmptyInputHandling() {
  console.log('\nTest 10: Hook handles empty input gracefully');

  const result = await runHook(null, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert(result.exitCode === 2, 'Should exit 2 with no input (fail closed for security)');
  assert(result.stderr.includes('no_input_fail_closed'), 'Should log fail-closed reason');
}

/**
 * Test 11: Default enforcement mode is block (production safety)
 */
async function testDefaultEnforcementIsBlock() {
  console.log('\nTest 11: Default enforcement mode is block');

  cleanupState();
  delete require.cache[require.resolve(STATE_MODULE_PATH)];

  const routerState = require(STATE_MODULE_PATH);
  routerState.resetToRouterMode();
  routerState.setComplexity('high');

  const input = {
    tool_name: 'TaskCreate',
    tool_input: {
      subject: 'Test',
      description: 'Test',
    },
  };

  // Don't set PLANNER_FIRST_ENFORCEMENT - should default to 'block' for production safety
  const result = await runHook(input, {});
  assert(result.exitCode === 2, 'Default should be block mode (exit 2)');
  assert(result.stdout.includes('block'), 'Default should output block JSON');
}

// Run all tests
async function runAllTests() {
  console.log('TaskCreate Guard Hook - Test Suite');
  console.log('='.repeat(70));

  cleanupState();

  try {
    testModuleExports();
    await testEnforcementOff();
    await testTrivialComplexityAllowed();
    await testLowComplexityAllowed();
    await testHighComplexityWarns();
    await testHighComplexityBlocks();
    await testHighComplexityWithPlannerAllowed();
    await testEpicComplexityBlocks();
    await testIgnoresOtherTools();
    await testEmptyInputHandling();
    await testDefaultEnforcementIsBlock();
  } catch (error) {
    console.error(`\nTest execution failed: ${error.message}`);
    console.error(error.stack);
    testsFailed++;
  } finally {
    cleanupState();
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\nTest Results: ${testsPass} passed, ${testsFailed} failed`);

  if (testsFailed > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

runAllTests();
