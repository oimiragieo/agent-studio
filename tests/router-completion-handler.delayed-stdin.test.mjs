import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = process.cwd();
const COMPLETION_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'router-completion-handler.mjs');
const SESSION_KEY = 'test-session-delayed-stdin';
let HOOK_TMP_DIR = '';

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

function statePath() {
  return join(HOOK_TMP_DIR, 'routing-sessions', `${safeFileId(SESSION_KEY)}.json`);
}

async function runCompletionHookWithDelay({ delayMs }) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [COMPLETION_PATH], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
      },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', err => reject(err));
    proc.on('close', code => resolve({ code, stdout, stderr }));

    setTimeout(() => {
      const payload = {
        tool_name: 'Task',
        tool_input: { subagent_type: 'router', prompt: 'Classify request' },
        tool_result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ selected_workflow: '@.claude/workflows/quick-flow.yaml' }),
            },
          ],
        },
        context: { agent_name: 'default' },
      };
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    }, delayMs);

    setTimeout(() => proc.kill('SIGTERM'), 10000);
  });
}

async function runCompletionHookWithSlowStream({ chunkDelayMs, chunks }) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [COMPLETION_PATH], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
      },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', c => (stdout += c));
    proc.stderr.on('data', c => (stderr += c));
    proc.on('error', err => reject(err));
    proc.on('close', code => resolve({ code, stdout, stderr }));

    const payload = {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Classify request' },
      tool_result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ selected_workflow: '@.claude/workflows/quick-flow.yaml' }),
          },
        ],
      },
      context: { agent_name: 'default' },
    };

    const text = JSON.stringify(payload);
    const parts = [];
    const size = Math.ceil(text.length / chunks);
    for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));

    let idx = 0;
    const writeNext = () => {
      if (idx >= parts.length) {
        proc.stdin.end();
        return;
      }
      proc.stdin.write(parts[idx]);
      idx++;
      setTimeout(writeNext, chunkDelayMs);
    };

    writeNext();

    setTimeout(() => proc.kill('SIGTERM'), 12000);
  });
}

async function runCompletionHookWithPayload(text) {
  const procResult = await new Promise((resolve, reject) => {
    const proc = spawn('node', [COMPLETION_PATH], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
      },
    });

    proc.on('error', err => reject(err));
    proc.on('close', code => resolve(code));

    const payload = {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt: 'Classify request' },
      tool_result: {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      },
      context: { agent_name: 'default' },
    };
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });

  assert.equal(procResult, 0);

  return JSON.parse(await readFile(statePath(), 'utf-8'));
}

async function runCompletionHookWithPromptAndPayload({ prompt, toolResultText }) {
  const procResult = await new Promise((resolve, reject) => {
    const proc = spawn('node', [COMPLETION_PATH], {
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: SESSION_KEY,
        CLAUDE_HOOK_TMP_DIR: HOOK_TMP_DIR,
      },
    });

    proc.on('error', err => reject(err));
    proc.on('close', code => resolve(code));

    const payload = {
      tool_name: 'Task',
      tool_input: { subagent_type: 'router', prompt },
      tool_result: {
        content: [
          {
            type: 'text',
            text: toolResultText,
          },
        ],
      },
      context: { agent_name: 'default' },
    };
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });

  assert.equal(procResult, 0);

  return JSON.parse(await readFile(statePath(), 'utf-8'));
}

beforeEach(async () => {
  HOOK_TMP_DIR = mkdtempSync(join(tmpdir(), 'llm-rules-hooktmp-'));
  await rm(statePath(), { force: true });
});

describe('router-completion-handler delayed stdin', () => {
  it('does not time out before stdin arrives (delayed >1500ms)', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const res = await runCompletionHookWithDelay({ delayMs: 400 });
    assert.equal(res.code, 0);

    const state = JSON.parse(await readFile(statePath(), 'utf-8'));
    assert.equal(state.routing.completed, true);
    assert.equal(typeof state.routing.decision?.selected_workflow, 'string');
  });

  it('handles slowly streamed stdin payloads without dropping tool_result', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    // Total stream time > 2200ms (previous regression window).
    const res = await runCompletionHookWithSlowStream({ chunkDelayMs: 200, chunks: 6 });
    assert.equal(res.code, 0);

    const state = JSON.parse(await readFile(statePath(), 'utf-8'));
    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision?.selected_workflow, '@.claude/workflows/quick-flow.yaml');
  });

  it('sanitizes fenced or single-quoted router JSON', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPayload(
      "```json\n{'selected_workflow': '@.claude/workflows/quick-flow.yaml',}\n``` trailing"
    );

    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision?.selected_workflow, '@.claude/workflows/quick-flow.yaml');
  });

  it('handles escaped quotes in router output', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPayload(
      '{"selected_workflow":"@.claude/workflows/quick-flow.yaml","reasoning":"prefers \\\"fast\\\" path"}'
    );

    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision?.selected_workflow, '@.claude/workflows/quick-flow.yaml');
    assert.equal(state.routing.decision?.reasoning, 'prefers "fast" path');
  });

  it('sanitizes router output with arrays', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPayload(
      "{'selected_workflow': '@.claude/workflows/quick-flow.yaml', 'keywords_detected': ['routing', 'test',],}"
    );

    assert.equal(state.routing.completed, true);
    assert.deepEqual(state.routing.decision?.keywords_detected, ['routing', 'test']);
  });

  it('sanitizes router output with nested objects', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPayload(
      "{'selected_workflow': '@.claude/workflows/quick-flow.yaml', 'metadata': {'source': 'router',},} trailing"
    );

    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision?.selected_workflow, '@.claude/workflows/quick-flow.yaml');
  });

  it('rewrites master-orchestrator escalation for integration tests to job-runner', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPromptAndPayload({
      prompt:
        'Run a single end-to-end integration test of the agent framework inside C:\\\\dev\\\\projects\\\\LLM-RULES',
      toolResultText: JSON.stringify({
        selected_workflow: '@.claude/workflows/recovery-test-flow.yaml',
        should_escalate: true,
        escalation_target: 'master-orchestrator',
        confidence: 0.9,
      }),
    });

    assert.equal(state.routing.completed, true);
    assert.equal(state.routing.decision?.should_escalate, true);
    assert.equal(state.routing.decision?.escalation_target, 'job-runner');
  });

  it('prefers integration harness over diagnostics wording for escalation target', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPromptAndPayload({
      prompt:
        'Run comprehensive framework diagnostics and an end-to-end integration test of the agent framework (agent-integration-v1-20260119-000000)',
      toolResultText: 'not-json router output',
    });

    assert.equal(state.routing.completed, true);
    assert.equal(
      state.routing.decision?.selected_workflow,
      '@.claude/workflows/agent-framework-integration-headless.yaml'
    );
    assert.equal(state.routing.decision?.should_escalate, true);
    assert.equal(state.routing.decision?.escalation_target, 'job-runner');
  });

  it('disables escalation when integration workflow is selected (even if router suggested diagnostics-runner)', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPromptAndPayload({
      prompt:
        'Run an end-to-end integration test of the agent framework inside C:\\\\dev\\\\projects\\\\LLM-RULES',
      toolResultText: JSON.stringify({
        selected_workflow: '@.claude/workflows/agent-framework-integration.yaml',
        should_escalate: true,
        escalation_target: 'diagnostics-runner',
        confidence: 0.9,
      }),
    });

    assert.equal(state.routing.completed, true);
    assert.equal(
      state.routing.decision?.selected_workflow,
      '@.claude/workflows/agent-framework-integration-headless.yaml'
    );
    assert.equal(state.routing.decision?.should_escalate, true);
    assert.equal(state.routing.decision?.escalation_target, 'job-runner');
  });

  it('forces ship-readiness headless workflow and routes to job-runner (even if router suggested orchestrator)', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPromptAndPayload({
      prompt:
        'Please run a ship readiness audit for C:\\\\dev\\\\projects\\\\LLM-RULES and produce an auditable report',
      toolResultText: JSON.stringify({
        selected_workflow: '@.claude/workflows/code-quality-flow.yaml',
        should_escalate: true,
        escalation_target: 'orchestrator',
        confidence: 0.9,
      }),
    });

    assert.equal(state.routing.completed, true);
    assert.equal(
      state.routing.decision?.selected_workflow,
      '@.claude/workflows/ship-readiness-headless.yaml'
    );
    assert.equal(state.routing.decision?.should_escalate, true);
    assert.equal(state.routing.decision?.escalation_target, 'job-runner');
  });

  it('detects ship-readiness intent even when router Task prompt is generic', async () => {
    await mkdir(join(HOOK_TMP_DIR, 'routing-sessions'), { recursive: true });

    const state = await runCompletionHookWithPromptAndPayload({
      prompt: 'Route ship-readiness audit request',
      toolResultText: JSON.stringify({
        selected_workflow: '@.claude/workflows/code-quality-flow.yaml',
        should_escalate: true,
        escalation_target: 'orchestrator',
        confidence: 0.9,
        reasoning: 'ship readiness audit requested; needs end-to-end checks',
      }),
    });

    assert.equal(state.routing.completed, true);
    assert.equal(
      state.routing.decision?.selected_workflow,
      '@.claude/workflows/ship-readiness-headless.yaml'
    );
    assert.equal(state.routing.decision?.should_escalate, true);
    assert.equal(state.routing.decision?.escalation_target, 'job-runner');
  });
});
