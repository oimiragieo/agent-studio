#!/usr/bin/env node
/**
 * Template Registry
 * Maps agents to their required template files for validation
 */

// Agent to template file mapping
export const AGENT_TEMPLATE_MAP = {
  planner: ['.claude/templates/plan-template.md'],
  analyst: ['.claude/templates/project-brief.md'],
  pm: [
    '.claude/templates/prd.md',
    '.claude/templates/brownfield-prd.md',
    '.claude/templates/feature-specification.md',
  ],
  'ux-expert': ['.claude/templates/ui-spec.md', '.claude/templates/project-constitution.md'],
  architect: ['.claude/templates/architecture.md', '.claude/templates/project-constitution.md'],
  developer: [
    '.claude/templates/implementation-plan.md',
    '.claude/templates/project-constitution.md',
    '.claude/templates/claude-md-template.md',
    '.claude/templates/browser-test-report.md',
  ],
  'code-reviewer': ['.claude/templates/code-review-report.md'],
  'technical-writer': ['.claude/templates/claude-md-template.md'],
  qa: ['.claude/templates/test-plan.md', '.claude/templates/browser-test-report.md'],
  'refactoring-specialist': ['.claude/templates/refactor-plan.md'],
  'compliance-auditor': ['.claude/templates/compliance-report.md'],
  devops: ['.claude/templates/infrastructure-config.md'],
  'cloud-integrator': [
    // Cloud integration uses implementation patterns, no specific template required
  ],
  router: [
    // Router uses route_decision.schema.json, no template required
  ],
};

// Optional templates (prompt templates)
export const OPTIONAL_TEMPLATE_MAP = {
  planner: [
    '.claude/templates/prompts/codebase-walkthrough.md',
    '.claude/templates/prompts/deep-dive.md',
  ],
  'code-reviewer': [
    '.claude/templates/prompts/senior-review.md',
    '.claude/templates/prompts/deep-dive.md',
  ],
  'ux-expert': ['.claude/templates/prompts/ui-perfection-loop.md'],
  orchestrator: [
    '.claude/templates/prompts/codebase-walkthrough.md',
    '.claude/templates/prompts/deep-dive.md',
    '.claude/templates/prompts/senior-review.md',
    '.claude/templates/prompts/ui-perfection-loop.md',
  ],
  router: [
    // Router uses semantic analysis, no prompt templates
  ],
  'cloud-integrator': [
    // Cloud integrator follows implementation patterns
  ],
};

/**
 * Get required templates for an agent
 */
export function getRequiredTemplates(agentName) {
  return AGENT_TEMPLATE_MAP[agentName] || [];
}

/**
 * Get optional templates for an agent
 */
export function getOptionalTemplates(agentName) {
  return OPTIONAL_TEMPLATE_MAP[agentName] || [];
}

/**
 * Get all templates for an agent (required + optional)
 */
export function getAllTemplates(agentName) {
  return [...getRequiredTemplates(agentName), ...getOptionalTemplates(agentName)];
}

export default {
  AGENT_TEMPLATE_MAP,
  OPTIONAL_TEMPLATE_MAP,
  getRequiredTemplates,
  getOptionalTemplates,
  getAllTemplates,
};
