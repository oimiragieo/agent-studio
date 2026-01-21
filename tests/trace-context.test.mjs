import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TraceContext, parseTraceparent } from '../.claude/tools/trace-context.mjs';

describe('TraceContext (OTel/W3C)', () => {
  it('generates valid trace_id/span_id and traceparent', () => {
    const ctx = new TraceContext();
    assert.match(ctx.trace_id, /^[0-9a-f]{32}$/);
    assert.match(ctx.span_id, /^[0-9a-f]{16}$/);
    assert.match(ctx.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  it('parses traceparent and creates child span with correct parent', () => {
    const root = new TraceContext();
    const parsed = parseTraceparent(root.traceparent);
    assert.equal(parsed.trace_id, root.trace_id);
    assert.equal(parsed.parent_span_id, root.span_id);
    assert.equal(parsed.sampled, true);

    const child = root.childSpan({ agent_name: 'router' });
    assert.equal(child.trace_id, root.trace_id);
    assert.equal(child.parent_span_id, root.span_id);
    assert.equal(child.baggage.agent_name, 'router');
  });
});
