import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('SessionStart hook rotates the shared session key per Claude session', () => {
  const hookPath = join('.claude', 'hooks', 'session-start.mjs');
  const tempRoot = mkdtempSync(join(tmpdir(), 'llm-rules-sessionstart-'));
  const sharedKeyPath = join(tempRoot, 'shared-session-key.json');

  const run = () =>
    spawnSync(process.execPath, [hookPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_HOOK_TMP_DIR: tempRoot },
    });

  const r1 = run();
  assert.equal(r1.status, 0);
  const first = JSON.parse(readFileSync(sharedKeyPath, 'utf8'));
  assert.equal(typeof first.session_key, 'string');
  assert.ok(first.session_key.startsWith('shared-'));
  assert.equal(first.created_by, 'session-start');

  const r2 = run();
  assert.equal(r2.status, 0);
  const second = JSON.parse(readFileSync(sharedKeyPath, 'utf8'));
  assert.equal(typeof second.session_key, 'string');
  assert.ok(second.session_key.startsWith('shared-'));
  assert.notEqual(second.session_key, first.session_key);
});
