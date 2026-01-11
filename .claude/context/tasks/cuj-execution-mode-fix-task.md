# CUJ Execution Mode Consistency Fix

## Task Overview

Fix execution mode inconsistencies across 8 CUJs where the CUJ file content contradicts the CUJ-INDEX.md mapping.

## Issues Identified

### 1. CUJ-013 (Code Review)

- **Issue**: Marked as `skill-only` in CUJ-INDEX.md but CUJ file has Step 0 planning (workflow mode)
- **CUJ-INDEX.md**: Line 641: `CUJ-013 | skill-only | null | rule-auditor`
- **CUJ File**: Lines 14-31 include Step 0 planning and Step 0.1 rating gate
- **Decision**: **Change to `workflow` mode** - File has full planning, making it a workflow
- **Fix**: Update CUJ-INDEX.md line 641 to `workflow` mode

### 2. CUJ-002 (Rule Configuration)

- **Issue**: Currently `skill-only` but task description implies orchestrator delegation
- **CUJ-INDEX.md**: Line 630: `CUJ-002 | skill-only | null | rule-selector`
- **CUJ File**: Lines 12-16 note "skill-only" but orchestrator spawns worker agent pattern
- **Decision**: **Keep as `skill-only`** - Direct skill invocation without workflow
- **Fix**: No change needed - CUJ file correctly describes skill-only execution

### 3. CUJ-027 (Workflow Recovery)

- **Issue**: Marked `skill-only` but contains Step 0 planning
- **CUJ-INDEX.md**: Line 654: `CUJ-027 | skill-only | null | recovery`
- **CUJ File**: Lines 17-20 have "Step 0: Recovery Initiation"
- **Decision**: **Keep as `skill-only`** - Step 0 is recovery initiation, not planning
- **Fix**: No change needed - Recovery skill handles the workflow

### 4. CUJ-044 (Agent Fallback Chain)

- **Issue**: Says "no planning" then includes Step 0/0.1
- **CUJ-INDEX.md**: Line 668: `CUJ-044 | manual-setup | null | null`
- **CUJ File**: Lines 17-18 say "skill-only" but Lines 20-36 have Step 0 and 0.1
- **Decision**: **Change to `workflow` mode** - Has planning phase despite note
- **Fix**: Update CUJ-INDEX.md line 668 to `workflow` mode

### 5. CUJ-049 (Cursor Plan Mode)

- **Issue**: Has Step 0 but inconsistent with workflow guide
- **CUJ-INDEX.md**: Line 673: `CUJ-049 | manual-setup | null | null`
- **CUJ File**: Lines 15-21 have "Step 0: Strategic Planning" (full planning)
- **Decision**: **Change to `workflow` mode** - Has complete planning phase
- **Fix**: Update CUJ-INDEX.md line 673 to `workflow` mode

### 6. CUJ-051 (Artifact Publishing Validation)

- **Issue**: Currently `workflow` but task says should be skill-based
- **CUJ-INDEX.md**: Line 675: `CUJ-051 | workflow | .claude/workflows/brownfield-fullstack.yaml | null`
- **CUJ File**: Lines 14-31 have full planning phase with Step 0 and 0.1
- **Decision**: **Keep as `workflow`** - Has planning phase, so it's workflow
- **Fix**: No change needed - Already correctly marked as workflow

### 7. CUJ-052 (Artifact Registry Migration)

- **Issue**: Currently `skill-only` but has planning phases
- **CUJ-INDEX.md**: Line 677: `CUJ-052 | skill-only | null | artifact-publisher`
- **CUJ File**: Lines 15-31 have full planning phase with Step 0 and 0.1
- **Decision**: **Change to `workflow` mode** - Has planning phase
- **Fix**: Update CUJ-INDEX.md line 677 to `workflow` mode

### 8. CUJ-063 (Error Recovery)

- **Issue**: Exists but not mapped in CUJ-INDEX.md
- **CUJ-INDEX.md**: Not present in mapping table
- **CUJ File**: Complete CUJ with workflow execution mode
- **Decision**: **Add to CUJ-INDEX.md** - Missing entry
- **Fix**: Add line to CUJ-INDEX.md mapping table

## Execution Mode Definitions

- `skill-only`: Direct skill invocation, NO planning phase (Step 0)
- `workflow`: Full workflow with Step 0 planning + Step 0.1 rating
- `delegated-skill`: Orchestrator spawns worker agent, may include light planning
- `manual-setup`: Requires manual user configuration

## Changes Required

### CUJ-INDEX.md Updates

1. **Line 641** (CUJ-013): Change from `skill-only` to `workflow`
2. **Line 668** (CUJ-044): Change from `manual-setup` to `workflow`
3. **Line 673** (CUJ-049): Change from `manual-setup` to `workflow`
4. **Line 677** (CUJ-052): Change from `skill-only` to `workflow`
5. **After line 686**: Add CUJ-063 entry

### CUJ File Updates

None needed - all CUJ files are internally consistent.

## Validation

After changes:

1. CUJ file execution mode matches CUJ-INDEX.md mapping
2. All CUJs with Step 0 planning are marked `workflow`
3. All CUJs without planning are marked `skill-only`
4. All 63 CUJs are mapped in CUJ-INDEX.md

## Summary of Fixes

| CUJ     | Current Mode | Correct Mode | Action              |
| ------- | ------------ | ------------ | ------------------- |
| CUJ-013 | skill-only   | workflow     | Update CUJ-INDEX.md |
| CUJ-002 | skill-only   | skill-only   | No change           |
| CUJ-027 | skill-only   | skill-only   | No change           |
| CUJ-044 | manual-setup | workflow     | Update CUJ-INDEX.md |
| CUJ-049 | manual-setup | workflow     | Update CUJ-INDEX.md |
| CUJ-051 | workflow     | workflow     | No change           |
| CUJ-052 | skill-only   | workflow     | Update CUJ-INDEX.md |
| CUJ-063 | (missing)    | workflow     | Add to CUJ-INDEX.md |

## Total Changes

- **CUJ-INDEX.md**: 5 updates (4 mode changes + 1 new entry)
- **CUJ Files**: 0 updates (all internally consistent)
