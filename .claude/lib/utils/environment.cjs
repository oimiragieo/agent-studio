/**
 * Environment Detection Utility
 *
 * Determines the current runtime environment (development, staging, production).
 * Used throughout the framework to enable environment-specific behavior.
 *
 * Priority: AGENT_STUDIO_ENV > NODE_ENV > default (development)
 *
 * @module environment
 */

/**
 * Get current environment name
 *
 * @returns {'development' | 'staging' | 'production'} Environment name
 */
function getEnvironment() {
  const agentEnv = process.env.AGENT_STUDIO_ENV;
  const nodeEnv = process.env.NODE_ENV;

  // Priority: AGENT_STUDIO_ENV > NODE_ENV > default
  if (agentEnv) {
    const normalized = agentEnv.toLowerCase();
    if (['development', 'staging', 'production'].includes(normalized)) {
      return normalized;
    }
    console.warn(`[environment] Invalid AGENT_STUDIO_ENV="${agentEnv}", defaulting to development`);
  }

  if (nodeEnv) {
    return nodeEnv === 'production' ? 'production' : 'development';
  }

  return 'development'; // Default
}

/**
 * Check if running in staging environment
 * @returns {boolean} True if staging
 */
function isStaging() {
  return getEnvironment() === 'staging';
}

/**
 * Check if running in production environment
 * @returns {boolean} True if production
 */
function isProduction() {
  return getEnvironment() === 'production';
}

/**
 * Check if running in development environment
 * @returns {boolean} True if development
 */
function isDevelopment() {
  return getEnvironment() === 'development';
}

/**
 * Get environment-specific performance threshold
 *
 * Staging has more lenient thresholds than production
 *
 * @param {string} metric - Metric name (e.g., 'hookExecutionTimeMs')
 * @param {number} productionValue - Production threshold
 * @returns {number} Environment-adjusted threshold
 */
function getThreshold(metric, productionValue) {
  const env = getEnvironment();

  // Staging: 2x more lenient than production
  if (env === 'staging') {
    return productionValue * 2;
  }

  // Development: No thresholds enforced
  if (env === 'development') {
    return Infinity;
  }

  // Production: Use strict threshold
  return productionValue;
}

module.exports = {
  getEnvironment,
  isStaging,
  isProduction,
  isDevelopment,
  getThreshold,
};
