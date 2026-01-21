import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const TOOL = join(PROJECT_ROOT, '.claude', 'tools', 'run-agent-framework-integration-headless.mjs');

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

describe('run-agent-framework-integration-headless tool', () => {
  it('produces report/results and runs smoke with fake claude + fake pnpm', async () => {
    const work = join(tmpdir(), `llm-rules-headless-int-${Date.now()}`);
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
        'const out = { structured_output: { agent, task_summary: \"ok\", tool_used: \"Read\", ok: true, notes: \"\" } };',
        'process.stdout.write(JSON.stringify(out));',
      ].join('\n'),
      'utf8'
    );

    if (process.platform === 'win32') {
      await writeFile(
        join(fakeBinDir, 'claude.cmd'),
        `@echo off\r\nnode "${fakeClaudeJs}" %*\r\n`,
        'utf8'
      );
      await writeFile(
        join(fakeBinDir, 'pnpm.cmd'),
        `@echo off\r\necho pnpm %*\r\nexit /b 0\r\n`,
        'utf8'
      );
    } else {
      const fakeClaude = join(fakeBinDir, 'claude');
      await writeFile(fakeClaude, `#!/usr/bin/env sh\nnode "${fakeClaudeJs}" "$@"\n`, 'utf8');
      await run('chmod', ['+x', fakeClaude]);
      const fakePnpm = join(fakeBinDir, 'pnpm');
      await writeFile(fakePnpm, '#!/usr/bin/env sh\necho pnpm "$@"\nexit 0\n', 'utf8');
      await run('chmod', ['+x', fakePnpm]);
    }

    // Keep the baseline minimal and fast in test mode.
    const baseline = JSON.stringify([
      {
        key: 'tools',
        name: 'pnpm test:tools',
        cmd: 'pnpm',
        args: ['test:tools'],
        log: 'pnpm-test-tools.log',
      },
    ]);

    const workflowId = `agent-integration-v1-20990101-000000`;
    const res = await run(
      'node',
      [
        TOOL,
        '--workflow-id',
        workflowId,
        '--expected-agents',
        'core',
        '--skip-observability',
        '--json',
      ],
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
    assert.ok(results.agent_smoke_testing);
    assert.equal(results.agent_smoke_testing.failed, 0);
    assert.ok(results.observability_paths);
    assert.ok(existsSync(results.observability_paths.events));
    assert.ok(existsSync(results.observability_paths.tool_events));

    // Cleanup created artifacts inside repo (this tool writes under .claude/context).
    await rm(
      join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'testing', `${workflowId}-logs`),
      {
        recursive: true,
        force: true,
      }
    );
    await rm(
      join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'testing', `${workflowId}-agent-smoke`),
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
      join(
        PROJECT_ROOT,
        '.claude',
        'context',
        'artifacts',
        'testing',
        `${workflowId}-verification.json`
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
    await rm(
      join(
        PROJECT_ROOT,
        '.claude',
        'context',
        'reports',
        'testing',
        `${workflowId}-verification-report.md`
      ),
      {
        force: true,
      }
    );
    await rm(join(PROJECT_ROOT, '.claude', 'context', 'runtime', 'headless'), {
      recursive: true,
      force: true,
    });
    await rm(work, { recursive: true, force: true });
  });
});
