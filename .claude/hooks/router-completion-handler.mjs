#!/usr/bin/env node
/**
 * Router Completion Handler Hook (PostToolUse) - v1.0.0
 *
 * Marks router-first routing as completed after the router agent finishes
 * classifying a user request. This flips:
 *   .claude/context/tmp/routing-sessions/<session>.json -> routing.completed = true
 * and mirrors best-effort to:
 *   .claude/context/tmp/routing-session-state.json
 *
 * Without this hook, router-first-enforcer.mjs will continue blocking tool calls
 * forever (routing.completed stays false), which can cascade into nested retries
 * and eventually an OOM in the host process.
 *
 * Fail-Safe: Never blocks execution. On error, logs and exits 0.
 */

import { existsSync } from 'fs';
import { appendFile, mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getSessionKeyForHook } from './session-key.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..', '..');
const DEFAULT_TMP_DIR = join(__dirname, '..', 'context', 'tmp');
const TMP_DIR =
  process.env.CLAUDE_HOOK_TMP_DIR ||
  process.env.CLAUDE_TMP_DIR ||
  process.env.CLAUDE_CONTEXT_TMP_DIR ||
  DEFAULT_TMP_DIR;
const ROUTING_SESSIONS_DIR = join(TMP_DIR, 'routing-sessions');
// Legacy mirror for tooling/docs; not authoritative.
const LEGACY_SESSION_STATE_PATH = join(TMP_DIR, 'routing-session-state.json');
const ERROR_LOG_PATH = join(__dirname, '..', 'context', 'logs', 'router-enforcement-errors.log');
const INCOMING_PROMPT_PATH = join(__dirname, '..', 'context', 'queue', 'incoming-prompt.json');
const DEFAULT_ROUTING_ARTIFACTS_DIR = join(__dirname, '..', 'context', 'artifacts', 'routing');
// Keep long-running workflows from expiring routing state mid-run.
// This is refreshed on every state write.
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours (sliding)

// Recursion protection
if (process.env.CLAUDE_ROUTER_COMPLETION_HOOK_EXECUTING === 'true') {
  process.stdout.write(
    JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
  );
  process.exit(0);
}
process.env.CLAUDE_ROUTER_COMPLETION_HOOK_EXECUTING = 'true';

// Timeout protection - force exit after a short window.
// This hook must not hang, but it also must be resilient to slow stdin streaming
// for large PostToolUse payloads (especially Task results).
const timeout = setTimeout(() => {
  process.stdout.write(
    JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
  );
  delete process.env.CLAUDE_ROUTER_COMPLETION_HOOK_EXECUTING;
  process.exit(0);
}, 8000);

async function logError(errorData) {
  try {
    await mkdir(dirname(ERROR_LOG_PATH), { recursive: true });
    const entry = { timestamp: new Date().toISOString(), ...errorData };
    await appendFile(ERROR_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Never block on logging
  }
}

async function readStdinWithLimit({
  maxBytes = 2 * 1024 * 1024,
  // Idle timeout: finalize if no new data arrives for this long.
  idleTimeoutMs = 900,
  // Absolute cap: finalize even if data keeps trickling.
  maxTotalMs = 6500,
} = {}) {
  return await new Promise(resolve => {
    const chunks = [];
    let bytes = 0;
    let resolved = false;
    let truncated = false;

    const finalize = () => {
      if (resolved) return;
      resolved = true;
      resolve({ text: Buffer.concat(chunks).toString('utf-8'), truncated });
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finalize, idleTimeoutMs);
    };

    const totalTimer = setTimeout(finalize, maxTotalMs);
    // IMPORTANT: Don't start the idle timer until the first data arrives.
    // Claude Code can delay the first stdin chunk for PostToolUse payloads.
    let idleTimer = null;

    process.stdin.on('data', chunk => {
      if (resolved) return;
      resetIdleTimer();
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8');
      const remaining = maxBytes - bytes;
      if (remaining <= 0) {
        truncated = true;
        try {
          process.stdin.pause();
        } catch {
          // ignore
        }
        clearTimeout(totalTimer);
        if (idleTimer) clearTimeout(idleTimer);
        finalize();
        return;
      }
      if (buf.length > remaining) {
        truncated = true;
        chunks.push(buf.slice(0, remaining));
        bytes += remaining;
        try {
          process.stdin.pause();
        } catch {
          // ignore
        }
        clearTimeout(totalTimer);
        if (idleTimer) clearTimeout(idleTimer);
        finalize();
        return;
      }
      chunks.push(buf);
      bytes += buf.length;
    });
    process.stdin.on('end', () => {
      clearTimeout(totalTimer);
      if (idleTimer) clearTimeout(idleTimer);
      finalize();
    });
    process.stdin.on('error', () => {
      clearTimeout(totalTimer);
      if (idleTimer) clearTimeout(idleTimer);
      finalize();
    });
  });
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

function getRoutingArtifactsDir() {
  const fromEnv = process.env.CLAUDE_ROUTING_ARTIFACTS_DIR;
  if (!fromEnv) return DEFAULT_ROUTING_ARTIFACTS_DIR;

  const asString = String(fromEnv).trim();
  if (!asString) return DEFAULT_ROUTING_ARTIFACTS_DIR;

  if (isAbsolute(asString)) return asString;
  return resolve(PROJECT_ROOT, asString);
}

async function getSessionKey(hookInput) {
  return await getSessionKeyForHook({ hookInput, tmpDir: TMP_DIR });
}

function getSessionStatePath(sessionKey) {
  return join(ROUTING_SESSIONS_DIR, `${safeFileId(sessionKey)}.json`);
}

function getRoutingArtifactPath(sessionKey) {
  return join(getRoutingArtifactsDir(), `${safeFileId(sessionKey)}.json`);
}

async function parseHookInputStreaming({ wantResultSample = true, maxSampleChars = 4096 } = {}) {
  // No external deps. Keep memory bounded and fall back to minimal extraction if needed.
  const { text, truncated } = await readStdinWithLimit({
    // PostToolUse payloads can be large; keep this high enough to include tool_result.
    maxBytes: Math.max(64 * 1024, wantResultSample ? 8 * 1024 * 1024 : 512 * 1024),
    // Claude Code can be slow to stream PostToolUse payloads for Task results; if we bail too early,
    // tool_result may be missing and routing will incorrectly fall back.
    idleTimeoutMs: 1200,
    maxTotalMs: 6500,
  });
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    if (!truncated) {
      await logError({
        error_type: 'ROUTER_COMPLETION_HOOK_INPUT_PARSE_ERROR',
        error_message: error.message,
        recovery_action: 'fallback_minimal_parse',
      });
    }

    const extractFirstStringField = keys => {
      for (const key of keys) {
        const re = new RegExp(`\"${key}\"\\s*:\\s*\"([^\"]+)\"`, 'i');
        const m = text.match(re);
        if (m?.[1]) return m[1];
      }
      return null;
    };

    const toolName = extractFirstStringField(['tool_name', 'tool', 'toolName', 'name']) ?? '';
    const sessionId =
      extractFirstStringField(['session_id', 'sessionId', 'conversation_id', 'conversationId']) ??
      null;

    const extractJsonValueForKey = key => {
      const keyRe = new RegExp(`\"${key}\"\\s*:\\s*`, 'i');
      const m = text.match(keyRe);
      if (!m || typeof m.index !== 'number') return null;

      let i = m.index + m[0].length;
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length) return null;

      const start = i;
      const ch = text[i];

      const sliceString = () => {
        // JSON string scanning starting at the opening quote.
        i++; // skip opening quote
        let escaping = false;
        for (; i < text.length; i++) {
          const c = text[i];
          if (escaping) {
            escaping = false;
            continue;
          }
          if (c === '\\') {
            escaping = true;
            continue;
          }
          if (c === '"') {
            return text.slice(start, i + 1);
          }
        }
        return null;
      };

      const sliceBalanced = (openChar, closeChar) => {
        let depth = 0;
        let inString = false;
        let escaping = false;
        for (; i < text.length; i++) {
          const c = text[i];
          if (inString) {
            if (escaping) {
              escaping = false;
              continue;
            }
            if (c === '\\') {
              escaping = true;
              continue;
            }
            if (c === '"') inString = false;
            continue;
          }
          if (c === '"') {
            inString = true;
            continue;
          }
          if (c === openChar) depth++;
          if (c === closeChar) depth--;
          if (depth === 0) {
            return text.slice(start, i + 1);
          }
        }
        return null;
      };

      if (ch === '"') return sliceString();
      if (ch === '{') return sliceBalanced('{', '}');
      if (ch === '[') return sliceBalanced('[', ']');

      // primitive/null/number/bool
      for (; i < text.length; i++) {
        const c = text[i];
        if (c === ',' || c === '}' || c === ']' || c === '\n' || c === '\r') break;
      }
      const raw = text.slice(start, i).trim();
      return raw || null;
    };

    const parseEmbeddedJson = raw => {
      if (raw == null) return null;
      const s = String(raw).trim();
      if (!s) return null;
      try {
        return JSON.parse(sanitizeLikelyJson(s));
      } catch {
        // If it isn't JSON, return raw string.
        return s;
      }
    };

    const toolResultSample =
      parseEmbeddedJson(extractJsonValueForKey('tool_result')) ??
      parseEmbeddedJson(extractJsonValueForKey('toolResult')) ??
      parseEmbeddedJson(extractJsonValueForKey('result')) ??
      null;

    const toolInput = {};
    if (
      /\"subagent_type\"\s*:\s*\"router\"/i.test(text) ||
      /\"subagentType\"\s*:\s*\"router\"/i.test(text) ||
      /\"agent\"\s*:\s*\"router\"/i.test(text)
    ) {
      toolInput.subagent_type = 'router';
    }

    const context = {};
    if (sessionId) context.session_id = sessionId;

    return {
      tool_name: toolName,
      tool_input: toolInput,
      tool_result_sample: toolResultSample,
      context,
    };
  }
}

function extractTextFromResult(toolResult) {
  if (!toolResult) return '';
  if (typeof toolResult === 'string') return toolResult;
  if (toolResult.content) {
    if (typeof toolResult.content === 'string') return toolResult.content;
    if (Array.isArray(toolResult.content)) {
      // Claude Code often represents outputs as content blocks:
      // [{ type: "text", text: "..." }, ...]
      const parts = toolResult.content
        .map(block => {
          if (!block) return '';
          if (typeof block === 'string') return block;
          if (typeof block.text === 'string') return block.text;
          if (typeof block.content === 'string') return block.content;
          return '';
        })
        .filter(Boolean);
      if (parts.length) return parts.join('\n');
    }
    return JSON.stringify(toolResult.content);
  }
  if (toolResult.output) {
    return typeof toolResult.output === 'string'
      ? toolResult.output
      : JSON.stringify(toolResult.output);
  }
  if (toolResult.text) return toolResult.text;
  return JSON.stringify(toolResult);
}

function isRouterDelegation(toolName, toolInput) {
  const normalized = normalizeToolName(toolName);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower === 'router' || /^router($|\()/.test(lower)) return true;
  if (lower !== 'task') return false;
  const raw = toolInput?.subagent_type ?? toolInput?.subagentType ?? toolInput?.agent ?? null;
  return typeof raw === 'string' && raw.toLowerCase() === 'router';
}

function extractRequestSummary(toolInput) {
  const raw =
    toolInput?.prompt ?? toolInput?.description ?? toolInput?.objective ?? toolInput?.task ?? '';
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 800);
}

async function readIncomingPromptFallback() {
  try {
    if (!existsSync(INCOMING_PROMPT_PATH)) return '';
    const content = await readFile(INCOMING_PROMPT_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    const prompt = typeof parsed?.prompt === 'string' ? parsed.prompt : '';
    return prompt.replace(/\s+/g, ' ').trim().slice(0, 800);
  } catch {
    return '';
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

function sanitizeLikelyJson(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.replace(/^\uFEFF/, '').trim();

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    cleaned = fencedMatch[1].trim();
  }

  cleaned = cleaned
    // Remove trailing semicolons some models add
    .replace(/;+\s*$/, '')
    // Fix common "almost JSON" issue: trailing commas
    .replace(/,\s*([}\]])/g, '$1');

  if ((cleaned.startsWith('{') || cleaned.startsWith('[')) && !/"/.test(cleaned)) {
    cleaned = cleaned.replace(/'((?:[^'\\]|\\.)*)'/g, '"$1"');
  }

  if (cleaned.startsWith('{')) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.slice(0, lastBrace + 1);
    }
  } else if (cleaned.startsWith('[')) {
    const lastBracket = cleaned.lastIndexOf(']');
    if (lastBracket > 0 && lastBracket < cleaned.length - 1) {
      cleaned = cleaned.slice(0, lastBracket + 1);
    }
  }

  return cleaned;
}

function normalizeDecision(rawDecision) {
  if (!rawDecision || typeof rawDecision !== 'object') return null;

  const workflow =
    rawDecision.workflow_selection ??
    rawDecision.workflow ??
    rawDecision.selected_workflow ??
    rawDecision.workflowSelection ??
    null;

  const intent = rawDecision.intent ?? rawDecision.task_type ?? rawDecision.type ?? 'analysis';
  const complexity = rawDecision.complexity ?? rawDecision.complexity_level ?? 'high';
  const confidence =
    typeof rawDecision.confidence === 'number'
      ? rawDecision.confidence
      : Number(rawDecision.confidence ?? 0);

  const shouldEscalate =
    typeof rawDecision.should_escalate === 'boolean'
      ? rawDecision.should_escalate
      : typeof rawDecision.should_route === 'boolean'
        ? rawDecision.should_route
        : typeof rawDecision.shouldRoute === 'boolean'
          ? rawDecision.shouldRoute
          : true;

  const decision = {
    intent,
    complexity,
    cloud_provider: rawDecision.cloud_provider ?? null,
    workflow_selection:
      typeof workflow === 'string' ? workflow : '@.claude/workflows/code-quality-flow.yaml',
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reasoning:
      typeof rawDecision.reasoning === 'string'
        ? rawDecision.reasoning.slice(0, 500)
        : 'Router classification captured by router-completion-handler',
    keywords_detected: Array.isArray(rawDecision.keywords_detected)
      ? rawDecision.keywords_detected.slice(0, 20)
      : [],
    should_escalate: shouldEscalate,
    escalation_target: rawDecision.escalation_target ?? null,
  };

  return decision;
}

function createInitialState() {
  const now = new Date();
  return {
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

async function loadStateForPath(statePath) {
  try {
    if (!existsSync(statePath)) return null;
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    await logError({
      error_type: 'ROUTER_COMPLETION_STATE_READ_ERROR',
      error_message: error.message,
      recovery_action: 'reset_state',
    });
    return null;
  }
}

async function saveStateForPaths(statePath, state) {
  await atomicWriteJson(statePath, state);
  await atomicWriteJson(LEGACY_SESSION_STATE_PATH, state).catch(() => {});
}

async function writeRoutingDecisionArtifact({
  sessionKey,
  statePath,
  requestSummary,
  toolName,
  contextAgentName,
  parseOk,
  decision,
}) {
  try {
    const artifactPath = getRoutingArtifactPath(sessionKey);
    const now = new Date();

    const payload = {
      schema_version: 1,
      artifact_type: 'routing_decision',
      created_at: now.toISOString(),
      session_key: sessionKey,
      routing_state_path: statePath,
      tool_name: toolName,
      context_agent_name: contextAgentName ?? null,
      request_summary: requestSummary ?? null,
      router_output_parse_ok: Boolean(parseOk),
      shouldRoute: Boolean(decision?.should_escalate),
      intent: decision?.intent ?? null,
      confidence: typeof decision?.confidence === 'number' ? decision.confidence : null,
      workflow_selection: decision?.workflow_selection ?? null,
      selected_workflow: decision?.selected_workflow ?? decision?.workflow_selection ?? null,
      escalation_target: decision?.escalation_target ?? null,
      should_escalate: Boolean(decision?.should_escalate),
      decision,
    };

    await atomicWriteJson(artifactPath, payload);
  } catch (error) {
    await logError({
      error_type: 'ROUTING_ARTIFACT_WRITE_FAILED',
      error_message: error.message,
      recovery_action: 'ignore',
    });
  }
}

async function main() {
  const startTime = Date.now();

  const hookInput = await parseHookInputStreaming().catch(() => null);

  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  );
  const toolInput =
    hookInput?.tool_input ?? hookInput?.toolInput ?? hookInput?.input ?? hookInput?.params ?? {};
  const context = hookInput?.context ?? hookInput?.ctx ?? {};
  const sessionKey = await getSessionKey(hookInput);
  const statePath = getSessionStatePath(sessionKey);

  const toolResult =
    hookInput?.tool_result ??
    hookInput?.toolResult ??
    hookInput?.result ??
    hookInput?.tool_result_sample ??
    hookInput?.toolResultSample ??
    null;

  // Only update routing state after router delegation completes.
  if (!isRouterDelegation(toolName, toolInput)) {
    process.stdout.write(
      JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
    );
    return;
  }

  const rawText = extractTextFromResult(toolResult);
  const jsonCandidate = extractFirstJsonObject(rawText) ?? rawText.trim();

  let parsedDecision = null;
  try {
    parsedDecision = JSON.parse(sanitizeLikelyJson(jsonCandidate));
  } catch {
    // If router output isn't valid JSON, proceed with safe fallback decision
    parsedDecision = null;
  }
  const parseOk = Boolean(parsedDecision);
  let requestSummary = extractRequestSummary(toolInput);
  // The router tool is sometimes invoked with a generic prompt ("Classify request").
  // If so, fall back to the most recent user prompt written by user-prompt-submit.mjs.
  if (
    requestSummary &&
    requestSummary.length <= 40 &&
    /(classify|route)\s+request/i.test(requestSummary)
  ) {
    const fromQueue = await readIncomingPromptFallback();
    if (fromQueue) requestSummary = fromQueue;
  }
  if (!requestSummary) {
    const fromQueue = await readIncomingPromptFallback();
    if (fromQueue) requestSummary = fromQueue;
  }
  if (!parsedDecision) {
    const sanitizedCandidate = sanitizeLikelyJson(jsonCandidate);
    await logError({
      error_type: 'ROUTER_COMPLETION_DECISION_PARSE_FAILED',
      error_message: 'Router tool result did not contain parseable JSON decision',
      tool_name: toolName,
      request_summary: requestSummary,
      json_candidate_sample: jsonCandidate.slice(0, 1200),
      sanitized_candidate_sample: sanitizedCandidate.slice(0, 1200),
      raw_sample: rawText.slice(0, 1200),
      recovery_action: 'fallback_default_decision',
    });
  }

  // Heuristics should not depend solely on the router's internal Task prompt (often generic like
  // "Classify request"). Prefer the best available user prompt signal, but fall back to the Task
  // prompt and a small sample of router output when the user prompt capture isn't available.
  const heuristicText = [
    requestSummary || '',
    (toolInput && typeof toolInput.prompt === 'string' ? toolInput.prompt : '') || '',
    // Small sample of router output (can contain keywords like "ship readiness")
    (jsonCandidate ? String(jsonCandidate).slice(0, 1200) : '') || '',
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const isDiagnosticsLike = (() => {
    const s = heuristicText;
    if (/\bdiagnostic(s)?\b/.test(s)) return true;
    if (s.includes('system diagnostics') || s.includes('framework diagnostics')) return true;
    if (s.includes('100% coverage')) return true;
    return false;
  })();

  const isIntegrationLike = (() => {
    const s = heuristicText;
    if (s.includes('agent framework')) return true;
    if (s.includes('agent-to-agent')) return true;
    if (s.includes('integration test')) return true;
    if (s.includes('smoke test')) return true;
    if (/\bagent-integration-v\d+-\d{8}-\d{6}\b/.test(s)) return true;
    return false;
  })();

  const isShipReadinessLike = (() => {
    const s = heuristicText;
    if (s.includes('ship readiness')) return true;
    if (s.includes('ship-readiness')) return true;
    if (s.includes('release readiness')) return true;
    if (s.includes('readiness audit')) return true;
    return false;
  })();

  // If a prompt mentions both “diagnostics” and “integration test”, treat it as an integration harness.
  // This avoids routing integration runs to diagnostics-runner (which then triggers handoff denials).
  const isEffectiveDiagnosticsLike = Boolean(isDiagnosticsLike && !isIntegrationLike);

  const fallbackWorkflow = isShipReadinessLike
    ? '@.claude/workflows/ship-readiness-headless.yaml'
    : isIntegrationLike
      ? '@.claude/workflows/agent-framework-integration-headless.yaml'
      : isEffectiveDiagnosticsLike
        ? '@.claude/workflows/automated-enterprise-flow.yaml'
        : '@.claude/workflows/code-quality-flow.yaml';

  const fallbackEscalationTarget = (() => {
    // Ship readiness runs via a deterministic headless runner. Avoid forcing a Task handoff.
    if (isShipReadinessLike) return null;

    // Integration tests run via a deterministic headless runner. Avoid forcing a Task handoff
    // (which can trigger nested routing / extra subagent spawning and increase OOM risk).
    if (isIntegrationLike) return null;

    // IMPORTANT: Subagents cannot spawn subagents. For diagnostics, route directly
    // to the worker that runs the deterministic diagnostics tool.
    if (isEffectiveDiagnosticsLike) return 'diagnostics-runner';

    // For all other requests, do not force an escalation target here.
    // Escalation must be explicit; otherwise we risk "handoff to nowhere" or
    // forcing an orchestrator that cannot spawn subagents (Claude Code limitation).
    return null;
  })();

  const decision =
    normalizeDecision(parsedDecision) ??
    normalizeDecision({
      intent: 'analysis',
      complexity: 'high',
      workflow_selection: fallbackWorkflow,
      selected_workflow: fallbackWorkflow,
      confidence: 0,
      reasoning: 'Router output was not parseable JSON; using safe fallback routing decision',
      keywords_detected: [],
      should_escalate: true,
      escalation_target: fallbackEscalationTarget,
    });

  // Harden: router output may omit escalation_target/workflow_selection even when it
  // indicates escalation. Ensure we always have a concrete next hop for enforcement.
  const hardenedDecision = (() => {
    const d = decision || {};

    const workflowSelectionRaw =
      typeof d.workflow_selection === 'string' && d.workflow_selection.trim()
        ? d.workflow_selection.trim()
        : null;
    const selectedWorkflowRaw =
      typeof d.selected_workflow === 'string' && d.selected_workflow.trim()
        ? d.selected_workflow.trim()
        : null;

    const isShipReadinessWorkflowSelected = Boolean(
      (workflowSelectionRaw && workflowSelectionRaw.includes('ship-readiness')) ||
      (selectedWorkflowRaw && selectedWorkflowRaw.includes('ship-readiness'))
    );

    const isIntegrationWorkflowSelected = Boolean(
      (workflowSelectionRaw && workflowSelectionRaw.includes('agent-framework-integration')) ||
      (selectedWorkflowRaw && selectedWorkflowRaw.includes('agent-framework-integration'))
    );

    const preferShipReadinessWorkflow = Boolean(
      isShipReadinessLike || isShipReadinessWorkflowSelected
    );
    const preferHeadlessIntegrationWorkflow = Boolean(
      isIntegrationLike || isIntegrationWorkflowSelected
    );
    const workflowSelection = (() => {
      if (!workflowSelectionRaw) return null;
      if (
        preferShipReadinessWorkflow &&
        workflowSelectionRaw !== '@.claude/workflows/ship-readiness-headless.yaml'
      ) {
        return '@.claude/workflows/ship-readiness-headless.yaml';
      }
      if (
        preferHeadlessIntegrationWorkflow &&
        workflowSelectionRaw !== '@.claude/workflows/agent-framework-integration-headless.yaml'
      ) {
        return '@.claude/workflows/agent-framework-integration-headless.yaml';
      }
      if (
        preferHeadlessIntegrationWorkflow &&
        workflowSelectionRaw === '@.claude/workflows/agent-framework-integration.yaml'
      ) {
        return '@.claude/workflows/agent-framework-integration-headless.yaml';
      }
      return workflowSelectionRaw;
    })();

    const selectedWorkflow = (() => {
      if (!selectedWorkflowRaw) return null;
      if (
        preferShipReadinessWorkflow &&
        selectedWorkflowRaw !== '@.claude/workflows/ship-readiness-headless.yaml'
      ) {
        return '@.claude/workflows/ship-readiness-headless.yaml';
      }
      if (
        preferHeadlessIntegrationWorkflow &&
        selectedWorkflowRaw !== '@.claude/workflows/agent-framework-integration-headless.yaml'
      ) {
        return '@.claude/workflows/agent-framework-integration-headless.yaml';
      }
      if (
        preferHeadlessIntegrationWorkflow &&
        selectedWorkflowRaw === '@.claude/workflows/agent-framework-integration.yaml'
      ) {
        return '@.claude/workflows/agent-framework-integration-headless.yaml';
      }
      return selectedWorkflowRaw;
    })();

    const shouldEscalate = Boolean(d.should_escalate);
    const explicitTarget =
      typeof d.escalation_target === 'string' && d.escalation_target.trim()
        ? d.escalation_target.trim()
        : null;

    // Normalize problematic targets for specific request types.
    // Master-orchestrator is intentionally "CEO-only" and may return without executing;
    // integration tests must route to an execution-capable coordinator.
    const normalizedExplicitTarget = (() => {
      if (
        (isIntegrationLike || isIntegrationWorkflowSelected) &&
        explicitTarget === 'master-orchestrator'
      ) {
        return 'orchestrator';
      }

      // Some router variants historically suggested diagnostics-runner for “framework diagnostics” text
      // even when the selected workflow is the integration harness. Prefer orchestrator in that case.
      if (
        (isIntegrationLike || isIntegrationWorkflowSelected) &&
        explicitTarget === 'diagnostics-runner'
      ) {
        return 'orchestrator';
      }

      return explicitTarget;
    })();

    // If escalation is requested but no explicit target is provided, only fall back when the request is
    // clearly diagnostics-like; otherwise disable escalation and allow the default agent to proceed.
    const isHeadlessWorkflowSelected =
      workflowSelection === '@.claude/workflows/agent-framework-integration-headless.yaml' ||
      selectedWorkflow === '@.claude/workflows/agent-framework-integration-headless.yaml' ||
      workflowSelection === '@.claude/workflows/ship-readiness-headless.yaml' ||
      selectedWorkflow === '@.claude/workflows/ship-readiness-headless.yaml';

    // For headless workflows, require a single handoff to a Bash-capable worker (job-runner).
    // Claude Code sessions often run as the `router` role, which does not have Bash permission.
    // Handing off to job-runner ensures the workflow executes via one deterministic CLI invocation,
    // without orchestrator fan-out (which is the common source of Claude Code host OOM).
    const headlessRunnerTarget = 'job-runner';
    const escalationTarget = isHeadlessWorkflowSelected
      ? headlessRunnerTarget
      : (normalizedExplicitTarget ?? fallbackEscalationTarget ?? null);
    const finalShouldEscalate = isHeadlessWorkflowSelected
      ? true
      : Boolean(shouldEscalate && escalationTarget);

    return {
      ...d,
      workflow_selection: workflowSelection ?? fallbackWorkflow,
      selected_workflow: selectedWorkflow ?? workflowSelection ?? fallbackWorkflow,
      should_escalate: finalShouldEscalate,
      escalation_target: escalationTarget,
    };
  })();

  // Load or initialize state
  const state = (await loadStateForPath(statePath)) ?? createInitialState();
  state.session_key = sessionKey;

  const now = new Date();
  if (!state.routing?.started_at) {
    state.routing = state.routing || {};
    state.routing.started_at = now.toISOString();
  }

  state.routing.completed = true;
  state.routing.completed_at = now.toISOString();
  state.routing.decision = hardenedDecision;

  // Coordination: require a single explicit handoff to the escalation target.
  // This prevents the parent (default) agent from continuing to "do work" after routing.
  // Enforced by router-first-enforcer.mjs.
  state.routing.handoff_target =
    hardenedDecision?.should_escalate && typeof hardenedDecision?.escalation_target === 'string'
      ? hardenedDecision.escalation_target
      : null;
  state.routing.handoff_completed = false;

  state.routing_history = Array.isArray(state.routing_history) ? state.routing_history : [];
  state.routing_history.push({
    timestamp: now.toISOString(),
    decision: hardenedDecision,
    request_summary: requestSummary,
  });
  state.routing_history = state.routing_history.slice(-10);

  // Best-effort metrics
  try {
    if (state.routing.started_at) {
      state.metrics = state.metrics || {};
      state.metrics.routing_duration_ms =
        now.getTime() - new Date(state.routing.started_at).getTime();
    }
  } catch {
    // Ignore metric errors
  }

  state.updated_at = now.toISOString();
  state.expires_at = new Date(now.getTime() + SESSION_TIMEOUT_MS).toISOString();
  state.version = (state.version || 0) + 1;
  state.last_compact_ms = Date.now();

  await saveStateForPaths(statePath, state);
  await writeRoutingDecisionArtifact({
    sessionKey,
    statePath,
    requestSummary,
    toolName,
    contextAgentName: context?.agent_name ?? context?.agentName ?? null,
    parseOk,
    decision: hardenedDecision,
  });

  process.stdout.write(
    JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
  );
}

main()
  .catch(async error => {
    await logError({
      error_type: 'ROUTER_COMPLETION_UNEXPECTED_EXCEPTION',
      error_message: error.message,
      stack: error.stack,
      recovery_action: 'ignore',
    });
    process.stdout.write(
      JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
    );
  })
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_ROUTER_COMPLETION_HOOK_EXECUTING;
  });
