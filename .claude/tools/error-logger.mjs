#!/usr/bin/env node
/**
 * Enhanced Error Context Logger (Cursor Recommendation #10)
 *
 * Creates detailed error files with full context for debugging workflow failures.
 * Error files are saved to `.claude/context/runs/<run_id>/errors/`
 *
 * Error context includes:
 * - Timestamp and error details
 * - Run, CUJ, step, agent, skill, and phase context
 * - Sanitized inputs and configuration
 * - System information (platform, node version, memory)
 *
 * Usage:
 *   import { logError, logStepError, logProviderError } from './error-logger.mjs';
 *
 *   // Log a general error
 *   logError(error, { runId: 'run-123', step: '05', agent: 'developer' });
 *
 *   // Log a step execution error
 *   logStepError(error, step, runId, workflowId);
 *
 *   // Log a provider error (for multi-AI operations)
 *   logProviderError(error, provider, { runId, operation: 'review' });
 *
 * @module error-logger
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to import sanitize-secrets, fallback to basic sanitization
let sanitize;
try {
  const sanitizeModule = await import('../../codex-skills/shared/sanitize-secrets.js');
  sanitize = sanitizeModule.sanitize || sanitizeModule.default?.sanitize;
} catch (e) {
  // Fallback: basic sanitization for API keys
  sanitize = (text) => {
    if (text == null) return '';
    const str = String(text);
    return str
      .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_ANTHROPIC_KEY]')
      .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_OPENAI_KEY]')
      .replace(/AIza[a-zA-Z0-9_-]{20,}/g, '[REDACTED_GOOGLE_KEY]')
      .replace(/gh[pousr]_[a-zA-Z0-9]{20,}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/[a-zA-Z0-9_-]{40,}/g, '[REDACTED_LONG_TOKEN]');
  };
}

/**
 * Get the error directory for a run
 * @param {string} runId - Run identifier
 * @returns {string} - Path to error directory
 */
function getErrorDirectory(runId) {
  const projectRoot = path.resolve(__dirname, '../..');

  if (runId) {
    return path.join(projectRoot, '.claude/context/runs', runId, 'errors');
  }

  // Fallback to default errors directory
  return path.join(projectRoot, '.claude/context/errors');
}

/**
 * Ensure the error directory exists
 * @param {string} errorDir - Path to error directory
 */
function ensureErrorDirectory(errorDir) {
  if (!fs.existsSync(errorDir)) {
    fs.mkdirSync(errorDir, { recursive: true });
  }
}

/**
 * Generate a unique error file name
 * @param {Object} context - Error context
 * @returns {string} - Error file name
 */
function generateErrorFileName(context) {
  const timestamp = Date.now();
  const step = context.step || 'unknown';
  const agent = context.agent || 'unknown';

  // Sanitize step and agent for filename safety
  const safeStep = String(step).replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeAgent = String(agent).replace(/[^a-zA-Z0-9_-]/g, '-');

  return `${safeStep}-${safeAgent}-${timestamp}.json`;
}

/**
 * Extract safe stack trace (first N lines)
 * @param {string} stack - Full stack trace
 * @param {number} maxLines - Maximum lines to include
 * @returns {string} - Truncated stack trace
 */
function extractSafeStack(stack, maxLines = 20) {
  if (!stack) return '';

  const lines = String(stack).split('\n');
  const truncated = lines.slice(0, maxLines);

  if (lines.length > maxLines) {
    truncated.push(`... ${lines.length - maxLines} more lines`);
  }

  return truncated.join('\n');
}

/**
 * Log an error with full context
 * Creates a detailed error file in the run's errors directory
 *
 * @param {Error|string} error - The error to log
 * @param {Object} context - Error context
 * @param {string} context.runId - Run identifier
 * @param {string} context.cujId - CUJ identifier
 * @param {string} context.step - Step number or identifier
 * @param {string} context.agent - Agent name
 * @param {string} context.skill - Skill name
 * @param {string} context.phase - Phase name
 * @param {Object} context.inputs - Input data (will be sanitized)
 * @param {Object} context.config - Configuration (will be sanitized)
 * @param {string} context.operation - Operation being performed
 * @param {Object} context.metadata - Additional metadata
 * @returns {string|null} - Path to error file, or null on failure
 */
export function logError(error, context = {}) {
  try {
    const errorDir = getErrorDirectory(context.runId);
    ensureErrorDirectory(errorDir);

    const errorFile = path.join(errorDir, generateErrorFileName(context));

    // Extract error details
    let errorDetails;
    if (error instanceof Error) {
      errorDetails = {
        message: sanitize(error.message),
        name: error.name,
        code: error.code || null,
        stack: sanitize(extractSafeStack(error.stack)),
        // Include additional error properties if present
        errno: error.errno || null,
        syscall: error.syscall || null,
        path: error.path ? sanitize(error.path) : null
      };
    } else {
      errorDetails = {
        message: sanitize(String(error)),
        name: 'Error',
        code: null,
        stack: null
      };
    }

    // Build error data structure
    const errorData = {
      // Metadata
      timestamp: new Date().toISOString(),
      error_id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,

      // Context
      context: {
        run_id: context.runId || null,
        cuj_id: context.cujId || null,
        step: context.step || null,
        agent: context.agent || null,
        skill: context.skill || null,
        phase: context.phase || null,
        operation: context.operation || null,
        workflow_id: context.workflowId || null
      },

      // Error details
      error: errorDetails,

      // Sanitized inputs and config
      inputs: context.inputs ? JSON.parse(sanitize(JSON.stringify(context.inputs))) : null,
      config: context.config || {},

      // Additional metadata
      metadata: context.metadata || {},

      // System information
      system: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        memory: process.memoryUsage(),
        cwd: process.cwd(),
        env: process.env.NODE_ENV || 'development'
      },

      // Recovery hints
      recovery: {
        retryable: isRetryableError(error),
        suggested_action: getSuggestedAction(error, context)
      }
    };

    // Write error file
    fs.writeFileSync(errorFile, JSON.stringify(errorData, null, 2), 'utf-8');
    console.error(`[error-logger] Error logged to: ${errorFile}`);

    return errorFile;
  } catch (logError) {
    // Don't throw from the error logger - log to stderr instead
    console.error(`[error-logger] Failed to log error: ${logError.message}`);
    console.error(`[error-logger] Original error: ${sanitize(String(error))}`);
    return null;
  }
}

/**
 * Log a step execution error with workflow context
 *
 * @param {Error} error - The error that occurred
 * @param {Object} step - Step configuration
 * @param {string} runId - Run identifier
 * @param {string} workflowId - Workflow identifier
 * @param {Object} options - Additional options
 * @returns {string|null} - Path to error file
 */
export function logStepError(error, step, runId, workflowId, options = {}) {
  return logError(error, {
    runId,
    workflowId,
    step: step?.step || step?.name || 'unknown',
    agent: step?.agent || null,
    skill: step?.skill || options.skill || null,
    phase: options.phase || null,
    operation: 'step_execution',
    inputs: {
      step_config: step,
      ...options.inputs
    },
    config: options.config || {},
    metadata: {
      attempt: options.attempt || 1,
      max_attempts: options.maxAttempts || 1,
      previous_errors: options.previousErrors || [],
      ...options.metadata
    }
  });
}

/**
 * Log a provider error (for multi-AI operations)
 *
 * @param {Error} error - The error that occurred
 * @param {string} provider - Provider name (claude, gemini, etc.)
 * @param {Object} context - Error context
 * @returns {string|null} - Path to error file
 */
export function logProviderError(error, provider, context = {}) {
  return logError(error, {
    ...context,
    operation: `provider_${context.operation || 'call'}`,
    metadata: {
      provider,
      provider_config: context.providerConfig || {},
      ...context.metadata
    }
  });
}

/**
 * Log a validation error
 *
 * @param {Error} error - The error that occurred
 * @param {string} validationType - Type of validation (schema, gate, artifact)
 * @param {Object} context - Error context
 * @returns {string|null} - Path to error file
 */
export function logValidationError(error, validationType, context = {}) {
  return logError(error, {
    ...context,
    operation: `validation_${validationType}`,
    metadata: {
      validation_type: validationType,
      validation_errors: context.validationErrors || [],
      ...context.metadata
    }
  });
}

/**
 * Log a circuit breaker event
 *
 * @param {string} provider - Provider that triggered circuit breaker
 * @param {string} state - Circuit breaker state (open, half-open, closed)
 * @param {Object} context - Event context
 * @returns {string|null} - Path to event file
 */
export function logCircuitBreakerEvent(provider, state, context = {}) {
  // Use a different file naming for circuit breaker events
  const errorDir = getErrorDirectory(context.runId);
  ensureErrorDirectory(errorDir);

  const timestamp = Date.now();
  const eventFile = path.join(errorDir, `circuit-breaker-${provider}-${timestamp}.json`);

  const eventData = {
    timestamp: new Date().toISOString(),
    event_type: 'circuit_breaker',
    provider,
    state,
    failures: context.failures || 0,
    reset_timeout: context.resetTimeout || null,
    open_until: context.openUntil || null,
    context: {
      run_id: context.runId || null,
      operation: context.operation || null
    }
  };

  try {
    fs.writeFileSync(eventFile, JSON.stringify(eventData, null, 2), 'utf-8');
    console.error(`[error-logger] Circuit breaker event logged to: ${eventFile}`);
    return eventFile;
  } catch (e) {
    console.error(`[error-logger] Failed to log circuit breaker event: ${e.message}`);
    return null;
  }
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryableError(error) {
  if (!error) return false;

  const errorStr = String(error.message || error).toLowerCase();
  const code = error.code ? String(error.code).toUpperCase() : '';

  // Retryable patterns
  const retryablePatterns = [
    'timeout', 'etimedout', 'econnreset', 'econnrefused',
    'rate limit', 'too many requests', '429',
    'service unavailable', '503',
    'gateway timeout', '504',
    'temporary', 'transient'
  ];

  // Non-retryable patterns (auth failures, etc.)
  const nonRetryablePatterns = [
    'api key', 'unauthorized', 'forbidden', 'invalid credentials',
    'authentication', 'permission denied', 'access denied'
  ];

  // Check for non-retryable first
  for (const pattern of nonRetryablePatterns) {
    if (errorStr.includes(pattern)) {
      return false;
    }
  }

  // Check for retryable patterns
  for (const pattern of retryablePatterns) {
    if (errorStr.includes(pattern) || code.includes(pattern.toUpperCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Get suggested recovery action for an error
 * @param {Error} error - The error
 * @param {Object} context - Error context
 * @returns {string} - Suggested action
 */
function getSuggestedAction(error, context) {
  if (!error) return 'Review error details and retry';

  const errorStr = String(error.message || error).toLowerCase();

  // Auth failures
  if (errorStr.includes('api key') || errorStr.includes('unauthorized')) {
    return 'Check API key configuration and ensure credentials are valid';
  }

  // Timeout
  if (errorStr.includes('timeout') || error.code === 'ETIMEDOUT') {
    return 'Increase timeout or retry the operation';
  }

  // Rate limiting
  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return 'Wait before retrying or reduce request frequency';
  }

  // Schema validation
  if (errorStr.includes('schema') || errorStr.includes('validation')) {
    return 'Review output against schema requirements and fix validation errors';
  }

  // Missing artifact
  if (errorStr.includes('artifact') || errorStr.includes('not found')) {
    return 'Ensure required artifacts from previous steps exist';
  }

  // Connection errors
  if (errorStr.includes('econnrefused') || errorStr.includes('econnreset')) {
    return 'Check network connectivity and service availability';
  }

  // Default
  return context.step
    ? `Review step ${context.step} execution and retry`
    : 'Review error details and retry the operation';
}

/**
 * Get all errors for a run
 * @param {string} runId - Run identifier
 * @returns {Object[]} - Array of error objects
 */
export function getRunErrors(runId) {
  const errorDir = getErrorDirectory(runId);

  if (!fs.existsSync(errorDir)) {
    return [];
  }

  const errorFiles = fs.readdirSync(errorDir).filter(f => f.endsWith('.json'));
  const errors = [];

  for (const file of errorFiles) {
    try {
      const content = fs.readFileSync(path.join(errorDir, file), 'utf-8');
      errors.push(JSON.parse(content));
    } catch (e) {
      console.error(`[error-logger] Failed to read error file ${file}: ${e.message}`);
    }
  }

  // Sort by timestamp (newest first)
  errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return errors;
}

/**
 * Get error summary for a run
 * @param {string} runId - Run identifier
 * @returns {Object} - Error summary
 */
export function getErrorSummary(runId) {
  const errors = getRunErrors(runId);

  // Count by step
  const byStep = {};
  // Count by agent
  const byAgent = {};
  // Count by error type
  const byType = {};

  for (const error of errors) {
    const step = error.context?.step || 'unknown';
    const agent = error.context?.agent || 'unknown';
    const type = error.error?.name || 'Error';

    byStep[step] = (byStep[step] || 0) + 1;
    byAgent[agent] = (byAgent[agent] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    total_errors: errors.length,
    by_step: byStep,
    by_agent: byAgent,
    by_type: byType,
    most_recent: errors[0] || null,
    retryable_count: errors.filter(e => e.recovery?.retryable).length
  };
}

// Default export
export default {
  logError,
  logStepError,
  logProviderError,
  logValidationError,
  logCircuitBreakerEvent,
  getRunErrors,
  getErrorSummary
};
