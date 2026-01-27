# Plan: Audit Fix Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Address all findings from the 7-agent deep-dive audit, fixing critical issues first and improving architectural patterns where appropriate.

**Architecture:** Lazy-load skill references from skill-catalog.md instead of static names in CLAUDE.md. Fix tool blacklist violations in router.md. Register missing hooks and clean up test files in production directories.

**Tech Stack:** Markdown, JSON, JavaScript (CJS)

---

## Executive Summary

This plan addresses audit findings across three priority levels. The most critical fix is implementing lazy-load skill discovery instead of hardcoding skill names in CLAUDE.md Section 7. Other fixes include router.md tool blacklist compliance, hook registration, test file relocation, and catalog count correction.

## Objectives

- Fix router.md tool blacklist violation (Glob/Grep listed but blacklisted)
- Replace static skill names in CLAUDE.md Section 7 with lazy-load catalog reference
- Register memory-reminder.cjs hook in settings.json
- Move test file out of production hooks directory
- Correct skill catalog count
- Clean up non-existent workflow references

## Review Required

- [ ] **Architect Review**: Optional - Changes are configuration/documentation fixes
- [ ] **Security Review**: Optional - No security-sensitive changes

### Review Focus Areas

- Architect: Lazy-load skill catalog design is sound for router discovery
- Security: None - no external integrations or auth changes

---

## Phase 1: Critical Fixes (Tool Blacklist & Skill Names)
**Dependencies**: None
**Parallel OK**: No (changes affect same files)

### Tasks

- [ ] **1.1** Fix router.md tool blacklist violation (~5 min)
  - **Command**: Edit `.claude/agents/core/router.md` to remove Glob and Grep from tools array
  - **Details**: Line 6-8 lists `Glob`, `Grep` but Section 1.1 of CLAUDE.md blacklists these for Router
  - **Verify**: `grep -E "Glob|Grep" .claude/agents/core/router.md` should NOT find them in tools section
  - **Rollback**: `git checkout -- .claude/agents/core/router.md`

- [ ] **1.2** Redesign CLAUDE.md Section 7 for lazy-load skill discovery (~15 min)
  - **Command**: Edit `.claude/CLAUDE.md` Section 7 to reference skill-catalog.md instead of listing skill names
  - **Details**: Currently lists specific skill names (python-pro, rust-pro, etc.) which may not match actual skill names (python-backend-expert). Replace with catalog reference pattern.
  - **New Section 7 Content**:
    ```markdown
    ## 7. SKILL INVOCATION PROTOCOL (CRITICAL)

    **Agents must use the `Skill()` tool to invoke skills, not just read them.**

    ```javascript
    // CORRECT: Use Skill tool to invoke
    Skill({ skill: 'tdd' });
    Skill({ skill: 'debugging' });

    // WRONG: Just reading the file doesn't apply the skill
    Read('.claude/skills/tdd/SKILL.md'); // Reading is not invoking
    ```

    **Skill Discovery**: Skills are dynamically discovered from the catalog.

    - **Skill Catalog**: `.claude/context/artifacts/skill-catalog.md`
    - **Usage**: Consult the catalog for available skills by category
    - **Total Skills**: See catalog header for current count

    **To find a skill:**
    1. Read `.claude/context/artifacts/skill-catalog.md`
    2. Search by category or keyword
    3. Invoke with `Skill({ skill: "<skill-name>" })`

    **Key Categories** (see catalog for complete list):
    - Core Development (tdd, debugging)
    - Planning & Architecture (plan-generator)
    - Security (security-architect)
    - Languages (see catalog Languages section)
    - Frameworks (see catalog Frameworks section)
    - Creator Tools (agent-creator, skill-creator)
    ```
  - **Verify**: `grep "python-pro" .claude/CLAUDE.md | grep -v "agents/domain"` should return nothing (no static skill references except routing table)
  - **Rollback**: `git checkout -- .claude/CLAUDE.md`

#### Phase 1 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 1 failed: $(date) - [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate
```bash
# All must pass before proceeding
grep -E "^  - Glob|^  - Grep" .claude/agents/core/router.md && echo "FAIL: Router still has Glob/Grep" && exit 1
grep "Skill Catalog.*skill-catalog.md" .claude/CLAUDE.md || echo "FAIL: No catalog reference" && exit 1
echo "Phase 1 PASS"
```

---

## Phase 2: Hook & Settings Fixes
**Dependencies**: None (independent of Phase 1)
**Parallel OK**: Yes

### Tasks

- [ ] **2.1** Register memory-reminder.cjs hook in settings.json (~5 min) [Parallel OK]
  - **Command**: Edit `.claude/settings.json` to add memory-reminder.cjs to UserPromptSubmit hooks
  - **Details**: Hook exists at `.claude/hooks/session/memory-reminder.cjs` but not registered
  - **New hook entry** (add to UserPromptSubmit.hooks array):
    ```json
    {
      "type": "command",
      "command": "node .claude/hooks/session/memory-reminder.cjs"
    }
    ```
  - **Verify**: `grep "memory-reminder" .claude/settings.json`
  - **Rollback**: `git checkout -- .claude/settings.json`

- [ ] **2.2** Move test file out of production hooks directory (~3 min) [Parallel OK]
  - **Command**: `move .claude\hooks\memory\extract-workflow-learnings.test.cjs .claude\tests\hooks\extract-workflow-learnings.test.cjs`
  - **Details**: Test file should not be in production hooks directory. Create tests/hooks if needed.
  - **Pre-step**: `mkdir -p .claude/tests/hooks` (or equivalent on Windows)
  - **Verify**: `ls .claude/tests/hooks/extract-workflow-learnings.test.cjs`
  - **Rollback**: `move .claude\tests\hooks\extract-workflow-learnings.test.cjs .claude\hooks\memory\`

#### Phase 2 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 2 failed: $(date) - [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 3

#### Phase 2 Verification Gate
```bash
# All must pass before proceeding
grep "memory-reminder" .claude/settings.json || echo "FAIL: Hook not registered" && exit 1
test -f .claude/tests/hooks/extract-workflow-learnings.test.cjs && echo "PASS: Test file moved" || echo "FAIL: Test file not moved"
echo "Phase 2 PASS"
```

---

## Phase 3: Workflow & Reference Cleanup
**Dependencies**: None
**Parallel OK**: Yes

### Tasks

- [ ] **3.1** Fix external-integration.md workflow reference (~5 min) [Parallel OK]
  - **Command**: Edit `.claude/workflows/core/external-integration.md` line 908 area
  - **Details**: Line 908 references "Codebase Integration Workflow" which may not exist. Check and either create reference or update to valid workflow.
  - **Current text** (line 908): `- **Codebase Integration Workflow**: Use when integrating entire codebases (not just artifacts)`
  - **Action**: Change to reference the `codebase-integration` skill instead since that exists
  - **New text**: `- **Codebase Integration Skill**: For integrating entire codebases, use `Skill({ skill: "codebase-integration" })`
  - **Verify**: `grep -n "Codebase Integration" .claude/workflows/core/external-integration.md`
  - **Rollback**: `git checkout -- .claude/workflows/core/external-integration.md`

- [ ] **3.2** Verify and correct skill catalog count (~10 min) [Parallel OK]
  - **Command**: Count actual skills and update catalog header
  - **Script**:
    ```bash
    # Count SKILL.md files
    find .claude/skills -name "SKILL.md" | wc -l
    # Compare with catalog header (should show 422, verify actual)
    ```
  - **Action**: Update the "Total Skills: X" line in `.claude/context/artifacts/skill-catalog.md` header with actual count
  - **Verify**: Count matches header
  - **Rollback**: `git checkout -- .claude/context/artifacts/skill-catalog.md`

#### Phase 3 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 3 failed: $(date) - [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 4

#### Phase 3 Verification Gate
```bash
# All must pass before proceeding
grep "Codebase Integration Skill" .claude/workflows/core/external-integration.md || echo "FAIL: Reference not updated"
echo "Phase 3 PASS"
```

---

## Phase 4: Documentation & Memory Maintenance
**Dependencies**: Phase 1, 2, 3
**Parallel OK**: No

### Tasks

- [ ] **4.1** Document learnings rotation strategy (~10 min)
  - **Command**: Add rotation notice to learnings.md header
  - **Details**: learnings.md is 3066 lines. Per the NOTICE in the file, new learnings should use the session-based memory system. Add a recommendation to archive old learnings periodically.
  - **Action**: The file already has a legacy notice. Add guidance about archival:
    ```markdown
    > **ARCHIVAL GUIDANCE**: When this file exceeds 5000 lines, archive older sections to `.claude/context/memory/archive/learnings-YYYY-MM.md`
    ```
  - **Verify**: `head -50 .claude/context/memory/learnings.md` shows archival guidance
  - **Rollback**: `git checkout -- .claude/context/memory/learnings.md`

- [ ] **4.2** Record audit fixes in decisions.md (~5 min)
  - **Command**: Append ADR entry to `.claude/context/memory/decisions.md`
  - **New ADR**:
    ```markdown
    ## [ADR-004] Lazy-Load Skill Discovery
    - **Date**: 2026-01-24
    - **Status**: Accepted
    - **Context**: CLAUDE.md Section 7 listed static skill names that became stale (e.g., python-pro vs python-backend-expert)
    - **Decision**: Reference skill-catalog.md dynamically instead of hardcoding skill names in CLAUDE.md
    - **Consequences**: Router and agents must read skill catalog for discovery; catalog becomes source of truth for available skills
    ```
  - **Verify**: `grep "ADR-004" .claude/context/memory/decisions.md`
  - **Rollback**: Manual removal of ADR entry

#### Phase 4 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error in issues.md
3. Report partial completion

#### Phase 4 Verification Gate
```bash
# All must pass
grep "ARCHIVAL GUIDANCE" .claude/context/memory/learnings.md || echo "WARN: No archival guidance"
grep "ADR-004" .claude/context/memory/decisions.md || echo "FAIL: ADR not recorded"
echo "Phase 4 PASS"
```

---

## Phase 5: Final Verification
**Dependencies**: Phases 1-4
**Parallel OK**: No

### Tasks

- [ ] **5.1** Run comprehensive verification (~5 min)
  - **Command**: Execute all verification checks
  - **Verification Script**:
    ```bash
    echo "=== Audit Fix Verification ==="

    echo "1. Router tool blacklist..."
    grep -E "^  - Glob|^  - Grep" .claude/agents/core/router.md && echo "FAIL" || echo "PASS"

    echo "2. CLAUDE.md skill catalog reference..."
    grep "skill-catalog.md" .claude/CLAUDE.md && echo "PASS" || echo "FAIL"

    echo "3. Memory-reminder hook registered..."
    grep "memory-reminder" .claude/settings.json && echo "PASS" || echo "FAIL"

    echo "4. Test file relocated..."
    test -f .claude/tests/hooks/extract-workflow-learnings.test.cjs && echo "PASS" || echo "FAIL"

    echo "5. Workflow reference fixed..."
    grep "Codebase Integration Skill" .claude/workflows/core/external-integration.md && echo "PASS" || echo "FAIL"

    echo "6. ADR recorded..."
    grep "ADR-004" .claude/context/memory/decisions.md && echo "PASS" || echo "FAIL"

    echo "=== Verification Complete ==="
    ```
  - **Verify**: All checks return PASS
  - **Rollback**: N/A (verification only)

- [ ] **5.2** Commit changes (~3 min)
  - **Command**:
    ```bash
    git add .claude/agents/core/router.md \
            .claude/CLAUDE.md \
            .claude/settings.json \
            .claude/tests/hooks/extract-workflow-learnings.test.cjs \
            .claude/workflows/core/external-integration.md \
            .claude/context/artifacts/skill-catalog.md \
            .claude/context/memory/learnings.md \
            .claude/context/memory/decisions.md
    git commit -m "fix: resolve 7-agent audit findings

    - Remove Glob/Grep from router.md tools (blacklist compliance)
    - Implement lazy-load skill discovery in CLAUDE.md Section 7
    - Register memory-reminder.cjs hook in settings.json
    - Move test file to .claude/tests/hooks/
    - Fix workflow reference in external-integration.md
    - Update skill catalog count
    - Add ADR-004 for lazy-load skill decision"
    ```
  - **Verify**: `git log -1 --oneline` shows the commit
  - **Rollback**: `git reset --soft HEAD~1`

#### Phase 5 Verification Gate
```bash
git status --porcelain | grep -q "" && echo "WARN: Uncommitted changes" || echo "PASS: Clean working directory"
echo "Phase 5 PASS - Audit fixes complete"
```

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Router breaks without Glob/Grep | High | Router should spawn agents that use Glob/Grep | `git checkout -- .claude/agents/core/router.md` |
| Skill discovery slower with catalog lookup | Low | Catalog is small (~500 lines), fast to search | N/A - performance acceptable |
| Missing hook breaks workflow | Medium | Test memory-reminder.cjs before commit | `git checkout -- .claude/settings.json` |
| Test file import paths break | Low | Update imports if test was imported elsewhere | Move file back |

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? |
|-------|-------|-----------|-----------|
| 1 | 2 | 20 min | No |
| 2 | 2 | 8 min | Yes |
| 3 | 2 | 15 min | Yes |
| 4 | 2 | 15 min | No |
| 5 | 2 | 8 min | No |
| **Total** | **10** | **~66 min** | |

---

## Notes on Audit Findings Not Addressed

1. **conductor-validator missing from routing table**: VERIFIED - It IS in the routing table at line 143. No fix needed.

2. **6 stub workflows in enterprise**: VERIFIED - Only 2 workflows exist (c4-architecture-workflow.md, feature-development-workflow.md) and both are complete, not stubs. The audit may have been referring to deleted files.

3. **AJV already installed**: User confirmed - SKIP any AJV installation tasks.

4. **learnings.md rotation**: Added guidance but NOT implementing automated rotation (would require significant tooling changes). The file already has a session-based memory notice.

---

## Post-Implementation Checklist

- [ ] All 5 phases completed successfully
- [ ] Git commit created with all changes
- [ ] No regression in router functionality
- [ ] Skill discovery works via catalog lookup
- [ ] Memory-reminder hook fires on UserPromptSubmit
- [ ] Update this plan status to COMPLETED
