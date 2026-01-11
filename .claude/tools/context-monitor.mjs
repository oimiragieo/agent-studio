#!/usr/bin/env node
/**
 * Context Usage Monitor
 * Tracks token usage per agent session with alerts and historical tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTEXT_HISTORY_FILE = path.join(__dirname, '../context/history/context-usage.json');
const ALERT_THRESHOLD = 0.7; // Alert at 70% of max context

/**
 * Get context limit from settings or default
 * @returns {number} Context limit in tokens
 */
function getContextLimit() {
  try {
    const settingsPath = path.join(__dirname, '../settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.session?.max_context_tokens) {
        return settings.session.max_context_tokens;
      }
    }
  } catch (error) {
    // Fall back to default
  }
  // Default to 100k (from settings.json)
  return 100000;
}

/**
 * Record context usage for an agent session
 * @param {string} agentName - Agent name
 * @param {Object} usage - Usage data
 * @param {string} runId - Optional run ID for run-based tracking
 */
export async function recordContextUsage(agentName, usage, runId = null) {
  const maxTokens = getContextLimit();
  const history = loadHistory();
  const timestamp = new Date().toISOString();

  const record = {
    timestamp,
    agent: agentName,
    runId: runId || null,
    totalTokens: usage.total || 0,
    systemPrompt: usage.systemPrompt || 0,
    systemTools: usage.systemTools || 0,
    mcpTools: usage.mcpTools || 0,
    customAgents: usage.customAgents || 0,
    memoryFiles: usage.memoryFiles || 0,
    messages: usage.messages || 0,
    autocompactBuffer: usage.autocompactBuffer || 0,
    percentage: (usage.total / maxTokens) * 100,
    maxTokens,
  };

  history.push(record);

  // Keep only last 1000 records
  if (history.length > 1000) {
    history.shift();
  }

  saveHistory(history);

  // Store snapshot in run directory if runId provided
  if (runId) {
    await saveRunContextSnapshot(runId, record);
  }

  // Check for alerts at 70% threshold
  if (record.percentage >= ALERT_THRESHOLD * 100) {
    console.warn(`⚠️  Context usage alert for ${agentName}: ${record.percentage.toFixed(1)}%`);
    console.warn(
      `   Total: ${record.totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens`
    );

    // Check if Phoenix reset should be triggered (90% threshold)
    if (runId && record.percentage >= 90) {
      try {
        const { shouldTriggerPhoenixReset, triggerPhoenixReset } =
          await import('./phoenix-manager.mjs');
        if (shouldTriggerPhoenixReset(record.percentage, 90)) {
          console.warn(
            `🔄 Context usage at ${record.percentage.toFixed(1)}% - Phoenix reset recommended`
          );
          console.warn(`   Use triggerPhoenixReset() to initiate seamless context recycling`);
        }
      } catch (error) {
        // Phoenix manager not available - continue with warning
      }
    }

    return { ...record, alert: true, thresholdReached: true };
  }

  return record;
}

/**
 * Save context snapshot to run directory
 * @param {string} runId - Run identifier
 * @param {Object} snapshot - Context usage snapshot
 */
async function saveRunContextSnapshot(runId, snapshot) {
  try {
    const { getRunDirectoryStructure } = await import('./run-manager.mjs');
    const runDirs = getRunDirectoryStructure(runId);
    const snapshotDir = path.join(runDirs.run_dir, 'context-snapshots');

    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const snapshotFile = path.join(snapshotDir, `snapshot-${Date.now()}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (error) {
    // Non-critical - continue if snapshot save fails
    console.warn(`Warning: Could not save context snapshot: ${error.message}`);
  }
}

/**
 * Check if context usage exceeds threshold (real-time monitoring)
 * @param {string} agentName - Agent name
 * @param {Object} usage - Usage data
 * @param {string} runId - Optional run ID
 */
export function checkContextThreshold(agentName, usage, runId = null) {
  const maxTokens = getContextLimit();
  const percentage = ((usage.total || 0) / maxTokens) * 100;
  const thresholdReached = percentage >= ALERT_THRESHOLD * 100;

  if (thresholdReached) {
    return {
      thresholdReached: true,
      percentage: percentage.toFixed(1),
      totalTokens: usage.total || 0,
      maxTokens: maxTokens,
      recommendation: 'Consider handoff to new orchestrator instance',
      runId,
    };
  }

  return {
    thresholdReached: false,
    percentage: percentage.toFixed(1),
    totalTokens: usage.total || 0,
    maxTokens: maxTokens,
    runId,
  };
}

/**
 * Get context usage for a run
 * @param {string} runId - Run identifier
 * @returns {Promise<Object|null>} Latest context snapshot or null
 */
export async function getRunContextUsage(runId) {
  try {
    const { getRunDirectoryStructure } = await import('./run-manager.mjs');
    const runDirs = getRunDirectoryStructure(runId);
    const snapshotDir = path.join(runDirs.run_dir, 'context-snapshots');

    if (!fs.existsSync(snapshotDir)) {
      return null;
    }

    const files = fs
      .readdirSync(snapshotDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const latestFile = path.join(snapshotDir, files[0]);
    const snapshot = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    return snapshot;
  } catch (error) {
    return null;
  }
}

/**
 * Get context usage statistics
 */
export function getContextStats(agentName = null, days = 7) {
  const history = loadHistory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  let filtered = history.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate >= cutoff && (!agentName || record.agent === agentName);
  });

  if (filtered.length === 0) {
    return null;
  }

  const stats = {
    totalSessions: filtered.length,
    averageTokens: Math.round(
      filtered.reduce((sum, r) => sum + r.totalTokens, 0) / filtered.length
    ),
    maxTokens: Math.max(...filtered.map(r => r.totalTokens)),
    minTokens: Math.min(...filtered.map(r => r.totalTokens)),
    averagePercentage: (
      filtered.reduce((sum, r) => sum + r.percentage, 0) / filtered.length
    ).toFixed(1),
    breakdown: {
      systemPrompt: Math.round(
        filtered.reduce((sum, r) => sum + r.systemPrompt, 0) / filtered.length
      ),
      systemTools: Math.round(
        filtered.reduce((sum, r) => sum + r.systemTools, 0) / filtered.length
      ),
      mcpTools: Math.round(filtered.reduce((sum, r) => sum + r.mcpTools, 0) / filtered.length),
      memoryFiles: Math.round(
        filtered.reduce((sum, r) => sum + r.memoryFiles, 0) / filtered.length
      ),
    },
  };

  return stats;
}

/**
 * Generate usage report
 */
export function generateReport(agentName = null) {
  const stats = getContextStats(agentName, 7);

  if (!stats) {
    console.log('No usage data available');
    return;
  }

  console.log('\n📊 Context Usage Report');
  console.log('='.repeat(50));
  if (agentName) {
    console.log(`Agent: ${agentName}`);
  }
  console.log(`Period: Last 7 days`);
  console.log(`Total Sessions: ${stats.totalSessions}`);
  console.log(`\nAverage Usage:`);
  console.log(`  Total Tokens: ${stats.averageTokens.toLocaleString()}`);
  console.log(`  Percentage: ${stats.averagePercentage}%`);
  console.log(`  Max: ${stats.maxTokens.toLocaleString()}`);
  console.log(`  Min: ${stats.minTokens.toLocaleString()}`);
  console.log(`\nBreakdown (Average):`);
  console.log(`  System Prompt: ${stats.breakdown.systemPrompt.toLocaleString()}`);
  console.log(`  System Tools: ${stats.breakdown.systemTools.toLocaleString()}`);
  console.log(`  MCP Tools: ${stats.breakdown.mcpTools.toLocaleString()}`);
  console.log(`  Memory Files: ${stats.breakdown.memoryFiles.toLocaleString()}`);
  console.log('='.repeat(50));
}

/**
 * Load history from file
 */
function loadHistory() {
  try {
    const dir = path.dirname(CONTEXT_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(CONTEXT_HISTORY_FILE)) {
      const data = fs.readFileSync(CONTEXT_HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }

  return [];
}

/**
 * Save history to file
 */
function saveHistory(history) {
  try {
    const dir = path.dirname(CONTEXT_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CONTEXT_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const agentName = process.argv[3];

  if (command === 'report') {
    generateReport(agentName);
  } else if (command === 'stats') {
    const stats = getContextStats(agentName);
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log('Usage: context-monitor.mjs [report|stats] [agent-name]');
  }
}
