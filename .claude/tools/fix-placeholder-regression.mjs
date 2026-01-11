#!/usr/bin/env node

/**
 * CUJ Template Placeholder Migration Script
 *
 * Fixes regression where 39 CUJs still use {{workflow_id}} format
 * instead of standardized <run_id> format in Success Criteria sections.
 *
 * Usage: node .claude/tools/fix-placeholder-regression.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// Replacement patterns
const replacements = [
  // Basic placeholder format changes
  { from: /\{\{workflow_id\}\}/g, to: '<run_id>' },
  { from: /\{\{run_id\}\}/g, to: '<run_id>' },
  { from: /\{\{plan_id\}\}/g, to: '<plan_id>' },

  // Specific artifact path patterns (most common)
  {
    from: /`plan-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.json`',
  },
  {
    from: /`plan-\{\{workflow_id\}\}\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.md`',
  },
  {
    from: /`gates\/\{\{workflow_id\}\}\//g,
    to: '`.claude/context/runs/<run_id>/gates/',
  },
  {
    from: /`gates\/00-planner\.json`/g,
    to: '`.claude/context/runs/<run_id>/gates/00-planner.json`',
  },

  // Project brief patterns
  {
    from: /`project-brief-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/project-brief.json`',
  },

  // PRD patterns
  {
    from: /`prd-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/prd.json`',
  },

  // UI spec patterns
  {
    from: /`ui-spec-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/ui-spec.json`',
  },

  // Architecture patterns
  {
    from: /`architecture-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/architecture.json`',
  },

  // Database schema patterns
  {
    from: /`db-schema-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/db-schema.json`',
  },

  // Test plan patterns
  {
    from: /`test-plan-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/test-plan.json`',
  },

  // Dev manifest patterns
  {
    from: /`dev-manifest-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/dev-manifest.json`',
  },

  // Documentation patterns
  {
    from: /`docs-\{\{workflow_id\}\}\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/docs.md`',
  },

  // API documentation patterns
  {
    from: /`api-docs-\{\{workflow_id\}\}\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/api-docs.md`',
  },

  // OpenAPI patterns
  {
    from: /`openapi-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/openapi.json`',
  },

  // Validation schema patterns
  {
    from: /`validation-schema-\{\{workflow_id\}\}\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/validation-schema.json`',
  },

  // Generic gates patterns
  {
    from: /`gates\/02-pm\.json`/g,
    to: '`.claude/context/runs/<run_id>/gates/02-pm.json`',
  },
  {
    from: /validated by gate file/g,
    to: 'validated by `.claude/context/runs/<run_id>/gates/<step>-<agent>.json`',
  },
  {
    from: /All gate files in `gates\/` show/g,
    to: 'All gate files in `.claude/context/runs/<run_id>/gates/` show',
  },

  // Second pass: Fix artifact names that still have -<run_id> suffix
  // These patterns handle artifacts that were already partially converted
  {
    from: /`plan-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.json`',
  },
  {
    from: /`plan-<run_id>\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.md`',
  },
  {
    from: /`project-brief-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/project-brief.json`',
  },
  {
    from: /`prd-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/prd.json`',
  },
  {
    from: /`ui-spec-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/ui-spec.json`',
  },
  {
    from: /`architecture-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/architecture.json`',
  },
  {
    from: /`db-schema-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/db-schema.json`',
  },
  {
    from: /`test-plan-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/test-plan.json`',
  },
  {
    from: /`dev-manifest-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/dev-manifest.json`',
  },
  {
    from: /`docs-<run_id>\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/docs.md`',
  },
  {
    from: /`api-docs-<run_id>\.md`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/api-docs.md`',
  },
  {
    from: /`openapi-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/openapi.json`',
  },
  {
    from: /`validation-schema-<run_id>\.json`/g,
    to: '`.claude/context/runs/<run_id>/artifacts/validation-schema.json`',
  },
];

/**
 * Process a single CUJ file
 * @param {string} filePath - Path to CUJ file
 * @param {boolean} dryRun - If true, don't write changes
 * @returns {Object} - Change statistics
 */
function processCujFile(filePath, dryRun = false) {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let changeCount = 0;
  const changes = [];

  // Apply all replacements
  for (const { from, to } of replacements) {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      changeCount += matches.length;
      changes.push({
        pattern: from.toString(),
        count: matches.length,
        replacement: to,
      });
    }
  }

  // Write changes if not dry run
  if (!dryRun && changeCount > 0) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return {
    file: filePath,
    changeCount,
    changes,
    modified: changeCount > 0,
  };
}

/**
 * Main migration function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🔧 CUJ Template Placeholder Migration');
  console.log('=====================================\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  // Find all CUJ files
  const cujDir = join(projectRoot, '.claude/docs/cujs');
  const allFiles = readdirSync(cujDir);
  const cujFiles = allFiles
    .filter(f => f.startsWith('CUJ-') && f.endsWith('.md'))
    .map(f => join(cujDir, f));

  console.log(`📂 Found ${cujFiles.length} CUJ files\n`);

  // Process each file
  const results = [];
  let totalChanges = 0;
  let filesModified = 0;

  for (const file of cujFiles) {
    const result = processCujFile(file, dryRun);
    results.push(result);

    if (result.modified) {
      filesModified++;
      totalChanges += result.changeCount;

      const fileName = file.split(/[/\\]/).pop();
      console.log(`✅ ${fileName}: ${result.changeCount} replacements`);

      if (dryRun && result.changes.length > 0) {
        result.changes.forEach(change => {
          console.log(`   - ${change.count}× ${change.pattern}`);
        });
      }
    }
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Total CUJ files: ${cujFiles.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalChanges}`);

  if (dryRun) {
    console.log('\n⚠️  This was a dry run. Re-run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }

  // Validation check
  console.log('\n🔍 Running validation...');
  const validationResults = validateCujFiles(cujFiles);

  if (validationResults.violations > 0) {
    console.error(`\n❌ Found ${validationResults.violations} remaining placeholder violations!`);
    console.error('Files with violations:');
    validationResults.files.forEach(file => {
      console.error(`  - ${file.name}: ${file.violations} violations`);
    });
    process.exit(1);
  } else {
    console.log('✅ No placeholder violations found!');
  }

  return {
    filesModified,
    totalChanges,
    results,
  };
}

/**
 * Validate CUJ files for remaining placeholder violations
 * @param {string[]} cujFiles - Array of CUJ file paths
 * @returns {Object} - Validation results
 */
function validateCujFiles(cujFiles) {
  const violations = [];
  let totalViolations = 0;

  for (const file of cujFiles) {
    const content = readFileSync(file, 'utf-8');
    const fileName = file.split(/[/\\]/).pop();

    // Check for old-style placeholders in Success Criteria
    const successCriteriaMatch = content.match(/## Success Criteria([\s\S]*?)(?=##|$)/);
    if (successCriteriaMatch) {
      const successCriteriaSection = successCriteriaMatch[1];

      // Count violations
      const workflowIdMatches = (successCriteriaSection.match(/\{\{workflow_id\}\}/g) || []).length;
      const runIdMatches = (successCriteriaSection.match(/\{\{run_id\}\}/g) || []).length;
      const planIdMatches = (successCriteriaSection.match(/\{\{plan_id\}\}/g) || []).length;

      const fileViolations = workflowIdMatches + runIdMatches + planIdMatches;

      if (fileViolations > 0) {
        violations.push({
          name: fileName,
          violations: fileViolations,
          details: {
            workflow_id: workflowIdMatches,
            run_id: runIdMatches,
            plan_id: planIdMatches,
          },
        });
        totalViolations += fileViolations;
      }
    }
  }

  return {
    violations: totalViolations,
    files: violations,
  };
}

// Run migration if executed directly
const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (isMainModule || process.argv[1]?.includes('fix-placeholder-regression')) {
  main();
}

export { processCujFile, validateCujFiles };
