import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractSessionKeyFromHookInput,
  getSessionKeyForHook,
  getStableSessionKey,
} from '../.claude/hooks/session-key.mjs';

test('getStableSessionKey refreshes shared-session-key expiry (sliding TTL)', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'llm-rules-sessionkey-'));
  const sharedKeyPath = join(tempRoot, 'shared-session-key.json');

  const now = Date.now();
  const firstExpiry = new Date(now + 60_000).toISOString();
  writeFileSync(
    sharedKeyPath,
    JSON.stringify(
      {
        session_key: 'shared-test-key',
        created_at: new Date(now).toISOString(),
        expires_at: firstExpiry,
        created_by: 'test',
      },
      null,
      2
    ),
    'utf8'
  );

  const originalEnv = process.env.CLAUDE_HOOK_TMP_DIR;
  process.env.CLAUDE_HOOK_TMP_DIR = tempRoot;
  try {
    const key = await getStableSessionKey({ tmpDir: tempRoot });
    assert.equal(key, 'shared-test-key');

    const refreshed = JSON.parse(readFileSync(sharedKeyPath, 'utf8'));
    assert.equal(refreshed.session_key, 'shared-test-key');
    assert.ok(Date.parse(refreshed.expires_at) > Date.parse(firstExpiry));
    assert.equal(typeof refreshed.refreshed_at, 'string');
  } finally {
    if (originalEnv === undefined) delete process.env.CLAUDE_HOOK_TMP_DIR;
    else process.env.CLAUDE_HOOK_TMP_DIR = originalEnv;
  }
});

test('getStableSessionKey normalizes env session ids and persists to shared-session-key.json', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'llm-rules-sessionkey-env-'));
  const sharedKeyPath = join(tempRoot, 'shared-session-key.json');

  const originalTmp = process.env.CLAUDE_HOOK_TMP_DIR;
  const originalSessionId = process.env.CLAUDE_SESSION_ID;

  process.env.CLAUDE_HOOK_TMP_DIR = tempRoot;
  process.env.CLAUDE_SESSION_ID = '3fdb298e-c0ac-4986-915a-262ba2a81fd8';

  try {
    const key1 = await getStableSessionKey({ tmpDir: tempRoot });
    assert.equal(key1, 'shared-3fdb298e-c0ac-4986-915a-262ba2a81fd8');

    const persisted = JSON.parse(readFileSync(sharedKeyPath, 'utf8'));
    assert.equal(persisted.session_key, key1);

    delete process.env.CLAUDE_SESSION_ID;
    const key2 = await getStableSessionKey({ tmpDir: tempRoot });
    assert.equal(key2, key1);
  } finally {
    if (originalTmp === undefined) delete process.env.CLAUDE_HOOK_TMP_DIR;
    else process.env.CLAUDE_HOOK_TMP_DIR = originalTmp;

    if (originalSessionId === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = originalSessionId;
  }
});

test('extractSessionKeyFromHookInput normalizes uuid-like ids to shared-*', () => {
  const key = extractSessionKeyFromHookInput({
    session_id: '3fdb298e-c0ac-4986-915a-262ba2a81fd8',
  });
  assert.equal(key, 'shared-3fdb298e-c0ac-4986-915a-262ba2a81fd8');
});

test('getSessionKeyForHook persists hookInput session id to shared-session-key.json for cross-process convergence', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'llm-rules-sessionkey-hook-'));
  const sharedKeyPath = join(tempRoot, 'shared-session-key.json');

  // Seed a different shared key (what SessionStart would have written).
  writeFileSync(
    sharedKeyPath,
    JSON.stringify(
      {
        session_key: 'shared-seeded-key',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_by: 'test',
      },
      null,
      2
    ),
    'utf8'
  );

  const key = await getSessionKeyForHook({
    tmpDir: tempRoot,
    hookInput: { session_id: '2af4a513-acd5-4773-a798-65ac49f62723' },
  });
  assert.equal(key, 'shared-2af4a513-acd5-4773-a798-65ac49f62723');

  const persisted = JSON.parse(readFileSync(sharedKeyPath, 'utf8'));
  assert.equal(persisted.session_key, key);
});
