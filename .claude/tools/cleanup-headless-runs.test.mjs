import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

import { cleanupHeadlessRuns } from './cleanup-headless-runs.mjs';

describe('cleanup-headless-runs tool', () => {
  it('refuses retention-days < 1 (safety)', async () => {
    await assert.rejects(
      () => cleanupHeadlessRuns({ projectRoot: process.cwd(), mode: 'dry-run', retentionDays: 0 }),
      {
        message: /retention-days must be at least 1/i,
      }
    );
  });

  it('selects and deletes old headless runs and otlp exports', async () => {
    const root = await (
      await import('node:fs/promises')
    ).mkdtemp(join(os.tmpdir(), 'llm-rules-cleanup-headless-'));
    try {
      const runsDir = join(root, '.claude', 'context', 'runtime', 'headless', 'runs');
      const obsDir = join(root, '.claude', 'context', 'artifacts', 'observability');
      await mkdir(runsDir, { recursive: true });
      await mkdir(obsDir, { recursive: true });

      const oldRun = join(runsDir, 'headless-old');
      const newRun = join(runsDir, 'headless-new');
      await mkdir(oldRun, { recursive: true });
      await mkdir(newRun, { recursive: true });

      const oldOtlp = join(obsDir, 'agent-integration-v1-20260119-000000-otlp.json');
      const newOtlp = join(obsDir, 'agent-integration-v1-20260119-000001-otlp.json');
      await writeFile(oldOtlp, '{}', 'utf8');
      await writeFile(newOtlp, '{}', 'utf8');

      const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days
      const newTime = new Date();
      await utimes(oldRun, oldTime, oldTime);
      await utimes(oldOtlp, oldTime, oldTime);
      await utimes(newRun, newTime, newTime);
      await utimes(newOtlp, newTime, newTime);

      const dry = await cleanupHeadlessRuns({
        projectRoot: root,
        mode: 'dry-run',
        retentionDays: 7,
        includeOtlp: true,
      });
      assert.equal(dry.ok, true);
      assert.equal(
        dry.candidates.some(c => c.path === oldRun),
        true
      );
      assert.equal(
        dry.candidates.some(c => c.path === oldOtlp),
        true
      );
      assert.equal(
        dry.candidates.some(c => c.path === newRun),
        false
      );
      assert.equal(
        dry.candidates.some(c => c.path === newOtlp),
        false
      );

      const exec = await cleanupHeadlessRuns({
        projectRoot: root,
        mode: 'execute',
        retentionDays: 7,
        includeOtlp: true,
      });
      assert.equal(exec.ok, true);
      assert.equal(existsSync(oldRun), false);
      assert.equal(existsSync(oldOtlp), false);
      assert.equal(existsSync(newRun), true);
      assert.equal(existsSync(newOtlp), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
