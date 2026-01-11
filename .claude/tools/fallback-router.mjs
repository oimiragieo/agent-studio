#!/usr/bin/env node
/**
 * Routes tasks to fallback agents when primary agent fails
 *
 * Usage:
 *   node .claude/tools/fallback-router.mjs --task <task.json> --failed-agent <agent>
 *   node .claude/tools/fallback-router.mjs --agent <agent> --list-fallbacks
 *   node .claude/tools/fallback-router.mjs --validate
 *
 * Examples:
 *   # Route task to fallback after developer failure
 *   node .claude/tools/fallback-router.mjs --task task.json --failed-agent developer
 *
 *   # List fallback agents for architect
 *   node .claude/tools/fallback-router.mjs --agent architect --list-fallbacks
 *
 *   # Validate fallback configuration
 *   node .claude/tools/fallback-router.mjs --validate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FALLBACK_CONFIG = path.resolve(__dirname, '../config/fallback-agents.json');
const FALLBACK_SCHEMA = path.resolve(__dirname, '../schemas/fallback-agents.schema.json');

/**
 * Load fallback configuration
 */
function loadFallbackConfig() {
  if (!fs.existsSync(FALLBACK_CONFIG)) {
    throw new Error(`Fallback configuration not found: ${FALLBACK_CONFIG}`);
  }

  const content = fs.readFileSync(FALLBACK_CONFIG, 'utf8');
  return JSON.parse(content);
}

/**
 * Get fallback agent for a failed agent
 * @param {string} failedAgent - Agent that failed
 * @param {number} attemptNumber - Current fallback attempt (0-based)
 * @returns {object|null} Fallback info or null if no more fallbacks
 */
function getFallbackAgent(failedAgent, attemptNumber = 0) {
  const config = loadFallbackConfig();
  const fallbacks = config.fallback_map[failedAgent] || [];

  if (attemptNumber >= fallbacks.length) {
    return null; // No more fallbacks available
  }

  const maxAttempts = config.fallback_rules.max_fallback_attempts;
  if (attemptNumber >= maxAttempts) {
    return null; // Exceeded max attempts
  }

  return {
    agent: fallbacks[attemptNumber],
    attempt: attemptNumber + 1,
    remaining: Math.min(fallbacks.length - attemptNumber - 1, maxAttempts - attemptNumber - 1),
    totalFallbacks: fallbacks.length,
    maxAttempts: maxAttempts,
  };
}

/**
 * Route task to fallback agent
 * @param {object} task - Original task data
 * @param {string} failedAgent - Agent that failed
 * @param {string} error - Error message/reason for failure
 * @returns {object} Routing result
 */
function routeToFallback(task, failedAgent, error) {
  const config = loadFallbackConfig();
  const fallbackAttempt = task.fallbackAttempt || 0;
  const fallback = getFallbackAgent(failedAgent, fallbackAttempt);

  if (!fallback) {
    return {
      status: 'escalate',
      message: `No fallback agents available for ${failedAgent} (attempt ${fallbackAttempt})`,
      originalError: error,
      escalationStrategy: config.fallback_rules.escalation_strategy || 'orchestrator',
      recommendation: 'Route to orchestrator for manual review',
    };
  }

  const routingInfo = {
    status: 'retry',
    newAgent: fallback.agent,
    attemptNumber: fallback.attempt,
    remainingFallbacks: fallback.remaining,
    task: {
      ...task,
      originalAgent: task.originalAgent || failedAgent,
      fallbackAttempt: fallback.attempt,
      fallbackReason: error,
      fallbackHistory: [
        ...(task.fallbackHistory || []),
        {
          agent: failedAgent,
          error: error,
          timestamp: new Date().toISOString(),
          attemptNumber: fallbackAttempt,
        },
      ],
    },
  };

  if (config.fallback_rules.notify_on_fallback) {
    routingInfo.notification = {
      message: `Routing from ${failedAgent} to ${fallback.agent} (attempt ${fallback.attempt}/${fallback.maxAttempts})`,
      reason: error,
      remainingFallbacks: fallback.remaining,
    };
  }

  return routingInfo;
}

/**
 * List all fallback agents for a given agent
 * @param {string} agent - Agent name
 * @returns {object} Fallback information
 */
function listFallbacks(agent) {
  const config = loadFallbackConfig();
  const fallbacks = config.fallback_map[agent] || [];
  const capabilities = config.agent_capabilities?.[agent] || null;

  return {
    agent: agent,
    fallbacks: fallbacks,
    maxAttempts: config.fallback_rules.max_fallback_attempts,
    capabilities: capabilities,
    hasFallbacks: fallbacks.length > 0,
  };
}

/**
 * Validate fallback configuration
 * @returns {object} Validation result
 */
function validateConfig() {
  const errors = [];
  const warnings = [];

  try {
    const config = loadFallbackConfig();

    // Check all fallback agents exist in the map
    for (const [agent, fallbacks] of Object.entries(config.fallback_map)) {
      for (const fallbackAgent of fallbacks) {
        if (
          !config.fallback_map[fallbackAgent] &&
          !['orchestrator', 'master-orchestrator'].includes(fallbackAgent)
        ) {
          warnings.push(
            `Fallback agent "${fallbackAgent}" for "${agent}" not found in fallback_map`
          );
        }
      }
    }

    // Check for circular dependencies
    for (const [agent, fallbacks] of Object.entries(config.fallback_map)) {
      if (fallbacks.includes(agent)) {
        errors.push(`Circular dependency: "${agent}" lists itself as fallback`);
      }

      // Check for direct circular fallback (A -> B, B -> A)
      for (const fallbackAgent of fallbacks) {
        const fallbackFallbacks = config.fallback_map[fallbackAgent] || [];
        if (fallbackFallbacks.includes(agent)) {
          warnings.push(`Circular fallback detected: "${agent}" <-> "${fallbackAgent}"`);
        }
      }
    }

    // Validate against schema if available
    if (fs.existsSync(FALLBACK_SCHEMA)) {
      // Schema validation would go here (requires additional dependency)
      warnings.push('Schema validation not implemented (requires ajv)');
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      agentCount: Object.keys(config.fallback_map).length,
      totalFallbackPaths: Object.values(config.fallback_map).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: warnings,
    };
  }
}

/**
 * CLI handler
 */
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = flag => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : null;
  };

  const hasFlag = flag => args.includes(flag);

  try {
    // Validate command
    if (hasFlag('--validate')) {
      const result = validateConfig();
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);
    }

    // List fallbacks
    if (hasFlag('--list-fallbacks')) {
      const agent = getArg('--agent');
      if (!agent) {
        console.error('Error: --agent required with --list-fallbacks');
        process.exit(1);
      }

      const result = listFallbacks(agent);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    // Route to fallback
    const taskFile = getArg('--task');
    const failedAgent = getArg('--failed-agent');
    const errorMsg = getArg('--error') || 'Agent failed';

    if (!taskFile || !failedAgent) {
      console.error(
        'Usage: fallback-router.mjs --task <file> --failed-agent <agent> [--error <msg>]'
      );
      console.error('       fallback-router.mjs --agent <agent> --list-fallbacks');
      console.error('       fallback-router.mjs --validate');
      process.exit(1);
    }

    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    const result = routeToFallback(task, failedAgent, errorMsg);

    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    process.exit(result.status === 'retry' ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getFallbackAgent, routeToFallback, listFallbacks, validateConfig };
