import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = process.cwd();
const ENFORCER_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'router-first-enforcer.mjs');
const COMPLETION_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'router-completion-handler.mjs');
const SESSION_KEY = 'test-session';
const INCOMING_PROMPT_PATH = join(
  PROJECT_ROOT,
  '.claude',
  'context',
  'queue',
  'incoming-prompt.json'
);
let HOOK_TMP_DIR = '';
let ROUTING_SESSIONS_DIR = '';
let LEGACY_STATE_PATH = '';
let ROUTING_ARTIFACTS_DIR = '';

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function getStatePath() {
  return join(ROUTING_SESSIONS_DIR, `${safeFileId(SESSION_KEY)}.json`);
}

function getArtifactPath() {
  return join(ROUTING_ARTIFACTS_DIR, `${safeFileId(SESSION_KEY)}.json`);
}

async function runHook(scriptPath, input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
        CLAUDE_ROUTING_ARTIFACTS_DIR: ROUTING_ARTIFACTS_DIR,
        ...env,
      },
    });
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
        resolve(trimmed ? JSON.parse(trimmed) : null);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse hook JSON (exit=${code}): ${scriptPath}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n${error.message}`
          )
        );
      }
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    setTimeout(() => proc.kill('SIGTERM'), 5000);
  });
}

beforeEach(async () => {
  HOOK_TMP_DIR = mkdtempSync(join(tmpdir(), 'llm-rules-hooktmp-'));
  ROUTING_SESSIONS_DIR = join(HOOK_TMP_DIR, 'routing-sessions');
  LEGACY_STATE_PATH = join(HOOK_TMP_DIR, 'routing-session-state.json');
  ROUTING_ARTIFACTS_DIR = join(HOOK_TMP_DIR, 'artifacts', 'routing');
  await rm(getStatePath(), { force: true });
  await rm(LEGACY_STATE_PATH, { force: true });
  await rm(getArtifactPath(), { force: true });
  await rm(INCOMING_PROMPT_PATH, { force: true });
});

describe('router-first enforcement state transitions', () => {
  it('router-first-enforcer allows router tool calls before routing completes', async () => {
    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool_name: 'router',
      tool_input: { prompt: 'Classify request' },
      context: { agent_name: 'default' },
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-first-enforcer tolerates router tool display names (e.g. router(...))', async () => {
    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool_name: 'router(Classify request)',
      tool_input: { prompt: 'Classify request' },
      context: { agent_name: 'default' },
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-first-enforcer tolerates alternate hook input keys (tool/tool_input)', async () => {
    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool: 'router',
      tool_input: { prompt: 'Classify request' },
      context: { agent_name: 'default' },
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-first-enforcer fallback allows Glob scoped to .claude when routing has started and agent identity is missing', async () => {
    const state = {
      session_id: 'sess_test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      routing: {
        completed: false,
        started_at: new Date().toISOString(),
        completed_at: null,
        decision: null,
      },
      routing_history: [],
      metrics: {},
      version: 1,
      last_compact_ms: Date.now(),
    };
    await mkdir(ROUTING_SESSIONS_DIR, { recursive: true });
    await writeFile(getStatePath(), JSON.stringify(state, null, 2), 'utf-8');

    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool_name: 'Glob',
      tool_input: { glob: '.claude/**/*.md' },
      // Intentionally omit context.agent_name
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-completion-handler marks routing.completed=true after router Task', async () => {
    const routerDecision = {
      intent: 'analysis',
      complexity: 'medium',
      workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
      confidence: 0.95,
      should_escalate: true,
      escalation_target: 'master-orchestrator',
      keywords_detected: ['deep dive', 'router'],
      reasoning: 'Test routing decision',
    };

    const completionResult = await runHook(COMPLETION_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Analyze routing issue' },
      tool_result: JSON.stringify(routerDecision),
      context: { agent_name: 'master-orchestrator' },
    });

    assert.equal(completionResult.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.equal(existsSync(getStatePath()), true);
    assert.equal(existsSync(getArtifactPath()), true);

    const state = JSON.parse(await readFile(getStatePath(), 'utf-8'));
    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision.workflow_selection, routerDecision.workflow_selection);

    const artifact = JSON.parse(await readFile(getArtifactPath(), 'utf-8'));
    assert.equal(artifact.artifact_type, 'routing_decision');
    assert.equal(artifact.session_key, SESSION_KEY);
    assert.equal(artifact.shouldRoute, true);
    assert.equal(artifact.escalation_target, 'master-orchestrator');
    assert.equal(artifact.selected_workflow, routerDecision.workflow_selection);
  });

  it('router-first-enforcer allows subsequent tools once routing is completed', async () => {
    await runHook(COMPLETION_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Analyze routing issue' },
      tool_result: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
        confidence: 0.9,
        // No escalation target -> should not force a handoff gate.
        should_escalate: true,
      }),
      context: { agent_name: 'master-orchestrator' },
    });

    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool_name: 'Read',
      tool_input: { file_path: 'README.md' },
      context: { agent_name: 'developer' },
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-first-enforcer requires handoff to escalation_target after routing', async () => {
    await runHook(COMPLETION_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Route to diagnostics-runner' },
      tool_result: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/automated-enterprise-flow.yaml',
        confidence: 0.9,
        should_escalate: true,
        escalation_target: 'diagnostics-runner',
      }),
      context: { agent_name: 'router' },
    });

    const blocked = await runHook(ENFORCER_PATH, {
      tool_name: 'Read',
      tool_input: { file_path: 'README.md' },
      context: { agent_name: 'default' },
    });
    assert.equal(blocked.decision, 'block');
    assert.ok(String(blocked.reason || '').includes('ROUTING HANDOFF REQUIRED'));

    const allowedSpawn = await runHook(ENFORCER_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'diagnostics-runner', prompt: 'Run diagnostics' },
      context: { agent_name: 'default' },
    });
    assert.equal(allowedSpawn.decision, 'approve');

    const afterHandoff = await runHook(ENFORCER_PATH, {
      tool_name: 'Read',
      tool_input: { file_path: 'README.md' },
      context: { agent_name: 'default' },
    });
    assert.equal(afterHandoff.decision, 'approve');
  });

  it('router-first-enforcer falls back to legacy mirror if per-session state is missing', async () => {
    await runHook(COMPLETION_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Analyze routing issue' },
      tool_result: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
        confidence: 0.9,
        // No escalation target -> should not force a handoff gate.
        should_escalate: true,
      }),
      context: { agent_name: 'master-orchestrator' },
    });

    // Simulate a different OS process or session-key mismatch where the per-session file isn't present.
    await rm(getStatePath(), { force: true });
    assert.equal(existsSync(LEGACY_STATE_PATH), true);

    const enforcerResult = await runHook(ENFORCER_PATH, {
      tool_name: 'Read',
      tool_input: { file_path: 'README.md' },
      context: { agent_name: 'developer' },
    });

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('routing state stays consistent when only some hook processes receive env session ids (debug-mode behavior)', async () => {
    const rawEnvSessionId = '3fdb298e-c0ac-4986-915a-262ba2a81fd8';
    const normalizedSessionKey = `shared-${rawEnvSessionId}`;
    const statePath = join(ROUTING_SESSIONS_DIR, `${safeFileId(normalizedSessionKey)}.json`);

    await runHook(
      COMPLETION_PATH,
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Analyze routing issue' },
        tool_result: JSON.stringify({
          intent: 'analysis',
          complexity: 'high',
          workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
          confidence: 0.9,
          should_escalate: false,
        }),
        context: { agent_name: 'router' },
      },
      { CLAUDE_SESSION_ID: rawEnvSessionId }
    );

    assert.equal(existsSync(statePath), true);

    // Simulate a different OS process where CLAUDE_SESSION_ID isn't present, but the
    // shared-session-key.json created above is readable.
    const enforcerResult = await runHook(
      ENFORCER_PATH,
      {
        tool_name: 'Read',
        tool_input: { file_path: 'README.md' },
        context: { agent_name: 'developer' },
      },
      { CLAUDE_SESSION_ID: '' }
    );

    assert.equal(enforcerResult.decision, 'approve');
  });

  it('router-completion-handler skips non-router Task delegations', async () => {
    const completionResult = await runHook(COMPLETION_PATH, {
      tool_name: 'Task',
      tool_input: { subagent_type: 'developer', prompt: 'Implement feature' },
      tool_result: 'ok',
      context: { agent_name: 'master-orchestrator' },
    });

    assert.equal(completionResult.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.equal(existsSync(getStatePath()), false);
  });

  it('router-completion-handler can complete routing on router tool results (non-Task runtimes)', async () => {
    const completionResult = await runHook(COMPLETION_PATH, {
      tool_name: 'router',
      tool_input: { prompt: 'Classify request' },
      tool_result: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
        confidence: 0.8,
        should_escalate: true,
      }),
      context: { agent_name: 'router' },
    });

    assert.equal(completionResult.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.equal(existsSync(getStatePath()), true);
  });

  it('router-completion-handler uses incoming prompt when tool prompt is generic', async () => {
    await mkdir(join(PROJECT_ROOT, '.claude', 'context', 'queue'), { recursive: true });
    await writeFile(
      INCOMING_PROMPT_PATH,
      JSON.stringify(
        {
          prompt:
            'Run a system diagnostics test on the Claude framework with 100% coverage of tools, agents, workflows, and hooks.',
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        null,
        2
      ),
      'utf-8'
    );

    const completionResult = await runHook(COMPLETION_PATH, {
      tool_name: 'router',
      tool_input: { prompt: 'Classify request' },
      tool_result: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        // omit escalation_target on purpose; handler should fall back
        should_escalate: true,
      }),
      context: { agent_name: 'router' },
    });

    assert.equal(completionResult.hookSpecificOutput.hookEventName, 'PostToolUse');
    const state = JSON.parse(await readFile(getStatePath(), 'utf-8'));
    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.handoff_target, 'diagnostics-runner');
    assert.equal(state.routing.decision.escalation_target, 'diagnostics-runner');
  });

  it('router-completion-handler tolerates alternate hook input keys (tool/tool_result)', async () => {
    const completionResult = await runHook(COMPLETION_PATH, {
      tool: 'router',
      tool_input: { prompt: 'Classify request' },
      toolResult: JSON.stringify({
        intent: 'analysis',
        complexity: 'high',
        workflow_selection: '@.claude/workflows/code-quality-flow.yaml',
        confidence: 0.8,
        should_escalate: true,
      }),
      context: { agent_name: 'router' },
    });

    assert.equal(completionResult.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.equal(existsSync(getStatePath()), true);
  });
});
