import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const TOOL = join(PROJECT_ROOT, '.claude', 'tools', 'run-agent-smoke-headless.mjs');

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

describe('run-agent-smoke-headless tool', () => {
  it('writes receipts + summary using a fake claude binary', async () => {
    const work = join(tmpdir(), `llm-rules-smoke-${Date.now()}`);
    const fakeBinDir = join(work, 'bin');
    await mkdir(fakeBinDir, { recursive: true });

    const fakeClaudeJs = join(fakeBinDir, 'fake-claude.js');
    await writeFile(
      fakeClaudeJs,
      [
        '#!/usr/bin/env node',
        'const args = process.argv.slice(2);',
        "const idx = args.indexOf('--agent');",
        "const agent = idx >= 0 ? args[idx + 1] : 'unknown';",
        'const out = {',
        "  structured_output: { agent, task_summary: 'ok', tool_used: 'Read', ok: true, notes: '' },",
        '};',
        'process.stdout.write(JSON.stringify(out));',
      ].join('\n'),
      'utf8'
    );

    if (process.platform === 'win32') {
      const fakeClaudeCmd = join(fakeBinDir, 'claude.cmd');
      await writeFile(fakeClaudeCmd, `@echo off\r\nnode "${fakeClaudeJs}" %*\r\n`, 'utf8');
    } else {
      const fakeClaude = join(fakeBinDir, 'claude');
      await writeFile(fakeClaude, `#!/usr/bin/env sh\nnode "${fakeClaudeJs}" "$@"\n`, 'utf8');
      await run('chmod', ['+x', fakeClaude]);
    }

    const workflowId = `agent-integration-v1-20990101-000000-${Date.now()}`;
    const res = await run('node', [TOOL, '--workflow-id', workflowId, '--timeout-ms', '2000'], {
      PATH: `${fakeBinDir}${delimiter}${process.env.PATH || ''}`,
    });

    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.workflow_id, workflowId);
    assert.equal(parsed.failed, 0);
    assert.ok(existsSync(parsed.receipts_directory));
    assert.ok(existsSync(parsed.summary_file));

    const summary = JSON.parse(await readFile(parsed.summary_file, 'utf8'));
    assert.equal(summary.workflow_id, workflowId);
    assert.equal(summary.total, summary.passed + summary.failed);
    assert.ok(summary.total > 0);

    // Ensure at least one receipt has the required keys.
    const first = summary.results[0];
    const receipt = JSON.parse(await readFile(first.receipt_path, 'utf8'));
    for (const k of ['agent', 'task_summary', 'tool_used', 'ok', 'notes']) {
      assert.ok(k in receipt, `missing key: ${k}`);
    }
    assert.equal(typeof receipt.ok, 'boolean');

    await rm(parsed.receipts_directory, { recursive: true, force: true });
    await rm(work, { recursive: true, force: true });
  });
});
