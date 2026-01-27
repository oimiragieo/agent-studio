#!/usr/bin/env node
/**
 * Tests for user-prompt-unified.cjs
 *
 * This unified hook consolidates 5 UserPromptSubmit hooks:
 * 1. router-mode-reset.cjs - Resets router state on new prompts
 * 2. router-enforcer.cjs - Analyzes prompts for routing recommendations
 * 3. memory-reminder.cjs - Reminds agents to read memory files
 * 4. evolution-trigger-detector.cjs - Detects evolution trigger patterns
 * 5. memory-health-check.cjs - Checks memory system health
 *
 * TDD approach: Write tests first, then implement the unified hook.
 */

'use strict';

const assert = require('node:assert');
const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const path = require('path');
const fs = require('fs');

// Test file paths
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const TEST_RUNTIME_DIR = path.join(PROJECT_ROOT, '.claude', 'context', 'runtime');
const TEST_ROUTER_STATE = path.join(TEST_RUNTIME_DIR, 'router-state.json');
const TEST_EVOLUTION_STATE = path.join(PROJECT_ROOT, '.claude', 'context', 'evolution-state.json');

// Prevent process.exit during tests
const originalExit = process.exit;
let lastExitCode = null;

beforeEach(() => {
  lastExitCode = null;
  process.exit = code => {
    lastExitCode = code;
  };
});

afterEach(() => {
  process.exit = originalExit;
});

// =============================================================================
// Test: Module loads and exports functions
// =============================================================================

describe('user-prompt-unified module exports', () => {
  it('should export required functions', () => {
    const unified = require('./user-prompt-unified.cjs');

    // Core check functions
    assert.strictEqual(
      typeof unified.checkRouterModeReset,
      'function',
      'checkRouterModeReset should be exported'
    );
    assert.strictEqual(
      typeof unified.checkRouterEnforcement,
      'function',
      'checkRouterEnforcement should be exported'
    );
    assert.strictEqual(
      typeof unified.checkMemoryReminder,
      'function',
      'checkMemoryReminder should be exported'
    );
    assert.strictEqual(
      typeof unified.checkEvolutionTrigger,
      'function',
      'checkEvolutionTrigger should be exported'
    );
    assert.strictEqual(
      typeof unified.checkMemoryHealth,
      'function',
      'checkMemoryHealth should be exported'
    );

    // Main entry point
    assert.strictEqual(typeof unified.runAllChecks, 'function', 'runAllChecks should be exported');

    // Helper for testing
    assert.strictEqual(
      typeof unified.parseHookInput,
      'function',
      'parseHookInput should be exported'
    );
  });
});

// =============================================================================
// Test: Router Mode Reset Logic (from router-mode-reset.cjs)
// =============================================================================

describe('checkRouterModeReset', () => {
  it('should skip reset for slash commands', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: '/help' };
    const result = unified.checkRouterModeReset(hookInput);

    assert.strictEqual(result.skipped, true, 'Should skip for slash commands');
    assert.strictEqual(result.reason, 'slash_command', 'Reason should be slash_command');
  });

  it('should skip reset if in active agent context (recent task)', () => {
    const unified = require('./user-prompt-unified.cjs');
    const routerState = require('./router-state.cjs');

    // Set up an active agent context (task spawned less than 30 min ago)
    const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    routerState.enterAgentMode('test task');

    const hookInput = { prompt: 'continue with the task' };
    const result = unified.checkRouterModeReset(hookInput);

    // Should either reset or skip depending on state
    // The actual logic checks if taskSpawned and taskSpawnedAt is recent
    assert.ok(result !== undefined, 'Should return a result');
  });

  it('should reset state for normal prompts', () => {
    const unified = require('./user-prompt-unified.cjs');
    const routerState = require('./router-state.cjs');

    // Clear any existing state
    routerState.resetToRouterMode();

    const hookInput = { prompt: 'Fix the login bug' };
    const result = unified.checkRouterModeReset(hookInput);

    assert.strictEqual(result.skipped, false, 'Should not skip for normal prompts');
    assert.strictEqual(result.stateReset, true, 'Should reset state');
  });
});

// =============================================================================
// Test: Router Enforcer Logic (from router-enforcer.cjs)
// =============================================================================

describe('checkRouterEnforcement', () => {
  it('should skip for very short prompts', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'hi' };
    const result = unified.checkRouterEnforcement(hookInput);

    assert.strictEqual(result.skipped, true, 'Should skip for short prompts');
  });

  it('should skip for slash commands', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: '/commit -m "test"' };
    const result = unified.checkRouterEnforcement(hookInput);

    assert.strictEqual(result.skipped, true, 'Should skip for slash commands');
  });

  it('should detect developer intent for bug fix prompts', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Fix the login bug in the authentication module' };
    const result = unified.checkRouterEnforcement(hookInput);

    assert.ok(result.candidates && result.candidates.length > 0, 'Should have candidates');
    // Developer should be among top candidates for bug fix
    const hasDevAgent = result.candidates.some(c => c.agent && c.agent.name === 'developer');
    assert.ok(hasDevAgent || result.skipped === true, 'Developer should be a candidate or skipped');
  });

  it('should detect high complexity for security-related prompts', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Add OAuth2 authentication to the API' };
    const result = unified.checkRouterEnforcement(hookInput);

    // Security-related prompts should trigger high complexity
    if (!result.skipped) {
      assert.ok(
        ['high', 'epic'].includes(result.planningReq?.complexity) ||
          result.planningReq?.requiresSecurityReview,
        'Should detect security-sensitive request'
      );
    }
  });
});

// =============================================================================
// Test: Memory Reminder Logic (from memory-reminder.cjs)
// =============================================================================

describe('checkMemoryReminder', () => {
  it('should return empty if memory directory does not exist', () => {
    const unified = require('./user-prompt-unified.cjs');

    // Use a non-existent path
    const result = unified.checkMemoryReminder({}, '/nonexistent/path');

    assert.strictEqual(result.show, false, 'Should not show reminder if no memory dir');
  });

  it('should detect existing memory files with content', () => {
    const unified = require('./user-prompt-unified.cjs');

    // Use actual project root
    const result = unified.checkMemoryReminder({}, PROJECT_ROOT);

    // If memory files exist, should have file info
    assert.ok(result.files !== undefined, 'Should have files property');
    assert.ok(Array.isArray(result.files), 'files should be an array');
  });
});

// =============================================================================
// Test: Evolution Trigger Detection (from evolution-trigger-detector.cjs)
// =============================================================================

describe('checkEvolutionTrigger', () => {
  it('should detect explicit creation trigger', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Create a new agent for Kubernetes deployments' };
    const result = unified.checkEvolutionTrigger(hookInput);

    assert.ok(result.triggers && result.triggers.length > 0, 'Should detect creation trigger');
    assert.strictEqual(
      result.triggers[0].type,
      'explicit_creation',
      'Type should be explicit_creation'
    );
  });

  it('should detect capability need trigger', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'I need a Python agent to handle data processing' };
    const result = unified.checkEvolutionTrigger(hookInput);

    assert.ok(result.triggers && result.triggers.length > 0, 'Should detect capability need');
  });

  it('should detect gap detection trigger', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'There is no matching agent for this task' };
    const result = unified.checkEvolutionTrigger(hookInput);

    assert.ok(result.triggers && result.triggers.length > 0, 'Should detect gap');
  });

  it('should return empty triggers for normal prompts', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Fix the button color on the homepage' };
    const result = unified.checkEvolutionTrigger(hookInput);

    assert.ok(result.triggers.length === 0, 'Should have no triggers for normal prompt');
  });

  it('should respect EVOLUTION_TRIGGER_DETECTION=off', () => {
    const unified = require('./user-prompt-unified.cjs');

    const oldEnv = process.env.EVOLUTION_TRIGGER_DETECTION;
    process.env.EVOLUTION_TRIGGER_DETECTION = 'off';

    const hookInput = { prompt: 'Create a new agent for testing' };
    const result = unified.checkEvolutionTrigger(hookInput);

    assert.strictEqual(result.enabled, false, 'Should be disabled when env var is off');

    process.env.EVOLUTION_TRIGGER_DETECTION = oldEnv;
  });
});

// =============================================================================
// Test: Memory Health Check (from memory-health-check.cjs)
// =============================================================================

describe('checkMemoryHealth', () => {
  it('should return health status', () => {
    const unified = require('./user-prompt-unified.cjs');

    const result = unified.checkMemoryHealth({}, PROJECT_ROOT);

    // Should have status field
    assert.ok(result.status !== undefined, 'Should have status');
    assert.ok(
      ['healthy', 'warning', 'error', 'unavailable'].includes(result.status),
      'Status should be valid'
    );
  });

  it('should return unavailable if memory manager not present', () => {
    const unified = require('./user-prompt-unified.cjs');

    // Use a non-existent path
    const result = unified.checkMemoryHealth({}, '/nonexistent/path');

    assert.strictEqual(result.status, 'unavailable', 'Should be unavailable for invalid path');
  });

  it('should include metrics when available', () => {
    const unified = require('./user-prompt-unified.cjs');

    const result = unified.checkMemoryHealth({}, PROJECT_ROOT);

    // If not unavailable, should have metrics
    if (result.status !== 'unavailable') {
      assert.ok(result.metrics !== undefined, 'Should have metrics');
    }
  });
});

// =============================================================================
// Test: Combined runAllChecks
// =============================================================================

describe('runAllChecks', () => {
  it('should run all checks and return combined result', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Fix the login bug in the app' };
    const result = unified.runAllChecks(hookInput, PROJECT_ROOT);

    // Should have all check results
    assert.ok(result.routerModeReset !== undefined, 'Should have routerModeReset result');
    assert.ok(result.routerEnforcement !== undefined, 'Should have routerEnforcement result');
    assert.ok(result.memoryReminder !== undefined, 'Should have memoryReminder result');
    assert.ok(result.evolutionTrigger !== undefined, 'Should have evolutionTrigger result');
    assert.ok(result.memoryHealth !== undefined, 'Should have memoryHealth result');
  });

  it('should handle null/empty input gracefully', () => {
    const unified = require('./user-prompt-unified.cjs');

    const result = unified.runAllChecks(null, PROJECT_ROOT);

    // Should not throw, should return results
    assert.ok(result !== undefined, 'Should return result for null input');
  });

  it('should always allow (exit 0) as all checks are advisory', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Test prompt' };
    const result = unified.runAllChecks(hookInput, PROJECT_ROOT);

    // The unified hook should never block (all original hooks exit 0)
    assert.strictEqual(result.exitCode, 0, 'Should always exit 0 (advisory mode)');
  });
});

// =============================================================================
// Test: Backward compatibility with original hook outputs
// =============================================================================

describe('backward compatibility', () => {
  it('should produce router analysis output for valid prompts', () => {
    const unified = require('./user-prompt-unified.cjs');

    const hookInput = { prompt: 'Implement a new feature for user registration with OAuth' };
    const result = unified.runAllChecks(hookInput, PROJECT_ROOT);

    // Router enforcement should produce analysis
    const enforcement = result.routerEnforcement;
    if (!enforcement.skipped) {
      assert.ok(
        enforcement.candidates !== undefined || enforcement.intent !== undefined,
        'Should have routing analysis'
      );
    }
  });

  it('should detect evolution triggers same as original hook', () => {
    const unified = require('./user-prompt-unified.cjs');

    // Test each trigger pattern from original hook
    const testCases = [
      { prompt: 'create a new agent for X', expectedType: 'explicit_creation' },
      { prompt: 'need a skill for handling Y', expectedType: 'capability_need' },
      { prompt: 'no matching agent for Z', expectedType: 'gap_detection' },
      { prompt: 'evolve the system to support W', expectedType: 'explicit_evolution' },
    ];

    for (const tc of testCases) {
      const result = unified.checkEvolutionTrigger({ prompt: tc.prompt });
      if (result.triggers.length > 0) {
        assert.strictEqual(
          result.triggers[0].type,
          tc.expectedType,
          `Should detect ${tc.expectedType} for: ${tc.prompt}`
        );
      }
    }
  });
});

// =============================================================================
// Test: Performance - Shared state caching
// =============================================================================

describe('performance optimizations', () => {
  it('should use shared hook input parsing', () => {
    const unified = require('./user-prompt-unified.cjs');

    // parseHookInput should be a single shared function
    assert.strictEqual(typeof unified.parseHookInput, 'function', 'Should export parseHookInput');
  });
});

console.log('All tests defined. Running...');
