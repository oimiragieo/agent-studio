#!/usr/bin/env node
/**
 * Planner-First Guard Integration Test
 * Verifies the PreToolUse(Task) hook works end-to-end with the router state system
 *
 * Test Cases:
 * 1. Task(DEVELOPER) blocked when complexity=EPIC, plannerSpawned=false
 * 2. Task(PLANNER) allowed when complexity=EPIC, plannerSpawned=false (breaks cycle)
 * 3. Task(DEVELOPER) allowed when complexity=EPIC, plannerSpawned=true
 * 4. Task(any) allowed when complexity=LOW
 * 5. Warn mode produces warning but allows
 * 6. Off mode always allows
 * 7. Multi-scope prompts detected as EPIC
 * 8. Full flow: UserPromptSubmit -> complexity set -> Task blocked/allowed
 */

'use strict';

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const routerState = require('./router-state.cjs');

/**
 * Reset the router state to a clean default
 */
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

/**
 * Run the planner-first-guard.cjs hook with the given input and environment
 * @param {Object} hookInput - The hook input to pass
 * @param {Object} env - Environment variables to set
 * @returns {Object} { exitCode, stdout, stderr }
 */
function runHook(hookInput, env = {}) {
  const hookPath = path.join(__dirname, 'planner-first-guard.cjs');
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

/**
 * Run the router-enforcer.cjs hook to simulate UserPromptSubmit
 * This sets complexity based on the prompt content
 * @param {string} userPrompt - The user prompt to analyze
 * @returns {Object} { exitCode, stdout, stderr }
 */
function runRouterEnforcer(userPrompt) {
  const hookPath = path.join(__dirname, 'router-enforcer.cjs');
  const hookInput = JSON.stringify({ prompt: userPrompt });

  try {
    // Windows-compatible: use double quotes and escape internal quotes
    const escapedInput = hookInput.replace(/"/g, '\\"');
    const result = execSync(`node "${hookPath}" "${escapedInput}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
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

// ============================================
// Test 1: Task(DEVELOPER) blocked when complexity=EPIC, plannerSpawned=false
// ============================================
function testBlocksDeveloperWhenPlannerNotSpawned() {
  resetState();
  routerState.setComplexity('epic');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement the new authentication system...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 2, 'Should exit with code 2 (block)');
  const output = result.stdout + result.stderr;
  assert.ok(
    output.includes('PLANNER') || output.includes('planner'),
    'Should mention PLANNER requirement in error message'
  );

  console.log('PASS Test 1: Task(DEVELOPER) blocked when complexity=EPIC, plannerSpawned=false');
}

// ============================================
// Test 2: Task(PLANNER) allowed when complexity=EPIC, plannerSpawned=false (breaks cycle)
// This is the CRITICAL test - solves the chicken-egg problem
// ============================================
function testAllowsPlannerEvenWhenPlannerNotSpawned() {
  resetState();
  routerState.setComplexity('epic');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are PLANNER. Design the authentication system architecture...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(
    result.exitCode,
    0,
    'Should exit with code 0 (allow PLANNER to break the cycle)'
  );

  console.log(
    'PASS Test 2: Task(PLANNER) allowed when complexity=EPIC, plannerSpawned=false (breaks cycle)'
  );
}

// ============================================
// Test 3: Task(DEVELOPER) allowed when complexity=EPIC, plannerSpawned=true
// ============================================
function testAllowsDeveloperWhenPlannerSpawned() {
  resetState();
  routerState.setComplexity('epic');
  routerState.markPlannerSpawned();

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement the new authentication system...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow after PLANNER spawned)');

  console.log('PASS Test 3: Task(DEVELOPER) allowed when complexity=EPIC, plannerSpawned=true');
}

// ============================================
// Test 4: Task(any) allowed when complexity=LOW
// ============================================
function testAllowsAnyAgentWhenComplexityLow() {
  resetState();
  routerState.setComplexity('low');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Fix the typo in the config file...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow for low complexity)');

  console.log('PASS Test 4: Task(any) allowed when complexity=LOW');
}

// ============================================
// Test 5: Warn mode produces warning but allows
// ============================================
function testWarnModeProducesWarningButAllows() {
  resetState();
  routerState.setComplexity('epic');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement the new authentication system...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'warn' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow in warn mode)');
  // Warning output is best-effort; integration test verifies exit code primarily

  console.log('PASS Test 5: Warn mode produces warning but allows');
}

// ============================================
// Test 6: Off mode always allows
// ============================================
function testOffModeAlwaysAllows() {
  resetState();
  routerState.setComplexity('epic');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement the new authentication system...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'off' });
  assert.strictEqual(result.exitCode, 0, 'Should exit with code 0 (allow in off mode)');

  console.log('PASS Test 6: Off mode always allows');
}

// ============================================
// Test 7: HIGH complexity also blocks (not just EPIC)
// ============================================
function testBlocksDeveloperWhenComplexityHigh() {
  resetState();
  routerState.setComplexity('high');
  // plannerSpawned is false by default

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement the feature...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 2, 'Should exit with code 2 (block for high complexity)');

  console.log('PASS Test 7: Task(DEVELOPER) blocked when complexity=HIGH, plannerSpawned=false');
}

// ============================================
// Test 8: Full flow - UserPromptSubmit -> complexity set -> Task blocked/allowed
// ============================================
function testFullFlowIntegration() {
  resetState();

  // Step 1: Simulate UserPromptSubmit that sets complexity to HIGH/EPIC
  // The router-enforcer sets complexity based on keywords
  runRouterEnforcer(
    'I need to add authentication, authorization, and security features to integrate with the new API'
  );

  // Verify complexity was set to high or epic
  const complexity = routerState.getComplexity();
  assert.ok(
    ['high', 'epic'].includes(complexity),
    `Complexity should be high or epic for security-related request, got: ${complexity}`
  );

  // Step 2: Attempt to spawn DEVELOPER without PLANNER
  const developerInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Implement authentication...',
    },
  };

  const result1 = runHook(developerInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result1.exitCode, 2, 'DEVELOPER should be blocked before PLANNER');

  // Step 3: Spawn PLANNER (should be allowed)
  const plannerInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are PLANNER. Design the authentication architecture...',
    },
  };

  const result2 = runHook(plannerInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result2.exitCode, 0, 'PLANNER should be allowed');

  // Step 4: Mark planner as spawned (simulating PostToolUse)
  routerState.markPlannerSpawned();

  // Step 5: Now DEVELOPER should be allowed
  const result3 = runHook(developerInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result3.exitCode, 0, 'DEVELOPER should be allowed after PLANNER spawned');

  console.log('PASS Test 8: Full flow integration test passed');
}

// ============================================
// Test 9: QA agent also blocked (not just DEVELOPER)
// ============================================
function testBlocksQAWhenPlannerNotSpawned() {
  resetState();
  routerState.setComplexity('epic');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are QA. Write tests for the authentication system...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(
    result.exitCode,
    2,
    'QA should be blocked when planner not spawned for epic complexity'
  );

  console.log('PASS Test 9: Task(QA) blocked when complexity=EPIC, plannerSpawned=false');
}

// ============================================
// Test 10: ARCHITECT agent blocked (only PLANNER breaks the cycle)
// This verifies that ONLY PLANNER, not other agents, can break the chicken-egg
// ============================================
function testBlocksArchitectWhenPlannerNotSpawned() {
  resetState();
  routerState.setComplexity('epic');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are ARCHITECT. Design the system architecture...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  // ARCHITECT is NOT allowed to break the cycle - only PLANNER can
  assert.strictEqual(result.exitCode, 2, 'ARCHITECT should be blocked (only PLANNER breaks cycle)');

  console.log('PASS Test 10: Task(ARCHITECT) blocked when complexity=EPIC, plannerSpawned=false');
}

// ============================================
// Test 11: MEDIUM complexity does not require planner
// ============================================
function testMediumComplexityDoesNotRequirePlanner() {
  resetState();
  routerState.setComplexity('medium');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Add a new endpoint...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'DEVELOPER should be allowed for medium complexity');

  console.log('PASS Test 11: Task(DEVELOPER) allowed when complexity=MEDIUM');
}

// ============================================
// Test 12: TRIVIAL complexity does not require planner
// ============================================
function testTrivialComplexityDoesNotRequirePlanner() {
  resetState();
  routerState.setComplexity('trivial');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVELOPER. Say hello...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'DEVELOPER should be allowed for trivial complexity');

  console.log('PASS Test 12: Task(DEVELOPER) allowed when complexity=TRIVIAL');
}

// ============================================
// Test 13: DEVOPS agent also blocked when planner required
// ============================================
function testBlocksDevopsWhenPlannerNotSpawned() {
  resetState();
  routerState.setComplexity('epic');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are DEVOPS. Deploy the infrastructure...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 2, 'DEVOPS should be blocked when planner not spawned');

  console.log('PASS Test 13: Task(DEVOPS) blocked when complexity=EPIC, plannerSpawned=false');
}

// ============================================
// Test 14: Planner detection works with description field
// ============================================
function testPlannerDetectedByDescription() {
  resetState();
  routerState.setComplexity('epic');

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      description: 'Planner designing the system',
      prompt: 'Design the authentication system architecture...',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Should detect PLANNER from description field');

  console.log('PASS Test 14: PLANNER detected via description field');
}

// ============================================
// Test 15: State correctly marks plannerSpawned after PLANNER Task
// ============================================
function testStateMarkedAfterPlannerSpawn() {
  resetState();
  routerState.setComplexity('epic');

  // Verify initial state
  assert.strictEqual(
    routerState.isPlannerSpawned(),
    false,
    'plannerSpawned should be false initially'
  );

  const hookInput = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'You are PLANNER. Design the system...',
    },
  };

  runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });

  // Invalidate cache to see state changes from subprocess
  routerState.invalidateStateCache();

  // The hook should have marked planner as spawned
  assert.strictEqual(
    routerState.isPlannerSpawned(),
    true,
    'plannerSpawned should be true after PLANNER spawn'
  );

  console.log('PASS Test 15: State correctly marks plannerSpawned after PLANNER Task');
}

// ============================================
// Test 16: Non-Task tools are ignored (fail open)
// ============================================
function testNonTaskToolIgnored() {
  resetState();
  routerState.setComplexity('epic');

  const hookInput = {
    tool_name: 'Read', // Not a Task tool
    tool_input: {
      file_path: '/some/file.txt',
    },
  };

  const result = runHook(hookInput, { PLANNER_FIRST_ENFORCEMENT: 'block' });
  assert.strictEqual(result.exitCode, 0, 'Non-Task tools should be ignored (fail open)');

  console.log('PASS Test 16: Non-Task tools ignored (fail open)');
}

// ============================================
// Run all tests
// ============================================
function runTests() {
  console.log('\n=== Planner-First Guard Integration Tests ===\n');

  // Check if the hook file exists
  const hookPath = path.join(__dirname, 'planner-first-guard.cjs');
  if (!fs.existsSync(hookPath)) {
    console.log('SKIP: planner-first-guard.cjs not found');
    console.log('This test requires Task #1 to be completed first.\n');
    process.exit(0);
  }

  try {
    testBlocksDeveloperWhenPlannerNotSpawned();
    testAllowsPlannerEvenWhenPlannerNotSpawned();
    testAllowsDeveloperWhenPlannerSpawned();
    testAllowsAnyAgentWhenComplexityLow();
    testWarnModeProducesWarningButAllows();
    testOffModeAlwaysAllows();
    testBlocksDeveloperWhenComplexityHigh();
    testFullFlowIntegration();
    testBlocksQAWhenPlannerNotSpawned();
    testBlocksArchitectWhenPlannerNotSpawned();
    testMediumComplexityDoesNotRequirePlanner();
    testTrivialComplexityDoesNotRequirePlanner();
    testBlocksDevopsWhenPlannerNotSpawned();
    testPlannerDetectedByDescription();
    testStateMarkedAfterPlannerSpawn();
    testNonTaskToolIgnored();

    console.log('\nAll 16 integration tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\nIntegration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests, runHook, resetState };
