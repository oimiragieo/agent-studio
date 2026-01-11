#!/usr/bin/env node
/**
 * Metrics Tracker for CUJ Success Rates
 * Tracks CUJ execution success/failure rates with historical trending
 *
 * Usage:
 *   import { recordCujExecution, getCujSuccessRate, getCujMetrics } from './metrics-tracker.mjs';
 *
 *   recordCujExecution('CUJ-005', true, 1234, null);
 *   const rate = getCujSuccessRate('CUJ-005', 86400000); // Last 24 hours
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const metricsFile = path.join(projectRoot, '.claude/context/analytics/cuj-metrics.jsonl');

/**
 * Sanitize error messages (remove sensitive data)
 * @param {string} message - Error message
 * @returns {string} Sanitized message
 */
function sanitize(message) {
  if (!message) return null;

  // Remove file paths
  message = message.replace(/[A-Z]:\\[\w\\/.-]+/g, '[PATH]');
  message = message.replace(/\/[\w\\/.-]+/g, '[PATH]');

  // Remove tokens
  message = message.replace(/Bearer [A-Za-z0-9_-]+/g, 'Bearer [REDACTED]');
  message = message.replace(/token[=:]\s*[A-Za-z0-9_-]+/gi, 'token=[REDACTED]');

  return message.substring(0, 500); // Limit length
}

/**
 * Ensure metrics directory exists
 */
function ensureMetricsDir() {
  const dir = path.dirname(metricsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Record a CUJ execution
 * @param {string} cujId - CUJ identifier
 * @param {boolean} success - Whether execution succeeded
 * @param {number} duration - Duration in milliseconds
 * @param {Error|string|null} error - Error object or message
 * @param {Object} metadata - Additional metadata
 */
export function recordCujExecution(cujId, success, duration, error = null, metadata = {}) {
  ensureMetricsDir();

  const metric = {
    timestamp: new Date().toISOString(),
    cuj_id: cujId,
    success: success,
    duration_ms: duration,
    error: error ? sanitize(error.message || error.toString()) : null,
    metadata: metadata
  };

  try {
    fs.appendFileSync(metricsFile, JSON.stringify(metric) + '\n');
  } catch (err) {
    console.error(`[MetricsTracker] Failed to record metric: ${err.message}`);
  }
}

/**
 * Load metrics from file
 * @param {string|null} cujId - Filter by CUJ ID (optional)
 * @param {number|null} timeWindow - Time window in milliseconds (optional)
 * @returns {Array<Object>} Array of metrics
 */
function loadMetrics(cujId = null, timeWindow = null) {
  if (!fs.existsSync(metricsFile)) {
    return [];
  }

  const lines = fs.readFileSync(metricsFile, 'utf-8').split('\n').filter(l => l.trim());
  const metrics = [];
  const now = Date.now();

  for (const line of lines) {
    try {
      const metric = JSON.parse(line);

      // Filter by CUJ ID
      if (cujId && metric.cuj_id !== cujId) continue;

      // Filter by time window
      if (timeWindow) {
        const metricTime = new Date(metric.timestamp).getTime();
        if (now - metricTime > timeWindow) continue;
      }

      metrics.push(metric);
    } catch (error) {
      // Skip malformed lines
      continue;
    }
  }

  return metrics;
}

/**
 * Get CUJ success rate
 * @param {string} cujId - CUJ identifier
 * @param {number} timeWindow - Time window in milliseconds (default: 24 hours)
 * @returns {Object} Success rate statistics
 */
export function getCujSuccessRate(cujId, timeWindow = 86400000) {
  const metrics = loadMetrics(cujId, timeWindow);

  if (metrics.length === 0) {
    return {
      cuj_id: cujId,
      total: 0,
      successful: 0,
      failed: 0,
      rate: 0,
      avg_duration_ms: 0,
      time_window_ms: timeWindow
    };
  }

  const total = metrics.length;
  const successful = metrics.filter(m => m.success).length;
  const failed = total - successful;
  const totalDuration = metrics.reduce((sum, m) => sum + (m.duration_ms || 0), 0);

  return {
    cuj_id: cujId,
    total,
    successful,
    failed,
    rate: successful / total,
    avg_duration_ms: totalDuration / total,
    time_window_ms: timeWindow,
    window_start: new Date(Date.now() - timeWindow).toISOString(),
    window_end: new Date().toISOString()
  };
}

/**
 * Get all CUJ metrics
 * @param {number} timeWindow - Time window in milliseconds (default: 24 hours)
 * @returns {Object} Metrics by CUJ ID
 */
export function getAllCujMetrics(timeWindow = 86400000) {
  const allMetrics = loadMetrics(null, timeWindow);
  const cujIds = [...new Set(allMetrics.map(m => m.cuj_id))];

  const result = {};
  for (const cujId of cujIds) {
    result[cujId] = getCujSuccessRate(cujId, timeWindow);
  }

  return result;
}

/**
 * Get trending data for a CUJ
 * @param {string} cujId - CUJ identifier
 * @param {number} buckets - Number of time buckets (default: 24)
 * @param {number} bucketSize - Size of each bucket in milliseconds (default: 1 hour)
 * @returns {Array<Object>} Trending data
 */
export function getCujTrending(cujId, buckets = 24, bucketSize = 3600000) {
  const totalTimeWindow = buckets * bucketSize;
  const metrics = loadMetrics(cujId, totalTimeWindow);
  const now = Date.now();

  const trending = [];
  for (let i = buckets - 1; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketSize;
    const bucketEnd = now - i * bucketSize;

    const bucketMetrics = metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime();
      return metricTime >= bucketStart && metricTime < bucketEnd;
    });

    const total = bucketMetrics.length;
    const successful = bucketMetrics.filter(m => m.success).length;

    trending.push({
      bucket_start: new Date(bucketStart).toISOString(),
      bucket_end: new Date(bucketEnd).toISOString(),
      total,
      successful,
      failed: total - successful,
      rate: total > 0 ? successful / total : 0
    });
  }

  return trending;
}

/**
 * Get failure analysis for a CUJ
 * @param {string} cujId - CUJ identifier
 * @param {number} timeWindow - Time window in milliseconds (default: 24 hours)
 * @returns {Object} Failure analysis
 */
export function getFailureAnalysis(cujId, timeWindow = 86400000) {
  const metrics = loadMetrics(cujId, timeWindow);
  const failures = metrics.filter(m => !m.success);

  const errorCounts = {};
  for (const failure of failures) {
    const error = failure.error || 'Unknown error';
    errorCounts[error] = (errorCounts[error] || 0) + 1;
  }

  // Sort by frequency
  const topErrors = Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    cuj_id: cujId,
    total_failures: failures.length,
    unique_errors: Object.keys(errorCounts).length,
    top_errors: topErrors,
    recent_failures: failures.slice(-5).map(f => ({
      timestamp: f.timestamp,
      error: f.error,
      duration_ms: f.duration_ms
    }))
  };
}

/**
 * Get performance percentiles for a CUJ
 * @param {string} cujId - CUJ identifier
 * @param {number} timeWindow - Time window in milliseconds (default: 24 hours)
 * @returns {Object} Performance percentiles
 */
export function getPerformancePercentiles(cujId, timeWindow = 86400000) {
  const metrics = loadMetrics(cujId, timeWindow);
  const durations = metrics.map(m => m.duration_ms).sort((a, b) => a - b);

  if (durations.length === 0) {
    return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
  }

  const percentile = (p) => {
    const index = Math.ceil((p / 100) * durations.length) - 1;
    return durations[Math.max(0, index)];
  };

  return {
    cuj_id: cujId,
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
    min: durations[0],
    max: durations[durations.length - 1],
    count: durations.length
  };
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rate') {
    const cujId = args[1];
    const timeWindow = args[2] ? parseInt(args[2]) : 86400000;
    const rate = getCujSuccessRate(cujId, timeWindow);
    console.log(JSON.stringify(rate, null, 2));
  } else if (command === 'all') {
    const timeWindow = args[1] ? parseInt(args[1]) : 86400000;
    const metrics = getAllCujMetrics(timeWindow);
    console.log(JSON.stringify(metrics, null, 2));
  } else if (command === 'trending') {
    const cujId = args[1];
    const buckets = args[2] ? parseInt(args[2]) : 24;
    const bucketSize = args[3] ? parseInt(args[3]) : 3600000;
    const trending = getCujTrending(cujId, buckets, bucketSize);
    console.log(JSON.stringify(trending, null, 2));
  } else if (command === 'failures') {
    const cujId = args[1];
    const timeWindow = args[2] ? parseInt(args[2]) : 86400000;
    const analysis = getFailureAnalysis(cujId, timeWindow);
    console.log(JSON.stringify(analysis, null, 2));
  } else if (command === 'percentiles') {
    const cujId = args[1];
    const timeWindow = args[2] ? parseInt(args[2]) : 86400000;
    const percentiles = getPerformancePercentiles(cujId, timeWindow);
    console.log(JSON.stringify(percentiles, null, 2));
  } else {
    console.log(`
Metrics Tracker CLI

Usage:
  node metrics-tracker.mjs rate <CUJ-ID> [timeWindow]
  node metrics-tracker.mjs all [timeWindow]
  node metrics-tracker.mjs trending <CUJ-ID> [buckets] [bucketSize]
  node metrics-tracker.mjs failures <CUJ-ID> [timeWindow]
  node metrics-tracker.mjs percentiles <CUJ-ID> [timeWindow]

Examples:
  node metrics-tracker.mjs rate CUJ-005
  node metrics-tracker.mjs all 86400000
  node metrics-tracker.mjs trending CUJ-005 24 3600000
  node metrics-tracker.mjs failures CUJ-005
  node metrics-tracker.mjs percentiles CUJ-005
    `);
  }
}
