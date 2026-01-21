import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function runJobDaemon(cwd, args, env) {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), '.claude/tools/job-daemon.mjs'), ...args],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    }
  );
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

test('job-daemon retries failed command with backoff', () => {
  const root = mkdtempSync(join(tmpdir(), 'llm-rules-job-daemon-'));
  const runtimeDir = join(root, '.claude', 'context', 'runtime');
  const jobsDir = join(runtimeDir, 'jobs');
  mkdirSync(jobsDir, { recursive: true });

  const counterPath = join(root, 'counter.txt');
  writeFileSync(counterPath, '0', 'utf8');

  const jobId = randomUUID();
  const jobPath = join(jobsDir, `${jobId}.json`);

  const scriptPath = join(root, 'attempt.cjs');
  writeFileSync(
    scriptPath,
    [
      "const { readFileSync, writeFileSync } = require('node:fs');",
      'const p = process.env.COUNTER_PATH;',
      "const n = Number(readFileSync(p, 'utf8')) || 0;",
      'writeFileSync(p, String(n + 1));',
      'process.exit(n === 0 ? 1 : 0);',
    ].join('\n'),
    'utf8'
  );
  const cmd = `node attempt.cjs`;

  writeFileSync(
    jobPath,
    JSON.stringify(
      {
        job_id: jobId,
        name: 'retry-test',
        status: 'queued',
        created_at: new Date().toISOString(),
        cwd: root,
        command: cmd,
        retries: 2,
        retry_delay_ms: 5,
        retry_backoff_mult: 1,
        max_retry_delay_ms: 20,
        pid: null,
        worker_pid: null,
        started_at: null,
        ended_at: null,
        exit_code: null,
        attempts: [],
        current_attempt: 0,
        max_attempts: 3,
        last_heartbeat_at: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

  const r = runJobDaemon(root, ['run', '--job-id', jobId], {
    CLAUDE_RUNTIME_DIR: runtimeDir,
    COUNTER_PATH: counterPath,
  });
  const finalState = JSON.parse(readFileSync(jobPath, 'utf8'));
  const logPath = join(runtimeDir, 'jobs', 'logs', `${jobId}.log`);
  const logTail = existsSync(logPath) ? readFileSync(logPath, 'utf8').slice(-4000) : '';
  const debug = JSON.stringify(
    {
      tool_exit: r.status,
      tool_stderr: r.stderr.slice(-500),
      tool_stdout: r.stdout.slice(-500),
      job_status: finalState.status,
      job_exit_code: finalState.exit_code,
      attempts: finalState.attempts,
      log_tail: logTail,
    },
    null,
    2
  );

  assert.equal(finalState.status, 'completed', debug);
  assert.equal(finalState.exit_code, 0, debug);
  assert.equal(finalState.current_attempt, 2);
  assert.ok(Array.isArray(finalState.attempts));
  assert.equal(finalState.attempts.length, 2);
  assert.equal(finalState.attempts[0].exit_code, 1);
  assert.equal(finalState.attempts[1].exit_code, 0);
  assert.ok(finalState.next_retry_at, 'expected next_retry_at to be set during retry scheduling');
});
