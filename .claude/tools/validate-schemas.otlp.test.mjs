import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { validateFile } from './validate-schemas.mjs';

describe('validate-schemas (otlp)', () => {
  it('auto-detects schema for observability/*-otlp.json', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-validate-schemas-otlp-'));
    try {
      const dir = join(root, 'observability');
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, 'agent-integration-v1-20260119-123456-otlp.json');
      await writeFile(
        filePath,
        JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans: [] }] }] }, null, 2),
        'utf8'
      );

      const res = await validateFile(filePath);
      assert.equal(res.autoDetected, true);
      assert.equal(res.schema, 'otlp-traces.schema.json');
      assert.equal(
        res.valid,
        true,
        `errors: ${JSON.stringify(res.errors || res.errorMessages || [])}`
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
