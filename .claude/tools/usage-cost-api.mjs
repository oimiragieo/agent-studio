#!/usr/bin/env node
/**
 * Usage Cost API - Enterprise Cost Tracking
 * Integrates with Claude's Usage Cost API for real-time cost monitoring
 * Based on: https://docs.claude.com/en/docs/build-with-claude/usage-cost-api.md
 */

import { recordCost, getCostStats, getCostForecast } from './cost-tracker.mjs';

const API_BASE_URL = process.env.ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com';

/**
 * Get usage cost from Anthropic API
 * Note: This requires API key and proper authentication
 */
export async function getUsageCostFromAPI(timeRange, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const { startDate, endDate } = timeRange;

  try {
    const response = await fetch(`${API_BASE_URL}/v1/usage`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      // Query parameters would be added here
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      period: { start: startDate, end: endDate },
      usage: data.usage || {},
      cost: data.cost || {},
      breakdown: data.breakdown || [],
    };
  } catch (error) {
    // Fallback to local cost tracking
    return {
      success: false,
      error: error.message,
      fallback: true,
      localStats: getCostStats(null, null, calculateDays(startDate, endDate)),
    };
  }
}

/**
 * Calculate days between dates
 */
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get real-time cost monitoring
 */
export async function getRealTimeCost(agentName = null, windowMinutes = 60) {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - windowMinutes);

  const stats = getCostStats(agentName, null, windowMinutes / (24 * 60));

  return {
    window_minutes: windowMinutes,
    current_cost: stats?.totalCost || 0,
    current_tokens: stats?.totalTokens || 0,
    rate_per_minute: stats ? stats.totalCost / windowMinutes : 0,
    projected_hourly: stats ? (stats.totalCost / windowMinutes) * 60 : 0,
    projected_daily: stats ? (stats.totalCost / windowMinutes) * 60 * 24 : 0,
  };
}

/**
 * Check budget alerts
 */
export async function checkBudgetAlerts(budgetConfig) {
  const { daily_limit, hourly_limit, agent_limits = {} } = budgetConfig;

  const alerts = [];

  // Check daily limit
  if (daily_limit) {
    const dailyStats = getCostStats(null, null, 1);
    if (dailyStats && dailyStats.totalCost > daily_limit) {
      alerts.push({
        type: 'daily_limit_exceeded',
        limit: daily_limit,
        current: dailyStats.totalCost,
        overage: dailyStats.totalCost - daily_limit,
        severity: 'high',
      });
    }
  }

  // Check hourly limit
  if (hourly_limit) {
    const hourlyCost = await getRealTimeCost(null, 60);
    if (hourlyCost.current_cost > hourly_limit) {
      alerts.push({
        type: 'hourly_limit_exceeded',
        limit: hourly_limit,
        current: hourlyCost.current_cost,
        overage: hourlyCost.current_cost - hourly_limit,
        severity: 'high',
      });
    }
  }

  // Check agent-specific limits
  for (const [agentName, limit] of Object.entries(agent_limits)) {
    const agentStats = getCostStats(agentName, null, 1);
    if (agentStats && agentStats.totalCost > limit) {
      alerts.push({
        type: 'agent_limit_exceeded',
        agent: agentName,
        limit,
        current: agentStats.totalCost,
        overage: agentStats.totalCost - limit,
        severity: 'medium',
      });
    }
  }

  return {
    alerts,
    has_alerts: alerts.length > 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get cost forecast
 */
export async function getCostForecast(days = 30) {
  const forecast = getCostForecast(days);

  return {
    forecast_days: days,
    projected_cost: forecast.projectedCost,
    projected_tokens: forecast.projectedTokens,
    confidence: forecast.confidence,
    recommendations: forecast.recommendations || [],
  };
}

export default {
  getUsageCostFromAPI,
  getRealTimeCost,
  checkBudgetAlerts,
  getCostForecast,
};
