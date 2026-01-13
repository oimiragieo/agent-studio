#!/usr/bin/env node

/**
 * CUJ Execution Mode Migration Script
 *
 * Normalizes execution modes for 16 CUJs to canonical formats:
 * - workflow + workflow_file
 * - plan-mode
 * - subagent-only
 *
 * Run: node scripts/migrate-cuj-execution-modes.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration mapping: 15 CUJs to normalize (CUJ-030 excluded - already skill-only mode)
const migrations = [
  {
    cuj: 'CUJ-005',
    oldMode: 'greenfield-fullstack.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/greenfield-fullstack.yaml',
  },
  {
    cuj: 'CUJ-010',
    oldMode: 'brownfield-fullstack.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/brownfield-fullstack.yaml',
  },
  {
    cuj: 'CUJ-015',
    oldMode: 'code-quality.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/code-quality.yaml',
  },
  {
    cuj: 'CUJ-020',
    oldMode: 'greenfield-fullstack.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/greenfield-fullstack.yaml',
  },
  {
    cuj: 'CUJ-025',
    oldMode: 'ai-system.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/ai-system.yaml',
  },
  // CUJ-030 EXCLUDED: Already has skill-only mode (not a workflow)
  {
    cuj: 'CUJ-035',
    oldMode: 'performance.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/performance.yaml',
  },
  {
    cuj: 'CUJ-040',
    oldMode: 'incident-response.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/incident-response.yaml',
  },
  {
    cuj: 'CUJ-045',
    oldMode: 'code-quality.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/code-quality.yaml',
  },
  {
    cuj: 'CUJ-050',
    oldMode: 'brownfield-fullstack.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/brownfield-fullstack.yaml',
  },
  {
    cuj: 'CUJ-055',
    oldMode: 'legacy-modernization.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/legacy-modernization.yaml',
  },
  {
    cuj: 'CUJ-060',
    oldMode: 'ai-system.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/ai-system.yaml',
  },
  {
    cuj: 'CUJ-061',
    oldMode: 'security-and-compliance.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/security-and-compliance.yaml',
  },
  {
    cuj: 'CUJ-062',
    oldMode: 'multi-platform-deployment.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/multi-platform-deployment.yaml',
  },
  {
    cuj: 'CUJ-063',
    oldMode: 'recovery-test-flow.yaml', // CORRECTED: CUJ-063 uses recovery-test-flow, not greenfield
    newMode: 'workflow',
    workflowFile: '.claude/workflows/recovery-test-flow.yaml',
  },
  {
    cuj: 'CUJ-064',
    oldMode: 'greenfield-fullstack.yaml',
    newMode: 'workflow',
    workflowFile: '.claude/workflows/greenfield-fullstack.yaml',
  },
];

// Statistics
const stats = {
  total: migrations.length,
  success: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

/**
 * Migrate a single CUJ file
 * @param {Object} migration - Migration configuration
 * @returns {Promise<Object>} Migration result
 */
async function migrateCUJ(migration) {
  const { cuj, oldMode, newMode, workflowFile } = migration;
  const cujPath = path.join(__dirname, '..', '.claude', 'docs', 'cujs', `${cuj}.md`);

  try {
    // Read file content
    const content = await fs.readFile(cujPath, 'utf-8');

    // Check if already fully migrated (has both workflow mode AND workflow_file)
    if (
      content.includes('**Execution Mode**: workflow') &&
      content.includes('**Workflow File**:')
    ) {
      return {
        cuj,
        status: 'skipped',
        reason: 'Already fully migrated (has workflow mode + workflow_file)',
      };
    }

    let updatedContent = content;
    let migrationApplied = false;

    // Pattern 1: Old mode with backticks (e.g., `greenfield-fullstack.yaml`)
    const patternWithBackticks = `**Execution Mode**: \`${oldMode}\``;
    if (content.includes(patternWithBackticks)) {
      const newPattern = `**Execution Mode**: ${newMode}\n**Workflow File**: \`${workflowFile}\``;
      updatedContent = content.replace(patternWithBackticks, newPattern);
      migrationApplied = true;
    }

    // Pattern 2: Already has "workflow" mode but missing workflow_file
    const workflowModePattern = /\*\*Execution Mode\*\*:\s*workflow\s*$/gm;
    if (!migrationApplied && workflowModePattern.test(content)) {
      // Add workflow_file after execution mode line
      updatedContent = content.replace(
        workflowModePattern,
        `**Execution Mode**: workflow\n**Workflow File**: \`${workflowFile}\``
      );
      migrationApplied = true;
    }

    // Pattern 3: Already has "workflow" mode with backticks but missing workflow_file
    const workflowModeBackticksPattern = /\*\*Execution Mode\*\*:\s*`workflow`\s*$/gm;
    if (!migrationApplied && workflowModeBackticksPattern.test(content)) {
      updatedContent = content.replace(
        workflowModeBackticksPattern,
        `**Execution Mode**: workflow\n**Workflow File**: \`${workflowFile}\``
      );
      migrationApplied = true;
    }

    if (!migrationApplied) {
      return {
        cuj,
        status: 'failed',
        reason: `No matching pattern found. Expected: ${patternWithBackticks} or workflow mode`,
      };
    }

    // Write updated content
    await fs.writeFile(cujPath, updatedContent, 'utf-8');

    return {
      cuj,
      status: 'success',
      oldMode,
      newMode,
      workflowFile,
    };
  } catch (error) {
    return {
      cuj,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Generate summary report
 * @param {Array} results - Migration results
 * @returns {string} Summary report
 */
function generateSummary(results) {
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  let summary = '\n';
  summary += '='.repeat(60) + '\n';
  summary += 'CUJ EXECUTION MODE MIGRATION SUMMARY\n';
  summary += '='.repeat(60) + '\n\n';

  summary += `Total CUJs: ${results.length}\n`;
  summary += `✅ Successfully migrated: ${successful.length}\n`;
  summary += `⏭️  Skipped (already migrated): ${skipped.length}\n`;
  summary += `❌ Failed: ${failed.length}\n`;
  summary += `⚠️  Errors: ${errors.length}\n\n`;

  if (successful.length > 0) {
    summary += '✅ Successfully Migrated:\n';
    summary += '-'.repeat(60) + '\n';
    successful.forEach(r => {
      summary += `  ${r.cuj}: ${r.oldMode} → ${r.newMode}\n`;
      summary += `    Workflow: ${r.workflowFile}\n`;
    });
    summary += '\n';
  }

  if (skipped.length > 0) {
    summary += '⏭️  Skipped (Already Migrated):\n';
    summary += '-'.repeat(60) + '\n';
    skipped.forEach(r => {
      summary += `  ${r.cuj}: ${r.reason}\n`;
    });
    summary += '\n';
  }

  if (failed.length > 0) {
    summary += '❌ Failed Migrations:\n';
    summary += '-'.repeat(60) + '\n';
    failed.forEach(r => {
      summary += `  ${r.cuj}: ${r.reason}\n`;
    });
    summary += '\n';
  }

  if (errors.length > 0) {
    summary += '⚠️  Errors:\n';
    summary += '-'.repeat(60) + '\n';
    errors.forEach(r => {
      summary += `  ${r.cuj}: ${r.error}\n`;
    });
    summary += '\n';
  }

  summary += '='.repeat(60) + '\n';

  return summary;
}

/**
 * Main migration function
 */
async function main() {
  console.log('Starting CUJ Execution Mode Migration...\n');

  // Migrate all CUJs
  const results = [];
  for (const migration of migrations) {
    console.log(`Migrating ${migration.cuj}...`);
    const result = await migrateCUJ(migration);
    results.push(result);

    // Update stats
    if (result.status === 'success') stats.success++;
    else if (result.status === 'failed') stats.failed++;
    else if (result.status === 'skipped') stats.skipped++;
    else if (result.status === 'error') {
      stats.failed++;
      stats.errors.push({ cuj: result.cuj, error: result.error });
    }
  }

  // Generate and display summary
  const summary = generateSummary(results);
  console.log(summary);

  // Write summary to file
  const summaryPath = path.join(
    __dirname,
    '..',
    '.claude',
    'context',
    'reports',
    'cuj-execution-mode-migration-summary.md'
  );

  const timestamp = new Date().toISOString();
  const fullReport = `# CUJ Execution Mode Migration Report

**Generated**: ${timestamp}

${summary}

## Migration Details

${results
  .map(r => {
    let detail = `### ${r.cuj}\n\n`;
    detail += `- **Status**: ${r.status}\n`;
    if (r.status === 'success') {
      detail += `- **Old Mode**: \`${r.oldMode}\`\n`;
      detail += `- **New Mode**: \`${r.newMode}\`\n`;
      detail += `- **Workflow File**: \`${r.workflowFile}\`\n`;
    } else if (r.status === 'failed') {
      detail += `- **Reason**: ${r.reason}\n`;
    } else if (r.status === 'skipped') {
      detail += `- **Reason**: ${r.reason}\n`;
    } else if (r.status === 'error') {
      detail += `- **Error**: ${r.error}\n`;
    }
    return detail;
  })
  .join('\n')}

## Next Steps

1. Review migration results above
2. Verify changes in CUJ files
3. Run validation: \`node .claude/tools/cuj-registry.mjs validate-all\`
4. Update CUJ registry if needed
5. Commit changes

## Validation Command

\`\`\`bash
node .claude/tools/cuj-registry.mjs validate-all
\`\`\`
`;

  await fs.writeFile(summaryPath, fullReport, 'utf-8');
  console.log(`\nFull report saved to: ${summaryPath}\n`);

  // Exit with appropriate code
  if (stats.failed > 0 || stats.errors.length > 0) {
    console.error('❌ Migration completed with errors');
    process.exit(1);
  } else {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  }
}

// Run migration
main().catch(error => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});
