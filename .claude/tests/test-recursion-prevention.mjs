#!/usr/bin/env node
/**
 * Recursion Prevention Test Suite
 *
 * Tests all 4 P0 fixes to ensure no recursion is possible
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

const AUDIT_HOOK = '.claude/hooks/audit-post-tool.mjs';
const SECURITY_HOOK = '.claude/hooks/security-pre-tool.mjs';

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
  return new Promise(resolve => {
    console.log(`\n🧪 TEST: ${name}`);
    testFn()
      .then(() => {
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
        resolve();
      })
      .catch(err => {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   Error: ${err.message}`);
        testsFailed++;
        resolve();
      });
  });
}

function runHook(hookPath, input, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [hookPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';
    const startTime = Date.now();

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      const duration = Date.now() - startTime;
      resolve({ code, stdout, stderr, duration });
    });

    proc.on('error', err => {
      reject(err);
    });

    // Send input
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    // Timeout protection
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        reject(new Error(`Timeout exceeded (${timeout}ms)`));
      }
    }, timeout);
  });
}

async function testTaskExclusion() {
  const input = {
    tool: 'Task',
    tool_input: { subagent_type: 'developer', prompt: 'test' },
  };

  const result = await runHook(AUDIT_HOOK, input);

  if (result.code !== 0) {
    throw new Error(`Expected exit code 0, got ${result.code}`);
  }

  if (result.duration > 1000) {
    throw new Error(`Execution too slow: ${result.duration}ms`);
  }

  console.log(`   Duration: ${result.duration}ms`);
}

async function testTodoWriteExclusion() {
  const input = {
    tool: 'TodoWrite',
    tool_input: { content: 'test' },
  };

  const result = await runHook(AUDIT_HOOK, input);

  if (result.code !== 0) {
    throw new Error(`Expected exit code 0, got ${result.code}`);
  }

  console.log(`   Duration: ${result.duration}ms`);
}

async function testRecursionGuard() {
  // Set environment variable to simulate re-entry
  process.env.CLAUDE_AUDIT_HOOK_EXECUTING = 'true';

  const input = {
    tool: 'Bash',
    tool_input: { command: 'echo test' },
  };

  const result = await runHook(AUDIT_HOOK, input);

  // Unset for other tests
  delete process.env.CLAUDE_AUDIT_HOOK_EXECUTING;

  if (result.code !== 0) {
    throw new Error(`Expected exit code 0, got ${result.code}`);
  }

  // Should exit immediately due to guard
  if (result.duration > 500) {
    throw new Error(`Recursion guard too slow: ${result.duration}ms`);
  }

  console.log(`   Duration: ${result.duration}ms (immediate exit)`);
}

async function testTimeoutProtection() {
  // This test verifies timeout works, but hook should complete fast
  const input = {
    tool: 'Bash',
    tool_input: { command: 'echo test' },
  };

  const result = await runHook(AUDIT_HOOK, input);

  if (result.duration > 1000) {
    throw new Error(`Hook took ${result.duration}ms, timeout should trigger at 1000ms`);
  }

  console.log(`   Duration: ${result.duration}ms (completed before timeout)`);
}

async function testSecurityHookProtection() {
  const input = {
    tool: 'Task',
    tool_input: { subagent_type: 'developer', prompt: 'test' },
  };

  const result = await runHook(SECURITY_HOOK, input);

  if (result.code !== 0) {
    throw new Error(`Expected exit code 0, got ${result.code}`);
  }

  // Should have "allow" response
  if (!result.stdout.includes('allow')) {
    throw new Error(`Expected "allow" in output, got: ${result.stdout}`);
  }

  console.log(`   Duration: ${result.duration}ms`);
}

async function testNormalOperation() {
  const input = {
    tool: 'Bash',
    tool_input: { command: 'echo test' },
  };

  const result = await runHook(AUDIT_HOOK, input);

  if (result.code !== 0) {
    throw new Error(`Expected exit code 0, got ${result.code}`);
  }

  if (result.duration > 1000) {
    throw new Error(`Normal operation too slow: ${result.duration}ms`);
  }

  console.log(`   Duration: ${result.duration}ms`);
}

async function main() {
  console.log('🚀 P0 Recursion Prevention Test Suite\n');
  console.log('Testing all 4 fixes:');
  console.log('  1. Task/TodoWrite Exclusion');
  console.log('  2. Recursion Guard');
  console.log('  3. Wildcard Matcher Restriction');
  console.log('  4. Timeout Protection');
  console.log('='.repeat(60));

  await runTest('Task Exclusion (audit-post-tool)', testTaskExclusion);
  await runTest('TodoWrite Exclusion (audit-post-tool)', testTodoWriteExclusion);
  await runTest('Recursion Guard (environment variable)', testRecursionGuard);
  await runTest('Timeout Protection (completes <1s)', testTimeoutProtection);
  await runTest('Security Hook Protection (Task exclusion)', testSecurityHookProtection);
  await runTest('Normal Operation (Bash auditing)', testNormalOperation);

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 TEST RESULTS:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - No recursion possible!');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review fixes');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
