#!/usr/bin/env node
/**
 * Unit tests for validate-config.mjs MCP validation
 * Tests the .mcp.json parsing logic to ensure correct structure validation
 */

import { strict as assert } from 'assert';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const testRunner = {
  tests: [],
  passed: 0,
  failed: 0,

  test(name, fn) {
    this.tests.push({ name, fn });
  },

  async run() {
    console.log('\n🧪 Running MCP Validation Tests\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);
    process.exit(this.failed > 0 ? 1 : 0);
  },
};

// Helper to create a temporary test directory with required structure
function createTestDir() {
  const tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));

  // Create required directories using Node.js API (Windows-compatible)
  const dirs = ['.claude/agents', '.claude/skills', '.claude/workflows', '.claude/schemas'];
  dirs.forEach(dir => {
    mkdirSync(join(tempDir, dir), { recursive: true });
  });

  // Create minimal required files to pass other validations
  writeFileSync(
    join(tempDir, '.claude/config.yaml'),
    `
agents:
  - name: test
paths:
  agents: .claude/agents
  skills: .claude/skills
  workflows: .claude/workflows
  schemas: .claude/schemas
`.trim()
  );

  return tempDir;
}

// Helper to run validation
function runValidation(dir) {
  // Get the absolute path to the validation script in the project root
  const scriptPath = join(process.cwd(), 'scripts', 'validate-config.mjs');

  try {
    const output = execSync(`node "${scriptPath}" --root "${dir}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.stdout + error.stderr };
  }
}

// Test 1: Valid Claude Code MCP structure
testRunner.test('Valid Claude Code MCP structure with nested mcpServers', () => {
  const dir = createTestDir();

  const mcpConfig = {
    betaFeatures: ['advanced-tool-use-2025-11-20'],
    toolSearch: {
      enabled: true,
      autoEnableThreshold: 20,
      defaultDeferLoading: true,
    },
    mcpServers: {
      repo: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-repo'],
        env: { REPO_PATH: '${workspaceFolder}' },
        description: 'Repository search',
        deferLoading: true,
      },
    },
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Should validate successfully');
  assert.ok(
    !result.output.includes('Server betaFeatures'),
    'Should not treat betaFeatures as server'
  );
  assert.ok(!result.output.includes('Server toolSearch'), 'Should not treat toolSearch as server');
});

// Test 2: betaFeatures not treated as server
testRunner.test('betaFeatures should not be treated as MCP server', () => {
  const dir = createTestDir();

  const mcpConfig = {
    betaFeatures: ['advanced-tool-use-2025-11-20'],
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(
    !result.output.includes('Server betaFeatures'),
    'betaFeatures should be ignored as server'
  );
  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Should validate successfully');
});

// Test 3: toolSearch not treated as server
testRunner.test('toolSearch should not be treated as MCP server', () => {
  const dir = createTestDir();

  const mcpConfig = {
    toolSearch: {
      enabled: true,
      autoEnableThreshold: 20,
    },
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.output.includes('Server toolSearch'), 'toolSearch should be ignored as server');
  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Should validate successfully');
});

// Test 4: Invalid betaFeatures type
testRunner.test('betaFeatures must be an array', () => {
  const dir = createTestDir();

  const mcpConfig = {
    betaFeatures: 'invalid-string',
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.success, 'Validation should fail');
  assert.ok(
    result.output.includes('betaFeatures must be an array'),
    'Should error on invalid betaFeatures type'
  );
});

// Test 5: Invalid toolSearch type
testRunner.test('toolSearch must be an object', () => {
  const dir = createTestDir();

  const mcpConfig = {
    toolSearch: 'invalid-string',
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.success, 'Validation should fail');
  assert.ok(
    result.output.includes('toolSearch must be an object'),
    'Should error on invalid toolSearch type'
  );
});

// Test 6: Invalid toolSearch.enabled type
testRunner.test('toolSearch.enabled must be boolean', () => {
  const dir = createTestDir();

  const mcpConfig = {
    toolSearch: {
      enabled: 'yes',
    },
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.success, 'Validation should fail');
  assert.ok(
    result.output.includes('toolSearch.enabled must be a boolean'),
    'Should error on invalid enabled type'
  );
});

// Test 7: Invalid toolSearch.autoEnableThreshold type
testRunner.test('toolSearch.autoEnableThreshold must be number', () => {
  const dir = createTestDir();

  const mcpConfig = {
    toolSearch: {
      autoEnableThreshold: '20',
    },
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.success, 'Validation should fail');
  assert.ok(
    result.output.includes('toolSearch.autoEnableThreshold must be a number'),
    'Should error on invalid autoEnableThreshold type'
  );
});

// Test 8: Unknown top-level keys should warn
testRunner.test('Unknown top-level keys should produce warning', () => {
  const dir = createTestDir();

  const mcpConfig = {
    unknownKey: 'value',
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  // Warnings don't cause validation failure, but should be in output
  assert.ok(
    result.output.includes('Unknown top-level keys: unknownKey'),
    'Should warn about unknown keys'
  );
});

// Test 9: Valid stdio server
testRunner.test('Valid stdio server configuration', () => {
  const dir = createTestDir();

  const mcpConfig = {
    mcpServers: {
      repo: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-repo'],
      },
    },
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Should validate stdio server');
});

// Test 10: Missing command for stdio server
testRunner.test('stdio server missing command should warn', () => {
  const dir = createTestDir();

  const mcpConfig = {
    mcpServers: {
      repo: {
        args: ['-y', '@modelcontextprotocol/server-repo'],
      },
    },
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  // Warnings don't cause validation failure, but should be in output
  assert.ok(
    result.output.includes('missing required field: command'),
    'Should warn about missing command'
  );
});

// Test 11: Invalid mcpServers type
testRunner.test('mcpServers must be an object', () => {
  const dir = createTestDir();

  const mcpConfig = {
    mcpServers: 'invalid-string',
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(!result.success, 'Validation should fail');
  assert.ok(
    result.output.includes('mcpServers must be an object'),
    'Should error on invalid mcpServers type'
  );
});

// Test 12: Empty mcpServers is valid
testRunner.test('Empty mcpServers object is valid', () => {
  const dir = createTestDir();

  const mcpConfig = {
    mcpServers: {},
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Empty mcpServers should be valid');
});

// Test 13: Complete real-world example
testRunner.test('Complete real-world MCP config validates correctly', () => {
  const dir = createTestDir();

  const mcpConfig = {
    betaFeatures: ['advanced-tool-use-2025-11-20'],
    toolSearch: {
      enabled: true,
      autoEnableThreshold: 20,
      defaultDeferLoading: true,
    },
    mcpServers: {
      repo: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-repo'],
        env: { REPO_PATH: '${workspaceFolder}' },
        description: 'Repository search',
        deferLoading: true,
        alwaysLoadTools: ['search_code', 'read_file'],
      },
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
        optional: true,
        deferLoading: true,
      },
      'chrome-devtools': {
        command: 'npx',
        args: ['-y', 'chrome-devtools-mcp@latest'],
        description: 'Chrome DevTools Protocol',
        deferLoading: true,
        alwaysLoadTools: ['take_screenshot', 'navigate_page'],
      },
    },
  };

  writeFileSync(join(dir, '.claude/.mcp.json'), JSON.stringify(mcpConfig, null, 2));

  const result = runValidation(dir);
  rmSync(dir, { recursive: true, force: true });

  assert.ok(result.output.includes('✓ .mcp.json validated'), 'Complete config should validate');
  assert.ok(
    !result.output.includes('Server betaFeatures'),
    'Should not treat betaFeatures as server'
  );
  assert.ok(!result.output.includes('Server toolSearch'), 'Should not treat toolSearch as server');
});

// Run all tests
testRunner.run();
