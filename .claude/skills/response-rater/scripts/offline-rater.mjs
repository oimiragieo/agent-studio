#!/usr/bin/env node

/**
 * Offline Plan Rating Module
 *
 * Provides heuristic-based plan scoring when network access is unavailable.
 * Scores plans based on structural analysis without requiring external AI providers.
 *
 * @module offline-rater
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Score plan completeness based on structural analysis
 * @param {Object} plan - Parsed plan JSON
 * @returns {number} Score 1-10
 */
function scoreCompleteness(plan) {
  let score = 0;
  const weights = {
    hasObjectives: 2,
    hasContext: 1,
    hasPhases: 2,
    hasSteps: 2,
    hasSuccessCriteria: 1,
    hasTimeline: 1,
    hasDeliverables: 1,
  };

  // Check for required sections
  if (plan.business_objective || plan.objectives || plan.goal) {
    score += weights.hasObjectives;
  }

  if (plan.context || plan.background || plan.problem_statement) {
    score += weights.hasContext;
  }

  if (plan.phases && Array.isArray(plan.phases) && plan.phases.length > 0) {
    score += weights.hasPhases;
  }

  if (plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0) {
    score += weights.hasSteps;
  }

  if (plan.success_criteria || plan.acceptance_criteria) {
    score += weights.hasSuccessCriteria;
  }

  if (plan.timeline || plan.schedule || plan.estimated_duration) {
    score += weights.hasTimeline;
  }

  if (plan.deliverables || plan.outputs) {
    score += weights.hasDeliverables;
  }

  return score;
}

/**
 * Score plan feasibility based on estimates and dependencies
 * @param {Object} plan - Parsed plan JSON
 * @returns {number} Score 1-10
 */
function scoreFeasibility(plan) {
  let score = 5; // Base score (neutral)

  // Check for realistic estimates
  const steps = plan.steps || plan.phases || [];
  if (steps.length > 0) {
    let hasEstimates = 0;
    let hasDependencies = 0;

    steps.forEach((step) => {
      if (step.estimated_duration || step.estimate || step.time) {
        hasEstimates++;
      }
      if (step.dependencies || step.depends_on) {
        hasDependencies++;
      }
    });

    // Reward for estimates
    const estimateRatio = hasEstimates / steps.length;
    score += estimateRatio * 2;

    // Reward for dependency mapping
    const dependencyRatio = hasDependencies / steps.length;
    score += dependencyRatio * 1.5;
  }

  // Check for resource requirements
  if (plan.resources || plan.resource_requirements) {
    score += 1;
  }

  // Check for constraints acknowledgment
  if (plan.constraints || plan.limitations) {
    score += 0.5;
  }

  return Math.min(score, 10);
}

/**
 * Score risk mitigation based on identified risks and mitigations
 * @param {Object} plan - Parsed plan JSON
 * @returns {number} Score 1-10
 */
function scoreRiskMitigation(plan) {
  let score = 0;

  // Check for risk identification
  const risks = plan.risks || [];
  if (risks.length === 0) {
    return 3; // Low score if no risks identified
  }

  // Count risks with mitigations
  let risksWithMitigation = 0;
  risks.forEach((risk) => {
    if (risk.mitigation || risk.response || risk.strategy) {
      risksWithMitigation++;
    }
  });

  const mitigationRatio = risksWithMitigation / risks.length;

  // Score based on mitigation coverage
  if (mitigationRatio >= 0.9) {
    score = 9;
  } else if (mitigationRatio >= 0.7) {
    score = 7;
  } else if (mitigationRatio >= 0.5) {
    score = 5;
  } else {
    score = 3;
  }

  // Bonus for contingency plans
  if (plan.contingency_plans || plan.fallback_strategies) {
    score += 1;
  }

  return Math.min(score, 10);
}

/**
 * Score agent coverage based on assigned agents
 * @param {Object} plan - Parsed plan JSON
 * @returns {number} Score 1-10
 */
function scoreAgentCoverage(plan) {
  let score = 0;

  // Check for agent assignments
  const steps = plan.steps || plan.phases || [];
  if (steps.length === 0) {
    return 3; // Low score if no steps
  }

  let stepsWithAgents = 0;
  const agentTypes = new Set();

  steps.forEach((step) => {
    if (step.agent || step.assigned_agent || step.responsible_agent) {
      stepsWithAgents++;
      agentTypes.add(step.agent || step.assigned_agent || step.responsible_agent);
    }
  });

  const assignmentRatio = stepsWithAgents / steps.length;

  // Score based on assignment coverage
  if (assignmentRatio >= 0.9) {
    score = 7;
  } else if (assignmentRatio >= 0.7) {
    score = 5;
  } else if (assignmentRatio >= 0.5) {
    score = 3;
  } else {
    score = 2;
  }

  // Bonus for diverse agent types (good separation of concerns)
  const diversityBonus = Math.min(agentTypes.size / 3, 3); // Up to 3 points
  score += diversityBonus;

  return Math.min(score, 10);
}

/**
 * Score integration based on dependency mapping
 * @param {Object} plan - Parsed plan JSON
 * @returns {number} Score 1-10
 */
function scoreIntegration(plan) {
  let score = 5; // Base score (neutral)

  // Check for integration points
  if (plan.integration_points || plan.external_dependencies) {
    score += 2;
  }

  // Check for data flow mapping
  if (plan.data_flow || plan.inputs_outputs) {
    score += 1.5;
  }

  // Check for API contracts
  if (plan.api_contracts || plan.interfaces) {
    score += 1;
  }

  // Check for backward compatibility
  if (plan.backward_compatibility || plan.migration_strategy) {
    score += 0.5;
  }

  return Math.min(score, 10);
}

/**
 * Rate a plan using offline heuristic scoring
 * @param {string} planPath - Path to plan JSON file
 * @returns {Object} Rating result with scores and feedback
 */
export async function ratePlanOffline(planPath) {
  const startTime = Date.now();

  // Read and parse plan
  let plan;
  try {
    const planContent = fs.readFileSync(path.resolve(planPath), 'utf8');
    plan = JSON.parse(planContent);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read/parse plan: ${error.message}`,
      method: 'offline',
    };
  }

  // Calculate dimension scores
  const scores = {
    completeness: scoreCompleteness(plan),
    feasibility: scoreFeasibility(plan),
    risk_mitigation: scoreRiskMitigation(plan),
    agent_coverage: scoreAgentCoverage(plan),
    integration: scoreIntegration(plan),
  };

  // Calculate overall score (equal weights)
  const overallScore =
    (scores.completeness +
      scores.feasibility +
      scores.risk_mitigation +
      scores.agent_coverage +
      scores.integration) /
    5;

  // Generate improvement suggestions based on low scores
  const improvements = [];
  if (scores.completeness < 7) {
    improvements.push('Add missing plan sections: objectives, context, success criteria');
  }
  if (scores.feasibility < 7) {
    improvements.push('Include time estimates and resource requirements for each step');
  }
  if (scores.risk_mitigation < 7) {
    improvements.push('Identify risks and define mitigation strategies for each');
  }
  if (scores.agent_coverage < 7) {
    improvements.push('Assign appropriate agents to all steps; ensure diverse agent types');
  }
  if (scores.integration < 7) {
    improvements.push('Define integration points, data flow, and API contracts');
  }

  // Generate summary
  const summary = `Plan scored ${overallScore.toFixed(1)}/10 using offline heuristic analysis. ${
    overallScore >= 7
      ? 'Plan meets minimum quality standards.'
      : 'Plan requires improvements before execution.'
  } ${improvements.length > 0 ? `Key areas: ${improvements.slice(0, 2).join('; ')}.` : ''}`;

  const duration = Date.now() - startTime;

  return {
    ok: true,
    method: 'offline',
    duration_ms: duration,
    scores,
    overall_score: parseFloat(overallScore.toFixed(1)),
    summary,
    improvements,
    note: 'Offline scoring uses heuristic analysis. For production use, prefer online scoring with AI providers.',
  };
}

/**
 * CLI entry point for offline rating
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Offline Plan Rater - Heuristic Scoring

Usage:
  node offline-rater.mjs <plan-file>

Example:
  node offline-rater.mjs ../../../context/artifacts/plan-greenfield-2025-01-06.json

Output:
  JSON with scores, summary, and improvements
`);
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const planPath = args[0];
  const result = await ratePlanOffline(planPath);

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

// Run CLI if executed directly
const scriptPath = fileURLToPath(import.meta.url);
const argPath = process.argv[1];

if (scriptPath === argPath || scriptPath.replace(/\\/g, '/') === argPath.replace(/\\/g, '/')) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
