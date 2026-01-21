import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import http from 'node:http';

import { exportToOtlpJson } from './otlp-export.mjs';

describe('otlp-export tool', () => {
  it('exports paired spans as OTLP/JSON with base64 IDs', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-otlp-'));
    try {
      const eventsPath = join(root, 'events.ndjson');
      const outPath = join(root, 'otlp.json');
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);

      await writeFile(
        eventsPath,
        [
          JSON.stringify({
            ts: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: null,
            span_state: 'start',
            event_type: 'ToolCallStart',
            span_name: 'tool:pnpm test',
            agent: 'headless-runner',
            tool: 'pnpm',
            span_kind: 'tool',
            ok: true,
          }),
          JSON.stringify({
            ts: new Date('2026-01-01T00:00:01.000Z').toISOString(),
            trace_id: traceId,
            span_id: spanId,
            parent_span_id: null,
            span_state: 'end',
            event_type: 'ToolCallStop',
            span_name: 'tool:pnpm test',
            agent: 'headless-runner',
            tool: 'pnpm',
            span_kind: 'tool',
            ok: true,
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      const res = await exportToOtlpJson({ eventsPath, outPath, serviceName: 'llm-rules-test' });
      assert.equal(res.ok, true);
      assert.equal(res.spans, 1);

      const payload = JSON.parse(
        await (await import('node:fs/promises')).readFile(outPath, 'utf8')
      );
      const span = payload.resourceSpans[0].scopeSpans[0].spans[0];
      assert.equal(span.name, 'tool:pnpm test');

      const traceBytes = Buffer.from(span.traceId, 'base64');
      const spanBytes = Buffer.from(span.spanId, 'base64');
      assert.equal(traceBytes.length, 16);
      assert.equal(spanBytes.length, 8);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips spans with invalid trace/span id lengths and warns on empty export', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-otlp-'));
    try {
      const eventsPath = join(root, 'events.ndjson');
      const outPath = join(root, 'otlp.json');

      await writeFile(
        eventsPath,
        [
          JSON.stringify({
            ts: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            trace_id: 'abc', // invalid
            span_id: 'def', // invalid
            span_state: 'start',
            event_type: 'ToolCallStart',
            span_name: 'tool:bad',
            ok: true,
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      const res = await exportToOtlpJson({
        eventsPath,
        outPath,
        serviceName: 'llm-rules-test',
        allowEmpty: true,
      });
      assert.equal(res.ok, true);
      assert.equal(res.spans, 0);
      assert.ok(Array.isArray(res.warnings));
      assert.ok(res.warnings.some(w => /no valid spans/i.test(w)));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('aborts endpoint export when timeout is exceeded', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-otlp-'));
    const server = http.createServer((req, res) => {
      // Intentionally never respond.
      void req;
      void res;
    });

    await new Promise(resolve => server.listen(0, resolve));
    const { port } = server.address();
    const endpoint = `http://127.0.0.1:${port}/v1/traces`;

    try {
      const eventsPath = join(root, 'events.ndjson');
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);
      await writeFile(
        eventsPath,
        [
          JSON.stringify({
            ts: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            trace_id: traceId,
            span_id: spanId,
            span_state: 'start',
            event_type: 'ToolCallStart',
            span_name: 'tool:pnpm test',
            ok: true,
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      await assert.rejects(
        () => exportToOtlpJson({ eventsPath, endpoint, timeoutMs: 20, allowEmpty: true }),
        /aborted|AbortError|The user aborted a request/i
      );
    } finally {
      server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
