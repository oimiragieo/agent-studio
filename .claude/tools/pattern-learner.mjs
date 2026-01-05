#!/usr/bin/env node
/**
 * Pattern Learner - Learning from Agent Executions
 *
 * Captures execution patterns to improve routing accuracy over time.
 * Records outcomes, duration, and feedback to build a knowledge base
 * of what works well for different task types.
 *
 * Usage:
 *   import { recordExecution, getPatternInsights } from './pattern-learner.mjs';
 *   await recordExecution({ task, taskType, agents, outcome, duration, feedback });
 *   const insights = await getPatternInsights('UI_UX');
 *
 * CLI:
 *   node pattern-learner.mjs --record <execution-data.json>
 *   node pattern-learner.mjs --insights <taskType>
 *   node pattern-learner.mjs --suggest --task "Add user authentication"
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATTERN_REGISTRY_PATH = join(__dirname, '..', 'context', 'pattern-registry.json');
const MIN_EXECUTIONS_FOR_INSIGHTS = 3; // Minimum executions before generating insights

/**
 * Initialize pattern registry if it doesn't exist
 * @returns {Promise<Object>} Pattern registry
 */
async function initRegistry() {
  const contextDir = dirname(PATTERN_REGISTRY_PATH);

  // Ensure context directory exists
  if (!existsSync(contextDir)) {
    await mkdir(contextDir, { recursive: true });
  }

  if (!existsSync(PATTERN_REGISTRY_PATH)) {
    const initialRegistry = {
      version: '1.0.0',
      patterns: {},
      recommendations: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalExecutions: 0
      }
    };

    await writeFile(PATTERN_REGISTRY_PATH, JSON.stringify(initialRegistry, null, 2));
    return initialRegistry;
  }

  const content = await readFile(PATTERN_REGISTRY_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save pattern registry
 * @param {Object} registry - Pattern registry to save
 * @returns {Promise<void>}
 */
async function saveRegistry(registry) {
  registry.metadata.lastUpdated = new Date().toISOString();
  await writeFile(PATTERN_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Record an execution for pattern learning
 * @param {Object} execution - Execution data
 * @param {string} execution.task - Task description
 * @param {string} execution.taskType - Task type identifier
 * @param {string[]} execution.agents - Agents used in execution chain
 * @param {string} execution.outcome - Outcome (success|failure|partial)
 * @param {number} execution.duration - Duration in minutes
 * @param {Object} execution.feedback - User feedback or metrics
 * @returns {Promise<void>}
 */
export async function recordExecution(execution) {
  // Validate input
  if (!execution.taskType || !execution.agents || !execution.outcome) {
    throw new Error('Execution must include taskType, agents, and outcome');
  }

  const registry = await initRegistry();

  // Initialize pattern entry if it doesn't exist
  if (!registry.patterns[execution.taskType]) {
    registry.patterns[execution.taskType] = {
      executions: [],
      insights: [],
      successRate: 0,
      avgDuration: 0,
      lastUpdated: null,
      agentCombinations: {}
    };
  }

  const pattern = registry.patterns[execution.taskType];

  // Add execution record
  const executionRecord = {
    timestamp: new Date().toISOString(),
    task: execution.task,
    agents: execution.agents,
    outcome: execution.outcome,
    duration: execution.duration || 0,
    feedback: execution.feedback || {},
    complexity: execution.complexity || 'unknown'
  };

  pattern.executions.push(executionRecord);

  // Keep only last 100 executions per task type
  if (pattern.executions.length > 100) {
    pattern.executions = pattern.executions.slice(-100);
  }

  // Track agent combinations
  const agentKey = execution.agents.join(' → ');
  if (!pattern.agentCombinations[agentKey]) {
    pattern.agentCombinations[agentKey] = {
      count: 0,
      successes: 0,
      failures: 0,
      avgDuration: 0
    };
  }

  const combo = pattern.agentCombinations[agentKey];
  combo.count++;
  if (execution.outcome === 'success') {
    combo.successes++;
  } else if (execution.outcome === 'failure') {
    combo.failures++;
  }

  // Update average duration
  combo.avgDuration = ((combo.avgDuration * (combo.count - 1)) + (execution.duration || 0)) / combo.count;

  // Recalculate metrics
  const successes = pattern.executions.filter(e => e.outcome === 'success').length;
  pattern.successRate = (successes / pattern.executions.length) * 100;

  const totalDuration = pattern.executions.reduce((sum, e) => sum + (e.duration || 0), 0);
  pattern.avgDuration = totalDuration / pattern.executions.length;

  pattern.lastUpdated = new Date().toISOString();

  // Generate insights if we have enough data
  if (pattern.executions.length >= MIN_EXECUTIONS_FOR_INSIGHTS) {
    pattern.insights = generateInsights(pattern);
  }

  // Update global metadata
  registry.metadata.totalExecutions++;

  await saveRegistry(registry);
}

/**
 * Generate insights from execution patterns
 * @param {Object} pattern - Pattern data for a task type
 * @returns {string[]} Array of insight strings
 */
function generateInsights(pattern) {
  const insights = [];

  // Success rate insights
  if (pattern.successRate >= 90) {
    insights.push(`High success rate (${pattern.successRate.toFixed(1)}%) indicates reliable routing for this task type`);
  } else if (pattern.successRate < 70) {
    insights.push(`Low success rate (${pattern.successRate.toFixed(1)}%) suggests routing may need adjustment`);
  }

  // Duration insights
  if (pattern.avgDuration > 60) {
    insights.push(`Average duration of ${pattern.avgDuration.toFixed(1)} minutes is high - consider parallel execution`);
  } else if (pattern.avgDuration < 15) {
    insights.push(`Quick turnaround time (${pattern.avgDuration.toFixed(1)} minutes) indicates efficient routing`);
  }

  // Agent combination insights
  const bestCombo = Object.entries(pattern.agentCombinations)
    .filter(([_, stats]) => stats.count >= 2)
    .sort((a, b) => {
      const successRateA = a[1].successes / a[1].count;
      const successRateB = b[1].successes / b[1].count;
      return successRateB - successRateA;
    })[0];

  if (bestCombo) {
    const [agents, stats] = bestCombo;
    const successRate = (stats.successes / stats.count) * 100;
    if (successRate >= 80) {
      insights.push(`Agent chain "${agents}" has ${successRate.toFixed(1)}% success rate with avg ${stats.avgDuration.toFixed(1)} min duration`);
    }
  }

  // Complexity insights
  const complexityBreakdown = {};
  for (const exec of pattern.executions) {
    const complexity = exec.complexity || 'unknown';
    if (!complexityBreakdown[complexity]) {
      complexityBreakdown[complexity] = { count: 0, successes: 0 };
    }
    complexityBreakdown[complexity].count++;
    if (exec.outcome === 'success') {
      complexityBreakdown[complexity].successes++;
    }
  }

  for (const [complexity, stats] of Object.entries(complexityBreakdown)) {
    const successRate = (stats.successes / stats.count) * 100;
    if (stats.count >= 3 && successRate < 70) {
      insights.push(`${complexity} complexity tasks have lower success rate (${successRate.toFixed(1)}%)`);
    }
  }

  return insights;
}

/**
 * Get pattern insights for a task type
 * @param {string} taskType - Task type identifier
 * @returns {Promise<Object>} Pattern insights
 */
export async function getPatternInsights(taskType) {
  const registry = await initRegistry();

  if (!registry.patterns[taskType]) {
    return {
      taskType,
      hasData: false,
      message: `No execution data available for task type: ${taskType}`
    };
  }

  const pattern = registry.patterns[taskType];

  return {
    taskType,
    hasData: true,
    executionCount: pattern.executions.length,
    successRate: pattern.successRate,
    avgDuration: pattern.avgDuration,
    insights: pattern.insights,
    topAgentCombinations: Object.entries(pattern.agentCombinations)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([agents, stats]) => ({
        agents,
        count: stats.count,
        successRate: (stats.successes / stats.count) * 100,
        avgDuration: stats.avgDuration
      })),
    recentExecutions: pattern.executions.slice(-5).map(e => ({
      timestamp: e.timestamp,
      outcome: e.outcome,
      duration: e.duration,
      agents: e.agents
    }))
  };
}

/**
 * Suggest routing improvements based on historical patterns
 * @param {string} task - Task description
 * @param {string} taskType - Task type from classifier
 * @param {string[]} proposedAgents - Proposed agent chain
 * @returns {Promise<Object>} Routing suggestions
 */
export async function suggestRoutingImprovement(task, taskType, proposedAgents) {
  const registry = await initRegistry();

  const suggestions = {
    hasRecommendations: false,
    recommendations: [],
    confidence: 'low'
  };

  if (!registry.patterns[taskType] || registry.patterns[taskType].executions.length < MIN_EXECUTIONS_FOR_INSIGHTS) {
    suggestions.recommendations.push({
      type: 'insufficient_data',
      message: `Not enough historical data for ${taskType} to make recommendations (need ${MIN_EXECUTIONS_FOR_INSIGHTS} executions)`
    });
    return suggestions;
  }

  const pattern = registry.patterns[taskType];

  // Check if proposed chain has been used before
  const proposedKey = proposedAgents.join(' → ');
  const proposedCombo = pattern.agentCombinations[proposedKey];

  if (proposedCombo && proposedCombo.count >= 2) {
    const successRate = (proposedCombo.successes / proposedCombo.count) * 100;
    if (successRate >= 80) {
      suggestions.recommendations.push({
        type: 'validated_chain',
        message: `Proposed chain has ${successRate.toFixed(1)}% success rate based on ${proposedCombo.count} previous executions`,
        confidence: 'high'
      });
      suggestions.confidence = 'high';
    } else if (successRate < 50) {
      suggestions.recommendations.push({
        type: 'low_success_chain',
        message: `Warning: Proposed chain has only ${successRate.toFixed(1)}% success rate. Consider alternative routing.`,
        confidence: 'high'
      });
      suggestions.confidence = 'high';
    }
  }

  // Find better alternatives
  const betterCombos = Object.entries(pattern.agentCombinations)
    .filter(([key, stats]) => {
      if (key === proposedKey) return false;
      if (stats.count < 2) return false;
      const successRate = (stats.successes / stats.count) * 100;
      return successRate >= 80;
    })
    .sort((a, b) => {
      const rateA = (a[1].successes / a[1].count);
      const rateB = (b[1].successes / b[1].count);
      return rateB - rateA;
    });

  if (betterCombos.length > 0) {
    const [agents, stats] = betterCombos[0];
    const successRate = (stats.successes / stats.count) * 100;
    suggestions.recommendations.push({
      type: 'alternative_chain',
      message: `Alternative chain "${agents}" has ${successRate.toFixed(1)}% success rate (${stats.count} executions)`,
      suggestedAgents: agents.split(' → '),
      confidence: 'medium'
    });
    suggestions.hasRecommendations = true;
    if (suggestions.confidence === 'low') {
      suggestions.confidence = 'medium';
    }
  }

  // Check for keywords that triggered different routing in past successes
  const taskLower = task.toLowerCase();
  const successfulExecs = pattern.executions.filter(e => e.outcome === 'success');

  for (const exec of successfulExecs) {
    const execTaskLower = (exec.task || '').toLowerCase();
    // Simple keyword overlap detection
    const words = taskLower.split(/\s+/);
    const execWords = execTaskLower.split(/\s+/);
    const overlap = words.filter(w => execWords.includes(w) && w.length > 3).length;

    if (overlap >= 3) {
      const agentKey = exec.agents.join(' → ');
      if (agentKey !== proposedKey) {
        suggestions.recommendations.push({
          type: 'similar_task',
          message: `Similar task "${exec.task?.substring(0, 50)}..." succeeded with chain: ${agentKey}`,
          suggestedAgents: exec.agents,
          confidence: 'low'
        });
        suggestions.hasRecommendations = true;
      }
    }
  }

  return suggestions;
}

/**
 * Get all pattern data (for debugging/analysis)
 * @returns {Promise<Object>} Full pattern registry
 */
export async function getAllPatterns() {
  return await initRegistry();
}

/**
 * Clear pattern data for a specific task type or all patterns
 * @param {string} [taskType] - Optional task type to clear, or null to clear all
 * @returns {Promise<void>}
 */
export async function clearPatterns(taskType = null) {
  const registry = await initRegistry();

  if (taskType) {
    delete registry.patterns[taskType];
  } else {
    registry.patterns = {};
    registry.metadata.totalExecutions = 0;
  }

  await saveRegistry(registry);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = {
    action: null,
    taskType: null,
    task: null,
    file: null,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--record' || arg === '-r') {
      parsed.action = 'record';
      parsed.file = args[++i];
    } else if (arg === '--insights' || arg === '-i') {
      parsed.action = 'insights';
      parsed.taskType = args[++i];
    } else if (arg === '--suggest' || arg === '-s') {
      parsed.action = 'suggest';
    } else if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--list' || arg === '-l') {
      parsed.action = 'list';
    } else if (arg === '--clear') {
      parsed.action = 'clear';
      parsed.taskType = args[++i];
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
Pattern Learner - Learn from Agent Executions

Records execution patterns to improve routing accuracy over time.

USAGE:
  node pattern-learner.mjs <action> [options]

ACTIONS:
  --record, -r <file>      Record execution from JSON file
  --insights, -i <type>    Get insights for task type
  --suggest, -s --task <desc>  Suggest routing improvements
  --list, -l               List all task types with data
  --clear <type>           Clear patterns for task type (or "all")

OPTIONS:
  --json, -j               Output as JSON
  --help, -h               Show this help message

EXAMPLES:
  # Record an execution
  node pattern-learner.mjs --record execution.json

  # Get insights for UI/UX tasks
  node pattern-learner.mjs --insights UI_UX

  # Suggest routing improvements
  node pattern-learner.mjs --suggest --task "Add authentication"

  # List all patterns
  node pattern-learner.mjs --list --json

PROGRAMMATIC USE:
  import { recordExecution, getPatternInsights } from './pattern-learner.mjs';
  await recordExecution({ taskType, agents, outcome, duration });
  const insights = await getPatternInsights('UI_UX');
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
      case 'record': {
        if (!args.file) {
          console.error('Error: --record requires a file path');
          process.exit(1);
        }
        const executionData = JSON.parse(await readFile(args.file, 'utf-8'));
        await recordExecution(executionData);
        console.log(`✓ Execution recorded for task type: ${executionData.taskType}`);
        break;
      }

      case 'insights': {
        if (!args.taskType) {
          console.error('Error: --insights requires a task type');
          process.exit(1);
        }
        const insights = await getPatternInsights(args.taskType);
        if (args.json) {
          console.log(JSON.stringify(insights, null, 2));
        } else {
          console.log(`\nPattern Insights: ${insights.taskType}`);
          console.log(`─────────────────────────────────────`);
          if (!insights.hasData) {
            console.log(insights.message);
          } else {
            console.log(`Executions: ${insights.executionCount}`);
            console.log(`Success Rate: ${insights.successRate.toFixed(1)}%`);
            console.log(`Avg Duration: ${insights.avgDuration.toFixed(1)} minutes`);
            console.log(`\nInsights:`);
            insights.insights.forEach(i => console.log(`  • ${i}`));
            console.log(`\nTop Agent Combinations:`);
            insights.topAgentCombinations.forEach(c => {
              console.log(`  ${c.agents}`);
              console.log(`    Success: ${c.successRate.toFixed(1)}% | Count: ${c.count} | Avg: ${c.avgDuration.toFixed(1)}m`);
            });
          }
        }
        break;
      }

      case 'suggest': {
        console.log('Error: --suggest requires integration with task classifier');
        console.log('Use programmatically: suggestRoutingImprovement(task, taskType, proposedAgents)');
        process.exit(1);
        break;
      }

      case 'list': {
        const registry = await getAllPatterns();
        const summary = Object.entries(registry.patterns).map(([taskType, pattern]) => ({
          taskType,
          executions: pattern.executions.length,
          successRate: pattern.successRate,
          avgDuration: pattern.avgDuration
        }));

        if (args.json) {
          console.log(JSON.stringify(summary, null, 2));
        } else {
          console.log(`\nPattern Registry Summary`);
          console.log(`Total Executions: ${registry.metadata.totalExecutions}`);
          console.log(`Last Updated: ${registry.metadata.lastUpdated}`);
          console.log(`\nTask Types:`);
          summary.forEach(s => {
            console.log(`  ${s.taskType}: ${s.executions} executions, ${s.successRate.toFixed(1)}% success, ${s.avgDuration.toFixed(1)}m avg`);
          });
        }
        break;
      }

      case 'clear': {
        if (!args.taskType) {
          console.error('Error: --clear requires a task type or "all"');
          process.exit(1);
        }
        await clearPatterns(args.taskType === 'all' ? null : args.taskType);
        console.log(`✓ Cleared patterns for: ${args.taskType}`);
        break;
      }

      default:
        console.error('Error: No action specified. Use --help for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export default {
  recordExecution,
  getPatternInsights,
  suggestRoutingImprovement,
  getAllPatterns,
  clearPatterns
};
