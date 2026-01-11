#!/usr/bin/env node
/**
 * Plan Review Gate - Automated Plan Review Orchestrator
 *
 * Coordinates multi-agent plan reviews based on task type and complexity.
 * Aggregates reviewer scores and determines if plan passes quality gates.
 *
 * Usage:
 *   Programmatic:
 *     import { runPlanReviewGate } from './plan-review-gate.mjs';
 *     const result = await runPlanReviewGate(planPath, workflowId, taskKeywords);
 *
 *   CLI:
 *     node plan-review-gate.mjs --plan path/to/plan.json --workflow-id wf-123 --keywords "auth,security"
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load plan review matrix configuration
 * @returns {Promise<Object>} Plan review matrix
 */
async function loadConfig() {
  try {
    const configPath = join(__dirname, '..', 'context', 'plan-review-matrix.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load plan review matrix: ${error.message}`);
  }
}

/**
 * Determine which reviewers should review the plan
 * @param {Object} plan - The plan to review
 * @param {Object} reviewMatrix - Plan review matrix configuration
 * @param {string[]} taskKeywords - Keywords from task description
 * @returns {Object} Reviewer requirements
 */
function determineReviewers(plan, reviewMatrix, taskKeywords = []) {
  // Extract task type from plan (assuming plan has a taskType field)
  const taskType = plan.taskType || 'IMPLEMENTATION';
  const complexity = plan.complexity || 'moderate';
  const workflow = plan.workflow || 'fullstack';

  const taskConfig = reviewMatrix.taskTypes[taskType];

  if (!taskConfig) {
    // Default fallback
    return {
      required: ['architect', 'qa'],
      optional: ['pm'],
      minimum_score: 7,
      blocking_threshold: 5,
      complexity_modifier: 0,
    };
  }

  let required = [...taskConfig.required];
  let optional = [...taskConfig.optional];
  let minimumScore = taskConfig.minimum_score;
  let blockingThreshold = taskConfig.blocking_threshold;

  // Apply complexity modifiers
  const complexityModifier = reviewMatrix.complexityModifiers[complexity];
  if (complexityModifier) {
    minimumScore += complexityModifier.score_modifier;

    if (complexityModifier.reduce_required_reviewers > 0 && required.length > 1) {
      const toMove = required.splice(-complexityModifier.reduce_required_reviewers);
      optional = [...optional, ...toMove];
    }
  }

  // Apply workflow modifiers
  const workflowModifier = reviewMatrix.workflowModifiers[workflow];
  if (workflowModifier) {
    if (workflowModifier.reduce_required_reviewers > 0 && required.length > 1) {
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
    complexity_modifier: complexityModifier?.score_modifier || 0,
  };
}

/**
 * Aggregate review results from multiple reviewers
 * @param {Object[]} reviews - Array of review results
 * @param {Object} scoringRules - Scoring rules from matrix
 * @returns {Object} Aggregated results
 */
function aggregateResults(reviews, scoringRules) {
  if (!reviews || reviews.length === 0) {
    return {
      overall_score: 0,
      passed: false,
      blocking_issues: [],
      summary: 'No reviews received',
    };
  }

  const requiredReviews = reviews.filter(r => r.required);
  const optionalReviews = reviews.filter(r => !r.required);

  // Calculate weighted average
  const requiredWeight = scoringRules.weights.required;
  const optionalWeight = scoringRules.weights.optional;

  let requiredScore = 0;
  if (requiredReviews.length > 0) {
    requiredScore = requiredReviews.reduce((sum, r) => sum + r.score, 0) / requiredReviews.length;
  }

  let optionalScore = 0;
  if (optionalReviews.length > 0) {
    optionalScore = optionalReviews.reduce((sum, r) => sum + r.score, 0) / optionalReviews.length;
  }

  const overallScore = requiredScore * requiredWeight + optionalScore * optionalWeight;

  // Check for blocking issues
  const blockingIssues = reviews.filter(r => r.blocking || r.critical_issues > 0);

  // Determine if passed
  const blockingBehavior = scoringRules.blocking_behavior;
  let passed = overallScore >= scoringRules.minimum_score;

  if (blockingBehavior === 'any_reviewer_below_threshold_blocks') {
    const hasBlockingReview = reviews.some(r => r.score < scoringRules.blocking_threshold);
    if (hasBlockingReview) {
      passed = false;
    }
  }

  if (blockingIssues.length > 0) {
    passed = false;
  }

  return {
    overall_score: parseFloat(overallScore.toFixed(2)),
    required_score: parseFloat(requiredScore.toFixed(2)),
    optional_score: parseFloat(optionalScore.toFixed(2)),
    passed,
    blocking_issues: blockingIssues.map(r => ({
      reviewer: r.reviewer,
      issues: r.issues || [],
      score: r.score,
    })),
    summary: passed
      ? `Plan passed review with score ${overallScore.toFixed(2)}/10`
      : `Plan failed review (score: ${overallScore.toFixed(2)}/10, blocking issues: ${blockingIssues.length})`,
  };
}

/**
 * Run plan review gate
 * @param {string} planPath - Path to plan file
 * @param {string} workflowId - Workflow identifier
 * @param {string[]} taskKeywords - Task keywords for reviewer selection
 * @returns {Promise<Object>} Review gate result
 */
export async function runPlanReviewGate(planPath, workflowId, taskKeywords = []) {
  try {
    // Load plan
    if (!existsSync(planPath)) {
      throw new Error(`Plan file not found: ${planPath}`);
    }

    const planContent = await readFile(planPath, 'utf-8');
    const plan = JSON.parse(planContent);

    // Load review matrix
    const reviewMatrix = await loadConfig();

    // Determine reviewers
    const reviewers = determineReviewers(plan, reviewMatrix, taskKeywords);

    // In a real implementation, this would spawn reviewer agents
    // For now, we'll return the requirements
    const result = {
      workflow_id: workflowId,
      plan_path: planPath,
      reviewers: reviewers,
      status: 'pending',
      message: 'Plan review gate configured. Spawn reviewer agents to complete review.',
      instructions: {
        required_reviewers: reviewers.required,
        optional_reviewers: reviewers.optional,
        minimum_score: reviewers.minimum_score,
        blocking_threshold: reviewers.blocking_threshold,
        next_steps: [
          'Spawn reviewer agents using Task tool',
          'Each reviewer provides score (0-10) and issues list',
          'Call aggregateResults() to determine pass/fail',
        ],
      },
    };

    return result;
  } catch (error) {
    return {
      workflow_id: workflowId,
      status: 'error',
      error: error.message,
      plan_path: planPath,
    };
  }
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const parsed = {
    plan: null,
    workflowId: null,
    keywords: [],
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--plan' || arg === '-p') {
      parsed.plan = args[++i];
    } else if (arg === '--workflow-id' || arg === '-w') {
      parsed.workflowId = args[++i];
    } else if (arg === '--keywords' || arg === '-k') {
      const keywords = args[++i];
      parsed.keywords = keywords.split(',').map(k => k.trim());
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
Plan Review Gate - Automated Plan Review Orchestrator

Coordinates multi-agent plan reviews and aggregates results.

USAGE:
  node plan-review-gate.mjs --plan <path> --workflow-id <id> [options]

OPTIONS:
  --plan, -p <path>          Path to plan JSON file (required)
  --workflow-id, -w <id>     Workflow identifier (required)
  --keywords, -k <keywords>  Comma-separated task keywords
  --help, -h                 Show this help message

EXAMPLES:
  node plan-review-gate.mjs --plan plan.json --workflow-id wf-123
  node plan-review-gate.mjs --plan plan.json --workflow-id wf-123 --keywords "auth,security"

PROGRAMMATIC USE:
  import { runPlanReviewGate, aggregateResults } from './plan-review-gate.mjs';

  const result = await runPlanReviewGate(planPath, workflowId, taskKeywords);

  const reviews = [
    { reviewer: 'architect', score: 8, required: true, issues: [] },
    { reviewer: 'qa', score: 7, required: true, issues: [] }
  ];
  const aggregated = aggregateResults(reviews, scoringRules);
`);
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.plan || !args.workflowId) {
    console.error('Error: --plan and --workflow-id are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    const result = await runPlanReviewGate(args.plan, args.workflowId, args.keywords);
    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'error') {
      process.exit(1);
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

export default {
  runPlanReviewGate,
  determineReviewers,
  aggregateResults,
  loadConfig,
};
