#!/usr/bin/env node
/**
 * Workflow Runner
 *
 * Enhanced workflow runner that supports:
 * - Template variable interpolation ({{workflow_id}}, {{story_id}}, {{epic_id}})
 * - Step validation gates
 * - Dependency validation (artifact references from previous steps)
 * - Artifact reference parsing
 *
 * Usage:
 *   node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>] [--story-id <story-id>] [--epic-id <epic-id>]
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    errors,
  };
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
      optional: input.includes('optional'),
    };
  }

  // Pattern 2: artifact.json (optional, from step X)
  match = input.match(/^(.+\.json)\s*\(optional,\s*from step (\d+(?:\.\d+)?)\)$/);
  if (match) {
    return {
      artifact: match[1].trim(),
      fromStep: match[2],
      optional: true,
    };
  }

  // If no "from step" pattern, it's a direct artifact name
  if (input.endsWith('.json')) {
    return {
      artifact: input.trim(),
      fromStep: null,
      optional: false,
    };
  }

  return null;
}

/**
 * Interpolate template variables in a string
 */
function interpolateTemplateVariables(str, workflowId, storyId = null, epicId = null) {
  if (typeof str !== 'string') return str;

  let result = str;
  result = result.replace(/\{\{workflow_id\}\}/g, workflowId);
  if (storyId) {
    result = result.replace(/\{\{story_id\}\}/g, storyId);
  }
  if (epicId) {
    result = result.replace(/\{\{epic_id\}\}/g, epicId);
  }

  return result;
}

/**
 * Find step in workflow YAML content
 */
function findStepInWorkflow(yamlContent, stepNumber) {
  const text = yamlContent.replace(/\r\n/g, '\n');
  const stepRegex = new RegExp(
    `- step: ${stepNumber}\\s*\\n([\\s\\S]*?)(?=\\n\\s*- step:|\\n\\s*completion_criteria:|$)`,
    'm'
  );
  const match = text.match(stepRegex);

  if (!match) return null;

  const block = match[1];

  // Extract agent
  const agentMatch = block.match(/agent:\s*(.+)/);
  const agent = agentMatch ? agentMatch[1].trim() : null;

  // Extract inputs
  const inputsMatch = block.match(/inputs:\s*\n((?:\s+-\s+.*\n)+)/);
  const inputs = inputsMatch
    ? inputsMatch[1]
        .split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.trim().substring(2).trim())
    : [];

  // Extract outputs
  const outputsMatch = block.match(/outputs:\s*\n((?:\s+-\s+.*\n)+)/);
  const outputs = outputsMatch
    ? outputsMatch[1]
        .split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.trim().substring(2).trim())
    : [];

  // Extract validation
  const schemaMatch = block.match(/schema:\s*(.+)/);
  const schema = schemaMatch ? schemaMatch[1].trim() : null;

  const gateMatch = block.match(/gate:\s*(.+)/);
  const gate = gateMatch ? gateMatch[1].trim() : null;

  return {
    step: stepNumber,
    agent,
    inputs,
    outputs,
    validation: {
      schema,
      gate,
    },
  };
}

/**
 * Validate step dependencies before execution
 */
function validateStepDependencies(
  yamlContent,
  stepNumber,
  workflowId,
  storyId = null,
  epicId = null
) {
  const step = findStepInWorkflow(yamlContent, stepNumber);
  if (!step) {
    return { valid: false, missing: [], errors: [`Step ${stepNumber} not found in workflow`] };
  }

  const missing = [];
  const errors = [];
  const artifactsDir = resolve(process.cwd(), '.opencode/context/artifacts');

  // Check agent file exists
  if (step.agent) {
    const agentFile = resolve(process.cwd(), `.opencode/agent/${step.agent}.md`);
    if (!existsSync(agentFile)) {
      errors.push(`Agent file not found: .opencode/agent/${step.agent}.md`);
    }
  }

  // Validate input artifacts from previous steps
  if (step.inputs && Array.isArray(step.inputs)) {
    for (const input of step.inputs) {
      const ref = parseArtifactReference(input);
      if (ref && ref.fromStep) {
        // This is a reference to a previous step's output
        const sourceStep = findStepInWorkflow(yamlContent, ref.fromStep);
        if (!sourceStep) {
          errors.push(`Input '${input}' references step ${ref.fromStep} which does not exist`);
          continue;
        }

        // Check if source step has this output
        let outputFound = false;
        if (sourceStep.outputs && Array.isArray(sourceStep.outputs)) {
          for (const output of sourceStep.outputs) {
            let outputName = null;
            if (typeof output === 'string' && !output.includes('reasoning:')) {
              outputName = output;
            }

            if (outputName) {
              // Interpolate template variables
              let interpolatedOutput = interpolateTemplateVariables(
                outputName,
                workflowId,
                storyId,
                epicId
              );
              let interpolatedArtifact = interpolateTemplateVariables(
                ref.artifact,
                workflowId,
                storyId,
                epicId
              );

              // Use basename comparison
              const outputBasename = interpolatedOutput.split('/').pop();
              const artifactBasename = interpolatedArtifact.split('/').pop();

              if (
                interpolatedOutput === interpolatedArtifact ||
                outputBasename === artifactBasename
              ) {
                outputFound = true;
                break;
              }
            }
          }
        }

        if (!outputFound) {
          errors.push(
            `Input '${input}' references artifact '${ref.artifact}' from step ${ref.fromStep}, but that step does not produce this artifact`
          );
          continue;
        }

        // Check if artifact file exists
        let interpolatedArtifact = interpolateTemplateVariables(
          ref.artifact,
          workflowId,
          storyId,
          epicId
        );
        const artifactPath = resolve(artifactsDir, interpolatedArtifact);

        if (!existsSync(artifactPath)) {
          if (ref.optional) {
            console.warn(
              `⚠️  Warning: Optional artifact '${interpolatedArtifact}' from step ${ref.fromStep} not found.`
            );
          } else {
            missing.push({
              artifact: interpolatedArtifact,
              fromStep: ref.fromStep,
              message: `Required artifact '${interpolatedArtifact}' from step ${ref.fromStep} not found. Run step ${ref.fromStep} first.`,
            });
          }
        }
      }
    }
  }

  // Check schema file exists if specified
  if (step.validation?.schema) {
    const schemaPath = resolve(process.cwd(), step.validation.schema);
    if (!existsSync(schemaPath)) {
      errors.push(`Schema file not found: ${step.validation.schema}`);
    }
  }

  return {
    valid: errors.length === 0 && missing.length === 0,
    missing,
    errors,
  };
}

/**
 * Validate workflow-level inputs against required inputs from YAML
 */
function validateWorkflowInputs(yamlContent, providedInputs = {}) {
  const workflowInputsMatch = yamlContent.match(
    /workflow_inputs:\s*\n\s+required:\s*\n((?:\s+-\s+.*\n)+)/
  );
  if (!workflowInputsMatch) return { valid: true, missing: [], required: [] };

  const requiredInputs = workflowInputsMatch[1]
    .split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(l => l.trim().substring(2).trim());

  const missing = requiredInputs.filter(input => !providedInputs || !providedInputs[input]);

  return {
    valid: missing.length === 0,
    missing,
    required: requiredInputs,
  };
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

// Simple regex-based YAML parser for specific workflow structure
function getStepConfig(yamlContent, stepNumber) {
  // Normalize line endings
  const text = yamlContent.replace(/\r\n/g, '\n');

  // Find the step block: "- step: N"
  const stepRegex = new RegExp(
    `- step: ${stepNumber}\\s*\\n([\\s\\S]*?)(?=\\n\\s*- step:|\\n\\s*completion_criteria:|$)`,
    'm'
  );
  const match = text.match(stepRegex);

  if (!match) return null;

  const block = match[1];

  // Extract outputs (assuming list of strings, we take the first one that looks like a file)
  const outputsMatch = block.match(/outputs:\s*\n((?:\s+-\s+.*\n)+)/);
  let primaryOutput = null;
  if (outputsMatch) {
    const outputLines = outputsMatch[1].split('\n');
    for (const line of outputLines) {
      // Skip reasoning outputs
      if (line.includes('reasoning:')) continue;
      const m = line.match(/-\\s+([\\w\\.\\{\\}-]+(?:-\\{\\{[^}]+\\}\\})*\\.json)/);
      if (m) {
        primaryOutput = m[1];
        break;
      }
    }
  }

  // Extract schema
  const schemaMatch = block.match(/schema:\\s*(.+)/);
  const schema = schemaMatch ? schemaMatch[1].trim() : null;

  // Extract gate
  const gateMatch = block.match(/gate:\\s*(.+)/);
  const gate = gateMatch ? gateMatch[1].trim() : null;

  // Extract secondary_outputs
  const secondaryOutputsMatch = block.match(/secondary_outputs:\s*\n((?:\s+-\s+.*\n)+)/);
  let secondaryOutputs = [];
  if (secondaryOutputsMatch) {
    const secondaryLines = secondaryOutputsMatch[1].split('\n');
    let currentArtifact = null;
    let currentSchema = null;

    for (const line of secondaryLines) {
      const artifactMatch = line.match(/artifact:\\s*(.+)/);
      const schemaMatch = line.match(/schema:\\s*(.+)/);

      if (artifactMatch) {
        // Save previous artifact if exists
        if (currentArtifact) {
          secondaryOutputs.push({ artifact: currentArtifact, schema: currentSchema });
        }
        currentArtifact = artifactMatch[1].trim();
        currentSchema = null;
      }
      if (schemaMatch) {
        currentSchema = schemaMatch[1].trim();
      }
    }

    // Save last artifact if exists
    if (currentArtifact) {
      secondaryOutputs.push({ artifact: currentArtifact, schema: currentSchema });
    }
  }

  return {
    output: primaryOutput,
    schema,
    gate,
    secondaryOutputs,
  };
}

function main() {
  const args = parseArgs();

  if (!args.workflow || !args.step) {
    console.error('Error: Missing arguments');
    console.error(
      'Usage: node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>] [--story-id <story-id>] [--epic-id <epic-id>]'
    );
    process.exit(1);
  }

  const workflowPath = resolve(args.workflow);
  const workflowId = args.id || 'default-run';
  const storyId = args['story-id'] || null;
  const epicId = args['epic-id'] || null;

  if (!existsSync(workflowPath)) {
    console.error(`Error: Workflow file not found at ${workflowPath}`);
    process.exit(1);
  }

  const content = readFileSync(workflowPath, 'utf-8');

  // Validate workflow inputs before step 0
  if (args.step === '0' || args.step === 0) {
    const providedInputs = args.inputs ? JSON.parse(args.inputs) : {};
    const inputValidation = validateWorkflowInputs(content, providedInputs);
    if (!inputValidation.valid) {
      console.error('\\n❌ Missing required workflow inputs:');
      inputValidation.missing.forEach(input => console.error(`  - ${input}`));
      console.error('\\nPlease provide required inputs when initializing the workflow.');
      console.error(
        'Example: --inputs \'{"target_files": ["src/"], "coding_standards": "PEP 8"}\''
      );
      process.exit(1);
    }
    if (inputValidation.required.length > 0) {
      console.log(`\\n✅ Workflow inputs validated (${inputValidation.required.length} required)`);
    }
  }

  // Validate dependencies before proceeding
  console.log(`\\n🔍 Validating dependencies for step ${args.step}...`);
  const dependencyCheck = validateStepDependencies(content, args.step, workflowId, storyId, epicId);

  if (!dependencyCheck.valid) {
    if (dependencyCheck.errors.length > 0) {
      console.error('\\n❌ Dependency validation errors:');
      dependencyCheck.errors.forEach(err => console.error(`  - ${err}`));
    }
    if (dependencyCheck.missing.length > 0) {
      console.error('\\n❌ Missing required artifacts:');
      dependencyCheck.missing.forEach(m => console.error(`  - ${m.message}`));
    }
    process.exit(1);
  }

  console.log('✅ All dependencies validated');

  const config = getStepConfig(content, args.step);

  if (!config) {
    console.error(`Error: Step ${args.step} not found in workflow.`);
    process.exit(1);
  }

  if (!config.gate || !config.output) {
    console.error(
      'Error: Missing required validation configuration (gate or output) for this step.'
    );
    console.log('Found config:', config);
    console.log('Note: Schema validation is optional. Gate and output are required.');
    process.exit(1);
  }

  // Interpolate template variables in output artifact name
  const templateSyntaxCheck = validateTemplateVariableSyntax(config.output);
  if (!templateSyntaxCheck.valid) {
    console.error(`❌ Error: Malformed template variables in output: ${config.output}`);
    templateSyntaxCheck.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  let interpolatedOutput = interpolateTemplateVariables(config.output, workflowId, storyId, epicId);

  // Check for un-interpolated variables after interpolation
  const remainingVars = detectUninterpolatedVariables(interpolatedOutput);
  if (remainingVars.length > 0) {
    const hasRequiredUnresolved = remainingVars.some(v => v === '{{workflow_id}}');
    if (hasRequiredUnresolved) {
      console.error(`❌ Error: Required template variable {{workflow_id}} could not be resolved.`);
      console.error(`   Please provide --id <workflow-id> argument.`);
      process.exit(1);
    }
    console.warn(
      `⚠️  Warning: Un-interpolated template variables found: ${remainingVars.join(', ')}`
    );
  }

  // Construct paths
  // Artifacts are stored in .opencode/context/artifacts/
  const artifactsDir = resolve(process.cwd(), '.opencode/context/artifacts');
  const inputPath = resolve(artifactsDir, interpolatedOutput);
  const schemaPath = config.schema ? resolve(process.cwd(), config.schema) : null;

  // Interpolate template variables in gate path
  const gateTemplateCheck = validateTemplateVariableSyntax(config.gate);
  if (!gateTemplateCheck.valid) {
    console.error(`❌ Error: Malformed template variables in gate path: ${config.gate}`);
    gateTemplateCheck.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  let gatePathRaw = interpolateTemplateVariables(config.gate, workflowId, storyId, epicId);

  // Check for un-interpolated variables
  const gateRemainingVars = detectUninterpolatedVariables(gatePathRaw);
  if (gateRemainingVars.length > 0) {
    console.warn(
      `⚠️  Warning: Un-interpolated template variables in gate path: ${gateRemainingVars.join(', ')}`
    );
  }

  const gatePath = resolve(process.cwd(), gatePathRaw);
  const gateScript = resolve(__dirname, 'gates', 'gate.mjs');

  // Ensure gate directory exists
  const gateDir = dirname(gatePath);
  if (!existsSync(gateDir)) {
    mkdirSync(gateDir, { recursive: true });
  }

  console.log(`\\n🚀 Running Validation for Step ${args.step}`);
  console.log(
    `   📂 Input:  ${interpolatedOutput}${interpolatedOutput !== config.output ? ` (from ${config.output})` : ''}`
  );
  console.log(`   📋 Schema: ${config.schema || '(optional - not provided)'}`);
  console.log(`   🛡️  Gate:   ${gatePathRaw}\\n`);

  if (!existsSync(inputPath)) {
    console.error(`❌ Error: Input artifact not found: ${inputPath}`);
    console.error(
      `   Please ensure the agent has created '${interpolatedOutput}' before running validation.`
    );
    process.exit(1);
  }

  // Construct command
  // node .opencode/tool/gates/gate.mjs --schema ... --input ... --gate ...
  // Schema is optional - only include if provided
  try {
    const schemaArg = schemaPath ? `--schema "${schemaPath}"` : '';
    execSync(
      `node "${gateScript}" ${schemaArg} --input "${inputPath}" --gate "${gatePath}" --autofix 1`,
      { stdio: 'inherit' }
    );
    console.log('\\n✨ Primary Output Validation Successful!');
  } catch (e) {
    console.error(
      '\\n⛔ Step Validation Failed. Please check the errors above and fix the artifact.'
    );
    process.exit(1);
  }

  // Validate secondary outputs if present
  if (config.secondaryOutputs && config.secondaryOutputs.length > 0) {
    console.log(`\\n🔍 Validating ${config.secondaryOutputs.length} secondary output(s)...`);
    for (const secondary of config.secondaryOutputs) {
      const interpolatedArtifact = interpolateTemplateVariables(
        secondary.artifact,
        workflowId,
        storyId,
        epicId
      );
      const secondaryPath = resolve(artifactsDir, interpolatedArtifact);

      if (!existsSync(secondaryPath)) {
        console.error(`❌ Error: Secondary output artifact not found: ${interpolatedArtifact}`);
        process.exit(1);
      }

      if (secondary.schema) {
        const secondarySchemaPath = resolve(process.cwd(), secondary.schema);
        if (existsSync(secondarySchemaPath)) {
          try {
            const secondarySchemaArg = `--schema "${secondarySchemaPath}"`;
            const secondaryGatePath = gatePath.replace(/\.json$/, '-secondary.json');
            execSync(
              `node "${gateScript}" ${secondarySchemaArg} --input "${secondaryPath}" --gate "${secondaryGatePath}" --autofix 1`,
              { stdio: 'inherit' }
            );
            console.log(`✅ Secondary output validated: ${interpolatedArtifact}`);
          } catch (e) {
            console.error(`❌ Secondary output validation failed: ${interpolatedArtifact}`);
            process.exit(1);
          }
        } else {
          console.warn(
            `⚠️  Warning: Schema file not found for secondary output: ${secondary.schema}`
          );
        }
      } else {
        console.log(
          `⚠️  Warning: No schema specified for secondary output: ${interpolatedArtifact}`
        );
      }
    }
  }

  console.log('\\n✨ Step Validation Successful! You may proceed to the next step.');
}

main();
