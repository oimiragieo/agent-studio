# CUJ-XXX: [CUJ Title]

## User Goal
[Clear description of what the user wants to achieve]

## Trigger
- [Trigger 1: command, keyword, or user prompt]
- [Trigger 2: alternative trigger]
- [Trigger 3: additional trigger]

## Workflow

**Execution Mode**: `workflow` | `skill-only` | `manual-setup` | `[workflow-name].yaml`

> **REQUIRED**: Every CUJ must explicitly declare its execution mode:
> - `workflow` - Multi-agent workflow execution (use when referencing a .yaml file)
> - `[workflow-name].yaml` - Specific workflow file (e.g., `greenfield-fullstack.yaml`)
> - `skill-only` - Direct skill invocation without workflow orchestration
> - `manual-setup` - Manual setup/execution steps (no automation)
>
> **Examples**:
> - `greenfield-fullstack.yaml` - Full workflow with planner → developer → qa
> - `brownfield-feature.yaml` - Feature addition to existing codebase
> - `incident-flow.yaml` - Incident response workflow
> - `skill-only` - Direct skill invocation (e.g., CUJ-002, CUJ-013)
> - `manual-setup` - Manual installation or configuration (e.g., CUJ-001)
>
> See `.claude/workflows/` for available workflow files.

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
- Records rating in `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

### Step 1: [Step Name]
- [Agent name] performs [action]
- [Additional details]
- Outputs: [artifact names]

[Add additional steps as needed]

## Agents Used
- [Agent 1] → [Agent 2] → [Agent 3]

## Skills Used
- `[skill-name]` - [Description of skill usage]
- `[another-skill]` - [Description]

**OR** (if capabilities don't exist as skills):

## Capabilities/Tools Used
- [Capability 1] - [Description]
- [Capability 2] - [Description]

**Note**: 
- **Use `## Skills Used`** when referencing actual `.claude/skills/*/SKILL.md` files (e.g., `plan-generator`, `repo-rag`, `artifact-publisher`)
  - Skills must exist in `.claude/skills/` directory
  - Reference skills using backticks: `` `skill-name` ``
  - Example: `` `plan-generator` - Creates structured plans from requirements ``
- **Use `## Capabilities/Tools Used`** for:
  - Free-form capabilities that don't have skill files
  - Platform-specific tools (e.g., "Cursor Plan Mode", "Chrome DevTools")
  - Generic behaviors (e.g., "artifact sharing", "coordination")
  - Native IDE features that aren't skills
- **Either section is acceptable**, but use the appropriate one based on whether you're referencing real skills
- **Best Practice**: If a skill exists in `.claude/skills/`, use `## Skills Used` and reference it. Otherwise, use `## Capabilities/Tools Used`

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
- `- [ ] Registry entry created: artifact registered in .claude/context/runs/{{run_id}}/artifact-registry.json`
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
1. **Partial Completion**: Save checkpoint to `.claude/context/runs/{{run_id}}/checkpoint.json`
2. **Failed Validation**: Return to previous passing gate
3. **Critical Failure**: Escalate to human with full context

### Fallback Options
- **Alternative Agent**: If primary agent fails 3x, route to backup agent
  - [Primary Agent] → [Backup Agent] ([fallback description])
- **Manual Override**: User can force-proceed with documented risks
- **Graceful Degradation**: [Description of reduced functionality option]

### Recovery Artifacts
- Error log: `.claude/context/runs/{{run_id}}/errors.log`
- Recovery state: `.claude/context/runs/{{run_id}}/recovery-state.json`
- Checkpoint: `.claude/context/runs/{{run_id}}/checkpoint.json`

## Related Documentation
- [Link to related agent documentation](../../agents/[agent].md)
- [Link to related skill documentation](../../skills/[skill]/SKILL.md)
- [Link to related workflow documentation](../../workflows/[workflow].yaml)

