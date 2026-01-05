#!/usr/bin/env node
/**
 * Context Tracker - Real-time context usage tracking with confidence model
 * 
 * Tracks token usage with confidence levels and fallback heuristics
 * 
 * Usage:
 *   import { trackContextUsage, getContextUsage } from './context-tracker.mjs';
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getRunDirectoryStructure } from './run-manager.mjs';
import { readSettings } from '../settings.mjs';
/**
 * @typedef {Object} ContextUsage
 * @property {number} used_tokens
 * @property {number} limit_tokens
 * @property {'api'|'session'|'estimate'|'heuristic'} source
 * @property {'high'|'medium'|'low'} confidence
 * @property {Object} [metadata]
 * @property {number} [metadata.autocompact_buffer]
 * @property {number} [metadata.step_count]
 * @property {number} [metadata.artifact_count]
 * @property {number} [metadata.elapsed_time_ms]
 */

/**
 * Get context limit from settings
 */
function getContextLimit() {
  try {
    const settings = readSettings();
    return settings.session?.max_context_tokens || 100000;
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read max_context_tokens from settings.json: ${error.message}. Using default 100000.`);
    return 100000;
  }
}

/**
 * Track context usage for a run
 * @param {string} runId - Run identifier
 * @param {Object} usage - Usage data
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<ContextUsage>} Context usage with confidence
 */
export async function trackContextUsage(runId, usage, metadata = {}) {
  try {
    const limitTokens = getContextLimit();
    
    // Try to get actual usage from API/session (high confidence)
    let usedTokens = usage.used_tokens || usage.total || 0;
    let source = 'estimate';
    let confidence = 'low';
  
  // If we have actual API usage, use it (high confidence)
  if (usage.api_usage && typeof usage.api_usage === 'number') {
    usedTokens = usage.api_usage;
    source = 'api';
    confidence = 'high';
  }
  // If we have session usage, use it (high confidence)
  else if (usage.session_usage && typeof usage.session_usage === 'number') {
    usedTokens = usage.session_usage;
    source = 'session';
    confidence = 'high';
  }
  // If we have autocompact buffer info, use heuristic (medium confidence)
  else if (metadata.autocompact_buffer && typeof metadata.autocompact_buffer === 'number') {
    // Estimate: autocompact buffer is typically 10-20% of total usage
    usedTokens = Math.max(usedTokens, metadata.autocompact_buffer * 5);
    source = 'heuristic';
    confidence = 'medium';
  }
  // If we have step/artifact counts, use heuristic (medium confidence)
  else if (metadata.step_count || metadata.artifact_count) {
    // Rough estimate: 10k tokens per step, 5k per artifact
    const stepEstimate = (metadata.step_count || 0) * 10000;
    const artifactEstimate = (metadata.artifact_count || 0) * 5000;
    usedTokens = Math.max(usedTokens, stepEstimate + artifactEstimate);
    source = 'heuristic';
    confidence = 'medium';
  }
  // If we have elapsed time, use time-based heuristic (low confidence)
  else if (metadata.elapsed_time_ms) {
    // Very rough estimate: 1k tokens per minute
    const timeEstimate = (metadata.elapsed_time_ms / 60000) * 1000;
    usedTokens = Math.max(usedTokens, timeEstimate);
    source = 'heuristic';
    confidence = 'low';
  }
  
  const contextUsage = {
    used_tokens: usedTokens,
    limit_tokens: limitTokens,
    source,
    confidence,
    metadata: {
      ...metadata,
      percentage: (usedTokens / limitTokens) * 100
    }
  };
  
    // Save snapshot to run directory
    await saveContextSnapshot(runId, contextUsage);
    
    return contextUsage;
  } catch (error) {
    console.error(`Error tracking context usage for run ${runId}: ${error.message}`);
    // Return fallback usage on error
    return {
      used_tokens: 0,
      limit_tokens: getContextLimit(),
      source: 'estimate',
      confidence: 'low',
      metadata: { error: error.message }
    };
  }
}

/**
 * Get current context usage for a run
 * @param {string} runId - Run identifier
 * @returns {Promise<ContextUsage|null>} Latest context usage or null
 */
export async function getContextUsage(runId) {
  const runDirs = getRunDirectoryStructure(runId);
  const snapshotDir = join(runDirs.run_dir, 'context-snapshots');
  
  if (!existsSync(snapshotDir)) {
    return null;
  }
  
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(snapshotDir);
    const snapshotFiles = files.filter(f => f.startsWith('snapshot-') && f.endsWith('.json'));
    
    if (snapshotFiles.length === 0) {
      return null;
    }
    
    // Get latest snapshot
    snapshotFiles.sort((a, b) => {
      const timeA = parseInt(a.match(/snapshot-(\d+)\.json$/)?.[1] || '0');
      const timeB = parseInt(b.match(/snapshot-(\d+)\.json$/)?.[1] || '0');
      return timeB - timeA;
    });
    
    const latestSnapshotPath = join(snapshotDir, snapshotFiles[0]);
    const content = await readFile(latestSnapshotPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading context usage for run ${runId}: ${error.message}`);
    return null;
  }
}

/**
 * Check if handoff should be triggered based on context usage
 * @param {string} runId - Run identifier
 * @param {ContextUsage} contextUsage - Current context usage
 * @returns {Object} Handoff recommendation
 */
export function shouldTriggerHandoff(runId, contextUsage) {
  const { used_tokens, limit_tokens, confidence, metadata } = contextUsage;
  const percentage = (used_tokens / limit_tokens) * 100;
  
  // Handoff thresholds based on confidence
  const thresholds = {
    high: 0.90,    // 90% for high confidence
    medium: 0.85,  // 85% for medium confidence
    low: 0.80      // 80% for low confidence
  };
  
  const threshold = thresholds[confidence] || 0.85;
  const shouldTrigger = percentage >= (threshold * 100);
  
  return {
    shouldTrigger,
    percentage: percentage.toFixed(1),
    threshold: (threshold * 100).toFixed(1),
    confidence,
    used_tokens,
    limit_tokens,
    recommendation: shouldTrigger 
      ? `Context usage at ${percentage.toFixed(1)}% (${confidence} confidence). Trigger handoff.`
      : `Context usage at ${percentage.toFixed(1)}% (${confidence} confidence). Continue monitoring.`
  };
}

/**
 * Save context snapshot to run directory
 * @param {string} runId - Run identifier
 * @param {ContextUsage} contextUsage - Context usage to save
 */
async function saveContextSnapshot(runId, contextUsage) {
  const runDirs = getRunDirectoryStructure(runId);
  const snapshotDir = join(runDirs.run_dir, 'context-snapshots');
  
  if (!existsSync(snapshotDir)) {
    await mkdir(snapshotDir, { recursive: true });
  }
  
  const snapshotFile = join(snapshotDir, `snapshot-${Date.now()}.json`);
  await writeFile(snapshotFile, JSON.stringify(contextUsage, null, 2), 'utf-8');
}

export default {
  trackContextUsage,
  getContextUsage,
  shouldTriggerHandoff
};

