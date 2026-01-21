#!/usr/bin/env node
/**
 * Routing Safety Guard (PreToolUse)
 *
 * Goal: prevent high-fanout tools from running while routing is in progress.
 *
 * Why:
 * - Claude Code can OOM if a tool returns extremely large output (e.g., repo-wide Glob/Grep/Search).
 * - During routing, we only need small, deterministic reads of routing config (workflows/agents/schemas).
 *
 * Policy (when routing.started_at is set and routing.completed is false):
 * - Block `Grep` and `Search` outright.
 * - Restrict `Glob` to small, config-only scopes (workflows/agents/schemas/config) and block `.claude/context`.
 * - Fail-open if routing state cannot be read (router-first-enforcer remains the correctness gate).
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

function normalizeForMatch(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .toLowerCase();
}

function globCandidates(globInput) {
  if (!globInput) return [];
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
  const out = [];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) out.push(c);
    if (Array.isArray(c)) out.push(...c.filter(v => typeof v === 'string' && v.trim()));
  }
  if (out.length) return out;
  try {
    const s = JSON.stringify(globInput);
    if (typeof s === 'string' && s.trim()) return [s.slice(0, 1000)];
  } catch {
    // ignore
  }
  return [];
}

function globIsAllowedDuringRouting(globInput) {
  const candidates = globCandidates(globInput);
  if (!candidates.length) return false;

  for (const raw of candidates) {
    const p = normalizeForMatch(raw);
    if (!p) continue;

    // Never allow routing-phase globs into runtime outputs (can be huge).
    if (p.includes('.claude/context')) return false;

    // Explicitly disallow broad `.claude/**` patterns.
    if (p.startsWith('.claude/**') || p.startsWith('.claude/**/*') || p.includes('/**/'))
      return false;

    // Allow only small config discovery.
    if (p.startsWith('.claude/workflows/')) return true;
    if (p.startsWith('.claude/agents/')) return true;
    if (p.startsWith('.claude/schemas/')) return true;
    if (p === '.claude/config.yaml') return true;
    if (p.startsWith('.claude/config/')) return true;
  }

  return false;
}

function respondAllow() {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

function respondBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function routingBlockReason(toolName) {
  const name = normalizeToolName(toolName) || 'tool';
  return [
    '==============================================================',
    'ROUTING SAFETY GUARD',
    '--------------------------------------------------------------',
    `Blocked: ${name}`,
    'Routing is in progress. High-fanout tools are blocked to prevent massive outputs and CLI OOM.',
    'During routing, only use `.claude/` scoped Glob + targeted Read of routing config.',
    '==============================================================',
  ].join('\n');
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk.toString();
  const hookInput = raw ? JSON.parse(raw) : {};

  const toolName = normalizeToolName(toolNameOf(hookInput));
  const lower = toolName.toLowerCase();
  if (lower !== 'grep' && lower !== 'search' && lower !== 'glob') {
    respondAllow();
    return;
  }

  const toolInput = toolInputOf(hookInput);
  const sessionKey = await getSessionKey(hookInput);

  const tmpDir = resolveTmpDir();
  const statePath = join(tmpDir, 'routing-sessions', `${safeFileId(sessionKey)}.json`);
  const state = readJson(statePath);

  // Fail-open if state is missing/unreadable.
  const routingStarted = Boolean(state?.routing?.started_at);
  const routingCompleted = Boolean(state?.routing?.completed);
  if (!routingStarted || routingCompleted) {
    respondAllow();
    return;
  }

  // Routing in progress -> block Grep/Search entirely.
  if (lower === 'grep' || lower === 'search') {
    const reason = routingBlockReason(toolName);
    await logDenialIfBlocking({
      hookName: 'routing-safety-guard',
      hookInput,
      decision: 'block',
      reason,
    });
    respondBlock(reason);
    return;
  }

  // Routing in progress -> strictly limit Glob to small config scopes.
  if (lower === 'glob') {
    if (!globIsAllowedDuringRouting(toolInput)) {
      const reason = routingBlockReason(toolName);
      await logDenialIfBlocking({
        hookName: 'routing-safety-guard',
        hookInput,
        decision: 'block',
        reason,
      });
      respondBlock(reason);
      return;
    }
    respondAllow();
    return;
  }

  respondAllow();
}

main().catch(() => {
  // fail-open
  respondAllow();
});
