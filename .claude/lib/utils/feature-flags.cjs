/**
 * Feature Flag Management System
 *
 * Supports environment variables, config file, and runtime toggling
 * for safe, gradual rollout of new features.
 *
 * Priority order (highest to lowest):
 * 1. Environment variables (e.g., PARTY_MODE_ENABLED=true)
 * 2. Config file (.claude/config.yaml)
 * 3. Runtime API (enable/disable methods)
 *
 * @example
 * const featureFlags = require('./.claude/lib/utils/feature-flags.cjs');
 *
 * // Check if feature is enabled
 * if (featureFlags.isEnabled('features.partyMode.enabled')) {
 *   // Feature is enabled
 * }
 *
 * // Get full config for feature
 * const config = featureFlags.getConfig('partyMode');
 * console.log(config.maxAgents); // 5
 *
 * // Runtime toggle (in-memory only)
 * featureFlags.enable('features.partyMode.enabled');
 * featureFlags.disable('features.partyMode.enabled');
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { PROJECT_ROOT } = require('./project-root.cjs');

class FeatureFlagManager {
  constructor() {
    this.flags = {};
    this.runtimeOverrides = {};
    this.loadFromConfig();
    this.loadFromEnvironment();
  }

  /**
   * Load feature flags from .claude/config.yaml
   * @private
   */
  loadFromConfig() {
    try {
      const configPath = path.join(PROJECT_ROOT, '.claude', 'config.yaml');
      if (!fs.existsSync(configPath)) {
        console.warn('[feature-flags] Config file not found:', configPath);
        return;
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent);

      if (config && config.features) {
        this.flags = { features: config.features };
      }
    } catch (error) {
      console.error('[feature-flags] Error loading config:', error.message);
    }
  }

  /**
   * Load feature flag overrides from environment variables
   * Priority: Environment > Config
   * @private
   */
  loadFromEnvironment() {
    // PARTY_MODE_ENABLED -> features.partyMode.enabled
    if (process.env.PARTY_MODE_ENABLED !== undefined) {
      const value = this.coerceBoolean(process.env.PARTY_MODE_ENABLED);
      this.setNested(this.flags, 'features.partyMode.enabled', value);
    }

    // ELICITATION_ENABLED -> features.advancedElicitation.enabled
    if (process.env.ELICITATION_ENABLED !== undefined) {
      const value = this.coerceBoolean(process.env.ELICITATION_ENABLED);
      this.setNested(this.flags, 'features.advancedElicitation.enabled', value);
    }
  }

  /**
   * Coerce string values to boolean
   * @param {string|boolean} value - Value to coerce
   * @returns {boolean}
   * @private
   */
  coerceBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  }

  /**
   * Get nested value using dot notation
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path (e.g., "features.partyMode.enabled")
   * @returns {*} Value at path, or undefined
   * @private
   */
  getNested(obj, path) {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Set nested value using dot notation
   * @param {Object} obj - Object to modify
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @private
   */
  setNested(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Check if a feature flag is enabled
   * @param {string} flagName - Dot-separated flag name (e.g., "features.partyMode.enabled")
   * @returns {boolean} True if enabled, false otherwise
   *
   * @example
   * if (featureFlags.isEnabled('features.partyMode.enabled')) {
   *   // Party mode is enabled
   * }
   */
  isEnabled(flagName) {
    // Check runtime overrides first
    const runtimeValue = this.getNested(this.runtimeOverrides, flagName);
    if (runtimeValue !== undefined) {
      return Boolean(runtimeValue);
    }

    // Check flags (environment + config)
    const value = this.getNested(this.flags, flagName);
    return Boolean(value);
  }

  /**
   * Get full configuration object for a feature
   * @param {string} featureName - Feature name (e.g., "partyMode")
   * @returns {Object|null} Configuration object, or null if not found
   *
   * @example
   * const config = featureFlags.getConfig('partyMode');
   * console.log(config.maxAgents); // 5
   * console.log(config.turnLimit); // 20
   */
  getConfig(featureName) {
    if (!this.flags.features) {
      return null;
    }
    return this.flags.features[featureName] || null;
  }

  /**
   * Enable a feature flag at runtime (in-memory only)
   * @param {string} flagName - Dot-separated flag name
   *
   * @example
   * featureFlags.enable('features.partyMode.enabled');
   */
  enable(flagName) {
    this.setNested(this.runtimeOverrides, flagName, true);
  }

  /**
   * Disable a feature flag at runtime (in-memory only)
   * @param {string} flagName - Dot-separated flag name
   *
   * @example
   * featureFlags.disable('features.partyMode.enabled');
   */
  disable(flagName) {
    this.setNested(this.runtimeOverrides, flagName, false);
  }

  /**
   * Persist current flags back to config.yaml (optional)
   * Warning: This modifies the config file on disk
   */
  persist() {
    try {
      const configPath = path.join(PROJECT_ROOT, '.claude', 'config.yaml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent);

      // Merge runtime overrides into flags
      for (const [key, value] of Object.entries(this.runtimeOverrides.features || {})) {
        if (!config.features) {
          config.features = {};
        }
        if (typeof value === 'object') {
          config.features[key] = { ...config.features[key], ...value };
        } else {
          config.features[key] = value;
        }
      }

      fs.writeFileSync(configPath, yaml.dump(config), 'utf8');
    } catch (error) {
      console.error('[feature-flags] Error persisting flags:', error.message);
      throw error;
    }
  }
}

// Singleton instance
module.exports = new FeatureFlagManager();
