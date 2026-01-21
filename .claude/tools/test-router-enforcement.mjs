#!/usr/bin/env node
/**
 * Router-First Enforcement Test Script
 *
 * Tests that the router-first enforcement system is working correctly.
 * Validates hook registration, hook execution, and session state creation.
 *
 * Usage: node .claude/tools/test-router-enforcement.mjs
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { join } from 'path';

const execAsync = promisify(exec);

const TESTS = [];
let passed = 0;
let failed = 0;

const SESSION_KEY = 'test-router-enforcement-script';
const ROUTING_SESSIONS_DIR = join('.claude', 'context', 'tmp', 'routing-sessions');
const LEGACY_STATE_PATH = join('.claude', 'context', 'tmp', 'routing-session-state.json');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

const STATE_PATH = join(ROUTING_SESSIONS_DIR, `${safeFileId(SESSION_KEY)}.json`);

// Test helper
function test(name, fn) {
  TESTS.push({ name, fn });
}

function pass(message) {
  console.log(`✅ PASS: ${message}`);
  passed++;
}

function fail(message) {
  console.log(`❌ FAIL: ${message}`);
  failed++;
}

function info(message) {
  console.log(`ℹ️  INFO: ${message}`);
}

// ===========================
// Test Suite
// ===========================

test('Hook registered in settings.json', async () => {
  const settingsPath = '.claude/settings.json';

  if (!existsSync(settingsPath)) {
    fail('settings.json not found');
    return;
  }

  const content = await readFile(settingsPath, 'utf-8');
  const settings = JSON.parse(content);

  if (!settings.hooks?.PreToolUse) {
    fail('PreToolUse hooks not found in settings.json');
    return;
  }

  const hookEntry = settings.hooks.PreToolUse.find(h =>
    h.hooks?.some(hook => hook.command?.includes('router-first-enforcer.mjs'))
  );

  if (hookEntry) {
    pass('router-first-enforcer.mjs registered in PreToolUse hooks');
  } else {
    fail('router-first-enforcer.mjs NOT registered in PreToolUse hooks');
  }
});

test('Router completion handler registered in PostToolUse hooks', async () => {
  const settingsPath = '.claude/settings.json';

  if (!existsSync(settingsPath)) {
    fail('settings.json not found');
    return;
  }

  const content = await readFile(settingsPath, 'utf-8');
  const settings = JSON.parse(content);

  if (!settings.hooks?.PostToolUse) {
    fail('PostToolUse hooks not found in settings.json');
    return;
  }

  const hookEntry = settings.hooks.PostToolUse.find(h =>
    h.hooks?.some(hook => hook.command?.includes('router-completion-handler.mjs'))
  );

  if (hookEntry) {
    pass('router-completion-handler.mjs registered in PostToolUse hooks');
  } else {
    fail('router-completion-handler.mjs NOT registered in PostToolUse hooks');
  }
});

test('Hook file exists and is executable', async () => {
  const hookPath = '.claude/hooks/router-first-enforcer.mjs';

  if (!existsSync(hookPath)) {
    fail('router-first-enforcer.mjs file not found');
    return;
  }

  pass('Hook file exists');

  // Test that it's valid JavaScript
  try {
    await execAsync(`node --check ${hookPath}`);
    pass('Hook file has valid syntax');
  } catch (error) {
    fail(`Hook file has syntax errors: ${error.message}`);
  }
});

test('Router completion handler file exists and is executable', async () => {
  const hookPath = '.claude/hooks/router-completion-handler.mjs';

  if (!existsSync(hookPath)) {
    fail('router-completion-handler.mjs file not found');
    return;
  }

  pass('Router completion handler file exists');

  // Test that it's valid JavaScript
  try {
    await execAsync(`node --check ${hookPath}`);
    pass('Router completion handler has valid syntax');
  } catch (error) {
    fail(`Router completion handler has syntax errors: ${error.message}`);
  }
});

test('Hook executes and returns block decision (no routing state)', async () => {
  const hookPath = '.claude/hooks/router-first-enforcer.mjs';

  // Ensure clean state for deterministic result
  const statePath = STATE_PATH;

  // Mock input for hook (tool call without routing completed)
  const mockInput = {
    tool_name: 'Read',
    tool_input: { file_path: 'test.txt' },
    context: {},
  };

  // Write to temp file to avoid shell escaping issues on Windows
  const { writeFile, unlink } = await import('fs/promises');
  const tmpFile = '.claude/context/tmp/test-hook-input.json';

  try {
    if (existsSync(statePath)) {
      await unlink(statePath).catch(() => {});
    }
    if (existsSync(LEGACY_STATE_PATH)) {
      await unlink(LEGACY_STATE_PATH).catch(() => {});
    }

    await writeFile(tmpFile, JSON.stringify(mockInput), 'utf-8');

    const { stdout, stderr } = await execAsync(`node ${hookPath} < ${tmpFile}`, {
      timeout: 3000,
      env: { ...process.env, CLAUDE_SESSION_ID: SESSION_KEY },
    });

    if (stderr && !stderr.includes('warning')) {
      info(`Hook stderr: ${stderr}`);
    }

    // Trim and clean stdout
    const cleanStdout = stdout.trim();
    if (!cleanStdout) {
      fail('Hook returned empty output');
      return;
    }

    const result = JSON.parse(cleanStdout);

    if (result.decision === 'block') {
      pass('Hook correctly blocks tools when routing not complete');
    } else if (result.decision === 'approve') {
      fail('Hook incorrectly approves tools (should block when routing not complete)');
      info(`Received result: ${JSON.stringify(result)}`);
    } else {
      fail(`Hook returned unexpected decision: ${result.decision}`);
      info(`Full result: ${JSON.stringify(result)}`);
    }

    // Clean up temp file
    await unlink(tmpFile).catch(() => {});
  } catch (error) {
    fail(`Hook execution failed: ${error.message}`);
    info(`Error details: ${error.stack || error}`);
    // Clean up temp file on error
    await unlink(tmpFile).catch(() => {});
  }
});

test('CLAUDE.md has DEFAULT AGENT PROTOCOL', async () => {
  const claudeMdPath = '.claude/CLAUDE.md';

  if (!existsSync(claudeMdPath)) {
    fail('CLAUDE.md not found');
    return;
  }

  const content = await readFile(claudeMdPath, 'utf-8');

  if (content.includes('ROUTING PROTOCOL (READ THIS FIRST)')) {
    pass('CLAUDE.md has ROUTING PROTOCOL section');
  } else {
    fail('CLAUDE.md missing ROUTING PROTOCOL section');
  }

  if (content.includes('DEFAULT AGENT PROTOCOL')) {
    pass('CLAUDE.md has DEFAULT AGENT PROTOCOL instructions');
  } else {
    fail('CLAUDE.md missing DEFAULT AGENT PROTOCOL instructions');
  }

  if (content.includes('YOUR MANDATORY FIRST ACTION')) {
    pass('CLAUDE.md has mandatory delegation instructions');
  } else {
    fail('CLAUDE.md missing mandatory delegation instructions');
  }
});

test('Router agent definition exists', async () => {
  const routerPath = '.claude/agents/router.md';

  if (!existsSync(routerPath)) {
    fail('router.md not found');
    return;
  }

  const content = await readFile(routerPath, 'utf-8');

  if (content.includes('name: router')) {
    pass('Router agent has correct frontmatter');
  } else {
    fail('Router agent missing name in frontmatter');
  }

  if (content.includes('Intent Classification')) {
    pass('Router agent has classification instructions');
  } else {
    fail('Router agent missing classification logic');
  }
});

test('Session state directory exists or can be created', async () => {
  const sessionDir = '.claude/context/tmp';

  if (existsSync(sessionDir)) {
    pass('Session state directory exists');
  } else {
    info('Session state directory does NOT exist yet (will be created on first run)');
  }
});

test('Bypass environment variable not set', async () => {
  if (process.env.CLAUDE_ROUTER_BYPASS === 'true') {
    fail('CLAUDE_ROUTER_BYPASS=true is set (enforcement is bypassed!)');
    info('Unset it with: unset CLAUDE_ROUTER_BYPASS');
  } else {
    pass('Bypass environment variable not set (enforcement active)');
  }
});

// ===========================
// Run Tests
// ===========================

async function runTests() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Router-First Enforcement Test Suite                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const test of TESTS) {
    console.log(`Running: ${test.name}`);
    try {
      await test.fn();
    } catch (error) {
      fail(`Test threw error: ${error.message}`);
    }
    console.log('');
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Test Results                                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Total Tests: ${TESTS.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Router-first enforcement is configured correctly.');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Run `claude` in your terminal');
    console.log('2. Ask a question like "What files are in this repository?"');
    console.log('3. Verify that Claude delegates to router agent first');
    console.log('');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED. Review failures above and fix issues.');
    console.log('');
    console.log('See .claude/context/reports/router-first-enforcement-fix-report.md');
    console.log('for troubleshooting steps.');
    console.log('');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
