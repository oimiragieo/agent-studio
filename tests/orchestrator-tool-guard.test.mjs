import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const GUARD_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'orchestrator-tool-guard.mjs');

async function runHook(input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [GUARD_PATH], { env: { ...process.env, ...env } });
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
    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

describe('orchestrator-tool-guard', () => {
  it('blocks Grep for orchestrator agents', async () => {
    const res = await runHook({
      tool_name: 'Grep',
      tool_input: { pattern: 'x' },
      context: { agent_name: 'master-orchestrator' },
    });

    assert.equal(res.json.decision, 'block');
    assert.equal(typeof res.json.reason, 'string');
    assert.equal(res.json.reason.includes('Blocked tool'), true);
  });

  it('approves Grep for non-orchestrator agents', async () => {
    const res = await runHook({
      tool_name: 'Grep',
      tool_input: { pattern: 'x' },
      context: { agent_name: 'developer' },
    });

    assert.equal(res.json.decision, 'approve');
  });
});
