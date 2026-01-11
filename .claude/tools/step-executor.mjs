#!/usr/bin/env node
/**
 * Step Executor with Timeout and Retry (Cursor Recommendations #12, #13)
 *
 * Provides enhanced step execution with:
 * - Configurable timeouts for long-running steps
 * - Validation error recovery with retry logic
 * - Enhanced error logging
 *
 * Usage:
 *   import { executeStepWithTimeout, executeStepWithRetry } from './step-executor.mjs';
 *
 *   // Execute with timeout
 *   const result = await executeStepWithTimeout(step, context, { timeout: 300000 });
 *
 *   // Execute with validation retry
 *   const result = await executeStepWithRetry(step, context, { maxRetries: 2 });
 *
 * @module step-executor
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load js-yaml for config parsing
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (e) {
  yaml = null;
}

/**
 * Load workflow timeout configuration from config.yaml
 * @returns {Object} Timeout configuration
 */
export function loadTimeoutConfig() {
  const defaults = {
    default: 300000, // 5 minutes
    by_agent: {
      analyst: 600000,
      architect: 900000,
      developer: 1200000,
      qa: 600000,
      'llm-architect': 900000,
      'security-architect': 600000,
      'code-reviewer': 480000,
      planner: 600000
    }
  };

  if (!yaml) {
    return defaults;
  }

  const configPath = path.join(__dirname, '../config.yaml');
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(configContent);
      return config?.workflow?.timeouts || defaults;
    }
  } catch (err) {
    console.warn(`[timeout] Could not load timeout config: ${err.message}`);
  }
  return defaults;
}

/**
 * Load validation retry configuration from config.yaml
 * @returns {Object} Retry configuration
 */
export function loadRetryConfig() {
  const defaults = {
    enabled: true,
    max_retries: 2,
    include_feedback: true,
    backoff_base_ms: 1000,
    backoff_max_ms: 5000
  };

  if (!yaml) {
    return defaults;
  }

  const configPath = path.join(__dirname, '../config.yaml');
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(configContent);
      return config?.workflow?.validation_retry || defaults;
    }
  } catch (err) {
    console.warn(`[retry] Could not load retry config: ${err.message}`);
  }
  return defaults;
}

/**
 * Get timeout for a specific agent
 * @param {string} agent - Agent name
 * @returns {number} Timeout in milliseconds
 */
export function getAgentTimeout(agent) {
  const config = loadTimeoutConfig();
  return config.by_agent?.[agent] || config.default || 300000;
}

/**
 * Sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a step with timeout handling (Cursor Recommendation #13)
 *
 * @param {Function} executeFn - Async function to execute the step
 * @param {Object} context - Execution context
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {string} options.agent - Agent name (for timeout lookup)
 * @param {string} options.step - Step identifier
 * @returns {Promise<Object>} - Execution result
 * @throws {Error} - If step times out
 */
export async function executeStepWithTimeout(executeFn, context = {}, options = {}) {
  const agent = options.agent || context.agent || 'unknown';
  const step = options.step || context.step || 'unknown';

  // Determine timeout
  let timeout = options.timeout;
  if (!timeout) {
    timeout = getAgentTimeout(agent);
  }

  console.log(`[timeout] Step ${step} (${agent}): timeout set to ${timeout}ms (${(timeout / 60000).toFixed(1)} min)`);

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(
        `Step ${step} (${agent}) timed out after ${timeout}ms (${(timeout / 60000).toFixed(1)} minutes)`
      );
      error.code = 'STEP_TIMEOUT';
      error.step = step;
      error.agent = agent;
      error.timeout = timeout;
      reject(error);
    }, timeout);

    // Allow timer to be cleared when step completes
    timer.unref && timer.unref();
  });

  // Race between step execution and timeout
  try {
    const result = await Promise.race([
      executeFn(),
      timeoutPromise
    ]);

    return result;
  } catch (error) {
    if (error.code === 'STEP_TIMEOUT') {
      console.error(`[timeout] Step ${step} (${agent}) TIMED OUT after ${timeout}ms`);

      // Log timeout error with context
      const errorLogger = await import('./error-logger.mjs').catch(() => null);
      if (errorLogger) {
        errorLogger.logError(error, {
          ...context,
          step,
          agent,
          operation: 'step_execution_timeout',
          metadata: { timeout }
        });
      }
    }
    throw error;
  }
}

/**
 * Execute a step with validation retry logic (Cursor Recommendation #12)
 *
 * If validation fails, provides feedback and retries up to maxRetries times.
 *
 * @param {Function} executeFn - Async function to execute the step
 * @param {Function} validateFn - Async function to validate the result
 * @param {Object} context - Execution context
 * @param {Object} options - Options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 2)
 * @param {boolean} options.includeFeedback - Include validation errors in retry context
 * @param {number} options.backoffBaseMs - Base delay for exponential backoff
 * @param {number} options.backoffMaxMs - Maximum delay for backoff
 * @returns {Promise<Object>} - Execution result
 * @throws {Error} - If all retries fail
 */
export async function executeStepWithRetry(executeFn, validateFn, context = {}, options = {}) {
  const config = loadRetryConfig();

  const maxRetries = options.maxRetries ?? config.max_retries ?? 2;
  const includeFeedback = options.includeFeedback ?? config.include_feedback ?? true;
  const backoffBaseMs = options.backoffBaseMs ?? config.backoff_base_ms ?? 1000;
  const backoffMaxMs = options.backoffMaxMs ?? config.backoff_max_ms ?? 5000;

  if (!config.enabled && !options.forceRetry) {
    // Retry disabled - execute once
    const result = await executeFn(context);
    const validation = validateFn ? await validateFn(result) : { valid: true };
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors?.join(', ') || 'Unknown error'}`);
    }
    return result;
  }

  let attempt = 0;
  let lastError = null;
  let lastValidationErrors = [];

  while (attempt < maxRetries) {
    attempt++;

    try {
      // Add validation feedback to context if this is a retry
      const retryContext = { ...context };
      if (attempt > 1 && includeFeedback && lastValidationErrors.length > 0) {
        retryContext.validationFeedback = {
          errors: lastValidationErrors,
          attempt,
          message: `Previous attempt failed validation. Issues: ${lastValidationErrors.join(', ')}`
        };
        console.log(`[retry] Attempt ${attempt}/${maxRetries}: Including validation feedback in context`);
      }

      // Execute step
      const result = await executeFn(retryContext);

      // Validate result
      if (validateFn) {
        const validation = await validateFn(result);

        if (validation.valid) {
          if (attempt > 1) {
            console.log(`[retry] Step succeeded on attempt ${attempt}/${maxRetries}`);
          }
          return result;
        }

        // Validation failed
        lastValidationErrors = validation.errors || ['Unknown validation error'];
        lastError = new Error(`Validation failed: ${lastValidationErrors.join(', ')}`);

        console.warn(
          `[retry] Attempt ${attempt}/${maxRetries} validation failed:`,
          lastValidationErrors
        );

        // If not last attempt, wait before retry
        if (attempt < maxRetries) {
          const delay = Math.min(backoffBaseMs * Math.pow(2, attempt - 1), backoffMaxMs);
          console.log(`[retry] Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      } else {
        // No validation function - return result directly
        return result;
      }
    } catch (error) {
      lastError = error;
      console.error(`[retry] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      // If not last attempt, wait before retry
      if (attempt < maxRetries) {
        const delay = Math.min(backoffBaseMs * Math.pow(2, attempt - 1), backoffMaxMs);
        console.log(`[retry] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  const finalError = new Error(
    `Step failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
  finalError.code = 'RETRY_EXHAUSTED';
  finalError.attempts = maxRetries;
  finalError.lastError = lastError;
  finalError.lastValidationErrors = lastValidationErrors;

  // Log error with context
  const errorLogger = await import('./error-logger.mjs').catch(() => null);
  if (errorLogger) {
    errorLogger.logError(finalError, {
      ...context,
      operation: 'step_execution_retry_exhausted',
      metadata: {
        attempts: maxRetries,
        lastValidationErrors
      }
    });
  }

  throw finalError;
}

/**
 * Execute a step with both timeout and retry (combined)
 *
 * @param {Function} executeFn - Async function to execute the step
 * @param {Function} validateFn - Async function to validate the result
 * @param {Object} context - Execution context
 * @param {Object} options - Options (combines timeout and retry options)
 * @returns {Promise<Object>} - Execution result
 */
export async function executeStepWithTimeoutAndRetry(executeFn, validateFn, context = {}, options = {}) {
  // Wrap executeFn with timeout
  const executeWithTimeout = () => executeStepWithTimeout(executeFn, context, {
    timeout: options.timeout,
    agent: options.agent || context.agent,
    step: options.step || context.step
  });

  // Execute with retry
  return executeStepWithRetry(
    executeWithTimeout,
    validateFn,
    context,
    {
      maxRetries: options.maxRetries,
      includeFeedback: options.includeFeedback,
      backoffBaseMs: options.backoffBaseMs,
      backoffMaxMs: options.backoffMaxMs,
      forceRetry: options.forceRetry
    }
  );
}

/**
 * Create a step executor with preconfigured options
 *
 * @param {Object} defaultOptions - Default options for all executions
 * @returns {Object} - Step executor with bound options
 */
export function createStepExecutor(defaultOptions = {}) {
  return {
    executeWithTimeout: (executeFn, context, options) =>
      executeStepWithTimeout(executeFn, context, { ...defaultOptions, ...options }),

    executeWithRetry: (executeFn, validateFn, context, options) =>
      executeStepWithRetry(executeFn, validateFn, context, { ...defaultOptions, ...options }),

    executeWithTimeoutAndRetry: (executeFn, validateFn, context, options) =>
      executeStepWithTimeoutAndRetry(executeFn, validateFn, context, { ...defaultOptions, ...options }),

    getAgentTimeout,
    loadTimeoutConfig,
    loadRetryConfig
  };
}

// Default export
export default {
  executeStepWithTimeout,
  executeStepWithRetry,
  executeStepWithTimeoutAndRetry,
  createStepExecutor,
  getAgentTimeout,
  loadTimeoutConfig,
  loadRetryConfig
};
