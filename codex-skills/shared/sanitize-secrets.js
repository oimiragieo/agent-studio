/**
 * Sanitize error messages and logs to prevent API key leakage
 * 
 * Security Architecture: Defense-in-Depth for Credential Protection
 * 
 * This module implements multiple layers of pattern matching to ensure
 * API keys and sensitive tokens are never exposed in error messages,
 * logs, or stack traces. It follows OWASP A02:2021 (Cryptographic Failures)
 * guidelines for preventing sensitive data exposure.
 * 
 * @module sanitize-secrets
 * @version 1.0.0
 */

/**
 * Common API key patterns with provider-specific regex
 * Each pattern is designed to catch real key formats while minimizing false positives
 */
const API_KEY_PATTERNS = [
  // Anthropic API keys (sk-ant-...)
  { pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g, replacement: '[REDACTED_ANTHROPIC_KEY]' },
  
  // OpenAI API keys (sk-...)
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  
  // Google/Gemini API keys (AIza...)
  { pattern: /AIza[a-zA-Z0-9_-]{20,}/g, replacement: '[REDACTED_GOOGLE_KEY]' },
  
  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  { pattern: /gh[pousr]_[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  
  // Generic long alphanumeric tokens (potential API keys)
  // Match sequences of 40+ chars that look like keys (mixed case, numbers, limited special chars)
  { pattern: /[a-zA-Z0-9_-]{40,}/g, replacement: '[REDACTED_LONG_TOKEN]' },
];

/**
 * Environment variable patterns that may contain secrets
 * Matches KEY=value format and redacts the value portion
 */
const ENV_VAR_PATTERNS = [
  { pattern: /ANTHROPIC_API_KEY=[^\s]+/g, replacement: 'ANTHROPIC_API_KEY=[REDACTED]' },
  { pattern: /GEMINI_API_KEY=[^\s]+/g, replacement: 'GEMINI_API_KEY=[REDACTED]' },
  { pattern: /GOOGLE_API_KEY=[^\s]+/g, replacement: 'GOOGLE_API_KEY=[REDACTED]' },
  { pattern: /GOOGLE_GENAI_API_KEY=[^\s]+/g, replacement: 'GOOGLE_GENAI_API_KEY=[REDACTED]' },
  { pattern: /OPENAI_API_KEY=[^\s]+/g, replacement: 'OPENAI_API_KEY=[REDACTED]' },
  { pattern: /CODEX_API_KEY=[^\s]+/g, replacement: 'CODEX_API_KEY=[REDACTED]' },
  { pattern: /CURSOR_API_KEY=[^\s]+/g, replacement: 'CURSOR_API_KEY=[REDACTED]' },
  { pattern: /COPILOT_API_KEY=[^\s]+/g, replacement: 'COPILOT_API_KEY=[REDACTED]' },
  { pattern: /GITHUB_TOKEN=[^\s]+/g, replacement: 'GITHUB_TOKEN=[REDACTED]' },
  { pattern: /GH_TOKEN=[^\s]+/g, replacement: 'GH_TOKEN=[REDACTED]' },
  { pattern: /NPM_TOKEN=[^\s]+/g, replacement: 'NPM_TOKEN=[REDACTED]' },
  { pattern: /AWS_SECRET_ACCESS_KEY=[^\s]+/g, replacement: 'AWS_SECRET_ACCESS_KEY=[REDACTED]' },
  { pattern: /AWS_SESSION_TOKEN=[^\s]+/g, replacement: 'AWS_SESSION_TOKEN=[REDACTED]' },
];

/**
 * Additional sensitive patterns (JWT, Authorization headers, etc.)
 */
const ADDITIONAL_PATTERNS = [
  // JWT tokens (three base64 sections separated by dots)
  { pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
  
  // Authorization headers with Bearer tokens
  { pattern: /Authorization:\s*Bearer\s+[^\s]+/gi, replacement: 'Authorization: Bearer [REDACTED]' },
  
  // Basic auth headers
  { pattern: /Authorization:\s*Basic\s+[^\s]+/gi, replacement: 'Authorization: Basic [REDACTED]' },
  
  // Generic Authorization header
  { pattern: /Authorization:\s+[^\s]+/gi, replacement: 'Authorization: [REDACTED]' },
  
  // API key in headers
  { pattern: /x-api-key:\s*[^\s]+/gi, replacement: 'x-api-key: [REDACTED]' },
  
  // Bearer tokens in various contexts
  { pattern: /Bearer\s+[a-zA-Z0-9_.-]{20,}/gi, replacement: 'Bearer [REDACTED]' },
];

/**
 * List of sensitive environment variable names for object sanitization
 */
const SENSITIVE_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY', 
  'GOOGLE_API_KEY',
  'GOOGLE_GENAI_API_KEY',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CURSOR_API_KEY',
  'COPILOT_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'NPM_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SESSION_TOKEN',
  'DATABASE_URL',
  'DATABASE_PASSWORD',
  'DB_PASSWORD',
  'REDIS_PASSWORD',
  'MONGO_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'PRIVATE_KEY',
];

/**
 * Sanitize error messages and logs to prevent API key leakage
 * 
 * @param {string|Error|object} input - Text, Error object, or object to sanitize
 * @returns {string} Sanitized text with API keys and sensitive data redacted
 * 
 * @example
 * // Sanitize error message
 * const safeMsg = sanitize('Error: Invalid key sk-ant-abc123def456...');
 * // Returns: 'Error: Invalid key [REDACTED_ANTHROPIC_KEY]'
 * 
 * @example
 * // Sanitize Error object
 * const safeErr = sanitize(new Error('Auth failed: ANTHROPIC_API_KEY=sk-ant-...'));
 * // Returns sanitized stack trace
 */
function sanitize(input) {
  // Handle null/undefined
  if (input == null) {
    return '';
  }
  
  // Extract text from various input types
  let text;
  if (input instanceof Error) {
    text = input.stack || input.message || String(input);
  } else if (typeof input === 'object') {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  } else {
    text = String(input);
  }
  
  // Apply all sanitization patterns in order of specificity
  // 1. First, redact specific API key formats
  for (const { pattern, replacement } of API_KEY_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  
  // 2. Then, redact environment variable values
  for (const { pattern, replacement } of ENV_VAR_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  
  // 3. Finally, redact additional sensitive patterns
  for (const { pattern, replacement } of ADDITIONAL_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  
  return text;
}

/**
 * Sanitize an object by redacting sensitive key values
 * Useful for sanitizing process.env or config objects before logging
 * 
 * @param {Object} obj - Object to sanitize (e.g., process.env)
 * @param {string[]} [additionalKeys=[]] - Additional keys to redact beyond defaults
 * @returns {Object} Shallow copy of object with sensitive values redacted
 * 
 * @example
 * const safeEnv = sanitizeObject(process.env);
 * console.log(safeEnv); // ANTHROPIC_API_KEY: '[REDACTED]'
 */
function sanitizeObject(obj, additionalKeys = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const keysToRedact = new Set([...SENSITIVE_ENV_KEYS, ...additionalKeys]);
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    // Redact if key is in sensitive list
    if (keysToRedact.has(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Also redact keys that contain common sensitive patterns
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes('password') ||
      keyLower.includes('secret') ||
      keyLower.includes('token') ||
      keyLower.includes('api_key') ||
      keyLower.includes('apikey') ||
      keyLower.includes('private_key') ||
      keyLower.includes('privatekey')
    ) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Create a sanitized error wrapper
 * Wraps an error with sanitized message and stack for safe logging
 * 
 * @param {Error} error - Original error object
 * @returns {Object} Safe error object with sanitized properties
 * 
 * @example
 * try {
 *   await apiCall();
 * } catch (error) {
 *   console.error(sanitizeError(error));
 * }
 */
function sanitizeError(error) {
  if (!error) {
    return { message: 'Unknown error', stack: '' };
  }
  
  return {
    message: sanitize(error.message || String(error)),
    stack: sanitize(error.stack || ''),
    code: error.code || 'UNKNOWN',
    name: error.name || 'Error',
  };
}

/**
 * Check if a string appears to contain an API key
 * Useful for validation before logging
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to contain an API key
 * 
 * @example
 * if (containsApiKey(errorMessage)) {
 *   console.warn('Warning: Error message may contain sensitive data');
 * }
 */
function containsApiKey(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // Check against all API key patterns
  for (const { pattern } of API_KEY_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// CommonJS exports for compatibility with both .js and .cjs files
module.exports = {
  sanitize,
  sanitizeObject,
  sanitizeError,
  containsApiKey,
  SENSITIVE_ENV_KEYS,
};

// Also support ES module default export pattern
module.exports.default = {
  sanitize,
  sanitizeObject,
  sanitizeError,
  containsApiKey,
  SENSITIVE_ENV_KEYS,
};
