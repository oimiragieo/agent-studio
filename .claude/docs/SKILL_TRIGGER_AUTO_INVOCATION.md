# Skill Trigger Auto-Invocation

## Overview

The skill trigger system automatically detects and invokes skills based on task descriptions. This reduces manual skill invocation overhead and ensures consistent skill usage across workflows.

## How It Works

### 1. Trigger Detection

When the orchestrator processes a user request:

1. Task description is analyzed against 216 trigger patterns
2. Patterns match keywords and phrases (e.g., "create component" → `new_component`)
3. Matched triggers are mapped to agent-specific skills

### 2. Skill Matching

Each agent has a `skill_triggers` mapping in `.claude/context/skill-integration-matrix.json`:

```json
{
  "agents": {
    "developer": {
      "required_skills": ["scaffolder", "rule-auditor", "repo-rag"],
      "skill_triggers": {
        "new_component": "scaffolder",
        "code_changes": "rule-auditor",
        "codebase_search": "repo-rag"
      }
    }
  }
}
```

### 3. Auto-Invocation

Triggered skills are:

- **Added to execution plan**: Skills automatically included in step execution
- **Logged to artifacts**: All triggers saved to `skill-detection.json`
- **Validated post-execution**: `skill-validator.mjs` checks for actual usage

### 4. Execution Flow

```
User Request
    ↓
orchestrator-entry.mjs → detectAllSkills(agentType, taskDescription)
    ↓
skill-trigger-detector.mjs → matchTriggers(taskDescription)
    ↓
Matched triggers → Mapped to skills → Added to execution plan
    ↓
workflow_runner.js → Executes step with triggered skills
    ↓
skill-validator.mjs → Validates skill usage post-execution
```

## Trigger Patterns

### Component/Feature Creation

| Trigger         | Pattern                                               | Invoked Skill       |
| --------------- | ----------------------------------------------------- | ------------------- |
| `new_component` | "create component", "new feature", "implement module" | scaffolder          |
| `new_module`    | "create module", "add folder", "initialize package"   | claude-md-generator |

### Code Modification

| Trigger        | Pattern                                            | Invoked Skill |
| -------------- | -------------------------------------------------- | ------------- |
| `code_changes` | "modify code", "update function", "refactor class" | rule-auditor  |
| `review_code`  | "review code", "analyze PR", "inspect changes"     | rule-auditor  |

### Documentation

| Trigger             | Pattern                                            | Invoked Skill |
| ------------------- | -------------------------------------------------- | ------------- |
| `documentation`     | "write docs", "create readme", "api documentation" | doc-generator |
| `architecture_docs` | "document architecture", "system design docs"      | doc-generator |

### Testing

| Trigger           | Pattern                                                | Invoked Skill   |
| ----------------- | ------------------------------------------------------ | --------------- |
| `test_creation`   | "write tests", "generate test suite", "add unit tests" | test-generator  |
| `browser_testing` | "test in browser", "chrome devtools", "ui testing"     | chrome-devtools |

### Planning

| Trigger           | Pattern                                            | Invoked Skill  |
| ----------------- | -------------------------------------------------- | -------------- |
| `plan_validation` | "validate plan", "rate plan", "check plan quality" | response-rater |
| `plan_creation`   | "create plan", "roadmap", "strategy"               | plan-generator |

### Security

| Trigger              | Pattern                                                     | Invoked Skill       |
| -------------------- | ----------------------------------------------------------- | ------------------- |
| `security_audit`     | "audit security", "vulnerability scan", "threat assessment" | rule-auditor        |
| `vulnerability_scan` | "scan for vulnerabilities", "detect CVEs"                   | dependency-analyzer |

### Performance

| Trigger                 | Pattern                                            | Invoked Skill       |
| ----------------------- | -------------------------------------------------- | ------------------- |
| `optimization_analysis` | "analyze performance", "profile code", "benchmark" | sequential-thinking |
| `dependency_analysis`   | "analyze dependencies", "check packages"           | dependency-analyzer |

## Agent-Specific Triggers

### Orchestrator

| Trigger            | Skill               | Use Case                               |
| ------------------ | ------------------- | -------------------------------------- |
| `plan_validation`  | response-rater      | Rate plans before execution (min 7/10) |
| `workflow_error`   | recovery            | Recover from workflow failures         |
| `task_complete`    | artifact-publisher  | Publish completed artifacts            |
| `platform_handoff` | context-bridge      | Sync to Cursor/Factory                 |
| `agent_conflict`   | conflict-resolution | Resolve conflicting outputs            |

### Developer

| Trigger           | Skill               | Use Case                        |
| ----------------- | ------------------- | ------------------------------- |
| `new_component`   | scaffolder          | Generate boilerplate components |
| `code_changes`    | rule-auditor        | Validate code before commit     |
| `codebase_search` | repo-rag            | Search for patterns/examples    |
| `test_creation`   | test-generator      | Generate test suites            |
| `new_module`      | claude-md-generator | Document new modules            |

### Code Reviewer

| Trigger           | Skill                  | Use Case                |
| ----------------- | ---------------------- | ----------------------- |
| `review_code`     | rule-auditor           | Validate compliance     |
| `style_review`    | code-style-validator   | Check formatting        |
| `multi_ai_review` | multi-ai-code-review   | Consensus-based reviews |
| `violation_fix`   | fixing-rule-violations | Auto-fix violations     |

### QA

| Trigger           | Skill           | Use Case                   |
| ----------------- | --------------- | -------------------------- |
| `test_creation`   | test-generator  | Generate test suites       |
| `quality_check`   | rule-auditor    | Validate quality standards |
| `browser_testing` | chrome-devtools | Browser-based testing      |
| `ui_testing`      | computer-use    | UI automation              |

### Architect

| Trigger                | Skill                  | Use Case                     |
| ---------------------- | ---------------------- | ---------------------------- |
| `architecture_diagram` | diagram-generator      | Create architecture diagrams |
| `pattern_search`       | repo-rag               | Find existing patterns       |
| `dependency_analysis`  | dependency-analyzer    | Analyze tech stack           |
| `api_design`           | api-contract-generator | Design API contracts         |

## Configuration

### Skill Integration Matrix

Location: `.claude/context/skill-integration-matrix.json`

Structure:

```json
{
  "agents": {
    "agent-name": {
      "required_skills": ["skill1", "skill2"],
      "recommended_skills": ["skill3"],
      "skill_triggers": {
        "trigger_keyword": "skill_name"
      }
    }
  }
}
```

### Trigger Patterns

Location: `.claude/tools/skill-trigger-detector.mjs`

Pattern format:

```javascript
const TRIGGER_PATTERNS = {
  trigger_name: /\b(keyword1|keyword2)\b.*\b(context)\b/i,
};
```

## Usage

### Manual Trigger Detection

Test trigger detection for any agent:

```bash
node .claude/tools/skill-trigger-detector.mjs \
  --agent developer \
  --task "Create new UserProfile component with tests"
```

Output:

```json
{
  "required": ["scaffolder", "rule-auditor", "repo-rag"],
  "triggered": ["scaffolder", "test-generator"],
  "recommended": ["claude-md-generator", "dependency-analyzer"],
  "all": ["scaffolder", "rule-auditor", "repo-rag", "test-generator"],
  "matchedTriggers": ["new_component", "test_creation"]
}
```

### Viewing Triggered Skills in Runs

After orchestrator processes a request, check:

1. **Console output**:

   ```
   [Orchestrator Entry] Skill detection for orchestrator:
     Required skills: response-rater, recovery, artifact-publisher
     Triggered skills: response-rater
     Recommended skills: context-bridge
     Matched triggers: plan_validation
   ```

2. **Artifact file**: `.claude/context/runs/<run-id>/artifacts/skill-detection.json`

3. **Run summary**: Generated dashboard shows triggered skills

### Overriding Auto-Invocation

You can manually invoke skills even if not triggered:

**Natural language**:

```
"Use repo-rag to search for authentication patterns"
```

**Skill tool**:

```
Skill: repo-rag
Query: "authentication patterns"
```

## Validation

### Post-Execution Validation

`skill-validator.mjs` checks that triggered skills were actually used:

```bash
node .claude/tools/skill-validator.mjs \
  --agent developer \
  --task "Create component" \
  --log ./execution.log
```

Validation checks:

1. **Explicit invocation**: `Skill: scaffolder` in logs
2. **Natural language**: "using scaffolder skill" in output
3. **Artifact evidence**: Expected skill outputs present

### Enforcement Gates

Workflows can enforce skill usage via gates:

```yaml
steps:
  - agent: developer
    required_skills: [scaffolder, rule-auditor]
    validation:
      skill_usage: strict # Fail if required skills not used
```

## Adding New Triggers

### 1. Define Trigger Pattern

Edit `.claude/tools/skill-trigger-detector.mjs`:

```javascript
const TRIGGER_PATTERNS = {
  // Add new trigger
  custom_operation: /\b(custom|special|unique)\b.*\b(operation|task)\b/i,
};
```

### 2. Map Trigger to Skill

Edit `.claude/context/skill-integration-matrix.json`:

```json
{
  "agents": {
    "custom-agent": {
      "skill_triggers": {
        "custom_operation": "custom-skill"
      }
    }
  }
}
```

### 3. Test Trigger

```bash
node .claude/tools/skill-trigger-detector.mjs \
  --agent custom-agent \
  --task "Perform custom operation"
```

## Benefits

1. **Automatic Skill Activation**: No manual skill invocation needed
2. **Consistent Behavior**: All agents follow same trigger patterns
3. **Reduced Cognitive Load**: Developers don't need to remember which skills to invoke
4. **Audit Trail**: All triggered skills logged for debugging
5. **Enforcement**: Validation ensures skills are actually used

## Limitations

1. **Pattern Matching**: Relies on keyword matching (may have false positives/negatives)
2. **Context-Free**: Doesn't understand semantic context beyond keywords
3. **Single-Agent**: Triggers apply to one agent at a time (no cross-agent triggers)
4. **Static Patterns**: Requires code changes to add new triggers

## Future Enhancements

1. **Semantic Matching**: Use embeddings for better trigger detection
2. **Multi-Agent Triggers**: Trigger skills across multiple agents
3. **Dynamic Patterns**: Learn patterns from execution history
4. **Confidence Scores**: Probabilistic trigger matching with thresholds
5. **User Preferences**: Allow users to customize trigger behavior

## References

- **Skill Integration Matrix**: `.claude/context/skill-integration-matrix.json`
- **Trigger Detector**: `.claude/tools/skill-trigger-detector.mjs`
- **Skill Validator**: `.claude/tools/skill-validator.mjs`
- **Orchestrator Entry**: `.claude/tools/orchestrator-entry.mjs`
- **Agent Documentation**: `.claude/agents/orchestrator.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
