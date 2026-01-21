#!/usr/bin/env node
/**
 * tmp-framework-feature-audit.mjs
 *
 * Deeper (still heuristic) feature audit of reference frameworks under `.tmp/`.
 * Focus: memory management, process isolation, orchestration patterns, and observability.
 *
 * Output:
 * - JSON: `.claude/context/artifacts/research/tmp-feature-audit-<timestamp>.json`
 * - Markdown: `.claude/context/reports/research/tmp-feature-audit-<timestamp>.md`
 *
 * Notes:
 * - This intentionally avoids heavy parsing and only reads the first N bytes per file.
 * - It skips common large directories (node_modules, dist, build, .venv, etc.).
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const TMP_DIR = join(PROJECT_ROOT, '.tmp');

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_BYTES_PER_FILE = 256 * 1024;
const DEFAULT_MAX_FILES = 8000;
const DEFAULT_MAX_HITS_PER_CATEGORY = 25;

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.idea',
  '.vscode',
  'coverage',
  'target',
]);

const ALLOWED_EXTS = new Set([
  '.md',
  '.txt',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.sh',
  '.ps1',
]);

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

function safeReadJson(path) {
  try {
    if (!existsSync(path)) return null;
    // eslint-disable-next-line n/no-sync
    return JSON.parse(String(require('node:fs').readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

function normalizeText(buf) {
  // Avoid throwing on bad encodings; this is heuristic-only.
  try {
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

async function listFiles(root, { maxDepth, maxFiles }) {
  const files = [];
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length && files.length < maxFiles) {
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
        if (SKIP_DIR_NAMES.has(e.name)) continue;
        if (depth < maxDepth) queue.push({ dir: p, depth: depth + 1 });
      } else if (e.isFile()) {
        const ext = extname(e.name).toLowerCase();
        if (!ext || ALLOWED_EXTS.has(ext)) files.push(p);
      }
      if (files.length >= maxFiles) break;
    }
  }
  return files;
}

function makeCategories() {
  return [
    {
      key: 'process_isolation',
      label: 'Process isolation / multi-process',
      patterns: [
        /\b(child_process|spawn|fork|execfile|subprocess|multiprocessing|processpool|worker pool)\b/i,
        /\b(pm2|supervisord|daemon|process manager)\b/i,
      ],
    },
    {
      key: 'memory_management',
      label: 'Memory/context management',
      patterns: [
        /\b(max[-_ ]old[-_ ]space[-_ ]size|heap|oom|out of memory)\b/i,
        /\b(truncate|trim|compact|summari[sz]e|clear_history|token limit|max_context)\b/i,
      ],
    },
    {
      key: 'observability',
      label: 'Observability / tracing',
      patterns: [
        /\b(opentelemetry|otlp|traceparent|tracestate|span_id|trace_id)\b/i,
        /\b(langfuse|langsmith|phoenix|openinference|arize|telemetry|metrics)\b/i,
      ],
    },
    {
      key: 'reliability',
      label: 'Reliability (retry/backoff/circuit breaker)',
      patterns: [/\b(retry|backoff|exponential|circuit breaker|timeout|rate limit)\b/i],
    },
    {
      key: 'orchestration',
      label: 'Orchestration / routing',
      patterns: [/\b(orchestrator|router|handoff|delegate|agent graph|planner|multi-agent)\b/i],
    },
    {
      key: 'persistence',
      label: 'Persistence / memory stores',
      patterns: [/\b(sqlite|postgres|pgvector|redis|chromadb|faiss|milvus|vector)\b/i],
    },
  ];
}

function emptyCategoryStats() {
  return { matches: 0, files: [] };
}

async function analyzeRepo(repoDir, opts) {
  const name = basename(repoDir);
  const packageJsonPath = join(repoDir, 'package.json');
  const pkg = safeReadJson(packageJsonPath);

  const categories = makeCategories();
  const stats = Object.fromEntries(categories.map(c => [c.key, emptyCategoryStats()]));

  const files = await listFiles(repoDir, { maxDepth: opts.maxDepth, maxFiles: opts.maxFiles });
  for (const file of files) {
    let s;
    try {
      s = await stat(file);
      if (!s.isFile()) continue;
    } catch {
      continue;
    }
    const bytes = Math.min(Number(s.size), opts.maxBytesPerFile);
    let text = '';
    try {
      const buf = await readFile(file);
      text = normalizeText(buf.subarray(0, bytes));
    } catch {
      continue;
    }

    for (const c of categories) {
      let hit = false;
      for (const re of c.patterns) {
        if (re.test(text)) {
          stats[c.key].matches += 1;
          hit = true;
          break;
        }
      }
      if (hit && stats[c.key].files.length < opts.maxHitsPerCategory) {
        stats[c.key].files.push(file);
      }
    }
  }

  const deps =
    pkg && typeof pkg === 'object' ? { ...pkg.dependencies, ...pkg.devDependencies } : null;
  const depKeys = deps ? Object.keys(deps) : [];

  const depSignals = {
    opentelemetry: depKeys.filter(k => /opentelemetry/i.test(k)).slice(0, 10),
    langfuse_like: depKeys
      .filter(k => /(langfuse|langsmith|phoenix|openinference)/i.test(k))
      .slice(0, 10),
    agent_like: depKeys
      .filter(k => /(autogen|langchain|llamaindex|crewai|swarm)/i.test(k))
      .slice(0, 10),
  };

  return {
    name,
    repo_dir: repoDir,
    scanned_files: files.length,
    package_json: existsSync(packageJsonPath) ? packageJsonPath : null,
    dependency_signals: depSignals,
    feature_stats: stats,
  };
}

function renderMarkdown({ timestamp, outJson, results }) {
  const lines = [];
  lines.push('# tmp Framework Feature Audit');
  lines.push('');
  lines.push(`Generated: \`${timestamp}\``);
  lines.push('');
  lines.push(`JSON artifact: \`${outJson}\``);
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.name}`);
    lines.push(`- Path: \`${r.repo_dir}\``);
    lines.push(`- Scanned files: **${r.scanned_files}**`);
    const stats = r.feature_stats || {};
    for (const [k, v] of Object.entries(stats)) {
      lines.push(`- ${k}: matches=${v.matches}, sample_files=${v.files.length}`);
    }
    const deps = r.dependency_signals || {};
    if ((deps.opentelemetry || []).length)
      lines.push(`- deps.opentelemetry: \`${deps.opentelemetry.join('`, `')}\``);
    if ((deps.langfuse_like || []).length)
      lines.push(`- deps.langfuse_like: \`${deps.langfuse_like.join('`, `')}\``);
    if ((deps.agent_like || []).length)
      lines.push(`- deps.agent_like: \`${deps.agent_like.join('`, `')}\``);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  if (!existsSync(TMP_DIR)) die(`Missing .tmp directory at ${TMP_DIR}`);

  const timestamp = nowStamp();
  const outJson = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'artifacts',
    'research',
    `tmp-feature-audit-${timestamp}.json`
  );
  const outMd = join(
    PROJECT_ROOT,
    '.claude',
    'context',
    'reports',
    'research',
    `tmp-feature-audit-${timestamp}.md`
  );

  await mkdir(dirname(outJson), { recursive: true });
  await mkdir(dirname(outMd), { recursive: true });

  const maxDepth = Number.isFinite(Number(process.env.TMP_AUDIT_MAX_DEPTH))
    ? Number(process.env.TMP_AUDIT_MAX_DEPTH)
    : DEFAULT_MAX_DEPTH;
  const maxBytesPerFile = Number.isFinite(Number(process.env.TMP_AUDIT_MAX_BYTES))
    ? Number(process.env.TMP_AUDIT_MAX_BYTES)
    : DEFAULT_MAX_BYTES_PER_FILE;
  const maxFiles = Number.isFinite(Number(process.env.TMP_AUDIT_MAX_FILES))
    ? Number(process.env.TMP_AUDIT_MAX_FILES)
    : DEFAULT_MAX_FILES;
  const maxHitsPerCategory = Number.isFinite(Number(process.env.TMP_AUDIT_MAX_HITS))
    ? Number(process.env.TMP_AUDIT_MAX_HITS)
    : DEFAULT_MAX_HITS_PER_CATEGORY;

  const entries = await readdir(TMP_DIR, { withFileTypes: true });
  const repos = entries.filter(e => e.isDirectory()).map(e => join(TMP_DIR, e.name));

  const results = [];
  for (const repoDir of repos) {
    results.push(
      await analyzeRepo(repoDir, { maxDepth, maxBytesPerFile, maxFiles, maxHitsPerCategory })
    );
  }

  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    timestamp,
    tmp_dir: TMP_DIR,
    options: { maxDepth, maxBytesPerFile, maxFiles, maxHitsPerCategory },
    repo_count: results.length,
    repos: results,
  };

  await writeFile(outJson, JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(outMd, renderMarkdown({ timestamp, outJson, results }), 'utf8');

  process.stdout.write(
    JSON.stringify({ ok: true, out_json: outJson, out_md: outMd, repo_count: results.length })
  );
}

main().catch(err => die(err?.stack || err?.message || String(err), 1));
