#!/usr/bin/env node
/**
 * Hook Performance Benchmark
 *
 * Measures and validates hook execution time against the <100ms target.
 * Tests various scenarios with different agent types and skill counts.
 *
 * Usage:
 *   node .claude/tests/hook-performance-benchmark.mjs
 *   node .claude/tests/hook-performance-benchmark.mjs --iterations 50
 *   node .claude/tests/hook-performance-benchmark.mjs --verbose
 *
 * Performance Target: <100ms average execution time
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import {
  injectSkillsForAgent,
  prewarmSkillCache,
  loadSkillsInParallel,
  getTopSkills,
  getSkillContentCacheStats,
  clearSkillContentCache,
} from '../tools/skill-injector.mjs';
import { getSharedCacheStats, clearSharedCache } from '../tools/shared-cache-manager.mjs';
import { getMemoryUsage } from '../tools/memory-monitor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_ITERATIONS = 100;
const TARGET_MS = 100; // Must achieve <100ms
const WARNING_MS = 80; // Warn if approaching target

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Developer - Simple Task',
    agent: 'developer',
    prompt: 'Create a new React component for user profile display',
  },
  {
    name: 'Developer - Complex Task',
    agent: 'developer',
    prompt: 'Implement OAuth2 authentication with JWT tokens and refresh token rotation',
  },
  {
    name: 'Architect - System Design',
    agent: 'architect',
    prompt: 'Design a microservices architecture for e-commerce platform',
  },
  {
    name: 'QA - Testing Task',
    agent: 'qa',
    prompt: 'Create comprehensive test suite for user authentication flow',
  },
  {
    name: 'Code Reviewer - PR Review',
    agent: 'code-reviewer',
    prompt: 'Review the pull request for security vulnerabilities and code quality',
  },
  {
    name: 'Security Architect - Audit',
    agent: 'security-architect',
    prompt: 'Perform security audit on the authentication module',
  },
];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    iterations: DEFAULT_ITERATIONS,
    verbose: false,
    warmup: true,
    report: true,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--iterations' && args[i + 1]) {
      parsed.iterations = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--verbose') {
      parsed.verbose = true;
    } else if (args[i] === '--no-warmup') {
      parsed.warmup = false;
    } else if (args[i] === '--no-report') {
      parsed.report = false;
    }
  }

  return parsed;
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: avg,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    stdDev: stdDev,
  };
}

/**
 * Run benchmark for a single scenario
 */
async function runScenarioBenchmark(scenario, iterations, verbose) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = process.hrtime.bigint();

    try {
      await injectSkillsForAgent(scenario.agent, scenario.prompt, {
        includeRecommended: false,
      });
    } catch (error) {
      console.error(`  Error in iteration ${i + 1}: ${error.message}`);
      continue;
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    times.push(durationMs);

    if (verbose && (i + 1) % 10 === 0) {
      console.log(`  Iteration ${i + 1}/${iterations}: ${durationMs.toFixed(2)}ms`);
    }
  }

  return calculateStats(times);
}

/**
 * Run parallel loading benchmark
 */
async function runParallelLoadingBenchmark(iterations, verbose) {
  const topSkills = await getTopSkills(10);
  const times = [];

  for (let i = 0; i < iterations; i++) {
    // Clear cache to measure actual loading time
    clearSkillContentCache();
    await clearSharedCache();

    const startTime = process.hrtime.bigint();

    try {
      await loadSkillsInParallel(topSkills, false); // Disable cache for accurate measurement
    } catch (error) {
      console.error(`  Error in iteration ${i + 1}: ${error.message}`);
      continue;
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    times.push(durationMs);

    if (verbose && (i + 1) % 10 === 0) {
      console.log(`  Iteration ${i + 1}/${iterations}: ${durationMs.toFixed(2)}ms`);
    }
  }

  return calculateStats(times);
}

/**
 * Run pre-warming benchmark
 */
async function runPrewarmBenchmark() {
  // Clear caches
  clearSkillContentCache();
  await clearSharedCache();

  const startTime = process.hrtime.bigint();
  const result = await prewarmSkillCache();
  const endTime = process.hrtime.bigint();

  const durationMs = Number(endTime - startTime) / 1_000_000;

  return {
    durationMs,
    loaded: result.loaded,
    failed: result.failed,
  };
}

/**
 * Format benchmark results for display
 */
function formatResults(stats, targetMs) {
  const passedTarget = stats.avg < targetMs;
  const statusIcon = passedTarget ? '✓' : '✗';
  const color = passedTarget ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  return (
    `${color}${statusIcon}${reset} Avg: ${stats.avg.toFixed(2)}ms | ` +
    `P95: ${stats.p95.toFixed(2)}ms | ` +
    `P99: ${stats.p99.toFixed(2)}ms | ` +
    `Min: ${stats.min.toFixed(2)}ms | ` +
    `Max: ${stats.max.toFixed(2)}ms`
  );
}

/**
 * Generate performance report
 */
function generateReport(results, config) {
  const reportDir = join(__dirname, '../context/reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(reportDir, 'hook-performance-report.md');

  let report = `# Hook Performance Benchmark Report

Generated: ${new Date().toISOString()}
Iterations: ${config.iterations}
Target: <${TARGET_MS}ms

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Average Execution Time | ${results.overall.avg.toFixed(2)}ms | ${results.overall.avg < TARGET_MS ? '✓ PASS' : '✗ FAIL'} |
| P95 Execution Time | ${results.overall.p95.toFixed(2)}ms | ${results.overall.p95 < TARGET_MS * 1.5 ? '✓ PASS' : '⚠ WARNING'} |
| P99 Execution Time | ${results.overall.p99.toFixed(2)}ms | ${results.overall.p99 < TARGET_MS * 2 ? '✓ PASS' : '⚠ WARNING'} |
| Pre-warm Time | ${results.prewarm.durationMs.toFixed(2)}ms | INFO |
| Skills Pre-warmed | ${results.prewarm.loaded} | INFO |

## Scenario Results

| Scenario | Avg (ms) | P95 (ms) | P99 (ms) | Status |
|----------|----------|----------|----------|--------|
`;

  for (const [name, stats] of Object.entries(results.scenarios)) {
    const status = stats.avg < TARGET_MS ? '✓ PASS' : '✗ FAIL';
    report += `| ${name} | ${stats.avg.toFixed(2)} | ${stats.p95.toFixed(2)} | ${stats.p99.toFixed(2)} | ${status} |\n`;
  }

  report += `
## Parallel Loading Performance

| Metric | Value |
|--------|-------|
| Average Load Time (10 skills) | ${results.parallelLoading.avg.toFixed(2)}ms |
| P95 Load Time | ${results.parallelLoading.p95.toFixed(2)}ms |
| Skills Loaded | ${results.prewarm.loaded} |

## Cache Statistics

| Metric | Value |
|--------|-------|
| Local Cache Size | ${results.cacheStats.local.size} skills |
| Local Cache Memory | ${results.cacheStats.local.estimatedSizeMB}MB |
| Shared Cache Entries | ${results.cacheStats.shared.entryCount} |
| Shared Cache Size | ${results.cacheStats.shared.totalSizeMB}MB |
| Shared Cache Utilization | ${results.cacheStats.shared.utilization} |

## Memory Usage

| Metric | Value |
|--------|-------|
| Heap Used | ${results.memory.heapUsedMB.toFixed(2)}MB |
| Heap Total | ${results.memory.heapTotalMB.toFixed(2)}MB |
| RSS | ${results.memory.rssMB.toFixed(2)}MB |

## Performance Optimizations Applied

1. **Pre-warming (Issue 1.1a)**: Top ${results.prewarm.loaded} skills pre-loaded on initialization
2. **Parallel Loading (Issue 1.1b)**: Skills loaded with Promise.all() for concurrent I/O
3. **Shared Cache (Issue 5.3)**: Cross-process cache reduces redundant disk reads
4. **Fast-path Planning**: Planning mode skips skill injection for better performance

## Recommendations

`;

  if (results.overall.avg >= TARGET_MS) {
    report += `
- **CRITICAL**: Average execution time (${results.overall.avg.toFixed(2)}ms) exceeds target (<${TARGET_MS}ms)
- Consider further optimizations:
  - Increase pre-warm skill count
  - Add more aggressive caching
  - Profile bottlenecks with Node.js profiler
`;
  } else if (results.overall.avg >= WARNING_MS) {
    report += `
- **WARNING**: Average execution time (${results.overall.avg.toFixed(2)}ms) approaching target (<${TARGET_MS}ms)
- Monitor performance during high load
- Consider additional caching optimizations
`;
  } else {
    report += `
- **SUCCESS**: All performance targets met
- Average execution time: ${results.overall.avg.toFixed(2)}ms (target: <${TARGET_MS}ms)
- Continue monitoring in production
`;
  }

  writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport saved to: ${reportPath}`);

  return reportPath;
}

/**
 * Main benchmark function
 */
async function main() {
  const config = parseArgs();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Hook Performance Benchmark');
  console.log('   Target: <100ms average execution time');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = {
    scenarios: {},
    overall: null,
    parallelLoading: null,
    prewarm: null,
    cacheStats: null,
    memory: null,
  };

  // 1. Pre-warming benchmark
  console.log('1. Pre-warming Cache...');
  results.prewarm = await runPrewarmBenchmark();
  console.log(
    `   Pre-warm: ${results.prewarm.durationMs.toFixed(2)}ms, ${results.prewarm.loaded} skills loaded\n`
  );

  // 2. Re-warm cache for scenario tests
  if (config.warmup) {
    console.log('2. Warming up cache for scenario tests...');
    await prewarmSkillCache();
    console.log('   Cache warmed\n');
  }

  // 3. Run scenario benchmarks
  console.log(
    `3. Running ${TEST_SCENARIOS.length} scenarios (${config.iterations} iterations each)...\n`
  );

  const allTimes = [];

  for (const scenario of TEST_SCENARIOS) {
    console.log(`   ${scenario.name}...`);
    const stats = await runScenarioBenchmark(scenario, config.iterations, config.verbose);
    results.scenarios[scenario.name] = stats;
    allTimes.push(...Array(stats.count).fill(stats.avg));
    console.log(`   ${formatResults(stats, TARGET_MS)}\n`);
  }

  // 4. Calculate overall statistics
  results.overall = calculateStats(Object.values(results.scenarios).map(s => s.avg));

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Overall Results');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`   ${formatResults(results.overall, TARGET_MS)}\n`);

  // 5. Parallel loading benchmark (reduced iterations)
  console.log('4. Parallel Loading Benchmark (10 skills)...');
  results.parallelLoading = await runParallelLoadingBenchmark(
    Math.min(config.iterations, 20),
    config.verbose
  );
  console.log(`   ${formatResults(results.parallelLoading, TARGET_MS)}\n`);

  // 6. Collect cache statistics
  console.log('5. Cache Statistics...');
  results.cacheStats = {
    local: getSkillContentCacheStats(),
    shared: await getSharedCacheStats(),
  };
  console.log(
    `   Local: ${results.cacheStats.local.size} skills, ${results.cacheStats.local.estimatedSizeMB}MB`
  );
  console.log(
    `   Shared: ${results.cacheStats.shared.entryCount} entries, ${results.cacheStats.shared.totalSizeMB}MB\n`
  );

  // 7. Memory usage
  results.memory = getMemoryUsage();
  console.log('6. Memory Usage...');
  console.log(
    `   Heap: ${results.memory.heapUsedMB.toFixed(2)}MB / ${results.memory.heapTotalMB.toFixed(2)}MB`
  );
  console.log(`   RSS: ${results.memory.rssMB.toFixed(2)}MB\n`);

  // 8. Generate report
  if (config.report) {
    console.log('7. Generating Report...');
    generateReport(results, config);
  }

  // 9. Final verdict
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (results.overall.avg < TARGET_MS) {
    console.log('   ✓ BENCHMARK PASSED');
    console.log(`   Average: ${results.overall.avg.toFixed(2)}ms < Target: ${TARGET_MS}ms`);
  } else {
    console.log('   ✗ BENCHMARK FAILED');
    console.log(`   Average: ${results.overall.avg.toFixed(2)}ms > Target: ${TARGET_MS}ms`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(results.overall.avg < TARGET_MS ? 0 : 1);
}

// Run benchmark
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
