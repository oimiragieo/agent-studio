import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const HOOKS_DIR = join(PROJECT_ROOT, '.claude', 'hooks');

function runHook({ hookFile, args = [], input = {}, env = {}, timeoutMs = 8000 }) {
  return new Promise(resolve => {
    const proc = spawn(process.execPath, [join(HOOKS_DIR, hookFile), ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const kill = setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
    }, timeoutMs);

    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('close', code => {
      clearTimeout(kill);
      let parsed = null;
      try {
        parsed = stdout.trim() ? JSON.parse(stdout.trim()) : null;
      } catch {
        parsed = null;
      }
      resolve({ code, stdout: parsed, rawStdout: stdout, stderr });
    });
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

test('headless-task-guard allows initial handoff to handoff_target', async () => {
  const tmpRoot = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'test-headless-task-guard-allow');
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, 'routing-sessions'), { recursive: true });

  const sessionKey = 'shared-test-headless-session';
  const statePath = join(tmpRoot, 'routing-sessions', `${safeFileId(sessionKey)}.json`);

  await writeFile(
    statePath,
    JSON.stringify(
      {
        session_key: sessionKey,
        routing: {
          completed: true,
          decision: { selected_workflow: '@.claude/workflows/ship-readiness-headless.yaml' },
          handoff_target: 'job-runner',
          handoff_completed: false,
        },
      },
      null,
      2
    ),
    'utf8'
  );

  const res = await runHook({
    hookFile: 'headless-task-guard.mjs',
    input: {
      session_key: sessionKey,
      tool_name: 'Task',
      tool_input: { subagent_type: 'job-runner' },
    },
    env: { CLAUDE_HOOK_TMP_DIR: tmpRoot },
  });

  assert.equal(res.code, 0);
  assert.equal(res.stdout?.decision, 'approve');
});

test('headless-task-guard denies spawning other agents after headless handoff is completed', async () => {
  const tmpRoot = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'test-headless-task-guard-deny');
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, 'routing-sessions'), { recursive: true });

  const sessionKey = 'shared-test-headless-session-2';
  const statePath = join(tmpRoot, 'routing-sessions', `${safeFileId(sessionKey)}.json`);

  await writeFile(
    statePath,
    JSON.stringify(
      {
        session_key: sessionKey,
        routing: {
          completed: true,
          decision: { selected_workflow: '@.claude/workflows/ship-readiness-headless.yaml' },
          handoff_target: 'job-runner',
          handoff_completed: true,
          handoff_actual: 'job-runner',
        },
      },
      null,
      2
    ),
    'utf8'
  );

  const res = await runHook({
    hookFile: 'headless-task-guard.mjs',
    input: { session_key: sessionKey, tool_name: 'Task', tool_input: { subagent_type: 'qa' } },
    env: { CLAUDE_HOOK_TMP_DIR: tmpRoot },
  });

  assert.equal(res.code, 0);
  assert.equal(res.stdout?.decision, 'deny');
  assert.match(String(res.stdout?.reason || ''), /headless workflow/i);
});

test('headless-task-guard treats Task(<display name>) as Task', async () => {
  const tmpRoot = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'tmp',
    'test-headless-task-guard-display'
  );
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, 'routing-sessions'), { recursive: true });

  const sessionKey = 'shared-test-headless-session-3';
  const statePath = join(tmpRoot, 'routing-sessions', `${safeFileId(sessionKey)}.json`);

  await writeFile(
    statePath,
    JSON.stringify(
      {
        session_key: sessionKey,
        routing: {
          completed: true,
          decision: { selected_workflow: '@.claude/workflows/ship-readiness-headless.yaml' },
          handoff_target: 'job-runner',
          handoff_completed: true,
        },
      },
      null,
      2
    ),
    'utf8'
  );

  const res = await runHook({
    hookFile: 'headless-task-guard.mjs',
    input: {
      session_key: sessionKey,
      tool_name: 'Task(Spawn)',
      tool_input: { subagent_type: 'qa' },
    },
    env: { CLAUDE_HOOK_TMP_DIR: tmpRoot },
  });

  assert.equal(res.code, 0);
  assert.equal(res.stdout?.decision, 'deny');
});
