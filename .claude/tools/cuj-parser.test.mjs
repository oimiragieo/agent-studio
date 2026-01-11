#!/usr/bin/env node
/**
 * Unit tests for CUJ Parser Module
 *
 * @module cuj-parser-test
 * @version 1.0.0
 *
 * Usage:
 *   node .claude/tools/cuj-parser.test.mjs
 */

import assert from 'assert';
import {
  loadRegistry,
  loadCUJMapping,
  normalizeExecutionMode,
  getCUJById,
  getCUJsByMode,
  getAllCUJIds,
  validateCUJStructure,
  cujDocExists,
  getValidationMetadata,
} from './cuj-parser.mjs';

// Test counter
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Run a test with assertion
 * @param {string} name - Test name
 * @param {Function} testFn - Async test function
 */
async function test(name, testFn) {
  testsRun++;
  try {
    await testFn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    if (process.env.DEBUG_TESTS) {
      console.error(error.stack);
    }
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('🧪 CUJ Parser Unit Tests\n');

  // Test: normalizeExecutionMode
  await test('normalizeExecutionMode - workflow', () => {
    assert.strictEqual(normalizeExecutionMode('workflow'), 'workflow');
    assert.strictEqual(normalizeExecutionMode('automated-workflow'), 'workflow');
    assert.strictEqual(normalizeExecutionMode('greenfield-fullstack.yaml'), 'workflow');
  });

  await test('normalizeExecutionMode - skill-only', () => {
    assert.strictEqual(normalizeExecutionMode('skill-only'), 'skill-only');
    assert.strictEqual(normalizeExecutionMode('delegated-skill'), 'skill-only');
    assert.strictEqual(normalizeExecutionMode('skill'), 'skill-only');
  });

  await test('normalizeExecutionMode - manual-setup', () => {
    assert.strictEqual(normalizeExecutionMode('manual-setup'), 'manual-setup');
    assert.strictEqual(normalizeExecutionMode('manual'), 'manual-setup');
  });

  await test('normalizeExecutionMode - null/undefined', () => {
    assert.strictEqual(normalizeExecutionMode(null), null);
    assert.strictEqual(normalizeExecutionMode(undefined), null);
    assert.strictEqual(normalizeExecutionMode(''), null);
  });

  // Test: loadRegistry
  await test('loadRegistry - returns valid registry', async () => {
    const registry = await loadRegistry();
    assert.ok(registry, 'Registry should exist');
    assert.ok(Array.isArray(registry.cujs), 'Registry should have cujs array');
    assert.ok(registry.cujs.length > 0, 'Registry should have at least one CUJ');
  });

  // Test: loadCUJMapping
  await test('loadCUJMapping - returns valid mapping', async () => {
    const mapping = await loadCUJMapping();
    assert.ok(mapping instanceof Map, 'Mapping should be a Map');
    assert.ok(mapping.size > 0, 'Mapping should have at least one entry');
  });

  await test('loadCUJMapping - entries have correct structure', async () => {
    const mapping = await loadCUJMapping();
    const firstEntry = mapping.values().next().value;
    assert.ok(firstEntry.hasOwnProperty('executionMode'), 'Entry should have executionMode');
    assert.ok(firstEntry.hasOwnProperty('workflowPath'), 'Entry should have workflowPath');
    assert.ok(firstEntry.hasOwnProperty('primarySkill'), 'Entry should have primarySkill');
  });

  // Test: getCUJById
  await test('getCUJById - finds valid CUJ', async () => {
    const cuj = await getCUJById('CUJ-001');
    assert.ok(cuj, 'CUJ-001 should exist');
    assert.strictEqual(cuj.id, 'CUJ-001', 'CUJ ID should match');
  });

  await test('getCUJById - returns null for invalid ID', async () => {
    const cuj = await getCUJById('CUJ-999');
    assert.strictEqual(cuj, null, 'Invalid CUJ should return null');
  });

  await test('getCUJById - combines registry and mapping data', async () => {
    const cuj = await getCUJById('CUJ-005');
    if (cuj) {
      assert.ok(cuj.id, 'CUJ should have id');
      assert.ok(cuj.name || cuj.execution_mode, 'CUJ should have name or execution_mode');
    }
  });

  // Test: getCUJsByMode
  await test('getCUJsByMode - workflow mode', async () => {
    const cujs = await getCUJsByMode('workflow');
    assert.ok(Array.isArray(cujs), 'Result should be an array');
    cujs.forEach(cuj => {
      const normalizedMode = normalizeExecutionMode(cuj.execution_mode);
      assert.strictEqual(normalizedMode, 'workflow', 'All CUJs should have workflow mode');
    });
  });

  await test('getCUJsByMode - skill-only mode', async () => {
    const cujs = await getCUJsByMode('skill-only');
    assert.ok(Array.isArray(cujs), 'Result should be an array');
    cujs.forEach(cuj => {
      const normalizedMode = normalizeExecutionMode(cuj.execution_mode);
      assert.strictEqual(normalizedMode, 'skill-only', 'All CUJs should have skill-only mode');
    });
  });

  await test('getCUJsByMode - manual-setup mode', async () => {
    const cujs = await getCUJsByMode('manual-setup');
    assert.ok(Array.isArray(cujs), 'Result should be an array');
  });

  // Test: getAllCUJIds
  await test('getAllCUJIds - returns array of IDs', async () => {
    const ids = await getAllCUJIds();
    assert.ok(Array.isArray(ids), 'Result should be an array');
    assert.ok(ids.length > 0, 'Should have at least one CUJ ID');
  });

  await test('getAllCUJIds - IDs are sorted', async () => {
    const ids = await getAllCUJIds();
    const sortedIds = [...ids].sort();
    assert.deepStrictEqual(ids, sortedIds, 'IDs should be sorted');
  });

  await test('getAllCUJIds - IDs match pattern', async () => {
    const ids = await getAllCUJIds();
    ids.forEach(id => {
      assert.match(id, /^CUJ-\d{3}$/, `ID should match pattern: ${id}`);
    });
  });

  // Test: validateCUJStructure
  await test('validateCUJStructure - valid CUJ', () => {
    const validCUJ = {
      id: 'CUJ-001',
      name: 'Test CUJ',
      execution_mode: 'workflow',
      workflow: 'test-workflow.yaml',
    };
    const result = validateCUJStructure(validCUJ);
    assert.strictEqual(result.valid, true, 'Valid CUJ should pass validation');
    assert.strictEqual(result.errors.length, 0, 'Valid CUJ should have no errors');
  });

  await test('validateCUJStructure - missing required fields', () => {
    const invalidCUJ = {
      name: 'Test CUJ',
      // Missing id and execution_mode
    };
    const result = validateCUJStructure(invalidCUJ);
    assert.strictEqual(result.valid, false, 'Invalid CUJ should fail validation');
    assert.ok(result.errors.length > 0, 'Invalid CUJ should have errors');
  });

  await test('validateCUJStructure - invalid execution mode', () => {
    const invalidCUJ = {
      id: 'CUJ-001',
      name: 'Test CUJ',
      execution_mode: 'invalid-mode',
    };
    const result = validateCUJStructure(invalidCUJ);
    assert.strictEqual(result.valid, false, 'Invalid execution mode should fail validation');
    assert.ok(
      result.errors.some(e => e.includes('Invalid execution mode')),
      'Should have execution mode error'
    );
  });

  await test('validateCUJStructure - workflow mode without workflow', () => {
    const cuj = {
      id: 'CUJ-001',
      name: 'Test CUJ',
      execution_mode: 'workflow',
      // Missing workflow field
    };
    const result = validateCUJStructure(cuj);
    assert.ok(
      result.warnings.some(w => w.includes('no workflow specified')),
      'Should warn about missing workflow'
    );
  });

  await test('validateCUJStructure - skill-only mode without primary_skill', () => {
    const cuj = {
      id: 'CUJ-001',
      name: 'Test CUJ',
      execution_mode: 'skill-only',
      // Missing primary_skill field
    };
    const result = validateCUJStructure(cuj);
    assert.ok(
      result.warnings.some(w => w.includes('no primary_skill specified')),
      'Should warn about missing primary_skill'
    );
  });

  await test('validateCUJStructure - invalid CUJ ID format', () => {
    const cuj = {
      id: 'CUJ-1', // Should be CUJ-001
      name: 'Test CUJ',
      execution_mode: 'workflow',
    };
    const result = validateCUJStructure(cuj);
    assert.ok(
      result.warnings.some(w => w.includes('CUJ ID format')),
      'Should warn about invalid ID format'
    );
  });

  // Test: cujDocExists
  await test('cujDocExists - existing CUJ', async () => {
    const exists = await cujDocExists('CUJ-001');
    assert.strictEqual(typeof exists, 'boolean', 'Result should be boolean');
  });

  await test('cujDocExists - non-existing CUJ', async () => {
    const exists = await cujDocExists('CUJ-999');
    assert.strictEqual(exists, false, 'Non-existing CUJ should return false');
  });

  // Test: getValidationMetadata
  await test('getValidationMetadata - returns metadata', () => {
    const meta = getValidationMetadata();
    assert.ok(
      meta.hasOwnProperty('lastFileReadTimestamp'),
      'Metadata should have lastFileReadTimestamp'
    );
    assert.ok(
      meta.hasOwnProperty('lastFileModificationTime'),
      'Metadata should have lastFileModificationTime'
    );
    assert.strictEqual(meta.source, 'file_system', 'Source should be file_system');
    assert.strictEqual(
      meta.conversationHistoryReferenced,
      false,
      'conversationHistoryReferenced should be false'
    );
  });

  await test('getValidationMetadata - updates after file read', async () => {
    const beforeMeta = getValidationMetadata();
    await loadRegistry(); // Trigger a file read
    const afterMeta = getValidationMetadata();

    // Timestamp should be updated
    assert.notStrictEqual(
      beforeMeta.lastFileReadTimestamp,
      afterMeta.lastFileReadTimestamp,
      'Timestamp should update after file read'
    );
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Test Results:`);
  console.log(`  Total: ${testsRun}`);
  console.log(`  ✅ Passed: ${testsPassed}`);
  console.log(`  ❌ Failed: ${testsFailed}`);
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  if (testsFailed > 0) {
    console.error('❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
