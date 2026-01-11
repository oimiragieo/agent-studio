#!/usr/bin/env node
/**
 * Test Suite for Orchestrator Enforcement Hook
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_STATE_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.json'
);
const HOOK_PATH = join(__dirname, '..', 'hooks', 'orchestrator-enforcement-pre-tool.mjs');

// Test results
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Run hook with input
 */
async function runHook(input) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH]);

    let output = '';
    proc.stdout.on('data', data => {
      output += data;
    });
    proc.stderr.on('data', data => {
      console.error('STDERR:', data.toString());
    });

    proc.on('close', () => {
      try {
        resolve(JSON.parse(output));
      } catch (e) {
        resolve({ decision: 'error', raw: output, parseError: e.message });
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

/**
 * Initialize orchestrator session
 */
function initOrchestratorSession() {
  const dir = dirname(SESSION_STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(
    SESSION_STATE_PATH,
    JSON.stringify({
      session_id: 'test_session',
      agent_role: 'orchestrator',
      read_count: 0,
      violations: [],
      files_read: [],
    })
  );
}

/**
 * Initialize subagent session
 */
function initSubagentSession() {
  const dir = dirname(SESSION_STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(
    SESSION_STATE_PATH,
    JSON.stringify({
      session_id: 'test_session',
      agent_role: 'subagent',
      read_count: 0,
      violations: [],
      files_read: [],
    })
  );
}

/**
 * Clean up session state
 */
function cleanupSession() {
  if (existsSync(SESSION_STATE_PATH)) {
    unlinkSync(SESSION_STATE_PATH);
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`✗ ${message}`);
  }
}

/**
 * Test suite
 */
async function runTests() {
  console.log('Starting Orchestrator Enforcement Hook Tests...\n');

  // Test 1: Block Write tool for orchestrator
  console.log('Test 1: Block Write tool for orchestrator');
  initOrchestratorSession();
  const result1 = await runHook({ tool: 'Write', tool_input: { file_path: '/test.ts' } });
  assert(result1.decision === 'block', 'Should block Write tool');
  assert(result1.reason?.includes('ORCHESTRATOR VIOLATION'), 'Should include violation message');
  cleanupSession();

  // Test 2: Block Edit tool for orchestrator
  console.log('\nTest 2: Block Edit tool for orchestrator');
  initOrchestratorSession();
  const result2 = await runHook({ tool: 'Edit', tool_input: { file_path: '/test.ts' } });
  assert(result2.decision === 'block', 'Should block Edit tool');
  cleanupSession();

  // Test 3: Block Grep tool for orchestrator
  console.log('\nTest 3: Block Grep tool for orchestrator');
  initOrchestratorSession();
  const result3 = await runHook({ tool: 'Grep', tool_input: { pattern: 'test' } });
  assert(result3.decision === 'block', 'Should block Grep tool');
  cleanupSession();

  // Test 4: Block Glob tool for orchestrator
  console.log('\nTest 4: Block Glob tool for orchestrator');
  initOrchestratorSession();
  const result4 = await runHook({ tool: 'Glob', tool_input: { pattern: '**/*.ts' } });
  assert(result4.decision === 'block', 'Should block Glob tool');
  cleanupSession();

  // Test 5: Allow first 2 Read calls
  console.log('\nTest 5: Allow first 2 Read calls');
  initOrchestratorSession();
  const result5a = await runHook({ tool: 'Read', tool_input: { file_path: '/file1.ts' } });
  assert(result5a.decision === 'allow', 'Should allow first Read');

  const result5b = await runHook({ tool: 'Read', tool_input: { file_path: '/file2.ts' } });
  assert(result5b.decision === 'allow', 'Should allow second Read');
  cleanupSession();

  // Test 6: Block 3rd Read call
  console.log('\nTest 6: Block 3rd Read call');
  initOrchestratorSession();
  await runHook({ tool: 'Read', tool_input: { file_path: '/file1.ts' } });
  await runHook({ tool: 'Read', tool_input: { file_path: '/file2.ts' } });

  const result6 = await runHook({ tool: 'Read', tool_input: { file_path: '/file3.ts' } });
  assert(result6.decision === 'block', 'Should block 3rd Read');
  assert(result6.reason?.includes('2-FILE RULE'), 'Should mention 2-file rule');
  cleanupSession();

  // Test 7: Allow coordination files after limit
  console.log('\nTest 7: Allow coordination files after limit');
  initOrchestratorSession();
  await runHook({ tool: 'Read', tool_input: { file_path: '/file1.ts' } });
  await runHook({ tool: 'Read', tool_input: { file_path: '/file2.ts' } });

  const result7 = await runHook({
    tool: 'Read',
    tool_input: { file_path: '.claude/context/runs/abc/plan-abc.json' },
  });
  assert(result7.decision === 'allow', 'Should allow coordination files');
  cleanupSession();

  // Test 8: Block git commands in Bash
  console.log('\nTest 8: Block git commands in Bash');
  initOrchestratorSession();
  const result8 = await runHook({
    tool: 'Bash',
    tool_input: { command: 'git add .' },
  });
  assert(result8.decision === 'block', 'Should block git commands');
  cleanupSession();

  // Test 9: Block rm commands in Bash
  console.log('\nTest 9: Block rm commands in Bash');
  initOrchestratorSession();
  const result9 = await runHook({
    tool: 'Bash',
    tool_input: { command: 'rm -rf /tmp/test' },
  });
  assert(result9.decision === 'block', 'Should block rm commands');
  cleanupSession();

  // Test 10: Allow safe Bash commands
  console.log('\nTest 10: Allow safe Bash commands');
  initOrchestratorSession();
  const result10 = await runHook({
    tool: 'Bash',
    tool_input: { command: 'ls -la' },
  });
  assert(result10.decision === 'allow', 'Should allow safe Bash commands');
  cleanupSession();

  // Test 11: Allow all tools for non-orchestrator
  console.log('\nTest 11: Allow all tools for subagent');
  initSubagentSession();
  const result11 = await runHook({ tool: 'Write', tool_input: { file_path: '/test.ts' } });
  assert(result11.decision === 'allow', 'Should allow Write for subagent');
  cleanupSession();

  // Test 12: Allow Task tool for orchestrator
  console.log('\nTest 12: Allow Task tool for orchestrator');
  initOrchestratorSession();
  const result12 = await runHook({ tool: 'Task', tool_input: { agent: 'developer' } });
  assert(result12.decision === 'allow', 'Should allow Task tool');
  cleanupSession();

  // Test 13: Allow TodoWrite for orchestrator
  console.log('\nTest 13: Allow TodoWrite for orchestrator');
  initOrchestratorSession();
  const result13 = await runHook({ tool: 'TodoWrite', tool_input: { task: 'test' } });
  assert(result13.decision === 'allow', 'Should allow TodoWrite');
  cleanupSession();

  // Test 14: Allow AskUserQuestion for orchestrator
  console.log('\nTest 14: Allow AskUserQuestion for orchestrator');
  initOrchestratorSession();
  const result14 = await runHook({ tool: 'AskUserQuestion', tool_input: { question: 'test?' } });
  assert(result14.decision === 'allow', 'Should allow AskUserQuestion');
  cleanupSession();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Tests Passed: ${passed}`);
  console.log(`Tests Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\nFailed Tests:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
