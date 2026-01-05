#!/usr/bin/env node
/**
 * Test script for skill-injection-hook.js
 *
 * Tests the hook with various inputs to ensure correct behavior:
 * 1. Task tool with developer subagent
 * 2. Task tool with unknown subagent (graceful handling)
 * 3. Non-Task tool (should pass through)
 * 4. Malformed input (error handling)
 * 5. Empty input
 * 6. Missing subagent_type
 * 7. Missing prompt
 *
 * Usage:
 *   node test-skill-injection-hook.js
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test cases
const testCases = [
  {
    name: 'Task tool with developer subagent',
    input: {
      tool: 'Task',
      input: {
        subagent_type: 'developer',
        prompt: 'Create a new UserProfile component'
      }
    },
    expectedBehavior: 'Should inject required skills for developer agent'
  },
  {
    name: 'Task tool with orchestrator subagent',
    input: {
      tool: 'Task',
      input: {
        subagent_type: 'orchestrator',
        prompt: 'Coordinate the feature development workflow'
      }
    },
    expectedBehavior: 'Should inject required skills for orchestrator agent'
  },
  {
    name: 'Task tool with unknown subagent',
    input: {
      tool: 'Task',
      input: {
        subagent_type: 'nonexistent-agent',
        prompt: 'Do something'
      }
    },
    expectedBehavior: 'Should gracefully handle unknown agent and pass through'
  },
  {
    name: 'Non-Task tool (Read)',
    input: {
      tool: 'Read',
      input: {
        file_path: '/some/file.txt'
      }
    },
    expectedBehavior: 'Should pass through unchanged (not a Task tool)'
  },
  {
    name: 'Malformed JSON',
    input: '{ invalid json',
    expectedBehavior: 'Should handle parse error and pass through'
  },
  {
    name: 'Empty input',
    input: '',
    expectedBehavior: 'Should handle empty input gracefully'
  },
  {
    name: 'Task tool missing subagent_type',
    input: {
      tool: 'Task',
      input: {
        prompt: 'Do something'
      }
    },
    expectedBehavior: 'Should warn and pass through unchanged'
  },
  {
    name: 'Task tool missing prompt',
    input: {
      tool: 'Task',
      input: {
        subagent_type: 'developer'
      }
    },
    expectedBehavior: 'Should warn and pass through unchanged'
  },
  {
    name: 'Task tool with code review trigger',
    input: {
      tool: 'Task',
      input: {
        subagent_type: 'developer',
        prompt: 'Review the authentication code for security issues'
      }
    },
    expectedBehavior: 'Should inject required + triggered skills (code review triggers)'
  }
];

/**
 * Run a single test case
 * @param {Object} testCase - Test case object
 * @returns {Promise<Object>} Test result
 */
async function runTest(testCase) {
  return new Promise((resolve) => {
    const hookPath = join(__dirname, 'skill-injection-hook.js');
    const startTime = Date.now();

    const proc = spawn('node', [hookPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      let output;
      try {
        output = JSON.parse(stdout);
      } catch (parseError) {
        output = stdout; // Could not parse as JSON
      }

      resolve({
        name: testCase.name,
        expectedBehavior: testCase.expectedBehavior,
        exitCode: code,
        executionTime,
        stdout,
        stderr,
        output,
        success: code === 0
      });
    });

    // Write input to stdin
    const inputStr = typeof testCase.input === 'string'
      ? testCase.input
      : JSON.stringify(testCase.input, null, 2);

    proc.stdin.write(inputStr);
    proc.stdin.end();
  });
}

/**
 * Main test runner
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Skill Injection Hook - Test Suite');
  console.log('='.repeat(80));
  console.log();

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Running test ${i + 1}/${testCases.length}: ${testCase.name}`);

    const result = await runTest(testCase);
    results.push(result);

    // Print result summary
    const statusIcon = result.success ? '✓' : '✗';
    console.log(`  ${statusIcon} Exit code: ${result.exitCode}`);
    console.log(`  ⏱  Execution time: ${result.executionTime}ms`);

    if (result.executionTime > 100) {
      console.log(`  ⚠  Warning: Execution time exceeds target of 100ms`);
    }

    // Print stderr logs (hook logs)
    if (result.stderr) {
      console.log('  Logs:');
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) console.log(`    ${line}`);
      });
    }

    // Check if output is valid JSON
    if (typeof result.output === 'object') {
      console.log('  ✓ Output is valid JSON');

      // For Task tool calls, check if prompt was enhanced
      if (result.output.tool === 'Task' && result.output.input?.prompt) {
        const originalPrompt = testCase.input.input?.prompt || '';
        const enhancedPrompt = result.output.input.prompt;

        if (enhancedPrompt.length > originalPrompt.length) {
          console.log('  ✓ Prompt was enhanced with skills');
        } else {
          console.log('  ℹ  Prompt was not enhanced (expected for unknown agents)');
        }
      }
    } else {
      console.log('  ℹ  Output is not JSON (expected for malformed input)');
    }

    console.log();
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Average execution time: ${avgExecutionTime.toFixed(2)}ms`);

  if (avgExecutionTime > 100) {
    console.log(`⚠  Warning: Average execution time exceeds target of 100ms`);
  } else {
    console.log(`✓ Average execution time within target (<100ms)`);
  }

  console.log();

  // Detailed results
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name} (exit code: ${r.exitCode})`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
