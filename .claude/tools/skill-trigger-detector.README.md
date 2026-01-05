# Skill Trigger Detector

Detects which skills should be activated for a given agent type and task description based on the skill-integration-matrix.json.

## Purpose

This tool matches task descriptions against comprehensive trigger patterns to determine:
- **Required skills**: Always needed for the agent
- **Triggered skills**: Activated based on task keywords
- **Recommended skills**: Optional but useful
- **All skills**: Combined required + triggered
- **Matched triggers**: Which trigger patterns were detected

## Usage

```bash
node .claude/tools/skill-trigger-detector.mjs --agent <agent-type> --task "<task-description>"
```

## Examples

### Developer Agent

```bash
# Component creation
node .claude/tools/skill-trigger-detector.mjs \
  --agent developer \
  --task "Create new UserProfile component"

# Output:
# {
#   "required": ["scaffolder", "rule-auditor", "repo-rag"],
#   "triggered": ["scaffolder"],
#   "recommended": ["test-generator", "claude-md-generator", ...],
#   "all": ["scaffolder", "rule-auditor", "repo-rag"],
#   "matchedTriggers": ["new_component"]
# }
```

### Code Reviewer Agent

```bash
# Security review
node .claude/tools/skill-trigger-detector.mjs \
  --agent code-reviewer \
  --task "Review security changes in auth module"

# Output:
# {
#   "required": ["rule-auditor", "code-style-validator", "explaining-rules"],
#   "triggered": ["rule-auditor"],
#   "recommended": ["fixing-rule-violations", "dependency-analyzer", ...],
#   "all": ["rule-auditor", "code-style-validator", "explaining-rules"],
#   "matchedTriggers": ["review_code", "code_review", "security_audit"]
# }
```

### Architect Agent

```bash
# Architecture diagram
node .claude/tools/skill-trigger-detector.mjs \
  --agent architect \
  --task "Design architecture diagram for payment microservice"

# Output:
# {
#   "required": ["diagram-generator", "repo-rag", "dependency-analyzer"],
#   "triggered": ["diagram-generator"],
#   "recommended": ["doc-generator", "api-contract-generator", ...],
#   "all": ["diagram-generator", "repo-rag", "dependency-analyzer"],
#   "matchedTriggers": ["architecture_diagram", "diagrams"]
# }
```

### QA Agent

```bash
# Test creation
node .claude/tools/skill-trigger-detector.mjs \
  --agent qa \
  --task "Write unit tests for login feature"

# Output:
# {
#   "required": ["test-generator", "rule-auditor", "evaluator"],
#   "triggered": ["test-generator"],
#   "recommended": ["response-rater", "chrome-devtools", ...],
#   "all": ["test-generator", "rule-auditor", "evaluator"],
#   "matchedTriggers": ["test_creation"]
# }
```

### Security Architect Agent

```bash
# Security audit
node .claude/tools/skill-trigger-detector.mjs \
  --agent security-architect \
  --task "Perform security audit on authentication flow"

# Output:
# {
#   "required": ["rule-auditor", "dependency-analyzer", "explaining-rules"],
#   "triggered": ["rule-auditor"],
#   "recommended": ["repo-rag", "doc-generator", ...],
#   "all": ["rule-auditor", "dependency-analyzer", "explaining-rules"],
#   "matchedTriggers": ["security_audit"]
# }
```

### Legacy Modernizer Agent

```bash
# Legacy migration
node .claude/tools/skill-trigger-detector.mjs \
  --agent legacy-modernizer \
  --task "Migrate old codebase to new framework"

# Output:
# {
#   "required": ["repo-rag", "dependency-analyzer", "migrating-rules"],
#   "triggered": ["repo-rag"],
#   "recommended": ["diagram-generator", "sequential-thinking", ...],
#   "all": ["repo-rag", "dependency-analyzer", "migrating-rules"],
#   "matchedTriggers": ["legacy_analysis"]
# }
```

### Technical Writer Agent

```bash
# PDF generation
node .claude/tools/skill-trigger-detector.mjs \
  --agent technical-writer \
  --task "Generate PDF documentation for API endpoints"

# Output:
# {
#   "required": ["doc-generator", "diagram-generator", "summarizer"],
#   "triggered": ["pdf-generator"],
#   "recommended": ["claude-md-generator", "pdf-generator", ...],
#   "all": ["doc-generator", "diagram-generator", "summarizer", "pdf-generator"],
#   "matchedTriggers": ["pdf_reports"]
# }
```

### Database Architect Agent

```bash
# Schema diagram
node .claude/tools/skill-trigger-detector.mjs \
  --agent database-architect \
  --task "Create ER diagram for user management schema"

# Output:
# {
#   "required": ["diagram-generator", "text-to-sql", "dependency-analyzer"],
#   "triggered": ["diagram-generator"],
#   "recommended": ["doc-generator", "repo-rag"],
#   "all": ["diagram-generator", "text-to-sql", "dependency-analyzer"],
#   "matchedTriggers": ["schema_diagram", "diagrams"]
# }
```

### DevOps Agent

```bash
# Deployment
node .claude/tools/skill-trigger-detector.mjs \
  --agent devops \
  --task "Deploy application to Cloud Run using infrastructure automation"

# Output:
# {
#   "required": ["cloud-run", "dependency-analyzer"],
#   "triggered": ["cloud-run"],
#   "recommended": ["doc-generator", "diagram-generator", "git"],
#   "all": ["cloud-run", "dependency-analyzer"],
#   "matchedTriggers": ["deployment"]
# }
```

## Available Agent Types

- `orchestrator`
- `developer`
- `code-reviewer`
- `qa`
- `architect`
- `security-architect`
- `technical-writer`
- `planner`
- `analyst`
- `pm`
- `ux-expert`
- `database-architect`
- `devops`
- `llm-architect`
- `api-designer`
- `mobile-developer`
- `performance-engineer`
- `refactoring-specialist`
- `legacy-modernizer`
- `accessibility-expert`
- `compliance-auditor`
- `incident-responder`
- `model-orchestrator`
- `code-simplifier`

## Trigger Pattern Categories

The detector uses 60+ comprehensive trigger patterns across these categories:

- **Component/Feature Creation**: `new_component`, `new_module`
- **Code Operations**: `code_changes`, `review_code`, `code_review`
- **Search & Analysis**: `codebase_search`, `pattern_search`, `codebase_analysis`
- **Testing**: `test_creation`, `browser_testing`, `ui_testing`
- **Quality**: `style_review`, `style_check`, `quality_check`, `rule_compliance`
- **Architecture**: `architecture_diagram`, `plan_diagram`, `schema_diagram`
- **Documentation**: `documentation`, `api_docs`, `component_docs`, `module_docs`
- **Security**: `security_audit`, `vulnerability_scan`, `threat_modeling`
- **Performance**: `performance_pattern_search`, `optimization_analysis`
- **Database**: `query_generation`, `orm_analysis`
- **Planning**: `plan_creation`, `requirement_planning`
- **Analysis**: `complex_analysis`, `legacy_analysis`, `incident_analysis`
- **Dependencies**: `dependency_update`, `dependency_upgrade`, `dependency_check`
- **Reports**: `pdf_reports`, `presentations`, `audit_report`
- **And many more...**

## Programmatic Usage

```javascript
import { detectAllSkills } from './.claude/tools/skill-trigger-detector.mjs';

const result = await detectAllSkills('developer', 'Create new UserProfile component');

console.log(result.required);      // Always needed skills
console.log(result.triggered);     // Task-activated skills
console.log(result.recommended);   // Optional skills
console.log(result.all);           // Combined required + triggered
console.log(result.matchedTriggers); // Which triggers matched
```

## Integration with Phase 2 Orchestration

This tool is part of the Phase 2 skill orchestration enhancement. It enables:

1. **Automatic Skill Injection**: Orchestrator can detect which skills to load for each agent
2. **Context Optimization**: Load only relevant skills, reducing context usage
3. **Dynamic Skill Discovery**: No hard-coding of skill dependencies
4. **Consistent Triggering**: Same task always triggers same skills across agents

## Pattern Matching Strategy

Patterns use flexible word boundary matching (`\b.*\b`) to handle:
- Multiple words between key terms: "Create **new UserProfile** component"
- Different word orders: "security audit" vs "audit security"
- Variations in phrasing: "write tests" vs "create unit tests"

## Error Handling

```bash
# Missing required argument
node .claude/tools/skill-trigger-detector.mjs --agent developer
# Error: Usage: node skill-trigger-detector.mjs --agent <agent-type> --task "<task-description>"

# Invalid agent type
node .claude/tools/skill-trigger-detector.mjs --agent invalid --task "Test"
# Error: Agent type "invalid" not found in skill matrix
```

## Exit Codes

- `0`: Success
- `1`: Error (invalid arguments, agent not found, etc.)
