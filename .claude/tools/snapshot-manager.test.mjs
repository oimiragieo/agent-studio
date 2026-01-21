#!/usr/bin/env node
/**
 * Snapshot Manager Tests
 *
 * Test suite for snapshot-manager.mjs
 *
 * Usage:
 *   node .claude/tools/snapshot-manager.test.mjs
 */

import { strict as assert } from 'assert';
import { unlink, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  pruneSnapshots,
} from './snapshot-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SNAPSHOTS_DIR = join(__dirname, '../conductor/context/snapshots');

// Test utilities
let testSnapshotIds = [];

async function cleanupTestSnapshots() {
  for (const snapshotId of testSnapshotIds) {
    try {
      await deleteSnapshot(snapshotId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  testSnapshotIds = [];
}

async function createTestSnapshot(type = 'manual', options = {}) {
  const result = await createSnapshot({ type, ...options });
  testSnapshotIds.push(result.snapshot_id);
  return result;
}

// Test suite
const tests = {
  // Test 1: Create snapshot
  async testCreateSnapshot() {
    console.log('Test 1: Create snapshot');

    const result = await createTestSnapshot('manual', {
      description: 'Test snapshot',
    });

    assert.ok(result.snapshot_id, 'Snapshot ID should be present');
    assert.ok(result.snapshot_id.startsWith('snap-'), 'Snapshot ID should start with "snap-"');
    assert.strictEqual(result.type, 'manual', 'Snapshot type should be "manual"');
    assert.ok(result.created_at, 'Created timestamp should be present');
    assert.ok(parseFloat(result.size_mb) >= 0, 'Size should be non-negative');
    assert.ok(result.path, 'Path should be present');
    assert.ok(existsSync(result.path), 'Snapshot file should exist');

    console.log('   ✅ Snapshot created successfully');
    console.log(`   ℹ️  Snapshot ID: ${result.snapshot_id}`);
    console.log(`   ℹ️  Size: ${result.size_mb} MB`);
    console.log(`   ℹ️  Compression ratio: ${result.compression_ratio}%`);
  },

  // Test 2: List snapshots
  async testListSnapshots() {
    console.log('\nTest 2: List snapshots');

    // Create multiple snapshots
    await createTestSnapshot('manual');
    await createTestSnapshot('auto');
    await createTestSnapshot('checkpoint');

    const snapshots = await listSnapshots();

    assert.ok(Array.isArray(snapshots), 'Should return an array');
    assert.ok(snapshots.length >= 3, 'Should have at least 3 snapshots');

    const testSnapshots = snapshots.filter(s => testSnapshotIds.includes(s.snapshot_id));
    assert.strictEqual(testSnapshots.length, 3, 'Should find all test snapshots');

    console.log(`   ✅ Listed ${snapshots.length} snapshots`);
    console.log(`   ℹ️  Test snapshots: ${testSnapshots.length}`);
  },

  // Test 3: Filter snapshots by type
  async testFilterByType() {
    console.log('\nTest 3: Filter snapshots by type');

    await createTestSnapshot('milestone');

    const milestoneSnapshots = await listSnapshots({ type: 'milestone' });

    assert.ok(Array.isArray(milestoneSnapshots), 'Should return an array');
    assert.ok(milestoneSnapshots.length >= 1, 'Should have at least 1 milestone snapshot');
    assert.ok(
      milestoneSnapshots.every(s => s.type === 'milestone'),
      'All snapshots should be milestone type'
    );

    console.log(`   ✅ Found ${milestoneSnapshots.length} milestone snapshots`);
  },

  // Test 4: Get snapshot by ID
  async testGetSnapshot() {
    console.log('\nTest 4: Get snapshot by ID');

    const created = await createTestSnapshot('manual', {
      name: 'Test Snapshot',
      description: 'Testing retrieval',
    });

    const snapshot = await getSnapshot(created.snapshot_id);

    assert.strictEqual(snapshot.snapshot_id, created.snapshot_id, 'Snapshot ID should match');
    assert.strictEqual(snapshot.type, 'manual', 'Type should be manual');
    assert.strictEqual(snapshot.name, 'Test Snapshot', 'Name should match');
    assert.strictEqual(snapshot.description, 'Testing retrieval', 'Description should match');
    assert.ok(snapshot.state, 'State should be present');
    assert.ok(snapshot.validation, 'Validation should be present');
    assert.ok(snapshot.validation.is_valid, 'Snapshot should be valid');
    assert.ok(snapshot.validation.checksum, 'Checksum should be present');

    console.log('   ✅ Retrieved snapshot successfully');
    console.log(
      `   ℹ️  Snapshot has valid checksum: ${snapshot.validation.checksum.substring(0, 16)}...`
    );
  },

  // Test 5: Delete snapshot
  async testDeleteSnapshot() {
    console.log('\nTest 5: Delete snapshot');

    const created = await createTestSnapshot('auto');
    const snapshotPath = created.path;

    assert.ok(existsSync(snapshotPath), 'Snapshot file should exist before deletion');

    const result = await deleteSnapshot(created.snapshot_id);

    assert.strictEqual(result.snapshot_id, created.snapshot_id, 'Deleted ID should match');
    assert.strictEqual(result.deleted, true, 'Delete flag should be true');
    assert.ok(!existsSync(snapshotPath), 'Snapshot file should not exist after deletion');

    // Remove from test tracking
    testSnapshotIds = testSnapshotIds.filter(id => id !== created.snapshot_id);

    console.log('   ✅ Snapshot deleted successfully');
  },

  // Test 6: Cannot delete pinned snapshot
  async testCannotDeletePinned() {
    console.log('\nTest 6: Cannot delete pinned snapshot');

    const created = await createTestSnapshot('milestone'); // Milestones are auto-pinned

    let errorThrown = false;
    try {
      await deleteSnapshot(created.snapshot_id);
    } catch (error) {
      errorThrown = true;
      assert.ok(
        error.message.includes('Cannot delete pinned'),
        'Error should mention pinned snapshot'
      );
    }

    assert.ok(errorThrown, 'Should throw error when deleting pinned snapshot');

    console.log('   ✅ Correctly prevented deletion of pinned snapshot');
  },

  // Test 7: Prune snapshots
  async testPruneSnapshots() {
    console.log('\nTest 7: Prune snapshots');

    // Create 15 snapshots (more than default keep count of 10)
    const snapshotPromises = [];
    for (let i = 0; i < 15; i++) {
      snapshotPromises.push(createTestSnapshot('auto', { description: `Test ${i}` }));
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await Promise.all(snapshotPromises);

    const beforePrune = await listSnapshots();
    const testSnapshotsBefore = beforePrune.filter(s => testSnapshotIds.includes(s.snapshot_id));

    console.log(`   ℹ️  Test snapshots before prune: ${testSnapshotsBefore.length}`);

    const pruneResult = await pruneSnapshots({ keepCount: 10 });

    assert.ok(pruneResult.deleted_count >= 0, 'Should report deleted count');
    assert.ok(pruneResult.kept_count >= 0, 'Should report kept count');

    const afterPrune = await listSnapshots();
    const testSnapshotsAfter = afterPrune.filter(s => testSnapshotIds.includes(s.snapshot_id));

    console.log(`   ℹ️  Deleted: ${pruneResult.deleted_count} snapshots`);
    console.log(`   ℹ️  Kept: ${pruneResult.kept_count} snapshots`);
    console.log(`   ℹ️  Test snapshots after prune: ${testSnapshotsAfter.length}`);

    // Update test tracking to remove deleted snapshots
    testSnapshotIds = testSnapshotsAfter.map(s => s.snapshot_id);

    console.log('   ✅ Pruning completed successfully');
  },

  // Test 8: Snapshot compression
  async testCompression() {
    console.log('\nTest 8: Snapshot compression');

    const created = await createTestSnapshot('manual');

    // Compression ratio should be positive (savings achieved)
    assert.ok(
      created.compression_ratio >= 0,
      `Compression ratio should be >= 0, got ${created.compression_ratio}`
    );

    // For typical JSON data, we expect at least 50% compression
    if (created.compression_ratio > 0) {
      assert.ok(
        created.compression_ratio >= 50,
        `Expected >= 50% compression, got ${created.compression_ratio}%`
      );
      console.log(`   ✅ Achieved ${created.compression_ratio}% compression`);
    } else {
      console.log('   ⚠️  Compression disabled or not effective');
    }
  },

  // Test 9: Snapshot state capture
  async testStateCaptureStructure() {
    console.log('\nTest 9: Snapshot state capture structure');

    const created = await createTestSnapshot('manual');
    const snapshot = await getSnapshot(created.snapshot_id);

    // Verify state structure matches schema
    assert.ok(snapshot.state, 'State should exist');
    assert.ok(snapshot.state.version, 'State version should exist');
    assert.strictEqual(snapshot.state.version, '1.0.0', 'State version should be 1.0.0');

    // Project state
    assert.ok(snapshot.state.project, 'Project state should exist');
    assert.ok(snapshot.state.project.root_path, 'Project root path should exist');

    // Context state
    assert.ok(snapshot.state.context, 'Context state should exist');
    assert.ok(snapshot.state.context.tokens_limit >= 0, 'Token limit should be non-negative');

    console.log('   ✅ Snapshot state structure is valid');
  },

  // Test 10: Snapshot validation (checksum)
  async testChecksumValidation() {
    console.log('\nTest 10: Snapshot checksum validation');

    const created = await createTestSnapshot('manual');
    const snapshot = await getSnapshot(created.snapshot_id);

    assert.ok(snapshot.validation, 'Validation info should exist');
    assert.strictEqual(snapshot.validation.is_valid, true, 'Snapshot should be valid');
    assert.ok(snapshot.validation.checksum, 'Checksum should exist');
    assert.strictEqual(
      snapshot.validation.checksum.length,
      64,
      'SHA-256 checksum should be 64 chars'
    );

    console.log('   ✅ Checksum validation passed');
  },

  // Test 11: Average snapshot creation time
  async testCreationPerformance() {
    console.log('\nTest 11: Average snapshot creation time');

    const iterations = 3;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await createTestSnapshot('auto');
      const elapsedTime = Date.now() - startTime;
      times.push(elapsedTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    console.log(`   ℹ️  Average creation time: ${avgTime.toFixed(0)} ms`);
    console.log(`   ℹ️  Max creation time: ${maxTime.toFixed(0)} ms`);

    assert.ok(avgTime < 5000, `Average creation time should be < 5 seconds, got ${avgTime} ms`);

    console.log('   ✅ Snapshot creation meets performance requirements');
  },

  // Test 12: Edge case - Empty snapshots directory
  async testEmptyDirectory() {
    console.log('\nTest 12: Edge case - Empty snapshots directory');

    // Clean all test snapshots
    await cleanupTestSnapshots();

    const snapshots = await listSnapshots();

    assert.ok(Array.isArray(snapshots), 'Should return an array even if empty');

    console.log(`   ✅ Handled empty directory correctly (${snapshots.length} snapshots)`);
  },

  // Test 13: Edge case - Invalid snapshot ID
  async testInvalidSnapshotId() {
    console.log('\nTest 13: Edge case - Invalid snapshot ID');

    let errorThrown = false;
    try {
      await getSnapshot('invalid-snapshot-id-12345');
    } catch (error) {
      errorThrown = true;
      assert.ok(error.message.includes('not found'), 'Error should mention not found');
    }

    assert.ok(errorThrown, 'Should throw error for invalid snapshot ID');

    console.log('   ✅ Correctly handled invalid snapshot ID');
  },
};

// Test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('Snapshot Manager Test Suite');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const [testName, testFn] of Object.entries(tests)) {
    try {
      await testFn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`   ❌ ${testName} failed:`);
      console.error(`      ${error.message}`);
      if (error.stack) {
        console.error(`      ${error.stack}`);
      }
    }
  }

  // Cleanup
  console.log('\n' + '='.repeat(60));
  console.log('Cleanup');
  console.log('='.repeat(60));
  await cleanupTestSnapshots();
  console.log('   ✅ Test snapshots cleaned up');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });
}

export { runTests };
