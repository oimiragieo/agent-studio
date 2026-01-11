#!/usr/bin/env node
/**
 * Error Recovery System
 *
 * Implements comprehensive error classification and automatic recovery strategies
 * for LLM-RULES workflows. Handles transient, permanent, recoverable, and critical errors.
 *
 * Usage:
 *   import { ErrorRecovery } from './error-recovery.mjs';
 *
 *   try {
 *     result = await operation();
 *   } catch (error) {
 *     const recoveryResult = await ErrorRecovery.recover(error, context);
 *     if (recoveryResult.success) {
 *       // Recovery successful
 *     } else {
 *       // Handle unrecoverable error
 *     }
 *   }
 *
 * @module error-recovery
 * @version 1.0.0
 */

import { appendFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const CONTEXT_DIR = join(__dirname, '..', 'context');
const LOGS_DIR = join(CONTEXT_DIR, 'logs');
const ERROR_RECOVERY_LOG = join(LOGS_DIR, 'error-recovery.log');

// Recovery configuration
const MAX_RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;
const JITTER_MS = 200;

/**
 * Error categories
 */
export const ErrorCategory = {
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  RECOVERABLE: 'recoverable',
  CRITICAL: 'critical'
};

/**
 * Main ErrorRecovery class
 */
export class ErrorRecovery {
  /**
   * Recover from an error based on its classification
   *
   * @param {Error} error - The error to recover from
   * @param {Object} context - Error context
   * @param {string} context.operation - Operation that failed
   * @param {number} context.stepNumber - Workflow step number
   * @param {string} context.workflowId - Workflow identifier
   * @param {string} context.runId - Run identifier
   * @param {boolean} context.interactive - Whether to prompt user
   * @param {boolean} context.rollbackSupported - Whether rollback is supported
   * @returns {Promise<Object>} Recovery result
   */
  static async recover(error, context) {
    const category = this.classify(error);
    await this.logRecoveryAttempt(error, context, category);

    switch (category) {
      case ErrorCategory.TRANSIENT:
        return await this.retryWithBackoff(error, context);
      case ErrorCategory.PERMANENT:
        return this.failFast(error, context);
      case ErrorCategory.RECOVERABLE:
        return await this.promptUser(error, context);
      case ErrorCategory.CRITICAL:
        return await this.stopAndRollback(error, context);
      default:
        // Unknown category, default to fail fast
        return this.failFast(error, context);
    }
  }

  /**
   * Classify error into one of four categories
   *
   * @param {Error} error - The error to classify
   * @returns {string} Error category
   */
  static classify(error) {
    // Critical errors (highest priority)
    if (this.isCriticalError(error)) {
      return ErrorCategory.CRITICAL;
    }

    // Transient errors
    if (this.isTransientError(error)) {
      return ErrorCategory.TRANSIENT;
    }

    // Permanent errors
    if (this.isPermanentError(error)) {
      return ErrorCategory.PERMANENT;
    }

    // Recoverable errors
    if (this.isRecoverableError(error)) {
      return ErrorCategory.RECOVERABLE;
    }

    // Default to permanent (fail fast)
    return ErrorCategory.PERMANENT;
  }

  /**
   * Check if error is transient (retry safe)
   */
  static isTransientError(error) {
    const transientCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'EBUSY', 'ENOTFOUND', 'ECONNRESET'];
    const transientMessages = /timeout|rate limit|temporarily unavailable|service unavailable|connection reset/i;

    return (
      transientCodes.includes(error.code) ||
      error.statusCode === 429 ||
      error.statusCode === 503 ||
      transientMessages.test(error.message)
    );
  }

  /**
   * Check if error is permanent (no retry)
   */
  static isPermanentError(error) {
    const permanentCodes = ['ENOENT', 'EACCES', 'EPERM'];
    const permanentStatuses = [401, 403, 404, 410];
    const permanentMessages = /not found|permission denied|invalid syntax|schema validation failed|does not exist/i;

    return (
      permanentCodes.includes(error.code) ||
      permanentStatuses.includes(error.statusCode) ||
      permanentMessages.test(error.message)
    );
  }

  /**
   * Check if error is recoverable (needs user intervention)
   */
  static isRecoverableError(error) {
    const recoverableMessages = /module.*not found|environment variable.*not set|configuration.*invalid|missing dependency|insufficient.*resources/i;

    return (
      error.code === 'MODULE_NOT_FOUND' ||
      recoverableMessages.test(error.message)
    );
  }

  /**
   * Check if error is critical (stop workflow)
   */
  static isCriticalError(error) {
    const criticalMessages = /security violation|data corruption|out of memory|disk full|circuit.*open|heap.*exhausted/i;
    const criticalCodes = ['ENOMEM', 'ENOSPC'];

    return (
      error.severity === 'critical' ||
      error.security === true ||
      criticalCodes.includes(error.code) ||
      criticalMessages.test(error.message)
    );
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryWithBackoff(error, context) {
    const maxAttempts = context.maxRetryAttempts || MAX_RETRY_ATTEMPTS;
    let attempt = 1;
    let delay = BASE_DELAY_MS;

    console.warn(`[Error Recovery] Transient error detected: ${error.message}`);
    console.warn(`[Error Recovery] Will retry up to ${maxAttempts} times with exponential backoff`);

    while (attempt <= maxAttempts) {
      try {
        // If operation function provided, retry it
        if (context.operation && typeof context.operation === 'function') {
          const result = await context.operation();

          await this.logRecoverySuccess(error, context, 'retry', attempt);
          console.log(`[Error Recovery] Retry successful on attempt ${attempt}`);

          return {
            success: true,
            category: ErrorCategory.TRANSIENT,
            attempts: attempt,
            message: 'Recovered after retry with exponential backoff'
          };
        } else {
          // No operation to retry, just return success indicator
          return {
            success: false,
            category: ErrorCategory.TRANSIENT,
            canRetry: true,
            attempts: attempt,
            message: 'Transient error detected but no retry function provided'
          };
        }
      } catch (retryError) {
        if (attempt === maxAttempts) {
          await this.logRecoveryFailure(error, context, 'retry', attempt);
          return {
            success: false,
            category: ErrorCategory.TRANSIENT,
            attempts: attempt,
            message: `Failed after ${maxAttempts} retry attempts`,
            lastError: retryError.message
          };
        }

        // Exponential backoff with jitter
        const jitter = Math.random() * (JITTER_MS * 2) - JITTER_MS;
        const actualDelay = Math.min(delay + jitter, MAX_DELAY_MS);

        console.warn(`[Error Recovery] Attempt ${attempt} failed: ${retryError.message}`);
        console.warn(`[Error Recovery] Retrying in ${actualDelay}ms...`);

        await new Promise(resolve => setTimeout(resolve, actualDelay));
        delay *= 2;
        attempt++;
      }
    }
  }

  /**
   * Handle permanent error (fail fast)
   */
  static failFast(error, context) {
    console.error(`[Error Recovery] Permanent error in ${context.operation}: ${error.message}`);

    const suggestion = this.generateSuggestion(error);

    return {
      success: false,
      category: ErrorCategory.PERMANENT,
      message: error.message,
      suggestion: suggestion,
      context: context,
      canRetry: false
    };
  }

  /**
   * Handle recoverable error (prompt user)
   */
  static async promptUser(error, context) {
    const fixInstructions = this.generateFixInstructions(error);

    console.error(`[Error Recovery] Recoverable error in ${context.operation}:`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Fix: ${fixInstructions.primary}`);

    if (fixInstructions.alternatives && fixInstructions.alternatives.length > 0) {
      console.error(`  Alternatives:`);
      fixInstructions.alternatives.forEach((alt, i) => {
        console.error(`    ${i + 1}. ${alt}`);
      });
    }

    return {
      success: false,
      category: ErrorCategory.RECOVERABLE,
      message: error.message,
      fixInstructions: fixInstructions,
      context: context,
      canRetry: true,
      requiresUserAction: true
    };
  }

  /**
   * Handle critical error (stop and rollback)
   */
  static async stopAndRollback(error, context) {
    console.error(`[Error Recovery] CRITICAL ERROR in ${context.operation}:`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Context: ${JSON.stringify(context, null, 2)}`);

    // Log to critical error log
    await this.logCriticalError(error, context);

    // Attempt rollback if supported
    let rollbackSuccess = false;
    if (context.rollbackSupported && context.rollbackFunction) {
      console.error(`  Attempting rollback...`);
      try {
        await context.rollbackFunction();
        rollbackSuccess = true;
        console.error(`  Rollback successful`);
      } catch (rollbackError) {
        console.error(`  Rollback failed: ${rollbackError.message}`);
      }
    }

    return {
      success: false,
      category: ErrorCategory.CRITICAL,
      message: error.message,
      severity: 'critical',
      context: context,
      canRetry: false,
      rollbackAttempted: context.rollbackSupported,
      rollbackSuccess: rollbackSuccess,
      recommendation: 'System requires manual inspection and recovery'
    };
  }

  /**
   * Generate suggestion for permanent errors
   */
  static generateSuggestion(error) {
    if (error.code === 'ENOENT') {
      return 'Check that the file exists and the path is correct';
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      return 'Verify file permissions or run with appropriate privileges';
    } else if (error.statusCode === 401) {
      return 'Check authentication credentials or refresh access token';
    } else if (error.statusCode === 403) {
      return 'Verify you have permission to access this resource';
    } else if (error.statusCode === 404) {
      return 'Check that the resource exists and the URL/path is correct';
    } else if (error.message.includes('schema validation')) {
      return 'Review the artifact against the schema and fix validation errors';
    }
    return 'Review the error details and correct the issue before retrying';
  }

  /**
   * Generate fix instructions for recoverable errors
   */
  static generateFixInstructions(error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      const moduleName = this.extractModuleName(error.message);
      return {
        primary: `Install missing dependency: pnpm add ${moduleName}`,
        alternatives: [
          `npm install ${moduleName}`,
          `yarn add ${moduleName}`
        ]
      };
    } else if (error.message.includes('Environment variable')) {
      const varName = this.extractVariableName(error.message);
      return {
        primary: `Set environment variable: export ${varName}=<value>`,
        alternatives: [
          `Add ${varName} to .env file`,
          `Set ${varName} in system environment variables`
        ]
      };
    } else if (error.message.includes('configuration')) {
      return {
        primary: 'Review and fix configuration in .claude/config.yaml',
        alternatives: [
          'Use default configuration: cp .claude/config.default.yaml .claude/config.yaml',
          'Validate configuration: node .claude/tools/validate-config.mjs'
        ]
      };
    } else if (error.message.includes('disk full') || error.code === 'ENOSPC') {
      return {
        primary: 'Free up disk space and retry',
        alternatives: [
          'Clear temporary files: rm -rf .claude/context/tmp/*',
          'Clear old run artifacts: node .claude/tools/cleanup-old-runs.mjs'
        ]
      };
    }

    return {
      primary: 'Review error details and correct the issue',
      alternatives: []
    };
  }

  /**
   * Extract module name from MODULE_NOT_FOUND error
   */
  static extractModuleName(message) {
    const match = message.match(/Cannot find module '([^']+)'/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract variable name from environment variable error
   */
  static extractVariableName(message) {
    const match = message.match(/Environment variable '([^']+)'/);
    return match ? match[1] : 'UNKNOWN_VAR';
  }

  /**
   * Log recovery attempt
   */
  static async logRecoveryAttempt(error, context, category) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${context.runId || 'unknown'}] [${context.operation || 'unknown'}] [${category}] [attempt] ${error.message}\n`;

    await this.appendToLog(logLine);
  }

  /**
   * Log recovery success
   */
  static async logRecoverySuccess(error, context, strategy, attempts) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${context.runId || 'unknown'}] [${context.operation || 'unknown'}] [${strategy}] [success] Recovered after ${attempts} attempts\n`;

    await this.appendToLog(logLine);
  }

  /**
   * Log recovery failure
   */
  static async logRecoveryFailure(error, context, strategy, attempts) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${context.runId || 'unknown'}] [${context.operation || 'unknown'}] [${strategy}] [failure] Failed after ${attempts} attempts: ${error.message}\n`;

    await this.appendToLog(logLine);
  }

  /**
   * Log critical error
   */
  static async logCriticalError(error, context) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context
    };

    const logLine = `[${timestamp}] [${context.runId || 'unknown'}] [${context.operation || 'unknown'}] [critical] ${error.message}\n`;
    const detailedLog = `${JSON.stringify(logEntry, null, 2)}\n\n`;

    await this.appendToLog(logLine);

    // Also log to critical errors log
    const criticalLogPath = join(LOGS_DIR, 'critical-errors.log');
    await this.appendToLog(detailedLog, criticalLogPath);
  }

  /**
   * Append to log file
   */
  static async appendToLog(content, logPath = ERROR_RECOVERY_LOG) {
    try {
      // Ensure log directory exists
      if (!existsSync(LOGS_DIR)) {
        await mkdir(LOGS_DIR, { recursive: true });
      }

      await appendFile(logPath, content, 'utf-8');
    } catch (error) {
      // Fail silently if logging fails
      console.error(`[Error Recovery] Failed to write to log: ${error.message}`);
    }
  }
}

// Default export
export default ErrorRecovery;
