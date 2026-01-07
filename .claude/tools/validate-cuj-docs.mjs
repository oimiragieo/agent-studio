#!/usr/bin/env node
/**
 * CUJ Documentation Validator - Validate CUJ markdown files
 *
 * Validates CUJ documents for:
 * - Required sections (Overview, Scenarios, Success Criteria, etc.)
 * - Valid links to referenced files
 * - Valid skill references
 * - Proper formatting and structure
 *
 * Usage:
 *   node .claude/tools/validate-cuj-docs.mjs
 *   node .claude/tools/validate-cuj-docs.mjs --cuj CUJ-001
 *   node .claude/tools/validate-cuj-docs.mjs --fix
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CUJS_DIR = join(__dirname, '..', 'docs', 'cujs');
const SKILLS_DIR = join(__dirname, '..', 'skills');
const WORKFLOWS_DIR = join(__dirname, '..', 'workflows');
const REPORTS_DIR = join(__dirname, '..', 'context', 'reports');

// Required sections for all CUJs
const REQUIRED_SECTIONS = [
  'overview',
  'scenarios',
  'success criteria',
  'agent sequence',
  'skills used',
  'expected artifacts'
];

// Optional sections
const OPTIONAL_SECTIONS = [
  'prerequisites',
  'dependencies',
  'validation steps',
  'troubleshooting',
  'related cujs'
];

/**
 * Parse CUJ markdown file
 * @param {string} filePath - Path to CUJ markdown file
 * @returns {Promise<Object>} Parsed CUJ structure
 */
async function parseCujFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const cuj = {
    filePath,
    title: '',
    sections: {},
    links: [],
    skills: [],
    workflows: [],
    artifacts: [],
    errors: [],
    warnings: []
  };

  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Extract title
    if (trimmed.startsWith('# ') && !cuj.title) {
      cuj.title = trimmed.substring(2).trim();
      continue;
    }

    // Extract section headers
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.substring(3).trim().toLowerCase();
      cuj.sections[currentSection] = {
        lineNumber: i + 1,
        content: []
      };
      continue;
    }

    // Collect section content
    if (currentSection && cuj.sections[currentSection]) {
      cuj.sections[currentSection].content.push(trimmed);
    }

    // Extract markdown links
    const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of linkMatches) {
      cuj.links.push({
        text: match[1],
        url: match[2],
        lineNumber: i + 1
      });
    }

    // Extract skill references
    if (trimmed.startsWith('- ') && currentSection === 'skills used') {
      const skillMatch = trimmed.match(/`([^`]+)`/);
      if (skillMatch) {
        cuj.skills.push({
          name: skillMatch[1],
          lineNumber: i + 1
        });
      }
    }

    // Extract workflow references
    const workflowMatch = trimmed.match(/workflow[:\s]+`([^`]+\.yaml)`/i);
    if (workflowMatch) {
      cuj.workflows.push({
        name: workflowMatch[1],
        lineNumber: i + 1
      });
    }

    // Extract artifact references
    if (trimmed.startsWith('- ') && currentSection === 'expected artifacts') {
      const artifactMatch = trimmed.match(/`([^`]+)`/);
      if (artifactMatch) {
        cuj.artifacts.push({
          name: artifactMatch[1],
          lineNumber: i + 1
        });
      }
    }
  }

  return cuj;
}

/**
 * Validate required sections
 * @param {Object} cuj - Parsed CUJ object
 * @returns {Array} Validation errors
 */
function validateRequiredSections(cuj) {
  const errors = [];

  for (const requiredSection of REQUIRED_SECTIONS) {
    if (!cuj.sections[requiredSection]) {
      errors.push({
        type: 'missing_section',
        severity: 'error',
        section: requiredSection,
        message: `Missing required section: ## ${requiredSection}`
      });
    } else if (cuj.sections[requiredSection].content.filter(c => c).length === 0) {
      errors.push({
        type: 'empty_section',
        severity: 'warning',
        section: requiredSection,
        lineNumber: cuj.sections[requiredSection].lineNumber,
        message: `Section is empty: ## ${requiredSection}`
      });
    }
  }

  return errors;
}

/**
 * Validate file links
 * @param {Object} cuj - Parsed CUJ object
 * @returns {Promise<Array>} Validation errors
 */
async function validateLinks(cuj) {
  const errors = [];

  for (const link of cuj.links) {
    // Skip external URLs
    if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
      continue;
    }

    // Check if file exists
    const basePath = dirname(cuj.filePath);
    const linkPath = join(basePath, link.url);

    if (!existsSync(linkPath)) {
      errors.push({
        type: 'broken_link',
        severity: 'error',
        link: link.url,
        lineNumber: link.lineNumber,
        message: `Broken link: ${link.url} (file not found)`
      });
    }
  }

  return errors;
}

/**
 * Validate skill references
 * @param {Object} cuj - Parsed CUJ object
 * @returns {Promise<Array>} Validation errors
 */
async function validateSkills(cuj) {
  const errors = [];

  // Get list of available skills
  let availableSkills = [];
  try {
    const skillDirs = await readdir(SKILLS_DIR, { withFileTypes: true });
    availableSkills = skillDirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch (error) {
    errors.push({
      type: 'skills_directory_error',
      severity: 'warning',
      message: `Could not read skills directory: ${error.message}`
    });
    return errors;
  }

  for (const skill of cuj.skills) {
    if (!availableSkills.includes(skill.name)) {
      errors.push({
        type: 'invalid_skill',
        severity: 'warning',
        skill: skill.name,
        lineNumber: skill.lineNumber,
        message: `Skill not found: ${skill.name}`
      });
    }
  }

  return errors;
}

/**
 * Validate workflow references
 * @param {Object} cuj - Parsed CUJ object
 * @returns {Promise<Array>} Validation errors
 */
async function validateWorkflows(cuj) {
  const errors = [];

  for (const workflow of cuj.workflows) {
    const workflowPath = join(WORKFLOWS_DIR, workflow.name);

    if (!existsSync(workflowPath)) {
      errors.push({
        type: 'invalid_workflow',
        severity: 'error',
        workflow: workflow.name,
        lineNumber: workflow.lineNumber,
        message: `Workflow not found: ${workflow.name}`
      });
    }
  }

  return errors;
}

/**
 * Validate a single CUJ file
 * @param {string} filePath - Path to CUJ file
 * @returns {Promise<Object>} Validation result
 */
export async function validateCujFile(filePath) {
  const result = {
    file: filePath,
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    const cuj = await parseCujFile(filePath);

    // Validate required sections
    const sectionErrors = validateRequiredSections(cuj);
    result.errors.push(...sectionErrors.filter(e => e.severity === 'error'));
    result.warnings.push(...sectionErrors.filter(e => e.severity === 'warning'));

    // Validate links
    const linkErrors = await validateLinks(cuj);
    result.errors.push(...linkErrors.filter(e => e.severity === 'error'));
    result.warnings.push(...linkErrors.filter(e => e.severity === 'warning'));

    // Validate skills
    const skillErrors = await validateSkills(cuj);
    result.errors.push(...skillErrors.filter(e => e.severity === 'error'));
    result.warnings.push(...skillErrors.filter(e => e.severity === 'warning'));

    // Validate workflows
    const workflowErrors = await validateWorkflows(cuj);
    result.errors.push(...workflowErrors.filter(e => e.severity === 'error'));
    result.warnings.push(...workflowErrors.filter(e => e.severity === 'warning'));

    result.valid = result.errors.length === 0;
    result.title = cuj.title;

  } catch (error) {
    result.valid = false;
    result.errors.push({
      type: 'parse_error',
      severity: 'error',
      message: `Failed to parse CUJ file: ${error.message}`
    });
  }

  return result;
}

/**
 * Validate all CUJ files
 * @returns {Promise<Object>} Aggregate validation result
 */
export async function validateAllCujs() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    files: [],
    timestamp: new Date().toISOString()
  };

  try {
    const files = await readdir(CUJS_DIR);
    const cujFiles = files.filter(f => f.endsWith('.md') && f !== 'CUJ-INDEX.md');

    for (const file of cujFiles) {
      const filePath = join(CUJS_DIR, file);
      const result = await validateCujFile(filePath);

      results.files.push(result);
      results.total++;

      if (result.valid) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Generate validation report
 * @param {Object} results - Validation results
 * @returns {Promise<string>} Report file path
 */
async function generateReport(results) {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `cuj-validation-report-${timestamp}.json`;
  const reportPath = join(REPORTS_DIR, reportFileName);

  await writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');

  return reportPath;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
CUJ Documentation Validator - Validate CUJ markdown files

Usage:
  node validate-cuj-docs.mjs [options]

Options:
  --cuj <id>          Validate specific CUJ (e.g., CUJ-001)
  --fix               Auto-fix issues where possible
  --json              Output as JSON
  --report            Generate detailed report
  --help, -h          Show this help

Examples:
  # Validate all CUJs
  node validate-cuj-docs.mjs

  # Validate specific CUJ
  node validate-cuj-docs.mjs --cuj CUJ-001

  # Generate report
  node validate-cuj-docs.mjs --report

Exit codes:
  0 - All validations passed
  1 - One or more validations failed
`);
    process.exit(0);
  }

  const getArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  };

  const hasFlag = (name) => args.includes(`--${name}`);

  try {
    const cujId = getArg('cuj');
    let results;

    if (cujId) {
      // Validate single CUJ
      const filePath = join(CUJS_DIR, `${cujId}.md`);
      const result = await validateCujFile(filePath);
      results = {
        total: 1,
        passed: result.valid ? 1 : 0,
        failed: result.valid ? 0 : 1,
        files: [result]
      };
    } else {
      // Validate all CUJs
      results = await validateAllCujs();
    }

    // Generate report if requested
    if (hasFlag('report')) {
      const reportPath = await generateReport(results);
      console.log(`\nReport generated: ${reportPath}`);
    }

    // Output results
    if (hasFlag('json')) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(`\nCUJ Validation Results:`);
      console.log(`  Total: ${results.total}`);
      console.log(`  Passed: ${results.passed}`);
      console.log(`  Failed: ${results.failed}`);
      console.log('');

      for (const fileResult of results.files) {
        const status = fileResult.valid ? '✓' : '✗';
        const fileName = fileResult.file.split(/[/\\]/).pop();
        console.log(`${status} ${fileName}${fileResult.title ? ` - ${fileResult.title}` : ''}`);

        if (fileResult.errors.length > 0) {
          console.log(`  Errors (${fileResult.errors.length}):`);
          fileResult.errors.forEach(err => {
            const line = err.lineNumber ? ` (line ${err.lineNumber})` : '';
            console.log(`    - ${err.message}${line}`);
          });
        }

        if (fileResult.warnings.length > 0) {
          console.log(`  Warnings (${fileResult.warnings.length}):`);
          fileResult.warnings.forEach(warn => {
            const line = warn.lineNumber ? ` (line ${warn.lineNumber})` : '';
            console.log(`    - ${warn.message}${line}`);
          });
        }
      }
    }

    process.exit(results.failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  validateCujFile,
  validateAllCujs
};
