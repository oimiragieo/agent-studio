#!/usr/bin/env node
/**
 * Orchestrator Enforcement Hook (PreToolUse) - v2.2
 *
 * Non-negotiables:
 * - Never crash agents (fail-open on unexpected errors)
 * - Persist Read count across hook invocations (each call is a fresh process)
 * - Avoid unbounded state growth (truncate tool input, cap arrays)
 *
 * Role detection priority:
 * 1) `CLAUDE_AGENT_ROLE` / `CLAUDE_AGENT_NAME` env vars (authoritative)
 * 2) On-disk session state (`.claude/context/tmp/orchestrator-session-state.json`)
 * 3) Default: subagent (fail-safe; avoids false positives)
 */

import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_STATE_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.json'
);
const SESSION_DELTA_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.delta.jsonl'
);
const SESSION_LOCK_PATH = join(
  __dirname,
  '..',
  'context',
  'tmp',
  'orchestrator-session-state.lock'
);
const AUDIT_LOG_PATH = join(__dirname, '..', 'context', 'logs', 'orchestrator-violations.log');

const MAX_VIOLATIONS = 100;
const MAX_FILES_READ = 200;
const MAX_TOOL_INPUT_CHARS = 500;
const STATE_CACHE_TTL_MS = 5000;
const STATE_COMPACT_DEBOUNCE_MS = 5000;

const ENFORCEMENT_RULES = {
  Write: {
    action: 'BLOCK',
    reason: 'Orchestrators MUST NOT write files directly',
    delegate: 'developer',
  },
  Edit: {
    action: 'BLOCK',
    reason: 'Orchestrators MUST NOT edit files directly',
    delegate: 'developer',
  },
  Grep: {
    action: 'BLOCK',
    reason: 'Orchestrators MUST NOT search code directly',
    delegate: 'analyst',
  },
  Glob: {
    action: 'BLOCK',
    reason: 'Orchestrators MUST NOT search files directly',
    delegate: 'analyst',
  },
  Bash: {
    action: 'CONDITIONAL',
    blocked_patterns: [
      /rm\s+-[rf]/i,
      /git\s+(add|commit|push|pull|merge|rebase)/i,
      /node\s+\.claude\/tools\//i,
      /npm\s+(run|test)/i,
      /pnpm\s+/i,
    ],
    reason: 'Orchestrators MUST NOT run git/rm/validation commands',
    delegate: 'developer or qa',
  },
  Read: {
    action: 'COUNT_LIMITED',
    max_count: 2,
    reason: 'Orchestrators limited to 2 Read calls (coordination only)',
    delegate: 'analyst or Explore',
  },
};

const ALLOWED_READ_PATTERNS = [
  /plan.*\.json$/i,
  /dashboard\.md$/i,
  /project-db\.json$/i,
  /workflow.*\.yaml$/i,
  /artifact-registry\.json$/i,
  /\.claude\/CLAUDE\.md$/i,
  /\.claude\/agents\//i,
  /\.claude\/context\/runs\//i,
];

let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // Fail-open: do nothing.
  }
}

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_ORCHESTRATOR_HOOK_EXECUTING === 'true') {
  safeRespond({ decision: 'allow' });
  process.exit(0);
}
process.env.CLAUDE_ORCHESTRATOR_HOOK_EXECUTING = 'true';

// Timeout protection - force exit after 2 seconds (fail-open)
const timeout = setTimeout(() => {
  safeRespond({ decision: 'allow', warning: 'Hook timeout' });
  delete process.env.CLAUDE_ORCHESTRATOR_HOOK_EXECUTING;
  process.exit(0);
}, 2000);

function isAllowedReadFile(filePath) {
  return ALLOWED_READ_PATTERNS.some(pattern => pattern.test(filePath));
}

function summarizeToolInput(tool, toolInput) {
  const summary = {};

  if (tool === 'Bash') {
    const command = String(toolInput?.command || '');
    summary.command = command.slice(0, MAX_TOOL_INPUT_CHARS);
    if (command.length > MAX_TOOL_INPUT_CHARS) summary.command_truncated = true;
    return summary;
  }

  if (tool === 'Read') {
    const filePath = String(toolInput?.file_path || '');
    summary.file_path = filePath.slice(0, MAX_TOOL_INPUT_CHARS);
    if (filePath.length > MAX_TOOL_INPUT_CHARS) summary.file_path_truncated = true;
    return summary;
  }

  if (tool === 'Write' || tool === 'Edit') {
    const filePath = String(toolInput?.file_path || toolInput?.path || '');
    summary.file_path = filePath.slice(0, MAX_TOOL_INPUT_CHARS);
    if (filePath.length > MAX_TOOL_INPUT_CHARS) summary.file_path_truncated = true;
    if (typeof toolInput?.content === 'string') summary.content_length = toolInput.content.length;
    if (typeof toolInput?.old_string === 'string')
      summary.old_string_length = toolInput.old_string.length;
    if (typeof toolInput?.new_string === 'string')
      summary.new_string_length = toolInput.new_string.length;
    return summary;
  }

  for (const [key, value] of Object.entries(toolInput || {})) {
    if (value == null) continue;
    if (typeof value === 'string') {
      summary[key] = value.slice(0, MAX_TOOL_INPUT_CHARS);
      if (value.length > MAX_TOOL_INPUT_CHARS) summary[`${key}_truncated`] = true;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      summary[key] = value;
    }
  }

  return summary;
}

let sessionStateCache = null;
let sessionStateCacheAt = 0;
let sessionStateCacheHasUncompactedUpdates = false;

async function loadSessionStateFromDisk() {
  try {
    if (!existsSync(SESSION_STATE_PATH)) return null;
    const content = await readFile(SESSION_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function tryLoadSessionState() {
  const now = Date.now();
  if (sessionStateCache && now - sessionStateCacheAt < STATE_CACHE_TTL_MS) {
    return sessionStateCache;
  }

  const state = await loadSessionStateFromDisk();
  sessionStateCache = state;
  sessionStateCacheAt = now;
  return state;
}

async function readSessionDeltas() {
  try {
    if (!existsSync(SESSION_DELTA_PATH)) return [];
    const content = await readFile(SESSION_DELTA_PATH, 'utf-8');
    if (!content) return [];

    const deltas = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') deltas.push(parsed);
      } catch {
        // ignore malformed line
      }
    }
    return deltas;
  } catch {
    return [];
  }
}

function applySessionDeltas(state, deltas) {
  if (!state || !deltas?.length) return state;

  for (const delta of deltas) {
    if (delta?.agent_role === 'orchestrator') state.agent_role = 'orchestrator';

    if (Number.isFinite(delta?.read_inc) && delta.read_inc !== 0) {
      state.read_count =
        (Number.isFinite(state.read_count) ? state.read_count : 0) + delta.read_inc;
    }

    if (typeof delta?.file_read === 'string' && delta.file_read) {
      state.files_read = Array.isArray(state.files_read) ? state.files_read : [];
      state.files_read.push(delta.file_read.slice(0, MAX_TOOL_INPUT_CHARS));
      if (state.files_read.length > MAX_FILES_READ)
        state.files_read = state.files_read.slice(-MAX_FILES_READ);
    }

    if (delta?.violation && typeof delta.violation === 'object') {
      state.violations = Array.isArray(state.violations) ? state.violations : [];
      state.violations.push(delta.violation);
      if (state.violations.length > MAX_VIOLATIONS)
        state.violations = state.violations.slice(-MAX_VIOLATIONS);
    }
  }

  return state;
}

async function tryLoadEffectiveSessionState() {
  const baseState = await tryLoadSessionState();
  if (!baseState) return null;

  const deltas = await readSessionDeltas();
  return applySessionDeltas(structuredClone(baseState), deltas);
}

function detectRoleFromEnv() {
  if (process.env.CLAUDE_AGENT_ROLE) {
    return process.env.CLAUDE_AGENT_ROLE === 'orchestrator' ? 'orchestrator' : 'subagent';
  }
  if (process.env.CLAUDE_AGENT_NAME) {
    const agentName = process.env.CLAUDE_AGENT_NAME.toLowerCase();
    return ['orchestrator', 'master-orchestrator'].includes(agentName)
      ? 'orchestrator'
      : 'subagent';
  }
  return null;
}

async function writeSessionState(state) {
  try {
    const dir = dirname(SESSION_STATE_PATH);
    await mkdir(dir, { recursive: true });
    const payload = JSON.stringify(state, null, 2);

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await writeFile(SESSION_STATE_PATH, payload, 'utf-8');
        return;
      } catch (error) {
        const isLast = attempt === maxRetries - 1;
        const retryable =
          error &&
          (error.code === 'EBUSY' ||
            error.code === 'EPERM' ||
            error.code === 'EACCES' ||
            error.code === 'EMFILE');
        if (!retryable || isLast) return;
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
      }
    }
  } catch {
    // ignore (fail-open)
  }
}

async function appendSessionDelta(delta) {
  try {
    const dir = dirname(SESSION_DELTA_PATH);
    await mkdir(dir, { recursive: true });
    await appendFile(SESSION_DELTA_PATH, JSON.stringify(delta) + '\n', 'utf-8');

    if (sessionStateCache) {
      applySessionDeltas(sessionStateCache, [delta]);
      sessionStateCacheAt = Date.now();
      sessionStateCacheHasUncompactedUpdates = true;
    }
  } catch {
    // ignore (fail-open)
  }
}

async function acquireCompactLock() {
  try {
    await writeFile(SESSION_LOCK_PATH, String(process.pid), { encoding: 'utf-8', flag: 'wx' });
    return true;
  } catch (error) {
    try {
      if (existsSync(SESSION_LOCK_PATH)) {
        const lockStat = await stat(SESSION_LOCK_PATH);
        const ageMs = Date.now() - lockStat.mtimeMs;
        if (ageMs > STATE_COMPACT_DEBOUNCE_MS * 3) {
          await unlink(SESSION_LOCK_PATH);
        }
      }
    } catch {
      // ignore
    }

    try {
      await writeFile(SESSION_LOCK_PATH, String(process.pid), { encoding: 'utf-8', flag: 'wx' });
      return true;
    } catch {
      return false;
    }
  }
}

async function releaseCompactLock() {
  try {
    if (existsSync(SESSION_LOCK_PATH)) await unlink(SESSION_LOCK_PATH);
  } catch {
    // ignore
  }
}

async function compactSessionStateIfNeeded({ force } = { force: false }) {
  const now = Date.now();

  let baseState =
    !sessionStateCacheHasUncompactedUpdates &&
    sessionStateCache &&
    now - sessionStateCacheAt < STATE_CACHE_TTL_MS
      ? sessionStateCache
      : await loadSessionStateFromDisk();

  if (!baseState && sessionStateCache) baseState = sessionStateCache;

  if (!baseState) return;

  const lastCompact = Number.isFinite(baseState?.last_compact_ms) ? baseState.last_compact_ms : 0;
  if (!force && now - lastCompact < STATE_COMPACT_DEBOUNCE_MS) return;

  const locked = await acquireCompactLock();
  if (!locked) return;

  const snapshotPath = `${SESSION_DELTA_PATH}.${now}.${process.pid}.snapshot`;

  try {
    if (existsSync(SESSION_DELTA_PATH)) {
      try {
        await rename(SESSION_DELTA_PATH, snapshotPath);
      } catch {
        return;
      }
    }

    const snapshotDeltas = existsSync(snapshotPath)
      ? await readFile(snapshotPath, 'utf-8')
          .then(content => {
            const deltas = [];
            for (const line of content.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object') deltas.push(parsed);
              } catch {
                // ignore
              }
            }
            return deltas;
          })
          .catch(() => [])
      : [];

    const merged = applySessionDeltas(structuredClone(baseState), snapshotDeltas);
    merged.last_compact_ms = now;
    merged.updated_at = new Date().toISOString();

    if (merged.violations?.length > MAX_VIOLATIONS)
      merged.violations = merged.violations.slice(-MAX_VIOLATIONS);
    if (merged.files_read?.length > MAX_FILES_READ)
      merged.files_read = merged.files_read.slice(-MAX_FILES_READ);

    await writeSessionState(merged);
    sessionStateCache = merged;
    sessionStateCacheAt = now;
    sessionStateCacheHasUncompactedUpdates = false;
  } finally {
    try {
      if (existsSync(snapshotPath)) await unlink(snapshotPath);
    } catch {
      // ignore
    }
    await releaseCompactLock();
  }
}

function addViolation(state, violation) {
  state.violations = Array.isArray(state.violations) ? state.violations : [];
  state.violations.push(violation);
  if (state.violations.length > MAX_VIOLATIONS) {
    state.violations = state.violations.slice(-MAX_VIOLATIONS);
  }
}

async function logViolation(violation) {
  try {
    const logDir = dirname(AUDIT_LOG_PATH);
    await mkdir(logDir, { recursive: true });
    await appendFile(AUDIT_LOG_PATH, JSON.stringify(violation) + '\n', 'utf-8');
  } catch {
    // ignore
  }
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString('utf-8');

  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    safeRespond({ decision: 'allow' });
    return;
  }

  const tool = hookInput.tool_name || hookInput.tool;
  const toolInput = hookInput.tool_input || {};

  // Exclusions to prevent recursion / self-interference
  if (tool === 'Task' || tool === 'TodoWrite') {
    safeRespond({ decision: 'allow' });
    return;
  }

  // Fast path: if tool isn't enforced, allow without touching state/logs
  if (!ENFORCEMENT_RULES[tool]) {
    safeRespond({ decision: 'allow' });
    return;
  }

  const envRole = detectRoleFromEnv();
  if (envRole === 'subagent') {
    safeRespond({ decision: 'allow' });
    return;
  }

  const existingState = await tryLoadEffectiveSessionState();
  const role =
    envRole ?? (existingState?.agent_role === 'orchestrator' ? 'orchestrator' : 'subagent');

  if (role !== 'orchestrator') {
    safeRespond({ decision: 'allow' });
    return;
  }

  const state = existingState || {
    session_id: `sess_${Date.now()}`,
    agent_role: 'orchestrator',
    read_count: 0,
    violations: [],
    files_read: [],
    created_at: new Date().toISOString(),
  };

  // Ensure session state exists on disk for subsequent hook invocations.
  if (!existsSync(SESSION_STATE_PATH)) {
    const nowMs = Date.now();
    state.last_compact_ms = nowMs;
    await writeSessionState(state);
    sessionStateCache = structuredClone(state);
    sessionStateCacheAt = nowMs;
    sessionStateCacheHasUncompactedUpdates = false;
  }

  state.agent_role = 'orchestrator';
  state.read_count = Number.isFinite(state.read_count) ? state.read_count : 0;
  state.violations = Array.isArray(state.violations) ? state.violations : [];
  state.files_read = Array.isArray(state.files_read) ? state.files_read : [];
  if (state.violations.length > MAX_VIOLATIONS)
    state.violations = state.violations.slice(-MAX_VIOLATIONS);
  if (state.files_read.length > MAX_FILES_READ)
    state.files_read = state.files_read.slice(-MAX_FILES_READ);

  const rule = ENFORCEMENT_RULES[tool];

  if (rule.action === 'BLOCK') {
    const violation = {
      session_id: state.session_id,
      tool,
      tool_input: summarizeToolInput(tool, toolInput),
      type: `${tool}_BLOCKED`,
      reason: rule.reason,
      delegate: rule.delegate,
      blocked: true,
      timestamp: new Date().toISOString(),
    };
    addViolation(state, violation);
    await appendSessionDelta({ agent_role: 'orchestrator', violation });
    await compactSessionStateIfNeeded({ force: true });
    await logViolation(violation);

    safeRespond({
      decision: 'block',
      reason: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - TOOL BLOCKED                            ║
╠═══════════════════════════════════════════════════════════════════╣
║  Tool: ${String(tool).padEnd(58)}║
║  Reason: ${String(rule.reason).substring(0, 55).padEnd(55)}║
║  Action: Spawn ${rule.delegate} subagent via Task tool${' '.repeat(Math.max(0, 35 - String(rule.delegate).length))}║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim(),
    });
    return;
  }

  if (rule.action === 'CONDITIONAL') {
    const command = String(toolInput.command || '');
    const isBlocked = rule.blocked_patterns.some(pattern => pattern.test(command));
    if (!isBlocked) {
      safeRespond({ decision: 'allow' });
      return;
    }

    const violation = {
      session_id: state.session_id,
      tool,
      tool_input: summarizeToolInput(tool, toolInput),
      type: 'BASH_DANGEROUS_COMMAND',
      reason: rule.reason,
      delegate: rule.delegate,
      blocked: true,
      timestamp: new Date().toISOString(),
    };
    addViolation(state, violation);
    await appendSessionDelta({ agent_role: 'orchestrator', violation });
    await compactSessionStateIfNeeded({ force: true });
    await logViolation(violation);

    safeRespond({
      decision: 'block',
      reason: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - DANGEROUS COMMAND BLOCKED               ║
╠═══════════════════════════════════════════════════════════════════╣
║  Command: ${command.substring(0, 55).padEnd(55)}║
║  Reason: ${String(rule.reason).substring(0, 55).padEnd(55)}║
║  Action: Spawn ${rule.delegate} subagent via Task tool${' '.repeat(Math.max(0, 35 - String(rule.delegate).length))}║
╚═══════════════════════════════════════════════════════════════════╝
      `.trim(),
    });
    return;
  }

  if (rule.action === 'COUNT_LIMITED') {
    state.read_count += 1;

    const filePath = String(toolInput.file_path || '');
    if (filePath) {
      state.files_read.push(filePath.slice(0, MAX_TOOL_INPUT_CHARS));
      if (state.files_read.length > MAX_FILES_READ)
        state.files_read = state.files_read.slice(-MAX_FILES_READ);
    }

    if (state.read_count > rule.max_count) {
      if (isAllowedReadFile(filePath)) {
        await appendSessionDelta({
          agent_role: 'orchestrator',
          read_inc: 1,
          file_read: filePath || undefined,
        });
        await compactSessionStateIfNeeded();
        safeRespond({ decision: 'allow' });
        return;
      }

      const violation = {
        session_id: state.session_id,
        tool,
        tool_input: summarizeToolInput(tool, toolInput),
        type: 'READ_LIMIT_EXCEEDED',
        read_count: state.read_count,
        reason: `${rule.reason} (attempt #${state.read_count})`,
        delegate: rule.delegate,
        blocked: true,
        timestamp: new Date().toISOString(),
      };
      addViolation(state, violation);
      await appendSessionDelta({
        agent_role: 'orchestrator',
        read_inc: 1,
        file_read: filePath || undefined,
        violation,
      });
      await compactSessionStateIfNeeded({ force: true });
      await logViolation(violation);

      safeRespond({
        decision: 'block',
        reason: `
╔═══════════════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION - 2-FILE RULE EXCEEDED                    ║
╠═══════════════════════════════════════════════════════════════════╣
║  Tool: Read (attempt #${String(state.read_count).padEnd(45)}║
║  Reason: ${String(rule.reason).substring(0, 55).padEnd(55)}║
║  Action: Spawn ${rule.delegate} subagent via Task tool${' '.repeat(Math.max(0, 35 - String(rule.delegate).length))}║
╚═══════════════════════════════════════════════════════════════════╝
        `.trim(),
      });
      return;
    }

    await appendSessionDelta({
      agent_role: 'orchestrator',
      read_inc: 1,
      file_read: filePath || undefined,
    });
    await compactSessionStateIfNeeded();
    safeRespond({ decision: 'allow' });
    return;
  }

  safeRespond({ decision: 'allow' });
}

main()
  .catch(error => {
    safeRespond({ decision: 'allow', warning: `Hook error: ${error.message}` });
  })
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_ORCHESTRATOR_HOOK_EXECUTING;
  });
