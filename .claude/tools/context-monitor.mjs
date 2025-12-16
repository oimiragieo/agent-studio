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
const ALERT_THRESHOLD = 0.8; // Alert at 80% of max context
const MAX_CONTEXT_TOKENS = 200000;

/**
 * Record context usage for an agent session
 */
export function recordContextUsage(agentName, usage) {
  const history = loadHistory();
  const timestamp = new Date().toISOString();
  
  const record = {
    timestamp,
    agent: agentName,
    totalTokens: usage.total || 0,
    systemPrompt: usage.systemPrompt || 0,
    systemTools: usage.systemTools || 0,
    mcpTools: usage.mcpTools || 0,
    customAgents: usage.customAgents || 0,
    memoryFiles: usage.memoryFiles || 0,
    messages: usage.messages || 0,
    autocompactBuffer: usage.autocompactBuffer || 0,
    percentage: (usage.total / MAX_CONTEXT_TOKENS) * 100
  };
  
  history.push(record);
  
  // Keep only last 1000 records
  if (history.length > 1000) {
    history.shift();
  }
  
  saveHistory(history);
  
  // Check for alerts
  if (record.percentage > ALERT_THRESHOLD * 100) {
    console.warn(`⚠️  Context usage alert for ${agentName}: ${record.percentage.toFixed(1)}%`);
    console.warn(`   Total: ${record.totalTokens.toLocaleString()} / ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens`);
  }
  
  return record;
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
      mcpTools: Math.round(
        filtered.reduce((sum, r) => sum + r.mcpTools, 0) / filtered.length
      ),
      memoryFiles: Math.round(
        filtered.reduce((sum, r) => sum + r.memoryFiles, 0) / filtered.length
      )
    }
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
    
    fs.writeFileSync(
      CONTEXT_HISTORY_FILE,
      JSON.stringify(history, null, 2),
      'utf8'
    );
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

