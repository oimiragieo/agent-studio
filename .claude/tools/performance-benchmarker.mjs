#!/usr/bin/env node
/**
 * CUJ Performance Benchmarking System
 * Tracks execution time, resource usage, and performance metrics for CUJ validation
 *
 * @module performance-benchmarker
 * @description Provides comprehensive performance tracking for Customer User Journey (CUJ) execution
 *
 * Usage:
 *   import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';
 *
 *   const benchmarker = new PerformanceBenchmarker();
 *   const benchmark = await benchmarker.startBenchmark('CUJ-001');
 *   benchmarker.recordStep(benchmark, 1, { action: 'parse_workflow' });
 *   const report = await benchmarker.endBenchmark(benchmark);
 *
 * CLI:
 *   node .claude/tools/performance-benchmarker.mjs stats
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @typedef {Object} BenchmarkStep
 * @property {number} step - Step number
 * @property {number} timestamp - Unix timestamp when step completed
 * @property {number} duration_ms - Duration from benchmark start to this step
 * @property {Object} memory - Node.js memory usage object
 * @property {number} memory.heapUsed - Heap memory used in bytes
 * @property {number} memory.heapTotal - Total heap memory in bytes
 * @property {number} memory.external - External memory in bytes
 * @property {number} memory.rss - Resident set size in bytes
 */

/**
 * @typedef {Object} Benchmark
 * @property {string} cuj_id - CUJ identifier
 * @property {number} start_time - Benchmark start timestamp
 * @property {Object} start_memory - Memory usage at start
 * @property {BenchmarkStep[]} steps - Array of step records
 * @property {number} [end_time] - Benchmark end timestamp
 * @property {number} [total_duration_ms] - Total execution duration
 * @property {Object} [end_memory] - Memory usage at end
 */

/**
 * @typedef {Object} PerformanceReport
 * @property {string} cuj_id - CUJ identifier
 * @property {string} total_time - Total execution time formatted
 * @property {number} steps_count - Number of steps executed
 * @property {string} avg_step_time - Average time per step formatted
 * @property {string} memory_used - Memory consumed formatted
 * @property {Object} slowest_step - Slowest step details
 * @property {number} slowest_step.step - Step number
 * @property {string} slowest_step.duration - Duration formatted
 */

/**
 * CUJ Performance Benchmarking System
 *
 * Tracks and analyzes performance metrics for Customer User Journey execution.
 * Provides step-level timing, memory usage tracking, and aggregated statistics.
 */
export class PerformanceBenchmarker {
  /**
   * Initialize benchmarker with metrics file path
   */
  constructor() {
    // Use forward slashes for cross-platform compatibility
    const projectRoot = join(__dirname, '..', '..');
    this.metricsFile = join(projectRoot, '.claude', 'context', 'performance', 'cuj-metrics.json');
    this.performanceDir = join(projectRoot, '.claude', 'context', 'performance');
  }

  /**
   * Ensure performance directory exists
   * @private
   */
  async _ensureDirectory() {
    if (!existsSync(this.performanceDir)) {
      await mkdir(this.performanceDir, { recursive: true });
    }
  }

  /**
   * Start benchmarking a CUJ execution
   *
   * @param {string} cujId - CUJ identifier (e.g., 'CUJ-001')
   * @returns {Benchmark} Benchmark object for tracking
   *
   * @example
   * const benchmark = await benchmarker.startBenchmark('CUJ-001');
   */
  async startBenchmark(cujId) {
    await this._ensureDirectory();

    return {
      cuj_id: cujId,
      start_time: Date.now(),
      start_memory: process.memoryUsage(),
      steps: []
    };
  }

  /**
   * Record step completion with timing and memory metrics
   *
   * @param {Benchmark} benchmark - Active benchmark object
   * @param {number} stepNumber - Step number/sequence
   * @param {Object} stepData - Additional step metadata
   *
   * @example
   * benchmarker.recordStep(benchmark, 1, {
   *   action: 'parse_workflow',
   *   agent: 'planner'
   * });
   */
  recordStep(benchmark, stepNumber, stepData = {}) {
    const now = Date.now();

    benchmark.steps.push({
      step: stepNumber,
      timestamp: now,
      duration_ms: now - benchmark.start_time,
      memory: process.memoryUsage(),
      ...stepData
    });
  }

  /**
   * End benchmarking and save metrics
   *
   * @param {Benchmark} benchmark - Completed benchmark object
   * @returns {Promise<PerformanceReport>} Performance report
   *
   * @example
   * const report = await benchmarker.endBenchmark(benchmark);
   * console.log(report.total_time); // "5.42s"
   */
  async endBenchmark(benchmark) {
    benchmark.end_time = Date.now();
    benchmark.total_duration_ms = benchmark.end_time - benchmark.start_time;
    benchmark.end_memory = process.memoryUsage();

    await this.saveMetrics(benchmark);
    return this.generateReport(benchmark);
  }

  /**
   * Save metrics to file (append mode)
   *
   * @param {Benchmark} benchmark - Benchmark to save
   * @private
   */
  async saveMetrics(benchmark) {
    try {
      await this._ensureDirectory();

      let metrics = [];

      // Load existing metrics if file exists
      if (existsSync(this.metricsFile)) {
        try {
          const content = await readFile(this.metricsFile, 'utf-8');
          metrics = JSON.parse(content);

          if (!Array.isArray(metrics)) {
            console.warn('Metrics file is not an array, resetting...');
            metrics = [];
          }
        } catch (parseError) {
          console.warn('Failed to parse metrics file, starting fresh:', parseError.message);
          metrics = [];
        }
      }

      // Append new benchmark
      metrics.push({
        ...benchmark,
        saved_at: new Date().toISOString()
      });

      // Write back to file
      await writeFile(this.metricsFile, JSON.stringify(metrics, null, 2), 'utf-8');

    } catch (error) {
      console.error('Failed to save metrics:', error.message);
      throw error;
    }
  }

  /**
   * Generate performance report from benchmark
   *
   * @param {Benchmark} benchmark - Completed benchmark
   * @returns {PerformanceReport} Formatted performance report
   */
  generateReport(benchmark) {
    const totalTimeSeconds = (benchmark.total_duration_ms / 1000).toFixed(2);
    const avgStepTimeSeconds = benchmark.steps.length > 0
      ? (benchmark.total_duration_ms / benchmark.steps.length / 1000).toFixed(2)
      : '0.00';

    const memoryUsedMB = benchmark.end_memory && benchmark.start_memory
      ? ((benchmark.end_memory.heapUsed - benchmark.start_memory.heapUsed) / 1024 / 1024).toFixed(2)
      : '0.00';

    return {
      cuj_id: benchmark.cuj_id,
      total_time: `${totalTimeSeconds}s`,
      steps_count: benchmark.steps.length,
      avg_step_time: `${avgStepTimeSeconds}s`,
      memory_used: `${memoryUsedMB} MB`,
      slowest_step: this.findSlowestStep(benchmark.steps)
    };
  }

  /**
   * Find step with longest duration
   *
   * @param {BenchmarkStep[]} steps - Array of step records
   * @returns {Object} Slowest step details
   * @returns {number} return.step - Step number
   * @returns {string} return.duration - Duration formatted
   */
  findSlowestStep(steps) {
    if (steps.length === 0) {
      return { step: 0, duration: '0.00s' };
    }

    if (steps.length === 1) {
      return {
        step: steps[0].step,
        duration: `${(steps[0].duration_ms / 1000).toFixed(2)}s`
      };
    }

    let slowestStep = null;
    let maxDuration = 0;

    // Calculate duration between consecutive steps
    for (let i = 1; i < steps.length; i++) {
      const stepDuration = steps[i].duration_ms - steps[i - 1].duration_ms;

      if (stepDuration > maxDuration) {
        maxDuration = stepDuration;
        slowestStep = steps[i];
      }
    }

    // Also check first step
    const firstStepDuration = steps[0].duration_ms;
    if (firstStepDuration > maxDuration) {
      maxDuration = firstStepDuration;
      slowestStep = steps[0];
    }

    return {
      step: slowestStep.step,
      duration: `${(maxDuration / 1000).toFixed(2)}s`,
      action: slowestStep.action || 'unknown'
    };
  }

  /**
   * Get performance statistics across all CUJs
   *
   * @returns {Promise<Object>} Aggregated statistics
   * @returns {number} return.total_cujs - Total CUJs benchmarked
   * @returns {string} return.avg_execution_time - Average execution time
   * @returns {string} return.min_execution_time - Minimum execution time
   * @returns {string} return.max_execution_time - Maximum execution time
   * @returns {string} return.avg_memory_usage - Average memory usage
   * @returns {Object} return.most_common_slowest_step - Most frequent slowest step
   *
   * @example
   * const stats = await benchmarker.getStatistics();
   * console.log(`Average time: ${stats.avg_execution_time}`);
   */
  async getStatistics() {
    try {
      if (!existsSync(this.metricsFile)) {
        return {
          total_cujs: 0,
          avg_execution_time: '0.00s',
          min_execution_time: '0.00s',
          max_execution_time: '0.00s',
          avg_memory_usage: '0.00 MB',
          most_common_slowest_step: { step: 0, count: 0 }
        };
      }

      const content = await readFile(this.metricsFile, 'utf-8');
      const metrics = JSON.parse(content);

      if (!Array.isArray(metrics) || metrics.length === 0) {
        return {
          total_cujs: 0,
          avg_execution_time: '0.00s',
          min_execution_time: '0.00s',
          max_execution_time: '0.00s',
          avg_memory_usage: '0.00 MB',
          most_common_slowest_step: { step: 0, count: 0 }
        };
      }

      // Calculate aggregated statistics
      const totalCujs = metrics.length;
      const executionTimes = metrics.map(m => m.total_duration_ms);
      const avgTime = executionTimes.reduce((sum, t) => sum + t, 0) / totalCujs;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);

      // Calculate average memory usage
      const memoryUsages = metrics
        .filter(m => m.end_memory && m.start_memory)
        .map(m => (m.end_memory.heapUsed - m.start_memory.heapUsed) / 1024 / 1024);

      const avgMemory = memoryUsages.length > 0
        ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
        : 0;

      // Find most common slowest step
      const slowestSteps = {};
      metrics.forEach(m => {
        const report = this.generateReport(m);
        const step = report.slowest_step.step;
        slowestSteps[step] = (slowestSteps[step] || 0) + 1;
      });

      const mostCommonStep = Object.entries(slowestSteps)
        .sort((a, b) => b[1] - a[1])[0] || [0, 0];

      return {
        total_cujs: totalCujs,
        avg_execution_time: `${(avgTime / 1000).toFixed(2)}s`,
        min_execution_time: `${(minTime / 1000).toFixed(2)}s`,
        max_execution_time: `${(maxTime / 1000).toFixed(2)}s`,
        avg_memory_usage: `${avgMemory.toFixed(2)} MB`,
        median_execution_time: `${(this._calculateMedian(executionTimes) / 1000).toFixed(2)}s`,
        p95_execution_time: `${(this._calculatePercentile(executionTimes, 95) / 1000).toFixed(2)}s`,
        most_common_slowest_step: {
          step: parseInt(mostCommonStep[0]),
          count: mostCommonStep[1],
          percentage: `${((mostCommonStep[1] / totalCujs) * 100).toFixed(1)}%`
        }
      };

    } catch (error) {
      console.error('Failed to calculate statistics:', error.message);
      throw error;
    }
  }

  /**
   * Calculate median value from array of numbers
   * @private
   */
  _calculateMedian(values) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate percentile value from array of numbers
   * @private
   */
  _calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[index];
  }
}

/**
 * CLI interface for performance benchmarker
 */
async function runCLI() {
  const command = process.argv[2];
  const benchmarker = new PerformanceBenchmarker();

  try {
    if (command === 'stats') {
      const stats = await benchmarker.getStatistics();
      console.log(JSON.stringify(stats, null, 2));
    } else if (command === 'help' || !command) {
      console.log(`
Performance Benchmarker CLI

Usage:
  node .claude/tools/performance-benchmarker.mjs <command>

Commands:
  stats     Show aggregated performance statistics
  help      Show this help message

Programmatic Usage:
  import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';

  const benchmarker = new PerformanceBenchmarker();
  const benchmark = await benchmarker.startBenchmark('CUJ-001');
  benchmarker.recordStep(benchmark, 1, { action: 'parse_workflow' });
  const report = await benchmarker.endBenchmark(benchmark);
      `);
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Run with "help" for usage information');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runCLI();
}
