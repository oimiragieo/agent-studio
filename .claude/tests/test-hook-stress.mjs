#!/usr/bin/env node
/**
 * Hook Stress Testing
 */

import { spawn } from 'child_process';
import { writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOKS_DIR = join(__dirname, '..', 'hooks');
const RESULTS_DIR = join(__dirname, '..', 'context', 'test-results');

const args = process.argv.slice(2);
const RAPID_CALLS = parseInt(args.find(a => a.startsWith('--rapid'))?.split('=')[1] || '100');
const CONCURRENT = parseInt(args.find(a => a.startsWith('--concurrent'))?.split('=')[1] || '10');

const HOOKS_TO_STRESS = [
  {
    name: 'security-pre-tool.mjs',
    input: { tool_name: 'Bash', tool_input: { command: 'git status' } },
  },
  {
    name: 'file-path-validator.js',
    input: { tool_name: 'Write', tool_input: { file_path: '.claude/test.md' } },
  },
  {
    name: 'audit-post-tool.mjs',
    input: { tool_name: 'Bash', tool_input: { command: 'git status' } },
  },
];

async function runHook(hookPath, input, timeout = 5000) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const proc = spawn('node', [hookPath], { env: process.env });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);
    let stdout = '';
    proc.stdout.on('data', c => {
      stdout += c;
    });
    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ success: false, timedOut: false, duration: performance.now() - startTime });
    });
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({
        success: code === 0 && !timedOut,
        timedOut,
        duration: performance.now() - startTime,
      });
    });
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

async function stressTestRapid(hookName, input) {
  const hookPath = join(HOOKS_DIR, hookName);
  try {
    await access(hookPath);
  } catch {
    return { skipped: true };
  }

  console.log('\nRapid: ' + hookName + ' (' + RAPID_CALLS + ' calls)');
  const results = [];
  const startTime = performance.now();

  for (let i = 0; i < RAPID_CALLS; i++) {
    const r = await runHook(hookPath, input);
    results.push(r);
    if ((i + 1) % 20 === 0) process.stdout.write('.');
  }

  const totalTime = performance.now() - startTime;
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const failures = results.filter(r => !r.success).length;

  return {
    hookName,
    testType: 'rapid',
    totalCalls: RAPID_CALLS,
    throughput: (RAPID_CALLS / (totalTime / 1000)).toFixed(1) + ' calls/sec',
    failures,
    failureRate: ((failures / RAPID_CALLS) * 100).toFixed(2) + '%',
    p50: durations[Math.floor(durations.length * 0.5)].toFixed(1),
    p99: durations[Math.floor(durations.length * 0.99)].toFixed(1),
    passed: failures / RAPID_CALLS <= 0.01 && durations[Math.floor(durations.length * 0.99)] <= 500,
  };
}

async function stressTestConcurrent(hookName, input) {
  const hookPath = join(HOOKS_DIR, hookName);
  try {
    await access(hookPath);
  } catch {
    return { skipped: true };
  }

  console.log('\nConcurrent: ' + hookName + ' (' + CONCURRENT + ' parallel)');
  const startTime = performance.now();
  const promises = Array(CONCURRENT)
    .fill(null)
    .map(() => runHook(hookPath, input));
  const results = await Promise.all(promises);
  const failures = results.filter(r => !r.success).length;
  const durations = results.map(r => r.duration).sort((a, b) => a - b);

  return {
    hookName,
    testType: 'concurrent',
    concurrency: CONCURRENT,
    totalTime: (performance.now() - startTime).toFixed(0) + 'ms',
    failures,
    maxDuration: durations[durations.length - 1].toFixed(1),
    avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1),
    passed: failures === 0,
  };
}

async function main() {
  console.log('HOOK STRESS TESTING - ' + new Date().toISOString());
  console.log('Rapid: ' + RAPID_CALLS + ', Concurrent: ' + CONCURRENT);

  try {
    await mkdir(RESULTS_DIR, { recursive: true });
  } catch {}

  const results = { timestamp: new Date().toISOString(), rapid: {}, concurrent: {} };
  let failedTests = 0;

  for (const hook of HOOKS_TO_STRESS) {
    const rapid = await stressTestRapid(hook.name, hook.input);
    results.rapid[hook.name] = rapid;
    if (rapid.passed === false) failedTests++;
    console.log(' ' + (rapid.passed ? '[PASS]' : '[FAIL]') + ' ' + rapid.throughput);

    const concurrent = await stressTestConcurrent(hook.name, hook.input);
    results.concurrent[hook.name] = concurrent;
    if (concurrent.passed === false) failedTests++;
    console.log(
      ' ' + (concurrent.passed ? '[PASS]' : '[FAIL]') + ' ' + concurrent.avgDuration + 'ms avg'
    );
  }

  console.log('\nSUMMARY: ' + failedTests + ' tests failed');
  const path = join(RESULTS_DIR, 'stress-' + Date.now() + '.json');
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log('Results: ' + path);
  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
