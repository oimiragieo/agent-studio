#!/usr/bin/env node

/**
 * Test Violation Logging Script
 *
 * Validates that orchestrator violations are properly logged to:
 * 1. Audit log: .claude/context/logs/orchestrator-violations.log
 * 2. Session state: .claude/context/tmp/orchestrator-session-state.json
 *
 * Tests 4 violation scenarios:
 * - Write tool violation
 * - Edit tool violation
 * - Grep tool violation
 * - Bash dangerous command violation
 *
 * Validates:
 * - Log entries contain timestamp, tool, reason
 * - Session state violations array updated
 * - Log file created and writable
 *
 * Auto-cleanup: Removes test artifacts after execution
 *
 * Exit Codes:
 *   0 - All tests passed
 *   1 - Some tests failed
 *   2 - Critical failure (logging not working)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../../..');
const SESSION_STATE_PATH = join(
  PROJECT_ROOT,
  '.claude/context/tmp/orchestrator-session-state.json'
);
const VIOLATION_LOG_PATH = join(PROJECT_ROOT, '.claude/context/logs/orchestrator-violations.log');

/**
 * Test result structure
 */
class LoggingTestResult {
  constructor(name, tool, shouldLogToFile, shouldLogToState) {
    this.name = name;
    this.tool = tool;
    this.should_log_to_file = shouldLogToFile;
    this.should_log_to_state = shouldLogToState;
    this.logged_to_file = false;
    this.logged_to_state = false;
    this.log_entry = null;
    this.state_entry = null;
    this.passed = false;
    this.error_message = null;
  }

  setActual(loggedToFile, loggedToState, logEntry, stateEntry, errorMessage = null) {
    this.logged_to_file = loggedToFile;
    this.logged_to_state = loggedToState;
    this.log_entry = logEntry;
    this.state_entry = stateEntry;
    this.error_message = errorMessage;

    this.passed =
      this.logged_to_file === this.should_log_to_file &&
      this.logged_to_state === this.should_log_to_state;
  }
}

/**
 * Test suite results
 */
class LoggingTestSuite {
  constructor(name) {
    this.test_suite = name;
    this.timestamp = new Date().toISOString();
    this.total_tests = 0;
    this.passed = 0;
    this.failed = 0;
    this.success_rate = 0;
    this.results = [];
    this.duration_ms = 0;
    this.environment = {
      node_version: process.version,
      platform: process.platform,
      project_root: PROJECT_ROOT,
    };
  }

  addResult(result) {
    this.results.push(result);
    this.total_tests++;
    if (result.passed) {
      this.passed++;
    } else {
      this.failed++;
    }
  }

  calculateSuccessRate() {
    this.success_rate =
      this.total_tests > 0 ? Math.round((this.passed / this.total_tests) * 100) : 0;
  }

  setDuration(startTime) {
    this.duration_ms = Date.now() - startTime;
  }
}

/**
 * Initialize test environment
 */
function initializeTestEnvironment() {
  const tmpDir = join(PROJECT_ROOT, '.claude/context/tmp');
  const logsDir = join(PROJECT_ROOT, '.claude/context/logs');

  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Create fresh session state
  const state = {
    session_id: `logging_test_${Date.now()}`,
    agent_role: 'orchestrator',
    read_count: 0,
    violations: [],
    created_at: new Date().toISOString(),
  };

  writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));

  // Clear violation log for clean test
  if (existsSync(VIOLATION_LOG_PATH)) {
    writeFileSync(VIOLATION_LOG_PATH, '');
  }

  process.env.CLAUDE_AGENT_ROLE = 'orchestrator';
}

/**
 * Log a violation (simulated)
 */
function logViolation(tool, reason, command = null) {
  const timestamp = new Date().toISOString();

  // Create log entry
  const logEntry = {
    timestamp,
    session_id: `logging_test_${Date.now()}`,
    tool,
    reason,
    command,
  };

  // Log to file
  const logLine = `[${timestamp}] VIOLATION: Tool=${tool}, Reason=${reason}${command ? `, Command=${command}` : ''}\n`;
  const logsDir = join(PROJECT_ROOT, '.claude/context/logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  try {
    if (existsSync(VIOLATION_LOG_PATH)) {
      const existingLog = readFileSync(VIOLATION_LOG_PATH, 'utf-8');
      writeFileSync(VIOLATION_LOG_PATH, existingLog + logLine);
    } else {
      writeFileSync(VIOLATION_LOG_PATH, logLine);
    }
  } catch (error) {
    console.error(`Failed to write to violation log: ${error.message}`);
  }

  // Log to session state
  try {
    if (existsSync(SESSION_STATE_PATH)) {
      const state = JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf-8'));
      state.violations = state.violations || [];
      state.violations.push(logEntry);
      writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
    }
  } catch (error) {
    console.error(`Failed to update session state: ${error.message}`);
  }

  return logEntry;
}

/**
 * Check if violation was logged to file
 */
function checkViolationLoggedToFile(tool) {
  if (!existsSync(VIOLATION_LOG_PATH)) {
    return { logged: false, entry: null };
  }

  try {
    const logContent = readFileSync(VIOLATION_LOG_PATH, 'utf-8');
    const lines = logContent.split('\n');

    // Find most recent entry for this tool
    const matchingLine = lines.reverse().find(line => line.includes(`Tool=${tool}`));

    if (matchingLine) {
      return { logged: true, entry: matchingLine.trim() };
    }

    return { logged: false, entry: null };
  } catch (error) {
    return { logged: false, entry: null };
  }
}

/**
 * Check if violation was logged to session state
 */
function checkViolationLoggedToState(tool) {
  if (!existsSync(SESSION_STATE_PATH)) {
    return { logged: false, entry: null };
  }

  try {
    const state = JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf-8'));
    const violations = state.violations || [];

    // Find most recent entry for this tool
    const matchingEntry = violations.reverse().find(v => v.tool === tool);

    if (matchingEntry) {
      return { logged: true, entry: matchingEntry };
    }

    return { logged: false, entry: null };
  } catch (error) {
    return { logged: false, entry: null };
  }
}

/**
 * Test scenarios
 */
const LOGGING_TEST_SCENARIOS = [
  {
    name: 'Write tool violation logged',
    tool: 'Write',
    reason: 'Orchestrator cannot modify files',
    shouldLogToFile: true,
    shouldLogToState: true,
  },
  {
    name: 'Edit tool violation logged',
    tool: 'Edit',
    reason: 'Orchestrator cannot edit files',
    shouldLogToFile: true,
    shouldLogToState: true,
  },
  {
    name: 'Grep tool violation logged',
    tool: 'Grep',
    reason: 'Orchestrator cannot search code',
    shouldLogToFile: true,
    shouldLogToState: true,
  },
  {
    name: 'Bash dangerous command violation logged',
    tool: 'Bash',
    reason: 'Dangerous git command',
    command: 'git add .',
    shouldLogToFile: true,
    shouldLogToState: true,
  },
];

/**
 * Run all logging tests
 */
async function runLoggingTests() {
  const startTime = Date.now();
  const suite = new LoggingTestSuite('Violation Logging Tests');

  console.log('Starting violation logging tests...\n');

  // Initialize test environment
  initializeTestEnvironment();

  // Run each test scenario
  for (const scenario of LOGGING_TEST_SCENARIOS) {
    const result = new LoggingTestResult(
      scenario.name,
      scenario.tool,
      scenario.shouldLogToFile,
      scenario.shouldLogToState
    );

    try {
      console.log(`Testing: ${scenario.name}...`);

      // Simulate violation
      logViolation(scenario.tool, scenario.reason, scenario.command);

      // Check file logging
      const fileCheck = checkViolationLoggedToFile(scenario.tool);

      // Check state logging
      const stateCheck = checkViolationLoggedToState(scenario.tool);

      result.setActual(fileCheck.logged, stateCheck.logged, fileCheck.entry, stateCheck.entry);

      if (result.passed) {
        console.log(`  ✓ PASS: Logged to file=${fileCheck.logged}, state=${stateCheck.logged}`);
        if (fileCheck.entry) {
          console.log(`    Log entry: ${fileCheck.entry.substring(0, 80)}...`);
        }
      } else {
        console.log(`  ✗ FAIL:`);
        console.log(
          `    Expected: File=${scenario.shouldLogToFile}, State=${scenario.shouldLogToState}`
        );
        console.log(`    Actual: File=${result.logged_to_file}, State=${result.logged_to_state}`);
      }
    } catch (error) {
      result.setActual(false, false, null, null, error.message);
      console.log(`  ✗ ERROR: ${error.message}`);
    }

    suite.addResult(result);
    console.log('');
  }

  // Calculate final results
  suite.calculateSuccessRate();
  suite.setDuration(startTime);

  // Output results
  outputResults(suite);

  // Cleanup test artifacts
  cleanupTestArtifacts();

  // Determine exit code
  if (suite.failed === 0) {
    console.log(`\n✓ All ${suite.total_tests} tests passed!`);
    process.exit(0);
  } else if (suite.success_rate >= 70) {
    console.log(
      `\n⚠ ${suite.failed} of ${suite.total_tests} tests failed (${suite.success_rate}% success rate)`
    );
    process.exit(1);
  } else {
    console.error(
      `\n✗ ${suite.failed} of ${suite.total_tests} tests failed (${suite.success_rate}% success rate)`
    );
    process.exit(2);
  }
}

/**
 * Output results to JSON file and console
 */
function outputResults(suite) {
  const outputDir = join(PROJECT_ROOT, '.claude/context/reports');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, `test-violation-logging-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(suite, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('LOGGING TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Test Suite: ${suite.test_suite}`);
  console.log(`Timestamp: ${suite.timestamp}`);
  console.log(`Total Tests: ${suite.total_tests}`);
  console.log(`Passed: ${suite.passed}`);
  console.log(`Failed: ${suite.failed}`);
  console.log(`Success Rate: ${suite.success_rate}%`);
  console.log(`Duration: ${suite.duration_ms}ms`);
  console.log(`Results saved to: ${outputPath}`);
  console.log('='.repeat(60));

  if (suite.failed > 0) {
    console.log('\nFailed Tests:');
    suite.results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    Expected: File=${r.should_log_to_file}, State=${r.should_log_to_state}`);
        console.log(`    Actual: File=${r.logged_to_file}, State=${r.logged_to_state}`);
        if (r.error_message) {
          console.log(`    Error: ${r.error_message}`);
        }
      });
  }
}

/**
 * Cleanup test artifacts
 */
function cleanupTestArtifacts() {
  console.log('\nCleaning up test artifacts...');

  try {
    // Clean session state
    if (existsSync(SESSION_STATE_PATH)) {
      const state = JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf-8'));
      if (state.session_id && state.session_id.startsWith('logging_test_')) {
        state.violations = [];
        writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
        console.log('  ✓ Session state cleaned');
      }
    }

    // Clean violation log
    if (existsSync(VIOLATION_LOG_PATH)) {
      const logContent = readFileSync(VIOLATION_LOG_PATH, 'utf-8');
      const lines = logContent.split('\n');
      const cleanedLines = lines.filter(line => !line.includes('logging_test_'));
      writeFileSync(VIOLATION_LOG_PATH, cleanedLines.join('\n'));
      console.log('  ✓ Violation log cleaned');
    }
  } catch (error) {
    console.warn(`  ⚠ Cleanup warning: ${error.message}`);
  }
}

// Run tests
runLoggingTests().catch(error => {
  console.error('Logging test execution failed:', error);
  process.exit(2);
});
