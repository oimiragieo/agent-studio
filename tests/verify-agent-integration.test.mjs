import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { verifyAgentIntegration } from '../.claude/tools/verify-agent-integration.mjs';

describe('verify-agent-integration tool', () => {
  it('passes when required artifacts exist and observability signals are present', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-agent-int-'));
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

      const eventsPath = join(
        root,
        '.claude',
        'context',
        'runtime',
        'runs',
        'run-1',
        'events.ndjson'
      );
      const toolEventsPath = join(
        root,
        '.claude',
        'context',
        'artifacts',
        'tool-events',
        'run-run-1.ndjson'
      );
      await mkdir(join(root, '.claude', 'context', 'runtime', 'runs', 'run-1'), {
        recursive: true,
      });
      await mkdir(join(root, '.claude', 'context', 'artifacts', 'tool-events'), {
        recursive: true,
      });
      await writeFile(
        eventsPath,
        [
          JSON.stringify({
            ts: new Date().toISOString(),
            event_type: 'AgentStart',
            phase: 'subagent_start',
          }),
          JSON.stringify({ ts: new Date().toISOString(), payload: { payload_ref: 'x' } }),
          JSON.stringify({
            ts: new Date().toISOString(),
            event_type: 'AgentStop',
            phase: 'subagent_stop',
          }),
        ].join('\n') + '\n',
        'utf8'
      );
      await writeFile(
        toolEventsPath,
        [JSON.stringify({ ts: new Date().toISOString(), denied: true, ok: false })].join('\n') +
          '\n',
        'utf8'
      );

      await writeFile(
        join(reportsDir, `${workflowId}-run-report.md`),
        [
          '# Report',
          'Overall Status: PASS',
          'Agent smoke results: 2',
          `Events: ${eventsPath}`,
          'payload_ref: example',
          'Denial: denied',
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
            observability_paths: { events: eventsPath, tool_events: toolEventsPath },
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

      const res = await verifyAgentIntegration({ projectRoot: root, workflowId });
      assert.equal(res.ok, true);
      assert.equal(res.status, 'PASS');
      assert.ok(res.outputs.verification_json);
      assert.ok(res.outputs.verification_report);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('allows core agent receipt expectation via --expected-agents core', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-agent-int-core-'));
    const prev = process.env.CLAUDE_VERIFY_EXPECTED_AGENTS;
    process.env.CLAUDE_VERIFY_EXPECTED_AGENTS = 'core';
    try {
      const workflowId = 'agent-integration-v1-20260119-123456';

      await mkdir(join(root, '.claude', 'agents'), { recursive: true });
      // Include core agents in repo, but only create receipts for a subset to prove core mode is used.
      for (const a of [
        'router',
        'orchestrator',
        'developer',
        'qa',
        'analyst',
        'security-architect',
        'performance-engineer',
        'technical-writer',
      ]) {
        await writeFile(join(root, '.claude', 'agents', `${a}.md`), `# ${a}\n`, 'utf8');
      }

      const reportsDir = join(root, '.claude', 'context', 'reports', 'testing');
      const artifactsDir = join(root, '.claude', 'context', 'artifacts', 'testing');
      const smokeDir = join(artifactsDir, `${workflowId}-agent-smoke`);
      await mkdir(reportsDir, { recursive: true });
      await mkdir(smokeDir, { recursive: true });

      const eventsPath = join(
        root,
        '.claude',
        'context',
        'runtime',
        'runs',
        'run-1',
        'events.ndjson'
      );
      const toolEventsPath = join(
        root,
        '.claude',
        'context',
        'artifacts',
        'tool-events',
        'run-run-1.ndjson'
      );
      await mkdir(join(root, '.claude', 'context', 'runtime', 'runs', 'run-1'), {
        recursive: true,
      });
      await mkdir(join(root, '.claude', 'context', 'artifacts', 'tool-events'), {
        recursive: true,
      });
      await writeFile(
        eventsPath,
        [
          JSON.stringify({ ts: new Date().toISOString(), event_type: 'AgentStart' }),
          JSON.stringify({ ts: new Date().toISOString(), payload: { payload_ref: 'x' } }),
          JSON.stringify({ ts: new Date().toISOString(), event_type: 'AgentStop' }),
        ].join('\n') + '\n',
        'utf8'
      );
      await writeFile(
        toolEventsPath,
        JSON.stringify({ ts: new Date().toISOString(), denied: true }) + '\n',
        'utf8'
      );

      await writeFile(
        join(reportsDir, `${workflowId}-run-report.md`),
        'Overall Status: PASS\nAgent smoke\n',
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
            observability_paths: { events: eventsPath, tool_events: toolEventsPath },
          },
          null,
          2
        ),
        'utf8'
      );

      // Only create receipts for 2 agents: should FAIL in all-mode, but core-mode still expects 8.
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

      const res = await verifyAgentIntegration({ projectRoot: root, workflowId });
      assert.equal(res.ok, false);
      assert.equal(
        res.failures.some(f => /Agent smoke receipts missing/.test(f)),
        true
      );
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_VERIFY_EXPECTED_AGENTS;
      else process.env.CLAUDE_VERIFY_EXPECTED_AGENTS = prev;
      await rm(root, { recursive: true, force: true });
    }
  });
});
