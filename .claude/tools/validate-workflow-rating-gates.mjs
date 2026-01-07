#!/usr/bin/env node

/**
 * Workflow Rating Gate Validation Script
 *
 * Purpose: Validates all workflow YAML files for Step 0.1 Plan Rating Gate compliance
 *
 * Checks:
 * 1. If workflow has Step 0 (Planning Phase)
 * 2. If Step 0 exists, verify Step 0.1 (Plan Rating Gate) also exists
 * 3. Verify Step 0.1 uses response-rater skill
 * 4. Report missing or incorrect implementations
 *
 * Usage:
 *   node .claude/tools/validate-workflow-rating-gates.mjs
 *   pnpm validate:workflow-gates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Find all workflow YAML files
 * @returns {string[]} Array of absolute paths to workflow files
 */
function findWorkflowFiles() {
  const workflowDir = path.join(__dirname, '..', 'workflows');

  if (!fs.existsSync(workflowDir)) {
    console.error(`${colors.red}Error: Workflow directory not found: ${workflowDir}${colors.reset}`);
    process.exit(1);
  }

  const files = fs.readdirSync(workflowDir);
  return files
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map(file => path.join(workflowDir, file));
}

/**
 * Parse YAML file with error handling
 * @param {string} filePath - Absolute path to YAML file
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function parseYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown parsing error'
    };
  }
}

/**
 * Find a step by step number
 * @param {Array} steps - Array of workflow steps
 * @param {number} stepNumber - Step number to find
 * @returns {object|null} Step object or null
 */
function findStep(steps, stepNumber) {
  if (!Array.isArray(steps)) {
    return null;
  }
  return steps.find(step => step.step === stepNumber) || null;
}

/**
 * Validate Step 0.1 structure and content
 * @param {object} step - Step 0.1 object
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateStep01(step) {
  const issues = [];

  // Check for response-rater skill
  if (step.skill !== 'response-rater') {
    issues.push(`Missing or incorrect skill (expected: "response-rater", found: "${step.skill || 'none'}")`);
  }

  // Check for minimum_score in validation
  if (!step.validation?.minimum_score) {
    issues.push('Missing validation.minimum_score');
  } else if (step.validation.minimum_score < 7) {
    issues.push(`minimum_score too low (expected: >= 7, found: ${step.validation.minimum_score})`);
  }

  // Check for plan input
  const hasPlanInput = step.inputs?.some(input =>
    typeof input === 'string' && input.includes('plan-{{workflow_id}}.json')
  );
  if (!hasPlanInput) {
    issues.push('Missing plan-{{workflow_id}}.json input');
  }

  // Check for rating output
  const hasRatingOutput = step.outputs?.some(output =>
    typeof output === 'string' && output.includes('plan-rating')
  );
  if (!hasRatingOutput) {
    issues.push('Missing plan-rating output');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate a single workflow file
 * @param {string} filePath - Absolute path to workflow file
 * @returns {object} Validation result
 */
function validateWorkflow(filePath) {
  const filename = path.basename(filePath);
  const result = {
    filename,
    success: true,
    hasStep0: false,
    hasStep01: false,
    step01Valid: false,
    issues: [],
    errors: []
  };

  // Parse YAML
  const parsed = parseYamlFile(filePath);
  if (!parsed.success) {
    result.success = false;
    result.errors.push(`YAML parsing failed: ${parsed.error}`);
    return result;
  }

  const workflow = parsed.data;

  // Check for steps array
  if (!workflow.steps || !Array.isArray(workflow.steps)) {
    result.success = false;
    result.errors.push('No steps array found in workflow');
    return result;
  }

  // Check for Step 0
  const step0 = findStep(workflow.steps, 0);
  result.hasStep0 = !!step0;

  if (!result.hasStep0) {
    // No Step 0 = no validation needed
    return result;
  }

  // Check for Step 0.1
  const step01 = findStep(workflow.steps, 0.1);
  result.hasStep01 = !!step01;

  if (!result.hasStep01) {
    result.success = false;
    result.issues.push('Step 0 exists but Step 0.1 (Plan Rating Gate) is missing');
    return result;
  }

  // Validate Step 0.1 structure
  const validation = validateStep01(step01);
  result.step01Valid = validation.valid;
  result.issues.push(...validation.issues);

  if (!validation.valid) {
    result.success = false;
  }

  return result;
}

/**
 * Main validation function
 */
function main() {
  console.log(`${colors.bold}${colors.cyan}Workflow Rating Gate Validation${colors.reset}`);
  console.log('='.repeat(50));
  console.log('');

  const workflowFiles = findWorkflowFiles();
  console.log(`Found ${workflowFiles.length} workflow file(s)\n`);

  const results = workflowFiles.map(validateWorkflow);

  // Group results
  const withStep0 = results.filter(r => r.hasStep0);
  const withStep01 = results.filter(r => r.hasStep01);
  const validStep01 = results.filter(r => r.step01Valid);
  const failures = results.filter(r => !r.success && r.hasStep0);

  // Print individual results
  results.forEach(result => {
    const icon = result.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    let status = '';

    if (!result.hasStep0) {
      status = `${colors.yellow}No Step 0${colors.reset}`;
    } else if (result.step01Valid) {
      status = `${colors.green}Step 0.1 present, uses response-rater${colors.reset}`;
    } else if (result.hasStep01) {
      status = `${colors.yellow}Step 0.1 present but has issues${colors.reset}`;
    } else {
      status = `${colors.red}Missing Step 0.1${colors.reset}`;
    }

    console.log(`${icon} ${result.filename} - ${status}`);

    // Print errors
    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(`    ${colors.red}ERROR: ${error}${colors.reset}`);
      });
    }

    // Print issues
    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        console.log(`    ${colors.yellow}ISSUE: ${issue}${colors.reset}`);
      });
    }
  });

  // Print summary
  console.log('');
  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`- Total workflows: ${results.length}`);
  console.log(`- Workflows with Step 0: ${withStep0.length}`);
  console.log(`- Workflows with Step 0.1: ${withStep01.length}`);
  console.log(`- Valid Step 0.1 implementations: ${validStep01.length}`);
  console.log(`- Missing/Invalid Step 0.1: ${failures.length}`);

  // List missing workflows
  if (failures.length > 0) {
    console.log('');
    console.log(`${colors.bold}${colors.red}Workflows with missing or invalid Step 0.1:${colors.reset}`);
    failures.forEach((result, index) => {
      console.log(`${index + 1}. ${result.filename}`);
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      }
    });
  }

  // Exit with appropriate code
  if (failures.length > 0) {
    console.log('');
    console.log(`${colors.red}${colors.bold}Validation FAILED${colors.reset}`);
    process.exit(1);
  } else {
    console.log('');
    console.log(`${colors.green}${colors.bold}Validation PASSED${colors.reset}`);
    process.exit(0);
  }
}

// Run validation
main();
