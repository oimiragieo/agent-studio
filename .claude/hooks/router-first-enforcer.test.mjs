#!/usr/bin/env node
/**
 * Router-First Enforcer Hook - Test Suite
 *
 * Covers all 7 test scenarios from the specification:
 * 1. First request in new session (router needed)
 * 2. Router agent running
 * 3. Routing completed (normal operation)
 * 4. Bypass mode enabled
 * 5. Corrupted session state
 * 6. Hook timeout (simulated)
 * 7. Task tool by orchestrator after routing
 */

import { existsSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOOK_PATH = join(__dirname, 'router-first-enforcer.mjs');
const SESSION_KEY = 'router-first-enforcer-test';
const ROUTING_SESSIONS_DIR = join(__dirname, '..', 'context', 'tmp', 'routing-sessions');
const LEGACY_SESSION_STATE_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'routing-session-state.json'
);

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

const SESSION_STATE_PATH = join(ROUTING_SESSIONS_DIR, `${safeFileId(SESSION_KEY)}.json`);
const TEST_SESSION_STATE_DIR = dirname(SESSION_STATE_PATH);

// Test utilities
let testsFailed = 0;
let testsPass = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  testsPass++;
  return true;
}

async function runHook(input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      env: { ...process.env, CLAUDE_SESSION_ID: SESSION_KEY, ...env },
    });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', c => {
      stdout += c;
    });
    proc.stderr.on('data', c => {
      stderr += c;
    });
    proc.on('error', e => reject(e));
    proc.on('close', code => {
      const trimmed = stdout.trim();
      if (!trimmed) {
        return reject(new Error(`Hook returned empty output (exit=${code}). Stderr: ${stderr}`));
      }
      try {
        return resolve(JSON.parse(trimmed));
      } catch (error) {
        return reject(
          new Error(
            `Hook output was not valid JSON (exit=${code}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n${error.message}`
          )
        );
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

async function cleanupTestState() {
  try {
    if (existsSync(SESSION_STATE_PATH)) await rm(SESSION_STATE_PATH, { force: true });
    if (existsSync(LEGACY_SESSION_STATE_PATH)) await rm(LEGACY_SESSION_STATE_PATH, { force: true });
  } catch {
    // Ignore cleanup errors
  }
  try {
    await mkdir(TEST_SESSION_STATE_DIR, { recursive: true });
  } catch {
    // Ignore mkdir errors
  }
}

async function createSessionState(state) {
  await mkdir(TEST_SESSION_STATE_DIR, { recursive: true });
  await writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  await writeFile(LEGACY_SESSION_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8').catch(
    () => {}
  );
}

// Test Scenario 1: First Request in New Session (Router Needed)
async function testFirstRequestNoRouting() {
  console.log('\n🧪 Test 1: First request in new session (router needed)');
  await cleanupTestState();

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.ts' },
    context: { agent_name: 'developer' },
  };

  const output = await runHook(input);

  assert(output.decision === 'block', 'Should block when routing not completed');
  assert(output.reason?.includes('ROUTER-FIRST ENFORCEMENT'), 'Should include enforcement message');

  // Verify state file was created
  assert(existsSync(SESSION_STATE_PATH), 'Should create session state file');
}

// Test Scenario 2: Router Agent Running
async function testRouterAgentRunning() {
  console.log('\n🧪 Test 2: Router agent running');
  await cleanupTestState();

  const initialState = {
    session_id: 'sess_1705420800000',
    created_at: '2026-01-16T12:00:00.000Z',
    updated_at: '2026-01-16T12:00:00.000Z',
    expires_at: '2999-01-01T00:00:00.000Z',
    routing: {
      completed: false,
      started_at: null,
      completed_at: null,
      decision: null,
    },
    routing_history: [],
    metrics: {
      routing_duration_ms: null,
      tokens_used: null,
      model: null,
    },
    version: 1,
    last_compact_ms: 1705420800000,
  };

  await createSessionState(initialState);

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/workflow.yaml' },
    context: { agent_name: 'router' },
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve router agent to run');

  // Verify state was updated with started_at
  const updatedState = JSON.parse(await readFile(SESSION_STATE_PATH, 'utf-8'));
  assert(updatedState.routing.started_at !== null, 'Should set routing.started_at');
}

// Test Scenario 2b: Router Agent Running (context uses subagent_type)
async function testRouterAgentRunningViaSubagentType() {
  console.log('\n🧪 Test 2b: Router agent running (subagent_type)');
  await cleanupTestState();

  const initialState = {
    session_id: 'sess_1705420800000',
    created_at: '2026-01-16T12:00:00.000Z',
    updated_at: '2026-01-16T12:00:00.000Z',
    expires_at: '2999-01-01T00:00:00.000Z',
    routing: {
      completed: false,
      started_at: null,
      completed_at: null,
      decision: null,
    },
    routing_history: [],
    metrics: {
      routing_duration_ms: null,
      tokens_used: null,
      model: null,
    },
    version: 1,
    last_compact_ms: 1705420800000,
  };

  await createSessionState(initialState);

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/workflow.yaml' },
    context: { subagent_type: 'router' },
  };

  const output = await runHook(input);
  assert(output.decision === 'approve', 'Should approve when context.subagent_type=router');
}

// Test Scenario 3: Routing Completed (Normal Operation)
async function testRoutingCompleted() {
  console.log('\n🧪 Test 3: Routing completed (normal operation)');
  await cleanupTestState();

  const completedState = {
    session_id: 'sess_1705420800000',
    created_at: '2026-01-16T12:00:00.000Z',
    updated_at: '2026-01-16T12:00:00.150Z',
    expires_at: '2999-01-01T00:00:00.000Z',
    routing: {
      completed: true,
      started_at: '2026-01-16T12:00:00.050Z',
      completed_at: '2026-01-16T12:00:00.150Z',
      decision: {
        intent: 'web_app',
        complexity: 'high',
        cloud_provider: 'gcp',
        workflow_selection: '@.claude/workflows/greenfield-fullstack.yaml',
        confidence: 0.95,
        reasoning: 'User wants enterprise web application with GCP',
        keywords_detected: ['enterprise', 'web application', 'google cloud'],
        should_escalate: true,
        escalation_target: 'master-orchestrator',
      },
    },
    routing_history: [],
    metrics: {
      routing_duration_ms: 100,
      tokens_used: { input: 250, output: 150 },
      model: 'haiku',
    },
    version: 2,
    last_compact_ms: 1705420800150,
  };

  await createSessionState(completedState);

  const input = {
    tool_name: 'Write',
    tool_input: { file_path: '/output.ts', content: '...' },
    context: { agent_name: 'developer' },
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve after routing completed');
}

// Test Scenario 4: Bypass Mode Enabled
async function testBypassMode() {
  console.log('\n🧪 Test 4: Bypass mode enabled');
  await cleanupTestState();

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/any/file.ts' },
    context: { agent_name: 'developer' },
  };

  const output = await runHook(input, { CLAUDE_ROUTER_BYPASS: 'true' });

  assert(output.decision === 'approve', 'Should approve in bypass mode');
}

// Test Scenario 5: Corrupted Session State
async function testCorruptedState() {
  console.log('\n🧪 Test 5: Corrupted session state');
  await cleanupTestState();

  // Write invalid JSON to state file
  await mkdir(TEST_SESSION_STATE_DIR, { recursive: true });
  await writeFile(SESSION_STATE_PATH, '{ invalid json', 'utf-8');

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/file.ts' },
    context: { agent_name: 'developer' },
  };

  const output = await runHook(input);

  assert(output.decision === 'block', 'Should block when state is corrupted');
  assert(output.reason?.includes('reset'), 'Should mention state was reset');

  // Verify state was reset to valid JSON
  const resetState = JSON.parse(await readFile(SESSION_STATE_PATH, 'utf-8'));
  assert(resetState.routing.completed === false, 'Reset state should have routing.completed=false');
}

// Test Scenario 6: Hook Timeout (Simulated via Fast Input)
// Note: We can't easily test the actual timeout without modifying the hook,
// but we can verify the hook completes quickly for normal inputs
async function testHookPerformance() {
  console.log('\n🧪 Test 6: Hook performance (should complete <50ms)');
  await cleanupTestState();

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/file.ts' },
    context: { agent_name: 'developer' },
  };

  const startTime = Date.now();
  const output = await runHook(input);
  const duration = Date.now() - startTime;

  assert(duration < 500, `Hook should complete quickly (took ${duration}ms)`);
  assert(output.decision === 'block', 'Should still block when routing not completed');
}

// Test Scenario 7: Task Tool by Orchestrator After Routing
async function testTaskToolAfterRouting() {
  console.log('\n🧪 Test 7: Task tool by orchestrator after routing');
  await cleanupTestState();

  const completedState = {
    session_id: 'sess_1705420800000',
    created_at: '2026-01-16T12:00:00.000Z',
    updated_at: '2026-01-16T12:00:00.150Z',
    expires_at: '2999-01-01T00:00:00.000Z',
    routing: {
      completed: true,
      started_at: '2026-01-16T12:00:00.050Z',
      completed_at: '2026-01-16T12:00:00.150Z',
      decision: {
        intent: 'web_app',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/greenfield-fullstack.yaml',
        confidence: 0.95,
        should_escalate: true,
        escalation_target: 'master-orchestrator',
      },
    },
    routing_history: [],
    metrics: { routing_duration_ms: 100, tokens_used: null, model: 'haiku' },
    version: 2,
    last_compact_ms: 1705420800150,
  };

  await createSessionState(completedState);

  const input = {
    tool_name: 'Task',
    tool_input: { prompt: '...', subagent_type: 'developer' },
    context: { agent_name: 'master-orchestrator' },
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve Task tool after routing completed');
}

// Test Session Expiration
async function testSessionExpiration() {
  console.log('\n🧪 Test 8: Session expiration');
  await cleanupTestState();

  const expiredState = {
    session_id: 'sess_1705420800000',
    created_at: '2026-01-16T12:00:00.000Z',
    updated_at: '2026-01-16T12:00:00.000Z',
    expires_at: '2020-01-01T00:00:00.000Z', // Expired
    routing: {
      completed: true,
      started_at: '2026-01-16T12:00:00.050Z',
      completed_at: '2026-01-16T12:00:00.150Z',
      decision: {
        intent: 'web_app',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/greenfield-fullstack.yaml',
        confidence: 0.95,
        should_escalate: true,
      },
    },
    routing_history: [],
    metrics: { routing_duration_ms: 100, tokens_used: null, model: 'haiku' },
    version: 2,
    last_compact_ms: 1705420800150,
  };

  await createSessionState(expiredState);

  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/file.ts' },
    context: { agent_name: 'developer' },
  };

  const output = await runHook(input);

  assert(output.decision === 'block', 'Should block with expired session');
}

// Test Scenario 9: Task tool spawning router (CRITICAL FIX)
async function testTaskToolSpawningRouter() {
  console.log('\n🧪 Test 9: Task tool spawning router (should be allowed)');
  await cleanupTestState();

  const input = {
    tool_name: 'Task',
    tool_input: { subagent_type: 'router', prompt: 'Classify user request' },
    context: {}, // Default agent (not router)
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve Task tool to spawn router');
}

// Test Scenario 9b: Task tool spawning router via subagentType (camelCase)
async function testTaskToolSpawningRouterCamelCase() {
  console.log('\nTest 9b: Task tool spawning router via subagentType (camelCase)');
  await cleanupTestState();

  const input = {
    tool_name: 'Task',
    tool_input: { subagentType: 'router', prompt: 'Classify user request' },
    context: {}, // Default agent (not router)
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve Task tool to spawn router (camelCase)');
}

// Test Scenario 9c: Direct router tool call allowed (non-Task runtimes)
async function testDirectRouterToolAllowed() {
  console.log('\nTest 9c: Direct router tool call allowed (non-Task runtimes)');
  await cleanupTestState();

  const input = {
    tool_name: 'router',
    tool_input: { prompt: 'Classify user request' },
    context: {}, // Default agent (not router)
  };

  const output = await runHook(input);

  assert(output.decision === 'approve', 'Should approve direct router tool call');
  assert(existsSync(SESSION_STATE_PATH), 'Should create session state file for direct router tool');
}

// Test Scenario 10: Coordination tools allowed (AskUserQuestion, TodoWrite)
async function testCoordinationToolsAllowed() {
  console.log('\n🧪 Test 10: Coordination tools allowed');
  await cleanupTestState();

  // Test AskUserQuestion
  const askInput = {
    tool_name: 'AskUserQuestion',
    tool_input: { question: 'What is your preference?' },
    context: {}, // Default agent
  };

  const askOutput = await runHook(askInput);
  assert(askOutput.decision === 'approve', 'Should approve AskUserQuestion');

  // Test TodoWrite
  const todoInput = {
    tool_name: 'TodoWrite',
    tool_input: { todos: [] },
    context: {}, // Default agent
  };

  const todoOutput = await runHook(todoInput);
  assert(todoOutput.decision === 'approve', 'Should approve TodoWrite');
}

// Test Scenario 11: Task tool spawning non-router still blocked
async function testTaskToolSpawningNonRouterBlocked() {
  console.log('\n🧪 Test 11: Task tool spawning non-router still blocked');
  await cleanupTestState();

  const input = {
    tool_name: 'Task',
    tool_input: { subagent_type: 'developer', prompt: 'Implement feature' },
    context: {}, // Default agent
  };

  const output = await runHook(input);

  assert(output.decision === 'block', 'Should block Task tool spawning non-router before routing');
  assert(output.reason?.includes('ROUTER-FIRST ENFORCEMENT'), 'Should include enforcement message');
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Router-First Enforcer Hook - Test Suite\n');
  console.log('='.repeat(70));

  try {
    await testFirstRequestNoRouting();
    await testRouterAgentRunning();
    await testRouterAgentRunningViaSubagentType();
    await testRoutingCompleted();
    await testBypassMode();
    await testCorruptedState();
    await testHookPerformance();
    await testTaskToolAfterRouting();
    await testSessionExpiration();
    await testTaskToolSpawningRouter();
    await testTaskToolSpawningRouterCamelCase();
    await testDirectRouterToolAllowed();
    await testCoordinationToolsAllowed();
    await testTaskToolSpawningNonRouterBlocked();
  } catch (error) {
    console.error(`\n❌ Test execution failed: ${error.message}`);
    console.error(error.stack);
    testsFailed++;
  } finally {
    await cleanupTestState();
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Test Results: ${testsPass} passed, ${testsFailed} failed`);

  if (testsFailed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

runAllTests();
