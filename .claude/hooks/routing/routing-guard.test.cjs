#!/usr/bin/env node
/**
 * Routing Guard Tests
 * ====================
 *
 * TDD tests for the consolidated routing-guard.cjs module.
 * Tests cover all 5 original hooks' functionality:
 * - router-self-check
 * - planner-first-guard
 * - task-create-guard
 * - security-review-guard
 * - router-write-guard
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// The module we're testing
let routingGuard;
let routerState;
try {
  routingGuard = require('./routing-guard.cjs');
  routerState = require('./router-state.cjs');
} catch (err) {
  routingGuard = null;
  routerState = null;
}

describe('routing-guard', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  describe('module exports', () => {
    it('should export main function', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.strictEqual(typeof routingGuard.main, 'function');
    });

    it('should export runAllChecks function', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.strictEqual(typeof routingGuard.runAllChecks, 'function');
    });

    it('should export individual check functions', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.strictEqual(typeof routingGuard.checkRouterSelfCheck, 'function');
      assert.strictEqual(typeof routingGuard.checkPlannerFirst, 'function');
      assert.strictEqual(typeof routingGuard.checkTaskCreate, 'function');
      assert.strictEqual(typeof routingGuard.checkSecurityReview, 'function');
      assert.strictEqual(typeof routingGuard.checkRouterWrite, 'function');
    });

    it('should export helper functions', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.strictEqual(typeof routingGuard.isPlannerSpawn, 'function');
      assert.strictEqual(typeof routingGuard.isSecuritySpawn, 'function');
      assert.strictEqual(typeof routingGuard.isImplementationAgentSpawn, 'function');
      assert.strictEqual(typeof routingGuard.isAlwaysAllowedWrite, 'function');
    });

    it('should export constants', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.ok(Array.isArray(routingGuard.ALL_WATCHED_TOOLS));
      assert.ok(Array.isArray(routingGuard.BLACKLISTED_TOOLS));
      assert.ok(Array.isArray(routingGuard.WHITELISTED_TOOLS));
      assert.ok(Array.isArray(routingGuard.WRITE_TOOLS));
      assert.ok(Array.isArray(routingGuard.IMPLEMENTATION_AGENTS));
    });
  });

  describe('isPlannerSpawn', () => {
    it('should detect PLANNER in prompt', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isPlannerSpawn({
        prompt: 'You are PLANNER. Design the feature...',
        description: 'Design feature',
      });
      assert.strictEqual(result, true);
    });

    it('should detect planner in description', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isPlannerSpawn({
        prompt: 'Design the feature',
        description: 'Planner designing feature',
      });
      assert.strictEqual(result, true);
    });

    it('should return false for non-planner tasks', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isPlannerSpawn({
        prompt: 'You are DEVELOPER. Fix the bug...',
        description: 'Developer fixing bug',
      });
      assert.strictEqual(result, false);
    });
  });

  describe('isSecuritySpawn', () => {
    it('should detect SECURITY-ARCHITECT in prompt', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isSecuritySpawn({
        prompt: 'You are SECURITY-ARCHITECT. Review the design...',
        description: 'Review design',
      });
      assert.strictEqual(result, true);
    });

    it('should detect security in description', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isSecuritySpawn({
        prompt: 'Review the design',
        description: 'Security reviewing design',
      });
      assert.strictEqual(result, true);
    });

    it('should return false for non-security tasks', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isSecuritySpawn({
        prompt: 'You are DEVELOPER. Fix the bug...',
        description: 'Developer fixing bug',
      });
      assert.strictEqual(result, false);
    });
  });

  describe('isImplementationAgentSpawn', () => {
    it('should detect developer agent', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isImplementationAgentSpawn({
        prompt: 'You are developer. Fix the bug...',
      });
      assert.strictEqual(result, true);
    });

    it('should detect qa agent', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isImplementationAgentSpawn({
        prompt: 'You are qa. Run the tests...',
      });
      assert.strictEqual(result, true);
    });

    it('should detect devops agent', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isImplementationAgentSpawn({
        prompt: 'You are devops. Deploy the service...',
      });
      assert.strictEqual(result, true);
    });

    it('should return false for non-implementation agents', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isImplementationAgentSpawn({
        prompt: 'You are PLANNER. Design the feature...',
      });
      assert.strictEqual(result, false);
    });
  });

  describe('isAlwaysAllowedWrite', () => {
    it('should allow runtime state files', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isAlwaysAllowedWrite(
        '/project/.claude/context/runtime/state.json'
      );
      assert.strictEqual(result, true);
    });

    it('should allow memory files', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isAlwaysAllowedWrite(
        '/project/.claude/context/memory/learnings.md'
      );
      assert.strictEqual(result, true);
    });

    it('should allow .gitkeep files', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isAlwaysAllowedWrite('/project/dir/.gitkeep');
      assert.strictEqual(result, true);
    });

    it('should return false for regular files', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.isAlwaysAllowedWrite('/project/src/index.js');
      assert.strictEqual(result, false);
    });

    it('should return false for null/undefined', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      assert.strictEqual(routingGuard.isAlwaysAllowedWrite(null), false);
      assert.strictEqual(routingGuard.isAlwaysAllowedWrite(undefined), false);
    });
  });

  describe('checkRouterSelfCheck', () => {
    it('should allow whitelisted tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkRouterSelfCheck('Read');
      assert.strictEqual(result.pass, true);
    });

    it('should allow non-blacklisted tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkRouterSelfCheck('Task');
      assert.strictEqual(result.pass, true);
    });

    it('should pass when enforcement is off', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      process.env.ROUTER_SELF_CHECK = 'off';
      const result = routingGuard.checkRouterSelfCheck('Glob');
      assert.strictEqual(result.pass, true);
    });

    // BUG FIX: checkRouterSelfCheck should allow writes to memory files
    // even when not in agent context (for spawned subagents)
    it('should allow Write to memory files even in router mode (FIX for reflection-agent bug)', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.ok(routerState, 'Router state module should be loadable');

      // Explicitly set router mode (not agent mode)
      routerState.resetToRouterMode();
      routerState.invalidateStateCache(); // Ensure cache is cleared

      // Verify we're in router mode
      const state = routerState.getState();
      assert.strictEqual(state.mode, 'router', 'Should be in router mode');
      assert.strictEqual(state.taskSpawned, false, 'Task should not be spawned');

      // Now test: writes to memory files should STILL be allowed
      const result = routingGuard.checkRouterSelfCheck('Write', {
        file_path: '/project/.claude/context/memory/learnings.md',
      });
      assert.strictEqual(
        result.pass,
        true,
        'Memory file writes should be allowed even in router mode'
      );
    });

    it('should allow Edit to memory files even in router mode', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.ok(routerState, 'Router state module should be loadable');

      // Explicitly set router mode
      routerState.resetToRouterMode();
      routerState.invalidateStateCache();

      const result = routingGuard.checkRouterSelfCheck('Edit', {
        file_path: '/project/.claude/context/memory/decisions.md',
      });
      assert.strictEqual(
        result.pass,
        true,
        'Memory file edits should be allowed even in router mode'
      );
    });

    it('should allow Write to runtime files even in router mode', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.ok(routerState, 'Router state module should be loadable');

      // Explicitly set router mode
      routerState.resetToRouterMode();
      routerState.invalidateStateCache();

      const result = routingGuard.checkRouterSelfCheck('Write', {
        file_path: '/project/.claude/context/runtime/router-state.json',
      });
      assert.strictEqual(
        result.pass,
        true,
        'Runtime file writes should be allowed even in router mode'
      );
    });

    it('should still block Write to non-memory files in router mode', () => {
      assert.ok(routingGuard, 'Module should be loadable');
      assert.ok(routerState, 'Router state module should be loadable');

      // Explicitly set router mode
      routerState.resetToRouterMode();
      routerState.invalidateStateCache();

      // Ensure enforcement is on
      process.env.ROUTER_SELF_CHECK = 'block';

      const result = routingGuard.checkRouterSelfCheck('Write', {
        file_path: '/project/src/index.js',
      });
      // In router mode without agent context, regular file writes should be blocked
      assert.strictEqual(
        result.pass,
        false,
        'Non-memory file writes should be blocked in router mode'
      );
    });
  });

  describe('checkTaskCreate', () => {
    it('should pass for non-TaskCreate tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkTaskCreate('Task');
      assert.strictEqual(result.pass, true);
    });

    it('should pass when enforcement is off', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      process.env.PLANNER_FIRST_ENFORCEMENT = 'off';
      const result = routingGuard.checkTaskCreate('TaskCreate');
      assert.strictEqual(result.pass, true);
    });
  });

  describe('checkPlannerFirst', () => {
    it('should pass for non-Task tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkPlannerFirst('TaskCreate', {});
      assert.strictEqual(result.pass, true);
    });

    it('should pass when enforcement is off', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      process.env.PLANNER_FIRST_ENFORCEMENT = 'off';
      const result = routingGuard.checkPlannerFirst('Task', {
        prompt: 'You are developer...',
      });
      assert.strictEqual(result.pass, true);
    });

    it('should mark planner spawn correctly', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkPlannerFirst('Task', {
        prompt: 'You are PLANNER...',
      });
      assert.strictEqual(result.pass, true);
      // Note: markPlanner will only be true if planner is required
    });
  });

  describe('checkSecurityReview', () => {
    it('should pass for non-Task tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkSecurityReview('TaskCreate', {});
      assert.strictEqual(result.pass, true);
    });

    it('should pass when enforcement is off', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      process.env.SECURITY_REVIEW_ENFORCEMENT = 'off';
      const result = routingGuard.checkSecurityReview('Task', {
        prompt: 'You are developer...',
      });
      assert.strictEqual(result.pass, true);
    });

    it('should mark security spawn correctly', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkSecurityReview('Task', {
        prompt: 'You are SECURITY-ARCHITECT...',
      });
      assert.strictEqual(result.pass, true);
      // Note: markSecurity will only be true if security review is required
    });
  });

  describe('checkRouterWrite', () => {
    it('should pass for non-write tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkRouterWrite('Read', {});
      assert.strictEqual(result.pass, true);
    });

    it('should pass when enforcement is off', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      process.env.ROUTER_WRITE_GUARD = 'off';
      const result = routingGuard.checkRouterWrite('Edit', {
        file_path: '/project/src/index.js',
      });
      assert.strictEqual(result.pass, true);
    });

    it('should pass for always-allowed files', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      const result = routingGuard.checkRouterWrite('Write', {
        file_path: '/project/.claude/context/runtime/state.json',
      });
      assert.strictEqual(result.pass, true);
    });
  });

  describe('constants', () => {
    it('should have correct watched tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('Glob'));
      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('Grep'));
      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('Edit'));
      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('Write'));
      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('Task'));
      assert.ok(routingGuard.ALL_WATCHED_TOOLS.includes('TaskCreate'));
    });

    it('should have correct blacklisted tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('Glob'));
      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('Grep'));
      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('Edit'));
      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('Write'));
      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('NotebookEdit'));
      assert.ok(routingGuard.BLACKLISTED_TOOLS.includes('WebSearch'));
    });

    it('should have correct whitelisted tools', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      assert.ok(routingGuard.WHITELISTED_TOOLS.includes('TaskUpdate'));
      assert.ok(routingGuard.WHITELISTED_TOOLS.includes('TaskList'));
      assert.ok(routingGuard.WHITELISTED_TOOLS.includes('Read'));
    });

    it('should have correct implementation agents', () => {
      assert.ok(routingGuard, 'Module should be loadable');

      assert.ok(routingGuard.IMPLEMENTATION_AGENTS.includes('developer'));
      assert.ok(routingGuard.IMPLEMENTATION_AGENTS.includes('qa'));
      assert.ok(routingGuard.IMPLEMENTATION_AGENTS.includes('devops'));
    });
  });
});
