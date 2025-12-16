#!/usr/bin/env node
/**
 * Workflow Runner
 * 
 * Enhanced workflow runner that supports:
 * - Step validation gates
 * - Decision point evaluation
 * - Loop iteration management
 * - Phase transitions
 * 
 * Usage:
 *   node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>]
 *   node workflow_runner.js --workflow <yaml-path> --decision <decision-id> [--id <workflow-id>]
 *   node workflow_runner.js --workflow <yaml-path> --loop <loop-type> [--id <workflow-id>]
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { evaluateDecision } from './workflow/decision-handler.mjs';
import { initializeLoop, advanceLoop, hasMoreIterations, getCurrentItem } from './workflow/loop-handler.mjs';

// Import js-yaml for proper YAML parsing
let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch (error) {
  console.error('❌ Error: js-yaml package is required for workflow parsing.');
  console.error('   Please install it: pnpm add -D js-yaml');
  process.exit(1);
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
  return parsed;
}

/**
 * Load and parse workflow YAML file
 */
function loadWorkflowYAML(workflowPath) {
  try {
    const content = readFileSync(workflowPath, 'utf-8');
    return yaml.load(content);
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
  
  // Check agent file exists
  if (step.agent) {
    const agentFile = resolve(process.cwd(), `.claude/agents/${step.agent}.md`);
    if (!existsSync(agentFile)) {
      errors.push(`Agent file not found: .claude/agents/${step.agent}.md`);
    }
  }
  
  // Check schema file exists if specified
  if (step.validation?.schema) {
    const schemaPath = resolve(process.cwd(), step.validation.schema);
    if (!existsSync(schemaPath)) {
      errors.push(`Schema file not found: ${step.validation.schema}`);
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
  
  return {
    output: primaryOutput,
    schema,
    gate,
    secondaryOutputs
  };
}

/**
 * Get step information (name, agent) from workflow YAML using parsed structure
 */
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

function main() {
  const args = parseArgs();
  
  if (!args.workflow) {
    console.error('Error: Missing workflow argument');
    console.error('Usage: node workflow_runner.js --workflow <yaml-path> [--step <number>|--decision <id>|--loop <type>] [--id <workflow-id>]');
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
  
  const workflowId = args.id || 'default-run';
  
  // Validate workflow_id format if provided (not default)
  if (workflowId !== 'default-run') {
    const idValidation = validateWorkflowIdFormat(workflowId);
    if (!idValidation.valid) {
      console.error(`❌ Error: ${idValidation.error}`);
      process.exit(1);
    }
  }
  
  if (!existsSync(workflowPath)) {
    console.error(`Error: Workflow file not found at ${workflowPath}`);
    console.error(`   Original path: ${args.workflow}`);
    console.error(`   Resolved from: ${resolve(__dirname, '../..')}`);
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

  // Handle step validation (original functionality)
  if (!args.step) {
    console.error('Error: Must specify --step, --decision, or --loop');
    console.error('Usage: node workflow_runner.js --workflow <yaml-path> [--step <number>|--decision <id>|--loop <type>] [--id <workflow-id>] [--story-id <id>] [--epic-id <id>]');
    process.exit(1);
  }

  const workflow = loadWorkflowYAML(workflowPath);
  const storyId = args['story-id'] || null;
  const epicId = args['epic-id'] || null;
  
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

  // Construct paths
  // Artifacts are stored in .claude/context/artifacts/
  const artifactsDir = resolve(process.cwd(), '.claude/context/artifacts');
  
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
    // Check if workflow_id is required but missing
    if (interpolatedOutput.includes('{{workflow_id}}') && (!workflowId || workflowId === 'default-run')) {
      console.error(`❌ Error: Required template variable {{workflow_id}} is missing or not provided.`);
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
  
  const inputPath = resolve(artifactsDir, interpolatedOutput);
  
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
  
  // Interpolate template variables in gate path
  // Validate template variable syntax first
  const gateTemplateCheck = validateTemplateVariableSyntax(config.gate);
  if (!gateTemplateCheck.valid) {
    console.error(`❌ Error: Malformed template variables in gate path: ${config.gate}`);
    gateTemplateCheck.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
  
  let gatePathRaw = config.gate;
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
  
  const gatePath = resolve(process.cwd(), gatePathRaw);
  const gateDir = dirname(gatePath);
  const gateScript = resolve(__dirname, 'gates', 'gate.mjs');
  
  // Validate gate script exists
  if (!existsSync(gateScript)) {
    console.error(`❌ Error: Gate script not found at ${gateScript}`);
    console.error(`   Please ensure the gates directory and gate.mjs file exist.`);
    process.exit(1);
  }

  // Ensure directories exist
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

  // Get step name and agent from workflow for better error messages
  const stepInfo = getStepInfo(workflow, args.step);
  const stepName = stepInfo?.name || `Step ${args.step}`;
  const agentName = stepInfo?.agent || 'unknown agent';

  console.log(`\n🚀 Running Validation for Step ${args.step}: ${stepName}`);
  console.log(`   👤 Agent:  ${agentName}`);
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
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log('\n✨ Primary Output Validation Successful!');
    
    // Validate secondary outputs if configured
    if (config.secondaryOutputs && Array.isArray(config.secondaryOutputs) && config.secondaryOutputs.length > 0) {
      console.log(`\n🔍 Validating ${config.secondaryOutputs.length} secondary output(s)...`);
      
      let allSecondaryValid = true;
      for (const secondary of config.secondaryOutputs) {
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
          try {
            mkdirSync(secondaryGateDir, { recursive: true });
          } catch (error) {
            console.error(`❌ Error: Failed to create secondary gate directory: ${secondaryGateDir}`);
            allSecondaryValid = false;
            continue;
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
  } catch (e) {
    console.error(`\n⛔ Step ${args.step} Validation Failed. Please check the errors above and fix the artifact.`);
    console.error(`   Agent: ${agentName}`);
    console.error(`   Artifact: ${interpolatedOutput}`);
    process.exit(1);
  }
}

main();
