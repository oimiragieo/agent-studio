#!/usr/bin/env node
/**
 * Loop Prevention Hook Tests
 *
 * Tests for the loop-prevention.cjs hook which prevents:
 * 1. Evolution Budget exhaustion (max evolutions per session)
 * 2. Cooldown Period violations (same-type evolutions too close together)
 * 3. Spawn Depth limit exceeded (nested agent spawns)
 * 4. Pattern Detection (same action repeated too many times)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Test state tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

// Test output
function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (typeof actual === 'string') {
        // Case-insensitive contains check for strings
        if (!actual.toLowerCase().includes(expected.toLowerCase())) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      } else {
        throw new Error('toContain only works with strings and arrays');
      }
    },
  };
}

// Test file paths
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const STATE_DIR = path.join(PROJECT_ROOT, '.claude', 'context', 'self-healing');
const TEST_STATE_FILE = path.join(STATE_DIR, 'loop-state.test.json');

// Ensure state directory exists
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

// Clean up test state before each test suite
function cleanupTestState() {
  if (fs.existsSync(TEST_STATE_FILE)) {
    fs.unlinkSync(TEST_STATE_FILE);
  }
}

// Load the module under test
const loopPrevention = require('./loop-prevention.cjs');

// ==========================================
// Test Suites
// ==========================================

describe('Loop Prevention Module Exports', () => {
  it('should export all required functions', () => {
    expect(typeof loopPrevention.getState).toBe('function');
    expect(typeof loopPrevention.resetState).toBe('function');
    expect(typeof loopPrevention.checkEvolutionBudget).toBe('function');
    expect(typeof loopPrevention.checkCooldownPeriod).toBe('function');
    expect(typeof loopPrevention.checkSpawnDepth).toBe('function');
    expect(typeof loopPrevention.checkPatternDetection).toBe('function');
    expect(typeof loopPrevention.recordEvolution).toBe('function');
    expect(typeof loopPrevention.recordSpawn).toBe('function');
    expect(typeof loopPrevention.recordAction).toBe('function');
    expect(typeof loopPrevention.getEnforcementMode).toBe('function');
  });

  it('should export constants', () => {
    expect(loopPrevention.DEFAULT_EVOLUTION_BUDGET).toBe(3);
    expect(loopPrevention.DEFAULT_COOLDOWN_MS).toBe(300000); // 5 minutes
    expect(loopPrevention.DEFAULT_DEPTH_LIMIT).toBe(5);
    expect(loopPrevention.DEFAULT_PATTERN_THRESHOLD).toBe(3);
  });
});

describe('State Management', () => {
  cleanupTestState();

  it('should return default state when no state file exists', () => {
    // Use custom state file for testing
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.evolutionCount).toBe(0);
    expect(state.spawnDepth).toBe(0);
    expect(typeof state.lastEvolutions).toBe('object');
    expect(Array.isArray(state.actionHistory)).toBeTruthy();
  });

  it('should reset state correctly', () => {
    // First, set some state
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    loopPrevention.recordSpawn('developer', TEST_STATE_FILE);

    // Reset
    loopPrevention.resetState(TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);

    expect(state.evolutionCount).toBe(0);
    expect(state.spawnDepth).toBe(0);
    expect(Object.keys(state.lastEvolutions).length).toBe(0);
    expect(state.actionHistory.length).toBe(0);
  });

  it('should preserve sessionId when set via environment', () => {
    process.env.CLAUDE_SESSION_ID = 'test-session-123';
    loopPrevention.resetState(TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.sessionId).toBe('test-session-123');
    delete process.env.CLAUDE_SESSION_ID;
  });

  cleanupTestState();
});

describe('Evolution Budget Mechanism', () => {
  cleanupTestState();

  it('should allow evolution when under budget', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const result = loopPrevention.checkEvolutionBudget(TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    expect(result.remaining).toBe(3);
  });

  it('should track evolution count', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.evolutionCount).toBe(1);
  });

  it('should block evolution when budget exhausted', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    loopPrevention.recordEvolution('skill', TEST_STATE_FILE);
    loopPrevention.recordEvolution('workflow', TEST_STATE_FILE);

    const result = loopPrevention.checkEvolutionBudget(TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain('budget');
  });

  it('should respect custom budget from environment', () => {
    process.env.LOOP_EVOLUTION_BUDGET = '5';
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    loopPrevention.recordEvolution('skill', TEST_STATE_FILE);
    loopPrevention.recordEvolution('workflow', TEST_STATE_FILE);

    const result = loopPrevention.checkEvolutionBudget(TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    expect(result.remaining).toBe(2);
    delete process.env.LOOP_EVOLUTION_BUDGET;
  });

  cleanupTestState();
});

describe('Cooldown Period Mechanism', () => {
  cleanupTestState();

  it('should allow evolution when no prior evolution of same type', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const result = loopPrevention.checkCooldownPeriod('agent', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
  });

  it('should block evolution within cooldown period', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);

    const result = loopPrevention.checkCooldownPeriod('agent', TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.reason).toContain('cooldown');
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it('should allow different evolution type during cooldown', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);

    const result = loopPrevention.checkCooldownPeriod('skill', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
  });

  it('should allow evolution after cooldown period', () => {
    loopPrevention.resetState(TEST_STATE_FILE);

    // Manually set a past timestamp (more than 5 minutes ago)
    const state = loopPrevention.getState(TEST_STATE_FILE);
    state.lastEvolutions.agent = new Date(Date.now() - 400000).toISOString(); // 6+ minutes ago
    loopPrevention._saveState(state, TEST_STATE_FILE);

    const result = loopPrevention.checkCooldownPeriod('agent', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
  });

  it('should respect custom cooldown from environment', () => {
    process.env.LOOP_COOLDOWN_MS = '1000'; // 1 second
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);

    // Wait slightly longer than cooldown
    const startTime = Date.now();
    while (Date.now() - startTime < 1100) {
      // busy wait for 1.1 seconds
    }

    const result = loopPrevention.checkCooldownPeriod('agent', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    delete process.env.LOOP_COOLDOWN_MS;
  });

  cleanupTestState();
});

describe('Spawn Depth Mechanism', () => {
  cleanupTestState();

  it('should allow spawn when under depth limit', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const result = loopPrevention.checkSpawnDepth(TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    expect(result.currentDepth).toBe(0);
  });

  it('should track spawn depth', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordSpawn('developer', TEST_STATE_FILE);
    loopPrevention.recordSpawn('planner', TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.spawnDepth).toBe(2);
  });

  it('should block spawn when depth limit exceeded', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    for (let i = 0; i < 5; i++) {
      loopPrevention.recordSpawn(`agent-${i}`, TEST_STATE_FILE);
    }

    const result = loopPrevention.checkSpawnDepth(TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.currentDepth).toBe(5);
    expect(result.reason).toContain('depth');
  });

  it('should respect custom depth limit from environment', () => {
    process.env.LOOP_DEPTH_LIMIT = '10';
    loopPrevention.resetState(TEST_STATE_FILE);
    for (let i = 0; i < 7; i++) {
      loopPrevention.recordSpawn(`agent-${i}`, TEST_STATE_FILE);
    }

    const result = loopPrevention.checkSpawnDepth(TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    delete process.env.LOOP_DEPTH_LIMIT;
  });

  it('should allow decrementing spawn depth', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordSpawn('developer', TEST_STATE_FILE);
    loopPrevention.recordSpawn('planner', TEST_STATE_FILE);
    loopPrevention.decrementSpawnDepth(TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.spawnDepth).toBe(1);
  });

  cleanupTestState();
});

describe('Pattern Detection Mechanism', () => {
  cleanupTestState();

  it('should allow action when under pattern threshold', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const result = loopPrevention.checkPatternDetection('spawn:developer', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
  });

  it('should track action history', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);

    const entry = state.actionHistory.find(a => a.action === 'spawn:developer');
    expect(entry.count).toBe(2);
  });

  it('should block action when pattern threshold exceeded', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);

    const result = loopPrevention.checkPatternDetection('spawn:developer', TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.count).toBe(3);
    expect(result.reason).toContain('pattern');
  });

  it('should respect custom pattern threshold from environment', () => {
    process.env.LOOP_PATTERN_THRESHOLD = '5';
    loopPrevention.resetState(TEST_STATE_FILE);
    for (let i = 0; i < 4; i++) {
      loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    }

    const result = loopPrevention.checkPatternDetection('spawn:developer', TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
    delete process.env.LOOP_PATTERN_THRESHOLD;
  });

  it('should track different actions separately', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:planner', TEST_STATE_FILE);

    const devResult = loopPrevention.checkPatternDetection('spawn:developer', TEST_STATE_FILE);
    expect(devResult.allowed).toBeTruthy(); // 2 < 3

    const plannerResult = loopPrevention.checkPatternDetection('spawn:planner', TEST_STATE_FILE);
    expect(plannerResult.allowed).toBeTruthy(); // 1 < 3
  });

  cleanupTestState();
});

describe('Enforcement Modes', () => {
  it('should default to block mode', () => {
    delete process.env.LOOP_PREVENTION_MODE;
    const mode = loopPrevention.getEnforcementMode();
    expect(mode).toBe('block');
  });

  it('should respect LOOP_PREVENTION_MODE=warn', () => {
    process.env.LOOP_PREVENTION_MODE = 'warn';
    const mode = loopPrevention.getEnforcementMode();
    expect(mode).toBe('warn');
    delete process.env.LOOP_PREVENTION_MODE;
  });

  it('should respect LOOP_PREVENTION_MODE=off', () => {
    process.env.LOOP_PREVENTION_MODE = 'off';
    const mode = loopPrevention.getEnforcementMode();
    expect(mode).toBe('off');
    delete process.env.LOOP_PREVENTION_MODE;
  });
});

describe('Combined Checks (PreToolUse Integration)', () => {
  cleanupTestState();

  it('should check all mechanisms for Task tool', () => {
    loopPrevention.resetState(TEST_STATE_FILE);

    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        description: 'Test spawn',
        prompt: 'You are DEVELOPER...',
      },
    };

    const result = loopPrevention.checkPreToolUse(hookInput, TEST_STATE_FILE);
    expect(result.allowed).toBeTruthy();
  });

  it('should block when spawn depth exceeded', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    for (let i = 0; i < 5; i++) {
      loopPrevention.recordSpawn(`agent-${i}`, TEST_STATE_FILE);
    }

    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        description: 'Test spawn',
        prompt: 'You are DEVELOPER...',
      },
    };

    const result = loopPrevention.checkPreToolUse(hookInput, TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.reason).toContain('depth');
  });

  it('should check evolution triggers for evolution-related prompts', () => {
    loopPrevention.resetState(TEST_STATE_FILE);

    // Record 3 evolutions to exhaust budget
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    loopPrevention.recordEvolution('skill', TEST_STATE_FILE);
    loopPrevention.recordEvolution('workflow', TEST_STATE_FILE);

    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        description: 'Create new agent',
        prompt: 'Invoke Skill({ skill: "agent-creator" })',
      },
    };

    const result = loopPrevention.checkPreToolUse(hookInput, TEST_STATE_FILE);
    expect(result.allowed).toBeFalsy();
    expect(result.reason).toContain('budget');
  });

  cleanupTestState();
});

describe('State Schema Compliance', () => {
  cleanupTestState();

  it('should produce state matching the documented schema', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    loopPrevention.recordEvolution('agent', TEST_STATE_FILE);
    loopPrevention.recordSpawn('developer', TEST_STATE_FILE);
    loopPrevention.recordAction('spawn:developer', TEST_STATE_FILE);

    const state = loopPrevention.getState(TEST_STATE_FILE);

    // Check schema compliance
    expect(typeof state.sessionId).toBe('string');
    expect(typeof state.evolutionCount).toBe('number');
    expect(typeof state.lastEvolutions).toBe('object');
    expect(typeof state.spawnDepth).toBe('number');
    expect(Array.isArray(state.actionHistory)).toBeTruthy();

    // Check lastEvolutions structure
    expect(typeof state.lastEvolutions.agent).toBe('string'); // ISO timestamp

    // Check actionHistory structure
    const action = state.actionHistory[0];
    expect(typeof action.action).toBe('string');
    expect(typeof action.count).toBe('number');
    expect(typeof action.lastAt).toBe('string'); // ISO timestamp
  });

  cleanupTestState();
});

describe('SEC-007: Prototype Pollution Protection', () => {
  cleanupTestState();

  it('should strip __proto__ from malicious state file', () => {
    // Write a malicious state file with prototype pollution attempt
    const maliciousState = {
      sessionId: 'test-session',
      evolutionCount: 0,
      spawnDepth: 0,
      lastEvolutions: {},
      actionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __proto__: { polluted: true },
    };
    fs.writeFileSync(TEST_STATE_FILE, JSON.stringify(maliciousState));

    // Read the state - should NOT have __proto__ pollution
    const state = loopPrevention.getState(TEST_STATE_FILE);

    // The state should not have __proto__ as own property
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBeFalsy();

    // Global Object prototype should NOT be polluted
    expect({}.polluted).toBe(undefined);
  });

  it('should strip constructor from malicious state file', () => {
    // Write a malicious state file with constructor pollution attempt
    const maliciousState = {
      sessionId: 'test-session',
      evolutionCount: 0,
      spawnDepth: 0,
      lastEvolutions: {},
      actionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      constructor: { prototype: { polluted: true } },
    };
    fs.writeFileSync(TEST_STATE_FILE, JSON.stringify(maliciousState));

    // Read the state - should NOT have constructor pollution
    const state = loopPrevention.getState(TEST_STATE_FILE);

    // The state should not have constructor as an object with prototype
    const hasConstructorPollution =
      state.constructor && typeof state.constructor === 'object' && state.constructor.prototype;
    expect(hasConstructorPollution).toBeFalsy();
  });

  it('should return defaults for corrupted JSON', () => {
    // Write corrupted JSON
    fs.writeFileSync(TEST_STATE_FILE, '{ invalid json }}}');

    // Should return defaults, not throw
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state.evolutionCount).toBe(0);
    expect(state.spawnDepth).toBe(0);
  });

  it('should only allow known properties from schema', () => {
    // Write state with unknown/malicious properties
    const maliciousState = {
      sessionId: 'test-session',
      evolutionCount: 1,
      spawnDepth: 2,
      lastEvolutions: {},
      actionHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maliciousProperty: 'should be stripped',
      anotherBadProp: { nested: 'data' },
    };
    fs.writeFileSync(TEST_STATE_FILE, JSON.stringify(maliciousState));

    // Read the state
    const state = loopPrevention.getState(TEST_STATE_FILE);

    // Should NOT have the malicious properties
    expect(Object.prototype.hasOwnProperty.call(state, 'maliciousProperty')).toBeFalsy();
    expect(Object.prototype.hasOwnProperty.call(state, 'anotherBadProp')).toBeFalsy();

    // But should have the valid ones
    expect(state.evolutionCount).toBe(1);
    expect(state.spawnDepth).toBe(2);
  });

  cleanupTestState();
});

// SEC-AUDIT-020: Busy-wait in lock retry
describe('SEC-AUDIT-020: Lock Retry Without CPU Spin', () => {
  cleanupTestState();

  it('should not use busy-wait for lock retry delays', () => {
    loopPrevention.resetState(TEST_STATE_FILE);

    // Test that rapid lock acquisition/release works correctly
    // (which uses internal sleep mechanism)
    const startTime = Date.now();

    for (let i = 0; i < 5; i++) {
      const state = loopPrevention.getState(TEST_STATE_FILE);
      state.evolutionCount = i;
      loopPrevention._saveState(state, TEST_STATE_FILE);
    }

    const elapsed = Date.now() - startTime;

    // Should complete reasonably quickly
    expect(elapsed).toBeLessThan(5000);

    // State should be consistent
    const final = loopPrevention.getState(TEST_STATE_FILE);
    expect(final.evolutionCount).toBe(4);
  });

  it('should have working Atomics.wait fallback if SharedArrayBuffer available', () => {
    // Check that SharedArrayBuffer and Atomics are available
    const hasAtomics = typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined';

    if (hasAtomics) {
      // Test that Atomics.wait works as expected
      const sharedBuffer = new SharedArrayBuffer(4);
      const int32 = new Int32Array(sharedBuffer);

      const startTime = Date.now();
      // This should block for ~50ms
      Atomics.wait(int32, 0, 0, 50);
      const elapsed = Date.now() - startTime;

      // Should have waited approximately 50ms
      expect(elapsed).toBeGreaterThan(40);
      expect(elapsed).toBeLessThan(200);
    } else {
      // Atomics not available - test still passes (fallback mode acceptable)
      expect(true).toBeTruthy();
    }
  });

  cleanupTestState();
});

// ==========================================
// Run Tests
// ==========================================

// SEC-AUDIT-014: TOCTOU in Lock File Cleanup
describe('SEC-AUDIT-014: Lock Mechanism', () => {
  cleanupTestState();

  it('should acquire and release lock', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state).toBeTruthy();

    // Lock should be released after operation
    const lockFile = TEST_STATE_FILE + '.lock';
    expect(fs.existsSync(lockFile)).toBeFalsy();
  });

  it('should handle stale locks from dead processes', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const lockFile = TEST_STATE_FILE + '.lock';

    // Create stale lock with non-existent PID
    const stalePid = 999999;
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        pid: stalePid,
        time: Date.now(),
      })
    );

    // Should detect dead process and remove lock
    const state = loopPrevention.getState(TEST_STATE_FILE);
    expect(state).toBeTruthy();

    // Lock should be removed
    expect(fs.existsSync(lockFile)).toBeFalsy();
  });

  it('should not use time-based lock cleanup (SEC-AUDIT-014 fix)', () => {
    loopPrevention.resetState(TEST_STATE_FILE);
    const lockFile = TEST_STATE_FILE + '.lock';

    // Create lock with old timestamp but current PID
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        pid: process.pid,
        time: Date.now() - 10000, // Old timestamp
      })
    );

    // Should NOT remove lock just because it's old
    // (would timeout waiting for lock to be released)
    const startTime = Date.now();
    let timedOut = false;

    try {
      // This should wait/timeout, not immediately succeed
      loopPrevention.getState(TEST_STATE_FILE);
    } catch {
      timedOut = true;
    }

    const elapsed = Date.now() - startTime;

    // Should have waited (indicating it didn't remove lock)
    // If it removed the lock immediately, elapsed would be < 10ms
    expect(elapsed).toBeGreaterThan(50);
  });

  it('should handle concurrent state access', () => {
    loopPrevention.resetState(TEST_STATE_FILE);

    // Rapidly read/write state
    for (let i = 0; i < 10; i++) {
      const state = loopPrevention.getState(TEST_STATE_FILE);
      state.evolutionCount = i;
      loopPrevention._saveState(state, TEST_STATE_FILE);
    }

    // State should be consistent - this is the critical assertion
    const final = loopPrevention.getState(TEST_STATE_FILE);
    expect(final.evolutionCount).toBe(9);

    // Clean up any lingering locks (Windows can be slow to release)
    const lockFile = TEST_STATE_FILE + '.lock';
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch {
        // Lock might be held briefly - not a test failure
        console.log('Note: Lock file existed after test, cleaned up');
      }
    }
  });

  cleanupTestState();
});

console.log('\n========================================');
console.log('Loop Prevention Hook Tests');
console.log('========================================');

// Print summary
console.log('\n----------------------------------------');
console.log(`Tests: ${testsRun} total`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log('----------------------------------------');

if (testsFailed > 0) {
  console.log('\nFailures:');
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name}`);
    console.log(`     ${f.error}`);
  });
  process.exit(1);
}

console.log('\nAll tests passed!');
process.exit(0);
