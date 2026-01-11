#!/usr/bin/env node
/**
 * Enforcement Gate - Hard validation gates for orchestration system
 * 
 * Provides HARD enforcement of:
 * 1. Plan rating requirements (minimum score 7/10 from response-rater)
 * 2. Signoff validation (required artifacts and approvals)
 * 3. Security trigger enforcement (agent assignment for security-sensitive tasks)
 * 
 * Usage:
 *   node .claude/tools/enforcement-gate.mjs validate-plan --run-id <id> --plan-id <id>
 *   node .claude/tools/enforcement-gate.mjs validate-signoffs --run-id <id> --workflow <name> --step <n>
 *   node .claude/tools/enforcement-gate.mjs validate-security --task "<description>" --agents <agent1,agent2>
 *   node .claude/tools/enforcement-gate.mjs validate-all --run-id <id> --workflow <name> --step <n> --task "<description>" --agents <agent1,agent2>
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration paths
const CONTEXT_DIR = join(__dirname, '..', 'context');
const RUNS_DIR = join(CONTEXT_DIR, 'runs');
const PLAN_REVIEW_MATRIX_PATH = join(CONTEXT_DIR, 'plan-review-matrix.json');
const SIGNOFF_MATRIX_PATH = join(CONTEXT_DIR, 'signoff-matrix.json');
const SECURITY_TRIGGERS_PATH = join(CONTEXT_DIR, 'security-triggers-v2.json');

// Default minimum score for plan rating
const DEFAULT_MINIMUM_SCORE = 7;

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
 * Get the gate file path for a run and step
 * @param {string} runId - Run identifier
 * @param {number} stepNumber - Step number
 * @returns {string} Path to gate file
 */
function getGateFilePath(runId, stepNumber) {
  const paddedStep = String(stepNumber).padStart(2, '0');
  return join(RUNS_DIR, runId, 'gates', `${paddedStep}-gate.json`);
}

/**
 * Get the plan rating file path for a run
 * @param {string} runId - Run identifier
 * @param {string} planId - Plan identifier
 * @returns {string} Path to plan rating file
 */
function getPlanRatingPath(runId, planId) {
  return join(RUNS_DIR, runId, 'plans', `${planId}-rating.json`);
}

/**
 * Validate that a plan has been rated and meets minimum score
 * 
 * @param {string} runId - Run identifier
 * @param {string} planId - Plan identifier (optional, defaults to 'plan')
 * @param {Object} options - Validation options
 * @param {number} options.minimumScore - Minimum required score (default: 7)
 * @param {string} options.taskType - Task type for matrix lookup
 * @param {string} options.complexity - Complexity level for score modifiers
 * @returns {Promise<Object>} Validation result
 */
export async function validatePlanRating(runId, planId = 'plan', options = {}) {
  const result = {
    valid: false,
    rated: false,
    score: null,
    minimumRequired: options.minimumScore || DEFAULT_MINIMUM_SCORE,
    feedback: [],
    details: {}
  };

  try {
    // Load plan review matrix for score requirements
    const planReviewMatrix = await loadJson(PLAN_REVIEW_MATRIX_PATH);
    
    // Determine minimum score based on task type and complexity
    let minimumScore = options.minimumScore || DEFAULT_MINIMUM_SCORE;
    
    if (planReviewMatrix && options.taskType) {
      const taskConfig = planReviewMatrix.taskTypes[options.taskType];
      if (taskConfig) {
        minimumScore = taskConfig.minimum_score || minimumScore;
        result.details.taskType = options.taskType;
        result.details.taskConfig = taskConfig;
      }
    }
    
    // Apply complexity modifiers
    if (planReviewMatrix && options.complexity) {
      const complexityMod = planReviewMatrix.complexityModifiers[options.complexity];
      if (complexityMod) {
        minimumScore += complexityMod.score_modifier;
        result.details.complexityModifier = complexityMod.score_modifier;
      }
    }
    
    result.minimumRequired = minimumScore;

    // Check for plan rating file
    const ratingPath = getPlanRatingPath(runId, planId);
    const ratingData = await loadJson(ratingPath);
    
    if (!ratingData) {
      result.feedback.push(`Plan rating not found at ${ratingPath}`);
      result.feedback.push('Plan must be rated using response-rater skill before execution');
      result.feedback.push('Use: Skill: response-rater to evaluate plan quality');
      return result;
    }

    result.rated = true;
    result.score = ratingData.score ?? ratingData.overall_score ?? ratingData.rating;
    result.details.ratingData = ratingData;
    result.details.ratedAt = ratingData.rated_at || ratingData.timestamp;
    result.details.ratedBy = ratingData.rated_by || 'response-rater';

    // Validate score format
    if (typeof result.score !== 'number') {
      result.feedback.push(`Invalid score format: ${typeof result.score}`);
      result.feedback.push('Score must be a number between 0 and 10');
      return result;
    }

    // Check minimum score
    if (result.score < minimumScore) {
      result.feedback.push(`Plan score ${result.score}/10 is below minimum required ${minimumScore}/10`);
      result.feedback.push('Return plan to Planner with specific improvement feedback');
      
      // Add specific feedback from rating if available
      if (ratingData.feedback && Array.isArray(ratingData.feedback)) {
        result.feedback.push('Rating feedback:');
        ratingData.feedback.forEach(f => result.feedback.push(`  - ${f}`));
      }
      if (ratingData.weakAreas && Array.isArray(ratingData.weakAreas)) {
        result.feedback.push('Weak areas needing improvement:');
        ratingData.weakAreas.forEach(w => result.feedback.push(`  - ${w}`));
      }
      
      return result;
    }

    // Check blocking threshold if specified in matrix
    if (planReviewMatrix && options.taskType) {
      const taskConfig = planReviewMatrix.taskTypes[options.taskType];
      if (taskConfig && ratingData.component_scores) {
        const blockingThreshold = taskConfig.blocking_threshold || 5;
        const blockedComponents = Object.entries(ratingData.component_scores)
          .filter(([_, score]) => score < blockingThreshold);
        
        if (blockedComponents.length > 0) {
          result.feedback.push(`Components below blocking threshold (${blockingThreshold}):`);
          blockedComponents.forEach(([component, score]) => {
            result.feedback.push(`  - ${component}: ${score}/10`);
          });
          return result;
        }
      }
    }

    result.valid = true;
    result.feedback.push(`Plan rating ${result.score}/10 meets minimum requirement ${minimumScore}/10`);
    
    return result;

  } catch (error) {
    result.feedback.push(`Error validating plan rating: ${error.message}`);
    return result;
  }
}

/**
 * Validate that required signoffs are present in gate files
 * 
 * @param {string} runId - Run identifier
 * @param {string} workflowName - Workflow name
 * @param {number} stepNumber - Current step number
 * @param {Object} options - Validation options
 * @param {string} options.taskDescription - Task description for conditional triggers
 * @returns {Promise<Object>} Validation result
 */
export async function validateSignoffs(runId, workflowName, stepNumber, options = {}) {
  const result = {
    valid: false,
    missing: [],
    present: [],
    conditional: {
      triggered: [],
      notTriggered: []
    },
    feedback: [],
    details: {}
  };

  try {
    // Load signoff matrix
    const signoffMatrix = await loadJson(SIGNOFF_MATRIX_PATH);
    
    if (!signoffMatrix) {
      result.feedback.push('Signoff matrix not found - defaulting to no required signoffs');
      result.valid = true;
      return result;
    }

    // Get workflow configuration
    const workflowConfig = signoffMatrix.workflows[workflowName];
    
    if (!workflowConfig) {
      result.feedback.push(`No signoff requirements defined for workflow: ${workflowName}`);
      result.valid = true;
      return result;
    }

    result.details.workflowConfig = workflowConfig;
    result.details.signoffRules = signoffMatrix.signoffRules;

    // Check required signoffs
    const requiredSignoffs = workflowConfig.required_signoffs || [];
    
    for (const signoff of requiredSignoffs) {
      const signoffPresent = await checkSignoffPresent(runId, signoff);
      
      if (signoffPresent.valid) {
        result.present.push({
          type: signoff.type,
          artifact: signoff.artifact,
          agent: signoff.agents.join(', '),
          validatedAt: signoffPresent.validatedAt
        });
      } else {
        result.missing.push({
          type: signoff.type,
          artifact: signoff.artifact,
          agents: signoff.agents,
          conditions: signoff.conditions,
          reason: signoffPresent.reason
        });
      }
    }

    // Check conditional signoffs if task description provided
    const conditionalSignoffs = workflowConfig.conditional_signoffs || [];
    const taskDescription = options.taskDescription?.toLowerCase() || '';
    
    for (const signoff of conditionalSignoffs) {
      const triggerKeywords = signoff.trigger_keywords || [];
      const isTriggered = triggerKeywords.some(keyword => 
        taskDescription.includes(keyword.toLowerCase())
      );

      if (isTriggered) {
        const signoffPresent = await checkSignoffPresent(runId, signoff);
        
        if (signoffPresent.valid) {
          result.conditional.triggered.push({
            type: signoff.type,
            artifact: signoff.artifact,
            triggered_by: triggerKeywords.filter(k => taskDescription.includes(k.toLowerCase())),
            status: 'present'
          });
          result.present.push({
            type: signoff.type,
            artifact: signoff.artifact,
            agent: signoff.agents.join(', '),
            conditional: true,
            validatedAt: signoffPresent.validatedAt
          });
        } else {
          result.conditional.triggered.push({
            type: signoff.type,
            artifact: signoff.artifact,
            triggered_by: triggerKeywords.filter(k => taskDescription.includes(k.toLowerCase())),
            status: 'missing'
          });
          
          // Only add to missing if conditional signoffs are blocking
          if (signoffMatrix.signoffRules?.conditional_signoffs_blocking !== false) {
            result.missing.push({
              type: signoff.type,
              artifact: signoff.artifact,
              agents: signoff.agents,
              conditions: signoff.conditions,
              reason: signoffPresent.reason,
              conditional: true
            });
          }
        }
      } else {
        result.conditional.notTriggered.push({
          type: signoff.type,
          trigger_keywords: triggerKeywords
        });
      }
    }

    // Determine overall validity
    const requiredMissing = result.missing.filter(m => !m.conditional);
    const conditionalMissing = result.missing.filter(m => m.conditional);

    if (requiredMissing.length > 0) {
      result.valid = false;
      result.feedback.push(`Missing ${requiredMissing.length} required signoff(s):`);
      requiredMissing.forEach(m => {
        result.feedback.push(`  - ${m.type}: ${m.artifact} (agents: ${m.agents.join(', ')})`);
        result.feedback.push(`    Reason: ${m.reason}`);
      });
    } else if (conditionalMissing.length > 0 && signoffMatrix.signoffRules?.conditional_signoffs_blocking) {
      result.valid = false;
      result.feedback.push(`Missing ${conditionalMissing.length} triggered conditional signoff(s):`);
      conditionalMissing.forEach(m => {
        result.feedback.push(`  - ${m.type}: ${m.artifact} (agents: ${m.agents.join(', ')})`);
      });
    } else {
      result.valid = true;
      if (result.present.length > 0) {
        result.feedback.push(`All ${result.present.length} required signoff(s) present`);
      } else {
        result.feedback.push('No signoffs required for this workflow/step');
      }
    }

    return result;

  } catch (error) {
    result.feedback.push(`Error validating signoffs: ${error.message}`);
    return result;
  }
}

/**
 * Check if a specific signoff is present and valid
 * @param {string} runId - Run identifier
 * @param {Object} signoff - Signoff configuration
 * @returns {Promise<Object>} Signoff check result
 */
async function checkSignoffPresent(runId, signoff) {
  try {
    // Look for artifact in run's artifacts directory
    const artifactPath = join(RUNS_DIR, runId, 'artifacts', signoff.artifact);
    const artifactData = await loadJson(artifactPath);
    
    if (!artifactData) {
      return {
        valid: false,
        reason: `Artifact not found: ${signoff.artifact}`
      };
    }

    // Check conditions if specified
    if (signoff.conditions) {
      const conditionResults = evaluateConditions(artifactData, signoff.conditions);
      if (!conditionResults.allPassed) {
        return {
          valid: false,
          reason: `Conditions not met: ${conditionResults.failedConditions.join(', ')}`
        };
      }
    }

    return {
      valid: true,
      validatedAt: artifactData.created_at || artifactData.timestamp || new Date().toISOString()
    };

  } catch (error) {
    return {
      valid: false,
      reason: `Error checking signoff: ${error.message}`
    };
  }
}

/**
 * Evaluate signoff conditions against artifact data
 * @param {Object} artifactData - Artifact data
 * @param {Object} conditions - Conditions to evaluate
 * @returns {Object} Evaluation result
 */
function evaluateConditions(artifactData, conditions) {
  const failedConditions = [];
  
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = getNestedValue(artifactData, key);
    
    if (actual === undefined) {
      failedConditions.push(`${key}: missing (expected ${expected})`);
      continue;
    }

    // Handle comparison operators
    if (typeof expected === 'string') {
      if (expected.startsWith('>=')) {
        const threshold = parseValue(expected.slice(2));
        const actualValue = parseValue(actual);
        if (actualValue < threshold) {
          failedConditions.push(`${key}: ${actual} < ${threshold}`);
        }
      } else if (expected.startsWith('<=')) {
        const threshold = parseValue(expected.slice(2));
        const actualValue = parseValue(actual);
        if (actualValue > threshold) {
          failedConditions.push(`${key}: ${actual} > ${threshold}`);
        }
      } else if (expected.startsWith('>')) {
        const threshold = parseValue(expected.slice(1));
        const actualValue = parseValue(actual);
        if (actualValue <= threshold) {
          failedConditions.push(`${key}: ${actual} <= ${threshold}`);
        }
      } else if (expected.startsWith('<')) {
        const threshold = parseValue(expected.slice(1));
        const actualValue = parseValue(actual);
        if (actualValue >= threshold) {
          failedConditions.push(`${key}: ${actual} >= ${threshold}`);
        }
      } else if (actual !== expected) {
        failedConditions.push(`${key}: ${actual} !== ${expected}`);
      }
    } else if (actual !== expected) {
      failedConditions.push(`${key}: ${actual} !== ${expected}`);
    }
  }

  return {
    allPassed: failedConditions.length === 0,
    failedConditions
  };
}

/**
 * Parse a value, handling percentages and numbers
 * @param {any} value - Value to parse
 * @returns {number} Parsed numeric value
 */
function parseValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.endsWith('%')) {
      return parseFloat(value.slice(0, -1));
    }
    return parseFloat(value) || 0;
  }
  return 0;
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot-notation path
 * @returns {any} Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => 
    current && current[key] !== undefined ? current[key] : undefined, obj);
}

/**
 * Validate skill usage for an agent
 *
 * @param {string} agentType - Agent type (e.g., 'developer', 'architect')
 * @param {string} taskDescription - Task description
 * @param {string} executionLog - Execution log text
 * @returns {Promise<Object>} Validation result
 */
export async function validateSkillUsage(agentType, taskDescription = '', executionLog = '') {
  const result = {
    valid: false,
    complianceScore: 0,
    violations: {
      missingRequired: [],
      missingTriggered: []
    },
    warnings: {
      missingRecommended: []
    },
    expected: [],
    used: [],
    feedback: [],
    details: {}
  };

  try {
    // Import skill validator dynamically
    const { validateSkillUsage: validate } = await import('./skill-validator.mjs');

    // Run validation
    const validationResult = await validate(agentType, taskDescription, executionLog);

    // Map to enforcement gate result format
    result.valid = validationResult.compliant;
    result.complianceScore = validationResult.complianceScore;
    result.violations.missingRequired = validationResult.violations.missingRequired || [];
    result.violations.missingTriggered = validationResult.violations.missingTriggered || [];
    result.expected = validationResult.expected || [];
    result.used = validationResult.used || [];
    result.details = validationResult.details || {};

    // Generate feedback
    if (!result.valid) {
      result.feedback.push(`Skill compliance failed: ${result.complianceScore}% (required skills missing)`);
      result.violations.missingRequired.forEach(skill => {
        result.feedback.push(`  - Missing required skill: ${skill}`);
      });
    }

    if (result.violations.missingTriggered.length > 0) {
      result.feedback.push(`Triggered skills not used:`);
      result.violations.missingTriggered.forEach(skill => {
        result.feedback.push(`  - ${skill} (triggered by task description)`);
      });
    }

    if (result.valid && result.violations.missingTriggered.length === 0) {
      result.feedback.push(`Skill compliance passed: ${result.complianceScore}%`);
    }

    return result;

  } catch (error) {
    result.feedback.push(`Error validating skill usage: ${error.message}`);
    return result;
  }
}

/**
 * Enforce security trigger requirements
 *
 * @param {string} taskDescription - Task description to analyze
 * @param {string[]} assignedAgents - Currently assigned agents
 * @returns {Promise<Object>} Enforcement result
 */
export async function enforceSecurityTriggers(taskDescription, assignedAgents = []) {
  const result = {
    blocked: false,
    triggeredCategories: [],
    requiredAgents: [],
    missingAgents: [],
    recommendedAgents: [],
    highestPriority: null,
    escalation: null,
    feedback: [],
    details: {}
  };

  try {
    // Load security triggers
    const securityTriggers = await loadJson(SECURITY_TRIGGERS_PATH);
    
    if (!securityTriggers) {
      result.feedback.push('Security triggers configuration not found');
      return result;
    }

    const taskLower = taskDescription.toLowerCase();
    const assignedLower = assignedAgents.map(a => a.toLowerCase());

    // Check each category for keyword matches
    for (const [categoryName, category] of Object.entries(securityTriggers.categories)) {
      const matchedKeywords = category.keywords.filter(keyword => 
        taskLower.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        result.triggeredCategories.push({
          category: categoryName,
          priority: category.priority,
          matchedKeywords,
          description: category.description,
          requiredAgents: category.required_agents,
          recommendedAgents: category.recommended_agents
        });

        // Collect required agents
        for (const agent of category.required_agents || []) {
          if (!result.requiredAgents.includes(agent)) {
            result.requiredAgents.push(agent);
          }
          if (!assignedLower.includes(agent.toLowerCase())) {
            if (!result.missingAgents.includes(agent)) {
              result.missingAgents.push(agent);
            }
          }
        }

        // Collect recommended agents
        for (const agent of category.recommended_agents || []) {
          if (!result.recommendedAgents.includes(agent)) {
            result.recommendedAgents.push(agent);
          }
        }

        // Track highest priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (!result.highestPriority || 
            priorityOrder[category.priority] < priorityOrder[result.highestPriority]) {
          result.highestPriority = category.priority;
        }
      }
    }

    // Check combination rules for priority escalation
    if (securityTriggers.combinationRules?.critical_combinations) {
      const triggeredCategoryNames = result.triggeredCategories.map(t => t.category);
      
      for (const combo of securityTriggers.combinationRules.critical_combinations) {
        const allPresent = combo.categories.every(cat => 
          triggeredCategoryNames.includes(cat)
        );
        
        if (allPresent) {
          result.highestPriority = combo.priority_override;
          result.details.combinationTriggered = combo;
          result.feedback.push(`Critical combination triggered: ${combo.description}`);
        }
      }
    }

    // Get escalation rules based on priority
    if (result.highestPriority && securityTriggers.escalationRules) {
      result.escalation = securityTriggers.escalationRules[result.highestPriority];
    }

    // Determine if execution should be blocked
    if (result.missingAgents.length > 0) {
      const shouldBlock = result.escalation?.blocking === true;
      
      if (shouldBlock) {
        result.blocked = true;
        result.feedback.push(`BLOCKED: Security-sensitive task requires missing agent(s): ${result.missingAgents.join(', ')}`);
        result.feedback.push(`Priority: ${result.highestPriority?.toUpperCase()}`);
        result.feedback.push(`Triggered categories: ${result.triggeredCategories.map(t => t.category).join(', ')}`);
      } else {
        result.feedback.push(`WARNING: Recommended agents missing: ${result.missingAgents.join(', ')}`);
      }
    }

    if (result.triggeredCategories.length === 0) {
      result.feedback.push('No security triggers matched');
    } else if (!result.blocked) {
      result.feedback.push(`Security check passed - ${result.triggeredCategories.length} category(ies) triggered, all required agents assigned`);
    }

    return result;

  } catch (error) {
    result.feedback.push(`Error enforcing security triggers: ${error.message}`);
    return result;
  }
}

/**
 * Master gate function - combines all validations
 * 
 * @param {Object} params - Validation parameters
 * @param {string} params.runId - Run identifier
 * @param {string} params.workflowName - Workflow name
 * @param {number} params.stepNumber - Step number
 * @param {string} params.planId - Plan identifier
 * @param {string} params.taskDescription - Task description
 * @param {string[]} params.assignedAgents - Assigned agents
 * @param {Object} params.options - Additional options
 * @returns {Promise<Object>} Comprehensive gate result
 */
export async function validateExecutionGate(params) {
  const {
    runId,
    workflowName,
    stepNumber,
    planId = 'plan',
    taskDescription = '',
    assignedAgents = [],
    options = {}
  } = params;

  const gateResult = {
    allowed: false,
    timestamp: new Date().toISOString(),
    runId,
    workflowName,
    stepNumber,
    validations: {
      planRating: null,
      signoffs: null,
      security: null,
      skills: null
    },
    blockers: [],
    warnings: [],
    summary: ''
  };

  try {
    // 1. Validate plan rating (if runId provided)
    if (runId) {
      gateResult.validations.planRating = await validatePlanRating(runId, planId, {
        taskType: options.taskType,
        complexity: options.complexity
      });
      
      if (!gateResult.validations.planRating.valid) {
        gateResult.blockers.push({
          type: 'plan_rating',
          message: gateResult.validations.planRating.feedback.join('; '),
          score: gateResult.validations.planRating.score,
          minimumRequired: gateResult.validations.planRating.minimumRequired
        });
      }
    }

    // 2. Validate signoffs (if workflow and step provided)
    if (runId && workflowName && stepNumber !== undefined) {
      gateResult.validations.signoffs = await validateSignoffs(runId, workflowName, stepNumber, {
        taskDescription
      });
      
      if (!gateResult.validations.signoffs.valid) {
        gateResult.blockers.push({
          type: 'signoffs',
          message: gateResult.validations.signoffs.feedback.join('; '),
          missing: gateResult.validations.signoffs.missing
        });
      }
    }

    // 3. Validate security triggers (if task description provided)
    if (taskDescription) {
      gateResult.validations.security = await enforceSecurityTriggers(taskDescription, assignedAgents);

      if (gateResult.validations.security.blocked) {
        gateResult.blockers.push({
          type: 'security',
          message: gateResult.validations.security.feedback.join('; '),
          missingAgents: gateResult.validations.security.missingAgents,
          priority: gateResult.validations.security.highestPriority
        });
      } else if (gateResult.validations.security.missingAgents.length > 0) {
        gateResult.warnings.push({
          type: 'security',
          message: `Recommended security agents not assigned: ${gateResult.validations.security.missingAgents.join(', ')}`
        });
      }
    }

    // 4. Validate skill usage (if agent type and execution log provided)
    if (options.agentType && options.executionLog) {
      gateResult.validations.skills = await validateSkillUsage(
        options.agentType,
        taskDescription,
        options.executionLog
      );

      if (!gateResult.validations.skills.valid) {
        gateResult.blockers.push({
          type: 'skills',
          message: gateResult.validations.skills.feedback.join('; '),
          missingSkills: gateResult.validations.skills.violations.missingRequired,
          complianceScore: gateResult.validations.skills.complianceScore
        });
      } else if (gateResult.validations.skills.violations.missingTriggered.length > 0) {
        gateResult.warnings.push({
          type: 'skills',
          message: `Triggered skills not used: ${gateResult.validations.skills.violations.missingTriggered.join(', ')}`
        });
      }
    }

    // Determine overall gate status
    gateResult.allowed = gateResult.blockers.length === 0;
    
    // Generate summary
    if (gateResult.allowed) {
      gateResult.summary = 'All execution gates passed - workflow may proceed';
      if (gateResult.warnings.length > 0) {
        gateResult.summary += ` (${gateResult.warnings.length} warning(s))`;
      }
    } else {
      gateResult.summary = `BLOCKED: ${gateResult.blockers.length} gate(s) failed - ${gateResult.blockers.map(b => b.type).join(', ')}`;
    }

    // Write gate result to file if runId provided
    if (runId && stepNumber !== undefined) {
      const gateFilePath = getGateFilePath(runId, stepNumber);
      const gatesDir = dirname(gateFilePath);
      
      if (!existsSync(gatesDir)) {
        await mkdir(gatesDir, { recursive: true });
      }
      
      await writeFile(gateFilePath, JSON.stringify(gateResult, null, 2), 'utf-8');
    }

    return gateResult;

  } catch (error) {
    gateResult.blockers.push({
      type: 'system_error',
      message: `Gate validation failed: ${error.message}`
    });
    gateResult.summary = `BLOCKED: System error during gate validation`;
    return gateResult;
  }
}

/**
 * Record a plan rating (used by response-rater skill)
 *
 * @param {string} runId - Run identifier
 * @param {string} planId - Plan identifier
 * @param {Object} rating - Rating data
 * @returns {Promise<void>}
 */
export async function recordPlanRating(runId, planId, rating) {
  const ratingPath = getPlanRatingPath(runId, planId);
  const plansDir = dirname(ratingPath);

  if (!existsSync(plansDir)) {
    await mkdir(plansDir, { recursive: true });
  }

  const ratingRecord = {
    ...rating,
    plan_id: planId,
    run_id: runId,
    rated_at: new Date().toISOString(),
    rated_by: rating.rated_by || 'response-rater'
  };

  await writeFile(ratingPath, JSON.stringify(ratingRecord, null, 2), 'utf-8');
}

/**
 * Validate file location to prevent SLOP (files in wrong locations)
 *
 * @param {string} filePath - Path to validate
 * @param {string} [fileType] - Optional file type for stricter validation
 * @param {string} [projectRoot] - Project root directory (defaults to CWD)
 * @returns {Promise<Object>} Validation result with allowed, blockers, warnings
 */
export async function validateFileLocation(filePath, fileType = null, projectRoot = null) {
  const result = {
    allowed: false,
    blockers: [],
    warnings: [],
    suggestedPath: null
  };

  try {
    // Use provided projectRoot or default to CWD
    const effectiveRoot = projectRoot || process.cwd();

    // Load schema for authoritative constants
    const schemaPath = join(__dirname, '..', 'schemas', 'file-location.schema.json');
    const schema = await loadJson(schemaPath);

    if (!schema) {
      result.warnings.push('File location schema not found - using fallback validation');
    }

    // Extract constants from schema (single source of truth)
    const allowedRootFiles = schema?.definitions?.root_allowlist?.default || [
      'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
      'README.md', 'GETTING_STARTED.md', 'LICENSE', '.gitignore',
      '.npmrc', '.nvmrc', '.editorconfig', 'tsconfig.json',
      'eslint.config.js', '.eslintrc.json', 'prettier.config.js', '.prettierrc',
      'CHANGELOG.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md'
    ];

    const prohibitedDirs = schema?.definitions?.prohibited_locations?.default || [
      'node_modules/', '.git/', 'dist/', 'build/', 'out/',
      '.next/', '.nuxt/', 'coverage/'
    ];

    const malformedPatterns = schema?.definitions?.malformed_path_patterns?.default || [
      { pattern: '^C:[a-zA-Z]', description: 'Windows path missing separator after drive letter' },
      { pattern: '^[A-Z]:[A-Z]:', description: 'Duplicate drive letters' },
      { pattern: '[a-z]{4,}[A-Z][a-z].*[a-z]{4,}[A-Z]', description: 'Path segments concatenated without separators' },
      { pattern: '^[^/\\\\]+[a-z]{3,}\\.claude', description: 'Path to .claude without separator' }
    ];

    // Normalize path for comparison
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedRoot = effectiveRoot.replace(/\\/g, '/');
    const basename = normalizedPath.split('/').pop();

    // Rule 1: Check for malformed paths
    for (const { pattern, description } of malformedPatterns) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        result.blockers.push(`Malformed path: ${description}`);
      }
    }

    // Rule 2: Check for prohibited directories
    for (const dir of prohibitedDirs) {
      const dirNormalized = dir.replace(/\/$/, '');
      if (normalizedPath.includes(`/${dirNormalized}/`) ||
          normalizedPath.startsWith(`${dirNormalized}/`)) {
        result.blockers.push(`Cannot write to prohibited directory: ${dir}`);
      }
    }

    // Rule 3: Check root directory writes (FIXED LOGIC)
    // A file is in root if its directory equals the project root
    const absolutePath = filePath.startsWith('/') || /^[A-Z]:/i.test(filePath)
      ? normalizedPath
      : join(normalizedRoot, normalizedPath).replace(/\\/g, '/');

    const fileDir = absolutePath.substring(0, absolutePath.lastIndexOf('/'));
    const isInProjectRoot = fileDir === normalizedRoot ||
                            fileDir === normalizedRoot.replace(/\/$/, '');

    if (isInProjectRoot && !allowedRootFiles.includes(basename)) {
      result.blockers.push(`File "${basename}" not allowed in project root. Use .claude/ hierarchy.`);

      // Suggest correct path based on file type
      if (basename.match(/-report\.(md|json)$/)) {
        result.suggestedPath = `.claude/context/reports/${basename}`;
      } else if (basename.match(/-task\.(md|json)$/)) {
        result.suggestedPath = `.claude/context/tasks/${basename}`;
      } else if (basename.match(/^plan-.*\.(md|json)$/)) {
        result.suggestedPath = `.claude/context/artifacts/${basename}`;
      } else if (basename.match(/^tmp-/)) {
        result.suggestedPath = `.claude/context/tmp/${basename}`;
      }
    }

    // Rule 4: Check file type locations
    const fileTypeRules = schema?.definitions?.file_location_rules?.properties || {};

    if (fileType && fileTypeRules[fileType]) {
      const rule = fileTypeRules[fileType].properties;
      const requiredPath = rule.required_path?.const;
      const requiredPaths = rule.required_paths?.default;
      const patterns = rule.patterns?.default || [];

      if (requiredPath && !normalizedPath.includes(requiredPath)) {
        result.blockers.push(`${fileType} files must be in ${requiredPath}`);
        result.suggestedPath = `${requiredPath}${basename}`;
      } else if (requiredPaths) {
        const matchesAnyPath = requiredPaths.some(path =>
          normalizedPath.includes(path.replace('{run_id}', ''))
        );
        if (!matchesAnyPath) {
          result.blockers.push(`${fileType} files must be in one of: ${requiredPaths.join(', ')}`);
        }
      }

      // Check pattern match if specified
      if (patterns.length > 0) {
        const matchesPattern = patterns.some(pattern => {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(basename);
        });
        if (!matchesPattern) {
          result.warnings.push(`${fileType} filename should match pattern: ${patterns.join(', ')}`);
        }
      }
    }

    // Auto-detect file type from patterns if not specified
    if (!fileType) {
      if (basename.match(/-report\.(md|json)$/)) {
        if (!normalizedPath.includes('.claude/context/reports/') &&
            !normalizedPath.includes('.claude/context/artifacts/')) {
          result.blockers.push('Report files must be in .claude/context/reports/ or .claude/context/artifacts/');
          result.suggestedPath = `.claude/context/reports/${basename}`;
        }
      } else if (basename.match(/-task\.(md|json)$/)) {
        if (!normalizedPath.includes('.claude/context/tasks/')) {
          result.blockers.push('Task files must be in .claude/context/tasks/');
          result.suggestedPath = `.claude/context/tasks/${basename}`;
        }
      } else if (basename.match(/^tmp-/)) {
        if (!normalizedPath.includes('.claude/context/tmp/')) {
          result.warnings.push('Temporary files should be in .claude/context/tmp/');
        }
      }
    }

    // Determine final result
    result.allowed = result.blockers.length === 0;

    return result;

  } catch (error) {
    result.blockers.push(`Error validating file location: ${error.message}`);
    return result;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  function getArg(name) {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
  }

  try {
    if (command === 'validate-plan') {
      const runId = getArg('run-id');
      const planId = getArg('plan-id') || 'plan';
      const taskType = getArg('task-type');
      const complexity = getArg('complexity');

      if (!runId) {
        console.error('Usage: node enforcement-gate.mjs validate-plan --run-id <id> [--plan-id <id>] [--task-type <type>] [--complexity <level>]');
        process.exit(1);
      }

      const result = await validatePlanRating(runId, planId, { taskType, complexity });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);

    } else if (command === 'validate-signoffs') {
      const runId = getArg('run-id');
      const workflow = getArg('workflow');
      const step = parseInt(getArg('step'), 10);
      const task = getArg('task');

      if (!runId || !workflow || isNaN(step)) {
        console.error('Usage: node enforcement-gate.mjs validate-signoffs --run-id <id> --workflow <name> --step <n> [--task "<description>"]');
        process.exit(1);
      }

      const result = await validateSignoffs(runId, workflow, step, { taskDescription: task });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);

    } else if (command === 'validate-security') {
      const task = getArg('task');
      const agents = getArg('agents')?.split(',').map(a => a.trim()) || [];

      if (!task) {
        console.error('Usage: node enforcement-gate.mjs validate-security --task "<description>" [--agents <agent1,agent2>]');
        process.exit(1);
      }

      const result = await enforceSecurityTriggers(task, agents);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.blocked ? 1 : 0);

    } else if (command === 'validate-skills') {
      const agentType = getArg('agent');
      const task = getArg('task') || '';
      const logFile = getArg('log');

      if (!agentType) {
        console.error('Usage: node enforcement-gate.mjs validate-skills --agent <type> [--task "<description>"] [--log <file>]');
        console.error('Note: Execution log can be provided via --log file or piped to stdin');
        process.exit(1);
      }

      // Read execution log from file or stdin
      let executionLog = '';
      if (logFile) {
        executionLog = await readFile(logFile, 'utf-8');
      } else if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        executionLog = Buffer.concat(chunks).toString('utf-8');
      }

      const result = await validateSkillUsage(agentType, task, executionLog);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.valid ? 0 : 1);

    } else if (command === 'validate-all') {
      const runId = getArg('run-id');
      const workflow = getArg('workflow');
      const step = getArg('step') ? parseInt(getArg('step'), 10) : undefined;
      const planId = getArg('plan-id') || 'plan';
      const task = getArg('task') || '';
      const agents = getArg('agents')?.split(',').map(a => a.trim()) || [];
      const taskType = getArg('task-type');
      const complexity = getArg('complexity');
      const agentType = getArg('agent');
      const logFile = getArg('log');

      // Read execution log if provided
      let executionLog = '';
      if (logFile) {
        executionLog = await readFile(logFile, 'utf-8');
      } else if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        executionLog = Buffer.concat(chunks).toString('utf-8');
      }

      const result = await validateExecutionGate({
        runId,
        workflowName: workflow,
        stepNumber: step,
        planId,
        taskDescription: task,
        assignedAgents: agents,
        options: {
          taskType,
          complexity,
          agentType,
          executionLog
        }
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.allowed ? 0 : 1);

    } else if (command === 'record-rating') {
      const runId = getArg('run-id');
      const planId = getArg('plan-id') || 'plan';
      const score = parseFloat(getArg('score'));
      const feedback = getArg('feedback');

      if (!runId || isNaN(score)) {
        console.error('Usage: node enforcement-gate.mjs record-rating --run-id <id> --score <n> [--plan-id <id>] [--feedback "<text>"]');
        process.exit(1);
      }

      await recordPlanRating(runId, planId, {
        score,
        feedback: feedback ? [feedback] : []
      });
      console.log(JSON.stringify({ success: true, runId, planId, score }));

    } else if (command === 'validate-file-location') {
      const path = getArg('path');
      const type = getArg('type');
      const projectRoot = getArg('project-root');

      if (!path) {
        console.error('Usage: node enforcement-gate.mjs validate-file-location --path "<path>" [--type <file_type>] [--project-root <root>]');
        process.exit(1);
      }

      const result = await validateFileLocation(path, type, projectRoot);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.allowed ? 0 : 1);

    } else {
      console.error('Available commands:');
      console.error('  validate-plan          - Validate plan rating');
      console.error('  validate-signoffs      - Validate signoff requirements');
      console.error('  validate-security      - Validate security trigger requirements');
      console.error('  validate-skills        - Validate skill usage compliance');
      console.error('  validate-all           - Run all validations');
      console.error('  validate-file-location - Validate file location (prevent SLOP)');
      console.error('  record-rating          - Record a plan rating');
      console.error('');
      console.error('Examples:');
      console.error('  # Validate skill usage from log file');
      console.error('  node enforcement-gate.mjs validate-skills --agent developer --task "Create component" --log ./execution.log');
      console.error('');
      console.error('  # Validate skill usage from stdin');
      console.error('  echo "Used Skill: scaffolder" | node enforcement-gate.mjs validate-skills --agent developer --task "Create"');
      console.error('');
      console.error('  # Validate all gates including skills');
      console.error('  node enforcement-gate.mjs validate-all --run-id abc123 --workflow fullstack --step 6 --agent developer --log ./step-6.log');
      console.error('');
      console.error('  # Validate file location');
      console.error('  node enforcement-gate.mjs validate-file-location --path ".claude/context/reports/audit.md"');
      console.error('  node enforcement-gate.mjs validate-file-location --path "report.md" --type report');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default {
  validatePlanRating,
  validateSignoffs,
  enforceSecurityTriggers,
  validateSkillUsage,
  validateExecutionGate,
  recordPlanRating,
  validateFileLocation
};
