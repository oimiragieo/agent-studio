#!/usr/bin/env node
/**
 * Tests for router-self-check.cjs
 *
 * Run with: node .claude/hooks/routing/router-self-check.test.cjs
 */

'use strict';

const assert = require('assert');
const routerState = require('../router-state.cjs');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    // Reset state before each test
    routerState.resetToRouterMode();
    // Clear environment
    delete process.env.ROUTER_SELF_CHECK;

    fn();
    console.log(`  PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(
      `${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected truthy value, got ${JSON.stringify(value)}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected falsy value, got ${JSON.stringify(value)}`);
  }
}

function assertIncludes(str, substr, message = '') {
  if (!str || !str.includes(substr)) {
    throw new Error(`${message} Expected "${str}" to include "${substr}"`);
  }
}

// Import the module under test (will fail until we create it)
let validate, BLACKLISTED_TOOLS, WHITELISTED_TOOLS, isAlwaysAllowedWrite, WRITE_TOOLS;
try {
  const selfCheck = require('./router-self-check.cjs');
  validate = selfCheck.validate;
  BLACKLISTED_TOOLS = selfCheck.BLACKLISTED_TOOLS;
  WHITELISTED_TOOLS = selfCheck.WHITELISTED_TOOLS;
  isAlwaysAllowedWrite = selfCheck.isAlwaysAllowedWrite;
  WRITE_TOOLS = selfCheck.WRITE_TOOLS;
} catch (e) {
  console.error('ERROR: Module not found or invalid');
  console.error('       Create .claude/hooks/routing/router-self-check.cjs first');
  process.exit(1);
}

// ===========================================
// Tool Classification Tests
// ===========================================

console.log('\n=== Tool Classification Tests ===\n');

test('BLACKLISTED_TOOLS contains exploration/modification tools', () => {
  assertTrue(BLACKLISTED_TOOLS.includes('Glob'), 'Glob should be blacklisted');
  assertTrue(BLACKLISTED_TOOLS.includes('Grep'), 'Grep should be blacklisted');
  assertTrue(BLACKLISTED_TOOLS.includes('Edit'), 'Edit should be blacklisted');
  assertTrue(BLACKLISTED_TOOLS.includes('Write'), 'Write should be blacklisted');
  assertTrue(BLACKLISTED_TOOLS.includes('NotebookEdit'), 'NotebookEdit should be blacklisted');
  assertTrue(BLACKLISTED_TOOLS.includes('WebSearch'), 'WebSearch should be blacklisted');
});

test('WHITELISTED_TOOLS contains routing tools', () => {
  assertTrue(WHITELISTED_TOOLS.includes('Task'), 'Task should be whitelisted');
  assertTrue(WHITELISTED_TOOLS.includes('TaskCreate'), 'TaskCreate should be whitelisted');
  assertTrue(WHITELISTED_TOOLS.includes('TaskUpdate'), 'TaskUpdate should be whitelisted');
  assertTrue(WHITELISTED_TOOLS.includes('TaskList'), 'TaskList should be whitelisted');
  assertTrue(WHITELISTED_TOOLS.includes('TaskGet'), 'TaskGet should be whitelisted');
  assertTrue(WHITELISTED_TOOLS.includes('Read'), 'Read should be whitelisted');
  assertTrue(
    WHITELISTED_TOOLS.includes('AskUserQuestion'),
    'AskUserQuestion should be whitelisted'
  );
});

// ===========================================
// Validate Function - Router Mode Tests
// ===========================================

console.log('\n=== Validate Function - Router Mode Tests ===\n');

test('blocks Glob in router mode (block enforcement)', () => {
  // Router mode is default
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Glob');
  assertFalse(result.allowed, 'Glob should be blocked in router mode');
  assertIncludes(result.message, 'ROUTER SELF-CHECK VIOLATION');
});

test('blocks Grep in router mode (block enforcement)', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Grep');
  assertFalse(result.allowed, 'Grep should be blocked in router mode');
});

test('blocks Edit in router mode (block enforcement)', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Edit');
  assertFalse(result.allowed, 'Edit should be blocked in router mode');
});

test('blocks Write in router mode (block enforcement)', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Write');
  assertFalse(result.allowed, 'Write should be blocked in router mode');
});

test('blocks WebSearch in router mode (block enforcement)', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('WebSearch');
  assertFalse(result.allowed, 'WebSearch should be blocked in router mode');
});

// ===========================================
// Validate Function - Agent Mode Tests
// ===========================================

console.log('\n=== Validate Function - Agent Mode Tests ===\n');

test('allows Glob in agent mode', () => {
  routerState.enterAgentMode('Test agent');
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Glob');
  assertTrue(result.allowed, 'Glob should be allowed in agent mode');
});

test('allows Grep in agent mode', () => {
  routerState.enterAgentMode('Test agent');
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Grep');
  assertTrue(result.allowed, 'Grep should be allowed in agent mode');
});

test('allows Edit in agent mode', () => {
  routerState.enterAgentMode('Test agent');
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Edit');
  assertTrue(result.allowed, 'Edit should be allowed in agent mode');
});

// ===========================================
// Validate Function - Whitelisted Tools
// ===========================================

console.log('\n=== Validate Function - Whitelisted Tools ===\n');

test('always allows Task in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Task');
  assertTrue(result.allowed, 'Task should always be allowed');
});

test('always allows TaskCreate in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('TaskCreate');
  assertTrue(result.allowed, 'TaskCreate should always be allowed');
});

test('always allows Read in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Read');
  assertTrue(result.allowed, 'Read should always be allowed');
});

test('always allows AskUserQuestion in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('AskUserQuestion');
  assertTrue(result.allowed, 'AskUserQuestion should always be allowed');
});

// ===========================================
// Enforcement Mode Tests
// ===========================================

console.log('\n=== Enforcement Mode Tests ===\n');

test('warn mode allows blacklisted tools with warning', () => {
  process.env.ROUTER_SELF_CHECK = 'warn';
  const result = validate('Glob');
  assertTrue(result.allowed, 'Should allow in warn mode');
  assertIncludes(result.message, 'WARNING', 'Should have warning message');
});

test('off mode allows blacklisted tools without warning', () => {
  process.env.ROUTER_SELF_CHECK = 'off';
  const result = validate('Glob');
  assertTrue(result.allowed, 'Should allow in off mode');
});

test('defaults to block mode when env not set', () => {
  delete process.env.ROUTER_SELF_CHECK;
  const result = validate('Glob');
  assertFalse(result.allowed, 'Should default to block mode');
});

// ===========================================
// Edge Cases
// ===========================================

console.log('\n=== Edge Cases ===\n');

test('allows unknown tools (not in either list)', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('SomeUnknownTool');
  assertTrue(result.allowed, 'Unknown tools should be allowed');
});

test('handles empty tool name gracefully', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('');
  assertTrue(result.allowed, 'Empty tool name should be allowed');
});

test('handles null tool name gracefully', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate(null);
  assertTrue(result.allowed, 'Null tool name should be allowed');
});

test('handles undefined tool name gracefully', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate(undefined);
  assertTrue(result.allowed, 'Undefined tool name should be allowed');
});

// ===========================================
// Message Format Tests
// ===========================================

console.log('\n=== Message Format Tests ===\n');

test('block message includes tool name', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Glob');
  assertIncludes(result.message, 'Glob', 'Message should include tool name');
});

test('block message includes Task example', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Glob');
  assertIncludes(result.message, 'Task(', 'Message should include Task example');
});

test('block message includes override instructions', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Glob');
  assertIncludes(result.message, 'ROUTER_SELF_CHECK=warn', 'Message should include override info');
});

// ===========================================
// Always-Allowed Write Paths Tests (FIX for reflection-agent bug)
// ===========================================

console.log('\n=== Always-Allowed Write Paths Tests (FIX for reflection-agent bug) ===\n');

test('isAlwaysAllowedWrite returns true for memory files', () => {
  assertTrue(isAlwaysAllowedWrite('/project/.claude/context/memory/learnings.md'));
  assertTrue(isAlwaysAllowedWrite('/project/.claude/context/memory/decisions.md'));
  assertTrue(isAlwaysAllowedWrite('/project/.claude/context/memory/issues.md'));
});

test('isAlwaysAllowedWrite returns true for runtime files', () => {
  assertTrue(isAlwaysAllowedWrite('/project/.claude/context/runtime/router-state.json'));
  assertTrue(isAlwaysAllowedWrite('/project/.claude/context/runtime/session.json'));
});

test('isAlwaysAllowedWrite returns true for .gitkeep files', () => {
  assertTrue(isAlwaysAllowedWrite('/project/some/dir/.gitkeep'));
});

test('isAlwaysAllowedWrite returns false for regular files', () => {
  assertFalse(isAlwaysAllowedWrite('/project/src/index.js'));
  assertFalse(isAlwaysAllowedWrite('/project/.claude/hooks/routing/routing-guard.cjs'));
});

test('isAlwaysAllowedWrite returns false for null/undefined', () => {
  assertFalse(isAlwaysAllowedWrite(null));
  assertFalse(isAlwaysAllowedWrite(undefined));
  assertFalse(isAlwaysAllowedWrite(''));
});

test('allows Write to memory files in router mode (FIX for reflection-agent bug)', () => {
  // This is the key fix: memory file writes should be allowed even in router mode
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Write', { file_path: '/project/.claude/context/memory/learnings.md' });
  assertTrue(result.allowed, 'Memory file writes should be allowed even in router mode');
});

test('allows Edit to memory files in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Edit', { file_path: '/project/.claude/context/memory/decisions.md' });
  assertTrue(result.allowed, 'Memory file edits should be allowed even in router mode');
});

test('allows Write to runtime files in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Write', {
    file_path: '/project/.claude/context/runtime/router-state.json',
  });
  assertTrue(result.allowed, 'Runtime file writes should be allowed even in router mode');
});

test('still blocks Write to non-memory files in router mode', () => {
  process.env.ROUTER_SELF_CHECK = 'block';
  const result = validate('Write', { file_path: '/project/src/index.js' });
  assertFalse(result.allowed, 'Non-memory file writes should be blocked in router mode');
});

test('WRITE_TOOLS contains Edit, Write, NotebookEdit', () => {
  assertTrue(WRITE_TOOLS.includes('Edit'), 'Edit should be in WRITE_TOOLS');
  assertTrue(WRITE_TOOLS.includes('Write'), 'Write should be in WRITE_TOOLS');
  assertTrue(WRITE_TOOLS.includes('NotebookEdit'), 'NotebookEdit should be in WRITE_TOOLS');
});

// ===========================================
// Summary
// ===========================================

console.log('\n===========================================');
console.log(`Tests completed: ${testsPassed + testsFailed}`);
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('===========================================\n');

// Clean up state
routerState.resetToRouterMode();

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);
