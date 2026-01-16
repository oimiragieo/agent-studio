#!/usr/bin/env node

/**
 * Verification Gate Tool
 *
 * CLI tool for orchestrators to verify agent outputs after delegation.
 * Implements 5-step verification protocol to catch errors, warnings,
 * missing deliverables, and unmet success criteria.
 *
 * Usage:
 *   node .claude/tools/verification-gate.mjs --output <path> [--strict] [--verbose]
 *
 * Modes:
 *   standard - Exit 0 (pass), 1 (concerns - can proceed)
 *   strict   - Exit 0 (pass), 2 (fail - must stop)
 *   verbose  - Print detailed verification steps
 *
 * Exit Codes:
 *   0 - PASS: Agent output verified successfully
 *   1 - CONCERNS: Issues found but can proceed (standard mode only)
 *   2 - FAIL: Critical issues found, must stop (strict mode or critical errors)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { parseArgs } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');

/**
 * Verification result structure
 */
class VerificationResult {
  constructor() {
    this.verdict = 'PASS'; // PASS, CONCERNS, FAIL
    this.agent_type = null;
    this.timestamp = new Date().toISOString();
    this.errors = [];
    this.warnings = [];
    this.deliverables_status = [];
    this.success_criteria_status = [];
    this.verification_steps = {
      step1_errors: { checked: false, found: [] },
      step2_warnings: { checked: false, found: [] },
      step3_deliverables: { checked: false, missing: [] },
      step4_criteria: { checked: false, unmet: [] },
      step5_verdict: { checked: false, agent_verdict: null },
    };
  }

  addError(message, severity = 'critical') {
    this.errors.push({ message, severity, timestamp: new Date().toISOString() });
    if (severity === 'critical') {
      this.verdict = 'FAIL';
    } else if (this.verdict === 'PASS') {
      this.verdict = 'CONCERNS';
    }
  }

  addWarning(message) {
    this.warnings.push({ message, timestamp: new Date().toISOString() });
    if (this.verdict === 'PASS') {
      this.verdict = 'CONCERNS';
    }
  }

  addDeliverableStatus(path, exists, validated, message = null) {
    this.deliverables_status.push({ path, exists, validated, message });
    if (!exists || !validated) {
      this.addError(`Deliverable missing or invalid: ${path}`, 'critical');
    }
  }

  addCriteriaStatus(criterion, met, evidence = null) {
    this.success_criteria_status.push({ criterion, met, evidence });
    if (!met) {
      this.addError(`Success criterion not met: ${criterion}`, 'high');
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  try {
    const { values } = parseArgs({
      options: {
        output: {
          type: 'string',
          short: 'o',
        },
        strict: {
          type: 'boolean',
          short: 's',
          default: false,
        },
        verbose: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
    });

    if (values.help) {
      printUsage();
      process.exit(0);
    }

    if (!values.output) {
      console.error('Error: --output <path> is required');
      printUsage();
      process.exit(2);
    }

    return values;
  } catch (error) {
    console.error(`Argument parsing error: ${error.message}`);
    printUsage();
    process.exit(2);
  }
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Verification Gate Tool - Post-Delegation Verification

Usage:
  node .claude/tools/verification-gate.mjs --output <path> [options]

Options:
  -o, --output <path>    Path to agent output file (required)
  -s, --strict          Strict mode: exit 2 on any concerns
  -v, --verbose         Verbose output with detailed steps
  -h, --help            Show this help message

Exit Codes:
  0 - PASS: Agent output verified successfully
  1 - CONCERNS: Issues found but can proceed (standard mode only)
  2 - FAIL: Critical issues found, must stop

Examples:
  # Standard verification
  node .claude/tools/verification-gate.mjs --output .claude/context/reports/agent-output.md

  # Strict mode (block on any concerns)
  node .claude/tools/verification-gate.mjs --output agent-output.md --strict

  # Verbose mode (show all verification steps)
  node .claude/tools/verification-gate.mjs --output agent-output.md --verbose
`);
}

/**
 * Load agent output file
 */
function loadAgentOutput(outputPath) {
  // Resolve path (may be relative or absolute)
  const resolvedPath = outputPath.startsWith('/') ? outputPath : join(PROJECT_ROOT, outputPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Agent output file not found: ${resolvedPath}`);
  }

  const content = readFileSync(resolvedPath, 'utf-8');

  // Try to parse as JSON first
  try {
    return { type: 'json', content: JSON.parse(content), raw: content };
  } catch {
    // Fall back to text
    return { type: 'text', content, raw: content };
  }
}

/**
 * Step 1: Check for errors
 */
function checkForErrors(output, result, verbose) {
  if (verbose) console.log('\n[STEP 1] Checking for errors...');

  const errorKeywords = ['error', 'failed', 'exception', 'crash', 'fatal', 'failure'];

  const content = output.raw.toLowerCase();
  const foundErrors = [];

  for (const keyword of errorKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      foundErrors.push({ keyword, count: matches.length });
    }
  }

  result.verification_steps.step1_errors.checked = true;
  result.verification_steps.step1_errors.found = foundErrors;

  if (foundErrors.length > 0) {
    foundErrors.forEach(({ keyword, count }) => {
      result.addError(`Found ${count} occurrence(s) of "${keyword}"`, 'critical');
    });

    if (verbose) {
      console.log(
        `  ✗ Found errors: ${foundErrors.map(e => `${e.keyword} (${e.count})`).join(', ')}`
      );
    }
  } else {
    if (verbose) console.log('  ✓ No errors found');
  }
}

/**
 * Step 2: Check for warnings
 */
function checkForWarnings(output, result, verbose) {
  if (verbose) console.log('\n[STEP 2] Checking for warnings...');

  const warningKeywords = ['warning', 'concern', 'issue', 'problem', 'caution'];

  const content = output.raw.toLowerCase();
  const foundWarnings = [];

  for (const keyword of warningKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      foundWarnings.push({ keyword, count: matches.length });
    }
  }

  result.verification_steps.step2_warnings.checked = true;
  result.verification_steps.step2_warnings.found = foundWarnings;

  if (foundWarnings.length > 0) {
    foundWarnings.forEach(({ keyword, count }) => {
      result.addWarning(`Found ${count} occurrence(s) of "${keyword}"`);
    });

    if (verbose) {
      console.log(
        `  ⚠ Found warnings: ${foundWarnings.map(w => `${w.keyword} (${w.count})`).join(', ')}`
      );
    }
  } else {
    if (verbose) console.log('  ✓ No warnings found');
  }
}

/**
 * Step 3: Verify deliverables exist
 */
function verifyDeliverablesExist(output, result, verbose) {
  if (verbose) console.log('\n[STEP 3] Verifying deliverables exist...');

  // Extract deliverables from output (if JSON)
  let deliverables = [];

  if (output.type === 'json') {
    // Look for common deliverable fields
    if (output.content.deliverables) {
      deliverables = Array.isArray(output.content.deliverables)
        ? output.content.deliverables
        : [output.content.deliverables];
    } else if (output.content.files_created) {
      deliverables = output.content.files_created.map(path => ({ path }));
    } else if (output.content.artifacts) {
      deliverables = Array.isArray(output.content.artifacts)
        ? output.content.artifacts.map(path => ({ path }))
        : [{ path: output.content.artifacts }];
    }
  }

  result.verification_steps.step3_deliverables.checked = true;

  if (deliverables.length === 0) {
    if (verbose) console.log('  ℹ No deliverables specified to verify');
    return;
  }

  let missingCount = 0;

  for (const deliverable of deliverables) {
    const path = typeof deliverable === 'string' ? deliverable : deliverable.path;
    if (!path) continue;

    const resolvedPath = path.startsWith('/') ? path : join(PROJECT_ROOT, path);
    const exists = existsSync(resolvedPath);

    let validated = false;
    if (exists) {
      const stats = statSync(resolvedPath);
      validated = stats.size > 0; // Basic validation: file is not empty
    }

    result.addDeliverableStatus(path, exists, validated);

    if (!exists) {
      result.verification_steps.step3_deliverables.missing.push(path);
      missingCount++;
      if (verbose) console.log(`  ✗ Missing: ${path}`);
    } else if (!validated) {
      if (verbose) console.log(`  ⚠ Empty: ${path}`);
    } else {
      if (verbose) console.log(`  ✓ Verified: ${path}`);
    }
  }

  if (missingCount === 0 && verbose) {
    console.log(`  ✓ All ${deliverables.length} deliverable(s) verified`);
  }
}

/**
 * Step 4: Validate success criteria
 */
function validateSuccessCriteria(output, result, verbose) {
  if (verbose) console.log('\n[STEP 4] Validating success criteria...');

  // Extract success criteria from output (if JSON)
  let criteria = [];

  if (output.type === 'json') {
    if (output.content.success_criteria) {
      criteria = Array.isArray(output.content.success_criteria)
        ? output.content.success_criteria
        : [output.content.success_criteria];
    } else if (output.content.criteria) {
      criteria = Array.isArray(output.content.criteria)
        ? output.content.criteria
        : [output.content.criteria];
    }
  }

  result.verification_steps.step4_criteria.checked = true;

  if (criteria.length === 0) {
    if (verbose) console.log('  ℹ No success criteria specified to validate');
    return;
  }

  let unmetCount = 0;

  for (const criterion of criteria) {
    const name = typeof criterion === 'string' ? criterion : criterion.name || criterion.criterion;
    const met = typeof criterion === 'string' ? null : criterion.met;
    const evidence = typeof criterion === 'string' ? null : criterion.evidence;

    // If met is explicitly false, mark as unmet
    if (met === false) {
      result.addCriteriaStatus(name, false, evidence);
      result.verification_steps.step4_criteria.unmet.push(name);
      unmetCount++;
      if (verbose) console.log(`  ✗ Not met: ${name}`);
    } else {
      // Assume met if not explicitly false
      result.addCriteriaStatus(name, true, evidence);
      if (verbose) console.log(`  ✓ Met: ${name}`);
    }
  }

  if (unmetCount === 0 && verbose) {
    console.log(`  ✓ All ${criteria.length} success criteria met`);
  }
}

/**
 * Step 5: Check verdict
 */
function checkVerdict(output, result, verbose) {
  if (verbose) console.log('\n[STEP 5] Checking agent verdict...');

  let agentVerdict = null;

  if (output.type === 'json') {
    agentVerdict = output.content.verdict || output.content.status || null;
  } else {
    // Search for verdict in text
    const verdictMatch = output.content.match(/verdict:\s*(PASS|CONCERNS|FAIL)/i);
    if (verdictMatch) {
      agentVerdict = verdictMatch[1].toUpperCase();
    }
  }

  result.verification_steps.step5_verdict.checked = true;
  result.verification_steps.step5_verdict.agent_verdict = agentVerdict;

  if (agentVerdict) {
    if (verbose) console.log(`  Agent verdict: ${agentVerdict}`);

    if (agentVerdict === 'FAIL') {
      result.verdict = 'FAIL';
      result.addError('Agent reported FAIL verdict', 'critical');
    } else if (agentVerdict === 'CONCERNS') {
      if (result.verdict === 'PASS') {
        result.verdict = 'CONCERNS';
      }
      result.addWarning('Agent reported CONCERNS verdict');
    } else if (agentVerdict === 'PASS') {
      if (verbose) console.log('  ✓ Agent reported PASS verdict');
    }
  } else {
    if (verbose) console.log('  ℹ No explicit verdict found in agent output');
  }
}

/**
 * Run verification
 */
function runVerification(args) {
  const { output: outputPath, strict, verbose } = args;

  if (verbose) {
    console.log('='.repeat(60));
    console.log('VERIFICATION GATE - POST-DELEGATION VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Output: ${outputPath}`);
    console.log(`Mode: ${strict ? 'STRICT' : 'STANDARD'}`);
    console.log('='.repeat(60));
  }

  const result = new VerificationResult();

  try {
    // Load agent output
    const output = loadAgentOutput(outputPath);
    if (verbose)
      console.log(`\nLoaded ${output.type.toUpperCase()} output (${output.raw.length} bytes)`);

    // Extract agent type if available
    if (output.type === 'json' && output.content.agent_type) {
      result.agent_type = output.content.agent_type;
    }

    // Execute 5-step verification protocol
    checkForErrors(output, result, verbose);
    checkForWarnings(output, result, verbose);
    verifyDeliverablesExist(output, result, verbose);
    validateSuccessCriteria(output, result, verbose);
    checkVerdict(output, result, verbose);

    // Save verification result
    saveVerificationResult(result, outputPath);

    // Print final verdict
    printVerdict(result, strict, verbose);

    // Determine exit code
    if (result.verdict === 'PASS') {
      process.exit(0);
    } else if (result.verdict === 'CONCERNS' && !strict) {
      process.exit(1);
    } else {
      process.exit(2);
    }
  } catch (error) {
    console.error(`\nVerification failed: ${error.message}`);
    if (verbose && error.stack) {
      console.error(error.stack);
    }
    process.exit(2);
  }
}

/**
 * Save verification result to file
 */
function saveVerificationResult(result, originalOutputPath) {
  const outputDir = join(PROJECT_ROOT, '.claude/context/reports');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `verification-result-${timestamp}.json`);

  writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

/**
 * Print final verdict
 */
function printVerdict(result, strict, verbose) {
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULT');
  console.log('='.repeat(60));
  console.log(`Verdict: ${result.verdict}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Deliverables Checked: ${result.deliverables_status.length}`);
  console.log(`Criteria Checked: ${result.success_criteria_status.length}`);
  console.log('='.repeat(60));

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.severity.toUpperCase()}] ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning.message}`);
    });
  }

  if (result.verdict === 'PASS') {
    console.log('\n✓ Verification PASSED - Agent output verified successfully');
  } else if (result.verdict === 'CONCERNS') {
    if (strict) {
      console.log('\n✗ Verification FAILED - Concerns found (strict mode)');
    } else {
      console.log('\n⚠ Verification CONCERNS - Issues found but can proceed');
    }
  } else {
    console.log('\n✗ Verification FAILED - Critical issues found, must stop');
  }
}

// Main execution
const args = parseArguments();
runVerification(args);
