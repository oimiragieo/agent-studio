#!/usr/bin/env node
/**
 * Router-First Enforcer Hook (PreToolUse) - v1.0.0
 *
 * Enforces that all requests must be routed through the router agent
 * before any other agent can operate. This prevents direct agent
 * invocations that bypass the routing architecture.
 *
 * Fail-Safe: Fail-open (ALLOW) on any unexpected error
 * Performance Target: <50ms execution time
 *
 * Non-negotiables:
 * - Never crash agents (fail-open on unexpected errors)
 * - Persist routing state across hook invocations
 * - Minimal performance overhead (<50ms per call)
 */

import { existsSync } from 'fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getSessionKeyForHook } from './session-key.mjs';
import { logDenialIfBlocking } from './denial-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_TMP_DIR = join(__dirname, '..', 'context', 'tmp');
const TMP_DIR =
  process.env.CLAUDE_HOOK_TMP_DIR ||
  process.env.CLAUDE_TMP_DIR ||
  process.env.CLAUDE_CONTEXT_TMP_DIR ||
  DEFAULT_TMP_DIR;
const ROUTING_SESSIONS_DIR = join(TMP_DIR, 'routing-sessions');
// Legacy path kept for backwards compatibility/debugging (not authoritative).
const LEGACY_SESSION_STATE_PATH = join(TMP_DIR, 'routing-session-state.json');
const ERROR_LOG_PATH = join(__dirname, '..', 'context', 'logs', 'router-enforcement-errors.log');
const ENFORCEMENT_VERSION = '1.0.0';
// Routing/session state must persist for long-running workflows (hours), otherwise the
// router-first gate can deadlock mid-run when the state expires and the router cannot
// safely re-run without user context. We use a sliding TTL refreshed on each write.
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours (sliding)
const STATE_CACHE_TTL_MS = 5000; // 5 seconds

// Prevent double-response
let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // Fail-open: do nothing
  }
}

function respondApprove() {
  safeRespond({ decision: 'approve' });
}

function respondBlock(reason) {
  safeRespond({ decision: 'block', reason });
}

// Recursion protection - prevent hook from triggering itself
if (process.env.CLAUDE_ROUTER_HOOK_EXECUTING === 'true') {
  respondApprove();
  process.exit(0);
}
process.env.CLAUDE_ROUTER_HOOK_EXECUTING = 'true';

// Timeout protection (2 seconds) - force exit with fail-open
const timeout = setTimeout(() => {
  respondApprove();
  delete process.env.CLAUDE_ROUTER_HOOK_EXECUTING;
  process.exit(0);
}, 900);

// Session state cache to reduce disk I/O (per-session file path)
const sessionStateCacheByPath = new Map();

/**
 * Check if bypass environment variable is enabled
 * Allows direct agent access for testing/development
 */
function isBypassEnabled() {
  return process.env.CLAUDE_ROUTER_BYPASS === 'true';
}

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

async function getSessionKey(hookInput) {
  return await getSessionKeyForHook({ hookInput, tmpDir: TMP_DIR });
}

function getSessionStatePath(sessionKey) {
  return join(ROUTING_SESSIONS_DIR, `${safeFileId(sessionKey)}.json`);
}

/**
 * Detect if current agent is the router.
 *
 * Role detection priority:
 * 1) `CLAUDE_AGENT_ROLE` / `CLAUDE_AGENT_NAME` env vars (authoritative)
 * 2) Hook context fields (best-effort)
 */
function isRouterAgent(context) {
  const envRole = String(process.env.CLAUDE_AGENT_ROLE || '').toLowerCase();
  const envName = String(process.env.CLAUDE_AGENT_NAME || '').toLowerCase();
  const envActive = String(
    process.env.CLAUDE_ACTIVE_AGENT ||
      process.env.CLAUDE_CURRENT_AGENT ||
      process.env.CLAUDE_AGENT ||
      process.env.CLAUDE_SUBAGENT_TYPE ||
      ''
  ).toLowerCase();
  if (
    envRole === 'router' ||
    envName === 'router' ||
    envActive === 'router' ||
    envActive.startsWith('router') ||
    envActive.includes(':router')
  ) {
    return true;
  }

  const agentName = String(
    context?.agent_name ||
      context?.agentName ||
      context?.agent ||
      context?.agent_type ||
      context?.agentType ||
      context?.subagent_type ||
      context?.subagentType ||
      context?.subagent ||
      context?.subagent_name ||
      context?.subagentName ||
      ''
  ).toLowerCase();
  const agentRole = String(
    context?.agent_role ||
      context?.role ||
      context?.agentRole ||
      context?.subagent_role ||
      context?.subagentRole ||
      ''
  ).toLowerCase();
  return agentName === 'router' || agentRole === 'router';
}

/**
 * Detect if a Task tool call is attempting to spawn the router agent.
 * Different runtimes may use different parameter names.
 */
function isTaskSpawningRouter(toolName, toolInput) {
  if (normalizeToolName(toolName).toLowerCase() !== 'task') return false;
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    toolInput?.subagent ??
    toolInput?.subagent_name ??
    toolInput?.subagentName ??
    null;
  return typeof raw === 'string' && raw.toLowerCase() === 'router';
}

/**
 * Detect if this tool call is invoking the router directly (non-Task runtimes).
 */
function isDirectRouterTool(toolName) {
  const normalized = normalizeToolName(toolName).toLowerCase();
  return normalized === 'router' || /^router($|\()/.test(normalized);
}

function isTaskSpawningAgent(toolName, toolInput, agentName) {
  if (normalizeToolName(toolName).toLowerCase() !== 'task') return false;
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    toolInput?.subagent ??
    toolInput?.subagent_name ??
    toolInput?.subagentName ??
    null;
  return typeof raw === 'string' && raw.toLowerCase() === String(agentName || '').toLowerCase();
}

function isEquivalentHandoffTarget(target, attempted) {
  const t = String(target || '')
    .trim()
    .toLowerCase();
  const a = String(attempted || '')
    .trim()
    .toLowerCase();
  if (!t || !a) return false;
  if (t === a) return true;
  // Allow the two coordinator flavors to satisfy an orchestrator handoff.
  // This avoids deadlocks where the model tries `master-orchestrator` but routing
  // required `orchestrator` (and vice versa). The master-orchestrator is expected
  // to immediately delegate real execution to orchestrator/worker agents.
  const coordinatorSet = new Set(['orchestrator', 'master-orchestrator']);
  return coordinatorSet.has(t) && coordinatorSet.has(a);
}

function getTaskSpawnTarget(toolName, toolInput) {
  if (normalizeToolName(toolName).toLowerCase() !== 'task') return null;
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    toolInput?.subagent ??
    toolInput?.subagent_name ??
    toolInput?.subagentName ??
    null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function normalizeAgentName(context) {
  const envName = String(process.env.CLAUDE_AGENT_NAME || '').trim();
  if (envName) return envName.toLowerCase();
  const envRole = String(process.env.CLAUDE_AGENT_ROLE || '').trim();
  if (envRole) return envRole.toLowerCase();
  const envActive =
    String(process.env.CLAUDE_ACTIVE_AGENT || '').trim() ||
    String(process.env.CLAUDE_CURRENT_AGENT || '').trim() ||
    String(process.env.CLAUDE_AGENT || '').trim() ||
    String(process.env.CLAUDE_SUBAGENT_TYPE || '').trim();
  if (envActive) return envActive.toLowerCase();

  const fromContext =
    context?.agent_name ??
    context?.agentName ??
    context?.agent ??
    context?.agent_type ??
    context?.agentType ??
    context?.subagent_type ??
    context?.subagentType ??
    context?.subagent ??
    context?.subagent_name ??
    context?.subagentName ??
    context?.role ??
    null;
  if (typeof fromContext === 'string' && fromContext.trim())
    return fromContext.trim().toLowerCase();
  return '';
}

function normalizePathForMatch(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .toLowerCase();
}

function toolInputLooksScopedToClaudeConfig(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;

  const candidates = [
    toolInput.path,
    toolInput.paths,
    toolInput.file_path,
    toolInput.filePath,
    toolInput.filename,
    toolInput.file,
    toolInput.dir,
    toolInput.directory,
    toolInput.cwd,
    toolInput.root,
    toolInput.base,
    toolInput.glob,
    toolInput.searchPath,
    toolInput.search_path,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      if (candidate.toLowerCase().includes('.claude')) return true;
      continue;
    }
    if (Array.isArray(candidate) && candidate.every(v => typeof v === 'string')) {
      if (candidate.some(v => v.toLowerCase().includes('.claude'))) return true;
    }
  }

  // Last-resort: bounded stringify to avoid accidentally scanning huge blobs.
  try {
    const s = JSON.stringify(toolInput);
    if (typeof s === 'string' && s.slice(0, 6000).toLowerCase().includes('.claude')) return true;
  } catch {
    // ignore
  }

  return false;
}

function isAllowedPreRoutingRead(toolName, toolInput) {
  if (normalizeToolName(toolName).toLowerCase() !== 'read') return false;
  const raw =
    toolInput?.path ??
    toolInput?.file_path ??
    toolInput?.filePath ??
    toolInput?.filename ??
    toolInput?.file ??
    null;
  const p = normalizePathForMatch(raw);
  if (!p) return false;

  const isClaudePath = p.startsWith('.claude/') || p.includes('/.claude/');

  // Minimal safe allowlist: router config + schemas needed to route.
  if (
    isClaudePath &&
    (p.endsWith('/.claude/config.yaml') ||
      p.endsWith('/.claude/config.yml') ||
      p === '.claude/config.yaml' ||
      p === '.claude/config.yml')
  ) {
    return true;
  }
  if (isClaudePath && (p.startsWith('.claude/schemas/') || p.includes('/.claude/schemas/')))
    return true;
  if (isClaudePath && (p.endsWith('/.claude/agents/router.md') || p === '.claude/agents/router.md'))
    return true;
  return false;
}

/**
 * Load session state from disk with caching
 */
async function loadSessionState(statePath) {
  try {
    // Check cache first
    const now = Date.now();
    const cached = sessionStateCacheByPath.get(statePath);
    if (cached && now - cached.at < STATE_CACHE_TTL_MS) return cached.state;

    // Read from disk
    if (!existsSync(statePath)) {
      return null;
    }

    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);

    // Check expiration
    if (state.expires_at && new Date(state.expires_at) < new Date()) {
      return null; // Expired session
    }

    // Update cache
    sessionStateCacheByPath.set(statePath, { state, at: now });

    return state;
  } catch (error) {
    // Log error but fail-open
    await logError({
      error_type: 'STATE_READ_ERROR',
      error_message: error.message,
      state_path: statePath,
      recovery_action: 'fail_open',
    });
    return null;
  }
}

function makeTempPath(targetPath) {
  const dir = dirname(targetPath);
  const name = `.${basename(targetPath)}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return join(dir, name);
}

async function atomicWriteJson(targetPath, data) {
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });

  const tmpPath = makeTempPath(targetPath);
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  try {
    await rename(tmpPath, targetPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => {});
    throw error;
  }
}

/**
 * Create initial session state
 */
function createInitialState(sessionKey) {
  const now = new Date();
  return {
    session_key: sessionKey,
    session_id: `sess_${Date.now()}`,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TIMEOUT_MS).toISOString(),
    routing: {
      completed: false,
      started_at: null,
      completed_at: null,
      decision: null,
    },
    routing_history: [],
    metrics: {
      routing_duration_ms: null,
      tokens_used: null,
      model: null,
    },
    version: 1,
    last_compact_ms: Date.now(),
  };
}

/**
 * Save session state to disk
 */
async function saveSessionState(state, fallbackSessionKey) {
  try {
    const now = Date.now();
    state.updated_at = new Date(now).toISOString();
    state.expires_at = new Date(now + SESSION_TIMEOUT_MS).toISOString();
    state.version = (state.version || 0) + 1;

    const keyCandidate = state?.session_key
      ? String(state.session_key)
      : String(fallbackSessionKey ?? '');
    const effectiveSessionKey = keyCandidate.trim() || (await getSessionKey());
    state.session_key = effectiveSessionKey;
    const statePath = getSessionStatePath(effectiveSessionKey);
    await atomicWriteJson(statePath, state);
    // Best-effort mirror (not used for enforcement)
    await atomicWriteJson(LEGACY_SESSION_STATE_PATH, state).catch(() => {});

    // Update cache
    sessionStateCacheByPath.set(statePath, { state, at: Date.now() });
  } catch (error) {
    // Log error but don't fail - write errors are non-blocking
    await logError({
      error_type: 'STATE_WRITE_ERROR',
      error_message: error.message,
      recovery_action: 'continue',
    });
  }
}

/**
 * Generate user-friendly block messages.
 *
 * Keep messages strictly ASCII to avoid mojibake/encoding artifacts in logs and terminals.
 */
function generateNotRoutedBlockMessage(toolName, toolInput) {
  const name = normalizeToolName(toolName);
  const attemptedTarget = getTaskSpawnTarget(name, toolInput);
  const attempted =
    name && attemptedTarget
      ? `Note: blocked tool: Task (attempted spawn: ${attemptedTarget})`
      : name
        ? `Note: blocked tool: ${name}`
        : null;
  return [
    '==============================================================',
    'ROUTER-FIRST ENFORCEMENT - REQUEST MUST BE ROUTED',
    '--------------------------------------------------------------',
    'Your request has not been classified by the router agent yet.',
    'All requests must be routed before processing can begin.',
    attempted ? '' : null,
    attempted,
    '',
    'What to do:',
    '1) Use Task to spawn router (subagent_type: \"router\")',
    '2) Or call the \"router\" tool directly (if available)',
    '3) After routing completes, retry your operation',
    '==============================================================',
  ]
    .filter(Boolean)
    .join('\n');
}

function generateRoutingInProgressBlockMessage(toolName, toolInput) {
  const name = normalizeToolName(toolName);
  const attemptedTarget = getTaskSpawnTarget(name, toolInput);
  const attempted =
    name && attemptedTarget
      ? `Note: blocked tool: Task (attempted spawn: ${attemptedTarget})`
      : name
        ? `Note: blocked tool: ${name}`
        : null;

  const extra =
    name.toLowerCase() === 'grep'
      ? 'Note: Grep is intentionally blocked during routing to prevent high-fanout scans and OOM crashes.'
      : null;

  return [
    '==============================================================',
    'ROUTING IN PROGRESS - LIMITED TOOLING',
    '--------------------------------------------------------------',
    'Routing has started but is not complete yet.',
    'During routing, only safe `.claude/` scoped reads/globs are allowed.',
    attempted ? '' : null,
    attempted,
    extra,
    '',
    'What to do:',
    '1) If you are routing: use Glob scoped to `.claude/` (e.g., `.claude/workflows/*.yaml`) and Read specific files.',
    '2) If you are not routing: wait for routing to complete, then retry.',
    '3) If routing seems stuck: spawn router (subagent_type: \"router\") or restart the session.',
    '==============================================================',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Log error to audit file
 */
async function logError(errorData) {
  try {
    const logDir = dirname(ERROR_LOG_PATH);
    await mkdir(logDir, { recursive: true });

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...errorData,
    };

    const { appendFile } = await import('fs/promises');
    await appendFile(ERROR_LOG_PATH, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch {
    // Fail silently - logging errors should never block execution
  }
}

/**
 * Main hook execution logic
 */
async function main() {
  const startTime = Date.now();

  // Read stdin (Claude Code should close stdin, but don't rely on it)
  const input = await new Promise(resolve => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(chunks.length ? Buffer.concat(chunks).toString('utf-8') : ''), 300);
  });

  // Parse input
  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch (error) {
    respondApprove();
    await logError({
      error_type: 'INVALID_INPUT_JSON',
      error_message: error.message,
      recovery_action: 'fail_open',
    });
    return;
  }

  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  );
  const toolInput =
    hookInput?.tool_input ?? hookInput?.toolInput ?? hookInput?.input ?? hookInput?.params ?? {};
  const context = hookInput?.context ?? hookInput?.ctx ?? {};
  const sessionKey = await getSessionKey(hookInput);
  const statePath = getSessionStatePath(sessionKey);
  const agentName = normalizeAgentName(context);

  // Check bypass mode
  if (isBypassEnabled()) {
    respondApprove();
    return;
  }

  // Allow direct router tool invocation (some runtimes treat agents as tools)
  if (isDirectRouterTool(toolName)) {
    // Load or create state
    let state = await loadSessionState(statePath);
    if (!state) {
      state = createInitialState(sessionKey);
    }

    // Mark routing as started
    if (!state.routing.started_at) {
      state.routing.started_at = new Date().toISOString();
      await saveSessionState(state, sessionKey);
    }

    respondApprove();
    return;
  }

  // Check if this IS the router agent
  if (isRouterAgent(context)) {
    // Load or create state
    let state = await loadSessionState(statePath);
    if (!state) {
      state = createInitialState(sessionKey);
    }

    // Mark routing as started
    if (!state.routing.started_at) {
      state.routing.started_at = new Date().toISOString();
      await saveSessionState(state, sessionKey);
    }

    respondApprove();
    return;
  }

  // Whitelist: Allow Task tool to spawn router agent
  if (isTaskSpawningRouter(toolName, toolInput)) {
    // Load or create state
    let state = await loadSessionState(statePath);
    if (!state) {
      state = createInitialState(sessionKey);
    }

    // Mark routing as started (similar to router agent check)
    // This ensures state consistency when router agent actually runs
    if (!state.routing.started_at) {
      state.routing.started_at = new Date().toISOString();
      await saveSessionState(state, sessionKey);
    }

    respondApprove();
    return;
  }

  // Whitelist: Allow coordination tools (AskUserQuestion, TodoWrite)
  // These tools don't require routing state checks - allow immediately
  const toolNameLower = toolName.toLowerCase();
  if (toolNameLower === 'askuserquestion' || toolNameLower === 'todowrite') {
    respondApprove();
    return;
  }

  // Load session state
  let state = await loadSessionState(statePath);

  // Cross-process coordination:
  // Claude Code can execute different agents in different OS processes. When no stable session id env var
  // is available, our per-session file key may differ between those processes (e.g., different `ppid-*`).
  // To avoid a false "not routed" deadlock, fall back to the legacy mirror if it shows routing completed,
  // then persist that completion state into this process's per-session file.
  if (!state || !state.routing?.completed) {
    const legacy = await loadSessionState(LEGACY_SESSION_STATE_PATH);
    if (legacy?.routing?.completed) {
      state = { ...legacy, session_key: sessionKey };
      await saveSessionState(state, sessionKey);
    }
  }

  // Handle corrupted state
  if (state === null && existsSync(statePath)) {
    // Preserve corrupt state for forensics, then reset.
    try {
      await rename(statePath, `${statePath}.corrupt-${Date.now()}`);
    } catch {
      // ignore
    }
    state = createInitialState(sessionKey);
    await saveSessionState(state, sessionKey);
    const reason =
      generateNotRoutedBlockMessage(toolName, toolInput) +
      '\n\n(Session state was reset due to corruption.)';
    await logDenialIfBlocking({
      hookName: 'router-first-enforcer',
      hookInput,
      decision: 'block',
      reason,
    });
    respondBlock(reason);
    return;
  }

  // No state or routing not completed -> BLOCK
  if (!state || !state.routing?.completed) {
    // Safe allowlist: permit reading routing config/schemas even before routing completes.
    if (isAllowedPreRoutingRead(toolName, toolInput)) {
      respondApprove();
      return;
    }

    // Router detection fallback:
    // Some runtimes omit reliable agent identity for the router subagent. Once routing has started,
    // permit Read/Glob only when clearly scoped to `.claude/` (safe) so routing can proceed.
    if (state?.routing?.started_at) {
      const lower = toolName.toLowerCase();
      if ((lower === 'read' || lower === 'glob') && toolInputLooksScopedToClaudeConfig(toolInput)) {
        respondApprove();
        return;
      }
    }

    // Create initial state if missing
    if (!state) {
      state = createInitialState(sessionKey);
      await saveSessionState(state, sessionKey);
    }

    const reason = state?.routing?.started_at
      ? generateRoutingInProgressBlockMessage(toolName, toolInput)
      : generateNotRoutedBlockMessage(toolName, toolInput);

    await logDenialIfBlocking({
      hookName: 'router-first-enforcer',
      hookInput,
      decision: 'block',
      reason,
    });
    respondBlock(reason);
    return;
  }

  // Post-routing handoff gate:
  // If routing completed with an escalation target, block all non-target tool use
  // until the target has been explicitly spawned/entered. This prevents the default
  // agent from continuing to run tools after routing.
  const handoffTarget =
    typeof state?.routing?.handoff_target === 'string' && state.routing.handoff_target.trim()
      ? state.routing.handoff_target.trim()
      : null;
  const handoffCompleted = Boolean(state?.routing?.handoff_completed);

  if (handoffTarget && !handoffCompleted) {
    const targetLower = handoffTarget.toLowerCase();

    // Allow the target agent itself to run tools, and mark handoff completed.
    if (isEquivalentHandoffTarget(targetLower, agentName)) {
      state.routing.handoff_completed = true;
      state.routing.handoff_actual = agentName;
      await saveSessionState(state, sessionKey);
      respondApprove();
      return;
    }

    const attemptedTaskTarget = getTaskSpawnTarget(toolName, toolInput);

    // Allow Task spawn of the target agent, and mark handoff completed.
    if (
      isTaskSpawningAgent(toolName, toolInput, handoffTarget) ||
      (attemptedTaskTarget && isEquivalentHandoffTarget(handoffTarget, attemptedTaskTarget))
    ) {
      state.routing.handoff_completed = true;
      state.routing.handoff_actual = attemptedTaskTarget ?? null;
      await saveSessionState(state, sessionKey);
      respondApprove();
      return;
    }

    // Allow coordinator tools so the UI can still progress.
    if (toolNameLower === 'askuserquestion' || toolNameLower === 'todowrite') {
      respondApprove();
      return;
    }

    const blockedToolLine = toolName ? `Note: blocked tool: ${toolName}` : null;

    const reason = [
      '==============================================================',
      'ROUTING HANDOFF REQUIRED',
      '--------------------------------------------------------------',
      `Routing is complete, but execution must be handed off to: ${handoffTarget}`,
      attemptedTaskTarget && attemptedTaskTarget.toLowerCase() !== targetLower
        ? `Note: You attempted to spawn: ${attemptedTaskTarget}`
        : null,
      blockedToolLine,
      '',
      'What to do:',
      `1) Use Task to spawn ${handoffTarget} (subagent_type: \"${handoffTarget}\")`,
      '2) Wait for that agent to start running, then continue',
      '==============================================================',
    ]
      .filter(Boolean)
      .join('\n');

    await logDenialIfBlocking({
      hookName: 'router-first-enforcer',
      hookInput,
      decision: 'block',
      reason,
    });
    respondBlock(reason);
    return;
  }

  // Routing completed -> ALLOW
  respondApprove();
}

// Execute with error handling
main()
  .catch(error => {
    respondApprove();
    logError({
      error_type: 'UNEXPECTED_EXCEPTION',
      error_message: error.message,
      stack: error.stack,
      recovery_action: 'fail_open',
    });
  })
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_ROUTER_HOOK_EXECUTING;
  });
