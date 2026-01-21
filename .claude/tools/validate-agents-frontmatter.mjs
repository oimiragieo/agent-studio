#!/usr/bin/env node
/**
 * Agent Frontmatter Validator (LLM-RULES)
 *
 * Validates `.claude/agents/*.md` YAML frontmatter for basic correctness:
 * - required: name, description
 * - name format: lowercase letters/numbers + hyphens
 * - optional: tools, model, permissionMode
 *
 * Usage:
 *   node .claude/tools/validate-agents-frontmatter.mjs
 *   node .claude/tools/validate-agents-frontmatter.mjs --json
 *   node .claude/tools/validate-agents-frontmatter.mjs --agents-dir .claude/agents --root <path>
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_ROOT = join(__dirname, '..', '..');

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_MODELS = new Set(['sonnet', 'opus', 'haiku', 'inherit']);
const ALLOWED_PERMISSION_MODES = new Set([
  'default',
  'acceptEdits',
  'dontAsk',
  'bypassPermissions',
  'plan',
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  const hasFlag = name => args.includes(`--${name}`) || args.includes(`-${name}`);
  const getArg = name => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : null;
  };
  return {
    root: getArg('root'),
    agentsDir: getArg('agents-dir'),
    json: hasFlag('json'),
    help: hasFlag('help') || hasFlag('h'),
  };
}

function resolvePath(root, p) {
  if (!p) return '';
  return isAbsolute(p) ? p : join(root, p);
}

function listAgentFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map(e => join(dir, e.name))
    .sort();
}

function extractFrontmatter(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n'))
    return { frontmatter: null, body: normalized, error: 'Missing frontmatter start' };
  const endIdx = normalized.indexOf('\n---', 4);
  if (endIdx < 0) return { frontmatter: null, body: normalized, error: 'Missing frontmatter end' };

  const after = normalized.indexOf('\n', endIdx + 4);
  const front = normalized.slice(4, endIdx).trim();
  const body = after >= 0 ? normalized.slice(after + 1) : '';
  return { frontmatter: front, body, error: null };
}

function normalizeTools(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  // Support "Read, Grep, Glob" or "Read|Grep" styles.
  return text
    .split(/[,\|]/g)
    .map(v => v.trim())
    .filter(Boolean);
}

function validateAgent(meta) {
  const issues = [];
  const name = typeof meta.name === 'string' ? meta.name.trim() : '';
  const description = typeof meta.description === 'string' ? meta.description.trim() : '';

  if (!name) issues.push({ field: 'name', message: 'Missing required field' });
  else if (!NAME_RE.test(name))
    issues.push({
      field: 'name',
      message: 'Invalid format (use lowercase letters/numbers with hyphens)',
    });

  if (!description) issues.push({ field: 'description', message: 'Missing required field' });

  if (meta.model != null) {
    const model = String(meta.model).trim();
    if (model && !ALLOWED_MODELS.has(model)) {
      issues.push({ field: 'model', message: `Unexpected value: ${model}` });
    }
  }

  if (meta.permissionMode != null) {
    const mode = String(meta.permissionMode).trim();
    if (mode && !ALLOWED_PERMISSION_MODES.has(mode)) {
      issues.push({ field: 'permissionMode', message: `Unexpected value: ${mode}` });
    }
  }

  const tools = normalizeTools(meta.tools);
  if (meta.tools != null && tools.length === 0) {
    issues.push({ field: 'tools', message: 'Provided but empty' });
  }

  return issues;
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'Agent Frontmatter Validator',
        '',
        'Usage:',
        '  node .claude/tools/validate-agents-frontmatter.mjs [options]',
        '',
        'Options:',
        '  --agents-dir <dir>   Agents directory (default: .claude/agents)',
        '  --root <dir>         Project root (default: repo root)',
        '  --json               Emit machine-readable JSON',
        '',
      ].join('\n')
    );
    return;
  }

  const root = resolve(opts.root ? opts.root : DEFAULT_ROOT);
  const agentsDir = resolvePath(root, opts.agentsDir || join('.claude', 'agents'));
  const files = listAgentFiles(agentsDir);

  const failures = [];
  for (const filePath of files) {
    let content;
    try {
      if (!existsSync(filePath) || !statSync(filePath).isFile()) continue;
      content = readFileSync(filePath, 'utf8');
    } catch (error) {
      failures.push({
        file: relative(root, filePath).split('\\').join('/'),
        issues: [{ field: 'file', message: error?.message ?? String(error) }],
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    if (fm.error || !fm.frontmatter) {
      failures.push({
        file: relative(root, filePath).split('\\').join('/'),
        issues: [{ field: 'frontmatter', message: fm.error || 'Missing frontmatter' }],
      });
      continue;
    }

    let meta;
    try {
      meta = yaml.load(fm.frontmatter) || {};
    } catch (error) {
      failures.push({
        file: relative(root, filePath).split('\\').join('/'),
        issues: [
          { field: 'frontmatter', message: `YAML parse error: ${error?.message ?? String(error)}` },
        ],
      });
      continue;
    }

    const issues = validateAgent(meta);
    if (issues.length) {
      failures.push({
        file: relative(root, filePath).split('\\').join('/'),
        issues,
      });
    }
  }

  const summary = {
    scanned: files.length,
    failed: failures.length,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify({ summary, failures }, null, 2));
  } else {
    process.stdout.write(
      [
        'AGENT FRONTMATTER VALIDATION',
        '============================',
        '',
        `Scanned: ${summary.scanned}`,
        `Failed: ${summary.failed}`,
        '',
      ].join('\n')
    );

    if (failures.length) {
      for (const f of failures.slice(0, 30)) {
        process.stdout.write(`- ${f.file}\n`);
        for (const issue of f.issues) {
          process.stdout.write(`    - ${issue.field}: ${issue.message}\n`);
        }
      }
      if (failures.length > 30) process.stdout.write(`- ... and ${failures.length - 30} more\n`);
    }
  }

  process.exitCode = failures.length ? 1 : 0;
}

main();
