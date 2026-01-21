#!/usr/bin/env node
/**
 * Read Path Guard (PreToolUse)
 *
 * Claude Code's Read tool is file-oriented. Attempting to Read a directory
 * path errors with EISDIR and can stall workflows. This hook blocks Read when
 * the requested path exists and is a directory, and suggests the right tool.
 *
 * Output schema must match Claude Code hook validation:
 * - approve/block (NOT allow/deny)
 *
 * This hook is fail-open on unexpected errors.
 */

import { statSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { logDenialIfBlocking } from './denial-logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT =
  String(process.env.CLAUDE_PROJECT_DIR || '').trim() || join(__dirname, '..', '..');

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

if (process.env.CLAUDE_READ_PATH_GUARD_EXECUTING === 'true') {
  approve();
  process.exit(0);
}
process.env.CLAUDE_READ_PATH_GUARD_EXECUTING = 'true';

const timeout = setTimeout(() => {
  approve();
  delete process.env.CLAUDE_READ_PATH_GUARD_EXECUTING;
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

function resolveWorkspacePath(p) {
  const raw = String(p || '').trim();
  if (!raw) return null;
  if (isAbsolute(raw)) return raw;
  return resolve(PROJECT_ROOT, raw);
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

  const resolvedPath = resolveWorkspacePath(path);
  if (!resolvedPath) {
    approve();
    return;
  }

  let s;
  try {
    s = statSync(resolvedPath);
  } catch {
    approve();
    return;
  }

  if (s?.isDirectory?.()) {
    const reason = [
      'Read path guard: Read() cannot open directories.',
      `Requested path is a directory: ${path}`,
      resolvedPath !== path ? `Resolved path: ${resolvedPath}` : null,
      'Use `Glob`/`Search` (or delegate a subagent to use `Bash(dir/ls)`), then Read a specific file.',
    ]
      .filter(Boolean)
      .join('\n');
    await logDenialIfBlocking({
      hookName: 'read-path-guard',
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
    delete process.env.CLAUDE_READ_PATH_GUARD_EXECUTING;
  });
