# CUJ Skill-Only Clarification Report

## Issue
Some skill-only CUJs mentioned planning or rating, which conflicts with their execution mode (skill-only CUJs execute directly without planning).

## Fix Applied
Added a standard clarification note to skill-only CUJs that mention planning/rating phases:

```markdown
> **Note**: Skill-only CUJs execute directly without planning. If invoked via workflow, planning (Step 0) and rating (Step 0.1) occur first. Direct skill invocation skips planning.
```

## CUJs Updated

### 1. CUJ-017: Module Documentation
- **File**: `.claude/docs/cujs/CUJ-017.md`
- **Issue**: Had old note "Skill-only CUJs may include optional plan rating for quality assurance, but planning is not required for direct skill invocation"
- **Fix**: Replaced with standard clarification note
- **Status**: ✅ Updated

### 2. CUJ-044: Agent Fallback Chain
- **File**: `.claude/docs/cujs/CUJ-044.md`
- **Issue**: Includes Step 0 (Planning Phase) and Step 0.1 (Plan Rating Gate) but had no clarification
- **Fix**: Added standard clarification note
- **Status**: ✅ Updated

## CUJs Reviewed (No Update Needed)

### 1. CUJ-003: Cross-Platform Setup
- **File**: `.claude/docs/cujs/CUJ-003.md`
- **Execution Mode**: skill-only
- **Mentions Planning/Rating**: No
- **Status**: ✅ No update needed

### 2. CUJ-027: Workflow Recovery After Context Loss
- **File**: `.claude/docs/cujs/CUJ-027.md`
- **Execution Mode**: skill-only
- **Has "Step 0"**: Yes, but it's "Recovery Initiation" (workflow step, not planning phase)
- **Status**: ✅ No update needed

### 3. CUJ-030: Multi-AI Validation Workflow
- **File**: `.claude/docs/cujs/CUJ-030.md`
- **Execution Mode**: skill-only
- **Mentions Planning/Rating**: No
- **Status**: ✅ No update needed

## Summary

- **Total Skill-Only CUJs Checked**: 5
- **Updated**: 2 (CUJ-017, CUJ-044)
- **No Update Needed**: 3 (CUJ-003, CUJ-027, CUJ-030)
- **Files Modified**: 2

## Standard Clarification Note

The following note has been added to skill-only CUJs that document planning/rating phases:

```markdown
> **Note**: Skill-only CUJs execute directly without planning. If invoked via workflow, planning (Step 0) and rating (Step 0.1) occur first. Direct skill invocation skips planning.
```

This note:
- Clarifies that skill-only execution skips planning
- Explains when planning occurs (workflow invocation)
- Distinguishes between direct skill invocation vs workflow execution
- Uses blockquote format for visual prominence

## Validation

All skill-only CUJs have been checked for consistency:
- ✅ CUJs with planning/rating phases now have clarification notes
- ✅ CUJs without planning/rating phases remain unchanged
- ✅ All clarification notes use consistent wording and format

## Next Steps

None required. All skill-only CUJs have been updated or verified as correct.

---

**Report Generated**: 2026-01-06
**Task Completed By**: Master Orchestrator (following subagent file location rules)
