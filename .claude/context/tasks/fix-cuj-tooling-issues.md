# Fix CUJ Tooling Issues - Task Brief

## Context

Three critical issues in CUJ tooling causing validation failures:

1. Registry drift (36 CUJs with `workflow: null`)
2. CUJ-030 missing primary_skill
3. cuj-doctor false positives on skill objects

## Root Causes Identified

### Issue 1: sync-cuj-registry.mjs Registry Drift

- **Problem**: 36 CUJs have `workflow: null` despite CUJ-INDEX.md mapping them to workflows
- **Root cause**: sync-cuj-registry.mjs uses heuristics-only approach (lines 187-293), doesn't fall back to CUJ-INDEX.md
- **Solution**: Add fallback to read CUJ-INDEX.md "Run CUJ Mapping" table when CUJ doc doesn't explicitly reference workflow

### Issue 2: CUJ-030 Missing Skill Mapping

- **Problem**: CUJ-030 has `primary_skill: null` in CUJ-INDEX.md line 660
- **Root cause**: CUJ-030.md lists "Multi-model coordination", "Consensus calculation", "Issue routing" (vague phrases) instead of actual skill name
- **Solution**:
  - Update CUJ-INDEX.md line 660: Set primary_skill to "multi-ai-code-review"
  - Update CUJ-030.md line 35-38: Replace vague phrases with concrete skill: `multi-ai-code-review`

### Issue 3: cuj-doctor False Positives

- **Problem**: cuj-doctor treats skill objects as strings, producing "[object Object]" warnings
- **Root cause**: cuj-registry.json stores skills as objects `{name, type, location}`, but cuj-doctor expects strings
- **Solution**: Normalize registry fields before comparing:
  - Extract skill.name from skill objects
  - Strip/resolve workflow paths (handle `.claude/workflows/` prefix)

## Files to Modify

1. `.claude/tools/sync-cuj-registry.mjs` (lines 260-293)
2. `.claude/docs/cujs/CUJ-INDEX.md` (line 660)
3. `.claude/docs/cujs/CUJ-030.md` (lines 35-38)
4. `.claude/tools/cuj-doctor.mjs` (lines 110-192)

## Implementation Tasks

### Task 1: Fix sync-cuj-registry.mjs

**Location**: `.claude/tools/sync-cuj-registry.mjs`
**Changes**:

1. Add function to parse CUJ-INDEX.md "Run CUJ Mapping" table
2. Add fallback after line 293 (after all heuristic patterns fail)
3. If `metadata.execution_mode === 'workflow' && !metadata.workflow`:
   - Read CUJ-INDEX.md
   - Parse "Run CUJ Mapping" table
   - Find row matching `cujId`
   - Extract workflow path from 3rd column
   - Set `metadata.workflow` if found

### Task 2: Fix CUJ-030 Mapping

**Location 1**: `.claude/docs/cujs/CUJ-INDEX.md` line 660
**Change**: `| CUJ-030 | skill-only | null | null |` → `| CUJ-030 | skill-only | null | multi-ai-code-review |`

**Location 2**: `.claude/docs/cujs/CUJ-030.md` lines 35-38
**Change**:

```markdown
## Skills Used

- Multi-model coordination
- Consensus calculation
- Issue routing
```

To:

```markdown
## Skills Used

- `multi-ai-code-review`
```

### Task 3: Fix cuj-doctor False Positives

**Location**: `.claude/tools/cuj-doctor.mjs`
**Changes**:

1. In `checkMissingWorkflows()` (lines 110-149):
   - Normalize workflow paths: Extract basename, handle `.claude/workflows/` prefix
   - Compare normalized paths

2. In `checkMissingSkills()` (lines 154-192):
   - Normalize skill names: If skill is object, extract skill.name
   - Compare skill names (strings)

## Success Criteria

- [ ] sync-cuj-registry.mjs uses CUJ-INDEX.md as fallback
- [ ] CUJ-030 has primary_skill set to "multi-ai-code-review"
- [ ] cuj-doctor handles skill objects correctly
- [ ] All 36 CUJs with drift now have correct workflow paths
- [ ] cuj-doctor produces zero false positives

## Testing

```bash
# Test sync-cuj-registry
node .claude/tools/sync-cuj-registry.mjs

# Verify CUJ-030 in registry
cat .claude/context/cuj-registry.json | grep -A 10 "CUJ-030"

# Test cuj-doctor
node .claude/tools/cuj-doctor.mjs
```

## Expected Output

- sync-cuj-registry: 62 CUJs with workflow paths (down from 36 with null)
- cuj-doctor: Zero "[object Object]" warnings
- CUJ-030: primary_skill = "multi-ai-code-review"
