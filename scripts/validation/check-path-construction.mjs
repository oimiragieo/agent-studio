#!/usr/bin/env node
/**
 * Mechanical Enforcement Check
 *
 * Prevents direct path construction to context files outside of context-path-resolver.
 * Fails CI if direct path joins to ../context/ are found in .claude/tools/
 *
 * Usage:
 *   node scripts/validation/check-path-construction.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');
const TOOLS_DIR = join(ROOT, '.claude/tools');

// Patterns to check - catch all direct context path construction
const BAD_PATTERNS = [
  /\.\.\/context\//, // ../context/
  /path\.join\([^)]*['"]\.\.\/context\//, // path.join(..., '../context/
  /path\.join\(__dirname,\s*['"]\.\.\/context\//, // path.join(__dirname, '../context/
  /join\([^)]*['"]\.\.\/context\//, // join(..., '../context/
  /join\(__dirname,\s*['"]\.\.\/context\//, // join(__dirname, '../context/
  /['"]\.claude\/context\/(?!artifacts\/reference|artifacts\/generated|history)/, // '.claude/context/' (except stable paths)
  /resolve\([^)]*['"]\.claude\/context\/(?!artifacts\/reference|artifacts\/generated|history)/, // resolve(..., '.claude/context/'
  /['"]\.claude\/context\/(tmp|analytics|sessions|cache|runs|checkpoints|logs|memory|test|todos|tasks|audit|reports|progress)/, // Direct runtime dir references
];

// Exclusions (legitimate uses)
const EXCLUSIONS = [
  'context-path-resolver.mjs',
  'enforcement-gate.mjs',
  'path-resolver.mjs',
  'docs/',
  'schemas/',
  '.md',
  '.json',
  '.test.mjs',
  '.example.mjs',
  'test-',
  'README',
  'check-path-construction.mjs',
];

// Stable paths that are intentionally kept as public API
const STABLE_PATHS = [
  /\.claude\/context\/artifacts\/reference/, // Reference artifacts (public API)
  /\.claude\/context\/artifacts\/generated/, // Generated artifacts (public API)
  /\.claude\/context\/history/, // History (public API)
];

function isCommentOnly(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed === ''
  );
}

function isStablePath(line) {
  return STABLE_PATHS.some(pattern => pattern.test(line));
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = new Map(); // Use Map to dedupe by file:line

  lines.forEach((line, index) => {
    // Skip comment-only lines
    if (isCommentOnly(line)) {
      return;
    }

    // Skip stable paths
    if (isStablePath(line)) {
      return;
    }

    for (const pattern of BAD_PATTERNS) {
      if (pattern.test(line)) {
        // Check if this is an exclusion
        const isExcluded = EXCLUSIONS.some(exclusion => filePath.includes(exclusion));
        if (!isExcluded) {
          const key = `${filePath}:${index + 1}`;
          if (!violations.has(key)) {
            violations.set(key, {
              file: filePath,
              line: index + 1,
              content: line.trim(),
            });
          }
        }
      }
    }
  });

  return Array.from(violations.values());
}

function checkDirectory(dir) {
  const violations = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      violations.push(...checkDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
      violations.push(...checkFile(fullPath));
    }
  }

  return violations;
}

function main() {
  console.log('🔍 Checking for direct path construction to context files...\n');

  const violations = checkDirectory(TOOLS_DIR);

  if (violations.length > 0) {
    console.error('❌ Found violations:');
    violations.forEach(v => {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.content}`);
    });
    console.error(`\n❌ Total violations: ${violations.length}`);
    console.error('\nAll context path access must go through context-path-resolver.mjs');
    process.exit(1);
  }

  console.log('✅ No violations found. All context paths use resolver.');
  process.exit(0);
}

main();
