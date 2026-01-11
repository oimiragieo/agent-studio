#!/usr/bin/env node

/**
 * Test Suite for Orchestrator Enforcement Hook
 *
 * Tests that the hook correctly blocks orchestrators from:
 * - Using Write tool
 * - Using Edit tool
 * - Using Bash with rm/git commands
 * - Using Read more than 2 times
 * - Using Grep tool
 * - Using Glob tool
 */

import {
  PreToolUse,
  PostToolUse,
  resetReadCounter,
  getReadCount,
} from './orchestrator-enforcement-hook.mjs';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    testsPassed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`❌ FAIL: ${message}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual: ${actual}`);
  }
}

// Test Suite
async function runTests() {
  console.log('🧪 Testing Orchestrator Enforcement Hook\n');

  // Test 1: Block Write tool for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Write',
      parameters: { file_path: 'test.txt', content: 'test' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Write tool blocked for orchestrator');
    assert(
      result.message.includes('ORCHESTRATOR VIOLATION'),
      'Write block message contains violation warning'
    );
  }

  // Test 2: Allow Write tool for developer
  {
    const result = await PreToolUse({
      tool: 'Write',
      parameters: { file_path: 'test.txt', content: 'test' },
      agentName: 'developer',
    });
    assertEquals(result.decision, 'allow', 'Write tool allowed for developer');
  }

  // Test 3: Block Edit tool for master-orchestrator
  {
    const result = await PreToolUse({
      tool: 'Edit',
      parameters: { file_path: 'test.txt', old_string: 'a', new_string: 'b' },
      agentName: 'master-orchestrator',
    });
    assertEquals(result.decision, 'block', 'Edit tool blocked for master-orchestrator');
  }

  // Test 4: Block Bash with rm -rf for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Bash',
      parameters: { command: 'rm -rf .claude/archive/' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Bash with rm -rf blocked for orchestrator');
    assert(result.message.includes('rm -rf'), 'Block message mentions rm -rf');
  }

  // Test 5: Block Bash with git add for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Bash',
      parameters: { command: 'git add .' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Bash with git add blocked for orchestrator');
  }

  // Test 6: Allow safe Bash commands for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Bash',
      parameters: { command: 'pwd' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'allow', 'Bash with safe command (pwd) allowed for orchestrator');
  }

  // Test 7: Block Grep tool for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Grep',
      parameters: { pattern: 'test' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Grep tool blocked for orchestrator');
  }

  // Test 8: Block Glob tool for orchestrator
  {
    const result = await PreToolUse({
      tool: 'Glob',
      parameters: { pattern: '**/*.md' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Glob tool blocked for orchestrator');
  }

  // Test 9: 2-File Rule - Allow first Read
  {
    resetReadCounter('orchestrator');
    const result = await PreToolUse({
      tool: 'Read',
      parameters: { file_path: 'file1.txt' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'allow', 'First Read allowed for orchestrator');
    assertEquals(getReadCount('orchestrator'), 1, 'Read count is 1 after first Read');
  }

  // Test 10: 2-File Rule - Allow second Read
  {
    const result = await PreToolUse({
      tool: 'Read',
      parameters: { file_path: 'file2.txt' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'allow', 'Second Read allowed for orchestrator');
    assertEquals(getReadCount('orchestrator'), 2, 'Read count is 2 after second Read');
  }

  // Test 11: 2-File Rule - Block third Read
  {
    const result = await PreToolUse({
      tool: 'Read',
      parameters: { file_path: 'file3.txt' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Third Read blocked for orchestrator (2-FILE RULE)');
    assert(result.message.includes('2-FILE RULE'), 'Block message mentions 2-FILE RULE');
  }

  // Test 12: Read counter resets after Task tool
  {
    await PostToolUse({
      tool: 'Task',
      agentName: 'orchestrator',
    });
    assertEquals(getReadCount('orchestrator'), 0, 'Read counter reset to 0 after Task tool');
  }

  // Test 13: Allow Task tool for orchestrator (coordination)
  {
    const result = await PreToolUse({
      tool: 'Task',
      parameters: { subagent_type: 'developer' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'allow', 'Task tool allowed for orchestrator');
  }

  // Test 14: Allow Search tool for orchestrator (coordination)
  {
    const result = await PreToolUse({
      tool: 'Search',
      parameters: { query: 'test' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'allow', 'Search tool allowed for orchestrator');
  }

  // Test 15: Block validation scripts via Bash
  {
    const result = await PreToolUse({
      tool: 'Bash',
      parameters: { command: 'node .claude/tools/enforcement-gate.mjs validate-all' },
      agentName: 'orchestrator',
    });
    assertEquals(result.decision, 'block', 'Validation script execution blocked for orchestrator');
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Orchestrator enforcement is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
