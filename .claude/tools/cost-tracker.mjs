#!/usr/bin/env node
/**
 * Cost Tracking Tool
 * Implements Claude Agent SDK cost tracking patterns for enterprise usage monitoring
 * Based on: https://docs.claude.com/en/docs/agent-sdk/cost-tracking.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COST_HISTORY_FILE = path.join(__dirname, '../context/history/cost-tracking.json');
const COST_CONFIG = {
  // Claude 3.5 Sonnet pricing (as of 2024)
  inputTokens: {
    'claude-sonnet-4': 0.003, // $3 per 1M tokens
    'claude-opus-4': 0.015,   // $15 per 1M tokens
    'claude-haiku-3': 0.00025 // $0.25 per 1M tokens
  },
  outputTokens: {
    'claude-sonnet-4': 0.015, // $15 per 1M tokens
    'claude-opus-4': 0.075,  // $75 per 1M tokens
    'claude-haiku-3': 0.00125 // $1.25 per 1M tokens
  }
};

/**
 * Record cost for a tool call or agent session
 */
export function recordCost(sessionId, agentName, model, inputTokens, outputTokens, metadata = {}) {
  const history = loadHistory();
  const timestamp = new Date().toISOString();
  
  const inputCost = (inputTokens / 1_000_000) * (COST_CONFIG.inputTokens[model] || 0.003);
  const outputCost = (outputTokens / 1_000_000) * (COST_CONFIG.outputTokens[model] || 0.015);
  const totalCost = inputCost + outputCost;
  
  const record = {
    sessionId,
    timestamp,
    agent: agentName,
    model,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    },
    cost: {
      input: inputCost,
      output: outputCost,
      total: totalCost
    },
    metadata
  };
  
  history.push(record);
  
  // Keep only last 10000 records
  if (history.length > 10000) {
    history.shift();
  }
  
  saveHistory(history);
  
  return record;
}

/**
 * Get cost statistics for a time period
 */
export function getCostStats(agentName = null, model = null, days = 30) {
  const history = loadHistory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  let filtered = history.filter(record => {
    const recordDate = new Date(record.timestamp);
    const dateMatch = recordDate >= cutoff;
    const agentMatch = !agentName || record.agent === agentName;
    const modelMatch = !model || record.model === model;
    return dateMatch && agentMatch && modelMatch;
  });
  
  if (filtered.length === 0) {
    return null;
  }
  
  const totalCost = filtered.reduce((sum, r) => sum + r.cost.total, 0);
  const totalTokens = filtered.reduce((sum, r) => sum + r.tokens.total, 0);
  const totalInputTokens = filtered.reduce((sum, r) => sum + r.tokens.input, 0);
  const totalOutputTokens = filtered.reduce((sum, r) => sum + r.tokens.output, 0);
  
  const stats = {
    period: `${days} days`,
    totalSessions: filtered.length,
    totalCost: totalCost,
    totalTokens: totalTokens,
    averageCostPerSession: totalCost / filtered.length,
    averageTokensPerSession: totalTokens / filtered.length,
    breakdown: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      inputCost: filtered.reduce((sum, r) => sum + r.cost.input, 0),
      outputCost: filtered.reduce((sum, r) => sum + r.cost.output, 0)
    },
    byAgent: groupBy(filtered, 'agent', 'cost.total'),
    byModel: groupBy(filtered, 'model', 'cost.total')
  };
  
  return stats;
}

/**
 * Get cost forecast based on current usage
 */
export function getCostForecast(days = 30) {
  const stats = getCostStats(null, null, 7); // Last 7 days
  
  if (!stats) {
    return null;
  }
  
  const dailyAverage = stats.totalCost / 7;
  const forecast = {
    currentPeriod: {
      days: 7,
      totalCost: stats.totalCost,
      dailyAverage: dailyAverage
    },
    forecast: {
      days: days,
      estimatedCost: dailyAverage * days,
      estimatedTokens: (stats.totalTokens / 7) * days
    },
    recommendations: []
  };
  
  // Generate recommendations
  if (dailyAverage > 10) {
    forecast.recommendations.push({
      type: 'high_usage',
      message: 'Consider optimizing context usage or using haiku for simpler tasks',
      potentialSavings: `${(dailyAverage * 0.3).toFixed(2)} per day`
    });
  }
  
  if (stats.breakdown.outputCost > stats.breakdown.inputCost * 2) {
    forecast.recommendations.push({
      type: 'output_optimization',
      message: 'Output tokens are high. Consider using prefill or shorter responses',
      potentialSavings: `${(stats.breakdown.outputCost * 0.2).toFixed(2)} per day`
    });
  }
  
  return forecast;
}

/**
 * Generate cost report
 */
export function generateCostReport(agentName = null, days = 30) {
  const stats = getCostStats(agentName, null, days);
  const forecast = getCostForecast(30);
  
  if (!stats) {
    console.log('No cost data available');
    return;
  }
  
  console.log('\n💰 Cost Tracking Report');
  console.log('='.repeat(60));
  if (agentName) {
    console.log(`Agent: ${agentName}`);
  }
  console.log(`Period: Last ${days} days`);
  console.log(`Total Sessions: ${stats.totalSessions}`);
  console.log(`\nTotal Cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`Average per Session: $${stats.averageCostPerSession.toFixed(4)}`);
  console.log(`\nToken Usage:`);
  console.log(`  Total: ${stats.totalTokens.toLocaleString()}`);
  console.log(`  Input: ${stats.totalInputTokens.toLocaleString()}`);
  console.log(`  Output: ${stats.totalOutputTokens.toLocaleString()}`);
  console.log(`\nCost Breakdown:`);
  console.log(`  Input: $${stats.breakdown.inputCost.toFixed(4)}`);
  console.log(`  Output: $${stats.breakdown.outputCost.toFixed(4)}`);
  
  if (stats.byAgent && Object.keys(stats.byAgent).length > 0) {
    console.log(`\nCost by Agent:`);
    Object.entries(stats.byAgent)
      .sort((a, b) => b[1] - a[1])
      .forEach(([agent, cost]) => {
        console.log(`  ${agent}: $${cost.toFixed(4)}`);
      });
  }
  
  if (stats.byModel && Object.keys(stats.byModel).length > 0) {
    console.log(`\nCost by Model:`);
    Object.entries(stats.byModel)
      .sort((a, b) => b[1] - a[1])
      .forEach(([model, cost]) => {
        console.log(`  ${model}: $${cost.toFixed(4)}`);
      });
  }
  
  if (forecast) {
    console.log(`\n📊 Forecast (Next 30 Days):`);
    console.log(`  Estimated Cost: $${forecast.forecast.estimatedCost.toFixed(2)}`);
    console.log(`  Estimated Tokens: ${forecast.forecast.estimatedTokens.toLocaleString()}`);
    
    if (forecast.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      forecast.recommendations.forEach(rec => {
        console.log(`  - ${rec.message}`);
        console.log(`    Potential Savings: $${rec.potentialSavings}`);
      });
    }
  }
  
  console.log('='.repeat(60));
}

/**
 * Group records by field and sum another field
 */
function groupBy(records, groupField, sumField) {
  const grouped = {};
  records.forEach(record => {
    const key = record[groupField];
    if (!grouped[key]) {
      grouped[key] = 0;
    }
    const value = sumField.split('.').reduce((obj, prop) => obj?.[prop], record);
    grouped[key] += value || 0;
  });
  return grouped;
}

/**
 * Load history from file
 */
function loadHistory() {
  try {
    const dir = path.dirname(COST_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(COST_HISTORY_FILE)) {
      const data = fs.readFileSync(COST_HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cost history:', error);
  }
  
  return [];
}

/**
 * Save history to file
 */
function saveHistory(history) {
  try {
    const dir = path.dirname(COST_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      COST_HISTORY_FILE,
      JSON.stringify(history, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Error saving cost history:', error);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const agentName = process.argv[3];
  const days = parseInt(process.argv[4]) || 30;
  
  if (command === 'report') {
    generateCostReport(agentName, days);
  } else if (command === 'stats') {
    const stats = getCostStats(agentName, null, days);
    console.log(JSON.stringify(stats, null, 2));
  } else if (command === 'forecast') {
    const forecast = getCostForecast(days);
    console.log(JSON.stringify(forecast, null, 2));
  } else {
    console.log('Usage: cost-tracker.mjs [report|stats|forecast] [agent-name] [days]');
  }
}

