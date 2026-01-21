#!/usr/bin/env node
/**
 * Workflow Dry-Run Suite
 *
 * Runs `workflow_runner.js --dry-run` across all workflows in `.claude/workflows`
 * and emits a compact JSON summary (for use by system diagnostics).
 *
 * Usage:
 *   node .claude/tools/workflow-dryrun-suite.mjs
 *   node .claude/tools/workflow-dryrun-suite.mjs --workflows-dir .claude/workflows --json
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const hasFlag = name => args.includes(`--${name}`);
  const getArg = name => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : null;
  };
  return {
    workflowsDir: getArg('workflows-dir') || join(PROJECT_ROOT, '.claude', 'workflows'),
    json: hasFlag('json') || true,
    help: hasFlag('help') || hasFlag('h'),
    failFast: hasFlag('fail-fast'),
    maxOutputBytes: Number(getArg('max-output-bytes') || 256 * 1024),
  };
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function walkWorkflows(dir) {
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'templates') continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.yaml') || lower.endsWith('.yml')) results.push(full);
    }
  }
  return results.sort();
}

function capBytes(text, maxBytes) {
  const buf = Buffer.from(String(text || ''), 'utf8');
  if (buf.length <= maxBytes) return { text: buf.toString('utf8'), truncated: false };
  return { text: buf.subarray(buf.length - maxBytes).toString('utf8'), truncated: true };
}

function parseRunnerSummary(output) {
  const text = String(output || '');
  const passed = /DRY-RUN PASSED/i.test(text) && !/DRY-RUN FAILED/i.test(text);
  const errorsMatch = text.match(/\bErrors:\s*(\d+)\b/i);
  const warningsMatch = text.match(/\bWarnings:\s*(\d+)\b/i);
  const errors = errorsMatch ? Number(errorsMatch[1]) : null;
  const warnings = warningsMatch ? Number(warningsMatch[1]) : null;
  return { passed, errors, warnings };
}

async function runDryRun(workflowPath, { id, maxOutputBytes }) {
  const runnerPath = join(PROJECT_ROOT, '.claude', 'tools', 'workflow_runner.js');
  const args = [runnerPath, '--workflow', workflowPath, '--dry-run', '--id', id];

  const startedAt = Date.now();
  return await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: PROJECT_ROOT, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('close', code => {
      const durationMs = Date.now() - startedAt;
      const out = capBytes(stdout, maxOutputBytes);
      const err = capBytes(stderr, maxOutputBytes);
      const summary = parseRunnerSummary(out.text);
      resolve({
        cmd: `${process.execPath} ${args.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`,
        code: typeof code === 'number' ? code : null,
        duration_ms: durationMs,
        stdout_tail: out.text,
        stderr_tail: err.text,
        stdout_truncated: out.truncated,
        stderr_truncated: err.truncated,
        ...summary,
      });
    });
  });
}

async function cleanupTempRun(id) {
  const tempDir = join(PROJECT_ROOT, '.claude', 'context', 'runtime', 'temp-runs', id);
  if (!existsSync(tempDir)) return;
  await rm(tempDir, { recursive: true, force: true });
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'Workflow Dry-Run Suite',
        '',
        'Usage:',
        '  node .claude/tools/workflow-dryrun-suite.mjs [options]',
        '',
        'Options:',
        '  --workflows-dir <dir>     Directory to scan for workflow yaml files (default: .claude/workflows)',
        '  --fail-fast               Stop on first failure',
        '  --max-output-bytes <n>    Capture at most N bytes per workflow output (default: 262144)',
        '  --json                    Emit JSON summary to stdout (default)',
        '',
      ].join('\n')
    );
    return;
  }

  const stamp = nowStamp();
  const workflows = walkWorkflows(opts.workflowsDir);

  const results = [];
  for (let i = 0; i < workflows.length; i += 1) {
    const workflowPath = workflows[i];
    const rel = relative(PROJECT_ROOT, workflowPath).split('\\').join('/');
    const id = `dryrun-${stamp}-${String(i + 1).padStart(2, '0')}`;

    const res = await runDryRun(workflowPath, { id, maxOutputBytes: opts.maxOutputBytes });
    results.push({
      workflow: rel,
      workflow_id: id,
      ok: res.code === 0 && res.passed === true,
      code: res.code,
      duration_ms: res.duration_ms,
      errors: res.errors,
      warnings: res.warnings,
      stdout_truncated: res.stdout_truncated,
      stderr_truncated: res.stderr_truncated,
      stdout_tail: res.stdout_tail,
      stderr_tail: res.stderr_tail,
    });

    await cleanupTempRun(id).catch(() => {});

    if (opts.failFast && results[results.length - 1].ok === false) break;
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const warningsTotal = results.reduce(
    (sum, r) => sum + (Number.isFinite(r.warnings) ? r.warnings : 0),
    0
  );

  const out = {
    generated_at: new Date().toISOString(),
    repo_root: PROJECT_ROOT,
    workflows_total: workflows.length,
    executed: results.length,
    passed,
    failed,
    warnings_total: warningsTotal,
    results,
  };

  process.stdout.write(JSON.stringify(out));
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ ok: false, error: err?.message ?? String(err) }));
  process.exitCode = 1;
});
