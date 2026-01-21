#!/usr/bin/env node
/**
 * Read Size Guard (PreToolUse)
 *
 * Prevents Claude Code's Read tool from attempting to read very large files
 * without pagination. This avoids MaxFileReadTokenExceededError and reduces
 * long stalls caused by oversized tool payloads.
 *
 * Policy:
 * - If tool=Read and target path exists and is a file:
 *   - Approve if offset/limit (or similar paging keys) are provided.
 *   - Block if file is above CLAUDE_READ_MAX_BYTES (default: 110KB).
 *
 * Fail-open on unexpected errors.
 */

import { statSync } from 'fs';
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

function approve(extra = undefined) {
  safeRespond(extra ? { decision: 'approve', ...extra } : { decision: 'approve' });
}

function block(reason) {
  safeRespond({ decision: 'block', reason });
}

if (process.env.CLAUDE_READ_SIZE_GUARD_EXECUTING === 'true') {
  approve();
  process.exit(0);
}
process.env.CLAUDE_READ_SIZE_GUARD_EXECUTING = 'true';

const timeout = setTimeout(() => {
  approve({ warning: 'read-size-guard timeout' });
  delete process.env.CLAUDE_READ_SIZE_GUARD_EXECUTING;
  process.exit(0);
}, 700);

function normalizeToolName(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
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

function getReadPath(toolInput) {
  const raw =
    toolInput?.path ??
    toolInput?.file_path ??
    toolInput?.filePath ??
    toolInput?.filename ??
    toolInput?.file ??
    null;
  return typeof raw === 'string' ? raw : null;
}

function hasPaging(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const keys = ['offset', 'limit', 'start', 'end', 'start_line', 'end_line', 'range'];
  return keys.some(k => toolInput[k] !== undefined && toolInput[k] !== null);
}

function isAgentEcosystemPath(path) {
  if (!path || typeof path !== 'string') return false;
  const normalized = path.replace(/\\/g, '/');
  // Allow `.claude/` reads (artifacts, runtime state, workflows, agents, schemas, config).
  // These files can legitimately be large and are foundational to the agent framework.
  return (
    normalized.startsWith('.claude/') ||
    normalized.includes('/.claude/') ||
    normalized.includes('/.claude\\') ||
    normalized.includes('\\.claude/')
  );
}

function getMaxBytes() {
  const raw = String(process.env.CLAUDE_READ_MAX_BYTES || '').trim();
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  // Default chosen to sit below typical ~25k token Read caps.
  return 110 * 1024;
}

async function main() {
  const hookInput = await readStdinJson();
  const toolName = normalizeToolName(
    hookInput?.tool_name ?? hookInput?.tool ?? hookInput?.toolName ?? hookInput?.name
  );
  if (toolName.toLowerCase() !== 'read') {
    approve();
    return;
  }

  const toolInput =
    hookInput?.tool_input ?? hookInput?.toolInput ?? hookInput?.input ?? hookInput?.params ?? {};

  const path = getReadPath(toolInput);
  if (!path || !path.trim()) {
    approve();
    return;
  }

  if (isAgentEcosystemPath(path)) {
    approve();
    return;
  }

  if (hasPaging(toolInput)) {
    approve();
    return;
  }

  let s;
  try {
    s = statSync(path);
  } catch {
    approve();
    return;
  }

  if (!s?.isFile?.()) {
    approve();
    return;
  }

  const maxBytes = getMaxBytes();
  if (typeof s.size === 'number' && s.size > maxBytes) {
    const reason = [
      'Read size guard: file is too large to Read without paging.',
      `Requested path: ${path}`,
      `Size: ${s.size} bytes (limit: ${maxBytes} bytes)`,
      'Fix: use Read with `offset` + `limit`, or use `Grep`/`Search` to narrow scope first.',
    ].join('\n');
    await logDenialIfBlocking({
      hookName: 'read-size-guard',
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
    delete process.env.CLAUDE_READ_SIZE_GUARD_EXECUTING;
  });
