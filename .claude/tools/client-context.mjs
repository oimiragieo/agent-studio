#!/usr/bin/env node
/**
 * Client Context (lightweight profiles)
 *
 * Stores the active "client context" (claude-code / cursor / codex) so agents and tools
 * can make consistent choices about tool usage patterns and verbosity.
 *
 * Usage:
 *   node .claude/tools/client-context.mjs list
 *   node .claude/tools/client-context.mjs current [--json]
 *   node .claude/tools/client-context.mjs set <name>
 *   node .claude/tools/client-context.mjs detect [--apply] [--json]
 *   node .claude/tools/client-context.mjs validate
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const CONTEXTS_PATH = join(PROJECT_ROOT, '.claude', 'config', 'client-contexts.json');
const STATE_PATH = join(PROJECT_ROOT, '.claude', 'context', 'tmp', 'client-context.json');

function readJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2), 'utf8');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const json = args.includes('--json');
  const apply = args.includes('--apply');
  const cmd = args.find(a => !a.startsWith('--')) || 'current';
  const rest = args.filter(a => a !== cmd && a !== '--json' && a !== '--apply');
  return { cmd, rest, json, apply };
}

function loadContexts() {
  const cfg = readJson(CONTEXTS_PATH);
  const contexts = cfg?.contexts && typeof cfg.contexts === 'object' ? cfg.contexts : {};
  return { schema_version: cfg?.schema_version ?? null, contexts };
}

function detectContext() {
  const truthy = v => {
    const raw = String(v || '')
      .trim()
      .toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  };

  // Prefer explicit override.
  const explicit = String(process.env.CLAUDE_CLIENT_CONTEXT || '').trim();
  if (explicit) return explicit;

  // Best-effort heuristics (non-authoritative).
  if (truthy(process.env.CLAUDE_CODE)) return 'claude-code';
  if (truthy(process.env.CODEX_CLI) || truthy(process.env.CODEX)) return 'codex';
  if (truthy(process.env.CURSOR) || process.env.CURSOR_TRACE_ID) return 'cursor';

  return null;
}

function main() {
  const { cmd, rest, json, apply } = parseArgs(process.argv);
  const { contexts } = loadContexts();

  if (cmd === 'list') {
    const names = Object.keys(contexts).sort();
    if (json) {
      process.stdout.write(
        JSON.stringify({ contexts: names.map(name => ({ name, ...contexts[name] })) }, null, 2)
      );
      return;
    }
    process.stdout.write('Client contexts:\n');
    for (const name of names) {
      const desc = contexts[name]?.description ? String(contexts[name].description) : '';
      process.stdout.write(`- ${name}${desc ? `: ${desc}` : ''}\n`);
    }
    return;
  }

  if (cmd === 'set') {
    const name = String(rest[0] || '').trim();
    if (!name) {
      process.stdout.write('Usage: node .claude/tools/client-context.mjs set <name>\n');
      process.exitCode = 2;
      return;
    }
    if (!contexts[name]) {
      process.stdout.write(
        `Unknown context "${name}". Try: node .claude/tools/client-context.mjs list\n`
      );
      process.exitCode = 2;
      return;
    }
    writeJson(STATE_PATH, { context: name, updated_at: new Date().toISOString() });
    process.stdout.write(
      json ? JSON.stringify({ ok: true, context: name, path: STATE_PATH }) : `OK: ${name}\n`
    );
    return;
  }

  if (cmd === 'detect') {
    const detected = detectContext();
    const normalized = detected && contexts[detected] ? detected : null;
    const desc =
      normalized && contexts[normalized]?.description
        ? String(contexts[normalized].description)
        : null;

    if (apply && normalized)
      writeJson(STATE_PATH, { context: normalized, updated_at: new Date().toISOString() });

    const payload = {
      detected: detected || null,
      resolved: normalized,
      applied: Boolean(apply && normalized),
      state_path: STATE_PATH,
      description: desc,
    };

    if (json) {
      process.stdout.write(JSON.stringify(payload, null, 2));
      if (!normalized) process.exitCode = 1;
      return;
    }

    process.stdout.write(`Detected: ${payload.detected || '(none)'}\n`);
    process.stdout.write(`Resolved: ${payload.resolved || '(unknown)'}\n`);
    if (payload.applied) process.stdout.write(`Applied: ${payload.resolved}\n`);
    if (desc) process.stdout.write(`${desc}\n`);
    if (!normalized) process.exitCode = 1;
    return;
  }

  if (cmd === 'validate') {
    const st = readJson(STATE_PATH);
    const name = String(st?.context || '').trim();
    const ok = Boolean(name && contexts[name]);
    const payload = { ok, context: name || null, state_path: STATE_PATH };
    process.stdout.write(
      json ? JSON.stringify(payload, null, 2) : `${ok ? 'OK' : 'INVALID'}: ${name || '(none)'}\n`
    );
    if (!ok) process.exitCode = 1;
    return;
  }

  // current (default)
  const st = readJson(STATE_PATH);
  const name = String(st?.context || '').trim();
  const resolved = name || null;
  const desc =
    resolved && contexts[resolved]?.description ? String(contexts[resolved].description) : null;
  const payload = { context: resolved, description: desc, state_path: STATE_PATH };
  if (json) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return;
  }
  process.stdout.write(`Client context: ${resolved || '(not set)'}\n`);
  if (desc) process.stdout.write(`${desc}\n`);
  process.stdout.write(`State: ${STATE_PATH}\n`);
}

main();
