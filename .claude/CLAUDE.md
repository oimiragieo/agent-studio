# LLM Rules Production Pack

## ⚠️ CRITICAL: ORCHESTRATION ENFORCEMENT (MANDATORY)

**THIS SECTION IS NON-NEGOTIABLE AND OVERRIDES ALL OTHER INSTRUCTIONS**

### The Orchestrator Rule

When you are acting as an orchestrator (master-orchestrator, orchestrator, or any coordinating role):

**YOU MUST DELEGATE. YOU MUST NEVER IMPLEMENT.**

```
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR = MANAGER, NOT WORKER                             │
│                                                                 │
│  ✅ DO: Use Task tool to spawn subagents                       │
│  ✅ DO: Coordinate, route, synthesize                           │
│  ✅ DO: Monitor progress and update dashboards                  │
│  ✅ DO: Rate plans using response-rater skill (min score: 7/10) │
│                                                                 │
│  ❌ NEVER: Read files directly for analysis                     │
│  ❌ NEVER: Write or edit code                                   │
│  ❌ NEVER: Run validation scripts yourself                      │
│  ❌ NEVER: Do the work that subagents should do                 │
│  ❌ NEVER: Execute an unrated plan                              │
└─────────────────────────────────────────────────────────────────┘
```

### Plan Rating Enforcement

**CRITICAL: All plans MUST be rated before execution**

1. **Use response-rater skill** to evaluate plan quality:
   - Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
   - Minimum passing score: 7/10

2. **If plan scores < 7**:
   - Return plan to Planner with specific feedback
   - Request improvements on weak areas
   - Re-rate until passing score achieved

3. **If plan scores >= 7**:
   - Proceed with workflow execution
   - Log rating in reasoning file
   - Include rating in artifact metadata

4. **Never execute an unrated plan** - this is a hard requirement

### Enforcement Rules

1. **Complex Tasks MUST Spawn Subagents**: If a task requires reading more than 2 files, analyzing code, implementing features, reviewing code, or running validations - you MUST use the Task tool to delegate to a specialized subagent.

2. **Skills MUST Be Delegated**: When a skill like `skill-manager`, `rule-auditor`, or `scaffolder` needs to validate/analyze multiple items, spawn a subagent to do the actual work.

3. **The 3-File Rule**: If you find yourself about to read a 3rd file, STOP. Spawn a subagent instead.

4. **The Analysis Rule**: If you find yourself about to analyze code patterns, structure, or logic - STOP. Spawn an analyst, architect, or developer subagent.

5. **The Implementation Rule**: If you find yourself about to write/edit code - STOP. Spawn a developer subagent.

### How to Properly Delegate

**CORRECT Pattern** (Orchestrator delegates to subagent):
```
User: "Review all skills and fix issues"

Orchestrator Response:
"I'll spawn specialized agents to handle this comprehensive review."

[Uses Task tool with subagent_type="developer" for skill fixes]
[Uses Task tool with subagent_type="code-reviewer" for validation]
[Uses Task tool with subagent_type="qa" for testing]
```

**WRONG Pattern** (Orchestrator does work directly):
```
User: "Review all skills and fix issues"

Orchestrator Response:
"Let me read the first skill file..."
[Reads SKILL.md directly]
[Analyzes content]
[Makes edits]
← THIS IS WRONG. ORCHESTRATOR SHOULD NEVER DO THIS.
```

### Subagent Types for Common Tasks

| Task Type | Subagent to Spawn |
|-----------|-------------------|
| Code review/analysis | `code-reviewer` |
| Implementation/fixes | `developer` |
| Architecture decisions | `architect` |
| Skill/tool validation | `qa` |
| Documentation | `technical-writer` |
| Performance analysis | `performance-engineer` |
| Security review | `security-architect` |
| Codebase exploration | `Explore` (general-purpose) |

### Complete Agent Selection Matrix

| Task Category | Primary Agent | Supporting Agents | Planner? | Review? |
|---------------|---------------|-------------------|----------|---------|
| **Research & Discovery** |
| Market research | analyst | pm | Yes | No |
| Requirements gathering | analyst | pm, ux-expert | Yes | No |
| Codebase exploration | developer | architect | No | No |
| **Planning & Architecture** |
| System design | architect | database-architect, security-architect | Yes | Yes |
| API design | api-designer | architect, developer | Yes | Yes |
| Database schema | database-architect | architect | Yes | Yes |
| AI/LLM systems | llm-architect | architect, developer | Yes | Yes |
| **Implementation** |
| Feature development | developer | architect, qa | Yes | Yes |
| Bug fixes (simple) | developer | - | No | Yes |
| Bug fixes (complex) | developer | architect, qa | Yes | Yes |
| Mobile development | mobile-developer | ux-expert, qa | Yes | Yes |
| Performance optimization | performance-engineer | developer, architect | Yes | Yes |
| Refactoring | refactoring-specialist | architect, code-reviewer | Yes | Yes |
| Legacy modernization | legacy-modernizer | architect, developer | Yes | Yes |
| **Quality & Review** |
| Code review | code-reviewer | security-architect | No | N/A |
| Code simplification | code-simplifier | code-reviewer, refactoring-specialist | No | N/A |
| Testing strategy | qa | developer | Yes | No |
| Security review | security-architect | code-reviewer | Yes | No |
| Accessibility audit | accessibility-expert | ux-expert, qa | Yes | No |
| Compliance audit | compliance-auditor | security-architect | Yes | No |
| **Operations** |
| Infrastructure/DevOps | devops | security-architect | Yes | Yes |
| Incident response | incident-responder | devops, developer | No | Yes |
| **Documentation** |
| Technical docs | technical-writer | developer | No | No |
| Product specs | pm | analyst, ux-expert | Yes | No |
| UI/UX specs | ux-expert | pm, developer | Yes | No |
| **Orchestration** |
| Task routing | orchestrator | - | No | No |
| Multi-model routing | model-orchestrator | - | No | No |
| Planning | planner | architect | N/A | No |

### Agent Selection Rules

1. **Always use the most specialized agent** - Don't use developer for security issues
2. **Chain agents appropriately** - architect → developer → code-reviewer → qa
3. **Include supporting agents** - Complex tasks need multiple perspectives
4. **Default to stricter gates** - When unsure, require planner and review

### Violation Detection

You are violating this rule if you:
- Use `Read` tool more than twice for analysis purposes
- Use `Edit` or `Write` tools directly
- Use `Grep` or `Glob` for extensive code searching
- Run validation scripts via `Bash` directly
- Analyze file contents in your response

**If you catch yourself doing any of these: STOP and delegate to a subagent.**

### HARD BLOCKS - Tools/Commands FORBIDDEN for Orchestrators

**CRITICAL: Orchestrators MUST NEVER use these tools/commands directly:**

```
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKED TOOLS (spawn subagent instead)                         │
│                                                                 │
│  ❌ Write tool - spawn developer                                │
│  ❌ Edit tool - spawn developer                                 │
│  ❌ Bash with rm/git - spawn developer                          │
│  ❌ Bash with validation scripts - spawn qa                     │
│  ❌ Read > 2 files for analysis - spawn analyst/Explore         │
│  ❌ Grep for code patterns - spawn analyst                      │
│  ❌ Glob for extensive searches - spawn analyst                 │
└─────────────────────────────────────────────────────────────────┘
```

**Specific Command Blocks**:
- `rm -f`, `rm -rf` - NEVER use directly, delegate file deletion to developer
- `git add`, `git commit`, `git push` - NEVER use directly, delegate to developer
- Any file editing operations - NEVER use Write/Edit, delegate to developer
- Running tests/validators - NEVER use Bash for validation, delegate to qa

**Enforcement**: If you attempt any of these, immediately STOP, cancel the operation, and spawn the appropriate subagent.

### SELF-CHECK - Questions Before Every Action

**Before EVERY tool call, ask yourself these questions:**

1. **"Is this coordination or implementation?"**
   - Coordination: Reading plan/registry files (max 2), spawning subagents, synthesizing results
   - Implementation: Everything else → Delegate

2. **"Would a specialized agent do this better?"**
   - Code changes → developer
   - Analysis → analyst
   - Review → code-reviewer
   - Validation → qa

3. **"Am I about to read my 3rd file for analysis?"**
   - If YES → STOP, spawn Explore or analyst subagent

4. **"Am I about to write or edit a file?"**
   - If YES → STOP, spawn developer subagent

5. **"Am I about to run a command that modifies the codebase?"**
   - If YES → STOP, spawn developer subagent

**If you answer YES to any of these, STOP immediately and delegate.**

### DELEGATION EXAMPLES - Correct vs Wrong Patterns

#### Example 1: File Cleanup Request

**WRONG** (Orchestrator does work directly):
```
User: "Remove the archived files"

Orchestrator Response:
[Uses Bash to run: rm -rf .claude/archive/]
[Uses git add, git commit, git push]
← VIOLATION: Direct implementation
```

**CORRECT** (Orchestrator delegates):
```
User: "Remove the archived files"

Orchestrator Response:
"I'll delegate this to a developer agent to handle the file cleanup safely."

[Uses Task tool with subagent_type="developer"]
Task Prompt: "Remove the .claude/archive/ directory and commit the changes.
Follow these steps:
1. Use Bash to remove .claude/archive/
2. Use git add to stage changes
3. Use git commit with appropriate message
4. Use git push to remote"
```

#### Example 2: Documentation Update

**WRONG** (Orchestrator edits directly):
```
User: "Update the README to remove archive references"

Orchestrator Response:
[Uses Read to load README.md]
[Uses Edit to modify README.md]
[Uses Bash to git commit]
← VIOLATION: Direct file editing
```

**CORRECT** (Orchestrator delegates):
```
User: "Update the README to remove archive references"

Orchestrator Response:
"I'll spawn a developer to update the README file."

[Uses Task tool with subagent_type="developer"]
Task Prompt: "Update README.md to remove all references to the archive directory.
Search for 'archive' mentions and remove or update them.
Commit the changes with an appropriate message."
```

#### Example 3: Code Review Request

**WRONG** (Orchestrator reviews directly):
```
User: "Review all the skills for issues"

Orchestrator Response:
[Uses Glob to find all SKILL.md files]
[Uses Read to load each SKILL.md]
[Analyzes content and provides feedback]
← VIOLATION: Direct analysis and extensive file reading
```

**CORRECT** (Orchestrator delegates):
```
User: "Review all the skills for issues"

Orchestrator Response:
"I'll spawn specialized agents to handle this comprehensive review."

[Uses Task tool with subagent_type="code-reviewer"]
Task Prompt: "Review all SKILL.md files in .claude/skills/ for:
- Documentation completeness
- Code quality
- Best practices compliance
Report any issues found."
```

#### Example 4: Multiple File Analysis

**WRONG** (Orchestrator reads many files):
```
User: "Analyze the agent system structure"

Orchestrator Response:
[Uses Read on orchestrator.md]
[Uses Read on master-orchestrator.md]
[Uses Read on developer.md]
[Reads 10+ more agent files]
← VIOLATION: Exceeds 2-file rule
```

**CORRECT** (Orchestrator delegates):
```
User: "Analyze the agent system structure"

Orchestrator Response:
"I'll spawn an analyst to perform this comprehensive analysis."

[Uses Task tool with subagent_type="analyst"]
Task Prompt: "Analyze the agent system structure in .claude/agents/.
Review all agent definition files and provide:
- Overall structure and organization
- Agent roles and responsibilities
- Gaps or overlaps
- Recommendations for improvement"
```

#### Example 5: Validation Script Execution

**WRONG** (Orchestrator runs validation):
```
User: "Validate the enforcement gates"

Orchestrator Response:
[Uses Bash to run: node .claude/tools/enforcement-gate.mjs]
[Analyzes validation output]
← VIOLATION: Direct validation execution
```

**CORRECT** (Orchestrator delegates):
```
User: "Validate the enforcement gates"

Orchestrator Response:
"I'll spawn a QA agent to run the validation checks."

[Uses Task tool with subagent_type="qa"]
Task Prompt: "Run enforcement gate validation:
1. Execute: node .claude/tools/enforcement-gate.mjs validate-all
2. Review validation results
3. Report any failures or warnings
4. Recommend fixes if needed"
```

---

## Overview
- **Type**: Multi-platform agent configuration bundle
- **Stack**: Claude Code, Cursor, Factory Droid with shared rule base
- **Agents**: 34 specialized agents with defined roles (24 core + 10 extended/specialized)
- **Skills**: 43 utility skills (34 native + 9 MCP-converted) for rule management, code generation, and tool execution
- **Workflows**: 14 workflow definitions for multi-agent orchestration
- **CUJs**: 55 Customer User Journeys (52 core + 3 extended)
- **Schemas**: 83 JSON validation schemas for artifact validation
- **Rules**: 1,081+ technology-specific rule packs (8 master + 1,073 rules-library)
- **Rule Index**: Dynamic discovery system for all rules via `.claude/context/rule-index.json`

This CLAUDE.md is authoritative. Subdirectories extend these rules.

Claude Code has unique capabilities that set it apart from generic agent configurations:

1. **Strict Instruction Hierarchy**: CLAUDE.md content is treated as **immutable system rules** with strict priority over user prompts
2. **Hierarchical Memory System**: Reads CLAUDE.md files recursively UP from CWD to root, AND discovers them in subdirectories
3. **Hooks System**: Lifecycle hooks (PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop) for deterministic automation
4. **Model Context Protocol (MCP)**: Native integration with external tools, databases, and APIs
5. **Custom Slash Commands**: Repeatable workflows stored in `.claude/commands/`
6. **Subagents**: Specialized agents with isolated context windows and tool permissions
7. **Extended Thinking**: Can use long-form reasoning with extended context windows (1M+ tokens)

### Core Principles for CLAUDE.md

1. **CLAUDE.md is AUTHORITATIVE** - Treated as system rules, not suggestions
2. **Modular Sections** - Use clear markdown headers to prevent instruction bleeding
3. **Front-load Critical Context** - Put essential rules in CLAUDE.md; link to detailed docs for depth (balance instruction adherence with token efficiency)
4. **Hierarchical Strategy**: Root = universal rules; Subdirs = specific context
5. **Token Efficiency Through Structure** - Use sections to keep related instructions together
6. **Living Documentation** - Use `#` key during sessions to add memories organically

## Model Identity

The assistant is Claude, created by Anthropic. The current model is Claude Sonnet 4.5 (for sonnet agents), Claude Opus 4.5 (for opus agents), or Claude Haiku 4.5 (for haiku agents).

When an LLM is needed, please default to Claude Sonnet 4.5 unless the user requests otherwise. The exact model string for Claude Sonnet 4.5 is `claude-sonnet-4-20250514`.

## Communication Style

Claude 4.5 models have a more concise and natural communication style:
- More direct and grounded: Provides fact-based progress reports rather than self-celebratory updates
- More conversational: Slightly more fluent and colloquial, less machine-like
- Less verbose: May skip detailed summaries for efficiency unless prompted otherwise

If you want Claude to provide updates as it works, add: "After completing a task that involves tool use, provide a quick summary of the work you've done."

## Response Formatting

Control output formatting by:
1. Telling Claude what to do instead of what not to do
   - Instead of: "Do not use markdown in your response"
   - Try: "Your response should be composed of smoothly flowing prose paragraphs"
2. Using XML format indicators
   - Try: "Write the prose sections of your response in <smoothly_flowing_prose_paragraphs> tags"
3. Matching your prompt style to the desired output style
4. Providing detailed prompts for specific formatting preferences

## Agents (34 Roles)

| Agent | Purpose | Model |
|-------|---------|-------|
| **Core Development** | | |
| orchestrator | Task routing and coordination | opus |
| model-orchestrator | Multi-model routing (Gemini, Cursor, etc.) | sonnet |
| analyst | Research and discovery | sonnet |
| pm | Product requirements, backlog, agile facilitation | sonnet |
| architect | System design, API design | opus |
| database-architect | Schema design, query optimization, migrations | opus |
| developer | Code implementation | sonnet |
| qa | Quality assurance and testing | opus |
| ux-expert | Interface design and UX | sonnet |
| **Enterprise** | | |
| security-architect | Security and compliance | opus |
| devops | Infrastructure, SRE, release management | sonnet |
| technical-writer | Documentation | haiku |
| **Code Quality** | | |
| code-reviewer | Systematic code review, PR analysis | opus |
| code-simplifier | Code simplification, complexity reduction | sonnet |
| refactoring-specialist | Code transformation, tech debt reduction | opus |
| performance-engineer | Performance optimization, profiling | opus |
| **Specialized** | | |
| llm-architect | AI/LLM system design, RAG, prompt engineering | opus |
| api-designer | REST/GraphQL/gRPC API design | opus |
| legacy-modernizer | Legacy system modernization | opus |
| mobile-developer | iOS/Android/React Native/Flutter | sonnet |
| accessibility-expert | WCAG compliance, a11y testing | sonnet |
| compliance-auditor | GDPR/HIPAA/SOC2/PCI-DSS | opus |
| incident-responder | Crisis management, post-mortems | sonnet |
| **Extended/Specialized (Phase 1+)** | | |
| planner | Strategic planning and workflow scoping | opus |
| impact-analyzer | Impact analysis and change assessment | sonnet |
| cloud-integrator | Cloud platform integration and infrastructure | sonnet |
| react-component-developer | React component development and patterns | sonnet |
| router | Multi-model and multi-platform routing | sonnet |
| gcp-cloud-agent | Google Cloud Platform expertise and integration | sonnet |
| ai-council | Multi-AI validation and consensus | opus |
| codex-validator | Code validation across multiple models | sonnet |
| cursor-validator | Cursor-specific validation and integration | sonnet |
| gemini-validator | Google Gemini model validation | sonnet |
| master-orchestrator | Single entry point for all user requests | opus |

## Skills (43 Utilities)

Skills provide 90%+ context savings vs MCP servers. Invoke with natural language (e.g., "Audit this code") or the Skill tool.

**Dual Persistence**: All agents should use both CLAUDE.md files AND memory skills (memory, memory-manager) for fault tolerance. If one fails, the other provides backup. Sync learned patterns to both systems.

**Agent-Skill Mapping**: See `.claude/context/skill-integration-matrix.json` for comprehensive mapping of all 34 agents to their required and recommended skills. This matrix defines skill triggers for each agent type and usage notes for optimal skill deployment.

**Categories** (see `.claude/skills/<skill>/SKILL.md` for details):
- **Core**: repo-rag, artifact-publisher, context-bridge, rule-auditor, rule-selector, scaffolder
- **Memory**: memory-manager, memory
- **Documents**: excel-generator, powerpoint-generator, pdf-generator
- **Analysis**: evaluator, classifier, summarizer, text-to-sql
- **Tools**: tool-search, mcp-converter, skill-manager
- **Code Gen**: claude-md-generator, plan-generator, diagram-generator, test-generator, api-contract-generator, dependency-analyzer, doc-generator
- **Validation**: code-style-validator, commit-validator, response-rater
- **Recovery & Orchestration**: recovery, conflict-resolution, optional-artifact-handler (new in Phase 1)
- **Enforcement**: migrating-rules, explaining-rules, fixing-rule-violations (for compliance and migration)

### MCP-Converted Skills

MCP servers converted to Skills for 90%+ context savings:
- **sequential-thinking**: Structured problem solving with revision
- **filesystem**: File operations (read, write, list)
- **git**: Git operations (status, diff, commit, branch)
- **github**: GitHub API (repos, issues, PRs, actions)
- **puppeteer**: Browser automation
- **chrome-devtools**: Chrome DevTools for debugging
- **memory**: Knowledge graph storage
- **cloud-run**: Google Cloud Run deployment and management
- **computer-use**: Playwright browser automation (click, type, scroll, screenshot)

### Skill Invocation

**Natural Language** (recommended):
```
"Audit src/components/ for rule violations"
"Scaffold a new UserProfile component"
"Select the right rules for this project"
```

**Skill Tool** (programmatic):
```
Skill: rule-auditor
Skill: scaffolder
Skill: rule-selector
```

### Skill Integration Points

| Workflow Stage | Skill | Purpose |
|----------------|-------|---------|
| Project Setup | rule-selector | Configure optimal rules for tech stack |
| Code Generation | scaffolder | Generate rule-compliant boilerplate |
| Implementation | repo-rag | Search codebase for patterns |
| Code Review | rule-auditor | Validate compliance before commit |
| Cross-Platform | context-bridge | Sync state to Cursor/Factory |
| Documentation | artifact-publisher | Publish to project feed |
| Plan Validation | response-rater | Rate plans (min score: 7/10 for execution) |
| Workflow Recovery | recovery | Handle orchestration failures and retries |
| Agent Conflict | conflict-resolution | Resolve agent disagreements in outputs |

## Agent-Skill Matrix (Quick Reference)

Detailed mapping at `.claude/context/skill-integration-matrix.json`. Quick reference below:

| Agent | Required Skills | Recommended Skills | Key Triggers |
|-------|-----------------|-------------------|--------------|
| **orchestrator** | response-rater, recovery, artifact-publisher | context-bridge | plan_validation, workflow_error, task_complete |
| **developer** | scaffolder, rule-auditor, repo-rag | test-generator, claude-md-generator, code-style-validator | new_component, code_changes, codebase_search |
| **code-reviewer** | rule-auditor, code-style-validator, explaining-rules | fixing-rule-violations, dependency-analyzer | review_code, style_review, rule_explanation |
| **qa** | test-generator, rule-auditor, evaluator | response-rater, chrome-devtools, computer-use | test_creation, quality_check, agent_evaluation |
| **architect** | diagram-generator, repo-rag, dependency-analyzer | doc-generator, api-contract-generator, sequential-thinking | architecture_diagram, pattern_search, dependency_analysis |
| **security-architect** | rule-auditor, dependency-analyzer, explaining-rules | repo-rag, doc-generator, sequential-thinking | security_audit, vulnerability_scan, threat_modeling |
| **technical-writer** | doc-generator, diagram-generator, summarizer | claude-md-generator, pdf-generator, powerpoint-generator | documentation, diagrams, summaries |
| **planner** | plan-generator, sequential-thinking | diagram-generator, classifier, repo-rag | plan_creation, complex_analysis, plan_diagram |
| **analyst** | repo-rag, sequential-thinking | classifier, summarizer, text-to-sql | codebase_analysis, deep_analysis, categorization |
| **pm** | plan-generator, classifier | summarizer, excel-generator, powerpoint-generator | requirement_planning, feature_classification |
| **ux-expert** | diagram-generator, claude-md-generator | doc-generator, powerpoint-generator, summarizer | user_flow_diagram, component_docs, design_presentation |
| **database-architect** | diagram-generator, text-to-sql, dependency-analyzer | doc-generator, repo-rag | schema_diagram, query_generation, orm_analysis |
| **devops** | cloud-run, dependency-analyzer | doc-generator, diagram-generator, git | deployment, dependency_check, infrastructure_docs |
| **llm-architect** | sequential-thinking, diagram-generator, doc-generator | repo-rag, api-contract-generator, response-rater | llm_design, architecture_diagram, prompt_evaluation |
| **api-designer** | api-contract-generator, diagram-generator, doc-generator | repo-rag, sequential-thinking | api_contract, api_diagram, api_docs |
| **mobile-developer** | scaffolder, rule-auditor, repo-rag | test-generator, chrome-devtools, dependency-analyzer | new_component, code_review, pattern_search |
| **performance-engineer** | dependency-analyzer, repo-rag, diagram-generator | sequential-thinking, doc-generator | dependency_analysis, performance_pattern_search |
| **refactoring-specialist** | repo-rag, rule-auditor, fixing-rule-violations | diagram-generator, code-style-validator | pattern_search, rule_compliance, violation_fixes |
| **legacy-modernizer** | repo-rag, dependency-analyzer, migrating-rules | diagram-generator, sequential-thinking, doc-generator | legacy_analysis, dependency_upgrade, rule_migration |
| **accessibility-expert** | rule-auditor, chrome-devtools, computer-use | repo-rag, doc-generator, diagram-generator | a11y_audit, browser_testing, ui_testing |
| **compliance-auditor** | rule-auditor, dependency-analyzer, explaining-rules | doc-generator, excel-generator, pdf-generator | compliance_audit, vulnerability_scan, audit_report |
| **incident-responder** | repo-rag, dependency-analyzer, sequential-thinking | doc-generator, diagram-generator, github | incident_analysis, root_cause_analysis, postmortem_docs |
| **model-orchestrator** | response-rater, context-bridge | recovery, conflict-resolution | response_evaluation, platform_routing, workflow_recovery |
| **code-simplifier** | repo-rag, code-style-validator, rule-auditor | fixing-rule-violations, diagram-generator | complexity_analysis, style_validation, rule_compliance |
| **master-orchestrator** | response-rater, recovery, artifact-publisher | context-bridge, conflict-resolution | plan_validation, workflow_orchestration, task_complete |
| **impact-analyzer** | sequential-thinking, repo-rag, diagram-generator | evaluator, response-rater | impact_assessment, change_analysis, risk_evaluation |
| **cloud-integrator** | cloud-run, dependency-analyzer, doc-generator | sequential-thinking, diagram-generator | cloud_integration, infrastructure_setup, deployment |
| **react-component-developer** | scaffolder, rule-auditor, test-generator | code-style-validator, repo-rag | component_creation, pattern_implementation, testing |
| **router** | response-rater, context-bridge | recovery, conflict-resolution | model_routing, platform_routing, workflow_selection |
| **gcp-cloud-agent** | cloud-run, dependency-analyzer, sequential-thinking | doc-generator, diagram-generator | gcp_integration, cloud_setup, infrastructure |
| **ai-council** | response-rater, sequential-thinking, evaluator | repo-rag, conflict-resolution | multi_model_validation, consensus_building, quality_check |
| **codex-validator** | code-style-validator, rule-auditor, evaluator | response-rater, test-generator | code_validation, multi_model_review, quality_assessment |
| **cursor-validator** | rule-auditor, evaluator, response-rater | code-style-validator, artifact-publisher | cursor_integration, platform_validation, compatibility_check |
| **gemini-validator** | evaluator, response-rater, sequential-thinking | artifact-publisher, classifier | gemini_integration, model_validation, response_quality |

## Rule Index System

The rule index enables Skills to discover all 1,081+ rules dynamically without hard-coding. This system uses progressive disclosure to minimize context usage.

### How It Works

1. **Index Generation**: Run `pnpm index-rules` to scan all rules and generate `.claude/context/rule-index.json`
2. **Rule Discovery**: Skills load the index and query `technology_map` to find relevant rules
3. **Progressive Disclosure**: Only relevant rules are loaded (5-10 rules), not all 1,081
4. **Dynamic Updates**: Adding new rules requires regenerating the index, not changing skill code

### Index Structure

The index contains:
- **Metadata**: Path, name, description, technologies for each rule
- **Technology Map**: Fast lookup of rules by technology (e.g., `nextjs`, `python`, `cypress`)
- **Rule Types**: Master rules (`.claude/rules-master/`) vs Library rules (`.claude/rules-library/`)

### Regenerating the Index

When rules are added or updated:
```bash
pnpm index-rules
```

This scans all rules and updates `.claude/context/rule-index.json`. All Skills automatically discover new rules without code changes.

**Self-Healing Index**: If a requested rule is not found in the index, offer to run `pnpm index-rules` to regenerate it. This handles cases where new rules were added but the index wasn't updated.

### Skills Using the Index

- **explaining-rules**: Discovers rules applicable to files
- **fixing-rule-violations**: Locates violated rules for fix instructions
- **recommending-rules**: Compares codebase against all indexed rules
- **migrating-rules**: Compares rule versions for migration plans
- **rule-auditor**: Finds applicable rules for auditing
- **rule-selector**: Discovers rules for tech stack configuration
- **scaffolder**: Finds relevant rules for code generation

See `.claude/docs/RULE_INDEX_MIGRATION.md` for detailed migration guide.

## Enforcement System (Phase 1)

The enforcement system provides hard validation gates to ensure orchestration quality and security compliance. Three integrated enforcement modules work together:

### 1. Plan Rating Enforcement (enforcement-gate.mjs)

All plans MUST be rated before execution. This is enforced at the orchestrator level.

**How it works**:
- Orchestrator spawns Planner to create plan
- Orchestrator uses `response-rater` skill to evaluate plan quality
- Rating is recorded in `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`
- Minimum passing score: **7/10**
- If score < 7: Plan returned to Planner with specific feedback; re-rate after improvements
- If score >= 7: Workflow execution proceeds; rating logged in run state

**Validation command**:
```bash
node .claude/tools/enforcement-gate.mjs validate-plan --run-id <id> --plan-id <id> [--task-type <type>] [--complexity <level>]
```

**Rating matrix** (`.claude/context/plan-review-matrix.json`):
- Defines minimum scores by task type (feature, bug, refactor, etc.)
- Defines complexity modifiers (+0.5 for complex, -0.5 for simple)
- Defines blocking thresholds for component-level scores

### 2. Signoff Validation (enforcement-gate.mjs)

Workflow steps may require signoffs from specific agents (e.g., security-architect for auth changes).

**Configuration** (`.claude/context/signoff-matrix.json`):
- Workflow-level signoff requirements (required_signoffs)
- Conditional signoffs (triggered by task keywords)
- Signoff rules (blocking behavior, conditions)

**Validation command**:
```bash
node .claude/tools/enforcement-gate.mjs validate-signoffs --run-id <id> --workflow <name> --step <n> [--task "<description>"]
```

**Signoff types**:
- **Artifact-based**: Requires specific artifact to be present (e.g., security-review.json)
- **Conditional-based**: Triggered by keywords in task description
- **Agent-based**: Requires sign-off from specific agents

### 3. Security Trigger Enforcement (security-enforcement.mjs, enforcement-gate.mjs)

Security-sensitive tasks are automatically routed to required agents and can block execution if agents are missing.

**Configuration** (`.claude/context/security-triggers-v2.json`):
- **12 security categories** covering 136+ keywords:
  - Authentication & Authorization (oauth, password, jwt, etc.)
  - Data Encryption & Privacy (encrypt, decrypt, pii, etc.)
  - Vulnerability Management (sql injection, xss, etc.)
  - API Security (rate limiting, cors, etc.)
  - And 8 more categories
- **Critical combinations**: Multi-category triggers with priority override
- **Escalation rules**: Define blocking behavior by priority (low, medium, high, critical)

**How it works**:
1. Task description is analyzed for security keywords
2. Matching categories trigger required agents
3. If agents are missing and priority is "critical" → **BLOCKED**
4. If agents are missing and priority < "critical" → **WARNING**

**Validation command**:
```bash
node .claude/tools/enforcement-gate.mjs validate-security --task "<description>" [--agents <agent1,agent2>]
```

**Priority levels and blocking**:
- `critical`: BLOCKS execution if required agents missing
- `high`: WARNING if agents missing, execution proceeds
- `medium`: WARNING only, no blocking
- `low`: INFO only

**Example security triggers**:
- Keywords "oauth", "authentication" → triggers: `security-architect` (required), `developer` (recommended)
- Keywords "password", "credentials" → triggers: `security-architect` (required)
- Keywords "sql injection", "xss" + "database" → critical combination → blocks unless `security-architect` assigned

### Master Gate Function

Combine all three validations with `validate-all`:

```bash
node .claude/tools/enforcement-gate.mjs validate-all \
  --run-id <id> \
  --workflow <name> \
  --step <n> \
  --plan-id <id> \
  --task "<description>" \
  --agents <agent1,agent2> \
  [--task-type <type>] \
  [--complexity <level>]
```

Returns JSON with:
- `allowed`: Boolean - proceed with execution?
- `blockers`: Array of blocking issues
- `warnings`: Array of non-blocking issues
- `validations`: Detailed results for plan, signoffs, security
- `summary`: Human-readable summary

**Exit codes**:
- `0`: All gates passed, execution allowed
- `1`: One or more gates failed, execution blocked

### Integration with Workflows

**Before executing workflow step**:
1. Run enforcement-gate validate-all
2. If `allowed: false` → stop, report blockers
3. If `allowed: true` → proceed with step execution

**In Master Orchestrator**:
1. After Planner produces plan, rate with response-rater
2. Record rating with `enforcement-gate.mjs record-rating`
3. Before each workflow step, validate with enforce-gate
4. Document all ratings and signoffs in run state

## Master Orchestrator Entry Point

**NEW: All user requests are routed through the Master Orchestrator first**

The Master Orchestrator (`.claude/agents/master-orchestrator.md`) is the single entry point for all user requests. It provides a seamless, infinite flow experience by managing the entire project lifecycle without user-visible interruptions.

### Master Orchestrator Flow

When a user prompt is received:

1. **Route to Master Orchestrator**: All requests go to Master Orchestrator first
2. **Spawn Planner**: Master Orchestrator spawns Planner to scope the work
3. **Review and Rate Plan**: Master Orchestrator reviews the plan for completeness
   - **MANDATORY**: Use response-rater skill to evaluate plan quality
   - **Minimum score**: 7/10 required to proceed
   - **If score < 7**: Return to Planner with feedback, request improvements
   - **If score >= 7**: Proceed with execution, log rating in reasoning file
   - **Never execute an unrated plan**
4. **Dynamic Workflow Instantiation**: Master Orchestrator dynamically creates or selects workflows based on plan
5. **Coordinate Execution**: Master Orchestrator delegates to specialized agents via Task tool
6. **Monitor Progress**: Master Orchestrator tracks progress via Project Database
7. **Update Dashboard**: Master Orchestrator maintains live dashboard.md artifact

See `.claude/workflows/WORKFLOW-GUIDE.md` for detailed workflow documentation and legacy routing fallback.

### Legacy Routing (Fallback)

If Master Orchestrator is bypassed, the legacy keyword-based routing system activates:
- User prompt keywords matched against `workflow_selection` in `config.yaml`
- Lowest priority number wins among matching workflows
- Falls back to `fullstack` workflow if no matches
- Still uses `workflow_runner.js` for step validation

**Example**: "Fix the production incident with auth" matches both `incident` (priority 0) and `fullstack` (priority 2). Since 0 < 2, `incident` workflow is selected.

## Workflow Execution

### Starting a Run (Recommended)

Use run-manager to create a canonical run before executing steps:
```bash
node .claude/tools/run-manager.mjs create --run-id <id> --workflow .claude/workflows/<name>.yaml
```

Alternatively, invoke Master Orchestrator directly - it will create runs automatically.

**Validation Command** (includes enforcement gates):
```bash
node .claude/tools/workflow_runner.js --workflow .claude/workflows/<name>.yaml --step <N> --id <workflow_id>
```

**With explicit enforcement**:
```bash
node .claude/tools/enforcement-gate.mjs validate-all \
  --run-id <id> \
  --workflow <name> \
  --step <N> \
  --task "<task_description>" \
  --agents <agent1,agent2>
```

**Key Points**:
- Workflows execute steps sequentially, each activating an agent from `.claude/agents/`
- Artifacts saved to `.claude/context/artifacts/`, referenced as `<artifact>.json (from step N)`
- Validation creates gate files in `.claude/context/history/gates/<workflow_id>/`
- Max 3 retries on validation failure; session state in `.claude/context/session.json`

### Security Enforcement in Workflows

Workflows automatically enforce security requirements through enforcement gates:

**Automatic Security Checks**:
- Task description analyzed for security keywords
- Required agents automatically assigned
- If critical security agents missing → **execution blocked**
- Warnings logged for non-blocking security gaps

**Security-Sensitive Workflows**:
- `auth-flow.yaml`: Automatically includes security-architect
- `data-protection-flow.yaml`: Includes security-architect and compliance-auditor
- `legacy-modernization-flow.yaml`: Includes security-architect for breaking changes
- Any workflow with keywords like "oauth", "password", "encryption", "sql injection", etc.

**Overriding Security Blocks**:
- Only orchestrator can approve security exceptions
- Requires documented justification
- Requires compliance-auditor sign-off for high-priority security tasks

### New Workflows (Phase 1)

| Workflow | Purpose | Primary Agent | Security Required |
|----------|---------|---------------|-------------------|
| `legacy-modernization-flow.yaml` | Modernize legacy systems | legacy-modernizer | Yes (breaking changes) |
| `code-quality-flow.yaml` | Improve code quality | refactoring-specialist | No |
| `incident-flow.yaml` | Respond to production incidents | incident-responder | Conditional |

### Troubleshooting workflow_runner.js

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing workflow_id" | `--id` not provided | Add `--id <workflow-id>` to command |
| Gate path not found | Directory doesn't exist | Directories are created at runtime; re-run with valid `--id` |
| Artifact not found | Previous step didn't complete | Run previous steps first; check `.claude/context/artifacts/` |
| Schema validation failed | Output doesn't match schema | Read gate file for specific errors; fix agent output |
| "BLOCKED: Security-sensitive task" | Security triggers matched, agents missing | Add required security agents or get approval to override |
| "Plan rating not found" | Plan not rated before execution | Use response-rater skill to rate plan, then re-validate |

### Workflow Validation

Each workflow step can specify validation:
```yaml
validation:
  schema: .claude/schemas/project_brief.schema.json
  gate: .claude/context/history/gates/{{workflow_id}}/01-analyst.json
```

Validation process: Run `workflow_runner.js` → Load schema → Validate output JSON → Create gate file with results. If validation fails, agent receives feedback for correction.

### Template Variables

Workflow artifacts and paths support template variable interpolation:
- `{{workflow_id}}`: Unique identifier (required, passed via `--id`)
- `{{story_id}}`: Story identifier for story loops (optional, passed via `--story-id`)
- `{{epic_id}}`: Epic identifier for epic loops (optional, passed via `--epic-id`)

Required variables must be provided or execution fails. Optional variables remain as-is if not provided.

### Error Handling and Retry Logic

When validation fails:
1. **Read Gate File**: Load the gate file to understand failures
2. **Analyze Errors**: Identify schema violations or missing fields
3. **Provide Feedback**: Give agent clear feedback for correction
4. **Retry Step**: Re-validate with `workflow_runner.js` (max 3 retries)

If step fails after max retries, pause workflow and request user guidance.

### Run State Management

**Canonical State Location**: `.claude/context/runs/<run_id>/` (managed by `run-manager.mjs`)
- Artifacts: `.claude/context/runs/<run_id>/artifacts/`
- Gates: `.claude/context/runs/<run_id>/gates/`
- Registry: `.claude/context/runs/<run_id>/artifact-registry.json`

### Backward Compatibility

**Legacy Mode** (still supported):
- Session state: `.claude/context/session.json`
- Artifacts: `.claude/context/artifacts/`
- Gates: `.claude/context/history/gates/<workflow_id>/`

**New Mode** (recommended):
- All state: `.claude/context/runs/<run_id>/` (managed by `run-manager.mjs`)

Both modes are runtime-created; absence of these directories in the repo is expected. New workflows should use runs directory; legacy paths supported for existing integrations.

See `.claude/workflows/WORKFLOW-GUIDE.md` for detailed execution instructions, YAML structure, and error handling.

## Universal Development Rules

### Code Quality (MUST)
- **MUST** create a Plan Mode artifact before modifying more than one file
- **MUST** generate or update automated tests covering critical paths before requesting merge
- **MUST** keep security controls (authz, secrets, PII) unchanged unless explicitly tasked
- **MUST** document decisions in Artifacts or repo ADRs when deviating from defaults

### Collaboration (SHOULD)
- **SHOULD** use Claude Projects instructions for shared vocabulary, business context, and tone [2].
- **SHOULD** sync Cursor and Droid executions back into the Claude Project activity feed after major milestones.
- **SHOULD** promote Artifacts to versioned documents for UI/UX deliverables.
- **SHOULD** prefer Claude's built-in repo search and diff MCP skills over manual file browsing.

### Safeguards (MUST NOT)
- **MUST NOT** delete secrets, env files, or production infrastructure manifests
- **MUST NOT** bypass lint/test hooks; rerun failed commands with context
- **MUST NOT** push directly to protected branches; use reviewed pull requests
- **MUST NOT** rely on hallucinated APIs—verify via docs or code search MCP.

## Default Action Behavior

<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent is unclear, infer the most useful likely action and proceed, using tools to discover any missing details instead of guessing. Try to infer the user's intent about whether a tool call (e.g., file edit or read) is intended or not, and act accordingly.
</default_to_action>

## Parallel Tool Execution

<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel. Prioritize calling tools simultaneously whenever the actions can be done in parallel rather than sequentially. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time. Maximize use of parallel tool calls where possible to increase speed and efficiency. However, if some tool calls depend on previous calls to inform dependent values like the parameters, do NOT call these tools in parallel and instead call them sequentially. Never use placeholders or guess missing parameters in tool calls.
</use_parallel_tool_calls>

## Slash Commands

### Core Commands
| Command | Purpose |
|---------|---------|
| `/review` | Comprehensive code review |
| `/fix-issue <n>` | Fix GitHub issue by number |
| `/quick-ship` | Fast iteration for small changes |
| `/run-workflow` | Execute a workflow step with validation |
| `/validate-gates` | Run all enforcement gates (plan, signoffs, security) |

### Skill Commands
| Command | Purpose |
|---------|---------|
| `/select-rules` | Auto-detect tech stack and configure rules |
| `/audit` | Validate code against loaded rules |
| `/scaffold` | Generate rule-compliant boilerplate |
| `/rate-plan` | Rate a plan using response-rater (min score 7/10) |

### Workflow Commands
| Command | Purpose |
|---------|---------|
| `/code-quality` | Code quality improvement workflow |
| `/performance` | Performance optimization workflow |
| `/ai-system` | AI/LLM system development workflow |
| `/mobile` | Mobile application workflow |
| `/incident` | Incident response workflow |
| `/legacy-modernize` | Legacy system modernization workflow |

### Enforcement Commands (Phase 1)
| Command | Purpose |
|---------|---------|
| `/check-security <task>` | Analyze task for security triggers |
| `/enforce-security` | Block execution if security agents missing |
| `/approve-security` | Override security blocks (orchestrator only) |
| `/validate-plan-rating <run-id>` | Validate plan meets minimum score |
| `/validate-signoffs <run-id> <workflow> <step>` | Check signoff requirements |

See `.claude/agents/developer.md` for common commands and workflows.

## Core Files

### Configuration
- `.claude/config.yaml`: Agent routing and workflow configuration
- `.claude/settings.json`: Tool permissions
- `CLAUDE.md`: This file (root instructions)

### Enforcement System (Phase 1)
- `.claude/context/skill-integration-matrix.json`: Maps 34 agents to 43 skills with triggers
- `.claude/context/plan-review-matrix.json`: Plan rating scores by task type and complexity
- `.claude/context/signoff-matrix.json`: Signoff requirements by workflow and step
- `.claude/context/security-triggers-v2.json`: 12 security categories with 136+ keywords

### Enforcement Tools
- `.claude/tools/enforcement-gate.mjs`: Hard validation gates (plan ratings, signoffs, security)
- `.claude/tools/security-enforcement.mjs`: Security trigger integration and routing
- `.claude/tools/validate-security-integration.mjs`: CI/CD validation for security triggers

### Agent System
- `.claude/agents/`: 24 agent prompts (now includes impact-analyzer, cloud-integrator, react-component-developer, planner)
- `.claude/skills/`: 45 utility skills (34 native + 9 MCP-converted + 2 new recovery skills)
- `.claude/workflows/`: 12 workflow definitions including legacy-modernization-flow.yaml (see `WORKFLOW-GUIDE.md`)
- `.claude/templates/`: 14 artifact templates
- `.claude/schemas/`: 13 JSON validation schemas

### Templates (14 Artifacts)

| Template | Agent | Purpose |
|----------|-------|---------|
| project-brief.md | analyst | Project discovery and brief |
| prd.md | pm | Product requirements |
| architecture.md | architect | System architecture |
| ui-spec.md | ux-expert | Interface specifications |
| test-plan.md | qa | Test strategy |
| implementation-plan.md | developer | Implementation plan |
| code-review-report.md | code-reviewer | Code review findings |
| performance-plan.md | performance-engineer | Performance optimization |
| llm-architecture.md | llm-architect | AI/LLM system design |
| incident-report.md | incident-responder | Incident post-mortem |
| refactor-plan.md | refactoring-specialist | Refactoring strategy |

### Security
- `.claude/hooks/security-pre-tool.sh`: Security validation hook
- `.claude/hooks/audit-post-tool.sh`: Audit logging hook
- `.claude/system/guardrails/guardrails.md`: Command safety and PII policies
- `.claude/system/permissions/permissions.md`: Tool permission policies

## Security & Secrets Management

### Protected Operations
- **BLOCKED**: `.env*` files, `secrets/` directory, credential files
- **BLOCKED**: Dangerous commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`)
- **BLOCKED**: Force push to main/master

### Tool Permissions
- **Always Allowed**: Read, Search
- **Require Confirmation**: Edit, Bash
- **Always Blocked**: Destructive operations

### Security Trigger System (Phase 1)

The system automatically enforces security requirements through semantic analysis of task descriptions.

**12 Security Categories** (136+ keywords total):
1. **Authentication & Authorization** (oauth, jwt, password, credentials, oidc, saml, rbac, acl, etc.)
2. **Data Encryption & Privacy** (encrypt, decrypt, pii, sensitive, gdpr, ccpa, etc.)
3. **Vulnerability Management** (sql injection, xss, csrf, directory traversal, etc.)
4. **API Security** (rate limiting, cors, authentication headers, api key management, etc.)
5. **Session Management** (session hijacking, cookie security, session timeout, etc.)
6. **Network Security** (tls, ssl, https, firewall, network segmentation, etc.)
7. **Code Injection** (eval, code execution, arbitrary code, remote code, etc.)
8. **Compliance & Auditing** (audit log, logging, traceability, compliance, certification, etc.)
9. **Dependency Security** (outdated, vulnerable, malware, supply chain, etc.)
10. **Input Validation** (validation, sanitization, input filtering, etc.)
11. **Secrets Management** (api key, secret, token, credential, vault, etc.)
12. **Access Control** (permission, authorization, privilege escalation, etc.)

**How Security Triggers Work**:
1. Task description is scanned for keywords in all 12 categories
2. Matching categories trigger required agent assignments
3. Required agents for each category specified in `security-triggers-v2.json`
4. Critical combinations (e.g., "sql injection" + "database change") may elevate priority to "critical"
5. If critical priority and agents missing → **execution blocked**

**Agent Assignment by Category** (examples):
- Authentication: security-architect (required), developer (recommended)
- Encryption: security-architect (required), compliance-auditor (recommended)
- Vulnerability: security-architect (required)
- SQL Injection + Database: critical combo → BLOCKS unless security-architect assigned

**Escalation Rules by Priority**:
- `critical`: Blocks execution if required agents missing; requires security-architect sign-off
- `high`: Warns if agents missing; execution proceeds with caution flag
- `medium`: Logs warning only
- `low`: Logs info only

**Security Trigger Configuration** (`.claude/context/security-triggers-v2.json`):
- Category definitions with keywords
- Required/recommended agents per category
- Critical combination rules
- Escalation rules with blocking behavior

**Bypassing Security Blocks**:
- Only orchestrator can override security blocks
- Requires documented approval from security-architect
- Requires compliance-auditor sign-off for critical priority
- Override decision logged in run state with justification

## Setup

1. Copy `.claude/`, `.cursor/`, `.factory/` into your project
2. Agents activate based on task keywords
3. Use slash commands for quick workflows

See `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md` for detailed setup and validation.

See `.claude/agents/` for agent-specific triggers and workflows.

## New Features

| Feature | Purpose | Documentation |
|---------|---------|---------------|
| Everlasting Agents | Unlimited project duration via context recycling | `.claude/docs/EVERLASTING_AGENTS.md` |
| Phase-Based Projects | Projects organized into phases (1-3k lines each) | `.claude/docs/PHASE_BASED_PROJECTS.md` |
| Dual Persistence | CLAUDE.md + memory skills for redundancy | `.claude/docs/MEMORY_PATTERNS.md` |
| Context Editing | Auto-compaction at token limits | `.claude/docs/CONTEXT_OPTIMIZATION.md` |
| Evaluation Framework | Agent performance + rule compliance grading | `.claude/docs/EVALUATION_GUIDE.md` |
| Tool Search | Semantic tool discovery (90%+ savings) | `.claude/docs/ADVANCED_TOOL_USE.md` |
| Document Generation | Excel, PowerPoint, PDF output | `.claude/docs/DOCUMENT_GENERATION.md` |
| Advanced Orchestration | Subagent patterns, hooks, slash commands | `.claude/docs/ORCHESTRATION_PATTERNS.md` |

## Documentation

- **Setup Guide**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Enterprise Guardrails**: `.claude/system/guardrails/` and `.claude/system/permissions/`
- **Agent Details**: `.claude/agents/` (each agent has full documentation)
- **Skill Details**: `.claude/skills/` (each skill has SKILL.md documentation)
- **Instructions**: `.claude/instructions/` (operational playbooks)

## MCP Integration (Optional)

The `.claude/.mcp.json` file contains optional MCP server configurations. This project does NOT ship an MCP server - these are configs consumed by Claude Code when you set the required environment variables.

**Prefer Skills over MCP**: Most MCP servers have been converted to Skills for 90%+ context savings. Use Skills (`.claude/skills/`) instead of MCP when possible. See "MCP-Converted Skills" section under Skills.

**When to Keep MCP**:
- Core tools needed every conversation (1-5 tools)
- Complex OAuth flows or persistent connections
- Tools not yet converted to Skills

| Server | Purpose | Skill Alternative | Environment Variable |
|--------|---------|-------------------|---------------------|
| repo | Codebase search | `repo-rag` skill | None (auto-configured) |
| github | GitHub integration | `github` skill | `GITHUB_TOKEN` |
| filesystem | File operations | `filesystem` skill | None |
| git | Git operations | `git` skill | None |
| memory | Knowledge graph | `memory` skill | None |
| cloud-run | Cloud Run deployment | `cloud-run` skill | `GOOGLE_CLOUD_PROJECT` |
| linear | Linear issues | - | `LINEAR_API_KEY` |
| slack | Notifications | - | `SLACK_BOT_TOKEN` |

**Tool Search Tool (Beta)**: For projects still using many MCP tools (20+), enable Anthropic's Tool Search Tool beta feature with `deferLoading: true` in `.claude/.mcp.json`. See `.claude/docs/ADVANCED_TOOL_USE.md` for details.

## Context Management

**Lazy-Loaded Rules**: Reference master rules with `@.claude/rules-master/<rule>.md` syntax. Rules load only when agents activate.

**Available Master Rules**:
- `@.claude/rules-master/PROTOCOL_ENGINEERING.md` - Universal engineering standards
- `@.claude/rules-master/TECH_STACK_NEXTJS.md` - Next.js/React/TypeScript
- `@.claude/rules-master/TOOL_CYPRESS_MASTER.md` - Cypress testing
- `@.claude/rules-master/TOOL_PLAYWRIGHT_MASTER.md` - Playwright testing
- `@.claude/rules-master/LANG_PYTHON_GENERAL.md` - Python rules
- `@.claude/rules-master/FRAMEWORK_FASTAPI.md` - FastAPI rules
- `@.claude/rules-master/LANG_SOLIDITY.md` - Solidity rules

**Auto-Compaction**: Context window auto-compacts at limits. Don't stop tasks early due to token concerns - complete work fully.

**Multi-Session State**: For long tasks, use `tests.json` (structured), `progress.txt` (notes), and git commits for state tracking.

**Session Commands**: `/clear` between tasks, `/compact` for long sessions.

See `.claude/docs/CONTEXT_OPTIMIZATION.md` for details.

## Context Window Management

Your context window will be automatically compacted as it approaches its limit, allowing you to continue working indefinitely. Do not stop tasks early due to token budget concerns - complete tasks fully.

For tasks spanning multiple context windows:
1. Use the first context window to set up a framework (write tests, create setup scripts)
2. Use future context windows to iterate on a todo-list
3. Write tests in a structured format (e.g., `tests.json`) before starting work
4. Create setup scripts (e.g., `init.sh`) to gracefully start servers, run test suites, and linters
5. When a context window is cleared, start fresh by calling `pwd`, reviewing `progress.txt`, `tests.json`, and git logs
6. Manually run through a fundamental integration test before moving on to implementing new features

### State Management

For long-horizon tasks spanning multiple context windows:

**Use structured formats for state data**: When tracking structured information (like test results or task status), use JSON or other structured formats to help Claude understand schema requirements.

**Use unstructured text for progress notes**: Freeform progress notes work well for tracking general progress and context.

**Use git for state tracking**: Git provides a log of what's been done and checkpoints that can be restored. Claude 4.5 models perform especially well in using git to track state across multiple sessions.

**Emphasize incremental progress**: Explicitly ask Claude to keep track of its progress and focus on incremental work.

Example state files:
- `tests.json`: Structured test results
- `progress.txt`: Freeform progress notes
- Git commits: State checkpoints

## Escalation Playbook

1. Flag blockers in the Claude Project feed; attach the current artifact or plan
2. Page the appropriate subagent (Architect vs. QA vs. PM) via subagent commands
3. If automation fails, fall back to manual CLI with the same rules

## References

Quick navigation to key documentation:
- **Setup**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Workflows**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Enforcement**: `.claude/context/` (skill matrix, plan review, signoffs, security triggers)
- **Agents**: `.claude/agents/` (24 agent definitions)
- **Skills**: `.claude/skills/` (45 skill definitions)
- **Rules**: `.claude/rules-master/` (8 master rules) + `.claude/rules-library/` (1,073 library rules)
- **Templates**: `.claude/templates/` (14 artifact templates)
- **Schemas**: `.claude/schemas/` (13 validation schemas)

## Phase 1 Enhancement Summary

**Orchestration Enforcement Foundation** includes:

1. **Agent-Skill Integration**: 34 agents × 43 skills = comprehensive skill mapping with triggers
2. **Plan Rating Enforcement**: Mandatory 7/10 minimum score via response-rater before execution
3. **Signoff Validation**: Workflow step approvals and conditional signoffs
4. **Security Trigger System**: 12 categories, 136+ keywords, automatic agent routing with blocking
5. **Master Gate Function**: Unified validation combining plans, signoffs, and security
6. **Tool Support**: enforcement-gate.mjs for CLI validation and CI/CD integration
7. **Workflow Updates**: 12 workflows with security enforcement, legacy modernization support
8. **Agent Additions**: planner, impact-analyzer, cloud-integrator, react-component-developer

See `.claude/CLAUDE.md` (this file) for authoritative orchestration rules.