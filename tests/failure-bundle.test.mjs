import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

import { generateFailureBundle } from '../.claude/tools/failure-bundle.mjs';

describe('failure-bundle tool', () => {
  it('writes a bundle with tails and refs', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));
    const bundlesDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-failure-bundles-'));

    const prevRuntime = process.env.CLAUDE_RUNTIME_DIR;
    process.env.CLAUDE_RUNTIME_DIR = runtimeDir;

    try {
      const runId = `run-${Date.now()}`;
      const runDir = join(runtimeDir, 'runs', runId);
      await mkdir(runDir, { recursive: true });

      await writeFile(
        join(runDir, 'state.json'),
        JSON.stringify(
          {
            run_id: runId,
            status: 'failed',
            current_agent: 'developer',
            current_step: 3,
            errors: [
              { at: new Date().toISOString(), tool: 'Bash', agent: 'developer', message: 'boom' },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      await writeFile(
        join(runDir, 'events.ndjson'),
        [
          JSON.stringify({ ts: new Date().toISOString(), phase: 'pre', tool: 'Bash', ok: true }),
          JSON.stringify({
            ts: new Date().toISOString(),
            phase: 'post',
            tool: 'Bash',
            ok: false,
            error: 'boom',
          }),
        ].join('\n') + '\n',
        'utf8'
      );

      await writeFile(
        join(toolEventsDir, `run-${runId}.ndjson`),
        [
          JSON.stringify({ ts: new Date().toISOString(), tool: 'Bash', ok: false, error: 'boom' }),
        ].join('\n') + '\n',
        'utf8'
      );

      const res = await generateFailureBundle({
        traceId: 'a'.repeat(32),
        spanId: 'b'.repeat(16),
        runId,
        sessionKey: 'shared-test',
        failureType: 'tool_error',
        triggerEvent: { tool: 'Bash', ok: false },
        bundlesDir,
        toolEventsDir,
        tailLines: 10,
        tailBytes: 32 * 1024,
      });

      assert.ok(res.bundle_id);
      assert.ok(res.bundle_path);

      const bundle = JSON.parse(await readFile(res.bundle_path, 'utf8'));
      assert.equal(bundle.bundle_id, res.bundle_id);
      assert.equal(bundle.run_id, runId);
      assert.equal(bundle.failure_type, 'tool_error');
      assert.ok(bundle.refs);
      assert.ok(bundle.tails);
      assert.equal(Array.isArray(bundle.tails.events_tail), true);
      assert.equal(Array.isArray(bundle.tails.tool_events_tail), true);
      assert.ok(bundle.state_snapshot);
      assert.equal(bundle.state_snapshot.current_agent, 'developer');
    } finally {
      if (prevRuntime === undefined) delete process.env.CLAUDE_RUNTIME_DIR;
      else process.env.CLAUDE_RUNTIME_DIR = prevRuntime;
      await rm(runtimeDir, { recursive: true, force: true });
      await rm(toolEventsDir, { recursive: true, force: true });
      await rm(bundlesDir, { recursive: true, force: true });
    }
  });

  it('supports explicit events/tool-events paths (headless)', async () => {
    const root = await mkdtemp(join(os.tmpdir(), 'llm-rules-failure-bundle-headless-'));
    try {
      const eventsPath = join(root, 'events.ndjson');
      const toolEventsPath = join(root, 'tool-events.ndjson');
      await writeFile(
        eventsPath,
        JSON.stringify({ ts: new Date().toISOString(), event_type: 'ToolCallStart' }) + '\n',
        'utf8'
      );
      await writeFile(
        toolEventsPath,
        JSON.stringify({ ts: new Date().toISOString(), denied: false }) + '\n',
        'utf8'
      );

      const res = await generateFailureBundle({
        traceId: 'b'.repeat(32),
        spanId: 'a'.repeat(16),
        failureType: 'headless_error',
        eventsPath,
        toolEventsPath,
        bundlesDir: join(root, 'bundles'),
      });

      const bundle = JSON.parse(await readFile(res.bundle_path, 'utf8'));
      assert.equal(bundle.failure_type, 'headless_error');
      assert.equal(bundle.refs.events_path, eventsPath);
      assert.equal(bundle.refs.tool_events_path, toolEventsPath);
      assert.ok(Array.isArray(bundle.tails.events_tail));
      assert.ok(Array.isArray(bundle.tails.tool_events_tail));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
