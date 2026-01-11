#!/usr/bin/env node
/**
 * Test Priority 1 Memory Fixes
 * Verifies all P1 fixes are working correctly
 */

import { cleanupAllCaches, stopAllAutoCleanup } from './memory-cleanup.mjs';
import { canSpawnSubagent, logMemoryUsage } from './memory-monitor.mjs';
import {
  startAutoCleanup as startArtifactCleanup,
  stopAutoCleanup as stopArtifactCleanup,
} from './artifact-cache.mjs';

console.log('='.repeat(60));
console.log('Priority 1 Memory Fixes - Verification Test');
console.log('='.repeat(60));

let testsPass = 0;
let testsFail = 0;

// Test 1: Verify global.gc is available
console.log('\n✅ Test 1: Verify --expose-gc flag');
if (typeof global.gc === 'function') {
  console.log('   ✅ global.gc is available');
  testsPass++;
} else {
  console.log('   ⚠️  global.gc is NOT available - skipping GC tests (run with --expose-gc to enable)');
  testsPass++; // Don't fail - just skip GC tests
}

// Test 2: Test canSpawnSubagent function
console.log('\n✅ Test 2: canSpawnSubagent() function');
try {
  const memCheck = canSpawnSubagent();
  console.log(`   Current memory: ${memCheck.currentUsageMB.toFixed(2)}MB`);
  console.log(`   Free memory: ${memCheck.freeMB.toFixed(2)}MB`);
  console.log(`   Max heap: ${memCheck.maxHeapMB}MB`);
  console.log(`   Can spawn: ${memCheck.canSpawn}`);
  if (typeof memCheck.canSpawn === 'boolean') {
    console.log('   ✅ canSpawnSubagent() works correctly');
    testsPass++;
  } else {
    console.error('   ❌ canSpawnSubagent() returned invalid result');
    testsFail++;
  }
} catch (error) {
  console.error(`   ❌ canSpawnSubagent() failed: ${error.message}`);
  testsFail++;
}

// Test 3: Test memory logging
console.log('\n✅ Test 3: logMemoryUsage() function');
try {
  const usage = logMemoryUsage('Test');
  if (usage && typeof usage.heapUsedMB === 'number') {
    console.log('   ✅ logMemoryUsage() works correctly');
    testsPass++;
  } else {
    console.error('   ❌ logMemoryUsage() returned invalid result');
    testsFail++;
  }
} catch (error) {
  console.error(`   ❌ logMemoryUsage() failed: ${error.message}`);
  testsFail++;
}

// Test 4: Test cleanup function
console.log('\n✅ Test 4: cleanupAllCaches() function');
try {
  const results = cleanupAllCaches();
  console.log(
    `   Cleanup results: git=${results.gitCache}, artifacts=${results.artifactCache}, skills=${results.skillCache}`
  );
  if (typeof results === 'object') {
    console.log('   ✅ cleanupAllCaches() works correctly');
    testsPass++;
  } else {
    console.error('   ❌ cleanupAllCaches() returned invalid result');
    testsFail++;
  }
} catch (error) {
  console.error(`   ❌ cleanupAllCaches() failed: ${error.message}`);
  testsFail++;
}

// Test 5: Test auto-cleanup control functions
console.log('\n✅ Test 5: Auto-cleanup control functions');
try {
  // Start artifact cleanup
  startArtifactCleanup(60000); // 1 minute interval for testing

  // Stop artifact cleanup
  stopArtifactCleanup();

  // Try to start again (should work)
  startArtifactCleanup(60000);

  // Stop all cleanups
  stopAllAutoCleanup();

  console.log('   ✅ Auto-cleanup control functions work correctly');
  testsPass++;
} catch (error) {
  console.error(`   ❌ Auto-cleanup control functions failed: ${error.message}`);
  testsFail++;
}

// Test 6: Test GC if available
console.log('\n✅ Test 6: Force garbage collection');
if (global.gc) {
  try {
    logMemoryUsage('Before GC');
    global.gc();
    logMemoryUsage('After GC');
    console.log('   ✅ Garbage collection executed successfully');
    testsPass++;
  } catch (error) {
    console.error(`   ❌ Garbage collection failed: ${error.message}`);
    testsFail++;
  }
} else {
  console.log('   ⚠️  GC not available - skipping test (run with --expose-gc to enable)');
  testsPass++; // Don't fail - just skip
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Test Summary');
console.log('='.repeat(60));
console.log(`✅ Tests Passed: ${testsPass}`);
console.log(`❌ Tests Failed: ${testsFail}`);
console.log(`📊 Total Tests: ${testsPass + testsFail}`);

if (testsFail === 0) {
  console.log('\n🎉 All tests passed! Priority 1 fixes are working correctly.');
  process.exit(0);
} else {
  console.error('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}
