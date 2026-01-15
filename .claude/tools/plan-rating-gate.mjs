#!/usr/bin/env node
/**
 * Plan Rating Gate - Enforces plan rating before workflow execution
 *
 * This module implements the Step 0.1 Plan Rating Gate that is documented
 * in all 40 workflow CUJs but was not being executed. It enforces the
 * "never execute an unrated plan" rule from CLAUDE.md.
 *
 * Features:
 * - Invokes response-rater skill to rate plan quality
 * - Enforces minimum score threshold (default: 7/10)
 * - Supports retry with planner feedback (max 3 attempts)
 * - Saves rating to canonical location
 * - Integrates with workflow_runner.js
 *
 * Usage:
 *   CLI:
 *     node plan-rating-gate.mjs --plan-path <path> --run-id <id> [--workflow-id <id>]
 *
 *   Programmatic:
 *     import { executePlanRatingGate } from './plan-rating-gate.mjs';
 *     const result = await executePlanRatingGate(runId, planPath, options);
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { recordPlanRating, validatePlanRating } from './enforcement-gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_MINIMUM_SCORE = 7;
const MAX_RATING_ATTEMPTS = 3;
const RATING_TIMEOUT_MS = 60000; // 60 seconds per provider (reduced from 3 minutes for faster feedback)
const PLAN_RATING_TIMEOUT_MS = 60000; // 60 seconds for plan rating gate
const DEFAULT_PROVIDERS = 'claude,gemini';

// Paths
const CONTEXT_DIR = join(__dirname, '..', 'context');
const RUNS_DIR = join(CONTEXT_DIR, 'runs');
const RESPONSE_RATER_SCRIPT = join(
  __dirname,
  '..',
  'skills',
  'response-rater',
  'scripts',
  'rate.cjs'
);

/**
 * Load JSON file safely with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object|null>} Parsed JSON or null on error
 */
async function loadJson(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

/**
 * Get plan rating file path
 * @param {string} runId - Run identifier
 * @param {string} planId - Plan identifier
 * @returns {string} Path to plan rating file
 */
function getPlanRatingPath(runId, planId) {
  return join(RUNS_DIR, runId, 'plans', `${planId}-rating.json`);
}

/**
 * Get plan file path (searches multiple locations)
 * @param {string} runId - Run identifier
 * @param {string} workflowId - Workflow identifier
 * @returns {string|null} Path to plan file or null if not found
 */
function findPlanFile(runId, workflowId) {
  // Try canonical locations
  const possiblePaths = [
    // Run-specific artifacts
    join(RUNS_DIR, runId, 'artifacts', `plan-${workflowId}.json`),
    join(RUNS_DIR, runId, 'artifacts', 'plan.json'),
    // Legacy artifacts location
    join(CONTEXT_DIR, 'artifacts', `plan-${workflowId}.json`),
    join(CONTEXT_DIR, 'artifacts', 'plan.json'),
    // Markdown variants
    join(RUNS_DIR, runId, 'artifacts', `plan-${workflowId}.md`),
    join(CONTEXT_DIR, 'artifacts', `plan-${workflowId}.md`),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Extract plan ID from plan file path
 * @param {string} planPath - Path to plan file
 * @returns {string} Plan identifier
 */
function extractPlanId(planPath) {
  const filename = basename(planPath);
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(json|md)$/, '');
  return nameWithoutExt;
}

/**
 * Invoke response-rater skill to rate a plan
 * @param {string} planPath - Path to plan file
 * @param {Object} options - Rating options
 * @param {string} options.providers - Comma-separated provider list
 * @param {string} options.template - Rating template (default: plan-review)
 * @returns {Promise<Object>} Rating result from response-rater
 */
async function invokeResponseRater(planPath, options = {}) {
  const {
    providers = DEFAULT_PROVIDERS,
    template = 'response-review', // Use response-review, plan is text content
    timeoutMs = RATING_TIMEOUT_MS,
  } = options;

  return new Promise((resolve, reject) => {
    // Check if response-rater script exists
    if (!existsSync(RESPONSE_RATER_SCRIPT)) {
      reject(new Error(`Response-rater script not found: ${RESPONSE_RATER_SCRIPT}`));
      return;
    }

    const args = [
      RESPONSE_RATER_SCRIPT,
      '--response-file',
      planPath,
      '--providers',
      providers,
      '--template',
      template,
    ];

    console.log(`[Plan Rating] Invoking response-rater with providers: ${providers}`);
    console.log(`[Plan Rating] Plan file: ${planPath}`);
    console.log(`[Plan Rating] Timeout: ${timeoutMs / 1000}s`);

    // Progress indicator
    let elapsedSeconds = 0;
    const progressInterval = setInterval(() => {
      elapsedSeconds += 5;
      if (elapsedSeconds <= timeoutMs / 1000) {
        console.log(`[Plan Rating] Rating plan... (${elapsedSeconds}s elapsed)`);
      }
    }, 5000);

    const child = spawn('node', args, {
      cwd: join(__dirname, '../..'),
      timeout: timeoutMs,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('error', error => {
      clearInterval(progressInterval);
      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        reject(
          new Error(
            `Plan rating timed out after ${timeoutMs / 1000}s. Consider using offline fallback or increasing timeout.`
          )
        );
      } else {
        reject(new Error(`Failed to spawn response-rater: ${error.message}`));
      }
    });

    child.on('close', code => {
      clearInterval(progressInterval);
      if (code !== 0) {
        // Check if any provider succeeded
        try {
          const result = JSON.parse(stdout);
          if (result.providers) {
            const successfulProviders = Object.entries(result.providers)
              .filter(([_, data]) => data.ok)
              .map(([name]) => name);

            if (successfulProviders.length > 0) {
              console.log(
                `[Plan Rating] ${successfulProviders.length} provider(s) succeeded: ${successfulProviders.join(', ')}`
              );
              resolve(result);
              return;
            }
          }
        } catch (parseError) {
          // Not JSON, fall through to error
        }
        reject(new Error(`Response-rater exited with code ${code}: ${stderr || 'Unknown error'}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        reject(
          new Error(
            `Failed to parse response-rater output: ${parseError.message}\nOutput: ${stdout}`
          )
        );
      }
    });
  });
}

/**
 * Parse rating result from response-rater output
 * Extracts scores from multiple providers and computes aggregate
 * @param {Object} raterResult - Raw response-rater output
 * @returns {Object} Normalized rating with overall_score and component_scores
 */
function parseRatingResult(raterResult) {
  const result = {
    overall_score: 0,
    component_scores: {},
    feedback: [],
    improvements: [],
    provider_results: {},
    providers_used: [],
    providers_failed: [],
  };

  if (!raterResult.providers) {
    return result;
  }

  const scores = [];

  for (const [providerName, providerData] of Object.entries(raterResult.providers)) {
    if (providerData.ok && providerData.parsed) {
      result.providers_used.push(providerName);
      result.provider_results[providerName] = providerData.parsed;

      // Extract scores - handle different response formats
      const parsed = providerData.parsed;

      // Plan rating uses 5 dimensions: completeness, feasibility, risk_mitigation, agent_coverage, integration
      // Response review uses 7 dimensions: correctness, completeness, clarity, actionability, risk_management, constraint_alignment, brevity
      if (parsed.scores) {
        // Calculate average of all score dimensions
        const scoreValues = Object.values(parsed.scores).filter(v => typeof v === 'number');
        if (scoreValues.length > 0) {
          const providerScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
          scores.push(providerScore);

          // Aggregate component scores
          for (const [component, score] of Object.entries(parsed.scores)) {
            if (typeof score === 'number') {
              if (!result.component_scores[component]) {
                result.component_scores[component] = [];
              }
              result.component_scores[component].push(score);
            }
          }
        }
      }

      // Collect feedback
      if (parsed.summary) {
        result.feedback.push(`[${providerName}] ${parsed.summary}`);
      }

      // Collect improvements
      if (parsed.improvements && Array.isArray(parsed.improvements)) {
        parsed.improvements.forEach(imp => {
          if (!result.improvements.includes(imp)) {
            result.improvements.push(imp);
          }
        });
      }
    } else {
      result.providers_failed.push(providerName);
    }
  }

  // Calculate overall score (average of provider scores)
  if (scores.length > 0) {
    result.overall_score = scores.reduce((a, b) => a + b, 0) / scores.length;
    result.overall_score = Math.round(result.overall_score * 10) / 10; // Round to 1 decimal
  }

  // Average component scores
  for (const [component, values] of Object.entries(result.component_scores)) {
    result.component_scores[component] =
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  return result;
}

/**
 * Generate feedback for planner when plan fails rating
 * @param {Object} rating - Parsed rating result
 * @param {number} minimumScore - Required minimum score
 * @returns {Object} Structured feedback for planner
 */
function generatePlannerFeedback(rating, minimumScore) {
  const feedback = {
    score: rating.overall_score,
    minimum_required: minimumScore,
    gap: minimumScore - rating.overall_score,
    weak_areas: [],
    improvements_required: rating.improvements.slice(0, 5), // Top 5 improvements
    provider_feedback: rating.feedback,
  };

  // Identify weak areas (components below 7)
  for (const [component, score] of Object.entries(rating.component_scores)) {
    if (score < 7) {
      feedback.weak_areas.push({
        component,
        score,
        suggestion: `Improve ${component.replace(/_/g, ' ')} to at least 7/10`,
      });
    }
  }

  return feedback;
}

/**
 * Execute plan rating gate
 *
 * @param {string} runId - Run identifier
 * @param {string} planPath - Path to plan file (optional, will search if not provided)
 * @param {Object} options - Gate options
 * @param {string} options.workflowId - Workflow identifier (for plan lookup)
 * @param {number} options.minimumScore - Minimum required score (default: 7)
 * @param {string} options.providers - Comma-separated provider list
 * @param {string} options.taskType - Task type for matrix lookup
 * @param {string} options.complexity - Complexity level
 * @param {number} options.maxAttempts - Max rating attempts (default: 3)
 * @returns {Promise<Object>} Gate result with success status
 */
export async function executePlanRatingGate(runId, planPath = null, options = {}) {
  const {
    workflowId = runId,
    minimumScore = DEFAULT_MINIMUM_SCORE,
    providers = DEFAULT_PROVIDERS,
    taskType = 'IMPLEMENTATION',
    complexity = 'moderate',
    maxAttempts = MAX_RATING_ATTEMPTS,
  } = options;

  const result = {
    success: false,
    rated: false,
    score: null,
    minimum_required: minimumScore,
    plan_path: planPath,
    plan_id: null,
    rating_path: null,
    attempt: 0,
    feedback: null,
    details: {},
  };

  console.log(`\n[Plan Rating Gate] Starting for run: ${runId}`);
  console.log(`[Plan Rating Gate] Minimum score required: ${minimumScore}/10`);

  try {
    // Find plan file if not provided
    if (!planPath) {
      planPath = findPlanFile(runId, workflowId);
      if (!planPath) {
        result.feedback = {
          error: 'Plan file not found',
          searched_locations: [
            `runs/${runId}/artifacts/plan-${workflowId}.json`,
            `runs/${runId}/artifacts/plan.json`,
            `artifacts/plan-${workflowId}.json`,
          ],
          suggestion: 'Ensure Step 0 (Planning) has completed and created a plan artifact',
        };
        console.error(`[Plan Rating Gate] Plan file not found for run ${runId}`);
        return result;
      }
    }

    result.plan_path = planPath;
    result.plan_id = extractPlanId(planPath);
    result.rating_path = getPlanRatingPath(runId, result.plan_id);

    console.log(`[Plan Rating Gate] Found plan: ${planPath}`);
    console.log(`[Plan Rating Gate] Plan ID: ${result.plan_id}`);

    // Check if rating already exists and is valid
    const existingRating = await loadJson(result.rating_path);
    if (existingRating && existingRating.overall_score !== undefined) {
      console.log(`[Plan Rating Gate] Found existing rating: ${existingRating.overall_score}/10`);

      if (existingRating.overall_score >= minimumScore) {
        result.success = true;
        result.rated = true;
        result.score = existingRating.overall_score;
        result.details.existing_rating = existingRating;
        console.log(`[Plan Rating Gate] Existing rating passes (>= ${minimumScore})`);
        return result;
      } else {
        console.log(
          `[Plan Rating Gate] Existing rating too low (${existingRating.overall_score} < ${minimumScore})`
        );
        result.details.previous_rating = existingRating;
      }
    }

    // Invoke response-rater to rate the plan
    result.attempt = 1;
    console.log(`\n[Plan Rating Gate] Rating attempt ${result.attempt}/${maxAttempts}...`);

    const raterResult = await invokeResponseRater(planPath, {
      providers,
      template: 'response-review',
    });

    // Parse rating result
    const rating = parseRatingResult(raterResult);
    result.rated = true;
    result.score = rating.overall_score;
    result.details.raw_result = raterResult;
    result.details.parsed_rating = rating;

    console.log(`[Plan Rating Gate] Rating received: ${rating.overall_score}/10`);
    console.log(`[Plan Rating Gate] Providers used: ${rating.providers_used.join(', ')}`);
    if (rating.providers_failed.length > 0) {
      console.warn(`[Plan Rating Gate] Providers failed: ${rating.providers_failed.join(', ')}`);
    }

    // Check if rating meets minimum
    if (rating.overall_score >= minimumScore) {
      result.success = true;
      console.log(
        `[Plan Rating Gate] Plan rating PASSED (${rating.overall_score} >= ${minimumScore})`
      );
    } else {
      result.success = false;
      result.feedback = generatePlannerFeedback(rating, minimumScore);
      console.log(
        `[Plan Rating Gate] Plan rating FAILED (${rating.overall_score} < ${minimumScore})`
      );
      console.log(
        `[Plan Rating Gate] Weak areas: ${result.feedback.weak_areas.map(w => w.component).join(', ')}`
      );
    }

    // Save rating to canonical location
    const ratingRecord = {
      plan_id: result.plan_id,
      run_id: runId,
      workflow_id: workflowId,
      overall_score: rating.overall_score,
      component_scores: rating.component_scores,
      providers_used: rating.providers_used,
      providers_failed: rating.providers_failed,
      minimum_required: minimumScore,
      passed: result.success,
      attempt: result.attempt,
      feedback: rating.feedback,
      improvements: rating.improvements,
      rated_at: new Date().toISOString(),
      rated_by: 'response-rater',
    };

    // Ensure directory exists
    const ratingDir = dirname(result.rating_path);
    if (!existsSync(ratingDir)) {
      await mkdir(ratingDir, { recursive: true });
    }

    await writeFile(result.rating_path, JSON.stringify(ratingRecord, null, 2), 'utf-8');
    console.log(`[Plan Rating Gate] Rating saved to: ${result.rating_path}`);

    // Also record via enforcement-gate for consistency
    await recordPlanRating(runId, result.plan_id, ratingRecord);

    return result;
  } catch (error) {
    result.feedback = {
      error: error.message,
      suggestion: 'Check response-rater skill configuration and provider authentication',
    };
    console.error(`[Plan Rating Gate] Error: ${error.message}`);
    return result;
  }
}

/**
 * Check if plan has been rated (used by workflow_runner)
 * @param {string} runId - Run identifier
 * @param {string} planId - Plan identifier (optional)
 * @returns {Promise<Object>} Validation result
 */
export async function checkPlanRating(runId, planId = 'plan') {
  return validatePlanRating(runId, planId);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = {
    planPath: null,
    runId: null,
    workflowId: null,
    minimumScore: DEFAULT_MINIMUM_SCORE,
    providers: DEFAULT_PROVIDERS,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--plan-path' || arg === '-p') {
      parsed.planPath = args[++i];
    } else if (arg === '--run-id' || arg === '-r') {
      parsed.runId = args[++i];
    } else if (arg === '--workflow-id' || arg === '-w') {
      parsed.workflowId = args[++i];
    } else if (arg === '--minimum-score' || arg === '-m') {
      parsed.minimumScore = parseFloat(args[++i]);
    } else if (arg === '--providers') {
      parsed.providers = args[++i];
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
Plan Rating Gate - Enforces plan rating before workflow execution

This implements the Step 0.1 Plan Rating Gate that ensures all plans
are rated using the response-rater skill before workflow execution.

USAGE:
  node plan-rating-gate.mjs --run-id <id> [options]

OPTIONS:
  --run-id, -r <id>           Run identifier (required)
  --plan-path, -p <path>      Path to plan file (optional, auto-detected)
  --workflow-id, -w <id>      Workflow identifier (default: same as run-id)
  --minimum-score, -m <n>     Minimum required score (default: 7)
  --providers <list>          Comma-separated provider list (default: claude,gemini)
  --help, -h                  Show this help message

EXAMPLES:
  # Rate plan for a run
  node plan-rating-gate.mjs --run-id run-001

  # Rate specific plan file with custom threshold
  node plan-rating-gate.mjs --run-id run-001 --plan-path plan.json --minimum-score 8

  # Use specific providers
  node plan-rating-gate.mjs --run-id run-001 --providers claude,gemini,codex

INTEGRATION:
  The plan-rating-gate is automatically invoked by workflow_runner.js
  before executing Step 1 if a plan exists from Step 0.
`);
}

// CLI interface
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.runId) {
    console.error('Error: --run-id is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    const result = await executePlanRatingGate(args.runId, args.planPath, {
      workflowId: args.workflowId,
      minimumScore: args.minimumScore,
      providers: args.providers,
    });

    console.log('\n' + '='.repeat(60));
    console.log('PLAN RATING GATE RESULT');
    console.log('='.repeat(60));
    console.log(
      JSON.stringify(
        {
          success: result.success,
          score: result.score,
          minimum_required: result.minimum_required,
          plan_id: result.plan_id,
          rating_path: result.rating_path,
          feedback: result.feedback,
        },
        null,
        2
      )
    );
    console.log('='.repeat(60));

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(console.error);
}

export default {
  executePlanRatingGate,
  checkPlanRating,
  invokeResponseRater,
  parseRatingResult,
  generatePlannerFeedback,
};
