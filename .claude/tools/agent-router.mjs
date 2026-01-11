#!/usr/bin/env node
/**
 * Agent Router - Runtime Agent Selection Module
 *
 * Selects the optimal agent chain based on task classification, routing matrix,
 * and cross-cutting triggers. Integrates with task-classifier for complexity
 * analysis and provides full execution chain with proper sequencing.
 *
 * Usage:
 *   import { selectAgents } from './agent-router.mjs';
 *   const routing = await selectAgents("Add authentication to the app");
 *
 * Programmatic:
 *   const routing = await selectAgents(taskDescription, options);
 *
 * CLI:
 *   node agent-router.mjs --task "Add user authentication"
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classifyTask, analyzeTaskType } from './task-classifier.mjs';
import { suggestRoutingImprovement } from './pattern-learner.mjs';
import {
  checkSecurityTriggers,
  hasSecurityArchitectApproval,
  validateSecurityApproval,
} from './security-enforcement.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Security: Input validation limits
const MAX_TASK_DESCRIPTION_LENGTH = 10000;

/**
 * Sanitize task description to prevent injection attacks
 * @param {string} task - Task description to sanitize
 * @returns {string} Sanitized task
 * @throws {Error} If task is invalid
 */
function sanitizeTaskDescription(task) {
  if (typeof task !== 'string') {
    throw new Error('Task description must be a string');
  }

  if (task.length > MAX_TASK_DESCRIPTION_LENGTH) {
    throw new Error(
      `Task description exceeds maximum length of ${MAX_TASK_DESCRIPTION_LENGTH} characters`
    );
  }

  // Remove any null bytes or control characters
  const sanitized = task.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Load agent routing matrix
 * @returns {Promise<Object>} Routing matrix configuration
 */
async function loadRoutingMatrix() {
  try {
    const matrixPath = join(__dirname, 'agent-routing-matrix.json');
    const content = await readFile(matrixPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load routing matrix: ${error.message}`);
  }
}

/**
 * Load cross-cutting triggers
 * @returns {Promise<Object>} Cross-cutting triggers configuration
 */
async function loadCrossCuttingTriggers() {
  try {
    const triggersPath = join(__dirname, 'cross-cutting-triggers.json');
    const content = await readFile(triggersPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load cross-cutting triggers: ${error.message}`);
  }
}

/**
 * Load plan review matrix
 * @returns {Promise<Object>} Plan review matrix configuration
 */
async function loadPlanReviewMatrix() {
  try {
    const matrixPath = join(__dirname, '..', 'context', 'plan-review-matrix.json');
    const content = await readFile(matrixPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load plan review matrix: ${error.message}`);
  }
}

/**
 * Load signoff matrix
 * @returns {Promise<Object>} Signoff matrix configuration
 */
async function loadSignoffMatrix() {
  try {
    const matrixPath = join(__dirname, '..', 'context', 'signoff-matrix.json');
    const content = await readFile(matrixPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load signoff matrix: ${error.message}`);
  }
}

/**
 * Load security triggers v2
 * @returns {Promise<Object>} Security triggers v2 configuration
 */
async function loadSecurityTriggersV2() {
  try {
    const triggersPath = join(__dirname, '..', 'context', 'security-triggers-v2.json');
    const content = await readFile(triggersPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load security triggers v2: ${error.message}`);
  }
}

/**
 * Detect cross-cutting triggers from task description
 * @param {string} task - Task description
 * @param {string} complexity - Task complexity level
 * @param {Object} triggers - Cross-cutting triggers configuration
 * @returns {string[]} List of triggered agents
 */
function detectCrossCuttingAgents(task, complexity, triggers) {
  const taskLower = task.toLowerCase();
  const triggeredAgents = new Set();

  for (const [agent, config] of Object.entries(triggers.triggers)) {
    // Check trigger level
    const shouldTrigger = shouldActivateTrigger(config.triggerLevel, complexity);

    if (!shouldTrigger) {
      continue;
    }

    // Check keywords
    const hasKeyword = config.keywords.some(keyword => taskLower.includes(keyword.toLowerCase()));

    if (hasKeyword) {
      triggeredAgents.add(agent);
    }
  }

  return Array.from(triggeredAgents);
}

/**
 * Determine if trigger should activate based on complexity
 * @param {string} triggerLevel - Trigger level (always, ui_tasks, moderate_plus, complex_plus)
 * @param {string} complexity - Task complexity (trivial, simple, moderate, complex, critical)
 * @returns {boolean} Whether trigger should activate
 */
function shouldActivateTrigger(triggerLevel, complexity) {
  const complexityLevels = ['trivial', 'simple', 'moderate', 'complex', 'critical'];
  const complexityIndex = complexityLevels.indexOf(complexity);

  switch (triggerLevel) {
    case 'always':
    case 'critical':
      return true;
    case 'ui_tasks':
      // Activated only if task is UI-related (check would be done via keywords)
      return true;
    case 'moderate_plus':
      return complexityIndex >= 2; // moderate, complex, critical
    case 'complex_plus':
      return complexityIndex >= 3; // complex, critical
    default:
      return false;
  }
}

/**
 * Determine plan reviewers based on task type and complexity
 * @param {string} task - Task description
 * @param {string} taskType - Task type from classifier
 * @param {string} workflow - Workflow name
 * @param {Object} reviewMatrix - Plan review matrix configuration
 * @returns {Object} Plan review requirements
 */
function determinePlanReviewers(task, taskType, workflow, reviewMatrix) {
  const taskConfig = reviewMatrix.taskTypes[taskType];

  if (!taskConfig) {
    // Default fallback
    return {
      required: ['architect', 'qa'],
      optional: ['pm'],
      minimum_score: 7,
      blocking_threshold: 5,
    };
  }

  let required = [...taskConfig.required];
  let optional = [...taskConfig.optional];
  let minimumScore = taskConfig.minimum_score;
  let blockingThreshold = taskConfig.blocking_threshold;

  // Apply workflow modifiers if they exist
  const workflowModifier = reviewMatrix.workflowModifiers[workflow];
  if (workflowModifier) {
    if (workflowModifier.reduce_required_reviewers > 0 && required.length > 1) {
      // Move some required reviewers to optional
      const toMove = required.splice(-workflowModifier.reduce_required_reviewers);
      optional = [...optional, ...toMove];
    }

    if (workflowModifier.skip_optional) {
      optional = [];
    }

    if (workflowModifier.minimum_score_override) {
      minimumScore = workflowModifier.minimum_score_override;
    }

    if (workflowModifier.add_reviewers) {
      required = [...required, ...workflowModifier.add_reviewers];
    }
  }

  // Remove duplicates
  required = [...new Set(required)];
  optional = [...new Set(optional.filter(r => !required.includes(r)))];

  return {
    required,
    optional,
    minimum_score: minimumScore,
    blocking_threshold: blockingThreshold,
  };
}

/**
 * Determine signoff requirements based on workflow and task
 * @param {string} workflow - Workflow name
 * @param {string} task - Task description
 * @param {Object} signoffMatrix - Signoff matrix configuration
 * @returns {Object} Signoff requirements
 */
function determineSignoffRequirements(workflow, task, signoffMatrix) {
  const workflowConfig = signoffMatrix.workflows[workflow];

  if (!workflowConfig) {
    // Default fallback
    return {
      required: ['quality_signoff'],
      conditional: [],
      agents: ['qa'],
    };
  }

  const taskLower = task.toLowerCase();
  const requiredSignoffs = workflowConfig.required_signoffs.map(s => s.type);
  const conditionalSignoffs = [];
  const agents = new Set();

  // Add required signoff agents
  for (const signoff of workflowConfig.required_signoffs) {
    for (const agent of signoff.agents) {
      agents.add(agent);
    }
  }

  // Check conditional signoffs
  for (const signoff of workflowConfig.conditional_signoffs || []) {
    const triggered = signoff.trigger_keywords.some(keyword =>
      taskLower.includes(keyword.toLowerCase())
    );

    if (triggered) {
      conditionalSignoffs.push(signoff.type);
      for (const agent of signoff.agents) {
        agents.add(agent);
      }
    }
  }

  return {
    required: requiredSignoffs,
    conditional: conditionalSignoffs,
    agents: Array.from(agents),
  };
}

/**
 * Detect enhanced security triggers from task description
 * @param {string} task - Task description
 * @param {Object} securityTriggersV2 - Security triggers v2 configuration
 * @returns {Object} Detected security triggers
 */
function detectEnhancedSecurityTriggers(task, securityTriggersV2) {
  const taskLower = task.toLowerCase();
  const triggeredCategories = new Set();
  const requiredAgents = new Set();
  const recommendedAgents = new Set();
  let highestPriority = 'low';

  const priorityLevels = ['low', 'medium', 'high', 'critical'];

  // Check each category
  for (const [categoryName, categoryConfig] of Object.entries(securityTriggersV2.categories)) {
    const hasKeyword = categoryConfig.keywords.some(keyword =>
      taskLower.includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      triggeredCategories.add(categoryName);

      // Track highest priority
      const categoryPriorityIndex = priorityLevels.indexOf(categoryConfig.priority);
      const currentPriorityIndex = priorityLevels.indexOf(highestPriority);
      if (categoryPriorityIndex > currentPriorityIndex) {
        highestPriority = categoryConfig.priority;
      }

      // Add agents
      for (const agent of categoryConfig.required_agents) {
        requiredAgents.add(agent);
      }
      for (const agent of categoryConfig.recommended_agents || []) {
        recommendedAgents.add(agent);
      }
    }
  }

  // Check for critical combinations
  const categories = Array.from(triggeredCategories);
  for (const combo of securityTriggersV2.combinationRules?.critical_combinations || []) {
    const hasAllCategories = combo.categories.every(cat => triggeredCategories.has(cat));
    if (hasAllCategories && combo.priority_override) {
      const comboPriorityIndex = priorityLevels.indexOf(combo.priority_override);
      const currentPriorityIndex = priorityLevels.indexOf(highestPriority);
      if (comboPriorityIndex > currentPriorityIndex) {
        highestPriority = combo.priority_override;
      }
    }
  }

  return {
    categories,
    agents: Array.from(requiredAgents),
    recommended_agents: Array.from(recommendedAgents),
    priority: highestPriority,
    triggered: categories.length > 0,
  };
}

/**
 * Build full execution chain from routing decision
 * @param {Object} routing - Routing decision with agent lists
 * @param {Object} matrix - Routing matrix configuration
 * @param {string} taskType - Task type identifier
 * @returns {string[]} Ordered list of agents in execution chain
 */
function buildExecutionChain(routing, matrix, taskType) {
  const chain = [];
  const seen = new Set();

  // Helper to add agents without duplicates
  const addAgents = agents => {
    for (const agent of agents) {
      if (!seen.has(agent)) {
        chain.push(agent);
        seen.add(agent);
      }
    }
  };

  // Check if we should skip certain chain steps
  const skipConditions = matrix.chainRules.chainSkipConditions[taskType] || [];

  // Build chain in order: primary → supporting → review → approval
  if (!skipConditions.includes('primary')) {
    addAgents([routing.primary]);
  }

  if (!skipConditions.includes('supporting')) {
    addAgents(routing.supporting);
  }

  // Inject cross-cutting agents before review
  if (routing.crossCutting && routing.crossCutting.length > 0) {
    addAgents(routing.crossCutting);
  }

  if (!skipConditions.includes('review')) {
    addAgents(routing.review);
  }

  if (!skipConditions.includes('approval')) {
    addAgents(routing.approval);
  }

  return chain;
}

/**
 * Get agent routing decision for a task
 * @param {string} taskType - Task type from classifier
 * @param {Object} matrix - Routing matrix
 * @returns {Object} Routing decision with agent lists
 */
function getAgentRouting(taskType, matrix) {
  const routing = matrix.taskTypes[taskType];

  if (!routing) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  return {
    primary: routing.primary,
    supporting: routing.supporting || [],
    review: routing.review || [],
    approval: routing.approval || [],
    workflow: routing.workflow || 'fullstack',
  };
}

/**
 * Select agents for a task
 * @param {string} taskDescription - Description of the task
 * @param {Object} options - Selection options
 * @param {string|string[]} options.files - File patterns affected by the task
 * @param {boolean} options.verbose - Include detailed analysis in output
 * @param {boolean} options.usePatternLearning - Apply pattern learning adjustments (default: true)
 * @returns {Promise<Object>} Agent routing decision
 */
export async function selectAgents(taskDescription, options = {}) {
  // Sanitize input
  const sanitized = sanitizeTaskDescription(taskDescription);

  // Default to using pattern learning
  const usePatternLearning = options.usePatternLearning !== false;

  // Load configuration
  const [matrix, triggers, reviewMatrix, signoffMatrix, securityTriggersV2] = await Promise.all([
    loadRoutingMatrix(),
    loadCrossCuttingTriggers(),
    loadPlanReviewMatrix(),
    loadSignoffMatrix(),
    loadSecurityTriggersV2(),
  ]);

  // Classify task
  const classification = await classifyTask(sanitized, options);

  // Get base routing from matrix
  const routing = getAgentRouting(classification.taskType, matrix);

  // Detect cross-cutting agents
  const crossCuttingAgents = detectCrossCuttingAgents(
    sanitized,
    classification.complexity,
    triggers
  );

  // Determine plan reviewers
  const planReviewers = determinePlanReviewers(
    sanitized,
    classification.taskType,
    routing.workflow,
    reviewMatrix
  );

  // Determine signoff requirements
  const signoffRequirements = determineSignoffRequirements(
    routing.workflow,
    sanitized,
    signoffMatrix
  );

  // Detect enhanced security triggers
  const securityTriggers = detectEnhancedSecurityTriggers(sanitized, securityTriggersV2);

  // Enhanced security enforcement check
  const securityEnforcementCheck = await checkSecurityTriggers(sanitized);

  // Enforce security escalation for critical/blocking triggers
  const assignedAgents = new Set([
    routing.primary,
    ...routing.supporting,
    ...crossCuttingAgents,
    ...routing.review,
    ...routing.approval,
  ]);

  if (securityEnforcementCheck.triggered) {
    // Force security-architect into the agent list if not already present
    const securityArchitectIncluded = assignedAgents.has('security-architect');

    if (
      !securityArchitectIncluded &&
      (securityEnforcementCheck.critical || securityEnforcementCheck.blocking)
    ) {
      crossCuttingAgents.push('security-architect');
      assignedAgents.add('security-architect');
    }

    // Add other required agents from security check
    for (const agent of securityEnforcementCheck.requiredAgents) {
      if (!assignedAgents.has(agent)) {
        crossCuttingAgents.push(agent);
        assignedAgents.add(agent);
      }
    }
  }

  // Build full execution chain
  const fullChain = buildExecutionChain(
    { ...routing, crossCutting: crossCuttingAgents },
    matrix,
    classification.taskType
  );

  // Apply pattern learning suggestions if enabled
  let patternSuggestions = null;
  if (usePatternLearning) {
    try {
      patternSuggestions = await suggestRoutingImprovement(
        sanitized,
        classification.taskType,
        fullChain
      );
    } catch (error) {
      // Pattern learning is optional - continue without it if it fails
      console.warn('Pattern learning unavailable:', error.message);
    }
  }

  // Build result
  const result = {
    taskType: classification.taskType,
    complexity: classification.complexity,
    primary: routing.primary,
    supporting: routing.supporting,
    review: routing.review,
    approval: routing.approval,
    crossCutting: crossCuttingAgents,
    fullChain: fullChain,
    workflow: routing.workflow,
    gates: classification.gates,
    reasoning: classification.reasoning,
    patternLearning: patternSuggestions,
    planReviewers: planReviewers,
    signoffRequirements: signoffRequirements,
    securityTriggers: securityTriggers,
    securityEnforcement: {
      triggered: securityEnforcementCheck.triggered,
      priority: securityEnforcementCheck.priority,
      blocking: securityEnforcementCheck.blocking,
      requireSignoff: securityEnforcementCheck.requireSignoff,
      categories: securityEnforcementCheck.categories,
      matchedKeywords: securityEnforcementCheck.matchedKeywords,
      requiredAgents: securityEnforcementCheck.requiredAgents,
      recommendedAgents: securityEnforcementCheck.recommendedAgents,
      maxResponseTimeHours: securityEnforcementCheck.maxResponseTimeHours,
      notifyAgents: securityEnforcementCheck.notifyAgents,
    },
  };

  // Add blocking status if security enforcement is blocking
  if (securityEnforcementCheck.blocking) {
    result.blocked = true;
    result.blockReason = 'Security review required before execution';
    result.blockingCategories = securityEnforcementCheck.categories;
    result.blockingPriority = securityEnforcementCheck.priority;
  } else {
    // Explicitly set to false if not blocking
    result.blocked = false;
  }

  // Add verbose details if requested
  if (options.verbose) {
    result.details = {
      classification: classification,
      triggeredAgents: crossCuttingAgents.map(agent => ({
        agent,
        trigger: triggers.triggers[agent],
      })),
      chainSkipConditions: matrix.chainRules.chainSkipConditions[classification.taskType] || [],
      patternLearning: patternSuggestions,
    };
  }

  return result;
}

/**
 * Record execution outcome for pattern learning
 * @param {Object} execution - Execution data
 * @param {string} execution.task - Task description
 * @param {string} execution.taskType - Task type
 * @param {string[]} execution.agents - Agents used
 * @param {string} execution.outcome - Outcome (success|failure|partial)
 * @param {number} execution.duration - Duration in minutes
 * @param {Object} execution.feedback - User feedback or metrics
 * @returns {Promise<void>}
 */
export async function recordExecutionOutcome(execution) {
  try {
    const { recordExecution } = await import('./pattern-learner.mjs');
    await recordExecution(execution);
  } catch (error) {
    console.warn('Failed to record execution outcome:', error.message);
  }
}

/**
 * Get execution hints for agent chain
 * @param {string[]} chain - Agent execution chain
 * @param {string} taskType - Task type
 * @returns {Object} Execution hints (parallel vs sequential)
 */
export function getExecutionHints(chain, taskType) {
  // Define which steps can run in parallel
  const parallelSteps = {
    UI_UX: ['supporting'], // UX and accessibility can analyze in parallel
    MOBILE: ['supporting'], // UX and developer can work in parallel
    DATABASE: ['supporting'], // Architect and developer can work in parallel
    IMPLEMENTATION: [], // Sequential by default
    ARCHITECTURE: ['supporting'], // Database and security architects can work in parallel
  };

  const hints = {
    parallelSteps: parallelSteps[taskType] || [],
    sequentialSteps: ['primary', 'review', 'approval'], // Always sequential
    totalEstimatedDuration: chain.length * 15, // 15 minutes per agent (rough estimate)
  };

  return hints;
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    task: null,
    files: null,
    verbose: false,
    help: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task' || arg === '-t') {
      parsed.task = args[++i];
    } else if (arg === '--files' || arg === '-f') {
      parsed.files = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--json' || arg === '-j') {
      parsed.json = true;
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
Agent Router - Runtime Agent Selection

Selects the optimal agent chain based on task classification and routing rules.

USAGE:
  node agent-router.mjs --task <description> [options]

OPTIONS:
  --task, -t <desc>    Task description to route (required)
  --files, -f <glob>   File patterns affected by the task
  --verbose, -v        Include detailed analysis in output
  --json, -j           Output as JSON
  --help, -h           Show this help message

EXAMPLES:
  node agent-router.mjs --task "Add user authentication"
  node agent-router.mjs --task "Fix mobile UI bug" --verbose
  node agent-router.mjs --task "Database schema migration" --json

PROGRAMMATIC USE:
  import { selectAgents } from './agent-router.mjs';
  const routing = await selectAgents("Add new feature", { files: "src/**" });
`);
}

/**
 * Format result for console output
 * @param {Object} result - Routing result
 * @param {boolean} verbose - Include verbose details
 * @returns {string} Formatted output
 */
function formatResult(result, verbose = false) {
  const lines = [];

  lines.push(`\nTask Type: ${result.taskType}`);
  lines.push(`Complexity: ${result.complexity.toUpperCase()}`);
  lines.push(`\nAgent Chain:`);
  lines.push(`  Primary:     ${result.primary}`);

  if (result.supporting.length > 0) {
    lines.push(`  Supporting:  ${result.supporting.join(', ')}`);
  }

  if (result.crossCutting.length > 0) {
    lines.push(`  Cross-Cutting: ${result.crossCutting.join(', ')}`);
  }

  if (result.review.length > 0) {
    lines.push(`  Review:      ${result.review.join(', ')}`);
  }

  if (result.approval.length > 0) {
    lines.push(`  Approval:    ${result.approval.join(', ')}`);
  }

  lines.push(`\nFull Execution Chain:`);
  lines.push(`  ${result.fullChain.join(' → ')}`);

  lines.push(`\nWorkflow: ${result.workflow}`);

  lines.push(`\nRequired Gates:`);
  lines.push(`  Planner:        ${result.gates.planner ? 'Yes' : 'No'}`);
  lines.push(`  Review:         ${result.gates.review ? 'Yes' : 'No'}`);
  lines.push(`  Impact Analysis: ${result.gates.impactAnalysis ? 'Yes' : 'No'}`);

  lines.push(`\nReasoning: ${result.reasoning}`);

  // Security Enforcement
  if (result.securityEnforcement && result.securityEnforcement.triggered) {
    lines.push(`\nSecurity Enforcement:`);
    lines.push(`  Priority: ${result.securityEnforcement.priority.toUpperCase()}`);
    lines.push(`  Blocking: ${result.securityEnforcement.blocking ? 'YES' : 'NO'}`);
    lines.push(`  Require Signoff: ${result.securityEnforcement.requireSignoff ? 'YES' : 'NO'}`);
    lines.push(`  Categories: ${result.securityEnforcement.categories.join(', ')}`);
    lines.push(`  Required Agents: ${result.securityEnforcement.requiredAgents.join(', ')}`);

    if (result.blocked) {
      lines.push(`\n  ⚠️  BLOCKED: ${result.blockReason}`);
      lines.push(`  ⚠️  Blocking Priority: ${result.blockingPriority}`);
    }

    if (result.securityEnforcement.maxResponseTimeHours) {
      lines.push(`  Max Response Time: ${result.securityEnforcement.maxResponseTimeHours} hours`);
    }
  }

  // Pattern learning suggestions
  if (result.patternLearning && result.patternLearning.hasRecommendations) {
    lines.push(`\nPattern Learning Suggestions:`);
    lines.push(`  Confidence: ${result.patternLearning.confidence}`);
    for (const rec of result.patternLearning.recommendations) {
      lines.push(`  - [${rec.type}] ${rec.message}`);
    }
  }

  if (verbose && result.details) {
    lines.push(`\nDetailed Analysis:`);

    if (result.details.triggeredAgents.length > 0) {
      lines.push(`\n  Triggered Cross-Cutting Agents:`);
      for (const { agent, trigger } of result.details.triggeredAgents) {
        lines.push(`    - ${agent}: ${trigger.description}`);
      }
    }

    if (result.details.chainSkipConditions.length > 0) {
      lines.push(`\n  Chain Skip Conditions:`);
      lines.push(`    Skipped: ${result.details.chainSkipConditions.join(', ')}`);
    }

    if (result.details.patternLearning) {
      lines.push(`\n  Pattern Learning Details:`);
      lines.push(`    Recommendations: ${result.details.patternLearning.recommendations.length}`);
      lines.push(`    Confidence: ${result.details.patternLearning.confidence}`);
    }
  }

  return lines.join('\n');
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.task) {
    console.error('Error: Task description is required. Use --task <description>');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  try {
    const result = await selectAgents(args.task, {
      files: args.files,
      verbose: args.verbose,
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatResult(result, args.verbose));
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

/**
 * Validate security approval for workflow execution
 * @param {string} workflowId - Workflow identifier
 * @param {string} taskDescription - Task description to check
 * @returns {Promise<Object>} Validation result with approval status
 */
export async function validateWorkflowSecurity(workflowId, taskDescription) {
  const securityCheck = await checkSecurityTriggers(taskDescription);
  return await validateSecurityApproval(workflowId, securityCheck);
}

export default {
  selectAgents,
  getExecutionHints,
  recordExecutionOutcome,
  validateWorkflowSecurity,
};
