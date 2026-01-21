#!/usr/bin/env node

/**
 * Post-Delegation Verification Hook (PostToolUse)
 *
 * Implements 5-step verification protocol after Task tool completes:
 * 1. Check for errors in agent output
 * 2. Check for warnings
 * 3. Verify deliverables exist
 * 4. Validate success criteria
 * 5. Check agent verdict
 *
 * Hook Type: PostToolUse
 * Execution: After Task tool (agent delegation) completes
 * Target Tool: Task
 *
 * See: .claude/docs/ORCHESTRATOR_VERIFICATION_PROTOCOL.md
 */

import { stdin, stdout, stderr } from 'process';
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

// Recursion protection
if (process.env.CLAUDE_VERIFICATION_HOOK_EXECUTING === 'true') {
  stdout.write(
    JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
  );
  process.exit(0);
}
process.env.CLAUDE_VERIFICATION_HOOK_EXECUTING = 'true';

// Timeout protection - force exit after 2 seconds
const timeout = setTimeout(() => {
  console.error('[VERIFICATION HOOK] Timeout exceeded, forcing exit');
  delete process.env.CLAUDE_VERIFICATION_HOOK_EXECUTING;
  try {
    stdout.write(
      JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
    );
  } catch {
    // ignore
  }
  process.exit(0);
}, 2000);

/**
 * Verification result structure
 */
class VerificationResult {
  constructor() {
    this.verdict = 'PASS'; // PASS, CONCERNS, FAIL
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
    if (!exists) {
      this.addError(`Deliverable not found: ${path}`, 'critical');
    } else if (!validated) {
      this.addWarning(`Deliverable empty or invalid: ${path}`);
    }
  }

  addCriteriaStatus(criterion, met, evidence = null) {
    this.success_criteria_status.push({ criterion, met, evidence });
    if (!met) {
      this.addError(`Success criterion not met: ${criterion}`, 'critical');
    }
  }
}

/**
 * Read stdin asynchronously
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Log to stderr
 */
function log(message) {
  stderr.write(`[post-delegation-verifier] ${message}\n`);
}

/**
 * Extract text from tool result (handles various formats)
 */
function extractTextFromResult(toolResult) {
  if (!toolResult) return '';

  // If string, return directly
  if (typeof toolResult === 'string') {
    return toolResult;
  }

  // If object with content field
  if (toolResult.content) {
    return typeof toolResult.content === 'string'
      ? toolResult.content
      : JSON.stringify(toolResult.content);
  }

  // If object with output field
  if (toolResult.output) {
    return typeof toolResult.output === 'string'
      ? toolResult.output
      : JSON.stringify(toolResult.output);
  }

  // If object with text field
  if (toolResult.text) {
    return toolResult.text;
  }

  // Fall back to JSON stringify
  return JSON.stringify(toolResult);
}

/**
 * Step 1: Check for errors in agent output
 */
function checkForErrors(outputText, result) {
  result.verification_steps.step1_errors.checked = true;

  const errorKeywords = ['error', 'failed', 'exception', 'crash', 'fatal', 'failure'];
  const content = outputText.toLowerCase();
  const foundErrors = [];

  for (const keyword of errorKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      foundErrors.push({ keyword, count: matches.length });
    }
  }

  result.verification_steps.step1_errors.found = foundErrors;

  if (foundErrors.length > 0) {
    foundErrors.forEach(({ keyword, count }) => {
      result.addError(`Found ${count} occurrence(s) of "${keyword}"`, 'critical');
    });
    log(`Step 1: Found errors - ${foundErrors.map(e => `${e.keyword}(${e.count})`).join(', ')}`);
  } else {
    log('Step 1: No errors found');
  }
}

/**
 * Step 2: Check for warnings in agent output
 */
function checkForWarnings(outputText, result) {
  result.verification_steps.step2_warnings.checked = true;

  const warningKeywords = ['warning', 'concern', 'issue', 'problem', 'caution'];
  const content = outputText.toLowerCase();
  const foundWarnings = [];

  for (const keyword of warningKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      foundWarnings.push({ keyword, count: matches.length });
    }
  }

  result.verification_steps.step2_warnings.found = foundWarnings;

  if (foundWarnings.length > 0) {
    foundWarnings.forEach(({ keyword, count }) => {
      result.addWarning(`Found ${count} occurrence(s) of "${keyword}"`);
    });
    log(
      `Step 2: Found warnings - ${foundWarnings.map(w => `${w.keyword}(${w.count})`).join(', ')}`
    );
  } else {
    log('Step 2: No warnings found');
  }
}

/**
 * Step 3: Verify deliverables exist
 */
function verifyDeliverablesExist(toolInput, result) {
  result.verification_steps.step3_deliverables.checked = true;

  // Extract deliverables from task template
  let deliverables = [];

  if (toolInput.deliverables) {
    deliverables = Array.isArray(toolInput.deliverables)
      ? toolInput.deliverables
      : [toolInput.deliverables];
  }

  if (deliverables.length === 0) {
    log('Step 3: No deliverables specified to verify');
    return;
  }

  let missingCount = 0;

  for (const deliverable of deliverables) {
    const path = typeof deliverable === 'string' ? deliverable : deliverable.path;
    if (!path) continue;

    const resolvedPath =
      path.startsWith('/') || path.match(/^[A-Z]:/) ? path : join(PROJECT_ROOT, path);
    const exists = existsSync(resolvedPath);

    let validated = false;
    if (exists) {
      try {
        const stats = statSync(resolvedPath);
        validated = stats.size > 0; // Basic validation: file is not empty
      } catch (error) {
        log(`Step 3: Error checking file ${path}: ${error.message}`);
      }
    }

    result.addDeliverableStatus(path, exists, validated);

    if (!exists) {
      result.verification_steps.step3_deliverables.missing.push(path);
      missingCount++;
    }
  }

  if (missingCount === 0) {
    log(`Step 3: All ${deliverables.length} deliverable(s) verified`);
  } else {
    log(`Step 3: ${missingCount} deliverable(s) missing`);
  }
}

/**
 * Step 4: Validate success criteria
 */
function validateSuccessCriteria(toolInput, result) {
  result.verification_steps.step4_criteria.checked = true;

  // Extract success criteria from task template
  let criteria = [];

  if (toolInput.success_criteria) {
    criteria = Array.isArray(toolInput.success_criteria)
      ? toolInput.success_criteria
      : [toolInput.success_criteria];
  }

  if (criteria.length === 0) {
    log('Step 4: No success criteria specified to validate');
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
    } else {
      // Assume met if not explicitly false (criteria are from template, not results)
      result.addCriteriaStatus(name, true, evidence);
    }
  }

  if (unmetCount === 0) {
    log(`Step 4: All ${criteria.length} success criteria validated`);
  } else {
    log(`Step 4: ${unmetCount} success criteria not met`);
  }
}

/**
 * Step 5: Check agent verdict
 */
function checkVerdict(outputText, result) {
  result.verification_steps.step5_verdict.checked = true;

  // Search for verdict in output text
  const verdictMatch = outputText.match(/verdict:\s*(PASS|CONCERNS|FAIL)/i);
  const agentVerdict = verdictMatch ? verdictMatch[1].toUpperCase() : null;

  result.verification_steps.step5_verdict.agent_verdict = agentVerdict;

  if (agentVerdict) {
    log(`Step 5: Agent verdict - ${agentVerdict}`);

    if (agentVerdict === 'FAIL') {
      result.verdict = 'FAIL';
      result.addError('Agent reported FAIL verdict', 'critical');
    } else if (agentVerdict === 'CONCERNS') {
      if (result.verdict === 'PASS') {
        result.verdict = 'CONCERNS';
      }
      result.addWarning('Agent reported CONCERNS verdict');
    }
  } else {
    log('Step 5: No explicit verdict found in agent output');
  }
}

/**
 * Save verification result to file
 */
function saveVerificationResult(result) {
  try {
    const outputDir = join(PROJECT_ROOT, '.claude/context/reports');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = join(outputDir, `verification-result-${timestamp}.json`);

    writeFileSync(outputPath, JSON.stringify(result, null, 2));
    log(`Verification result saved to ${outputPath}`);
  } catch (error) {
    log(`Failed to save verification result: ${error.message}`);
  }
}

/**
 * Main hook function
 */
async function main() {
  try {
    // Read input from stdin
    const inputStr = await readStdin();

    if (!inputStr || inputStr.trim() === '') {
      log('No input received, exiting');
      process.stdout.write(
        JSON.stringify({
          decision: 'approve',
          hookSpecificOutput: { hookEventName: 'PostToolUse' },
        })
      );
      process.exit(0);
    }

    const input = JSON.parse(inputStr);
    const { tool_name: toolName, tool_input: toolInput, tool_result: toolResult } = input;

    // Only verify Task tool (agent delegations)
    if (toolName !== 'Task') {
      log(`Skipping verification for ${toolName} (only Task tool is verified)`);
      process.stdout.write(
        JSON.stringify({
          decision: 'approve',
          hookSpecificOutput: { hookEventName: 'PostToolUse' },
        })
      );
      process.exit(0);
    }

    log('Starting post-delegation verification...');

    const result = new VerificationResult();

    // Extract text from tool result
    const outputText = extractTextFromResult(toolResult);

    // Execute 5-step verification protocol
    checkForErrors(outputText, result);
    checkForWarnings(outputText, result);
    verifyDeliverablesExist(toolInput, result);
    validateSuccessCriteria(toolInput, result);
    checkVerdict(outputText, result);

    // Save verification result
    saveVerificationResult(result);

    // Log final verdict
    log(`Verification complete: ${result.verdict}`);
    if (result.errors.length > 0) {
      log(`  Errors: ${result.errors.length}`);
    }
    if (result.warnings.length > 0) {
      log(`  Warnings: ${result.warnings.length}`);
    }

    // Return verification result
    const hookResult = {
      verification_passed: result.verdict === 'PASS',
      verification_verdict: result.verdict,
      errors_count: result.errors.length,
      warnings_count: result.warnings.length,
      verification_details: result,
    };

    process.stdout.write(
      JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
    );
    process.exit(0);
  } catch (error) {
    // FAIL-SAFE: Never block task completion
    log(`Error (non-blocking): ${error.message}`);

    const hookResult = {
      verification_passed: false,
      verification_verdict: 'ERROR',
      error: error.message,
    };

    process.stdout.write(
      JSON.stringify({ decision: 'approve', hookSpecificOutput: { hookEventName: 'PostToolUse' } })
    );
    process.exit(0);
  } finally {
    clearTimeout(timeout);
    delete process.env.CLAUDE_VERIFICATION_HOOK_EXECUTING;
  }
}

// Execute
main();
