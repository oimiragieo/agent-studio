# CUJ Validator Enhancements

## Overview
Enhanced `scripts/validate-cujs.mjs` to validate execution mode consistency between CUJ files and the CUJ-INDEX.md mapping table.

## New Features

### 1. Execution Mode Validation
- **Parses CUJ-INDEX.md**: Extracts the "Run CUJ Mapping" table (lines 291-345)
- **Extracts Declared Mode**: Reads `**Execution Mode**: <mode>` from each CUJ file
- **Compares Modes**: Warns if CUJ declares a different mode than CUJ-INDEX.md maps to
- **Example Warning**: `Execution mode mismatch: CUJ declares "skill-only" but CUJ-INDEX.md maps to "greenfield-fullstack.yaml"`

### 2. Workflow File Validation
- **Checks Existence**: Validates that workflow files referenced in execution modes exist
- **Path Validation**: Checks `.claude/workflows/<workflow-name>.yaml`
- **Example Warning**: `CUJ-INDEX.md references workflow "feature-development.yaml" which does not exist at .claude/workflows/feature-development.yaml`

### 3. Skill Validation
- **Primary Skill Check**: Validates that skills listed as "Primary Skill" in mapping table exist
- **Path Validation**: Checks `.claude/skills/<skill-name>/SKILL.md`
- **Example Warning**: `CUJ-INDEX.md references primary skill "recovery" which does not exist`

### 4. Mapping Coverage Validation
- **Missing Entries**: Warns if a CUJ file exists but has no entry in CUJ-INDEX.md mapping table
- **Example Warning**: `CUJ "CUJ-056" not found in CUJ-INDEX.md mapping table`

## Enhanced Summary Output

The validator now reports:
```
============================================================
Summary:
  ✅ Valid: 49/53
  ❌ Issues: 15
  ⚠️  Warnings: 140
  🔄 Execution Mode Mismatches: 33
  📋 Missing CUJ-INDEX.md Entries: 0
============================================================
```

## CI-Friendly Exit Codes

- **Exit 0**: All CUJs valid (warnings allowed)
- **Exit 1**: Validation failed (issues found)

## Current Validation Results

As of this enhancement:
- **53 CUJ files** found
- **49 valid** (with warnings)
- **4 invalid** (CUJ-010, CUJ-034, CUJ-AUDIT-REPORT, missing sections)
- **33 execution mode mismatches** detected
- **Many workflow files** referenced but not yet created

## Common Mismatches Detected

1. **skill-only → workflow**: CUJ declares `skill-only` but mapping references a workflow file
   - CUJ-004: `skill-only` → `feature-development.yaml`
   - CUJ-006: `skill-only` → `architecture-review.yaml`
   - CUJ-007: `skill-only` → `refactoring.yaml`

2. **workflow → different workflow**: CUJ declares one workflow, mapping references another
   - CUJ-012: `greenfield-fullstack.yaml` → `feature-development.yaml`
   - CUJ-026: `greenfield-fullstack.yaml` → `multi-phase.yaml`

3. **Missing workflow files**: Many workflows referenced in mapping don't exist yet
   - `feature-development.yaml`
   - `architecture-review.yaml`
   - `database-design.yaml`
   - And many more...

## Next Steps

1. **Fix Execution Mode Mismatches**: Update either CUJ files or CUJ-INDEX.md to align
2. **Create Missing Workflows**: Implement workflow files referenced in mapping
3. **Update CUJ-INDEX.md**: Ensure all CUJs have mapping entries
4. **Fix Invalid CUJs**: Add missing sections to CUJ-010, CUJ-034, etc.

## Usage

```bash
# Run validation
node scripts/validate-cujs.mjs

# Show help
node scripts/validate-cujs.mjs --help
```

## Implementation Details

### New Functions
- `getCUJMapping()`: Parses CUJ-INDEX.md mapping table (cached)
- `extractCUJId()`: Extracts CUJ ID from filename (e.g., `CUJ-001.md` → `CUJ-001`)
- `extractExecutionMode()`: Extracts execution mode from CUJ content

### Enhanced Validation Logic
- Added execution mode comparison in `validateCUJ()`
- Added workflow file existence check
- Added primary skill existence check
- Added mapping coverage check
- Enhanced summary statistics with mismatch counts

### Backward Compatibility
- All existing validation rules preserved
- New checks are warnings (not failures) to avoid breaking CI
- Exit codes unchanged (0 = pass with warnings, 1 = fail with issues)
