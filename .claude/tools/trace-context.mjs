#!/usr/bin/env node
/**
 * Trace Context (OTel IDs + W3C Trace Context + Baggage)
 *
 * - trace_id: 16 bytes hex (32 chars)
 * - span_id: 8 bytes hex (16 chars)
 * - traceparent: 00-<trace_id>-<parent_id>-<flags>
 *
 * Note:
 * - W3C `tracestate` is vendor-specific. Do not encode app baggage into it.
 * - Baggage is represented as an object and (optionally) a `baggage` header string.
 */

import { createHash, randomBytes } from 'node:crypto';

function isAllZeros(hex) {
  return /^[0]+$/.test(hex);
}

export function generateTraceId() {
  for (let i = 0; i < 10; i++) {
    const id = randomBytes(16).toString('hex');
    if (!isAllZeros(id)) return id;
  }
  // Fallback (extremely unlikely)
  return '1'.padStart(32, '0');
}

export function generateSpanId() {
  for (let i = 0; i < 10; i++) {
    const id = randomBytes(8).toString('hex');
    if (!isAllZeros(id)) return id;
  }
  return '1'.padStart(16, '0');
}

export function buildTraceparent({ traceId, parentId, sampled = true } = {}) {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${parentId}-${flags}`;
}

export function parseTraceparent(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!m) return null;
  const version = m[1].toLowerCase();
  if (version !== '00') return null;
  const traceId = m[2].toLowerCase();
  const parentSpanId = m[3].toLowerCase();
  const flags = m[4].toLowerCase();
  if (isAllZeros(traceId) || isAllZeros(parentSpanId)) return null;
  const sampled = (parseInt(flags, 16) & 1) === 1;
  return { trace_id: traceId, parent_span_id: parentSpanId, sampled };
}

export function toBaggageHeader(baggage) {
  if (!baggage || typeof baggage !== 'object') return null;
  const pairs = [];
  for (const [k, v] of Object.entries(baggage)) {
    if (v == null) continue;
    const key = String(k).trim();
    if (!key) continue;
    // Keep this conservative for now; full W3C baggage key grammar is stricter.
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const safeValue = encodeURIComponent(String(v));
    pairs.push(`${safeKey}=${safeValue}`);
  }
  return pairs.length ? pairs.join(',') : null;
}

export class TraceContext {
  constructor({ trace_id = null, parent_span_id = null, baggage = {}, sampled = true } = {}) {
    this.trace_id = trace_id || generateTraceId();
    this.span_id = generateSpanId();
    this.parent_span_id = parent_span_id || null;
    this.sampled = Boolean(sampled);
    this.baggage = baggage && typeof baggage === 'object' ? { ...baggage } : {};
  }

  get traceparent() {
    return buildTraceparent({
      traceId: this.trace_id,
      parentId: this.span_id,
      sampled: this.sampled,
    });
  }

  // Vendor-specific tracestate is intentionally not generated here.
  get tracestate() {
    return null;
  }

  get baggage_header() {
    return toBaggageHeader(this.baggage);
  }

  childSpan(baggageUpdates = {}) {
    return new TraceContext({
      trace_id: this.trace_id,
      parent_span_id: this.span_id,
      baggage: { ...this.baggage, ...(baggageUpdates || {}) },
      sampled: this.sampled,
    });
  }

  hashPayload(payload) {
    if (payload == null) return null;
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return `sha256:${createHash('sha256').update(str).digest('hex')}`;
  }

  serialize() {
    return {
      trace_id: this.trace_id,
      span_id: this.span_id,
      parent_span_id: this.parent_span_id,
      sampled: this.sampled,
      baggage: this.baggage,
    };
  }

  static deserialize(data) {
    const obj = data && typeof data === 'object' ? data : {};
    const ctx = new TraceContext({
      trace_id: typeof obj.trace_id === 'string' ? obj.trace_id : null,
      parent_span_id: typeof obj.parent_span_id === 'string' ? obj.parent_span_id : null,
      baggage: obj.baggage && typeof obj.baggage === 'object' ? obj.baggage : {},
      sampled: obj.sampled !== undefined ? Boolean(obj.sampled) : true,
    });
    if (
      typeof obj.span_id === 'string' &&
      /^[0-9a-f]{16}$/i.test(obj.span_id) &&
      !isAllZeros(obj.span_id)
    ) {
      ctx.span_id = obj.span_id.toLowerCase();
    }
    return ctx;
  }

  // Build a new span from an incoming traceparent header.
  // The returned context has a new span_id and parent_span_id set to the incoming parent-id.
  static fromTraceparent(traceparent, baggage = {}) {
    const parsed = parseTraceparent(traceparent);
    if (!parsed) return null;
    return new TraceContext({
      trace_id: parsed.trace_id,
      parent_span_id: parsed.parent_span_id,
      baggage,
      sampled: parsed.sampled,
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Minimal CLI: print a new context as JSON.
  const ctx = new TraceContext();
  process.stdout.write(
    JSON.stringify({ ...ctx.serialize(), traceparent: ctx.traceparent }, null, 2)
  );
}
