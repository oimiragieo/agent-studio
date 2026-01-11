# Task: Fix Factory Compatibility Validation in CUJ E2E Tool

## Status

**Created**: 2026-01-09
**Priority**: High
**Assigned To**: Developer Agent
**Type**: Bug Fix

## Problem Statement

The CUJ validation tool (`.claude/tools/validate-cuj-e2e.mjs`) incorrectly assumes Factory has the same capabilities as Cursor. At line 331-334, the code auto-adds Factory support whenever Cursor is supported:

```javascript
// Factory compatibility (similar to Cursor)
if (platforms.includes('cursor')) {
  platforms.push('factory');
}
```

This is **factually incorrect** and overstates Factory's capabilities.

## Actual Factory Capabilities

According to `.factory/README.md`, Factory has:

1. **Only 8 skills** (vs 108 in Claude):
   - rule-auditor
   - rule-selector
   - scaffolder
   - repo-rag
   - artifact-publisher
   - context-bridge
   - context-router (Factory-specific)
   - incident-response (Factory-specific)

2. **Only 22 agents** (vs 34 in Claude):
   - analyst, pm, architect, database-architect, developer, qa, ux-expert
   - security-architect, devops, technical-writer
   - orchestrator, model-orchestrator
   - code-reviewer, refactoring-specialist, performance-engineer
   - llm-architect, api-designer, legacy-modernizer, mobile-developer
   - accessibility-expert, compliance-auditor, incident-responder

3. **No direct workflow execution**:
   - Factory uses "Task tool with subagent" pattern
   - Cannot execute `.yaml` workflow files directly
   - Requires manual adaptation for workflow-based CUJs

4. **Manual setup CUJs work** (line 309 is correct):
   - User-driven tasks work across all platforms

## Required Changes

### File: `.claude/tools/validate-cuj-e2e.mjs`

**Location**: Lines 331-334

**Current Code** (INCORRECT):

```javascript
// Factory compatibility (similar to Cursor)
if (platforms.includes('cursor')) {
  platforms.push('factory');
}
```

**Replacement Code**:

```javascript
// Factory compatibility (limited subset - only 8 skills, 22 agents, no workflow execution)
// Factory-supported skills: rule-auditor, rule-selector, scaffolder, repo-rag,
// artifact-publisher, context-bridge, context-router, incident-response
const factorySupportedSkills = [
  'rule-auditor',
  'rule-selector',
  'scaffolder',
  'repo-rag',
  'artifact-publisher',
  'context-bridge',
  'context-router',
  'incident-response',
];

if (
  executionMode === 'skill-only' &&
  primarySkill &&
  factorySupportedSkills.includes(primarySkill)
) {
  // Skill-only CUJ using Factory-supported skill
  platforms.push('factory');
} else if (executionMode === 'manual-setup' || executionMode === 'manual') {
  // Manual CUJs already added at line 309 (no action needed)
} else if (executionMode === 'workflow') {
  // Workflow-based CUJs NOT auto-compatible with Factory (requires manual adaptation)
  // Factory uses "Task tool with subagent" pattern, not direct .yaml execution
  // Do NOT add 'factory' to platforms
}
```

### Additional Change: Update Comments

Update the comment at line 320-322 to clarify the compatibility hierarchy:

**Current**:

```javascript
// Cursor compatibility (subset of Claude)
// CUJs that require Claude-only skills are excluded
const claudeOnlySkills = [
  'recovery',
  'optional-artifact-handler',
  'conflict-resolution',
  'api-contract-generator',
];
```

**Updated**:

```javascript
// Cursor compatibility (subset of Claude - excludes Claude-only skills)
// Factory compatibility (smaller subset - only 8 skills, 22 agents, no workflows)
// Claude (108 skills, 34 agents, full workflows) ⊃ Cursor (104 skills, 34 agents, workflows) ⊃ Factory (8 skills, 22 agents, no workflows)
const claudeOnlySkills = [
  'recovery',
  'optional-artifact-handler',
  'conflict-resolution',
  'api-contract-generator',
];
```

## Validation Steps

After implementing the fix:

1. **Run CUJ validation**:

   ```bash
   node .claude/tools/validate-cuj-e2e.mjs
   ```

2. **Expected Output Changes**:
   - Factory runnable count should be **lower** than Cursor count
   - Factory should only support:
     - Skill-only CUJs using the 8 Factory-supported skills
     - Manual setup CUJs (already working)
   - Factory should NOT support:
     - Workflow-based CUJs (.yaml files)
     - Skill-only CUJs using Claude/Cursor-exclusive skills

3. **Sample Validation**:
   - CUJ-002 (rule-selector, skill-only) → Should be Factory-compatible ✅
   - CUJ-013 (scaffolder, skill-only) → Should be Factory-compatible ✅
   - CUJ-001 (manual setup) → Should be Factory-compatible ✅
   - CUJ-003 (workflow mode) → Should NOT be Factory-compatible ❌
   - CUJ-005 (recovery skill) → Should NOT be Factory-compatible ❌

4. **Compare counts**:

   ```
   Before fix:
   ✅ Runnable (Claude): 57
   ✅ Runnable (Cursor): 56
   ✅ Runnable (Factory): 56  ← WRONG (overstated)

   After fix (expected):
   ✅ Runnable (Claude): 57
   ✅ Runnable (Cursor): 56
   ✅ Runnable (Factory): ~15-20  ← CORRECT (honest about limitations)
   ```

## Success Criteria

- [ ] Code updated to use `factorySupportedSkills` array
- [ ] Factory compatibility logic checks skill name against supported list
- [ ] Workflow-based CUJs NOT auto-added to Factory platforms
- [ ] Comments updated to clarify compatibility hierarchy
- [ ] CUJ validation runs without errors
- [ ] Factory runnable count reflects actual capabilities (lower than Cursor)
- [ ] Manual testing confirms Factory CUJs are actually executable in Factory

## Related Files

- `.claude/tools/validate-cuj-e2e.mjs` (implementation file)
- `.factory/README.md` (Factory capability documentation)
- `.factory/skills/` (8 supported skills)
- `.factory/droids/` (22 supported agents)

## Notes

- This fix is about **honesty** in platform compatibility reporting
- Factory is a powerful platform, but it has different capabilities than Claude/Cursor
- Users should know which CUJs work on which platforms before attempting execution
- Better to under-promise and over-deliver than the reverse

## Implementation Estimate

**Time**: 15-20 minutes
**Complexity**: Low (straightforward logic change)
**Risk**: Low (validation-only code, no runtime impact)
