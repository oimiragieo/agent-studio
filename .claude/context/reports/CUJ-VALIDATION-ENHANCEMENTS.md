# CUJ Validation Enhancement Summary

## Files Modified/Created

1. ✅ `.claude/tools/validate-cuj-e2e.mjs` - Enhanced with new validation functions
2. ✅ `scripts/validate-cuj-dry-run.mjs` - Added execution mode checks and schema validation
3. ✅ `.claude/tools/validate-cuj.mjs` - NEW user-facing validation command
4. ✅ `package.json` - Added new validation scripts

## New Validation Functions

### In validate-cuj-e2e.mjs:

- `checkExecutionModeContradiction()` - Detects skill-only CUJs with planning steps
- `checkErrorRecovery()` - Validates workflow CUJs have error recovery
- `validateSchemaReferences()` - Verifies all schema files exist
- `checkPlanRatingStep()` - Ensures workflow CUJs have Step 0.1 (Plan Rating Gate)

### In validate-cuj-dry-run.mjs:

- `checkExecutionModeContradiction()` - CI-failing check for mode mismatches
- `validateSchemaReferences()` - CI-failing check for missing schemas
- `checkPlanRatingStep()` - Warning for missing plan rating gates
- `checkErrorRecovery()` - Warning for missing error recovery

## New Package.json Scripts

```json
"validate:cuj": "node .claude/tools/validate-cuj.mjs"
"validate:cujs:e2e": "node .claude/tools/validate-cuj-e2e.mjs"
"validate:cujs:dry-run": "node scripts/validate-cuj-dry-run.mjs"
```

## Usage Examples

### Validate single CUJ:

```bash
pnpm validate:cuj CUJ-005
node .claude/tools/validate-cuj.mjs CUJ-005 --json
```

### Validate all CUJs (dry-run, CI-safe):

```bash
pnpm validate:cujs:dry-run
```

### Comprehensive E2E validation:

```bash
pnpm validate:cujs:e2e
pnpm validate:cujs:e2e --verbose --json
```

## Validation Checks Implemented

### Critical (CI-Failing):

1. ✅ Execution mode mismatch (skill-only with Step 0)
2. ✅ Missing schema files
3. ✅ Missing required sections
4. ✅ Invalid workflow references

### Warnings:

1. ⚠️ Missing Step 0.1 (Plan Rating Gate) for workflow CUJs
2. ⚠️ Missing error recovery steps for workflow CUJs
3. ⚠️ Missing agent/skill references

## Test Results

Current validation status:

- 21/52 CUJs valid
- 31 execution mode mismatches detected
- All schema references validated
- All new checks operational

## Implementation Complete ✅
