#!/usr/bin/env node
/**
 * run-guard-denial-headless.mjs
 *
 * Deterministic headless denial check: executes the repo's `read-path-guard.mjs`
 * hook directly with a directory path so the hook must return `{ decision: "block" }`.
 *
 * Why: `claude -p` best-effort prompts are not reliable for forcing a tool call.
 *
 * Output (stdout): JSON summary (always).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    const hasValue = next != null && !String(next).startsWith('--');
    if (hasValue) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function resolveRoot(projectRoot) {
  const root = projectRoot && typeof projectRoot === 'string' ? projectRoot : process.cwd();
  return isAbsolute(root) ? root : resolve(root);
}

async function runHook({ projectRoot, hookPath, hookInput, timeoutMs }) {
  return await new Promise(resolveRun => {
    const child = spawn(process.execPath, [hookPath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectRoot,
        CLAUDE_DENIAL_LOGGER_DISABLE: 'true',
      },
    });

    let stdout = '';
    let stderr = '';
    const killTimer =
      timeoutMs > 0
        ? setTimeout(() => {
            try {
              child.kill('SIGTERM');
            } catch {
              // ignore
            }
          }, timeoutMs)
        : null;

    child.stdout.on('data', c => (stdout += c));
    child.stderr.on('data', c => (stderr += c));
    child.on('error', err => {
      if (killTimer) clearTimeout(killTimer);
      resolveRun({
        ok: false,
        code: 1,
        stdout,
        stderr: `${stderr}\n${err?.message || err}`.trim(),
      });
    });
    child.on('close', code => {
      if (killTimer) clearTimeout(killTimer);
      resolveRun({ ok: code === 0, code: code ?? 1, stdout, stderr });
    });

    try {
      child.stdin.write(JSON.stringify(hookInput));
      child.stdin.end();
    } catch {
      // ignore
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workflowId = typeof args['workflow-id'] === 'string' ? args['workflow-id'] : null;
  const timeoutMs = Number.isFinite(Number(args['timeout-ms']))
    ? Number(args['timeout-ms'])
    : 30_000;
  const projectRoot = resolveRoot(
    typeof args['project-root'] === 'string' ? args['project-root'] : null
  );

  if (!workflowId)
    die('Missing required --workflow-id (expected: agent-integration-v1-<YYYYMMDD-HHMMSS>)');

  const hookPath = join(projectRoot, '.claude', 'hooks', 'read-path-guard.mjs');
  if (!existsSync(hookPath)) die(`Missing hook file: ${hookPath}`);

  const hookInput = {
    tool_name: 'Read',
    tool_input: { path: '.claude/agents/' },
    session_key: workflowId,
  };

  const startedAt = new Date().toISOString();
  const res = await runHook({ projectRoot, hookPath, hookInput, timeoutMs });
  const finishedAt = new Date().toISOString();

  let decision = null;
  let reason = null;
  try {
    const parsed = JSON.parse(String(res.stdout || '').trim() || '{}');
    decision = typeof parsed.decision === 'string' ? parsed.decision : null;
    reason = typeof parsed.reason === 'string' ? parsed.reason : null;
  } catch {
    // ignore
  }

  const denied = decision === 'block';

  process.stdout.write(
    JSON.stringify(
      {
        ok: denied,
        workflow_id: workflowId,
        started_at: startedAt,
        finished_at: finishedAt,
        exit_code: res.code,
        denied,
        denied_by: 'read-path-guard',
        hook_decision: decision,
        hook_reason: reason ? reason.slice(0, 400) : null,
        hook_stderr_tail: String(res.stderr || '')
          .trim()
          .slice(0, 600),
      },
      null,
      2
    )
  );
}

main().catch(err => die(err?.stack || err?.message || String(err), 1));
