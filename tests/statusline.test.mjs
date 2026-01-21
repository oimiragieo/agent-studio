import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const STATUSLINE = join(PROJECT_ROOT, '.claude', 'hooks', 'statusline.mjs');

function runStatusline(input, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [STATUSLINE], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
    setTimeout(() => proc.kill('SIGTERM'), 3000);
  });
}

describe('statusline hook', () => {
  it('renders without crashing and includes dir + status when last-run exists', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    await mkdir(join(runtimeDir, 'jobs'), { recursive: true });
    await writeFile(
      join(runtimeDir, 'last-run.json'),
      JSON.stringify(
        {
          run_id: 'run-123',
          status: 'running',
          current_agent: 'router',
          current_activity: 'spawn router: Classify request',
        },
        null,
        2
      ),
      'utf8'
    );

    const res = await runStatusline(
      {
        model: { display_name: 'Sonnet' },
        workspace: { current_dir: PROJECT_ROOT },
        context_window: { remaining_percentage: 42 },
      },
      { CLAUDE_RUNTIME_DIR: runtimeDir }
    );

    assert.equal(res.code, 0);
    assert.match(res.stdout, /Sonnet/);
    assert.match(res.stdout, new RegExp(PROJECT_ROOT.split(/[\\\\/]/).pop(), 'i'));
    assert.match(res.stdout, /running/i);
  });
});
