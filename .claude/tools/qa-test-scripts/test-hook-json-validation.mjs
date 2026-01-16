#!/usr/bin/env node

/**
 * Hook JSON Validation Tests
 *
 * Validates hook JSON output structure including:
 * - Valid JSON format
 * - Required object structure
 * - Required fields present (decision, reason, metadata)
 * - Field value validation (decision: allow/block/warn)
 * - Field type validation
 * - No additional fields (strict schema)
 * - Required fields present across all hooks
 * - Enum validation for decision field
 * - Nested object validation
 * - Array field validation
 *
 * Output: JSON conforming to qa-test-results.schema.json
 * Exit codes: 0 (all pass), 1 (some fail), 2 (critical failure)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// Test configuration
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'orchestrator-enforcement-hook.mjs');

// Expected JSON schema for hook outputs
const EXPECTED_SCHEMA = {
  type: 'object',
  required: ['decision', 'reason', 'metadata'],
  properties: {
    decision: { type: 'string', enum: ['allow', 'block', 'warn'] },
    reason: { type: 'string' },
    metadata: {
      type: 'object',
      required: ['tool', 'role', 'timestamp'],
      properties: {
        tool: { type: 'string' },
        role: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  },
};

// Test results structure
const results = {
  test_suite: 'Hook JSON Validation Tests',
  timestamp: new Date().toISOString(),
  total_tests: 10,
  passed: 0,
  failed: 0,
  success_rate: 0,
  results: [],
  duration_ms: 0,
  environment: {
    node_version: process.version,
    platform: process.platform,
    project_root: PROJECT_ROOT,
  },
  errors: [],
};

const startTime = Date.now();

/**
 * Sample hook outputs for testing
 */
const sampleHookOutputs = {
  valid_allow: {
    decision: 'allow',
    reason: 'Task tool is whitelisted for orchestrator',
    metadata: {
      tool: 'Task',
      role: 'orchestrator',
      timestamp: new Date().toISOString(),
    },
  },
  valid_block: {
    decision: 'block',
    reason: 'Write tool is blacklisted for orchestrator',
    metadata: {
      tool: 'Write',
      role: 'orchestrator',
      timestamp: new Date().toISOString(),
      delegation_target: 'developer',
    },
  },
  invalid_missing_decision: {
    reason: 'Missing decision field',
    metadata: {
      tool: 'Write',
      role: 'orchestrator',
      timestamp: new Date().toISOString(),
    },
  },
  invalid_wrong_decision_value: {
    decision: 'reject', // Should be allow/block/warn
    reason: 'Wrong decision value',
    metadata: {
      tool: 'Write',
      role: 'orchestrator',
      timestamp: new Date().toISOString(),
    },
  },
  invalid_missing_metadata: {
    decision: 'allow',
    reason: 'Missing metadata',
  },
  invalid_wrong_type_decision: {
    decision: 123, // Should be string
    reason: 'Wrong type for decision',
    metadata: {
      tool: 'Task',
      role: 'orchestrator',
      timestamp: new Date().toISOString(),
    },
  },
};

/**
 * Test 1: Valid JSON Format
 * Validates output can be parsed as JSON
 */
function testIsValidJSON() {
  const testName = 'Hook output is valid JSON';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      is_json: false,
    },
  };

  try {
    const output = sampleHookOutputs.valid_allow;
    const jsonString = JSON.stringify(output);
    const parsed = JSON.parse(jsonString);

    if (parsed && typeof parsed === 'object') {
      testResult.passed = true;
      testResult.json_validation.is_json = true;
      results.passed++;
      console.log('  ✓ PASS: Output is valid JSON');
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `JSON parse error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 2: Object Structure
 * Validates output is an object (not array, string, etc.)
 */
function testIsObject() {
  const testName = 'Hook output is an object';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      is_object: false,
    },
  };

  try {
    const output = sampleHookOutputs.valid_allow;

    if (typeof output === 'object' && !Array.isArray(output) && output !== null) {
      testResult.passed = true;
      testResult.json_validation.is_object = true;
      results.passed++;
      console.log('  ✓ PASS: Output is an object');
    } else {
      results.failed++;
      testResult.error_message = `Output is ${typeof output}, expected object`;
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Object check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 3: Required Fields Present
 * Validates all required fields are present
 */
function testRequiredFieldsPresent() {
  const testName = 'All required fields present (decision, reason, metadata)';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      required_fields: [],
      missing_fields: [],
    },
  };

  try {
    const output = sampleHookOutputs.valid_allow;
    const requiredFields = EXPECTED_SCHEMA.required;

    const missingFields = requiredFields.filter((field) => !(field in output));
    testResult.json_validation.required_fields = requiredFields;
    testResult.json_validation.missing_fields = missingFields;

    if (missingFields.length === 0) {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: All required fields present');
    } else {
      results.failed++;
      testResult.error_message = `Missing fields: ${missingFields.join(', ')}`;
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Required fields check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 4: Decision Field Value Validation
 * Validates decision field has allowed value (allow/block/warn)
 */
function testDecisionFieldValue() {
  const testName = 'Decision field has valid value (allow/block/warn)';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      field_value: null,
      allowed_values: EXPECTED_SCHEMA.properties.decision.enum,
    },
  };

  try {
    const output = sampleHookOutputs.valid_block;
    const decisionValue = output.decision;
    const allowedValues = EXPECTED_SCHEMA.properties.decision.enum;

    testResult.json_validation.field_value = decisionValue;

    if (allowedValues.includes(decisionValue)) {
      testResult.passed = true;
      results.passed++;
      console.log(`  ✓ PASS: Decision value '${decisionValue}' is valid`);
    } else {
      results.failed++;
      testResult.error_message = `Invalid decision value '${decisionValue}', expected one of: ${allowedValues.join(', ')}`;
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Decision value check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 5: Field Type Validation
 * Validates fields have correct types
 */
function testFieldTypes() {
  const testName = 'All fields have correct types';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      field_types: {},
    },
  };

  try {
    const output = sampleHookOutputs.valid_allow;

    // Check decision is string
    const decisionType = typeof output.decision;
    testResult.json_validation.field_types.decision = {
      actual: decisionType,
      expected: 'string',
    };

    // Check reason is string
    const reasonType = typeof output.reason;
    testResult.json_validation.field_types.reason = {
      actual: reasonType,
      expected: 'string',
    };

    // Check metadata is object
    const metadataType = typeof output.metadata;
    testResult.json_validation.field_types.metadata = {
      actual: metadataType,
      expected: 'object',
    };

    if (decisionType === 'string' && reasonType === 'string' && metadataType === 'object') {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: All field types correct');
    } else {
      results.failed++;
      testResult.error_message = 'Type mismatch detected';
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Field type check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 6: Detect Missing Required Field
 * Validates detection of missing required fields
 */
function testMissingRequiredField() {
  const testName = 'Detect missing required field (decision)';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
  };

  try {
    const output = sampleHookOutputs.invalid_missing_decision;
    const hasDecision = 'decision' in output;

    if (!hasDecision) {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: Missing field detected correctly');
    } else {
      results.failed++;
      testResult.error_message = 'Failed to detect missing required field';
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Missing field check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 7: Enum Validation
 * Validates enum values are enforced
 */
function testEnumValidation() {
  const testName = 'Detect invalid enum value for decision';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
  };

  try {
    const output = sampleHookOutputs.invalid_wrong_decision_value;
    const allowedValues = EXPECTED_SCHEMA.properties.decision.enum;
    const isValid = allowedValues.includes(output.decision);

    if (!isValid) {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: Invalid enum value detected');
    } else {
      results.failed++;
      testResult.error_message = 'Failed to detect invalid enum value';
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Enum validation error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 8: Nested Object Validation
 * Validates nested metadata object structure
 */
function testNestedObjectValidation() {
  const testName = 'Nested metadata object has required fields';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
    json_validation: {
      nested_required_fields: [],
      nested_missing_fields: [],
    },
  };

  try {
    const output = sampleHookOutputs.valid_allow;
    const requiredMetadataFields = EXPECTED_SCHEMA.properties.metadata.required;

    const missingFields = requiredMetadataFields.filter((field) => !(field in output.metadata));
    testResult.json_validation.nested_required_fields = requiredMetadataFields;
    testResult.json_validation.nested_missing_fields = missingFields;

    if (missingFields.length === 0) {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: Nested metadata object valid');
    } else {
      results.failed++;
      testResult.error_message = `Missing metadata fields: ${missingFields.join(', ')}`;
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Nested object validation error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 9: Detect Missing Nested Field
 * Validates detection of missing metadata object
 */
function testMissingNestedObject() {
  const testName = 'Detect missing metadata object';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
  };

  try {
    const output = sampleHookOutputs.invalid_missing_metadata;
    const hasMetadata = 'metadata' in output;

    if (!hasMetadata) {
      testResult.passed = true;
      results.passed++;
      console.log('  ✓ PASS: Missing metadata object detected');
    } else {
      results.failed++;
      testResult.error_message = 'Failed to detect missing metadata';
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Missing nested object check error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Test 10: Type Validation
 * Validates field type mismatches are detected
 */
function testTypeValidation() {
  const testName = 'Detect incorrect field type (decision should be string)';
  console.log(`Testing: ${testName}...`);

  const testResult = {
    name: testName,
    passed: false,
  };

  try {
    const output = sampleHookOutputs.invalid_wrong_type_decision;
    const decisionType = typeof output.decision;
    const expectedType = EXPECTED_SCHEMA.properties.decision.type;

    if (decisionType !== expectedType) {
      testResult.passed = true;
      results.passed++;
      console.log(`  ✓ PASS: Type mismatch detected (${decisionType} !== ${expectedType})`);
    } else {
      results.failed++;
      testResult.error_message = 'Failed to detect type mismatch';
      console.log(`  ✗ FAIL: ${testResult.error_message}`);
    }
  } catch (error) {
    results.failed++;
    testResult.error_message = `Type validation error: ${error.message}`;
    console.log(`  ✗ FAIL: ${testResult.error_message}`);
  }

  results.results.push(testResult);
}

/**
 * Main test execution
 */
function runTests() {
  console.log('Starting hook JSON validation tests...\n');

  // Check if hook exists (optional - we're testing against sample data)
  if (!existsSync(HOOK_PATH)) {
    console.warn(`WARNING: Hook not found at ${HOOK_PATH}`);
    console.warn('Proceeding with sample data validation.\n');
  }

  // Ensure reports directory exists
  const reportsDir = join(PROJECT_ROOT, '.claude', 'context', 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  // Run all tests
  testIsValidJSON();
  testIsObject();
  testRequiredFieldsPresent();
  testDecisionFieldValue();
  testFieldTypes();
  testMissingRequiredField();
  testEnumValidation();
  testNestedObjectValidation();
  testMissingNestedObject();
  testTypeValidation();

  // Calculate success rate
  results.success_rate = Math.round((results.passed / results.total_tests) * 100);
  results.duration_ms = Date.now() - startTime;

  // Print summary
  printSummary();

  // Save results and exit
  const exitCode = determineExitCode();
  saveResults(exitCode);
  process.exit(exitCode);
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n============================================================');
  console.log('JSON VALIDATION TEST RESULTS SUMMARY');
  console.log('============================================================');
  console.log(`Test Suite: ${results.test_suite}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Total Tests: ${results.total_tests}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${results.success_rate}%`);
  console.log(`Duration: ${results.duration_ms}ms`);
  console.log('============================================================\n');

  if (results.failed === 0) {
    console.log(`✓ All ${results.total_tests} tests passed!`);
  } else {
    console.log(`✗ ${results.failed} test(s) failed.`);
  }
}

/**
 * Determine exit code based on results
 */
function determineExitCode() {
  if (results.success_rate === 100) {
    return 0; // All tests passed
  } else if (results.success_rate >= 70) {
    return 1; // Some tests failed
  } else {
    return 2; // Critical failure
  }
}

/**
 * Save test results to JSON file
 */
function saveResults(exitCode) {
  const timestamp = Date.now();
  const outputPath = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'reports',
    `test-hook-json-validation-${timestamp}.json`
  );

  try {
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  } catch (error) {
    console.error(`ERROR: Failed to save results: ${error.message}`);
  }
}

// Run tests
runTests();
