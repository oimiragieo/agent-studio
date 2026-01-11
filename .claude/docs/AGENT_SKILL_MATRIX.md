# Agent-Skill Integration Matrix

Complete mapping of all 34 agents to 43 skills with triggers and usage notes.

For the authoritative JSON mapping, see `.claude/context/skill-integration-matrix.json`.

**Note**: This matrix covers **Agent Studio Skills** only (`.claude/skills/`). For information about **Codex Skills** (`codex-skills/`), see [SKILLS_TAXONOMY.md](SKILLS_TAXONOMY.md).

## Phase 2.1.2 Updates

### context:fork Feature

Skills now support automatic forking into subagent contexts. Only skills with `context:fork: true` in their SKILL.md frontmatter are injected into subagent prompts via `skill-injection-hook.js`.

**Token Savings Impact**: Reduces subagent context by 80% while maintaining access to required functionality:

- Without context:fork: Each skill adds ~500-2000 tokens per subagent
- With context:fork: Each skill adds ~50-100 tokens (summary only)
- For 5-10 skills: 2500-5000 tokens → 500-1000 tokens

This injection happens automatically and requires zero orchestrator involvement.

### Model Affinity

Skills can now specify optimal model affinity in their frontmatter (`model: haiku|sonnet|opus`). The skill-injection-hook uses this to route skills to appropriately-sized subagents, improving both performance and cost efficiency.

## Agent-Skill Mapping Table

| Agent                         | Required Skills                                                     | Recommended Skills                                         | Key Triggers                                                                 |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **orchestrator**              | response-rater, recovery, artifact-publisher                        | context-bridge                                             | plan_validation, workflow_error, task_complete                               |
| **developer**                 | scaffolder, rule-auditor, repo-rag                                  | test-generator, claude-md-generator, code-style-validator  | new_component, code_changes, codebase_search                                 |
| **code-reviewer**             | rule-auditor, code-style-validator, explaining-rules                | fixing-rule-violations, dependency-analyzer                | review_code, style_review, rule_explanation                                  |
| **qa**                        | test-generator, rule-auditor, evaluator                             | response-rater, chrome-devtools, computer-use              | test_creation, quality_check, agent_evaluation                               |
| **architect**                 | diagram-generator, repo-rag, dependency-analyzer                    | doc-generator, api-contract-generator, sequential-thinking | architecture_diagram, pattern_search, dependency_analysis                    |
| **security-architect**        | rule-auditor, dependency-analyzer, explaining-rules                 | repo-rag, doc-generator, sequential-thinking               | security_audit, vulnerability_scan, threat_modeling                          |
| **technical-writer**          | doc-generator, diagram-generator, summarizer                        | claude-md-generator, pdf-generator, powerpoint-generator   | documentation, diagrams, summaries                                           |
| **planner**                   | plan-generator, sequential-thinking                                 | diagram-generator, classifier, repo-rag                    | plan_creation, complex_analysis, plan_diagram                                |
| **analyst**                   | repo-rag, sequential-thinking                                       | classifier, summarizer, text-to-sql                        | codebase_analysis, deep_analysis, categorization                             |
| **pm**                        | plan-generator, classifier                                          | summarizer, excel-generator, powerpoint-generator          | requirement_planning, feature_classification                                 |
| **ux-expert**                 | diagram-generator, claude-md-generator                              | doc-generator, powerpoint-generator, summarizer            | user_flow_diagram, component_docs, design_presentation                       |
| **database-architect**        | diagram-generator, text-to-sql, dependency-analyzer                 | doc-generator, repo-rag                                    | schema_diagram, query_generation, orm_analysis                               |
| **devops**                    | cloud-run, kubernetes-flux, dependency-analyzer                     | doc-generator, diagram-generator, git                      | deployment, dependency_check, infrastructure_docs, k8s_management            |
| **llm-architect**             | sequential-thinking, diagram-generator, doc-generator               | repo-rag, api-contract-generator, response-rater           | llm_design, architecture_diagram, prompt_evaluation                          |
| **api-designer**              | api-contract-generator, diagram-generator, doc-generator            | repo-rag, sequential-thinking                              | api_contract, api_diagram, api_docs                                          |
| **mobile-developer**          | scaffolder, rule-auditor, repo-rag                                  | test-generator, chrome-devtools, dependency-analyzer       | new_component, code_review, pattern_search                                   |
| **performance-engineer**      | dependency-analyzer, repo-rag, diagram-generator                    | sequential-thinking, doc-generator                         | dependency_analysis, performance_pattern_search                              |
| **refactoring-specialist**    | repo-rag, rule-auditor, fixing-rule-violations                      | diagram-generator, code-style-validator                    | pattern_search, rule_compliance, violation_fixes                             |
| **legacy-modernizer**         | repo-rag, dependency-analyzer, migrating-rules                      | diagram-generator, sequential-thinking, doc-generator      | legacy_analysis, dependency_upgrade, rule_migration                          |
| **accessibility-expert**      | rule-auditor, chrome-devtools, computer-use                         | repo-rag, doc-generator, diagram-generator                 | a11y_audit, browser_testing, ui_testing                                      |
| **compliance-auditor**        | rule-auditor, dependency-analyzer, explaining-rules                 | doc-generator, excel-generator, pdf-generator              | compliance_audit, vulnerability_scan, audit_report                           |
| **incident-responder**        | kubernetes-flux, repo-rag, dependency-analyzer, sequential-thinking | doc-generator, diagram-generator, github                   | incident_analysis, root_cause_analysis, postmortem_docs, k8s_troubleshooting |
| **model-orchestrator**        | response-rater, context-bridge                                      | recovery, conflict-resolution                              | response_evaluation, platform_routing, workflow_recovery                     |
| **code-simplifier**           | repo-rag, code-style-validator, rule-auditor                        | fixing-rule-violations, diagram-generator                  | complexity_analysis, style_validation, rule_compliance                       |
| **master-orchestrator**       | response-rater, recovery, artifact-publisher                        | context-bridge, conflict-resolution                        | plan_validation, workflow_orchestration, task_complete                       |
| **impact-analyzer**           | sequential-thinking, repo-rag, diagram-generator                    | evaluator, response-rater                                  | impact_assessment, change_analysis, risk_evaluation                          |
| **cloud-integrator**          | cloud-run, kubernetes-flux, dependency-analyzer, doc-generator      | sequential-thinking, diagram-generator                     | cloud_integration, infrastructure_setup, deployment, k8s_setup               |
| **react-component-developer** | scaffolder, rule-auditor, test-generator                            | code-style-validator, repo-rag                             | component_creation, pattern_implementation, testing                          |
| **router**                    | response-rater, context-bridge                                      | recovery, conflict-resolution                              | model_routing, platform_routing, workflow_selection                          |
| **gcp-cloud-agent**           | cloud-run, dependency-analyzer, sequential-thinking                 | doc-generator, diagram-generator                           | gcp_integration, cloud_setup, infrastructure                                 |
| **ai-council**                | response-rater, sequential-thinking, evaluator                      | repo-rag, conflict-resolution                              | multi_model_validation, consensus_building, quality_check                    |
| **codex-validator**           | code-style-validator, rule-auditor, evaluator                       | response-rater, test-generator                             | code_validation, multi_model_review, quality_assessment                      |
| **cursor-validator**          | rule-auditor, evaluator, response-rater                             | code-style-validator, artifact-publisher                   | cursor_integration, platform_validation, compatibility_check                 |
| **gemini-validator**          | evaluator, response-rater, sequential-thinking                      | artifact-publisher, classifier                             | gemini_integration, model_validation, response_quality                       |

## Skill Categories

**Core**: repo-rag, artifact-publisher, context-bridge, rule-auditor, rule-selector, scaffolder

**Memory**: memory-manager, memory

**Documents**: excel-generator, powerpoint-generator, pdf-generator

**Analysis**: evaluator, classifier, summarizer, text-to-sql

**Tools**: tool-search, mcp-converter, skill-manager

**Code Gen**: claude-md-generator, plan-generator, diagram-generator, test-generator, api-contract-generator, dependency-analyzer, doc-generator

**Validation**: code-style-validator, commit-validator, response-rater

**Recovery & Orchestration**: recovery, conflict-resolution, optional-artifact-handler

**Enforcement**: migrating-rules, explaining-rules, fixing-rule-violations

## MCP-Converted Skills

MCP servers converted to Skills for 90%+ context savings:

- **sequential-thinking**: Structured problem solving
- **filesystem**: File operations
- **git**: Git operations
- **github**: GitHub API integration
- **puppeteer**: Browser automation
- **chrome-devtools**: Chrome debugging
- **memory**: Knowledge graph storage
- **cloud-run**: Cloud Run deployment
- **computer-use**: Playwright automation
- **kubernetes-flux**: Kubernetes cluster management
