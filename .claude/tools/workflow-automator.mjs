#!/usr/bin/env node
/**
 * Workflow Automator
 * Automated plan → implement → debug → fix cycle execution
 *
 * Usage:
 *   node .claude/tools/workflow-automator.mjs --plan <plan-file> --project <project-name>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load plan file
 */
async function loadPlan(planPath) {
  const content = await readFile(planPath, 'utf-8');

  // Try to parse as JSON first
  try {
    return JSON.parse(content);
  } catch (error) {
    // If not JSON, treat as markdown and extract structure
    // This is a simplified parser - in production, use a proper markdown parser
    const lines = content.split('\n');
    const plan = {
      tasks: [],
      phases: [],
      metadata: {},
    };

    let currentPhase = null;
    let currentTask = null;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        plan.metadata.title = line.substring(2).trim();
      } else if (line.startsWith('## ')) {
        if (currentPhase) {
          plan.phases.push(currentPhase);
        }
        currentPhase = {
          name: line.substring(3).trim(),
          tasks: [],
        };
      } else if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
        const taskText = line.substring(5).trim();
        const completed = line.startsWith('- [x]');
        const task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: taskText,
          completed,
          phase: currentPhase?.name || 'default',
          agent: null,
          dependencies: [],
        };

        if (currentPhase) {
          currentPhase.tasks.push(task);
        }
        plan.tasks.push(task);
      }
    }

    if (currentPhase) {
      plan.phases.push(currentPhase);
    }

    return plan;
  }
}

/**
 * Execute plan phase
 */
async function executePhase(phase, plan, projectName, options = {}) {
  const results = {
    phase: phase.name,
    tasks: [],
    errors: [],
    artifacts: [],
  };

  for (const task of phase.tasks) {
    if (task.completed) {
      results.tasks.push({
        id: task.id,
        status: 'skipped',
        reason: 'already completed',
      });
      continue;
    }

    try {
      // Delegate to assigned agent
      const agent = task.agent || 'developer';
      const result = await executeTask(task, agent, projectName, options);

      results.tasks.push({
        id: task.id,
        status: 'completed',
        result,
      });

      if (result.artifacts) {
        results.artifacts.push(...result.artifacts);
      }
    } catch (error) {
      results.errors.push({
        task: task.id,
        error: error.message,
      });
      results.tasks.push({
        id: task.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Execute individual task
 */
async function executeTask(task, agent, projectName, options = {}) {
  // ACTUAL DELEGATION TO SUBAGENTS - Use orchestrator-coordinator for real delegation
  const { delegateTask } = await import('./orchestrator-coordinator.mjs');

  try {
    // Delegate task to agent using orchestrator-coordinator
    const delegation = await delegateTask(task, [], null);

    // In a real implementation, this would spawn the actual subagent
    // For now, we'll use the delegation prompt structure
    // The orchestrator should handle actual subagent spawning

    // Register artifacts if runId provided
    const artifacts = [];
    if (options.runId) {
      const { registerArtifact } = await import('./run-manager.mjs');
      // Artifacts would come from actual subagent execution
      // This is a placeholder - actual implementation would wait for subagent completion
    }

    return {
      success: true,
      output: `Task ${task.id} delegated to ${agent}`,
      artifacts: artifacts,
      delegation: delegation,
      validationStatus: 'pending',
      gatePass: false,
    };
  } catch (error) {
    // If delegation fails, try fallback agent
    const fallbackAgent = getFallbackAgent(agent);
    if (fallbackAgent && fallbackAgent !== agent) {
      console.warn(`Agent ${agent} failed, trying fallback ${fallbackAgent}`);
      return await executeTask(task, fallbackAgent, projectName, options);
    }

    throw new Error(`Task execution failed: ${error.message}`);
  }
}

/**
 * Get fallback agent for a given agent
 */
function getFallbackAgent(agent) {
  const FALLBACK_MAP = {
    'security-architect': 'architect',
    'performance-engineer': 'developer',
    'compliance-auditor': 'security-architect',
    'llm-architect': 'architect',
    'database-architect': 'architect',
    'api-designer': 'architect',
    'mobile-developer': 'developer',
    'refactoring-specialist': 'developer',
    'legacy-modernizer': 'developer',
    'accessibility-expert': 'ux-expert',
    'incident-responder': 'devops',
    'model-orchestrator': 'architect',
    'gcp-cloud-agent': 'devops',
    'ai-council': 'planner',
  };
  return FALLBACK_MAP[agent] || null;
}

/**
 * Run validation on implemented code
 */
async function runValidation(target, validators = ['cursor', 'gemini', 'codex']) {
  const { validateWithMultiAI } = await import('./multi-ai-validator.mjs');
  return await validateWithMultiAI(target, validators);
}

/**
 * Route issues to appropriate agents
 */
function routeIssues(validationReport) {
  const routes = {
    developer: [],
    architect: [],
    security: [],
    performance: [],
  };

  for (const issue of validationReport.consensus) {
    if (issue.category === 'security') {
      routes.security.push(issue);
    } else if (issue.category === 'performance') {
      routes.performance.push(issue);
    } else if (issue.category === 'architecture' || issue.category === 'design') {
      routes.architect.push(issue);
    } else {
      routes.developer.push(issue);
    }
  }

  return routes;
}

/**
 * Execute automated workflow cycle
 */
export async function executeAutomatedWorkflow(planPath, projectName, options = {}) {
  const {
    maxIterations = 10,
    validators = ['cursor', 'gemini', 'codex'],
    autoFix = true,
  } = options;

  // Load plan
  const plan = await loadPlan(planPath);

  const workflowState = {
    plan,
    projectName,
    currentIteration: 0,
    completedPhases: [],
    currentPhase: 0,
    validationResults: [],
    fixResults: [],
    status: 'running',
  };

  // Save initial state
  const statePath = join(__dirname, '..', 'projects', projectName, 'workflow-state.json');
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(workflowState, null, 2), 'utf-8');

  // Main workflow loop
  while (workflowState.currentIteration < maxIterations && workflowState.status === 'running') {
    workflowState.currentIteration++;

    // 1. Plan Phase (if needed)
    if (workflowState.currentIteration === 1) {
      // Plan already loaded, proceed to implementation
    }

    // 2. Implement Phase
    if (workflowState.currentPhase < plan.phases.length) {
      const phase = plan.phases[workflowState.currentPhase];
      const phaseResult = await executePhase(phase, plan, projectName, options);

      workflowState.completedPhases.push(phaseResult);

      if (phaseResult.errors.length > 0) {
        workflowState.status = 'error';
        workflowState.error = `Phase ${phase.name} failed with errors`;
        break;
      }

      workflowState.currentPhase++;
    }

    // 3. Debug/Validate Phase
    const target = join(__dirname, '..', 'projects', projectName);
    const validationReport = await runValidation(target, validators);
    workflowState.validationResults.push(validationReport);

    // Check if validation found issues
    if (validationReport.summary.consensusIssues === 0) {
      // No issues found, workflow complete
      workflowState.status = 'completed';
      break;
    }

    // 4. Fix Phase
    if (autoFix) {
      const issueRoutes = routeIssues(validationReport);

      const fixResults = [];
      for (const [agent, issues] of Object.entries(issueRoutes)) {
        if (issues.length > 0) {
          // Route issues to agent for fixing
          // In a real implementation, this would delegate to the actual agent
          fixResults.push({
            agent,
            issuesCount: issues.length,
            status: 'routed',
          });
        }
      }

      workflowState.fixResults.push(fixResults);

      // Update plan with fixes
      // In a real implementation, this would update the plan with new tasks
    } else {
      // Manual fix required
      workflowState.status = 'manual_fix_required';
      break;
    }
  }

  // Save final state
  await writeFile(statePath, JSON.stringify(workflowState, null, 2), 'utf-8');

  return workflowState;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const planIndex = args.indexOf('--plan');
  const projectIndex = args.indexOf('--project');
  const maxIterationsIndex = args.indexOf('--max-iterations');
  const validatorsIndex = args.indexOf('--validators');
  const noAutoFix = args.includes('--no-auto-fix');

  if (planIndex === -1 || !args[planIndex + 1] || projectIndex === -1 || !args[projectIndex + 1]) {
    console.error(
      'Usage: node workflow-automator.mjs --plan <plan-file> --project <project-name> [--max-iterations <n>] [--validators cursor,gemini,codex] [--no-auto-fix]'
    );
    process.exit(1);
  }

  const planPath = args[planIndex + 1];
  const projectName = args[projectIndex + 1];
  const maxIterations = maxIterationsIndex !== -1 ? parseInt(args[maxIterationsIndex + 1]) : 10;
  const validators =
    validatorsIndex !== -1 && args[validatorsIndex + 1]
      ? args[validatorsIndex + 1].split(',')
      : ['cursor', 'gemini', 'codex'];

  const options = {
    maxIterations,
    validators,
    autoFix: !noAutoFix,
  };

  const result = await executeAutomatedWorkflow(planPath, projectName, options);

  console.log(JSON.stringify(result, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  executeAutomatedWorkflow,
  loadPlan,
  executePhase,
  runValidation,
  routeIssues,
};
