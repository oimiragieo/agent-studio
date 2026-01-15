#!/usr/bin/env node
/**
 * Signoff Validator - Workflow Signoff Validation Tool
 *
 * Validates that required signoff artifacts exist and meet quality criteria
 * before allowing workflow completion. Uses JSON schema validation with Ajv.
 *
 * Usage:
 *   Programmatic:
 *     import { validateWorkflowSignoffs } from './signoff-validator.mjs';
 *     const result = await validateWorkflowSignoffs(workflowId, workflow);
 *
 *   CLI:
 *     node signoff-validator.mjs --workflow-id wf-123 --workflow fullstack
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { resolveConfigPath } from './context-path-resolver.mjs';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load signoff matrix configuration
 * @returns {Promise<Object>} Signoff matrix
 */
async function loadSignoffMatrix() {
  try {
    const matrixPath = resolveConfigPath('signoff-matrix.json', { read: true });
    const content = await readFile(matrixPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load signoff matrix: ${error.message}`);
  }
}

/**
 * Check if artifact file exists
 * @param {string} path - Path to artifact (relative or absolute)
 * @returns {boolean} True if artifact exists
 */
function artifactExists(path) {
  // Handle both absolute and relative paths
  const absolutePath =
    path.startsWith('/') || path.includes(':\\') ? path : join(process.cwd(), path);

  return existsSync(absolutePath);
}

/**
 * Validate signoff artifact against JSON schema
 * @param {string} artifactPath - Path to artifact JSON file
 * @param {string} schemaPath - Path to JSON schema file
 * @returns {Promise<Object>} Validation result
 */
async function validateSignoff(artifactPath, schemaPath) {
  try {
    // Check if artifact exists
    if (!artifactExists(artifactPath)) {
      return {
        valid: false,
        error: `Artifact not found: ${artifactPath}`,
        errors: [],
      };
    }

    // Load artifact
    const artifactContent = await readFile(artifactPath, 'utf-8');
    const artifact = JSON.parse(artifactContent);

    // Check if schema exists
    const absoluteSchemaPath =
      schemaPath.startsWith('/') || schemaPath.includes(':\\')
        ? schemaPath
        : join(process.cwd(), schemaPath);

    if (!existsSync(absoluteSchemaPath)) {
      return {
        valid: false,
        error: `Schema not found: ${schemaPath}`,
        errors: [],
      };
    }

    // Load schema
    const schemaContent = await readFile(absoluteSchemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Validate using Ajv
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(artifact);

    return {
      valid,
      artifact,
      errors: validate.errors || [],
      error: valid ? null : 'Schema validation failed',
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      errors: [],
    };
  }
}

/**
 * Check if signoff passes conditions
 * @param {Object} artifact - Signoff artifact data
 * @param {Object} conditions - Conditions to check
 * @returns {Object} Condition check result
 */
function signoffPasses(artifact, conditions) {
  const failures = [];

  for (const [key, condition] of Object.entries(conditions)) {
    const value = artifact[key];

    if (value === undefined) {
      failures.push({
        condition: key,
        expected: condition,
        actual: 'undefined',
        reason: 'Field missing from artifact',
      });
      continue;
    }

    // Handle different condition types
    if (typeof condition === 'string' && condition.startsWith('>=')) {
      const threshold = parseFloat(condition.substring(2).replace('%', ''));
      let actualValue = parseFloat(value);

      // Handle percentage strings
      if (typeof value === 'string' && value.includes('%')) {
        actualValue = parseFloat(value.replace('%', ''));
      }

      if (actualValue < threshold) {
        failures.push({
          condition: key,
          expected: condition,
          actual: value,
          reason: `Value ${actualValue} is less than threshold ${threshold}`,
        });
      }
    } else if (typeof condition === 'number') {
      const actualValue = parseFloat(value);
      if (actualValue < condition) {
        failures.push({
          condition: key,
          expected: condition,
          actual: value,
          reason: `Value ${actualValue} is less than expected ${condition}`,
        });
      }
    } else if (typeof condition === 'boolean') {
      if (value !== condition) {
        failures.push({
          condition: key,
          expected: condition,
          actual: value,
          reason: `Expected ${condition} but got ${value}`,
        });
      }
    } else if (typeof condition === 'string') {
      if (value !== condition) {
        failures.push({
          condition: key,
          expected: condition,
          actual: value,
          reason: `Expected "${condition}" but got "${value}"`,
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Validate all signoffs for a workflow
 * @param {string} workflowId - Workflow identifier
 * @param {string} workflow - Workflow name (e.g., 'fullstack', 'incident')
 * @param {string} [task] - Task description for conditional signoff triggers
 * @returns {Promise<Object>} Validation result
 */
export async function validateWorkflowSignoffs(workflowId, workflow, task = '') {
  try {
    // Load signoff matrix
    const signoffMatrix = await loadSignoffMatrix();

    const workflowConfig = signoffMatrix.workflows[workflow];

    if (!workflowConfig) {
      return {
        workflow_id: workflowId,
        workflow,
        valid: false,
        error: `Unknown workflow: ${workflow}`,
        signoffs: [],
      };
    }

    const results = [];
    let allValid = true;

    // Validate required signoffs
    for (const signoff of workflowConfig.required_signoffs) {
      const artifactPath = join(process.cwd(), '.claude', 'context', 'artifacts', signoff.artifact);
      const validationResult = await validateSignoff(artifactPath, signoff.schema);

      let conditionResult = { passed: true, failures: [] };
      if (validationResult.valid && validationResult.artifact) {
        conditionResult = signoffPasses(validationResult.artifact, signoff.conditions);
      }

      const signoffValid = validationResult.valid && conditionResult.passed;

      results.push({
        type: signoff.type,
        required: true,
        artifact: signoff.artifact,
        schema: signoff.schema,
        agents: signoff.agents,
        schema_valid: validationResult.valid,
        conditions_passed: conditionResult.passed,
        valid: signoffValid,
        errors: validationResult.errors,
        condition_failures: conditionResult.failures,
        error: validationResult.error,
      });

      if (!signoffValid) {
        allValid = false;
      }
    }

    // Check conditional signoffs
    const taskLower = task.toLowerCase();
    for (const signoff of workflowConfig.conditional_signoffs || []) {
      const triggered = signoff.trigger_keywords.some(keyword =>
        taskLower.includes(keyword.toLowerCase())
      );

      if (!triggered) {
        results.push({
          type: signoff.type,
          required: false,
          triggered: false,
          artifact: signoff.artifact,
          schema: signoff.schema,
          agents: signoff.agents,
          valid: true,
          message: 'Not triggered by task keywords',
        });
        continue;
      }

      const artifactPath = join(process.cwd(), '.claude', 'context', 'artifacts', signoff.artifact);
      const validationResult = await validateSignoff(artifactPath, signoff.schema);

      let conditionResult = { passed: true, failures: [] };
      if (validationResult.valid && validationResult.artifact) {
        conditionResult = signoffPasses(validationResult.artifact, signoff.conditions);
      }

      const signoffValid = validationResult.valid && conditionResult.passed;

      results.push({
        type: signoff.type,
        required: false,
        triggered: true,
        artifact: signoff.artifact,
        schema: signoff.schema,
        agents: signoff.agents,
        schema_valid: validationResult.valid,
        conditions_passed: conditionResult.passed,
        valid: signoffValid,
        errors: validationResult.errors,
        condition_failures: conditionResult.failures,
        error: validationResult.error,
      });

      // Conditional signoffs are blocking if configured
      if (!signoffValid && !signoffMatrix.signoffRules.allow_conditional_override) {
        allValid = false;
      }
    }

    return {
      workflow_id: workflowId,
      workflow,
      valid: allValid,
      signoffs: results,
      summary: {
        total: results.length,
        required: results.filter(r => r.required).length,
        conditional: results.filter(r => !r.required).length,
        passed: results.filter(r => r.valid).length,
        failed: results.filter(r => !r.valid).length,
      },
      message: allValid
        ? 'All signoffs passed'
        : `Signoff validation failed: ${results.filter(r => !r.valid).length} signoff(s) did not pass`,
    };
  } catch (error) {
    return {
      workflow_id: workflowId,
      workflow,
      valid: false,
      error: error.message,
      signoffs: [],
    };
  }
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    workflowId: null,
    workflow: null,
    task: '',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--workflow-id' || arg === '-w') {
      parsed.workflowId = args[++i];
    } else if (arg === '--workflow' || arg === '-f') {
      parsed.workflow = args[++i];
    } else if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Signoff Validator - Workflow Signoff Validation Tool

Validates that required signoff artifacts exist and meet quality criteria.

USAGE:
  node signoff-validator.mjs --workflow-id <id> --workflow <name> [options]

OPTIONS:
  --workflow-id, -w <id>     Workflow identifier (required)
  --workflow, -f <name>      Workflow name (required)
  --task, -t <description>   Task description for conditional signoffs
  --help, -h                 Show this help message

EXAMPLES:
  node signoff-validator.mjs --workflow-id wf-123 --workflow fullstack
  node signoff-validator.mjs --workflow-id wf-123 --workflow fullstack --task "Add auth"

PROGRAMMATIC USE:
  import { validateWorkflowSignoffs } from './signoff-validator.mjs';

  const result = await validateWorkflowSignoffs(workflowId, workflow, task);

  if (result.valid) {
    console.log('All signoffs passed!');
  } else {
    console.log('Signoff failures:', result.signoffs.filter(s => !s.valid));
  }
`);
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.workflowId || !args.workflow) {
    console.error('Error: --workflow-id and --workflow are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    const result = await validateWorkflowSignoffs(args.workflowId, args.workflow, args.task);
    console.log(JSON.stringify(result, null, 2));

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(console.error);
}

export default {
  validateWorkflowSignoffs,
  validateSignoff,
  signoffPasses,
  artifactExists,
  loadSignoffMatrix,
};
