#!/usr/bin/env node

/**
 * Minimal test framework for sync-cuj-registry tests
 *
 * Provides describe, it, expect functions for testing
 */

let currentSuite = '';
let passCount = 0;
let failCount = 0;
const failures = [];

export function describe(suiteName, testFn) {
  currentSuite = suiteName;
  console.log(`\n📦 ${suiteName}\n`);
  testFn();
  printSummary();
}

export function it(testName, testFn) {
  try {
    testFn();
    passCount++;
    console.log(`  ✅ ${testName}`);
  } catch (error) {
    failCount++;
    failures.push({ suite: currentSuite, test: testName, error: error.message });
    console.log(`  ❌ ${testName}`);
    console.log(`     ${error.message}`);
  }
}

export function expect(actual) {
  return {
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
  };
}

function printSummary() {
  console.log(`\n📊 Test Summary`);
  console.log(`   Passed: ${passCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total:  ${passCount + failCount}`);

  if (failCount > 0) {
    console.log(`\n❌ ${failCount} test(s) failed:\n`);
    failures.forEach(f => {
      console.log(`   - ${f.suite} > ${f.test}`);
      console.log(`     ${f.error}\n`);
    });
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed!\n`);
    process.exit(0);
  }
}
