#!/usr/bin/env node
/**
 * Payload Store (sanitized, size-bounded)
 *
 * Stores tool inputs/outputs separately from `events.ndjson` to keep events small while
 * enabling deep debugging when needed.
 *
 * Default path:
 *   .claude/context/payloads/trace-<trace_id>/span-<span_id>.json
 *
 * Feature flags (set by the caller/hook):
 * - CLAUDE_OBS_STORE_PAYLOADS=1 (controls whether hooks call storePayload)
 *
 * Env overrides:
 * - CLAUDE_PAYLOADS_DIR: override payload root directory
 * - CLAUDE_PAYLOAD_TTL_DAYS: default TTL (days) for expires_at
 * - CLAUDE_PAYLOAD_MAX_BYTES: max JSON bytes stored per (inputs/outputs) section
 * - CLAUDE_PAYLOAD_MAX_DEPTH: max object depth
 * - CLAUDE_PAYLOAD_MAX_KEYS: max keys per object
 * - CLAUDE_PAYLOAD_MAX_ARRAY: max items per array
 * - CLAUDE_PAYLOAD_MAX_STRING: max string length
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function resolveDirEnv(envName, defaultPath) {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) return defaultPath;
  return isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw);
}

function parseIntEnv(name, fallback) {
  const raw = Number.parseInt(String(process.env[name] || '').trim(), 10);
  return Number.isFinite(raw) ? raw : fallback;
}

let sanitize;
try {
  const mod = await import('../../codex-skills/shared/sanitize-secrets.js');
  sanitize = mod.sanitize || mod.default?.sanitize;
} catch {
  sanitize = input => String(input ?? '');
}

const DEFAULT_TTL_DAYS = parseIntEnv('CLAUDE_PAYLOAD_TTL_DAYS', 7);
const DEFAULT_MAX_BYTES = parseIntEnv('CLAUDE_PAYLOAD_MAX_BYTES', 128 * 1024);
const DEFAULT_MAX_DEPTH = parseIntEnv('CLAUDE_PAYLOAD_MAX_DEPTH', 8);
const DEFAULT_MAX_KEYS = parseIntEnv('CLAUDE_PAYLOAD_MAX_KEYS', 80);
const DEFAULT_MAX_ARRAY = parseIntEnv('CLAUDE_PAYLOAD_MAX_ARRAY', 80);
const DEFAULT_MAX_STRING = parseIntEnv('CLAUDE_PAYLOAD_MAX_STRING', 4000);

const DEFAULT_PAYLOADS_DIR = resolveDirEnv(
  'CLAUDE_PAYLOADS_DIR',
  join(PROJECT_ROOT, '.claude', 'context', 'payloads')
);

function hashSha256(text) {
  return `sha256:${createHash('sha256')
    .update(String(text ?? ''))
    .digest('hex')}`;
}

function pruneValue(value, depth, limits) {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    maxKeys = DEFAULT_MAX_KEYS,
    maxArray = DEFAULT_MAX_ARRAY,
    maxString = DEFAULT_MAX_STRING,
  } = limits || {};

  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > maxString ? value.slice(0, maxString) + '…' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return String(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: String(value.message || ''),
      stack:
        typeof value.stack === 'string' ? value.stack.split('\n').slice(0, 20).join('\n') : null,
    };
  }

  if (depth >= maxDepth) return '[Truncated:MaxDepth]';

  if (Array.isArray(value)) {
    const out = [];
    const count = Math.min(value.length, maxArray);
    for (let i = 0; i < count; i++) out.push(pruneValue(value[i], depth + 1, limits));
    if (value.length > count) out.push(`[Truncated:ArrayItems:${value.length - count}]`);
    return out;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const out = {};
    const count = Math.min(entries.length, maxKeys);
    for (let i = 0; i < count; i++) {
      const [k, v] = entries[i];
      out[String(k)] = pruneValue(v, depth + 1, limits);
    }
    if (entries.length > count) out._truncated_keys = entries.length - count;
    return out;
  }

  return String(value);
}

function toSanitizedJsonObject(value, { maxBytes = DEFAULT_MAX_BYTES, limits } = {}) {
  let pruned = pruneValue(value, 0, limits);
  let json = '';

  try {
    json = JSON.stringify(pruned);
  } catch {
    json = JSON.stringify({ _unserializable: true, preview: String(value) });
  }

  if (Buffer.byteLength(json, 'utf8') > maxBytes) {
    const preview = json.slice(0, Math.max(0, maxBytes - 200));
    pruned = {
      _truncated_bytes: Buffer.byteLength(json, 'utf8'),
      _max_bytes: maxBytes,
      preview,
    };
    json = JSON.stringify(pruned);
  }

  const sanitizedJson = sanitize(json);
  try {
    return {
      ok: true,
      json: sanitizedJson,
      value: JSON.parse(sanitizedJson),
      redacted: sanitizedJson !== json,
    };
  } catch {
    return {
      ok: false,
      json: sanitizedJson,
      value: sanitizedJson,
      redacted: sanitizedJson !== json,
    };
  }
}

export async function storePayload({
  traceId,
  spanId,
  runId = null,
  sessionKey = null,
  spanName = null,
  eventType = null,
  inputs,
  outputs,
  ttlDays = DEFAULT_TTL_DAYS,
  payloadsDir = DEFAULT_PAYLOADS_DIR,
  maxBytes = DEFAULT_MAX_BYTES,
  limits = {},
} = {}) {
  if (!traceId || !spanId) throw new Error('storePayload requires traceId and spanId');

  const inputsSan = toSanitizedJsonObject(inputs, { maxBytes, limits });
  const outputsSan = toSanitizedJsonObject(outputs, { maxBytes, limits });

  const payload = {
    $schema: '../schemas/payload-record.schema.json',
    schema_version: 1,
    trace_id: traceId,
    span_id: spanId,
    run_id: runId,
    session_key: sessionKey,
    span_name: spanName,
    event_type: eventType,
    stored_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + Math.max(0, ttlDays) * 24 * 60 * 60 * 1000).toISOString(),
    inputs: inputsSan.value,
    outputs: outputsSan.value,
  };

  const payloadPath = join(payloadsDir, `trace-${traceId}`, `span-${spanId}.json`);
  await mkdir(dirname(payloadPath), { recursive: true });

  const payloadJson = JSON.stringify(payload, null, 2);
  await writeFile(payloadPath, payloadJson, 'utf8');

  return {
    payload_ref: payloadPath,
    payload_bytes: Buffer.byteLength(payloadJson, 'utf8'),
    inputs_hash: hashSha256(inputsSan.json),
    outputs_hash: hashSha256(outputsSan.json),
    inputs_redacted: inputsSan.redacted,
    outputs_redacted: outputsSan.redacted,
    redacted_keys: [],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Minimal CLI for debugging:
  //   node .claude/tools/payload-store.mjs <traceId> <spanId>
  const [traceId, spanId] = process.argv.slice(2);
  const meta = await storePayload({
    traceId,
    spanId,
    inputs: { hello: 'world' },
    outputs: { ok: true },
  });
  process.stdout.write(JSON.stringify({ ok: true, ...meta }, null, 2));
}
