#!/usr/bin/env node
/**
 * Token Monitor - Monitors orchestrator context usage and triggers handoff at 90% threshold
 *
 * This tool monitors the context window usage of the orchestrator agent and triggers
 * a handoff process when usage reaches 90% (180k tokens of 200k).
 *
 * Usage:
 *   node .claude/tools/token-monitor.mjs --session-id <id> [--threshold 0.90]
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_THRESHOLD = 0.9; // 90% of 200k tokens = 180k tokens
const CONTEXT_LIMIT = 200000; // 200k tokens for Claude 4.5 models

/**
 * Get current context usage from Claude Code session
 * This is a placeholder - actual implementation would hook into Claude Code's context tracking
 */
async function getContextUsage(sessionId) {
  // In a real implementation, this would:
  // 1. Query Claude Code API for current session context usage
  // 2. Or read from a session state file that Claude Code maintains
  // 3. Or use Claude's context management API

  // For now, we'll use a session state file approach
  const sessionFile = join(
    __dirname,
    '..',
    'orchestrators',
    `orchestrator-${sessionId}`,
    'session.json'
  );

  try {
    const sessionData = JSON.parse(await readFile(sessionFile, 'utf-8'));
    return {
      inputTokens: sessionData.contextUsage?.inputTokens || 0,
      outputTokens: sessionData.contextUsage?.outputTokens || 0,
      totalTokens: sessionData.contextUsage?.totalTokens || 0,
      percentage: (sessionData.contextUsage?.totalTokens || 0) / CONTEXT_LIMIT,
    };
  } catch (error) {
    // If session file doesn't exist, return default
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      percentage: 0,
    };
  }
}

/**
 * Check if handoff should be triggered
 */
async function shouldTriggerHandoff(sessionId, threshold = DEFAULT_THRESHOLD) {
  const usage = await getContextUsage(sessionId);
  return usage.percentage >= threshold;
}

/**
 * Update session state with current context usage
 */
async function updateSessionState(sessionId, contextUsage) {
  const orchestratorDir = join(__dirname, '..', 'orchestrators', `orchestrator-${sessionId}`);
  const sessionFile = join(orchestratorDir, 'session.json');

  // Ensure directory exists
  await mkdir(orchestratorDir, { recursive: true });

  let sessionData = {};
  try {
    sessionData = JSON.parse(await readFile(sessionFile, 'utf-8'));
  } catch (error) {
    // File doesn't exist, create new
    sessionData = {
      sessionId,
      createdAt: new Date().toISOString(),
      contextUsage: {},
    };
  }

  sessionData.contextUsage = {
    ...sessionData.contextUsage,
    ...contextUsage,
    lastUpdated: new Date().toISOString(),
    percentage: (contextUsage.totalTokens || 0) / CONTEXT_LIMIT,
  };

  await writeFile(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');
  return sessionData;
}

/**
 * Main monitoring function
 */
export async function monitorContext(sessionId, threshold = DEFAULT_THRESHOLD) {
  const usage = await getContextUsage(sessionId);
  const shouldHandoff = await shouldTriggerHandoff(sessionId, threshold);

  return {
    sessionId,
    usage,
    threshold,
    shouldHandoff,
    recommendation: shouldHandoff
      ? 'TRIGGER_HANDOFF'
      : usage.percentage >= threshold * 0.8
        ? 'WARNING'
        : 'OK',
  };
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const sessionIdIndex = args.indexOf('--session-id');
  const thresholdIndex = args.indexOf('--threshold');

  if (sessionIdIndex === -1 || !args[sessionIdIndex + 1]) {
    console.error('Usage: node token-monitor.mjs --session-id <id> [--threshold 0.90]');
    process.exit(1);
  }

  const sessionId = args[sessionIdIndex + 1];
  const threshold =
    thresholdIndex !== -1 && args[thresholdIndex + 1]
      ? parseFloat(args[thresholdIndex + 1])
      : DEFAULT_THRESHOLD;

  const result = await monitorContext(sessionId, threshold);

  console.log(JSON.stringify(result, null, 2));

  // Exit with code 1 if handoff should be triggered (for use in scripts)
  if (result.shouldHandoff) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default { monitorContext, getContextUsage, shouldTriggerHandoff, updateSessionState };
