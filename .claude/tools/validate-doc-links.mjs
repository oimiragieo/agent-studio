#!/usr/bin/env node
/**
 * Documentation Link Validator (LLM-RULES)
 *
 * Validates markdown links and anchors for a given docs directory and optional extra files.
 * Can auto-fix broken links when a unique target can be found under the docs dir.
 *
 * Usage:
 *   node .claude/tools/validate-doc-links.mjs
 *   node .claude/tools/validate-doc-links.mjs --write
 *   node .claude/tools/validate-doc-links.mjs --docs-dir .claude/docs --root <path> --write
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_ROOT = join(__dirname, '..', '..');

const LINK_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/gm;

const STATIC_ASSET_EXTENSIONS = new Set([
  '.zip',
  '.txt',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
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
    docsDir: getArg('docs-dir'),
    write: hasFlag('write'),
    json: hasFlag('json'),
    help: hasFlag('help') || hasFlag('h'),
  };
}

function resolvePath(root, p) {
  if (!p) return '';
  return isAbsolute(p) ? p : join(root, p);
}

function walkMarkdownFiles(dir) {
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
      if (entry.name.startsWith('_')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.toLowerCase().endsWith('.md')) results.push(full);
    }
  }
  return results.sort();
}

function stripCodeBlocks(content) {
  return content.replaceAll(/```[\s\S]*?```/g, '');
}

function headingToAnchor(heading) {
  return String(heading || '')
    .toLowerCase()
    .replaceAll(/[\u{1F300}-\u{1F9FF}]/gu, '') // emojis
    .replaceAll(/[^\w\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

function extractAnchors(markdown) {
  const anchors = new Set();
  const text = stripCodeBlocks(markdown);
  let match;
  while ((match = HEADING_PATTERN.exec(text)) !== null) {
    const heading = match[1];
    const slug = headingToAnchor(heading);
    if (slug) anchors.add(slug);
  }
  return anchors;
}

function isSkippableHref(href) {
  const h = String(href || '').trim();
  if (!h) return true;
  if (h.startsWith('http://') || h.startsWith('https://')) return true;
  if (h.startsWith('mailto:') || h.startsWith('tel:')) return true;
  if (h.startsWith('vscode:') || h.startsWith('file://')) return true;
  return false;
}

function splitHref(hrefRaw) {
  let href = String(hrefRaw || '').trim();
  if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1).trim();
  const hashIdx = href.indexOf('#');
  if (hashIdx < 0) return { path: href, anchor: '' };
  return { path: href.slice(0, hashIdx), anchor: href.slice(hashIdx + 1) };
}

function normalizeTargetFile(root, sourceFile, targetPath) {
  const raw = String(targetPath || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/')) return join(root, raw.replace(/^\/+/, ''));
  if (raw.startsWith('./') || raw.startsWith('../')) return resolve(dirname(sourceFile), raw);
  // bare relative: treat as relative to current file dir
  return resolve(dirname(sourceFile), raw);
}

function isMarkdownTarget(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.md')) return true;
  const extIdx = lower.lastIndexOf('.');
  if (extIdx < 0) return true; // no extension: assume md
  const ext = lower.slice(extIdx);
  return !STATIC_ASSET_EXTENSIONS.has(ext);
}

function targetExists(pathname) {
  try {
    if (!existsSync(pathname)) return false;
    const st = statSync(pathname);
    return st.isFile() || st.isDirectory();
  } catch {
    return false;
  }
}

function resolveExistingTargetFile(root, sourceFile, targetPath) {
  const candidate = normalizeTargetFile(root, sourceFile, targetPath);
  if (!candidate) return null;

  if (targetExists(candidate)) return candidate;
  // If no extension, try .md
  if (!candidate.toLowerCase().endsWith('.md')) {
    const md = `${candidate}.md`;
    if (targetExists(md)) return md;
  }
  return candidate; // return normalized even if missing for diagnostics
}

function indexDocsByBasename(docsRoot, markdownFiles) {
  const map = new Map(); // basename -> [absPaths]
  for (const file of markdownFiles) {
    const base = file.split(/[\\/]/).pop();
    const list = map.get(base) || [];
    list.push(file);
    map.set(base, list);
  }
  return map;
}

function applyFixes(content, issues) {
  let out = content;
  for (const issue of issues) {
    if (!issue.suggestedFix) continue;
    out = out.split(issue.href).join(issue.suggestedFix);
  }
  return out;
}

function processFile({ root, docsRoot, docsIndex, filePath }) {
  const raw = readFileSync(filePath, 'utf8');
  const content = stripCodeBlocks(raw);
  const anchors = extractAnchors(raw);

  const issues = [];
  let match;
  while ((match = LINK_REGEX.exec(content)) !== null) {
    const hrefRaw = match[2];
    if (isSkippableHref(hrefRaw)) continue;

    const { path: targetPath, anchor } = splitHref(hrefRaw);

    if (!targetPath && anchor) {
      if (!anchors.has(anchor)) {
        issues.push({
          type: 'broken-anchor',
          href: hrefRaw,
          message: `Anchor not found in file: #${anchor}`,
        });
      }
      continue;
    }

    if (!targetPath) continue;

    const resolved = resolveExistingTargetFile(root, filePath, targetPath);
    if (!resolved) continue;

    if (!targetExists(resolved)) {
      // Attempt auto-fix only for markdown-like targets, searching within docs root.
      if (docsRoot && isMarkdownTarget(targetPath)) {
        const base = resolved.split(/[\\/]/).pop();
        const candidates = docsIndex.get(base) || [];
        if (candidates.length === 1) {
          const relFromFile = relative(dirname(filePath), candidates[0]).split('\\').join('/');
          const suggested = `${relFromFile.startsWith('.') ? relFromFile : `./${relFromFile}`}${
            anchor ? `#${anchor}` : ''
          }`;
          issues.push({
            type: 'broken-link',
            href: hrefRaw,
            status: 'auto-fixable',
            suggestedFix: suggested,
            message: `Target not found; unique match in docs: ${relative(root, candidates[0])}`,
          });
        } else if (candidates.length > 1) {
          issues.push({
            type: 'broken-link',
            href: hrefRaw,
            status: 'needs-review',
            candidates: candidates.map(c => relative(root, c).split('\\').join('/')),
            message: 'Target not found; multiple candidates in docs',
          });
        } else {
          issues.push({
            type: 'broken-link',
            href: hrefRaw,
            status: 'manual',
            message: `Target not found: ${relative(root, resolved).split('\\').join('/')}`,
          });
        }
      } else {
        issues.push({
          type: 'broken-link',
          href: hrefRaw,
          status: 'manual',
          message: `Target not found: ${relative(root, resolved).split('\\').join('/')}`,
        });
      }
      continue;
    }

    if (anchor && isMarkdownTarget(targetPath)) {
      try {
        const st = statSync(resolved);
        if (st.isDirectory()) {
          issues.push({
            type: 'broken-anchor',
            href: hrefRaw,
            status: 'manual',
            message: `Anchor cannot be validated for directory target: ${relative(root, resolved).split('\\').join('/')}`,
          });
        } else {
          const targetContent = readFileSync(resolved, 'utf8');
          const targetAnchors = extractAnchors(targetContent);
          if (!targetAnchors.has(anchor)) {
            issues.push({
              type: 'broken-anchor',
              href: hrefRaw,
              status: 'manual',
              message: `Anchor not found in target: ${relative(root, resolved).split('\\').join('/')}#${anchor}`,
            });
          }
        }
      } catch {
        issues.push({
          type: 'broken-anchor',
          href: hrefRaw,
          status: 'manual',
          message: `Anchor validation failed for target: ${relative(root, resolved).split('\\').join('/')}`,
        });
      }
    }
  }

  return { raw, issues };
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    process.stdout.write(
      [
        'Documentation Link Validator',
        '',
        'Usage:',
        '  node .claude/tools/validate-doc-links.mjs [options]',
        '',
        'Options:',
        '  --docs-dir <dir>   Directory to scan for docs (default: .claude/docs)',
        '  --root <dir>       Project root (default: repo root)',
        '  --write            Apply auto-fixable link fixes',
        '  --json             Emit machine-readable JSON',
        '',
      ].join('\n')
    );
    return;
  }

  const root = resolve(opts.root ? opts.root : DEFAULT_ROOT);
  const docsRoot = resolvePath(root, opts.docsDir || join('.claude', 'docs'));
  const docsExists = existsSync(docsRoot);

  const docsFiles = docsExists ? walkMarkdownFiles(docsRoot) : [];
  const docsIndex = indexDocsByBasename(docsRoot, docsFiles);

  const extraFiles = [
    join(root, '.claude', 'README.md'),
    join(root, 'README.md'),
    join(root, 'GETTING_STARTED.md'),
  ].filter(p => existsSync(p));

  const files = [...new Set([...docsFiles, ...extraFiles])];

  const allIssues = [];
  let filesWithIssues = 0;

  for (const filePath of files) {
    const { raw, issues } = processFile({
      root,
      docsRoot: docsExists ? docsRoot : null,
      docsIndex,
      filePath,
    });
    if (!issues.length) continue;
    filesWithIssues += 1;
    for (const issue of issues) {
      allIssues.push({
        file: relative(root, filePath).split('\\').join('/'),
        ...issue,
      });
    }

    if (opts.write) {
      const fixable = issues.filter(i => i.status === 'auto-fixable' && i.suggestedFix);
      if (fixable.length) {
        const updated = applyFixes(raw, fixable);
        writeFileSync(filePath, updated, 'utf8');
      }
    }
  }

  const summary = {
    scanned: files.length,
    files_with_issues: filesWithIssues,
    issues: allIssues.length,
    auto_fixable: allIssues.filter(i => i.status === 'auto-fixable').length,
    needs_review: allIssues.filter(i => i.status === 'needs-review').length,
    manual: allIssues.filter(i => i.status === 'manual' || i.type === 'broken-anchor').length,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify({ summary, issues: allIssues }, null, 2));
  } else {
    process.stdout.write(
      [
        'DOC LINK VALIDATION',
        '===================',
        '',
        `Scanned: ${summary.scanned}`,
        `Files with issues: ${summary.files_with_issues}`,
        `Total issues: ${summary.issues}`,
        `Auto-fixable: ${summary.auto_fixable}`,
        `Needs review: ${summary.needs_review}`,
        `Manual: ${summary.manual}`,
        '',
      ].join('\n')
    );
    if (allIssues.length) {
      for (const issue of allIssues.slice(0, 50)) {
        const tag =
          issue.status === 'auto-fixable'
            ? 'FIX'
            : issue.status === 'needs-review'
              ? 'REVIEW'
              : 'MANUAL';
        process.stdout.write(`- [${tag}] ${issue.file}: ${issue.href}\n`);
        if (issue.suggestedFix) process.stdout.write(`    -> ${issue.suggestedFix}\n`);
        if (issue.message) process.stdout.write(`    ${issue.message}\n`);
      }
      if (allIssues.length > 50) {
        process.stdout.write(`- ... and ${allIssues.length - 50} more\n`);
      }
      if (!opts.write && summary.auto_fixable) {
        process.stdout.write('\nRe-run with `--write` to auto-fix auto-fixable issues.\n');
      }
    }
  }

  process.exitCode = allIssues.length ? 1 : 0;
}

main();
