/**
 * Retry utilities for Codex skills
 * Provides exponential backoff retry logic for transient failures
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['TIMEOUT', 'RATE_LIMIT', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
};

/**
 * Sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @param {string[]} retryableErrors - List of retryable error codes/messages
 * @returns {boolean}
 */
function isRetryable(error, retryableErrors) {
  if (!error) return false;

  const errorString = String(error.message || error).toUpperCase();
  const errorCode = error.code ? String(error.code).toUpperCase() : '';

  // Check if error code or message matches retryable patterns
  return retryableErrors.some(pattern => {
    const patternUpper = pattern.toUpperCase();
    return errorCode.includes(patternUpper) || errorString.includes(patternUpper);
  });
}

/**
 * Check if an error is an authentication failure (should not be retried)
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isAuthFailure(error) {
  if (!error) return false;

  const errorString = String(error.message || error.stderr || error).toLowerCase();

  return (
    errorString.includes('api key') ||
    errorString.includes('auth') ||
    errorString.includes('unauthorized') ||
    errorString.includes('permission') ||
    errorString.includes('login') ||
    errorString.includes('not logged') ||
    errorString.includes('credentials') ||
    errorString.includes('forbidden')
  );
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} config - Retry configuration
 * @param {number} config.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} config.baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param {number} config.maxDelayMs - Maximum delay in milliseconds (default: 10000)
 * @param {string[]} config.retryableErrors - List of retryable error patterns (default: TIMEOUT, RATE_LIMIT, etc.)
 * @param {Function} config.onRetry - Optional callback called before each retry (attempt, error, delay)
 * @returns {Promise<*>} - Result of the function call
 * @throws {Error} - Last error if all retries fail
 */
async function withRetry(fn, config = {}) {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    baseDelayMs = DEFAULT_RETRY_CONFIG.baseDelayMs,
    maxDelayMs = DEFAULT_RETRY_CONFIG.maxDelayMs,
    retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors,
    onRetry = null,
  } = config;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on auth failures - fail fast
      if (isAuthFailure(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (!isRetryable(error, retryableErrors)) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

module.exports = {
  withRetry,
  sleep,
  isRetryable,
  isAuthFailure,
  DEFAULT_RETRY_CONFIG,
};
