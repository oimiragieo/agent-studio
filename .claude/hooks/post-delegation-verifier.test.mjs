#!/usr/bin/env node

/**
 * Unit Tests for Post-Delegation Verification Hook
 *
 * Tests 5-step verification protocol:
 * 1. Check for errors
 * 2. Check for warnings
 * 3. Verify deliverables exist
 * 4. Validate success criteria
 * 5. Check agent verdict
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

const HOOK_PATH = join(__dirname, 'post-delegation-verifier.mjs');

/**
 * Test helper: Execute hook with input
 */
function executeHook(input) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('close', code => {
      try {
        const output = stdout.trim() ? JSON.parse(stdout) : null;
        resolve({ code, output, stderr });
      } catch (error) {
        reject(new Error(`Invalid JSON output: ${stdout}`));
      }
    });

    proc.on('error', reject);

    // Write input to stdin
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Hook execution timeout'));
    }, 5000);
  });
}

/**
 * Test Suite
 */
async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('='.repeat(60));
  console.log('POST-DELEGATION VERIFICATION HOOK - UNIT TESTS');
  console.log('='.repeat(60));

  // Test 1: Non-Task tool should be skipped
  try {
    console.log('\n[Test 1] Non-Task tool should be skipped...');
    const input = {
      tool_name: 'Read',
      tool_input: { file_path: 'test.txt' },
      tool_result: { content: 'file content' },
    };

    const { code, output, stderr } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.ok(stderr.includes('only Task tool is verified'), 'Should skip non-Task tools');

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 2: Step 1 - Detect errors in output
  try {
    console.log('\n[Test 2] Step 1 - Detect errors in output...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task failed with error: compilation failed. Exception thrown.',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0 (non-blocking)');
    assert.strictEqual(output.verification_verdict, 'FAIL', 'Should detect errors as FAIL');
    assert.ok(output.errors_count > 0, 'Should have error count > 0');
    assert.strictEqual(
      output.verification_details.verification_steps.step1_errors.checked,
      true,
      'Step 1 should be checked'
    );
    assert.ok(
      output.verification_details.verification_steps.step1_errors.found.length > 0,
      'Should find error keywords'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 3: Step 2 - Detect warnings in output
  try {
    console.log('\n[Test 3] Step 2 - Detect warnings in output...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task completed with warning: 3 tests skipped. Minor issue detected.',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(
      output.verification_verdict,
      'CONCERNS',
      'Should detect warnings as CONCERNS'
    );
    assert.ok(output.warnings_count > 0, 'Should have warning count > 0');
    assert.strictEqual(
      output.verification_details.verification_steps.step2_warnings.checked,
      true,
      'Step 2 should be checked'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 4: Step 3 - Verify deliverables exist (missing file)
  try {
    console.log('\n[Test 4] Step 3 - Verify deliverables exist (missing file)...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [
          {
            path: '.claude/context/reports/nonexistent-file.md',
            description: 'Test report',
          },
        ],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task completed successfully.',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(
      output.verification_verdict,
      'FAIL',
      'Should detect missing deliverable as FAIL'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step3_deliverables.checked,
      true,
      'Step 3 should be checked'
    );
    assert.ok(
      output.verification_details.verification_steps.step3_deliverables.missing.length > 0,
      'Should have missing deliverables'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 5: Step 3 - Verify deliverables exist (existing file)
  try {
    console.log('\n[Test 5] Step 3 - Verify deliverables exist (existing file)...');

    // Create temporary test file
    const testFilePath = join(PROJECT_ROOT, '.claude/context/tmp/tmp-test-deliverable.md');
    const testFileDir = dirname(testFilePath);
    if (!existsSync(testFileDir)) {
      mkdirSync(testFileDir, { recursive: true });
    }
    writeFileSync(testFilePath, 'Test content');

    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [
          {
            path: '.claude/context/tmp/tmp-test-deliverable.md',
            description: 'Test deliverable',
          },
        ],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task completed successfully.',
      },
    };

    const { code, output } = await executeHook(input);

    // Clean up test file
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(output.verification_verdict, 'PASS', 'Should pass with existing file');
    assert.strictEqual(
      output.verification_details.verification_steps.step3_deliverables.missing.length,
      0,
      'Should have no missing deliverables'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 6: Step 4 - Validate success criteria (not met)
  try {
    console.log('\n[Test 6] Step 4 - Validate success criteria (not met)...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [
          {
            criterion: 'All tests passing',
            met: false,
            evidence: 'Test suite: 10/15 passed',
          },
        ],
      },
      tool_result: {
        content: 'Task completed with failures.',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(output.verification_verdict, 'FAIL', 'Should fail when criteria not met');
    assert.strictEqual(
      output.verification_details.verification_steps.step4_criteria.checked,
      true,
      'Step 4 should be checked'
    );
    assert.ok(
      output.verification_details.verification_steps.step4_criteria.unmet.length > 0,
      'Should have unmet criteria'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 7: Step 5 - Check agent verdict (PASS)
  try {
    console.log('\n[Test 7] Step 5 - Check agent verdict (PASS)...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task completed successfully.\nVerdict: PASS',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(output.verification_verdict, 'PASS', 'Should pass with PASS verdict');
    assert.strictEqual(
      output.verification_details.verification_steps.step5_verdict.agent_verdict,
      'PASS',
      'Should detect PASS verdict'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 8: Step 5 - Check agent verdict (FAIL)
  try {
    console.log('\n[Test 8] Step 5 - Check agent verdict (FAIL)...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task encountered critical issues.\nVerdict: FAIL',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(output.verification_verdict, 'FAIL', 'Should fail with FAIL verdict');
    assert.strictEqual(
      output.verification_details.verification_steps.step5_verdict.agent_verdict,
      'FAIL',
      'Should detect FAIL verdict'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 9: Step 5 - Check agent verdict (CONCERNS)
  try {
    console.log('\n[Test 9] Step 5 - Check agent verdict (CONCERNS)...');
    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [],
        success_criteria: [],
      },
      tool_result: {
        content: 'Task completed with some concerns.\nVerdict: CONCERNS',
      },
    };

    const { code, output } = await executeHook(input);

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(
      output.verification_verdict,
      'CONCERNS',
      'Should have concerns with CONCERNS verdict'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step5_verdict.agent_verdict,
      'CONCERNS',
      'Should detect CONCERNS verdict'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Test 10: Complete verification (all steps PASS)
  try {
    console.log('\n[Test 10] Complete verification (all steps PASS)...');

    // Create temporary test file
    const testFilePath = join(PROJECT_ROOT, '.claude/context/tmp/tmp-test-complete.md');
    const testFileDir = dirname(testFilePath);
    if (!existsSync(testFileDir)) {
      mkdirSync(testFileDir, { recursive: true });
    }
    writeFileSync(testFilePath, 'Test content');

    const input = {
      tool_name: 'Task',
      tool_input: {
        deliverables: [
          {
            path: '.claude/context/tmp/tmp-test-complete.md',
            description: 'Test deliverable',
          },
        ],
        success_criteria: ['All tests passing', 'No security issues'],
      },
      tool_result: {
        content: 'Task completed successfully.\nAll tests passed.\nVerdict: PASS',
      },
    };

    const { code, output } = await executeHook(input);

    // Clean up test file
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }

    assert.strictEqual(code, 0, 'Hook should exit with code 0');
    assert.strictEqual(output.verification_verdict, 'PASS', 'Should pass all steps');
    assert.strictEqual(output.errors_count, 0, 'Should have no errors');
    assert.strictEqual(
      output.verification_details.verification_steps.step1_errors.checked,
      true,
      'Step 1 checked'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step2_warnings.checked,
      true,
      'Step 2 checked'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step3_deliverables.checked,
      true,
      'Step 3 checked'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step4_criteria.checked,
      true,
      'Step 4 checked'
    );
    assert.strictEqual(
      output.verification_details.verification_steps.step5_verdict.checked,
      true,
      'Step 5 checked'
    );

    console.log('  ✓ PASS');
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL: ${error.message}`);
    failed++;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n✗ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`Test execution error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
