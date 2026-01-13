# CUJ Execution Mode Migration Guide

## Overview

This guide helps CUJ authors migrate from deprecated execution mode patterns to the canonical standard. The migration ensures consistent validation and execution across all CUJs.

## Migration Summary

### Before Migration

CUJs used various patterns for `execution_mode`:

- Raw workflow filenames (e.g., `greenfield-fullstack.yaml`)
- Canonical modes (e.g., `workflow`, `skill-only`)
- Invalid modes (e.g., `skill-workflow`)

### After Migration

All CUJs will use exactly three canonical modes:

- `workflow` - with separate `workflow_file` field
- `skill-only` - with `primary_skill` field
- `manual-setup` - with optional `manual_steps` field

## Complete Migration Mapping Table

### CUJs Requiring Migration

| CUJ ID  | Current Mode                | Canonical Mode | Workflow File                                 | Primary Skill  | Action Required                 |
| ------- | --------------------------- | -------------- | --------------------------------------------- | -------------- | ------------------------------- |
| CUJ-005 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/greenfield-fullstack.yaml` | null           | Update mode + add workflow_file |
| CUJ-010 | `brownfield-fullstack.yaml` | `workflow`     | `.claude/workflows/brownfield-fullstack.yaml` | scaffolder     | Update mode + add workflow_file |
| CUJ-011 | `quick-flow.yaml`           | `workflow`     | `.claude/workflows/quick-flow.yaml`           | null           | Update mode + add workflow_file |
| CUJ-012 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/greenfield-fullstack.yaml` | null           | Update mode + add workflow_file |
| CUJ-019 | `performance-flow.yaml`     | `workflow`     | `.claude/workflows/performance-flow.yaml`     | null           | Update mode + add workflow_file |
| CUJ-021 | `mobile-flow.yaml`          | `workflow`     | `.claude/workflows/mobile-flow.yaml`          | null           | Update mode + add workflow_file |
| CUJ-022 | `ai-system-flow.yaml`       | `workflow`     | `.claude/workflows/ai-system-flow.yaml`       | null           | Update mode + add workflow_file |
| CUJ-024 | `incident-flow.yaml`        | `workflow`     | `.claude/workflows/incident-flow.yaml`        | null           | Update mode + add workflow_file |
| CUJ-026 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/enterprise-track.yaml`     | null           | Update mode + add workflow_file |
| CUJ-028 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/greenfield-fullstack.yaml` | null           | Update mode + add workflow_file |
| CUJ-029 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/greenfield-fullstack.yaml` | null           | Update mode + add workflow_file |
| CUJ-034 | `browser-testing-flow.yaml` | `workflow`     | `.claude/workflows/browser-testing-flow.yaml` | null           | Update mode + add workflow_file |
| CUJ-037 | `greenfield-fullstack.yaml` | `workflow`     | `.claude/workflows/enterprise-track.yaml`     | null           | Update mode + add workflow_file |
| CUJ-059 | `performance-flow.yaml`     | `workflow`     | `.claude/workflows/performance-flow.yaml`     | null           | Update mode + add workflow_file |
| CUJ-063 | `recovery-test-flow.yaml`   | `workflow`     | `.claude/workflows/recovery-test-flow.yaml`   | recovery       | Update mode + add workflow_file |
| CUJ-064 | `skill-workflow` (INVALID)  | `workflow`     | `.claude/workflows/search-setup-flow.yaml`    | algolia-search | Update to valid mode            |

### CUJs Already Compliant

| CUJ ID  | Current Mode   | Status    |
| ------- | -------------- | --------- |
| CUJ-001 | `manual-setup` | Compliant |
| CUJ-002 | `skill-only`   | Compliant |
| CUJ-003 | `skill-only`   | Compliant |
| CUJ-004 | `workflow`     | Compliant |
| CUJ-006 | `workflow`     | Compliant |
| CUJ-007 | `workflow`     | Compliant |
| CUJ-008 | `workflow`     | Compliant |
| CUJ-009 | `workflow`     | Compliant |
| CUJ-013 | `workflow`     | Compliant |
| CUJ-014 | `workflow`     | Compliant |
| CUJ-015 | `workflow`     | Compliant |
| CUJ-016 | `workflow`     | Compliant |
| CUJ-017 | `skill-only`   | Compliant |
| CUJ-018 | `workflow`     | Compliant |
| CUJ-020 | `workflow`     | Compliant |
| CUJ-023 | `workflow`     | Compliant |
| CUJ-025 | `workflow`     | Compliant |
| CUJ-027 | `skill-only`   | Compliant |
| CUJ-030 | `skill-only`   | Compliant |
| CUJ-035 | `workflow`     | Compliant |
| CUJ-036 | `workflow`     | Compliant |
| CUJ-038 | `workflow`     | Compliant |
| CUJ-039 | `workflow`     | Compliant |
| CUJ-040 | `workflow`     | Compliant |
| CUJ-041 | `workflow`     | Compliant |
| CUJ-042 | `manual-setup` | Compliant |
| CUJ-043 | `workflow`     | Compliant |
| CUJ-044 | `workflow`     | Compliant |
| CUJ-045 | `workflow`     | Compliant |
| CUJ-046 | `workflow`     | Compliant |
| CUJ-047 | `workflow`     | Compliant |
| CUJ-048 | `workflow`     | Compliant |
| CUJ-049 | `workflow`     | Compliant |
| CUJ-050 | `workflow`     | Compliant |
| CUJ-051 | `workflow`     | Compliant |
| CUJ-052 | `workflow`     | Compliant |
| CUJ-053 | `workflow`     | Compliant |
| CUJ-054 | `workflow`     | Compliant |
| CUJ-055 | `workflow`     | Compliant |
| CUJ-056 | `workflow`     | Compliant |
| CUJ-057 | `workflow`     | Compliant |
| CUJ-058 | `workflow`     | Compliant |
| CUJ-060 | `workflow`     | Compliant |
| CUJ-061 | `workflow`     | Compliant |
| CUJ-062 | `workflow`     | Compliant |

## Step-by-Step Migration

### Step 1: Identify CUJ to Migrate

Check if your CUJ uses a deprecated pattern:

```bash
# Check current execution_mode
grep -n "Execution Mode" .claude/docs/cujs/CUJ-XXX.md
```

### Step 2: Update Markdown File

**Before** (deprecated pattern):

```markdown
## Workflow

**Execution Mode**: `greenfield-fullstack.yaml`

### Step 0: Planning Phase
```

**After** (canonical pattern):

```markdown
## Workflow

**Execution Mode**: `workflow`

**Workflow File**: `.claude/workflows/greenfield-fullstack.yaml`

### Step 0: Planning Phase
```

### Step 3: Update Registry Entry

If your CUJ is in `cuj-registry.json`, update the entry:

**Before**:

```json
{
  "id": "CUJ-005",
  "execution_mode": "greenfield-fullstack.yaml",
  "workflow": null
}
```

**After**:

```json
{
  "id": "CUJ-005",
  "execution_mode": "workflow",
  "workflow": ".claude/workflows/greenfield-fullstack.yaml",
  "primary_skill": null
}
```

### Step 4: Validate Migration

```bash
# Validate single CUJ
node .claude/tools/cuj-validator-unified.mjs --cuj CUJ-XXX

# Validate all CUJs
pnpm validate:cujs
```

## Migration Examples

### Example 1: Raw YAML to workflow Mode

**CUJ-019: Performance Optimization**

Before:

```markdown
**Execution Mode**: `performance-flow.yaml`
```

After:

```markdown
**Execution Mode**: `workflow`

**Workflow File**: `.claude/workflows/performance-flow.yaml`
```

### Example 2: Invalid Mode Fix

**CUJ-064: Search Functionality**

Before:

```markdown
**Execution Mode**: `skill-workflow`

**Workflow File**: `.claude/workflows/search-setup-flow.yaml`
```

After:

```markdown
**Execution Mode**: `workflow`

**Workflow File**: `.claude/workflows/search-setup-flow.yaml`
```

Note: `skill-workflow` is not a valid mode. Since the CUJ has a workflow file, use `workflow` mode.

### Example 3: skill-only Mode (No Changes Needed)

**CUJ-002: Rule Configuration**

```markdown
**Execution Mode**: `skill-only`

**Primary Skill**: `rule-selector`
```

This is already compliant with the canonical standard.

## Automated Migration Script

A migration script is available to automate bulk updates:

```bash
# Dry run - show what would change
node .claude/tools/migrate-execution-modes.mjs --dry-run

# Apply migrations
node .claude/tools/migrate-execution-modes.mjs --apply

# Migrate specific CUJ
node .claude/tools/migrate-execution-modes.mjs --cuj CUJ-064 --apply
```

## Validation After Migration

### Check Markdown Syntax

Ensure the format matches:

```markdown
**Execution Mode**: `workflow`

**Workflow File**: `.claude/workflows/<name>.yaml`
```

### Check Registry Sync

After migration, resync the registry:

```bash
node scripts/sync-cuj-registry.mjs
```

### Run Full Validation

```bash
pnpm validate
```

## Troubleshooting

### Error: Invalid execution_mode

**Cause**: Using a non-canonical mode value.

**Fix**: Change to one of: `workflow`, `skill-only`, `manual-setup`

### Error: Missing workflow_file

**Cause**: Using `workflow` mode without specifying `workflow_file`.

**Fix**: Add `**Workflow File**: \`.claude/workflows/<name>.yaml\``

### Error: Missing primary_skill

**Cause**: Using `skill-only` mode without specifying `primary_skill`.

**Fix**: Add `**Primary Skill**: \`<skill-name>\``

### Warning: Deprecated execution_mode pattern

**Cause**: Using raw workflow filename instead of canonical mode.

**Fix**: Change to `workflow` mode and add separate `workflow_file` field.

## Migration Statistics

| Category            | Count       |
| ------------------- | ----------- |
| Total CUJs          | 62          |
| Already Compliant   | 46          |
| Requiring Migration | 16          |
| Using Invalid Mode  | 1 (CUJ-064) |

## Timeline

| Phase                | Date       | Status   |
| -------------------- | ---------- | -------- |
| Standard Definition  | 2025-01-12 | Complete |
| Migration Guide      | 2025-01-12 | Complete |
| Deprecation Warnings | 2025-01-12 | Active   |
| Migration Deadline   | 2025-03-01 | Pending  |
| Hard Enforcement     | 2025-04-01 | Pending  |

## Related Documentation

- [Execution Mode Standard](./EXECUTION_MODE_STANDARD.md)
- [Execution Mode Schema](../schemas/execution-mode.schema.json)
- [CUJ Template](../templates/cuj-template.md)
- [CUJ Registry Schema](../schemas/cuj-registry.schema.json)

## Version History

| Version | Date       | Changes                 |
| ------- | ---------- | ----------------------- |
| 1.0.0   | 2025-01-12 | Initial migration guide |
