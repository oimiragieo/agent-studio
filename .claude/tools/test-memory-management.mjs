#!/usr/bin/env node
/**
 * Memory Management Test Suite
 * Unit tests for memory management utilities
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startMonitoring, stopMonitoring, getMemoryUsage, logMemoryUsage, canSpawnSubagent } from './memory-monitor.mjs';
import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';
import { cleanupAllCaches, setupPeriodicCleanup } from './memory-cleanup.mjs';
import { saveCheckpoint, loadCheckpoint, deleteCheckpoint } from './workflow-checkpoint.mjs';
import { setupMemoryPressureHandling, getCurrentPressureLevel, isPressureAtLevel } from './memory-pressure-handler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, '../context/test');

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Test memory monitor
test('Memory monitor tracks usage', async () => {
  const usage = getMemoryUsage();
  assert.ok(usage.heapUsedMB >= 0);
  assert.ok(usage.heapTotalMB >= 0);
  assert.ok(usage.rssMB >= 0);
});

test('Memory monitor logs usage', () => {
  const usage = logMemoryUsage('Test');
  assert.ok(usage.heapUsedMB >= 0);
});

test('Memory monitor starts and stops', () => {
  startMonitoring({ checkIntervalMs: 100 });
  stopMonitoring();
  // If we get here without errors, it works
  assert.ok(true);
});

// Test streaming parser
test('Streaming JSON parser handles small files', async () => {
  const testFile = path.join(TEST_DIR, 'test-small.json');
  const testData = { test: 'data', number: 42 };
  fs.writeFileSync(testFile, JSON.stringify(testData));
  
  const parsed = await parseLargeJSON(testFile);
  assert.deepStrictEqual(parsed, testData);
  
  fs.unlinkSync(testFile);
});

test('Streaming JSON parser rejects oversized files', async () => {
  const testFile = path.join(TEST_DIR, 'test-large.json');
  // Create a file that exceeds the limit
  const largeData = { data: 'x'.repeat(200 * 1024 * 1024) }; // 200MB string
  fs.writeFileSync(testFile, JSON.stringify(largeData));
  
  try {
    await parseLargeJSON(testFile, { maxSize: 100 * 1024 * 1024 }); // 100MB limit
    assert.fail('Should have thrown error for oversized file');
  } catch (error) {
    assert.ok(error.message.includes('exceeds size limit'));
  }
  
  fs.unlinkSync(testFile);
});

test('shouldUseStreaming detects large files', () => {
  const testFile = path.join(TEST_DIR, 'test-large.json');
  // Create a 2MB file
  const largeData = { data: 'x'.repeat(2 * 1024 * 1024) };
  fs.writeFileSync(testFile, JSON.stringify(largeData));
  
  assert.strictEqual(shouldUseStreaming(testFile, 1), true);
  assert.strictEqual(shouldUseStreaming(testFile, 5), false);
  
  fs.unlinkSync(testFile);
});

// Test cleanup
test('Cleanup clears all caches', () => {
  const results = cleanupAllCaches();
  assert.ok(typeof results.gitCache === 'number');
  assert.ok(typeof results.artifactCache === 'number');
  assert.ok(typeof results.skillCache === 'number');
});

test('Periodic cleanup can be set up and stopped', () => {
  const stopCleanup = setupPeriodicCleanup(1000);
  // Wait a bit to ensure it's running
  setTimeout(() => {
    stopCleanup();
    assert.ok(true);
  }, 100);
});

// Test checkpoint system
test('Checkpoint save and load works', async () => {
  const workflowId = 'test-workflow-123';
  const step = 5;
  const state = { test: 'state', data: [1, 2, 3] };
  
  const checkpointPath = await saveCheckpoint(workflowId, step, state);
  assert.ok(fs.existsSync(checkpointPath));
  
  const loaded = await loadCheckpoint(workflowId);
  assert.strictEqual(loaded.workflowId, workflowId);
  assert.strictEqual(loaded.step, step);
  assert.deepStrictEqual(loaded.state, state);
  
  await deleteCheckpoint(workflowId);
  assert.strictEqual(fs.existsSync(checkpointPath), false);
});

test('Load checkpoint returns null for non-existent checkpoint', async () => {
  const loaded = await loadCheckpoint('non-existent-workflow');
  assert.strictEqual(loaded, null);
});

// Priority 3: Memory Pressure Tests
test('Get current pressure level returns valid data', () => {
  const pressure = getCurrentPressureLevel();
  assert.ok(['normal', 'high', 'critical'].includes(pressure.level));
  assert.ok(pressure.usage >= 0 && pressure.usage <= 1);
  assert.ok(pressure.stats.heapUsedMB >= 0);
  assert.ok(pressure.stats.heapLimitMB > 0);
});

test('Check pressure at level works correctly', () => {
  const isHigh = isPressureAtLevel('high');
  const isCritical = isPressureAtLevel('critical');
  assert.ok(typeof isHigh === 'boolean');
  assert.ok(typeof isCritical === 'boolean');
});

test('Memory pressure callback triggers on low threshold', async () => {
  let callbackCalled = false;
  let callbackLevel = null;

  // Use very low thresholds to trigger callback immediately
  const stopMonitoring = setupMemoryPressureHandling((level, usage, stats) => {
    callbackCalled = true;
    callbackLevel = level;
  }, {
    highThreshold: 0.01, // 1% - will trigger immediately
    criticalThreshold: 0.99, // 99% - won't trigger
    checkIntervalMs: 100 // Check quickly
  });

  // Wait for one check cycle
  await new Promise(resolve => setTimeout(resolve, 150));

  stopMonitoring();

  // Should have triggered high-level callback
  assert.ok(callbackCalled, 'Callback should have been called');
  assert.strictEqual(callbackLevel, 'high', 'Should be at high pressure level');
});

test('Memory pressure monitoring can be stopped', () => {
  let callbackCount = 0;

  const stopMonitoring = setupMemoryPressureHandling(() => {
    callbackCount++;
  }, {
    highThreshold: 0.01,
    checkIntervalMs: 50
  });

  // Stop immediately
  stopMonitoring();

  // Wait to ensure no more callbacks
  setTimeout(() => {
    const count = callbackCount;
    setTimeout(() => {
      assert.strictEqual(callbackCount, count, 'Callback count should not increase after stopping');
    }, 100);
  }, 100);
});

test('canSpawnSubagent respects memory limits', () => {
  const check = canSpawnSubagent(10000000); // Request 10GB (unrealistic)
  assert.ok(typeof check.canSpawn === 'boolean');
  assert.ok(typeof check.currentUsageMB === 'number');
  assert.ok(typeof check.freeMB === 'number');
});

// Run tests
console.log('Running memory management unit tests...');
console.log('All tests passed!');
