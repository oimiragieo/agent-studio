# Skill Field Requirements

## Overview

This document defines which fields are **required** vs **recommended** in skill SKILL.md frontmatter. The validation rules balance backwards compatibility with best practices.

## Field Classification

### Required Fields (MUST Have)

These fields are **mandatory** and validation will **ERROR** if missing:

| Field         | Type   | Description                                  | Example                        |
| ------------- | ------ | -------------------------------------------- | ------------------------------ |
| `name`        | string | Skill identifier (must match directory name) | `rule-auditor`                 |
| `description` | string | Brief description of skill purpose           | `Validates code against rules` |

**Impact**: Missing required fields will cause validation to fail with exit code 1.

### Recommended Fields (SHOULD Have)

These fields are **strongly recommended** but validation will only **WARN** if missing:

| Field           | Type          | Description             | Example               |
| --------------- | ------------- | ----------------------- | --------------------- |
| `allowed-tools` | array         | Tools the skill can use | `[read, write, grep]` |
| `version`       | number/string | Skill version           | `1.0` or `"2.1"`      |

**Impact**: Missing recommended fields will produce warnings but validation will still pass with exit code 0.

### Optional Fields (MAY Have)

These fields are completely optional and produce no warnings:

| Field            | Type    | Description                                  | Valid Values              | Example                                    |
| ---------------- | ------- | -------------------------------------------- | ------------------------- | ------------------------------------------ |
| `context:fork`   | boolean | Enable context forking for 80% token savings | `true`, `false`           | `true`                                     |
| `model`          | string  | Preferred Claude model                       | `haiku`, `sonnet`, `opus` | `sonnet`                                   |
| `executable`     | string  | Path to executable script                    | Any path                  | `scripts/audit.mjs`                        |
| `test_suite`     | string  | Path to test file                            | Any path                  | `scripts/test.mjs`                         |
| `best_practices` | array   | Best practice guidelines                     | Array of strings          | `["Run early", "Fix high-severity first"]` |
| `error_handling` | string  | Error handling approach                      | Any string                | `graceful`                                 |
| `streaming`      | string  | Streaming support                            | Any string                | `supported`                                |
| `output_formats` | array   | Supported output formats                     | Array of strings          | `[markdown, json]`                         |
| `templates`      | array   | Skill template types                         | Array of strings          | `[component, api, test]`                   |

## Validation Behavior

### Valid Skill Examples

#### Minimal Valid Skill

```yaml
---
name: minimal-skill
description: A minimal skill with only required fields
---
```

**Result**: ✅ Pass with 2 warnings (missing `allowed-tools` and `version`)

#### Complete Skill

```yaml
---
name: complete-skill
description: A complete skill with all fields
allowed-tools: [read, write, grep]
version: 1.0
context:fork: true
model: sonnet
---
```

**Result**: ✅ Pass with 0 warnings

#### Legacy Skill (No Version)

```yaml
---
name: legacy-skill
description: Skill from before version tracking
allowed-tools: [read]
---
```

**Result**: ✅ Pass with 1 warning (missing `version`)

### Invalid Skill Examples

#### Missing Name

```yaml
---
description: Skill without name
allowed-tools: [read]
---
```

**Result**: ❌ Fail - Missing required field: `name`

#### Missing Description

```yaml
---
name: no-description
allowed-tools: [read]
---
```

**Result**: ❌ Fail - Missing required field: `description`

#### Invalid context:fork Type

```yaml
---
name: invalid-fork
description: Skill with string context:fork
context:fork: 'yes'
---
```

**Result**: ❌ Fail - `context:fork` must be boolean, got string

#### Invalid Model

```yaml
---
name: invalid-model
description: Skill with invalid model
model: gpt4
---
```

**Result**: ❌ Fail - `model` must be one of: haiku, sonnet, opus

## Validation Error Levels

| Level       | Exit Code | When It Appears                                    | Example                              |
| ----------- | --------- | -------------------------------------------------- | ------------------------------------ |
| **ERROR**   | 1         | Required field missing OR invalid field type/value | `Missing required field: name`       |
| **WARNING** | 0         | Recommended field missing OR name mismatch         | `Missing recommended field: version` |
| **INFO**    | 0         | Advisory messages                                  | `Skill validated successfully`       |

## Why This Approach?

### Backwards Compatibility

- **78 existing skills** don't have `version` field
- **5 existing skills** don't have `allowed-tools` field
- Making these required would break all existing skills

### Forward Compatibility

- New skills are **encouraged** to include `allowed-tools` and `version`
- Warnings guide developers to best practices
- Required fields can be expanded in future without breaking changes

### Graceful Degradation

- Skills without `version` still work, but can't be version-checked
- Skills without `allowed-tools` still work, but can't be permission-checked
- No functionality is lost, just optional features disabled

## Migration Guide

### For New Skills

Always include all recommended fields:

```yaml
---
name: my-new-skill
description: What my skill does
allowed-tools: [read, write]
version: 1.0
context:fork: true # Optional but recommended for token savings
model: sonnet # Optional but helps with routing
---
```

### For Existing Skills

Gradually add recommended fields when updating skills:

```diff
 ---
 name: my-legacy-skill
 description: Legacy skill
+allowed-tools: [read]
+version: 1.0
 ---
```

### Bulk Update Script

To update all skills at once:

```bash
# Find skills missing version
find .claude/skills -name "SKILL.md" -exec grep -L "version:" {} \;

# Find skills missing allowed-tools
find .claude/skills -name "SKILL.md" -exec grep -L "allowed-tools:" {} \;
```

## Testing

### Run Validation

```bash
# Validate all skills
node scripts/validate-config.mjs

# Run skill validation tests
node --test tests/validate-skills.test.mjs
```

### Expected Output

- **Exit Code 0**: Validation passed (may have warnings)
- **Exit Code 1**: Validation failed (has errors)

### Warning vs Error Output

```
Warnings (non-blocking):
  - Skill algolia-search: Missing recommended field: version
  - Skill explaining-rules: Missing recommended field: allowed-tools

Errors (blocking):
  - Skill bad-skill: Missing required field: name
```

## See Also

- `.claude/skills/` - All skill definitions
- `scripts/validate-config.mjs` - Validation script implementation
- `tests/validate-skills.test.mjs` - Skill validation test suite
- `.claude/docs/SKILLS_TAXONOMY.md` - Complete skills documentation
