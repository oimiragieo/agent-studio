#!/usr/bin/env node
/**
 * Read-only Enforcer (PreToolUse)
 *
 * Inspired by Serena's "read_only" project flag: provide a single, explicit toggle that
 * prevents accidental writes while still allowing diagnostics and investigation.
 *
 * Enable via:
 * - env: CLAUDE_READ_ONLY=true/1/yes
 * - file: .claude/context/tmp/read-only.json { enabled: true }
 *
 * Notes:
 * - Blocks Write/Edit always when enabled.
 * - Blocks Bash when the command looks mutating (git add/commit, installs, rm/mv/cp, redirects).
 * - Allows safe Bash commands by default (tests/validation/status commands).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT =
  String(process.env.CLAUDE_PROJECT_DIR || '').trim() || join(__dirname, '..', '..');

const STATE_PATH = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'read-only.json');

function truthy(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function isEnabled() {
  if (truthy(process.env.CLAUDE_READ_ONLY)) return true;
  const st = readJson(STATE_PATH);
  return Boolean(st?.enabled);
}

function toolNameOf(input) {
  const v = input?.tool_name ?? input?.tool ?? input?.toolName ?? input?.name ?? '';
  return typeof v === 'string' ? v.trim() : String(v ?? '').trim();
}

function toolInputOf(input) {
  return input?.tool_input ?? input?.toolInput ?? input?.input ?? input?.params ?? {};
}

function bashIsMutating(command) {
  const c = String(command || '');
  const s = c.toLowerCase();

  // Obvious file writes via shell redirection / tee
  if (/[^\S\r\n]>(>|&)?[^\S\r\n]?/.test(c) || /\btee\b/i.test(c)) return true;

  // Git operations: allow common read-only commands, but block staging/history mutations.
  if (/\bgit\b/.test(s)) {
    const mutatingGit =
      /\b(add|commit|push|tag|checkout|merge|rebase|reset|clean|apply|stash|cherry-pick)\b/.test(s);
    if (mutatingGit) return true;
    const readOnlyGit = /\b(status|log|diff|show|grep|blame|branch|remote|config|help)\b/.test(s);
    if (readOnlyGit) return false;
  }

  // Package installs/updates
  if (
    /\b(pnpm|npm|yarn)\b/.test(s) &&
    /\b(install|add|remove|update|upgrade|link|unlink)\b/.test(s)
  )
    return true;

  // File mutations (keep conservative)
  if (/\b(rm|del|erase|mv|move|cp|copy|mkdir|rmdir|touch|chmod|chown)\b/.test(s)) return true;

  // Formatting/lint fixers can rewrite files
  if (
    /\b(pnpm|npm)\b/.test(s) &&
    /\b(format|lint)\b/.test(s) &&
    !/\b(format:check|lint:check)\b/.test(s)
  )
    return true;

  return false;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk.toString();
  const input = raw ? JSON.parse(raw) : {};

  if (!isEnabled()) {
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
    return;
  }

  const toolName = toolNameOf(input);
  const lower = toolName.toLowerCase();
  const toolInput = toolInputOf(input);

  if (lower === 'write' || lower === 'edit') {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          'READ-ONLY MODE: Write/Edit is disabled. Disable read-only via `node .claude/tools/read-only.mjs disable` (or unset CLAUDE_READ_ONLY) to proceed.',
      })
    );
    return;
  }

  if (lower === 'bash') {
    const cmd = toolInput?.command ?? toolInput?.cmd ?? '';
    if (bashIsMutating(cmd)) {
      process.stdout.write(
        JSON.stringify({
          decision: 'block',
          reason:
            'READ-ONLY MODE: This Bash command looks like it may modify the repo. Disable read-only via `node .claude/tools/read-only.mjs disable` (or unset CLAUDE_READ_ONLY) to proceed.',
        })
      );
      return;
    }
  }

  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

main().catch(() => {
  // fail-open
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
