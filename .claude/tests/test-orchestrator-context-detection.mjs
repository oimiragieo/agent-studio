#!/usr/bin/env node
/**
 * Test: Orchestrator Context Detection
 *
 * Verifies that orchestrator-enforcement-pre-tool.mjs correctly detects
 * orchestrator role without relying on CLAUDE.md content (to avoid false
 * positives that block subagents).
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hookPath = join(__dirname, '..', 'hooks', 'orchestrator-enforcement-pre-tool.mjs');
const claudeMdPath = join(__dirname, '..', 'CLAUDE.md');
const sessionStatePath = join(__dirname, '..', 'context', 'tmp', 'orchestrator-session-state.json');

// Test cases
const tests = [
  {
    name: 'Session state agent_role=orchestrator → BLOCK Edit tool',
    setup: () => {
      delete process.env.CLAUDE_AGENT_ROLE;
      delete process.env.CLAUDE_AGENT_NAME;
      if (existsSync(sessionStatePath)) unlinkSync(sessionStatePath);
      writeFileSync(
        sessionStatePath,
        JSON.stringify({
          session_id: 'test_session',
          agent_role: 'orchestrator',
          read_count: 0,
          violations: [],
          files_read: [],
        })
      );
    },
    input: {
      tool_name: 'Edit',
      tool_input: {
        file_path: 'test.ts',
        old_string: 'old',
        new_string: 'new',
      },
    },
    expectedDecision: 'block',
    expectedReason: /ORCHESTRATOR VIOLATION/,
  },
  {
    name: 'Env var CLAUDE_AGENT_ROLE=orchestrator → BLOCK Write tool',
    setup: () => {
      process.env.CLAUDE_AGENT_ROLE = 'orchestrator';
      if (existsSync(sessionStatePath)) {
        unlinkSync(sessionStatePath);
      }
    },
    input: {
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.ts',
        content: 'content',
      },
    },
    expectedDecision: 'block',
    expectedReason: /ORCHESTRATOR VIOLATION/,
    cleanup: () => {
      delete process.env.CLAUDE_AGENT_ROLE;
    },
  },
  {
    name: 'No orchestrator signals → ALLOW Edit tool',
    setup: () => {
      delete process.env.CLAUDE_AGENT_ROLE;
      delete process.env.CLAUDE_AGENT_NAME;
      if (existsSync(sessionStatePath)) {
        unlinkSync(sessionStatePath);
      }
      // Temporarily rename CLAUDE.md to disable context detection
      if (existsSync(claudeMdPath)) {
        execSync(`move "${claudeMdPath}" "${claudeMdPath}.backup"`, { shell: true });
      }
    },
    input: {
      tool_name: 'Edit',
      tool_input: {
        file_path: 'test.ts',
        old_string: 'old',
        new_string: 'new',
      },
    },
    expectedDecision: 'allow',
    cleanup: () => {
      // Restore CLAUDE.md
      const backupPath = `${claudeMdPath}.backup`;
      if (existsSync(backupPath)) {
        execSync(`move "${backupPath}" "${claudeMdPath}"`, { shell: true });
      }
    },
  },
  {
    name: 'Session state orchestrator → Read tool count limit enforced',
    setup: () => {
      delete process.env.CLAUDE_AGENT_ROLE;
      delete process.env.CLAUDE_AGENT_NAME;
      if (existsSync(sessionStatePath)) unlinkSync(sessionStatePath);
      writeFileSync(
        sessionStatePath,
        JSON.stringify({
          session_id: 'test_session',
          agent_role: 'orchestrator',
          read_count: 0,
          violations: [],
          files_read: [],
        })
      );
    },
    input: {
      tool_name: 'Read',
      tool_input: {
        file_path: 'test.ts',
      },
    },
    expectedDecision: 'allow', // First read should be allowed
    runMultipleTimes: 3, // Run 3 times to trigger limit
    expectedDecisionOnThirdCall: 'block',
  },
];

/**
 * Run hook with given input
 */
function runHook(input) {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      env: process.env,
    });
    return JSON.parse(result.trim());
  } catch (error) {
    // Hook may fail gracefully
    console.error('Hook execution error:', error.message);
    return { decision: 'allow', error: true };
  }
}

/**
 * Run all tests
 */
function runTests() {
  console.log('🧪 Testing Orchestrator Context Detection\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);

    try {
      // Setup
      if (test.setup) {
        test.setup();
      }

      if (test.runMultipleTimes) {
        // Run multiple times and check last result
        let lastResult;
        for (let i = 0; i < test.runMultipleTimes; i++) {
          lastResult = runHook(test.input);
        }

        if (lastResult.decision === test.expectedDecisionOnThirdCall) {
          console.log(`✅ PASS - Third call blocked as expected`);
          passed++;
        } else {
          console.log(
            `❌ FAIL - Expected ${test.expectedDecisionOnThirdCall}, got ${lastResult.decision}`
          );
          console.log('Result:', JSON.stringify(lastResult, null, 2));
          failed++;
        }
      } else {
        // Run once
        const result = runHook(test.input);

        // Check decision
        if (result.decision !== test.expectedDecision) {
          console.log(
            `❌ FAIL - Expected decision: ${test.expectedDecision}, got: ${result.decision}`
          );
          console.log('Result:', JSON.stringify(result, null, 2));
          failed++;
        } else if (test.expectedReason && !test.expectedReason.test(result.reason || '')) {
          console.log(`❌ FAIL - Reason doesn't match expected pattern`);
          console.log('Result:', JSON.stringify(result, null, 2));
          failed++;
        } else {
          console.log(`✅ PASS`);
          passed++;
        }
      }

      // Cleanup
      if (test.cleanup) {
        test.cleanup();
      }
    } catch (error) {
      console.log(`❌ FAIL - Error: ${error.message}`);
      failed++;

      // Cleanup on error
      if (test.cleanup) {
        try {
          test.cleanup();
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError.message);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Review hook implementation.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Orchestrator context detection works correctly.');
    process.exit(0);
  }
}

// Run tests
runTests();
