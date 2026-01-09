#!/usr/bin/env node
/**
 * Provider Health Monitoring
 * Tracks availability and performance of AI model providers (Anthropic, OpenAI, Google)
 *
 * Usage:
 *   import { ProviderHealthMonitor, getGlobalHealthMonitor } from './provider-health.mjs';
 *
 *   const monitor = getGlobalHealthMonitor();
 *   monitor.recordProviderCall('anthropic', true, 1234);
 *   const health = monitor.getProviderHealth('anthropic');
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const healthFile = path.join(projectRoot, '.claude/context/analytics/provider-health.jsonl');

/**
 * Provider Health Monitor
 */
export class ProviderHealthMonitor {
  constructor() {
    this.healthData = new Map();
    this.loadFromDisk();
  }

  /**
   * Load health data from disk
   * @private
   */
  loadFromDisk() {
    if (!fs.existsSync(healthFile)) {
      return;
    }

    try {
      const lines = fs.readFileSync(healthFile, 'utf-8').split('\n').filter(l => l.trim());

      // Load last 1000 entries for each provider
      const recentEntries = lines.slice(-1000);

      for (const line of recentEntries) {
        try {
          const entry = JSON.parse(line);
          this._processEntry(entry);
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }
    } catch (error) {
      console.error(`[ProviderHealth] Failed to load from disk: ${error.message}`);
    }
  }

  /**
   * Process a single entry
   * @private
   */
  _processEntry(entry) {
    const provider = entry.provider;

    if (!this.healthData.has(provider)) {
      this.healthData.set(provider, {
        total_calls: 0,
        successful_calls: 0,
        total_latency_ms: 0,
        last_success: null,
        last_failure: null,
        latencies: [],
        recent_errors: []
      });
    }

    const data = this.healthData.get(provider);
    data.total_calls++;

    if (entry.success) {
      data.successful_calls++;
      data.last_success = entry.timestamp;
    } else {
      data.last_failure = entry.timestamp;
      if (entry.error) {
        data.recent_errors.push({
          timestamp: entry.timestamp,
          error: entry.error
        });
        // Keep only last 10 errors
        if (data.recent_errors.length > 10) {
          data.recent_errors.shift();
        }
      }
    }

    data.total_latency_ms += entry.latency_ms;
    data.latencies.push(entry.latency_ms);

    // Keep only last 100 latencies for percentile calculation
    if (data.latencies.length > 100) {
      data.latencies.shift();
    }
  }

  /**
   * Record a provider API call
   * @param {string} provider - Provider name (anthropic, openai, google, etc.)
   * @param {boolean} success - Whether the call succeeded
   * @param {number} latency_ms - Latency in milliseconds
   * @param {string|null} error - Error message (if failed)
   * @param {Object} metadata - Additional metadata
   */
  recordProviderCall(provider, success, latency_ms, error = null, metadata = {}) {
    const entry = {
      timestamp: Date.now(),
      iso_timestamp: new Date().toISOString(),
      provider: provider.toLowerCase(),
      success,
      latency_ms,
      error: error ? error.substring(0, 200) : null, // Limit error length
      metadata
    };

    // Update in-memory data
    this._processEntry(entry);

    // Persist to disk
    this._persistEntry(entry);
  }

  /**
   * Persist entry to disk
   * @private
   */
  _persistEntry(entry) {
    try {
      const dir = path.dirname(healthFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(healthFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error(`[ProviderHealth] Failed to persist: ${error.message}`);
    }
  }

  /**
   * Get health status for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Health status
   */
  getProviderHealth(provider) {
    const data = this.healthData.get(provider.toLowerCase());

    if (!data) {
      return {
        provider,
        available: false,
        reason: 'No data available'
      };
    }

    const successRate = data.total_calls > 0 ? data.successful_calls / data.total_calls : 0;
    const avgLatency = data.total_calls > 0 ? data.total_latency_ms / data.total_calls : 0;

    // Calculate percentiles
    const sortedLatencies = [...data.latencies].sort((a, b) => a - b);
    const p50 = this._percentile(sortedLatencies, 50);
    const p95 = this._percentile(sortedLatencies, 95);
    const p99 = this._percentile(sortedLatencies, 99);

    return {
      provider,
      available: true,
      success_rate: successRate,
      total_calls: data.total_calls,
      successful_calls: data.successful_calls,
      failed_calls: data.total_calls - data.successful_calls,
      avg_latency_ms: Math.round(avgLatency),
      latency_p50: p50,
      latency_p95: p95,
      latency_p99: p99,
      last_success: data.last_success,
      last_failure: data.last_failure,
      recent_errors: data.recent_errors
    };
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  _percentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get health status for all providers
   * @returns {Object} Health status by provider
   */
  getAllProviderHealth() {
    const health = {};

    for (const provider of this.healthData.keys()) {
      health[provider] = this.getProviderHealth(provider);
    }

    return health;
  }

  /**
   * Get overall system health
   * @returns {Object} Overall health status
   */
  getOverallHealth() {
    const allHealth = this.getAllProviderHealth();
    const providers = Object.values(allHealth);

    if (providers.length === 0) {
      return {
        status: 'unknown',
        healthy_providers: 0,
        total_providers: 0,
        overall_success_rate: 0,
        overall_avg_latency_ms: 0
      };
    }

    const healthyProviders = providers.filter(p => p.success_rate > 0.95).length;
    const totalCalls = providers.reduce((sum, p) => sum + p.total_calls, 0);
    const totalSuccessful = providers.reduce((sum, p) => sum + p.successful_calls, 0);
    const totalLatency = providers.reduce((sum, p) => sum + (p.avg_latency_ms * p.total_calls), 0);

    const overallSuccessRate = totalCalls > 0 ? totalSuccessful / totalCalls : 0;
    const overallAvgLatency = totalCalls > 0 ? totalLatency / totalCalls : 0;

    let status = 'healthy';
    if (overallSuccessRate < 0.9) {
      status = 'degraded';
    }
    if (overallSuccessRate < 0.7) {
      status = 'unhealthy';
    }

    return {
      status,
      healthy_providers: healthyProviders,
      total_providers: providers.length,
      overall_success_rate: overallSuccessRate,
      overall_avg_latency_ms: Math.round(overallAvgLatency),
      providers: allHealth
    };
  }

  /**
   * Get provider comparison
   * @returns {Array<Object>} Providers sorted by performance
   */
  getProviderComparison() {
    const allHealth = this.getAllProviderHealth();

    return Object.entries(allHealth)
      .map(([provider, health]) => ({
        provider,
        success_rate: health.success_rate,
        avg_latency_ms: health.avg_latency_ms,
        total_calls: health.total_calls,
        score: health.success_rate * (1 - Math.min(health.avg_latency_ms / 10000, 1)) // Composite score
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Reset health data for a provider
   * @param {string} provider - Provider name
   */
  resetProvider(provider) {
    this.healthData.delete(provider.toLowerCase());
  }

  /**
   * Reset all health data
   */
  resetAll() {
    this.healthData.clear();
  }
}

// Singleton instance
let globalMonitor = null;

/**
 * Get or create global health monitor instance
 * @returns {ProviderHealthMonitor}
 */
export function getGlobalHealthMonitor() {
  if (!globalMonitor) {
    globalMonitor = new ProviderHealthMonitor();
  }
  return globalMonitor;
}

/**
 * Record a provider call (convenience function)
 * @param {string} provider - Provider name
 * @param {boolean} success - Whether the call succeeded
 * @param {number} latency_ms - Latency in milliseconds
 * @param {string|null} error - Error message
 */
export function recordProviderCall(provider, success, latency_ms, error = null) {
  const monitor = getGlobalHealthMonitor();
  monitor.recordProviderCall(provider, success, latency_ms, error);
}

/**
 * Get provider health (convenience function)
 * @param {string} provider - Provider name
 * @returns {Object} Health status
 */
export function getProviderHealth(provider) {
  const monitor = getGlobalHealthMonitor();
  return monitor.getProviderHealth(provider);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = getGlobalHealthMonitor();
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'status') {
    const provider = args[1];
    if (provider) {
      const health = monitor.getProviderHealth(provider);
      console.log(JSON.stringify(health, null, 2));
    } else {
      const health = monitor.getAllProviderHealth();
      console.log(JSON.stringify(health, null, 2));
    }
  } else if (command === 'overall') {
    const overall = monitor.getOverallHealth();
    console.log(JSON.stringify(overall, null, 2));
  } else if (command === 'compare') {
    const comparison = monitor.getProviderComparison();
    console.log(JSON.stringify(comparison, null, 2));
  } else if (command === 'record') {
    const provider = args[1];
    const success = args[2] === 'true';
    const latency = parseInt(args[3]);
    const error = args[4] || null;

    if (!provider || typeof success !== 'boolean' || isNaN(latency)) {
      console.error('Usage: node provider-health.mjs record <provider> <success:true|false> <latency_ms> [error]');
      process.exit(1);
    }

    monitor.recordProviderCall(provider, success, latency, error);
    console.log(`Recorded call for ${provider}: success=${success}, latency=${latency}ms`);
  } else {
    console.log(`
Provider Health Monitor CLI

Usage:
  node provider-health.mjs status [provider]
  node provider-health.mjs overall
  node provider-health.mjs compare
  node provider-health.mjs record <provider> <success> <latency_ms> [error]

Examples:
  node provider-health.mjs status anthropic
  node provider-health.mjs overall
  node provider-health.mjs compare
  node provider-health.mjs record anthropic true 1234
  node provider-health.mjs record openai false 5000 "API timeout"
    `);
  }
}
