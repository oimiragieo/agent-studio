#!/usr/bin/env node
/**
 * Run Observer Hook (PreToolUse/PostToolUse)
 *
 * Goal: durable observability for long-running agent workflows.
 * - Creates/updates `.claude/context/runtime/runs/<runId>/state.json`
 * - Appends event log `.claude/context/runtime/runs/<runId>/events.ndjson`
 * - Maintains session->run mapping in `.claude/context/runtime/sessions/`
 *
 * This is intentionally lightweight and fail-open: it never blocks tools.
 *
 * Usage (from Claude Code hooks):
 *   node .claude/hooks/run-observer.mjs pre
 *   node .claude/hooks/run-observer.mjs post
 */

import { existsSync } from 'fs';
import { appendFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import { basename, dirname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';
import { getSessionKeyForHook } from './session-key.mjs';
import { resolveRuntimeScope } from '../tools/runtime-scope.mjs';
import { TraceContext } from '../tools/trace-context.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] || '')
    .trim()
    .toLowerCase();
  if (!raw) return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

const RUNTIME_SCOPE = resolveRuntimeScope({ projectRoot: PROJECT_ROOT });
const RUNTIME_DIR = RUNTIME_SCOPE.runtimeDir;
const RUNS_DIR = join(RUNTIME_DIR, 'runs');
const SESSIONS_DIR = join(RUNTIME_DIR, 'sessions');
const LAST_RUN_PATH = join(RUNTIME_DIR, 'last-run.json');
const AGENT_ARTIFACTS_DIR = resolveDirEnv(
  'CLAUDE_AGENT_ARTIFACTS_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'agents')
);
const TOOL_EVENTS_ARTIFACTS_DIR = resolveDirEnv(
  'CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'tool-events')
);
const ROUTING_HANDOFF_ARTIFACTS_DIR = resolveDirEnv(
  'CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'artifacts', 'routing-handoff')
);
const ROUTING_TMP_DIR = resolveDirEnv(
  'CLAUDE_HOOK_TMP_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'tmp')
);
const ROUTING_STATE_LEGACY_PATH = join(ROUTING_TMP_DIR, 'routing-session-state.json');
const ROUTING_SESSIONS_DIR = join(ROUTING_TMP_DIR, 'routing-sessions');
const DEBUG_LOG_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'logs',
  'run-observer-debug.ndjson'
);

const OBS_STORE_PAYLOADS = envFlag('CLAUDE_OBS_STORE_PAYLOADS', false);
const OBS_FAILURE_BUNDLES = envFlag('CLAUDE_OBS_FAILURE_BUNDLES', false);

const DEFAULT_STALE_MS = 30 * 60 * 1000;
const MAX_TOOL_RESULT_SAMPLE_CHARS = 4096;
const PENDING_SUBAGENT_TTL_MS = (() => {
  const override = Number(process.env.CLAUDE_PENDING_SUBAGENT_TTL_MS);
  if (Number.isFinite(override) && override >= 0) return override;
  return 3 * 60 * 1000; // 3 minutes
})();

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

// Guard against accidental recursion within the same process.
// (Cross-process env leakage should not disable the hook.)
if (process.env.CLAUDE_RUN_OBSERVER_EXECUTING === String(process.pid)) {
  safeRespond({ decision: 'approve' });
  process.exit(0);
}
process.env.CLAUDE_RUN_OBSERVER_EXECUTING = String(process.pid);

const timeout = setTimeout(() => {
  safeRespond({ decision: 'approve' });
  delete process.env.CLAUDE_RUN_OBSERVER_EXECUTING;
  process.exit(0);
}, 700);

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function truncateText(value, maxChars) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (!Number.isFinite(maxChars) || maxChars <= 0) return '';
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function normalizeAgentName(context) {
  const envName = String(process.env.CLAUDE_AGENT_NAME || '').trim();
  if (envName) return envName;
  const envRole = String(process.env.CLAUDE_AGENT_ROLE || '').trim();
  if (envRole) return envRole;
  const envActive =
    String(process.env.CLAUDE_ACTIVE_AGENT || '').trim() ||
    String(process.env.CLAUDE_CURRENT_AGENT || '').trim() ||
    String(process.env.CLAUDE_AGENT || '').trim();
  if (envActive) return envActive;
  const fromContext =
    context?.agent_name ?? context?.agentName ?? context?.agent ?? context?.role ?? null;
  if (typeof fromContext === 'string' && fromContext.trim()) return fromContext.trim();
  return 'unknown';
}

async function getSessionKey(hookInput) {
  return await getSessionKeyForHook({ hookInput, tmpDir: ROUTING_TMP_DIR });
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
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

async function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

function isRouterDelegation(toolName, toolInput) {
  const lower = normalizeToolName(toolName).toLowerCase();
  if (lower === 'router' || /^router($|\()/.test(lower)) return true;
  if (lower !== 'task') return false;
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    null;
  return typeof raw === 'string' && raw.toLowerCase() === 'router';
}

function summarizeTask(toolInput) {
  const agent =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    null;
  const desc =
    toolInput?.description ?? toolInput?.objective ?? toolInput?.task ?? toolInput?.prompt ?? '';
  const agentPart = typeof agent === 'string' && agent.trim() ? `spawn ${agent.trim()}` : 'Task';
  const descPart = typeof desc === 'string' ? desc.replace(/\s+/g, ' ').trim().slice(0, 140) : '';
  return descPart ? `${agentPart}: ${descPart}` : agentPart;
}

function extractDelegatedAgent(toolInput) {
  const raw =
    toolInput?.subagent_type ??
    toolInput?.subagentType ??
    toolInput?.agent ??
    toolInput?.agent_name ??
    toolInput?.agentName ??
    null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

function extractPromptSummary(toolInput) {
  const raw =
    toolInput?.description ?? toolInput?.objective ?? toolInput?.task ?? toolInput?.prompt ?? null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

function extractToolResultSample(toolResult) {
  try {
    if (toolResult == null) return null;
    if (typeof toolResult === 'string') return toolResult.slice(0, 2000);
    if (typeof toolResult === 'object') return JSON.stringify(toolResult).slice(0, 2000);
    return String(toolResult).slice(0, 2000);
  } catch {
    return null;
  }
}

async function maybeWriteAgentTaskArtifact({
  phase,
  toolName,
  toolInput,
  toolResult,
  failure,
  sessionKey,
  runId,
  runDir,
  statePath,
  eventsPath,
  invokerAgentName,
  delegatedAgentName,
  now,
  activity,
}) {
  try {
    if (phase !== 'post') return;
    if (normalizeToolName(toolName).toLowerCase() !== 'task') return;
    if (!delegatedAgentName) return;

    const sessionDir = join(AGENT_ARTIFACTS_DIR, safeFileId(sessionKey));
    const filename = `${Date.now()}-${safeFileId(delegatedAgentName)}.json`;
    const artifactPath = join(sessionDir, filename);

    await atomicWriteJson(artifactPath, {
      schema_version: 1,
      artifact_type: 'agent_task_completion',
      created_at: now,
      run_id: runId,
      session_key: sessionKey,
      invoker_agent: invokerAgentName ?? null,
      delegated_agent: delegatedAgentName,
      activity,
      tool_name: toolName,
      prompt_summary: extractPromptSummary(toolInput),
      ok: !failure,
      failure: failure ?? null,
      tool_result_sample: extractToolResultSample(toolResult),
      paths: {
        run_dir: runDir,
        run_state_path: statePath,
        run_events_path: eventsPath,
      },
    });
  } catch {
    // ignore (fail-open)
  }
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
  if (lower === 'task') return summarizeTask(toolInput);
  if (lower === 'read') return summarizeRead(toolInput);
  if (lower === 'todowrite') return 'TodoWrite update';
  if (lower === 'askuserquestion') return 'AskUserQuestion';
  if (lower === 'router' || /^router($|\()/.test(lower)) return 'Router classification';
  return normalizeToolName(toolName) || 'unknown tool';
}

function detectFailure(toolResult) {
  if (!toolResult) return null;
  if (typeof toolResult === 'object') {
    if (typeof toolResult.error === 'string' && toolResult.error.trim())
      return toolResult.error.trim();
    if (typeof toolResult.message === 'string' && /error/i.test(toolResult.message))
      return toolResult.message;
    return null;
  }
  const text = String(toolResult);
  if (/PreToolUse:.*hook error/i.test(text)) return 'PreToolUse hook error';
  if (/FATAL ERROR/i.test(text)) return 'Fatal error';
  if (/error/i.test(text) && text.length < 500) return text;
  return null;
}

async function parseHookInputStreaming({ phase, timeoutMs = 350 } = {}) {
  // Best-effort, low-memory extraction of the fields we need from hook stdin.
  // We intentionally avoid buffering and stop early once we have enough.
  let streamJson = null;
  try {
    const mod = await import('stream-json');
    streamJson = mod?.default ?? mod;
  } catch {
    streamJson = null;
  }

  if (!streamJson?.parser) return null;

  const { parser } = streamJson;
  const p = parser({ packStrings: false, packKeys: true });

  const extracted = {
    tool_name: null,
    context: {},
    tool_input: {},
    tool_result: null,
  };

  let depth = 0;
  let rootKey = null;
  let activeObjectKey = null;
  let activeObjectDepth = null;
  let activeSubKey = null;
  let activeStringDest = null;

  let toolResultSample = '';

  const stop = () => {
    try {
      process.stdin.unpipe(p);
    } catch {
      // ignore
    }
    try {
      process.stdin.destroy();
    } catch {
      // ignore
    }
    try {
      p.end();
    } catch {
      // ignore
    }
  };

  const shouldStopNow = () => {
    if (!extracted.tool_name) return false;
    const hasContext =
      Object.keys(extracted.context || {}).length > 0 ||
      Boolean(process.env.CLAUDE_AGENT_NAME || process.env.CLAUDE_AGENT_ROLE);
    const hasToolInput = Object.keys(extracted.tool_input || {}).length > 0;
    const phaseLower = String(phase || '').toLowerCase();
    const needsToolResult = phaseLower === 'post';
    if (!needsToolResult) return hasContext && hasToolInput;

    // For PostToolUse: stop if we have either (a) an explicit error/message, or (b) a sample.
    const tr = extracted.tool_result;
    const hasError =
      tr &&
      typeof tr === 'object' &&
      (typeof tr.error === 'string' || typeof tr.message === 'string');
    const hasSample = typeof tr === 'string' && tr.length > 0;

    return (hasContext || hasToolInput) && (hasError || hasSample);
  };

  const captureInToolInput = (key, value) => {
    if (typeof value !== 'string') return;
    if (!value.trim()) return;
    extracted.tool_input[key] = value;
  };

  const captureInContext = (key, value) => {
    if (typeof value !== 'string') return;
    if (!value.trim()) return;
    extracted.context[key] = value;
  };

  const captureToolResultField = (key, value) => {
    if (typeof value !== 'string') return;
    if (!value.trim()) return;
    extracted.tool_result =
      extracted.tool_result && typeof extracted.tool_result === 'object'
        ? extracted.tool_result
        : {};
    extracted.tool_result[key] = value;
  };

  p.on('data', token => {
    switch (token.name) {
      case 'startObject':
        depth += 1;
        if (depth === 2 && rootKey && ['tool_input', 'context', 'tool_result'].includes(rootKey)) {
          activeObjectKey = rootKey;
          activeObjectDepth = depth;
        }
        break;
      case 'endObject':
        if (activeObjectKey && activeObjectDepth === depth) {
          activeObjectKey = null;
          activeObjectDepth = null;
          activeSubKey = null;
        }
        depth -= 1;
        break;
      case 'startArray':
        depth += 1;
        break;
      case 'endArray':
        depth -= 1;
        break;
      case 'keyValue':
        if (depth === 1) {
          rootKey = token.value;
          activeSubKey = null;
        } else if (activeObjectKey && depth === activeObjectDepth) {
          activeSubKey = token.value;
        }
        break;
      case 'startString':
        // Determine where string chunks should go.
        if (depth === 1 && rootKey === 'tool_name') {
          activeStringDest = 'tool_name';
        } else if (depth === 1 && rootKey === 'tool_result') {
          activeStringDest = 'tool_result_sample';
        } else if (activeObjectKey === 'tool_input' && depth === activeObjectDepth) {
          activeStringDest = `tool_input.${activeSubKey || ''}`;
        } else if (activeObjectKey === 'context' && depth === activeObjectDepth) {
          activeStringDest = `context.${activeSubKey || ''}`;
        } else if (activeObjectKey === 'tool_result' && depth === activeObjectDepth) {
          activeStringDest = `tool_result.${activeSubKey || ''}`;
        } else {
          activeStringDest = null;
        }
        break;
      case 'stringChunk': {
        if (!activeStringDest) break;
        const chunk = token.value ?? '';
        if (activeStringDest === 'tool_name') {
          extracted.tool_name = (extracted.tool_name || '') + chunk;
        } else if (activeStringDest === 'tool_result_sample') {
          if (toolResultSample.length < MAX_TOOL_RESULT_SAMPLE_CHARS) {
            toolResultSample += chunk;
            if (toolResultSample.length > MAX_TOOL_RESULT_SAMPLE_CHARS) {
              toolResultSample = toolResultSample.slice(0, MAX_TOOL_RESULT_SAMPLE_CHARS);
            }
          }
        } else if (activeStringDest.startsWith('tool_input.')) {
          const key = activeStringDest.slice('tool_input.'.length);
          const allowedKeys = new Set([
            'subagent_type',
            'subagentType',
            'agent',
            'agent_name',
            'agentName',
            'description',
            'objective',
            'task',
            'prompt',
            'path',
            'file_path',
            'filePath',
            'filename',
          ]);
          if (allowedKeys.has(key)) {
            captureInToolInput(key, (extracted.tool_input[key] || '') + chunk);
          }
        } else if (activeStringDest.startsWith('context.')) {
          const key = activeStringDest.slice('context.'.length);
          const allowedKeys = new Set([
            'agent_name',
            'agentName',
            'agent',
            'role',
            'agent_role',
            'session_id',
            'sessionId',
            'conversation_id',
            'conversationId',
          ]);
          if (allowedKeys.has(key)) {
            captureInContext(key, (extracted.context[key] || '') + chunk);
          }
        } else if (activeStringDest.startsWith('tool_result.')) {
          const key = activeStringDest.slice('tool_result.'.length);
          if (key === 'error' || key === 'message') {
            const existing =
              extracted.tool_result && typeof extracted.tool_result === 'object'
                ? extracted.tool_result[key] || ''
                : '';
            captureToolResultField(key, existing + chunk);
          }
        }
        break;
      }
      case 'endString':
        if (activeStringDest === 'tool_result_sample') {
          extracted.tool_result = truncateText(toolResultSample, MAX_TOOL_RESULT_SAMPLE_CHARS);
        }
        activeStringDest = null;
        if (shouldStopNow()) stop();
        break;
      default:
        break;
    }
  });

  return await new Promise(resolve => {
    const done = () => resolve(extracted);
    const timer = setTimeout(() => {
      stop();
      resolve(extracted);
    }, timeoutMs);
    p.once('end', () => {
      clearTimeout(timer);
      done();
    });
    p.once('error', () => {
      clearTimeout(timer);
      resolve(extracted);
    });

    process.stdin.pipe(p);
  });
}

async function parseHookInputFallback(timeoutMs = 200) {
  // Fallback for environments without node_modules: read a small prefix and try to extract minimally.
  const stdin = await new Promise(resolve => {
    const chunks = [];
    let bytes = 0;
    const MAX_BYTES = 256 * 1024;
    process.stdin.on('data', chunk => {
      if (!chunk) return;
      bytes += chunk.length;
      if (bytes <= MAX_BYTES) chunks.push(chunk);
      if (bytes > MAX_BYTES) {
        try {
          process.stdin.destroy();
        } catch {
          // ignore
        }
      }
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(
      () => resolve(chunks.length ? Buffer.concat(chunks).toString('utf-8') : ''),
      timeoutMs
    );
  });

  if (!stdin || !stdin.trim()) return null;

  try {
    return JSON.parse(stdin);
  } catch {
    const toolNameMatch = stdin.match(/\"tool_name\"\s*:\s*\"([^\"]+)\"/i);
    return {
      tool_name: toolNameMatch ? toolNameMatch[1] : null,
      tool_input: {},
      tool_result: truncateText(stdin, MAX_TOOL_RESULT_SAMPLE_CHARS),
      context: {},
    };
  }
}

async function ensureRunForSession(sessionKey) {
  await mkdir(RUNS_DIR, { recursive: true });
  await mkdir(SESSIONS_DIR, { recursive: true });

  const sessionFile = join(SESSIONS_DIR, `${safeFileId(sessionKey)}.json`);
  const existing = await readJson(sessionFile);
  if (existing?.run_id && typeof existing.run_id === 'string') {
    return { runId: existing.run_id, sessionFile };
  }

  const runId = `agent-${randomUUID()}`;
  const mapping = {
    session_key: sessionKey,
    run_id: runId,
    created_at: new Date().toISOString(),
    stale_after_ms: DEFAULT_STALE_MS,
  };
  await atomicWriteJson(sessionFile, mapping);
  return { runId, sessionFile };
}

async function ensureRunState(runId) {
  const runDir = join(RUNS_DIR, runId);
  const statePath = join(runDir, 'state.json');
  const eventsPath = join(runDir, 'events.ndjson');
  const pendingPath = join(runDir, 'pending-tools.json');

  await mkdir(runDir, { recursive: true });

  let state = await readJson(statePath);
  if (!state) {
    const now = new Date().toISOString();
    state = {
      run_id: runId,
      workflow_name: null,
      status: 'running',
      total_steps: null,
      current_step: 0,
      current_agent: null,
      current_activity: null,
      started_at: now,
      last_heartbeat_at: now,
      last_event_at: now,
      events_count: 0,
      errors: [],
      routing: null,
      metadata: {
        created_by: 'run-observer',
        created_at: now,
      },
    };
    await atomicWriteJson(statePath, state);
  }

  return { runDir, statePath, eventsPath, pendingPath, state };
}

async function readJsonFile(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function readPendingQueue(pendingPath) {
  const pending = (await readJsonFile(pendingPath)) || {};
  if (!pending || typeof pending !== 'object') return {};
  return pending;
}

async function writePendingQueue(pendingPath, pending) {
  try {
    await atomicWriteJson(pendingPath, pending);
  } catch {
    // ignore
  }
}

function safeNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatMs(ms) {
  const n = safeNumber(ms, 0);
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

function topByTotalMs(obj, topN = 8) {
  const entries = Object.entries(obj || {}).map(([k, v]) => [k, v]);
  entries.sort((a, b) => safeNumber(b[1]?.total_ms, 0) - safeNumber(a[1]?.total_ms, 0));
  return entries.slice(0, Math.max(0, Math.min(25, topN)));
}

async function writeRunSummary(runDir, state) {
  try {
    const path = join(runDir, 'summary.md');
    const now = state?.last_event_at || new Date().toISOString();
    const startedAt = Date.parse(String(state?.started_at || ''));
    const lastAt = Date.parse(String(state?.last_event_at || ''));
    const durationMs =
      Number.isFinite(startedAt) && Number.isFinite(lastAt)
        ? Math.max(0, lastAt - startedAt)
        : null;

    const metrics = state?.metrics && typeof state.metrics === 'object' ? state.metrics : {};
    const tools = metrics.tools && typeof metrics.tools === 'object' ? metrics.tools : {};
    const agents = metrics.agents && typeof metrics.agents === 'object' ? metrics.agents : {};

    const lines = [];
    lines.push(`# Run Summary`);
    lines.push(`- Run ID: \`${state?.run_id || ''}\``);
    lines.push(`- Status: \`${state?.status || 'unknown'}\``);
    lines.push(`- Current Agent: \`${state?.current_agent || 'unknown'}\``);
    lines.push(`- Activity: ${state?.current_activity || ''}`);
    lines.push(`- Updated: ${now}`);
    if (durationMs != null) lines.push(`- Duration: ${formatMs(durationMs)}`);
    lines.push('');

    const errors = Array.isArray(state?.errors) ? state.errors : [];
    if (errors.length) {
      lines.push(`## Recent Errors`);
      for (const e of errors.slice(-5)) {
        lines.push(
          `- ${e?.at || ''} \`${e?.agent || ''}\` \`${e?.tool || ''}\`: ${String(e?.message || '').slice(0, 200)}`.trim()
        );
      }
      lines.push('');
    }

    lines.push(`## Metrics`);
    lines.push(`- Tool Calls: ${safeNumber(metrics.total_tool_calls, 0)}`);
    lines.push(`- Tool Time: ${formatMs(safeNumber(metrics.total_tool_duration_ms, 0))}`);
    if (metrics.last_tool) {
      lines.push(
        `- Last Tool: \`${metrics.last_tool}\` (\`${metrics.last_tool_agent || 'unknown'}\`) ${formatMs(safeNumber(metrics.last_tool_duration_ms, 0))}`
      );
    }
    lines.push('');

    const topTools = topByTotalMs(tools, 8);
    if (topTools.length) {
      lines.push(`## Top Tools`);
      for (const [name, v] of topTools) {
        lines.push(
          `- \`${name}\`: ${formatMs(safeNumber(v?.total_ms, 0))} (${safeNumber(v?.count, 0)} calls, max ${formatMs(safeNumber(v?.max_ms, 0))})`
        );
      }
      lines.push('');
    }

    const topAgents = topByTotalMs(agents, 8);
    if (topAgents.length) {
      lines.push(`## Top Agents`);
      for (const [name, v] of topAgents) {
        lines.push(
          `- \`${name}\`: ${formatMs(safeNumber(v?.total_ms, 0))} (${safeNumber(v?.count, 0)} calls, max ${formatMs(safeNumber(v?.max_ms, 0))})`
        );
      }
      lines.push('');
    }

    await writeFile(path, lines.join('\n'), 'utf-8');
  } catch {
    // ignore
  }
}

function pendingKey(agentName, toolName) {
  const agent = typeof agentName === 'string' && agentName.trim() ? agentName.trim() : 'unknown';
  const tool = typeof toolName === 'string' && toolName.trim() ? toolName.trim() : 'unknown';
  return `${agent}:${tool}`;
}

function ensureMetrics(state) {
  const next = { ...state };
  next.metrics = next.metrics && typeof next.metrics === 'object' ? next.metrics : {};
  next.metrics.tools =
    next.metrics.tools && typeof next.metrics.tools === 'object' ? next.metrics.tools : {};
  next.metrics.agents =
    next.metrics.agents && typeof next.metrics.agents === 'object' ? next.metrics.agents : {};
  next.metrics.total_tool_calls = Number.isFinite(next.metrics.total_tool_calls)
    ? next.metrics.total_tool_calls
    : 0;
  next.metrics.total_tool_duration_ms = Number.isFinite(next.metrics.total_tool_duration_ms)
    ? next.metrics.total_tool_duration_ms
    : 0;
  return next;
}

function recordToolMetric(state, { agentName, toolName, durationMs }) {
  const next = ensureMetrics(state);
  const safeTool = normalizeToolName(toolName) || 'unknown';
  const safeAgent = normalizeAgentName({ agent_name: agentName }) || 'unknown';

  next.metrics.total_tool_calls += 1;
  if (Number.isFinite(durationMs) && durationMs >= 0)
    next.metrics.total_tool_duration_ms += durationMs;

  const toolEntry = next.metrics.tools[safeTool] || {
    count: 0,
    total_ms: 0,
    max_ms: 0,
    last_ms: null,
  };
  toolEntry.count += 1;
  if (Number.isFinite(durationMs) && durationMs >= 0) {
    toolEntry.total_ms += durationMs;
    toolEntry.max_ms = Math.max(toolEntry.max_ms || 0, durationMs);
    toolEntry.last_ms = durationMs;
  }
  next.metrics.tools[safeTool] = toolEntry;

  const agentEntry = next.metrics.agents[safeAgent] || {
    count: 0,
    total_ms: 0,
    max_ms: 0,
    last_ms: null,
  };
  agentEntry.count += 1;
  if (Number.isFinite(durationMs) && durationMs >= 0) {
    agentEntry.total_ms += durationMs;
    agentEntry.max_ms = Math.max(agentEntry.max_ms || 0, durationMs);
    agentEntry.last_ms = durationMs;
  }
  next.metrics.agents[safeAgent] = agentEntry;

  // keep metrics bounded
  const limit = Number(process.env.CLAUDE_RUN_OBSERVER_METRICS_MAX_KEYS || 60);
  const maxKeys = Number.isFinite(limit) && limit > 10 ? limit : 60;
  const prune = obj => {
    const keys = Object.keys(obj || {});
    if (keys.length <= maxKeys) return obj;
    const sorted = keys.sort((a, b) => (obj[b]?.total_ms || 0) - (obj[a]?.total_ms || 0));
    const keep = new Set(sorted.slice(0, maxKeys));
    const out = {};
    for (const k of keep) out[k] = obj[k];
    return out;
  };
  next.metrics.tools = prune(next.metrics.tools);
  next.metrics.agents = prune(next.metrics.agents);

  next.metrics.last_tool_duration_ms = Number.isFinite(durationMs) ? durationMs : null;
  next.metrics.last_tool = safeTool;
  next.metrics.last_tool_agent = safeAgent;
  next.metrics.last_tool_at = new Date().toISOString();

  return next;
}

async function maybeIngestRoutingDecision(state, sessionKey) {
  const perSessionPath = join(ROUTING_SESSIONS_DIR, `${safeFileId(sessionKey)}.json`);
  const routingState =
    (await readJson(perSessionPath)) ?? (await readJson(ROUTING_STATE_LEGACY_PATH));
  if (!routingState?.routing?.completed || !routingState?.routing?.decision) return state;

  const decision = routingState.routing.decision;
  const workflowSelection = decision.workflow_selection || decision.workflow || null;
  const workflowName =
    typeof workflowSelection === 'string' && workflowSelection.trim()
      ? workflowSelection.trim()
      : null;

  const next = { ...state };
  next.routing = {
    ...decision,
    completed_at: routingState.routing.completed_at || null,
    handoff_target: routingState.routing.handoff_target || null,
    handoff_completed: Boolean(routingState.routing.handoff_completed),
  };
  if (!next.workflow_name && workflowName) next.workflow_name = workflowName;
  return next;
}

async function readTailText(path, { maxBytes = 256 * 1024 } = {}) {
  try {
    if (!existsSync(path)) return '';
    const st = await stat(path);
    if (!st.isFile() || st.size <= 0) return '';
    const start = Math.max(0, st.size - maxBytes);
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(st.size - start);
      const { bytesRead } = await fh.read(buf, 0, buf.length, start);
      return buf.slice(0, bytesRead).toString('utf8');
    } finally {
      await fh.close().catch(() => {});
    }
  } catch {
    return '';
  }
}

async function maybeRecordRoutingHandoffOutcome({
  phase,
  toolName,
  toolInput,
  sessionKey,
  runId,
  now,
  state,
}) {
  try {
    if (phase !== 'post') return state;
    if (normalizeToolName(toolName).toLowerCase() !== 'task') return state;

    const delegated = extractDelegatedAgent(toolInput);
    if (!delegated) return state;

    const routing = state?.routing;
    const handoffTarget =
      typeof routing?.handoff_target === 'string' && routing.handoff_target.trim()
        ? routing.handoff_target.trim()
        : typeof routing?.escalation_target === 'string' && routing.escalation_target.trim()
          ? routing.escalation_target.trim()
          : null;
    const shouldEscalate = Boolean(routing?.should_escalate);
    if (!shouldEscalate || !handoffTarget) return state;
    if (delegated.trim().toLowerCase() !== handoffTarget.toLowerCase()) return state;

    const toolEventsPath = join(TOOL_EVENTS_ARTIFACTS_DIR, `run-${runId}.ndjson`);
    const tail = await readTailText(toolEventsPath);
    const denialSeen =
      /ROUTING HANDOFF REQUIRED/.test(tail) &&
      /\"denied\"\s*:\s*true/.test(tail) &&
      /\"denied_by\"\s*:\s*\"router-first-enforcer\"/.test(tail);

    const outcome = denialSeen ? 'fallback' : 'proactive';

    const next = { ...state };
    next.metrics = next.metrics || {};
    next.metrics.routing_handoff = {
      target: handoffTarget,
      outcome,
      denial_seen: Boolean(denialSeen),
      observed_at: now,
      delegated_agent: delegated,
      routing_completed_at: routing?.completed_at || null,
    };

    const artifactPath = join(ROUTING_HANDOFF_ARTIFACTS_DIR, `run-${runId}.json`);
    await atomicWriteJson(artifactPath, {
      schema_version: 1,
      artifact_type: 'routing_handoff_outcome',
      created_at: now,
      run_id: runId,
      session_key: sessionKey,
      routing_completed_at: routing?.completed_at || null,
      handoff_target: handoffTarget,
      delegated_agent: delegated,
      outcome,
      denial_seen: Boolean(denialSeen),
      signals: {
        denial_marker: 'ROUTING HANDOFF REQUIRED',
        denial_source: 'tool-events tail scan',
      },
    });

    return next;
  } catch {
    return state;
  }
}

async function writeEvent(eventsPath, event) {
  await maybeRotateEvents(eventsPath);
  const line = JSON.stringify(event);
  await appendFile(eventsPath, line + '\n', 'utf-8');
}

function pickWorkflowBaggage(state) {
  const workflowId =
    typeof state?.workflow_name === 'string' && state.workflow_name.trim()
      ? state.workflow_name.trim()
      : null;
  const workflowStep = Number.isFinite(state?.current_step) ? String(state.current_step) : null;
  return { workflow_id: workflowId, workflow_step: workflowStep };
}

function spanKindForEvent({ phase, toolName, agentName, toolPath }) {
  const lowerTool = normalizeToolName(toolName).toLowerCase();
  const lowerAgent = String(agentName || '').toLowerCase();

  if (phase === 'subagent_start' || phase === 'subagent_stop') return 'agent';
  if (phase === 'stop') return 'chain';

  if (lowerAgent === 'router') return 'router';
  if (lowerTool === 'task') return 'agent';

  if (lowerTool === 'read' || lowerTool === 'write' || lowerTool === 'edit') {
    if (typeof toolPath === 'string' && toolPath.replace(/\\/g, '/').includes('/.claude/context/'))
      return 'artifact';
    return 'tool';
  }

  if (
    lowerTool === 'grep' ||
    lowerTool === 'glob' ||
    lowerTool === 'search' ||
    lowerTool === 'bash'
  )
    return 'tool';

  return 'chain';
}

function eventTypeFor({ phase, toolName }) {
  const lowerTool = normalizeToolName(toolName).toLowerCase();
  if (phase === 'subagent_start') return 'AgentStart';
  if (phase === 'subagent_stop') return 'AgentStop';
  if (phase === 'stop') return 'SpanEnd';
  if (phase === 'pre' && lowerTool) return lowerTool === 'task' ? 'Handoff' : 'ToolCallStart';
  if (phase === 'post' && lowerTool) return lowerTool === 'task' ? 'Handoff' : 'ToolCallStop';
  return phase === 'pre' ? 'SpanStart' : 'SpanEnd';
}

function spanStateFor({ phase }) {
  if (phase === 'pre' || phase === 'subagent_start') return 'start';
  if (phase === 'post' || phase === 'subagent_stop' || phase === 'stop') return 'end';
  return null;
}

function spanNameFor({ spanKind, toolName, agentName }) {
  const tool = normalizeToolName(toolName);
  const agent = String(agentName || '').trim();
  if (spanKind === 'agent') return agent ? `agent:${agent}` : 'agent';
  if (spanKind === 'router') return 'router';
  if (spanKind === 'tool') return tool ? `tool:${tool}` : 'tool';
  if (spanKind === 'artifact') return tool ? `artifact:${tool}` : 'artifact';
  return tool || agent || spanKind || 'span';
}

function getPathFromToolInput(toolInput) {
  const raw =
    toolInput?.path ??
    toolInput?.file_path ??
    toolInput?.filePath ??
    toolInput?.filename ??
    toolInput?.file ??
    null;
  return typeof raw === 'string' ? raw : null;
}

let rotateCounter = 0;
async function maybeRotateEvents(eventsPath) {
  const disabled = String(process.env.CLAUDE_RUN_OBSERVER_ROTATION_DISABLED || '').trim();
  if (disabled === '1' || disabled.toLowerCase() === 'true') return;

  rotateCounter += 1;
  const rotateEveryRaw = Number(process.env.CLAUDE_RUN_OBSERVER_ROTATE_EVERY || 200);
  const rotateEvery = Number.isFinite(rotateEveryRaw) && rotateEveryRaw > 0 ? rotateEveryRaw : 200;
  if (rotateCounter % rotateEvery !== 0) return;

  const maxBytesRaw = Number(process.env.CLAUDE_RUN_OBSERVER_MAX_EVENTS_BYTES || 10 * 1024 * 1024);
  const maxBytes = Number.isFinite(maxBytesRaw) && maxBytesRaw > 0 ? maxBytesRaw : 10 * 1024 * 1024;

  try {
    if (!existsSync(eventsPath)) return;
    const { stat } = await import('fs/promises');
    const st = await stat(eventsPath);
    if (!st.isFile()) return;
    if (st.size <= maxBytes) return;

    const rotatedPath = `${eventsPath}.1`;
    try {
      if (existsSync(rotatedPath)) {
        await unlink(rotatedPath).catch(() => {});
      }
      await rename(eventsPath, rotatedPath);
    } catch {
      // ignore rotation failures; fail-open
    }
  } catch {
    // ignore
  }
}

async function writeLastRunPointer({ runId, sessionKey, agentName, activity, now, phase, status }) {
  try {
    await mkdir(dirname(LAST_RUN_PATH), { recursive: true });
    await atomicWriteJson(LAST_RUN_PATH, {
      run_id: runId,
      session_key: sessionKey,
      status: status || 'running',
      current_agent: agentName || null,
      current_activity: activity || null,
      phase: phase || null,
      last_update_at: now,
      updated_by: 'run-observer',
    });
  } catch {
    // ignore
  }
}

function pickSafeEnvSnapshot() {
  const entries = Object.entries(process.env || {});
  const isClaudeish = k => k.startsWith('CLAUDE') || k.startsWith('ANTHROPIC');
  const isSensitive = k => /(TOKEN|KEY|SECRET|PASSWORD|AUTH)/i.test(k);
  const interesting = k => /(SESSION|CONVERSATION|CHAT|RUN|AGENT|ROLE|PROJECT)/i.test(k);

  const snapshot = {};
  for (const [key, value] of entries) {
    if (!isClaudeish(key)) continue;
    if (isSensitive(key)) continue;
    if (!interesting(key)) continue;
    snapshot[key] = String(value ?? '').slice(0, 160);
  }
  return snapshot;
}

async function maybeWriteDebugSample({ phase, toolName, hookInput, sessionKey, agentName }) {
  try {
    const shouldSample = agentName === 'unknown' || sessionKey.startsWith('unknown-');
    if (!shouldSample) return;
    await mkdir(dirname(DEBUG_LOG_PATH), { recursive: true });

    const entry = {
      ts: new Date().toISOString(),
      phase,
      tool: toolName,
      session_key: sessionKey,
      agent: agentName,
      extracted_context_keys:
        hookInput?.context && typeof hookInput.context === 'object'
          ? Object.keys(hookInput.context).slice(0, 50)
          : [],
      env: pickSafeEnvSnapshot(),
    };

    await appendFile(DEBUG_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // ignore
  }
}

async function writeToolEventArtifact({ runId, event }) {
  try {
    const targetPath = join(TOOL_EVENTS_ARTIFACTS_DIR, `run-${runId}.ndjson`);
    await mkdir(dirname(targetPath), { recursive: true });
    await appendFile(targetPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // ignore
  }
}

async function main() {
  const rawPhase = String(process.argv[2] || '').toLowerCase() || 'post';
  const phase =
    rawPhase === 'subagentstart' || rawPhase === 'subagent_start' || rawPhase === 'subagent-start'
      ? 'subagent_start'
      : rawPhase === 'subagentstop' || rawPhase === 'subagent_stop' || rawPhase === 'subagent-stop'
        ? 'subagent_stop'
        : rawPhase;

  const streamed = await parseHookInputStreaming({ phase }).catch(() => null);
  const hookInput = streamed || (await parseHookInputFallback().catch(() => null));

  const context = hookInput?.context ?? hookInput?.ctx ?? {};
  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  );
  const toolInput =
    hookInput?.tool_input ?? hookInput?.toolInput ?? hookInput?.input ?? hookInput?.params ?? {};
  const toolResult = hookInput?.tool_result ?? hookInput?.toolResult ?? hookInput?.result ?? null;
  const delegatedAgentName =
    normalizeToolName(toolName).toLowerCase() === 'task' ? extractDelegatedAgent(toolInput) : null;

  const sessionKey = await getSessionKey(hookInput);
  const { runId } = await ensureRunForSession(sessionKey);
  const {
    runDir,
    statePath,
    eventsPath,
    pendingPath,
    state: existingState,
  } = await ensureRunState(runId);
  const now = new Date().toISOString();

  let agentName = normalizeAgentName(context);
  // Improve attribution: if Claude Code omits agent context/env, prefer the last-known
  // agent from run state early (avoid clobbering summaries with "unknown").
  if (
    agentName === 'unknown' &&
    phase !== 'subagent_start' &&
    phase !== 'subagent_stop' &&
    typeof existingState?.current_agent === 'string' &&
    existingState.current_agent.trim() &&
    existingState.current_agent.trim() !== 'unknown'
  ) {
    agentName = existingState.current_agent.trim();
  }
  if (agentName === 'unknown' && (phase === 'subagent_start' || phase === 'subagent_stop')) {
    const hinted =
      toolInput?.subagent_type ??
      toolInput?.subagentType ??
      toolInput?.agent ??
      toolInput?.agent_name ??
      toolInput?.agentName ??
      hookInput?.subagent_type ??
      hookInput?.subagentType ??
      hookInput?.subagent ??
      hookInput?.subagent_name ??
      hookInput?.subagentName ??
      null;
    if (typeof hinted === 'string' && hinted.trim()) agentName = hinted.trim();
  }
  if (agentName === 'unknown') {
    const lower = normalizeToolName(toolName).toLowerCase();
    if (lower === 'router' || /^router($|\()/.test(lower)) agentName = 'router';
  }

  // Improve observability: Claude Code tool workers may omit agent context/env.
  // In that case, prefer the last-known agent from run state instead of
  // clobbering it with "unknown" (which hides tool attribution in summaries).
  // For subagent start/stop events, we intentionally avoid this fallback so we
  // can attribute those events to the delegated subagent (using pending Task
  // delegation state) instead of the parent agent.
  if (agentName === 'unknown' && phase !== 'subagent_start' && phase !== 'subagent_stop') {
    const prior =
      typeof existingState?.current_agent === 'string' && existingState.current_agent.trim()
        ? existingState.current_agent.trim()
        : null;
    if (prior && prior !== 'unknown') agentName = prior;
  }

  const failure = phase === 'post' ? detectFailure(toolResult) : null;

  let state = { ...existingState };
  state.status = state.status || 'running';
  state.last_heartbeat_at = now;
  state.last_event_at = now;

  // Track delegated subagents so SubagentStart/SubagentStop can be attributed even
  // when Claude Code doesn't provide agent context/inputs for those events.
  const nowMs = Date.now();
  const pendingSubagentsRaw = Array.isArray(state.pending_subagents) ? state.pending_subagents : [];
  const parentStack = Array.isArray(state.subagent_parent_stack) ? state.subagent_parent_stack : [];
  let subagentParentForEvent = null;

  // Drop stale pending delegations. If a subagent never starts (crash/timeout),
  // the queue shouldn't stay shifted forever.
  const beforePendingCount = pendingSubagentsRaw.length;
  let droppedStalePending = 0;
  const pendingSubagents = pendingSubagentsRaw.filter(entry => {
    if (!entry || typeof entry !== 'object') return false;
    const ts = entry.ts;
    if (typeof ts !== 'string' || !ts.trim()) return false;
    const entryMs = Date.parse(ts);
    if (!Number.isFinite(entryMs)) return false;
    const ageMs = nowMs - entryMs;
    const ok = ageMs >= 0 && ageMs < PENDING_SUBAGENT_TTL_MS;
    if (!ok) droppedStalePending += 1;
    return ok;
  });

  if (
    phase === 'pre' &&
    normalizeToolName(toolName).toLowerCase() === 'task' &&
    delegatedAgentName
  ) {
    pendingSubagents.push({
      agent: delegatedAgentName,
      parent: agentName,
      ts: now,
    });
  }

  let currentAgentAfterEvent = agentName;
  if (phase === 'subagent_start') {
    let subagent = agentName;
    if (subagent === 'unknown' && pendingSubagents.length) {
      const next = pendingSubagents.shift();
      if (next && typeof next.agent === 'string' && next.agent.trim()) subagent = next.agent.trim();
      const parent =
        next &&
        typeof next.parent === 'string' &&
        next.parent.trim() &&
        next.parent.trim() !== 'unknown'
          ? next.parent.trim()
          : null;
      subagentParentForEvent = parent;
      if (parent) parentStack.push(parent);
      else if (
        typeof state.current_agent === 'string' &&
        state.current_agent.trim() &&
        state.current_agent !== 'unknown'
      ) {
        subagentParentForEvent = state.current_agent.trim();
        parentStack.push(state.current_agent.trim());
      }
    } else if (subagent !== 'unknown') {
      if (
        typeof state.current_agent === 'string' &&
        state.current_agent.trim() &&
        state.current_agent !== 'unknown'
      ) {
        subagentParentForEvent = state.current_agent.trim();
        parentStack.push(state.current_agent.trim());
      }
    }
    agentName = subagent;
    currentAgentAfterEvent = agentName;
  } else if (phase === 'subagent_stop') {
    if (
      agentName === 'unknown' &&
      typeof state.current_agent === 'string' &&
      state.current_agent.trim()
    ) {
      agentName = state.current_agent.trim();
    }
    const parent = parentStack.length ? parentStack.pop() : null;
    subagentParentForEvent = parent;
    currentAgentAfterEvent =
      typeof parent === 'string' && parent.trim() && parent.trim() !== 'unknown'
        ? parent.trim()
        : agentName;
  }

  // Never overwrite a known current_agent with "unknown".
  if (
    currentAgentAfterEvent === 'unknown' &&
    typeof state.current_agent === 'string' &&
    state.current_agent.trim() &&
    state.current_agent.trim() !== 'unknown'
  ) {
    currentAgentAfterEvent = state.current_agent.trim();
  }

  state.pending_subagents = pendingSubagents.slice(-20);
  state.subagent_parent_stack = parentStack.slice(-20);
  state = ensureMetrics(state);
  state.metrics.pending_subagents_max = Math.max(
    Number(state.metrics.pending_subagents_max || 0),
    beforePendingCount
  );
  state.metrics.subagent_parent_stack_max = Math.max(
    Number(state.metrics.subagent_parent_stack_max || 0),
    parentStack.length
  );
  if (droppedStalePending > 0) {
    state.metrics.pending_subagents_stale_dropped =
      Number(state.metrics.pending_subagents_stale_dropped || 0) + droppedStalePending;
  }

  const invokerAgentName = agentName;
  const activity =
    phase === 'subagent_start'
      ? `SubagentStart: ${agentName}`
      : phase === 'subagent_stop'
        ? `SubagentStop: ${agentName}`
        : phase === 'stop'
          ? 'Stop'
          : summarizeTool(toolName, toolInput);

  await maybeWriteDebugSample({ phase, toolName, hookInput, sessionKey, agentName });

  state.current_agent = currentAgentAfterEvent;
  state.current_activity = activity;
  state.events_count = Number.isFinite(state.events_count) ? state.events_count + 1 : 1;

  // Best-effort duration tracking across PreToolUse/PostToolUse.
  // We approximate by queueing tool start times per (agent, tool) pair.
  let durationMs = null;
  try {
    const pending = await readPendingQueue(pendingPath);
    const key = pendingKey(agentName, toolName);
    const queue = Array.isArray(pending[key]) ? pending[key] : [];

    if (phase === 'pre') {
      queue.push({ ts: Date.now(), activity });
      pending[key] = queue.slice(-30);
      await writePendingQueue(pendingPath, pending);
    } else if (phase === 'post') {
      const first = queue.shift();
      pending[key] = queue.slice(-30);
      await writePendingQueue(pendingPath, pending);
      if (first && Number.isFinite(first.ts)) {
        durationMs = Math.max(0, Date.now() - first.ts);
        state = recordToolMetric(state, { agentName, toolName, durationMs });
      }
    }
  } catch {
    // ignore
  }

  if (phase === 'post' && normalizeToolName(toolName).toLowerCase() === 'task') {
    state.current_step = Number.isFinite(state.current_step) ? state.current_step + 1 : 1;
  }

  if (failure) {
    state.errors = Array.isArray(state.errors) ? state.errors : [];
    state.errors.push({ at: now, tool: toolName, agent: agentName, message: failure });
    state.errors = state.errors.slice(-20);
    state.status = 'failed';
  }

  if (phase === 'stop') {
    state.stopped_at = now;
    if (String(state.status || '').toLowerCase() === 'running') {
      state.status = 'completed';
    }
  }

  if (phase === 'post' && isRouterDelegation(toolName, toolInput)) {
    state = await maybeIngestRoutingDecision(state, sessionKey);
  }

  state = await maybeRecordRoutingHandoffOutcome({
    phase,
    toolName,
    toolInput,
    sessionKey,
    runId,
    now,
    state,
  });

  // Trace/span context (OTel IDs + W3C traceparent) - backward compatible.
  // This is fail-open: if anything goes wrong we still write the legacy event fields.
  let traceFields = null;
  try {
    state.trace = state.trace && typeof state.trace === 'object' ? state.trace : {};
    const rootStored =
      state.trace.root && typeof state.trace.root === 'object' ? state.trace.root : null;
    const rootCtx = rootStored
      ? TraceContext.deserialize(rootStored)
      : new TraceContext({
          baggage: {
            session_id: sessionKey,
            run_id: runId,
            ...(pickWorkflowBaggage(state) || {}),
          },
        });
    state.trace.root = state.trace.root || rootCtx.serialize();

    state.trace.agent_spans =
      state.trace.agent_spans && typeof state.trace.agent_spans === 'object'
        ? state.trace.agent_spans
        : {};
    state.trace.inflight_tool =
      state.trace.inflight_tool && typeof state.trace.inflight_tool === 'object'
        ? state.trace.inflight_tool
        : null;

    const activeAgentSpanId =
      typeof state.trace.agent_spans[agentName] === 'string'
        ? state.trace.agent_spans[agentName]
        : null;
    const stoppingAgentSpanId =
      phase === 'subagent_stop' && typeof state.trace.agent_spans[agentName] === 'string'
        ? state.trace.agent_spans[agentName]
        : null;

    // For subagents, create/close an "agent span" so tool spans can attach beneath it.
    if (phase === 'subagent_start') {
      const parentSpanId =
        subagentParentForEvent &&
        typeof state.trace.agent_spans[subagentParentForEvent] === 'string'
          ? state.trace.agent_spans[subagentParentForEvent]
          : rootCtx.span_id;

      const agentCtx = new TraceContext({
        trace_id: rootCtx.trace_id,
        parent_span_id: parentSpanId,
        baggage: {
          session_id: sessionKey,
          run_id: runId,
          ...(pickWorkflowBaggage(state) || {}),
          agent_name: agentName,
          parent_agent: subagentParentForEvent,
        },
      });
      state.trace.agent_spans[agentName] = agentCtx.span_id;
    } else if (phase === 'subagent_stop') {
      delete state.trace.agent_spans[agentName];
    }

    let inflight = state.trace.inflight_tool;
    if (phase === 'pre') {
      const parentSpanId = activeAgentSpanId || rootCtx.span_id;
      const toolCtx = new TraceContext({
        trace_id: rootCtx.trace_id,
        parent_span_id: parentSpanId,
        baggage: {
          session_id: sessionKey,
          run_id: runId,
          ...(pickWorkflowBaggage(state) || {}),
          agent_name: agentName,
          ...(delegatedAgentName ? { delegated_agent: delegatedAgentName } : {}),
        },
      });
      inflight = {
        agent: agentName,
        tool: toolName,
        span_id: toolCtx.span_id,
        parent_span_id: parentSpanId,
      };
      state.trace.inflight_tool = inflight;
    } else if (phase === 'post') {
      // Post should close the active tool span.
      if (
        inflight &&
        inflight.agent === agentName &&
        normalizeToolName(inflight.tool) === normalizeToolName(toolName) &&
        typeof inflight.span_id === 'string'
      ) {
        // ok
      } else {
        inflight = null;
      }
      state.trace.inflight_tool = null;
    }

    const spanIdForEvent =
      phase === 'subagent_start'
        ? typeof state.trace.agent_spans[agentName] === 'string'
          ? state.trace.agent_spans[agentName]
          : rootCtx.span_id
        : phase === 'subagent_stop'
          ? stoppingAgentSpanId || rootCtx.span_id
          : phase === 'pre' || phase === 'post'
            ? inflight?.span_id || rootCtx.span_id
            : rootCtx.span_id;

    const parentSpanIdForEvent =
      phase === 'subagent_start'
        ? subagentParentForEvent &&
          typeof state.trace.agent_spans[subagentParentForEvent] === 'string'
          ? state.trace.agent_spans[subagentParentForEvent]
          : rootCtx.span_id
        : phase === 'subagent_stop'
          ? subagentParentForEvent &&
            typeof state.trace.agent_spans[subagentParentForEvent] === 'string'
            ? state.trace.agent_spans[subagentParentForEvent]
            : null
          : phase === 'pre' || phase === 'post'
            ? inflight?.parent_span_id || activeAgentSpanId || rootCtx.span_id
            : null;

    // Self-parent spans are invalid (root spans must have parent_span_id=null).
    const finalParentSpanId =
      typeof parentSpanIdForEvent === 'string' && parentSpanIdForEvent === spanIdForEvent
        ? null
        : parentSpanIdForEvent;

    const toolPath = getPathFromToolInput(toolInput);
    const spanKind = spanKindForEvent({ phase, toolName, agentName, toolPath });
    const eventType = eventTypeFor({ phase, toolName });

    traceFields = {
      trace_id: rootCtx.trace_id,
      span_id: spanIdForEvent,
      parent_span_id: finalParentSpanId ?? null,
      traceparent: `00-${rootCtx.trace_id}-${spanIdForEvent}-01`,
      tracestate: null,
      baggage: {
        session_id: sessionKey,
        run_id: runId,
        ...(pickWorkflowBaggage(state) || {}),
        agent_name: agentName,
        ...(delegatedAgentName ? { delegated_agent: delegatedAgentName } : {}),
      },
      span_kind: spanKind,
      event_type: eventType,
      span_state: spanStateFor({ phase }),
      span_name: spanNameFor({ spanKind, toolName, agentName }),
    };
  } catch {
    traceFields = null;
  }

  await maybeWriteAgentTaskArtifact({
    phase,
    toolName,
    toolInput,
    toolResult,
    failure,
    sessionKey,
    runId,
    runDir,
    statePath,
    eventsPath,
    invokerAgentName,
    delegatedAgentName,
    now,
    activity,
  });

  await atomicWriteJson(statePath, state);
  await writeRunSummary(runDir, state);
  await writeLastRunPointer({
    runId,
    sessionKey,
    agentName,
    activity,
    now,
    phase,
    status: state.status,
  });

  // Best-effort event log
  try {
    let payloadMeta = null;
    if (
      OBS_STORE_PAYLOADS &&
      phase === 'post' &&
      traceFields &&
      typeof traceFields.trace_id === 'string' &&
      typeof traceFields.span_id === 'string'
    ) {
      try {
        const { storePayload } = await import('../tools/payload-store.mjs');
        payloadMeta = await storePayload({
          traceId: traceFields.trace_id,
          spanId: traceFields.span_id,
          runId,
          sessionKey,
          spanName: traceFields.span_name,
          eventType: traceFields.event_type,
          inputs: toolInput,
          outputs: toolResult,
        });
      } catch {
        payloadMeta = null;
      }
    }

    const event = {
      ts: now,
      ...(traceFields || {}),
      phase,
      run_id: runId,
      session_key: sessionKey,
      agent: agentName,
      tool: toolName,
      activity,
      ok: !failure,
      ...(payloadMeta ? { payload: payloadMeta } : {}),
      ...(Number.isFinite(durationMs) ? { duration_ms: durationMs } : {}),
      ...(failure ? { error: failure } : {}),
      ...(delegatedAgentName ? { delegated_agent: delegatedAgentName } : {}),
    };
    await writeEvent(eventsPath, event);
    await writeToolEventArtifact({ runId, event });

    if (OBS_FAILURE_BUNDLES && failure) {
      try {
        const { generateFailureBundle } = await import('../tools/failure-bundle.mjs');
        await generateFailureBundle({
          traceId: traceFields?.trace_id || null,
          spanId: traceFields?.span_id || null,
          runId,
          sessionKey,
          failureType: 'tool_error',
          triggerEvent: event,
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  if (phase === 'pre' || phase === 'stop') {
    safeRespond({ decision: 'approve' });
  } else {
    safeRespond({ hookSpecificOutput: { hookEventName: 'PostToolUse' } });
  }
}

main()
  .catch(() => safeRespond({ decision: 'approve' }))
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_RUN_OBSERVER_EXECUTING;
  });
