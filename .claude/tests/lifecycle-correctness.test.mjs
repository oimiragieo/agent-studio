#!/usr/bin/env node
/**
 * Integration test for CUJ lifecycle correctness
 * Tests cleanup behavior in success, error, and timeout scenarios
 * Verifies no orphan processes remain after CUJ execution
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runCujPath = path.join(__dirname, '../tools/run-cuj.mjs');

/**
 * Get process tree for a PID (cross-platform)
 * @param {number} pid - Process ID
 * @returns {Promise<number[]>} Array of child PIDs
 */
async function getProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      // Windows: Use WMIC to get child processes
      const { stdout } = await execPromise(
        `wmic process where (ParentProcessId=${pid}) get ProcessId`,
        { timeout: 5000 }
      );
      const lines = stdout.split('\n').slice(1); // Skip header
      const pids = lines.map(line => parseInt(line.trim())).filter(pid => !isNaN(pid));
      return pids;
    } else {
      // Unix: Use pgrep to get child processes
      const { stdout } = await execPromise(`pgrep -P ${pid}`, { timeout: 5000 });
      const pids = stdout
        .split('\n')
        .map(line => parseInt(line.trim()))
        .filter(pid => !isNaN(pid));
      return pids;
    }
  } catch (error) {
    // No children found (command returns non-zero when no matches)
    return [];
  }
}

/**
 * Check if a process exists (cross-platform)
 * @param {number} pid - Process ID
 * @returns {Promise<boolean>}
 */
async function processExists(pid) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execPromise(`tasklist /FI "PID eq ${pid}" /NH`, { timeout: 5000 });
      return stdout.includes(`${pid}`);
    } else {
      const { stdout } = await execPromise(`ps -p ${pid} -o pid=`, { timeout: 5000 });
      return stdout.trim() === `${pid}`;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Wait for all child processes to exit
 * @param {number} parentPid - Parent process PID
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{success: boolean, remainingPids: number[]}>}
 */
async function waitForChildrenExit(parentPid, timeoutMs = 10000) {
  const startTime = Date.now();
  let children = [];

  while (Date.now() - startTime < timeoutMs) {
    children = await getProcessTree(parentPid);
    if (children.length === 0) {
      return { success: true, remainingPids: [] };
    }
    // Wait 500ms before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { success: false, remainingPids: children };
}

/**
 * Test lifecycle: Successful CUJ completion
 */
async function testSuccessfulCompletion() {
  console.log('\n🧪 Test 1: Successful CUJ Completion');
  console.log('─'.repeat(60));

  return new Promise((resolve, reject) => {
    // Spawn run-cuj.mjs with --simulate (dry run, guaranteed success)
    const child = spawn('node', [runCujPath, '--simulate', 'CUJ-001'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = child.pid;
    console.log(`  Child PID: ${pid}`);

    let stdout = '';
    let stderr = '';
    let lifecycleStates = [];

    child.stdout.on('data', data => {
      const output = data.toString();
      stdout += output;

      // Capture lifecycle state transitions
      const stateMatches = output.match(/\[Lifecycle\] (.*)/g);
      if (stateMatches) {
        lifecycleStates.push(...stateMatches);
      }
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('exit', async (code, signal) => {
      console.log(`  Exit code: ${code}`);
      console.log(`  Signal: ${signal}`);

      // Wait 2 seconds for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for orphan processes
      const { success, remainingPids } = await waitForChildrenExit(pid, 5000);

      // Verify lifecycle states
      console.log('\n  Lifecycle states observed:');
      lifecycleStates.forEach(state => console.log(`    ${state}`));

      const hasInitializing = lifecycleStates.some(s => s.includes('initializing'));
      const hasRunning = lifecycleStates.some(s => s.includes('running'));
      const hasMonitoring = lifecycleStates.some(s => s.includes('monitoring'));
      const hasCleanup = lifecycleStates.some(s => s.includes('cleanup'));

      console.log('\n  Lifecycle transitions:');
      console.log(`    INITIALIZING: ${hasInitializing ? '✅' : '❌'}`);
      console.log(`    RUNNING: ${hasRunning ? '✅' : '❌'}`);
      console.log(`    MONITORING: ${hasMonitoring ? '✅' : '❌'}`);
      console.log(`    CLEANUP: ${hasCleanup ? '✅' : '❌'}`);

      // Verify no orphan processes
      console.log(`\n  Orphan check: ${success ? '✅ PASS' : '❌ FAIL'}`);
      if (!success) {
        console.log(`  Remaining child processes: ${remainingPids.join(', ')}`);
      }

      // Check for cleanup messages
      const hasCleanupMessage =
        stdout.includes('[Lifecycle] Starting cleanup') ||
        stderr.includes('[Lifecycle] Starting cleanup');
      console.log(`  Cleanup executed: ${hasCleanupMessage ? '✅ PASS' : '❌ FAIL'}`);

      const testPassed = code === 0 && success && hasCleanup && hasCleanupMessage;
      resolve({
        name: 'Successful Completion',
        passed: testPassed,
        details: {
          exitCode: code,
          noOrphans: success,
          lifecycleComplete: hasCleanup,
          cleanupExecuted: hasCleanupMessage,
        },
      });
    });

    child.on('error', error => {
      reject(new Error(`Failed to spawn child: ${error.message}`));
    });
  });
}

/**
 * Test lifecycle: Error during setup (preflight failure)
 */
async function testPreflightFailure() {
  console.log('\n🧪 Test 2: Preflight Failure (Error Scenario)');
  console.log('─'.repeat(60));

  return new Promise((resolve, reject) => {
    // Use non-existent CUJ to trigger preflight failure
    const child = spawn('node', [runCujPath, 'CUJ-999'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = child.pid;
    console.log(`  Child PID: ${pid}`);

    let stdout = '';
    let stderr = '';
    let lifecycleStates = [];

    child.stdout.on('data', data => {
      const output = data.toString();
      stdout += output;

      const stateMatches = output.match(/\[Lifecycle\] (.*)/g);
      if (stateMatches) {
        lifecycleStates.push(...stateMatches);
      }
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('exit', async (code, signal) => {
      console.log(`  Exit code: ${code} (expected non-zero)`);
      console.log(`  Signal: ${signal}`);

      // Wait 2 seconds for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for orphan processes
      const { success, remainingPids } = await waitForChildrenExit(pid, 5000);

      console.log(`  Orphan check: ${success ? '✅ PASS' : '❌ FAIL'}`);
      if (!success) {
        console.log(`  Remaining child processes: ${remainingPids.join(', ')}`);
      }

      // Check for cleanup on error
      const hasCleanupMessage =
        stdout.includes('[Lifecycle] Starting cleanup') ||
        stderr.includes('[Lifecycle] Starting cleanup');
      console.log(`  Cleanup on error: ${hasCleanupMessage ? '✅ PASS' : '❌ FAIL'}`);

      const testPassed = code !== 0 && success && hasCleanupMessage;
      resolve({
        name: 'Preflight Failure',
        passed: testPassed,
        details: {
          exitCode: code,
          noOrphans: success,
          cleanupExecuted: hasCleanupMessage,
        },
      });
    });

    child.on('error', error => {
      reject(new Error(`Failed to spawn child: ${error.message}`));
    });
  });
}

/**
 * Test lifecycle: Timeout scenario
 */
async function testTimeout() {
  console.log('\n🧪 Test 3: Timeout Scenario');
  console.log('─'.repeat(60));

  return new Promise((resolve, reject) => {
    // Spawn a long-running CUJ and kill it after 3 seconds
    const child = spawn('node', [runCujPath, '--simulate', 'CUJ-001'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = child.pid;
    console.log(`  Child PID: ${pid}`);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    // Kill after 3 seconds
    const killTimer = setTimeout(() => {
      console.log('  Sending SIGTERM to child process');
      child.kill('SIGTERM');
    }, 3000);

    child.on('exit', async (code, signal) => {
      clearTimeout(killTimer);
      console.log(`  Exit code: ${code}`);
      console.log(`  Signal: ${signal} (expected SIGTERM)`);

      // Wait 2 seconds for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for orphan processes
      const { success, remainingPids } = await waitForChildrenExit(pid, 5000);

      console.log(`  Orphan check: ${success ? '✅ PASS' : '❌ FAIL'}`);
      if (!success) {
        console.log(`  Remaining child processes: ${remainingPids.join(', ')}`);
      }

      const testPassed = success;
      resolve({
        name: 'Timeout Scenario',
        passed: testPassed,
        details: {
          signal,
          noOrphans: success,
        },
      });
    });

    child.on('error', error => {
      clearTimeout(killTimer);
      reject(new Error(`Failed to spawn child: ${error.message}`));
    });
  });
}

/**
 * Run all lifecycle tests
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  CUJ Lifecycle Correctness Integration Tests              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = [];

  try {
    // Test 1: Successful completion
    const test1 = await testSuccessfulCompletion();
    results.push(test1);

    // Test 2: Preflight failure
    const test2 = await testPreflightFailure();
    results.push(test2);

    // Test 3: Timeout
    const test3 = await testTimeout();
    results.push(test3);

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${result.name}`);
      if (!result.passed) {
        console.log(`    Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n❌ Test suite error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
