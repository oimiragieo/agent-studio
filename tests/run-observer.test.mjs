import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

const PROJECT_ROOT = process.cwd();
const HOOK_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'run-observer.mjs');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

async function runHook(phase, input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [HOOK_PATH, phase], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk;
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk;
    });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      const trimmed = stdout.trim();
      try {
        resolve({ json: trimmed ? JSON.parse(trimmed) : null, stderr, code });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse hook JSON (exit=${code})\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n${error.message}`
          )
        );
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

describe('run-observer hook', () => {
  it('creates run state and increments steps on Task completion', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const runtimeRunsDir = join(runtimeDir, 'runs');
    const runtimeSessionsDir = join(runtimeDir, 'sessions');
    const artifactsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-artifacts-'));
    const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));

    const sessionId = `test-session-${Date.now()}`;
    const sessionMap = join(runtimeSessionsDir, `${safeFileId(sessionId)}.json`);
    await rm(sessionMap, { force: true });

    const pre = await runHook(
      'pre',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_AGENT_ARTIFACTS_DIR: artifactsDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );

    assert.equal(pre.json.decision, 'approve');

    assert.equal(existsSync(sessionMap), true);
    const mapping = JSON.parse(await readFile(sessionMap, 'utf-8'));
    const runId = mapping.run_id;
    assert.ok(runId);
    const runDir = join(runtimeRunsDir, runId);
    const statePath = join(runDir, 'state.json');
    const eventsPath = join(runDir, 'events.ndjson');

    assert.equal(existsSync(statePath), true);

    const post = await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        tool_result: '{"intent":"analysis"}',
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_AGENT_ARTIFACTS_DIR: artifactsDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );

    assert.equal(post.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(state.run_id, runId);
    assert.equal(state.current_step >= 1, true);
    assert.equal(state.status, 'running');
    assert.equal(existsSync(eventsPath), true);

    const sessionArtifactsDir = join(artifactsDir, safeFileId(sessionId));
    assert.equal(existsSync(sessionArtifactsDir), true);
    const artifacts = await readdir(sessionArtifactsDir);
    assert.equal(artifacts.length >= 1, true);
    const first = JSON.parse(await readFile(join(sessionArtifactsDir, artifacts[0]), 'utf-8'));
    assert.equal(first.artifact_type, 'agent_task_completion');
    assert.equal(first.delegated_agent, 'router');

    const toolEventsPath = join(toolEventsDir, `run-${runId}.ndjson`);
    assert.equal(existsSync(toolEventsPath), true);
    const lines = (await readFile(toolEventsPath, 'utf-8'))
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    assert.equal(lines.length >= 2, true);
    const events = lines.map(line => JSON.parse(line));
    assert.equal(
      events.some(e => e.phase === 'pre' && e.tool === 'Task' && e.agent === 'default'),
      true
    );
    assert.equal(
      events.some(e => e.phase === 'post' && e.tool === 'Task' && e.agent === 'default'),
      true
    );

    const preEvent = events.find(
      e => e.phase === 'pre' && e.tool === 'Task' && e.agent === 'default'
    );
    const postEvent = events.find(
      e => e.phase === 'post' && e.tool === 'Task' && e.agent === 'default'
    );
    assert.match(String(preEvent.trace_id || ''), /^[0-9a-f]{32}$/);
    assert.match(String(preEvent.span_id || ''), /^[0-9a-f]{16}$/);
    assert.equal(preEvent.trace_id, postEvent.trace_id);
    assert.equal(preEvent.span_id, postEvent.span_id);

    // Trace correctness: spans should never self-parent (root parent_span_id must be null).
    const eventLines = (await readFile(eventsPath, 'utf-8'))
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const ndjson = eventLines.map(line => JSON.parse(line));
    assert.equal(
      ndjson.some(
        e => typeof e.span_id === 'string' && e.span_id && e.parent_span_id === e.span_id
      ),
      false
    );

    // Cleanup: best-effort
    await rm(runDir, { recursive: true, force: true });
    await rm(sessionMap, { force: true });
    await rm(runtimeDir, { recursive: true, force: true });
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
  });

  it('keeps last-known agent when context is missing', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const runtimeRunsDir = join(runtimeDir, 'runs');
    const runtimeSessionsDir = join(runtimeDir, 'sessions');

    const sessionId = `test-session-${Date.now()}`;
    const sessionMap = join(runtimeSessionsDir, `${safeFileId(sessionId)}.json`);
    await rm(sessionMap, { force: true });

    // Seed state with a known agent name.
    const pre = await runHook(
      'pre',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_AGENT_NAME: 'developer',
        CLAUDE_RUNTIME_DIR: runtimeDir,
      }
    );
    assert.equal(pre.json.decision, 'approve');

    const mapping = JSON.parse(await readFile(sessionMap, 'utf-8'));
    const runId = mapping.run_id;
    assert.ok(runId);

    // Simulate a tool worker call without env agent identity and without context.
    const post = await runHook(
      'post',
      { tool_name: 'Bash', tool_input: { command: 'echo hi' }, tool_result: 'ok', context: {} },
      { CLAUDE_SESSION_ID: sessionId, CLAUDE_RUNTIME_DIR: runtimeDir }
    );
    assert.equal(post.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const statePath = join(runtimeRunsDir, runId, 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(state.current_agent, 'developer');

    await rm(join(runtimeRunsDir, runId), { recursive: true, force: true });
    await rm(sessionMap, { force: true });
    await rm(runtimeDir, { recursive: true, force: true });
  });

  it('attributes SubagentStart/SubagentStop using pending Task delegation', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const runtimeRunsDir = join(runtimeDir, 'runs');
    const runtimeSessionsDir = join(runtimeDir, 'sessions');
    const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));

    const sessionId = `test-session-${Date.now()}`;
    const sessionMap = join(runtimeSessionsDir, `${safeFileId(sessionId)}.json`);
    await rm(sessionMap, { force: true });

    // Spawn a router subagent; this should be recorded as "pending" so SubagentStart can be attributed.
    const taskPre = await runHook(
      'pre',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_AGENT_NAME: 'developer',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(taskPre.json.decision, 'approve');

    const mapping = JSON.parse(await readFile(sessionMap, 'utf-8'));
    const runId = mapping.run_id;
    assert.ok(runId);

    // Claude Code often omits context/tool_input for SubagentStart; ensure we still attribute it.
    const start = await runHook(
      'subagent-start',
      { tool_name: '', tool_input: {}, context: {} },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(start.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const statePath = join(runtimeRunsDir, runId, 'state.json');
    const stateAfterStart = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(stateAfterStart.current_agent, 'router');

    // A tool call without env/context should inherit the last-known agent (router).
    const post = await runHook(
      'post',
      { tool_name: 'Read', tool_input: { file_path: 'README.md' }, tool_result: 'ok', context: {} },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(post.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const stateAfterRead = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(stateAfterRead.current_agent, 'router');

    // On SubagentStop we should restore the parent agent if it was known.
    const stop = await runHook(
      'subagent-stop',
      { tool_name: '', tool_input: {}, context: {} },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(stop.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const stateAfterStop = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(stateAfterStop.current_agent, 'developer');

    await rm(join(runtimeRunsDir, runId), { recursive: true, force: true });
    await rm(sessionMap, { force: true });
    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
  });

  it('records failures and marks run failed', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const runtimeRunsDir = join(runtimeDir, 'runs');
    const runtimeSessionsDir = join(runtimeDir, 'sessions');

    const sessionId = `test-session-${Date.now()}`;
    const sessionMap = join(runtimeSessionsDir, `${safeFileId(sessionId)}.json`);
    await rm(sessionMap, { force: true });

    const pre = await runHook(
      'pre',
      { tool_name: 'router', tool_input: { prompt: 'Classify request' }, context: {} },
      { CLAUDE_SESSION_ID: sessionId, CLAUDE_AGENT_NAME: 'default', CLAUDE_RUNTIME_DIR: runtimeDir }
    );
    assert.equal(pre.json.decision, 'approve');
    assert.equal(existsSync(sessionMap), true);
    const mapping = JSON.parse(await readFile(sessionMap, 'utf-8'));
    const runId = mapping.run_id;
    assert.ok(runId);

    const post = await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify request' },
        tool_result: 'PreToolUse:Task hook error',
        context: {},
      },
      { CLAUDE_SESSION_ID: sessionId, CLAUDE_AGENT_NAME: 'default', CLAUDE_RUNTIME_DIR: runtimeDir }
    );

    assert.equal(post.json.hookSpecificOutput.hookEventName, 'PostToolUse');

    const statePath = join(runtimeRunsDir, runId, 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    assert.equal(state.status, 'failed');
    assert.equal(Array.isArray(state.errors), true);
    assert.equal(state.errors.length >= 1, true);

    await rm(join(runtimeRunsDir, runId), { recursive: true, force: true });
    await rm(sessionMap, { force: true });
    await rm(runtimeDir, { recursive: true, force: true });
  });
});
