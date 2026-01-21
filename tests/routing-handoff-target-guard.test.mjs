import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'routing-handoff-target-guard.mjs');
const TMP_DIR = join(PROJECT_ROOT, '.claude', 'context', 'tmp');
const ROUTING_DIR = join(TMP_DIR, 'routing-sessions');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

async function runHook(payload) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      env: { ...process.env, CLAUDE_HOOK_TMP_DIR: TMP_DIR },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
    proc.stdin.end(JSON.stringify(payload));
    setTimeout(() => proc.kill('SIGTERM'), 2000);
  });
}

describe('routing-handoff-target-guard hook', () => {
  it('blocks spawning the wrong coordinator after routing', async () => {
    const sessionKey = 'test-session-handoff-guard';
    const statePath = join(ROUTING_DIR, `${safeFileId(sessionKey)}.json`);
    await mkdir(ROUTING_DIR, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({ routing: { completed: true, handoff_target: 'orchestrator' } }, null, 2),
      'utf8'
    );

    const res = await runHook({
      tool_name: 'Task',
      tool_input: { subagent_type: 'master-orchestrator', prompt: 'do the run' },
      session_key: sessionKey,
    });

    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.decision, 'block');
    assert.match(parsed.reason, /ROUTING HANDOFF TARGET MISMATCH/i);

    await rm(statePath, { force: true });
  });

  it('allows spawning the required coordinator after routing', async () => {
    const sessionKey = 'test-session-handoff-guard-2';
    const statePath = join(ROUTING_DIR, `${safeFileId(sessionKey)}.json`);
    await mkdir(ROUTING_DIR, { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({ routing: { completed: true, handoff_target: 'orchestrator' } }, null, 2),
      'utf8'
    );

    const res = await runHook({
      tool_name: 'Task',
      tool_input: { subagent_type: 'orchestrator', prompt: 'do the run' },
      session_key: sessionKey,
    });

    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.decision, 'approve');

    await rm(statePath, { force: true });
  });
});
