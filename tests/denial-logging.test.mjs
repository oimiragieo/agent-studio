import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';

const PROJECT_ROOT = process.cwd();
const RUN_OBSERVER_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'run-observer.mjs');
const READ_PATH_GUARD_PATH = join(PROJECT_ROOT, '.claude', 'hooks', 'read-path-guard.mjs');

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

async function runHook(scriptPath, args, input, env = {}) {
  return await new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath, ...args], { env: { ...process.env, ...env } });
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

describe('denial logging', () => {
  it('records denied Read events to tool-events stream', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));
    const runsDir = join(runtimeDir, 'runs');
    const sessionsDir = join(runtimeDir, 'sessions');

    const sessionId = `test-session-${Date.now()}`;
    const runId = `test-run-${Date.now()}`;

    mkdirSync(join(runsDir, runId), { recursive: true });
    mkdirSync(sessionsDir, { recursive: true });
    await writeFile(
      join(sessionsDir, `${safeFileId(sessionId)}.json`),
      JSON.stringify({ run_id: runId }, null, 2),
      'utf-8'
    );

    const denyDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-deny-dir-'));

    // Seed a "pre" attempt so the run has an initial event.
    const pre = await runHook(
      RUN_OBSERVER_PATH,
      ['pre'],
      { tool_name: 'Read', tool_input: { file_path: denyDir }, context: { agent_name: 'router' } },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_PROJECT_DIR: PROJECT_ROOT,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(pre.json.decision, 'approve');

    // Now block the read (directory).
    const deny = await runHook(
      READ_PATH_GUARD_PATH,
      [],
      { tool_name: 'Read', tool_input: { file_path: denyDir }, context: { agent_name: 'router' } },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_PROJECT_DIR: PROJECT_ROOT,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(deny.json.decision, 'block');

    const toolEventsPath = join(toolEventsDir, `run-${runId}.ndjson`);
    const lines = (await readFile(toolEventsPath, 'utf-8'))
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    assert.equal(lines.length >= 2, true);
    const events = lines.map(line => JSON.parse(line));
    assert.equal(
      events.some(e => e.denied === true && e.tool === 'Read' && e.agent === 'router'),
      true
    );

    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
    await rm(denyDir, { recursive: true, force: true });
  });

  it('writes orphan denial stream when runId is missing', async () => {
    const runtimeDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-runtime-'));
    const toolEventsDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-tool-events-'));

    const sessionId = `test-session-${Date.now()}`;
    const denyDir = await mkdtemp(join(os.tmpdir(), 'llm-rules-deny-dir-'));

    const deny = await runHook(
      READ_PATH_GUARD_PATH,
      [],
      { tool_name: 'Read', tool_input: { file_path: denyDir }, context: { agent_name: 'router' } },
      {
        CLAUDE_SESSION_ID: sessionId,
        CLAUDE_PROJECT_DIR: PROJECT_ROOT,
        CLAUDE_RUNTIME_DIR: runtimeDir,
        CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: toolEventsDir,
      }
    );
    assert.equal(deny.json.decision, 'block');

    const orphanPath = join(toolEventsDir, 'orphan-denials.ndjson');
    assert.equal(existsSync(orphanPath), true);
    const lines = (await readFile(orphanPath, 'utf-8'))
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    assert.equal(lines.length >= 1, true);
    const event = JSON.parse(lines[lines.length - 1]);
    assert.equal(event.denied, true);
    assert.equal(event.run_id, null);
    assert.equal(event.tool, 'Read');

    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
    await rm(denyDir, { recursive: true, force: true });
  });
});
