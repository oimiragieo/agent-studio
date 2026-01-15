#!/usr/bin/env node
/**
 * Structured Logging for Skill Invocations
 * Provides JSONL-based logging for all skill executions with comprehensive metadata
 *
 * Usage:
 *   import { StructuredLogger, logSkillInvocation } from './structured-logger.mjs';
 *
 *   const logger = new StructuredLogger();
 *   logger.logSkillInvocation({
 *     skill: 'multi-ai-code-review',
 *     params: { code: 'function foo() {}' },
 *     result: 'success',
 *     duration: 1234,
 *     cacheHit: false,
 *     agent: 'developer',
 *     runId: 'run-001',
 *     cujId: 'CUJ-005'
 *   });
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sanitize sensitive data from parameters
 * @param {string} data - JSON string to sanitize
 * @returns {string} Sanitized JSON string
 */
function sanitize(data) {
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;

    // Remove sensitive keys
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'credentials'];
    const sanitized = JSON.stringify(obj, (key, value) => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        return '[REDACTED]';
      }
      return value;
    });

    return sanitized;
  } catch (error) {
    return '[PARSE_ERROR]';
  }
}

/**
 * Structured Logger for Skill Invocations
 */
export class StructuredLogger {
  /**
   * Initialize logger with log directory
   * @param {string} logDir - Directory for log files (relative to runtime, e.g., 'logs')
   */
  constructor(logDir = 'logs') {
    this.logDir = resolveRuntimePath(logDir, { write: true });

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Create daily log file
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logFile = path.join(this.logDir, `skill-invocations-${date}.jsonl`);
  }

  /**
   * Log a skill invocation
   * @param {Object} event - Skill invocation event
   * @param {string} event.skill - Skill name
   * @param {Object} event.params - Skill parameters
   * @param {string} event.result - 'success' or 'failure'
   * @param {number} event.duration - Duration in milliseconds
   * @param {boolean} event.cacheHit - Whether result was from cache
   * @param {string} event.agent - Agent that invoked the skill
   * @param {string} event.runId - Run ID
   * @param {string} event.cujId - CUJ ID (if applicable)
   * @param {string} event.error - Error message (if failure)
   * @param {Object} event.metadata - Additional metadata
   */
  logSkillInvocation(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'skill_invocation',
      skill: event.skill || 'unknown',
      params: event.params ? sanitize(JSON.stringify(event.params)) : '{}',
      result: event.result || 'unknown',
      duration_ms: event.duration || 0,
      cache_hit: event.cacheHit || false,
      agent: event.agent || 'unknown',
      run_id: event.runId || null,
      cuj_id: event.cujId || null,
      error: event.error || null,
      metadata: event.metadata || {},
    };

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error(`[StructuredLogger] Failed to write log: ${error.message}`);
    }
  }

  /**
   * Query logs by filters
   * @param {Object} filters - Query filters
   * @param {string} filters.skill - Filter by skill name
   * @param {string} filters.agent - Filter by agent
   * @param {string} filters.runId - Filter by run ID
   * @param {string} filters.cujId - Filter by CUJ ID
   * @param {string} filters.result - Filter by result (success/failure)
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {number} filters.limit - Maximum number of results
   * @returns {Array<Object>} Matching log entries
   */
  queryLogs(filters = {}) {
    const entries = [];
    const { skill, agent, runId, cujId, result, startDate, endDate, limit } = filters;

    // Read all log files if date range specified
    let logFiles = [this.logFile];
    if (startDate || endDate) {
      logFiles = this._getLogFilesInRange(startDate, endDate);
    }

    for (const logFile of logFiles) {
      if (!fs.existsSync(logFile)) continue;

      const lines = fs
        .readFileSync(logFile, 'utf-8')
        .split('\n')
        .filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Apply filters
          if (skill && entry.skill !== skill) continue;
          if (agent && entry.agent !== agent) continue;
          if (runId && entry.run_id !== runId) continue;
          if (cujId && entry.cuj_id !== cujId) continue;
          if (result && entry.result !== result) continue;
          if (startDate && new Date(entry.timestamp) < startDate) continue;
          if (endDate && new Date(entry.timestamp) > endDate) continue;

          entries.push(entry);

          // Apply limit
          if (limit && entries.length >= limit) {
            return entries;
          }
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }
    }

    return entries;
  }

  /**
   * Get log files in date range
   * @private
   */
  _getLogFilesInRange(startDate, endDate) {
    const files = fs
      .readdirSync(this.logDir)
      .filter(f => f.startsWith('skill-invocations-') && f.endsWith('.jsonl'));

    return files
      .map(f => {
        const match = f.match(/skill-invocations-(\d{4}-\d{2}-\d{2})\.jsonl/);
        if (!match) return null;

        const fileDate = new Date(match[1]);
        if (startDate && fileDate < startDate) return null;
        if (endDate && fileDate > endDate) return null;

        return path.join(this.logDir, f);
      })
      .filter(f => f !== null);
  }

  /**
   * Get aggregated statistics
   * @param {Object} filters - Query filters (same as queryLogs)
   * @returns {Object} Statistics
   */
  getStatistics(filters = {}) {
    const entries = this.queryLogs(filters);

    const stats = {
      total_invocations: entries.length,
      successful: entries.filter(e => e.result === 'success').length,
      failed: entries.filter(e => e.result === 'failure').length,
      cache_hits: entries.filter(e => e.cache_hit).length,
      total_duration_ms: entries.reduce((sum, e) => sum + (e.duration_ms || 0), 0),
      avg_duration_ms: 0,
      by_skill: {},
      by_agent: {},
      by_cuj: {},
    };

    if (entries.length > 0) {
      stats.avg_duration_ms = stats.total_duration_ms / entries.length;
    }

    // Aggregate by skill
    for (const entry of entries) {
      if (!stats.by_skill[entry.skill]) {
        stats.by_skill[entry.skill] = { count: 0, duration_ms: 0, failures: 0, cache_hits: 0 };
      }
      stats.by_skill[entry.skill].count++;
      stats.by_skill[entry.skill].duration_ms += entry.duration_ms || 0;
      if (entry.result === 'failure') stats.by_skill[entry.skill].failures++;
      if (entry.cache_hit) stats.by_skill[entry.skill].cache_hits++;
    }

    // Aggregate by agent
    for (const entry of entries) {
      if (!stats.by_agent[entry.agent]) {
        stats.by_agent[entry.agent] = { count: 0, duration_ms: 0 };
      }
      stats.by_agent[entry.agent].count++;
      stats.by_agent[entry.agent].duration_ms += entry.duration_ms || 0;
    }

    // Aggregate by CUJ
    for (const entry of entries) {
      if (entry.cuj_id) {
        if (!stats.by_cuj[entry.cuj_id]) {
          stats.by_cuj[entry.cuj_id] = { count: 0, duration_ms: 0 };
        }
        stats.by_cuj[entry.cuj_id].count++;
        stats.by_cuj[entry.cuj_id].duration_ms += entry.duration_ms || 0;
      }
    }

    return stats;
  }
}

// Singleton instance
let globalLogger = null;

/**
 * Get or create global logger instance
 * @returns {StructuredLogger}
 */
export function getLogger() {
  if (!globalLogger) {
    globalLogger = new StructuredLogger();
  }
  return globalLogger;
}

/**
 * Convenience function to log skill invocation
 * @param {Object} event - Skill invocation event (see StructuredLogger.logSkillInvocation)
 */
export function logSkillInvocation(event) {
  const logger = getLogger();
  logger.logSkillInvocation(event);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const logger = new StructuredLogger();

  if (args[0] === 'query') {
    // Query logs
    const filters = {};
    for (let i = 1; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      filters[key] = value;
    }

    const results = logger.queryLogs(filters);
    console.log(JSON.stringify(results, null, 2));
  } else if (args[0] === 'stats') {
    // Get statistics
    const filters = {};
    for (let i = 1; i < args.length; i += 2) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      filters[key] = value;
    }

    const stats = logger.getStatistics(filters);
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log(`
Structured Logger CLI

Usage:
  node structured-logger.mjs query [--skill <name>] [--agent <name>] [--runId <id>] [--cujId <id>] [--result <success|failure>] [--limit <n>]
  node structured-logger.mjs stats [--skill <name>] [--agent <name>] [--runId <id>] [--cujId <id>]

Examples:
  node structured-logger.mjs query --skill multi-ai-code-review --limit 10
  node structured-logger.mjs stats --agent developer
  node structured-logger.mjs stats --cujId CUJ-005
    `);
  }
}
