# CUJ File Fixes Task

## Issues to Fix

### 1. CUJ-017 Contradiction
**File**: `.claude/docs/cujs/CUJ-017.md`
**Issue**: Execution mode is `skill-only` but Step 0 describes a Planning Phase with Planner agent
**Fix**: Remove Step 0 (Planning Phase) since this is truly skill-only

### 2. Execution Mode Mismatches (CUJ-004)
**File**: `.claude/docs/cujs/CUJ-004.md`
**Current**: Says "skill-only"
**Index Says**: "workflow" (greenfield-fullstack.yaml)
**Fix**: Change to `workflow` mode (index is correct - this involves Planner -> Analyst -> PM -> Architect)

### 3. Execution Mode Mismatches (CUJ-005)
**File**: `.claude/docs/cujs/CUJ-005.md`
**Current**: Says "greenfield-fullstack.yaml" (correct)
**No issue** - Already correct

### 4. Schema Reference Fixes

**CUJ-005.md** - Fix these schema references:
- Line 86: `project-brief.schema.json` → `project_brief.schema.json`
- Line 89: `architecture.schema.json` → `system_architecture.schema.json`
- Line 91: `test-plan.schema.json` → `test_plan.schema.json`

**CUJ-007.md** - Fix schema reference:
- Line 53: `refactor-plan.schema.json` → `refactoring-plan.schema.json`

**CUJ-013.md** - Fix schema reference:
- Line 55: `code-review-report.schema.json` → `code-review.schema.json`

**CUJ-014.md** - Fix schema reference:
- Line 61: `audit-report.schema.json` → `skill-rule-auditor-output.schema.json`

### 5. Delegated-Skill Mode Updates

**CUJ-002.md**, **CUJ-051.md**, **CUJ-052.md**:
- Change "Execution Mode: skill-only" to "Execution Mode: delegated-skill"
- Add note after execution mode:
  ```
  **Note**: Orchestrator MUST spawn a worker agent (Developer or QA) to execute this skill. The orchestrator never executes skills directly.
  ```

## Verification

After fixes:
1. All schema references must match actual files in `.claude/schemas/`
2. CUJ-017 should have no Step 0
3. CUJ-004 should say "workflow" mode
4. CUJ-002, CUJ-051, CUJ-052 should say "delegated-skill" with orchestrator note
5. All execution modes should match CUJ-INDEX.md

## Files to Modify
- `.claude/docs/cujs/CUJ-002.md`
- `.claude/docs/cujs/CUJ-004.md`
- `.claude/docs/cujs/CUJ-005.md`
- `.claude/docs/cujs/CUJ-007.md`
- `.claude/docs/cujs/CUJ-013.md`
- `.claude/docs/cujs/CUJ-014.md`
- `.claude/docs/cujs/CUJ-017.md`
- `.claude/docs/cujs/CUJ-051.md`
- `.claude/docs/cujs/CUJ-052.md`
