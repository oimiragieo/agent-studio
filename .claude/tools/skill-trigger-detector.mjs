#!/usr/bin/env node

/**
 * Skill Trigger Detector
 *
 * Matches task descriptions against skill triggers from skill-integration-matrix.json
 * to determine which skills should be activated for a given agent and task.
 *
 * Usage:
 *   node .claude/tools/skill-trigger-detector.mjs --agent developer --task "Create new UserProfile component"
 *   node .claude/tools/skill-trigger-detector.mjs --agent code-reviewer --task "Review security changes in auth module"
 *
 * Outputs:
 *   {
 *     "required": ["scaffolder", "rule-auditor", "repo-rag"],
 *     "triggered": ["scaffolder"],
 *     "recommended": ["test-generator"],
 *     "all": ["scaffolder", "rule-auditor", "repo-rag"],
 *     "matchedTriggers": ["new_component"]
 *   }
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveConfigPath } from './context-path-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Comprehensive trigger patterns based on skill-integration-matrix.json
const TRIGGER_PATTERNS = {
  // Component/feature creation
  new_component:
    /\b(new|create|add|implement|build|scaffold|generate)\b.*\b(component|module|feature|widget|screen|page|view)\b/i,

  // Module/folder creation
  new_module:
    /\b(new|create|add|initialize)\b.*\b(module|folder|directory|package|namespace|subdirectory)\b/i,

  // Code modification
  code_changes:
    /\b(modify|update|change|edit|refactor|alter|fix|improve)\b.*\b(code|file|function|class|method|logic)\b/i,

  // Code review
  review_code:
    /\b(review|analyze|inspect|examine|check|validate)\b.*\b(code|changes|pr|pull\s+request|commit|diff)\b/i,
  code_review:
    /\b(review|analyze|inspect|examine|check|validate)\b.*\b(code|changes|pr|pull\s+request|commit|diff)\b/i,

  // Codebase search
  codebase_search:
    /\b(find|search|locate|discover|look\s+for|query)\b.*\b(pattern|example|usage|implementation|reference)\b/i,
  pattern_search:
    /\b(find|search|locate|discover)\b.*\b(pattern|example|usage|implementation|best\s+practice)\b/i,
  codebase_analysis:
    /\b(analyze|examine|explore|investigate)\b.*\b(codebase|repository|project|source)\b/i,

  // Test operations
  test_creation: /\b(write|create|generate|add|implement)\b.*(test|spec|unit|integration|e2e)/i,

  // Style and formatting
  style_review:
    /\b(check|validate|review|enforce)\b.*\b(style|format|formatting|code\s+style|conventions)\b/i,
  style_check: /\b(check|validate|lint|format)\b.*\b(style|code|formatting)\b/i,
  style_validation: /\b(validate|check|enforce)\b.*\b(style|formatting|conventions)\b/i,

  // Rule compliance
  rule_explanation:
    /\b(explain|clarify|understand|describe)\b.*\b(rule|violation|standard|guideline)\b/i,
  rule_compliance: /\b(check|validate|ensure|enforce)\b.*\b(compliance|rule|standard|guideline)\b/i,
  violation_fix: /\b(fix|resolve|correct|address)\b.*\b(violation|issue|error|warning)\b/i,
  violation_fixes: /\b(fix|resolve|correct|address)\b.*\b(violations|issues|errors|warnings)\b/i,
  simplification_fixes: /\b(simplify|reduce|optimize)\b.*\b(complexity|code|logic)\b/i,

  // Quality checks
  quality_check:
    /\b(check|validate|verify|ensure|assess)\b.*\b(quality|standard|compliance|correctness)\b/i,

  // Architecture and diagrams
  architecture_diagram:
    /(\b(diagram|visualize|draw|sketch|illustrate)\b.*\b(architecture|system|design|structure)\b|\b(design|architect)\b.*\b(diagram)\b|\b(architecture)\b.*\b(diagram)\b)/i,
  plan_diagram: /\b(diagram|visualize|chart)\b.*\b(plan|roadmap|timeline)\b/i,
  schema_diagram: /\b(diagram|visualize|erd|model)\b.*\b(schema|database|data\s+model|entity)\b/i,
  api_diagram: /\b(diagram|visualize|map)\b.*\b(api|endpoint|interface|contract)\b/i,
  user_flow_diagram:
    /\b(diagram|visualize|map)\b.*\b(user\s+flow|user\s+journey|flow|interaction)\b/i,
  performance_diagram: /\b(diagram|visualize|chart)\b.*\b(performance|metrics|benchmark)\b/i,
  refactor_diagram: /\b(diagram|visualize)\b.*\b(refactor|transformation|migration)\b/i,
  migration_diagram: /\b(diagram|visualize|map)\b.*\b(migration|modernization|upgrade)\b/i,
  user_flow: /\b(user\s+flow|user\s+journey|interaction\s+flow|flow\s+diagram)\b/i,
  incident_diagram: /\b(diagram|visualize)\b.*\b(incident|root\s+cause|timeline)\b/i,
  complexity_diagram: /\b(diagram|visualize)\b.*\b(complexity|cyclomatic|dependencies)\b/i,

  // Documentation
  documentation: /\b(document|write\s+docs|create\s+documentation|readme|api\s+docs|guide)\b/i,
  component_docs: /\b(document)\b.*\b(component|module|widget|interface)\b/i,
  architecture_docs: /\b(document)\b.*\b(architecture|system|design)\b/i,
  api_documentation: /\b(api|endpoint)\b.*\b(docs|documentation|reference)\b/i,
  api_docs: /\b(api|rest|graphql)\b.*\b(docs|documentation|guide)\b/i,
  ux_documentation: /\b(ux|ui|design)\b.*\b(docs|documentation|guide)\b/i,
  database_docs: /\b(database|schema|data)\b.*\b(docs|documentation)\b/i,
  infrastructure_docs: /\b(infrastructure|deployment|devops)\b.*\b(docs|documentation)\b/i,
  security_docs: /\b(security|threat|compliance)\b.*\b(docs|documentation)\b/i,
  performance_docs: /\b(performance|optimization|profiling)\b.*\b(docs|documentation)\b/i,
  compliance_docs: /\b(compliance|audit|regulatory)\b.*\b(docs|documentation)\b/i,
  postmortem_docs: /\b(postmortem|incident\s+report|root\s+cause)\b.*\b(docs|documentation)\b/i,
  migration_docs: /\b(migration|modernization|upgrade)\b.*\b(docs|documentation|guide)\b/i,
  a11y_docs: /\b(accessibility|a11y|wcag)\b.*\b(docs|documentation)\b/i,
  module_docs: /\b(module)\b.*\b(docs|documentation|guide)\b/i,

  // Diagrams generation
  diagrams: /\b(diagram|chart|graph|visual|illustration)\b/i,

  // Summaries
  summaries: /\b(summarize|summary|synopsis|overview|brief)\b/i,
  data_summary: /\b(summarize|aggregate)\b.*\b(data|results|findings)\b/i,
  requirement_summary: /\b(summarize)\b.*\b(requirement|spec|feature)\b/i,
  ux_summary: /\b(summarize|overview)\b.*\b(ux|design|user\s+experience)\b/i,
  test_summary: /\b(summarize|report)\b.*\b(test|results|coverage)\b/i,

  // Performance
  performance_pattern_search:
    /\b(find|search|identify)\b.*\b(performance|optimization|bottleneck|slow)\b/i,
  optimization_analysis:
    /\b(analyze|profile|benchmark)\b.*\b(performance|optimization|speed|latency)\b/i,

  // Security
  security_audit:
    /\b(audit|review|assess|scan|perform)\b.*\b(security|vulnerability|threat|risk)\b/i,
  security_explanation: /\b(explain)\b.*\b(security|vulnerability|threat|risk)\b/i,
  vulnerability_scan: /\b(scan|check|detect)\b.*\b(vulnerability|cve|exploit|weakness)\b/i,
  threat_modeling: /\b(threat|attack|risk)\b.*\b(model|modeling|analysis|assessment)\b/i,
  a11y_audit: /\b(audit|check|validate)\b.*\b(accessibility|a11y|wcag|aria)\b/i,
  compliance_audit: /\b(audit|check|validate)\b.*\b(compliance|regulatory|gdpr|hipaa|soc2)\b/i,

  // Database operations
  query_generation: /\b(generate|create|write)\b.*\b(query|sql|select|insert|update)\b/i,
  orm_analysis: /\b(analyze|check|review)\b.*\b(orm|model|entity|migration)\b/i,
  database_query: /\b(query|sql|database)\b.*\b(generation|create|write)\b/i,

  // Planning
  plan_creation: /\b(plan|roadmap|strategy|approach|breakdown|scope)\b/i,
  requirement_planning: /\b(plan|scope|define)\b.*\b(requirement|feature|epic|story)\b/i,
  migration_planning: /\b(plan)\b.*\b(migration|modernization|upgrade)\b/i,

  // Analysis
  complex_analysis:
    /\b(analyze|deep\s+dive|investigate|research)\b.*\b(complex|detailed|comprehensive)\b/i,
  deep_analysis: /\b(deep|thorough|comprehensive)\b.*\b(analysis|investigation|research)\b/i,
  complex_decision: /\b(decide|choose|select)\b.*\b(complex|critical|architectural)\b/i,
  dependency_analysis: /\b(analyze|check|review)\b.*\b(dependency|dependencies|package|library)\b/i,
  legacy_analysis:
    /(\b(analyze|assess|evaluate)\b.*\b(legacy|old|outdated|deprecated)\b|\b(migrate|modernize)\b.*\b(legacy|old|codebase)\b)/i,
  incident_analysis: /\b(analyze|investigate|diagnose)\b.*\b(incident|outage|failure|error)\b/i,
  root_cause_analysis: /\b(root\s+cause|rca|postmortem)\b.*\b(analysis|investigation)\b/i,
  complexity_analysis: /\b(analyze|measure|assess)\b.*\b(complexity|cyclomatic|cognitive)\b/i,

  // Classification and categorization
  task_classification: /\b(classify|categorize|tag|label)\b.*\b(task|issue|ticket|work)\b/i,
  feature_classification: /\b(classify|categorize|prioritize)\b.*\b(feature|requirement|story)\b/i,
  categorization: /\b(categorize|classify|group|organize)\b/i,

  // Dependency operations
  dependency_update: /\b(update|upgrade|patch)\b.*\b(dependency|package|library|module)\b/i,
  dependency_upgrade: /\b(upgrade|update|migrate)\b.*\b(dependency|package|version)\b/i,
  dependency_check: /\b(check|verify|validate)\b.*\b(dependency|package|version)\b/i,
  dependency_review: /\b(review|audit|check)\b.*\b(dependency|package|library)\b/i,

  // Commit operations
  commit_review: /\b(review|validate|check)\b.*\b(commit|commit\s+message|git)\b/i,

  // Agent and response evaluation
  agent_evaluation: /\b(evaluate|assess|measure)\b.*\b(agent|performance|quality)\b/i,
  response_quality: /\b(evaluate|assess|rate)\b.*\b(response|output|quality)\b/i,
  response_evaluation: /\b(evaluate|rate|assess)\b.*\b(response|output|result)\b/i,
  prompt_evaluation: /\b(evaluate|assess|test)\b.*\b(prompt|template|instruction)\b/i,

  // Browser and UI testing
  browser_testing: /\b(test|check|validate)\b.*\b(browser|chrome|firefox|ui)\b/i,
  ui_testing: /\b(test|check|automate)\b.*\b(ui|interface|interaction|click)\b/i,

  // Workflow operations
  plan_validation: /\b(validate|verify|check)\b.*\b(plan|roadmap|strategy)\b/i,
  workflow_error: /\b(error|failure|issue|problem)\b.*\b(workflow|pipeline|process)\b/i,
  workflow_recovery: /\b(recover|retry|resume)\b.*\b(workflow|process|execution)\b/i,

  // Task completion
  task_complete: /\b(complete|finish|done|deliver)\b.*\b(task|work|feature)\b/i,

  // Platform operations
  platform_handoff: /\b(handoff|transfer|sync|share)\b.*\b(context|state|cursor|factory)\b/i,
  platform_routing: /\b(route|delegate|assign)\b.*\b(task|work|model)\b/i,

  // Conflict resolution
  agent_conflict: /\b(conflict|disagree|differ)\b.*\b(agent|output|result)\b/i,
  model_conflict: /\b(conflict|disagree)\b.*\b(model|response)\b/i,

  // Optional artifact handling
  missing_optional_artifact: /\b(missing|absent|not\s+found)\b.*\b(optional|artifact)\b/i,

  // API operations
  api_design: /\b(design|architect|plan)\b.*\b(api|endpoint|interface|contract)\b/i,
  api_contract: /\b(contract|specification|openapi|swagger)\b.*\b(api|rest|graphql)\b/i,

  // LLM design
  llm_design: /\b(design|architect|plan)\b.*\b(llm|ai|model|rag|prompt)\b/i,

  // Deployment
  deployment: /\b(deploy|release|ship|publish)\b.*\b(application|service|container)\b/i,

  // Git operations
  git_operations: /\b(git|commit|branch|merge|pull|push|clone)\b/i,

  // Presentations and reports
  presentations: /\b(presentation|slides|powerpoint|deck)\b/i,
  design_presentation: /\b(presentation)\b.*\b(design|ui|ux|mockup)\b/i,
  stakeholder_presentation: /\b(presentation)\b.*\b(stakeholder|executive|client)\b/i,
  pdf_reports: /\b(pdf|report|formal\s+report)\b/i,
  formal_report: /\b(formal|official)\b.*\b(report|document)\b/i,
  audit_report: /\b(audit|compliance)\b.*\b(report|document)\b/i,

  // Data operations
  data_tables: /\b(table|spreadsheet|excel|csv|data\s+export)\b/i,
  roadmap_export: /\b(export|generate)\b.*\b(roadmap|timeline|schedule)\b/i,

  // Rule migration
  rule_migration: /\b(migrate|upgrade|update)\b.*\b(rule|standard|guideline)\b/i,

  // Issue tracking
  issue_tracking: /\b(track|manage|create)\b.*\b(issue|ticket|bug|github)\b/i,

  // Complex design
  complex_design: /\b(design|architect)\b.*\b(complex|sophisticated|advanced)\b/i,
};

/**
 * Load the skill integration matrix
 * @returns {Promise<Object>} The skill matrix
 */
async function loadSkillMatrix() {
  const matrixPath = resolveConfigPath('skill-integration-matrix.json', { read: true });
  const content = await fs.readFile(matrixPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Match triggers against task description
 * @param {string} taskDescription - The task description
 * @returns {string[]} Array of matched trigger names
 */
function matchTriggers(taskDescription) {
  const matched = [];

  for (const [trigger, pattern] of Object.entries(TRIGGER_PATTERNS)) {
    if (pattern.test(taskDescription)) {
      matched.push(trigger);
    }
  }

  return matched;
}

/**
 * Get triggered skills for an agent and task
 * @param {string} agentType - The agent type (e.g., "developer")
 * @param {string} taskDescription - The task description
 * @returns {Promise<string[]>} Array of skill names that should be activated
 */
async function getTriggeredSkills(agentType, taskDescription) {
  const matrix = await loadSkillMatrix();
  const agentConfig = matrix.agents[agentType];

  if (!agentConfig) {
    throw new Error(`Agent type "${agentType}" not found in skill matrix`);
  }

  // Get skill triggers mapping for this agent
  const skillTriggers = agentConfig.skill_triggers || {};

  // Match task against trigger patterns
  const matchedTriggers = matchTriggers(taskDescription);

  // Map matched triggers to skills
  const triggeredSkills = [];
  for (const trigger of matchedTriggers) {
    const skill = skillTriggers[trigger];
    if (skill && !triggeredSkills.includes(skill)) {
      triggeredSkills.push(skill);
    }
  }

  return triggeredSkills;
}

/**
 * Detect all skills for an agent and task
 * @param {string} agentType - The agent type
 * @param {string} taskDescription - The task description
 * @returns {Promise<Object>} Object containing required, triggered, recommended, and all skills
 */
export async function detectAllSkills(agentType, taskDescription) {
  const matrix = await loadSkillMatrix();
  const agentConfig = matrix.agents[agentType];

  if (!agentConfig) {
    throw new Error(`Agent type "${agentType}" not found in skill matrix`);
  }

  // Required skills (always needed)
  const required = agentConfig.required_skills || [];

  // Triggered skills (based on task)
  const triggered = await getTriggeredSkills(agentType, taskDescription);

  // Recommended skills (optional)
  const recommended = agentConfig.recommended_skills || [];

  // All skills (required + triggered, deduplicated)
  const all = [...new Set([...required, ...triggered])];

  // Matched triggers
  const matchedTriggers = matchTriggers(taskDescription);

  return {
    required,
    triggered,
    recommended,
    all,
    matchedTriggers,
  };
}

/**
 * CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let agentType = null;
  let taskDescription = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && i + 1 < args.length) {
      agentType = args[i + 1];
      i++;
    } else if (args[i] === '--task' && i + 1 < args.length) {
      taskDescription = args[i + 1];
      i++;
    }
  }

  // Validate required arguments
  if (!agentType || !taskDescription) {
    console.error(
      'Usage: node skill-trigger-detector.mjs --agent <agent-type> --task "<task-description>"'
    );
    console.error('\nExample:');
    console.error(
      '  node skill-trigger-detector.mjs --agent developer --task "Create new UserProfile component"'
    );
    console.error('\nAvailable agent types:');
    const matrix = await loadSkillMatrix();
    console.error('  ' + Object.keys(matrix.agents).join(', '));
    process.exit(1);
  }

  try {
    const result = await detectAllSkills(agentType, taskDescription);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (process.argv[1] && process.argv[1].endsWith('skill-trigger-detector.mjs')) {
  main();
}
