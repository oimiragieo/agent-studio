# Workflow Rating Gate Validation Script

## Purpose

Validates all workflow YAML files for Step 0.1 Plan Rating Gate compliance as required by the Plan Rating Enforcement system.

## Requirements

All workflows with a Step 0 (Planning Phase) **MUST** include:

1. **Step 0.1 (Plan Rating Gate)** with:
   - `skill: response-rater`
   - `validation.minimum_score: 7` (or higher)
   - Input: `plan-{{workflow_id}}.json (from step 0)`
   - Output: `plan-rating-{{workflow_id}}.json`

## Usage

### Command Line

```bash
# Run validation
node .claude/tools/validate-workflow-rating-gates.mjs

# Or use npm script
pnpm validate:workflow-gates
```

### Exit Codes

- `0` - All workflows pass validation
- `1` - One or more workflows have missing or invalid Step 0.1

## Validation Checks

The script performs the following checks:

1. **YAML Parsing**: Validates YAML syntax
2. **Step 0 Detection**: Identifies workflows with Planning Phase
3. **Step 0.1 Existence**: Ensures Step 0.1 exists when Step 0 is present
4. **Skill Verification**: Confirms `response-rater` skill is used
5. **Minimum Score**: Validates `minimum_score >= 7`
6. **Input/Output**: Checks for required plan input and rating output

## Output Format

### Individual Results

```
✓ greenfield-fullstack.yaml - Step 0.1 present, uses response-rater
✓ brownfield-fullstack.yaml - Step 0.1 present, uses response-rater
✗ quick-flow.yaml - Missing Step 0.1
    ISSUE: Step 0 exists but Step 0.1 (Plan Rating Gate) is missing
✗ incident-flow.yaml - Step 0.1 present but has issues
    ISSUE: minimum_score too low (expected: >= 7, found: 5)
```

### Summary

```
Summary:
- Total workflows: 14
- Workflows with Step 0: 13
- Workflows with Step 0.1: 12
- Valid Step 0.1 implementations: 11
- Missing/Invalid Step 0.1: 2

Workflows with missing or invalid Step 0.1:
1. quick-flow.yaml
   - Step 0 exists but Step 0.1 (Plan Rating Gate) is missing
2. incident-flow.yaml
   - minimum_score too low (expected: >= 7, found: 5)
```

## Common Issues

### Issue: Missing Step 0.1

**Problem**: Workflow has Step 0 but no Step 0.1

**Solution**: Add Step 0.1 after Step 0:

```yaml
steps:
  - step: 0
    name: "Planning Phase"
    agent: planner
    # ... step 0 configuration ...

  - step: 0.1
    name: "Plan Rating Gate"
    agent: orchestrator
    type: validation
    skill: response-rater
    inputs:
      - plan-{{workflow_id}}.json (from step 0)
    outputs:
      - plan-rating-{{workflow_id}}.json
      - reasoning: .claude/context/history/reasoning/{{workflow_id}}/00.1-orchestrator.json
    validation:
      minimum_score: 7
      rubric_file: .claude/context/artifacts/standard-plan-rubric.json
      gate: .claude/context/history/gates/{{workflow_id}}/00.1-orchestrator.json
    retry:
      max_attempts: 3
      on_failure: escalate_to_human
    description: |
      Rate plan quality using response-rater skill.
      - Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
      - Minimum passing score: 7/10
      - If score < 7: Return to Planner with feedback
      - If score >= 7: Proceed with workflow execution
```

### Issue: minimum_score too low

**Problem**: `validation.minimum_score` is less than 7

**Solution**: Update minimum_score to 7:

```yaml
validation:
  minimum_score: 7  # Changed from 5
  rubric_file: .claude/context/artifacts/standard-plan-rubric.json
```

**Exception**: Incident response workflows may use lower scores (e.g., 5) with `emergency_bypass: true`. The validation script will still flag this as non-compliant, which is correct behavior. Document the exception in the workflow description.

### Issue: Missing response-rater skill

**Problem**: Step 0.1 exists but doesn't use `response-rater` skill

**Solution**: Add or update skill field:

```yaml
- step: 0.1
  name: "Plan Rating Gate"
  agent: orchestrator
  type: validation
  skill: response-rater  # Add this line
```

### Issue: YAML Parsing Failed

**Problem**: Syntax error in YAML file

**Solution**: Use a YAML validator to identify and fix syntax errors:

```bash
# Install yamllint
pip install yamllint

# Validate YAML syntax
yamllint .claude/workflows/<workflow-name>.yaml
```

## Integration with CI/CD

Add to your CI/CD pipeline to enforce Plan Rating Gate compliance:

```yaml
# .github/workflows/validate.yml
- name: Validate Workflow Rating Gates
  run: pnpm validate:workflow-gates
```

## Related Documentation

- **Plan Rating Enforcement**: `.claude/CLAUDE.md` (Plan Rating Enforcement section)
- **response-rater Skill**: `.claude/skills/response-rater/SKILL.md`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Enforcement System**: `.claude/docs/ENFORCEMENT_EXAMPLES.md`

## Workflow Exemptions

### Workflows Without Step 0

Workflows that don't have a Planning Phase (Step 0) are automatically exempt from Step 0.1 validation. Examples:

- Workflows with alternative structures (e.g., `phases:` instead of `steps:`)
- Reactive workflows (e.g., monitoring, alerting)
- Template workflows without execution steps

### Emergency Workflows

Incident response workflows may use:
- Lower minimum_score (e.g., 5 instead of 7)
- `emergency_bypass: true` flag

The validation script will flag these as non-compliant, which is **correct behavior**. These exceptions should be:
1. Documented in the workflow description
2. Approved by the orchestrator
3. Limited to genuine emergency scenarios

## Troubleshooting

### Script Fails to Find Workflows

**Error**: `Error: Workflow directory not found`

**Solution**: Ensure you're running the script from the project root:

```bash
cd /path/to/LLM-RULES
node .claude/tools/validate-workflow-rating-gates.mjs
```

### All Workflows Show "No steps array found"

**Problem**: Workflows use alternative structure (e.g., `phases:`)

**Solution**: This is expected for BMad Method workflows and other alternative structures. The script correctly identifies these as not requiring Step 0.1 validation.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-06 | Initial release - validates Step 0.1 Plan Rating Gate |

## Author

Created as part of the Plan Rating Enforcement system (Phase 1).
