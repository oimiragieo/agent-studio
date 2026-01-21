#!/usr/bin/env node
/**
 * catalog-reference-frameworks.mjs
 *
 * Scans the repo-local `.tmp/` directory (reference frameworks) and emits a small JSON catalog
 * that we can diff against our implementation decisions (concurrency, process model, memory, observability).
 *
 * This is intentionally local-only: it does not fetch network resources.
 */

import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = { tmpDir: '.tmp', out: null, maxReadBytes: 256 * 1024 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tmp-dir') args.tmpDir = argv[++i] || args.tmpDir;
    else if (a === '--out') args.out = argv[++i] || null;
    else if (a === '--max-read-bytes')
      args.maxReadBytes = Number(argv[++i] || '0') || args.maxReadBytes;
  }
  return args;
}

async function safeReadText(path, maxBytes) {
  try {
    if (!existsSync(path)) return null;
    const s = await stat(path);
    const bytes = Math.min(Number(s.size || 0), maxBytes);
    const raw = await readFile(path);
    const slice = raw.subarray(0, bytes);
    return slice.toString('utf8');
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = process.cwd();
  const tmpRoot = resolve(projectRoot, args.tmpDir);

  if (!existsSync(tmpRoot)) {
    process.stderr.write(`No tmp dir found at: ${tmpRoot}\n`);
    process.exit(2);
  }

  const dirs = (await readdir(tmpRoot, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b));

  const markerFiles = [
    'package.json',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'README.md',
    'AGENTS.md',
    'claude.json',
    'mcp.json',
    '.mcp.json',
  ];

  const entries = [];
  for (const name of dirs) {
    const root = join(tmpRoot, name);
    const markers = markerFiles.filter(m => existsSync(join(root, m)));
    const pkgText = await safeReadText(join(root, 'package.json'), args.maxReadBytes);
    const readmeText = await safeReadText(join(root, 'README.md'), args.maxReadBytes);

    let pkg = null;
    if (pkgText) {
      try {
        pkg = JSON.parse(pkgText);
      } catch {
        pkg = null;
      }
    }

    const signals = {
      has_package_json: Boolean(pkg),
      has_pyproject: existsSync(join(root, 'pyproject.toml')),
      has_mcp_json: existsSync(join(root, '.mcp.json')) || existsSync(join(root, 'mcp.json')),
      mentions_mcp: Boolean(readmeText && /\bmcp\b/i.test(readmeText)),
      mentions_subagents: Boolean(readmeText && /\bsub-?agent(s)?\b/i.test(readmeText)),
      mentions_streaming: Boolean(readmeText && /\bstream(ing)?\b/i.test(readmeText)),
      mentions_memory: Boolean(readmeText && /\b(memory|heap|oom|rss)\b/i.test(readmeText)),
      mentions_workers: Boolean(readmeText && /\b(worker|pool|queue)\b/i.test(readmeText)),
    };

    entries.push({
      name,
      root,
      markers,
      pkg: pkg
        ? {
            name: pkg.name || null,
            version: pkg.version || null,
            type: pkg.type || null,
            bin: pkg.bin || null,
            scripts: pkg.scripts || null,
            engines: pkg.engines || null,
            dependencies_count: pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
            dev_dependencies_count: pkg.devDependencies
              ? Object.keys(pkg.devDependencies).length
              : 0,
          }
        : null,
      signals,
    });
  }

  const catalog = {
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    tmp_root: tmpRoot,
    entries,
  };

  const out =
    args.out && String(args.out).trim()
      ? resolve(projectRoot, args.out)
      : resolve(
          projectRoot,
          '.claude',
          'context',
          'artifacts',
          'research',
          'reference-frameworks-catalog.json'
        );
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(out, JSON.stringify(catalog, null, 2), 'utf8');
  process.stdout.write(`${out}\n`);
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
