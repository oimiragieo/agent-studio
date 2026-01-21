#!/usr/bin/env node
/**
 * Router-First Enforcement - End-to-End Test Suite
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const HOOK_PATH = path.join(PROJECT_ROOT, '.claude/hooks/router-first-enforcer.mjs');
const SESSION_KEY = 'a2a-router-first-e2e';
const ROUTING_SESSIONS_DIR = path.join(PROJECT_ROOT, '.claude/context/tmp/routing-sessions');
const LEGACY_STATE_PATH = path.join(PROJECT_ROOT, '.claude/context/tmp/routing-session-state.json');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

const STATE_PATH = path.join(ROUTING_SESSIONS_DIR, `${safeFileId(SESSION_KEY)}.json`);

let testResults = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runHook(input, env = {}) {
  return new Promise(resolve => {
    const child = spawn('node', [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_SESSION_ID: SESSION_KEY, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => {
      try {
        resolve({ success: true, output: JSON.parse(stdout), raw: stdout, stderr, code });
      } catch (e) {
        resolve({ success: false, error: e.message, raw: stdout, stderr, code });
      }
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

function cleanup() {
  try {
    if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  } catch {}
  try {
    if (fs.existsSync(LEGACY_STATE_PATH)) fs.unlinkSync(LEGACY_STATE_PATH);
  } catch {}
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  try {
    fs.mkdirSync(path.dirname(LEGACY_STATE_PATH), { recursive: true });
    fs.writeFileSync(LEGACY_STATE_PATH, JSON.stringify(state, null, 2));
  } catch {}
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log('  [PASS] ' + testName);
    testResults.push({ test: testName, status: 'PASS', details: '' });
  } else {
    failedTests++;
    console.log('  [FAIL] ' + testName);
    if (details) console.log('     Detail: ' + details);
    testResults.push({ test: testName, status: 'FAIL', details });
  }
  return condition;
}

async function testNormalFlow() {
  console.log('');
  console.log('== Scenario 1: Normal Flow ==');
  cleanup();

  const r1 = await runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/test.ts' },
    context: { agent_name: 'developer' },
  });
  assert(r1.output?.decision === 'block', 'Non-router blocked');
  assert(r1.output?.metadata?.routing_status === 'pending', 'Status pending');

  const r2 = await runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/w.yaml' },
    context: { agent_name: 'router' },
  });
  assert(r2.output?.decision === 'approve', 'Router allowed');
  assert(r2.output?.metadata?.routing_status === 'in_progress', 'Status in_progress');

  const state = readState();
  state.routing.completed = true;
  state.routing.completed_at = new Date().toISOString();
  state.routing.decision = { intent: 'web_app', confidence: 0.95 };
  writeState(state);

  const r3 = await runHook({
    tool_name: 'Task',
    tool_input: { prompt: 'test' },
    context: { agent_name: 'master-orchestrator' },
  });
  assert(r3.output?.decision === 'approve', 'Orchestrator allowed after routing');
  assert(r3.output?.metadata?.routing_status === 'completed', 'Status completed');
}

async function testBypass() {
  console.log('');
  console.log('== Scenario 2: Bypass Mode ==');
  cleanup();

  const r1 = await runHook(
    {
      tool_name: 'Write',
      tool_input: { file_path: '/t.ts', content: 'x' },
      context: { agent_name: 'developer' },
    },
    { CLAUDE_ROUTER_BYPASS: 'true' }
  );
  assert(r1.output?.decision === 'approve', 'Bypass allows');
  assert(r1.output?.metadata?.routing_status === 'bypassed', 'Status bypassed');
}

async function testExpiration() {
  console.log('');
  console.log('== Scenario 3: Session Expiration ==');
  cleanup();

  writeState({
    session_id: 'sess_expired',
    routing: { completed: true },
    expires_at: '2020-01-01T00:00:00.000Z',
    version: 1,
  });

  const r1 = await runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/t.ts' },
    context: { agent_name: 'developer' },
  });
  assert(r1.output?.decision === 'block', 'Expired session blocked');
  assert(r1.output?.metadata?.routing_status === 'pending', 'Status reset');
}

async function testCorrupted() {
  console.log('');
  console.log('== Scenario 4: Corrupted State ==');
  cleanup();

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, '{ invalid');

  const r1 = await runHook({
    tool_name: 'Read',
    tool_input: { file_path: '/t.ts' },
    context: { agent_name: 'developer' },
  });
  assert(r1.output?.decision === 'block', 'Corrupted state blocked');
  assert(r1.output?.warning?.includes('corrupted'), 'Warning mentions corruption');
}

async function testPerformance() {
  console.log('');
  console.log('== Scenario 5: Performance ==');
  cleanup();

  const times = [];
  for (let i = 0; i < 5; i++) {
    cleanup();
    const r = await runHook({
      tool_name: 'Read',
      tool_input: { file_path: '/t.ts' },
      context: { agent_name: 'developer' },
    });
    times.push(r.output?.metadata?.decision_time_ms || 0);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log('  Avg time: ' + avg.toFixed(2) + 'ms');
  assert(avg < 50, 'Average < 50ms', 'Got: ' + avg.toFixed(2) + 'ms');
  assert(Math.max(...times) < 50, 'Max < 50ms', 'Got: ' + Math.max(...times) + 'ms');
}

async function main() {
  console.log('Router-First Enforcement E2E Tests');
  console.log('==================================');

  const start = Date.now();

  await testNormalFlow();
  await testBypass();
  await testExpiration();
  await testCorrupted();
  await testPerformance();

  cleanup();

  const duration = Date.now() - start;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('');
  console.log('==================================');
  console.log('Summary: ' + passedTests + '/' + totalTests + ' passed (' + passRate + '%)');
  console.log('Duration: ' + duration + 'ms');
  console.log('Verdict: ' + (failedTests === 0 ? 'PASS' : 'FAIL'));

  const result = {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      pass_rate: parseFloat(passRate),
      duration_ms: duration,
    },
    test_results: testResults,
    verdict: failedTests === 0 ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
  };

  console.log('');
  console.log('JSON: ' + JSON.stringify(result));
  process.exit(failedTests > 0 ? 1 : 0);
}

main();
