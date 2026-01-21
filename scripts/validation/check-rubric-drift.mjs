#!/usr/bin/env node
/**
 * Rubric Drift Checker
 *
 * Ensures standard-plan-rubric.json stays in sync between:
 * - .claude/context/artifacts/standard-plan-rubric.json (root, for backward compatibility)
 * - .claude/context/artifacts/reference/standard-plan-rubric.json (reference, canonical)
 *
 * Prevents subtle workflow/agent mismatches from drift.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');

const ROOT_RUBRIC = join(ROOT, '.claude/context/artifacts/standard-plan-rubric.json');
const REFERENCE_RUBRIC = join(
  ROOT,
  '.claude/context/artifacts/reference/standard-plan-rubric.json'
);

function checkRubricDrift() {
  const errors = [];
  const warnings = [];

  // Check if both files exist
  const rootExists = existsSync(ROOT_RUBRIC);
  const referenceExists = existsSync(REFERENCE_RUBRIC);

  if (!rootExists && !referenceExists) {
    errors.push('Neither rubric file exists. Both should be present.');
    return { valid: false, errors, warnings };
  }

  if (!rootExists) {
    warnings.push('Root rubric missing. Workflows may fail.');
  }

  if (!referenceExists) {
    warnings.push('Reference rubric missing. This is the canonical location.');
  }

  // If both exist, compare content
  if (rootExists && referenceExists) {
    try {
      const rootContent = readFileSync(ROOT_RUBRIC, 'utf-8');
      const referenceContent = readFileSync(REFERENCE_RUBRIC, 'utf-8');

      // Parse JSON to normalize formatting differences
      const rootJson = JSON.parse(rootContent);
      const referenceJson = JSON.parse(referenceContent);

      // Deep comparison (simple stringify comparison for now)
      const rootNormalized = JSON.stringify(rootJson, null, 2);
      const referenceNormalized = JSON.stringify(referenceJson, null, 2);

      if (rootNormalized !== referenceNormalized) {
        errors.push(
          'Rubric files have drifted - content differs between root and reference locations.'
        );
        errors.push('  Root: .claude/context/artifacts/standard-plan-rubric.json');
        errors.push('  Reference: .claude/context/artifacts/reference/standard-plan-rubric.json');
        errors.push('  Action: Sync the files to ensure consistency.');
      }
    } catch (error) {
      errors.push(`Failed to compare rubric files: ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Run check if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkRubricDrift();

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (result.errors.length > 0) {
    console.error('\n❌ Rubric drift detected:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ Rubric files are in sync');
  process.exit(0);
}

export { checkRubricDrift };
