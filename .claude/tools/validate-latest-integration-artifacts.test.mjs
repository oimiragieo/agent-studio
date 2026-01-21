import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function makeTmpDir() {
  const dir = join(tmpdir(), `llm-rules-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runTool(args, cwd) {
  const proc = spawnSync(process.execPath, args, { cwd, encoding: 'utf-8' });
  return { status: proc.status ?? 1, stdout: proc.stdout, stderr: proc.stderr };
}

describe('validate-latest-integration-artifacts tool', () => {
  it('exits 0 when no run results and require-run is not set', () => {
    const dir = makeTmpDir();
    const tool = '.claude/tools/validate-latest-integration-artifacts.mjs';
    const r = runTool([tool, '--root', dir, '--json'], process.cwd());
    assert.equal(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.reason, 'no-run-results-found');
  });

  it('exits 2 when no run results and require-run is set', () => {
    const dir = makeTmpDir();
    const tool = '.claude/tools/validate-latest-integration-artifacts.mjs';
    const r = runTool([tool, '--root', dir, '--require-run', '--json'], process.cwd());
    assert.equal(r.status, 2);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
  });

  it('selects newest run-results by mtime and reports workflow_id', () => {
    const dir = makeTmpDir();
    const older = join(dir, 'agent-integration-v1-20000101-000000-run-results.json');
    const newer = join(dir, 'agent-integration-v1-20990101-000000-run-results.json');
    writeFileSync(older, JSON.stringify({ workflow_id: 'old' }), 'utf-8');
    writeFileSync(newer, JSON.stringify({ workflow_id: 'new' }), 'utf-8');
    // Ensure deterministic mtimes across files (some filesystems have coarse resolution).
    utimesSync(older, new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'));
    utimesSync(newer, new Date('2099-01-01T00:00:00Z'), new Date('2099-01-01T00:00:00Z'));

    const tool = '.claude/tools/validate-latest-integration-artifacts.mjs';
    const r = runTool([tool, '--root', dir, '--json'], process.cwd());
    assert.equal(r.status, 1); // schema validation should fail for our dummy payloads
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.workflow_id, 'agent-integration-v1-20990101-000000');
  });
});
