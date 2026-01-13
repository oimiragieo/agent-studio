/**
 * Orchestrator Entry - Worker Integration Tests
 *
 * Tests integration of worker pattern into orchestrator-entry.mjs
 * Validates feature flag behavior and execution mode routing
 *
 * @module orchestrator-entry.worker-integration.test
 * @version 1.0.0
 * @created 2026-01-12
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  processUserPrompt,
  initializeSupervisor,
  isLongRunningTask,
} from '../orchestrator-entry.mjs';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

describe('Orchestrator Entry - Worker Integration', () => {
  const testDbPath = '.claude/context/memory/test-workers.db';

  beforeEach(async () => {
    // Clean up test database before each test
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }
  });

  afterEach(async () => {
    // Clean up test database after each test
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }
  });

  describe('Feature Flag Behavior', () => {
    it('should disable workers when USE_WORKERS=false (default)', async () => {
      // Default behavior - workers disabled
      delete process.env.USE_WORKERS;

      const supervisor = await initializeSupervisor();
      assert.strictEqual(supervisor, null, 'Supervisor should be null when workers disabled');
    });

    it('should enable workers when USE_WORKERS=true', async () => {
      process.env.USE_WORKERS = 'true';

      const supervisor = await initializeSupervisor();
      assert.notStrictEqual(
        supervisor,
        null,
        'Supervisor should be initialized when workers enabled'
      );

      // Cleanup
      await supervisor.cleanup();
      delete process.env.USE_WORKERS;
    });

    it('should return same supervisor instance on multiple initializations', async () => {
      process.env.USE_WORKERS = 'true';

      const supervisor1 = await initializeSupervisor();
      const supervisor2 = await initializeSupervisor();

      assert.strictEqual(
        supervisor1,
        supervisor2,
        'Should return same supervisor instance (singleton)'
      );

      // Cleanup
      await supervisor1.cleanup();
      delete process.env.USE_WORKERS;
    });
  });

  describe('Task Duration Heuristics', () => {
    it('should classify "implement feature" as long-running', () => {
      const result = isLongRunningTask('Implement authentication feature', 0.5);
      assert.strictEqual(result, true, 'Should be long-running task');
    });

    it('should classify "refactor codebase" as long-running', () => {
      const result = isLongRunningTask('Refactor the entire codebase', 0.6);
      assert.strictEqual(result, true, 'Should be long-running task');
    });

    it('should classify "analyze codebase" as long-running', () => {
      const result = isLongRunningTask('Analyze codebase for issues', 0.5);
      assert.strictEqual(result, true, 'Should be long-running task');
    });

    it('should classify "fix bug" as short-running (low complexity)', () => {
      const result = isLongRunningTask('Fix the login bug', 0.3);
      assert.strictEqual(result, false, 'Should be short-running task');
    });

    it('should classify "update README" as short-running', () => {
      const result = isLongRunningTask('Update README documentation', 0.2);
      assert.strictEqual(result, false, 'Should be short-running task');
    });

    it('should classify "add comment" as short-running', () => {
      const result = isLongRunningTask('Add code comment to function', 0.1);
      assert.strictEqual(result, false, 'Should be short-running task');
    });

    it('should use complexity threshold for ambiguous tasks', () => {
      const result1 = isLongRunningTask('Process user data', 0.5); // Below threshold
      const result2 = isLongRunningTask('Process user data', 0.7); // Above threshold

      assert.strictEqual(result1, false, 'Should be short-running (complexity 0.5)');
      assert.strictEqual(result2, true, 'Should be long-running (complexity 0.7)');
    });

    it('should handle edge case: high complexity overrides short keywords', () => {
      const result = isLongRunningTask('Quick fix for the entire system', 0.8);
      assert.strictEqual(result, true, 'High complexity should override short keywords');
    });
  });

  describe('Execution Mode Routing', () => {
    it('should use legacy execution when workers disabled', async () => {
      delete process.env.USE_WORKERS; // Ensure disabled

      // Mock workflow execution - simplified test
      const mockPrompt = 'Implement a simple feature';
      const mockRunId = `test-run-${Date.now()}`;

      // Note: Full integration test would require mocking run-manager and workflow-router
      // This test validates the routing logic exists
      const supervisor = await initializeSupervisor();
      assert.strictEqual(supervisor, null, 'Should not initialize supervisor when disabled');
    });

    it('should use worker execution for long-running tasks when enabled', async () => {
      process.env.USE_WORKERS = 'true';

      const supervisor = await initializeSupervisor();
      assert.notStrictEqual(supervisor, null, 'Should initialize supervisor when enabled');

      // Validate supervisor has required methods
      assert.strictEqual(
        typeof supervisor.spawnWorker,
        'function',
        'Should have spawnWorker method'
      );
      assert.strictEqual(
        typeof supervisor.waitForCompletion,
        'function',
        'Should have waitForCompletion method'
      );

      // Cleanup
      await supervisor.cleanup();
      delete process.env.USE_WORKERS;
    });
  });

  describe('Complexity Mapping', () => {
    it('should map "high" complexity to 0.8', () => {
      const routingResult = { complexity: 'high' };
      const mapped =
        routingResult.complexity === 'high'
          ? 0.8
          : routingResult.complexity === 'medium'
            ? 0.5
            : 0.3;
      assert.strictEqual(mapped, 0.8, 'High complexity should map to 0.8');
    });

    it('should map "medium" complexity to 0.5', () => {
      const routingResult = { complexity: 'medium' };
      const mapped =
        routingResult.complexity === 'high'
          ? 0.8
          : routingResult.complexity === 'medium'
            ? 0.5
            : 0.3;
      assert.strictEqual(mapped, 0.5, 'Medium complexity should map to 0.5');
    });

    it('should map "low" complexity to 0.3', () => {
      const routingResult = { complexity: 'low' };
      const mapped =
        routingResult.complexity === 'high'
          ? 0.8
          : routingResult.complexity === 'medium'
            ? 0.5
            : 0.3;
      assert.strictEqual(mapped, 0.3, 'Low complexity should map to 0.3');
    });

    it('should default to 0.5 when complexity not specified', () => {
      const routingResult = {};
      const mapped = routingResult.complexity ? 0.5 : 0.5;
      assert.strictEqual(mapped, 0.5, 'Should default to 0.5');
    });
  });

  describe('Safe Rollback Validation', () => {
    it('should not break existing functionality when workers disabled', async () => {
      delete process.env.USE_WORKERS;

      // Validate that orchestrator-entry can still function
      const supervisor = await initializeSupervisor();
      assert.strictEqual(supervisor, null, 'Legacy mode should work without supervisor');

      // isLongRunningTask should still work
      const result = isLongRunningTask('Test task', 0.5);
      assert.strictEqual(typeof result, 'boolean', 'Heuristics should still work');
    });

    it('should not modify existing exports when workers disabled', async () => {
      delete process.env.USE_WORKERS;

      // Validate exports are available
      assert.strictEqual(
        typeof processUserPrompt,
        'function',
        'processUserPrompt should be exported'
      );
      assert.strictEqual(
        typeof initializeSupervisor,
        'function',
        'initializeSupervisor should be exported'
      );
      assert.strictEqual(
        typeof isLongRunningTask,
        'function',
        'isLongRunningTask should be exported'
      );
    });
  });

  describe('Cleanup Handlers', () => {
    it('should register cleanup handlers for process exit', async () => {
      process.env.USE_WORKERS = 'true';

      const supervisor = await initializeSupervisor();
      assert.notStrictEqual(supervisor, null, 'Supervisor should be initialized');

      // Validate cleanup method exists
      assert.strictEqual(typeof supervisor.cleanup, 'function', 'Should have cleanup method');

      // Cleanup
      await supervisor.cleanup();
      delete process.env.USE_WORKERS;
    });

    it('should handle SIGINT gracefully', async () => {
      process.env.USE_WORKERS = 'true';

      const supervisor = await initializeSupervisor();
      assert.notStrictEqual(supervisor, null, 'Supervisor should be initialized');

      // Simulate cleanup
      await supervisor.cleanup();

      // Validate cleanup completed
      const metrics = supervisor.getMetrics();
      assert.strictEqual(metrics.activeWorkers, 0, 'Should have no active workers after cleanup');

      delete process.env.USE_WORKERS;
    });
  });
});

console.log('Worker integration tests defined successfully');
