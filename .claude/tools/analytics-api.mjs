#!/usr/bin/env node
/**
 * Analytics API Integration
 * Implements Claude Code Analytics API patterns
 * Based on: https://docs.claude.com/en/docs/build-with-claude/claude-code-analytics-api.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveRuntimePath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYTICS_DIR = resolveRuntimePath('analytics', { write: true });

/**
 * Track usage event
 */
export function trackEvent(eventType, data = {}) {
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    data,
    sessionId: data.sessionId || 'unknown',
    agent: data.agent || 'unknown',
  };

  saveEvent(event);
  return event;
}

/**
 * Get usage statistics
 */
export function getUsageStats(period = '7d', agent = null) {
  const events = loadEvents(period, agent);

  if (events.length === 0) {
    return {
      period,
      totalEvents: 0,
      message: 'No events found for this period',
    };
  }

  const stats = {
    period,
    totalEvents: events.length,
    byType: groupBy(events, 'type', 'count'),
    byAgent: groupBy(events, 'agent', 'count'),
    timeline: buildTimeline(events),
    topEvents: getTopEvents(events, 10),
  };

  return stats;
}

/**
 * Get agent performance metrics
 */
export function getAgentMetrics(agentName, period = '7d') {
  const events = loadEvents(period, agentName);

  const metrics = {
    agent: agentName,
    period,
    totalSessions: new Set(events.map(e => e.data.sessionId)).size,
    totalEvents: events.length,
    averageEventsPerSession:
      events.length / Math.max(1, new Set(events.map(e => e.data.sessionId)).size),
    eventTypes: groupBy(events, 'type', 'count'),
    successRate: calculateSuccessRate(events),
    averageLatency: calculateAverageLatency(events),
  };

  return metrics;
}

/**
 * Generate analytics report
 */
export function generateAnalyticsReport(period = '7d') {
  const stats = getUsageStats(period);
  const agents = getUniqueAgents(period);

  const report = {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalEvents: stats.totalEvents,
      uniqueAgents: agents.length,
      uniqueSessions: getUniqueSessions(period).length,
    },
    agentMetrics: agents.map(agent => getAgentMetrics(agent, period)),
    topEvents: stats.topEvents,
    recommendations: generateAnalyticsRecommendations(stats),
  };

  return report;
}

/**
 * Save event to file
 */
function saveEvent(event) {
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }

  const date = new Date(event.timestamp);
  const filename = `events_${date.toISOString().split('T')[0]}.jsonl`;
  const filePath = path.join(ANALYTICS_DIR, filename);

  // Append to JSONL file
  fs.appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8');
}

/**
 * Load events for period
 */
function loadEvents(period, agent = null) {
  if (!fs.existsSync(ANALYTICS_DIR)) {
    return [];
  }

  const days = parsePeriod(period);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const events = [];
  const files = fs.readdirSync(ANALYTICS_DIR);

  files.forEach(file => {
    if (file.startsWith('events_') && file.endsWith('.jsonl')) {
      const fileDate = new Date(file.replace('events_', '').replace('.jsonl', ''));
      if (fileDate >= cutoff) {
        const filePath = path.join(ANALYTICS_DIR, file);
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');

        lines.forEach(line => {
          if (line.trim()) {
            try {
              const event = JSON.parse(line);
              const eventDate = new Date(event.timestamp);
              if (eventDate >= cutoff && (!agent || event.agent === agent)) {
                events.push(event);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        });
      }
    }
  });

  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Parse period string
 */
function parsePeriod(period) {
  const match = period.match(/(\d+)([dwmy])/);
  if (!match) return 7;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value;
    case 'w':
      return value * 7;
    case 'm':
      return value * 30;
    case 'y':
      return value * 365;
    default:
      return 7;
  }
}

/**
 * Group events by field
 */
function groupBy(events, field, operation = 'count') {
  const grouped = {};
  events.forEach(event => {
    const key = event[field] || 'unknown';
    if (!grouped[key]) {
      grouped[key] = operation === 'count' ? 0 : [];
    }
    if (operation === 'count') {
      grouped[key]++;
    } else {
      grouped[key].push(event);
    }
  });
  return grouped;
}

/**
 * Build timeline
 */
function buildTimeline(events) {
  const timeline = {};
  events.forEach(event => {
    const date = new Date(event.timestamp).toISOString().split('T')[0];
    if (!timeline[date]) {
      timeline[date] = 0;
    }
    timeline[date]++;
  });
  return timeline;
}

/**
 * Get top events
 */
function getTopEvents(events, limit = 10) {
  const byType = groupBy(events, 'type', 'count');
  return Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type, count]) => ({ type, count }));
}

/**
 * Calculate success rate
 */
function calculateSuccessRate(events) {
  const successEvents = events.filter(
    e => e.data?.status === 'success' || e.data?.success === true
  );
  return events.length > 0 ? (successEvents.length / events.length) * 100 : 0;
}

/**
 * Calculate average latency
 */
function calculateAverageLatency(events) {
  const latencies = events.map(e => e.data?.latency || e.data?.duration).filter(l => l != null);

  if (latencies.length === 0) return 0;

  return latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
}

/**
 * Get unique agents
 */
function getUniqueAgents(period) {
  const events = loadEvents(period);
  return [...new Set(events.map(e => e.agent).filter(a => a !== 'unknown'))];
}

/**
 * Get unique sessions
 */
function getUniqueSessions(period) {
  const events = loadEvents(period);
  return [...new Set(events.map(e => e.data.sessionId).filter(s => s !== 'unknown'))];
}

/**
 * Generate recommendations
 */
function generateAnalyticsRecommendations(stats) {
  const recommendations = [];

  if (stats.totalEvents === 0) {
    recommendations.push({
      type: 'no_data',
      message: 'No analytics data available. Ensure events are being tracked.',
      priority: 'medium',
    });
  }

  const agentDistribution = Object.keys(stats.byAgent || {});
  if (agentDistribution.length === 1) {
    recommendations.push({
      type: 'agent_diversity',
      message:
        'Only one agent is being used. Consider utilizing specialized agents for different tasks.',
      priority: 'low',
    });
  }

  return recommendations;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  if (command === 'track' && arg1) {
    const data = JSON.parse(process.argv[4] || '{}');
    const event = trackEvent(arg1, data);
    console.log(JSON.stringify(event, null, 2));
  } else if (command === 'stats') {
    const period = arg1 || '7d';
    const agent = arg2 || null;
    const stats = getUsageStats(period, agent);
    console.log(JSON.stringify(stats, null, 2));
  } else if (command === 'metrics' && arg1) {
    const period = arg2 || '7d';
    const metrics = getAgentMetrics(arg1, period);
    console.log(JSON.stringify(metrics, null, 2));
  } else if (command === 'report') {
    const period = arg1 || '7d';
    const report = generateAnalyticsReport(period);
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Usage: analytics-api.mjs [track|stats|metrics|report] [args...]');
  }
}
