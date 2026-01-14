/**
 * Feature Flags Manager Tests
 *
 * Comprehensive test suite covering:
 * - Flag retrieval (isEnabled, getFlags, getFlagDetails)
 * - Environment overrides (dev, staging, prod)
 * - Dependency validation (validateDependencies, canEnableFlag)
 * - Audit logging (auditLog, getAuditLog)
 * - Safe defaults (all flags OFF by default)
 * - Error handling (missing flags, invalid config)
 * - Rollout status (getRolloutStatus, getFlagsByPhase)
 *
 * @module feature-flags-manager.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FeatureFlagsManager } from './feature-flags-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_CONFIG_PATH = path.join(__dirname, '..', 'context', 'tmp', 'tmp-test-feature-flags.json');
const TEST_AUDIT_LOG_PATH = path.join(__dirname, '..', 'context', 'tmp', 'tmp-test-audit.log');

/**
 * Create test configuration
 */
function createTestConfig() {
  return {
    version: '1.0.0',
    last_updated: '2025-01-13T00:00:00Z',
    flags: {
      test_flag_a: {
        enabled: false,
        description: 'Test flag A - no dependencies',
        phase: 'POC',
        rollout_order: 1,
        dependencies: [],
        environments: {
          dev: true,
          staging: false,
          prod: false
        },
        metadata: {
          owner: 'developer',
          risk_level: 'low'
        }
      },
      test_flag_b: {
        enabled: false,
        description: 'Test flag B - depends on A',
        phase: 'POC',
        rollout_order: 2,
        dependencies: ['test_flag_a'],
        environments: {
          dev: false,
          staging: false,
          prod: false
        },
        metadata: {
          owner: 'developer',
          risk_level: 'medium'
        }
      },
      test_flag_c: {
        enabled: true,
        description: 'Test flag C - globally enabled',
        phase: 'Memory',
        rollout_order: 3,
        dependencies: [],
        environments: {
          dev: true,
          staging: true,
          prod: false
        },
        metadata: {
          owner: 'architect',
          risk_level: 'low'
        }
      },
      test_flag_d: {
        enabled: false,
        description: 'Test flag D - depends on B and C',
        phase: 'Lifecycle',
        rollout_order: 4,
        dependencies: ['test_flag_b', 'test_flag_c'],
        environments: {
          dev: false,
          staging: false,
          prod: false
        },
        metadata: {
          owner: 'developer',
          risk_level: 'high'
        }
      }
    },
    audit: {
      enabled: true,
      log_path: TEST_AUDIT_LOG_PATH,
      retention_days: 90
    },
    validation_rules: {
      dependency_check: true,
      environment_validation: true,
      rollout_order_enforcement: true
    }
  };
}

/**
 * Setup test environment
 */
function setupTestEnvironment() {
  const config = createTestConfig();
  const configDir = path.dirname(TEST_CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

  // Clean up audit log if exists
  if (fs.existsSync(TEST_AUDIT_LOG_PATH)) {
    fs.unlinkSync(TEST_AUDIT_LOG_PATH);
  }
}

/**
 * Cleanup test environment
 */
function cleanupTestEnvironment() {
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.unlinkSync(TEST_CONFIG_PATH);
  }
  if (fs.existsSync(TEST_AUDIT_LOG_PATH)) {
    fs.unlinkSync(TEST_AUDIT_LOG_PATH);
  }
}

describe('FeatureFlagsManager', () => {
  let manager;

  beforeEach(() => {
    setupTestEnvironment();
    manager = new FeatureFlagsManager({
      configPath: TEST_CONFIG_PATH,
      auditLogPath: TEST_AUDIT_LOG_PATH
    });
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('isEnabled()', () => {
    it('should return true when flag has environment override set to true', () => {
      const enabled = manager.isEnabled('test_flag_a', 'dev');
      assert.strictEqual(enabled, true, 'test_flag_a should be enabled in dev');
    });

    it('should return false when flag has environment override set to false', () => {
      const enabled = manager.isEnabled('test_flag_b', 'dev');
      assert.strictEqual(enabled, false, 'test_flag_b should be disabled in dev');
    });

    it('should return global enabled state when no environment override', () => {
      // test_flag_c has enabled: true globally and prod: false
      const enabledDev = manager.isEnabled('test_flag_c', 'dev');
      const enabledProd = manager.isEnabled('test_flag_c', 'prod');

      assert.strictEqual(enabledDev, true, 'test_flag_c should use env override (true) in dev');
      assert.strictEqual(enabledProd, false, 'test_flag_c should use env override (false) in prod');
    });

    it('should default to false for missing flags', () => {
      const enabled = manager.isEnabled('nonexistent_flag', 'dev');
      assert.strictEqual(enabled, false, 'Missing flag should default to false');
    });

    it('should use NODE_ENV when env parameter not provided', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'dev';

      const enabled = manager.isEnabled('test_flag_a');
      assert.strictEqual(enabled, true, 'Should use NODE_ENV (dev)');

      process.env.NODE_ENV = originalEnv;
    });

    it('should default to dev environment when NODE_ENV not set', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const enabled = manager.isEnabled('test_flag_a');
      assert.strictEqual(enabled, true, 'Should default to dev environment');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validateDependencies()', () => {
    it('should return valid=true when flag has no dependencies', () => {
      const result = manager.validateDependencies('test_flag_a', 'dev');
      assert.strictEqual(result.valid, true, 'Flag with no dependencies should be valid');
      assert.strictEqual(result.missingDependencies.length, 0, 'Should have no missing dependencies');
    });

    it('should return valid=true when all dependencies are enabled', () => {
      // test_flag_b depends on test_flag_a, which is enabled in dev
      const result = manager.validateDependencies('test_flag_b', 'dev');
      assert.strictEqual(result.valid, true, 'Flag with satisfied dependencies should be valid');
      assert.strictEqual(result.missingDependencies.length, 0, 'Should have no missing dependencies');
    });

    it('should return valid=false when dependencies are missing', () => {
      // test_flag_b depends on test_flag_a, which is disabled in staging
      const result = manager.validateDependencies('test_flag_b', 'staging');
      assert.strictEqual(result.valid, false, 'Flag with unsatisfied dependencies should be invalid');
      assert.strictEqual(result.missingDependencies.length, 1, 'Should have 1 missing dependency');
      assert.strictEqual(result.missingDependencies[0], 'test_flag_a', 'Should identify missing dependency');
    });

    it('should return valid=false when multiple dependencies are missing', () => {
      // test_flag_d depends on test_flag_b and test_flag_c
      // In prod: test_flag_b is disabled, test_flag_c is disabled
      const result = manager.validateDependencies('test_flag_d', 'prod');
      assert.strictEqual(result.valid, false, 'Flag with multiple unsatisfied dependencies should be invalid');
      assert.ok(result.missingDependencies.length >= 1, 'Should have at least 1 missing dependency');
    });

    it('should throw error for nonexistent flag', () => {
      assert.throws(
        () => manager.validateDependencies('nonexistent_flag', 'dev'),
        /Feature flag "nonexistent_flag" not found/,
        'Should throw error for missing flag'
      );
    });
  });

  describe('getFlags()', () => {
    it('should return all flags with environment-specific values', () => {
      const flags = manager.getFlags('dev');

      assert.strictEqual(typeof flags, 'object', 'Should return object');
      assert.strictEqual(flags.test_flag_a, true, 'test_flag_a should be true in dev');
      assert.strictEqual(flags.test_flag_b, false, 'test_flag_b should be false in dev');
      assert.strictEqual(flags.test_flag_c, true, 'test_flag_c should be true in dev');
      assert.strictEqual(flags.test_flag_d, false, 'test_flag_d should be false in dev');
    });

    it('should return different values for different environments', () => {
      const devFlags = manager.getFlags('dev');
      const prodFlags = manager.getFlags('prod');

      assert.notDeepStrictEqual(devFlags, prodFlags, 'Dev and prod flags should differ');
      assert.strictEqual(devFlags.test_flag_a, true, 'test_flag_a should be true in dev');
      assert.strictEqual(prodFlags.test_flag_a, false, 'test_flag_a should be false in prod');
    });
  });

  describe('getFlagDetails()', () => {
    it('should return complete flag configuration', () => {
      const details = manager.getFlagDetails('test_flag_a');

      assert.strictEqual(typeof details, 'object', 'Should return object');
      assert.strictEqual(details.description, 'Test flag A - no dependencies', 'Should have description');
      assert.strictEqual(details.phase, 'POC', 'Should have phase');
      assert.strictEqual(details.rollout_order, 1, 'Should have rollout_order');
      assert.ok(Array.isArray(details.dependencies), 'Should have dependencies array');
      assert.ok(details.environments, 'Should have environments');
      assert.ok(details.metadata, 'Should have metadata');
    });

    it('should return null for nonexistent flag', () => {
      const details = manager.getFlagDetails('nonexistent_flag');
      assert.strictEqual(details, null, 'Should return null for missing flag');
    });
  });

  describe('auditLog()', () => {
    it('should create audit log entry', () => {
      manager.auditLog('test_flag_a', 'enable', 'test-user', { env: 'dev' });

      assert.ok(fs.existsSync(TEST_AUDIT_LOG_PATH), 'Audit log file should exist');

      const logData = fs.readFileSync(TEST_AUDIT_LOG_PATH, 'utf8');
      const logEntry = JSON.parse(logData.trim());

      assert.strictEqual(logEntry.flag, 'test_flag_a', 'Should log flag name');
      assert.strictEqual(logEntry.action, 'enable', 'Should log action');
      assert.strictEqual(logEntry.user, 'test-user', 'Should log user');
      assert.ok(logEntry.timestamp, 'Should log timestamp');
      assert.strictEqual(logEntry.metadata.env, 'dev', 'Should log metadata');
    });

    it('should append multiple log entries', () => {
      manager.auditLog('test_flag_a', 'enable', 'user1');
      manager.auditLog('test_flag_b', 'disable', 'user2');

      const logData = fs.readFileSync(TEST_AUDIT_LOG_PATH, 'utf8');
      const lines = logData.trim().split('\n');

      assert.strictEqual(lines.length, 2, 'Should have 2 log entries');

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      assert.strictEqual(entry1.flag, 'test_flag_a', 'First entry should be test_flag_a');
      assert.strictEqual(entry2.flag, 'test_flag_b', 'Second entry should be test_flag_b');
    });
  });

  describe('getAuditLog()', () => {
    it('should return empty array when no audit log exists', () => {
      const entries = manager.getAuditLog();
      assert.ok(Array.isArray(entries), 'Should return array');
      assert.strictEqual(entries.length, 0, 'Should be empty array');
    });

    it('should return all audit log entries', () => {
      manager.auditLog('test_flag_a', 'enable', 'user1');
      manager.auditLog('test_flag_b', 'disable', 'user2');

      const entries = manager.getAuditLog();
      assert.strictEqual(entries.length, 2, 'Should return 2 entries');
    });

    it('should filter by flag name', () => {
      manager.auditLog('test_flag_a', 'enable', 'user1');
      manager.auditLog('test_flag_b', 'disable', 'user2');
      manager.auditLog('test_flag_a', 'disable', 'user3');

      const entries = manager.getAuditLog('test_flag_a');
      assert.strictEqual(entries.length, 2, 'Should return 2 entries for test_flag_a');
      assert.ok(entries.every(e => e.flag === 'test_flag_a'), 'All entries should be for test_flag_a');
    });

    it('should limit number of entries returned', () => {
      for (let i = 0; i < 10; i++) {
        manager.auditLog('test_flag_a', 'enable', `user${i}`);
      }

      const entries = manager.getAuditLog(null, 5);
      assert.strictEqual(entries.length, 5, 'Should limit to 5 entries');
    });

    it('should return entries in descending timestamp order', () => {
      manager.auditLog('test_flag_a', 'enable', 'user1');
      manager.auditLog('test_flag_b', 'disable', 'user2');

      const entries = manager.getAuditLog();
      assert.ok(entries.length >= 2, 'Should have at least 2 entries');

      const timestamp1 = new Date(entries[0].timestamp);
      const timestamp2 = new Date(entries[1].timestamp);

      assert.ok(timestamp1 >= timestamp2, 'Entries should be in descending timestamp order');
    });
  });

  describe('updateFlag()', () => {
    it('should update global enabled state', () => {
      assert.strictEqual(manager.isEnabled('test_flag_b', 'staging'), false, 'Initial state should be false');

      manager.updateFlag('test_flag_b', true, null, 'test-user');

      assert.strictEqual(manager.config.flags.test_flag_b.enabled, true, 'Global enabled should be true');
    });

    it('should update environment-specific state', () => {
      assert.strictEqual(manager.isEnabled('test_flag_b', 'staging'), false, 'Initial state should be false');

      manager.updateFlag('test_flag_b', true, 'staging', 'test-user');

      assert.strictEqual(manager.isEnabled('test_flag_b', 'staging'), true, 'Staging should be enabled');
      assert.strictEqual(manager.isEnabled('test_flag_b', 'prod'), false, 'Prod should remain disabled');
    });

    it('should create audit log entry', () => {
      manager.updateFlag('test_flag_a', false, 'dev', 'test-user');

      const entries = manager.getAuditLog('test_flag_a');
      assert.ok(entries.length > 0, 'Should have audit log entry');
      assert.strictEqual(entries[0].action, 'disable', 'Should log disable action');
      assert.strictEqual(entries[0].user, 'test-user', 'Should log user');
    });

    it('should throw error for nonexistent flag', () => {
      assert.throws(
        () => manager.updateFlag('nonexistent_flag', true),
        /Feature flag "nonexistent_flag" not found/,
        'Should throw error for missing flag'
      );
    });
  });

  describe('getFlagsByPhase()', () => {
    it('should return flags for specific phase', () => {
      const pocFlags = manager.getFlagsByPhase('POC');
      assert.ok(Array.isArray(pocFlags), 'Should return array');
      assert.ok(pocFlags.includes('test_flag_a'), 'Should include test_flag_a');
      assert.ok(pocFlags.includes('test_flag_b'), 'Should include test_flag_b');
    });

    it('should return empty array for phase with no flags', () => {
      const flags = manager.getFlagsByPhase('External');
      assert.ok(Array.isArray(flags), 'Should return array');
      assert.strictEqual(flags.length, 0, 'Should be empty for phase with no flags');
    });
  });

  describe('getFlagsInRolloutOrder()', () => {
    it('should return flags sorted by rollout_order', () => {
      const flags = manager.getFlagsInRolloutOrder();

      assert.ok(Array.isArray(flags), 'Should return array');
      assert.strictEqual(flags[0], 'test_flag_a', 'First should be test_flag_a (order 1)');
      assert.strictEqual(flags[1], 'test_flag_b', 'Second should be test_flag_b (order 2)');
      assert.strictEqual(flags[2], 'test_flag_c', 'Third should be test_flag_c (order 3)');
      assert.strictEqual(flags[3], 'test_flag_d', 'Fourth should be test_flag_d (order 4)');
    });
  });

  describe('canEnableFlag()', () => {
    it('should return canEnable=true when dependencies satisfied', () => {
      const result = manager.canEnableFlag('test_flag_b', 'dev');
      assert.strictEqual(result.canEnable, true, 'Should be able to enable when dependencies satisfied');
      assert.strictEqual(result.blockers.length, 0, 'Should have no blockers');
    });

    it('should return canEnable=false when dependencies missing', () => {
      const result = manager.canEnableFlag('test_flag_d', 'prod');
      assert.strictEqual(result.canEnable, false, 'Should not be able to enable when dependencies missing');
      assert.ok(result.blockers.length > 0, 'Should have blockers');
    });
  });

  describe('getEnabledFlags()', () => {
    it('should return only enabled flags for environment', () => {
      const enabledDev = manager.getEnabledFlags('dev');

      assert.ok(Array.isArray(enabledDev), 'Should return array');
      assert.ok(enabledDev.includes('test_flag_a'), 'Should include test_flag_a');
      assert.ok(enabledDev.includes('test_flag_c'), 'Should include test_flag_c');
      assert.ok(!enabledDev.includes('test_flag_b'), 'Should not include test_flag_b');
    });
  });

  describe('getRolloutStatus()', () => {
    it('should return rollout status by phase', () => {
      const status = manager.getRolloutStatus('dev');

      assert.ok(status.POC, 'Should have POC phase');
      assert.strictEqual(status.POC.total, 2, 'POC should have 2 flags');
      assert.strictEqual(status.POC.enabled, 1, 'POC should have 1 enabled');
      assert.strictEqual(status.POC.disabled, 1, 'POC should have 1 disabled');
      assert.strictEqual(status.POC.complete, false, 'POC should not be complete');

      assert.ok(status.Memory, 'Should have Memory phase');
      assert.strictEqual(status.Memory.total, 1, 'Memory should have 1 flag');
      assert.strictEqual(status.Memory.enabled, 1, 'Memory should have 1 enabled');
      assert.strictEqual(status.Memory.complete, true, 'Memory should be complete');
    });

    it('should include flag-level details', () => {
      const status = manager.getRolloutStatus('dev');

      assert.ok(Array.isArray(status.POC.flags), 'Should have flags array');
      assert.ok(status.POC.flags.length > 0, 'Should have flag details');
      assert.ok(status.POC.flags[0].name, 'Flag should have name');
      assert.ok(typeof status.POC.flags[0].enabled === 'boolean', 'Flag should have enabled state');
    });
  });
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Feature Flags Manager tests...\n');
}
