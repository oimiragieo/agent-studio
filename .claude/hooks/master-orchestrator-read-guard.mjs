#!/usr/bin/env node
/**
 * Master Orchestrator Read Guard (PreToolUse)
 *
 * Problem:
 * - master-orchestrator often "plans" by reading many files and then idles,
 *   instead of delegating immediately to specialized subagents.
 *
 * Policy:
 * - If the active agent is master-orchestrator, block Read tool usage.
 * - This forces CEO-style delegation: spawn `diagnostics-runner` / `analyst`.
 *
 * Safety:
 * - Fail-open if parsing fails or agent cannot be determined.
 */

import { createHash } from 'crypto';
import { logDenialIfBlocking } from './denial-logger.mjs';

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
  safeRespond({ decision: 'approve' });
}

function block(reason) {
  safeRespond({ decision: 'block', reason });
}

function readStdinWithLimit({ maxBytes = 256 * 1024, timeoutMs = 250 } = {}) {
  return new Promise(resolve => {
    const chunks = [];
    let bytes = 0;
    let resolved = false;

    const finalize = () => {
      if (resolved) return;
      resolved = true;
      resolve(Buffer.concat(chunks).toString('utf-8'));
    };

    process.stdin.on('data', chunk => {
      if (resolved) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8');
      const remaining = maxBytes - bytes;
      if (remaining <= 0) return finalize();
      if (buf.length > remaining) {
        chunks.push(buf.subarray(0, remaining));
        bytes += remaining;
        return finalize();
      }
      chunks.push(buf);
      bytes += buf.length;
    });
    process.stdin.on('end', finalize);
    process.stdin.on('error', finalize);
    setTimeout(finalize, timeoutMs);
  });
}

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function normalizeAgentName(context) {
  const envActive =
    String(process.env.CLAUDE_AGENT_NAME || '').trim() ||
    String(process.env.CLAUDE_AGENT_ROLE || '').trim() ||
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
    context?.role ??
    null;
  if (typeof fromContext === 'string' && fromContext.trim())
    return fromContext.trim().toLowerCase();
  return '';
}

function stableReason() {
  const id = createHash('sha256')
    .update('master-orchestrator-read-guard-v1')
    .digest('hex')
    .slice(0, 8);
  return [
    'MASTER-ORCHESTRATOR READ BLOCKED',
    'Master orchestrator must delegate analysis to subagents instead of reading files directly.',
    'Next: spawn `diagnostics-runner` (for diagnostics) or `analyst` (for file analysis).',
    `ref:${id}`,
  ].join('\n');
}

async function main() {
  const raw = await readStdinWithLimit().catch(() => '');
  if (!raw) return approve();

  let hookInput;
  try {
    hookInput = JSON.parse(raw);
  } catch {
    return approve();
  }

  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  ).toLowerCase();
  if (toolName !== 'read') return approve();

  const context = hookInput?.context ?? hookInput?.ctx ?? {};
  const agent = normalizeAgentName(context);
  if (agent !== 'master-orchestrator') return approve();

  const reason = stableReason();
  await logDenialIfBlocking({
    hookName: 'master-orchestrator-read-guard',
    hookInput,
    decision: 'block',
    reason,
  });
  return block(reason);
}

main()
  .catch(() => approve())
  .finally(() => {
    // no-op
  });
