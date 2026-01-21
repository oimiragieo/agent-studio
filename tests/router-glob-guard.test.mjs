import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'router-glob-guard.mjs');
const SESSION_KEY = 'test-session';
let HOOK_TMP_DIR = '';

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function statePath() {
  return join(HOOK_TMP_DIR, 'routing-sessions', `${safeFileId(SESSION_KEY)}.json`);
}

async function runHook(input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
        ...env,
      },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      const trimmed = stdout.trim();
      try {
        resolve({ json: trimmed ? JSON.parse(trimmed) : null, code, stderr });
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
    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

beforeEach(async () => {
  HOOK_TMP_DIR = mkdtempSync(join(tmpdir(), 'llm-rules-hooktmp-'));
  await rm(statePath(), { force: true });
});

describe('router-glob-guard', () => {
  it('blocks non-.claude Glob when routing not completed', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });
    await writeFile(
      statePath(),
      JSON.stringify(
        { routing: { completed: false, started_at: new Date().toISOString() } },
        null,
        2
      ),
      'utf-8'
    );

    const res = await runHook({
      tool_name: 'Glob',
      tool_input: { glob: '**/*' },
      context: { agent_name: 'router' },
    });
    assert.equal(res.json.decision, 'block');
  });

  it('allows .claude-scoped Glob when routing not completed', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });
    await writeFile(
      statePath(),
      JSON.stringify(
        { routing: { completed: false, started_at: new Date().toISOString() } },
        null,
        2
      ),
      'utf-8'
    );

    const res = await runHook({
      tool_name: 'Glob',
      tool_input: { glob: '.claude/workflows/*.yaml' },
      context: { agent_name: 'router' },
    });
    assert.equal(res.json.decision, 'approve');
  });

  it('allows Glob once routing is completed', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });
    await writeFile(
      statePath(),
      JSON.stringify(
        { routing: { completed: true, completed_at: new Date().toISOString() } },
        null,
        2
      ),
      'utf-8'
    );

    const res = await runHook({
      tool_name: 'Glob',
      tool_input: { glob: '**/*' },
      context: { agent_name: 'router' },
    });
    assert.equal(res.json.decision, 'approve');
  });
});
