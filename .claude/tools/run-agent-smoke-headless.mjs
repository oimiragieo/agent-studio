#!/usr/bin/env node
/**
 * run-agent-smoke-headless.mjs
 *
 * Runs a per-agent smoke test using separate `claude -p` invocations (headless / print mode),
 * writing one receipt JSON per agent and a `_summary.json` file.
 *
 * Why: Avoids Claude Code host-process transcript growth and reduces OOM risk by isolating
 * each agent run into its own short-lived process.
 *
 * Output:
 * - `.claude/context/artifacts/testing/<workflow_id>-agent-smoke/<agent>.json`
 * - `.claude/context/artifacts/testing/<workflow_id>-agent-smoke/_summary.json`
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
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

async function listAgentNames(agentDir) {
  const entries = await readdir(agentDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name.replace(/\.md$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

async function safeJsonParse(path) {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractStructuredOutput(obj) {
  if (!obj || typeof obj !== 'object') return null;
  // claude --output-format json typically contains a structured field; be liberal.
  if (obj.structured_output && typeof obj.structured_output === 'object')
    return obj.structured_output;
  if (obj.result && typeof obj.result === 'object') return obj.result;
  if (obj.output && typeof obj.output === 'object') return obj.output;
  if (obj.message && typeof obj.message === 'object') return obj.message;
  return null;
}

function buildReceiptSchema(agent) {
  // Keep the schema minimal so it works across models/tooling.
  return {
    type: 'object',
    additionalProperties: true,
    required: ['agent', 'task_summary', 'tool_used', 'ok', 'notes'],
    properties: {
      agent: { type: 'string', enum: [agent] },
      task_summary: { type: 'string' },
      tool_used: { type: 'string' },
      ok: { type: 'boolean' },
      notes: { type: 'string' },
    },
  };
}

function buildAgentPrompt({ agent, microTaskPath }) {
  // Important: print-mode runs should return ONLY the receipt JSON (enforced via --json-schema).
  return [
    'Run a minimal, safe smoke check for your agent role.',
    '',
    'Constraints:',
    '- Perform exactly ONE small action (prefer Read or Glob).',
    '- Do not write or edit files.',
    '- Do not include any prose, markdown, or analysis in the final output.',
    '',
    `Action: Read the file: ${microTaskPath}`,
    '',
    'Then return a single JSON object with:',
    '{"agent": "...", "task_summary": "...", "tool_used": "...", "ok": true, "notes": "..."}',
  ].join('\n');
}

async function resolveClaudeBinary(claudeBin) {
  if (process.platform !== 'win32') return claudeBin;

  // If a path is provided, trust it.
  if (/[\\/]/.test(claudeBin)) return resolve(claudeBin);

  // If an extension is provided, trust it.
  if (/\.[a-z0-9]+$/i.test(claudeBin)) return claudeBin;

  // Otherwise, prefer `where` to resolve a concrete path. This helps in tests
  // (fake claude.cmd) and is robust when multiple claude binaries exist.
  const resolved = await new Promise(resolveWhere => {
    const p = spawn('where', [claudeBin], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', c => (out += c));
    p.on('error', () => resolveWhere(null));
    p.on('close', code => {
      if (code !== 0) return resolveWhere(null);
      const candidates = String(out)
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
      if (!candidates.length) return resolveWhere(null);

      // Prefer executable file types on Windows. Node's spawn cannot execute
      // npm shim files without an extension (e.g. ...\\npm\\claude) directly.
      const preferred =
        candidates.find(p => /\.(exe|cmd|bat)$/i.test(p)) ||
        candidates.find(p => existsSync(`${p}.cmd`)) ||
        candidates.find(p => existsSync(`${p}.exe`)) ||
        candidates[0];

      if (!preferred) return resolveWhere(null);
      if (/\.[a-z0-9]+$/i.test(preferred)) return resolveWhere(preferred);
      if (existsSync(`${preferred}.cmd`)) return resolveWhere(`${preferred}.cmd`);
      if (existsSync(`${preferred}.exe`)) return resolveWhere(`${preferred}.exe`);
      resolveWhere(preferred);
    });
  });

  return resolved || claudeBin;
}

function isWindowsCmdFile(path) {
  return process.platform === 'win32' && typeof path === 'string' && /\.(cmd|bat)$/i.test(path);
}

function resolveClaudeInvocation(claudeBin) {
  // On Windows, the npm-installed `claude.cmd` shim cannot safely receive JSON
  // schema arguments due to cmd.exe quoting rules. Prefer invoking the underlying
  // Node entrypoint directly so we can pass args without mangling quotes.
  if (process.platform === 'win32' && typeof claudeBin === 'string' && /\.cmd$/i.test(claudeBin)) {
    const shimDir = dirname(claudeBin);
    const cliJs = join(shimDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (existsSync(cliJs)) {
      return { cmd: process.execPath, argsPrefix: [cliJs] };
    }
  }
  return { cmd: claudeBin, argsPrefix: [] };
}

async function killProcessTree(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return;
  if (process.platform === 'win32') {
    // Best-effort: kill the entire process tree. This avoids hung `claude -p` calls
    // stalling the whole smoke run when per-agent timeouts trigger.
    await new Promise(resolveKill => {
      const p = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      });
      p.on('error', () => resolveKill());
      p.on('close', () => resolveKill());
    });
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // ignore
  }
  // Escalate quickly if the process ignores SIGTERM.
  await new Promise(r => setTimeout(r, 1500));
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
}

async function runClaudePrint({
  claudeBin,
  agent,
  prompt,
  jsonSchema,
  timeoutMs,
  model,
  strictSchema,
}) {
  return await new Promise(resolveRun => {
    const { cmd, argsPrefix } = resolveClaudeInvocation(claudeBin);
    const args = [
      ...argsPrefix,
      '--model',
      model,
      '--agent',
      agent,
      '--append-system-prompt',
      'SMOKE MODE OVERRIDE: Do not route, delegate, or spawn subagents. Perform exactly one small action (prefer Read/Glob). Output a JSON object (prefer the receipt shape), but do not get stuck on formatting.',
      '-p',
      prompt,
      '--output-format',
      'json',
      '--no-session-persistence',
      '--permission-mode',
      'bypassPermissions',
      '--tools',
      'Read,Glob',
    ];

    if (strictSchema) {
      args.push('--json-schema', JSON.stringify(jsonSchema));
    }

    const child = isWindowsCmdFile(cmd)
      ? spawn('cmd.exe', ['/d', '/s', '/c', claudeBin, ...args], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsVerbatimArguments: true,
        })
      : spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const killTimer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            // Kill in the background; we still wait for process close.
            killProcessTree(child.pid).catch(() => null);
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
      resolveRun({
        ok: code === 0 && !timedOut,
        code: code ?? 1,
        stdout,
        stderr: timedOut ? `${stderr}\nTIMEOUT after ${timeoutMs}ms`.trim() : stderr,
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const workflowId = typeof args['workflow-id'] === 'string' ? args['workflow-id'] : null;
  const set = String(args['expected-agents'] || 'all')
    .trim()
    .toLowerCase();
  const claudeBinArg = typeof args['claude-bin'] === 'string' ? args['claude-bin'] : 'claude';
  const modelArg = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : null;
  const timeoutMs = Number.isFinite(Number(args['timeout-ms']))
    ? Number(args['timeout-ms'])
    : 180000;
  const strictSchema = Boolean(args.strict || args['strict-schema'] || false);

  if (!workflowId) {
    die('Missing required --workflow-id (expected: agent-integration-v1-<YYYYMMDD-HHMMSS>)');
  }

  const model = modelArg || String(process.env.CLAUDE_HEADLESS_MODEL || '').trim() || 'sonnet';

  const projectRoot = process.cwd();
  const agentDir = join(projectRoot, '.claude', 'agents');
  if (!existsSync(agentDir)) die(`Missing agent directory: ${agentDir}`);

  const allAgents = await listAgentNames(agentDir);
  if (!allAgents.length) die('No agents found under .claude/agents/*.md');

  const claudeBin = await resolveClaudeBinary(claudeBinArg);

  // Keep this simple: the verifier supports expected agent mode via env var; this runner can filter too.
  const selectedAgents =
    set === 'core'
      ? allAgents.filter(a =>
          new Set([
            'router',
            'orchestrator',
            'developer',
            'qa',
            'analyst',
            'security-architect',
            'performance-engineer',
            'technical-writer',
          ]).has(a)
        )
      : allAgents;

  const outDir = join(
    projectRoot,
    '.claude',
    'context',
    'artifacts',
    'testing',
    `${workflowId}-agent-smoke`
  );
  await mkdir(outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const results = [];

  for (const agent of selectedAgents) {
    process.stderr.write(`[smoke] agent=${agent} start\n`);
    const agentFile = join(agentDir, `${agent}.md`);
    const microTaskPath = existsSync(agentFile)
      ? `.claude/agents/${agent}.md`
      : '.claude/settings.json';
    const prompt = buildAgentPrompt({ agent, microTaskPath });
    const schema = buildReceiptSchema(agent);

    let run = await runClaudePrint({
      claudeBin,
      agent,
      prompt,
      jsonSchema: schema,
      timeoutMs,
      model,
      strictSchema,
    });
    if (!run.ok) {
      // One retry for transient CLI issues (especially around session startup).
      await new Promise(r => setTimeout(r, 250));
      const retry = await runClaudePrint({
        claudeBin,
        agent,
        prompt,
        jsonSchema: schema,
        timeoutMs,
        model,
        strictSchema,
      });
      if (retry.ok) run = retry;
      else if (String(retry.stderr || '').trim()) run = retry;
    }

    let receipt = null;
    let parseError = null;
    if (run.ok) {
      try {
        const top = JSON.parse(String(run.stdout || '').trim() || '{}');
        if (top && typeof top === 'object') {
          receipt = extractStructuredOutput(top) ?? top;
        } else {
          receipt = null;
        }
      } catch (e) {
        parseError = e?.message || String(e);
      }
    }

    const outPath = join(outDir, `${agent}.json`);

    if (!run.ok) {
      const failureReceipt = {
        agent,
        task_summary: 'headless smoke run failed',
        tool_used: 'unknown',
        ok: false,
        notes: [
          `exit_code=${run.code}`,
          parseError ? `parse_error=${parseError}` : null,
          run.stdout ? `stdout_tail=${String(run.stdout).trim().slice(0, 400)}` : null,
          run.stderr ? `stderr_tail=${String(run.stderr).trim().slice(0, 400)}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      };
      await writeFile(outPath, JSON.stringify(failureReceipt, null, 2), 'utf8');
      results.push({ agent, ok: false, receipt_path: outPath });
      process.stderr.write(`[smoke] agent=${agent} end ok=false\n`);
      continue;
    }

    // Prefer the model-provided receipt shape, but fall back to a derived receipt if the agent output
    // doesn't match the expected smoke JSON.
    const normalized = (() => {
      if (receipt && typeof receipt === 'object') {
        const hasReceiptKeys =
          typeof receipt.agent === 'string' &&
          typeof receipt.task_summary === 'string' &&
          typeof receipt.tool_used === 'string' &&
          typeof receipt.ok === 'boolean' &&
          typeof receipt.notes === 'string';
        if (hasReceiptKeys) return receipt;
      }

      const stdoutTail = String(run.stdout || '')
        .trim()
        .slice(0, 400);
      const stderrTail = String(run.stderr || '')
        .trim()
        .slice(0, 400);
      const notes = [
        parseError ? `parse_error=${parseError}` : null,
        stdoutTail ? `stdout_tail=${stdoutTail}` : null,
        stderrTail ? `stderr_tail=${stderrTail}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      return {
        agent,
        task_summary: 'headless smoke run succeeded (non-standard output)',
        tool_used: 'unknown',
        ok: true,
        notes,
      };
    })();

    await writeFile(outPath, JSON.stringify(normalized, null, 2), 'utf8');
    results.push({ agent, ok: normalized.ok, receipt_path: outPath });
    process.stderr.write(`[smoke] agent=${agent} end ok=${normalized.ok}\n`);
  }

  const summary = {
    workflow_id: workflowId,
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    receipts_directory: outDir,
    results,
  };

  await writeFile(join(outDir, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  process.stdout.write(
    JSON.stringify({
      ok: summary.failed === 0,
      workflow_id: workflowId,
      receipts_directory: outDir,
      summary_file: join(outDir, '_summary.json'),
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
    })
  );
}

main().catch(err => die(err?.stack || err?.message || String(err), 1));
