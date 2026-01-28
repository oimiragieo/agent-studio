#!/usr/bin/env node
/**
 * Workflow Validator
 * ==================
 *
 * Validates workflow YAML files for the EVOLVE system.
 * Checks EVOLVE phase compliance, gates, rollback actions, and iron laws.
 *
 * Usage:
 *   const { WorkflowValidator, validateEvolvePhases } = require('./workflow-validator.cjs');
 *
 *   const validator = new WorkflowValidator();
 *   const result = await validator.validate('/path/to/workflow.yaml');
 *   const allResults = await validator.validateAll('/path/to/workflows/');
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Import parseWorkflow from workflow-engine
const { parseWorkflow } = require('./workflow-engine.cjs');

// =============================================================================
// Constants
// =============================================================================

/**
 * Required EVOLVE phases in order
 */
const EVOLVE_PHASES = ['evaluate', 'validate', 'obtain', 'lock', 'verify', 'enable'];

/**
 * Valid gate types
 */
const VALID_GATE_TYPES = ['assertion', 'research', 'file_exists', 'registration'];

/**
 * Valid rollback strategies
 */
const VALID_ROLLBACK_STRATEGIES = ['saga', 'checkpoint', 'manual'];

/**
 * Required gate fields by type
 */
const GATE_REQUIRED_FIELDS = {
  assertion: ['condition', 'message'],
  research: ['minQueries', 'minSources'],
  file_exists: ['path'],
  registration: ['targets'],
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate that a workflow has all EVOLVE phases
 *
 * @param {Object} workflow - Parsed workflow definition
 * @returns {{ valid: boolean, missing: string[], warnings: string[] }}
 */
function validateEvolvePhases(workflow) {
  const result = {
    valid: true,
    missing: [],
    warnings: [],
  };

  if (!workflow.phases) {
    result.valid = false;
    result.missing = EVOLVE_PHASES;
    return result;
  }

  const presentPhases = Object.keys(workflow.phases).map(p => p.toLowerCase());

  for (const phase of EVOLVE_PHASES) {
    if (!presentPhases.includes(phase)) {
      result.missing.push(phase);
      result.valid = false;
    }
  }

  return result;
}

/**
 * Check for duplicate step IDs across all phases
 *
 * @param {Object} workflow - Parsed workflow definition
 * @returns {{ valid: boolean, duplicates: string[] }}
 */
function checkDuplicateStepIds(workflow) {
  const result = {
    valid: true,
    duplicates: [],
  };

  if (!workflow.phases) {
    return result;
  }

  const seenIds = new Set();

  for (const [, phaseConfig] of Object.entries(workflow.phases)) {
    if (phaseConfig && phaseConfig.steps) {
      for (const step of phaseConfig.steps) {
        if (step.id) {
          if (seenIds.has(step.id)) {
            result.duplicates.push(step.id);
            result.valid = false;
          }
          seenIds.add(step.id);
        }
      }
    }
  }

  return result;
}

/**
 * Validate a single step's schema
 *
 * @param {Object} step - Step definition
 * @param {string} phaseName - Name of the phase
 * @param {number} stepNumber - 1-based step number for error messages
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateSingleStep(step, phaseName, stepNumber) {
  const errors = [];

  // Check for required 'id' field
  if (!step.id) {
    errors.push(`Phase ${phaseName}, Step ${stepNumber}: missing 'id'`);
  }

  // Check for required 'handler' or 'action' field
  if (!step.handler && !step.action) {
    errors.push(`Phase ${phaseName}, Step ${stepNumber}: missing 'handler' or 'action'`);
  }

  return errors;
}

/**
 * Validate step schema (required fields: id, handler/action)
 *
 * @param {Object} workflow - Parsed workflow definition
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateStepSchema(workflow) {
  const result = {
    valid: true,
    errors: [],
  };

  if (!workflow.phases) {
    return result;
  }

  for (const [phaseName, phaseConfig] of Object.entries(workflow.phases)) {
    if (phaseConfig && phaseConfig.steps) {
      for (let stepIndex = 0; stepIndex < phaseConfig.steps.length; stepIndex++) {
        const step = phaseConfig.steps[stepIndex];
        const stepNumber = stepIndex + 1;
        const stepErrors = validateSingleStep(step, phaseName, stepNumber);

        if (stepErrors.length > 0) {
          result.errors.push(...stepErrors);
          result.valid = false;
        }
      }
    }
  }

  return result;
}

/**
 * Check if workflow has compensate steps but no rollback config
 *
 * @param {Object} workflow - Parsed workflow definition
 * @returns {boolean} True if has compensate steps
 */
function hasCompensateSteps(workflow) {
  if (!workflow.phases) {
    return false;
  }

  for (const [, phaseConfig] of Object.entries(workflow.phases)) {
    if (phaseConfig && phaseConfig.steps) {
      for (const step of phaseConfig.steps) {
        if (step.compensate) {
          return true;
        }
      }
    }
  }

  return false;
}

// =============================================================================
// WorkflowValidator Class
// =============================================================================

/**
 * Validates workflow YAML files
 */
class WorkflowValidator {
  /**
   * Create a new WorkflowValidator
   *
   * @param {Object} options - Validator options
   * @param {boolean} options.strict - Enable strict validation
   */
  constructor(options = {}) {
    this.options = {
      strict: options.strict || false,
    };
  }

  /**
   * Validate a single workflow file
   *
   * @param {string} workflowPath - Path to workflow YAML file
   * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
   */
  async validate(workflowPath) {
    const result = {
      path: workflowPath,
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Read and parse workflow
      const content = await fs.promises.readFile(workflowPath, 'utf-8');
      const workflow = parseWorkflow(content);

      // Required fields
      if (!workflow.name) {
        result.errors.push('Missing required field: name');
        result.valid = false;
      }

      if (!workflow.phases) {
        result.errors.push('Missing required field: phases');
        result.valid = false;
        return result;
      }

      // Check EVOLVE phases
      const phaseResult = validateEvolvePhases(workflow);
      if (!phaseResult.valid) {
        for (const missing of phaseResult.missing) {
          result.errors.push(`Missing EVOLVE phase: ${missing}`);
        }
        result.valid = false;
      }

      // Check duplicate step IDs
      const dupResult = checkDuplicateStepIds(workflow);
      if (!dupResult.valid) {
        for (const dup of dupResult.duplicates) {
          result.errors.push(`Duplicate step ID: ${dup}`);
        }
        result.valid = false;
      }

      // Check step schema
      const stepSchemaResult = this.validateStepSchema(workflow);
      if (!stepSchemaResult.valid) {
        result.errors.push(...stepSchemaResult.errors);
        result.valid = false;
      }

      // Check gates
      const gateResult = this.checkGates(workflow);
      if (!gateResult.valid) {
        result.errors.push(...gateResult.errors);
        result.valid = false;
      }

      // Check rollback actions
      const rollbackResult = this.checkRollbackActions(workflow);
      if (!rollbackResult.valid) {
        result.errors.push(...rollbackResult.errors);
        result.valid = false;
      }
      if (rollbackResult.warnings) {
        result.warnings.push(...rollbackResult.warnings);
      }

      // Check iron laws
      const ironLawsResult = this.checkIronLaws(workflow);
      if (ironLawsResult.warnings) {
        result.warnings.push(...ironLawsResult.warnings);
      }

      // Check for compensate steps without rollback
      if (hasCompensateSteps(workflow) && !workflow.rollback) {
        result.warnings.push('Workflow has compensate steps but no rollback configuration');
      }
    } catch (e) {
      result.errors.push(`Failed to parse workflow: ${e.message}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate all workflows in a directory
   *
   * @param {string} workflowsDir - Directory containing workflow files
   * @returns {Promise<Array<{path: string, valid: boolean, errors: string[], warnings: string[]}>>}
   */
  async validateAll(workflowsDir) {
    const results = [];

    if (!fs.existsSync(workflowsDir)) {
      return results;
    }

    const files = fs.readdirSync(workflowsDir);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const fullPath = path.join(workflowsDir, file);
        const result = await this.validate(fullPath);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Validate step schema (required fields: id, handler/action)
   *
   * @param {Object} workflow - Parsed workflow definition
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateStepSchema(workflow) {
    return validateStepSchema(workflow);
  }

  /**
   * Check gate configurations
   *
   * @param {Object} workflow - Parsed workflow definition
   * @returns {{ valid: boolean, errors: string[] }}
   */
  checkGates(workflow) {
    const result = {
      valid: true,
      errors: [],
    };

    if (!workflow.phases) {
      return result;
    }

    for (const [phaseName, phaseConfig] of Object.entries(workflow.phases)) {
      if (phaseConfig && phaseConfig.gates) {
        for (let i = 0; i < phaseConfig.gates.length; i++) {
          const gate = phaseConfig.gates[i];
          const gateNum = i + 1;

          // Check gate type
          if (gate.type && !VALID_GATE_TYPES.includes(gate.type)) {
            result.errors.push(
              `Phase ${phaseName} gate ${gateNum}: Invalid gate type '${gate.type}'`
            );
            result.valid = false;
          }

          // Check required fields based on type
          if (gate.type === 'assertion') {
            if (!gate.condition) {
              result.errors.push(
                `Phase ${phaseName} gate ${gateNum}: Assertion gate missing condition`
              );
              result.valid = false;
            }
            if (!gate.message) {
              result.errors.push(
                `Phase ${phaseName} gate ${gateNum}: Assertion gate missing message`
              );
              result.valid = false;
            }
          }

          if (gate.type === 'research') {
            if (gate.minQueries === undefined) {
              result.errors.push(
                `Phase ${phaseName} gate ${gateNum}: Research gate missing minQueries`
              );
              result.valid = false;
            }
            if (gate.minSources === undefined) {
              result.errors.push(
                `Phase ${phaseName} gate ${gateNum}: Research gate missing minSources`
              );
              result.valid = false;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Check rollback action configurations
   *
   * @param {Object} workflow - Parsed workflow definition
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  checkRollbackActions(workflow) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!workflow.rollback) {
      // No rollback is OK if no compensate steps
      return result;
    }

    // Check strategy
    if (
      workflow.rollback.strategy &&
      !VALID_ROLLBACK_STRATEGIES.includes(workflow.rollback.strategy)
    ) {
      result.errors.push(`Invalid rollback strategy: ${workflow.rollback.strategy}`);
      result.valid = false;
    }

    // Check compensations
    if (!workflow.rollback.compensations || workflow.rollback.compensations.length === 0) {
      result.warnings.push('Rollback section has no compensations defined');
    }

    return result;
  }

  /**
   * Check iron laws in metadata
   *
   * @param {Object} workflow - Parsed workflow definition
   * @returns {{ valid: boolean, warnings: string[] }}
   */
  checkIronLaws(workflow) {
    const result = {
      valid: true,
      warnings: [],
    };

    if (
      !workflow.metadata ||
      !workflow.metadata.iron_laws ||
      workflow.metadata.iron_laws.length === 0
    ) {
      result.warnings.push('Workflow has no iron laws defined in metadata');
    }

    return result;
  }

  /**
   * Generate a validation report
   *
   * @param {Array} results - Array of validation results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    const lines = [];
    lines.push('Workflow Validation Report');
    lines.push('==========================\n');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
      const status = result.valid ? '✓ PASS' : '✗ FAIL';
      const fileName = path.basename(result.path);

      lines.push(`${status} - ${fileName}`);

      if (!result.valid && result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          lines.push(`  Error: ${error}`);
        }
      }

      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          lines.push(`  Warning: ${warning}`);
        }
      }

      if (result.valid) {
        passed++;
      } else {
        failed++;
      }

      lines.push('');
    }

    lines.push('Summary');
    lines.push('-------');
    lines.push(`Total: ${results.length} workflows`);
    lines.push(`Passed: ${passed}`);
    lines.push(`Failed: ${failed}`);

    return lines.join('\n');
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node workflow-validator.cjs <workflow-path|workflows-dir>');
    process.exit(1);
  }

  const targetPath = args[0];
  const validator = new WorkflowValidator();

  if (fs.statSync(targetPath).isDirectory()) {
    // Validate all workflows in directory
    const results = await validator.validateAll(targetPath);
    const report = validator.generateReport(results);
    console.log(report);

    const failed = results.filter(r => !r.valid).length;
    process.exit(failed > 0 ? 1 : 0);
  } else {
    // Validate single workflow
    const result = await validator.validate(targetPath);

    if (result.valid) {
      console.log(`✓ ${targetPath} is valid`);
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }
      process.exit(0);
    } else {
      console.log(`✗ ${targetPath} is invalid`);
      console.log('\nErrors:');
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
  });
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  WorkflowValidator,
  validateEvolvePhases,
  checkDuplicateStepIds,
  validateStepSchema,
  validateSingleStep,
  hasCompensateSteps,
  EVOLVE_PHASES,
  VALID_GATE_TYPES,
  VALID_ROLLBACK_STRATEGIES,
};
