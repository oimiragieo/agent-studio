#!/usr/bin/env node

/**
 * @file recovery-handler.mjs
 * @description Recovery pattern handler for automated failure recovery
 *
 * Supports 5 recovery strategies:
 * 1. retry - Retry operation with backoff
 * 2. escalate - Escalate to different agent
 * 3. skip - Skip failed step, continue workflow
 * 4. rollback - Revert to previous state
 * 5. halt - Stop workflow execution
 *
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Paths
const PATTERNS_DIR = path.join(PROJECT_ROOT, '.claude/schemas/recovery-patterns');
const LOGS_DIR = path.join(PROJECT_ROOT, '.claude/context/logs');
const RECOVERY_LOG = path.join(LOGS_DIR, 'recovery.log');
const STATE_DIR = path.join(PROJECT_ROOT, '.claude/context/runtime/recovery');

/**
 * Recovery Pattern Handler
 */
class RecoveryHandler {
  constructor() {
    this.patterns = new Map();
    this.recoveryHistory = [];
  }

  /**
   * Initialize recovery handler
   */
  async init() {
    await this.ensureDirectories();
    await this.loadPatterns();
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [PATTERNS_DIR, LOGS_DIR, STATE_DIR];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Load all recovery patterns
   */
  async loadPatterns() {
    try {
      const files = await fs.readdir(PATTERNS_DIR);
      const patternFiles = files.filter(f => f.endsWith('.json'));

      for (const file of patternFiles) {
        const filePath = path.join(PATTERNS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const pattern = JSON.parse(content);

        if (this.validatePattern(pattern)) {
          this.patterns.set(pattern.pattern_id, pattern);
        } else {
          console.warn(`Invalid pattern in ${file}`);
        }
      }

      console.log(`Loaded ${this.patterns.size} recovery patterns`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No recovery patterns directory found, creating default patterns');
        await this.createDefaultPatterns();
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate recovery pattern structure
   */
  validatePattern(pattern) {
    const required = ['pattern_id', 'name', 'triggers', 'strategy', 'priority'];
    return required.every(field => pattern.hasOwnProperty(field));
  }

  /**
   * Match failure to recovery pattern
   */
  matchPattern(failure) {
    const { type, severity, metadata = {} } = failure;
    const matchedPatterns = [];

    for (const [id, pattern] of this.patterns) {
      if (!pattern.enabled) continue;

      const triggered = pattern.triggers.some(trigger => {
        // Check condition match
        if (trigger.condition !== type) return false;

        // Check severity match
        const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
        if (severityLevels[trigger.severity] > severityLevels[severity]) {
          return false;
        }

        // Check error pattern match if provided
        if (trigger.error_pattern && metadata.error_message) {
          const regex = new RegExp(trigger.error_pattern);
          if (!regex.test(metadata.error_message)) return false;
        }

        // Check threshold (if tracking occurrences)
        if (trigger.threshold && trigger.threshold > 1) {
          const occurrences = this.countRecentOccurrences(
            type,
            trigger.timeframe_minutes || 60
          );
          if (occurrences < trigger.threshold) return false;
        }

        return true;
      });

      if (triggered) {
        matchedPatterns.push({ pattern, priority: pattern.priority });
      }
    }

    // Sort by priority (lower number = higher priority)
    matchedPatterns.sort((a, b) => a.priority - b.priority);

    return matchedPatterns.length > 0 ? matchedPatterns[0].pattern : null;
  }

  /**
   * Count recent occurrences of failure type
   */
  countRecentOccurrences(failureType, timeframeMinutes) {
    const cutoff = Date.now() - timeframeMinutes * 60 * 1000;
    return this.recoveryHistory.filter(
      h => h.failure_type === failureType && new Date(h.timestamp).getTime() > cutoff
    ).length;
  }

  /**
   * Apply recovery pattern
   */
  async applyPattern(pattern, failure, context = {}) {
    const recoveryAttempt = {
      timestamp: new Date().toISOString(),
      pattern_id: pattern.pattern_id,
      failure_type: failure.type,
      strategy: pattern.strategy,
      context,
      result: null,
      error: null,
    };

    try {
      await this.logRecovery(`Applying recovery pattern: ${pattern.name}`, 'INFO');

      let result;
      switch (pattern.strategy) {
        case 'retry':
          result = await this.executeRetry(pattern, failure, context);
          break;
        case 'escalate':
          result = await this.executeEscalate(pattern, failure, context);
          break;
        case 'skip':
          result = await this.executeSkip(pattern, failure, context);
          break;
        case 'rollback':
          result = await this.executeRollback(pattern, failure, context);
          break;
        case 'halt':
          result = await this.executeHalt(pattern, failure, context);
          break;
        default:
          throw new Error(`Unknown recovery strategy: ${pattern.strategy}`);
      }

      recoveryAttempt.result = result;
      recoveryAttempt.success = result.success;

      await this.logRecovery(
        `Recovery ${result.success ? 'succeeded' : 'failed'}: ${result.message}`,
        result.success ? 'INFO' : 'ERROR'
      );

      return result;
    } catch (error) {
      recoveryAttempt.error = error.message;
      recoveryAttempt.success = false;
      await this.logRecovery(`Recovery error: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      this.recoveryHistory.push(recoveryAttempt);
      await this.saveRecoveryState();
    }
  }

  /**
   * Execute retry recovery strategy
   */
  async executeRetry(pattern, failure, context) {
    const policy = pattern.retry_policy;
    const attempt = (context.retry_count || 0) + 1;

    if (attempt > policy.max_attempts) {
      return {
        success: false,
        strategy: 'retry',
        message: `Max retry attempts (${policy.max_attempts}) exceeded`,
        next_action: 'escalate_or_halt',
      };
    }

    // Calculate delay based on backoff strategy
    const delay = this.calculateDelay(policy, attempt);

    await this.logRecovery(
      `Retry attempt ${attempt}/${policy.max_attempts} with ${delay}ms delay`,
      'INFO'
    );

    // In actual implementation, this would trigger task retry
    return {
      success: true,
      strategy: 'retry',
      message: `Scheduled retry attempt ${attempt}/${policy.max_attempts}`,
      delay_ms: delay,
      timeout_multiplier: policy.timeout_multiplier || 1.0,
      retry_count: attempt,
      action: 'schedule_retry',
    };
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  calculateDelay(policy, attempt) {
    const baseDelay = policy.delay_ms || 1000;
    let delay;

    switch (policy.backoff) {
      case 'fixed':
        delay = baseDelay;
        break;
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
      default:
        delay = baseDelay;
    }

    // Apply max delay cap
    const maxDelay = policy.max_delay_ms || 60000;
    delay = Math.min(delay, maxDelay);

    // Apply jitter if enabled
    if (policy.jitter) {
      const jitterFactor = policy.jitter_factor || 0.1;
      const jitter = delay * jitterFactor * Math.random();
      delay = Math.floor(delay + jitter);
    }

    return delay;
  }

  /**
   * Execute escalate recovery strategy
   */
  async executeEscalate(pattern, failure, context) {
    const escalation = pattern.escalation;
    const escalationCount = (context.escalation_count || 0) + 1;

    if (escalationCount > (escalation.max_escalations || 2)) {
      return {
        success: false,
        strategy: 'escalate',
        message: `Max escalations (${escalation.max_escalations}) exceeded`,
        next_action: 'halt',
      };
    }

    const targetAgent = escalation.escalation_chain
      ? escalation.escalation_chain[escalationCount - 1]
      : escalation.to_agent;

    await this.logRecovery(
      `Escalating to ${targetAgent} (escalation ${escalationCount})`,
      'INFO'
    );

    return {
      success: true,
      strategy: 'escalate',
      message: `Escalated to ${targetAgent}`,
      target_agent: targetAgent,
      timeout_multiplier: escalation.timeout_multiplier || 2.0,
      priority_boost: escalation.priority_boost || 'medium',
      escalation_count: escalationCount,
      context: escalation.context || '',
      include_artifacts: escalation.include_artifacts !== false,
      include_logs: escalation.include_logs !== false,
      action: 'create_escalation_task',
    };
  }

  /**
   * Execute skip recovery strategy
   */
  async executeSkip(pattern, failure, context) {
    const skip = pattern.skip;

    if (skip.require_approval && !context.approval_granted) {
      return {
        success: false,
        strategy: 'skip',
        message: 'Skip requires human approval',
        action: 'request_approval',
        approval_required: true,
      };
    }

    await this.logRecovery(
      `Skipping failed step: ${skip.reason}`,
      skip.impact === 'critical' ? 'WARN' : 'INFO'
    );

    return {
      success: true,
      strategy: 'skip',
      message: `Step skipped: ${skip.reason}`,
      impact: skip.impact,
      continue_workflow: skip.continue_workflow !== false,
      mark_degraded: skip.mark_workflow_degraded !== false,
      skip_dependent_steps: skip.skip_dependent_steps || false,
      alternative_steps: skip.alternative_steps || [],
      action: 'skip_and_continue',
    };
  }

  /**
   * Execute rollback recovery strategy
   */
  async executeRollback(pattern, failure, context) {
    const rollback = pattern.rollback;

    await this.logRecovery(
      `Rolling back to ${rollback.target_state}`,
      'WARN'
    );

    // Determine target checkpoint
    let checkpointId;
    switch (rollback.target_state) {
      case 'previous_step':
        checkpointId = context.previous_checkpoint;
        break;
      case 'workflow_start':
        checkpointId = context.initial_checkpoint;
        break;
      case 'last_checkpoint':
        checkpointId = context.last_checkpoint;
        break;
      case 'custom':
        checkpointId = rollback.custom_checkpoint_id;
        break;
      default:
        checkpointId = context.previous_checkpoint;
    }

    if (!checkpointId) {
      return {
        success: false,
        strategy: 'rollback',
        message: `No checkpoint found for target_state: ${rollback.target_state}`,
        action: 'halt',
      };
    }

    return {
      success: true,
      strategy: 'rollback',
      message: `Rolling back to checkpoint: ${checkpointId}`,
      checkpoint_id: checkpointId,
      preserve_artifacts: rollback.preserve_artifacts !== false,
      cleanup_files: rollback.cleanup_files || [],
      cleanup_directories: rollback.cleanup_directories || [],
      restore_files: rollback.restore_files || [],
      notify_on_rollback: rollback.notify_on_rollback !== false,
      halt_after_rollback: rollback.halt_workflow_on_rollback || false,
      action: 'execute_rollback',
    };
  }

  /**
   * Execute halt recovery strategy
   */
  async executeHalt(pattern, failure, context) {
    const halt = pattern.halt;

    await this.logRecovery(
      `Halting workflow: ${halt.reason}`,
      'ERROR'
    );

    // Execute cleanup if required
    let cleanupResult = null;
    if (halt.cleanup_required) {
      cleanupResult = await this.executeCleanup(halt, context);
    }

    return {
      success: true,
      strategy: 'halt',
      message: `Workflow halted: ${halt.reason}`,
      reason: halt.reason,
      cleanup_executed: halt.cleanup_required || false,
      cleanup_result: cleanupResult,
      preserve_state: halt.preserve_state !== false,
      preserve_artifacts: halt.preserve_artifacts !== false,
      preserve_logs: halt.preserve_logs !== false,
      notify: halt.notify || ['orchestrator', 'user'],
      notification_channels: halt.notification_channels || ['log'],
      create_incident: halt.create_incident || false,
      incident_severity: halt.incident_severity || 'medium',
      allow_resume: halt.allow_resume || false,
      action: 'halt_workflow',
    };
  }

  /**
   * Execute cleanup operations
   */
  async executeCleanup(halt, context) {
    const timeout = (halt.cleanup_timeout_minutes || 5) * 60 * 1000;
    const startTime = Date.now();

    try {
      // In actual implementation, this would execute cleanup tasks
      await this.logRecovery('Executing cleanup operations', 'INFO');

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        message: 'Cleanup completed successfully',
      };
    } catch (error) {
      await this.logRecovery(`Cleanup failed: ${error.message}`, 'ERROR');
      return {
        success: false,
        duration_ms: Date.now() - startTime,
        message: `Cleanup failed: ${error.message}`,
      };
    }
  }

  /**
   * Log recovery event
   */
  async logRecovery(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    await fs.appendFile(RECOVERY_LOG, logLine, 'utf-8');
    console.log(`[RECOVERY] ${message}`);
  }

  /**
   * Save recovery state
   */
  async saveRecoveryState() {
    const state = {
      patterns_loaded: this.patterns.size,
      recovery_history: this.recoveryHistory.slice(-100), // Keep last 100
      last_updated: new Date().toISOString(),
    };

    const statePath = path.join(STATE_DIR, 'recovery-state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * Get recovery statistics
   */
  getStats() {
    const total = this.recoveryHistory.length;
    const successful = this.recoveryHistory.filter(r => r.success).length;
    const byStrategy = {};

    for (const record of this.recoveryHistory) {
      byStrategy[record.strategy] = (byStrategy[record.strategy] || 0) + 1;
    }

    return {
      total_recoveries: total,
      successful_recoveries: successful,
      success_rate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : 'N/A',
      by_strategy: byStrategy,
      patterns_loaded: this.patterns.size,
    };
  }

  /**
   * List all loaded patterns
   */
  listPatterns() {
    return Array.from(this.patterns.values()).map(p => ({
      pattern_id: p.pattern_id,
      name: p.name,
      strategy: p.strategy,
      priority: p.priority,
      enabled: p.enabled !== false,
      triggers: p.triggers.map(t => t.condition),
    }));
  }

  /**
   * Create default recovery patterns
   */
  async createDefaultPatterns() {
    // This method stub - actual default patterns created separately
    await this.logRecovery('Default patterns should be created manually', 'INFO');
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const handler = new RecoveryHandler();

  try {
    await handler.init();

    // Parse command
    const command = args[0];

    switch (command) {
      case '--test':
        await testRecoveryHandler(handler);
        break;

      case '--apply': {
        const patternId = args[args.indexOf('--pattern') + 1];
        const failureType = args[args.indexOf('--failure') + 1];

        if (!patternId || !failureType) {
          console.error('Usage: --apply --pattern <pattern-id> --failure <type>');
          process.exit(1);
        }

        const pattern = handler.patterns.get(patternId);
        if (!pattern) {
          console.error(`Pattern not found: ${patternId}`);
          process.exit(1);
        }

        const failure = {
          type: failureType,
          severity: 'medium',
          metadata: {},
        };

        const result = await handler.applyPattern(pattern, failure);
        console.log('\nRecovery Result:');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case '--list-patterns': {
        const patterns = handler.listPatterns();
        console.log('\nLoaded Recovery Patterns:');
        console.log(JSON.stringify(patterns, null, 2));
        break;
      }

      case '--stats': {
        const stats = handler.getStats();
        console.log('\nRecovery Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        break;
      }

      case '--match': {
        const failureType = args[args.indexOf('--failure') + 1];
        const severity = args[args.indexOf('--severity') + 1] || 'medium';

        if (!failureType) {
          console.error('Usage: --match --failure <type> [--severity <level>]');
          process.exit(1);
        }

        const failure = { type: failureType, severity };
        const pattern = handler.matchPattern(failure);

        if (pattern) {
          console.log('\nMatched Pattern:');
          console.log(JSON.stringify(pattern, null, 2));
        } else {
          console.log(`\nNo pattern matched for failure: ${failureType} (${severity})`);
        }
        break;
      }

      case '--help':
      default:
        printHelp();
        process.exit(command === '--help' ? 0 : 1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Test recovery handler
 */
async function testRecoveryHandler(handler) {
  console.log('Testing Recovery Handler...\n');

  const testCases = [
    {
      name: 'Timeout Retry',
      failure: { type: 'timeout', severity: 'medium', metadata: {} },
    },
    {
      name: 'Test Failure Escalate',
      failure: { type: 'test_failure', severity: 'high', metadata: {} },
    },
    {
      name: 'Dependency Missing',
      failure: { type: 'dependency_missing', severity: 'medium', metadata: {} },
    },
    {
      name: 'Compilation Error',
      failure: { type: 'compilation_error', severity: 'high', metadata: {} },
    },
    {
      name: 'Security Violation',
      failure: { type: 'security_violation', severity: 'critical', metadata: {} },
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`);
    const pattern = handler.matchPattern(testCase.failure);

    if (pattern) {
      console.log(`Matched: ${pattern.name}`);
      const result = await handler.applyPattern(pattern, testCase.failure);
      results.push({
        test: testCase.name,
        pattern: pattern.name,
        strategy: pattern.strategy,
        success: result.success,
        result,
      });
    } else {
      console.log('No pattern matched');
      results.push({
        test: testCase.name,
        pattern: null,
        strategy: null,
        success: false,
        result: null,
      });
    }
  }

  console.log('\n=== Test Summary ===');
  console.log(JSON.stringify(results, null, 2));

  console.log('\n=== Recovery Statistics ===');
  const stats = handler.getStats();
  console.log(JSON.stringify(stats, null, 2));
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Recovery Handler CLI

Usage:
  node recovery-handler.mjs <command> [options]

Commands:
  --test                                Test recovery handler with sample failures
  --apply --pattern <id> --failure <type>   Apply recovery pattern to failure
  --match --failure <type> [--severity <level>]   Match failure to recovery pattern
  --list-patterns                       List all loaded recovery patterns
  --stats                               Show recovery statistics
  --help                                Show this help message

Examples:
  # Test recovery handler
  node recovery-handler.mjs --test

  # Apply specific pattern
  node recovery-handler.mjs --apply --pattern timeout-retry --failure timeout

  # Match failure to pattern
  node recovery-handler.mjs --match --failure test_failure --severity high

  # List all patterns
  node recovery-handler.mjs --list-patterns

  # Show statistics
  node recovery-handler.mjs --stats
  `);
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default RecoveryHandler;
