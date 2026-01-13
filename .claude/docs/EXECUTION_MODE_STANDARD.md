# CUJ Execution Mode Standard

## Overview

This document defines the canonical execution modes for Customer User Journeys (CUJs) in the LLM-RULES system. All CUJs must conform to this standard for consistent validation and execution.

## Canonical Execution Modes

The system supports exactly three canonical execution modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| `workflow` | Multi-agent workflow execution via YAML file | Complex multi-step journeys with agent coordination |
| `skill-only` | Direct skill invocation without workflow orchestration | Simple, single-skill operations |
| `manual-setup` | Manual setup/execution steps (no automation) | Installation, configuration, or human-driven processes |

## Field Definitions

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `execution_mode` | `string` | One of: `workflow`, `skill-only`, `manual-setup` |

### Conditional Fields

| Field | Type | Required When | Description |
|-------|------|---------------|-------------|
| `workflow_file` | `string` | `execution_mode === "workflow"` | Path to workflow YAML (e.g., `.claude/workflows/greenfield-fullstack.yaml`) |
| `primary_skill` | `string` | `execution_mode === "skill-only"` | Main skill name (e.g., `rule-selector`) |
| `supporting_skills` | `array<string>` | Optional (any mode) | Additional skills used |
| `manual_steps` | `array<string>` | Optional (`manual-setup`) | List of manual steps |

## Mode Details

### workflow Mode

Use `workflow` when the CUJ requires multi-agent coordination through a workflow YAML file.

**Requirements**:
- `workflow_file` must be set to a valid path matching `.claude/workflows/*.yaml`
- `primary_skill` is optional (workflow may use multiple skills)

**Markdown Format**:
```markdown
**Execution Mode**: `workflow`

**Workflow File**: `.claude/workflows/greenfield-fullstack.yaml`
```

**JSON Format**:
```json
{
  "execution_mode": "workflow",
  "workflow_file": ".claude/workflows/greenfield-fullstack.yaml",
  "primary_skill": null,
  "supporting_skills": ["plan-generator", "response-rater"]
}
```

### skill-only Mode

Use `skill-only` when the CUJ can be completed by invoking a single skill without workflow orchestration.

**Requirements**:
- `primary_skill` must be set to a valid skill name
- `workflow_file` must be `null`

**Markdown Format**:
```markdown
**Execution Mode**: `skill-only`

**Primary Skill**: `rule-selector`
```

**JSON Format**:
```json
{
  "execution_mode": "skill-only",
  "workflow_file": null,
  "primary_skill": "rule-selector",
  "supporting_skills": []
}
```

### manual-setup Mode

Use `manual-setup` when the CUJ requires human intervention and cannot be fully automated.

**Requirements**:
- `workflow_file` must be `null`
- `primary_skill` must be `null`
- `manual_steps` is recommended to document the process

**Markdown Format**:
```markdown
**Execution Mode**: `manual-setup`

### Manual Steps
1. Clone the repository
2. Run the installation script
3. Configure environment variables
```

**JSON Format**:
```json
{
  "execution_mode": "manual-setup",
  "workflow_file": null,
  "primary_skill": null,
  "manual_steps": [
    "Clone the repository",
    "Run the installation script",
    "Configure environment variables"
  ]
}
```

## Deprecated Patterns

The following patterns are **deprecated** and should be migrated to canonical forms:

| Deprecated Pattern | Canonical Replacement | Migration Notes |
|--------------------|----------------------|-----------------|
| `greenfield-fullstack.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `brownfield-fullstack.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `quick-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `performance-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `mobile-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `ai-system-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `incident-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `browser-testing-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `recovery-test-flow.yaml` | `workflow` + `workflow_file` | Move filename to separate field |
| `skill-workflow` | `workflow` (INVALID) | Invalid mode, must choose `workflow` or `skill-only` |
| `delegated-skill` | `skill-only` | Renamed for clarity |

## Schema Validation

All CUJ execution configurations are validated against:
- `.claude/schemas/execution-mode.schema.json` - Canonical execution mode schema
- `.claude/schemas/cuj-registry.schema.json` - Registry-level validation

### Validation Rules

1. `execution_mode` must be one of: `workflow`, `skill-only`, `manual-setup`
2. If `execution_mode === "workflow"`, `workflow_file` is required
3. If `execution_mode === "skill-only"`, `primary_skill` is required
4. `workflow_file` must match pattern: `.claude/workflows/[a-z0-9-]+\.yaml`
5. `primary_skill` must match pattern: `[a-z0-9-]+`

### Validation Command

```bash
# Validate a single CUJ
node .claude/tools/cuj-validator-unified.mjs --cuj CUJ-064 --validate-execution-mode

# Validate all CUJs
node .claude/tools/cuj-validator-unified.mjs --all --validate-execution-mode
```

## Backwards Compatibility

### Deprecation Timeline

| Phase | Date | Action |
|-------|------|--------|
| Phase 1 | 2025-01-12 | Deprecation warnings for non-canonical modes |
| Phase 2 | 2025-02-01 | Migration tooling available |
| Phase 3 | 2025-03-01 | Non-canonical modes become errors |
| Phase 4 | 2025-04-01 | Remove deprecated pattern support |

### Deprecation Warnings

During the deprecation period, validators will emit warnings:

```
⚠️ DEPRECATION WARNING: CUJ-005
   execution_mode: 'greenfield-fullstack.yaml' is deprecated
   Migrate to: execution_mode: 'workflow', workflow_file: '.claude/workflows/greenfield-fullstack.yaml'
```

## Migration Guide

See [EXECUTION_MODE_MIGRATION.md](./EXECUTION_MODE_MIGRATION.md) for step-by-step migration instructions.

## Related Documentation

- [CUJ Template](../templates/cuj-template.md) - CUJ authoring template
- [CUJ Registry Schema](../schemas/cuj-registry.schema.json) - Registry validation
- [Execution Mode Schema](../schemas/execution-mode.schema.json) - Execution mode validation
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow documentation

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-12 | Initial canonical standard definition |
