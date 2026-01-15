#!/usr/bin/env node
/**
 * Fix Encoding-Dependent Glyphs
 * Replaces encoding-dependent characters (checkmarks, arrows) with ASCII-compatible alternatives
 * Fixes corrupted ASCII trees in CUJ files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

const DOCS_DIR = path.join(ROOT, '.claude/docs');

// Replacement mappings
const REPLACEMENTS = [
  // Checkmarks
  { pattern: /✅/g, replacement: '- [x]' },
  { pattern: /❌/g, replacement: '- [ ]' },
  { pattern: /⚠️/g, replacement: 'WARNING:' },

  // Arrows - standardize to ->
  { pattern: /→/g, replacement: '->' },
  { pattern: /←/g, replacement: '<-' },
  { pattern: /⇒/g, replacement: '=>' },
  { pattern: /⇐/g, replacement: '<=' },

  // Control glyphs and corrupted characters
  { pattern: /␦/g, replacement: '->' }, // Control glyph separator
  { pattern: /[\u0000-\u001F]/g, replacement: '' }, // Remove other control characters

  // Other common Unicode
  { pattern: /…/g, replacement: '...' },
  { pattern: /–/g, replacement: '-' },
  { pattern: /—/g, replacement: '--' },
];

/**
 * Fix ASCII tree diagrams
 */
function fixASCIITree(content) {
  // Fix tree characters that might be corrupted
  const treeFixes = [
    // Fix box drawing characters that might be corrupted
    { pattern: /├─/g, replacement: '|-' },
    { pattern: /└─/g, replacement: '`-' },
    { pattern: /│/g, replacement: '|' },
    { pattern: /├/g, replacement: '|' },
    { pattern: /└/g, replacement: '`' },
    { pattern: /─/g, replacement: '-' },
  ];

  let fixed = content;
  treeFixes.forEach(({ pattern, replacement }) => {
    fixed = fixed.replace(pattern, replacement);
  });

  return fixed;
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let fixed = content;

    // Apply replacements
    REPLACEMENTS.forEach(({ pattern, replacement }) => {
      fixed = fixed.replace(pattern, replacement);
    });

    // Fix ASCII trees
    fixed = fixASCIITree(fixed);

    // Only write if changed
    if (fixed !== content) {
      await fs.writeFile(filePath, fixed, 'utf-8');
      return { file: path.relative(ROOT, filePath), changed: true };
    }

    return { file: path.relative(ROOT, filePath), changed: false };
  } catch (error) {
    return { file: path.relative(ROOT, filePath), error: error.message };
  }
}

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return files;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/fix-encoding.mjs [--dry-run] [--file <path>]');
    console.log('');
    console.log('Replaces encoding-dependent glyphs with ASCII-compatible alternatives.');
    console.log('Fixes corrupted ASCII trees in documentation files.');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run    Show what would be changed without modifying files');
    console.log('  --file       Process a specific file instead of all docs');
    console.log('  --help       Show this help message');
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

  let files;
  if (fileArg) {
    files = [path.resolve(fileArg)];
  } else {
    files = await findMarkdownFiles(DOCS_DIR);
  }

  console.log(`🔍 Processing ${files.length} file(s)...\n`);

  const results = [];
  for (const file of files) {
    const result = await processFile(file);
    results.push(result);
  }

  const changed = results.filter(r => r.changed).length;
  const errors = results.filter(r => r.error).length;

  if (dryRun) {
    console.log('DRY RUN - No files were modified\n');
    results
      .filter(r => r.changed)
      .forEach(r => {
        console.log(`Would fix: ${r.file}`);
      });
  } else {
    if (changed > 0) {
      console.log(`✅ Fixed ${changed} file(s)\n`);
      results
        .filter(r => r.changed)
        .forEach(r => {
          console.log(`   - ${r.file}`);
        });
    } else {
      console.log('✅ No files needed fixing\n');
    }
  }

  if (errors > 0) {
    console.log(`\n⚠️  ${errors} error(s):`);
    results
      .filter(r => r.error)
      .forEach(r => {
        console.log(`   - ${r.file}: ${r.error}`);
      });
    process.exit(1);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
