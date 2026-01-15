#!/usr/bin/env node

/**
 * Workflow Path Validator
 *
 * Validates workflow paths across the LLM-RULES project to prevent:
 * - Double-prefix patterns (e.g., .claude/workflows/.claude/workflows/file.yaml)
 * - Missing workflow files referenced in CUJ registry and documentation
 * - Path inconsistencies between files
 *
 * Usage:
 *   node .claude/tools/validate-workflow-paths.mjs
 *   node .claude/tools/validate-workflow-paths.mjs --fix
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConfigPath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Detect double-prefix patterns in workflow paths
 */
function hasDoublePrefix(workflowPath) {
  const patterns = [
    /\.claude\/workflows\/\.claude\/workflows\//,
    /workflows\/\.claude\/workflows\//,
    /\.claude\/workflows\/workflows\//,
  ];
  return patterns.some(pattern => pattern.test(workflowPath));
}

/**
 * Normalize workflow path
 * - Remove double prefixes
 * - Ensure consistent format
 */
function normalizeWorkflowPath(workflowPath) {
  if (!workflowPath || workflowPath === 'null') return null;

  // Remove double prefixes
  let normalized = workflowPath
    .replace(/\.claude\/workflows\/\.claude\/workflows\//, '.claude/workflows/')
    .replace(/workflows\/\.claude\/workflows\//, '.claude/workflows/')
    .replace(/\.claude\/workflows\/workflows\//, '.claude/workflows/');

  // Ensure starts with .claude/workflows/
  if (!normalized.startsWith('.claude/workflows/') && normalized.endsWith('.yaml')) {
    normalized = `.claude/workflows/${path.basename(normalized)}`;
  }

  return normalized;
}

/**
 * Check if workflow file exists
 */
function workflowFileExists(workflowPath) {
  if (!workflowPath || workflowPath === 'null') return false;
  const absolutePath = path.resolve(PROJECT_ROOT, workflowPath);
  return fs.existsSync(absolutePath);
}

/**
 * Get all workflow files in .claude/workflows/
 */
function getAllWorkflowFiles() {
  const workflowDir = path.resolve(PROJECT_ROOT, '.claude/workflows');
  if (!fs.existsSync(workflowDir)) {
    return [];
  }
  return fs
    .readdirSync(workflowDir)
    .filter(file => file.endsWith('.yaml'))
    .map(file => `.claude/workflows/${file}`);
}

/**
 * Validate CUJ registry
 */
function validateCUJRegistry() {
  const registryPath = resolveConfigPath('cuj-registry.json', { read: true });

  if (!fs.existsSync(registryPath)) {
    log('❌ CUJ registry not found', 'red');
    return { valid: false, issues: [], cujs: [] };
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const issues = [];
  const cujWorkflows = [];

  registry.cujs.forEach((cuj, index) => {
    if (cuj.workflow) {
      cujWorkflows.push({
        cuj_id: cuj.id,
        workflow: cuj.workflow,
        line_estimate: calculateLineNumber(registry, index),
      });

      // Check for double-prefix
      if (hasDoublePrefix(cuj.workflow)) {
        issues.push({
          type: 'double_prefix',
          cuj_id: cuj.id,
          workflow: cuj.workflow,
          normalized: normalizeWorkflowPath(cuj.workflow),
          line: calculateLineNumber(registry, index),
        });
      }

      // Check if file exists
      if (!workflowFileExists(cuj.workflow)) {
        issues.push({
          type: 'missing_file',
          cuj_id: cuj.id,
          workflow: cuj.workflow,
          line: calculateLineNumber(registry, index),
        });
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    cujs: cujWorkflows,
    total_cujs: registry.cujs.length,
    cujs_with_workflows: cujWorkflows.length,
  };
}

/**
 * Calculate approximate line number in JSON file
 */
function calculateLineNumber(registry, cujIndex) {
  // Rough estimate: header (~5 lines) + avg 30 lines per CUJ
  return 5 + cujIndex * 30;
}

/**
 * Validate CUJ documentation files
 */
function validateCUJDocs() {
  const cujDocsDir = path.resolve(PROJECT_ROOT, '.claude/docs/cujs');

  if (!fs.existsSync(cujDocsDir)) {
    log('❌ CUJ docs directory not found: .claude/docs/cujs/', 'red');
    return { valid: false, issues: [] };
  }

  const cujFiles = fs
    .readdirSync(cujDocsDir)
    .filter(file => file.startsWith('CUJ-') && file.endsWith('.md'));

  const issues = [];
  const workflowPattern = /Workflow File[`:\s]*(?:`)?\.claude\/workflows\/[^`\n]+\.yaml/g;
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+\.yaml)\)/g;

  cujFiles.forEach(file => {
    const filePath = path.join(cujDocsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check for workflow file references
    lines.forEach((line, lineNum) => {
      // Check inline workflow file references
      const workflowMatches = [...line.matchAll(workflowPattern)];
      workflowMatches.forEach(match => {
        const workflowPath = match[0].replace(/Workflow File[`:\s]*(?:`)?/, '').trim();

        if (hasDoublePrefix(workflowPath)) {
          issues.push({
            type: 'double_prefix',
            file,
            line: lineNum + 1,
            workflow: workflowPath,
            normalized: normalizeWorkflowPath(workflowPath),
          });
        }

        if (!workflowFileExists(workflowPath)) {
          issues.push({
            type: 'missing_file',
            file,
            line: lineNum + 1,
            workflow: workflowPath,
          });
        }
      });

      // Check markdown links to workflow files
      const linkMatches = [...line.matchAll(markdownLinkPattern)];
      linkMatches.forEach(match => {
        const linkPath = match[2];
        if (linkPath.includes('workflows') && linkPath.endsWith('.yaml')) {
          // Resolve relative path
          const absoluteLinkPath = path.resolve(cujDocsDir, linkPath);
          if (!fs.existsSync(absoluteLinkPath)) {
            issues.push({
              type: 'broken_link',
              file,
              line: lineNum + 1,
              link: linkPath,
              resolved: path.relative(PROJECT_ROOT, absoluteLinkPath),
            });
          }
        }
      });
    });
  });

  return {
    valid: issues.length === 0,
    issues,
    files_checked: cujFiles.length,
  };
}

/**
 * Generate validation report
 */
function generateReport(registryResult, docsResult) {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║          Workflow Path Validation Report              ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  // Summary
  const allIssues = [...registryResult.issues, ...docsResult.issues];
  const hasIssues = allIssues.length > 0;

  log(`📊 Summary:`, 'blue');
  log(`  • CUJs in registry: ${registryResult.total_cujs}`, 'reset');
  log(`  • CUJs with workflows: ${registryResult.cujs_with_workflows}`, 'reset');
  log(`  • CUJ docs checked: ${docsResult.files_checked}`, 'reset');
  log(`  • Total issues found: ${allIssues.length}`, hasIssues ? 'red' : 'green');
  log('');

  // Get available workflows
  const availableWorkflows = getAllWorkflowFiles();
  log(`📁 Available workflows (${availableWorkflows.length}):`, 'blue');
  availableWorkflows.forEach(workflow => {
    log(`  ✓ ${workflow}`, 'green');
  });
  log('');

  // Issue breakdown
  if (hasIssues) {
    const doublePrefixIssues = allIssues.filter(i => i.type === 'double_prefix');
    const missingFileIssues = allIssues.filter(i => i.type === 'missing_file');
    const brokenLinkIssues = allIssues.filter(i => i.type === 'broken_link');

    if (doublePrefixIssues.length > 0) {
      log(`🔴 Double-Prefix Issues (${doublePrefixIssues.length}):`, 'red');
      doublePrefixIssues.forEach(issue => {
        if (issue.cuj_id) {
          log(`  • ${issue.cuj_id} (line ~${issue.line}):`, 'yellow');
          log(`    Current:    ${issue.workflow}`, 'red');
          log(`    Should be:  ${issue.normalized}`, 'green');
        } else {
          log(`  • ${issue.file} (line ${issue.line}):`, 'yellow');
          log(`    Current:    ${issue.workflow}`, 'red');
          log(`    Should be:  ${issue.normalized}`, 'green');
        }
      });
      log('');
    }

    if (missingFileIssues.length > 0) {
      log(`🔴 Missing Workflow Files (${missingFileIssues.length}):`, 'red');
      missingFileIssues.forEach(issue => {
        if (issue.cuj_id) {
          log(`  • ${issue.cuj_id} (line ~${issue.line}): ${issue.workflow}`, 'yellow');
        } else {
          log(`  • ${issue.file} (line ${issue.line}): ${issue.workflow}`, 'yellow');
        }
      });
      log('');

      // Suggest closest matches
      log(`💡 Suggestions:`, 'blue');
      missingFileIssues.forEach(issue => {
        const closestMatch = findClosestWorkflow(issue.workflow, availableWorkflows);
        if (closestMatch) {
          log(`  • For "${path.basename(issue.workflow)}":`, 'yellow');
          log(`    Did you mean: ${closestMatch}`, 'green');
        }
      });
      log('');
    }

    if (brokenLinkIssues.length > 0) {
      log(`🔴 Broken Workflow Links (${brokenLinkIssues.length}):`, 'red');
      brokenLinkIssues.forEach(issue => {
        log(`  • ${issue.file} (line ${issue.line}):`, 'yellow');
        log(`    Link: ${issue.link}`, 'red');
        log(`    Resolved to: ${issue.resolved}`, 'yellow');
      });
      log('');
    }
  } else {
    log(`✅ No issues found! All workflow paths are valid.`, 'green');
    log('');
  }

  // Recommendations
  if (hasIssues) {
    log(`📋 Recommendations:`, 'magenta');
    log(`  1. Run with --fix flag to auto-correct double-prefix issues`, 'reset');
    log(`  2. Create missing workflow files or update references`, 'reset');
    log(`  3. Fix broken links in documentation`, 'reset');
    log('');
  }

  return hasIssues ? 1 : 0;
}

/**
 * Find closest matching workflow file
 */
function findClosestWorkflow(targetPath, availableWorkflows) {
  const targetBasename = path.basename(targetPath);

  // Exact match
  const exactMatch = availableWorkflows.find(w => path.basename(w) === targetBasename);
  if (exactMatch) return exactMatch;

  // Fuzzy match (contains similar words)
  const targetWords = targetBasename.replace('.yaml', '').split('-');
  const matches = availableWorkflows
    .map(workflow => {
      const workflowWords = path.basename(workflow).replace('.yaml', '').split('-');
      const commonWords = targetWords.filter(w => workflowWords.includes(w));
      return { workflow, score: commonWords.length };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches.length > 0 ? matches[0].workflow : null;
}

/**
 * Fix double-prefix issues in CUJ registry
 */
function fixCUJRegistry() {
  const registryPath = resolveConfigPath('cuj-registry.json', { read: true });

  if (!fs.existsSync(registryPath)) {
    log('❌ CUJ registry not found', 'red');
    return false;
  }

  const content = fs.readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(content);

  let fixCount = 0;
  registry.cujs.forEach(cuj => {
    if (cuj.workflow && hasDoublePrefix(cuj.workflow)) {
      const original = cuj.workflow;
      cuj.workflow = normalizeWorkflowPath(cuj.workflow);
      log(`  ✓ Fixed ${cuj.id}: ${original} → ${cuj.workflow}`, 'green');
      fixCount++;
    }
  });

  if (fixCount > 0) {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    log(`\n✅ Fixed ${fixCount} double-prefix issues in cuj-registry.json`, 'green');
    return true;
  } else {
    log(`\n✓ No fixes needed in cuj-registry.json`, 'green');
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');

  log(`🔍 Validating workflow paths across LLM-RULES project...`, 'cyan');
  log('');

  if (shouldFix) {
    log(`🔧 Fix mode enabled - will attempt to auto-correct issues\n`, 'yellow');
    fixCUJRegistry();
    log('');
  }

  // Run validations
  const registryResult = validateCUJRegistry();
  const docsResult = validateCUJDocs();

  // Generate report
  const exitCode = generateReport(registryResult, docsResult);

  if (exitCode !== 0) {
    log(
      `\n❌ Validation failed with ${registryResult.issues.length + docsResult.issues.length} issues`,
      'red'
    );
    log(`Run with --fix to auto-correct double-prefix issues`, 'yellow');
  } else {
    log(`\n✅ All workflow paths are valid!`, 'green');
  }

  process.exit(exitCode);
}

// Run main function
main();
