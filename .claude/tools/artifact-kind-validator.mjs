#!/usr/bin/env node
/**
 * Artifact Kind Validator
 * 
 * Enforces canonical rules for reference vs generated artifacts.
 * Prevents placing rubrics/templates in generated/ or writing outputs into reference/.
 * 
 * Usage:
 *   node artifact-kind-validator.mjs [--check] [--fix]
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCanonicalPath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ARTIFACTS_DIR = getCanonicalPath('artifacts');
const GENERATED_DIR = join(ARTIFACTS_DIR, 'generated');
const REFERENCE_DIR = join(ARTIFACTS_DIR, 'reference');

// Known reference patterns
const REFERENCE_PATTERNS = [
  /-rubric\.json$/i,
  /-reference\.json$/i,
  /-template\.json$/i,
  /^plan-.*\.json$/i,
  /^rubric-.*\.json$/i,
  /^template-.*\.json$/i,
];

// Known generated patterns
const GENERATED_PATTERNS = [
  /-{workflow-id}\.json$/i,
  /-{timestamp}\.json$/i,
  /-{run-id}\.json$/i,
  /-{.*-id}\.json$/i, // Any pattern with -id suffix
];

function isReferenceFile(filename) {
  return REFERENCE_PATTERNS.some(pattern => pattern.test(filename));
}

function isGeneratedFile(filename) {
  return GENERATED_PATTERNS.some(pattern => pattern.test(filename));
}

function validateArtifactPlacement() {
  const errors = [];
  const warnings = [];

  // Check generated directory for reference files
  if (existsSync(GENERATED_DIR)) {
    const files = readdirSync(GENERATED_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && isReferenceFile(file)) {
        errors.push(
          `Reference file "${file}" found in generated/ directory. ` +
          `Move to reference/ directory.`
        );
      }
    }
  }

  // Check reference directory for generated files
  if (existsSync(REFERENCE_DIR)) {
    const files = readdirSync(REFERENCE_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && isGeneratedFile(file)) {
        warnings.push(
          `Generated file "${file}" found in reference/ directory. ` +
          `Consider moving to generated/ directory.`
        );
      }
    }
  }

  // Check root artifacts directory (should be empty after migration)
  if (existsSync(ARTIFACTS_DIR)) {
    const files = readdirSync(ARTIFACTS_DIR).filter(f => 
      f.endsWith('.json') && f !== 'generated' && f !== 'reference'
    );
    if (files.length > 0) {
      warnings.push(
        `Found ${files.length} artifact file(s) in root artifacts/ directory. ` +
        `These should be moved to generated/ or reference/ subdirectories.`
      );
    }
  }

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const fix = args.includes('--fix');

  const { errors, warnings } = validateArtifactPlacement();

  if (errors.length > 0) {
    console.error('❌ Artifact validation errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Artifact validation warnings:');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All artifacts are correctly placed.');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateArtifactPlacement, isReferenceFile, isGeneratedFile };
