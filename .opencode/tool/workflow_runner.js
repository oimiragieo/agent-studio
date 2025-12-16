#!/usr/bin/env node
/**
 * Workflow Runner
 * 
 * Helper script to execute validation gates for workflow steps.
 * Parses the workflow YAML to find the schema and gate paths for a specific step,
 * then executes gate.mjs.
 * 
 * Usage:
 *   node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>]
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const stepRegex = new RegExp(`- step: ${stepNumber}\s*\n([\s\S]*?)(?=\n\s*- step:|\n\s*completion_criteria:|$)`, 'm');
  const match = text.match(stepRegex);
  
  if (!match) return null;
  
  const block = match[1];
  
  // Extract outputs (assuming list of strings, we take the first one that looks like a file)
  const outputsMatch = block.match(/outputs:\s*\n((?:\s+-\s+.*\n)+)/);
  let primaryOutput = null;
  if (outputsMatch) {
    const outputLines = outputsMatch[1].split('\n');
    for (const line of outputLines) {
      const m = line.match(/-\s+([\w\.-]+\.json)/);
      if (m) {
        primaryOutput = m[1];
        break;
      }
    }
  }
  
  // Extract schema
  const schemaMatch = block.match(/schema:\s*(.+)/);
  const schema = schemaMatch ? schemaMatch[1].trim() : null;
  
  // Extract gate
  const gateMatch = block.match(/gate:\s*(.+)/);
  const gate = gateMatch ? gateMatch[1].trim() : null;
  
  return {
    output: primaryOutput,
    schema,
    gate
  };
}

function main() {
  const args = parseArgs();
  
  if (!args.workflow || !args.step) {
    console.error('Error: Missing arguments');
    console.error('Usage: node workflow_runner.js --workflow <yaml-path> --step <number> [--id <workflow-id>]');
    process.exit(1);
  }

  const workflowPath = resolve(args.workflow);
  const workflowId = args.id || 'default-run';
  
  if (!existsSync(workflowPath)) {
    console.error(`Error: Workflow file not found at ${workflowPath}`);
    process.exit(1);
  }

  const content = readFileSync(workflowPath, 'utf-8');
  const config = getStepConfig(content, args.step);
  
  if (!config) {
    console.error(`Error: Step ${args.step} not found in workflow.`);
    process.exit(1);
  }
  
  if (!config.schema || !config.gate || !config.output) {
    console.error('Error: Missing validation configuration (schema, gate, or output) for this step.');
    console.log('Found config:', config);
    process.exit(1);
  }

  // Construct paths
  // Artifacts are stored in .opencode/context/artifacts/
  const inputPath = resolve(process.cwd(), '.opencode/context/artifacts', config.output);
  const schemaPath = resolve(process.cwd(), config.schema);
  // Interpolate workflow_id in gate path
  const gatePathRaw = config.gate.replace('{{workflow_id}}', workflowId);
  const gatePath = resolve(process.cwd(), gatePathRaw);
  const gateScript = resolve(__dirname, 'gates', 'gate.mjs');

  console.log(`\n🚀 Running Validation for Step ${args.step}`);
  console.log(`   📂 Input:  ${config.output}`);
  console.log(`   📋 Schema: ${config.schema}`);
  console.log(`   🛡️  Gate:   ${gatePathRaw}\n`);

  if (!existsSync(inputPath)) {
    console.error(`❌ Error: Input artifact not found: ${inputPath}`);
    console.error(`   Please ensure the agent has created '${config.output}' before running validation.`);
    process.exit(1);
  }

  // Construct command
  // node .opencode/tool/gates/gate.mjs --schema ... --input ... --gate ...
  try {
    execSync(`node "${gateScript}" --schema "${schemaPath}" --input "${inputPath}" --gate "${gatePath}" --autofix 1`, { stdio: 'inherit' });
    console.log('\n✨ Step Validation Successful! You may proceed to the next step.');
  } catch (e) {
    console.error('\n⛔ Step Validation Failed. Please check the errors above and fix the artifact.');
    process.exit(1);
  }
}

main();
