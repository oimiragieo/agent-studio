#!/usr/bin/env node
/**
 * Decision Handler - Workflow Decision Point Management
 * Evaluates workflow decisions and routes workflow based on conditions
 * Based on BMad Method Standard Greenfield workflow decision points
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Load artifact from file
 */
async function loadArtifact(artifactPath) {
  try {
    const content = await readFile(artifactPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[DecisionHandler] Error loading artifact ${artifactPath}:`, error.message);
    return null;
  }
}

/**
 * Evaluate a decision point
 */
export async function evaluateDecision(decisionId, context = {}) {
  const {
    decision_type,
    condition,
    input_artifacts = {},
    user_prompt = null,
    config = {}
  } = context;

  switch (decision_type) {
    case 'include_discovery':
      return await evaluateIncludeDiscovery(input_artifacts, user_prompt, config);
    
    case 'has_ui':
      return await evaluateHasUI(input_artifacts, user_prompt, config);
    
    case 'code_review_pass':
      return await evaluateCodeReviewPass(input_artifacts, user_prompt, config);
    
    case 'more_stories':
      return await evaluateMoreStories(input_artifacts, user_prompt, config);
    
    case 'more_epics':
      return await evaluateMoreEpics(input_artifacts, user_prompt, config);
    
    default:
      throw new Error(`Unknown decision type: ${decision_type}`);
  }
}

/**
 * Evaluate "Include Discovery?" decision
 */
async function evaluateIncludeDiscovery(inputArtifacts, userPrompt, config) {
  // Check if discovery was explicitly requested
  if (userPrompt && /discovery|research|analyze|brief/i.test(userPrompt)) {
    return { result: true, reason: 'Discovery explicitly requested in user prompt' };
  }
  
  // Check config
  if (config.include_discovery !== undefined) {
    return { result: config.include_discovery, reason: 'Set in configuration' };
  }
  
  // Default: include discovery for new projects
  return { result: true, reason: 'Default: Discovery included for new projects' };
}

/**
 * Evaluate "Has UI?" decision
 */
async function evaluateHasUI(inputArtifacts, userPrompt, config) {
  // Check PRD if available
  if (inputArtifacts.prd) {
    const prd = await loadArtifact(inputArtifacts.prd);
    if (prd && prd.features) {
      const hasUI = prd.features.some(f => 
        f.type === 'ui' || f.type === 'frontend' || f.requires_ui === true
      );
      if (hasUI !== undefined) {
        return { result: hasUI, reason: 'Determined from PRD features' };
      }
    }
  }
  
  // Check user prompt
  if (userPrompt && /ui|interface|frontend|web|mobile|app|dashboard/i.test(userPrompt)) {
    return { result: true, reason: 'UI mentioned in user prompt' };
  }
  
  // Check config
  if (config.has_ui !== undefined) {
    return { result: config.has_ui, reason: 'Set in configuration' };
  }
  
  // Default: assume UI for full-stack projects
  return { result: true, reason: 'Default: UI assumed for full-stack projects' };
}

/**
 * Evaluate "Code Review Pass?" decision
 */
async function evaluateCodeReviewPass(inputArtifacts, userPrompt, config) {
  // Check code review artifact
  if (inputArtifacts.code_review) {
    const review = await loadArtifact(inputArtifacts.code_review);
    if (review && review.status) {
      const passed = review.status === 'approved' || review.status === 'pass';
      return { 
        result: passed, 
        reason: `Code review status: ${review.status}`,
        details: review.issues || []
      };
    }
  }
  
  // Check user confirmation if available
  if (userPrompt && /approve|pass|ok|yes/i.test(userPrompt)) {
    return { result: true, reason: 'User confirmed code review pass' };
  }
  
  if (userPrompt && /reject|fail|no|fix/i.test(userPrompt)) {
    return { result: false, reason: 'User indicated code review failure' };
  }
  
  // Default: require explicit approval
  return { result: false, reason: 'Default: Code review requires explicit approval' };
}

/**
 * Evaluate "More Stories in Epic?" decision
 */
async function evaluateMoreStories(inputArtifacts, userPrompt, config) {
  // Check epic/story context
  if (inputArtifacts.epics_stories) {
    const epicsStories = await loadArtifact(inputArtifacts.epics_stories);
    const currentEpic = inputArtifacts.current_epic || 0;
    const currentStory = inputArtifacts.current_story || 0;
    
    if (epicsStories && epicsStories.epics && epicsStories.epics[currentEpic]) {
      const epic = epicsStories.epics[currentEpic];
      const totalStories = epic.stories?.length || 0;
      const hasMore = currentStory < totalStories - 1;
      return { 
        result: hasMore, 
        reason: `Story ${currentStory + 1} of ${totalStories} in epic ${currentEpic + 1}` 
      };
    }
  }
  
  // Check config
  if (config.more_stories !== undefined) {
    return { result: config.more_stories, reason: 'Set in configuration' };
  }
  
  return { result: false, reason: 'No more stories detected' };
}

/**
 * Evaluate "More Epics?" decision
 */
async function evaluateMoreEpics(inputArtifacts, userPrompt, config) {
  // Check epics/stories artifact
  if (inputArtifacts.epics_stories) {
    const epicsStories = await loadArtifact(inputArtifacts.epics_stories);
    const currentEpic = inputArtifacts.current_epic || 0;
    
    if (epicsStories && epicsStories.epics) {
      const totalEpics = epicsStories.epics.length;
      const hasMore = currentEpic < totalEpics - 1;
      return { 
        result: hasMore, 
        reason: `Epic ${currentEpic + 1} of ${totalEpics}` 
      };
    }
  }
  
  // Check config
  if (config.more_epics !== undefined) {
    return { result: config.more_epics, reason: 'Set in configuration' };
  }
  
  return { result: false, reason: 'No more epics detected' };
}

/**
 * Request user confirmation for ambiguous decisions
 */
export async function requestUserConfirmation(decisionId, question, context = {}) {
  // In production, this would prompt the user
  // For now, return based on context or default
  return {
    confirmed: context.auto_confirm || false,
    reason: context.auto_confirm ? 'Auto-confirmed' : 'Requires user input'
  };
}

export default {
  evaluateDecision,
  requestUserConfirmation
};

