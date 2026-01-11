#!/usr/bin/env node
/**
 * CUJ Mapping Validation Script
 *
 * Validates the CUJ-INDEX.md mapping table format and references
 *
 * Checks:
 * - Table format in 'Run CUJ Mapping' section
 * - CUJ ID uniqueness
 * - Workflow path existence
 * - Skill name validity
 *
 * Usage:
 *   node validate-cuj-mapping.mjs
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const cujIndexPath = join(__dirname, '..', 'docs', 'cujs', 'CUJ-INDEX.md');
const workflowsDir = join(__dirname, '..', 'workflows');
const skillsDir = join(__dirname, '..', 'skills');

// Valid execution modes
const VALID_EXECUTION_MODES = ['workflow', 'skill', 'manual', 'skill-only', 'manual-setup'];

/**
 * Extract Run CUJ Mapping tables from CUJ-INDEX.md
 */
function extractCUJMappingTables(content) {
  const tables = [];
  const tableRegex = /## Run CUJ Mapping\s+([\s\S]*?)(?=\n##|$)/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push(match[1]);
  }

  return tables;
}

/**
 * Parse CUJ mapping table rows
 */
function parseTableRows(tableContent) {
  const rows = tableContent.split('\n').filter(line => line.trim().startsWith('|'));

  // Skip header and separator rows
  const dataRows = rows.slice(2);

  const entries = [];
  const errors = [];
  const warnings = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const cells = row
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell);

    // Validate column count
    if (cells.length < 4) {
      warnings.push({
        row: i + 3, // Account for header rows
        message: `Expected 4+ columns, got ${cells.length}`,
        raw: row,
      });
      continue;
    }

    // Validate required fields
    const cujId = cells[0];
    const executionMode = cells[1];
    const workflowPath = cells[2] && cells[2] !== '-' && cells[2] !== 'null' ? cells[2] : null;
    const primarySkill = cells[3] && cells[3] !== '-' && cells[3] !== 'null' ? cells[3] : null;

    if (!cujId) {
      errors.push({
        row: i + 3,
        message: 'Missing CUJ ID',
        raw: row,
      });
      continue;
    }

    if (!executionMode) {
      errors.push({
        row: i + 3,
        message: `Missing execution mode for ${cujId}`,
        raw: row,
      });
      continue;
    }

    // Validate execution mode
    if (!VALID_EXECUTION_MODES.includes(executionMode)) {
      errors.push({
        row: i + 3,
        message: `Invalid execution mode '${executionMode}' for ${cujId}. Expected one of: ${VALID_EXECUTION_MODES.join(', ')}`,
        raw: row,
      });
    }

    entries.push({
      cujId,
      executionMode,
      workflowPath,
      primarySkill,
      row: i + 3,
    });
  }

  return { entries, errors, warnings };
}

/**
 * Check for duplicate CUJ IDs
 */
function checkDuplicateCUJs(entries) {
  const duplicates = [];
  const seen = new Map();

  for (const entry of entries) {
    if (seen.has(entry.cujId)) {
      duplicates.push({
        cujId: entry.cujId,
        rows: [seen.get(entry.cujId), entry.row],
      });
    } else {
      seen.set(entry.cujId, entry.row);
    }
  }

  return duplicates;
}

/**
 * Validate workflow paths exist
 */
function validateWorkflowPaths(entries) {
  const errors = [];

  for (const entry of entries) {
    if (entry.workflowPath) {
      // Resolve relative to project root
      const fullPath = resolve(projectRoot, entry.workflowPath);

      if (!existsSync(fullPath)) {
        errors.push({
          cujId: entry.cujId,
          row: entry.row,
          workflowPath: entry.workflowPath,
          resolvedPath: fullPath,
          message: `Workflow file not found: ${entry.workflowPath}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate skill names exist
 */
function validateSkillNames(entries) {
  const errors = [];

  // Get list of valid skills
  let validSkills = [];
  try {
    if (existsSync(skillsDir)) {
      validSkills = readdirSync(skillsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read skills directory: ${error.message}`);
  }

  for (const entry of entries) {
    if (entry.primarySkill) {
      if (!validSkills.includes(entry.primarySkill)) {
        errors.push({
          cujId: entry.cujId,
          row: entry.row,
          primarySkill: entry.primarySkill,
          message: `Skill not found: ${entry.primarySkill}`,
          availableSkills: validSkills,
        });
      }
    }
  }

  return errors;
}

/**
 * Main validation function
 */
async function validateCUJMapping() {
  console.log('🔍 Validating CUJ Mapping Table...\n');

  let hasErrors = false;

  // Step 1: Check CUJ-INDEX.md exists
  if (!existsSync(cujIndexPath)) {
    console.error(`❌ Error: CUJ-INDEX.md not found at ${cujIndexPath}`);
    return false;
  }

  console.log(`✅ CUJ-INDEX.md found at ${cujIndexPath}`);

  // Step 2: Read CUJ-INDEX.md
  let content;
  try {
    content = readFileSync(cujIndexPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error: Failed to read CUJ-INDEX.md: ${error.message}`);
    return false;
  }

  // Step 3: Extract mapping tables
  const tables = extractCUJMappingTables(content);

  if (tables.length === 0) {
    console.error(`❌ Error: No 'Run CUJ Mapping' tables found in CUJ-INDEX.md`);
    return false;
  }

  console.log(`✅ Found ${tables.length} Run CUJ Mapping table(s)\n`);

  // Step 4: Parse and validate each table
  const allEntries = [];
  const allErrors = [];
  const allWarnings = [];

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    console.log(`📋 Validating table ${tableIndex + 1} of ${tables.length}...`);

    const { entries, errors, warnings } = parseTableRows(tables[tableIndex]);

    allEntries.push(...entries);
    allErrors.push(...errors);
    allWarnings.push(...warnings);

    if (errors.length > 0) {
      console.error(`\n❌ Table ${tableIndex + 1} has ${errors.length} error(s):`);
      errors.forEach(err => {
        console.error(`   Row ${err.row}: ${err.message}`);
        console.error(`     ${err.raw}`);
      });
      hasErrors = true;
    }

    if (warnings.length > 0) {
      console.warn(`\n⚠️  Table ${tableIndex + 1} has ${warnings.length} warning(s):`);
      warnings.forEach(warn => {
        console.warn(`   Row ${warn.row}: ${warn.message}`);
        console.warn(`     ${warn.raw}`);
      });
    }

    console.log(`   Parsed ${entries.length} CUJ entries from table ${tableIndex + 1}`);
  }

  console.log(`\n📊 Total CUJ entries: ${allEntries.length}\n`);

  // Step 5: Check for duplicate CUJ IDs
  console.log('🔍 Checking for duplicate CUJ IDs...');
  const duplicates = checkDuplicateCUJs(allEntries);

  if (duplicates.length > 0) {
    console.error(`\n❌ Found ${duplicates.length} duplicate CUJ ID(s):`);
    duplicates.forEach(dup => {
      console.error(`   ${dup.cujId} appears on rows: ${dup.rows.join(', ')}`);
    });
    hasErrors = true;
  } else {
    console.log('✅ All CUJ IDs are unique');
  }

  // Step 6: Validate workflow paths
  console.log('\n🔍 Validating workflow paths...');
  const workflowErrors = validateWorkflowPaths(allEntries);

  if (workflowErrors.length > 0) {
    console.error(`\n❌ Found ${workflowErrors.length} workflow path error(s):`);
    workflowErrors.forEach(err => {
      console.error(`   ${err.cujId} (row ${err.row}): ${err.message}`);
      console.error(`     Expected at: ${err.resolvedPath}`);
    });
    hasErrors = true;
  } else {
    const workflowCount = allEntries.filter(e => e.workflowPath).length;
    console.log(`✅ All ${workflowCount} workflow paths are valid`);
  }

  // Step 7: Validate skill names
  console.log('\n🔍 Validating skill names...');
  const skillErrors = validateSkillNames(allEntries);

  if (skillErrors.length > 0) {
    console.error(`\n❌ Found ${skillErrors.length} skill name error(s):`);
    skillErrors.forEach(err => {
      console.error(`   ${err.cujId} (row ${err.row}): ${err.message}`);
      if (err.availableSkills && err.availableSkills.length > 0) {
        console.error(
          `     Available skills: ${err.availableSkills.slice(0, 10).join(', ')}${err.availableSkills.length > 10 ? '...' : ''}`
        );
      }
    });
    hasErrors = true;
  } else {
    const skillCount = allEntries.filter(e => e.primarySkill).length;
    console.log(`✅ All ${skillCount} skill names are valid`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.error('❌ VALIDATION FAILED');
    console.error(
      `   Total errors: ${allErrors.length + duplicates.length + workflowErrors.length + skillErrors.length}`
    );
    console.error(`   Total warnings: ${allWarnings.length}`);
    return false;
  } else {
    console.log('✅ VALIDATION PASSED');
    console.log(`   Total CUJ entries: ${allEntries.length}`);
    console.log(`   Total warnings: ${allWarnings.length}`);
    return true;
  }
}

// Run validation
validateCUJMapping()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
