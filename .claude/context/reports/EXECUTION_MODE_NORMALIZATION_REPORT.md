# Execution Mode Normalization Report

## Summary

Normalized execution mode handling across all CUJ validators to align with the schema enum in `.claude/schemas/cuj-registry.schema.json`.

## Problem

CUJ documentation and validators used mixed execution mode values:
- Raw `.yaml` file references (e.g., `greenfield-fullstack.yaml`)
- `automated-workflow`
- `delegated-skill`
- `skill` vs `skill-only`
- `manual` vs `manual-setup`

This caused validation inconsistencies and made it difficult to determine the execution mode programmatically.

## Schema-Compliant Values

According to `.claude/schemas/cuj-registry.schema.json`, the official `execution_mode` enum values are:
- `"workflow"` - Multi-agent workflow execution
- `"skill-only"` - Direct skill invocation without workflow
- `"delegated-skill"` - Skill invoked by an agent (maps to `skill-only`)
- `"manual-setup"` - Manual setup/execution required

## Solution

### 1. Added Normalization Function

Created `normalizeExecutionMode()` function in all validators:

```javascript
function normalizeExecutionMode(mode) {
  if (!mode) return null;

  const modeMap = {
    'workflow': 'workflow',
    'automated-workflow': 'workflow',
    'delegated-skill': 'skill-only',
    'skill-only': 'skill-only',
    'skill': 'skill-only',
    'manual-setup': 'manual-setup',
    'manual': 'manual-setup'
  };

  // Handle raw .yaml references as 'workflow'
  if (mode.endsWith('.yaml')) {
    return 'workflow';
  }

  return modeMap[mode] || mode;
}
```

**Normalization Rules**:
- `automated-workflow` → `workflow`
- `delegated-skill` → `skill-only`
- `skill` → `skill-only`
- `manual` → `manual-setup`
- `*.yaml` → `workflow` (raw YAML file references)

### 2. Separated Workflow File from Execution Mode

**Before**: Mixed execution mode and workflow file path
```
Execution Mode: greenfield-fullstack.yaml
```

**After**: Separate fields for clarity
- `execution_mode`: `"workflow"` (normalized)
- `workflow_file`: `"greenfield-fullstack.yaml"` (extracted separately)

This separation allows:
1. Consistent execution mode checks (`if (mode === 'workflow')`)
2. Workflow file validation (`if (workflowFile) { validateWorkflow(workflowFile) }`)
3. Schema compliance without losing workflow file references

### 3. Updated All Validators

Modified three validation scripts:

#### A. `scripts/validate-cujs.mjs`
- Added `normalizeExecutionMode()` function
- Updated `extractExecutionMode()` to normalize values
- Separated workflow file extraction from mode normalization
- Normalized both CUJ-declared modes and CUJ-INDEX.md mapping modes before comparison

#### B. `scripts/validate-cuj-dry-run.mjs`
- Added `normalizeExecutionMode()` function
- Updated `extractExecutionMode()` to normalize values
- Separated workflow file extraction from mode normalization
- Updated `checkExecutionModeContradiction()` to use normalized modes

#### C. `.claude/tools/validate-cuj.mjs`
- Added `normalizeExecutionMode()` function
- Updated `extractExecutionMode()` to normalize values
- Separated workflow file extraction from mode normalization
- Updated all mode checks to use normalized values

### 4. Backward Compatibility

The validators still support legacy formats:
- `**Execution Mode**: greenfield-fullstack.yaml` → Normalizes to `workflow`, extracts `greenfield-fullstack.yaml` as workflow file
- `Workflow Reference: skill-only` → Normalizes to `skill-only`
- `automated-workflow` → Normalizes to `workflow`

### 5. CUJ-INDEX.md Considerations

The `CUJ-INDEX.md` file contains a mapping table with the "Execution Mode" column. This column should be updated to use consistent values:

**Current Mixed Values**:
| CUJ ID | Execution Mode | Workflow File Path | Primary Skill |
|--------|----------------|-------------------|---------------|
| CUJ-004 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-010 | workflow | `.claude/workflows/brownfield-fullstack.yaml` | scaffolder |
| CUJ-002 | skill-only | null | rule-selector |

**Recommendation**: Keep the table as-is for now, since validators now normalize the values automatically. The mixed values in the table are handled by the normalization function.

Alternatively, update the table to use only schema-compliant values:
- Replace `greenfield-fullstack.yaml` with `workflow` (keep workflow file in separate column)
- Standardize all `delegated-skill` to `skill-only`
- Standardize all `manual` to `manual-setup`

## Files Modified

1. `scripts/validate-cujs.mjs`
   - Added normalization function
   - Updated extraction logic
   - Separated workflow file from mode

2. `scripts/validate-cuj-dry-run.mjs`
   - Added normalization function
   - Updated extraction logic
   - Separated workflow file from mode

3. `.claude/tools/validate-cuj.mjs`
   - Added normalization function
   - Updated extraction logic
   - Separated workflow file from mode

## Testing

All validators now:
- ✅ Accept raw `.yaml` references and normalize to `workflow`
- ✅ Accept legacy formats (`automated-workflow`, `delegated-skill`, `manual`)
- ✅ Normalize to schema-compliant values before validation
- ✅ Separate workflow file extraction from mode normalization
- ✅ Validate workflow files exist when referenced
- ✅ Compare normalized modes consistently

## Next Steps

**Optional - Update CUJ-INDEX.md** (not required, normalization handles this):
- Update "Execution Mode" column to use only schema-compliant values
- Keep workflow file references in "Workflow File Path" column

**Optional - Update Individual CUJ Files** (not required, validators accept both formats):
- Replace `**Execution Mode**: greenfield-fullstack.yaml` with `**Execution Mode**: workflow` and add `**Workflow File**: greenfield-fullstack.yaml`
- Standardize all execution modes to schema-compliant values

**Benefits of Not Updating**:
- Backward compatibility preserved
- Less disruptive to existing CUJ files
- Validators handle normalization automatically

**Benefits of Updating**:
- Schema compliance at source
- Clearer separation of concerns
- Easier to audit execution modes

## Conclusion

Execution mode normalization is now implemented across all validators. The system accepts both legacy and schema-compliant formats, normalizes them automatically, and validates consistently.

**Key Achievement**: CUJ execution modes are now deterministic, schema-compliant, and backward-compatible.
