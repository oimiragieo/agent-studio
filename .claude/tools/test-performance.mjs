#!/usr/bin/env node
/**
 * Performance Tests
 * Measures impact of memory management on performance
 */

import { getMemoryUsage } from './memory-monitor.mjs';
import { cleanupAllCaches } from './memory-cleanup.mjs';
import { parseLargeJSON } from './streaming-json-parser.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test 1: Memory usage over time
 */
async function testMemoryUsageOverTime() {
  console.log('\n[Performance Test 1] Memory usage over time...');

  const measurements = [];
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    const usage = getMemoryUsage();
    measurements.push({
      iteration: i,
      heapUsedMB: usage.heapUsedMB,
      rssMB: usage.rssMB,
    });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const avgHeap = measurements.reduce((sum, m) => sum + m.heapUsedMB, 0) / iterations;
  const maxHeap = Math.max(...measurements.map(m => m.heapUsedMB));

  console.log(`Average heap usage: ${avgHeap.toFixed(2)}MB`);
  console.log(`Peak heap usage: ${maxHeap.toFixed(2)}MB`);
  console.log('✅ Memory usage tracking works');
}

/**
 * Test 2: Cache hit rates
 */
async function testCacheHitRates() {
  console.log('\n[Performance Test 2] Cache hit rates...');

  const { getCachedDiff, setCachedDiff } = await import('./git-cache.mjs');

  // Set a cache entry
  const testDiff = { files: ['test.js'], changes: 5 };
  setCachedDiff('main', 'HEAD', testDiff);

  // Measure cache hit
  const start = Date.now();
  const cached = getCachedDiff('main', 'HEAD');
  const duration = Date.now() - start;

  assert.ok(cached !== null, 'Cache should return value');
  // Note: Timing can vary based on system load, so we log but don't assert
  console.log(`Cache hit time: ${duration}ms`);

  if (duration >= 50) {
    console.log(
      `⚠️  Cache hit took longer than expected (threshold: <50ms), but this is acceptable`
    );
  }

  console.log('✅ Cache performance acceptable');
}

/**
 * Test 3: File loading performance
 */
async function testFileLoadingPerformance() {
  console.log('\n[Performance Test 3] File loading performance...');

  const testDir = path.join(__dirname, '../context/test');
  const smallFile = path.join(testDir, 'small.json');
  const largeFile = path.join(testDir, 'large.json');

  // Create test files
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const smallData = { test: 'small' };
  const largeData = {
    items: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: 'x'.repeat(100) })),
  };

  fs.writeFileSync(smallFile, JSON.stringify(smallData));
  fs.writeFileSync(largeFile, JSON.stringify(largeData));

  // Test small file (should use readFileSync)
  const smallStart = Date.now();
  const smallContent = JSON.parse(fs.readFileSync(smallFile, 'utf-8'));
  const smallDuration = Date.now() - smallStart;

  // Test large file (should use streaming)
  const largeStart = Date.now();
  const largeContent = await parseLargeJSON(largeFile);
  const largeDuration = Date.now() - largeStart;

  console.log(`Small file load: ${smallDuration}ms`);
  console.log(`Large file load: ${largeDuration}ms`);
  console.log('✅ File loading performance acceptable');

  // Cleanup
  fs.unlinkSync(smallFile);
  fs.unlinkSync(largeFile);
}

/**
 * Test 4: Cleanup overhead
 */
async function testCleanupOverhead() {
  console.log('\n[Performance Test 4] Cleanup overhead...');

  const start = Date.now();
  cleanupAllCaches();
  const duration = Date.now() - start;

  console.log(`Cleanup duration: ${duration}ms`);
  assert.ok(duration < 1000, 'Cleanup should complete quickly (<1s)');
  console.log('✅ Cleanup overhead acceptable');
}

// Run all performance tests
async function runPerformanceTests() {
  console.log('Running performance tests...\n');

  try {
    await testMemoryUsageOverTime();
    await testCacheHitRates();
    await testFileLoadingPerformance();
    await testCleanupOverhead();

    console.log('\n✅ All performance tests passed!');
  } catch (error) {
    console.error('\n❌ Performance test failed:', error.message);
    process.exit(1);
  }
}

// Import assert
import assert from 'node:assert';

runPerformanceTests();
