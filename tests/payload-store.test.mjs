import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { storePayload } from '../.claude/tools/payload-store.mjs';

describe('payload-store tool', () => {
  it('stores sanitized payloads under trace/span path', async () => {
    const tmp = await mkdtemp(join(os.tmpdir(), 'llm-rules-payloads-'));
    try {
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);
      const secret = 'sk-ant-abcdefghijklmnopqrstuvwxyz0123456789';

      const meta = await storePayload({
        traceId,
        spanId,
        payloadsDir: tmp,
        maxBytes: 32 * 1024,
        inputs: { authorization: `Bearer ${secret}`, nested: { key: secret } },
        outputs: { ok: true, token: secret },
      });

      assert.ok(meta.payload_ref);
      assert.equal(meta.inputs_redacted, true);
      assert.equal(meta.outputs_redacted, true);

      const expectedPath = join(tmp, `trace-${traceId}`, `span-${spanId}.json`);
      assert.equal(meta.payload_ref, expectedPath);

      const payload = JSON.parse(await readFile(expectedPath, 'utf8'));
      const content = JSON.stringify(payload);
      assert.equal(content.includes(secret), false);
      assert.equal(content.includes('[REDACTED_ANTHROPIC_KEY]'), true);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
