import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { validateFile } from './validate-schemas.mjs';

describe('validate-schemas (agent integration artifacts)', () => {
  it('auto-detects schema for testing/*-run-results.json', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-validate-schemas-'));
    try {
      const filePath = join(
        root,
        'testing',
        'agent-integration-v1-20260119-123456-run-results.json'
      );
      await mkdir(join(root, 'testing'), { recursive: true });
      await writeFile(
        filePath,
        JSON.stringify(
          {
            workflow_id: 'agent-integration-v1-20260119-123456',
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            suite_statuses: {
              test: { exit_code: 0 },
              tools: { exit_code: 0 },
              validate: { exit_code: 0 },
              workflow_dryrun: { exit_code: 0 },
            },
          },
          null,
          2
        ),
        'utf8'
      );

      const res = await validateFile(filePath);
      assert.equal(res.autoDetected, true);
      assert.equal(res.schema, 'agent-integration-run-results.schema.json');
      assert.equal(
        res.valid,
        true,
        `errors: ${JSON.stringify(res.errors || res.errorMessages || [])}`
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('auto-detects schema for *-agent-smoke/_summary.json', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-validate-schemas-smoke-'));
    try {
      const smokeDir = join(root, 'agent-integration-v1-20260119-123456-agent-smoke');
      await mkdir(smokeDir, { recursive: true });
      const filePath = join(smokeDir, '_summary.json');
      await writeFile(
        filePath,
        JSON.stringify(
          {
            workflow_id: 'agent-integration-v1-20260119-123456',
            generated_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            total: 1,
            passed: 1,
            failed: 0,
            receipts_directory: smokeDir,
            results: [{ agent: 'router', ok: true, receipt_path: join(smokeDir, 'router.json') }],
          },
          null,
          2
        ),
        'utf8'
      );

      const res = await validateFile(filePath);
      assert.equal(res.autoDetected, true);
      assert.equal(res.schema, 'agent-smoke-summary.schema.json');
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
