// Tests for validate-skill-invocation hook
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.join(
  __dirname,
  '..',
  '.claude',
  'hooks',
  'safety',
  'validate-skill-invocation.cjs'
);

/**
 * Helper to run the hook with stdin input
 * @param {object|null} input - JSON input to send via stdin
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
async function runHook(input) {
  return new Promise(resolve => {
    const proc = spawn('node', [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk;
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk;
    });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    if (input !== null) {
      proc.stdin.write(JSON.stringify(input));
    }
    proc.stdin.end();
  });
}

describe('validate-skill-invocation hook', () => {
  test('exits 0 when no input provided', async () => {
    const result = await runHook(null);
    assert.strictEqual(result.code, 0, 'Should exit 0 (allow) when no input');
  });

  test('exits 0 for non-Read tool calls', async () => {
    const result = await runHook({
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    assert.strictEqual(result.code, 0, 'Should exit 0 for non-Read tools');
  });

  test('exits 0 for Read calls to non-skill files', async () => {
    const result = await runHook({
      tool_name: 'Read',
      tool_input: { file_path: '/some/path/to/file.js' },
    });
    assert.strictEqual(result.code, 0, 'Should exit 0 for regular file reads');
  });

  test('exits 0 with warning for Read calls to SKILL.md files', async () => {
    const result = await runHook({
      tool_name: 'Read',
      tool_input: { file_path: '.claude/skills/tdd/SKILL.md' },
    });

    // Should exit 0 (warning, not block)
    assert.strictEqual(result.code, 0, 'Should exit 0 (warn, not block) for skill file reads');

    // Should output a JSON warning message
    const output = result.stdout.trim();
    assert.ok(output.length > 0, 'Should output a warning message');

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.result, 'warn', 'Result should be "warn"');
    assert.ok(parsed.message.includes('tdd'), 'Warning should mention the skill name');
    assert.ok(parsed.message.includes('Skill('), 'Warning should suggest using Skill() tool');
  });

  test('extracts skill name correctly from Windows-style paths', async () => {
    const result = await runHook({
      tool_name: 'Read',
      tool_input: { file_path: 'C:\\projects\\.claude\\skills\\debugging\\SKILL.md' },
    });

    assert.strictEqual(result.code, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.ok(
      parsed.message.includes('debugging'),
      'Should extract debugging skill name from Windows path'
    );
  });

  test('extracts skill name correctly from Unix-style paths', async () => {
    const result = await runHook({
      tool_name: 'Read',
      tool_input: { file_path: '/home/user/.claude/skills/security-architect/SKILL.md' },
    });

    assert.strictEqual(result.code, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.ok(
      parsed.message.includes('security-architect'),
      'Should extract skill name from Unix path'
    );
  });
});

describe('validate-skill-invocation exports', () => {
  test('exports validate function for programmatic use', async () => {
    // Dynamic import to test exports
    const mod = await import(`file://${HOOK_PATH}`);

    assert.ok(typeof mod.validate === 'function', 'Should export validate function');
    assert.ok(typeof mod.isSkillFile === 'function', 'Should export isSkillFile helper');
    assert.ok(typeof mod.extractSkillName === 'function', 'Should export extractSkillName helper');
  });

  test('validate function works programmatically', async () => {
    const mod = await import(`file://${HOOK_PATH}`);

    // Non-skill file
    const result1 = mod.validate({
      tool: 'Read',
      parameters: { file_path: '/some/file.js' },
    });
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result1.warning, undefined);

    // Skill file
    const result2 = mod.validate({
      tool: 'Read',
      parameters: { file_path: '.claude/skills/tdd/SKILL.md' },
    });
    assert.strictEqual(result2.valid, true);
    assert.ok(result2.warning, 'Should have warning for skill file');
    assert.ok(result2.warning.includes('Skill('), 'Warning should suggest Skill() tool');
  });
});
