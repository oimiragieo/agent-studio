# CUJ-XXX: [CUJ Title]

## User Goal
[Clear description of what the user wants to achieve]

## Trigger
- [Trigger 1: command, keyword, or user prompt]
- [Trigger 2: alternative trigger]
- [Trigger 3: additional trigger]

## Workflow

**Execution Mode**: `[workflow-name].yaml` | `skill-only`

> **REQUIRED**: Every CUJ must explicitly declare its execution mode:
> - `greenfield-fullstack.yaml` - Full workflow with planner → developer → qa
> - `brownfield-feature.yaml` - Feature addition to existing codebase
> - `incident-flow.yaml` - Incident response workflow
> - `skill-only` - Direct skill invocation without workflow orchestration
>
> See `.claude/workflows/` for available workflow files.

### Step 0: Planning Phase (MANDATORY)
- Planner creates comprehensive plan
- [Additional planning details]
- Outputs: `plan-{{workflow_id}}.md`, `plan-{{workflow_id}}.json`

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

Examples:
- `- [ ] Artifact created: plan-{{workflow_id}}.json (validated by gate file: gates/step-0.json)`
- `- [ ] Schema validation passes: artifact matches .claude/schemas/plan.schema.json`
- `- [ ] Registry entry created: artifact registered in .claude/context/runs/{{run_id}}/artifact-registry.json`
- `- [ ] Gate file passes: gates/step-1.json has valid: true`

Format: `- [ ] [Description]: [artifact-path] (validated by [validation-method])`

- [ ] [Criterion 1: specific, measurable with artifact reference]
- [ ] [Criterion 2: specific, measurable with artifact reference]
- [ ] [Criterion 3: specific, measurable with artifact reference]

## Example Prompts
```
[Example prompt 1]
[Example prompt 2]
[Example prompt 3]
```

## Related Documentation
- [Link to related agent documentation](../../agents/[agent].md)
- [Link to related skill documentation](../../skills/[skill]/SKILL.md)
- [Link to related workflow documentation](../../workflows/[workflow].yaml)

