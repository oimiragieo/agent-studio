import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'read-path-guard.mjs');

async function runHook(input) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], { env: { ...process.env } });
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

describe('read-path-guard hook', () => {
  it('blocks Read when path is a directory', async () => {
    const res = await runHook({
      tool_name: 'Read',
      tool_input: { path: join(PROJECT_ROOT, '.claude') },
      context: {},
    });
    assert.equal(res.json.decision, 'block');
    assert.match(String(res.json.reason || ''), /EISDIR|directory/i);
  });

  it('blocks Read when path is a directory (relative path)', async () => {
    const res = await runHook({
      tool_name: 'Read',
      tool_input: { path: '.claude' },
      context: {},
    });
    assert.equal(res.json.decision, 'block');
    assert.match(String(res.json.reason || ''), /Resolved path:/i);
  });

  it('approves Read when path is a file', async () => {
    const res = await runHook({
      tool_name: 'Read',
      tool_input: { path: join(PROJECT_ROOT, 'package.json') },
      context: {},
    });
    assert.equal(res.json.decision, 'approve');
  });

  it('approves Read when path does not exist', async () => {
    const res = await runHook({
      tool_name: 'Read',
      tool_input: { path: join(PROJECT_ROOT, 'this-file-should-not-exist-xyz.txt') },
      context: {},
    });
    assert.equal(res.json.decision, 'approve');
  });
});
