# Plan: v2.1.0 Framework Deep Dive Analysis

## Executive Summary

Systematic analysis of the .claude framework to verify previous fixes, discover new issues, identify optimization opportunities, and recommend process improvements. This deep dive follows the 2026-01-26 session which achieved 95% security compliance.

## Objectives

- Verify that previously identified issues are actually fixed in code
- Discover NEW bugs, vulnerabilities, or code quality issues not yet documented
- Identify optimization opportunities (performance, code duplication)
- Recommend process improvements for long-term maintainability
- Update memory files with findings for institutional knowledge

## Verification Summary from Context

### Issues Previously Identified (2026-01-26) - NOW VERIFIED FIXED:

1. **SEC-007 (Self-Healing Hooks)** - FIXED: anomaly-detector.cjs and auto-rerouter.cjs now use `safeParseJSON` (verified lines 34, 126 in anomaly-detector; lines 29, 110 in auto-rerouter)
2. **SEC-008 (Exit Codes)** - FIXED: tdd-check.cjs uses exit(2) on line 208; enforce-claude-md-update.cjs uses exit(2) on line 209
3. **Atomic Write Pattern** - FIXED: Both self-healing hooks now use `atomicWriteJSONSync`
4. **Shared hook-input.cjs** - PROGRESS: 36 hooks now use shared utility (previously claimed 17 remaining, but grep shows 0 local `function parseHookInput` definitions remaining)

### Documentation Bug Found:

- enforce-claude-md-update.cjs line 19: Comment says "Exit codes: 1: Block" but actual code uses exit(2). Comment needs update.

## Phases

### Phase 1: Verification of Previous Fixes

**Purpose**: Confirm that all issues marked RESOLVED in issues.md are actually fixed in code
**Parallel OK**: Yes (each verification is independent)

#### Tasks

- [ ] **1.1** Verify SEC-007 safe JSON parsing in all hooks (~15 min) [parallelizable]
  - **Command**: `Grep({ pattern: "JSON\\.parse\\(", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All JSON.parse calls are in test files only, or wrapped in safe parsing
  - **Rollback**: N/A (read-only analysis)

- [ ] **1.2** Verify SEC-008 exit code consistency (~15 min) [parallelizable]
  - **Command**: `Grep({ pattern: "process\\.exit\\(1\\)", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All exit(1) calls are in test files only
  - **Rollback**: N/A (read-only analysis)

- [ ] **1.3** Verify atomic write usage in state-modifying hooks (~20 min) [parallelizable]
  - **Command**: `Grep({ pattern: "writeFileSync|writeFile\\(", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All file writes use atomicWriteJSONSync or atomic pattern
  - **Rollback**: N/A (read-only analysis)

- [ ] **1.4** Verify shared utility adoption in all hooks (~15 min) [parallelizable]
  - **Command**: `Grep({ pattern: "require.*hook-input\\.cjs", path: ".claude/hooks", output_mode: "files_with_matches" })`
  - **Verify**: All 40+ hooks use shared hook-input.cjs
  - **Rollback**: N/A (read-only analysis)

#### Phase 1 Verification Gate

```bash
# Must pass before proceeding
# All verification tasks complete with documented findings
ls .claude/context/artifacts/deep-dive-verification-results.md
```

**Success Criteria**:

- Verification results documented
- Any regressions identified and logged to issues.md
- Previously RESOLVED issues confirmed still fixed

---

### Phase 2: New Bug Discovery - Hooks

**Purpose**: Systematically search for NEW bugs not previously documented
**Dependencies**: Phase 1
**Parallel OK**: Yes

#### Tasks

- [ ] **2.1** Audit empty catch blocks in hooks (~20 min) [parallelizable]
  - **Command**: `Grep({ pattern: "catch.*\\{[\\s\\S]*?\\}", path: ".claude/hooks", multiline: true, output_mode: "content" })`
  - **Verify**: All catch blocks have proper error handling (not empty or just comments)
  - **Rollback**: N/A

- [ ] **2.2** Check for missing test files (~15 min) [parallelizable]
  - **Command**: `Bash({ command: "ls .claude/hooks/*/*.cjs | grep -v test | while read f; do t=\"${f%.cjs}.test.cjs\"; [ -f \"$t\" ] || echo \"MISSING: $t\"; done" })`
  - **Verify**: Document hooks without corresponding test files
  - **Rollback**: N/A

- [ ] **2.3** Audit path validation in all file operations (~25 min) [parallelizable]
  - **Command**: `Grep({ pattern: "fs\\.(readFileSync|writeFileSync|existsSync|mkdirSync)", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All file operations validate paths don't escape PROJECT_ROOT
  - **Rollback**: N/A

- [ ] **2.4** Check for hardcoded paths that should use PROJECT_ROOT (~15 min) [parallelizable]
  - **Command**: `Grep({ pattern: "\\.claude/|/\\.claude", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All .claude paths use PROJECT_ROOT prefix, not relative paths
  - **Rollback**: N/A

- [ ] **2.5** Audit async/await error handling (~20 min) [parallelizable]
  - **Command**: `Grep({ pattern: "await.*[^{]*$", path: ".claude/hooks", output_mode: "content" })`
  - **Verify**: All await calls are in try/catch or have .catch()
  - **Rollback**: N/A

#### Phase 2 Verification Gate

```bash
# Must pass before proceeding
ls .claude/context/artifacts/deep-dive-hooks-audit.md
```

**Success Criteria**:

- New bugs documented with file:line references
- Severity ratings assigned (Critical/High/Medium/Low)
- Each finding has recommended fix

---

### Phase 3: New Bug Discovery - Library Files

**Purpose**: Audit .claude/lib/ for security and quality issues
**Dependencies**: Phase 1
**Parallel OK**: Yes

#### Tasks

- [ ] **3.1** Audit memory module error handling (~25 min)
  - **Files**: `.claude/lib/memory/*.cjs`
  - **Command**: `Read({ file_path: ".claude/lib/memory/memory-manager.cjs" })`
  - **Verify**: Proper error handling, no silent failures
  - **Rollback**: N/A

- [ ] **3.2** Audit workflow engine security (~25 min)
  - **Files**: `.claude/lib/workflow/*.cjs`
  - **Focus**: Check for any remaining new Function() or eval() usage
  - **Command**: `Grep({ pattern: "new Function|eval\\(", path: ".claude/lib", output_mode: "content" })`
  - **Verify**: No dynamic code execution patterns
  - **Rollback**: N/A

- [ ] **3.3** Audit self-healing library (~20 min)
  - **Files**: `.claude/lib/self-healing/*.cjs`
  - **Focus**: State management, rollback safety
  - **Command**: `Read({ file_path: ".claude/lib/self-healing/rollback-manager.cjs" })`
  - **Verify**: Path validation, atomic operations
  - **Rollback**: N/A

- [ ] **3.4** Audit shared utilities completeness (~15 min)
  - **Files**: `.claude/lib/utils/*.cjs`
  - **Focus**: Are all utilities well-tested and documented?
  - **Command**: `Glob({ pattern: ".claude/lib/utils/*.cjs" })`
  - **Verify**: Each utility has corresponding test file
  - **Rollback**: N/A

#### Phase 3 Verification Gate

```bash
ls .claude/context/artifacts/deep-dive-lib-audit.md
```

**Success Criteria**:

- Library audit complete
- New issues added to issues.md
- Security compliance verified

---

### Phase 4: Agent and Skill Consistency Audit

**Purpose**: Verify agent definitions and skill files are consistent and complete
**Dependencies**: Phase 1
**Parallel OK**: Yes

#### Tasks

- [ ] **4.1** Audit agent routing table completeness (~20 min)
  - **Command**: Compare CLAUDE.md Section 3 with actual files in `.claude/agents/`
  - **Verify**: All agents listed in CLAUDE.md exist; all existing agents are listed
  - **Rollback**: N/A

- [ ] **4.2** Audit agent skill references (~15 min)
  - **Command**: `Grep({ pattern: "skills:", path: ".claude/agents", output_mode: "content" })`
  - **Verify**: All skill references in agents point to existing skills
  - **Rollback**: N/A

- [ ] **4.3** Check for deprecated skill references (~15 min)
  - **Focus**: Find references to deprecated skills (writing -> writing-skills, testing-expert -> tdd)
  - **Command**: `Grep({ pattern: "writing|testing-expert", path: ".claude/agents", output_mode: "content" })`
  - **Verify**: No deprecated skill references
  - **Rollback**: N/A

- [ ] **4.4** Audit skill catalog completeness (~20 min)
  - **Command**: Compare `.claude/context/artifacts/skill-catalog.md` with actual `.claude/skills/` directories
  - **Verify**: Catalog matches actual skill inventory
  - **Rollback**: N/A

#### Phase 4 Verification Gate

```bash
ls .claude/context/artifacts/deep-dive-agent-skill-audit.md
```

**Success Criteria**:

- Agent-skill mappings verified
- Missing or deprecated references documented
- CLAUDE.md Section 3 accuracy verified

---

### Phase 5: Optimization Opportunities

**Purpose**: Identify performance and code quality improvements
**Dependencies**: Phases 2-4
**Parallel OK**: No (builds on prior findings)

#### Tasks

- [ ] **5.1** Identify hook consolidation opportunities (~30 min)
  - **Analysis**: Review hooks firing on same events that could be merged
  - **Example**: routing-guard.cjs pattern (consolidated 5 hooks)
  - **Output**: List of consolidation candidates

- [ ] **5.2** Identify code duplication patterns (~25 min)
  - **Command**: Review patterns that appear in multiple files
  - **Focus**: Common error handling, state loading, file operations
  - **Output**: Candidates for new shared utilities

- [ ] **5.3** Review test coverage gaps (~20 min)
  - **Command**: List hooks/libs with missing or minimal tests
  - **Focus**: Security-critical code without tests
  - **Output**: Priority list for test additions

- [ ] **5.4** Documentation completeness review (~20 min)
  - **Focus**: Missing JSDoc, outdated comments (like enforce-claude-md-update line 19)
  - **Output**: Documentation update tasks

#### Phase 5 Verification Gate

```bash
ls .claude/context/artifacts/deep-dive-optimization-recommendations.md
```

**Success Criteria**:

- Optimization opportunities documented
- Priority ranking established
- Estimated effort for each

---

### Phase 6: Memory File Updates

**Purpose**: Persist findings to memory files for future sessions
**Dependencies**: Phases 1-5
**Parallel OK**: No (sequential writes to avoid conflicts)

#### Tasks

- [ ] **6.1** Update issues.md with new findings (~15 min)
  - **Action**: Append new issues discovered in Phases 2-4
  - **Format**: Use existing [ISSUE-XXX] format
  - **Command**: `Edit({ file_path: ".claude/context/memory/issues.md", ... })`

- [ ] **6.2** Update learnings.md with patterns (~15 min)
  - **Action**: Document successful patterns and anti-patterns found
  - **Format**: Use existing dated entry format
  - **Command**: `Edit({ file_path: ".claude/context/memory/learnings.md", ... })`

- [ ] **6.3** Update decisions.md if any architectural decisions (~10 min)
  - **Action**: Document any ADRs from optimization recommendations
  - **Command**: `Edit({ file_path: ".claude/context/memory/decisions.md", ... })`

#### Phase 6 Verification Gate

```bash
git diff .claude/context/memory/
```

**Success Criteria**:

- Memory files updated with session findings
- All new issues have unique IDs
- Learnings are actionable

---

### Phase FINAL: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction

**Tasks**:

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities (new agents/skills needed)

**Spawn Command**:
Task({
subagent_type: "reflection-agent",
description: "Session reflection and learning extraction",
prompt: "You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan, extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created)."
})

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

---

## Risks

| Risk                       | Impact | Mitigation                                    | Rollback                   |
| -------------------------- | ------ | --------------------------------------------- | -------------------------- |
| False positive bug reports | Medium | Cross-reference with issues.md before logging | Edit issues.md to remove   |
| Missing security issues    | High   | Use systematic grep patterns                  | Additional targeted audits |
| Stale memory file data     | Medium | Always read before write                      | git checkout -- memory/    |
| Context overload           | Medium | Compress findings progressively               | Summarize per phase        |

## Timeline Summary

| Phase     | Tasks  | Est. Time    | Parallel? |
| --------- | ------ | ------------ | --------- |
| 1         | 4      | 65 min       | Yes       |
| 2         | 5      | 95 min       | Yes       |
| 3         | 4      | 85 min       | Yes       |
| 4         | 4      | 70 min       | Yes       |
| 5         | 4      | 95 min       | No        |
| 6         | 3      | 40 min       | No        |
| FINAL     | 3      | 30 min       | No        |
| **Total** | **27** | **~8 hours** |           |

## Priority Order

1. **Critical**: Phase 1 (Verification) - Must confirm fixes before finding new issues
2. **High**: Phases 2-3 (Hooks & Libs) - Security and stability focus
3. **Medium**: Phase 4 (Agents & Skills) - Consistency and discoverability
4. **Medium**: Phase 5 (Optimization) - Long-term maintainability
5. **Required**: Phases 6 & FINAL - Memory persistence and reflection

## Related Artifacts

- Previous deep dive: `.claude/context/memory/learnings.md` (2026-01-26 entries)
- Issues tracker: `.claude/context/memory/issues.md`
- Security review: `.claude/context/artifacts/security-review-implementation.md`
- Architecture review: `.claude/context/artifacts/architecture-review-findings.md`

---

_Plan generated by PLANNER agent on 2026-01-27_
_Framework version: v2.1.0_
