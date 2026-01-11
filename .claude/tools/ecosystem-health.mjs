#!/usr/bin/env node
/**
 * Ecosystem Health - Health Monitoring for Agent Routing System
 *
 * Provides health metrics and monitoring for the living ecosystem:
 * - Routing accuracy based on pattern learning
 * - Agent utilization statistics
 * - Pattern coverage across task types
 * - System performance metrics
 *
 * Usage:
 *   import { getHealthMetrics } from './ecosystem-health.mjs';
 *   const metrics = await getHealthMetrics();
 *
 * CLI:
 *   node ecosystem-health.mjs --metrics
 *   node ecosystem-health.mjs --report
 *   node ecosystem-health.mjs --agent-utilization
 *   node ecosystem-health.mjs --routing-accuracy
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getAllPatterns } from './pattern-learner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROUTING_MATRIX_PATH = join(__dirname, 'agent-routing-matrix.json');
const CROSS_CUTTING_PATH = join(__dirname, 'cross-cutting-triggers.json');

/**
 * Get comprehensive health metrics
 * @returns {Promise<Object>} Health metrics
 */
export async function getHealthMetrics() {
  const [patterns, matrix, triggers] = await Promise.all([
    getAllPatterns(),
    loadRoutingMatrix(),
    loadCrossCuttingTriggers(),
  ]);

  const metrics = {
    timestamp: new Date().toISOString(),
    overall: {
      status: 'unknown',
      score: 0,
    },
    routing: await getRoutingAccuracy(patterns, matrix),
    agents: await getAgentUtilization(patterns, matrix),
    patterns: {
      totalTaskTypes: Object.keys(patterns.patterns).length,
      totalExecutions: patterns.metadata.totalExecutions,
      avgExecutionsPerType: 0,
      coverage: 0,
    },
    performance: {
      avgDuration: 0,
      successRate: 0,
      totalFailures: 0,
    },
    recommendations: [],
  };

  // Calculate pattern metrics
  const taskTypes = Object.keys(patterns.patterns);
  if (taskTypes.length > 0) {
    metrics.patterns.avgExecutionsPerType = patterns.metadata.totalExecutions / taskTypes.length;

    // Coverage: percentage of task types with sufficient data (>=3 executions)
    const sufficinetData = taskTypes.filter(
      t => patterns.patterns[t].executions.length >= 3
    ).length;
    metrics.patterns.coverage = (sufficinetData / taskTypes.length) * 100;
  }

  // Calculate performance metrics
  let totalDuration = 0;
  let totalSuccesses = 0;
  let totalFailures = 0;
  let totalExecs = 0;

  for (const pattern of Object.values(patterns.patterns)) {
    for (const exec of pattern.executions) {
      totalDuration += exec.duration || 0;
      totalExecs++;
      if (exec.outcome === 'success') {
        totalSuccesses++;
      } else if (exec.outcome === 'failure') {
        totalFailures++;
      }
    }
  }

  if (totalExecs > 0) {
    metrics.performance.avgDuration = totalDuration / totalExecs;
    metrics.performance.successRate = (totalSuccesses / totalExecs) * 100;
    metrics.performance.totalFailures = totalFailures;
  }

  // Calculate overall health score (0-100)
  let score = 0;

  // Routing accuracy contribution (40 points)
  score += (metrics.routing.accuracy / 100) * 40;

  // Success rate contribution (30 points)
  score += (metrics.performance.successRate / 100) * 30;

  // Pattern coverage contribution (20 points)
  score += (metrics.patterns.coverage / 100) * 20;

  // Agent utilization contribution (10 points)
  const utilizationScore = 100 - Math.abs(50 - metrics.agents.avgUtilization);
  score += (utilizationScore / 100) * 10;

  metrics.overall.score = Math.round(score);

  // Determine overall status
  if (metrics.overall.score >= 80) {
    metrics.overall.status = 'healthy';
  } else if (metrics.overall.score >= 60) {
    metrics.overall.status = 'warning';
  } else {
    metrics.overall.status = 'critical';
  }

  // Generate recommendations
  metrics.recommendations = generateRecommendations(metrics);

  return metrics;
}

/**
 * Get routing accuracy metrics
 * @param {Object} patterns - Pattern registry
 * @param {Object} matrix - Routing matrix
 * @returns {Promise<Object>} Routing accuracy metrics
 */
export async function getRoutingAccuracy(patterns = null, matrix = null) {
  if (!patterns) {
    patterns = await getAllPatterns();
  }
  if (!matrix) {
    matrix = await loadRoutingMatrix();
  }

  const accuracy = {
    overall: 0,
    byTaskType: {},
    totalRouted: 0,
    successfulRoutes: 0,
  };

  for (const [taskType, pattern] of Object.entries(patterns.patterns)) {
    const matrixRouting = matrix.taskTypes[taskType];
    if (!matrixRouting) {
      continue;
    }

    const expectedPrimary = matrixRouting.primary;
    let correctRoutes = 0;
    let totalRoutes = pattern.executions.length;

    for (const exec of pattern.executions) {
      // Check if primary agent matches matrix
      if (exec.agents && exec.agents[0] === expectedPrimary) {
        correctRoutes++;
        if (exec.outcome === 'success') {
          accuracy.successfulRoutes++;
        }
      }
      accuracy.totalRouted++;
    }

    if (totalRoutes > 0) {
      accuracy.byTaskType[taskType] = {
        accuracy: (correctRoutes / totalRoutes) * 100,
        totalRoutes,
        correctRoutes,
        successRate:
          (pattern.executions.filter(e => e.outcome === 'success').length / totalRoutes) * 100,
      };
    }
  }

  // Calculate overall accuracy
  if (accuracy.totalRouted > 0) {
    const totalCorrect = Object.values(accuracy.byTaskType).reduce(
      (sum, t) => sum + t.correctRoutes,
      0
    );
    accuracy.overall = (totalCorrect / accuracy.totalRouted) * 100;
  }

  return accuracy;
}

/**
 * Get agent utilization statistics
 * @param {Object} patterns - Pattern registry
 * @param {Object} matrix - Routing matrix
 * @returns {Promise<Object>} Agent utilization metrics
 */
export async function getAgentUtilization(patterns = null, matrix = null) {
  if (!patterns) {
    patterns = await getAllPatterns();
  }
  if (!matrix) {
    matrix = await loadRoutingMatrix();
  }

  const utilization = {
    byAgent: {},
    avgUtilization: 0,
    maxUtilization: 0,
    minUtilization: 100,
    underutilized: [],
    overutilized: [],
  };

  // Initialize all agents from matrix
  const allAgents = new Set();
  for (const routing of Object.values(matrix.taskTypes)) {
    allAgents.add(routing.primary);
    routing.supporting?.forEach(a => allAgents.add(a));
    routing.review?.forEach(a => allAgents.add(a));
    routing.approval?.forEach(a => allAgents.add(a));
  }

  for (const agent of allAgents) {
    utilization.byAgent[agent] = {
      totalExecutions: 0,
      asPrimary: 0,
      asSupporting: 0,
      asReview: 0,
      asApproval: 0,
      successRate: 0,
      avgDuration: 0,
    };
  }

  // Count agent appearances
  let totalExecutions = 0;
  for (const pattern of Object.values(patterns.patterns)) {
    for (const exec of pattern.executions) {
      totalExecutions++;
      if (exec.agents && exec.agents.length > 0) {
        const primary = exec.agents[0];
        if (utilization.byAgent[primary]) {
          utilization.byAgent[primary].totalExecutions++;
          utilization.byAgent[primary].asPrimary++;
        }

        for (let i = 1; i < exec.agents.length; i++) {
          const agent = exec.agents[i];
          if (utilization.byAgent[agent]) {
            utilization.byAgent[agent].totalExecutions++;

            // Rough classification (could be improved with actual role tracking)
            if (agent.includes('reviewer') || agent.includes('code-')) {
              utilization.byAgent[agent].asReview++;
            } else if (agent === 'qa' || agent === 'pm') {
              utilization.byAgent[agent].asApproval++;
            } else {
              utilization.byAgent[agent].asSupporting++;
            }
          }
        }

        // Track success and duration per agent
        for (const agent of exec.agents) {
          if (utilization.byAgent[agent]) {
            const stats = utilization.byAgent[agent];
            const prevTotal = stats.totalExecutions - 1;

            if (exec.outcome === 'success') {
              stats.successRate = (stats.successRate * prevTotal + 100) / stats.totalExecutions;
            } else {
              stats.successRate = (stats.successRate * prevTotal) / stats.totalExecutions;
            }

            stats.avgDuration =
              (stats.avgDuration * prevTotal + (exec.duration || 0)) / stats.totalExecutions;
          }
        }
      }
    }
  }

  // Calculate utilization percentages
  let totalUtilization = 0;
  let agentCount = 0;

  for (const [agent, stats] of Object.entries(utilization.byAgent)) {
    const utilizationPct =
      totalExecutions > 0 ? (stats.totalExecutions / totalExecutions) * 100 : 0;
    stats.utilizationPct = utilizationPct;

    totalUtilization += utilizationPct;
    agentCount++;

    utilization.maxUtilization = Math.max(utilization.maxUtilization, utilizationPct);
    if (stats.totalExecutions > 0) {
      utilization.minUtilization = Math.min(utilization.minUtilization, utilizationPct);
    }

    // Flag underutilized (< 5%) and overutilized (> 30%) agents
    if (utilizationPct < 5 && stats.totalExecutions > 0) {
      utilization.underutilized.push(agent);
    } else if (utilizationPct > 30) {
      utilization.overutilized.push(agent);
    }
  }

  utilization.avgUtilization = agentCount > 0 ? totalUtilization / agentCount : 0;

  return utilization;
}

/**
 * Generate health recommendations
 * @param {Object} metrics - Health metrics
 * @returns {string[]} Array of recommendations
 */
function generateRecommendations(metrics) {
  const recommendations = [];

  // Routing accuracy recommendations
  if (metrics.routing.accuracy < 70) {
    recommendations.push({
      priority: 'high',
      category: 'routing',
      message: `Low routing accuracy (${metrics.routing.accuracy.toFixed(1)}%). Review routing matrix and task classifier rules.`,
    });
  }

  // Success rate recommendations
  if (metrics.performance.successRate < 80) {
    recommendations.push({
      priority: 'high',
      category: 'performance',
      message: `Success rate is ${metrics.performance.successRate.toFixed(1)}%. Analyze failure patterns to improve agent chains.`,
    });
  }

  // Pattern coverage recommendations
  if (metrics.patterns.coverage < 50) {
    recommendations.push({
      priority: 'medium',
      category: 'patterns',
      message: `Only ${metrics.patterns.coverage.toFixed(1)}% of task types have sufficient execution data. Encourage more diverse workflow usage.`,
    });
  }

  // Agent utilization recommendations
  if (metrics.agents.underutilized.length > 0) {
    recommendations.push({
      priority: 'low',
      category: 'agents',
      message: `Underutilized agents: ${metrics.agents.underutilized.join(', ')}. Consider removing or reassigning roles.`,
    });
  }

  if (metrics.agents.overutilized.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'agents',
      message: `Overutilized agents: ${metrics.agents.overutilized.join(', ')}. Consider load balancing or adding supporting agents.`,
    });
  }

  // Duration recommendations
  if (metrics.performance.avgDuration > 45) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      message: `Average duration is ${metrics.performance.avgDuration.toFixed(1)} minutes. Look for opportunities to parallelize agent work.`,
    });
  }

  return recommendations;
}

/**
 * Generate comprehensive health report
 * @returns {Promise<string>} Markdown health report
 */
export async function generateHealthReport() {
  const metrics = await getHealthMetrics();

  const lines = [];
  lines.push(`# Agent Routing System Health Report`);
  lines.push('');
  lines.push(`Generated: ${metrics.timestamp}`);
  lines.push('');

  // Overall status
  const statusEmoji =
    metrics.overall.status === 'healthy' ? '✓' : metrics.overall.status === 'warning' ? '⚠' : '✗';
  lines.push(`## Overall Status: ${statusEmoji} ${metrics.overall.status.toUpperCase()}`);
  lines.push('');
  lines.push(`**Health Score**: ${metrics.overall.score}/100`);
  lines.push('');

  // Routing accuracy
  lines.push(`## Routing Accuracy: ${metrics.routing.accuracy.toFixed(1)}%`);
  lines.push('');
  lines.push(`- **Total Routes**: ${metrics.routing.totalRouted}`);
  lines.push(`- **Successful Routes**: ${metrics.routing.successfulRoutes}`);
  lines.push('');

  if (Object.keys(metrics.routing.byTaskType).length > 0) {
    lines.push(`### By Task Type`);
    lines.push('');
    lines.push('| Task Type | Accuracy | Routes | Success Rate |');
    lines.push('|-----------|----------|--------|--------------|');
    for (const [taskType, data] of Object.entries(metrics.routing.byTaskType)) {
      lines.push(
        `| ${taskType} | ${data.accuracy.toFixed(1)}% | ${data.totalRoutes} | ${data.successRate.toFixed(1)}% |`
      );
    }
    lines.push('');
  }

  // Agent utilization
  lines.push(`## Agent Utilization`);
  lines.push('');
  lines.push(`- **Average**: ${metrics.agents.avgUtilization.toFixed(1)}%`);
  lines.push(
    `- **Range**: ${metrics.agents.minUtilization.toFixed(1)}% - ${metrics.agents.maxUtilization.toFixed(1)}%`
  );
  lines.push('');

  const topAgents = Object.entries(metrics.agents.byAgent)
    .filter(([_, stats]) => stats.totalExecutions > 0)
    .sort((a, b) => b[1].utilizationPct - a[1].utilizationPct)
    .slice(0, 10);

  if (topAgents.length > 0) {
    lines.push(`### Top 10 Most Used Agents`);
    lines.push('');
    lines.push('| Agent | Utilization | Executions | Success Rate | Avg Duration |');
    lines.push('|-------|-------------|------------|--------------|--------------|');
    for (const [agent, stats] of topAgents) {
      lines.push(
        `| ${agent} | ${stats.utilizationPct.toFixed(1)}% | ${stats.totalExecutions} | ${stats.successRate.toFixed(1)}% | ${stats.avgDuration.toFixed(1)}m |`
      );
    }
    lines.push('');
  }

  if (metrics.agents.underutilized.length > 0) {
    lines.push(`### Underutilized Agents`);
    lines.push('');
    lines.push(metrics.agents.underutilized.join(', '));
    lines.push('');
  }

  // Pattern coverage
  lines.push(`## Pattern Coverage: ${metrics.patterns.coverage.toFixed(1)}%`);
  lines.push('');
  lines.push(`- **Task Types Tracked**: ${metrics.patterns.totalTaskTypes}`);
  lines.push(`- **Total Executions**: ${metrics.patterns.totalExecutions}`);
  lines.push(`- **Avg Executions/Type**: ${metrics.patterns.avgExecutionsPerType.toFixed(1)}`);
  lines.push('');

  // Performance
  lines.push(`## Performance Metrics`);
  lines.push('');
  lines.push(`- **Success Rate**: ${metrics.performance.successRate.toFixed(1)}%`);
  lines.push(`- **Avg Duration**: ${metrics.performance.avgDuration.toFixed(1)} minutes`);
  lines.push(`- **Total Failures**: ${metrics.performance.totalFailures}`);
  lines.push('');

  // Recommendations
  if (metrics.recommendations.length > 0) {
    lines.push(`## Recommendations`);
    lines.push('');

    const highPriority = metrics.recommendations.filter(r => r.priority === 'high');
    const mediumPriority = metrics.recommendations.filter(r => r.priority === 'medium');
    const lowPriority = metrics.recommendations.filter(r => r.priority === 'low');

    if (highPriority.length > 0) {
      lines.push(`### High Priority`);
      lines.push('');
      highPriority.forEach(r => lines.push(`- **[${r.category}]**: ${r.message}`));
      lines.push('');
    }

    if (mediumPriority.length > 0) {
      lines.push(`### Medium Priority`);
      lines.push('');
      mediumPriority.forEach(r => lines.push(`- **[${r.category}]**: ${r.message}`));
      lines.push('');
    }

    if (lowPriority.length > 0) {
      lines.push(`### Low Priority`);
      lines.push('');
      lowPriority.forEach(r => lines.push(`- **[${r.category}]**: ${r.message}`));
      lines.push('');
    }
  }

  lines.push(`---`);
  lines.push(`*Generated by ecosystem-health.mjs*`);

  return lines.join('\n');
}

/**
 * Load routing matrix
 */
async function loadRoutingMatrix() {
  if (!existsSync(ROUTING_MATRIX_PATH)) {
    return { taskTypes: {} };
  }
  const content = await readFile(ROUTING_MATRIX_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load cross-cutting triggers
 */
async function loadCrossCuttingTriggers() {
  if (!existsSync(CROSS_CUTTING_PATH)) {
    return { triggers: {} };
  }
  const content = await readFile(CROSS_CUTTING_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = {
    action: 'metrics',
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--metrics' || arg === '-m') {
      parsed.action = 'metrics';
    } else if (arg === '--report' || arg === '-r') {
      parsed.action = 'report';
    } else if (arg === '--agent-utilization' || arg === '-a') {
      parsed.action = 'agents';
    } else if (arg === '--routing-accuracy' || arg === '-c') {
      parsed.action = 'routing';
    } else if (arg === '--json' || arg === '-j') {
      parsed.json = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Ecosystem Health - Health Monitoring for Agent Routing System

Provides health metrics and monitoring for the living ecosystem.

USAGE:
  node ecosystem-health.mjs [action] [options]

ACTIONS:
  --metrics, -m            Get comprehensive health metrics (default)
  --report, -r             Generate full health report
  --agent-utilization, -a  Get agent utilization statistics
  --routing-accuracy, -c   Get routing accuracy metrics

OPTIONS:
  --json, -j               Output as JSON
  --help, -h               Show this help message

EXAMPLES:
  # Get health metrics
  node ecosystem-health.mjs --metrics

  # Generate health report
  node ecosystem-health.mjs --report

  # Get agent utilization as JSON
  node ecosystem-health.mjs --agent-utilization --json

PROGRAMMATIC USE:
  import { getHealthMetrics } from './ecosystem-health.mjs';
  const metrics = await getHealthMetrics();
`);
}

/**
 * CLI interface
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (args.action) {
      case 'metrics': {
        const metrics = await getHealthMetrics();
        if (args.json) {
          console.log(JSON.stringify(metrics, null, 2));
        } else {
          console.log(`\nAgent Routing System Health`);
          console.log(`═══════════════════════════════════════`);
          console.log(
            `Status: ${metrics.overall.status.toUpperCase()} (${metrics.overall.score || 0}/100)`
          );
          console.log(`\nRouting Accuracy: ${(metrics.routing.accuracy || 0).toFixed(1)}%`);
          console.log(`Success Rate: ${(metrics.performance.successRate || 0).toFixed(1)}%`);
          console.log(`Avg Duration: ${(metrics.performance.avgDuration || 0).toFixed(1)} minutes`);
          console.log(`Pattern Coverage: ${(metrics.patterns.coverage || 0).toFixed(1)}%`);
          console.log(`\nRecommendations: ${metrics.recommendations.length}`);
          metrics.recommendations.forEach((r, i) => {
            console.log(`  ${i + 1}. [${r.priority.toUpperCase()}] ${r.message}`);
          });
        }
        break;
      }

      case 'report': {
        const report = await generateHealthReport();
        console.log(report);
        break;
      }

      case 'agents': {
        const utilization = await getAgentUtilization();
        if (args.json) {
          console.log(JSON.stringify(utilization, null, 2));
        } else {
          console.log(`\nAgent Utilization`);
          console.log(`═══════════════════════════════════════`);
          console.log(`Avg: ${utilization.avgUtilization.toFixed(1)}%`);
          console.log(
            `Range: ${utilization.minUtilization.toFixed(1)}% - ${utilization.maxUtilization.toFixed(1)}%`
          );
          console.log(`\nTop Agents:`);
          const top = Object.entries(utilization.byAgent)
            .filter(([_, s]) => s.totalExecutions > 0)
            .sort((a, b) => b[1].utilizationPct - a[1].utilizationPct)
            .slice(0, 5);
          top.forEach(([agent, stats]) => {
            console.log(
              `  ${agent}: ${stats.utilizationPct.toFixed(1)}% (${stats.totalExecutions} executions)`
            );
          });
        }
        break;
      }

      case 'routing': {
        const accuracy = await getRoutingAccuracy();
        if (args.json) {
          console.log(JSON.stringify(accuracy, null, 2));
        } else {
          console.log(`\nRouting Accuracy`);
          console.log(`═══════════════════════════════════════`);
          console.log(`Overall: ${accuracy.overall.toFixed(1)}%`);
          console.log(`Total Routes: ${accuracy.totalRouted}`);
          console.log(`Successful: ${accuracy.successfulRoutes}`);
          console.log(`\nBy Task Type:`);
          for (const [type, data] of Object.entries(accuracy.byTaskType)) {
            console.log(`  ${type}: ${data.accuracy.toFixed(1)}% (${data.totalRoutes} routes)`);
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export default {
  getHealthMetrics,
  getRoutingAccuracy,
  getAgentUtilization,
  generateHealthReport,
};
