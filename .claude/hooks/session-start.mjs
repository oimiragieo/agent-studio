#!/usr/bin/env node
/**
 * Session Start Hook
 *
 * Purpose:
 * - Create a per-run stable session key on disk so hooks can coordinate across
 *   multiple OS processes spawned by Claude Code (subagents, tool workers, etc).
 *
 * Why:
 * - Claude Code can execute subagents in separate processes where `process.ppid`
 *   and other process identifiers are not stable.
 * - Without a stable cross-process key, router-first enforcement and run
 *   observability can fragment into multiple per-process state files.
 *
 * Notes:
 * - This hook never blocks session startup.
 * - It overwrites the shared key at the start of each top-level Claude session.
 * - Concurrency: if multiple Claude sessions run in the same repo concurrently,
 *   they will contend for this shared key file. This repo assumes one active
 *   session per project directory at a time.
 */

import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_TMP_DIR = join(__dirname, '..', 'context', 'tmp');
const TMP_DIR =
  process.env.CLAUDE_HOOK_TMP_DIR ||
  process.env.CLAUDE_TMP_DIR ||
  process.env.CLAUDE_CONTEXT_TMP_DIR ||
  DEFAULT_TMP_DIR;
const SHARED_KEY_PATH = join(TMP_DIR, 'shared-session-key.json');

let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function approve() {
  // Claude Code hook output schema varies by event. For non-PreToolUse events,
  // the safest compatible response is a `hookSpecificOutput` marker.
  safeRespond({ decision: 'approve', hookSpecificOutput: { hookEventName: 'SessionStart' } });
}

function makeTempPath(targetPath) {
  const dir = dirname(targetPath);
  const name = `.${basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return join(dir, name);
}

async function atomicWriteJson(targetPath, data) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmpPath = makeTempPath(targetPath);
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

async function main() {
  const now = Date.now();
  // Rotate on every top-level Claude session start. This avoids cross-session
  // collisions when multiple `claude` runs occur close together.
  const data = {
    session_key: `shared-${randomUUID()}`,
    created_at: new Date(now).toISOString(),
    // Long TTL to avoid mid-session expiry fragmenting routing/observability state
    // across processes. The key is rotated per-session by this hook.
    expires_at: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    created_by_pid: process.pid,
    created_by: 'session-start',
  };

  await atomicWriteJson(SHARED_KEY_PATH, data);
  approve();
}

// Fail-open: never block SessionStart
main()
  .catch(() => approve())
  .finally(() => {
    // no-op
  });
