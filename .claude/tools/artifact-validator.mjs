#!/usr/bin/env node
/**
 * Artifact Validator - Enforces strict artifact contract
 * 
 * Every step must produce:
 * 1. Artifact(s) - schema-validated JSON files
 * 2. Gate file - pass/fail + errors
 * 3. Reasoning file - structured JSON with minimal reasoning
 * 
 * Usage:
 *   import { validateArtifactContract, enforceArtifactContract } from './artifact-validator.mjs';
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getRunDirectoryStructure, readArtifactRegistry, getArtifactsArray } from './run-manager.mjs';
import { resolveArtifactPath, resolveGatePath, resolveReasoningPath } from './path-resolver.mjs';

/**
 * Validate artifact contract for a step
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} options - Validation options
 * @param {boolean} options.requireSchema - Require schema validation (default: true)
 * @param {boolean} options.requireGate - Require gate file (default: true)
 * @param {boolean} options.requireReasoning - Require reasoning file (default: true)
 * @returns {Object} Validation result
 */
export async function validateArtifactContract(runId, step, options = {}) {
  const {
    requireSchema = true,
    requireGate = true,
    requireReasoning = true
  } = options;
  
  const errors = [];
  const warnings = [];
  const runDirs = getRunDirectoryStructure(runId);
  
  // Read artifact registry
  let artifactRegistry;
  try {
    artifactRegistry = await readArtifactRegistry(runId);
  } catch (error) {
    errors.push(`Could not read artifact registry: ${error.message}`);
    return {
      valid: false,
      errors,
      warnings,
      artifacts: {},
      gate: null,
      reasoning: null
    };
  }

  // Find artifacts for this step using shared helper
  const artifactsArray = getArtifactsArray(artifactRegistry);
  const stepArtifacts = artifactsArray.filter(a => a.step === step);
  
  if (stepArtifacts.length === 0) {
    errors.push(`No artifacts registered for step ${step}`);
  }
  
  // Validate each artifact
  const validatedArtifacts = [];
  for (const artifact of stepArtifacts) {
    const artifactPath = artifact.path || resolveArtifactPath(runId, artifact.name);
    
    if (!existsSync(artifactPath)) {
      errors.push(`Artifact file not found: ${artifactPath}`);
      continue;
    }
    
    // Check if artifact is valid JSON
    try {
      const artifactContent = JSON.parse(readFileSync(artifactPath, 'utf-8'));
      validatedArtifacts.push({
        name: artifact.name,
        path: artifactPath,
        valid: true,
        validationStatus: artifact.validationStatus || 'unknown'
      });
    } catch (error) {
      errors.push(`Artifact ${artifact.name} is not valid JSON: ${error.message}`);
      validatedArtifacts.push({
        name: artifact.name,
        path: artifactPath,
        valid: false,
        error: error.message
      });
    }
  }
  
  // Validate gate file
  const gatePath = resolveGatePath(runId, step);
  let gate = null;
  
  if (requireGate) {
    if (!existsSync(gatePath)) {
      errors.push(`Gate file not found: ${gatePath}`);
    } else {
      try {
        const gateContent = JSON.parse(readFileSync(gatePath, 'utf-8'));
        gate = {
          path: gatePath,
          valid: gateContent.valid === true,
          errors: gateContent.errors || [],
          warnings: gateContent.warnings || []
        };
        
        if (!gate.valid) {
          errors.push(`Gate validation failed for step ${step}`);
          if (gate.errors.length > 0) {
            errors.push(...gate.errors.map(e => `  - ${e}`));
          }
        }
      } catch (error) {
        errors.push(`Gate file is not valid JSON: ${error.message}`);
      }
    }
  } else {
    if (existsSync(gatePath)) {
      warnings.push(`Gate file exists but is not required: ${gatePath}`);
    }
  }
  
  // Validate reasoning file
  const reasoningPath = resolveReasoningPath(runId, step);
  let reasoning = null;
  
  if (requireReasoning) {
    if (!existsSync(reasoningPath)) {
      errors.push(`Reasoning file not found: ${reasoningPath}`);
    } else {
      try {
        const reasoningContent = JSON.parse(readFileSync(reasoningPath, 'utf-8'));
        reasoning = {
          path: reasoningPath,
          valid: true,
          content: reasoningContent
        };
        
        // Validate reasoning structure (should have minimal fields)
        if (!reasoningContent.step && !reasoningContent.reasoning) {
          warnings.push(`Reasoning file missing expected fields (step, reasoning)`);
        }
      } catch (error) {
        errors.push(`Reasoning file is not valid JSON: ${error.message}`);
      }
    }
  } else {
    if (existsSync(reasoningPath)) {
      warnings.push(`Reasoning file exists but is not required: ${reasoningPath}`);
    }
  }
  
  // Schema validation (if required)
  if (requireSchema && stepArtifacts.length > 0) {
    // Check if artifacts have schema validation status
    const artifactsWithoutSchema = stepArtifacts.filter(a => 
      !a.schema || a.validationStatus === 'unknown'
    );
    
    if (artifactsWithoutSchema.length > 0) {
      warnings.push(`Some artifacts do not have schema validation: ${artifactsWithoutSchema.map(a => a.name).join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    artifacts: validatedArtifacts,
    gate,
    reasoning,
    step
  };
}

/**
 * Enforce artifact contract - fail fast if contract not met
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} options - Validation options
 * @throws {Error} If contract is not met
 */
export async function enforceArtifactContract(runId, step, options = {}) {
  const result = await validateArtifactContract(runId, step, options);
  
  if (!result.valid) {
    const errorMessage = `Artifact contract violation for step ${step}:\n` +
      result.errors.map(e => `  - ${e}`).join('\n');
    throw new Error(errorMessage);
  }
  
  if (result.warnings.length > 0) {
    console.warn(`⚠️  Artifact contract warnings for step ${step}:`);
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }
  
  return result;
}

/**
 * Check if artifact contract is satisfied (non-throwing)
 * @param {string} runId - Run identifier
 * @param {number} step - Step number
 * @param {Object} options - Validation options
 * @returns {Promise<boolean>} True if contract is satisfied
 */
export async function checkArtifactContract(runId, step, options = {}) {
  const result = await validateArtifactContract(runId, step, options);
  return result.valid;
}

export default {
  validateArtifactContract,
  enforceArtifactContract,
  checkArtifactContract
};

