import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const TOOL = join(PROJECT_ROOT, '.claude', 'tools', 'run-guard-denial-headless.mjs');

async function run(cmd, args, env = {}) {
  return await new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', c => (stdout += c));
    p.stderr.on('data', c => (stderr += c));
    p.on('error', reject);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('run-guard-denial-headless tool', () => {
  it('returns denied=true when read-path-guard blocks reading a directory', async () => {
    const workflowId = 'agent-integration-v1-20990101-000001';
    const res = await run('node', [TOOL, '--workflow-id', workflowId, '--timeout-ms', '5000']);

    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const out = JSON.parse(res.stdout);
    assert.equal(out.workflow_id, workflowId);
    assert.equal(out.denied, true);
    assert.equal(out.denied_by, 'read-path-guard');
    assert.equal(out.ok, true);
  });
});
