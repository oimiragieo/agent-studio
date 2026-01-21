import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
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
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
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

async function setupRunDirs() {
  const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
  const runtimeSessionsDir = join(runtimeDir, 'sessions');
  const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));
  const hookTmpDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-hooktmp-'));
  const handoffArtifactsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-handoff-artifacts-'));
  return { runtimeDir, runtimeSessionsDir, toolEventsDir, hookTmpDir, handoffArtifactsDir };
}

async function writeRoutingState({ hookTmpDir, sessionKey, handoffTarget }) {
  const routingSessionsDir = join(hookTmpDir, 'routing-sessions');
  await mkdir(routingSessionsDir, { recursive: true });
  const path = join(routingSessionsDir, `${safeFileId(sessionKey)}.json`);
  const now = new Date().toISOString();
  const state = {
    routing: {
      completed: true,
      completed_at: now,
      decision: {
        selected_workflow: '@.claude/workflows/automated-enterprise-flow.yaml',
        should_escalate: true,
        escalation_target: handoffTarget,
      },
      handoff_target: handoffTarget,
      handoff_completed: false,
    },
  };
  await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');
}

async function getRunId({ runtimeSessionsDir, sessionKey }) {
  const sessionMap = join(runtimeSessionsDir, `${safeFileId(sessionKey)}.json`);
  const mapping = JSON.parse(await readFile(sessionMap, 'utf-8'));
  return mapping.run_id;
}

describe('routing handoff observability', () => {
  it('records proactive outcome when target is spawned without prior handoff denial', async () => {
    const { runtimeDir, runtimeSessionsDir, toolEventsDir, hookTmpDir, handoffArtifactsDir } =
      await setupRunDirs();
    const sessionKey = `test-session-${Date.now()}`;
    const handoffTarget = 'diagnostics-runner';

    // Create run mapping.
    await runHook(
      'pre',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );
    const runId = await getRunId({ runtimeSessionsDir, sessionKey });

    // Seed routing decision into run-observer state.
    await writeRoutingState({ hookTmpDir, sessionKey, handoffTarget });
    await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        tool_result: '{}',
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );

    // Spawn target without a denial event in tool-events.
    await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: handoffTarget, prompt: 'Run diagnostics' },
        tool_result: '{}',
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'router',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );

    const artifactPath = join(handoffArtifactsDir, `run-${runId}.json`);
    assert.equal(existsSync(artifactPath), true);
    const artifact = JSON.parse(await readFile(artifactPath, 'utf-8'));
    assert.equal(artifact.outcome, 'proactive');

    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
    await rm(hookTmpDir, { recursive: true, force: true });
    await rm(handoffArtifactsDir, { recursive: true, force: true });
  });

  it('records fallback outcome when a handoff denial occurred before spawning target', async () => {
    const { runtimeDir, runtimeSessionsDir, toolEventsDir, hookTmpDir, handoffArtifactsDir } =
      await setupRunDirs();
    const sessionKey = `test-session-${Date.now()}`;
    const handoffTarget = 'diagnostics-runner';

    await runHook(
      'pre',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );
    const runId = await getRunId({ runtimeSessionsDir, sessionKey });

    await writeRoutingState({ hookTmpDir, sessionKey, handoffTarget });
    await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify' },
        tool_result: '{}',
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'default',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );

    // Insert a denied Task event with the handoff marker before spawning target.
    const toolEventsPath = join(toolEventsDir, `run-${runId}.ndjson`);
    await appendFile(
      toolEventsPath,
      JSON.stringify({
        denied: true,
        denied_by: 'router-first-enforcer',
        tool: 'Task',
        denial_reason: 'ROUTING HANDOFF REQUIRED',
      }) + '\n',
      'utf-8'
    );

    await runHook(
      'post',
      {
        tool_name: 'Task',
        tool_input: { subagent_type: handoffTarget, prompt: 'Run diagnostics' },
        tool_result: '{}',
        context: {},
      },
      {
        CLAUDE_SESSION_ID: sessionKey,
        CLAUDE_AGENT_NAME: 'router',
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
        CLAUDE_HOOK_TMP_DIR: hookTmpDir,
        CLAUDE_ROUTING_HANDOFF_ARTIFACTS_DIR: handoffArtifactsDir,
      }
    );

    const artifactPath = join(handoffArtifactsDir, `run-${runId}.json`);
    assert.equal(existsSync(artifactPath), true);
    const artifact = JSON.parse(await readFile(artifactPath, 'utf-8'));
    assert.equal(artifact.outcome, 'fallback');

    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
    await rm(hookTmpDir, { recursive: true, force: true });
    await rm(handoffArtifactsDir, { recursive: true, force: true });
  });
});
