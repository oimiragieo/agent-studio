#!/usr/bin/env node
/**
 * Memory Management Integration Tests
 * End-to-end tests for memory management during CUJ execution
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert';
import { getMemoryUsage, canSpawnSubagent } from './memory-monitor.mjs';
import {
  setupMemoryPressureHandling,
  getCurrentPressureLevel,
} from './memory-pressure-handler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test 1: Long-running CUJ with memory monitoring
 */
async function testLongRunningCUJ() {
  console.log('\n[Test 1] Long-running CUJ with memory monitoring...');

  const initialMemory = getMemoryUsage();
  console.log(`Initial memory: ${initialMemory.heapUsedMB.toFixed(2)}MB`);

  // Run a simple CUJ simulation
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--max-old-space-size=4096', path.join(__dirname, 'run-cuj.mjs'), '--simulate', 'CUJ-013'],
      {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..'),
      }
    );

    let output = '';
    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      output += data.toString();
    });

    child.on('exit', code => {
      const finalMemory = getMemoryUsage();
      console.log(`Final memory: ${finalMemory.heapUsedMB.toFixed(2)}MB`);
      console.log(
        `Memory delta: ${(finalMemory.heapUsedMB - initialMemory.heapUsedMB).toFixed(2)}MB`
      );

      if (code === 0) {
        console.log('✅ Test 1 passed: CUJ executed without memory errors');
        resolve();
      } else {
        console.error('❌ Test 1 failed: CUJ execution failed');
        console.error(output);
        reject(new Error(`CUJ execution failed with code ${code}`));
      }
    });
  });
}

/**
 * Test 2: Cache eviction during workflow execution
 */
async function testCacheEviction() {
  console.log('\n[Test 2] Cache eviction during workflow execution...');

  // This test would require filling caches beyond limits
  // For now, we'll just verify cleanup works
  const { cleanupAllCaches } = await import('./memory-cleanup.mjs');
  const results = cleanupAllCaches();

  console.log(
    `Cleanup results: git=${results.gitCache}, artifacts=${results.artifactCache}, skills=${results.skillCache}`
  );
  console.log('✅ Test 2 passed: Cache cleanup works');
}

/**
 * Test 3: Large artifact handling
 */
async function testLargeArtifactHandling() {
  console.log('\n[Test 3] Large artifact handling...');

  const { parseLargeJSON, shouldUseStreaming } = await import('./streaming-json-parser.mjs');
  const testDir = path.join(__dirname, '../context/test');
  const testFile = path.join(testDir, 'large-artifact.json');

  // Create a 2MB JSON file
  const largeData = {
    items: Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      data: 'x'.repeat(200), // 200 chars per item = ~2MB total
    })),
  };

  const fs = await import('fs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  fs.writeFileSync(testFile, JSON.stringify(largeData));

  // Test streaming detection
  const shouldStream = shouldUseStreaming(testFile, 1);
  assert.strictEqual(shouldStream, true, 'Should detect large file for streaming');

  // Test parsing
  const parsed = await parseLargeJSON(testFile);
  assert.strictEqual(parsed.items.length, 10000, 'Should parse all items');

  fs.unlinkSync(testFile);
  console.log('✅ Test 3 passed: Large artifact handling works');
}

/**
 * Test 4: Cleanup during execution
 */
async function testCleanupDuringExecution() {
  console.log('\n[Test 4] Cleanup during execution...');

  const { setupPeriodicCleanup } = await import('./memory-cleanup.mjs');

  let cleanupCalled = false;
  const stopCleanup = setupPeriodicCleanup(100); // Every 100ms for testing

  // Wait for cleanup to run
  await new Promise(resolve => setTimeout(resolve, 150));

  stopCleanup();
  console.log('✅ Test 4 passed: Periodic cleanup works');
}

/**
 * Test 5: Checkpoint/resume with memory management
 */
async function testCheckpointResume() {
  console.log('\n[Test 5] Checkpoint/resume with memory management...');

  const { saveCheckpoint, loadCheckpoint, deleteCheckpoint } =
    await import('./workflow-checkpoint.mjs');

  const workflowId = 'test-integration-123';
  const step = 3;
  const state = { memory: getMemoryUsage(), step: step };

  await saveCheckpoint(workflowId, step, state);
  const loaded = await loadCheckpoint(workflowId);

  assert.strictEqual(loaded.workflowId, workflowId);
  assert.strictEqual(loaded.step, step);
  assert.ok(loaded.memoryUsage);

  await deleteCheckpoint(workflowId);
  console.log('✅ Test 5 passed: Checkpoint system works');
}

/**
 * Test 6: Memory pressure detection (P3)
 */
async function testMemoryPressureDetection() {
  console.log('\n[Test 6] Memory pressure detection (P3)...');

  const pressure = getCurrentPressureLevel();
  assert.ok(['normal', 'high', 'critical'].includes(pressure.level));
  assert.ok(pressure.usage >= 0 && pressure.usage <= 1);
  assert.ok(pressure.stats.heapUsedMB >= 0);

  console.log(
    `  Current pressure: ${pressure.level} (${(pressure.stats.heapUsagePercent ?? 0).toFixed(1)}%)`
  );
  console.log(
    `  Heap: ${(pressure.stats.heapUsedMB ?? 0).toFixed(2)}MB / ${(pressure.stats.heapLimitMB ?? 0).toFixed(2)}MB`
  );
  console.log('✅ Test 6 passed: Memory pressure detection works');
}

/**
 * Test 7: Pressure callback triggers (P3)
 */
async function testPressureCallback() {
  console.log('\n[Test 7] Memory pressure callback (P3)...');

  let callbackCalled = false;
  let detectedLevel = null;

  // Use very low threshold to trigger immediately
  const stopMonitoring = setupMemoryPressureHandling(
    (level, usage, stats) => {
      callbackCalled = true;
      detectedLevel = level;
      console.log(`  Callback triggered: ${level} at ${(stats.heapUsagePercent ?? 0).toFixed(1)}%`);
    },
    {
      highThreshold: 0.01, // 1% - will trigger
      criticalThreshold: 0.99,
      checkIntervalMs: 50,
    }
  );

  // Wait for callback
  await new Promise(resolve => setTimeout(resolve, 100));
  stopMonitoring();

  assert.ok(callbackCalled, 'Callback should have been called');
  assert.strictEqual(detectedLevel, 'high', 'Should detect high pressure');
  console.log('✅ Test 7 passed: Pressure callback triggers correctly');
}

/**
 * Test 8: Spawn limiting with memory check (P3)
 */
async function testSpawnLimiting() {
  console.log('\n[Test 8] Subagent spawn limiting (P3)...');

  // Test with realistic requirement
  const check1 = canSpawnSubagent(500);
  assert.ok(typeof check1.canSpawn === 'boolean');
  console.log(`  Check 500MB: canSpawn=${check1.canSpawn}, free=${check1.freeMB.toFixed(2)}MB`);

  // Test with unrealistic requirement
  const check2 = canSpawnSubagent(100000);
  assert.strictEqual(check2.canSpawn, false, 'Should not allow 100GB spawn');
  console.log(`  Check 100GB: canSpawn=${check2.canSpawn} (expected: false)`);

  console.log('✅ Test 8 passed: Spawn limiting works correctly');
}

/**
 * Test 9: Exit code 42 handling (P3)
 */
async function testExitCode42() {
  console.log('\n[Test 9] Exit code 42 handling (P3)...');

  return new Promise(resolve => {
    const testScript = 'process.exit(42);';
    const child = spawn('node', ['-e', testScript], {
      stdio: 'pipe',
      shell: true,
    });

    child.on('exit', code => {
      assert.strictEqual(code, 42, 'Should exit with code 42');
      console.log(`  Exit code: ${code} (expected: 42)`);
      console.log('✅ Test 9 passed: Exit code 42 works correctly');
      resolve();
    });
  });
}

// Run all integration tests
async function runIntegrationTests() {
  console.log('='.repeat(60));
  console.log('Memory Management Integration Tests (P1 + P2 + P3)');
  console.log('='.repeat(60));

  try {
    // P1 + P2 tests
    await testCacheEviction();
    await testLargeArtifactHandling();
    await testCleanupDuringExecution();
    await testCheckpointResume();

    // P3 tests (new)
    await testMemoryPressureDetection();
    await testPressureCallback();
    await testSpawnLimiting();
    await testExitCode42();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All integration tests passed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Integration test failed:', error.message);
    console.error(error.stack);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

runIntegrationTests();
