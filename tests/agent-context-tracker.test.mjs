// Tests for agent-context-tracker.cjs
// Verifies detection of PLANNER and SECURITY-ARCHITECT spawns
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRACKER_PATH = path.join(
  PROJECT_ROOT,
  '.claude',
  'hooks',
  'routing',
  'agent-context-tracker.cjs'
);
const ROUTER_STATE_PATH = path.join(
  PROJECT_ROOT,
  '.claude',
  'hooks',
  'routing',
  'router-state.cjs'
);
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', 'context', 'runtime', 'router-state.json');

// Helper to run the tracker with specific input
function runTracker(hookInput) {
  const inputJson = JSON.stringify(hookInput);
  // Use escaped double quotes for Windows/cross-platform compatibility
  const escapedJson = inputJson.replace(/"/g, '\\"');
  try {
    execSync(`node "${TRACKER_PATH}" "${escapedJson}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (e) {
    // Exit code 0 is expected (hook always allows)
    if (e.status === 0) return true;
    throw e;
  }
}

// Helper to get current state
function getState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return null;
}

// Helper to reset state
function resetState() {
  const routerState = require(ROUTER_STATE_PATH);
  routerState.resetToRouterMode();
}

describe('agent-context-tracker PLANNER detection', () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    resetState();
  });

  test('detects PLANNER spawn via subagent_type containing "plan"', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'planner-agent',
        description: 'Some task',
        prompt: 'Do something',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.plannerSpawned, true, 'plannerSpawned should be true');
  });

  test('detects PLANNER spawn via description containing "planner" (case-insensitive)', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Planner designing auth feature',
        prompt: 'Design the feature',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.plannerSpawned, true, 'plannerSpawned should be true');
  });

  test('detects PLANNER spawn via prompt containing "You are PLANNER"', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Some task',
        prompt: 'You are PLANNER. Read .claude/agents/core/planner.md...',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.plannerSpawned, true, 'plannerSpawned should be true');
  });

  test('detects PLANNER spawn via prompt containing "You are the PLANNER"', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Some task',
        prompt: 'You are the PLANNER agent. Design the system...',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.plannerSpawned, true, 'plannerSpawned should be true');
  });

  test('does NOT mark plannerSpawned for non-planner tasks', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Developer fixing login bug',
        prompt: 'You are DEVELOPER. Fix the bug...',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.plannerSpawned, false, 'plannerSpawned should remain false');
  });
});

describe('agent-context-tracker SECURITY detection', () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    resetState();
  });

  test('detects SECURITY spawn via subagent_type containing "security"', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'security-review',
        description: 'Review auth',
        prompt: 'Review the code',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.securitySpawned, true, 'securitySpawned should be true');
  });

  test('detects SECURITY spawn via description containing "security" (case-insensitive)', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Security reviewing payment design',
        prompt: 'Review the design',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.securitySpawned, true, 'securitySpawned should be true');
  });

  test('detects SECURITY spawn via prompt containing "SECURITY-ARCHITECT"', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Some task',
        prompt:
          'You are SECURITY-ARCHITECT. Read .claude/agents/specialized/security-architect.md...',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.securitySpawned, true, 'securitySpawned should be true');
  });

  test('does NOT mark securitySpawned for non-security tasks', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Developer fixing login bug',
        prompt: 'You are DEVELOPER. Fix the bug...',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.securitySpawned, false, 'securitySpawned should remain false');
  });
});

describe('agent-context-tracker existing behavior preserved', () => {
  beforeEach(() => {
    resetState();
  });

  afterEach(() => {
    resetState();
  });

  test('enters agent mode when Task tool is used', () => {
    const hookInput = {
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Developer task',
        prompt: 'Do work',
      },
    };

    runTracker(hookInput);
    const state = getState();

    assert.strictEqual(state.mode, 'agent', 'mode should be "agent"');
    assert.strictEqual(state.taskSpawned, true, 'taskSpawned should be true');
  });

  test('ignores non-Task tools', () => {
    const hookInput = {
      tool_name: 'Read',
      tool_input: {
        file_path: '/some/file.txt',
      },
    };

    // This should exit without changing state
    runTracker(hookInput);
    const state = getState();

    // State should remain in router mode (the reset state)
    assert.strictEqual(state.mode, 'router', 'mode should remain "router"');
  });
});
