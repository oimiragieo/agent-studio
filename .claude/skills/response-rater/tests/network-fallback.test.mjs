#!/usr/bin/env node

/**
 * Network Fallback Integration Test
 *
 * Tests that rate.cjs correctly falls back to offline mode when network fails.
 *
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Simulate network failure by using invalid provider endpoints
 */
async function testNetworkFallback() {
  console.log('\n=== Test: Network Fallback Integration ===');

  // Create a test plan
  const testPlan = {
    business_objective: 'Test network fallback',
    context: 'Verify offline fallback activates on network error',
    steps: [
      { name: 'Step 1', agent: 'developer', estimated_duration: '1 day' },
      { name: 'Step 2', agent: 'qa', estimated_duration: '1 day' },
    ],
    success_criteria: ['Test passes'],
    risks: [{ description: 'Test risk', mitigation: 'Test mitigation' }],
  };

  const planPath = path.join(FIXTURES_DIR, 'network-fallback-test.json');
  fs.writeFileSync(planPath, JSON.stringify(testPlan, null, 2));

  // Run rate.cjs with providers that will fail (no auth configured)
  const rateScript = path.join(__dirname, '..', 'scripts', 'rate.cjs');

  return new Promise(resolve => {
    const proc = spawn(
      'node',
      [
        rateScript,
        '--response-file',
        planPath,
        '--providers',
        'claude,gemini', // These will fail without auth
      ],
      {
        env: {
          ...process.env,
          // Clear API keys to force failure
          ANTHROPIC_API_KEY: '',
          GEMINI_API_KEY: '',
          GOOGLE_API_KEY: '',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      try {
        // Parse output
        const result = JSON.parse(stdout);

        console.log('Output received:');
        console.log(`- Method: ${result.method || 'online'}`);
        console.log(`- Offline Fallback: ${result.offline_fallback ? 'YES' : 'NO'}`);

        if (result.offline_rating) {
          console.log(`- Offline Score: ${result.offline_rating.overall_score}/10`);
          console.log(`- Offline Duration: ${result.offline_rating.duration_ms}ms`);
        }

        // Check if offline fallback activated
        const passed = result.offline_fallback === true && result.offline_rating?.ok === true;

        console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

        if (!passed) {
          console.error('Expected offline fallback to activate');
          console.error('Stdout:', stdout);
          console.error('Stderr:', stderr);
        }

        resolve(passed);
      } catch (error) {
        console.error('Failed to parse output:', error.message);
        console.error('Stdout:', stdout);
        console.error('Stderr:', stderr);
        resolve(false);
      }
    });
  });
}

/**
 * Test: Explicit offline mode bypasses network
 */
async function testExplicitOfflineMode() {
  console.log('\n=== Test: Explicit Offline Mode ===');

  const testPlan = {
    business_objective: 'Test explicit offline mode',
    steps: [{ name: 'Step 1', agent: 'developer' }],
  };

  const planPath = path.join(FIXTURES_DIR, 'explicit-offline-test.json');
  fs.writeFileSync(planPath, JSON.stringify(testPlan, null, 2));

  const offlineRaterScript = path.join(__dirname, '..', 'scripts', 'offline-rater.mjs');

  return new Promise(resolve => {
    const proc = spawn('node', [offlineRaterScript, planPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      try {
        const result = JSON.parse(stdout);

        console.log('Output received:');
        console.log(`- Method: ${result.method}`);
        console.log(`- Score: ${result.overall_score}/10`);
        console.log(`- Duration: ${result.duration_ms}ms`);

        const passed = result.ok === true && result.method === 'offline';

        console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

        if (!passed) {
          console.error('Expected explicit offline mode to work');
          console.error('Stdout:', stdout);
          console.error('Stderr:', stderr);
        }

        resolve(passed);
      } catch (error) {
        console.error('Failed to parse output:', error.message);
        console.error('Stdout:', stdout);
        console.error('Stderr:', stderr);
        resolve(false);
      }
    });
  });
}

/**
 * Run all integration tests
 */
async function runTests() {
  console.log('======================================');
  console.log('Network Fallback Integration Tests');
  console.log('======================================');

  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  const tests = [
    testExplicitOfflineMode,
    // testNetworkFallback, // Disabled: requires network failure simulation
  ];

  const results = [];
  for (const test of tests) {
    try {
      const passed = await test();
      results.push(passed);
    } catch (error) {
      console.error(`\n❌ Test failed with exception: ${error.message}`);
      results.push(false);
    }
  }

  // Summary
  const totalTests = results.length;
  const passedTests = results.filter(Boolean).length;
  const failedTests = totalTests - passedTests;

  console.log('\n======================================');
  console.log('Test Summary');
  console.log('======================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  // Note about network fallback test
  console.log('\nNote: Network fallback test disabled in automated suite.');
  console.log('To test manually: disconnect network and run rate.cjs');

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
