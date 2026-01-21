import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'read-size-guard.mjs');

async function runHook(input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk;
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk;
    });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      const trimmed = stdout.trim();
      try {
        resolve({ json: trimmed ? JSON.parse(trimmed) : null, stderr, code });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse hook JSON (exit=${code})\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n${error.message}`
          )
        );
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    setTimeout(() => proc.kill('SIGTERM'), 3000);
  });
}

describe('read-size-guard hook', () => {
  it('blocks Read for large files when no paging is provided', async () => {
    const bigPath = join(PROJECT_ROOT, '.tmp', 'read-size-guard-big.txt');
    await writeFile(bigPath, 'x'.repeat(4096));

    try {
      const res = await runHook(
        {
          tool_name: 'Read',
          tool_input: { path: bigPath },
          context: {},
        },
        { CLAUDE_READ_MAX_BYTES: '1024' }
      );
      assert.equal(res.json.decision, 'block');
      assert.match(String(res.json.reason || ''), /too large|offset|limit/i);
    } finally {
      await unlink(bigPath);
    }
  });

  it('approves Read for large files when paging is provided', async () => {
    const bigPath = join(PROJECT_ROOT, '.tmp', 'read-size-guard-big-paged.txt');
    await writeFile(bigPath, 'x'.repeat(4096));

    try {
      const res = await runHook(
        {
          tool_name: 'Read',
          tool_input: { path: bigPath, offset: 0, limit: 200 },
          context: {},
        },
        { CLAUDE_READ_MAX_BYTES: '1024' }
      );
      assert.equal(res.json.decision, 'approve');
    } finally {
      await unlink(bigPath);
    }
  });
});
