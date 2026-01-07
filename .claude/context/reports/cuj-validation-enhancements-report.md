# CUJ Validation Script Enhancements Report

**Date**: 2026-01-06
**Script**: `scripts/validate-cujs.mjs`
**Status**: ✅ Complete

## Summary

Enhanced the CUJ validation script with 7 new validation checks to ensure execution mode consistency, workflow file existence, skill references, plan rating gates, rubric files, and plan rating thresholds.

## New Validations Added

### 1. Execution Mode Validation
- **Check**: Valid values: `workflow`, `skill-only`, `manual-setup`
- **Implementation**: Validates that normalized execution mode matches standard values
- **Output**: Warning if execution mode is non-standard
- **Metric**: `⚙️ Invalid Execution Modes: N`

### 2. Workflow File Existence Check
- **Check**: For CUJs with execution_mode: "workflow", verify referenced workflow file exists
- **Implementation**: Checks `.claude/workflows/<workflow_name>.yaml` exists
- **Output**: Issue if workflow file does not exist
- **Metric**: `📄 Missing Workflow Files: N`

### 3. Skill Reference Validation
- **Check**: Verify skill references exist in `.claude/skills/` directory
- **Implementation**: Each skill should have a SKILL.md file
- **Output**: Warning if skill reference does not exist
- **Metric**: `🛠️ Missing Skill References: N`

### 4. Skill-Only CUJ Step 0/0.1 Validation
- **Check**: Skill-only CUJs should NOT have Step 0/0.1 as mandatory
- **Implementation**: Detects Step 0 and Step 0.1 in workflow section for skill-only CUJs
- **Output**: Warning if skill-only CUJ has mandatory Step 0/0.1
- **Rationale**: Skill-only CUJs execute directly without planning workflows

### 5. Workflow-Based CUJ Plan Rating Gate Validation
- **Check**: For workflow-based CUJs, ensure Step 0.1 (Plan Rating Gate) is documented
- **Implementation**: Detects Step 0.1 or "Plan Rating Gate" in workflow section
- **Output**: Warning if workflow-based CUJ is missing Step 0.1
- **Metric**: `📊 Plan Rating Step Missing: N`

### 6. Plan Rating Artifact Path Validation
- **Check**: Validate plan rating artifact path matches standard format
- **Implementation**: Checks for `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json` pattern
- **Output**: Warning if artifact path is non-standard or missing
- **Standard Path**: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

### 7. Rubric File Reference Validation
- **Check**: If workflows reference rubric file, verify it exists
- **Implementation**: Detects "Rubric: <path>" references and checks file existence
- **Output**: Warning if rubric file does not exist
- **Metric**: `📋 Missing Rubric Files: N`
- **Default Rubric**: `.claude/context/artifacts/standard-plan-rubric.json`

### 8. Plan Rating Threshold Validation
- **Check**: Validate minimum_score is appropriate: 5 (emergency), 7 (standard), 8 (enterprise)
- **Implementation**: Detects "minimum_score:" or "threshold:" and validates value
- **Output**: Warning if threshold is not 5, 7, or 8
- **Metric**: `🎯 Invalid Plan Rating Thresholds: N`

## Enhanced Summary Output

New metrics added to validation summary:
```
============================================================
Summary:
  ✅ Valid: 21/59
  ❌ Issues: 40
  ⚠️  Warnings: 184
  🔄 Execution Mode Mismatches: 4
  📋 Missing CUJ-INDEX.md Entries: 0
  ⚙️  Invalid Execution Modes: 0
  📄 Missing Workflow Files: 0
  🛠️  Missing Skill References: 0
  📊 Plan Rating Step Missing: 2
  📋 Missing Rubric Files: 0
  🎯 Invalid Plan Rating Thresholds: 0
============================================================
```

## Help Text Updated

New checks documented in help text:
```bash
node scripts/validate-cujs.mjs --help
```

Additional checks listed:
- Execution mode validation (workflow, skill-only, manual-setup)
- Skill-only CUJs do not have mandatory Step 0/0.1
- Workflow-based CUJs have Step 0.1 (Plan Rating Gate)
- Plan rating artifact path validation
- Rubric file reference validation
- Plan rating threshold validation (5, 7, or 8)

## Validation Results (Current State)

**Total CUJs**: 59

**Validation Status**:
- ✅ Valid: 21/59 (36%)
- ❌ Issues: 40 (mostly missing execution mode declarations)
- ⚠️ Warnings: 184 (various non-critical issues)

**Key Findings**:
- Execution Mode Mismatches: 4
- Plan Rating Step Missing: 2
- Many CUJs need execution mode declarations added

## Next Steps

1. **Fix Execution Mode Declarations**: 40 CUJs need explicit execution mode declarations
2. **Add Plan Rating Gates**: 2 workflow-based CUJs need Step 0.1 documented
3. **Standardize Artifact Paths**: Ensure all plan rating artifact paths follow standard format
4. **Document Rubric Files**: Add rubric file references where appropriate

## Technical Details

### Functions Added

1. **`validateRubricFile(rubricPath)`**
   - Validates rubric file exists
   - Used for rubric file reference validation

### Variables Added

1. **`hasStep0`**: Boolean flag for Step 0 detection
2. **`hasStep01`**: Boolean flag for Step 0.1 detection
3. **Validation counters**:
   - `executionModeInvalid`
   - `workflowFilesMissing`
   - `skillReferencesMissing`
   - `planRatingStepMissing`
   - `rubricFilesMissing`
   - `planRatingThresholdInvalid`

### Regex Patterns Used

1. **Step Detection**: `/Step\s+0[:\s]/i`, `/Step\s+0\.1[:\s]|Plan\s+Rating\s+Gate/i`
2. **Artifact Path**: `/\.claude\/context\/runs\/[^/]+\/plans\/[^/]+-rating\.json/`
3. **Rubric Reference**: `/Rubric:\s*`?([^`\n]+rubric[^`\n]*\.json)`?/i`
4. **Threshold**: `/(?:minimum[_\s]score|threshold):\s*(\d+)/i`

## Files Modified

1. **`scripts/validate-cujs.mjs`**
   - Added 7 new validation checks
   - Enhanced summary output with 6 new metrics
   - Updated help text

## Testing

Validation script tested against all 59 CUJs:
```bash
node scripts/validate-cujs.mjs
```

**Results**:
- Script runs successfully
- All new validations execute
- Metrics correctly counted
- Summary output enhanced

## Related Documentation

- **CUJ Template**: `.claude/templates/cuj-template.md`
- **CUJ Index**: `.claude/docs/cujs/CUJ-INDEX.md`
- **CUJ Registry**: `.claude/context/cuj-registry.json`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`

## Conclusion

The CUJ validation script has been successfully enhanced with 7 new validation checks to ensure:
1. Execution mode consistency between CUJs and CUJ-INDEX.md
2. Workflow file existence for workflow-based CUJs
3. Skill reference validation
4. Proper Step 0/0.1 usage based on execution mode
5. Plan rating artifact path standardization
6. Rubric file reference validation
7. Plan rating threshold validation

These enhancements will help maintain CUJ quality and consistency across the project.
