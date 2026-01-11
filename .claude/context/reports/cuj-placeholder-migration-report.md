# CUJ Placeholder Migration Report

## Summary

Successfully migrated all 62 CUJs from old `{{workflow_id}}` format to standardized `<run_id>` format.

## Migration Statistics

| Metric                      | Count |
| --------------------------- | ----- |
| **Total CUJ files**         | 62    |
| **Files modified (pass 1)** | 42    |
| **Replacements (pass 1)**   | 220   |
| **Files modified (pass 2)** | 35    |
| **Replacements (pass 2)**   | 111   |
| **Total replacements**      | 331   |

## Validation Results

### Before Migration

- 39 CUJ files with `{{workflow_id}}` violations
- 157 total placeholder occurrences (audit estimate)

### After Migration

- ✅ 0 CUJ files with `{{workflow_id}}` violations
- ✅ 0 CUJ files with `{{run_id}}` violations
- ✅ 0 CUJ files with `{{plan_id}}` violations
- ✅ 56 CUJ files now using correct `<run_id>` format

## Replacement Patterns Applied

### Basic Placeholders

- `{{workflow_id}}` → `<run_id>`
- `{{run_id}}` → `<run_id>` (standardization)
- `{{plan_id}}` → `<plan_id>` (standardization)

### Artifact Paths (Full Paths)

- `plan-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.json`
- `project-brief-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/project-brief.json`
- `prd-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/prd.json`
- `ui-spec-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/ui-spec.json`
- `architecture-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/architecture.json`
- `db-schema-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/db-schema.json`
- `test-plan-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/test-plan.json`
- `dev-manifest-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/dev-manifest.json`
- `docs-{{workflow_id}}.md` → `.claude/context/runs/<run_id>/artifacts/docs.md`
- `api-docs-{{workflow_id}}.md` → `.claude/context/runs/<run_id>/artifacts/api-docs.md`
- `openapi-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/openapi.json`
- `validation-schema-{{workflow_id}}.json` → `.claude/context/runs/<run_id>/artifacts/validation-schema.json`

### Gate Paths

- `gates/{{workflow_id}}/` → `.claude/context/runs/<run_id>/gates/`
- `gates/00-planner.json` → `.claude/context/runs/<run_id>/gates/00-planner.json`
- `gates/02-pm.json` → `.claude/context/runs/<run_id>/gates/02-pm.json`
- "validated by gate file" → "validated by `.claude/context/runs/<run_id>/gates/<step>-<agent>.json`"

### Second Pass (Artifact Name Cleanup)

Removed redundant `-<run_id>` suffixes from artifact names since they're already in run-specific directories:

- `plan-<run_id>.json` → `.claude/context/runs/<run_id>/artifacts/plan-<plan_id>.json`
- `project-brief-<run_id>.json` → `.claude/context/runs/<run_id>/artifacts/project-brief.json`
- (and all other artifact types)

## Files Modified

### First Pass (42 files)

CUJ-004, CUJ-005, CUJ-006, CUJ-007, CUJ-008, CUJ-009, CUJ-010, CUJ-011, CUJ-012, CUJ-013, CUJ-014, CUJ-015, CUJ-016, CUJ-018, CUJ-019, CUJ-020, CUJ-021, CUJ-022, CUJ-023, CUJ-024, CUJ-025, CUJ-027, CUJ-028, CUJ-029, CUJ-034, CUJ-035, CUJ-037, CUJ-039, CUJ-040, CUJ-041, CUJ-043, CUJ-048, CUJ-049, CUJ-050, CUJ-051, CUJ-052, CUJ-053, CUJ-054, CUJ-055, CUJ-056, CUJ-058, CUJ-063

### Second Pass (35 files - artifact name cleanup)

CUJ-005, CUJ-006, CUJ-007, CUJ-008, CUJ-009, CUJ-010, CUJ-011, CUJ-012, CUJ-013, CUJ-014, CUJ-015, CUJ-016, CUJ-018, CUJ-019, CUJ-020, CUJ-021, CUJ-022, CUJ-023, CUJ-024, CUJ-027, CUJ-028, CUJ-029, CUJ-034, CUJ-035, CUJ-037, CUJ-040, CUJ-049, CUJ-051, CUJ-052, CUJ-053, CUJ-054, CUJ-055, CUJ-056, CUJ-058, CUJ-063

## Migration Tool

Created reusable migration script: `.claude/tools/fix-placeholder-regression.mjs`

### Usage

```bash
# Dry run (preview changes)
node .claude/tools/fix-placeholder-regression.mjs --dry-run

# Apply changes
node .claude/tools/fix-placeholder-regression.mjs
```

### Features

- Automatic discovery of all CUJ files
- Comprehensive replacement patterns
- Two-pass processing (placeholders → artifact names)
- Built-in validation with detailed reporting
- Dry-run mode for safe preview

## Notes

### Excluded Files

- `AUDIT-REPORT.md` - Contains 15 intentional `{{workflow_id}}` examples in documentation (not actual CUJ definitions)

### Preserved Placeholders

- `{{endpoint}}` - Used for API endpoint names (e.g., `/api/{{endpoint}}/route.ts`)
- `<step>`, `<agent>` - Generic gate placeholders
- Other domain-specific placeholders (intentionally preserved)

## Success Criteria Met

- ✅ All 39+ CUJs updated with correct `<placeholder>` format
- ✅ Zero `{{workflow_id}}` occurrences in Success Criteria sections
- ✅ Artifact paths use full `.claude/context/runs/<run_id>/...` format
- ✅ Validation command shows 0 files with old format
- ✅ Reusable migration script created

## Date

2026-01-10

## Migration Completed By

Developer Agent (Claude Sonnet 4.5)
