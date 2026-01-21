import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const DASHBOARD_PATH = join(PROJECT_ROOT, '.claude', 'tools', 'workflow-dashboard.mjs');
const BASE_RUNTIME_DIR = join(PROJECT_ROOT, '.claude', 'context', 'runtime');
const ACTIVE_PROJECT_PATH = join(BASE_RUNTIME_DIR, 'active-project.json');

async function runDashboard(args) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [DASHBOARD_PATH, ...args], { env: process.env });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', err => reject(err));
    proc.on('close', code => resolve({ code, stdout, stderr }));
    setTimeout(() => proc.kill('SIGTERM'), 3000);
  });
}

describe('workflow-dashboard', () => {
  it('finds run state under active project runtime dir', async () => {
    const projectName = 'test-project-scope';
    const runId = 'test-run-scope-1';
    const runDir = join(BASE_RUNTIME_DIR, 'projects', projectName, 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(ACTIVE_PROJECT_PATH, JSON.stringify({ name: projectName }, null, 2), 'utf8');
    await writeFile(
      join(runDir, 'state.json'),
      JSON.stringify(
        {
          run_id: runId,
          status: 'running',
          workflow_name: '@.claude/workflows/agent-framework-integration.yaml',
          started_at: '2026-01-01T00:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );

    const res = await runDashboard(['--run-id', runId]);
    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    assert.match(res.stdout, new RegExp(`Run ID:\\s+${runId}`));

    await rm(join(BASE_RUNTIME_DIR, 'projects', projectName), { recursive: true, force: true });
    await rm(ACTIVE_PROJECT_PATH, { force: true });
  });
});
