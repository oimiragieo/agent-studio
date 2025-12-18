### Workflow Guide

Use these flows to route the right agents and artifacts.

- **Quick Flow**: Bugfix/hotfix/small change. Agents: **planner** → developer → qa. Outputs: plan + dev change + basic validation.
- **Full Stack Flow**: New features/greenfield. Agents: **planner** → analyst → pm → ux → architect → developer → qa. Outputs: plan + brief/PRD/UX/arch/test plan.
- **Code Quality Flow**: Code health/review/refactor. Agents: **planner** → code-reviewer → refactoring-specialist → compliance-auditor → qa.
- **Performance Flow**: Perf tuning/SLI/SLO. Agents: **planner** → performance-engineer → architect → developer → qa.
- **AI System Flow**: LLM/AI features. Agents: **planner** → model-orchestrator → llm-architect → api-designer → developer → qa.
- **Mobile Flow**: Mobile feature work. Agents: **planner** → mobile-developer → ux-expert → developer → qa.
- **Incident Flow**: Reliability/incident response. Agents: **planner** → incident-responder → devops → security-architect → qa.

Templates:
- `.opencode/template/code-review-report.md`
- `.opencode/template/refactor-plan.md`
- `.opencode/template/performance-plan.md`
- `.opencode/template/llm-architecture.md`
- `.opencode/template/incident-report.md`

## Workflow ID Generation

Workflow IDs are used to uniquely identify workflow executions and are used in template variable interpolation (e.g., `{{workflow_id}}`).

### ID Format

- **Default**: `default-run` (if not provided)
- **Custom**: Any string identifier (e.g., `feature-login-20250120`, `bugfix-123`)
- **Recommended**: Use descriptive names with timestamps or ticket numbers

### Generating Workflow IDs

```bash
# Automatic generation (recommended)
WORKFLOW_ID="workflow-$(date +%Y%m%d-%H%M%S)"

# Manual specification
WORKFLOW_ID="feature-user-auth-01"

# Using ticket/issue numbers
WORKFLOW_ID="issue-123-fix-login-bug"
```

### Using Workflow IDs

Workflow IDs are used in:
- Artifact file names: `plan-{{workflow_id}}.json`
- Gate file paths: `.opencode/context/history/gates/{{workflow_id}}/00-planner.json`
- Reasoning file paths: `.opencode/context/history/reasoning/{{workflow_id}}/00-planner.json`

### Providing Workflow IDs

```bash
# Via workflow runner
node .opencode/tool/workflow_runner.js \
  --workflow .opencode/workflow/code-quality-flow.yaml \
  --step 0 \
  --id my-workflow-123

# Via orchestrator
executeWorkflow('code-quality-flow', {
  step: 0,
  workflowId: generateWorkflowId(),
  inputs: {...}
});
```

### Template Variable Resolution

The workflow runner automatically interpolates `{{workflow_id}}` in:
- Output artifact names
- Gate file paths
- Schema paths (if they contain template variables)

If `{{workflow_id}}` cannot be resolved, the workflow runner will fail with a clear error message.

## Agent File Verification

The workflow runner automatically verifies that all agent files referenced in workflows exist before execution.

### Verification Process

1. **Agent File Check**: For each step, the runner checks if `.opencode/agent/{agent-name}.md` exists
2. **Error Reporting**: If an agent file is missing, the workflow fails with a clear error message
3. **Validation Timing**: Agent file verification happens during dependency validation (before step execution)

### Error Messages

When an agent file is missing, you'll see:
```
❌ Dependency validation errors:
  - Agent file not found: .opencode/agent/planner.md
```

### Troubleshooting

**Issue**: Agent file not found error
- **Solution 1**: Verify the agent file exists at `.opencode/agent/{agent-name}.md`
- **Solution 2**: Check for typos in the workflow YAML `agent:` field
- **Solution 3**: Ensure the agent name matches the filename (without `.md` extension)

**Issue**: Agent file exists but workflow still fails
- **Solution**: Check file permissions and ensure the file is readable

### Agent File Requirements

- **Location**: Must be in `.opencode/agent/` directory
- **Naming**: Must match the agent name in workflow YAML (case-sensitive)
- **Extension**: Must have `.md` extension
- **Format**: Should follow agent definition format (see `.opencode/agent/` examples)

### Example Agent Verification

```yaml
# In workflow YAML
steps:
  - step: 0
    agent: planner  # Runner checks for .opencode/agent/planner.md
    ...
  - step: 1
    agent: code-reviewer  # Runner checks for .opencode/agent/code-reviewer.md
    ...
```

All agent files are verified before any step execution begins, ensuring the workflow can complete successfully.
