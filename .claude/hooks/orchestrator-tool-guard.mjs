#!/usr/bin/env node
/**
 * Orchestrator Tool Guard (PreToolUse)
 *
 * Prevents orchestrator agents from running high-fanout repo-wide tools that
 * commonly cause huge outputs and CLI memory blowups (e.g., Grep/Glob/Search).
 *
 * This is intentionally narrow: it only applies when the active agent is an
 * orchestrator (master-orchestrator/orchestrator).
 *
 * Output schema must match Claude Code hook validation:
 * - approve/block (NOT allow/deny)
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logDenialIfBlocking } from './denial-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

if (process.env.CLAUDE_ORCHESTRATOR_GUARD_EXECUTING === 'true') {
  approve();
  process.exit(0);
}
process.env.CLAUDE_ORCHESTRATOR_GUARD_EXECUTING = 'true';

const timeout = setTimeout(() => {
  approve();
  delete process.env.CLAUDE_ORCHESTRATOR_GUARD_EXECUTING;
  process.exit(0);
}, 700);

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function detectOrchestrator(context) {
  const envRole = String(process.env.CLAUDE_AGENT_ROLE || '').toLowerCase();
  const envName = String(process.env.CLAUDE_AGENT_NAME || '').toLowerCase();
  if (envRole.includes('orchestrator')) return true;
  if (envName.includes('orchestrator')) return true;

  const agent = String(
    context?.agent_name ?? context?.agentName ?? context?.agent ?? context?.role ?? ''
  ).toLowerCase();
  return agent.includes('orchestrator');
}

async function readStdinJson() {
  const input = await new Promise(resolve => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
    setTimeout(() => resolve(chunks.length ? Buffer.concat(chunks).toString('utf-8') : ''), 250);
  });

  if (!input || !input.trim()) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

async function main() {
  const hookInput = await readStdinJson();
  const context = hookInput?.context ?? hookInput?.ctx ?? {};
  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  );

  if (!detectOrchestrator(context)) {
    approve();
    return;
  }

  const lower = toolName.toLowerCase();
  const blockedTools = new Set(['grep', 'glob', 'search']);

  if (blockedTools.has(lower)) {
    const reason = [
      'Orchestrator tool guard: high-fanout repo scans must be delegated.',
      `Blocked tool: ${toolName}`,
      'Use Task to spawn an analyst/developer subagent to perform targeted searches and return a summary.',
    ].join('\n');
    await logDenialIfBlocking({
      hookName: 'orchestrator-tool-guard',
      hookInput,
      decision: 'block',
      reason,
    });
    block(reason);
    return;
  }

  approve();
}

main()
  .catch(() => approve())
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_ORCHESTRATOR_GUARD_EXECUTING;
  });
