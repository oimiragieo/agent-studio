#!/usr/bin/env node
/**
 * otlp-export.mjs
 *
 * Converts `.ndjson` run events into an OTLP/JSON payload (OpenTelemetry Protocol).
 *
 * Primary use: export LLM-RULES traces into enterprise observability systems.
 *
 * Usage:
 *   node .claude/tools/otlp-export.mjs --events <events.ndjson> --out <out.json>
 *   node .claude/tools/otlp-export.mjs --events <events.ndjson> --endpoint <url>
 *
 * Notes:
 * - OTLP/JSON uses base64-encoded bytes for trace/span IDs. This tool emits base64 by default.
 * - This is a best-effort reconstruction: spans are paired by span_id using start/end markers.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    events: null,
    out: null,
    endpoint: null,
    service: 'llm-rules',
    format: 'otlp-json',
    projectRoot: null,
    timeoutMs: 30_000,
    allowEmpty: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--events') args.events = argv[++i] || null;
    else if (a === '--out') args.out = argv[++i] || null;
    else if (a === '--endpoint') args.endpoint = argv[++i] || null;
    else if (a === '--service') args.service = argv[++i] || 'llm-rules';
    else if (a === '--format') args.format = (argv[++i] || 'otlp-json').trim();
    else if (a === '--project-root') args.projectRoot = argv[++i] || null;
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i] || '0');
    else if (a === '--allow-empty') args.allowEmpty = true;
  }
  return args;
}

function resolvePath(projectRoot, p) {
  if (!p) return null;
  if (isAbsolute(p)) return p;
  const root = projectRoot
    ? isAbsolute(projectRoot)
      ? projectRoot
      : resolve(projectRoot)
    : process.cwd();
  return resolve(join(root, p));
}

function hexToBase64(hex, expectedLength = null) {
  const raw = String(hex || '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]+$/.test(raw) || raw.length % 2 !== 0) return null;
  if (expectedLength != null && raw.length !== expectedLength) return null;
  return Buffer.from(raw, 'hex').toString('base64');
}

function toUnixNano(ts) {
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return null;
  // Date.parse returns milliseconds. Preserve ms precision in ns conversion.
  return String(BigInt(Math.round(t)) * 1000000n);
}

function attr(key, value) {
  if (value == null) return null;
  const v =
    typeof value === 'string'
      ? { stringValue: value }
      : typeof value === 'boolean'
        ? { boolValue: value }
        : { stringValue: String(value) };
  return { key, value: v };
}

function reconstructSpans(events) {
  const bySpan = new Map();
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const spanId = e.span_id;
    const traceId = e.trace_id;
    if (typeof spanId !== 'string' || typeof traceId !== 'string') continue;

    const rec = bySpan.get(spanId) || {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: e.parent_span_id || null,
      start_ts: null,
      end_ts: null,
      ok: true,
      name: null,
      attributes: {},
      errors: [],
    };
    rec.parent_span_id = rec.parent_span_id || e.parent_span_id || null;
    rec.name = rec.name || e.span_name || e.activity || null;

    if (e.span_state === 'start' || /Start$/.test(String(e.event_type || ''))) {
      rec.start_ts = rec.start_ts || e.ts;
    }
    if (e.span_state === 'end' || /(Stop|End)$/.test(String(e.event_type || ''))) {
      rec.end_ts = e.ts || rec.end_ts;
    }

    if (e.ok === false) rec.ok = false;
    if (e.error) rec.errors.push(String(e.error));

    rec.attributes.agent = rec.attributes.agent || e.agent || null;
    rec.attributes.tool = rec.attributes.tool || e.tool || null;
    rec.attributes.span_kind = rec.attributes.span_kind || e.span_kind || null;
    rec.attributes.event_type = rec.attributes.event_type || e.event_type || null;

    bySpan.set(spanId, rec);
  }

  return [...bySpan.values()].filter(s => s.start_ts && (s.end_ts || s.start_ts));
}

export async function exportToOtlpJson({
  eventsPath,
  outPath,
  endpoint,
  serviceName = 'llm-rules',
  timeoutMs = 30_000,
  allowEmpty = false,
} = {}) {
  if (!eventsPath) throw new Error('Missing eventsPath');
  if (!existsSync(eventsPath)) throw new Error(`Events file not found: ${eventsPath}`);

  const text = await readFile(eventsPath, 'utf8');
  const events = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const spans = reconstructSpans(events);
  const warnings = [];

  const otlpSpans = spans
    .map(s => {
      const traceIdB64 = hexToBase64(s.trace_id, 32);
      const spanIdB64 = hexToBase64(s.span_id, 16);
      const parentIdB64 = s.parent_span_id ? hexToBase64(s.parent_span_id, 16) : null;
      if (!traceIdB64 || !spanIdB64) return null;

      const startNs = toUnixNano(s.start_ts);
      const endNs = toUnixNano(s.end_ts || s.start_ts);
      if (!startNs || !endNs) return null;

      const attrs = [
        attr('agent.name', s.attributes.agent),
        attr('tool.name', s.attributes.tool),
        attr('span.kind', s.attributes.span_kind),
        attr('event.type', s.attributes.event_type),
      ].filter(Boolean);

      const status = s.ok
        ? { code: 'STATUS_CODE_OK' }
        : { code: 'STATUS_CODE_ERROR', message: s.errors[0] || 'error' };

      return {
        traceId: traceIdB64,
        spanId: spanIdB64,
        ...(parentIdB64 ? { parentSpanId: parentIdB64 } : {}),
        name: s.name || 'span',
        kind: 'SPAN_KIND_INTERNAL',
        startTimeUnixNano: startNs,
        endTimeUnixNano: endNs,
        attributes: attrs,
        status,
      };
    })
    .filter(Boolean);

  if (otlpSpans.length === 0) {
    warnings.push(
      allowEmpty
        ? 'No valid spans reconstructed (allow-empty enabled).'
        : 'No valid spans reconstructed. Use --allow-empty to treat this as expected.'
    );
    if (!allowEmpty) process.stderr.write(`[otlp-export] WARN: ${warnings.at(-1)}\n`);
  }

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [attr('service.name', serviceName)].filter(Boolean),
        },
        scopeSpans: [
          {
            scope: { name: 'llm-rules', version: '1' },
            spans: otlpSpans,
          },
        ],
      },
    ],
  };

  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  if (endpoint) {
    const controller = new AbortController();
    const effectiveTimeoutMs =
      Number.isFinite(timeoutMs) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 30_000;
    const t = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `OTLP export failed: ${res.status} ${res.statusText}${body ? `\n${body}` : ''}`
      );
    }
  }

  return { ok: true, spans: otlpSpans.length, out_path: outPath || null, warnings };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.events)
    die(
      'Usage: node .claude/tools/otlp-export.mjs --events <events.ndjson> [--out <out.json>] [--endpoint <url>] [--timeout-ms <n>] [--allow-empty]'
    );
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)
    die('--timeout-ms must be a positive number');

  const eventsPath = resolvePath(args.projectRoot, args.events);
  const outPath = args.out ? resolvePath(args.projectRoot, args.out) : null;

  const res = await exportToOtlpJson({
    eventsPath,
    outPath,
    endpoint: args.endpoint,
    serviceName: args.service,
    timeoutMs: args.timeoutMs,
    allowEmpty: args.allowEmpty,
  });
  process.stdout.write(JSON.stringify({ ok: true, ...res }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => die(err?.stack || err?.message || String(err), 1));
}
