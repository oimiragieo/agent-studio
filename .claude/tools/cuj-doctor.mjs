#!/usr/bin/env node
/**
 * CUJ Doctor - Comprehensive health check for CUJ system
 * Reports all issues in a single unified view
 *
 * Usage: node .claude/tools/cuj-doctor.mjs [--json]
 *
 * Exit codes:
 * 0 - All checks passed
 * 1 - Critical issues found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const CUJS_DIR = path.join(ROOT_DIR, '.claude/docs/cujs');
const REGISTRY_PATH = path.join(ROOT_DIR, '.claude/context/cuj-registry.json');
const INDEX_PATH = path.join(ROOT_DIR, '.claude/docs/cujs/CUJ-INDEX.md');
const WORKFLOWS_DIR = path.join(ROOT_DIR, '.claude/workflows');
const SKILLS_DIR = path.join(ROOT_DIR, '.claude/skills');

// Results tracking
const results = {
  critical: [],
  warnings: [],
  passed: [],
  stats: {}
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Check for CUJ count drift between docs, index, and registry
 */
function checkCujCountDrift() {
  console.log('\n📊 Checking CUJ count consistency...');

  try {
    // Count CUJ files
    const cujFiles = fs.readdirSync(CUJS_DIR)
      .filter(f => f.match(/^CUJ-\d{3}\.md$/));
    const docCount = cujFiles.length;

    // Count registry entries
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const registryCount = registry.cujs.length;

    // Count index entries
    const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
    // Match both [CUJ-001] and [CUJ-001: ...] formats
    const indexMatches = indexContent.match(/\[CUJ-\d{3}(?::|])/g) || [];
    const indexCount = new Set(indexMatches.map(m => m.match(/CUJ-\d{3}/)[0])).size;

    results.stats.docCount = docCount;
    results.stats.registryCount = registryCount;
    results.stats.indexCount = indexCount;

    if (docCount === registryCount && docCount === indexCount) {
      results.passed.push(`CUJ counts aligned: ${docCount} docs, ${registryCount} registry, ${indexCount} index`);
    } else {
      const drift = [];
      if (docCount !== registryCount) drift.push(`Docs (${docCount}) ≠ Registry (${registryCount})`);
      if (docCount !== indexCount) drift.push(`Docs (${docCount}) ≠ Index (${indexCount})`);
      if (registryCount !== indexCount) drift.push(`Registry (${registryCount}) ≠ Index (${indexCount})`);

      results.critical.push(`CUJ count drift detected: ${drift.join(', ')}`);
    }

    // Check for orphaned docs (in docs but not in registry)
    const registryIds = new Set(registry.cujs.map(c => c.id));
    const orphanedDocs = cujFiles.filter(f => {
      const id = f.replace('.md', '');
      return !registryIds.has(id);
    });

    if (orphanedDocs.length > 0) {
      results.critical.push(`Orphaned CUJ docs (not in registry): ${orphanedDocs.join(', ')}`);
    }

    // Check for missing docs (in registry but not in docs)
    const docIds = new Set(cujFiles.map(f => f.replace('.md', '')));
    const missingDocs = registry.cujs.filter(c => !docIds.has(c.id));

    if (missingDocs.length > 0) {
      const missingIds = missingDocs.map(c => c.id).join(', ');
      results.critical.push(`Missing CUJ docs (in registry but no file): ${missingIds}`);
    }

  } catch (error) {
    results.critical.push(`Failed to check CUJ count drift: ${error.message}`);
  }
}

/**
 * Check for missing workflows referenced in CUJs
 */
function checkMissingWorkflows() {
  console.log('\n🔄 Checking workflow references...');

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => f.replace(/\.(yaml|yml)$/, ''));

    const missingWorkflows = new Map(); // workflow -> [CUJ IDs]

    for (const cuj of registry.cujs) {
      // Support both singular (workflow) and plural (workflows) for backwards compatibility
      const workflowList = cuj.workflow ? [cuj.workflow] : (cuj.workflows || []);

      if (Array.isArray(workflowList)) {
        for (const workflow of workflowList) {
          // Normalize workflow path: strip `.claude/workflows/` prefix if present
          const normalizedWorkflow = workflow.replace(/^\.claude\/workflows\//, '');
          const workflowName = normalizedWorkflow.replace(/\.(yaml|yml)$/, '');

          if (!workflowFiles.includes(workflowName)) {
            if (!missingWorkflows.has(workflow)) {
              missingWorkflows.set(workflow, []);
            }
            missingWorkflows.get(workflow).push(cuj.id);
          }
        }
      }
    }

    if (missingWorkflows.size === 0) {
      results.passed.push(`All workflow references valid`);
    } else {
      for (const [workflow, cujIds] of missingWorkflows.entries()) {
        results.critical.push(`Missing workflow "${workflow}" referenced by: ${cujIds.join(', ')}`);
      }
    }

  } catch (error) {
    results.critical.push(`Failed to check workflow references: ${error.message}`);
  }
}

/**
 * Check for missing skills referenced in CUJs
 */
function checkMissingSkills() {
  console.log('\n🛠️ Checking skill references...');

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const missingSkills = new Map(); // skill -> [CUJ IDs]

    for (const cuj of registry.cujs) {
      // Support both singular (skills) and plural (required_skills) for backwards compatibility
      const skillList = cuj.skills || cuj.required_skills || [];

      if (Array.isArray(skillList)) {
        for (const skill of skillList) {
          // Normalize skill to string name
          // Skills can be either strings or objects with a 'name' property
          let skillName;

          if (typeof skill === 'string') {
            skillName = skill;
          } else if (typeof skill === 'object' && skill !== null) {
            // Object-based skill entry: { name, type, location } or similar
            skillName = skill.name || String(skill);
          } else {
            // Unexpected type - convert to string as fallback
            skillName = String(skill);
          }

          // Validate the normalized skill name
          if (skillName && !skillDirs.includes(skillName)) {
            if (!missingSkills.has(skillName)) {
              missingSkills.set(skillName, []);
            }
            missingSkills.get(skillName).push(cuj.id);
          }
        }
      }
    }

    if (missingSkills.size === 0) {
      results.passed.push(`All skill references valid`);
    } else {
      for (const [skill, cujIds] of missingSkills.entries()) {
        results.warnings.push(`Missing skill "${skill}" referenced by: ${cujIds.join(', ')}`);
      }
    }

  } catch (error) {
    results.critical.push(`Failed to check skill references: ${error.message}`);
  }
}

/**
 * Check for broken links in CUJ documentation
 */
function checkBrokenLinks() {
  console.log('\n🔗 Checking for broken links...');

  try {
    const cujFiles = fs.readdirSync(CUJS_DIR)
      .filter(f => f.match(/^CUJ-\d{3}\.md$/));

    let totalLinks = 0;
    let brokenLinks = 0;
    const linkIssues = [];

    for (const file of cujFiles) {
      const content = fs.readFileSync(path.join(CUJS_DIR, file), 'utf-8');
      const cujId = file.replace('.md', '');

      // Check markdown links: [text](path)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;

      while ((match = linkRegex.exec(content)) !== null) {
        totalLinks++;
        const linkPath = match[2];

        // Skip external URLs
        if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
          continue;
        }

        // Skip anchors
        if (linkPath.startsWith('#')) {
          continue;
        }

        // Resolve relative path
        let resolvedPath = linkPath;
        if (linkPath.startsWith('.')) {
          resolvedPath = path.resolve(CUJS_DIR, linkPath);
        } else if (linkPath.startsWith('/')) {
          resolvedPath = path.join(ROOT_DIR, linkPath.substring(1));
        } else {
          resolvedPath = path.join(CUJS_DIR, linkPath);
        }

        // Remove anchor from path
        resolvedPath = resolvedPath.split('#')[0];

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
          brokenLinks++;
          linkIssues.push(`${cujId}: Broken link to "${linkPath}"`);
        }
      }

      // Check @-references: @.claude/path/to/file.md
      const atRefRegex = /@(\.claude\/[^\s]+)/g;
      while ((match = atRefRegex.exec(content)) !== null) {
        totalLinks++;
        const refPath = match[1];
        const resolvedPath = path.join(ROOT_DIR, refPath);

        if (!fs.existsSync(resolvedPath)) {
          brokenLinks++;
          linkIssues.push(`${cujId}: Broken @-reference to "${refPath}"`);
        }
      }
    }

    results.stats.totalLinks = totalLinks;
    results.stats.brokenLinks = brokenLinks;

    if (brokenLinks === 0) {
      results.passed.push(`All ${totalLinks} links valid`);
    } else {
      linkIssues.forEach(issue => results.warnings.push(issue));
    }

  } catch (error) {
    results.critical.push(`Failed to check broken links: ${error.message}`);
  }
}

/**
 * Check platform compatibility matrix consistency
 */
function checkPlatformCompatibility() {
  console.log('\n🖥️ Checking platform compatibility...');

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const validPlatforms = ['claude-code', 'cursor', 'factory-droid'];
    const platformIssues = [];

    for (const cuj of registry.cujs) {
      // Use platform_compatibility (new schema) instead of platforms (old schema)
      if (!cuj.platform_compatibility || typeof cuj.platform_compatibility !== 'object') {
        platformIssues.push(`${cuj.id}: Missing platform_compatibility object`);
        continue;
      }

      // Check for required platform keys
      const requiredKeys = ['claude', 'cursor', 'factory'];
      for (const key of requiredKeys) {
        if (!(key in cuj.platform_compatibility)) {
          platformIssues.push(`${cuj.id}: Missing platform_compatibility.${key}`);
        }
      }

      // Check for non-boolean values
      for (const [platform, supported] of Object.entries(cuj.platform_compatibility)) {
        if (typeof supported !== 'boolean') {
          platformIssues.push(`${cuj.id}: platform_compatibility.${platform} should be boolean (got ${typeof supported})`);
        }
      }
    }

    if (platformIssues.length === 0) {
      results.passed.push(`Platform compatibility matrix consistent`);
    } else {
      platformIssues.forEach(issue => results.warnings.push(issue));
    }

  } catch (error) {
    results.critical.push(`Failed to check platform compatibility: ${error.message}`);
  }
}

/**
 * Check for non-measurable success criteria
 */
function checkSuccessCriteria() {
  console.log('\n📏 Checking success criteria measurability...');

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));

    // Keywords that indicate measurability
    const measurableKeywords = [
      'time', 'seconds', 'minutes', 'hours',
      'count', 'number', 'total', 'size',
      'percentage', '%', 'ratio',
      'score', 'rating',
      'exists', 'contains', 'includes',
      'passes', 'fails',
      'equal', 'greater', 'less', 'than',
      'valid', 'invalid',
      'status code', 'response',
      'deployed', 'running',
      'coverage'
    ];

    const nonMeasurableIssues = [];
    let totalCriteria = 0;
    let measurableCriteria = 0;

    for (const cuj of registry.cujs) {
      // Use expected_outputs (new schema) instead of success_criteria (old schema)
      if (!cuj.expected_outputs || !Array.isArray(cuj.expected_outputs)) {
        nonMeasurableIssues.push(`${cuj.id}: Missing expected_outputs array`);
        continue;
      }

      for (const output of cuj.expected_outputs) {
        totalCriteria++;
        const lowerOutput = output.toLowerCase();

        const isMeasurable = measurableKeywords.some(keyword =>
          lowerOutput.includes(keyword)
        );

        if (isMeasurable) {
          measurableCriteria++;
        } else {
          nonMeasurableIssues.push(`${cuj.id}: Non-measurable output: "${output}"`);
        }
      }
    }

    results.stats.totalCriteria = totalCriteria;
    results.stats.measurableCriteria = measurableCriteria;
    results.stats.nonMeasurablePercent = totalCriteria > 0
      ? ((totalCriteria - measurableCriteria) / totalCriteria * 100).toFixed(1)
      : 0;

    if (nonMeasurableIssues.length === 0) {
      results.passed.push(`All ${totalCriteria} success criteria measurable`);
    } else {
      // Report top 10 non-measurable criteria
      const topIssues = nonMeasurableIssues.slice(0, 10);
      topIssues.forEach(issue => results.warnings.push(issue));

      if (nonMeasurableIssues.length > 10) {
        results.warnings.push(`... and ${nonMeasurableIssues.length - 10} more non-measurable criteria`);
      }
    }

  } catch (error) {
    results.critical.push(`Failed to check success criteria: ${error.message}`);
  }
}

/**
 * Check execution mode consistency
 */
function checkExecutionModes() {
  console.log('\n⚙️ Checking execution modes...');

  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    // Updated valid modes per actual schema
    const validModes = ['manual-setup', 'skill-only', 'workflow', 'delegated-skill'];
    const modeIssues = [];

    for (const cuj of registry.cujs) {
      if (!cuj.execution_mode) {
        modeIssues.push(`${cuj.id}: Missing execution_mode`);
        continue;
      }

      if (!validModes.includes(cuj.execution_mode)) {
        modeIssues.push(`${cuj.id}: Invalid execution_mode "${cuj.execution_mode}" (expected: ${validModes.join(', ')})`);
      }

      // For workflow mode, check if workflow field is populated
      if (cuj.execution_mode === 'workflow' && !cuj.workflow) {
        modeIssues.push(`${cuj.id}: Execution mode "workflow" but workflow field is null or missing`);
      }

      // For skill-only mode, check if skills are populated
      if ((cuj.execution_mode === 'skill-only' || cuj.execution_mode === 'delegated-skill')
          && (!cuj.skills || cuj.skills.length === 0)) {
        modeIssues.push(`${cuj.id}: Execution mode "${cuj.execution_mode}" but no skills defined`);
      }
    }

    if (modeIssues.length === 0) {
      results.passed.push(`Execution modes consistent`);
    } else {
      modeIssues.forEach(issue => results.warnings.push(issue));
    }

  } catch (error) {
    results.critical.push(`Failed to check execution modes: ${error.message}`);
  }
}

/**
 * Print formatted report
 */
function printReport(jsonOutput = false) {
  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bold}${colors.cyan}CUJ DOCTOR REPORT${colors.reset}`);
  console.log('='.repeat(70));

  // Statistics
  if (Object.keys(results.stats).length > 0) {
    console.log(`\n${colors.bold}${colors.cyan}📊 Statistics:${colors.reset}`);
    for (const [key, value] of Object.entries(results.stats)) {
      console.log(`  ${key}: ${value}`);
    }
  }

  // Critical issues
  if (results.critical.length > 0) {
    console.log(`\n${colors.bold}${colors.red}❌ Critical Issues (${results.critical.length}):${colors.reset}`);
    results.critical.forEach(issue => {
      console.log(`  ${colors.red}• ${issue}${colors.reset}`);
    });
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`\n${colors.bold}${colors.yellow}⚠️  Warnings (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(warning => {
      console.log(`  ${colors.yellow}• ${warning}${colors.reset}`);
    });
  }

  // Passed checks
  if (results.passed.length > 0) {
    console.log(`\n${colors.bold}${colors.green}✅ Passed Checks (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(check => {
      console.log(`  ${colors.green}• ${check}${colors.reset}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  const hasCritical = results.critical.length > 0;
  const statusColor = hasCritical ? colors.red : colors.green;
  const statusText = hasCritical ? 'FAILED' : 'PASSED';

  console.log(`${colors.bold}${statusColor}Status: ${statusText}${colors.reset}`);
  console.log(`Critical: ${results.critical.length} | Warnings: ${results.warnings.length} | Passed: ${results.passed.length}`);
  console.log('='.repeat(70) + '\n');
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  console.log(`${colors.bold}${colors.cyan}🏥 CUJ Doctor - Health Check${colors.reset}`);
  console.log(`Analyzing CUJ system...`);

  // Run all checks
  checkCujCountDrift();
  checkMissingWorkflows();
  checkMissingSkills();
  checkBrokenLinks();
  checkPlatformCompatibility();
  checkSuccessCriteria();
  checkExecutionModes();

  // Print report
  printReport(jsonOutput);

  // Exit with appropriate code
  const exitCode = results.critical.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run if executed directly
const isMain = process.argv[1] && (
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
);

if (isMain) {
  main();
}

export { checkCujCountDrift, checkMissingWorkflows, checkMissingSkills, checkBrokenLinks, checkPlatformCompatibility, checkSuccessCriteria, checkExecutionModes };
