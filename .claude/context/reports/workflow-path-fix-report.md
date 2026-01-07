# Workflow Path Fix Report

**Date**: 2026-01-06
**Issue**: Workflow file path inconsistencies
**Status**: ✅ RESOLVED

---

## Problem

The validation report identified workflow path inconsistencies:

1. **Malformed workflow path**: CUJ-002 referenced `.claude/workflows/manifest.yaml` which doesn't exist
2. **Risk of double-prefix patterns**: Potential for paths like `.claude/workflows/.claude/workflows/file.yaml`

---

## Investigation

### Validation Tool Created

Created `.claude/tools/validate-workflow-paths.mjs` to:
- Scan `cuj-registry.json` for workflow paths
- Check for double-prefix patterns
- Verify workflow files exist
- Check CUJ documentation for broken links
- Suggest closest matches for missing files

### Findings

**Total CUJs**: 59
**CUJs with workflows**: 14 (now 13 after fix)
**Issues Found**: 1

**Issue Details**:
- **CUJ-002**: Referenced `.claude/workflows/manifest.yaml` (file doesn't exist)
- **Execution mode**: Incorrectly set to `workflow` instead of `skill-only`
- **Primary skill**: `rule-selector` (should be skill-only, not workflow-based)

---

## Resolution

### 1. Fixed CUJ-002 Registry Entry

**File**: `.claude/context/cuj-registry.json`

**Before**:
```json
{
  "id": "CUJ-002",
  "execution_mode": "workflow",
  "workflow": ".claude/workflows/manifest.yaml"
}
```

**After**:
```json
{
  "id": "CUJ-002",
  "execution_mode": "skill-only",
  "workflow": null
}
```

**Rationale**: CUJ-002 (Rule Configuration) is a skill-only CUJ that uses the `rule-selector` skill. It doesn't require a workflow file. The `manifest.yaml` reference was incorrect.

### 2. Validation Results

**After Fix**:
```
✅ All workflow paths are valid!
  • CUJs in registry: 59
  • CUJs with workflows: 13
  • Total issues found: 0
```

---

## Available Workflows (14 Total)

All workflow files verified to exist:

1. `.claude/workflows/ai-system-flow.yaml`
2. `.claude/workflows/automated-enterprise-flow.yaml`
3. `.claude/workflows/bmad-greenfield-standard.yaml`
4. `.claude/workflows/brownfield-fullstack.yaml`
5. `.claude/workflows/browser-testing-flow.yaml`
6. `.claude/workflows/code-quality-flow.yaml`
7. `.claude/workflows/enterprise-track.yaml`
8. `.claude/workflows/greenfield-fullstack.yaml`
9. `.claude/workflows/incident-flow.yaml`
10. `.claude/workflows/legacy-modernization-flow.yaml`
11. `.claude/workflows/mobile-flow.yaml`
12. `.claude/workflows/performance-flow.yaml`
13. `.claude/workflows/quick-flow.yaml`
14. `.claude/workflows/ui-perfection-loop.yaml`

---

## Validation Tool Usage

### Run Validation
```bash
node .claude/tools/validate-workflow-paths.mjs
```

### Auto-Fix Issues
```bash
node .claude/tools/validate-workflow-paths.mjs --fix
```

### Features
- ✅ Detects double-prefix patterns (e.g., `.claude/workflows/.claude/workflows/`)
- ✅ Checks if workflow files exist
- ✅ Validates CUJ documentation links
- ✅ Suggests closest matches for missing files
- ✅ Auto-fixes double-prefix issues with `--fix` flag
- ✅ Color-coded output for easy reading
- ✅ Exit code 0 = success, 1 = issues found

---

## Documentation Verified

### Files Checked

1. **cuj-registry.json**: 59 CUJs checked ✅
2. **CUJ documentation**: 61 files checked ✅
3. **CUJ-INDEX.md**: Mapping table verified ✅

### Consistency Verified

- ✅ CUJ-002 correctly listed as `skill-only` in CUJ-INDEX.md (line 629)
- ✅ CUJ-002 correctly shows `rule-selector` as primary skill
- ✅ No double-prefix patterns found
- ✅ All workflow references point to existing files

---

## Recommendations

### Ongoing Maintenance

1. **Run validation before commits**:
   ```bash
   node .claude/tools/validate-workflow-paths.mjs
   ```

2. **Add to CI/CD pipeline**:
   ```yaml
   - name: Validate workflow paths
     run: node .claude/tools/validate-workflow-paths.mjs
   ```

3. **Use validation tool when**:
   - Adding new CUJs
   - Updating workflow references
   - Renaming workflow files
   - Updating CUJ documentation

### Path Normalization Rules

When referencing workflows, always use:
- ✅ `.claude/workflows/filename.yaml` (canonical format)
- ✅ `null` (for skill-only CUJs)
- ❌ NEVER use double prefixes
- ❌ NEVER use relative paths like `../../workflows/`
- ❌ NEVER use `workflows/` without `.claude/` prefix

---

## Test Results

### Before Fix
```
❌ Validation failed with 1 issues
  • CUJ-002 (line ~35): .claude/workflows/manifest.yaml
```

### After Fix
```
✅ All workflow paths are valid!
  • CUJs in registry: 59
  • CUJs with workflows: 13
  • Total issues found: 0
```

---

## Impact

- **Files Modified**: 1 (`.claude/context/cuj-registry.json`)
- **Lines Changed**: 2 (execution_mode and workflow fields)
- **Breaking Changes**: None
- **Backward Compatibility**: Maintained

---

## Next Steps

1. ✅ **Fixed**: CUJ-002 registry entry
2. ✅ **Created**: Validation tool (`validate-workflow-paths.mjs`)
3. ✅ **Verified**: All workflow paths are valid
4. ⏳ **TODO**: Add validation to pre-commit hooks (optional)
5. ⏳ **TODO**: Add validation to CI/CD pipeline (optional)

---

## Validation Script Features

### Detection Capabilities

- **Double-prefix patterns**: Detects `.claude/workflows/.claude/workflows/`
- **Missing files**: Checks if workflow files exist
- **Broken links**: Validates markdown links to workflows
- **Path normalization**: Suggests correct path format

### Auto-Fix Capabilities

- **Double-prefix removal**: Automatically normalizes paths
- **Consistent format**: Ensures all paths use `.claude/workflows/` prefix
- **Safe operation**: Only fixes double-prefix issues (doesn't delete or rename files)

### Output Format

- **Color-coded**: Green = success, Red = error, Yellow = warning, Blue = info
- **Structured report**: Summary, issues, suggestions, recommendations
- **Exit codes**: 0 = success, 1 = issues found (CI/CD friendly)

---

## Conclusion

All workflow path inconsistencies have been resolved. The validation tool is now available for ongoing maintenance and can detect:

1. ✅ Double-prefix patterns
2. ✅ Missing workflow files
3. ✅ Broken links in documentation
4. ✅ Path inconsistencies

**Status**: ✅ COMPLETE
**All workflow paths validated and corrected**
