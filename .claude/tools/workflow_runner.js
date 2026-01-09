#!/usr/bin/env node
/**
 * Workflow Runner
 *
 * Enhanced workflow runner that supports:
 * - Step validation gates
 * - Decision point evaluation
 * - Loop iteration management
 * - Phase transitions
 * - Dry-run validation
 * - CUJ simulation
 *
 * Usage:
 *   node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>] [--dry-run]
 *   node workflow_runner.js --workflow <yaml-path> --decision <decision-id> [--id <workflow-id>] [--dry-run]
 *   node workflow_runner.js --workflow <yaml-path> --loop <loop-type> [--id <workflow-id>] [--dry-run]
 *   node workflow_runner.js --workflow <yaml-path> --dry-run [--id <workflow-id>]
 *   node workflow_runner.js --cuj-simulation <cuj-id>
 *
 * Options:
 *   --dry-run              Validate workflow structure without executing or writing files (CI-friendly)
 *   --cuj-simulation       Simulate entire CUJ workflow end-to-end (validates all steps and success criteria)
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { evaluateDecision } from './workflow/decision-handler.mjs';
import { initializeLoop, advanceLoop, hasMoreIterations, getCurrentItem } from './workflow/loop-handler.mjs';
import { checkContextThreshold, recordContextUsage } from './context-monitor.mjs';
import { getRequiredTemplates } from './template-registry.mjs';
import { createRun, updateRun, readRun, registerArtifact, readArtifactRegistry, getRunDirectoryStructure } from './run-manager.mjs';
import { resolveArtifactPath, resolveGatePath, resolveReasoningPath } from './path-resolver.mjs';
import { enforceArtifactContract } from './artifact-validator.mjs';
import { updateRunSummary } from './dashboard-generator.mjs';
import { executeAgent } from './agent-executor.mjs';
import { injectSkillsForAgent } from './skill-injector.mjs';
import { validateSkillUsage, generateViolationReport } from './skill-validator.mjs';
import { validateExecutionGate } from './enforcement-gate.mjs';
import { createCheckpoint, restoreFromCheckpoint, listCheckpoints } from './checkpoint-manager.mjs';
import { executePlanRatingGate, checkPlanRating } from './plan-rating-gate.mjs';

// Import js-yaml for proper YAML parsing
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (error) {
  // In dry-run mode, js-yaml is optional (we'll do basic validation)
  const isDryRun = process.argv.includes('--dry-run');
  if (!isDryRun) {
    console.error('❌ Error: js-yaml package is required for workflow parsing.');
    console.error('   Please install it: pnpm add -D js-yaml');
    console.error('   Or use --dry-run mode for validation without execution');
    process.exit(1);
  }
  // In dry-run mode, we'll do basic YAML validation without full parsing
  yaml = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve workflow path from project root
 * Handles relative paths from config.yaml (e.g., .claude/workflows/...)
 * 
 * PATH RESOLUTION STRATEGY:
 * 
 * The workflow runner uses a multi-strategy approach to find workflow files:
 * 1. Absolute paths: If path starts with '/' (Unix) or 'C:' (Windows), use as-is
 * 2. Project root: Resolve from project root (parent of .claude directory)
 *    - This is the PRIMARY strategy and works when called from project root
 *    - workflow_runner.js is in .claude/tools/, so project root is ../..
 * 3. Current working directory: Fallback if project root resolution fails
 *    - Useful when called from subdirectories
 * 4. Script location: Final fallback relative to script's directory
 * 
 * EXPECTED WORKING DIRECTORY:
 * - Best practice: Run from project root directory
 * - Command: `node .claude/tools/workflow_runner.js --workflow .claude/workflows/<name>.yaml --step 0`
 * - The runner will automatically resolve paths relative to project root
 * 
 * EXAMPLES:
 * - From project root: `node .claude/tools/workflow_runner.js --workflow .claude/workflows/quick-flow.yaml --step 0`
 * - From any directory: Works due to fallback strategies, but project root is recommended
 */
function resolveWorkflowPath(relativePath) {
  // If path is already absolute, return as-is
  if (relativePath.startsWith('/') || (process.platform === 'win32' && /^[A-Z]:/.test(relativePath))) {
    return relativePath;
  }
  
  // Strategy 1: Resolve from project root (parent of .claude directory)
  // workflow_runner.js is in .claude/tools/, so go up two levels
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

/**
 * Resolve schema path using same strategy as workflow files
 * Uses multi-strategy approach: project root -> cwd -> script location
 */
function resolveSchemaPath(relativePath) {
  // If path is already absolute, return as-is
  if (relativePath.startsWith('/') || (process.platform === 'win32' && /^[A-Z]:/.test(relativePath))) {
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

/**
 * Generate a unique workflow ID
 * Format: <timestamp>-<random>
 */
function generateWorkflowId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Ensure artifact registry exists and is initialized for a workflow run
 * Creates run directory structure and initializes registry if not present
 *
 * @param {string} runId - Run identifier
 * @param {string} workflowName - Name of the workflow
 * @param {boolean} isDryRun - Whether in dry-run mode
 * @returns {Promise<Object>} Registry status
 */
async function ensureArtifactRegistry(runId, workflowName, isDryRun = false) {
  if (!runId) {
    throw new Error('Run ID is required to ensure artifact registry');
  }

  const runDirs = getRunDirectoryStructure(runId);

  // Check if run directory exists
  const runDirExists = existsSync(runDirs.run_dir);

  if (!runDirExists) {
    if (isDryRun) {
      console.log(`🔍 DRY-RUN: Would create run directory structure for ${runId}`);
      return { initialized: false, dry_run: true, run_id: runId };
    }

    // Create new run with registry
    try {
      await createRun({
        run_id: runId,
        workflow: workflowName,
        status: 'initializing'
      });
      console.log(`📁 Initialized run directory and artifact registry for ${runId}`);
    } catch (error) {
      throw new Error(`Failed to initialize artifact registry: ${error.message}`);
    }
  }

  // Verify registry exists and is valid
  try {
    const registry = await readArtifactRegistry(runId);

    if (!registry || typeof registry !== 'object') {
      throw new Error('Registry is invalid or empty');
    }

    // Check for required artifacts from previous steps if this isn't Step 0
    const artifactCount = Object.keys(registry.artifacts || {}).length;

    return {
      initialized: true,
      run_id: runId,
      artifact_count: artifactCount,
      registry_path: runDirs.registry_path
    };
  } catch (error) {
    if (isDryRun) {
      console.log(`🔍 DRY-RUN: Registry would be at ${runDirs.registry_path}`);
      return { initialized: false, dry_run: true, run_id: runId };
    }

    // Registry file is missing or corrupt - re-initialize
    console.warn(`⚠️  Registry corrupted or missing, re-initializing...`);

    try {
      await createRun({
        run_id: runId,
        workflow: workflowName,
        status: 'initializing'
      });
      console.log(`📁 Re-initialized artifact registry for ${runId}`);
      return { initialized: true, run_id: runId, artifact_count: 0, reinitialized: true };
    } catch (reinitError) {
      throw new Error(`Failed to re-initialize artifact registry: ${reinitError.message}`);
    }
  }
}

/**
 * Validate artifacts required for a step before execution
 * Checks that all required artifacts from previous steps exist and are validated
 *
 * @param {string} runId - Run identifier
 * @param {number} stepNumber - Current step number
 * @param {Array} requiredArtifacts - List of required artifact names
 * @returns {Promise<Object>} Validation result
 */
async function validateRequiredArtifacts(runId, stepNumber, requiredArtifacts = []) {
  if (!runId || requiredArtifacts.length === 0) {
    return { valid: true, missing: [], failed: [] };
  }

  const missing = [];
  const failed = [];

  try {
    const registry = await readArtifactRegistry(runId);
    const registeredArtifacts = registry.artifacts || {};

    for (const artifactName of requiredArtifacts) {
      const artifact = registeredArtifacts[artifactName];

      if (!artifact) {
        missing.push({
          name: artifactName,
          error: 'Artifact not found in registry'
        });
        continue;
      }

      // Check validation status
      if (artifact.validationStatus === 'fail') {
        failed.push({
          name: artifactName,
          step: artifact.step,
          error: 'Artifact validation failed'
        });
      } else if (artifact.validationStatus === 'pending') {
        // Pending is allowed for now - agent may still be working
        console.warn(`⚠️  Artifact ${artifactName} validation is pending`);
      }
    }

    return {
      valid: missing.length === 0 && failed.length === 0,
      missing,
      failed
    };
  } catch (error) {
    return {
      valid: false,
      missing: requiredArtifacts.map(name => ({ name, error: 'Registry read failed' })),
      failed: [],
      error: error.message
    };
  }
}

/**
 * Get skill requirements from workflow step configuration
 * Merges step-level skill_requirements with agent-level defaults from skill matrix
 * @param {Object} step - Workflow step configuration
 * @returns {Object} Merged skill requirements
 */
function getStepSkillRequirements(step) {
  // Step-level skill requirements (highest priority)
  const stepSkills = step.skill_requirements || {};

  return {
    required: stepSkills.required || [],
    recommended: stepSkills.recommended || [],
    triggered: stepSkills.triggered || [],
    validation: {
      mode: stepSkills.validation?.mode || 'warning', // 'blocking' or 'warning'
      enforce_usage: stepSkills.validation?.enforce_usage !== false // Default true
    }
  };
}

/**
 * Validate that required skills exist in .claude/skills/
 * @param {string[]} skills - Array of skill names to validate
 * @returns {Promise<Object>} Validation result with missing skills
 */
async function validateSkillAvailability(skills) {
  const missing = [];
  const projectRoot = resolve(__dirname, '../..');
  const skillsDir = join(projectRoot, '.claude/skills');

  for (const skillName of skills) {
    const skillPath = join(skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      missing.push({
        skill: skillName,
        path: skillPath,
        message: `SKILL.md not found for required skill: ${skillName}`
      });
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Record skill validation results in gate file
 * @param {string} workflowId - Workflow identifier
 * @param {number} stepNumber - Step number
 * @param {Object} skillValidation - Skill validation result
 * @param {string} gatePath - Path to gate file
 * @param {boolean} isDryRun - Whether in dry-run mode
 * @returns {Promise<void>}
 */
async function recordSkillValidation(workflowId, stepNumber, skillValidation, gatePath, isDryRun = false) {
  if (isDryRun) {
    console.log(`🔍 DRY-RUN: Would record skill validation in gate file: ${gatePath}`);
    return;
  }

  try {
    if (!existsSync(gatePath)) {
      console.warn(`⚠️  Gate file not found for skill validation recording: ${gatePath}`);
      return;
    }

    const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));

    // Add skill validation section
    gateData.skill_validation = {
      compliant: skillValidation.compliant,
      compliance_score: skillValidation.complianceScore,
      expected_skills: skillValidation.expected,
      used_skills: skillValidation.used,
      violations: skillValidation.violations,
      recommendation: skillValidation.recommendation,
      validated_at: new Date().toISOString()
    };

    // Update overall validity if skill validation failed
    if (!skillValidation.compliant) {
      gateData.valid = false;
      gateData.errors = gateData.errors || [];
      gateData.errors.push(`Skill compliance failure: ${skillValidation.violations.missingRequired.length} required skill(s) not used`);
    }

    writeFileSync(gatePath, JSON.stringify(gateData, null, 2), 'utf-8');
    console.log(`✅ Skill validation recorded in gate file`);
  } catch (error) {
    console.error(`❌ Failed to record skill validation: ${error.message}`);
  }
}

/**
 * Custom error class for skill compliance failures
 */
class SkillComplianceError extends Error {
  constructor(validation) {
    const message = `Skill compliance failure: ${validation.violations.missingRequired.length} required skill(s) not used`;
    super(message);
    this.name = 'SkillComplianceError';
    this.validation = validation;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  // Special handling for --user-requirements (can have hyphen in key)
  if (process.argv.includes('--user-requirements')) {
    const index = process.argv.indexOf('--user-requirements');
    if (index >= 0 && index + 1 < process.argv.length && !process.argv[index + 1].startsWith('--')) {
      parsed['user-requirements'] = process.argv[index + 1];
    }
  }

  // Special handling for --run-id (can have hyphen in key)
  if (process.argv.includes('--run-id')) {
    const index = process.argv.indexOf('--run-id');
    if (index >= 0 && index + 1 < process.argv.length && !process.argv[index + 1].startsWith('--')) {
      parsed['run-id'] = process.argv[index + 1];
    }
  }

  return parsed;
}

/**
 * Load and parse workflow YAML file
 */
/**
 * Normalize workflow YAML keys (map old keys to new keys)
 * @param {Object} workflow - Workflow object
 * @returns {Object} Normalized workflow
 */
function normalizeWorkflowKeys(workflow) {
  const normalized = JSON.parse(JSON.stringify(workflow)); // Deep clone
  const deprecationWarnings = [];
  
  // Key mapping: old key -> new key
  const keyMappings = {
    'customChecks': 'custom_checks',
    'secondaryOutputs': 'secondary_outputs',
    'securityChecks': 'security_checks'
  };
  
  // Recursively normalize keys
  function normalizeObject(obj, path = '') {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          normalizeObject(item, `${path}[${index}]`);
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [oldKey, newKey] of Object.entries(keyMappings)) {
        if (oldKey in obj) {
          // Warn about deprecated key
          deprecationWarnings.push({
            path: path || 'root',
            oldKey,
            newKey
          });
          
          // Map old key to new key
          if (!(newKey in obj)) {
            obj[newKey] = obj[oldKey];
          } else {
            // Both exist - prefer new key, warn about conflict
            deprecationWarnings.push({
              path: path || 'root',
              oldKey,
              newKey,
              conflict: true
            });
          }
          delete obj[oldKey];
        }
      }
      
      // Recursively process nested objects
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          normalizeObject(value, path ? `${path}.${key}` : key);
        }
      }
    }
  }
  
  normalizeObject(normalized);
  
  // Log warnings if any
  if (deprecationWarnings.length > 0) {
    console.warn(`⚠️  Workflow YAML uses deprecated keys. Please update to use snake_case:`);
    deprecationWarnings.forEach(w => {
      if (w.conflict) {
        console.warn(`   ${w.path}: Both '${w.oldKey}' and '${w.newKey}' found. Using '${w.newKey}'.`);
      } else {
        console.warn(`   ${w.path}: '${w.oldKey}' → '${w.newKey}'`);
      }
    });
  }
  
  return normalized;
}

function loadWorkflowYAML(workflowPath) {
  try {
    const content = readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.load(content);
    // Normalize keys (map old camelCase to new snake_case)
    return normalizeWorkflowKeys(workflow);
  } catch (error) {
    console.error(`❌ Error: Failed to parse workflow YAML at ${workflowPath}`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Detect un-interpolated template variables in a string
 */
function detectUninterpolatedVariables(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{\{[^}]+\}\}/g);
  return matches || [];
}

/**
 * Validate template variable syntax (properly closed)
 */
function validateTemplateVariableSyntax(str) {
  if (typeof str !== 'string') return { valid: true, errors: [] };
  
  const errors = [];
  // Check for unclosed variables: {{variable without closing }}
  const unclosedMatches = str.match(/\{\{[^}]*$/g);
  if (unclosedMatches) {
    errors.push(`Unclosed template variable: ${unclosedMatches[0]}`);
  }
  // Check for closing braces without opening
  const orphanedCloses = str.match(/^[^}]*\}\}/g);
  if (orphanedCloses) {
    errors.push(`Orphaned closing braces: ${orphanedCloses[0]}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate workflow_id format (safe for file paths)
 * workflow_id should only contain alphanumeric characters, hyphens, underscores, and dots
 * Should not contain path separators or other special characters that could break file paths
 */
function validateWorkflowIdFormat(workflowId) {
  if (!workflowId || typeof workflowId !== 'string') {
    return { valid: false, error: 'Workflow ID must be a non-empty string' };
  }
  
  // Allow alphanumeric, hyphens, underscores, dots, and colons (for timestamps)
  // Disallow: path separators (/ \), spaces, and other special characters
  const validPattern = /^[a-zA-Z0-9._:-]+$/;
  
  if (!validPattern.test(workflowId)) {
    return {
      valid: false,
      error: `Invalid workflow_id format: "${workflowId}". Workflow ID must contain only alphanumeric characters, hyphens, underscores, dots, and colons. Path separators (/ \\) and spaces are not allowed.`
    };
  }
  
  // Additional safety: check for common problematic patterns
  if (workflowId.includes('..')) {
    return {
      valid: false,
      error: `Invalid workflow_id: "${workflowId}". Workflow ID cannot contain ".." (directory traversal pattern).`
    };
  }
  
  if (workflowId.length > 255) {
    return {
      valid: false,
      error: `Invalid workflow_id: "${workflowId}". Workflow ID must be 255 characters or less.`
    };
  }
  
  return { valid: true };
}

/**
 * Parse artifact reference from input string
 * Handles patterns like: "artifact.json (from step X)" or "artifact.json (from step X, optional)" or "(optional, from step X)"
 */
function parseArtifactReference(input) {
  if (typeof input !== 'string') {
    return null;
  }
  
  // Pattern 1: artifact.json (from step X) or artifact.json (from step X, optional)
  let match = input.match(/^(.+\.json)\s*\(from step (\d+(?:\.\d+)?)(?:,\s*optional)?\)$/);
  if (match) {
    return {
      artifact: match[1].trim(),
      fromStep: match[2],
      optional: input.includes('optional')
    };
  }
  
  // Pattern 2: artifact.json (optional, from step X)
  match = input.match(/^(.+\.json)\s*\(optional,\s*from step (\d+(?:\.\d+)?)\)$/);
  if (match) {
    return {
      artifact: match[1].trim(),
      fromStep: match[2],
      optional: true
    };
  }
  
  // If no "from step" pattern, it's a direct artifact name
  if (input.endsWith('.json')) {
    return {
      artifact: input.trim(),
      fromStep: null,
      optional: false
    };
  }
  
  return null;
}

/**
 * Validate step dependencies before execution
 */
function validateStepDependencies(workflow, stepNumber, workflowId, storyId = null, epicId = null) {
  const step = findStepInWorkflow(workflow, stepNumber);
  if (!step) {
    return { valid: false, missing: [], errors: [`Step ${stepNumber} not found in workflow`] };
  }
  
  const missing = [];
  const errors = [];
  const artifactsDir = resolve(process.cwd(), '.claude/context/artifacts');
  
  // Check tool file exists if specified (tool-based steps)
  if (step.tool) {
    const toolPath = resolve(process.cwd(), `.claude/tools/${step.tool}.mjs`);
    if (!existsSync(toolPath)) {
      errors.push(`Tool file not found: .claude/tools/${step.tool}.mjs`);
      errors.push(`   Resolved path: ${toolPath}`);
      errors.push(`   This tool is required for step ${stepNumber} execution.`);
    }
  }
  
  // Check agent file exists
  if (step.agent) {
    const agentFile = resolve(process.cwd(), `.claude/agents/${step.agent}.md`);
    if (!existsSync(agentFile)) {
      errors.push(`Agent file not found: .claude/agents/${step.agent}.md`);
    } else {
      // Check required template files for this agent
      try {
        const requiredTemplates = getRequiredTemplates(step.agent);
        for (const templatePath of requiredTemplates) {
          const fullTemplatePath = resolve(process.cwd(), templatePath);
          if (!existsSync(fullTemplatePath)) {
            errors.push(`Required template file not found for agent ${step.agent}: ${templatePath}`);
            errors.push(`   Resolved path: ${fullTemplatePath}`);
            errors.push(`   This template is referenced in the agent's instructions and should exist.`);
          }
        }
      } catch (error) {
        // Template registry not available - log warning but don't fail
        console.warn(`⚠️  Warning: Could not validate templates for agent ${step.agent}: ${error.message}`);
      }
    }
  }
  
  // Check schema file exists if specified
  if (step.validation?.schema) {
    const schemaPath = resolveSchemaPath(step.validation.schema);
    if (!existsSync(schemaPath)) {
      errors.push(`Schema file not found: ${step.validation.schema}`);
      errors.push(`   Resolved path: ${schemaPath}`);
    }
  }
  
  // Validate input artifacts from previous steps
  if (step.inputs && Array.isArray(step.inputs)) {
    for (const input of step.inputs) {
      const ref = parseArtifactReference(input);
      if (ref && ref.fromStep) {
        // This is a reference to a previous step's output
        const sourceStep = findStepInWorkflow(workflow, ref.fromStep);
        if (!sourceStep) {
          errors.push(`Input '${input}' references step ${ref.fromStep} which does not exist`);
          continue;
        }
        
        // Check if source step has this output
        let outputFound = false;
        if (sourceStep.outputs && Array.isArray(sourceStep.outputs)) {
          for (const output of sourceStep.outputs) {
            let outputName = null;
            if (typeof output === 'string') {
              outputName = output;
            } else if (typeof output === 'object' && output.reasoning) {
              continue; // Skip reasoning outputs
            }
            
            if (outputName) {
              // Interpolate template variables
              let interpolatedOutput = outputName;
              interpolatedOutput = interpolatedOutput.replace(/\{\{workflow_id\}\}/g, workflowId);
              if (storyId) {
                interpolatedOutput = interpolatedOutput.replace(/\{\{story_id\}\}/g, storyId);
              }
              if (epicId) {
                interpolatedOutput = interpolatedOutput.replace(/\{\{epic_id\}\}/g, epicId);
              }
              
              // Interpolate artifact reference
              let interpolatedArtifact = ref.artifact;
              interpolatedArtifact = interpolatedArtifact.replace(/\{\{workflow_id\}\}/g, workflowId);
              if (storyId) {
                interpolatedArtifact = interpolatedArtifact.replace(/\{\{story_id\}\}/g, storyId);
              }
              if (epicId) {
                interpolatedArtifact = interpolatedArtifact.replace(/\{\{epic_id\}\}/g, epicId);
              }
              
              // Check for un-interpolated variables
              const remainingVars = detectUninterpolatedVariables(interpolatedArtifact);
              if (remainingVars.length > 0) {
                console.warn(`⚠️  Warning: Un-interpolated template variables in artifact reference: ${remainingVars.join(', ')}`);
              }
              
              // Use exact match or proper basename comparison (fix false positive bug)
              // Extract basename for comparison to avoid substring false positives
              const outputBasename = interpolatedOutput.split('/').pop();
              const artifactBasename = interpolatedArtifact.split('/').pop();
              
              if (interpolatedOutput === interpolatedArtifact || outputBasename === artifactBasename) {
                outputFound = true;
                break;
              }
            }
          }
        }
        
        if (!outputFound && !ref.optional) {
          // Interpolate artifact name for checking
          let interpolatedArtifact = ref.artifact;
          interpolatedArtifact = interpolatedArtifact.replace(/\{\{workflow_id\}\}/g, workflowId);
          if (storyId) {
            interpolatedArtifact = interpolatedArtifact.replace(/\{\{story_id\}\}/g, storyId);
          }
          if (epicId) {
            interpolatedArtifact = interpolatedArtifact.replace(/\{\{epic_id\}\}/g, epicId);
          }
          
          // Check for un-interpolated variables and warn
          const remainingVars = detectUninterpolatedVariables(interpolatedArtifact);
          if (remainingVars.length > 0) {
            console.warn(`⚠️  Warning: Un-interpolated template variables found: ${remainingVars.join(', ')}`);
            console.warn(`   This may cause artifact path resolution issues.`);
          }
          
          const artifactPath = resolve(artifactsDir, interpolatedArtifact);
          if (!existsSync(artifactPath)) {
            missing.push({
              artifact: interpolatedArtifact,
              fromStep: ref.fromStep,
              path: artifactPath,
              message: `Required artifact '${interpolatedArtifact}' from step ${ref.fromStep} not found. Run step ${ref.fromStep} first.`
            });
          }
        }
      }
    }
  }
  
  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors
  };
}

/**
 * Find step in workflow (handles both flat steps array and nested phases)
 */
function findStepInWorkflow(workflow, stepNumber) {
  // Handle flat steps array
  if (workflow.steps && Array.isArray(workflow.steps)) {
    for (const step of workflow.steps) {
      if (String(step.step) === String(stepNumber)) {
        return step;
      }
    }
  }
  
  // Handle phase-based workflows (BMad format)
  if (workflow.phases && Array.isArray(workflow.phases)) {
    for (const phase of workflow.phases) {
      if (phase.steps && Array.isArray(phase.steps)) {
        for (const step of phase.steps) {
          if (String(step.step) === String(stepNumber)) {
            return step;
          }
        }
      }
      // Check if_yes and if_no steps
      if (phase.decision) {
        if (phase.decision.if_yes && Array.isArray(phase.decision.if_yes)) {
          for (const step of phase.decision.if_yes) {
            if (String(step.step) === String(stepNumber)) {
              return step;
            }
          }
        }
        if (phase.decision.if_no && Array.isArray(phase.decision.if_no)) {
          for (const step of phase.decision.if_no) {
            if (String(step.step) === String(stepNumber)) {
              return step;
            }
          }
        }
      }
      // Check epic_loop and story_loop
      if (phase.epic_loop && phase.epic_loop.story_loop && Array.isArray(phase.epic_loop.story_loop)) {
        for (const step of phase.epic_loop.story_loop) {
          if (String(step.step) === String(stepNumber)) {
            return step;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Get step configuration using proper YAML parsing
 */
function getStepConfig(workflow, stepNumber) {
  const step = findStepInWorkflow(workflow, stepNumber);
  
  if (!step) {
    return null;
  }
  
  // Extract primary output from outputs array
  // Priority: 1) Regular JSON outputs, 2) First JSON file found, 3) Reasoning JSON as fallback
  let primaryOutput = null;
  let jsonOutputs = [];
  let reasoningOutput = null;
  
  if (step.outputs && Array.isArray(step.outputs)) {
    for (const output of step.outputs) {
      // Handle string outputs (JSON files)
      if (typeof output === 'string') {
        if (output.endsWith('.json')) {
          jsonOutputs.push(output);
          // Use first JSON output as primary (most common case)
          if (!primaryOutput) {
            primaryOutput = output;
          }
        }
      }
      // Handle object outputs with reasoning
      else if (typeof output === 'object' && output.reasoning) {
        const reasoningPath = output.reasoning;
        if (typeof reasoningPath === 'string') {
          const reasoningFile = reasoningPath.split('/').pop();
          if (reasoningFile && reasoningFile.endsWith('.json')) {
            reasoningOutput = reasoningFile;
          }
        }
      }
    }
    
    // If multiple JSON outputs, prefer the one that looks like a primary artifact
    // (not reasoning, not intermediate, typically matches step purpose)
    if (jsonOutputs.length > 1) {
      // Filter out reasoning outputs
      const nonReasoningOutputs = jsonOutputs.filter(out => 
        !out.toLowerCase().includes('reasoning') && 
        !out.toLowerCase().includes('intermediate')
      );
      
      if (nonReasoningOutputs.length > 0) {
        primaryOutput = nonReasoningOutputs[0];
      } else {
        // If all are reasoning-like, use first one
        primaryOutput = jsonOutputs[0];
      }
    }
    
    // Fallback to reasoning output if no regular output found
    if (!primaryOutput && reasoningOutput) {
      primaryOutput = reasoningOutput;
    }
  }
  
  // Extract schema and gate from validation object
  const schema = step.validation?.schema || null;
  const gate = step.validation?.gate || null;
  
  // Extract secondary outputs configuration
  const secondaryOutputs = step.validation?.secondary_outputs || [];
  
  // Extract custom checks if specified
  const customChecks = step.validation?.custom_checks || [];
  
  // Extract tool field if specified (for tool-based steps)
  const tool = step.tool || null;
  
  return {
    output: primaryOutput,
    schema,
    gate,
    secondaryOutputs,
    customChecks,
    tool
  };
}

/**
 * Safe property access utility - handles undefined/null paths gracefully
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., 'step.output.risk')
 * @param {*} defaultValue - Value to return if path not found
 * @returns {*} - The value at the path, or defaultValue if not found
 */
function safeGet(obj, path, defaultValue = undefined) {
  if (obj == null || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

/**
 * Tokenize condition string into tokens for parsing
 * Handles parentheses, quotes, operators, and function calls
 * @param {string} condition - The condition string to tokenize
 * @returns {string[]} - Array of tokens
 */
function tokenizeCondition(condition) {
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;
  let parenDepth = 0; // Track nested parentheses in function calls
  let inFunctionCall = false;

  for (let i = 0; i < condition.length; i++) {
    const char = condition[i];

    // Handle quote toggling
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = null;
      current += char;
    } else if (!inQuotes && char === '(') {
      // Check if this is a function call (current ends with function-like pattern)
      // Patterns like: .includes(, .startsWith(, .endsWith(, .match(
      if (/\.[a-zA-Z]+$/.test(current)) {
        // This is a function call - include the parentheses in the token
        inFunctionCall = true;
        parenDepth = 1;
        current += char;
      } else {
        // This is a grouping parenthesis
        if (current.trim()) {
          tokens.push(current.trim());
        }
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && char === ')') {
      if (inFunctionCall) {
        current += char;
        parenDepth--;
        if (parenDepth === 0) {
          inFunctionCall = false;
        }
      } else {
        // This is a grouping parenthesis
        if (current.trim()) {
          tokens.push(current.trim());
        }
        tokens.push(char);
        current = '';
      }
    } else if (!inQuotes && !inFunctionCall && /\s/.test(char)) {
      // Whitespace separates tokens (outside quotes and function calls)
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Push final token
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Evaluate an atomic condition (no operators, no parentheses)
 * @param {string} condition - The atomic condition to evaluate
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
function evaluateAtomic(condition, safeContext) {
  // Pattern: providers.includes('provider_name')
  if (condition.includes('providers.includes')) {
    const match = condition.match(/providers\.includes\(['"]([^'"]+)['"]\)/);
    if (match) {
      const providers = safeGet(safeContext, 'providers', []);
      return Array.isArray(providers) && providers.includes(match[1]);
    }
  }

  // Pattern: step.output.field === 'value' or step.output.field === true/false
  if (condition.includes('step.output.')) {
    // Boolean match
    const boolMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const fieldName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue === expectedValue;
    }

    // String match
    const strMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const fieldName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue === expectedValue;
    }

    // Inequality match (!==)
    const neqMatch = condition.match(/step\.output\.([a-zA-Z_]+)\s*!==?\s*['"]([^'"]*)['"]/);
    if (neqMatch) {
      const fieldName = neqMatch[1];
      const expectedValue = neqMatch[2];
      const actualValue = safeGet(safeContext, `step.output.${fieldName}`);
      return actualValue !== expectedValue;
    }
  }

  // Pattern: config.field === true|false or config.field === 'value' or config.field === number
  if (condition.includes('config.')) {
    // Boolean match
    const boolMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const fieldName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      return actualValue === expectedValue;
    }

    // String match
    const strMatch = condition.match(/config\.([a-zA-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const fieldName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      return actualValue === expectedValue;
    }

    // Numeric match (including == for loose equality)
    const numMatch = condition.match(/config\.([a-zA-Z_]+)\s*[!=<>]=?\s*(-?\d+(?:\.\d+)?)/);
    if (numMatch) {
      const fieldName = numMatch[1];
      const expectedValue = parseFloat(numMatch[2]);
      const actualValue = safeGet(safeContext, `config.${fieldName}`);
      // Check operator type
      if (condition.includes('!==') || condition.includes('!=')) {
        return actualValue !== expectedValue;
      } else if (condition.includes('>=')) {
        return actualValue >= expectedValue;
      } else if (condition.includes('<=')) {
        return actualValue <= expectedValue;
      } else if (condition.includes('>')) {
        return actualValue > expectedValue;
      } else if (condition.includes('<')) {
        return actualValue < expectedValue;
      } else {
        // == or ===
        return actualValue === expectedValue || actualValue == expectedValue;
      }
    }
  }

  // Pattern: env.VARIABLE === 'value' or env.VARIABLE === true/false
  if (condition.includes('env.')) {
    // Boolean match
    const boolMatch = condition.match(/env\.([A-Z_]+)\s*===?\s*(true|false)/);
    if (boolMatch) {
      const varName = boolMatch[1];
      const expectedValue = boolMatch[2] === 'true';
      const actualValue = safeGet(safeContext, `env.${varName}`);
      return actualValue === expectedValue || actualValue === String(expectedValue);
    }

    // String match
    const strMatch = condition.match(/env\.([A-Z_]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (strMatch) {
      const varName = strMatch[1];
      const expectedValue = strMatch[2];
      const actualValue = safeGet(safeContext, `env.${varName}`);
      return actualValue === expectedValue;
    }
  }

  // Pattern: artifacts.field.subfield === 'value'
  if (condition.includes('artifacts.')) {
    const match = condition.match(/artifacts\.([a-zA-Z_.]+)\s*===?\s*['"]([^'"]*)['"]/);
    if (match) {
      const fieldPath = match[1];
      const expectedValue = match[2];
      const actualValue = safeGet(safeContext, `artifacts.${fieldPath}`);
      return actualValue === expectedValue;
    }
  }

  // Pattern: simple boolean flags (snake_case identifiers)
  // These are common patterns in code-review-flow.yaml
  if (/^[a-z][a-z0-9_]*$/i.test(condition)) {
    // Check in config first
    const configValue = safeGet(safeContext, `config.${condition}`);
    if (configValue !== undefined) {
      return !!configValue;
    }

    // Check in artifacts
    const artifactValue = safeGet(safeContext, `artifacts.${condition}`);
    if (artifactValue !== undefined) {
      return !!artifactValue;
    }

    // Check environment variables (uppercase version)
    const envKey = condition.toUpperCase();
    const envValue = safeGet(safeContext, `env.${envKey}`);
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === true;
    }

    // Check direct context property
    const directValue = safeGet(safeContext, condition);
    if (directValue !== undefined) {
      return !!directValue;
    }

    // Not found anywhere - return false (fail closed for booleans)
    return false;
  }

  // Unrecognized pattern - log warning and return false (fail closed)
  console.warn(`⚠️  Warning: Unrecognized atomic condition: "${condition}"`);
  return false;
}

/**
 * Parse primary expression (handles parentheses, NOT, comparisons, and atomic conditions)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
function parsePrimary(tokens, safeContext) {
  if (tokens.length === 0) {
    return false;
  }

  const token = tokens[0];

  // Handle opening parenthesis - parse nested expression
  if (token === '(') {
    tokens.shift(); // consume '('
    const result = parseOr(tokens, safeContext);
    if (tokens.length > 0 && tokens[0] === ')') {
      tokens.shift(); // consume ')'
    }
    return result;
  }

  // Handle NOT operator
  if (token === 'NOT' || token === '!') {
    tokens.shift(); // consume 'NOT' or '!'
    return !parsePrimary(tokens, safeContext);
  }

  // Consume the first token
  tokens.shift();

  // Check if next token is a comparison operator
  // This handles patterns like: config.enabled === true
  if (tokens.length >= 2 && /^[!=<>]=?=?$/.test(tokens[0])) {
    const operator = tokens.shift(); // consume operator (===, ==, !==, !=, etc.)
    const rightValue = tokens.shift(); // consume right-hand value

    // Reconstruct the full comparison expression for evaluateAtomic
    const fullCondition = `${token} ${operator} ${rightValue}`;
    return evaluateAtomic(fullCondition, safeContext);
  }

  // Single token atomic condition (boolean flag, function call like providers.includes)
  return evaluateAtomic(token, safeContext);
}

/**
 * Parse AND expressions (higher precedence than OR)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
function parseAnd(tokens, safeContext) {
  let left = parsePrimary(tokens, safeContext);

  while (tokens.length > 0 && (tokens[0] === 'AND' || tokens[0] === '&&')) {
    tokens.shift(); // consume 'AND' or '&&'
    const right = parsePrimary(tokens, safeContext);
    left = left && right;
  }

  return left;
}

/**
 * Parse OR expressions (lower precedence than AND)
 * @param {string[]} tokens - Mutable array of tokens
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
function parseOr(tokens, safeContext) {
  let left = parseAnd(tokens, safeContext);

  while (tokens.length > 0 && (tokens[0] === 'OR' || tokens[0] === '||')) {
    tokens.shift(); // consume 'OR' or '||'
    const right = parseAnd(tokens, safeContext);
    left = left || right;
  }

  return left;
}

/**
 * Parse and evaluate a condition expression with proper operator precedence
 * @param {string[]} tokens - Array of tokens to parse
 * @param {Object} safeContext - The evaluation context
 * @returns {boolean} - The evaluation result
 */
function parseExpression(tokens, safeContext) {
  // Create a copy to avoid mutating the original
  const tokensCopy = [...tokens];
  return parseOr(tokensCopy, safeContext);
}

/**
 * Evaluate step condition expression to determine if step should execute
 *
 * Supports:
 * - Nested expressions with parentheses: (A OR B) AND C
 * - Operator precedence: AND binds tighter than OR
 * - NOT operator: NOT condition, !condition
 * - Safe variable resolution: missing variables return false
 * - Multiple condition patterns:
 *   - providers.includes("name")
 *   - step.output.field === "value"
 *   - config.field === true/false/"value"
 *   - env.VARIABLE === "value"
 *   - artifacts.field === "value"
 *   - simple_boolean_flag
 *
 * @param {string} condition - Condition expression from workflow YAML
 * @param {Object} context - Context containing artifacts, config, env, providers
 * @returns {boolean} - true if step should execute, false if should skip
 */
function evaluateCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'string') {
    return true; // No condition means always execute
  }

  // Build safe evaluation context with defaults
  const safeContext = {
    providers: context.providers || [],
    step: context.step || {},
    config: context.config || {},
    env: {
      MULTI_AI_ENABLED: process.env.MULTI_AI_ENABLED === 'true',
      CI: process.env.CI === 'true',
      NODE_ENV: process.env.NODE_ENV || 'development',
      ...context.env
    },
    artifacts: context.artifacts || {}
  };

  try {
    const trimmed = condition.trim();

    // Tokenize the condition
    const tokens = tokenizeCondition(trimmed);

    if (tokens.length === 0) {
      return true; // Empty condition means always execute
    }

    // Parse and evaluate the expression
    return parseExpression(tokens, safeContext);

  } catch (error) {
    // On any error, fail open (execute step)
    console.warn(`⚠️  Warning: Condition evaluation failed: ${error.message}`);
    console.warn(`   Condition: "${condition}"`);
    console.warn(`   Defaulting to execute step (fail-open behavior)`);
    return true;
  }
}

/**
 * Run custom validation checks for a step
 * @param {Array<string>} checks - List of custom check names to run
 * @param {Object} artifactData - The artifact data to validate
 * @param {string} artifactPath - Path to the artifact file
 * @param {string} stepNumber - Step number being validated
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<Object>} Validation result with valid flag and errors array
 */
async function runCustomValidationChecks(checks, artifactData, artifactPath, stepNumber, workflowId) {
  const errors = [];
  
  for (const check of checks) {
    try {
      switch (check) {
        case 'all_critical_features_preserved':
          // For features-distilled.json, verify all features have required fields
          if (artifactData.features && Array.isArray(artifactData.features)) {
            const missingFields = artifactData.features.filter(f => 
              !f.id || !f.name || !f.description || !f.priority
            );
            if (missingFields.length > 0) {
              errors.push(`all_critical_features_preserved: ${missingFields.length} feature(s) missing required fields (id, name, description, priority)`);
            }
          } else {
            errors.push(`all_critical_features_preserved: features array is missing or invalid`);
          }
          break;
          
        case 'acceptance_criteria_included':
          // Verify features have acceptance criteria
          if (artifactData.features && Array.isArray(artifactData.features)) {
            const missingCriteria = artifactData.features.filter(f => 
              !f.acceptance_criteria || !Array.isArray(f.acceptance_criteria) || f.acceptance_criteria.length === 0
            );
            if (missingCriteria.length > 0) {
              errors.push(`acceptance_criteria_included: ${missingCriteria.length} feature(s) missing acceptance criteria`);
            }
          }
          break;
          
        case 'dependencies_mapped':
          // Verify dependencies are properly formatted
          if (artifactData.features && Array.isArray(artifactData.features)) {
            const invalidDeps = artifactData.features.filter(f => {
              if (f.dependencies && Array.isArray(f.dependencies)) {
                return f.dependencies.some(dep => 
                  typeof dep !== 'string' || !dep.match(/^feature-[a-zA-Z0-9_-]+$/)
                );
              }
              return false;
            });
            if (invalidDeps.length > 0) {
              errors.push(`dependencies_mapped: ${invalidDeps.length} feature(s) have invalid dependency format`);
            }
          }
          break;
          
        case 'no_hardcoded_secrets':
        case 'all_secrets_use_references':
        case 'resource_names_have_suffixes':
        case 'connection_strings_use_placeholders':
          // Infrastructure security checks - use dedicated validation module
          try {
            const { validateInfrastructureSecurity } = await import('./validation/infrastructure-security.mjs');
            const securityResult = validateInfrastructureSecurity(artifactPath);
            if (!securityResult.valid) {
              securityResult.errors.forEach(err => errors.push(`${check}: ${err}`));
            }
            if (securityResult.warnings && securityResult.warnings.length > 0) {
              securityResult.warnings.forEach(warn => {
                if (check === 'resource_names_have_suffixes') {
                  // Only add as error if this specific check is being run
                  errors.push(`${check}: ${warn}`);
                }
              });
            }
          } catch (securityError) {
            errors.push(`${check}: Security validation error - ${securityError.message}`);
          }
          break;
          
        default:
          console.warn(`⚠️  Warning: Unknown custom check: ${check}`);
      }
    } catch (checkError) {
      errors.push(`${check}: Validation error - ${checkError.message}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get step information (name, agent) from workflow YAML using parsed structure
 */
/**
 * Check if feature distillation (Step 0.5) should execute
 * Returns true if user_requirements is a file > 15KB
 * 
 * @param {Object} workflow - Workflow YAML object
 * @param {string} workflowId - Workflow ID
 * @param {string|null} userRequirementsPath - Explicit file path (from argument or env var)
 * @returns {Object} Result with shouldExecute, filePath, sizeKB, and reason
 */
function shouldDistillFeatures(workflow, workflowId, userRequirementsPath = null) {
  const DISTILL_THRESHOLD_KB = 15;
  
  // Try to find user_requirements input in Step 0
  const step0 = workflow.steps?.find(s => String(s.step) === '0');
  if (!step0 || !step0.inputs) {
    return { shouldExecute: false, reason: 'Step 0 not found or has no inputs' };
  }
  
  // Look for user_requirements in Step 0 inputs
  const userRequirementsInput = step0.inputs.find(input => 
    typeof input === 'string' && (input.includes('user_requirements') || input.includes('user-requirements'))
  );
  
  if (!userRequirementsInput) {
    return { shouldExecute: false, reason: 'user_requirements not found in Step 0 inputs' };
  }
  
  // Priority 1: Explicit argument or parameter
  let filePath = userRequirementsPath;
  
  // Priority 2: Environment variable
  if (!filePath) {
    filePath = process.env.USER_REQUIREMENTS_PATH;
  }
  
  // Priority 3: Workflow context (if available)
  // TODO: Implement when workflow context system is available
  
  // Priority 4: Fallback to hardcoded paths
  if (!filePath) {
    const possiblePaths = [
      resolve(__dirname, '../../context/artifacts/user_requirements.md'),
      resolve(__dirname, '../../context/artifacts/user-requirements.md'),
      resolve(process.cwd(), 'user_requirements.md'),
      resolve(process.cwd(), 'user-requirements.md'),
      resolve(process.cwd(), 'features.md')
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        filePath = path;
        break;
      }
    }
  }
  
  if (!filePath || !existsSync(filePath)) {
    return { shouldExecute: false, reason: 'File not found' };
  }
  
  try {
    const stats = statSync(filePath);
    const sizeKB = stats.size / 1024;
    
    if (sizeKB > DISTILL_THRESHOLD_KB) {
      return {
        shouldExecute: true,
        filePath: filePath,
        sizeKB: sizeKB.toFixed(2),
        reason: `File size ${sizeKB.toFixed(2)}KB exceeds ${DISTILL_THRESHOLD_KB}KB threshold`
      };
    }
    
    return { 
      shouldExecute: false, 
      reason: `File size ${sizeKB.toFixed(2)}KB is below ${DISTILL_THRESHOLD_KB}KB threshold`,
      filePath: filePath,
      sizeKB: sizeKB.toFixed(2)
    };
  } catch (error) {
    return { shouldExecute: false, reason: `Error reading file: ${error.message}` };
  }
}

/**
 * Execute Step 0.5 (Feature Distillation) programmatically
 * 
 * @param {Object} workflow - Workflow YAML object
 * @param {string} workflowId - Workflow ID
 * @param {string} filePath - Path to user requirements markdown file
 * @param {string|null} storyId - Story ID (optional)
 * @param {string|null} epicId - Epic ID (optional)
 */
async function executeStep05(workflow, workflowId, filePath, storyId = null, epicId = null) {
  const step05Info = getStepInfo(workflow, '0.5');
  if (!step05Info) {
    console.warn(`⚠️  Step 0.5 not found in workflow`);
    return;
  }
  
  // Validate dependencies
  const dependencyCheck = validateStepDependencies(workflow, '0.5', workflowId, storyId, epicId);
  if (!dependencyCheck.valid) {
    console.error(`❌ Step 0.5 dependencies not met:`);
    dependencyCheck.errors.forEach(err => console.error(`   - ${err}`));
    if (dependencyCheck.missing.length > 0) {
      console.error(`   Missing: ${dependencyCheck.missing.join(', ')}`);
    }
    process.exit(1);
  }
  
  console.log(`✅ Step 0.5 (Feature Distillation) dependencies validated`);
  console.log(`   Input file: ${filePath}`);
  console.log(`   Output: features-distilled.json`);
  console.log(`   Agent: ${step05Info.agent}`);
  console.log(`\n   Note: Step 0.5 agent invocation would execute here.`);
  console.log(`   The Analyst agent will read ${filePath} and create features-distilled.json.\n`);
  
  // TODO: Actual agent invocation would happen here
  // For now, we validate dependencies and inform the user
  // In a full implementation, this would:
  // 1. Invoke the Analyst agent with the file path
  // 2. Wait for completion
  // 3. Verify features-distilled.json was created
  // 4. Validate against features_distilled.schema.json
}

function getStepInfo(workflow, stepNumber) {
  const step = findStepInWorkflow(workflow, stepNumber);
  
  if (!step) {
    return null;
  }
  
  return {
    name: step.name || null,
    agent: step.agent || null
  };
}

/**
 * Evaluate a decision point
 */
async function handleDecision(workflowPath, decisionId, workflowId, context = {}) {
  const workflow = loadWorkflowYAML(workflowPath);
  const decisionConfig = getDecisionConfig(workflow, decisionId);
  
  if (!decisionConfig) {
    console.error(`Error: Decision ${decisionId} not found in workflow.`);
    process.exit(1);
  }
  
  console.log(`\n🔀 Evaluating Decision: ${decisionId}`);
  console.log(`   Type: ${decisionConfig.type}\n`);
  
  try {
    const result = await evaluateDecision(decisionId, {
      decision_type: decisionConfig.type,
      condition: decisionConfig.condition,
      input_artifacts: context.input_artifacts || {},
      user_prompt: context.user_prompt || null,
      config: context.config || {}
    });
    
    console.log(`✅ Decision Result: ${result.result}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.details) {
      console.log(`   Details:`, result.details);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error evaluating decision:`, error.message);
    process.exit(1);
  }
}

/**
 * Handle loop iteration
 */
async function handleLoop(workflowPath, loopType, workflowId, context = {}) {
  console.log(`\n🔄 Managing Loop: ${loopType}`);
  
  try {
    const loopState = await initializeLoop(loopType, {
      epic_index: context.epic_index || 0,
      epics_stories_path: context.epics_stories_path || resolve(process.cwd(), '.claude/context/artifacts/epics-stories.json')
    });
    
    console.log(`   Total Items: ${loopState.total_items}`);
    console.log(`   Current Index: ${loopState.current_index}`);
    
    const currentItem = getCurrentItem(loopState);
    if (currentItem) {
      console.log(`   Current Item:`, currentItem);
    }
    
    const hasMore = hasMoreIterations(loopState);
    console.log(`   Has More: ${hasMore}`);
    
    return {
      loop_state: loopState,
      current_item: currentItem,
      has_more: hasMore
    };
  } catch (error) {
    console.error(`❌ Error managing loop:`, error.message);
    process.exit(1);
  }
}

/**
 * Get decision configuration from parsed workflow YAML
 */
function getDecisionConfig(workflow, decisionId) {
  // Search in phases for decision points
  if (workflow.phases && Array.isArray(workflow.phases)) {
    for (const phase of workflow.phases) {
      if (phase.decision && phase.decision.id === decisionId) {
        return {
          id: decisionId,
          type: phase.decision.type || null,
          condition: phase.decision.condition || null
        };
      }
    }
  }
  
  return null;
}

/**
 * Perform comprehensive dry-run validation of a workflow
 * Validates workflow structure, artifact paths, schemas, agents, and dependencies
 * without executing or writing any files
 *
 * @param {string} workflowPath - Path to workflow YAML
 * @param {string} workflowId - Workflow ID
 * @returns {Object} Validation result with detailed report
 */
async function performDryRun(workflowPath, workflowId) {
  const report = {
    valid: true,
    workflow: basename(workflowPath),
    workflow_id: workflowId,
    steps_validated: [],
    artifacts_resolved: [],
    schemas_resolved: [],
    agents_verified: [],
    missing_dependencies: [],
    errors: [],
    warnings: [],
    temp_dir: resolve(process.cwd(), '.claude/context/temp-runs', workflowId)
  };

  console.log('\n🔍 DRY-RUN VALIDATION');
  console.log('='.repeat(60));
  console.log(`Workflow: ${report.workflow}`);
  console.log(`Workflow ID: ${workflowId}`);
  console.log(`Temp Directory: ${report.temp_dir}`);
  console.log('='.repeat(60));

  try {
    // Load workflow YAML
    const workflow = loadWorkflowYAML(workflowPath);

    // Get all steps (handle both flat and phase-based workflows)
    const steps = [];
    if (workflow.steps && Array.isArray(workflow.steps)) {
      steps.push(...workflow.steps);
    }
    if (workflow.phases && Array.isArray(workflow.phases)) {
      for (const phase of workflow.phases) {
        if (phase.steps && Array.isArray(phase.steps)) {
          steps.push(...phase.steps);
        }
      }
    }

    console.log(`\n📋 Found ${steps.length} step(s) to validate\n`);

    // Validate each step
    for (const step of steps) {
      const stepNum = step.step;
      const stepName = step.name || `Step ${stepNum}`;
      const agentName = step.agent;

      console.log(`\n--- Step ${stepNum}: ${stepName} ---`);

      // Validate agent exists
      if (agentName) {
        const agentPath = resolve(process.cwd(), `.claude/agents/${agentName}.md`);
        if (existsSync(agentPath)) {
          console.log(`  ✅ Agent: ${agentName}`);
          report.agents_verified.push(agentName);
        } else {
          const error = `Agent file not found: .claude/agents/${agentName}.md`;
          console.error(`  ❌ ${error}`);
          report.errors.push(error);
          report.valid = false;
        }
      }

      // Validate outputs (artifact paths)
      if (step.outputs && Array.isArray(step.outputs)) {
        for (const output of step.outputs) {
          let artifactName = null;
          if (typeof output === 'string') {
            artifactName = output;
          } else if (typeof output === 'object' && output.reasoning) {
            // Reasoning output - extract path
            artifactName = output.reasoning;
          }

          if (artifactName) {
            // Interpolate workflow_id
            const interpolated = artifactName.replace(/\{\{workflow_id\}\}/g, workflowId);
            const artifactPath = resolve(report.temp_dir, 'artifacts', interpolated);
            console.log(`  📄 Output: ${interpolated}`);
            report.artifacts_resolved.push({
              step: stepNum,
              artifact: interpolated,
              path: artifactPath
            });
          }
        }
      }

      // Validate schema exists
      if (step.validation && step.validation.schema) {
        const schemaPath = resolveSchemaPath(step.validation.schema);
        if (existsSync(schemaPath)) {
          console.log(`  ✅ Schema: ${step.validation.schema}`);
          report.schemas_resolved.push({
            step: stepNum,
            schema: step.validation.schema,
            path: schemaPath
          });
        } else {
          const error = `Schema not found: ${step.validation.schema} (resolved: ${schemaPath})`;
          console.error(`  ❌ ${error}`);
          report.errors.push(error);
          report.valid = false;
        }
      } else {
        console.log(`  ⚠️  No schema validation configured`);
        report.warnings.push(`Step ${stepNum}: No schema validation`);
      }

      // Validate inputs (dependencies on previous steps)
      if (step.inputs && Array.isArray(step.inputs)) {
        for (const input of step.inputs) {
          const ref = parseArtifactReference(input);
          if (ref && ref.fromStep) {
            console.log(`  📥 Input: ${ref.artifact} (from step ${ref.fromStep}${ref.optional ? ', optional' : ''})`);
          } else if (typeof input === 'string') {
            console.log(`  📥 Input: ${input}`);
          }
        }
      }

      report.steps_validated.push({
        step: stepNum,
        name: stepName,
        agent: agentName
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('DRY-RUN SUMMARY');
    console.log('='.repeat(60));
    console.log(`Steps validated: ${report.steps_validated.length}`);
    console.log(`Artifacts resolved: ${report.artifacts_resolved.length}`);
    console.log(`Schemas validated: ${report.schemas_resolved.length}`);
    console.log(`Agents verified: ${report.agents_verified.length}`);
    console.log(`Errors: ${report.errors.length}`);
    console.log(`Warnings: ${report.warnings.length}`);

    if (report.valid) {
      console.log(`\n✅ DRY-RUN PASSED: Workflow is valid and ready for execution`);
    } else {
      console.log(`\n❌ DRY-RUN FAILED: ${report.errors.length} error(s) found`);
      console.log('\nErrors:');
      report.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    if (report.warnings.length > 0) {
      console.log('\nWarnings:');
      report.warnings.forEach((warn, idx) => {
        console.log(`  ${idx + 1}. ${warn}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    return report;
  } catch (error) {
    report.valid = false;
    report.errors.push(`Dry-run validation error: ${error.message}`);
    console.error(`\n❌ DRY-RUN ERROR: ${error.message}\n`);
    return report;
  }
}

/**
 * Load CUJ definition from CUJ-INDEX.md
 * @param {string} cujId - CUJ ID (e.g., "CUJ-004")
 * @returns {Object} CUJ definition with workflow path and success criteria
 */
function loadCUJDefinition(cujId) {
  const cujIndexPath = resolve(process.cwd(), '.claude/docs/cujs/CUJ-INDEX.md');
  const cujFilePath = resolve(process.cwd(), `.claude/docs/cujs/${cujId}.md`);

  if (!existsSync(cujIndexPath)) {
    throw new Error(`CUJ index not found: ${cujIndexPath}`);
  }

  if (!existsSync(cujFilePath)) {
    throw new Error(`CUJ file not found: ${cujFilePath}`);
  }

  // Read CUJ file
  const cujContent = readFileSync(cujFilePath, 'utf-8');

  // Parse CUJ metadata
  const cuj = {
    id: cujId,
    name: null,
    workflow_path: null,
    execution_mode: null,
    success_criteria: [],
    agents: [],
    skills: [],
    expected_outputs: []
  };

  // Extract CUJ name from first heading
  const nameMatch = cujContent.match(/^#\s+([^\n]+)/m);
  if (nameMatch) {
    cuj.name = nameMatch[1].replace(/^CUJ-\d+:\s*/, '');
  }

  // Extract workflow path from index (use the "Run CUJ Mapping" table at the bottom)
  const indexContent = readFileSync(cujIndexPath, 'utf-8');

  // Find the "Run CUJ Mapping" table (last table in the file with execution modes)
  const mappingTableMatch = indexContent.match(/\| CUJ ID \| Execution Mode \| Workflow File Path \| Primary Skill \|([\s\S]*?)(?=\n\*\*|$)/);

  if (mappingTableMatch) {
    const tableContent = mappingTableMatch[1];
    const rowPattern = new RegExp(`\\| ${cujId} \\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\|`, 'i');
    const rowMatch = tableContent.match(rowPattern);

    if (rowMatch) {
      const executionMode = rowMatch[1].trim();
      const workflowPath = rowMatch[2].trim();
      const primarySkill = rowMatch[3].trim();

      if (executionMode === 'skill-only') {
        cuj.execution_mode = 'skill-only';
        if (primarySkill && primarySkill !== 'null') {
          cuj.skills.push(primarySkill);
        }
      } else if (executionMode === 'manual-setup') {
        cuj.execution_mode = 'manual';
      } else if (workflowPath && workflowPath !== 'null') {
        // Workflow-based execution
        cuj.execution_mode = 'workflow';
        cuj.workflow_path = workflowPath.replace(/`/g, '');
      } else {
        cuj.execution_mode = 'unknown';
      }
    }
  }

  // Fallback to old method if table not found
  if (!cuj.execution_mode) {
    const workflowMatch = indexContent.match(new RegExp(`${cujId}.*?\\.claude/workflows/([^\\s|]+)`, 's'));
    if (workflowMatch) {
      cuj.workflow_path = `.claude/workflows/${workflowMatch[1]}`;
      cuj.execution_mode = 'workflow';
    } else {
      cuj.execution_mode = 'manual';
    }
  }

  // Extract success criteria (support both checkbox bullets and tables)
  const criteriaSection = cujContent.match(/## Success Criteria\s*\n([\s\S]*?)(?=\n##|$)/);
  if (criteriaSection) {
    const sectionText = criteriaSection[1];
    const criteria = [];

    // Pattern 1: Checkbox bullets (existing)
    const checkboxMatches = sectionText.match(/- \[.\]\s+(.+)/g);
    if (checkboxMatches) {
      checkboxMatches.forEach(match => {
        criteria.push(match.replace(/- \[.\]\s+/, '').trim());
      });
    }

    // Pattern 2: Table rows (new - for CUJ-063 and others)
    // Match table rows that aren't headers or separators
    const tableRowMatches = sectionText.match(/\|([^|]+)\|([^|]+)\|/g);
    if (tableRowMatches) {
      tableRowMatches.forEach(row => {
        // Skip header rows and separator rows
        if (!row.includes('---') && !row.toLowerCase().includes('criteria') && !row.toLowerCase().includes('status')) {
          // Extract first column (criteria text)
          const columns = row.split('|').map(c => c.trim()).filter(c => c);
          if (columns.length > 0 && columns[0]) {
            // Avoid duplicate entries if checkbox pattern already captured this
            const criteriaText = columns[0].trim();
            if (!criteria.includes(criteriaText)) {
              criteria.push(criteriaText);
            }
          }
        }
      });
    }

    cuj.success_criteria = criteria;
  }

  // Extract agents
  const agentsSection = cujContent.match(/## Agents Used\s*\n([\s\S]*?)(?=\n##|$)/);
  if (agentsSection) {
    const agents = agentsSection[1].match(/- ([A-Z][a-z-]+)/g);
    if (agents) {
      cuj.agents = agents.map(a => a.replace(/- /, '').toLowerCase().replace(/\s+/g, '-'));
    }
  }

  // Extract expected outputs
  const outputsSection = cujContent.match(/## Expected Outputs\s*\n([\s\S]*?)(?=\n##|$)/);
  if (outputsSection) {
    const outputs = outputsSection[1].match(/- ([^\n]+)/g);
    if (outputs) {
      cuj.expected_outputs = outputs.map(o => o.replace(/- /, '').trim());
    }
  }

  return cuj;
}

/**
 * Simulate CUJ execution end-to-end
 * Validates workflow structure, success criteria, and artifacts without executing
 *
 * @param {string} cujId - CUJ ID (e.g., "CUJ-004")
 * @returns {Object} Simulation result with pass/fail status
 */
async function simulateCUJ(cujId) {
  console.log('\n🎯 CUJ SIMULATION');
  console.log('='.repeat(60));
  console.log(`CUJ ID: ${cujId}`);
  console.log('='.repeat(60));

  const simulation = {
    cuj_id: cujId,
    success: true,
    cuj_definition: null,
    dry_run_report: null,
    success_criteria_check: {
      total: 0,
      measurable: 0,
      non_measurable: []
    },
    errors: [],
    warnings: []
  };

  try {
    // Load CUJ definition
    console.log(`\n📖 Loading CUJ definition...`);
    simulation.cuj_definition = loadCUJDefinition(cujId);

    console.log(`\nCUJ: ${simulation.cuj_definition.name}`);
    console.log(`Execution Mode: ${simulation.cuj_definition.execution_mode}`);
    console.log(`Workflow: ${simulation.cuj_definition.workflow_path || 'N/A'}`);
    console.log(`Agents: ${simulation.cuj_definition.agents.join(', ') || 'N/A'}`);
    console.log(`Skills: ${simulation.cuj_definition.skills.join(', ') || 'N/A'}`);

    // Validate execution mode
    if (simulation.cuj_definition.execution_mode === 'manual') {
      simulation.warnings.push(`CUJ ${cujId} requires manual execution - cannot fully simulate`);
      console.log(`\n⚠️  Warning: ${simulation.warnings[0]}`);
    }

    // Perform dry-run if workflow exists
    if (simulation.cuj_definition.workflow_path) {
      const workflowPath = resolve(process.cwd(), simulation.cuj_definition.workflow_path);

      if (!existsSync(workflowPath)) {
        const error = `Workflow file not found: ${simulation.cuj_definition.workflow_path}`;
        simulation.errors.push(error);
        simulation.success = false;
        console.error(`\n❌ ${error}`);
      } else {
        console.log(`\n🔍 Running dry-run validation...`);
        const workflowId = `cuj-sim-${cujId.toLowerCase()}-${Date.now()}`;
        simulation.dry_run_report = await performDryRun(workflowPath, workflowId);

        if (!simulation.dry_run_report.valid) {
          simulation.success = false;
          simulation.errors.push(`Workflow dry-run failed: ${simulation.dry_run_report.errors.length} error(s)`);
        }
      }
    }

    // Validate success criteria
    console.log(`\n📊 Validating success criteria...`);
    simulation.success_criteria_check.total = simulation.cuj_definition.success_criteria.length;

    for (const criterion of simulation.cuj_definition.success_criteria) {
      // Check if criterion is measurable (references artifacts, schemas, or gates)
      const isMeasurable = /artifact:|schema:|gate:|validated by/.test(criterion);

      if (isMeasurable) {
        simulation.success_criteria_check.measurable++;
        console.log(`  ✅ Measurable: ${criterion}`);
      } else {
        simulation.success_criteria_check.non_measurable.push(criterion);
        console.log(`  ⚠️  Non-measurable: ${criterion}`);
        simulation.warnings.push(`Non-measurable success criterion: ${criterion}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('CUJ SIMULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`CUJ: ${cujId} - ${simulation.cuj_definition.name}`);
    console.log(`Execution Mode: ${simulation.cuj_definition.execution_mode}`);
    console.log(`Success Criteria: ${simulation.success_criteria_check.measurable}/${simulation.success_criteria_check.total} measurable`);
    console.log(`Errors: ${simulation.errors.length}`);
    console.log(`Warnings: ${simulation.warnings.length}`);

    if (simulation.success) {
      console.log(`\n✅ CUJ SIMULATION PASSED`);
    } else {
      console.log(`\n❌ CUJ SIMULATION FAILED`);
      console.log('\nErrors:');
      simulation.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    if (simulation.warnings.length > 0) {
      console.log('\nWarnings:');
      simulation.warnings.forEach((warn, idx) => {
        console.log(`  ${idx + 1}. ${warn}`);
      });
    }

    console.log('='.repeat(60) + '\n');

    return simulation;
  } catch (error) {
    simulation.success = false;
    simulation.errors.push(`CUJ simulation error: ${error.message}`);
    console.error(`\n❌ CUJ SIMULATION ERROR: ${error.message}\n`);
    return simulation;
  }
}

async function main() {
  const args = parseArgs();
  const isDryRun = args['dry-run'] || false;
  const cujSimulation = args['cuj-simulation'] || null;
  
  // Handle CUJ simulation mode
  if (cujSimulation) {
    try {
      const result = await simulateCUJ(cujSimulation.toUpperCase());
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error(`❌ CUJ simulation failed: ${error.message}`);
      process.exit(1);
    }
  }

  if (!args.workflow) {
    console.error('Error: Missing workflow argument');
    console.error('Usage: node workflow_runner.js --workflow <yaml-path> [--step <number>|--decision <id>|--loop <type>] [--id <workflow-id>] [--dry-run]');
    console.error('       node workflow_runner.js --workflow <yaml-path> --dry-run [--id <workflow-id>]');
    console.error('       node workflow_runner.js --cuj-simulation <cuj-id>');
    process.exit(1);
  }

  // Resolve workflow path (handles relative paths from config.yaml)
  let workflowPath = args.workflow;
  if (!workflowPath.startsWith('/') && !(process.platform === 'win32' && /^[A-Z]:/.test(workflowPath))) {
    // Relative path - resolve from project root
    workflowPath = resolveWorkflowPath(workflowPath);
  } else {
    workflowPath = resolve(workflowPath);
  }
  
  // Handle resume from checkpoint
  if (args.resume || args['resume-step']) {
    const runId = args['run-id'];
    if (!runId) {
      console.error('❌ Error: --run-id required for resume');
      console.error('Usage: node workflow_runner.js --workflow <yaml> --resume --run-id <id> [--resume-step <step>]');
      process.exit(1);
    }
    
    try {
      const checkpoints = await listCheckpoints(runId);
      if (checkpoints.length === 0) {
        console.error(`❌ Error: No checkpoints found for run ${runId}`);
        process.exit(1);
      }
      
      let checkpointToRestore;
      if (args['resume-step']) {
        const targetStep = parseInt(args['resume-step'], 10);
        checkpointToRestore = checkpoints.find(c => c.step === targetStep);
        if (!checkpointToRestore) {
          console.error(`❌ Error: No checkpoint found for step ${targetStep}`);
          console.error(`   Available checkpoints:`);
          checkpoints.forEach(c => console.error(`     - Step ${c.step}: ${c.checkpoint_id}`));
          process.exit(1);
        }
      } else {
        // Use most recent checkpoint
        checkpointToRestore = checkpoints[0];
      }
      
      console.log(`\n🔄 Restoring from checkpoint: ${checkpointToRestore.checkpoint_id}`);
      console.log(`   Step: ${checkpointToRestore.step}`);
      console.log(`   Timestamp: ${checkpointToRestore.timestamp}\n`);
      
      const restored = await restoreFromCheckpoint(runId, checkpointToRestore.checkpoint_id);
      console.log(`✅ Restored ${restored.artifacts_restored} artifact(s) from checkpoint`);
      console.log(`   Resume from step ${restored.restored_step + 1}\n`);
      
      // Update args to continue from restored step
      args.step = String(restored.restored_step + 1);
      args.id = runId; // Use run-id as workflow-id for continuation
    } catch (resumeError) {
      console.error(`❌ Error: Resume failed: ${resumeError.message}`);
      process.exit(1);
    }
  }
  
  // Auto-generate workflow ID if not provided
  const workflowId = args.id || args['run-id'] || generateWorkflowId();
  
  // Always validate format
  const idValidation = validateWorkflowIdFormat(workflowId);
  if (!idValidation.valid) {
    console.error(`❌ Error: ${idValidation.error}`);
    process.exit(1);
  }
  
  // Log generated ID for user reference
  if (!args.id && !args['run-id']) {
    console.log(`📋 Generated workflow ID: ${workflowId}`);
    console.log(`   Use --id ${workflowId} to reference this workflow in future steps\n`);
  }
  
  if (!existsSync(workflowPath)) {
    console.error(`❌ Error: Workflow file not found at ${workflowPath}`);
    console.error(`   Original path: ${args.workflow}`);
    console.error(`   Resolved from: ${resolve(__dirname, '../..')}`);

    // List available workflows to help user
    try {
      const workflowsDir = resolve(__dirname, '..', 'workflows');
      if (existsSync(workflowsDir)) {
        const workflows = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml'));
        if (workflows.length > 0) {
          console.error(`\n📋 Available workflows:`);
          workflows.forEach(wf => {
            console.error(`   - .claude/workflows/${wf}`);
          });
        }
      }
    } catch (listError) {
      // Silently fail - listing is just a helpful hint
    }

    process.exit(1);
  }

  // Handle decision evaluation
  if (args.decision) {
    let inputArtifacts = {};
    let config = {};
    
    if (args.artifacts) {
      try {
        inputArtifacts = JSON.parse(args.artifacts);
      } catch (error) {
        console.error(`❌ Error: Invalid JSON in --artifacts argument: ${error.message}`);
        process.exit(1);
      }
    }
    
    if (args.config) {
      try {
        config = JSON.parse(args.config);
      } catch (error) {
        console.error(`❌ Error: Invalid JSON in --config argument: ${error.message}`);
        process.exit(1);
      }
    }
    
    handleDecision(workflowPath, args.decision, workflowId, {
      input_artifacts: inputArtifacts,
      user_prompt: args.prompt || null,
      config: config
    });
    return;
  }

  // Handle loop management
  if (args.loop) {
    handleLoop(workflowPath, args.loop, workflowId, {
      epic_index: args.epic_index ? parseInt(args.epic_index) : 0,
      epics_stories_path: args.epics_path || null
    });
    return;
  }

  // Handle dry-run-only mode (no step specified)
  if (isDryRun && !args.step && !args.decision && !args.loop) {
    try {
      const workflowId = args.id || generateWorkflowId();
      const result = await performDryRun(workflowPath, workflowId);
      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      console.error(`❌ Dry-run failed: ${error.message}`);
      process.exit(1);
    }
  }

  // Handle step validation (original functionality)
  if (!args.step) {
    console.error('Error: Must specify --step, --decision, or --loop');
    console.error('Usage: node workflow_runner.js --workflow <yaml-path> [--step <number>|--decision <id>|--loop <type>] [--id <workflow-id>] [--story-id <id>] [--epic-id <id>]');
    console.error('       node workflow_runner.js --workflow <yaml-path> --dry-run [--id <workflow-id>]');
    process.exit(1);
  }

  const workflow = loadWorkflowYAML(workflowPath);
  
  // Pre-execution validation
  try {
    const { validateWorkflow } = await import('./validation/workflow-validator.mjs');
    const validationResult = validateWorkflow(workflowPath);
    if (!validationResult.valid) {
      console.error('\n❌ Workflow Pre-Execution Validation Failed\n');
      console.error('Errors:');
      validationResult.errors.forEach(error => console.error(`  - ${error}`));
      if (validationResult.warnings.length > 0) {
        console.error('\n⚠️  Warnings:');
        validationResult.warnings.forEach(warning => console.error(`  - ${warning}`));
      }
      console.error('\nPlease fix the errors before executing the workflow.');
      process.exit(1);
    }
    if (validationResult.warnings.length > 0) {
      console.warn('\n⚠️  Workflow Validation Warnings:');
      validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
      console.warn('');
    }
  } catch (validationError) {
    console.warn(`⚠️  Warning: Could not run pre-execution validation: ${validationError.message}`);
    console.warn('   Continuing with workflow execution...\n');
  }
  
  const storyId = args['story-id'] || null;
  const epicId = args['epic-id'] || null;
  
  // Check if Step 0.5 (Feature Distillation) should execute before Step 0
  // This happens when user_requirements is a markdown file > 15KB
  if (args.step === '0' || args.step === 0) {
    const userRequirementsPath = args['user-requirements'] || process.env.USER_REQUIREMENTS_PATH;
    const shouldDistill = shouldDistillFeatures(workflow, workflowId, userRequirementsPath);
    
    if (shouldDistill.shouldExecute) {
      console.log(`\n📄 Large markdown detected (${shouldDistill.sizeKB}KB > 15KB)`);
      console.log(`   File: ${shouldDistill.filePath}`);
      console.log(`   Executing Step 0.5 (Feature Distillation) first...\n`);
      
      // Execute Step 0.5
      await executeStep05(workflow, workflowId, shouldDistill.filePath, storyId, epicId);
      
      // Continue with Step 0, which will use features-distilled.json
      console.log(`\n✅ Step 0.5 completed. Proceeding with Step 0 (Planning) using features-distilled.json...\n`);
    }
  }
  
  // ========================================================================
  // PLAN RATING GATE (Step 0.1)
  // Enforces "never execute an unrated plan" rule from CLAUDE.md
  // Executes before Step 1 if Step 0 (Planning) has completed
  // ========================================================================
  const runId = args['run-id'] || null;
  const stepNumber = parseInt(args.step, 10);

  // Execute Plan Rating Gate for steps >= 1 (after planning)
  if (stepNumber >= 1 && runId && !isDryRun) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('STEP 0.1: PLAN RATING GATE');
    console.log('Enforcing: "Never execute an unrated plan" (CLAUDE.md)');
    console.log(`${'='.repeat(60)}`);

    try {
      // First check if a rating already exists and passes
      const existingRating = await checkPlanRating(runId, 'plan');

      if (existingRating.valid && existingRating.rated) {
        console.log(`\n✅ Plan Rating Gate: PASSED (existing rating)`);
        console.log(`   Score: ${existingRating.score}/10 (minimum: ${existingRating.minimumRequired})`);
      } else if (!existingRating.rated) {
        // No rating exists - execute the plan rating gate
        console.log(`\n⚠️  No plan rating found. Invoking response-rater skill...`);

        const ratingResult = await executePlanRatingGate(runId, null, {
          workflowId,
          minimumScore: 7,
          providers: 'claude,gemini'
        });

        if (ratingResult.success) {
          console.log(`\n✅ Plan Rating Gate: PASSED`);
          console.log(`   Score: ${ratingResult.score}/10 (minimum: 7)`);
          console.log(`   Rating saved: ${ratingResult.rating_path}`);
        } else {
          console.error(`\n❌ Plan Rating Gate: FAILED`);
          console.error(`   Score: ${ratingResult.score}/10 (minimum required: 7)`);

          if (ratingResult.feedback) {
            console.error(`\n   Feedback for Planner:`);
            if (ratingResult.feedback.weak_areas && ratingResult.feedback.weak_areas.length > 0) {
              console.error(`   Weak areas:`);
              ratingResult.feedback.weak_areas.forEach(area => {
                console.error(`     - ${area.component}: ${area.score}/10 - ${area.suggestion}`);
              });
            }
            if (ratingResult.feedback.improvements_required && ratingResult.feedback.improvements_required.length > 0) {
              console.error(`\n   Required improvements:`);
              ratingResult.feedback.improvements_required.forEach((imp, i) => {
                console.error(`     ${i + 1}. ${imp}`);
              });
            }
          }

          console.error(`\n   Action Required: Return plan to Planner for revision.`);
          console.error(`   Command: node workflow_runner.js --workflow ${args.workflow} --step 0 --id ${workflowId}`);
          console.error(`${'='.repeat(60)}\n`);
          process.exit(1);
        }
      } else {
        // Rating exists but doesn't pass
        console.error(`\n❌ Plan Rating Gate: FAILED (existing rating below threshold)`);
        console.error(`   Score: ${existingRating.score}/10 (minimum required: ${existingRating.minimumRequired})`);
        console.error(`\n   Action Required: Return plan to Planner for revision.`);
        process.exit(1);
      }
    } catch (ratingError) {
      // Handle gracefully - log warning but allow execution to continue
      // This prevents breaking existing workflows while rating infrastructure is being set up
      console.warn(`\n⚠️  Plan Rating Gate: Could not validate (${ratingError.message})`);
      console.warn(`   Proceeding with execution (non-blocking on errors)`);
      console.warn(`   To fix: Ensure response-rater skill is properly configured`);
    }

    console.log(`${'='.repeat(60)}\n`);
  } else if (stepNumber >= 1 && !runId) {
    // Warn if run-id is missing for steps that should have rating
    console.warn(`\n⚠️  Warning: --run-id not provided for Step ${stepNumber}`);
    console.warn(`   Plan rating gate requires --run-id to validate plans.`);
    console.warn(`   Usage: node workflow_runner.js --workflow <yaml> --step ${stepNumber} --run-id <id>\n`);
  }

  // Validate step dependencies before proceeding
  // Context monitoring: Check context usage before step execution
  const stepInfo = getStepInfo(workflow, args.step);
  const agentName = stepInfo?.agent || 'unknown';
  
  // Record actual context usage (if available from Claude API or session state)
  try {
    // Try to get actual context usage from session state or Claude API
    // This is a placeholder - actual implementation would read from Claude session state
    const estimatedUsage = estimateContextUsage(workflow, args.step, workflowId);
    const contextUsage = {
      total: estimatedUsage.total || 0,
      inputTokens: estimatedUsage.inputTokens || 0,
      outputTokens: estimatedUsage.outputTokens || 0,
      systemPrompt: estimatedUsage.systemPrompt || 0,
      messages: estimatedUsage.messages || 0
    };
    
    // Record usage
    recordContextUsage(agentName, contextUsage);
    
    // Check threshold
    const contextCheck = checkContextThreshold(agentName, contextUsage);
    if (contextCheck.thresholdReached) {
      console.warn(`\n⚠️  Context usage alert: ${contextCheck.percentage}%`);
      console.warn(`   Recommendation: ${contextCheck.recommendation}`);
      console.warn(`   Consider preparing for handoff if usage continues to increase.\n`);
    }
  } catch (error) {
    // Context monitoring not critical - continue execution
    // This allows workflow to run even if context monitoring fails
  }

  // Call step validation execution
  await executeWorkflowStepValidation(workflow, args, workflowId, storyId, epicId, isDryRun);
}

/**
 * Estimate context usage (deterministic estimator)
 * This provides a reasonable estimate when real usage is not available
 */
function estimateContextUsage(workflow, step, workflowId) {
  // Base estimates per component
  const SYSTEM_PROMPT_BASE = 5000; // Base system prompt tokens
  const AGENT_PROMPT_BASE = 3000; // Agent-specific prompt tokens
  const ARTIFACT_READ_BASE = 100; // Per artifact read
  const MESSAGE_BASE = 200; // Per message
  
  // Count artifacts loaded
  const stepInfo = getStepInfo(workflow, step);
  const artifactsCount = (stepInfo?.inputs || []).length;
  
  // Estimate based on step number (accumulates over time)
  const stepMultiplier = step * 0.1; // 10% growth per step
  
  const estimated = {
    systemPrompt: SYSTEM_PROMPT_BASE + AGENT_PROMPT_BASE,
    messages: MESSAGE_BASE * (step + 1),
    artifacts: ARTIFACT_READ_BASE * artifactsCount,
    total: 0
  };
  
  estimated.total = estimated.systemPrompt + estimated.messages + estimated.artifacts;
  estimated.total = Math.floor(estimated.total * (1 + stepMultiplier));

  return estimated;
}

async function executeWorkflowStepValidation(workflow, args, workflowId, storyId, epicId, isDryRun) {
  // Validate step dependencies before proceeding
  const dependencyCheck = validateStepDependencies(workflow, args.step, workflowId, storyId, epicId);
  if (!dependencyCheck.valid) {
    console.error(`\n❌ Step ${args.step} Dependency Validation Failed\n`);
    
    if (dependencyCheck.errors.length > 0) {
      console.error('Errors:');
      dependencyCheck.errors.forEach(error => {
        console.error(`  - ${error}`);
      });
      console.error('\n💡 Suggestions:');
      console.error('  - Verify agent files exist in .claude/agents/');
      console.error('  - Check schema file paths are correct');
      console.error('  - Ensure workflow YAML syntax is valid');
    }
    
    if (dependencyCheck.missing.length > 0) {
      console.error('\nMissing Required Artifacts:');
      dependencyCheck.missing.forEach(missing => {
        console.error(`  - ${missing.message}`);
        console.error(`    Expected at: ${missing.path}`);
        console.error(`    Suggestion: Run step ${missing.fromStep} first to generate this artifact`);
        console.error(`    Command: node .claude/tools/workflow_runner.js --workflow ${args.workflow} --step ${missing.fromStep} --id ${workflowId}`);
      });
    }
    
    process.exit(1);
  }
  
  const config = getStepConfig(workflow, args.step);
  
  if (!config) {
    console.error(`Error: Step ${args.step} not found in workflow.`);
    process.exit(1);
  }
  
  // Gate and output are required, schema is optional
  if (!config.gate || !config.output) {
    console.error('Error: Missing required validation configuration (gate or output) for this step.');
    console.error(`   Step ${args.step} must have at least 'gate' and 'output' defined.`);
    console.error(`   Schema is optional but recommended for structured artifacts.`);
    console.log('Found config:', config);
    process.exit(1);
  }

  // Construct paths - use run directory if run-id provided
  let artifactsDir;
  let gateDir;
  let runId = args['run-id'] || null;
  
  // Ensure artifact registry is initialized before step execution
  if (runId) {
    try {
      const workflowName = basename(workflowPath, '.yaml');
      await ensureArtifactRegistry(runId, workflowName, isDryRun);
    } catch (error) {
      console.error(`❌ Error: Failed to ensure artifact registry: ${error.message}`);
      if (!isDryRun) {
        process.exit(1);
      }
    }
    
    const runDirs = getRunDirectoryStructure(runId);
    artifactsDir = runDirs.artifacts_dir;
    gateDir = runDirs.gates_dir;
  } else {
    // Legacy paths
    artifactsDir = resolve(process.cwd(), '.claude/context/artifacts');
    gateDir = resolve(process.cwd(), '.claude/context/history/gates', workflowId);
  }
  
  // Interpolate template variables in output artifact name
  // Handle {{workflow_id}}, {{story_id}}, {{epic_id}}, etc.
  
  // Validate template variable syntax first
  const templateSyntaxCheck = validateTemplateVariableSyntax(config.output);
  if (!templateSyntaxCheck.valid) {
    console.error(`❌ Error: Malformed template variables in output: ${config.output}`);
    templateSyntaxCheck.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
  
  let interpolatedOutput = config.output;
  if (interpolatedOutput) {
    // Check if workflow_id is required but missing (should never happen with auto-generation, but keep as safety check)
    if (interpolatedOutput.includes('{{workflow_id}}') && !workflowId) {
      console.error(`❌ Error: Required template variable {{workflow_id}} could not be resolved.`);
      console.error(`   This is unexpected - workflow ID should be auto-generated.`);
      console.error(`   Please provide a workflow ID using --id <workflow-id>`);
      console.error(`   Output artifact: ${interpolatedOutput}`);
      process.exit(1);
    }
    
    interpolatedOutput = interpolatedOutput.replace(/\{\{workflow_id\}\}/g, workflowId);
    if (storyId) {
      interpolatedOutput = interpolatedOutput.replace(/\{\{story_id\}\}/g, storyId);
    }
    if (epicId) {
      interpolatedOutput = interpolatedOutput.replace(/\{\{epic_id\}\}/g, epicId);
    }
    
    // Check for un-interpolated variables after interpolation
    const remainingVars = detectUninterpolatedVariables(interpolatedOutput);
    if (remainingVars.length > 0) {
      // Check if any remaining variables are required (workflow_id is always required if present)
      const hasRequiredUnresolved = remainingVars.some(v => v === '{{workflow_id}}');
      if (hasRequiredUnresolved) {
        console.error(`❌ Error: Required template variable {{workflow_id}} could not be resolved.`);
        console.error(`   Please provide a workflow ID using --id <workflow-id>`);
        process.exit(1);
      }
      // Warn for optional variables
      console.warn(`⚠️  Warning: Un-interpolated template variables found: ${remainingVars.join(', ')}`);
      console.warn(`   This may cause artifact path resolution issues.`);
    }
  }
  
  // Use path resolver if run-id provided, otherwise legacy paths
  let inputPath;
  if (runId) {
    inputPath = resolveArtifactPath(runId, interpolatedOutput);
  } else {
    inputPath = resolve(artifactsDir, interpolatedOutput);
  }
  
  // Schema is optional - use same path resolution strategy as workflow files
  const schemaPath = config.schema ? resolveSchemaPath(config.schema) : null;
  
  // Validate schema file exists if specified
  if (config.schema && schemaPath && !existsSync(schemaPath)) {
    console.error(`\n❌ Error: Schema file not found: ${config.schema}`);
    console.error(`   Resolved path: ${schemaPath}`);
    console.error(`   Workflow: ${workflowPath}`);
    console.error(`   Step: ${args.step} (${stepName})`);
    console.error(`   Agent: ${agentName}`);
    console.error(`\n   Common causes:`);
    console.error(`   - Schema file was moved or deleted`);
    console.error(`   - Path in workflow YAML is incorrect`);
    console.error(`   - File permissions issue`);
    console.error(`   - Working directory is incorrect`);
    console.error(`\n   Please ensure the schema file exists at the specified path.`);
    process.exit(1);
  }
  
  // Determine gate path - use run directory if run-id provided
  let gatePath;
  let gatePathRaw;
  
  if (runId) {
    // Use run directory gate path
    gatePath = resolveGatePath(runId, args.step);
    gatePathRaw = `gates/step-${args.step}.json`; // Relative path for display
  } else {
    // Legacy gate path handling
    const gateTemplateCheck = validateTemplateVariableSyntax(config.gate);
    if (!gateTemplateCheck.valid) {
      console.error(`❌ Error: Malformed template variables in gate path: ${config.gate}`);
      gateTemplateCheck.errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }
    
    gatePathRaw = config.gate;
    gatePathRaw = gatePathRaw.replace(/\{\{workflow_id\}\}/g, workflowId);
    if (storyId) {
      gatePathRaw = gatePathRaw.replace(/\{\{story_id\}\}/g, storyId);
    }
    if (epicId) {
      gatePathRaw = gatePathRaw.replace(/\{\{epic_id\}\}/g, epicId);
    }
    
    // Check for un-interpolated variables
    const gateRemainingVars = detectUninterpolatedVariables(gatePathRaw);
    if (gateRemainingVars.length > 0) {
      console.warn(`⚠️  Warning: Un-interpolated template variables in gate path: ${gateRemainingVars.join(', ')}`);
    }
    
    gatePath = resolve(process.cwd(), gatePathRaw);
    gateDir = dirname(gatePath);
  }
  const gateScript = resolve(__dirname, 'gates', 'gate.mjs');
  
  // Validate gate script exists
  if (!existsSync(gateScript)) {
    console.error(`❌ Error: Gate script not found at ${gateScript}`);
    console.error(`   Please ensure the gates directory and gate.mjs file exist.`);
    process.exit(1);
  }

  // Ensure directories exist (skip in dry-run mode)
  if (!isDryRun) {
    if (!existsSync(artifactsDir)) {
      try {
        mkdirSync(artifactsDir, { recursive: true });
      } catch (error) {
        console.error(`❌ Error: Failed to create artifacts directory: ${artifactsDir}`);
        console.error(`   ${error.message}`);
        process.exit(1);
      }
    }
    if (!existsSync(gateDir)) {
      try {
        mkdirSync(gateDir, { recursive: true });
        if (!existsSync(gateDir)) {
          throw new Error('Directory creation appeared to succeed but directory does not exist');
        }
      } catch (error) {
        console.error(`❌ Error: Failed to create gate directory: ${gateDir}`);
        console.error(`   ${error.message}`);
        process.exit(1);
      }
    }
  } else {
    // In dry-run mode, just validate paths would be valid
    console.log(`✓ Would create artifacts directory: ${artifactsDir}`);
    console.log(`✓ Would create gate directory: ${gateDir}`);
  }

  // Get step name and agent from workflow for better error messages
  // (stepInfo already retrieved above for context monitoring)
  const stepName = stepInfo?.name || `Step ${args.step}`;

  // Declare execution result at higher scope for skill validation
  let executionResult = null;

  // Check if step has a condition that needs to be evaluated
  const stepCondition = stepInfo?.condition || null;

  if (stepCondition) {
    console.log(`\n🔍 Evaluating step condition: "${stepCondition}"`);

    // Build context for condition evaluation
    // Try to load previous step outputs if available
    let previousStepOutput = {};
    try {
      // Load plan artifact if available (common dependency for conditional steps)
      const planPath = resolveArtifactPath(runId, `plan-${workflowId}.json`);
      if (existsSync(planPath)) {
        const planData = JSON.parse(readFileSync(planPath, 'utf-8'));
        previousStepOutput = planData;
      }
    } catch (error) {
      // Ignore errors loading previous outputs
    }

    const conditionContext = {
      config: {
        user_requested_multi_ai_review: process.env.MULTI_AI_REVIEW === 'true',
        critical_security_changes: previousStepOutput.overall_risk === 'high' || previousStepOutput.overall_risk === 'critical',
        security_focus: previousStepOutput.security_focus === true,
        critical_security_issues_found: previousStepOutput.critical_issues_count > 0
      },
      env: {
        MULTI_AI_ENABLED: process.env.MULTI_AI_ENABLED === 'true',
        CI: process.env.CI === 'true'
      },
      providers: (process.env.MULTI_AI_PROVIDERS || 'claude,gemini').split(','),
      step: { output: previousStepOutput },
      artifacts: previousStepOutput
    };

    const shouldExecute = evaluateCondition(stepCondition, conditionContext);

    if (!shouldExecute) {
      console.log(`   ⏭️  Condition not met - skipping step ${args.step}`);
      console.log(`   Step will not execute: ${stepName}\n`);

      // Create a gate file indicating the step was skipped
      const skipGateResult = {
        valid: true,
        skipped: true,
        reason: `Condition not met: ${stepCondition}`,
        timestamp: new Date().toISOString(),
        step: args.step,
        condition: stepCondition,
        evaluated_context: conditionContext
      };

      if (!isDryRun) {
        writeFileSync(gatePath, JSON.stringify(skipGateResult, null, 2));
        console.log(`   ✅ Gate file created: ${gatePathRaw} (marked as skipped)`);
      }

      // Exit successfully - skipped steps are not failures
      process.exit(0);
    }

    console.log(`   ✅ Condition met - proceeding with step execution\n`);
  }

  // Execute agent if not a tool-based step and run-id is provided (skip in dry-run)
  if (runId && !config.tool && agentName) {
    if (isDryRun) {
      console.log(`\n🔍 DRY-RUN: Would execute agent for Step ${args.step}: ${stepName}`);
      console.log(`   👤 Agent:  ${agentName}`);
      console.log(`   📋 Step:   ${stepName}`);
      console.log(`   ⚠️  Agent execution skipped in dry-run mode\n`);
    } else {
      // Validate enforcement gates before step execution
      if (config.validation?.gate) {
        console.log(`\n🔒 Validating Enforcement Gates for Step ${args.step}...`);
        try {
          const workflowName = basename(workflowPath, '.yaml');
          const taskDescription = config.description || stepName;
          const planId = args['plan-id'] || 'plan';
          
          const gateResult = await validateExecutionGate({
            runId,
            workflowName,
            stepNumber: parseInt(args.step, 10),
            planId,
            taskDescription,
            assignedAgents: [agentName],
            options: {
              agentType: agentName,
              taskType: config.taskType,
              complexity: config.complexity
            }
          });
          
          if (!gateResult.allowed) {
            console.error(`\n❌ BLOCKED: Enforcement gate validation failed for Step ${args.step}`);
            console.error(`   Summary: ${gateResult.summary}`);
            if (gateResult.blockers.length > 0) {
              console.error(`\n   Blockers:`);
              gateResult.blockers.forEach(blocker => {
                console.error(`   - ${blocker.type}: ${blocker.message}`);
              });
            }
            if (gateResult.warnings.length > 0) {
              console.warn(`\n   Warnings:`);
              gateResult.warnings.forEach(warning => {
                console.warn(`   - ${warning.type}: ${warning.message}`);
              });
            }
            process.exit(1);
          } else {
            console.log(`   ✅ All gates passed`);
            if (gateResult.warnings.length > 0) {
              console.warn(`   ⚠️  ${gateResult.warnings.length} warning(s):`);
              gateResult.warnings.forEach(warning => {
                console.warn(`      - ${warning.message}`);
              });
            }
          }
        } catch (gateError) {
          console.error(`\n❌ Error: Enforcement gate validation failed: ${gateError.message}`);
          console.error(`   Continuing with step execution (gate validation is non-blocking on errors)`);
        }
      }
      
      console.log(`\n🤖 Executing Agent for Step ${args.step}: ${stepName}`);
      console.log(`   👤 Agent:  ${agentName}`);
      console.log(`   📋 Step:   ${stepName}\n`);

      try {
        // PRE-EXECUTION: Get skill requirements from workflow step
        const step = findStepInWorkflow(workflow, args.step);
        const skillRequirements = getStepSkillRequirements(step);

        console.log(`\n📚 Injecting Skills for ${agentName}...`);

        // Inject skill requirements into agent instruction
        const taskDescription = step.description || step.name || `Step ${args.step}`;
        const skillInjection = await injectSkillsForAgent(agentName, taskDescription, {
          includeRecommended: false // Only required and triggered skills
        });

        if (skillInjection.success) {
          console.log(`   ✅ Injected ${skillInjection.loadedSkills.length} skill(s)`);
          console.log(`   Required: ${skillInjection.requiredSkills.join(', ') || 'none'}`);
          if (skillInjection.triggeredSkills.length > 0) {
            console.log(`   Triggered: ${skillInjection.triggeredSkills.join(', ')}`);
          }

          if (skillInjection.failedSkills.length > 0) {
            console.warn(`   ⚠️  Failed to load: ${skillInjection.failedSkills.join(', ')}`);
          }
        } else {
          console.error(`   ❌ Skill injection failed: ${skillInjection.error}`);
        }

        // PRE-EXECUTION: Validate skill availability
        const allRequiredSkills = [
          ...skillRequirements.required,
          ...skillInjection.requiredSkills
        ].filter((skill, index, self) => self.indexOf(skill) === index); // Unique

        if (allRequiredSkills.length > 0) {
          console.log(`\n🔍 Validating skill availability...`);
          const availabilityCheck = await validateSkillAvailability(allRequiredSkills);

          if (!availabilityCheck.valid) {
            console.error(`\n❌ Required skills missing:`);
            availabilityCheck.missing.forEach(m => {
              console.error(`   - ${m.skill}: ${m.message}`);
            });

            if (skillRequirements.validation.mode === 'blocking') {
              console.error(`\n❌ BLOCKED: Cannot proceed without required skills`);
              process.exit(1);
            } else {
              console.warn(`\n⚠️  WARNING: Proceeding despite missing skills (validation mode: ${skillRequirements.validation.mode})`);
            }
          } else {
            console.log(`   ✅ All required skills available`);
          }
        }

        // Get injections from step config and merge with skill injection
        const injections = config.injections || [];

        // Add skill injection to agent instructions
        if (skillInjection.success && skillInjection.skillPrompt) {
          injections.push({
            type: 'skill_requirements',
            content: skillInjection.skillPrompt,
            priority: 'high'
          });
        }

        // Execute agent
        executionResult = await executeAgent({
          agent: agentName,
          runId: runId,
          step: parseInt(args.step),
          injections: injections,
          workflowStep: config
        });
      
      // Handle approval requirement
      if (executionResult.status === 'awaiting_approval') {
        console.log(`\n⏸️  Execution paused - awaiting user approval`);
        console.log(`   Please review and approve to continue.\n`);
        await updateRunSummary(runId);
        process.exit(0);
      }
      
      // Handle execution failure
      if (executionResult.status === 'failed') {
        console.error(`\n❌ Agent execution failed for step ${args.step}`);
        if (executionResult.error) {
          console.error(`   Error: ${executionResult.error}`);
        }
        if (executionResult.stderr) {
          console.error(`   Stderr: ${executionResult.stderr}`);
        }
        process.exit(1);
      }
      
      // Log execution success
      console.log(`✅ Agent execution completed`);
      console.log(`   Duration: ${executionResult.duration_ms}ms`);
      console.log(`   Artifacts: ${executionResult.artifacts_written.length}`);
      if (executionResult.token_usage) {
        console.log(`   Token usage: ${executionResult.token_usage.used}/${executionResult.token_usage.limit} (${executionResult.token_usage.confidence} confidence)`);
      }
      console.log('');

      // POST-EXECUTION: Validate skill usage
      if (skillRequirements.validation.enforce_usage && allRequiredSkills.length > 0) {
        console.log(`\n🔍 Validating skill usage...`);

        // Get execution log from result (if available)
        const executionLog = executionResult.log || executionResult.output || '';

        if (!executionLog) {
          console.warn(`   ⚠️  No execution log available for skill validation`);
        } else {
          try {
            // Validate skill usage against requirements
            const skillValidation = await validateSkillUsage(
              agentName,
              taskDescription,
              executionLog
            );

            // Display validation results
            console.log(`   Compliance Score: ${skillValidation.complianceScore}%`);
            console.log(`   Expected: ${skillValidation.expected.join(', ') || 'none'}`);
            console.log(`   Used: ${skillValidation.used.join(', ') || 'none'}`);

            if (skillValidation.compliant) {
              console.log(`   ✅ All required skills used`);
            } else {
              console.error(`\n❌ Skill compliance check failed:`);

              if (skillValidation.violations.missingRequired.length > 0) {
                console.error(`   Missing required skills: ${skillValidation.violations.missingRequired.join(', ')}`);
              }

              if (skillValidation.violations.missingTriggered.length > 0) {
                console.warn(`   ⚠️  Missing triggered skills: ${skillValidation.violations.missingTriggered.join(', ')}`);
              }

              // Generate and display violation report
              const violationReport = generateViolationReport(skillValidation);
              console.log(`\n${violationReport}`);

              // Enforce blocking if configured
              if (skillRequirements.validation.mode === 'blocking') {
                console.error(`\n❌ BLOCKED: Skill compliance failure blocks step execution`);

                // Record skill validation in gate file before exiting
                await recordSkillValidation(workflowId, args.step, skillValidation, gatePath, isDryRun);

                throw new SkillComplianceError(skillValidation);
              } else {
                console.warn(`\n⚠️  WARNING: Skill compliance failure (validation mode: ${skillRequirements.validation.mode})`);
              }
            }

            // Store skill validation result for gate file recording
            executionResult.skillValidation = skillValidation;
          } catch (validationError) {
            console.error(`\n❌ Skill validation error: ${validationError.message}`);

            if (validationError instanceof SkillComplianceError) {
              throw validationError; // Re-throw to block execution
            }

            // Non-blocking validation errors
            console.warn(`   ⚠️  Continuing despite validation error`);
          }
        }
      }

      // Update run status (skip in dry-run)
      if (!isDryRun) {
        await updateRun(runId, {
          current_step: parseInt(args.step),
          status: 'in_progress'
        });
      }
      
      } catch (error) {
        console.error(`\n❌ Error executing agent: ${error.message}`);
        console.error(`   Step: ${args.step} (${stepName})`);
        console.error(`   Agent: ${agentName}`);
        process.exit(1);
      }
    }
  }

  console.log(`\n🚀 Running Validation for Step ${args.step}: ${stepName}`);
  console.log(`   👤 Agent:  ${agentName}`);
  if (config.tool) {
    console.log(`   🔧 Tool:   ${config.tool} (tool-based step)`);
  }
  console.log(`   📂 Input:  ${interpolatedOutput}${interpolatedOutput !== config.output ? ` (from ${config.output})` : ''}`);
  console.log(`   📋 Schema: ${config.schema || '(none - flexible validation)'}`);
  console.log(`   🛡️  Gate:   ${gatePathRaw}\n`);

  if (!existsSync(inputPath)) {
    console.error(`❌ Error: Input artifact not found: ${inputPath}`);
    console.error(`   Step ${args.step} (${stepName}) executed by ${agentName} should have created '${interpolatedOutput}'.`);
    console.error(`   Original output definition: '${config.output}'`);
    console.error(`   Please ensure the agent completed successfully before running validation.`);
    console.error(`\n💡 Suggestions:`);
    console.error(`   - Verify the agent executed successfully`);
    console.error(`   - Check that the artifact was saved to: ${artifactsDir}`);
    console.error(`   - Ensure template variables were correctly interpolated`);
    console.error(`   - Review agent logs for any errors during artifact creation`);
    process.exit(1);
  }

  // Construct command
  // Schema is optional - gate script handles missing schema
  let command = `node "${gateScript}" --input "${inputPath}" --gate "${gatePath}" --autofix 1`;
  if (schemaPath && existsSync(schemaPath)) {
    command += ` --schema "${schemaPath}"`;
  }
  
  // Retry logic for validation
  const maxRetries = 3;
  let retryCount = 0;
  let validationSuccess = false;
  let lastError = null;
  
  while (retryCount < maxRetries && !validationSuccess) {
    try {
      if (retryCount > 0) {
        const backoffSeconds = Math.pow(2, retryCount - 1);
        console.log(`\n⏳ Retrying validation (attempt ${retryCount + 1}/${maxRetries}) after ${backoffSeconds}s backoff...`);
        await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
      }
      
      if (isDryRun) {
        console.log(`\n🔍 DRY-RUN: Would run validation command:`);
        console.log(`   ${command}`);
        console.log(`   ✓ Schema path resolved: ${schemaPath || 'none'}`);
        console.log(`   ✓ Artifact path would be: ${inputPath}`);
        console.log(`   ✓ Gate path would be: ${gatePath}`);
        validationSuccess = true;
        console.log('\n✨ DRY-RUN: Validation command would succeed');
      } else {
        execSync(command, { stdio: 'inherit' });
        validationSuccess = true;
        console.log('\n✨ Primary Output Validation Successful!');
      }
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Check if error is transient (network, file system, etc.)
      const isTransientError = error.message.includes('ENOENT') || 
                              error.message.includes('EACCES') ||
                              error.message.includes('network') ||
                              error.message.includes('timeout') ||
                              error.code === 'ENOENT' ||
                              error.code === 'EACCES';
      
      if (retryCount >= maxRetries || !isTransientError) {
        // Non-transient error or max retries reached
        console.error(`\n❌ Validation failed after ${retryCount} attempt(s)`);
        if (!isTransientError) {
          console.error('   Error appears to be non-transient - not retrying');
        }
        throw error;
      }
      
      console.warn(`⚠️  Validation attempt ${retryCount} failed: ${error.message}`);
      console.warn('   Retrying with exponential backoff...');
    }
  }
  
  if (!validationSuccess) {
    throw lastError || new Error('Validation failed after all retries');
  }
  
  try {
    
    // Check gate file validation status
    try {
      if (existsSync(gatePath)) {
        const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
        if (gateData.valid) {
          console.log(`\n✅ Gate validation status: PASSED`);
          if (gateData.autofix_applied && gateData.fixed_fields_count > 0) {
            console.log(`   ℹ️  Autofix applied: ${gateData.fixed_fields_count} field(s) fixed`);
          }
        } else {
          console.error(`\n❌ Gate validation status: FAILED`);
          console.error(`   Errors: ${gateData.errors?.length || 0}`);
          if (gateData.errors && gateData.errors.length > 0) {
            console.error(`   First few errors:`);
            gateData.errors.slice(0, 3).forEach((error, index) => {
              console.error(`     ${index + 1}. ${error}`);
            });
            if (gateData.errors.length > 3) {
              console.error(`     ... and ${gateData.errors.length - 3} more error(s)`);
            }
          }
        }
      }
    } catch (gateError) {
      // Gate file check failed - not critical, continue
      console.warn(`⚠️  Warning: Could not read gate file for status check: ${gateError.message}`);
    }

    // Record skill validation in gate file (if skill validation was performed)
    if (runId && agentName && executionResult && executionResult.skillValidation) {
      console.log(`\n📝 Recording skill validation results...`);
      try {
        await recordSkillValidation(
          workflowId,
          args.step,
          executionResult.skillValidation,
          gatePath,
          isDryRun
        );
      } catch (recordError) {
        console.warn(`⚠️  Warning: Failed to record skill validation: ${recordError.message}`);
      }
    }

    // Run custom validation checks if configured
    // All keys normalized to snake_case at load time - use only snake_case below
    if (config.custom_checks && Array.isArray(config.custom_checks) && config.custom_checks.length > 0) {
      console.log(`\n🔍 Running ${config.custom_checks.length} custom validation check(s)...`);
      
      try {
        const artifactData = JSON.parse(readFileSync(inputPath, 'utf-8'));
        const customValidationResult = await runCustomValidationChecks(
          config.custom_checks,
          artifactData,
          inputPath,
          args.step,
          workflowId
        );
        
        if (customValidationResult.valid) {
          console.log(`✅ Custom validation checks: PASSED`);
        } else {
          console.error(`❌ Custom validation checks: FAILED`);
          customValidationResult.errors.forEach((error, index) => {
            console.error(`   ${index + 1}. ${error}`);
          });
          
          // Update gate file with custom validation errors
          if (existsSync(gatePath)) {
            try {
              const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
              gateData.custom_validation = {
                valid: false,
                errors: customValidationResult.errors,
                checks_run: config.custom_checks
              };
              if (!isDryRun) {
                writeFileSync(gatePath, JSON.stringify(gateData, null, 2), 'utf-8');
              } else {
                console.log(`🔍 DRY-RUN: Would write gate file: ${gatePath}`);
              }
            } catch (updateError) {
              console.warn(`⚠️  Warning: Could not update gate file with custom validation results: ${updateError.message}`);
            }
          }
          
          process.exit(1);
        }
      } catch (customError) {
        console.error(`❌ Error running custom validation checks: ${customError.message}`);
        process.exit(1);
      }
    }
    
    // Validate secondary outputs if configured
    // All keys normalized to snake_case at load time - use only snake_case below
    if (config.secondary_outputs && Array.isArray(config.secondary_outputs) && config.secondary_outputs.length > 0) {
      console.log(`\n🔍 Validating ${config.secondary_outputs.length} secondary output(s)...`);
      
      let allSecondaryValid = true;
      for (const secondary of config.secondary_outputs) {
        const artifactName = secondary.artifact;
        const secondarySchema = secondary.schema;
        const validationTiming = secondary.validation_timing || 'post-generation';
        
        // Interpolate template variables in artifact name
        let interpolatedArtifact = artifactName;
        interpolatedArtifact = interpolatedArtifact.replace(/\{\{workflow_id\}\}/g, workflowId);
        if (storyId) {
          interpolatedArtifact = interpolatedArtifact.replace(/\{\{story_id\}\}/g, storyId);
        }
        if (epicId) {
          interpolatedArtifact = interpolatedArtifact.replace(/\{\{epic_id\}\}/g, epicId);
        }
        
        const secondaryArtifactPath = resolve(artifactsDir, interpolatedArtifact);
        
        // Check if artifact exists
        if (!existsSync(secondaryArtifactPath)) {
          console.error(`\n❌ Secondary output artifact not found: ${interpolatedArtifact}`);
          console.error(`   Expected at: ${secondaryArtifactPath}`);
          console.error(`   This artifact should be created by ${agentName} during step execution.`);
          allSecondaryValid = false;
          continue;
        }
        
        // Resolve schema path
        const secondarySchemaPath = secondarySchema ? resolveSchemaPath(secondarySchema) : null;
        
        // Validate schema exists if specified
        if (secondarySchema && secondarySchemaPath && !existsSync(secondarySchemaPath)) {
          console.error(`\n❌ Secondary output schema file not found: ${secondarySchema}`);
          console.error(`   Resolved path: ${secondarySchemaPath}`);
          allSecondaryValid = false;
          continue;
        }
        
        // Create gate path for secondary output (use same directory as primary gate)
        const primaryGateBasename = gatePathRaw.split('/').pop().replace('.json', '');
        const secondaryGateBasename = `${primaryGateBasename}-${interpolatedArtifact.replace('.json', '').replace(/\{\{workflow_id\}\}/g, workflowId)}`;
        const secondaryGatePath = resolve(gateDir, `${secondaryGateBasename}.json`);
        const secondaryGateDir = dirname(secondaryGatePath);
        if (!existsSync(secondaryGateDir)) {
          if (isDryRun) {
            console.log(`🔍 DRY-RUN: Would create secondary gate directory: ${secondaryGateDir}`);
          } else {
            try {
              mkdirSync(secondaryGateDir, { recursive: true });
            } catch (error) {
              console.error(`❌ Error: Failed to create secondary gate directory: ${secondaryGateDir}`);
              allSecondaryValid = false;
              continue;
            }
          }
        }
        
        // Validate secondary output
        let secondaryCommand = `node "${gateScript}" --input "${secondaryArtifactPath}" --gate "${secondaryGatePath}" --autofix 1`;
        if (secondarySchemaPath && existsSync(secondarySchemaPath)) {
          secondaryCommand += ` --schema "${secondarySchemaPath}"`;
        }
        
        try {
          execSync(secondaryCommand, { stdio: 'inherit' });
          console.log(`   ✅ Secondary output validated: ${interpolatedArtifact}`);
        } catch (e) {
          console.error(`\n❌ Secondary output validation failed: ${interpolatedArtifact}`);
          console.error(`   Schema: ${secondarySchema || '(none)'}`);
          allSecondaryValid = false;
        }
      }
      
      if (!allSecondaryValid) {
        console.error(`\n⛔ Step ${args.step} Secondary Output Validation Failed.`);
        console.error(`   Please check the errors above and fix the secondary artifacts.`);
        process.exit(1);
      }
      
      console.log(`\n✨ All Secondary Outputs Validated Successfully!`);
    }
    
    console.log('\n✨ Step Validation Complete! You may proceed to the next step.');
    
    // Register artifacts and update run.json if run-id provided
    if (runId) {
      try {
        // Read gate file to get validation status
        let validationStatus = 'pending';
        if (existsSync(gatePath)) {
          const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
          validationStatus = gateData.valid ? 'pass' : 'fail';
        }
        
        // Register primary artifact (skip in dry-run)
        if (!isDryRun) {
          await registerArtifact(runId, {
            name: interpolatedOutput,
            step: parseInt(args.step),
            agent: agentName,
            path: inputPath,
            dependencies: [], // TODO: Extract from step inputs
            validationStatus: validationStatus
          });
        } else {
          console.log(`🔍 DRY-RUN: Would register artifact: ${interpolatedOutput}`);
        }
        
        // Register secondary artifacts if any
        if (config.secondary_outputs && Array.isArray(config.secondary_outputs)) {
          for (const secondaryOutput of config.secondary_outputs) {
            let secondaryInterpolated = secondaryOutput;
            secondaryInterpolated = secondaryInterpolated.replace(/\{\{workflow_id\}\}/g, workflowId);
            if (storyId) {
              secondaryInterpolated = secondaryInterpolated.replace(/\{\{story_id\}\}/g, storyId);
            }
            if (epicId) {
              secondaryInterpolated = secondaryInterpolated.replace(/\{\{epic_id\}\}/g, epicId);
            }
            
            const secondaryPath = resolveArtifactPath(runId, secondaryInterpolated);
            if (existsSync(secondaryPath) || isDryRun) {
              if (!isDryRun) {
                await registerArtifact(runId, {
                  name: secondaryInterpolated,
                  step: parseInt(args.step),
                  agent: agentName,
                  path: secondaryPath,
                  dependencies: [interpolatedOutput],
                  validationStatus: validationStatus
                });
              } else {
                console.log(`🔍 DRY-RUN: Would register secondary artifact: ${secondaryInterpolated}`);
              }
            }
          }
        }
        
        // Enforce artifact contract (fail fast if contract not met) - skip in dry-run
        if (!isDryRun) {
          try {
            await enforceArtifactContract(runId, parseInt(args.step), {
              requireSchema: true,
              requireGate: true,
              requireReasoning: false // Reasoning is optional for now
            });
            console.log(`\n✅ Artifact contract validated for step ${args.step}`);
          } catch (contractError) {
            console.error(`\n❌ Artifact contract violation for step ${args.step}:`);
            console.error(`   ${contractError.message}`);
            // Don't fail the step, but log the violation
            // In strict mode, this would cause step to fail
          }
          
          // Check publishing status for publishable artifacts
          try {
            const { readArtifactRegistry } = await import('./run-manager.mjs');
            const registry = await readArtifactRegistry(runId);
            const stepArtifacts = Object.values(registry.artifacts || {}).filter(
              a => a.step === parseInt(args.step)
            );
            
            for (const artifact of stepArtifacts) {
              const metadata = artifact.metadata || {};
              if (metadata.publishable === true && metadata.published !== true) {
                console.warn(`\n⚠️  Warning: Artifact "${artifact.name}" is marked as publishable but not published`);
                console.warn(`   Publish status: ${metadata.publish_status || 'pending'}`);
                if (metadata.publish_error) {
                  console.warn(`   Last error: ${metadata.publish_error}`);
                }
                console.warn(`   Consider using artifact-publisher skill to publish this artifact`);
              }
            }
          } catch (publishCheckError) {
            // Publishing check failed - not critical, continue
            console.warn(`⚠️  Warning: Could not check publishing status: ${publishCheckError.message}`);
          }
        } else {
          console.log(`🔍 DRY-RUN: Would validate artifact contract for step ${args.step}`);
          console.log(`🔍 DRY-RUN: Would check publishing status for publishable artifacts`);
        }
        
        // Update run.json with step completion (skip in dry-run)
        if (!isDryRun) {
          await updateRun(runId, {
            current_step: parseInt(args.step),
            status: 'in_progress'
          });
          
          // Update dashboard
          try {
            await updateRunSummary(runId);
          } catch (dashboardError) {
            console.warn(`⚠️  Warning: Could not update dashboard: ${dashboardError.message}`);
          }
          
          // Create checkpoint after successful step execution
          try {
            const checkpoint = await createCheckpoint(runId, parseInt(args.step), {
              step_name: stepName,
              agent: agentName,
              artifacts: [interpolatedOutput],
              validation_status: validationStatus
            });
            console.log(`\n💾 Checkpoint created: ${checkpoint.checkpoint_id}`);
          } catch (checkpointError) {
            console.warn(`⚠️  Warning: Could not create checkpoint: ${checkpointError.message}`);
            // Continue - checkpoint creation is not critical
          }
          
          console.log(`\n📝 Artifacts registered in run ${runId}`);
        } else {
          console.log(`\n🔍 DRY-RUN: Would register artifacts in run ${runId}`);
        }
      } catch (error) {
        console.warn(`⚠️  Warning: Could not register artifacts: ${error.message}`);
        // Continue - artifact registration is not critical for step execution
      }
    }
    
    // Context monitoring: Record context usage after step execution
    try {
      // Record step completion (actual usage would come from agent execution tracking)
      // This is a placeholder - in production, actual usage would be tracked during agent execution
      // The actual usage values would be obtained from the agent execution system
      recordContextUsage(agentName, {
        total: 0, // Would be actual usage from agent execution
        systemPrompt: 0,
        systemTools: 0,
        mcpTools: 0,
        messages: 0
      });
      
      // Check threshold again after recording
      const postCheck = checkContextThreshold(agentName, { total: 0 });
      if (postCheck.thresholdReached) {
        console.warn(`\n⚠️  Post-execution context check: ${postCheck.percentage}%`);
        console.warn(`   ${postCheck.recommendation}`);
      }
    } catch (error) {
      // Context monitoring not critical - continue execution
      // Log warning but don't fail workflow
      console.warn(`⚠️  Context monitoring unavailable: ${error.message}`);
    }
  } catch (e) {
    console.error(`\n⛔ Step ${args.step} Validation Failed`);
    console.error(`   Agent: ${agentName}`);
    console.error(`   Artifact: ${interpolatedOutput}`);
    console.error(`   Gate file: ${gatePathRaw}`);
    
    // Try to read gate file for detailed error information
    try {
      if (existsSync(gatePath)) {
        const gateData = JSON.parse(readFileSync(gatePath, 'utf-8'));
        if (!gateData.valid && gateData.errors) {
          console.error(`\n   Validation Errors:`);
          gateData.errors.forEach((error, index) => {
            console.error(`     ${index + 1}. ${error}`);
          });
        }
        console.error(`\n   💡 Review the gate file for complete validation details: ${gatePath}`);
      }
    } catch (gateError) {
      // Gate file read failed - continue with basic error message
    }
    
    console.error(`\n   💡 Suggestions:`);
    console.error(`   - Fix the errors in the artifact file`);
    console.error(`   - Re-run validation after fixes`);
    console.error(`   - Check schema file if validation errors are unclear`);
    console.error(`   - Review agent output for any warnings or issues`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(2);
});

// Export functions for testing
export {
  evaluateCondition,
  tokenizeCondition,
  evaluateAtomic,
  safeGet,
  parseExpression,
  parseOr,
  parseAnd,
  parsePrimary
};
