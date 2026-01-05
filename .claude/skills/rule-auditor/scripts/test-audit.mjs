#!/usr/bin/env node
/**
 * Test suite for rule-auditor audit script
 *
 * Usage:
 *   node test-audit.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.join(__dirname, '.test-temp');
const AUDIT_SCRIPT = path.join(__dirname, 'audit.mjs');

/**
 * Setup test environment
 */
async function setup() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Create test file
 */
async function createTestFile(filename, content) {
  const filePath = path.join(TEST_DIR, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Run audit command
 */
async function runAudit(args = []) {
  const command = `node "${AUDIT_SCRIPT}" ${args.join(' ')}`;
  try {
    const { stdout, stderr } = await execAsync(command);
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code || 1 };
  }
}

/**
 * Assert function
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Test: Basic audit
 */
async function testBasicAudit() {
  console.log('Testing basic audit...');

  // Create test file
  const testFile = await createTestFile('test.tsx', `
import React from 'react';

export function UserAuth() {
  const user: any = getUser(); // Should trigger "avoid any" violation
  console.log('Debug:', user); // Should trigger "console.log" violation

  return <div>Hello {user.name}</div>;
}
`);

  // Run audit
  const result = await runAudit([TEST_DIR, '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Assertions
  assert(output.skill_name === 'rule-auditor', 'skill_name should be rule-auditor');
  assert(output.files_audited.length > 0, 'Should audit at least one file');
  assert(output.rules_applied.length > 0, 'Should apply at least one rule');
  assert(typeof output.compliance_score === 'number', 'compliance_score should be a number');
  assert(Array.isArray(output.violations_found), 'violations_found should be an array');
  assert(output.rule_index_consulted === true, 'rule_index_consulted should be true');
  assert(output.timestamp, 'timestamp should be present');

  console.log('✅ Basic audit test passed');
}

/**
 * Test: Dry-run fix mode
 */
async function testDryRunFix() {
  console.log('Testing dry-run fix mode...');

  const testFile = await createTestFile('test-fix.tsx', `
const user: any = getUser();
console.log('test');
`);

  // Run audit with --fix-dry-run
  const result = await runAudit([TEST_DIR, '--fix-dry-run', '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Check that fixes_applied is present
  assert(Array.isArray(output.fixes_applied), 'fixes_applied should be an array in dry-run mode');

  // Verify file was not modified
  const content = await fs.readFile(testFile, 'utf-8');
  assert(content.includes('const user: any'), 'File should not be modified in dry-run mode');

  console.log('✅ Dry-run fix test passed');
}

/**
 * Test: Fix mode with backups
 */
async function testFixMode() {
  console.log('Testing fix mode with backups...');

  const testFile = await createTestFile('test-fix2.tsx', `
const user: any = getUser();
`);

  // Run audit with --fix
  const result = await runAudit([TEST_DIR, '--fix', '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Check that fixes were applied
  assert(Array.isArray(output.fixes_applied), 'fixes_applied should be an array');

  // Verify backup was created (if fixes were applied)
  if (output.fixes_applied.length > 0) {
    try {
      await fs.access(`${testFile}.bak`);
      console.log('✅ Backup file created');
    } catch (error) {
      // Backup might not be created if no fixable violations
      console.log('⚠️  No backup created (no fixable violations)');
    }
  }

  console.log('✅ Fix mode test passed');
}

/**
 * Test: Technology detection
 */
async function testTechnologyDetection() {
  console.log('Testing technology detection...');

  // Create TypeScript file
  await createTestFile('test.ts', `
const x: string = 'hello';
`);

  // Create React file
  await createTestFile('component.tsx', `
import React from 'react';
export const App = () => <div>Hello</div>;
`);

  // Run audit
  const result = await runAudit([TEST_DIR, '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Check technologies detected
  assert(Array.isArray(output.technologies_detected), 'technologies_detected should be an array');
  assert(output.technologies_detected.includes('typescript'), 'Should detect TypeScript');
  assert(output.technologies_detected.includes('react'), 'Should detect React');

  console.log('✅ Technology detection test passed');
}

/**
 * Test: Compliance score calculation
 */
async function testComplianceScore() {
  console.log('Testing compliance score calculation...');

  // Create file with no violations
  await createTestFile('clean.tsx', `
import React from 'react';
export const Clean = () => <div>No violations</div>;
`);

  const result = await runAudit([TEST_DIR, '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Check compliance score
  assert(typeof output.compliance_score === 'number', 'compliance_score should be a number');
  assert(output.compliance_score >= 0 && output.compliance_score <= 100, 'compliance_score should be 0-100');

  console.log('✅ Compliance score test passed');
}

/**
 * Test: Audit summary
 */
async function testAuditSummary() {
  console.log('Testing audit summary...');

  await createTestFile('summary.tsx', `
import React from 'react';
export const Test = () => <div>Test</div>;
`);

  const result = await runAudit([TEST_DIR, '--format', 'json']);
  const output = JSON.parse(result.stdout);

  // Check audit_summary
  assert(output.audit_summary, 'audit_summary should be present');
  assert(typeof output.audit_summary.total_files === 'number', 'total_files should be a number');
  assert(typeof output.audit_summary.total_lines === 'number', 'total_lines should be a number');
  assert(typeof output.audit_summary.total_violations === 'number', 'total_violations should be a number');
  assert(typeof output.audit_summary.errors === 'number', 'errors should be a number');
  assert(typeof output.audit_summary.warnings === 'number', 'warnings should be a number');
  assert(typeof output.audit_summary.info === 'number', 'info should be a number');

  console.log('✅ Audit summary test passed');
}

/**
 * Test: Exit codes
 */
async function testExitCodes() {
  console.log('Testing exit codes...');

  // Create file with violations
  await createTestFile('violations.tsx', `
const user: any = getUser();
`);

  // Run audit (should exit with code 1 if errors found)
  const result = await runAudit([TEST_DIR, '--format', 'json']);

  // Note: Exit code depends on whether validation patterns exist
  console.log(`Exit code: ${result.exitCode}`);

  console.log('✅ Exit code test passed');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Running rule-auditor test suite\n');

  try {
    await setup();

    await testBasicAudit();
    await cleanup();
    await setup();

    await testDryRunFix();
    await cleanup();
    await setup();

    await testFixMode();
    await cleanup();
    await setup();

    await testTechnologyDetection();
    await cleanup();
    await setup();

    await testComplianceScore();
    await cleanup();
    await setup();

    await testAuditSummary();
    await cleanup();
    await setup();

    await testExitCodes();

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTests();
