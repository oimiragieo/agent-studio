#!/usr/bin/env node
/**
 * tmp-framework-catalog.mjs
 *
 * Produces a lightweight, repo-local catalog of reference frameworks under `.tmp/`.
 * This is intentionally heuristic-based (no deep parsing) so it stays fast and safe.
 *
 * Output:
 * - JSON: `.claude/context/artifacts/research/tmp-frameworks-<timestamp>.json`
 * - Markdown: `.claude/context/reports/research/tmp-frameworks-<timestamp>.md`
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const PROJECT_ROOT = process.cwd();
const TMP_DIR = join(PROJECT_ROOT, '.tmp');

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function safeReadJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(String(require('node:fs').readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

async function safeReadText(path, maxBytes = 256 * 1024) {
  try {
    if (!existsSync(path)) return null;
    const s = await stat(path);
    if (!s.isFile()) return null;
    const bytes = Math.min(Number(s.size), maxBytes);
    const buf = await readFile(path);
    return buf.subarray(0, bytes).toString('utf8');
  } catch {
    return null;
  }
}

function detectSignals(text) {
  if (!text) return {};
  const t = text.toLowerCase();
  const has = re => re.test(t);
  return {
    mentions_headless: has(/\b(headless|non-interactive|--output-format|-p\b|--print)\b/),
    mentions_json_output: has(/\b(output[- ]format|jsonl?|structured output)\b/),
    mentions_summarization: has(/\b(summar(y|ize)|carryover|clear_history|compact)\b/),
    mentions_checkpoints: has(/\b(checkpoint|rollback|revert)\b/),
    mentions_observability: has(
      /\b(observability|telemetry|trace|span|otlp|opentelemetry|metrics)\b/
    ),
    mentions_memory: has(/\b(memory|rag|vector|embedding|hnsw)\b/),
    mentions_multi_process: has(
      /\b(worktree|worktree|subprocess|separate process|multiple terminals)\b/
    ),
  };
}

async function listFilesShallow(root, maxDepth = 3) {
  const out = [];
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth && !e.name.startsWith('.git'))
          queue.push({ dir: p, depth: depth + 1 });
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }
  return out;
}

function summarizeTech(files) {
  const exts = new Map();
  for (const f of files) {
    const ext = extname(f).toLowerCase() || '(none)';
    exts.set(ext, (exts.get(ext) || 0) + 1);
  }
  const top = [...exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { top_extensions: top.map(([ext, count]) => ({ ext, count })) };
}

async function analyzeRepo(repoDir) {
  const name = basename(repoDir);
  const paths = {
    readme: join(repoDir, 'README.md'),
    claude_md: join(repoDir, 'CLAUDE.md'),
    package_json: join(repoDir, 'package.json'),
    pyproject: join(repoDir, 'pyproject.toml'),
    requirements: join(repoDir, 'requirements.txt'),
    dot_claude_settings: join(repoDir, '.claude', 'settings.json'),
    conductor_commands: join(repoDir, 'commands'),
  };

  const readmeText = await safeReadText(paths.readme);
  const claudeText = await safeReadText(paths.claude_md);
  const settingsText = await safeReadText(paths.dot_claude_settings);
  const pkg = safeReadJson(paths.package_json);

  const signals = {
    ...detectSignals(readmeText),
    ...Object.fromEntries(
      Object.entries(detectSignals(claudeText)).map(([k, v]) => [`claude_${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(detectSignals(settingsText)).map(([k, v]) => [`settings_${k}`, v])
    ),
  };

  const files = await listFilesShallow(repoDir, 3);
  const tech = summarizeTech(files);

  const featureHints = [];
  if (existsSync(paths.dot_claude_settings)) featureHints.push('has_claude_settings');
  if (existsSync(paths.conductor_commands)) featureHints.push('has_command_defs');
  if (existsSync(paths.pyproject) || existsSync(paths.requirements)) featureHints.push('python');
  if (existsSync(paths.package_json)) featureHints.push('node');

  const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : [];

  return {
    name,
    repo_dir: repoDir,
    key_files: Object.fromEntries(
      Object.entries(paths).map(([k, v]) => [k, existsSync(v) ? v : null])
    ),
    package: pkg
      ? { name: pkg.name || null, private: !!pkg.private, type: pkg.type || null, scripts }
      : null,
    tech,
    signals,
    feature_hints: featureHints,
  };
}

function renderMarkdown({ timestamp, repos }) {
  const lines = [];
  lines.push(`# tmp Framework Catalog`);
  lines.push('');
  lines.push(`Generated: \`${timestamp}\``);
  lines.push('');
  lines.push(`Total repos scanned: **${repos.length}**`);
  lines.push('');

  for (const r of repos) {
    lines.push(`## ${r.name}`);
    lines.push(`- Path: \`${r.repo_dir}\``);
    if (r.key_files.readme) lines.push(`- README: \`${r.key_files.readme}\``);
    if (r.key_files.dot_claude_settings)
      lines.push(`- .claude settings: \`${r.key_files.dot_claude_settings}\``);
    if (r.key_files.claude_md) lines.push(`- CLAUDE.md: \`${r.key_files.claude_md}\``);
    if (r.key_files.package_json) lines.push(`- package.json: \`${r.key_files.package_json}\``);
    lines.push(
      `- Signals: headless=${!!r.signals.mentions_headless || !!r.signals.settings_mentions_headless}, summaries=${
        !!r.signals.mentions_summarization || !!r.signals.settings_mentions_summarization
      }, observability=${!!r.signals.mentions_observability || !!r.signals.settings_mentions_observability}, memory=${
        !!r.signals.mentions_memory || !!r.signals.settings_mentions_memory
      }`
    );
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  if (!existsSync(TMP_DIR)) {
    process.stderr.write(`Missing .tmp directory at ${TMP_DIR}\n`);
    process.exit(2);
  }

  const timestamp = nowStamp();
  const outJson = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'artifacts',
    'research',
    `tmp-frameworks-${timestamp}.json`
  );
  const outMd = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'reports',
    'research',
    `tmp-frameworks-${timestamp}.md`
  );

  await mkdir(dirname(outJson), { recursive: true });
  await mkdir(dirname(outMd), { recursive: true });

  const entries = await readdir(TMP_DIR, { withFileTypes: true });
  const repos = entries
    .filter(e => e.isDirectory())
    .map(e => join(TMP_DIR, e.name))
    .filter(p => existsSync(p));

  const results = [];
  for (const repoDir of repos) {
    results.push(await analyzeRepo(repoDir));
  }

  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    timestamp,
    tmp_dir: TMP_DIR,
    repo_count: results.length,
    repos: results,
  };

  await writeFile(outJson, JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(outMd, renderMarkdown({ timestamp, repos: results }), 'utf8');

  process.stdout.write(
    JSON.stringify({
      ok: true,
      out_json: outJson,
      out_md: outMd,
      repo_count: results.length,
    })
  );
}

main().catch(err => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
