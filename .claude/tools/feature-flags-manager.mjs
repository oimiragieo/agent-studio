/**
 * Feature Flags Manager
 *
 * Manages feature flag state for A2A protocol integration with:
 * - Granular component control (enable/disable individual features)
 * - Environment-aware configuration (dev, staging, prod)
 * - Instant rollback capability (disable flags without redeployment)
 * - Audit trail (log all flag changes with timestamp and user)
 * - Safe defaults (all flags OFF by default)
 * - Dependency validation (ensure required flags are enabled)
 *
 * @module feature-flags-manager
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'feature-flags.json');
const AUDIT_LOG_PATH = path.join(__dirname, '..', 'context', 'logs', 'feature-flags-audit.log');

/**
 * Feature Flags Manager class
 */
export class FeatureFlagsManager {
  constructor(options = {}) {
    this.configPath = options.configPath || CONFIG_PATH;
    this.auditLogPath = options.auditLogPath || AUDIT_LOG_PATH;
    this.config = null;
    this.loadConfig();
  }

  /**
   * Load feature flags configuration from file
   * @private
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to load feature flags config: ${error.message}`);
    }
  }

  /**
   * Reload configuration from disk (useful after manual updates)
   */
  reload() {
    this.loadConfig();
  }

  /**
   * Check if a feature flag is enabled
   *
   * @param {string} flagName - Name of the feature flag
   * @param {string} [env] - Environment name (dev, staging, prod). Defaults to NODE_ENV or 'dev'
   * @returns {boolean} - True if flag is enabled, false otherwise
   *
   * @example
   * // Check if agent card generation is enabled in dev
   * const enabled = manager.isEnabled('agent_card_generation', 'dev');
   *
   * @example
   * // Check using current environment
   * const enabled = manager.isEnabled('agent_card_generation');
   */
  isEnabled(flagName, env = null) {
    const environment = env || process.env.NODE_ENV || 'dev';

    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    const flag = this.config.flags[flagName];

    if (!flag) {
      console.warn(`Feature flag "${flagName}" not found. Defaulting to disabled.`);
      return false;
    }

    // Check environment-specific override first
    if (flag.environments && flag.environments[environment] !== undefined) {
      return flag.environments[environment];
    }

    // Fall back to global enabled state
    return flag.enabled || false;
  }

  /**
   * Validate that all dependencies for a flag are enabled
   *
   * @param {string} flagName - Name of the feature flag
   * @param {string} [env] - Environment name
   * @returns {{ valid: boolean, missingDependencies: string[] }} - Validation result
   *
   * @example
   * // Validate streaming_support dependencies
   * const result = manager.validateDependencies('streaming_support');
   * if (!result.valid) {
   *   console.error('Missing dependencies:', result.missingDependencies);
   * }
   */
  validateDependencies(flagName, env = null) {
    const environment = env || process.env.NODE_ENV || 'dev';

    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    const flag = this.config.flags[flagName];

    if (!flag) {
      throw new Error(`Feature flag "${flagName}" not found`);
    }

    const dependencies = flag.dependencies || [];
    const missingDependencies = [];

    for (const depName of dependencies) {
      if (!this.isEnabled(depName, environment)) {
        missingDependencies.push(depName);
      }
    }

    return {
      valid: missingDependencies.length === 0,
      missingDependencies
    };
  }

  /**
   * Get all flags for a specific environment
   *
   * @param {string} [env] - Environment name
   * @returns {Object} - Object mapping flag names to enabled state
   *
   * @example
   * const devFlags = manager.getFlags('dev');
   * console.log('Dev flags:', devFlags);
   * // { agent_card_generation: true, agent_card_discovery: true, ... }
   */
  getFlags(env = null) {
    const environment = env || process.env.NODE_ENV || 'dev';

    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    const result = {};

    for (const [flagName, flag] of Object.entries(this.config.flags)) {
      // Check environment-specific override first
      if (flag.environments && flag.environments[environment] !== undefined) {
        result[flagName] = flag.environments[environment];
      } else {
        result[flagName] = flag.enabled || false;
      }
    }

    return result;
  }

  /**
   * Get detailed information about a flag
   *
   * @param {string} flagName - Name of the feature flag
   * @returns {Object|null} - Flag configuration object or null if not found
   */
  getFlagDetails(flagName) {
    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    return this.config.flags[flagName] || null;
  }

  /**
   * Get flags by rollout phase
   *
   * @param {string} phase - Rollout phase (POC, Memory, Lifecycle, External)
   * @returns {string[]} - Array of flag names in the specified phase
   */
  getFlagsByPhase(phase) {
    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    return Object.entries(this.config.flags)
      .filter(([_, flag]) => flag.phase === phase)
      .map(([flagName, _]) => flagName);
  }

  /**
   * Get flags in rollout order
   *
   * @returns {string[]} - Array of flag names sorted by rollout order
   */
  getFlagsInRolloutOrder() {
    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    return Object.entries(this.config.flags)
      .sort(([_, a], [__, b]) => (a.rollout_order || 999) - (b.rollout_order || 999))
      .map(([flagName, _]) => flagName);
  }

  /**
   * Log a flag change to the audit trail
   *
   * @param {string} flagName - Name of the feature flag
   * @param {string} action - Action performed (enable, disable, update)
   * @param {string} [user] - User who made the change
   * @param {Object} [metadata] - Additional metadata
   *
   * @example
   * manager.auditLog('agent_card_generation', 'enable', 'developer', { env: 'dev' });
   */
  auditLog(flagName, action, user = 'system', metadata = {}) {
    if (!this.config || !this.config.audit || !this.config.audit.enabled) {
      return; // Audit logging disabled
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      flag: flagName,
      action,
      user,
      metadata
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.auditLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      fs.appendFileSync(this.auditLogPath, logLine, 'utf8');
    } catch (error) {
      console.error(`Failed to write audit log: ${error.message}`);
    }
  }

  /**
   * Update a flag's enabled state (modifies config file)
   *
   * @param {string} flagName - Name of the feature flag
   * @param {boolean} enabled - New enabled state
   * @param {string} [env] - Environment to update (if not specified, updates global enabled state)
   * @param {string} [user] - User making the change
   *
   * @example
   * // Enable agent_card_generation globally
   * manager.updateFlag('agent_card_generation', true, null, 'developer');
   *
   * @example
   * // Enable in staging environment only
   * manager.updateFlag('agent_card_generation', true, 'staging', 'architect');
   */
  updateFlag(flagName, enabled, env = null, user = 'system') {
    if (!this.config || !this.config.flags) {
      throw new Error('Feature flags configuration not loaded');
    }

    const flag = this.config.flags[flagName];

    if (!flag) {
      throw new Error(`Feature flag "${flagName}" not found`);
    }

    // Update flag state
    if (env) {
      if (!flag.environments) {
        flag.environments = {};
      }
      flag.environments[env] = enabled;
    } else {
      flag.enabled = enabled;
    }

    // Update last_updated timestamp
    this.config.last_updated = new Date().toISOString();

    // Save config
    this.saveConfig();

    // Log to audit trail
    this.auditLog(flagName, enabled ? 'enable' : 'disable', user, { env: env || 'global' });
  }

  /**
   * Save configuration to file
   * @private
   */
  saveConfig() {
    try {
      const configJson = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save feature flags config: ${error.message}`);
    }
  }

  /**
   * Get audit log entries for a specific flag
   *
   * @param {string} flagName - Name of the feature flag
   * @param {number} [limit] - Maximum number of entries to return
   * @returns {Object[]} - Array of audit log entries
   */
  getAuditLog(flagName = null, limit = 100) {
    if (!fs.existsSync(this.auditLogPath)) {
      return [];
    }

    try {
      const logData = fs.readFileSync(this.auditLogPath, 'utf8');
      const lines = logData.trim().split('\n').filter(line => line.length > 0);

      let entries = lines.map(line => JSON.parse(line));

      // Filter by flag name if specified
      if (flagName) {
        entries = entries.filter(entry => entry.flag === flagName);
      }

      // Sort by timestamp descending
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Limit results
      return entries.slice(0, limit);
    } catch (error) {
      console.error(`Failed to read audit log: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a flag can be safely enabled (validates dependencies and rollout order)
   *
   * @param {string} flagName - Name of the feature flag
   * @param {string} [env] - Environment name
   * @returns {{ canEnable: boolean, blockers: string[] }} - Validation result
   */
  canEnableFlag(flagName, env = null) {
    const environment = env || process.env.NODE_ENV || 'dev';
    const blockers = [];

    // Check dependencies
    const depValidation = this.validateDependencies(flagName, environment);
    if (!depValidation.valid) {
      blockers.push(`Missing dependencies: ${depValidation.missingDependencies.join(', ')}`);
    }

    // Check rollout order (optional - only warn)
    const flag = this.config.flags[flagName];
    if (flag && this.config.validation_rules?.rollout_order_enforcement) {
      const rolloutOrder = flag.rollout_order || 999;

      // Find flags with lower rollout order that are not enabled
      for (const [otherFlagName, otherFlag] of Object.entries(this.config.flags)) {
        if (otherFlag.rollout_order < rolloutOrder) {
          if (!this.isEnabled(otherFlagName, environment)) {
            console.warn(`Flag "${otherFlagName}" (order ${otherFlag.rollout_order}) should be enabled before "${flagName}" (order ${rolloutOrder})`);
          }
        }
      }
    }

    return {
      canEnable: blockers.length === 0,
      blockers
    };
  }

  /**
   * Get flags that are currently enabled
   *
   * @param {string} [env] - Environment name
   * @returns {string[]} - Array of enabled flag names
   */
  getEnabledFlags(env = null) {
    const flags = this.getFlags(env);
    return Object.entries(flags)
      .filter(([_, enabled]) => enabled)
      .map(([flagName, _]) => flagName);
  }

  /**
   * Get rollout status summary
   *
   * @param {string} [env] - Environment name
   * @returns {Object} - Rollout status by phase
   */
  getRolloutStatus(env = null) {
    const environment = env || process.env.NODE_ENV || 'dev';
    const phases = ['POC', 'Memory', 'Lifecycle', 'External'];
    const status = {};

    for (const phase of phases) {
      const phaseFlags = this.getFlagsByPhase(phase);
      const enabledCount = phaseFlags.filter(flagName => this.isEnabled(flagName, environment)).length;

      status[phase] = {
        total: phaseFlags.length,
        enabled: enabledCount,
        disabled: phaseFlags.length - enabledCount,
        complete: enabledCount === phaseFlags.length,
        flags: phaseFlags.map(flagName => ({
          name: flagName,
          enabled: this.isEnabled(flagName, environment)
        }))
      };
    }

    return status;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of FeatureFlagsManager
 *
 * @returns {FeatureFlagsManager}
 */
export function getInstance() {
  if (!instance) {
    instance = new FeatureFlagsManager();
  }
  return instance;
}

/**
 * Convenience function to check if a flag is enabled
 *
 * @param {string} flagName - Name of the feature flag
 * @param {string} [env] - Environment name
 * @returns {boolean}
 */
export function isEnabled(flagName, env = null) {
  return getInstance().isEnabled(flagName, env);
}

/**
 * Convenience function to validate dependencies
 *
 * @param {string} flagName - Name of the feature flag
 * @param {string} [env] - Environment name
 * @returns {{ valid: boolean, missingDependencies: string[] }}
 */
export function validateDependencies(flagName, env = null) {
  return getInstance().validateDependencies(flagName, env);
}

/**
 * Convenience function to get all flags
 *
 * @param {string} [env] - Environment name
 * @returns {Object}
 */
export function getFlags(env = null) {
  return getInstance().getFlags(env);
}

/**
 * Convenience function to log audit entry
 *
 * @param {string} flagName - Name of the feature flag
 * @param {string} action - Action performed
 * @param {string} [user] - User who made the change
 * @param {Object} [metadata] - Additional metadata
 */
export function auditLog(flagName, action, user = 'system', metadata = {}) {
  getInstance().auditLog(flagName, action, user, metadata);
}

export default {
  FeatureFlagsManager,
  getInstance,
  isEnabled,
  validateDependencies,
  getFlags,
  auditLog
};
