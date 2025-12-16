#!/usr/bin/env node
/**
 * Cost Tracker - Usage Cost API Integration
 * Tracks tool usage, agent usage, and session costs for enterprise cost management
 * Based on: https://docs.claude.com/en/docs/build-with-claude/usage-cost-api.md
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
// Import will be done dynamically to avoid circular dependencies

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COST_LOG_DIR = join(__dirname, '../../../context/cost-logs');
const COST_CONFIG_FILE = join(__dirname, '../../../context/cost-config.json');

/**
 * Estimate token count for a string (rough approximation)
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Load cost configuration
 */
async function loadCostConfig() {
  if (existsSync(COST_CONFIG_FILE)) {
    const content = await readFile(COST_CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  }
  
  // Default cost configuration (per 1M tokens)
  return {
    models: {
      'claude-opus-4': { input: 15.00, output: 75.00 },
      'claude-sonnet-4': { input: 3.00, output: 15.00 },
      'claude-haiku-4': { input: 0.25, output: 1.25 }
    },
    tools: {
      default: { input: 0.01, output: 0.01 }
    },
    budgets: {
      daily: null,
      monthly: null,
      per_session: null
    }
  };
}

/**
 * Track tool usage
 */
export async function trackToolUsage(sessionId, toolName, input, output) {
  const inputTokens = estimateTokens(JSON.stringify(input));
  const outputTokens = estimateTokens(JSON.stringify(output));
  
  const config = await loadCostConfig();
  const toolCost = config.tools[toolName] || config.tools.default;
  
  const cost = {
    tool_name: toolName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost: (inputTokens / 1000000) * toolCost.input + (outputTokens / 1000000) * toolCost.output,
    timestamp: new Date().toISOString()
  };

  // Update session cost
  const { updateSessionCost } = await import('../../agents/sdk/session-handler.mjs');
  await updateSessionCost(sessionId, {
    total: cost.cost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tool_calls: 1
  });

  // Log cost entry
  await logCostEntry(sessionId, 'tool', cost);

  return cost;
}

/**
 * Track agent usage
 */
export async function trackAgentUsage(sessionId, agentName, model, inputTokens, outputTokens, duration) {
  const config = await loadCostConfig();
  const modelCost = config.models[model] || config.models['claude-sonnet-4'];
  
  const cost = {
    agent_name: agentName,
    model: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: duration,
    cost: (inputTokens / 1000000) * modelCost.input + (outputTokens / 1000000) * modelCost.output,
    timestamp: new Date().toISOString()
  };

  // Update session cost
  const { updateSessionCost } = await import('../../agents/sdk/session-handler.mjs');
  await updateSessionCost(sessionId, {
    total: cost.cost,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tool_calls: 0
  });

  // Log cost entry
  await logCostEntry(sessionId, 'agent', cost);

  return cost;
}

/**
 * Get real-time cost for a session
 */
export async function getRealTimeCost(sessionId, timeWindow = 60) {
  const session = await loadSDKSession(sessionId);
  
  if (!session) {
    return { total: 0, input_tokens: 0, output_tokens: 0, tool_calls: 0 };
  }

  // Filter by time window (minutes)
  const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000).toISOString();
  
  // Load cost logs for this session
  const costLogs = await loadCostLogs(sessionId);
  const recentCosts = costLogs.filter(log => log.timestamp >= cutoffTime);

  const total = recentCosts.reduce((sum, log) => sum + (log.cost || 0), 0);
  const inputTokens = recentCosts.reduce((sum, log) => sum + (log.input_tokens || 0), 0);
  const outputTokens = recentCosts.reduce((sum, log) => sum + (log.output_tokens || 0), 0);
  const toolCalls = recentCosts.filter(log => log.type === 'tool').length;

  return {
    total,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tool_calls: toolCalls,
    time_window_minutes: timeWindow
  };
}

/**
 * Check budget alerts
 */
export async function checkBudgetAlerts(organizationId = 'default') {
  const config = await loadCostConfig();
  const budgets = config.budgets || {};
  
  // Load today's costs
  const today = new Date().toISOString().split('T')[0];
  const todayCosts = await getCostsForDate(today);
  
  const alerts = [];
  
  if (budgets.daily && todayCosts.total > budgets.daily) {
    alerts.push({
      type: 'daily_budget_exceeded',
      budget: budgets.daily,
      actual: todayCosts.total,
      organization_id: organizationId
    });
  }
  
  if (budgets.monthly) {
    const monthCosts = await getCostsForMonth(new Date().getMonth(), new Date().getFullYear());
    if (monthCosts.total > budgets.monthly) {
      alerts.push({
        type: 'monthly_budget_exceeded',
        budget: budgets.monthly,
        actual: monthCosts.total,
        organization_id: organizationId
      });
    }
  }

  return alerts;
}

/**
 * Log cost entry
 */
async function logCostEntry(sessionId, type, cost) {
  await mkdir(COST_LOG_DIR, { recursive: true });
  
  const logFile = join(COST_LOG_DIR, `${sessionId}.json`);
  let logs = [];
  
  if (existsSync(logFile)) {
    const content = await readFile(logFile, 'utf8');
    logs = JSON.parse(content);
  }
  
  logs.push({
    type,
    ...cost
  });
  
  await writeFile(logFile, JSON.stringify(logs, null, 2), 'utf8');
}

/**
 * Load cost logs for a session
 */
async function loadCostLogs(sessionId) {
  const logFile = join(COST_LOG_DIR, `${sessionId}.json`);
  
  if (!existsSync(logFile)) {
    return [];
  }
  
  const content = await readFile(logFile, 'utf8');
  return JSON.parse(content);
}

/**
 * Get costs for a specific date
 */
async function getCostsForDate(date) {
  // Implementation would aggregate costs from all sessions for the date
  // Simplified for now
  return { total: 0, input_tokens: 0, output_tokens: 0 };
}

/**
 * Get costs for a month
 */
async function getCostsForMonth(month, year) {
  // Implementation would aggregate costs from all sessions for the month
  // Simplified for now
  return { total: 0, input_tokens: 0, output_tokens: 0 };
}

/**
 * Import session handler for cost updates
 */
async function loadSDKSession(sessionId) {
  const { loadSDKSession } = await import('../../agents/sdk/session-handler.mjs');
  return await loadSDKSession(sessionId);
}

export default {
  trackToolUsage,
  trackAgentUsage,
  getRealTimeCost,
  checkBudgetAlerts
};

