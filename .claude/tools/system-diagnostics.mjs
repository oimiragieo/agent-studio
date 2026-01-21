#!/usr/bin/env node
/**
 * System Diagnostics Runner (Claude framework)
 *
 * Goal:
 * - Run a repeatable diagnostics suite for this repo (hooks/agents/workflows/tools/tests)
 * - Parse an optional Claude debug log for errors/warnings
 * - Write a human-readable report + a structured JSON artifact
 * - Append/refresh the diagnostics fix plan with findings (default: .claude/context/artifacts/diagnostics/diagnostics-master-fix-plan.md)
 *
 * Design constraints:
 * - Bound memory: truncate captured subprocess output
 * - No network required
 * - Windows-friendly (pnpm.cmd)
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const REPORTS_DIR = join(PROJECT_ROOT, '.claude', 'context', 'reports');
const ARTIFACTS_DIR = join(PROJECT_ROOT, '.claude', 'context', 'artifacts');
const DIAGNOSTICS_ARTIFACTS_DIR = join(ARTIFACTS_DIR, 'diagnostics');
const DEFAULT_FIX_PLAN_PATH = join(DIAGNOSTICS_ARTIFACTS_DIR, 'diagnostics-master-fix-plan.md');
const LEGACY_ROOT_FIX_PLAN_PATH = join(PROJECT_ROOT, 'DIAGNOSTICS_MASTER_FIX_PLAN.md');

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function parseArgs(argv) {
  const out = {
    log: '',
    skipTests: false,
    skipValidate: false,
    skipWorkflows: false,
    skipDeepValidate: false,
    dryRun: false,
    help: false,
    fixPlanPath: '',
    legacyRootFixPlan: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--log') {
      out.log = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg.startsWith('--log=')) {
      out.log = arg.slice('--log='.length);
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--skip-tests') {
      out.skipTests = true;
      continue;
    }
    if (arg === '--skip-validate') {
      out.skipValidate = true;
      continue;
    }
    if (arg === '--skip-workflows') {
      out.skipWorkflows = true;
      continue;
    }
    if (arg === '--skip-deep-validate') {
      out.skipDeepValidate = true;
      continue;
    }
    if (arg === '--fix-plan-path') {
      out.fixPlanPath = String(argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (arg.startsWith('--fix-plan-path=')) {
      out.fixPlanPath = arg.slice('--fix-plan-path='.length);
      continue;
    }
    if (arg === '--legacy-root-fix-plan') {
      out.legacyRootFixPlan = true;
      continue;
    }
  }
  return out;
}

function readTailBytes(filePath, maxBytes) {
  try {
    const buf = readFileSync(filePath);
    if (buf.length <= maxBytes) return buf.toString('utf8');
    return buf.subarray(buf.length - maxBytes).toString('utf8');
  } catch {
    return '';
  }
}

async function runCommand(
  cmd,
  args,
  { cwd, timeoutMs = 10 * 60 * 1000, maxBytes = 2 * 1024 * 1024 } = {}
) {
  const startedAt = Date.now();
  return await new Promise(resolve => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        windowsHide: true,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        cmd: [cmd, ...args].join(' '),
        code: null,
        duration_ms: Date.now() - startedAt,
        stdout: '',
        stderr: error?.message ?? String(error),
        stdout_truncated: false,
        stderr_truncated: false,
        spawn_error: true,
      });
      return;
    }

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutChunks = [];
    let stderrChunks = [];
    let stdoutTruncated = false;
    let stderrTruncated = false;

    const cap = (chunk, chunks, state) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      const remaining = maxBytes - state.bytes;
      if (remaining <= 0) {
        state.truncated = true;
        return;
      }
      if (buf.length > remaining) {
        chunks.push(buf.subarray(0, remaining));
        state.bytes += remaining;
        state.truncated = true;
        return;
      }
      chunks.push(buf);
      state.bytes += buf.length;
    };

    const outState = { bytes: stdoutBytes, truncated: stdoutTruncated };
    const errState = { bytes: stderrBytes, truncated: stderrTruncated };

    child.stdout.on('data', chunk => {
      cap(chunk, stdoutChunks, outState);
      stdoutBytes = outState.bytes;
      stdoutTruncated = outState.truncated;
    });
    child.stderr.on('data', chunk => {
      cap(chunk, stderrChunks, errState);
      stderrBytes = errState.bytes;
      stderrTruncated = errState.truncated;
    });

    const killTimer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.on('error', error => {
      clearTimeout(killTimer);
      resolve({
        cmd: [cmd, ...args].join(' '),
        code: null,
        duration_ms: Date.now() - startedAt,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr:
          `${Buffer.concat(stderrChunks).toString('utf8')}\n${error?.message ?? String(error)}`.trim(),
        stdout_truncated: stdoutTruncated,
        stderr_truncated: true,
        spawn_error: true,
      });
    });

    child.on('close', code => {
      clearTimeout(killTimer);
      resolve({
        cmd: [cmd, ...args].join(' '),
        code: typeof code === 'number' ? code : null,
        duration_ms: Date.now() - startedAt,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        stdout_truncated: stdoutTruncated,
        stderr_truncated: stderrTruncated,
      });
    });
  });
}

function summarizeLog(logText) {
  if (!logText) return { present: false, stats: {}, samples: {} };

  const lines = logText.split(/\r?\n/);

  const known = {
    // Claude Code logs MCP server startup to stderr; this is usually benign noise.
    mcp_sequential_thinking_noise:
      /MCP server \"sequential-thinking\".*Sequential Thinking MCP Server running on stdio/i,
    // Claude Code may attempt to fetch "passes eligibility" and log a 401 if auth is unavailable.
    // This is external to the repo and typically non-blocking for local diagnostics.
    external_auth_warning:
      /Failed to fetch and cache passes eligibility|AxiosError: Request failed with status code 401/i,
    // Tool Search can be disabled when the model lacks tool_reference support or MCPSearchTool is disallowed.
    tool_search_disabled:
      /Tool search disabled: MCPSearchTool is not available|Auto tool search disabled:|tool_reference blocks/i,
  };

  const patterns = {
    errors_actionable: /\[ERROR\]|\bFATAL ERROR\b|hook error/i,
    router_block: /ROUTER-FIRST ENFORCEMENT/i,
    routing_handoff_required: /ROUTING HANDOFF REQUIRED/i,
    tool_denied_task: /Hook denied tool use for Task\b/i,
    eisdDir: /\bEISDIR\b/i,
    enoent: /\bENOENT\b/i,
    oom: /\bheap out of memory\b/i,
    mcp_noise: known.mcp_sequential_thinking_noise,
    external_auth: known.external_auth_warning,
    tool_search_disabled: known.tool_search_disabled,
  };

  const buckets = Object.fromEntries(Object.keys(patterns).map(k => [k, []]));
  for (const line of lines) {
    if (known.mcp_sequential_thinking_noise.test(line)) {
      buckets.mcp_noise.push(line);
      continue;
    }
    if (known.external_auth_warning.test(line)) {
      buckets.external_auth.push(line);
      continue;
    }
    if (known.tool_search_disabled.test(line)) {
      buckets.tool_search_disabled.push(line);
      continue;
    }

    for (const [k, re] of Object.entries(patterns)) {
      if (k === 'mcp_noise' || k === 'external_auth' || k === 'tool_search_disabled') continue;
      if (re.test(line)) buckets[k].push(line);
    }
  }

  const stats = {};
  const samples = {};
  for (const [k, arr] of Object.entries(buckets)) {
    stats[k] = arr.length;
    samples[k] = arr.slice(-10);
  }

  return { present: true, stats, samples };
}

function walkFiles(rootDir, { exts = null, maxFiles = 20000 } = {}) {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip huge/irrelevant dirs
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (exts && !exts.some(ext => entry.name.toLowerCase().endsWith(ext))) continue;
      results.push(full);
      if (results.length >= maxFiles) return results;
    }
  }
  return results;
}

function inventoryRepo() {
  const rel = p => relative(PROJECT_ROOT, p).split('\\').join('/');
  const workflows = walkFiles(join(PROJECT_ROOT, '.claude', 'workflows'), {
    exts: ['.yaml', '.yml'],
  }).map(rel);
  const agents = walkFiles(join(PROJECT_ROOT, '.claude', 'agents'), { exts: ['.md'] }).map(rel);
  const hooks = walkFiles(join(PROJECT_ROOT, '.claude', 'hooks'), { exts: ['.mjs', '.js'] }).map(
    rel
  );
  const tools = walkFiles(join(PROJECT_ROOT, '.claude', 'tools'), { exts: ['.mjs', '.js'] }).map(
    rel
  );
  const tests = walkFiles(join(PROJECT_ROOT, 'tests'), { exts: ['.test.mjs'] }).map(rel);
  return {
    counts: {
      workflows: workflows.length,
      agents: agents.length,
      hooks: hooks.length,
      tools: tools.length,
      tests: tests.length,
    },
    lists: {
      workflows: workflows.sort(),
      agents: agents.sort(),
    },
  };
}

function mdSection(title, bodyLines) {
  return [`## ${title}`, '', ...bodyLines, ''].join('\n');
}

function isExecutableAvailable(cmd) {
  try {
    const res = spawnSync(cmd, ['--version'], { windowsHide: true, stdio: 'ignore' });
    return res.status === 0 || res.status === 1;
  } catch {
    return false;
  }
}

function runVersionCheckWindows(binName) {
  try {
    const res = spawnSync('cmd.exe', ['/d', '/s', '/c', `${binName} --version`], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return res.status === 0 || res.status === 1;
  } catch {
    return false;
  }
}

function detectPackageRunner() {
  // On Windows, spawning `npm.cmd`/`pnpm.cmd` directly can raise EINVAL in some
  // environments. Use `cmd.exe /c` so PATHEXT resolution works reliably.
  if (process.platform === 'win32') {
    if (runVersionCheckWindows('pnpm')) return { tool: 'pnpm', cmd: 'pnpm' };
    if (runVersionCheckWindows('npm')) return { tool: 'npm', cmd: 'npm' };
    return { tool: 'none', cmd: '' };
  }

  if (isExecutableAvailable('pnpm')) return { tool: 'pnpm', cmd: 'pnpm' };
  if (isExecutableAvailable('npm')) return { tool: 'npm', cmd: 'npm' };
  return { tool: 'none', cmd: '' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(
      [
        'System Diagnostics Runner',
        '',
        'Usage:',
        '  node .claude/tools/system-diagnostics.mjs [--log <path>] [--skip-tests] [--skip-validate] [--skip-workflows] [--skip-deep-validate] [--dry-run] [--fix-plan-path <path>] [--legacy-root-fix-plan]',
        '',
        'Options:',
        '  --log <path>        Optional Claude debug log to analyze (tail only)',
        '  --skip-tests        Skip running package test script',
        '  --skip-validate      Skip running package validate script',
        '  --skip-workflows    Skip workflow_runner dry-run suite',
        '  --skip-deep-validate Skip extra validations (workflows + references)',
        '  --dry-run           Do not run commands; only inventory + log summary + write reports',
        `  --fix-plan-path <path> Override fix plan output path (default: ${relative(PROJECT_ROOT, DEFAULT_FIX_PLAN_PATH)})`,
        '  --legacy-root-fix-plan Write fix plan to repo root (legacy behavior)',
        '',
      ].join('\n')
    );
    return;
  }
  const stamp = nowStamp();

  ensureDir(REPORTS_DIR);
  ensureDir(ARTIFACTS_DIR);
  ensureDir(DIAGNOSTICS_ARTIFACTS_DIR);

  const fixPlanPath = (() => {
    if (opts.legacyRootFixPlan) return LEGACY_ROOT_FIX_PLAN_PATH;
    const raw = String(opts.fixPlanPath || '').trim();
    if (!raw) return DEFAULT_FIX_PLAN_PATH;
    // If relative, treat as relative to repo root.
    return raw.includes(':\\') || raw.startsWith('\\\\') ? raw : join(PROJECT_ROOT, raw);
  })();

  const inventory = inventoryRepo();

  const runner = detectPackageRunner();
  const commands = [];

  if (!opts.dryRun && !opts.skipWorkflows) {
    commands.push({
      name: 'workflow dry-run suite',
      cmd: process.execPath,
      args: [join(PROJECT_ROOT, '.claude', 'tools', 'workflow-dryrun-suite.mjs')],
    });
  }

  if (!opts.dryRun && runner.tool !== 'none') {
    if (!opts.skipTests) {
      commands.push({
        name: `${runner.tool} test`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? ['/d', '/s', '/c', runner.tool === 'npm' ? 'npm run test' : 'pnpm test']
            : runner.tool === 'npm'
              ? ['run', 'test']
              : ['test'],
      });
    }
    if (!opts.skipValidate) {
      commands.push({
        name: `${runner.tool} validate`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? ['/d', '/s', '/c', runner.tool === 'npm' ? 'npm run validate' : 'pnpm validate']
            : runner.tool === 'npm'
              ? ['run', 'validate']
              : ['validate'],
      });
    }

    if (!opts.skipValidate && !opts.skipDeepValidate) {
      commands.push({
        name: `${runner.tool} validate:workflow`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? [
                '/d',
                '/s',
                '/c',
                runner.tool === 'npm' ? 'npm run validate:workflow' : 'pnpm validate:workflow',
              ]
            : runner.tool === 'npm'
              ? ['run', 'validate:workflow']
              : ['validate:workflow'],
      });

      commands.push({
        name: `${runner.tool} validate:references`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? [
                '/d',
                '/s',
                '/c',
                runner.tool === 'npm' ? 'npm run validate:references' : 'pnpm validate:references',
              ]
            : runner.tool === 'npm'
              ? ['run', 'validate:references']
              : ['validate:references'],
      });

      commands.push({
        name: `${runner.tool} validate:docs-links`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? [
                '/d',
                '/s',
                '/c',
                runner.tool === 'npm' ? 'npm run validate:docs-links' : 'pnpm validate:docs-links',
              ]
            : runner.tool === 'npm'
              ? ['run', 'validate:docs-links']
              : ['validate:docs-links'],
      });

      commands.push({
        name: `${runner.tool} validate:agents`,
        cmd: process.platform === 'win32' ? 'cmd.exe' : runner.cmd,
        args:
          process.platform === 'win32'
            ? [
                '/d',
                '/s',
                '/c',
                runner.tool === 'npm' ? 'npm run validate:agents' : 'pnpm validate:agents',
              ]
            : runner.tool === 'npm'
              ? ['run', 'validate:agents']
              : ['validate:agents'],
      });
    }
  }

  const results = [];
  for (const c of commands) {
    results.push({
      name: c.name,
      ...(await runCommand(c.cmd, c.args, { cwd: PROJECT_ROOT })),
    });
  }

  let workflowSuiteSummary = null;
  const workflowRun = results.find(r => r.name === 'workflow dry-run suite');
  if (workflowRun && typeof workflowRun.stdout === 'string') {
    const trimmed = workflowRun.stdout.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        workflowSuiteSummary = {
          workflows_total: parsed.workflows_total ?? null,
          executed: parsed.executed ?? null,
          passed: parsed.passed ?? null,
          failed: parsed.failed ?? null,
          warnings_total: parsed.warnings_total ?? null,
        };
      } catch {
        // ignore
      }
    }
  }

  const logPath = typeof opts.log === 'string' && opts.log.trim() ? opts.log.trim() : '';
  const logExists = logPath && existsSync(logPath);
  const logTail = logExists ? readTailBytes(logPath, 1024 * 1024) : '';
  const logSummary = summarizeLog(logTail);

  const logOk =
    !logSummary.present ||
    ((logSummary.stats.errors_actionable ?? 0) === 0 &&
      (logSummary.stats.router_block ?? 0) === 0 &&
      (logSummary.stats.routing_handoff_required ?? 0) === 0 &&
      (logSummary.stats.tool_denied_task ?? 0) === 0 &&
      (logSummary.stats.eisdDir ?? 0) === 0 &&
      (logSummary.stats.enoent ?? 0) === 0 &&
      (logSummary.stats.oom ?? 0) === 0);

  const overallOk =
    results.every(r => r.code === 0) &&
    (opts.dryRun || runner.tool !== 'none' || opts.skipTests || opts.skipValidate) &&
    logOk;
  const artifact = {
    generated_at: new Date().toISOString(),
    repo_root: PROJECT_ROOT,
    inputs: { log_path: logPath || null, log_exists: Boolean(logExists) },
    inventory: inventory.counts,
    runner: { tool: runner.tool, cmd: runner.cmd || null, dry_run: Boolean(opts.dryRun) },
    workflow_dryrun: workflowSuiteSummary,
    commands: results.map(r => ({
      name: r.name,
      cmd: r.cmd,
      code: r.code,
      duration_ms: r.duration_ms,
      stdout_truncated: r.stdout_truncated,
      stderr_truncated: r.stderr_truncated,
    })),
    log_summary: logSummary,
    log_ok: logOk,
    overall_ok: overallOk,
  };

  const reportPath = join(REPORTS_DIR, `system-diagnostics-${stamp}.md`);
  const artifactPath = join(ARTIFACTS_DIR, `system-diagnostics-${stamp}.json`);

  const reportLines = [];
  reportLines.push(`# System Diagnostics Report (${stamp})`, '');
  reportLines.push(`- Overall: ${overallOk ? 'PASS' : 'CONCERNS'}`);
  reportLines.push(`- Repo: \`${PROJECT_ROOT}\``);
  reportLines.push(
    `- Debug log: ${logExists ? `\`${logPath}\`` : logPath ? `Missing: \`${logPath}\`` : 'none provided'}`
  );
  reportLines.push('');

  reportLines.push(
    mdSection('Inventory', [
      `- Workflows: ${inventory.counts.workflows}`,
      `- Agents: ${inventory.counts.agents}`,
      `- Hooks: ${inventory.counts.hooks}`,
      `- Tools: ${inventory.counts.tools}`,
      `- Tests: ${inventory.counts.tests}`,
    ])
  );

  reportLines.push(
    mdSection(
      'Command Results',
      results.length
        ? results.map(r => {
            const status = r.code === 0 ? 'PASS' : `FAIL (exit ${r.code ?? 'null'})`;
            const trunc = [
              r.stdout_truncated ? 'stdout truncated' : null,
              r.stderr_truncated ? 'stderr truncated' : null,
            ]
              .filter(Boolean)
              .join(', ');
            return `- ${r.name}: ${status} (${r.duration_ms}ms)${trunc ? ` - ${trunc}` : ''}`;
          })
        : [
            opts.dryRun
              ? '- Skipped (dry-run)'
              : '- Skipped (no package runner found or all command steps skipped)',
            `- Detected runner: ${runner.tool}${runner.cmd ? ` (${runner.cmd})` : ''}`,
          ]
    )
  );

  if (workflowSuiteSummary) {
    reportLines.push(
      mdSection('Workflow Dry-Run Summary', [
        `- workflows_total: ${workflowSuiteSummary.workflows_total ?? 'unknown'}`,
        `- executed: ${workflowSuiteSummary.executed ?? 'unknown'}`,
        `- passed: ${workflowSuiteSummary.passed ?? 'unknown'}`,
        `- failed: ${workflowSuiteSummary.failed ?? 'unknown'}`,
        `- warnings_total: ${workflowSuiteSummary.warnings_total ?? 'unknown'}`,
      ])
    );
  }

  if (logSummary.present) {
    reportLines.push(
      mdSection('Debug Log Summary (tail)', [
        `- errors_actionable: ${logSummary.stats.errors_actionable ?? 0}`,
        `- router_block: ${logSummary.stats.router_block ?? 0}`,
        `- routing_handoff_required: ${logSummary.stats.routing_handoff_required ?? 0}`,
        `- tool_denied_task: ${logSummary.stats.tool_denied_task ?? 0}`,
        `- EISDIR: ${logSummary.stats.eisdDir ?? 0}`,
        `- ENOENT: ${logSummary.stats.enoent ?? 0}`,
        `- OOM: ${logSummary.stats.oom ?? 0}`,
        `- external_auth (non-blocking): ${logSummary.stats.external_auth ?? 0}`,
        `- tool_search_disabled (non-blocking): ${logSummary.stats.tool_search_disabled ?? 0}`,
        `- mcp_noise (non-blocking): ${logSummary.stats.mcp_noise ?? 0}`,
        '',
        'Recent actionable error-like lines:',
        '```',
        ...(logSummary.samples.errors_actionable ?? []),
        '```',
        ...(logSummary.stats.external_auth
          ? [
              '',
              'External auth warnings (non-blocking):',
              '```',
              ...(logSummary.samples.external_auth ?? []),
              '```',
            ]
          : []),
        ...(logSummary.stats.tool_search_disabled
          ? [
              '',
              'Tool search disabled (non-blocking):',
              '```',
              ...(logSummary.samples.tool_search_disabled ?? []),
              '```',
            ]
          : []),
        ...(logSummary.stats.mcp_noise
          ? ['', 'MCP noise (non-blocking):', '```', ...(logSummary.samples.mcp_noise ?? []), '```']
          : []),
      ])
    );
  }

  if (logSummary.present && !logOk) {
    reportLines.push(
      mdSection('Flow Concerns', [
        'The debug log indicates the session did not follow the expected router-first flow cleanly.',
        'In a healthy run, these should all be zero: `router_block`, `routing_handoff_required`, `tool_denied_task`.',
      ])
    );
  }

  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  writeFileSync(reportPath, reportLines.join('\n'), 'utf8');

  // Append minimal run summary to the master fix plan (do not overwrite existing guidance).
  const planSnippet = [
    '',
    `## Run ${stamp}`,
    '',
    `- Overall: ${overallOk ? 'PASS' : 'CONCERNS'}`,
    `- Report: \`${reportPath}\``,
    `- Artifact: \`${artifactPath}\``,
    logExists ? `- Debug log analyzed: \`${logPath}\`` : `- Debug log analyzed: none/missing`,
    `- Command results: ${results.map(r => `${r.name}=${r.code === 0 ? 'PASS' : 'FAIL'}`).join(', ')}`,
    logSummary.present
      ? `- Log flags: errors_actionable=${logSummary.stats.errors_actionable ?? 0}, router_block=${
          logSummary.stats.router_block ?? 0
        }, handoff_required=${logSummary.stats.routing_handoff_required ?? 0}, denied_task=${
          logSummary.stats.tool_denied_task ?? 0
        }, EISDIR=${logSummary.stats.eisdDir ?? 0}, ENOENT=${logSummary.stats.enoent ?? 0}, OOM=${
          logSummary.stats.oom ?? 0
        }, tool_search_disabled=${logSummary.stats.tool_search_disabled ?? 0}, external_auth=${
          logSummary.stats.external_auth ?? 0
        }, mcp_noise=${logSummary.stats.mcp_noise ?? 0}`
      : `- Log flags: not analyzed`,
    '',
  ].join('\n');

  ensureDir(dirname(fixPlanPath));
  const existing = existsSync(fixPlanPath)
    ? readFileSync(fixPlanPath, 'utf8')
    : '# Diagnostics Master Fix Plan\n';
  writeFileSync(fixPlanPath, existing + planSnippet, 'utf8');

  process.stdout.write(
    JSON.stringify({
      ok: overallOk,
      report_path: reportPath,
      artifact_path: artifactPath,
      fix_plan_path: fixPlanPath,
    })
  );
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ ok: false, error: err?.message ?? String(err) }));
  process.exitCode = 1;
});
