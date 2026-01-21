import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'read-only-enforcer.mjs');

async function runHook(input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
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

describe('read-only-enforcer hook', () => {
  it('allows Write/Edit when read-only is disabled', async () => {
    const tmpProject = await mkdtemp(join(os.tmpdir(), 'llm-rules-ro-'));
    await mkdir(join(tmpProject, '.claude', 'context', 'tmp'), { recursive: true });
    await writeFile(
      join(tmpProject, '.claude', 'context', 'tmp', 'read-only.json'),
      JSON.stringify({ enabled: false })
    );

    const res = await runHook(
      { tool_name: 'Write', tool_input: { file_path: 'x.txt', content: 'hi' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(res.json.decision, 'approve');
    await rm(tmpProject, { recursive: true, force: true });
  });

  it('blocks Write/Edit when read-only is enabled', async () => {
    const tmpProject = await mkdtemp(join(os.tmpdir(), 'llm-rules-ro-'));
    await mkdir(join(tmpProject, '.claude', 'context', 'tmp'), { recursive: true });
    await writeFile(
      join(tmpProject, '.claude', 'context', 'tmp', 'read-only.json'),
      JSON.stringify({ enabled: true })
    );

    const writeRes = await runHook(
      { tool_name: 'Write', tool_input: { file_path: 'x.txt', content: 'hi' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(writeRes.json.decision, 'block');

    const editRes = await runHook(
      { tool_name: 'Edit', tool_input: { file_path: 'x.txt', old_string: 'a', new_string: 'b' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(editRes.json.decision, 'block');

    await rm(tmpProject, { recursive: true, force: true });
  });

  it('blocks mutating Bash in read-only mode but allows safe Bash', async () => {
    const tmpProject = await mkdtemp(join(os.tmpdir(), 'llm-rules-ro-'));
    await mkdir(join(tmpProject, '.claude', 'context', 'tmp'), { recursive: true });
    await writeFile(
      join(tmpProject, '.claude', 'context', 'tmp', 'read-only.json'),
      JSON.stringify({ enabled: true })
    );

    const mut = await runHook(
      { tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(mut.json.decision, 'block');

    const safe = await runHook(
      { tool_name: 'Bash', tool_input: { command: 'git status' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(safe.json.decision, 'approve');

    const safe2 = await runHook(
      { tool_name: 'Bash', tool_input: { command: 'git diff --name-only' } },
      { CLAUDE_PROJECT_DIR: tmpProject }
    );
    assert.equal(safe2.json.decision, 'approve');

    await rm(tmpProject, { recursive: true, force: true });
  });
});
