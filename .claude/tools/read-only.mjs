#!/usr/bin/env node
/**
 * Read-only mode toggle (repo safety)
 *
 * Persists a read-only flag under `.claude/context/tmp/read-only.json` which is enforced
 * by the `read-only-enforcer.mjs` PreToolUse hook.
 *
 * Usage:
 *   node .claude/tools/read-only.mjs status [--json]
 *   node .claude/tools/read-only.mjs enable [--reason "..."]
 *   node .claude/tools/read-only.mjs disable
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const STATE_PATH = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'read-only.json');

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2), 'utf8');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const cmd = args.find(a => !a.startsWith('--')) || 'status';
  let reason = '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--reason') {
      reason = String(args[i + 1] || '');
      i += 1;
    } else if (a.startsWith('--reason=')) {
      reason = a.slice('--reason='.length);
    }
  }
  return { cmd, json, reason };
}

function main() {
  const { cmd, json, reason } = parseArgs(process.argv);
  const st = readJson(STATE_PATH);
  const enabled = Boolean(st?.enabled);

  if (cmd === 'enable') {
    writeJson(STATE_PATH, {
      enabled: true,
      updated_at: new Date().toISOString(),
      reason: reason || null,
    });
    const payload = { ok: true, enabled: true, state_path: STATE_PATH };
    process.stdout.write(json ? JSON.stringify(payload, null, 2) : `Read-only enabled.\n`);
    return;
  }
  if (cmd === 'disable') {
    writeJson(STATE_PATH, { enabled: false, updated_at: new Date().toISOString(), reason: null });
    const payload = { ok: true, enabled: false, state_path: STATE_PATH };
    process.stdout.write(json ? JSON.stringify(payload, null, 2) : `Read-only disabled.\n`);
    return;
  }

  const payload = {
    enabled,
    state_path: STATE_PATH,
    updated_at: st?.updated_at ?? null,
    reason: st?.reason ?? null,
  };
  process.stdout.write(
    json ? JSON.stringify(payload, null, 2) : `Read-only: ${enabled ? 'ON' : 'OFF'}\n`
  );
}

main();
