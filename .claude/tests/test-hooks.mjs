#!/usr/bin/env node
/**
 * Hook Testing Script
 *
 * Tests all hooks to ensure they work correctly on all platforms
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test cases
const TEST_CASES = {
  'security-pre-tool.mjs': [
    {
      name: 'Should block rm -rf /',
      input: {
        tool: 'Bash',
        tool_input: { command: 'rm -rf /' },
      },
      expected: { decision: 'block' },
    },
    {
      name: 'Should block SQL injection',
      input: {
        tool: 'Bash',
        tool_input: { command: 'DROP DATABASE production' },
      },
      expected: { decision: 'block' },
    },
    {
      name: 'Should block force push to main',
      input: {
        tool: 'Bash',
        tool_input: { command: 'git push --force origin main' },
      },
      expected: { decision: 'block' },
    },
    {
      name: 'Should block .env editing',
      input: {
        tool: 'Write',
        tool_input: { file_path: '.env.production' },
      },
      expected: { decision: 'block' },
    },
    {
      name: 'Should allow safe git commands',
      input: {
        tool: 'Bash',
        tool_input: { command: 'git status' },
      },
      expected: { decision: 'allow' },
    },
    {
      name: 'Should allow safe file writes',
      input: {
        tool: 'Write',
        tool_input: { file_path: 'README.md' },
      },
      expected: { decision: 'allow' },
    },
  ],
  'audit-post-tool.mjs': [
    {
      name: 'Should log Bash command',
      input: {
        tool: 'Bash',
        tool_input: { command: 'git status' },
      },
      expected: { exitCode: 0 },
    },
    {
      name: 'Should log Write operation',
      input: {
        tool: 'Write',
        tool_input: { file_path: 'test.txt' },
      },
      expected: { exitCode: 0 },
    },
  ],
};

/**
 * Run a hook with test input
 */
async function runHook(hookPath, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [hookPath]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', code => {
      try {
        const result = stdout.trim() ? JSON.parse(stdout.trim()) : {};
        resolve({
          exitCode: code,
          stdout: result,
          stderr: stderr,
        });
      } catch (error) {
        resolve({
          exitCode: code,
          stdout: stdout,
          stderr: stderr,
          parseError: error.message,
        });
      }
    });

    // Write input and close stdin
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

/**
 * Run all tests for a hook
 */
async function testHook(hookName, testCases) {
  const hookPath = join(__dirname, '..', 'hooks', hookName);

  console.log(`\n🧪 Testing ${hookName}...`);
  console.log('─'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await runHook(hookPath, testCase.input);

      // Check expected values
      let testPassed = true;

      if (testCase.expected.decision) {
        if (result.stdout.decision !== testCase.expected.decision) {
          testPassed = false;
          console.log(`  ❌ ${testCase.name}`);
          console.log(`     Expected: ${testCase.expected.decision}`);
          console.log(`     Got: ${result.stdout.decision}`);
        }
      }

      if (testCase.expected.exitCode !== undefined) {
        if (result.exitCode !== testCase.expected.exitCode) {
          testPassed = false;
          console.log(`  ❌ ${testCase.name}`);
          console.log(`     Expected exit code: ${testCase.expected.exitCode}`);
          console.log(`     Got: ${result.exitCode}`);
        }
      }

      if (testPassed) {
        console.log(`  ✅ ${testCase.name}`);
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${testCase.name}`);
      console.log(`     Error: ${error.message}`);
      failed++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`  Passed: ${passed}/${passed + failed}`);

  return { passed, failed };
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Hook Testing Suite');
  console.log('═'.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [hookName, testCases] of Object.entries(TEST_CASES)) {
    const { passed, failed } = await testHook(hookName, testCases);
    totalPassed += passed;
    totalFailed += failed;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Summary');
  console.log('═'.repeat(60));
  console.log(`  Total Passed: ${totalPassed}`);
  console.log(`  Total Failed: ${totalFailed}`);
  console.log(`  Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
