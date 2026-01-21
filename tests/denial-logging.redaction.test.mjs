import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';

import { recordToolDenial } from '../.claude/hooks/denial-logger.mjs';

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

describe('denial logging redaction', () => {
  it('redacts github_pat and GITHUB_PERSONAL_ACCESS_TOKEN in denial_reason', async () => {
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

    const prior = {
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
      CLAUDE_RUNTIME_DIR: process.env.CLAUDE_RUNTIME_DIR,
      CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR: process.env.CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR,
      CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    };
    process.env.CLAUDE_PROJECT_DIR = process.cwd();
    process.env.CLAUDE_RUNTIME_DIR = runtimeDir;
    process.env.CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR = toolEventsDir;
    process.env.CLAUDE_SESSION_ID = sessionId;

    const rawToken = 'github_pat_ABCDEF1234567890';
    const reason = `Denied with ${rawToken} and GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_SHOULD_NOT_APPEAR"`;

    await recordToolDenial({
      hookName: 'test',
      hookInput: {
        tool_name: 'Bash',
        tool_input: { command: 'echo hi' },
        context: { agent_name: 'tester' },
      },
      toolName: 'Bash',
      toolInput: { command: 'echo hi' },
      reason,
    });

    const toolEventsPath = join(toolEventsDir, `run-${runId}.ndjson`);
    const lines = (await readFile(toolEventsPath, 'utf-8'))
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    assert.equal(lines.length >= 1, true);

    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(typeof last.denial_reason, 'string');
    assert.equal(last.denial_reason.includes(rawToken), false);
    assert.equal(last.denial_reason.includes('github_pat_***REDACTED***'), true);
    assert.equal(
      last.denial_reason.includes('GITHUB_PERSONAL_ACCESS_TOKEN="***REDACTED***"'),
      true
    );

    process.env.CLAUDE_PROJECT_DIR = prior.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_RUNTIME_DIR = prior.CLAUDE_RUNTIME_DIR;
    process.env.CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR = prior.CLAUDE_TOOL_EVENTS_ARTIFACTS_DIR;
    process.env.CLAUDE_SESSION_ID = prior.CLAUDE_SESSION_ID;

    await rm(runtimeDir, { recursive: true, force: true });
    await rm(toolEventsDir, { recursive: true, force: true });
  });
});
