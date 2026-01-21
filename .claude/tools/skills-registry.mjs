#!/usr/bin/env node
/**
 * skills-registry.mjs
 *
 * Builds a machine-readable registry of skills available in this workspace.
 * - Scans `.claude/skills/<skill>/SKILL.md` and `codex-skills/<skill>/SKILL.md` (if present)
 * - Parses YAML frontmatter (best-effort) to extract name/description/etc
 * - Writes a JSON file for audits and enterprise inventory
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), out: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--project-root') args.projectRoot = argv[++i] || args.projectRoot;
    else if (a === '--out') args.out = argv[++i] || null;
  }
  return args;
}

async function tryLoadYaml() {
  try {
    const mod = await import('js-yaml');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function extractFrontmatterBlock(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return null;
  return normalized.slice(4, end);
}

function parseFrontmatterFallback(text) {
  const out = {};
  for (const line of String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)) {
    const m = line.match(/^([A-Za-z0-9_.:-]+)\s*:\s*(.+)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}

async function parseSkillFile(skillFile, dirName) {
  const raw = await readFile(skillFile, 'utf8');
  const block = extractFrontmatterBlock(raw);
  const yaml = await tryLoadYaml();
  let data = null;
  if (block && yaml) {
    try {
      data = yaml.load(block);
    } catch {
      data = null;
    }
  }
  if (!data && block) data = parseFrontmatterFallback(block);
  const get = k => (data && typeof data === 'object' ? data[k] : undefined);

  const name = typeof get('name') === 'string' ? get('name').trim() : dirName;
  const description = typeof get('description') === 'string' ? get('description').trim() : '';
  const version = get('version') != null ? String(get('version')).trim() : null;
  const model = get('model') != null ? String(get('model')).trim() : null;
  const contextFork =
    typeof get('context:fork') === 'boolean'
      ? get('context:fork')
      : get('context:fork') != null
        ? String(get('context:fork')).trim()
        : null;

  const allowedToolsRaw = get('allowed-tools');
  const allowedTools = Array.isArray(allowedToolsRaw)
    ? allowedToolsRaw.map(String)
    : typeof allowedToolsRaw === 'string'
      ? allowedToolsRaw
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : null;

  return {
    name,
    description,
    version,
    model,
    context_fork: contextFork,
    allowed_tools: allowedTools,
  };
}

async function listSkillDirs(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function buildRegistry({ projectRoot }) {
  const roots = [
    { source: 'agent-studio', dir: join(projectRoot, '.claude', 'skills') },
    { source: 'codex-skills', dir: join(projectRoot, 'codex-skills') },
  ].filter(r => existsSync(r.dir));

  const skills = [];
  for (const r of roots) {
    const dirs = await listSkillDirs(r.dir);
    for (const d of dirs) {
      const skillFile = join(r.dir, d, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const meta = await parseSkillFile(skillFile, d).catch(() => null);
      skills.push({
        source: r.source,
        dir: d,
        skill_file: skillFile,
        ...(meta || {
          name: d,
          description: '',
          version: null,
          model: null,
          context_fork: null,
          allowed_tools: null,
        }),
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    counts: {
      total: skills.length,
      by_source: skills.reduce((acc, s) => {
        acc[s.source] = (acc[s.source] || 0) + 1;
        return acc;
      }, {}),
    },
    skills,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = isAbsolute(args.projectRoot)
    ? args.projectRoot
    : resolve(process.cwd(), args.projectRoot);
  const registry = await buildRegistry({ projectRoot });

  const out =
    args.out && String(args.out).trim()
      ? resolve(projectRoot, args.out)
      : resolve(projectRoot, '.claude', 'context', 'artifacts', 'skills', 'skills-registry.json');
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(out, JSON.stringify(registry, null, 2), 'utf8');

  if (args.json)
    process.stdout.write(JSON.stringify({ ok: true, out, counts: registry.counts }) + '\n');
  else process.stdout.write(`${out}\n`);
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
