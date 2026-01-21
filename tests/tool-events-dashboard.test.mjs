import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_ROOT = process.cwd();
const DASHBOARD_PATH = join(PROJECT_ROOT, '.claude', 'tools', 'tool-events-dashboard.mjs');
const TOOL_EVENTS_DIR = join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'tool-events');

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

describe('tool-events-dashboard', () => {
  it('computes tool_calls as post events plus denied-without-post', async () => {
    const runId = 'test-tool-calls';
    const path = join(TOOL_EVENTS_DIR, `run-${runId}.ndjson`);
    const lines = [
      JSON.stringify({
        ts: '2026-01-01T00:00:00.000Z',
        phase: 'pre',
        agent: 'a',
        tool: 'Read',
        ok: true,
      }),
      JSON.stringify({
        ts: '2026-01-01T00:00:01.000Z',
        phase: 'post',
        agent: 'a',
        tool: 'Read',
        ok: true,
      }),
      JSON.stringify({
        ts: '2026-01-01T00:00:02.000Z',
        phase: 'pre',
        agent: 'a',
        tool: 'Task',
        ok: true,
      }),
      JSON.stringify({
        ts: '2026-01-01T00:00:03.000Z',
        phase: 'post',
        agent: 'a',
        tool: 'Task',
        ok: true,
      }),
      JSON.stringify({
        ts: '2026-01-01T00:00:04.000Z',
        phase: 'pre',
        agent: 'a',
        tool: 'Read',
        ok: false,
        denied: true,
      }),
    ].join('\n');
    await writeFile(path, lines, 'utf8');

    const res = await runDashboard(['--run-id', runId, '--json', '--last', '5']);
    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.total_events, 5);
    assert.equal(parsed.denied_events, 1);
    assert.equal(parsed.tool_calls, 3);

    await rm(path, { force: true });
  });

  it('filters events by --since (ISO timestamp)', async () => {
    const runId = 'test-since';
    const path = join(TOOL_EVENTS_DIR, `run-${runId}.ndjson`);
    const lines = [
      JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', agent: 'a', tool: 'Read', ok: true }),
      JSON.stringify({ ts: '2026-01-02T00:00:00.000Z', agent: 'b', tool: 'Grep', ok: true }),
      JSON.stringify({ ts: '2026-01-03T00:00:00.000Z', agent: 'b', tool: 'Write', ok: false }),
    ].join('\n');
    await writeFile(path, lines, 'utf8');

    const res = await runDashboard([
      '--run-id',
      runId,
      '--json',
      '--since',
      '2026-01-02T00:00:00.000Z',
    ]);
    assert.equal(res.code, 0, `stderr:\n${res.stderr}\nstdout:\n${res.stdout}`);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.total_events, 2);
    assert.equal(parsed.since, '2026-01-02T00:00:00.000Z');

    await rm(path, { force: true });
  });

  it('exits non-zero for invalid --since', async () => {
    const runId = 'test-since-invalid';
    const path = join(TOOL_EVENTS_DIR, `run-${runId}.ndjson`);
    await writeFile(
      path,
      JSON.stringify({ ts: '2026-01-01T00:00:00.000Z', agent: 'a', tool: 'Read', ok: true }) + '\n',
      'utf8'
    );

    const res = await runDashboard(['--run-id', runId, '--json', '--since', 'not-a-date']);
    assert.equal(res.code, 2);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.error, 'invalid_since');

    await rm(path, { force: true });
  });
});
