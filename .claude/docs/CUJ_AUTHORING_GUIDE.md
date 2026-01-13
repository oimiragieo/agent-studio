# CUJ Authoring Guide

This guide provides comprehensive instructions for creating and maintaining Customer User Journeys (CUJs).

## Table of Contents

1. [Overview](#overview)
2. [CUJ Structure](#cuj-structure)
3. [Measurability Requirements](#measurability-requirements)
4. [Execution Modes](#execution-modes)
5. [Validation](#validation)
6. [Best Practices](#best-practices)

---

## Overview

A Customer User Journey (CUJ) documents a complete user workflow from initial request to successful completion. Each CUJ includes:

- User goal and trigger
- Agent workflow sequence
- Skills used
- Expected outputs
- **Measurable success criteria** (CRITICAL)

### CUJ Inventory

- **Total CUJs**: 60 (CUJ-001 through CUJ-063, with 3 reserved)
- **Workflow-Based**: 53 CUJs (multi-agent workflows)
- **Skill-Only**: 5 CUJs (direct skill invocation)
- **Manual Setup**: 2 CUJs (manual execution)

---

## CUJ Structure

Every CUJ must follow the template at `.claude/templates/cuj-template.md`.

### Required Sections

| Section                                      | Purpose                                | Required |
| -------------------------------------------- | -------------------------------------- | -------- |
| ## User Goal                                 | What the user wants to achieve         | Yes      |
| ## Trigger                                   | Commands/prompts that activate the CUJ | Yes      |
| ## Workflow                                  | Step-by-step execution with agents     | Yes      |
| ## Agents Used                               | List of agents involved                | Yes      |
| ## Skills Used OR ## Capabilities/Tools Used | Skills or tools used                   | Yes      |
| ## Expected Outputs                          | Artifacts produced                     | Yes      |
| ## Success Criteria                          | **Measurable** validation criteria     | Yes      |
| ## Example Prompts                           | Example user prompts                   | Yes      |

### Optional Sections

| Section                   | Purpose                              |
| ------------------------- | ------------------------------------ |
| ## Error Recovery         | Retry, rollback, fallback strategies |
| ## Platform Compatibility | Claude/Cursor/Factory support        |
| ## Related Documentation  | Links to agents, skills, workflows   |
| ## Related CUJs           | Cross-references to related CUJs     |
| ## Notes                  | Additional implementation notes      |

---

## Measurability Requirements

### CRITICAL: All success criteria MUST be measurable

**Target**: At least 70% of success criteria must be measurable (verifiable through artifacts, gates, schemas, or metrics).

### What Makes a Criterion Measurable?

A criterion is **measurable** if it references:

| Reference Type | Example                                           | Pattern               |
| -------------- | ------------------------------------------------- | --------------------- |
| **Artifact**   | plan-workflow_id.json exists                      | File existence check  |
| **Gate**       | Validated by gates/01-developer.json              | Gate pass/fail status |
| **Schema**     | Validated against .claude/schemas/prd.schema.json | Schema validation     |
| **Metric**     | >= 7/10 score                                     | Numeric threshold     |
| **Field**      | issues array populated                            | Content validation    |

### Non-Measurable Criteria (Avoid)

These terms indicate non-measurable criteria:

- improved, faster, better
- working, functional
- complete (without validation reference)
- correct, accurate
- quality met, standards met

### Subjective Criteria

For inherently subjective criteria (e.g., UX quality), flag with [subjective:true]:

| Criterion  | Measurement  | Target                                        |
| ---------- | ------------ | --------------------------------------------- |
| UX quality | Human review | [subjective:true] Requires UX-Expert approval |

### Success Criteria Template

See `.claude/templates/success-criteria-template.md` for comprehensive guidance.

---

## Execution Modes

Every CUJ must declare its execution mode in the ## Workflow section.

### Available Modes

| Mode         | Description               | Example CUJs              |
| ------------ | ------------------------- | ------------------------- |
| workflow     | Multi-agent YAML workflow | CUJ-004, CUJ-005, CUJ-013 |
| skill-only   | Direct skill invocation   | CUJ-002, CUJ-003, CUJ-017 |
| manual-setup | Manual steps required     | CUJ-001, CUJ-042          |

### Consistency Requirements

1. **Execution mode must match CUJ-INDEX.md**: The mode declared in the CUJ file must match the mapping in CUJ-INDEX.md
2. **Workflow file must exist**: If referencing a workflow YAML, it must exist in .claude/workflows/
3. **Skill must exist**: If referencing a skill, it must exist in .claude/skills/

---

## Tools vs Skills: Critical Distinction

### What is the Difference?

This is one of the most important distinctions in CUJs. Confusing tools and skills causes validation errors.

| Aspect               | **Skills**                                          | **Tools/Capabilities**                            |
| -------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **Location**         | `.claude/skills/<name>/SKILL.md`                    | External (MCP, platform, IDE)                     |
| **CUJ Section**      | `## Skills Used`                                    | `## Capabilities/Tools Used`                      |
| **Examples**         | `plan-generator`, `response-rater`, `doc-generator` | `navigate_page`, `click`, Chrome DevTools, Cursor |
| **Validation**       | Checked against `.claude/skills/` directory         | No validation - external tools                    |
| **Error if Missing** | YES - Validation error                              | NO - External tools don't need to be present      |

### Skill Examples

These go in **## Skills Used** section:

```markdown
## Skills Used

- `plan-generator` - Creates structured plans from requirements
- `response-rater` - Validates and scores plan completeness
- `doc-generator` - Generates markdown documentation from code
- `test-generator` - Creates test files for specified code
```

**Check for their existence**: Each skill name in backticks must have a corresponding directory at `.claude/skills/<skill-name>/SKILL.md`

### Tools/Capabilities Examples

These go in **## Capabilities/Tools Used** section:

```markdown
## Capabilities/Tools Used

**Chrome DevTools MCP**:

- `navigate_page`: Navigate to URLs and pages
- `take_screenshot`: Capture page screenshots
- `click`: Click UI elements
- `type`: Enter text into input fields

**GitHub API**:

- `create_pull_request`: Create a new PR
- `list_issues`: Query and filter issues

**Cursor IDE**:

- `composer-mode`: Multi-file editing
- `chat-context`: Full file context
```

**NO validation needed** for tools - they're external to this project. Don't reference them with backticks in the section title.

### Common Mistakes to Avoid

**WRONG** (mixing tools and skills):

```markdown
## Skills Used

- `navigate_page` (this is a MCP tool, not a skill!)
- `click` (another MCP tool!)
- plan-generator (missing backticks!)
```

**CORRECT** (proper separation):

```markdown
## Capabilities/Tools Used

- `navigate_page`: Chrome DevTools MCP
- `click`: Chrome DevTools MCP

## Skills Used

- `plan-generator` - Creates structured plans
```

### Validation Behavior

When you run `pnpm validate:cujs`:

1. **Skills Used section**: Validator checks that each skill exists at `.claude/skills/<name>/SKILL.md`
   - Missing = ERROR (fails validation)
   - Extra skill = WARNING (documented but not used)

2. **Capabilities/Tools Used section**: Validator SKIPS validation
   - These are external (MCP servers, IDE features, APIs)
   - No error if tool doesn't exist locally
   - Section documents what external tools are used

### How to Get Tools vs Skills Right

1. **Ask**: "Is this in `.claude/skills/`?"
   - YES → Use `## Skills Used` section
   - NO → Use `## Capabilities/Tools Used` section

2. **Format Check**:
   - Skills: Always in backticks (`` `skill-name` ``)
   - Tools: Listed as `-` bullets with description

3. **Test**: Run validator to confirm no "missing skill" errors:
   ```bash
   pnpm validate:cujs:full
   ```

---

## Validation

### Pre-Commit Validation

Before committing CUJ changes, run:

```bash
# Full validation (recommended)
pnpm validate:cujs

# Quick validation (skip link checks)
pnpm validate:cujs:quick

# Dry-run validation (no state changes)
pnpm validate:cujs:dry-run

# Doctor mode (detailed diagnostics)
pnpm cuj:doctor

# Or use the unified validator directly
node .claude/tools/cuj-validator-unified.mjs --mode full --path .claude/cujs/CUJ-XXX.md
```

### Unified Validator Modes

The new unified validator supports multiple modes:

| Mode      | Purpose                                      | Command                                               |
| --------- | -------------------------------------------- | ----------------------------------------------------- |
| `full`    | Complete validation with all checks          | `cuj-validator-unified --mode full`                   |
| `quick`   | Fast validation (skip link checks)           | `cuj-validator-unified --mode quick`                  |
| `dry-run` | Validation without state mutations (CI mode) | `cuj-validator-unified --mode dry-run`                |
| `doctor`  | Detailed diagnostics and repair suggestions  | `cuj-validator-unified --doctor` or `pnpm cuj:doctor` |

### Validation Checks

The validation script checks:

1. **Required sections present**: All mandatory sections exist
2. **Execution mode valid**: Mode matches CUJ-INDEX.md (must be: `workflow`, `skill-only`, or `manual-setup`)
3. **Workflow file exists**: Referenced workflow YAML exists
4. **Skill exists**: Referenced skills exist (checked in .claude/skills/)
5. **Schema validation**: Referenced schemas exist and are valid
6. **Links valid**: Internal links resolve (unless --quick or --dry-run)
7. **Success criteria**: References at least one artifact/gate/schema (measurable)
8. **Tools vs Skills distinction**: Correctly separated in Capabilities/Tools vs Skills Used sections

### Measurability Report

```bash
pnpm validate:cujs:full
```

The full validator reports the percentage of measurable vs non-measurable criteria and identifies which criteria lack artifact references.

### Deprecated Validators (Replaced)

The following tools are deprecated and should not be used. Use `cuj-validator-unified.mjs` instead:

- `validate-cujs.mjs` - Use `cuj-validator-unified --mode full`
- `validate-cuj-dry-run.mjs` - Use `cuj-validator-unified --mode dry-run`
- `cuj-doctor.mjs` - Use `cuj-validator-unified --doctor`

---

## Best Practices

### 1. Use Table Format for Success Criteria

Tables are clearer and more consistent than checkboxes.

### 2. Include Workflow ID Placeholders

Use {{workflow_id}} for traceability.

### 3. Reference Specific Paths

Avoid vague references. Include full artifact paths.

### 4. Include Plan Rating for Workflow CUJs

All workflow CUJs should include Step 0.1 (Plan Rating Gate).

### 5. Document Error Recovery

Include retry, rollback, and fallback strategies.

### 6. Cross-Reference Related Documentation

Link to agents, skills, and workflows.

---

## Checklist

Before submitting a CUJ:

- [ ] All required sections present
- [ ] Execution mode declared and matches CUJ-INDEX.md
- [ ] Workflow/skill references exist
- [ ] Success criteria use table format
- [ ] At least 70% of criteria are measurable
- [ ] Criteria reference artifacts/gates/schemas/metrics
- [ ] Error recovery section included (for workflow CUJs)
- [ ] Example prompts provided
- [ ] Related documentation linked
- [ ] Validation passes: node scripts/validate-cujs.mjs
- [ ] Measurability check passes: node scripts/validate-cujs.mjs --measurability

---

## Resources

- **CUJ Template**: .claude/templates/cuj-template.md
- **Success Criteria Template**: .claude/templates/success-criteria-template.md
- **CUJ Index**: .claude/docs/cujs/CUJ-INDEX.md
- **Validation Script**: scripts/validate-cujs.mjs
- **Schemas**: .claude/schemas/
- **Workflows**: .claude/workflows/
