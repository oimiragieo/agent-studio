#!/usr/bin/env node
/**
 * Workflow Pre-Execution Validator
 *
 * Validates workflow configuration before execution:
 * - All required agents exist
 * - All artifact dependencies can be resolved
 * - All schemas exist and are valid
 * - Template variables are properly formatted
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import js-yaml for YAML parsing
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (error) {
  console.error('❌ Error: js-yaml package is required.');
  console.error('   Please install it: pnpm add -D js-yaml');
  process.exit(1);
}

/**
 * Validate workflow before execution
 * @param {string} workflowPath - Path to workflow YAML file
 * @returns {Object} Validation result with valid flag, errors, and warnings
 */
export function validateWorkflow(workflowPath) {
  const errors = [];
  const warnings = [];

  try {
    // Read and parse workflow YAML
    const workflowContent = readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(workflowContent);

    if (!workflow || !workflow.steps) {
      errors.push('Workflow file is missing or has no steps');
      return { valid: false, errors, warnings };
    }

    // Validate each step
    const stepNumbers = new Set();
    const artifactReferences = new Map(); // step -> [artifact references]
    const createdArtifacts = new Map(); // step -> [artifacts created]

    for (const step of workflow.steps) {
      const stepNum = String(step.step);

      // Check for duplicate step numbers
      if (stepNumbers.has(stepNum)) {
        errors.push(`Step ${stepNum}: Duplicate step number`);
      }
      stepNumbers.add(stepNum);

      // Validate agent exists
      if (step.agent) {
        const agentPath = resolve(__dirname, '../../agents', `${step.agent}.md`);
        if (!existsSync(agentPath)) {
          errors.push(`Step ${stepNum}: Agent '${step.agent}' not found at ${agentPath}`);
        }
      }

      // Validate schema exists if specified
      if (step.validation?.schema) {
        const schemaPath = resolveSchemaPath(step.validation.schema);
        if (!existsSync(schemaPath)) {
          errors.push(`Step ${stepNum}: Schema file not found: ${step.validation.schema}`);
        } else {
          // Validate schema is valid JSON
          try {
            JSON.parse(readFileSync(schemaPath, 'utf-8'));
          } catch (schemaError) {
            errors.push(`Step ${stepNum}: Schema file is invalid JSON: ${schemaError.message}`);
          }
        }
      }

      // Collect artifact references
      if (step.inputs && Array.isArray(step.inputs)) {
        const refs = [];
        for (const input of step.inputs) {
          if (typeof input === 'string' && input.includes('(from step')) {
            refs.push(input);
          }
        }
        if (refs.length > 0) {
          artifactReferences.set(stepNum, refs);
        }
      }

      // Collect created artifacts
      if (step.outputs && Array.isArray(step.outputs)) {
        const artifacts = [];
        for (const output of step.outputs) {
          if (typeof output === 'string' && output.endsWith('.json')) {
            artifacts.push(output);
          } else if (typeof output === 'object' && output.reasoning) {
            // Reasoning file - skip for dependency tracking
          }
        }
        if (artifacts.length > 0) {
          createdArtifacts.set(stepNum, artifacts);
        }
      }

      // Validate template variables in outputs
      if (step.outputs) {
        for (const output of step.outputs) {
          if (typeof output === 'string') {
            const templateVars = output.match(/\{\{([^}]+)\}\}/g);
            if (templateVars) {
              for (const varName of templateVars) {
                const varKey = varName.replace(/\{\{|\}\}/g, '');
                if (!['workflow_id', 'story_id', 'epic_id'].includes(varKey)) {
                  warnings.push(`Step ${stepNum}: Unknown template variable in output: ${varName}`);
                }
              }
            }
          }
        }
      }

      // Validate template variables in gate path
      if (step.validation?.gate) {
        const templateVars = step.validation.gate.match(/\{\{([^}]+)\}\}/g);
        if (templateVars) {
          for (const varName of templateVars) {
            const varKey = varName.replace(/\{\{|\}\}/g, '');
            if (!['workflow_id', 'story_id', 'epic_id'].includes(varKey)) {
              warnings.push(`Step ${stepNum}: Unknown template variable in gate path: ${varName}`);
            }
          }
        }
      }
    }

    // Validate artifact dependencies
    for (const [stepNum, refs] of artifactReferences.entries()) {
      for (const ref of refs) {
        // Parse artifact reference: "artifact.json (from step X)"
        const match = ref.match(/(.+?)\s*\(from step\s+([0-9.]+)/);
        if (match) {
          const artifactName = match[1].trim();
          const fromStep = match[2].trim();

          // Check if referenced step exists
          if (!stepNumbers.has(fromStep)) {
            errors.push(
              `Step ${stepNum}: References artifact from non-existent step ${fromStep}: ${artifactName}`
            );
            continue;
          }

          // Check if artifact is created by referenced step
          const created = createdArtifacts.get(fromStep) || [];
          const artifactFound = created.some(art => {
            // Handle template variables in artifact names
            const artPattern = art.replace(/\{\{[^}]+\}\}/g, '.*');
            return new RegExp(`^${artPattern}$`).test(artifactName) || art === artifactName;
          });

          if (!artifactFound) {
            errors.push(
              `Step ${stepNum}: References artifact '${artifactName}' from step ${fromStep}, but step ${fromStep} does not create it`
            );
          }
        }
      }
    }

    // Validate step ordering (steps should be in order)
    const sortedSteps = Array.from(stepNumbers)
      .map(s => {
        const num = parseFloat(s);
        return { step: s, num: isNaN(num) ? Infinity : num };
      })
      .sort((a, b) => a.num - b.num);

    // Check for gaps or out-of-order steps
    for (let i = 0; i < sortedSteps.length - 1; i++) {
      const current = sortedSteps[i].num;
      const next = sortedSteps[i + 1].num;
      if (next - current > 1 && current !== 0 && next !== 0.5) {
        warnings.push(
          `Step gap detected: Step ${sortedSteps[i].step} to ${sortedSteps[i + 1].step}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate workflow: ${error.message}`],
      warnings: [],
    };
  }
}

/**
 * Resolve schema path using same strategy as workflow files
 */
function resolveSchemaPath(relativePath) {
  // If path is already absolute, return as-is
  if (
    relativePath.startsWith('/') ||
    (process.platform === 'win32' && /^[A-Z]:/.test(relativePath))
  ) {
    return relativePath;
  }

  // Strategy 1: Resolve from project root (parent of .claude directory)
  const projectRoot = resolve(__dirname, '../..');
  const projectRootPath = resolve(projectRoot, relativePath);
  if (existsSync(projectRootPath)) {
    return projectRootPath;
  }

  // Strategy 2: Resolve from current working directory
  const cwdPath = resolve(process.cwd(), relativePath);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // Strategy 3: Resolve from script location
  const scriptPath = resolve(__dirname, relativePath);
  if (existsSync(scriptPath)) {
    return scriptPath;
  }

  // If none found, return project root path (will fail with clear error later)
  return projectRootPath;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const workflowPath = args[0];

  if (!workflowPath) {
    console.error('Usage: node workflow-validator.mjs <workflow-yaml-path>');
    process.exit(1);
  }

  const resolvedPath = resolve(process.cwd(), workflowPath);
  if (!existsSync(resolvedPath)) {
    console.error(`❌ Error: Workflow file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const result = validateWorkflow(resolvedPath);

  if (result.valid) {
    console.log('✅ Workflow validation: PASSED');
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    process.exit(0);
  } else {
    console.error('❌ Workflow validation: FAILED');
    console.error('\nErrors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    if (result.warnings.length > 0) {
      console.error('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.error(`  - ${warning}`));
    }
    process.exit(1);
  }
}
