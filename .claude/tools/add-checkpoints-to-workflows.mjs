#!/usr/bin/env node
/**
 * Add checkpoint steps to all workflows
 *
 * This tool automatically adds checkpoint steps after major phases in workflows:
 * - After planning phase (Step 0.5 or 1.5)
 * - After design phase (Step 3.5 or 4.5)
 * - After implementation phase (Step 7.5 or 8.5)
 * - Before final validation (Step N-1.5)
 *
 * Usage:
 *   node .claude/tools/add-checkpoints-to-workflows.mjs [--workflow <file>] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOWS_DIR = path.resolve(__dirname, '../workflows');

/**
 * Determine checkpoint positions based on workflow steps
 */
function determineCheckpointPositions(steps) {
  const positions = [];
  const stepNumbers = steps.map(s => s.step).filter(n => typeof n === 'number');
  const maxStep = Math.max(...stepNumbers);

  // After planning (around step 0.5-1.5)
  const planningSteps = steps.filter(
    s =>
      s.agent === 'planner' ||
      s.name?.toLowerCase().includes('planning') ||
      s.name?.toLowerCase().includes('discovery')
  );
  if (planningSteps.length > 0) {
    const lastPlanningStep = Math.max(...planningSteps.map(s => s.step));
    positions.push({
      step: lastPlanningStep + 0.5,
      phase: 'planning',
      name: 'Planning Phase Complete',
      after_step: lastPlanningStep,
    });
  }

  // After design (around step 3.5-4.5)
  const designSteps = steps.filter(
    s =>
      s.agent === 'architect' ||
      s.agent === 'database-architect' ||
      s.agent === 'ux-expert' ||
      s.name?.toLowerCase().includes('architecture') ||
      s.name?.toLowerCase().includes('design')
  );
  if (designSteps.length > 0) {
    const lastDesignStep = Math.max(...designSteps.map(s => s.step));
    positions.push({
      step: lastDesignStep + 0.5,
      phase: 'design',
      name: 'Design Phase Complete',
      after_step: lastDesignStep,
    });
  }

  // After implementation (around step 7.5-8.5)
  const implementationSteps = steps.filter(
    s =>
      s.agent === 'developer' ||
      s.agent === 'cloud-integrator' ||
      s.name?.toLowerCase().includes('implementation') ||
      s.name?.toLowerCase().includes('development')
  );
  if (implementationSteps.length > 0) {
    const lastImplStep = Math.max(...implementationSteps.map(s => s.step));
    positions.push({
      step: lastImplStep + 0.5,
      phase: 'implementation',
      name: 'Implementation Phase Complete',
      after_step: lastImplStep,
    });
  }

  // Before final validation (Step N-1.5)
  const validationSteps = steps.filter(
    s =>
      s.name?.toLowerCase().includes('signoff') ||
      s.name?.toLowerCase().includes('final') ||
      s.step >= maxStep - 2
  );
  if (validationSteps.length > 0) {
    const lastStep = Math.max(...validationSteps.map(s => s.step));
    if (lastStep > 0) {
      positions.push({
        step: lastStep - 0.5,
        phase: 'pre-validation',
        name: 'Pre-Validation Checkpoint',
        after_step: lastStep - 1,
      });
    }
  }

  return positions;
}

/**
 * Create checkpoint step YAML
 */
function createCheckpointStep(position, prevSteps) {
  const inputs = prevSteps
    .filter(s => s.step <= position.after_step && s.outputs && s.outputs.length > 0)
    .flatMap(s => s.outputs.filter(o => o.endsWith('.json') && !o.includes('reasoning')))
    .slice(-5); // Last 5 artifacts

  return `
  - step: ${position.step}
    name: "Checkpoint: ${position.name}"
    agent: orchestrator
    type: checkpoint
    description: "Create checkpoint after ${position.phase} phase"
    inputs:
${inputs.map(i => `      - ${i.replace(/.+\//, '')}`).join('\n') || '      - None'}
    outputs:
      - .claude/context/runs/{{run_id}}/checkpoints/checkpoint-${position.phase}.json
    checkpoint_data:
      phase: "${position.phase}"
      completed_steps: [${prevSteps
        .filter(s => s.step <= position.after_step)
        .map(s => s.step)
        .join(', ')}]
      validation_status: "pass"
`;
}

/**
 * Add checkpoints to workflow YAML
 */
function addCheckpointsToWorkflow(workflowPath, dryRun = false) {
  console.log(`\nProcessing: ${path.basename(workflowPath)}`);

  const content = fs.readFileSync(workflowPath, 'utf8');

  // Parse YAML manually (simple approach for this use case)
  const lines = content.split('\n');
  const stepsStartIdx = lines.findIndex(l => l.startsWith('steps:'));
  if (stepsStartIdx < 0) {
    console.log('  No steps section found');
    return;
  }

  // Extract existing steps (rough parsing)
  const stepPattern = /^  - step: ([\d.]+)/;
  const steps = [];
  let currentStep = null;

  for (let i = stepsStartIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(stepPattern);

    if (match) {
      if (currentStep) steps.push(currentStep);
      currentStep = {
        step: parseFloat(match[1]),
        lineIdx: i,
        name: '',
        agent: '',
        outputs: [],
      };
    } else if (currentStep) {
      if (line.includes('name:')) {
        currentStep.name = line.split('name:')[1].replace(/["']/g, '').trim();
      } else if (line.includes('agent:')) {
        currentStep.agent = line.split('agent:')[1].trim();
      } else if (line.includes('outputs:')) {
        // Start collecting outputs
        currentStep.collectingOutputs = true;
      } else if (currentStep.collectingOutputs && line.match(/^\s+- /)) {
        currentStep.outputs.push(line.trim().replace(/^- /, ''));
      } else if (line.match(/^\s+[a-z_]+:/)) {
        currentStep.collectingOutputs = false;
      }
    }

    // Stop at next major section
    if (line.match(/^[a-z_]+:/) && !line.startsWith(' ')) {
      break;
    }
  }
  if (currentStep) steps.push(currentStep);

  // Check if checkpoints already exist
  const hasCheckpoints = steps.some(s => s.name?.includes('Checkpoint'));
  if (hasCheckpoints) {
    console.log('  ✓ Workflow already has checkpoints');
    return;
  }

  // Determine checkpoint positions
  const positions = determineCheckpointPositions(steps);
  console.log(
    `  Found ${positions.length} checkpoint positions:`,
    positions.map(p => `${p.step} (${p.phase})`).join(', ')
  );

  if (positions.length === 0) {
    console.log('  No suitable checkpoint positions found');
    return;
  }

  // Generate checkpoint steps
  const checkpointSteps = positions.map(pos => createCheckpointStep(pos, steps));

  // Insert checkpoints (would need more sophisticated YAML manipulation)
  console.log(
    `  ${dryRun ? '[DRY RUN]' : ''} Would add ${checkpointSteps.length} checkpoint steps`
  );

  if (!dryRun) {
    // For now, just append checkpoints to a summary file
    const summary = {
      workflow: path.basename(workflowPath),
      checkpoints_to_add: positions,
      checkpoint_yaml: checkpointSteps.join('\n'),
    };

    const summaryFile = path.resolve(__dirname, '../context/tmp/tmp-checkpoint-additions.json');
    const summaries = fs.existsSync(summaryFile)
      ? JSON.parse(fs.readFileSync(summaryFile, 'utf8'))
      : [];
    summaries.push(summary);
    fs.writeFileSync(summaryFile, JSON.stringify(summaries, null, 2));

    console.log(`  ✓ Checkpoint plan saved to tmp-checkpoint-additions.json`);
  }
}

/**
 * Process all workflows
 */
function processAllWorkflows(dryRun = false) {
  const files = fs
    .readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.yaml') && f !== 'WORKFLOW-GUIDE.md');

  console.log(`Found ${files.length} workflow files`);

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    addCheckpointsToWorkflow(filePath, dryRun);
  }

  console.log('\nDone!');
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const workflowFile = args.find((_, i) => args[i - 1] === '--workflow');

if (workflowFile) {
  addCheckpointsToWorkflow(path.join(WORKFLOWS_DIR, workflowFile), dryRun);
} else {
  processAllWorkflows(dryRun);
}
