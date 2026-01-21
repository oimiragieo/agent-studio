import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

test('task-concurrency-guard denies Task when active subagents >= limit', async () => {
  const tmpRoot = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'test-task-concurrency');
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(join(tmpRoot, 'active-subagents'), { recursive: true });

  const sessionKey = 'test-session-concurrency';
  await writeFile(
    join(tmpRoot, 'active-subagents', `${sessionKey}.json`),
    JSON.stringify(
      { active: 1, pending: 0, agents: ['qa'], updated_at: new Date().toISOString() },
      null,
      2
    ),
    'utf8'
  );

  const res = await runHook({
    hookFile: 'task-concurrency-guard.mjs',
    input: { session_key: sessionKey, tool_name: 'Task', tool_input: { subagent_type: 'qa' } },
    env: {
      CLAUDE_AGENT_NAME: 'orchestrator',
      CLAUDE_HOOK_TMP_DIR: tmpRoot,
      CLAUDE_MAX_ACTIVE_SUBAGENTS: '1',
    },
  });

  assert.equal(res.code, 0);
  assert.equal(res.stdout?.decision, 'deny');
  assert.match(String(res.stdout?.reason || ''), /concurrency limit/i);
});

test('subagent-activity-tracker increments and decrements active subagent count', async () => {
  const tmpRoot = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'test-subagent-activity');
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });

  const sessionKey = 'test-session-activity';
  const statePath = join(tmpRoot, 'active-subagents', `${sessionKey}.json`);

  const start = await runHook({
    hookFile: 'subagent-activity-tracker.mjs',
    args: ['start'],
    input: { session_key: sessionKey, delegated_agent: 'qa' },
    env: { CLAUDE_HOOK_TMP_DIR: tmpRoot },
  });
  assert.equal(start.code, 0);
  assert.equal(start.stdout?.decision, 'approve');

  const afterStart = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(afterStart.active, 1);
  assert.equal(afterStart.pending, 0);
  assert.ok(Array.isArray(afterStart.agents));
  assert.equal(afterStart.agents[0], 'qa');

  const stop = await runHook({
    hookFile: 'subagent-activity-tracker.mjs',
    args: ['stop'],
    input: { session_key: sessionKey, delegated_agent: 'qa' },
    env: { CLAUDE_HOOK_TMP_DIR: tmpRoot },
  });
  assert.equal(stop.code, 0);
  assert.equal(stop.stdout?.decision, 'approve');

  const afterStop = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(afterStop.active, 0);
});
