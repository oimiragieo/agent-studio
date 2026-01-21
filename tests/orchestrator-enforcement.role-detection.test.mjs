import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'orchestrator-enforcement-pre-tool.mjs');

const SESSION_STATE_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'tmp',
  'orchestrator-session-state.json'
);
const SESSION_DELTA_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'tmp',
  'orchestrator-session-state.delta.jsonl'
);
const SESSION_LOCK_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'tmp',
  'orchestrator-session-state.lock'
);

async function runHook(payload) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH], {
      env: {
        ...process.env,
        // Ensure recursion guard isn't accidentally set in test env.
        CLAUDE_ORCHESTRATOR_HOOK_EXECUTING: '',
        CLAUDE_AGENT_ROLE: '',
        CLAUDE_AGENT_NAME: '',
      },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', err => reject(err));
    proc.on('close', code => resolve({ code, stdout, stderr }));

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

async function cleanupState() {
  await rm(SESSION_STATE_PATH, { force: true });
  await rm(SESSION_DELTA_PATH, { force: true });
  await rm(SESSION_LOCK_PATH, { force: true });
}

describe('orchestrator-enforcement-pre-tool role detection', () => {
  beforeEach(async () => {
    await cleanupState();
  });

  afterEach(async () => {
    await cleanupState();
  });

  it('treats context.agent_name=orchestrator as orchestrator role and blocks Write', async () => {
    const res = await runHook({
      tool_name: 'Write',
      tool_input: {
        file_path: 'C:/dev/projects/LLM-RULES/.claude/context/tmp/test-write.txt',
        content: 'test',
      },
      context: { agent_name: 'orchestrator' },
    });

    assert.equal(res.code, 0);
    const out = JSON.parse(res.stdout);
    assert.equal(out.decision, 'block');
    assert.match(String(out.reason || ''), /ORCHESTRATOR VIOLATION/i);
  });
});
