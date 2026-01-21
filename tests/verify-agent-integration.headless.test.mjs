import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { verifyAgentIntegration } from '../.claude/tools/verify-agent-integration.mjs';

describe('verify-agent-integration tool (headless mode)', () => {
  it('passes without runtime events/tool-events when mode=headless', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-agent-int-headless-'));
    try {
      const workflowId = 'agent-integration-v1-20260119-123456';

      await mkdir(join(root, '.claude', 'agents'), { recursive: true });
      await writeFile(join(root, '.claude', 'agents', 'router.md'), '# router\n', 'utf8');
      await writeFile(join(root, '.claude', 'agents', 'developer.md'), '# developer\n', 'utf8');

      const reportsDir = join(root, '.claude', 'context', 'reports', 'testing');
      const artifactsDir = join(root, '.claude', 'context', 'artifacts', 'testing');
      const smokeDir = join(artifactsDir, `${workflowId}-agent-smoke`);
      await mkdir(reportsDir, { recursive: true });
      await mkdir(smokeDir, { recursive: true });

      await writeFile(
        join(reportsDir, `${workflowId}-run-report.md`),
        [
          '# Report',
          'Overall Status: PASS',
          'Agent smoke results',
          'Workflow dry-run warnings summary',
        ].join('\n'),
        'utf8'
      );

      await writeFile(
        join(artifactsDir, `${workflowId}-run-results.json`),
        JSON.stringify(
          {
            workflow_id: workflowId,
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            suite_statuses: {
              test: { exit_code: 0 },
              tools: { exit_code: 0 },
              validate: { exit_code: 0 },
              workflow_dryrun: { exit_code: 0 },
            },
            agent_smoke_receipts_path: smokeDir,
            observability_paths: {},
          },
          null,
          2
        ),
        'utf8'
      );

      await writeFile(
        join(smokeDir, 'router.json'),
        JSON.stringify(
          { agent: 'router', task_summary: 'x', tool_used: 'Read', ok: true, notes: '' },
          null,
          2
        ),
        'utf8'
      );
      await writeFile(
        join(smokeDir, 'developer.json'),
        JSON.stringify(
          { agent: 'developer', task_summary: 'x', tool_used: 'Read', ok: true, notes: '' },
          null,
          2
        ),
        'utf8'
      );

      const res = await verifyAgentIntegration({ projectRoot: root, workflowId, mode: 'headless' });
      assert.equal(res.ok, true);
      assert.equal(res.status, 'PASS');
      assert.equal(res.mode, 'headless');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
