#!/usr/bin/env node
/**
 * Performance Metrics Dashboard Generator
 * Aggregates all monitoring data into a unified dashboard
 *
 * Usage:
 *   import { generateMetricsDashboard } from './metrics-dashboard.mjs';
 *
 *   const dashboard = generateMetricsDashboard();
 *   console.log(dashboard);
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLogger } from './structured-logger.mjs';
import { getAllCujMetrics, getPerformancePercentiles } from './metrics-tracker.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const dashboardFile = path.join(projectRoot, '.claude/context/analytics/metrics-dashboard.json');

/**
 * Aggregate CUJ metrics
 * @returns {Object} Aggregated CUJ metrics
 */
function aggregateCujMetrics() {
  const timeWindows = {
    '1h': 3600000,
    '24h': 86400000,
    '7d': 604800000,
    '30d': 2592000000
  };

  const aggregated = {};

  for (const [label, window] of Object.entries(timeWindows)) {
    const metrics = getAllCujMetrics(window);
    aggregated[label] = metrics;

    // Calculate overall stats
    const allCujs = Object.values(metrics);
    if (allCujs.length > 0) {
      const totalExecutions = allCujs.reduce((sum, m) => sum + m.total, 0);
      const totalSuccessful = allCujs.reduce((sum, m) => sum + m.successful, 0);
      const avgDuration = allCujs.reduce((sum, m) => sum + m.avg_duration_ms * m.total, 0) / totalExecutions;

      aggregated[`${label}_summary`] = {
        total_cujs: allCujs.length,
        total_executions: totalExecutions,
        total_successful: totalSuccessful,
        overall_success_rate: totalSuccessful / totalExecutions,
        avg_duration_ms: avgDuration
      };
    }
  }

  return aggregated;
}

/**
 * Aggregate skill metrics from structured logger
 * @returns {Object} Aggregated skill metrics
 */
function aggregateSkillMetrics() {
  const logger = getLogger();

  const timeWindows = {
    '1h': { startDate: new Date(Date.now() - 3600000) },
    '24h': { startDate: new Date(Date.now() - 86400000) },
    '7d': { startDate: new Date(Date.now() - 604800000) }
  };

  const aggregated = {};

  for (const [label, filters] of Object.entries(timeWindows)) {
    const stats = logger.getStatistics(filters);
    aggregated[label] = {
      total_invocations: stats.total_invocations,
      successful: stats.successful,
      failed: stats.failed,
      success_rate: stats.total_invocations > 0 ? stats.successful / stats.total_invocations : 0,
      cache_hits: stats.cache_hits,
      cache_hit_rate: stats.total_invocations > 0 ? stats.cache_hits / stats.total_invocations : 0,
      total_duration_ms: stats.total_duration_ms,
      avg_duration_ms: stats.avg_duration_ms,
      by_skill: stats.by_skill,
      by_agent: stats.by_agent
    };

    // Top 10 most used skills
    aggregated[`${label}_top_skills`] = Object.entries(stats.by_skill)
      .map(([skill, data]) => ({
        skill,
        count: data.count,
        avg_duration_ms: data.count > 0 ? data.duration_ms / data.count : 0,
        failure_rate: data.count > 0 ? data.failures / data.count : 0,
        cache_hit_rate: data.count > 0 ? data.cache_hits / data.count : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return aggregated;
}

/**
 * Aggregate provider health metrics (placeholder)
 * This would integrate with provider-health.mjs once implemented
 * @returns {Object} Provider health metrics
 */
function aggregateProviderMetrics() {
  // Placeholder for now - will be populated by provider-health.mjs
  return {
    providers: {
      'anthropic': { available: true, success_rate: 0.99, avg_latency_ms: 1200 },
      'openai': { available: true, success_rate: 0.98, avg_latency_ms: 1500 },
      'google': { available: true, success_rate: 0.97, avg_latency_ms: 1800 }
    },
    last_updated: new Date().toISOString(),
    note: 'Provider metrics integration pending'
  };
}

/**
 * Aggregate resource usage metrics
 * @returns {Object} Resource usage metrics
 */
function aggregateResourceMetrics() {
  // Get current process stats
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    current_process: {
      heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      external_mb: (memUsage.external / 1024 / 1024).toFixed(2),
      rss_mb: (memUsage.rss / 1024 / 1024).toFixed(2),
      cpu_user_ms: cpuUsage.user / 1000,
      cpu_system_ms: cpuUsage.system / 1000
    },
    system_info: {
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
      uptime_seconds: process.uptime()
    }
  };
}

/**
 * Get performance highlights
 * @returns {Object} Performance highlights
 */
function getPerformanceHighlights() {
  const cujMetrics = getAllCujMetrics(86400000); // Last 24 hours
  const cujIds = Object.keys(cujMetrics);

  if (cujIds.length === 0) {
    return {
      fastest_cuj: null,
      slowest_cuj: null,
      most_reliable_cuj: null,
      least_reliable_cuj: null
    };
  }

  // Find fastest CUJ (by avg duration)
  const fastest = cujIds.reduce((min, cujId) => {
    const curr = cujMetrics[cujId];
    const minData = cujMetrics[min];
    return curr.avg_duration_ms < minData.avg_duration_ms ? cujId : min;
  }, cujIds[0]);

  // Find slowest CUJ
  const slowest = cujIds.reduce((max, cujId) => {
    const curr = cujMetrics[cujId];
    const maxData = cujMetrics[max];
    return curr.avg_duration_ms > maxData.avg_duration_ms ? cujId : max;
  }, cujIds[0]);

  // Find most reliable CUJ (by success rate)
  const mostReliable = cujIds.reduce((max, cujId) => {
    const curr = cujMetrics[cujId];
    const maxData = cujMetrics[max];
    return curr.rate > maxData.rate ? cujId : max;
  }, cujIds[0]);

  // Find least reliable CUJ
  const leastReliable = cujIds.reduce((min, cujId) => {
    const curr = cujMetrics[cujId];
    const minData = cujMetrics[min];
    return curr.rate < minData.rate ? cujId : min;
  }, cujIds[0]);

  return {
    fastest_cuj: {
      cuj_id: fastest,
      avg_duration_ms: cujMetrics[fastest].avg_duration_ms
    },
    slowest_cuj: {
      cuj_id: slowest,
      avg_duration_ms: cujMetrics[slowest].avg_duration_ms
    },
    most_reliable_cuj: {
      cuj_id: mostReliable,
      success_rate: cujMetrics[mostReliable].rate
    },
    least_reliable_cuj: {
      cuj_id: leastReliable,
      success_rate: cujMetrics[leastReliable].rate
    }
  };
}

/**
 * Generate comprehensive metrics dashboard
 * @returns {Object} Complete metrics dashboard
 */
export function generateMetricsDashboard() {
  const dashboard = {
    generated_at: new Date().toISOString(),
    summary: {
      cujs: aggregateCujMetrics(),
      skills: aggregateSkillMetrics(),
      providers: aggregateProviderMetrics(),
      resources: aggregateResourceMetrics()
    },
    highlights: getPerformanceHighlights(),
    metadata: {
      dashboard_version: '1.0.0',
      monitoring_enabled: true
    }
  };

  return dashboard;
}

/**
 * Save dashboard to file
 * @param {Object} dashboard - Dashboard data (optional, will generate if not provided)
 */
export function saveDashboard(dashboard = null) {
  if (!dashboard) {
    dashboard = generateMetricsDashboard();
  }

  const dir = path.dirname(dashboardFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(dashboardFile, JSON.stringify(dashboard, null, 2));
  return dashboardFile;
}

/**
 * Load dashboard from file
 * @returns {Object|null} Dashboard data or null if file doesn't exist
 */
export function loadDashboard() {
  if (!fs.existsSync(dashboardFile)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(dashboardFile, 'utf-8'));
}

/**
 * Format dashboard as human-readable text
 * @param {Object} dashboard - Dashboard data
 * @returns {string} Formatted dashboard
 */
export function formatDashboard(dashboard) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('              PERFORMANCE METRICS DASHBOARD');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`Generated: ${new Date(dashboard.generated_at).toLocaleString()}`);
  lines.push('');

  // CUJ Summary (24h)
  const cuj24h = dashboard.summary.cujs['24h_summary'];
  if (cuj24h) {
    lines.push('CUJ METRICS (Last 24 Hours)');
    lines.push('─────────────────────────────────────────────────────────');
    lines.push(`  Total CUJs:           ${cuj24h.total_cujs}`);
    lines.push(`  Total Executions:     ${cuj24h.total_executions}`);
    lines.push(`  Success Rate:         ${(cuj24h.overall_success_rate * 100).toFixed(1)}%`);
    lines.push(`  Avg Duration:         ${cuj24h.avg_duration_ms.toFixed(0)}ms`);
    lines.push('');
  }

  // Skill Summary (24h)
  const skill24h = dashboard.summary.skills['24h'];
  if (skill24h) {
    lines.push('SKILL METRICS (Last 24 Hours)');
    lines.push('─────────────────────────────────────────────────────────');
    lines.push(`  Total Invocations:    ${skill24h.total_invocations}`);
    lines.push(`  Success Rate:         ${(skill24h.success_rate * 100).toFixed(1)}%`);
    lines.push(`  Cache Hit Rate:       ${(skill24h.cache_hit_rate * 100).toFixed(1)}%`);
    lines.push(`  Avg Duration:         ${skill24h.avg_duration_ms.toFixed(0)}ms`);
    lines.push('');
  }

  // Highlights
  if (dashboard.highlights) {
    lines.push('PERFORMANCE HIGHLIGHTS');
    lines.push('─────────────────────────────────────────────────────────');
    if (dashboard.highlights.fastest_cuj) {
      lines.push(`  Fastest CUJ:          ${dashboard.highlights.fastest_cuj.cuj_id} (${dashboard.highlights.fastest_cuj.avg_duration_ms.toFixed(0)}ms)`);
    }
    if (dashboard.highlights.most_reliable_cuj) {
      lines.push(`  Most Reliable:        ${dashboard.highlights.most_reliable_cuj.cuj_id} (${(dashboard.highlights.most_reliable_cuj.success_rate * 100).toFixed(1)}%)`);
    }
    lines.push('');
  }

  // Top Skills
  const topSkills = dashboard.summary.skills['24h_top_skills'];
  if (topSkills && topSkills.length > 0) {
    lines.push('TOP 5 MOST USED SKILLS (Last 24 Hours)');
    lines.push('─────────────────────────────────────────────────────────');
    topSkills.slice(0, 5).forEach((skill, i) => {
      lines.push(`  ${i + 1}. ${skill.skill.padEnd(30)} ${skill.count} calls, ${skill.avg_duration_ms.toFixed(0)}ms avg`);
    });
    lines.push('');
  }

  // Resource Usage
  const resources = dashboard.summary.resources.current_process;
  if (resources) {
    lines.push('RESOURCE USAGE');
    lines.push('─────────────────────────────────────────────────────────');
    lines.push(`  Heap Used:            ${resources.heap_used_mb} MB`);
    lines.push(`  Heap Total:           ${resources.heap_total_mb} MB`);
    lines.push(`  RSS:                  ${resources.rss_mb} MB`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'generate') {
    console.log('Generating metrics dashboard...');
    const dashboard = generateMetricsDashboard();
    const file = saveDashboard(dashboard);
    console.log(`Dashboard saved to: ${file}`);
    console.log('');
    console.log(formatDashboard(dashboard));
  } else if (command === 'view') {
    const dashboard = loadDashboard();
    if (!dashboard) {
      console.error('Dashboard not found. Run "generate" first.');
      process.exit(1);
    }
    console.log(formatDashboard(dashboard));
  } else if (command === 'json') {
    const dashboard = loadDashboard() || generateMetricsDashboard();
    console.log(JSON.stringify(dashboard, null, 2));
  } else {
    console.log(`
Metrics Dashboard CLI

Usage:
  node metrics-dashboard.mjs generate    Generate and save dashboard
  node metrics-dashboard.mjs view        View existing dashboard
  node metrics-dashboard.mjs json        Output dashboard as JSON

Examples:
  node metrics-dashboard.mjs generate
  node metrics-dashboard.mjs view
    `);
  }
}
