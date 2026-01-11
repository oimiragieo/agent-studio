#!/usr/bin/env node
/**
 * Unit tests for streaming JSON parser
 */

import { parseLargeJSON, shouldUseStreaming } from './streaming-json-parser.mjs';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = join(__dirname, '../context/tmp');
const TEST_FILE_SMALL = join(TEST_DIR, 'test-small.json');
const TEST_FILE_LARGE = join(TEST_DIR, 'test-large.json');

// Ensure test directory exists
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

/**
 * Test 1: Parse small JSON file
 */
async function testSmallFile() {
  const testData = {
    name: 'test',
    version: '1.0.0',
    items: [1, 2, 3],
    nested: {
      key: 'value',
      flag: true,
    },
  };

  writeFileSync(TEST_FILE_SMALL, JSON.stringify(testData, null, 2));

  try {
    const result = await parseLargeJSON(TEST_FILE_SMALL);

    // Validate result
    if (result.name !== testData.name) throw new Error('Name mismatch');
    if (result.version !== testData.version) throw new Error('Version mismatch');
    if (result.items.length !== testData.items.length) throw new Error('Items length mismatch');
    if (result.nested.key !== testData.nested.key) throw new Error('Nested key mismatch');

    console.log('✓ Test 1 passed: Small file parsed correctly');
    return true;
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    return false;
  } finally {
    if (existsSync(TEST_FILE_SMALL)) {
      unlinkSync(TEST_FILE_SMALL);
    }
  }
}

/**
 * Test 2: Parse large JSON file (5MB)
 */
async function testLargeFile() {
  // Generate 5MB JSON file
  const largeData = {
    metadata: {
      size: 'large',
      items: 10000,
    },
    data: [],
  };

  // Create 10,000 items to make file ~5MB
  for (let i = 0; i < 10000; i++) {
    largeData.data.push({
      id: i,
      name: `Item ${i}`,
      description: 'A'.repeat(100), // 100 chars
      tags: ['tag1', 'tag2', 'tag3'],
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1,
      },
    });
  }

  writeFileSync(TEST_FILE_LARGE, JSON.stringify(largeData, null, 2));

  try {
    const startTime = Date.now();
    const result = await parseLargeJSON(TEST_FILE_LARGE);
    const duration = Date.now() - startTime;

    // Validate result
    if (result.metadata.items !== largeData.metadata.items) throw new Error('Metadata mismatch');
    if (result.data.length !== largeData.data.length) throw new Error('Data length mismatch');
    if (result.data[0].id !== 0) throw new Error('First item ID mismatch');
    if (result.data[9999].id !== 9999) throw new Error('Last item ID mismatch');

    console.log(`✓ Test 2 passed: Large file (5MB) parsed in ${duration}ms`);
    return true;
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    return false;
  } finally {
    if (existsSync(TEST_FILE_LARGE)) {
      unlinkSync(TEST_FILE_LARGE);
    }
  }
}

/**
 * Test 3: Size limit enforcement
 */
async function testSizeLimit() {
  const testData = { data: 'A'.repeat(1000) };
  writeFileSync(TEST_FILE_SMALL, JSON.stringify(testData));

  try {
    // Set max size to 100 bytes (file is larger)
    await parseLargeJSON(TEST_FILE_SMALL, { maxSize: 100 });
    console.error('✗ Test 3 failed: Size limit not enforced');
    return false;
  } catch (error) {
    if (error.message.includes('exceeds size limit')) {
      console.log('✓ Test 3 passed: Size limit enforced correctly');
      return true;
    }
    console.error('✗ Test 3 failed: Wrong error:', error.message);
    return false;
  } finally {
    if (existsSync(TEST_FILE_SMALL)) {
      unlinkSync(TEST_FILE_SMALL);
    }
  }
}

/**
 * Test 4: shouldUseStreaming threshold
 */
async function testShouldUseStreaming() {
  try {
    // Create small file (<1MB)
    const smallData = { data: 'test' };
    writeFileSync(TEST_FILE_SMALL, JSON.stringify(smallData));

    const shouldStreamSmall = shouldUseStreaming(TEST_FILE_SMALL, 1);
    if (shouldStreamSmall) throw new Error('Should not stream small file');

    // Create large file (>1MB)
    const largeData = { data: 'A'.repeat(2 * 1024 * 1024) }; // 2MB
    writeFileSync(TEST_FILE_LARGE, JSON.stringify(largeData));

    const shouldStreamLarge = shouldUseStreaming(TEST_FILE_LARGE, 1);
    if (!shouldStreamLarge) throw new Error('Should stream large file');

    console.log('✓ Test 4 passed: shouldUseStreaming threshold works');
    return true;
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    return false;
  } finally {
    if (existsSync(TEST_FILE_SMALL)) unlinkSync(TEST_FILE_SMALL);
    if (existsSync(TEST_FILE_LARGE)) unlinkSync(TEST_FILE_LARGE);
  }
}

/**
 * Test 5: Malformed JSON handling
 */
async function testMalformedJSON() {
  writeFileSync(TEST_FILE_SMALL, '{ "name": "test", invalid }');

  try {
    await parseLargeJSON(TEST_FILE_SMALL);
    console.error('✗ Test 5 failed: Malformed JSON not detected');
    return false;
  } catch (error) {
    if (error.message.includes('Failed to parse JSON')) {
      console.log('✓ Test 5 passed: Malformed JSON detected');
      return true;
    }
    console.error('✗ Test 5 failed: Wrong error:', error.message);
    return false;
  } finally {
    if (existsSync(TEST_FILE_SMALL)) {
      unlinkSync(TEST_FILE_SMALL);
    }
  }
}

// Run all tests
(async () => {
  console.log('\n🧪 Running Streaming JSON Parser Tests\n');

  const results = [];
  results.push(await testSmallFile());
  results.push(await testLargeFile());
  results.push(await testSizeLimit());
  results.push(await testShouldUseStreaming());
  results.push(await testMalformedJSON());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n📊 Test Results: ${passed}/${total} passed`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
})();
