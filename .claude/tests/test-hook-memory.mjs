#!/usr/bin/env node
/**
 * Hook Memory Profiling Tests
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
const ITERATIONS = parseInt(args.find(a => a.startsWith('--iterations'))?.split('=')[1] || '100');
const HOOK_FILTER = args.includes('--hook') ? args[args.indexOf('--hook') + 1] : null;

const THRESHOLDS = {
  maxGrowthPer100: 5 * 1024 * 1024,
  maxTotalGrowth: 20 * 1024 * 1024,
  warningGrowth: 2 * 1024 * 1024,
};

const HOOKS_TO_TEST = [
  {
    name: 'security-pre-tool.mjs',
    input: { tool_name: 'Bash', tool_input: { command: 'git status' } },
  },
  {
    name: 'orchestrator-enforcement-pre-tool.mjs',
    input: { tool_name: 'Write', tool_input: { file_path: 'test.txt' } },
    env: { CLAUDE_AGENT_ROLE: 'developer' },
  },
  {
    name: 'file-path-validator.js',
    input: { tool_name: 'Write', tool_input: { file_path: '.claude/test.md' } },
  },
  {
    name: 'audit-post-tool.mjs',
    input: { tool_name: 'Bash', tool_input: { command: 'git status' } },
  },
  {
    name: 'post-session-cleanup.js',
    input: { tool_name: 'Write', tool_input: { file_path: '.claude/test.md' } },
  },
];

async function runHook(hookPath, input, env = {}) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const proc = spawn('node', [hookPath], { env: { ...process.env, ...env } });
    let stdout = '',
      stderr = '';
    proc.stdout.on('data', c => {
      stdout += c;
    });
    proc.stderr.on('data', c => {
      stderr += c;
    });
    proc.on('error', () => resolve({ success: false, duration: performance.now() - startTime }));
    proc.on('close', code =>
      resolve({ success: code === 0, duration: performance.now() - startTime })
    );
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function testHookMemory(hookName, input, env = {}) {
  const hookPath = join(HOOKS_DIR, hookName);
  try {
    await access(hookPath);
  } catch {
    return { skipped: true, reason: 'File not found' };
  }

  console.log('\nTesting: ' + hookName);
  console.log('Iterations: ' + ITERATIONS);

  if (global.gc) global.gc();

  const baselineHeap = process.memoryUsage().heapUsed;
  const samples = [];
  const durations = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const result = await runHook(hookPath, input, env);
    durations.push(result.duration);
    if (i % 10 === 0) {
      const heap = process.memoryUsage().heapUsed;
      samples.push({ iteration: i, heap, growth: heap - baselineHeap });
      process.stdout.write('.');
    }
  }

  if (global.gc) global.gc();
  const finalHeap = process.memoryUsage().heapUsed;
  const totalGrowth = finalHeap - baselineHeap;

  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  const result = {
    hookName,
    iterations: ITERATIONS,
    baselineHeap: formatBytes(baselineHeap),
    finalHeap: formatBytes(finalHeap),
    totalGrowth: formatBytes(totalGrowth),
    growthPerCall: formatBytes(totalGrowth / ITERATIONS),
    performance: { p50: p50.toFixed(1), p95: p95.toFixed(1), p99: p99.toFixed(1) },
    memoryLeak: totalGrowth > THRESHOLDS.maxTotalGrowth,
    warning: totalGrowth > THRESHOLDS.warningGrowth,
    samples,
  };

  console.log('\n  Growth: ' + result.totalGrowth + ' (' + result.growthPerCall + '/call)');
  console.log(
    '  Perf: p50=' + p50.toFixed(1) + 'ms p95=' + p95.toFixed(1) + 'ms p99=' + p99.toFixed(1) + 'ms'
  );
  console.log('  Status: ' + (result.memoryLeak ? 'LEAK' : result.warning ? 'WARN' : 'OK'));
  return result;
}

async function main() {
  console.log('HOOK MEMORY PROFILING - ' + new Date().toISOString());
  console.log(
    'Iterations: ' + ITERATIONS + ', Threshold: ' + formatBytes(THRESHOLDS.maxTotalGrowth)
  );

  try {
    await mkdir(RESULTS_DIR, { recursive: true });
  } catch {}

  const results = { timestamp: new Date().toISOString(), iterations: ITERATIONS, hooks: {} };
  let leaksDetected = 0,
    warnings = 0;

  for (const hook of HOOKS_TO_TEST) {
    if (HOOK_FILTER && !hook.name.includes(HOOK_FILTER)) continue;
    const result = await testHookMemory(hook.name, hook.input, hook.env);
    results.hooks[hook.name] = result;
    if (result.memoryLeak) leaksDetected++;
    if (result.warning) warnings++;
  }

  console.log(
    '\nSUMMARY: ' +
      Object.keys(results.hooks).length +
      ' hooks, ' +
      leaksDetected +
      ' leaks, ' +
      warnings +
      ' warnings'
  );
  for (const [name, r] of Object.entries(results.hooks)) {
    if (r.skipped) continue;
    console.log('  ' + (r.memoryLeak ? '[LEAK]' : r.warning ? '[WARN]' : '[OK]') + ' ' + name);
  }

  const path = join(RESULTS_DIR, 'memory-' + Date.now() + '.json');
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log('Results: ' + path);
  process.exit(leaksDetected > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
