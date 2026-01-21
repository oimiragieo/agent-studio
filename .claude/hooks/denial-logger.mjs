import { existsSync } from 'fs';
import { appendFile, mkdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';
import { getSessionKeyForHook } from './session-key.mjs';
import { resolveRuntimeScope } from '../tools/runtime-scope.mjs';
import { TraceContext } from '../tools/trace-context.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const ERRORS_LOG_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'logs',
  'denial-logger-errors.log'
);
const WARNINGS_LOG_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'logs',
  'denial-logger-warnings.log'
);

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] || '')
    .trim()
    .toLowerCase();
  if (!raw) return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function shouldEmitSideEffects() {
  // Avoid writing into the repo during unit tests that execute hooks directly.
  // Claude Code sets at least one of these env vars; tests can opt-in by setting
  // `CLAUDE_RUNTIME_DIR` or `CLAUDE_PROJECT_DIR`.
  if (process.env.CLAUDE_DENIAL_LOGGER_DISABLE === 'true') return false;
  return Boolean(
    String(process.env.CLAUDE_PROJECT_DIR || '').trim() ||
    String(process.env.CLAUDE_RUNTIME_DIR || '').trim()
  );
}

function redactSensitive(value) {
  if (value == null) return value;
  const text = String(value);
  return text
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_***REDACTED***')
    .replace(
      /GITHUB_PERSONAL_ACCESS_TOKEN\s*=\s*"[^"]+"/g,
      'GITHUB_PERSONAL_ACCESS_TOKEN="***REDACTED***"'
    )
    .replace(
      /GITHUB_PERSONAL_ACCESS_TOKEN\s*=\s*'[^']+'/g,
      "GITHUB_PERSONAL_ACCESS_TOKEN='***REDACTED***'"
    )
    .replace(
      /GITHUB_PERSONAL_ACCESS_TOKEN\s*=\s*[^\s"']+/g,
      'GITHUB_PERSONAL_ACCESS_TOKEN=***REDACTED***'
    );
}

function summarizeRead(toolInput) {
  const raw =
    toolInput?.path ??
    toolInput?.file_path ??
    toolInput?.filePath ??
    toolInput?.filename ??
    toolInput?.file ??
    null;
  if (typeof raw !== 'string' || !raw.trim()) return 'Read';
  const trimmed = raw.trim();
  const short = trimmed.length > 200 ? trimmed.slice(0, 200) + '...' : trimmed;
  try {
    return `Read ${basename(short)}`;
  } catch {
    return `Read ${short}`;
  }
}

function summarizeTool(toolName, toolInput) {
  const lower = normalizeToolName(toolName).toLowerCase();
  if (lower === 'read') return summarizeRead(toolInput);
  return normalizeToolName(toolName) || 'unknown tool';
}

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

function buildTraceFields({ state, sessionKey, runId, agentName, toolName }) {
  try {
    const traceRoot =
      state?.trace?.root && typeof state.trace.root === 'object' ? state.trace.root : null;
    if (!traceRoot) return null;
    const rootCtx = TraceContext.deserialize(traceRoot);
    const agentSpanId =
      state?.trace?.agent_spans && typeof state.trace.agent_spans === 'object'
        ? typeof state.trace.agent_spans[agentName] === 'string'
          ? state.trace.agent_spans[agentName]
          : null
        : null;
    const parentSpanId = agentSpanId || rootCtx.span_id;

    const ctx = new TraceContext({
      trace_id: rootCtx.trace_id,
      parent_span_id: parentSpanId,
      baggage: { session_id: sessionKey, run_id: runId, agent_name: agentName, tool: toolName },
      sampled: rootCtx.sampled,
    });

    return {
      trace_id: ctx.trace_id,
      span_id: ctx.span_id,
      parent_span_id: ctx.parent_span_id,
      traceparent: ctx.traceparent,
      tracestate: null,
      baggage: ctx.baggage,
      span_kind: 'guard',
      event_type: 'GuardDecision',
      span_state: null,
      span_name: 'guard:denial',
    };
  } catch {
    return null;
  }
}

async function appendNdjson(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(obj) + '\n', 'utf-8');
}

async function appendLogLine(path, line) {
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, line + '\n', 'utf-8');
  } catch {
    // ignore
  }
}

async function getSessionKey(hookInput) {
  const tmpDir =
    process.env.CLAUDE_HOOK_TMP_DIR ||
    process.env.CLAUDE_TMP_DIR ||
    process.env.CLAUDE_CONTEXT_TMP_DIR ||
    join(PROJECT_ROOT, '.claude', 'context', 'tmp');

  return await getSessionKeyForHook({ hookInput, tmpDir });
}

export async function recordToolDenial({
  hookName,
  hookInput,
  toolName,
  toolInput,
  decision,
  reason,
  now = new Date().toISOString(),
}) {
  try {
    if (!shouldEmitSideEffects()) return;

    const sessionKey = await getSessionKey(hookInput);
    const runtimeScope = resolveRuntimeScope({ projectRoot: PROJECT_ROOT });
    const runtimeDir = runtimeScope.runtimeDir;

    const sessionsDir = join(runtimeDir, 'sessions');
    const sessionMapPath = join(sessionsDir, `${safeFileId(sessionKey)}.json`);
    const mapping = await readJson(sessionMapPath);
    const runId = typeof mapping?.run_id === 'string' ? mapping.run_id : null;
    const toolEventsDir = resolveDirEnv(
      'CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR',
      join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'tool-events')
    );

    const context = hookInput?.context ?? hookInput?.ctx ?? {};
    const agentName =
      typeof context?.agent_name === 'string'
        ? context.agent_name
        : typeof context?.agentName === 'string'
          ? context.agentName
          : typeof process.env.CLAUDE_AGENT_NAME === 'string'
            ? process.env.CLAUDE_AGENT_NAME
            : 'unknown';

    const event = {
      ts: now,
      phase: 'pre',
      run_id: runId,
      session_key: sessionKey,
      agent: agentName,
      tool: toolName,
      activity: `DENIED: ${summarizeTool(toolName, toolInput)}`,
      ok: false,
      denied: true,
      denial_reason: reason ?? null,
      denied_by: hookName ?? null,
    };

    if (!runId) {
      await appendLogLine(
        WARNINGS_LOG_PATH,
        `${now} [denial-logger] No runId found for session_key=${redactSensitive(sessionKey)}; writing orphan denial`
      );
      const orphanPath = join(toolEventsDir, `orphan-denials.ndjson`);
      await appendNdjson(orphanPath, {
        ...event,
        run_id: null,
        denial_reason: redactSensitive(event.denial_reason),
      }).catch(() => {});
      return;
    }

    const runsDir = join(runtimeDir, 'runs');
    const eventsPath = join(runsDir, runId, 'events.ndjson');
    const toolEventsPath = join(toolEventsDir, `run-${runId}.ndjson`);

    const runStatePath = join(runsDir, runId, 'state.json');
    const runState = await readJson(runStatePath);
    const traceFields = buildTraceFields({
      state: runState,
      sessionKey,
      runId,
      agentName,
      toolName,
    });

    const enriched = {
      ...(traceFields || {}),
      ...event,
      denial_decision: decision ?? null,
      denial_reason: redactSensitive(event.denial_reason),
    };

    await appendNdjson(eventsPath, enriched).catch(() => {});
    await appendNdjson(toolEventsPath, enriched).catch(() => {});

    if (envFlag('CLAUDE_OBS_FAILURE_BUNDLES', false)) {
      try {
        const { generateFailureBundle } = await import('../tools/failure-bundle.mjs');
        await generateFailureBundle({
          traceId: enriched.trace_id || null,
          spanId: enriched.span_id || null,
          runId,
          sessionKey,
          failureType: String(decision || 'deny').toLowerCase(),
          triggerEvent: enriched,
        });
      } catch {
        // ignore
      }
    }
  } catch (error) {
    await appendLogLine(
      ERRORS_LOG_PATH,
      `${new Date().toISOString()} ERROR: ${redactSensitive(error?.message || error)}`
    );
  }
}

export async function logDenialIfBlocking({ hookName, hookInput, decision, reason }) {
  try {
    const normalized = String(decision || '').toLowerCase();
    if (normalized !== 'block' && normalized !== 'deny') return;
    const toolName = normalizeToolName(
      hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
    );
    const toolInput =
      hookInput?.tool_input ?? hookInput?.toolInput ?? hookInput?.input ?? hookInput?.params ?? {};
    await recordToolDenial({
      hookName,
      hookInput,
      toolName,
      toolInput,
      decision: normalized,
      reason,
    });
  } catch (error) {
    await appendLogLine(
      ERRORS_LOG_PATH,
      `${new Date().toISOString()} [${hookName || 'unknown-hook'}] ERROR: ${redactSensitive(error?.message || error)}`
    );
  }
}
