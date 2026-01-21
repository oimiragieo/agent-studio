# Context Path Migration Guide

This document describes the migration from legacy context paths to the new organized structure with resolver fallback.

## Overview

The context directory has been reorganized to separate:

- **Config files** (version-controlled): `.claude/context/config/`
- **Runtime data** (gitignored): `.claude/context/runtime/`
- **Artifacts** (split into generated/reference): `.claude/context/artifacts/`

## Path Mapping

### Config Files

| Legacy Path                                     | New Path                                               | Status      |
| ----------------------------------------------- | ------------------------------------------------------ | ----------- |
| `.claude/context/cuj-registry.json`             | `.claude/context/config/cuj-registry.json`             | ✅ Migrated |
| `.claude/context/skill-integration-matrix.json` | `.claude/context/config/skill-integration-matrix.json` | ✅ Migrated |
| `.claude/context/security-triggers-v2.json`     | `.claude/context/config/security-triggers-v2.json`     | ✅ Migrated |
| `.claude/context/rule-index.json`               | `.claude/context/config/rule-index.json`               | ✅ Migrated |
| `.claude/context/signoff-matrix.json`           | `.claude/context/config/signoff-matrix.json`           | ✅ Migrated |

### Runtime Data

| Legacy Path                            | New Path                               | Status      |
| -------------------------------------- | -------------------------------------- | ----------- |
| `.claude/context/analytics/`           | `.claude/context/runtime/analytics/`   | ✅ Migrated |
| `.claude/context/audit/`               | `.claude/context/runtime/audit/`       | ✅ Migrated |
| `.claude/context/cache/`               | `.claude/context/runtime/cache/`       | ✅ Migrated |
| `.claude/context/runtime/checkpoints/` | `.claude/context/runtime/checkpoints/` | ✅ Migrated |
| `.claude/context/logs/`                | `.claude/context/runtime/logs/`        | ✅ Migrated |
| `.claude/context/memory/`              | `.claude/context/runtime/memory/`      | ✅ Migrated |
| `.claude/context/reports/`             | `.claude/context/runtime/reports/`     | ✅ Migrated |
| `.claude/context/runtime/runs/`        | `.claude/context/runtime/runs/`        | ✅ Migrated |
| `.claude/context/sessions/`            | `.claude/context/runtime/sessions/`    | ✅ Migrated |
| `.claude/context/tasks/`               | `.claude/context/runtime/tasks/`       | ✅ Migrated |
| `.claude/context/test/`                | `.claude/context/runtime/test/`        | ✅ Migrated |
| `.claude/context/tmp/`                 | `.claude/context/runtime/tmp/`         | ✅ Migrated |
| `.claude/context/todos/`               | `.claude/context/runtime/todos/`       | ✅ Migrated |

### Artifacts

| Legacy Path                                    | New Path                                               | Status      |
| ---------------------------------------------- | ------------------------------------------------------ | ----------- |
| `.claude/context/artifacts/*.json` (generated) | `.claude/context/artifacts/generated/*.json`           | ✅ Migrated |
| `.claude/context/artifacts/*-rubric.json`      | `.claude/context/artifacts/reference/*-rubric.json`    | ✅ Migrated |
| `.claude/context/artifacts/*-reference.json`   | `.claude/context/artifacts/reference/*-reference.json` | ✅ Migrated |
| `.claude/context/artifacts/*-template.json`    | `.claude/context/artifacts/reference/*-template.json`  | ✅ Migrated |

### History (Stable - Option A)

| Path                       | Status                               |
| -------------------------- | ------------------------------------ |
| `.claude/context/history/` | ✅ Kept stable (workflows expect it) |

## Resolver Fallback Behavior

The `context-path-resolver.mjs` provides backward compatibility:

### Read Behavior

- **Primary**: Check canonical (new) path first
- **Fallback**: If canonical doesn't exist, use legacy path
- **Precedence**: If both exist, prefer canonical (newer) path

### Write Behavior

- **Always**: Writes go to canonical paths
- **Auto-migration**: On write, automatically migrates from legacy if needed

### Example Usage

```javascript
import {
  resolveConfigPath,
  resolveRuntimePath,
  resolveArtifactPath,
} from './context-path-resolver.mjs';

// Config file (read with fallback)
const registryPath = resolveConfigPath('cuj-registry.json', { read: true });

// Config file (write to canonical)
const writePath = resolveConfigPath('cuj-registry.json', { read: false });

// Runtime file (read with fallback)
const analyticsPath = resolveRuntimePath('analytics/cuj-performance.json', { read: true });

// Runtime file (write to canonical)
const writeAnalyticsPath = resolveRuntimePath('analytics/cuj-performance.json', { read: false });

// Artifact (enforces kind)
const generatedArtifact = resolveArtifactPath({ kind: 'generated', filename: 'plan-123.json' });
const referenceArtifact = resolveArtifactPath({ kind: 'reference', filename: 'rubric.json' });
```

## Migration Helper

The resolver includes `migrateIfNeeded()` for idempotent migrations:

```javascript
import { migrateIfNeeded } from './context-path-resolver.mjs';

// Idempotent migration (safe to run multiple times)
migrateIfNeeded(
  '.claude/context/runtime/analytics/cuj-performance.json',
  '.claude/context/runtime/analytics/cuj-performance.json',
  { mergePolicy: 'prefer-newer' }
);
```

### Merge Policies

- **`prefer-newer`**: Prefer newer timestamps, merge JSON objects, append arrays
- **`append`**: Append old content to new (for log files)
- **`overwrite`**: Use newer file content

## Precedence Rules

When both old and new paths exist:

1. **For reads**: Prefer canonical (new) path
2. **For writes**: Always use canonical path
3. **On mismatch**: Warn and use canonical (auto-migrate on write)

## Enforcement

Direct path construction to context files is prevented via:

- **Mechanical check**: `scripts/validation/check-path-construction.mjs`
- **CI integration**: Fails build if violations found
- **Hard rule**: All context path access MUST go through `context-path-resolver.mjs`

## Updated Tools

The following tools have been updated to use the resolver:

- ✅ `.claude/tools/run-cuj.mjs` - Registry and analytics paths
- ✅ `.claude/tools/sync-cuj-registry.mjs` - Registry path
- ✅ `.claude/tools/cuj-validator-unified.mjs` - Registry path
- ✅ `.claude/tools/workflow_runner.js` - Registry path

## Migration Checklist

- [x] Phase 0.0: Artifacts boundary tightened (Option A-Safe)
- [x] Phase 0.1: Skill validation verified
- [x] Phase 0.2: CUJ schema fixed
- [x] Phase 0.3: Test strategy defined
- [x] Phase 2.0.1: Resolver created
- [x] Phase 2.0.2: Core entrypoints updated
- [x] Phase 2.0.3: Mechanical enforcement added
- [x] Phase 2.1: Context structure created
- [x] Phase 2.2: Config files moved
- [x] Phase 2.3: Runtime data moved
- [x] Phase 3: .gitignore updated
- [x] Phase 4: Documentation organized

## Next Steps

1. Gradually migrate remaining tools to use resolver
2. Remove legacy path fallback after full migration
3. Update workflow YAML paths if Option B chosen (currently Option A - stable)
