#!/usr/bin/env node

/**
 * @file test-recovery-handler.mjs
 * @description QA test script for recovery handler
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import RecoveryHandler from '../recovery-handler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const RESULTS_FILE = path.join(
  PROJECT_ROOT,
  '.claude/context/test-results/recovery-handler-test-results.json'
);

/**
 * Test Recovery Handler
 */
class RecoveryHandlerTest {
  constructor() {
    this.handler = null;
    this.results = {
      test_suite: 'Recovery Handler Tests',
      timestamp: new Date().toISOString(),
      total_tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 0,
      tests: [],
      summary: {},
      metadata: {
        version: '1.0.0',
        environment: 'test'
      }
    };
  }

  /**
   * Run all tests
   */
  async runAll() {
    const startTime = Date.now();

    console.log('='.repeat(60));
    console.log('Recovery Handler Test Suite');
    console.log('='.repeat(60));

    try {
      await this.setup();

      // Test scenarios
      await this.testPatternLoading();
      await this.testTimeoutRetry();
      await this.testTestFailureEscalate();
      await this.testDependencyMissingRetry();
      await this.testCompilationErrorEscalate();
      await this.testCriticalFailureHalt();
      await this.testPatternMatching();
      await this.testBackoffCalculation();
      await this.testStateManagement();
      await this.testRecoveryStatistics();

      await this.teardown();
    } catch (error) {
      console.error('Test suite error:', error);
      this.addTest('Test Suite Execution', 'FAILED', {
        error: error.message,
        stack: error.stack
      });
    }

    this.results.duration_ms = Date.now() - startTime;
    await this.saveResults();
    this.printSummary();

    process.exit(this.results.failed > 0 ? 1 : 0);
  }

  /**
   * Setup test environment
   */
  async setup() {
    console.log('\n[SETUP] Initializing recovery handler...');
    this.handler = new RecoveryHandler();
    await this.handler.init();
    console.log('[SETUP] Recovery handler initialized');
  }

  /**
   * Teardown test environment
   */
  async teardown() {
    console.log('\n[TEARDOWN] Cleaning up...');
    // Cleanup if needed
  }

  /**
   * Test 1: Pattern Loading
   */
  async testPatternLoading() {
    const testName = 'Pattern Loading';
    console.log(`\n[TEST] ${testName}`);

    try {
      const patternsLoaded = this.handler.patterns.size;

      if (patternsLoaded === 0) {
        throw new Error('No patterns loaded');
      }

      console.log(`  ✓ Loaded ${patternsLoaded} patterns`);

      // Check specific patterns exist
      const expectedPatterns = [
        'timeout-retry',
        'test-failure-escalate',
        'dependency-missing-retry',
        'compilation-error-escalate',
        'critical-failure-halt'
      ];

      for (const patternId of expectedPatterns) {
        if (!this.handler.patterns.has(patternId)) {
          throw new Error(`Missing expected pattern: ${patternId}`);
        }
        console.log(`  ✓ Pattern exists: ${patternId}`);
      }

      this.addTest(testName, 'PASSED', {
        patterns_loaded: patternsLoaded,
        expected_patterns: expectedPatterns
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 2: Timeout Retry Strategy
   */
  async testTimeoutRetry() {
    const testName = 'Timeout Retry Strategy';
    console.log(`\n[TEST] ${testName}`);

    try {
      const failure = {
        type: 'timeout',
        severity: 'medium',
        metadata: { error_message: 'Request timeout' }
      };

      const pattern = this.handler.matchPattern(failure);
      if (!pattern) {
        throw new Error('No pattern matched for timeout');
      }

      console.log(`  ✓ Matched pattern: ${pattern.name}`);

      if (pattern.strategy !== 'retry') {
        throw new Error(`Expected retry strategy, got: ${pattern.strategy}`);
      }

      console.log(`  ✓ Strategy is retry`);

      const result = await this.handler.applyPattern(pattern, failure, {
        retry_count: 0
      });

      if (!result.success) {
        throw new Error('Retry strategy failed');
      }

      console.log(`  ✓ Retry scheduled with ${result.delay_ms}ms delay`);

      if (result.retry_count !== 1) {
        throw new Error(`Expected retry_count=1, got: ${result.retry_count}`);
      }

      console.log(`  ✓ Retry count incremented`);

      this.addTest(testName, 'PASSED', {
        pattern: pattern.pattern_id,
        strategy: pattern.strategy,
        delay_ms: result.delay_ms,
        retry_count: result.retry_count
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 3: Test Failure Escalate Strategy
   */
  async testTestFailureEscalate() {
    const testName = 'Test Failure Escalate Strategy';
    console.log(`\n[TEST] ${testName}`);

    try {
      const failure = {
        type: 'test_failure',
        severity: 'high',
        metadata: { error_message: 'AssertionError: Expected true to be false' }
      };

      // Simulate multiple failures to meet threshold
      this.handler.recoveryHistory.push(
        { failure_type: 'test_failure', timestamp: new Date().toISOString() },
        { failure_type: 'test_failure', timestamp: new Date().toISOString() }
      );

      const pattern = this.handler.matchPattern(failure);
      if (!pattern) {
        throw new Error('No pattern matched for test_failure');
      }

      console.log(`  ✓ Matched pattern: ${pattern.name}`);

      if (pattern.strategy !== 'escalate') {
        throw new Error(`Expected escalate strategy, got: ${pattern.strategy}`);
      }

      console.log(`  ✓ Strategy is escalate`);

      const result = await this.handler.applyPattern(pattern, failure, {
        escalation_count: 0
      });

      if (!result.success) {
        throw new Error('Escalation strategy failed');
      }

      console.log(`  ✓ Escalated to ${result.target_agent}`);

      if (result.target_agent !== 'developer') {
        throw new Error(`Expected target_agent=developer, got: ${result.target_agent}`);
      }

      console.log(`  ✓ Target agent is developer`);

      this.addTest(testName, 'PASSED', {
        pattern: pattern.pattern_id,
        strategy: pattern.strategy,
        target_agent: result.target_agent,
        timeout_multiplier: result.timeout_multiplier
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 4: Dependency Missing Retry
   */
  async testDependencyMissingRetry() {
    const testName = 'Dependency Missing Retry';
    console.log(`\n[TEST] ${testName}`);

    try {
      const failure = {
        type: 'dependency_missing',
        severity: 'medium',
        metadata: { error_message: 'npm ERR! 404 Not Found' }
      };

      const pattern = this.handler.matchPattern(failure);
      if (!pattern) {
        throw new Error('No pattern matched for dependency_missing');
      }

      console.log(`  ✓ Matched pattern: ${pattern.name}`);

      const result = await this.handler.applyPattern(pattern, failure, {});

      if (!result.success) {
        throw new Error('Dependency retry failed');
      }

      console.log(`  ✓ Retry scheduled`);

      if (pattern.retry_policy.backoff !== 'linear') {
        throw new Error(`Expected linear backoff, got: ${pattern.retry_policy.backoff}`);
      }

      console.log(`  ✓ Using linear backoff`);

      this.addTest(testName, 'PASSED', {
        pattern: pattern.pattern_id,
        backoff: pattern.retry_policy.backoff,
        max_attempts: pattern.retry_policy.max_attempts
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 5: Compilation Error Escalate
   */
  async testCompilationErrorEscalate() {
    const testName = 'Compilation Error Escalate';
    console.log(`\n[TEST] ${testName}`);

    try {
      const failure = {
        type: 'compilation_error',
        severity: 'high',
        metadata: { error_message: 'SyntaxError: Unexpected token' }
      };

      const pattern = this.handler.matchPattern(failure);
      if (!pattern) {
        throw new Error('No pattern matched for compilation_error');
      }

      console.log(`  ✓ Matched pattern: ${pattern.name}`);

      if (pattern.strategy !== 'escalate') {
        throw new Error(`Expected escalate, got: ${pattern.strategy}`);
      }

      const result = await this.handler.applyPattern(pattern, failure, {});

      if (!result.success || result.target_agent !== 'developer') {
        throw new Error('Compilation error escalation failed');
      }

      console.log(`  ✓ Escalated to developer`);

      this.addTest(testName, 'PASSED', {
        pattern: pattern.pattern_id,
        strategy: pattern.strategy,
        target_agent: result.target_agent
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 6: Critical Failure Halt
   */
  async testCriticalFailureHalt() {
    const testName = 'Critical Failure Halt';
    console.log(`\n[TEST] ${testName}`);

    try {
      const failure = {
        type: 'security_violation',
        severity: 'critical',
        metadata: { error_message: 'SQL injection detected' }
      };

      const pattern = this.handler.matchPattern(failure);
      if (!pattern) {
        throw new Error('No pattern matched for security_violation');
      }

      console.log(`  ✓ Matched pattern: ${pattern.name}`);

      if (pattern.strategy !== 'halt') {
        throw new Error(`Expected halt, got: ${pattern.strategy}`);
      }

      const result = await this.handler.applyPattern(pattern, failure, {});

      if (!result.success) {
        throw new Error('Halt strategy failed');
      }

      console.log(`  ✓ Workflow halted`);

      if (!result.preserve_state) {
        throw new Error('State should be preserved for critical failures');
      }

      console.log(`  ✓ State preserved`);

      this.addTest(testName, 'PASSED', {
        pattern: pattern.pattern_id,
        strategy: pattern.strategy,
        preserve_state: result.preserve_state,
        create_incident: result.create_incident
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 7: Pattern Matching
   */
  async testPatternMatching() {
    const testName = 'Pattern Matching';
    console.log(`\n[TEST] ${testName}`);

    try {
      const testCases = [
        { type: 'timeout', severity: 'medium', expected: true },
        { type: 'test_failure', severity: 'high', expected: true },
        { type: 'unknown_failure', severity: 'low', expected: false }
      ];

      for (const testCase of testCases) {
        const failure = {
          type: testCase.type,
          severity: testCase.severity,
          metadata: {}
        };

        const pattern = this.handler.matchPattern(failure);
        const matched = pattern !== null;

        if (matched !== testCase.expected) {
          throw new Error(
            `Pattern matching failed for ${testCase.type}: expected ${testCase.expected}, got ${matched}`
          );
        }

        console.log(`  ✓ ${testCase.type}: ${matched ? 'matched' : 'no match'}`);
      }

      this.addTest(testName, 'PASSED', { test_cases: testCases.length });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 8: Backoff Calculation
   */
  async testBackoffCalculation() {
    const testName = 'Backoff Calculation';
    console.log(`\n[TEST] ${testName}`);

    try {
      const policies = [
        { backoff: 'fixed', delay_ms: 1000, expected: [1000, 1000, 1000] },
        { backoff: 'linear', delay_ms: 1000, expected: [1000, 2000, 3000] },
        { backoff: 'exponential', delay_ms: 1000, jitter: false, expected: [1000, 2000, 4000] }
      ];

      for (const policy of policies) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const delay = this.handler.calculateDelay(policy, attempt);
          const expected = policy.expected[attempt - 1];

          // Allow 10% tolerance for jitter
          const tolerance = expected * 0.1;
          if (Math.abs(delay - expected) > tolerance) {
            throw new Error(
              `${policy.backoff} backoff incorrect: attempt ${attempt}, expected ${expected}, got ${delay}`
            );
          }
        }

        console.log(`  ✓ ${policy.backoff} backoff correct`);
      }

      this.addTest(testName, 'PASSED', { policies_tested: policies.length });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 9: State Management
   */
  async testStateManagement() {
    const testName = 'State Management';
    console.log(`\n[TEST] ${testName}`);

    try {
      // Ensure recovery history is tracked
      const initialHistoryLength = this.handler.recoveryHistory.length;

      const failure = { type: 'timeout', severity: 'medium', metadata: {} };
      const pattern = this.handler.matchPattern(failure);
      await this.handler.applyPattern(pattern, failure, {});

      const newHistoryLength = this.handler.recoveryHistory.length;

      if (newHistoryLength <= initialHistoryLength) {
        throw new Error('Recovery history not updated');
      }

      console.log(`  ✓ Recovery history updated`);

      // Verify state saved
      const statePath = path.join(PROJECT_ROOT, '.claude/context/runtime/recovery/recovery-state.json');
      const stateExists = await fs.access(statePath).then(() => true).catch(() => false);

      if (!stateExists) {
        throw new Error('Recovery state not saved');
      }

      console.log(`  ✓ Recovery state saved`);

      this.addTest(testName, 'PASSED', {
        history_entries: newHistoryLength,
        state_saved: true
      });
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Test 10: Recovery Statistics
   */
  async testRecoveryStatistics() {
    const testName = 'Recovery Statistics';
    console.log(`\n[TEST] ${testName}`);

    try {
      const stats = this.handler.getStats();

      if (!stats.total_recoveries) {
        throw new Error('No recovery statistics available');
      }

      console.log(`  ✓ Total recoveries: ${stats.total_recoveries}`);
      console.log(`  ✓ Success rate: ${stats.success_rate}`);
      console.log(`  ✓ Patterns loaded: ${stats.patterns_loaded}`);

      this.addTest(testName, 'PASSED', stats);
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      this.addTest(testName, 'FAILED', { error: error.message });
    }
  }

  /**
   * Add test result
   */
  addTest(name, status, details = {}) {
    this.results.total_tests++;

    if (status === 'PASSED') {
      this.results.passed++;
    } else if (status === 'FAILED') {
      this.results.failed++;
    } else {
      this.results.skipped++;
    }

    this.results.tests.push({
      name,
      status,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Save test results
   */
  async saveResults() {
    this.results.summary = {
      total: this.results.total_tests,
      passed: this.results.passed,
      failed: this.results.failed,
      skipped: this.results.skipped,
      pass_rate: this.results.total_tests > 0
        ? (this.results.passed / this.results.total_tests * 100).toFixed(2) + '%'
        : '0%'
    };

    const resultsDir = path.dirname(RESULTS_FILE);
    await fs.mkdir(resultsDir, { recursive: true });
    await fs.writeFile(RESULTS_FILE, JSON.stringify(this.results, null, 2), 'utf-8');

    console.log(`\n[RESULTS] Saved to: ${RESULTS_FILE}`);
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:  ${this.results.total_tests}`);
    console.log(`Passed:       ${this.results.passed} ✓`);
    console.log(`Failed:       ${this.results.failed} ✗`);
    console.log(`Skipped:      ${this.results.skipped}`);
    console.log(`Pass Rate:    ${this.results.summary.pass_rate}`);
    console.log(`Duration:     ${this.results.duration_ms}ms`);
    console.log('='.repeat(60));
  }
}

// Run tests
const test = new RecoveryHandlerTest();
test.runAll();
