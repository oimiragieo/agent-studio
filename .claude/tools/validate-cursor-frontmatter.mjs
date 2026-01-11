#!/usr/bin/env node

/**
 * Cursor .mdc Frontmatter Validator
 *
 * Validates that all .mdc files in .cursor/ have required frontmatter fields:
 * - description (required)
 * - alwaysApply (required, default false)
 * - globs (optional)
 *
 * Can be run in CI/CD pipelines to ensure consistency.
 *
 * Usage:
 *   node .claude/tools/validate-cursor-frontmatter.mjs [--fix]
 *
 * Options:
 *   --fix  Automatically fix files missing alwaysApply field
 */

import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Parse CLI args
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

/**
 * Parse frontmatter from .mdc file
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, content, hasValidFrontmatter: false };
  }

  const frontmatterText = match[1];
  const frontmatterLines = frontmatterText.split('\n');
  const frontmatter = {};

  let currentKey = null;
  let currentValue = '';

  for (const line of frontmatterLines) {
    // Check if line starts a new key-value pair
    const keyValueMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);

    if (keyValueMatch) {
      // Save previous key-value if exists
      if (currentKey) {
        frontmatter[currentKey] = currentValue.trim();
      }

      currentKey = keyValueMatch[1];
      currentValue = keyValueMatch[2];
    } else if (currentKey && line.trim()) {
      // Continuation of multi-line value
      currentValue += '\n' + line;
    }
  }

  // Save last key-value
  if (currentKey) {
    frontmatter[currentKey] = currentValue.trim();
  }

  return {
    frontmatter,
    content: content.substring(match[0].length),
    hasValidFrontmatter: true,
    frontmatterText: match[0],
  };
}

/**
 * Validate frontmatter structure
 */
function validateFrontmatter(frontmatter, filePath) {
  const errors = [];
  const warnings = [];

  if (!frontmatter) {
    errors.push('Missing frontmatter block');
    return { valid: false, errors, warnings };
  }

  // Check required fields
  if (!frontmatter.description) {
    errors.push('Missing required field: description');
  }

  if (!('alwaysApply' in frontmatter)) {
    errors.push('Missing required field: alwaysApply');
  } else {
    // Validate alwaysApply is a boolean
    const value = frontmatter.alwaysApply.toLowerCase();
    if (value !== 'true' && value !== 'false') {
      errors.push('alwaysApply must be true or false');
    }
  }

  // Check optional fields
  if (frontmatter.globs) {
    // Validate globs is an array-like structure
    if (!frontmatter.globs.startsWith('[') && !frontmatter.globs.includes('\n')) {
      warnings.push('globs field should be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Fix frontmatter by adding missing alwaysApply field
 */
function fixFrontmatter(content, parsed) {
  if (!parsed.hasValidFrontmatter || !parsed.frontmatter) {
    console.error('Cannot fix file without valid frontmatter structure');
    return null;
  }

  // Only fix if alwaysApply is missing
  if ('alwaysApply' in parsed.frontmatter) {
    return null; // Nothing to fix
  }

  // Parse frontmatter lines
  const frontmatterLines = parsed.frontmatterText.split('\n');

  // Find insertion point (after description if it exists, otherwise after opening ---)
  let insertIndex = 1; // After opening ---

  for (let i = 1; i < frontmatterLines.length - 1; i++) {
    const line = frontmatterLines[i];
    if (line.trim().startsWith('description:')) {
      // Insert after description (accounting for multi-line descriptions)
      insertIndex = i + 1;

      // Skip continuation lines
      while (
        insertIndex < frontmatterLines.length - 1 &&
        frontmatterLines[insertIndex].trim() &&
        !frontmatterLines[insertIndex].includes(':')
      ) {
        insertIndex++;
      }
      break;
    }
  }

  // Insert alwaysApply: false
  frontmatterLines.splice(insertIndex, 0, 'alwaysApply: false');

  // Reconstruct file
  const newFrontmatter = frontmatterLines.join('\n');
  const newContent = newFrontmatter + parsed.content;

  return newContent;
}

/**
 * Main validation logic
 */
async function validateMdcFiles() {
  console.log('🔍 Validating Cursor .mdc frontmatter...\n');

  // Find all .mdc files in .cursor/
  const mdcFiles = await glob('.cursor/**/*.mdc', { cwd: projectRoot });

  if (mdcFiles.length === 0) {
    console.log('No .mdc files found in .cursor/');
    return { valid: true, totalFiles: 0 };
  }

  console.log(`Found ${mdcFiles.length} .mdc files\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let filesFixed = 0;
  const results = [];

  for (const file of mdcFiles) {
    const filePath = path.join(projectRoot, file);
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    const validation = validateFrontmatter(parsed.frontmatter, file);

    if (!validation.valid || validation.warnings.length > 0) {
      console.log(`📄 ${file}`);

      if (validation.errors.length > 0) {
        console.log('  ❌ Errors:');
        validation.errors.forEach(err => console.log(`     - ${err}`));
        totalErrors += validation.errors.length;
      }

      if (validation.warnings.length > 0) {
        console.log('  ⚠️  Warnings:');
        validation.warnings.forEach(warn => console.log(`     - ${warn}`));
        totalWarnings += validation.warnings.length;
      }

      // Attempt fix if --fix flag provided
      if (shouldFix && validation.errors.some(e => e.includes('alwaysApply'))) {
        const fixedContent = fixFrontmatter(content, parsed);
        if (fixedContent) {
          await writeFile(filePath, fixedContent, 'utf-8');
          console.log('  ✅ Fixed: Added alwaysApply: false');
          filesFixed++;
        } else {
          console.log('  ⚠️  Could not auto-fix');
        }
      }

      console.log('');
    }

    results.push({
      file,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total files: ${mdcFiles.length}`);
  console.log(`Files with errors: ${results.filter(r => r.errors.length > 0).length}`);
  console.log(`Files with warnings: ${results.filter(r => r.warnings.length > 0).length}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);

  if (shouldFix) {
    console.log(`Files fixed: ${filesFixed}`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allValid = results.every(r => r.valid);

  if (allValid) {
    console.log('✅ All .mdc files have valid frontmatter');
  } else if (shouldFix) {
    console.log('⚠️  Some files still have issues after auto-fix');
    console.log('   Run without --fix to see remaining issues');
  } else {
    console.log('❌ Validation failed');
    console.log('   Run with --fix to automatically fix missing alwaysApply fields');
  }

  return {
    valid: allValid,
    totalFiles: mdcFiles.length,
    totalErrors,
    totalWarnings,
    filesFixed,
  };
}

// Run validation
validateMdcFiles()
  .then(result => {
    process.exit(result.valid ? 0 : 1);
  })
  .catch(err => {
    console.error('Validation error:', err);
    process.exit(1);
  });
