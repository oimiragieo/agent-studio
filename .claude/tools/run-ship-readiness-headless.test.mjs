import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const TOOL = join(PROJECT_ROOT, '.claude', 'tools', 'run-ship-readiness-headless.mjs');
const VERIFY = join(PROJECT_ROOT, '.claude', 'tools', 'verify-ship-readiness.mjs');

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

describe('run-ship-readiness-headless tool', () => {
  it('produces report/results with fake pnpm baseline', async () => {
    const work = join(tmpdir(), `llm-rules-headless-ship-${Date.now()}`);
    const fakeBinDir = join(work, 'bin');
    await mkdir(fakeBinDir, { recursive: true });

    if (process.platform === 'win32') {
      await writeFile(
        join(fakeBinDir, 'pnpm.cmd'),
        `@echo off\r\necho pnpm %*\r\nexit /b 0\r\n`,
        'utf8'
      );
    } else {
      const fakePnpm = join(fakeBinDir, 'pnpm');
      await writeFile(fakePnpm, '#!/usr/bin/env sh\necho pnpm \"$@\"\\nexit 0\\n', 'utf8');
      await run('chmod', ['+x', fakePnpm]);
    }

    const baseline = JSON.stringify([
      {
        key: 'tools',
        name: 'pnpm test:tools',
        cmd: 'pnpm',
        args: ['test:tools'],
        log: 'pnpm-test-tools.log',
      },
    ]);

    const workflowId = `ship-readiness-v1-20990101-000000`;
    const res = await run(
      'node',
      [TOOL, '--workflow-id', workflowId, '--json', '--skip-observability'],
      {
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH || ''}`,
        LLM_RULES_HEADLESS_BASELINE_JSON: baseline,
      }
    );

    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const out = JSON.parse(res.stdout);
    assert.equal(out.workflow_id, workflowId);
    assert.ok(existsSync(out.report_path));
    assert.ok(existsSync(out.results_path));
    assert.ok(existsSync(out.logs_dir));

    const results = JSON.parse(await readFile(out.results_path, 'utf8'));
    assert.equal(results.workflow_id, workflowId);
    assert.equal(results.status, 'PASS');
    assert.equal(results.baseline.skipped, false);
    assert.equal(results.baseline.steps.length, 1);
    assert.equal(results.baseline.steps[0].ok, true);

    const verify = await run('node', [VERIFY, '--workflow-id', workflowId, '--json']);
    assert.equal(
      verify.code,
      0,
      `verify stderr:\n${verify.stderr}\nverify stdout:\n${verify.stdout}`
    );
    const verifyOut = JSON.parse(verify.stdout);
    assert.equal(verifyOut.ok, true);

    await rm(
      join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'testing', `${workflowId}-logs`),
      {
        recursive: true,
        force: true,
      }
    );
    await rm(
      join(
        PROJECT_ROOT,
        '.claude',
        'context',
        'artifacts',
        'testing',
        `${workflowId}-run-results.json`
      ),
      {
        force: true,
      }
    );
    await rm(
      join(PROJECT_ROOT, '.claude', 'context', 'reports', 'testing', `${workflowId}-run-report.md`),
      {
        force: true,
      }
    );
    await rm(work, { recursive: true, force: true });
  });
});
