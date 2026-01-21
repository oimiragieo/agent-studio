import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function runTool(cwd, args = [], env = {}) {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), '.claude/tools/events-tail.mjs'), ...args],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    }
  );
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

test('events-tail reads last-run.json and prints recent events', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-events-tail-'));
  const runtimeDir = join(root, '.claude', 'context', 'runtime');
  const runId = 'agent-test-run';
  const runDir = join(runtimeDir, 'runs', runId);
  mkdirSync(runDir, { recursive: true });

  writeFileSync(
    join(runtimeDir, 'last-run.json'),
    JSON.stringify({ run_id: runId, status: 'running', current_agent: 'router' }, null, 2),
    'utf8'
  );

  writeFileSync(
    join(runDir, 'events.ndjson'),
    [
      JSON.stringify({
        ts: 't1',
        ok: true,
        agent: 'router',
        phase: 'pre',
        tool: 'router',
        activity: 'Router',
      }),
      JSON.stringify({
        ts: 't2',
        ok: true,
        agent: 'master-orchestrator',
        phase: 'subagent_start',
        tool: 'Task',
      }),
    ].join('\n') + '\n',
    'utf8'
  );

  const r = runTool(root, ['--lines', '10'], { CLAUDE_RUNTIME_DIR: runtimeDir });
  assert.equal(r.status, 0, r.stdout || r.stderr);
  assert.match(r.stdout, /RUN EVENTS \(agent-test-run\)/);
  assert.match(r.stdout, /router/);
});

test('events-tail --json emits structured output', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-events-tail-json-'));
  const runtimeDir = join(root, '.claude', 'context', 'runtime');
  const runId = 'agent-json-run';
  const runDir = join(runtimeDir, 'runs', runId);
  mkdirSync(runDir, { recursive: true });

  writeFileSync(
    join(runtimeDir, 'last-run.json'),
    JSON.stringify({ run_id: runId }, null, 2),
    'utf8'
  );
  writeFileSync(
    join(runDir, 'events.ndjson'),
    JSON.stringify({ ts: 't1', ok: false, error: 'boom' }) + '\n',
    'utf8'
  );

  const r = runTool(root, ['--json'], { CLAUDE_RUNTIME_DIR: runtimeDir });
  assert.equal(r.status, 0, r.stdout || r.stderr);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.run_id, runId);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.last_error.error, 'boom');
});
