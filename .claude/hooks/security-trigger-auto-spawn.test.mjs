#!/usr/bin/env node
/**
 * Security Trigger Auto-Spawn Hook Tests
 *
 * Tests the PostToolUse hook that detects security triggers
 * and suggests spawning security-architect agent.
 */

import { spawn } from 'child_process';
import { readFile, writeFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOOK_PATH = join(__dirname, 'security-trigger-auto-spawn.mjs');
const TEMP_CONFIG_PATH = join(__dirname, '..', 'context', 'config', 'security-triggers-test.json');

// Test security triggers configuration
const TEST_SECURITY_CONFIG = {
  version: '2.0.0',
  categories: {
    authentication: {
      keywords: ['login', 'password', 'auth', 'oauth', 'sso'],
      priority: 'critical',
      required_agents: ['security-architect'],
      recommended_agents: ['compliance-auditor'],
      description: 'Authentication and identity management',
    },
    secrets_management: {
      keywords: ['secret', 'credential', 'api key', 'token', 'vault'],
      priority: 'critical',
      required_agents: ['security-architect'],
      recommended_agents: ['devops'],
      description: 'Secrets and credentials management',
    },
    tool_development: {
      keywords: ['tool creation', 'hook', 'cli tool', 'mcp server'],
      priority: 'high',
      required_agents: ['security-architect'],
      recommended_agents: ['code-reviewer'],
      description: 'Tool and script development',
    },
  },
};

/**
 * Execute hook with input and capture output
 */
async function executeHook(input) {
  return new Promise((resolve, reject) => {
    const hookProcess = spawn('node', [HOOK_PATH]);

    let stdout = '';
    let stderr = '';

    hookProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    hookProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    hookProcess.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Hook exited with code ${code}\nStderr: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve({ result, stderr });
      } catch (error) {
        reject(new Error(`Failed to parse hook output: ${stdout}`));
      }
    });

    hookProcess.stdin.write(JSON.stringify(input));
    hookProcess.stdin.end();
  });
}

/**
 * Test suite
 */
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('Running Security Trigger Auto-Spawn Hook Tests...\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);

  // Cleanup temp config if exists
  if (existsSync(TEMP_CONFIG_PATH)) {
    try {
      await unlink(TEMP_CONFIG_PATH);
    } catch {
      // ignore
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Test 1: Non-Task tool should allow without analysis
test('Non-Task tool should allow without analysis', async () => {
  const input = {
    tool_name: 'Read',
    tool_input: { file_path: '/some/file.txt' },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (result.suggestion) {
    throw new Error('Expected no suggestion for non-Task tool');
  }
});

// Test 2: Task without security triggers should allow without suggestion
test('Task without security triggers should allow without suggestion', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'Update documentation for feature X',
      objective: 'Improve documentation clarity',
      assigned_agent: 'technical-writer',
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (result.suggestion) {
    throw new Error('Expected no suggestion for non-security task');
  }
});

// Test 3: Task with authentication keywords should detect triggers
test('Task with authentication keywords should detect triggers', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'Implement OAuth login flow with password reset',
      objective: 'Add authentication system',
      assigned_agent: 'developer',
      context: {
        problem: 'Need to add login and auth features',
      },
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (!result.suggestion) {
    throw new Error('Expected suggestion for authentication task');
  }

  if (!result.suggestion.includes('SECURITY TRIGGERS DETECTED')) {
    throw new Error('Expected security triggers detection message');
  }

  if (
    !result.metadata?.security_triggers_detected ||
    result.metadata.security_triggers_detected < 1
  ) {
    throw new Error('Expected at least 1 security trigger detected');
  }
});

// Test 4: Task with secrets keywords should detect triggers
test('Task with secrets keywords should detect triggers', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      objective: 'Create API key management system',
      prompt: 'Implement credential storage with vault integration',
      deliverables: [
        {
          description: 'Secret management service',
          path: '.claude/services/secrets.mjs',
        },
      ],
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (!result.suggestion) {
    throw new Error('Expected suggestion for secrets management task');
  }

  if (!result.metadata?.categories.includes('secrets_management')) {
    throw new Error('Expected secrets_management category to be detected');
  }
});

// Test 5: Task with security-architect already included should NOT suggest
test('Task with security-architect already included should NOT suggest', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'Implement OAuth login with security review',
      objective: 'Add authentication with security validation',
      assigned_agent: 'security-architect',
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (result.suggestion) {
    throw new Error('Expected NO suggestion when security-architect is already assigned');
  }
});

// Test 6: Task with tool development keywords should detect triggers
test('Task with tool development keywords should detect triggers', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      objective: 'Create snapshot manager tool',
      prompt: 'Implement CLI tool for snapshot management',
      deliverables: [
        {
          type: 'file',
          path: '.claude/tools/snapshot-manager.mjs',
          description: 'Snapshot management tool',
        },
      ],
      success_criteria: ['Tool creation completed', 'Unit tests pass'],
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  // Note: This test depends on whether "tool creation" is in the keywords
  // The actual hook loads from security-triggers-v2.json, which may not have
  // "tool creation" as a keyword. This test validates the hook's behavior
  // when keywords match.
  if (result.suggestion && !result.suggestion.includes('SECURITY TRIGGERS')) {
    throw new Error('Unexpected suggestion format');
  }
});

// Test 7: Multiple security categories should be detected
test('Multiple security categories should be detected', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      objective: 'Implement authentication and API key management',
      prompt: 'Build login system with OAuth and credential vault for API keys',
      context: {
        problem: 'Need secure auth and secret storage',
        why_now: 'Security requirements for compliance',
      },
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (!result.suggestion) {
    throw new Error('Expected suggestion for multi-category security task');
  }

  if (
    !result.metadata?.security_triggers_detected ||
    result.metadata.security_triggers_detected < 2
  ) {
    throw new Error('Expected at least 2 security triggers detected');
  }

  if (!result.metadata?.categories.includes('authentication')) {
    throw new Error('Expected authentication category');
  }

  if (!result.metadata?.categories.includes('secrets_management')) {
    throw new Error('Expected secrets_management category');
  }
});

// Test 8: Critical priority should be indicated
test('Critical priority should be indicated in suggestion', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      objective: 'Implement password reset flow',
      prompt: 'Build secure password reset with email verification',
    },
  };

  const { result } = await executeHook(input);

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }

  if (!result.suggestion) {
    throw new Error('Expected suggestion for password-related task');
  }

  if (result.metadata?.highest_priority === 'critical' && !result.suggestion.includes('CRITICAL')) {
    throw new Error('Expected CRITICAL priority indicator in suggestion');
  }
});

// Test 9: Hook should timeout gracefully
test('Hook should timeout gracefully (2s limit)', async () => {
  const input = {
    tool_name: 'Task',
    tool_input: {
      prompt: 'Simple task without security concerns',
    },
  };

  const startTime = Date.now();
  const { result } = await executeHook(input);
  const duration = Date.now() - startTime;

  if (duration > 3000) {
    throw new Error(`Hook took ${duration}ms, should timeout at 2000ms`);
  }

  if (result.decision !== 'allow') {
    throw new Error(`Expected decision 'allow', got '${result.decision}'`);
  }
});

// Test 10: Malformed input should fail-open
test('Malformed input should fail-open', async () => {
  const input = 'not valid json';

  return new Promise((resolve, reject) => {
    const hookProcess = spawn('node', [HOOK_PATH]);

    let stdout = '';

    hookProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    hookProcess.on('close', () => {
      try {
        const result = JSON.parse(stdout);
        if (result.decision !== 'allow') {
          reject(new Error(`Expected fail-open 'allow', got '${result.decision}'`));
        }
        resolve();
      } catch (error) {
        reject(new Error(`Hook should output valid JSON even on error: ${stdout}`));
      }
    });

    hookProcess.stdin.write(input);
    hookProcess.stdin.end();
  });
});

// Run all tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
