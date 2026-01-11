#!/usr/bin/env node
/**
 * Performance Benchmarker Example
 * Demonstrates how to use the performance benchmarking system
 */

import { PerformanceBenchmarker } from '../performance-benchmarker.mjs';

async function exampleBasicUsage() {
  console.log('=== Basic Usage Example ===\n');

  const benchmarker = new PerformanceBenchmarker();

  // Start benchmark
  const benchmark = await benchmarker.startBenchmark('CUJ-001');
  console.log('✓ Started benchmark for CUJ-001');

  // Simulate workflow steps
  await simulateWork(100);
  benchmarker.recordStep(benchmark, 1, {
    action: 'parse_workflow',
    agent: 'planner'
  });
  console.log('✓ Recorded step 1: parse_workflow');

  await simulateWork(200);
  benchmarker.recordStep(benchmark, 2, {
    action: 'validate_schema',
    agent: 'qa'
  });
  console.log('✓ Recorded step 2: validate_schema');

  await simulateWork(150);
  benchmarker.recordStep(benchmark, 3, {
    action: 'execute_agent',
    agent: 'developer'
  });
  console.log('✓ Recorded step 3: execute_agent');

  // End benchmark and get report
  const report = await benchmarker.endBenchmark(benchmark);
  console.log('\n=== Performance Report ===');
  console.log(JSON.stringify(report, null, 2));
}

async function exampleWithMetadata() {
  console.log('\n\n=== Enhanced Metadata Example ===\n');

  const benchmarker = new PerformanceBenchmarker();

  const benchmark = await benchmarker.startBenchmark('CUJ-002');

  await simulateWork(50);
  benchmarker.recordStep(benchmark, 1, {
    action: 'load_workflow',
    agent: 'orchestrator',
    workflow: 'greenfield-workflow.yaml',
    file_size: '1.2 KB'
  });

  await simulateWork(300);
  benchmarker.recordStep(benchmark, 2, {
    action: 'run_validation',
    agent: 'qa',
    tests_run: 15,
    tests_passed: 15
  });

  await simulateWork(100);
  benchmarker.recordStep(benchmark, 3, {
    action: 'generate_report',
    agent: 'technical-writer',
    report_type: 'markdown'
  });

  const report = await benchmarker.endBenchmark(benchmark);
  console.log('Performance Report with Metadata:');
  console.log(JSON.stringify(report, null, 2));
}

async function exampleAggregatedStats() {
  console.log('\n\n=== Aggregated Statistics Example ===\n');

  const benchmarker = new PerformanceBenchmarker();

  // Get overall statistics
  const stats = await benchmarker.getStatistics();
  console.log('Overall Performance Statistics:');
  console.log(JSON.stringify(stats, null, 2));

  // Performance insights
  console.log('\n=== Performance Insights ===');
  console.log(`Total CUJs benchmarked: ${stats.total_cujs}`);
  console.log(`Average execution time: ${stats.avg_execution_time}`);
  console.log(`Fastest execution: ${stats.min_execution_time}`);
  console.log(`Slowest execution: ${stats.max_execution_time}`);
  console.log(`95th percentile: ${stats.p95_execution_time}`);
  console.log(`Most common bottleneck: Step ${stats.most_common_slowest_step.step} (${stats.most_common_slowest_step.percentage})`);
}

async function exampleErrorHandling() {
  console.log('\n\n=== Error Handling Example ===\n');

  const benchmarker = new PerformanceBenchmarker();
  const benchmark = await benchmarker.startBenchmark('CUJ-003');

  try {
    benchmarker.recordStep(benchmark, 1, { action: 'start_workflow' });
    await simulateWork(100);

    // Simulate error during workflow
    throw new Error('Simulated workflow failure');

  } catch (error) {
    console.log(`✗ Error occurred: ${error.message}`);
    console.log('✓ Still saving benchmark metrics...');

    // Important: Still end benchmark to capture partial metrics
    const report = await benchmarker.endBenchmark(benchmark);
    console.log('\nPartial Performance Report:');
    console.log(JSON.stringify(report, null, 2));
  }
}

// Utility function to simulate work
function simulateWork(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run examples
async function runExamples() {
  try {
    await exampleBasicUsage();
    await exampleWithMetadata();
    await exampleAggregatedStats();
    await exampleErrorHandling();

    console.log('\n\n✅ All examples completed successfully!');
    console.log('\nNext steps:');
    console.log('- View aggregated stats: node .claude/tools/performance-benchmarker.mjs stats');
    console.log('- Check metrics file: .claude/context/performance/cuj-metrics.json');
    console.log('- Read documentation: .claude/docs/PERFORMANCE_BENCHMARKING.md');

  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

runExamples();
