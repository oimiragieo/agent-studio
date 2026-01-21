import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();

async function runNode(args, { cwd = PROJECT_ROOT } = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, { cwd, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('observability-bundle tool', () => {
  it('writes bundle.json + report.md for a provided debug log', async () => {
    const outRoot = join(PROJECT_ROOT, '.tmp', 'obs-test');
    await mkdir(outRoot, { recursive: true });

    const debugPath = join(outRoot, 'sample-debug.txt');
    await writeFile(
      debugPath,
      [
        '2026-01-19T00:00:00.000Z [WARN] Streaming stall detected: 30.1s gap between events (stall #1)',
        '2026-01-19T00:00:01.000Z [ERROR] MCP server "sequential-thinking" Server stderr: Sequential Thinking MCP Server running on stdio',
        '2026-01-19T00:00:02.000Z [DEBUG] npm view failed with code 1',
      ].join('\n'),
      'utf8'
    );

    const res = await runNode([
      join(PROJECT_ROOT, '.claude', 'tools', 'observability-bundle.mjs'),
      '--id',
      'obs-test',
      '--output-root',
      outRoot,
      '--debug-log',
      debugPath,
      '--events-lines',
      '5',
      '--tool-events-last',
      '5',
    ]);
    assert.equal(res.code, 0, `stdout:\n${res.stdout}\nstderr:\n${res.stderr}`);

    const out = JSON.parse(res.stdout.trim());
    assert.equal(out.ok, true);
    assert.ok(String(out.bundle).includes(join(outRoot, 'artifacts', 'observability', 'obs-test')));
    assert.ok(String(out.report).includes(join(outRoot, 'reports', 'observability')));

    const bundle = JSON.parse(await readFile(out.bundle, 'utf8'));
    assert.equal(bundle.id, 'obs-test');
    assert.equal(bundle.inputs.debug_log_path, debugPath);
    assert.ok(bundle.data.debug_analysis, 'expected debug_analysis in bundle');

    const report = await readFile(out.report, 'utf8');
    assert.match(report, /Observability Bundle: obs-test/);
  });

  it('includes a testing run summary when --testing-run is provided', async () => {
    const outRoot = join(PROJECT_ROOT, '.tmp', 'obs-test-testing-run');
    await mkdir(join(outRoot, 'artifacts', 'testing'), { recursive: true });
    await mkdir(join(outRoot, 'reports', 'testing'), { recursive: true });
    await mkdir(join(outRoot, 'artifacts', 'testing', 'ship-readiness-v1-20990101-000000-logs'), {
      recursive: true,
    });

    const workflowId = 'ship-readiness-v1-20990101-000000';
    await writeFile(
      join(outRoot, 'artifacts', 'testing', `${workflowId}-run-results.json`),
      JSON.stringify(
        { workflow_id: workflowId, status: 'PASS', baseline: { skipped: true, steps: [] } },
        null,
        2
      ),
      'utf8'
    );
    await writeFile(
      join(outRoot, 'reports', 'testing', `${workflowId}-run-report.md`),
      '# Ship Readiness Audit (Headless)\n',
      'utf8'
    );

    const res = await runNode([
      join(PROJECT_ROOT, '.claude', 'tools', 'observability-bundle.mjs'),
      '--id',
      'obs-test-run',
      '--output-root',
      outRoot,
      '--testing-run',
      workflowId,
      '--events-lines',
      '5',
      '--tool-events-last',
      '5',
    ]);
    assert.equal(res.code, 0, `stdout:\n${res.stdout}\nstderr:\n${res.stderr}`);

    const out = JSON.parse(res.stdout.trim());
    const bundle = JSON.parse(await readFile(out.bundle, 'utf8'));
    assert.equal(bundle.inputs.testing_run_id, workflowId);
    assert.equal(bundle.data.testing_run.workflow_id, workflowId);
    assert.equal(bundle.data.testing_run.status, 'PASS');

    const report = await readFile(out.report, 'utf8');
    assert.match(report, /Testing Run Summary/);
    assert.match(report, new RegExp(workflowId));
  });
});
