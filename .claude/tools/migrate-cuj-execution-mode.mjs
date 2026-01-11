#!/usr/bin/env node
/**
 * Migration Script: CUJ Execution Mode Standardization
 *
 * Converts old format (mixed execution mode + workflow path) to new format:
 * - execution_mode: enum value (workflow, skill-only, manual-setup)
 * - workflow_path: separate field for workflow file path (only for workflow mode)
 *
 * Usage:
 *   node .claude/tools/migrate-cuj-execution-mode.mjs --dry-run
 *   node .claude/tools/migrate-cuj-execution-mode.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CUJ_DIR = path.join(PROJECT_ROOT, '.claude/docs/cujs');

// Execution mode patterns
const EXECUTION_MODE_PATTERN = /\*\*Execution Mode\*\*:\s*`([^`]+)`/;
const WORKFLOW_PATH_PATTERN = /\.claude\/workflows\/[a-z0-9-]+\.yaml/;

// Standard execution mode enum
const EXECUTION_MODES = {
  WORKFLOW: 'workflow',
  SKILL_ONLY: 'skill-only',
  MANUAL_SETUP: 'manual-setup',
};

/**
 * Determine execution mode from current string
 */
function parseExecutionMode(currentValue) {
  // Check if it's already a valid enum
  if (Object.values(EXECUTION_MODES).includes(currentValue)) {
    return {
      mode: currentValue,
      workflowPath: null,
    };
  }

  // Check if it's a workflow path
  if (WORKFLOW_PATH_PATTERN.test(currentValue)) {
    return {
      mode: EXECUTION_MODES.WORKFLOW,
      workflowPath: `.claude/workflows/${currentValue}`,
    };
  }

  // Check if it's a short workflow filename
  if (currentValue.endsWith('.yaml')) {
    return {
      mode: EXECUTION_MODES.WORKFLOW,
      workflowPath: `.claude/workflows/${currentValue}`,
    };
  }

  // Default to workflow mode if unknown
  console.warn(`⚠️ Unknown execution mode format: "${currentValue}". Defaulting to 'workflow'.`);
  return {
    mode: EXECUTION_MODES.WORKFLOW,
    workflowPath: null,
  };
}

/**
 * Generate new format documentation section
 */
function generateNewFormat(mode, workflowPath) {
  let result = `**Execution Mode**: \`${mode}\`\n`;

  if (mode === EXECUTION_MODES.WORKFLOW && workflowPath) {
    result += `\n**Workflow Path**: \`${workflowPath}\`\n`;
  }

  return result;
}

/**
 * Migrate a single CUJ file
 */
function migrateCUJFile(filePath, dryRun = true) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(EXECUTION_MODE_PATTERN);

  if (!match) {
    return {
      file: path.basename(filePath),
      status: 'skipped',
      reason: 'No execution mode found',
    };
  }

  const currentValue = match[1];
  const { mode, workflowPath } = parseExecutionMode(currentValue);

  // Check if already in new format
  if (mode === currentValue && !workflowPath) {
    return {
      file: path.basename(filePath),
      status: 'skipped',
      reason: 'Already in new format',
    };
  }

  // Generate new format
  const newFormat = generateNewFormat(mode, workflowPath);
  const oldFormat = match[0];

  // Replace old format with new format
  const newContent = content.replace(oldFormat, newFormat.trim());

  // Apply changes if not dry run
  if (!dryRun) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return {
    file: path.basename(filePath),
    status: dryRun ? 'would-migrate' : 'migrated',
    oldValue: currentValue,
    newMode: mode,
    newWorkflowPath: workflowPath,
    changes: {
      old: oldFormat,
      new: newFormat.trim(),
    },
  };
}

/**
 * Migrate all CUJ files
 */
function migrateAllCUJs(dryRun = true) {
  const cujFiles = fs
    .readdirSync(CUJ_DIR)
    .filter(
      f =>
        f.startsWith('CUJ-') &&
        f.endsWith('.md') &&
        f !== 'CUJ-INDEX.md' &&
        f !== 'CUJ-E2E-VALIDATION-SUMMARY.md'
    )
    .map(f => path.join(CUJ_DIR, f));

  const results = cujFiles.map(filePath => migrateCUJFile(filePath, dryRun));

  return results;
}

/**
 * Print migration summary
 */
function printSummary(results, dryRun) {
  console.log('\n' + '='.repeat(80));
  console.log(dryRun ? 'DRY RUN - No files modified' : 'MIGRATION COMPLETE');
  console.log('='.repeat(80) + '\n');

  const migrated = results.filter(r => r.status === 'migrated' || r.status === 'would-migrate');
  const skipped = results.filter(r => r.status === 'skipped');

  console.log(`📊 Summary:`);
  console.log(`   Total files: ${results.length}`);
  console.log(`   ${dryRun ? 'Would migrate' : 'Migrated'}: ${migrated.length}`);
  console.log(`   Skipped: ${skipped.length}\n`);

  if (migrated.length > 0) {
    console.log(`✅ ${dryRun ? 'Would migrate' : 'Migrated'} files:\n`);
    migrated.forEach(result => {
      console.log(`   ${result.file}:`);
      console.log(`      Old: ${result.oldValue}`);
      console.log(
        `      New: execution_mode="${result.newMode}"${result.newWorkflowPath ? `, workflow_path="${result.newWorkflowPath}"` : ''}`
      );
    });
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped files:\n`);
    skipped.forEach(result => {
      console.log(`   ${result.file}: ${result.reason}`);
    });
  }

  if (dryRun) {
    console.log(`\n💡 To apply changes, run:`);
    console.log(`   node .claude/tools/migrate-cuj-execution-mode.mjs --apply\n`);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (dryRun && !args.includes('--dry-run')) {
    console.log('⚠️  No --apply flag provided. Running in dry-run mode.\n');
  }

  try {
    const results = migrateAllCUJs(dryRun);
    printSummary(results, dryRun);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
