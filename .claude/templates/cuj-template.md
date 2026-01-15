# CUJ-XXX: [CUJ Title]

## User Goal

[Clear description of what the user wants to achieve]

## Trigger

- [Trigger 1: command, keyword, or user prompt]
- [Trigger 2: alternative trigger]
- [Trigger 3: additional trigger]

## Workflow

**Execution Mode**: `workflow` | `skill-only` | `manual-setup`

> **REQUIRED**: Every CUJ must explicitly declare its execution mode using ONE of these three canonical values:
>
> | Mode           | Description                                   | Required Fields |
> | -------------- | --------------------------------------------- | --------------- |
> | `workflow`     | Multi-agent workflow execution via YAML file  | `workflow_file` |
> | `skill-only`   | Direct skill invocation without orchestration | `primary_skill` |
> | `manual-setup` | Manual setup/execution steps (no automation)  | None            |
>
> **DEPRECATED**: Using raw workflow filenames (e.g., `greenfield-fullstack.yaml`) as execution_mode is deprecated.
> Instead, use `workflow` mode with a separate `**Workflow File**:` field.
>
> See `.claude/docs/EXECUTION_MODE_STANDARD.md` for the canonical standard.

**Workflow File**: `.claude/workflows/[workflow-name].yaml`

<!-- Required when execution_mode is "workflow". Omit for skill-only and manual-setup modes. -->

**Primary Skill**: `[skill-name]`

<!-- Required when execution_mode is "skill-only". Omit for workflow and manual-setup modes. -->

### Step 0: Planning Phase (MANDATORY)

- Planner creates comprehensive plan
- [Additional planning details]
- Outputs: `plan-{{workflow_id}}.md`, `plan-{{workflow_id}}.json`

### Step 0.1: Plan Rating Gate (MANDATORY for workflow execution mode)

**Agent**: orchestrator
**Skill**: `response-rater`
**Validation**:

- Minimum score: 7/10 (default) - see `.claude/docs/PLAN_RATING_THRESHOLDS.md` for workflow-specific thresholds
- Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
- If score < 7: Return to planner with feedback (max 3 attempts)
- If score >= 7: Proceed to Step 1
- Records rating in `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json`

### Step 1: [Step Name]

- [Agent name] performs [action]
- [Additional details]
- Outputs: [artifact names]

[Add additional steps as needed]

## Agents Used

- [Agent 1] → [Agent 2] → [Agent 3]

## Capabilities/Tools Used

**Use this section for:**

- Platform-specific tools (e.g., "Chrome DevTools", "Cursor features", "GitHub API")
- MCP (Model Context Protocol) tools (e.g., `navigate_page`, `click`, `screenshot`)
- Native IDE features that aren't formal skills
- Generic behaviors that don't have dedicated skill implementations

**Format**: `- [tool-name]: [Description of what it does]`

**Examples**:

- **Chrome DevTools MCP**:
  - `navigate_page`: Navigate to URLs
  - `take_screenshot`: Capture page screenshots
  - `click`: Click UI elements
- **GitHub API**:
  - `create-pull-request`: Create a new PR
  - `list-issues`: Query issues

## Skills Used

**Use this section for:**

- Actual `.claude/skills/*/SKILL.md` implementations
- Formal utilities with dedicated skill files
- Reusable agent capabilities

**Format**: `` `skill-name` - [Description] ``

**Examples**:

- `` `plan-generator` - Creates structured plans from requirements ``
- `` `response-rater` - Validates and scores completeness ``
- `` `artifact-publisher` - Publishes artifacts to project feed ``

---

## Key Distinction: Tools vs Skills

| Aspect         | MCP Tools / Capabilities                    | Skills                                      |
| -------------- | ------------------------------------------- | ------------------------------------------- |
| **Location**   | External platform/MCP                       | `.claude/skills/*/SKILL.md`                 |
| **Section**    | `## Capabilities/Tools Used`                | `## Skills Used`                            |
| **Example**    | `navigate_page`, `click`, `Chrome DevTools` | `plan-generator`, `response-rater`          |
| **Detection**  | Listed by tool name                         | Listed by skill name with backticks         |
| **Validation** | No "missing" check - external tools         | Checked against `.claude/skills/` directory |

**Critical**: Do NOT mix tool names and skill names in the same section. Use:

- **Capabilities/Tools Used** for MCP tools, platform features, external capabilities
- **Skills Used** for actual `.claude/skills/` implementations

## Expected Outputs

- [Output 1: description]
- [Output 2: description]
- [Output 3: description]

## Success Criteria

**REQUIRED**: Each success criterion must reference at least one verifiable artifact (schema-validated output, gate file, registry entry, run record).

**Format Options**:

1. **Checkboxes** (recommended for simple criteria):
   - `- [ ] Artifact created: plan-{{workflow_id}}.json (validated by gate file: gates/step-0.json)`
   - `- [ ] Schema validation passes: artifact matches .claude/schemas/plan.schema.json`

2. **Tables** (recommended for multiple measurements per criterion):
   ```
   | Criterion | Measurement | Target |
   |-----------|-------------|--------|
   | Artifact created | Gate validation | plan-{{workflow_id}}.json validated by gate file |
   | Schema validation | Schema match | Validated against .claude/schemas/plan.schema.json |
   ```

Examples:

- `- [ ] Artifact created: plan-{{workflow_id}}.json (validated by gate file: gates/step-0.json)`
- `- [ ] Schema validation passes: artifact matches .claude/schemas/plan.schema.json`
- `- [ ] Registry entry created: artifact registered in .claude/context/runtime/runs/{{run_id}}/artifact-registry.json`
- `- [ ] Gate file passes: gates/step-1.json has valid: true`

- [ ] [Criterion 1: specific, measurable with artifact reference]
- [ ] [Criterion 2: specific, measurable with artifact reference]
- [ ] [Criterion 3: specific, measurable with artifact reference]

## Example Prompts

```
[Example prompt 1]
[Example prompt 2]
[Example prompt 3]
```

## Error Recovery

### Retry Strategy

- **Max Retries**: 3 attempts per step
- **Backoff**: Exponential (1s, 2s, 4s)
- **Retry Triggers**: Transient failures, timeouts, rate limits

### Rollback Procedures

1. **Partial Completion**: Save checkpoint to `.claude/context/runtime/runs/{{run_id}}/checkpoint.json`
2. **Failed Validation**: Return to previous passing gate
3. **Critical Failure**: Escalate to human with full context

### Fallback Options

- **Alternative Agent**: If primary agent fails 3x, route to backup agent
  - [Primary Agent] → [Backup Agent] ([fallback description])
- **Manual Override**: User can force-proceed with documented risks
- **Graceful Degradation**: [Description of reduced functionality option]

### Recovery Artifacts

- Error log: `.claude/context/runtime/runs/{{run_id}}/errors.log`
- Recovery state: `.claude/context/runtime/runs/{{run_id}}/recovery-state.json`
- Checkpoint: `.claude/context/runtime/runs/{{run_id}}/checkpoint.json`

## Related Documentation

- [Link to related agent documentation](../../agents/[agent].md)
- [Link to related skill documentation](../../skills/[skill]/SKILL.md)
- [Link to related workflow documentation](../../workflows/[workflow].yaml)
