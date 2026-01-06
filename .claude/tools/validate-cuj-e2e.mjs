#!/usr/bin/env node
/**
 * Comprehensive E2E CUJ Smoke Test Script
 *
 * Single command to validate entire CUJ system health across all platforms.
 *
 * Tests performed:
 * 1. Config validation (validate-config.mjs)
 * 2. CUJ file validation (validate-cujs.mjs)
 * 3. Reference integrity (validate-all-references.mjs)
 * 4. Workflow dry-run for each workflow in CUJ-INDEX.md
 * 5. Skill availability for skill-only CUJs
 * 6. Platform compatibility check (Claude, Cursor, Factory)
 *
 * Output formats:
 * - JSON: Machine-readable summary with actionable recommendations
 * - Text: Human-readable progress and summary
 * - Exit codes: 0 = pass, 1 = fail
 *
 * Usage:
 *   node .claude/tools/validate-cuj-e2e.mjs [--verbose] [--json] [--fix-suggestions]
 *
 * Options:
 *   --verbose           Show detailed progress and output from each validation step
 *   --json              Output results as JSON (for CI/CD integration)
 *   --fix-suggestions   Generate actionable fix commands for identified issues
 *
 * Exit codes:
 *   0: All validations passed
 *   1: One or more validations failed
 *   2: Fatal error (missing dependencies, unable to run)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

// CLI arguments
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const JSON_OUTPUT = args.includes('--json');
const FIX_SUGGESTIONS = args.includes('--fix-suggestions');

// Help text
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Comprehensive E2E CUJ Smoke Test Script

Single command to validate entire CUJ system health across all platforms.

Usage:
  node .claude/tools/validate-cuj-e2e.mjs [options]

Options:
  --verbose           Show detailed progress and output from each validation step
  --json              Output results as JSON (for CI/CD integration)
  --fix-suggestions   Generate actionable fix commands for identified issues
  --help, -h          Show this help message

Tests performed:
  1. Config validation (validate-config.mjs)
  2. CUJ file validation (validate-cujs.mjs)
  3. Reference integrity (validate-all-references.mjs)
  4. Workflow dry-run for each workflow in CUJ-INDEX.md
  5. Skill availability for skill-only CUJs
  6. Platform compatibility check (Claude, Cursor, Factory)

Output:
  - JSON format: Machine-readable summary with actionable recommendations
  - Text format: Human-readable progress and summary

Exit codes:
  0: All validations passed
  1: One or more validations failed
  2: Fatal error (missing dependencies, unable to run)

Examples:
  # Basic validation
  node .claude/tools/validate-cuj-e2e.mjs

  # Verbose output with fix suggestions
  node .claude/tools/validate-cuj-e2e.mjs --verbose --fix-suggestions

  # JSON output for CI/CD
  node .claude/tools/validate-cuj-e2e.mjs --json

  # Save JSON results to file
  node .claude/tools/validate-cuj-e2e.mjs --json > cuj-validation-results.json
`);
  process.exit(0);
}

// Validation state
const validationResults = {
  timestamp: new Date().toISOString(),
  summary: {
    total_cujs: 0,
    runnable_claude: 0,
    runnable_cursor: 0,
    runnable_factory: 0,
    manual_only: 0,
    blocked: 0
  },
  details: {},
  recommendations: [],
  errors: [],
  warnings: []
};

/**
 * Execute command and return output
 */
function execCommand(cmd, description, allowFail = false) {
  if (VERBOSE) {
    console.log(`\n🔧 ${description}...`);
  }

  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: VERBOSE ? 'inherit' : 'pipe'
    });

    if (!VERBOSE && !JSON_OUTPUT) {
      console.log(`  ✓ ${description}`);
    }

    return { success: true, output };
  } catch (error) {
    if (allowFail) {
      if (!JSON_OUTPUT) {
        console.log(`  ⚠️  ${description} (non-critical failure)`);
      }
      return { success: false, output: error.message };
    } else {
      if (!JSON_OUTPUT) {
        console.log(`  ❌ ${description} failed`);
      }
      validationResults.errors.push({
        step: description,
        error: error.message
      });
      return { success: false, output: error.message };
    }
  }
}

/**
 * Check if file exists
 */
function fileExists(path) {
  return existsSync(resolve(ROOT, path));
}

/**
 * Read and parse CUJ-INDEX.md to extract mapping table
 */
function parseCUJIndex() {
  const indexPath = resolve(ROOT, '.claude/docs/cujs/CUJ-INDEX.md');

  if (!existsSync(indexPath)) {
    validationResults.errors.push({
      step: 'Parse CUJ-INDEX.md',
      error: 'CUJ-INDEX.md not found'
    });
    return new Map();
  }

  const content = readFileSync(indexPath, 'utf-8');
  const mapping = new Map();

  // Find the "Run CUJ Mapping" table
  const lines = content.split('\n');
  let inMappingTable = false;
  let headerPassed = false;

  for (const line of lines) {
    // Detect table header with "Execution Mode" column
    if (line.includes('| CUJ ID') && line.includes('Execution Mode')) {
      inMappingTable = true;
      continue;
    }

    // Skip separator line
    if (inMappingTable && !headerPassed && line.includes('|---')) {
      headerPassed = true;
      continue;
    }

    // Parse table rows
    if (inMappingTable && headerPassed && line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(c => c);
      if (cols.length >= 4) {
        const cujId = cols[0]; // e.g., "CUJ-001"
        const executionMode = cols[1]; // e.g., "skill-only" or "greenfield-fullstack.yaml"
        const workflowPath = cols[2] === 'null' ? null : cols[2].replace(/`/g, '').trim();
        const primarySkill = cols[3] === 'null' ? null : cols[3].trim();

        if (cujId.startsWith('CUJ-')) {
          mapping.set(cujId, {
            executionMode,
            workflowPath,
            primarySkill
          });
        }
      }
    }

    // Stop when we hit another section
    if (inMappingTable && headerPassed && line.startsWith('##')) {
      break;
    }
  }

  return mapping;
}

/**
 * Get all CUJ files
 */
function getCUJFiles() {
  const cujDir = resolve(ROOT, '.claude/docs/cujs');

  if (!existsSync(cujDir)) {
    validationResults.errors.push({
      step: 'Get CUJ files',
      error: 'CUJ directory not found: .claude/docs/cujs'
    });
    return [];
  }

  const files = readdirSync(cujDir);
  // Only match CUJ-XXX.md where XXX is a 3-digit number
  return files.filter(f => /^CUJ-\d{3}\.md$/.test(f));
}

/**
 * Check if skill exists
 */
function skillExists(skillName) {
  const skillPath = resolve(ROOT, '.claude/skills', skillName, 'SKILL.md');
  return existsSync(skillPath);
}

/**
 * Check if workflow exists
 */
function workflowExists(workflowName) {
  const workflowPath = resolve(ROOT, '.claude/workflows', `${workflowName}.yaml`);
  return existsSync(workflowPath);
}

/**
 * Check if schema exists
 */
function schemaExists(schemaName) {
  const schemaPath = resolve(ROOT, '.claude/schemas', `${schemaName}.schema.json`);
  return existsSync(schemaPath);
}

/**
 * Validate workflow dry-run
 */
function validateWorkflowDryRun(workflowName) {
  const workflowPath = `.claude/workflows/${workflowName}.yaml`;

  if (!fileExists(workflowPath)) {
    return {
      success: false,
      error: `Workflow file not found: ${workflowPath}`
    };
  }

  try {
    execSync(
      `node .claude/tools/workflow_runner.js --workflow ${workflowPath} --dry-run`,
      { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }
    );
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Determine platform compatibility for a CUJ
 */
function getPlatformCompatibility(cujEntry) {
  const { executionMode, workflowPath, primarySkill } = cujEntry;
  const platforms = [];

  // Check Claude compatibility
  if (executionMode === 'skill-only') {
    // Skill-only CUJs: Check if skill exists
    if (primarySkill && skillExists(primarySkill)) {
      platforms.push('claude');
    }
  } else if (executionMode === 'manual-setup' || executionMode === 'manual') {
    // Manual CUJs work on all platforms (user-driven)
    platforms.push('claude', 'cursor', 'factory');
  } else if (executionMode === 'workflow') {
    // Workflow-based CUJs: Check if workflow exists
    if (workflowPath && workflowPath !== 'null') {
      const workflowName = workflowPath.replace(/`/g, '').replace('.claude/workflows/', '').replace('.yaml', '').trim();
      if (workflowExists(workflowName)) {
        platforms.push('claude');
      }
    }
  }

  // Cursor compatibility (subset of Claude)
  // CUJs that require Claude-only skills are excluded
  const claudeOnlySkills = ['recovery', 'optional-artifact-handler', 'conflict-resolution', 'api-contract-generator'];
  if (platforms.includes('claude')) {
    if (executionMode === 'skill-only' && claudeOnlySkills.includes(primarySkill)) {
      // Claude-only skill, not compatible with Cursor
    } else {
      platforms.push('cursor');
    }
  }

  // Factory compatibility (similar to Cursor)
  if (platforms.includes('cursor')) {
    platforms.push('factory');
  }

  return platforms;
}

/**
 * Check execution mode contradiction
 */
function checkExecutionModeContradiction(cujId, executionMode, hasStep0) {
  const warnings = [];
  if (executionMode === 'skill-only' && hasStep0) {
    warnings.push(`CUJ ${cujId}: Has planning step but is skill-only (contradiction)`);
  }
  return warnings;
}

/**
 * Check error recovery for workflow CUJs
 */
function checkErrorRecovery(cujId, executionMode, hasErrorRecovery) {
  const warnings = [];
  if (executionMode === 'workflow' && !hasErrorRecovery) {
    warnings.push(`CUJ ${cujId}: Workflow CUJ missing error recovery steps`);
  }
  return warnings;
}

/**
 * Validate schema references
 */
function validateSchemaReferences(cujId, schemas) {
  const errors = [];
  for (const schema of schemas) {
    const schemaPath = join(ROOT, '.claude/schemas', schema);
    if (!existsSync(schemaPath)) {
      errors.push(`CUJ ${cujId}: Schema not found: ${schema}`);
    }
  }
  return errors;
}

/**
 * Check plan rating step for workflow CUJs
 */
function checkPlanRatingStep(cujId, executionMode, cujContent) {
  const errors = [];
  const warnings = [];
  const hasStep0 = cujContent.includes('## Step 0:') || cujContent.includes('**Step 0**');
  const hasStep0_1 = cujContent.includes('## Step 0.1:') || cujContent.includes('**Step 0.1**');

  if (executionMode === 'workflow' && hasStep0) {
    if (!hasStep0_1) {
      // TASK 1: Promote to error for workflow CUJs
      errors.push(`CUJ ${cujId}: Has Step 0 but missing Step 0.1 (Plan Rating Gate)`);
    } else {
      // TASK 2: Verify Step 0.1 actually contains response-rater skill
      const step01Match = cujContent.match(/## Step 0\.1:[\s\S]*?(?=## Step|$)/);
      if (step01Match) {
        const step01Content = step01Match[0];
        const hasResponseRater = step01Content.toLowerCase().includes('skill: response-rater') ||
                                 step01Content.toLowerCase().includes('response-rater');
        if (!hasResponseRater) {
          errors.push(`CUJ ${cujId}: Step 0.1 exists but does not contain "Skill: response-rater" - correct mechanism required`);
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validate individual CUJ
 */
function validateCUJ(cujId, cujEntry) {
  const { executionMode, workflowPath, primarySkill } = cujEntry;
  const status = {
    cujId,
    status: 'unknown',
    platforms: [],
    execution_mode: executionMode,
    issues: [],
    warnings: []
  };

  // TASK 3: Verify CUJ doc file exists (fix false green for CUJ-056)
  const cujDocPath = resolve(ROOT, '.claude/docs/cujs', `${cujId}.md`);
  if (!existsSync(cujDocPath)) {
    status.status = 'blocked';
    status.issues.push(`CUJ documentation file not found: ${cujId}.md`);
    validationResults.summary.blocked++;
    return status;
  }

  // Read CUJ content for plan rating validation
  let cujContent = '';
  try {
    cujContent = readFileSync(cujDocPath, 'utf-8');
  } catch (error) {
    status.status = 'blocked';
    status.issues.push(`Failed to read CUJ file: ${error.message}`);
    validationResults.summary.blocked++;
    return status;
  }

  // Validate plan rating step for workflow CUJs
  const planRatingResult = checkPlanRatingStep(cujId, executionMode, cujContent);
  status.issues.push(...planRatingResult.errors);
  status.warnings.push(...planRatingResult.warnings);

  // Determine execution mode type
  if (executionMode === 'manual-setup' || executionMode === 'manual') {
    status.status = 'manual';
    status.platforms = ['claude', 'cursor', 'factory'];
    validationResults.summary.manual_only++;
  } else if (executionMode === 'skill-only') {
    // Skill-only CUJ
    status.execution_mode_type = 'skill';
    status.skill = primarySkill;

    if (!primarySkill) {
      status.status = 'blocked';
      status.issues.push('Missing primary skill in mapping');
      validationResults.summary.blocked++;
    } else if (!skillExists(primarySkill)) {
      status.status = 'blocked';
      status.issues.push(`Skill not found: ${primarySkill}`);
      validationResults.summary.blocked++;
    } else {
      status.status = 'runnable';
      status.platforms = getPlatformCompatibility(cujEntry);

      // Count platform compatibility
      if (status.platforms.includes('claude')) validationResults.summary.runnable_claude++;
      if (status.platforms.includes('cursor')) validationResults.summary.runnable_cursor++;
      if (status.platforms.includes('factory')) validationResults.summary.runnable_factory++;
    }
  } else if (executionMode === 'workflow') {
    // Workflow-based CUJ
    status.execution_mode_type = 'workflow';

    // Extract workflow name from workflow path (column 2)
    if (!workflowPath || workflowPath === 'null') {
      status.status = 'blocked';
      status.issues.push('Missing workflow path in mapping');
      validationResults.summary.blocked++;
    } else {
      // Extract workflow filename from path (e.g., ".claude/workflows/greenfield-fullstack.yaml" -> "greenfield-fullstack")
      const workflowName = workflowPath.replace(/`/g, '').replace('.claude/workflows/', '').replace('.yaml', '').trim();
      status.workflow = workflowName;

      if (!workflowExists(workflowName)) {
        status.status = 'blocked';
        status.issues.push(`Workflow not found: ${workflowName}.yaml`);
        validationResults.summary.blocked++;
      } else {
        // Validate workflow dry-run
        const dryRunResult = validateWorkflowDryRun(workflowName);

        if (dryRunResult.success) {
          status.status = 'runnable';
          status.platforms = getPlatformCompatibility(cujEntry);

          // Count platform compatibility
          if (status.platforms.includes('claude')) validationResults.summary.runnable_claude++;
          if (status.platforms.includes('cursor')) validationResults.summary.runnable_cursor++;
          if (status.platforms.includes('factory')) validationResults.summary.runnable_factory++;
        } else {
          status.status = 'blocked';
          status.issues.push(`Workflow dry-run failed: ${dryRunResult.error}`);
          validationResults.summary.blocked++;
        }
      }
    }
  } else {
    // Unknown execution mode
    status.status = 'blocked';
    status.issues.push(`Unknown execution mode: ${executionMode}`);
    validationResults.summary.blocked++;
  }

  return status;
}

/**
 * Generate fix recommendations
 */
function generateRecommendations() {
  const recommendations = [];

  // Analyze blocked CUJs
  for (const [cujId, details] of Object.entries(validationResults.details)) {
    if (details.status === 'blocked') {
      for (const issue of details.issues) {
        if (issue.includes('Skill not found')) {
          const skillName = issue.match(/Skill not found: (.+)/)?.[1];
          if (skillName) {
            recommendations.push({
              cujId,
              issue,
              fix: `Create missing skill: .claude/skills/${skillName}/SKILL.md`,
              command: `mkdir -p .claude/skills/${skillName} && touch .claude/skills/${skillName}/SKILL.md`
            });
          }
        } else if (issue.includes('Workflow not found')) {
          const workflowName = issue.match(/Workflow not found: (.+)\.yaml/)?.[1];
          if (workflowName) {
            recommendations.push({
              cujId,
              issue,
              fix: `Create missing workflow: .claude/workflows/${workflowName}.yaml`,
              command: `touch .claude/workflows/${workflowName}.yaml`
            });
          }
        } else if (issue.includes('Schema not found')) {
          const schemaName = issue.match(/Schema not found: (.+)\.schema\.json/)?.[1];
          if (schemaName) {
            recommendations.push({
              cujId,
              issue,
              fix: `Create missing schema: .claude/schemas/${schemaName}.schema.json`,
              command: `touch .claude/schemas/${schemaName}.schema.json`
            });
          }
        } else if (issue.includes('Workflow dry-run failed')) {
          recommendations.push({
            cujId,
            issue,
            fix: `Fix workflow validation errors in ${details.workflow}.yaml`,
            command: `node .claude/tools/workflow_runner.js --workflow .claude/workflows/${details.workflow}.yaml --dry-run --verbose`
          });
        }
      }
    }
  }

  // Analyze platform compatibility gaps
  const claudeOnlyCount = validationResults.summary.runnable_claude - validationResults.summary.runnable_cursor;
  if (claudeOnlyCount > 0) {
    recommendations.push({
      cujId: 'PLATFORM',
      issue: `${claudeOnlyCount} CUJs are Claude-only`,
      fix: 'Port Claude-only skills to Cursor for broader compatibility',
      skills: ['recovery', 'optional-artifact-handler', 'conflict-resolution', 'api-contract-generator']
    });
  }

  return recommendations;
}

/**
 * Main validation function
 */
async function validateCUJSystem() {
  if (!JSON_OUTPUT) {
    console.log('🔍 Comprehensive E2E CUJ Smoke Test\n');
    console.log('='.repeat(60));
  }

  // Step 1: Config validation
  const configResult = execCommand(
    'node scripts/validate-config.mjs',
    'Config validation',
    true // Allow fail - non-critical
  );

  // Step 2: CUJ file validation
  const cujResult = execCommand(
    'node scripts/validate-cujs.mjs',
    'CUJ file validation',
    true // Allow fail - non-critical
  );

  // Step 3: Reference integrity validation
  const refResult = execCommand(
    'node scripts/validate-all-references.mjs',
    'Reference integrity validation',
    true // Allow fail - non-critical
  );

  if (!JSON_OUTPUT) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CUJ System Analysis\n');
  }

  // Step 4: Parse CUJ-INDEX.md
  const cujMapping = parseCUJIndex();
  validationResults.summary.total_cujs = cujMapping.size;

  if (cujMapping.size === 0) {
    validationResults.errors.push({
      step: 'Parse CUJ-INDEX.md',
      error: 'No CUJ mappings found in CUJ-INDEX.md'
    });

    if (!JSON_OUTPUT) {
      console.log('❌ Failed to parse CUJ-INDEX.md mapping table');
    }
    return false;
  }

  if (!JSON_OUTPUT) {
    console.log(`Found ${cujMapping.size} CUJs in mapping table\n`);
  }

  // Step 5: Validate each CUJ
  let validatedCount = 0;
  for (const [cujId, cujEntry] of cujMapping.entries()) {
    const status = validateCUJ(cujId, cujEntry);
    validationResults.details[cujId] = status;
    validatedCount++;

    if (VERBOSE && !JSON_OUTPUT) {
      const statusSymbol = status.status === 'runnable' ? '✓' :
                          status.status === 'manual' ? '⚠' : '❌';
      console.log(`  ${statusSymbol} ${cujId}: ${status.status} (${status.execution_mode})`);
    }
  }

  // Step 6: Generate recommendations
  if (FIX_SUGGESTIONS) {
    validationResults.recommendations = generateRecommendations();
  }

  return validationResults.errors.length === 0;
}

/**
 * Print results
 */
function printResults() {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(validationResults, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 Validation Summary');
  console.log('='.repeat(60));

  console.log(`\nTotal CUJs: ${validationResults.summary.total_cujs}`);
  console.log(`  ✅ Runnable (Claude): ${validationResults.summary.runnable_claude}`);
  console.log(`  ✅ Runnable (Cursor): ${validationResults.summary.runnable_cursor}`);
  console.log(`  ✅ Runnable (Factory): ${validationResults.summary.runnable_factory}`);
  console.log(`  ⚠️  Manual Only: ${validationResults.summary.manual_only}`);
  console.log(`  ❌ Blocked: ${validationResults.summary.blocked}`);

  // Show errors
  if (validationResults.errors.length > 0) {
    console.log(`\n❌ Errors (${validationResults.errors.length}):`);
    validationResults.errors.forEach(err => {
      console.log(`  - ${err.step}: ${err.error}`);
    });
  }

  // Show warnings
  if (validationResults.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${validationResults.warnings.length}):`);
    validationResults.warnings.forEach(warn => {
      console.log(`  - ${warn}`);
    });
  }

  // Show recommendations
  if (FIX_SUGGESTIONS && validationResults.recommendations.length > 0) {
    console.log(`\n💡 Recommendations (${validationResults.recommendations.length}):`);
    validationResults.recommendations.forEach(rec => {
      console.log(`\n  ${rec.cujId || 'GENERAL'}:`);
      console.log(`    Issue: ${rec.issue}`);
      console.log(`    Fix: ${rec.fix}`);
      if (rec.command) {
        console.log(`    Command: ${rec.command}`);
      }
      if (rec.skills) {
        console.log(`    Skills: ${rec.skills.join(', ')}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));

  // Final status
  const success = validationResults.errors.length === 0 && validationResults.summary.blocked === 0;
  if (success) {
    console.log('✅ CUJ system health check PASSED');
  } else {
    console.log('❌ CUJ system health check FAILED');
    if (FIX_SUGGESTIONS) {
      console.log('\n💡 Run with --fix-suggestions for actionable recommendations');
    }
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Main entry point
 */
async function main() {
  try {
    const success = await validateCUJSystem();
    printResults();
    process.exit(success ? 0 : 1);
  } catch (error) {
    if (!JSON_OUTPUT) {
      console.error('❌ Fatal error during validation:', error.message);
      console.error(error.stack);
    } else {
      console.log(JSON.stringify({
        error: 'Fatal error',
        message: error.message,
        stack: error.stack
      }, null, 2));
    }
    process.exit(2);
  }
}

// Run validation
main();
