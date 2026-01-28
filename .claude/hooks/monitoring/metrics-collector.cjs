// @ts-check
/**
 * Metrics Collector Hook
 *
 * Collects performance metrics for hook execution:
 * - Execution time per hook
 * - Success/failure rates
 * - Hook chain performance
 * - Bottleneck detection
 *
 * Security: SEC-MON-001 (Metrics validation)
 * Performance: <1ms overhead per hook
 *
 * @module hooks/monitoring/metrics-collector
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Metrics file location
const METRICS_DIR = path.join(process.cwd(), '.claude', 'context', 'metrics');
const HOOKS_METRICS_FILE = path.join(METRICS_DIR, 'hook-metrics.jsonl');

// Rate limiting: 10000 metrics per hour (reasonable for hook execution)
const RATE_LIMIT_PER_HOUR = 10000;
const rateLimitState = {
  hour: new Date().getHours(),
  count: 0
};

/**
 * Ensure metrics directory exists
 */
function ensureMetricsDir() {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }
}

/**
 * Check rate limit
 */
function checkRateLimit() {
  const currentHour = new Date().getHours();

  // Reset counter if hour changed
  if (currentHour !== rateLimitState.hour) {
    rateLimitState.hour = currentHour;
    rateLimitState.count = 0;
  }

  // Check limit
  if (rateLimitState.count >= RATE_LIMIT_PER_HOUR) {
    console.warn(`[metrics-collector] Rate limit exceeded (${RATE_LIMIT_PER_HOUR}/hour)`);
    return false;
  }

  rateLimitState.count++;
  return true;
}

/**
 * Validate metric entry (SEC-MON-001)
 */
function validateMetric(metric) {
  if (!metric.timestamp || typeof metric.timestamp !== 'string') {
    throw new Error('Invalid metric: timestamp must be ISO 8601 string');
  }

  if (!metric.hook || typeof metric.hook !== 'string') {
    throw new Error('Invalid metric: hook must be string');
  }

  if (!metric.event || typeof metric.event !== 'string') {
    throw new Error('Invalid metric: event must be string');
  }

  if (typeof metric.executionTimeMs !== 'number' || metric.executionTimeMs < 0) {
    throw new Error('Invalid metric: executionTimeMs must be non-negative number');
  }

  if (!['success', 'failure'].includes(metric.status)) {
    throw new Error('Invalid metric: status must be "success" or "failure"');
  }

  return true;
}

/**
 * Log metric to JSONL file
 */
function logMetric(metric) {
  try {
    // Check rate limit
    if (!checkRateLimit()) {
      return;
    }

    // Validate metric
    validateMetric(metric);

    // Ensure directory exists
    ensureMetricsDir();

    // Append to log file
    const line = JSON.stringify(metric) + '\n';
    fs.appendFileSync(HOOKS_METRICS_FILE, line, 'utf8');
  } catch (error) {
    // Log error but don't throw (monitoring shouldn't break the system)
    console.error('[metrics-collector] Failed to log metric:', error.message);
  }
}

/**
 * Store start time in context
 */
function preToolUse(tool, params, context) {
  // Store start time
  context._metricsStartTime = Date.now();

  return { tool, params };
}

/**
 * Calculate and log metrics
 */
function postToolUse(tool, params, result, context) {
  try {
    // Calculate duration
    const startTime = context._metricsStartTime || Date.now();
    const executionTimeMs = Date.now() - startTime;

    // Determine status
    const status = result.error ? 'failure' : 'success';

    // Get hook name from stack trace (if available)
    const stack = new Error().stack || '';
    const hookMatch = stack.match(/at\s+(\w+\.cjs)/);
    const hook = hookMatch ? hookMatch[1] : 'unknown';

    // Create metric entry
    const metric = {
      timestamp: new Date().toISOString(),
      hook,
      event: 'PostToolUse',
      tool,
      executionTimeMs: Math.round(executionTimeMs * 100) / 100, // Round to 2 decimals
      status,
      error: result.error ? result.error.message : undefined,
      metadata: {
        paramsSize: JSON.stringify(params).length,
        resultSize: JSON.stringify(result).length
      }
    };

    // Log metric
    logMetric(metric);
  } catch (error) {
    // Silently fail - monitoring shouldn't break execution
    console.error('[metrics-collector] Error in postToolUse:', error.message);
  }

  return { tool, params, result };
}

/**
 * Session start tracking
 */
function sessionStart(context) {
  const metric = {
    timestamp: new Date().toISOString(),
    hook: 'metrics-collector.cjs',
    event: 'SessionStart',
    tool: 'N/A',
    executionTimeMs: 0,
    status: 'success',
    metadata: {
      sessionId: context.sessionId || 'unknown'
    }
  };

  logMetric(metric);

  return context;
}

/**
 * Session end tracking
 */
function sessionEnd(context) {
  const metric = {
    timestamp: new Date().toISOString(),
    hook: 'metrics-collector.cjs',
    event: 'SessionEnd',
    tool: 'N/A',
    executionTimeMs: 0,
    status: 'success',
    metadata: {
      sessionId: context.sessionId || 'unknown',
      duration: context.sessionDuration || 'unknown'
    }
  };

  logMetric(metric);

  return context;
}

module.exports = {
  preToolUse,
  postToolUse,
  sessionStart,
  sessionEnd
};
