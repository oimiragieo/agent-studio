#!/usr/bin/env node
/**
 * Router Glob Guard (PreToolUse)
 *
 * Prevents accidental high-fanout `Glob` during the routing phase.
 * Rationale: repo-wide globs (especially with large rule libraries) can produce massive tool output,
 * causing Claude Code to spike memory and potentially OOM.
 *
 * Policy:
 * - If routing is not completed yet, only allow Glob patterns clearly scoped to `.claude/`.
 * - Once routing is completed, allow Glob (other guards may apply).
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logDenialIfBlocking } from './denial-logger.mjs';
import { getSessionKeyForHook } from './session-key.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function toolNameOf(input) {
  const v = input?.tool_name ?? input?.tool ?? input?.toolName ?? input?.name ?? '';
  return typeof v === 'string' ? v.trim() : String(v ?? '').trim();
}

function toolInputOf(input) {
  return input?.tool_input ?? input?.toolInput ?? input?.input ?? input?.params ?? {};
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function resolveTmpDir() {
  const raw =
    process.env.CLAUDE_HOOK_TMP_DIR ||
    process.env.CLAUDE_TMP_DIR ||
    process.env.CLAUDE_CONTEXT_TMP_DIR ||
    join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  const trimmed = String(raw || '').trim();
  if (!trimmed) return join(PROJECT_ROOT, '.claude', 'context', 'tmp');
  return isAbsolute(trimmed) ? trimmed : join(PROJECT_ROOT, trimmed);
}

async function getSessionKey(hookInput) {
  const tmpDir = resolveTmpDir();
  return await getSessionKeyForHook({ hookInput, tmpDir });
}

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function normalizePathForMatch(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .toLowerCase();
}

function globLooksScopedToClaude(globInput) {
  if (!globInput) return false;
  const candidates = [
    globInput.glob,
    globInput.pattern,
    globInput.path,
    globInput.paths,
    globInput.searchPath,
    globInput.search_path,
    globInput.cwd,
    globInput.directory,
    globInput.dir,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      if (normalizePathForMatch(c).includes('.claude')) return true;
      continue;
    }
    if (Array.isArray(c) && c.every(v => typeof v === 'string')) {
      if (c.some(v => normalizePathForMatch(v).includes('.claude'))) return true;
    }
  }
  try {
    const s = JSON.stringify(globInput);
    if (typeof s === 'string' && s.slice(0, 6000).toLowerCase().includes('.claude')) return true;
  } catch {
    // ignore
  }
  return false;
}

function respondAllow() {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

function respondBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk.toString();
  const hookInput = raw ? JSON.parse(raw) : {};

  const toolName = normalizeToolName(toolNameOf(hookInput));
  if (toolName.toLowerCase() !== 'glob') {
    respondAllow();
    return;
  }

  const toolInput = toolInputOf(hookInput);
  const sessionKey = await getSessionKey(hookInput);

  const tmpDir = resolveTmpDir();
  const statePath = join(tmpDir, 'routing-sessions', `${safeFileId(sessionKey)}.json`);
  const state = readJson(statePath);

  // If we can't read state, fail-open (router-first-enforcer will still protect correctness).
  const routingCompleted = Boolean(state?.routing?.completed);
  if (routingCompleted) {
    respondAllow();
    return;
  }

  // Routing not completed -> only allow `.claude/` scoped globs.
  if (!globLooksScopedToClaude(toolInput)) {
    const reason = [
      '==============================================================',
      'ROUTER GLOB GUARD',
      '--------------------------------------------------------------',
      'Glob is restricted during routing to prevent high-fanout, memory-heavy tool results.',
      'Allowed during routing: Glob patterns scoped to `.claude/` (e.g. `.claude/workflows/*.yaml`).',
      'After routing completes, retry the Glob operation.',
      '==============================================================',
    ].join('\n');
    await logDenialIfBlocking({
      hookName: 'router-glob-guard',
      hookInput,
      decision: 'block',
      reason,
    });
    respondBlock(reason);
    return;
  }

  respondAllow();
}

main().catch(() => {
  // fail-open
  respondAllow();
});
