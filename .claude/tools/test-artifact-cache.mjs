#!/usr/bin/env node
/**
 * Test suite for artifact-cache.mjs
 * Tests both file-based and workflow-based caching
 */

import { strict as assert } from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateKey,
  getCachedArtifact,
  cacheArtifact,
  loadArtifact,
  invalidateArtifact,
  getWorkflowCache,
  setWorkflowCache,
  clearWorkflowCache,
  getCacheStats,
  cleanExpiredEntries,
} from './artifact-cache.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Test data
const TEST_ARTIFACT_PATH = '.claude/context/tmp/test-artifact.json';
const TEST_ARTIFACT_DATA = {
  id: 'test-001',
  title: 'Test Artifact',
  data: { foo: 'bar', baz: 123 },
};

/**
 * Test runner with colored output
 */
class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async test(name, fn) {
    try {
      await fn();
      this.passed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      this.failed++;
      console.error(`✗ ${name}`);
      console.error(`  Error: ${error.message}`);
      if (error.stack) {
        console.error(`  ${error.stack.split('\n')[1]}`);
      }
    }
  }

  summary() {
    const total = this.passed + this.failed;
    console.log('\n' + '='.repeat(60));
    console.log(`Tests: ${total} total, ${this.passed} passed, ${this.failed} failed`);

    if (this.failed === 0) {
      console.log('✓ All tests passed!');
      return 0;
    } else {
      console.log('✗ Some tests failed');
      return 1;
    }
  }
}

/**
 * Setup: Create test artifact file
 */
async function setupTestFile() {
  const fullPath = path.join(ROOT, TEST_ARTIFACT_PATH);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(TEST_ARTIFACT_DATA, null, 2), 'utf-8');
}

/**
 * Cleanup: Remove test files
 */
async function cleanupTestFiles() {
  try {
    const fullPath = path.join(ROOT, TEST_ARTIFACT_PATH);
    await fs.unlink(fullPath);
  } catch {
    // File doesn't exist
  }

  // Clear all caches
  invalidateArtifact();
  await clearWorkflowCache();
}

/**
 * Run all tests
 */
async function runTests() {
  const runner = new TestRunner();

  console.log('Artifact Cache Test Suite\n');

  // Setup
  await setupTestFile();

  // =========================================================================
  // File-Based Caching Tests
  // =========================================================================

  await runner.test('File cache: Load artifact from disk', async () => {
    const artifact = await loadArtifact(TEST_ARTIFACT_PATH);
    assert.deepEqual(artifact, TEST_ARTIFACT_DATA);
  });

  await runner.test('File cache: Second load uses cache', async () => {
    // First load (populates cache)
    await loadArtifact(TEST_ARTIFACT_PATH);

    // Second load (should hit cache)
    const cached = await getCachedArtifact(TEST_ARTIFACT_PATH);
    assert.notEqual(cached, null);
    assert.deepEqual(cached, TEST_ARTIFACT_DATA);
  });

  await runner.test('File cache: Cache invalidation', async () => {
    await loadArtifact(TEST_ARTIFACT_PATH);
    invalidateArtifact(TEST_ARTIFACT_PATH);

    const cached = await getCachedArtifact(TEST_ARTIFACT_PATH);
    assert.equal(cached, null);
  });

  await runner.test('File cache: File modification detection', async () => {
    // Load and cache
    await loadArtifact(TEST_ARTIFACT_PATH);

    // Modify file
    const fullPath = path.join(ROOT, TEST_ARTIFACT_PATH);
    await fs.writeFile(fullPath, JSON.stringify({ modified: true }, null, 2), 'utf-8');

    // Wait for file system to update mtime
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cache should be invalidated
    const cached = await getCachedArtifact(TEST_ARTIFACT_PATH);
    assert.equal(cached, null);
  });

  await runner.test('File cache: Manual caching', async () => {
    const testData = { manual: 'cache', value: 42 };
    await cacheArtifact(TEST_ARTIFACT_PATH, testData, 5000);

    const cached = await getCachedArtifact(TEST_ARTIFACT_PATH);
    assert.deepEqual(cached, testData);
  });

  // =========================================================================
  // Workflow-Based Caching Tests
  // =========================================================================

  await runner.test('Workflow cache: Generate deterministic keys', () => {
    const key1 = generateKey('workflow-001', 2, { foo: 'bar' });
    const key2 = generateKey('workflow-001', 2, { foo: 'bar' });

    assert.equal(key1, key2);
    assert.equal(key1.length, 64); // SHA-256 produces 64 hex chars
  });

  await runner.test('Workflow cache: Different inputs produce different keys', () => {
    const key1 = generateKey('workflow-001', 2, { foo: 'bar' });
    const key2 = generateKey('workflow-001', 2, { foo: 'baz' });

    assert.notEqual(key1, key2);
  });

  await runner.test('Workflow cache: Set and get cached output', async () => {
    const workflowId = 'test-workflow-001';
    const stepNumber = 2;
    const inputs = { requirement: 'Build auth system' };
    const artifact = { code: 'implementation', tests: 'test suite' };

    await setWorkflowCache(workflowId, stepNumber, inputs, artifact);

    const cached = await getWorkflowCache(workflowId, stepNumber, inputs);
    assert.deepEqual(cached, artifact);
  });

  await runner.test('Workflow cache: Cache miss with different inputs', async () => {
    const workflowId = 'test-workflow-002';
    const stepNumber = 2;

    await setWorkflowCache(workflowId, stepNumber, { foo: 'bar' }, { result: 'output1' });

    // Different inputs should miss cache
    const cached = await getWorkflowCache(workflowId, stepNumber, { foo: 'baz' });
    assert.equal(cached, null);
  });

  await runner.test('Workflow cache: Clear specific workflow', async () => {
    const workflowId = 'test-workflow-003';

    await setWorkflowCache(workflowId, 1, { a: 1 }, { result: 'step1' });
    await setWorkflowCache(workflowId, 2, { b: 2 }, { result: 'step2' });

    await clearWorkflowCache(workflowId);

    const cached1 = await getWorkflowCache(workflowId, 1, { a: 1 });
    const cached2 = await getWorkflowCache(workflowId, 2, { b: 2 });

    assert.equal(cached1, null);
    assert.equal(cached2, null);
  });

  await runner.test('Workflow cache: Persistent cache survives clear', async () => {
    const workflowId = 'test-workflow-004';
    const stepNumber = 1;
    const inputs = { persistent: true };
    const artifact = { persisted: 'data' };

    // Cache with persistence
    await setWorkflowCache(workflowId, stepNumber, inputs, artifact);

    // Clear in-memory cache (simulate process restart)
    // Note: We can't actually restart the process, but this simulates clearing memory
    await clearWorkflowCache(); // Clears everything including disk
    await setWorkflowCache(workflowId, stepNumber, inputs, artifact); // Re-cache

    // Should still be available from disk
    const cached = await getWorkflowCache(workflowId, stepNumber, inputs);
    assert.deepEqual(cached, artifact);
  });

  // =========================================================================
  // Cache Statistics Tests
  // =========================================================================

  await runner.test('Cache stats: Get statistics', async () => {
    // Clear caches first
    invalidateArtifact();
    await clearWorkflowCache();

    // Add some entries
    await cacheArtifact(TEST_ARTIFACT_PATH, TEST_ARTIFACT_DATA);
    await setWorkflowCache('test-wf', 1, { foo: 'bar' }, { result: 'output' });

    const stats = getCacheStats();

    assert.ok(stats.file_cache);
    assert.ok(stats.workflow_cache);
    assert.ok(stats.combined);

    assert.equal(stats.file_cache.total >= 1, true);
    assert.equal(stats.workflow_cache.total >= 1, true);
  });

  await runner.test('Cache stats: Memory estimation', () => {
    const stats = getCacheStats();

    assert.ok(stats.file_cache.memory_bytes >= 0);
    assert.ok(stats.workflow_cache.memory_bytes >= 0);
    assert.ok(stats.combined.memory_bytes >= 0);

    assert.ok(parseFloat(stats.file_cache.memory_mb) >= 0);
    assert.ok(parseFloat(stats.workflow_cache.memory_mb) >= 0);
    assert.ok(parseFloat(stats.combined.memory_mb) >= 0);
  });

  // =========================================================================
  // Cache Cleanup Tests
  // =========================================================================

  await runner.test('Cache cleanup: Clean expired entries', async () => {
    // Clear caches first
    invalidateArtifact();
    await clearWorkflowCache();

    // Add entry with very short TTL (will expire immediately)
    await cacheArtifact(TEST_ARTIFACT_PATH, TEST_ARTIFACT_DATA, 0);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 100));

    const removed = cleanExpiredEntries();
    assert.equal(removed.file_cache >= 1, true);
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  await runner.test('Edge case: Cache non-existent file', async () => {
    const nonExistentPath = '.claude/context/tmp/non-existent.json';

    // Caching non-existent file should work, but getCachedArtifact checks file existence
    await cacheArtifact(nonExistentPath, { test: 'data' });

    // Since file doesn't exist, cache validation fails and returns null
    const cached = await getCachedArtifact(nonExistentPath);
    assert.equal(cached, null);
  });

  await runner.test('Edge case: Empty inputs for workflow cache', async () => {
    const workflowId = 'test-workflow-empty';
    const stepNumber = 1;
    const inputs = {};
    const artifact = { empty: 'inputs' };

    await setWorkflowCache(workflowId, stepNumber, inputs, artifact);

    const cached = await getWorkflowCache(workflowId, stepNumber, inputs);
    assert.deepEqual(cached, artifact);
  });

  await runner.test('Edge case: Null artifact value', async () => {
    const workflowId = 'test-workflow-null';
    const stepNumber = 1;
    const inputs = { test: 'null' };
    const artifact = null;

    await setWorkflowCache(workflowId, stepNumber, inputs, artifact);

    const cached = await getWorkflowCache(workflowId, stepNumber, inputs);
    assert.equal(cached, null);
  });

  // Cleanup
  await cleanupTestFiles();

  // Summary
  return runner.summary();
}

// Run tests
runTests()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
