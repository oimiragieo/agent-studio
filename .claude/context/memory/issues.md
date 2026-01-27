# Known Issues and Blockers

## Summary (as of 2026-01-27)

| Status Category | Count | Notes                                   |
| --------------- | ----- | --------------------------------------- |
| **OPEN**        | 48    | Active issues requiring attention       |
| **RESOLVED**    | 60    | Archived in issues-archive.md           |
| **Won't Fix**   | 1     | Documented as not requiring remediation |
| **Total**       | 109   | All tracked issues                      |

**Historical issues**: See `issues-archive.md` for 60 resolved issues archived on 2026-01-27.

### Priority Breakdown (OPEN Issues)

- **CRITICAL**: 3 (SEC-AUDIT-012, SEC-AUDIT-017, SEC-AUDIT-014)
- **HIGH**: 8 (security audits, structural issues)
- **MEDIUM**: 20 (documentation gaps, pointer gaps, process improvements)
- **LOW**: 17 (future enhancements, recommendations)

## Format

```
## [ISSUE-XXX] Title
- **Date**: YYYY-MM-DD
- **Severity**: Critical | High | Medium | Low
- **Status**: Open | In Progress | Resolved | Won't Fix
- **Description**: What the issue is
- **Workaround**: Temporary solution (if any)
- **Resolution**: How it was fixed (when resolved)
```

---

<!-- OPEN ISSUES BELOW THIS LINE -->

## Architecture Review Findings (2026-01-27)

### POINTER GAPS

### POINTER-001: Empty Diagrams Directory Despite Agent References

- **Date**: 2026-01-27
- **Category**: pointer_gap
- **Impact**: silent_failure
- **Status**: Open
- **Description**: Architect agent references `.claude/context/artifacts/diagrams/` for diagram output (architect.md line 78). The diagram-generator skill exists and is invoked, but the directory contains only .gitkeep placeholders - zero actual diagrams have been generated.
- **Remediation**:
  1. Create example architecture diagrams for the framework itself (agents, hooks, workflows structure)
  2. Update FILE_PLACEMENT_RULES.md with explicit diagram placement rules
  3. Add diagram generation to evolution-orchestrator workflow as evidence of architectural decisions

### POINTER-003: Architect Missing Workflow References

- **Date**: 2026-01-27
- **Category**: pointer_gap
- **Impact**: maintainability
- **Status**: Open
- **Description**: Architect agent definition mentions "trade-off analysis using SequentialThinking" (line 56) but provides NO guidance on which workflows to use for architecture reviews. The framework HAS architecture-review-skill-workflow.md, consensus-voting-skill-workflow.md, and database-architect-skill-workflow.md, but architect.md doesn't reference them.
- **Remediation**: Add "Related Workflows" section to architect.md

### STRUCTURAL ISSUES

### ARCH-002: Consolidated Hook File Confusion Risk

- **Date**: 2026-01-27
- **Category**: structural
- **Impact**: maintainability
- **Status**: Documented (Recommendation)
- **Description**: Per ADR-026, individual hooks (planner-first-guard.cjs, task-create-guard.cjs, router-self-check.cjs, security-review-guard.cjs, router-write-guard.cjs) still exist as files but are NOT registered in settings.json. They were consolidated into routing-guard.cjs. Files kept for reference/testing, but could confuse future developers who might edit the wrong file.
- **Remediation**: Two options:
  1. **Preferred**: Move to `.claude/hooks/routing/_legacy/` subdirectory with README explaining consolidation
  2. **Alternative**: Add header comment to each file: `// NOT REGISTERED - See routing-guard.cjs for active implementation`

### ARCH-003: Skill Catalog Count Audit Needed

- **Date**: 2026-01-27
- **Category**: structural
- **Impact**: maintainability
- **Status**: Open
- **Description**: Skill catalog header claims "Total Skills: 426 (2 deprecated)" but category table totals need verification. The count includes 139 scientific sub-skills under scientific-skills parent.
- **Remediation**: Run audit to count actual skill directories and update catalog header if discrepancy exists

### DOCUMENTATION GAPS

### DOC-001: Missing Skill-to-Workflow Cross-References

- **Date**: 2026-01-27
- **Category**: pointer_gap
- **Impact**: maintainability
- **Status**: Open
- **Description**: Skills like architecture-review, consensus-voting, database-architect have corresponding workflow files (.claude/workflows/\*-skill-workflow.md), but the skill files don't reference the workflows and vice versa. This breaks discoverability.
- **Remediation**: Add "Workflow Integration" section to each skill that has a corresponding workflow

---

## Architecture Review Pointer Gaps (2026-01-26)

### [ARCH-002] Undocumented Skill Workflows

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Location**: CLAUDE.md Section 8.6 Enterprise Workflows table
- **Description**: 6 workflow files exist but are not documented in CLAUDE.md:
  - security-architect-skill-workflow.md
  - architecture-review-skill-workflow.md
  - consensus-voting-skill-workflow.md
  - swarm-coordination-skill-workflow.md
  - database-architect-skill-workflow.md
  - context-compressor-skill-workflow.md
- **Impact**: Agents may not discover these workflows
- **Recommendation**: Add to CLAUDE.md Section 8.6 or create workflows/skills/ subdirectory

### [ARCH-003] Inconsistent Workflow Placement

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN
- **Location**: `.claude/workflows/` directory
- **Description**: Skill workflows are inconsistently placed - most in root workflows/ but one in workflows/enterprise/
- **Recommendation**: Standardize by moving all skill workflows to workflows/skills/ or keeping all in root

### [ARCH-004] Deprecated Skill Reference in technical-writer.md

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN
- **File**: `.claude/agents/core/technical-writer.md` line 12
- **Description**: References deprecated `writing` skill instead of `writing-skills`
- **Impact**: Works due to alias but inconsistent with deprecation policy
- **Recommendation**: Update skills list to use `writing-skills` instead of `writing`

---

## Implementation Task Security Review (2026-01-26)

### [SEC-IMPL-001] Task #3 State Merging DoS Risk

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #3 - Add state merging to router-state.cjs
- **CWE**: CWE-400 (Uncontrolled Resource Consumption)
- **STRIDE Category**: Denial of Service
- **Description**: Proposed optimistic concurrency with retry could cause infinite loops if no retry limit is implemented
- **Required Safeguard**: Maximum 5 retries with exponential backoff (100ms, 200ms, 400ms...)
- **Implementation Condition**: Fail-closed after max retries (throw error, don't silently succeed)

### [SEC-IMPL-002] Task #3 Version Field Manipulation

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #3 - Add state merging to router-state.cjs
- **CWE**: CWE-20 (Improper Input Validation)
- **STRIDE Category**: Tampering
- **Description**: If version field is used for optimistic concurrency, attackers could set it to MAX_SAFE_INTEGER or 0
- **Required Safeguard**: Validate version as positive integer, auto-reset to 1 if corrupted

### [SEC-IMPL-003] Task #2 Memory Exhaustion Risk

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #2 - Add event handler deduplication to workflow-engine.cjs
- **CWE**: CWE-770 (Allocation of Resources Without Limits)
- **STRIDE Category**: Denial of Service
- **Description**: Without handler count limits, event handlers could grow unboundedly
- **Required Safeguard**: Maximum 100 handlers per event, use Set for deduplication

### [SEC-IMPL-004] Task #8 TOCTOU Race Conditions

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #8 - Convert sync I/O to async in memory modules
- **CWE**: CWE-367 (Time-of-Check to Time-of-Use Race Condition)
- **STRIDE Category**: Tampering
- **Description**: Async operations create larger TOCTOU windows than sync operations
- **Required Safeguard**: Eliminate exists() checks, use try/catch with ENOENT handling

### [SEC-IMPL-005] Task #8 Async Error Handling

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #8 - Convert sync I/O to async in memory modules
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **STRIDE Category**: Denial of Service
- **Description**: Unhandled promise rejections can crash the process; silent error swallowing loses audit trail
- **Required Safeguard**: Explicit error handling for ALL async operations, log before returning defaults

### [SEC-IMPL-006] Task #8 Atomic Write Preservation

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: CONDITIONALLY_APPROVED
- **Task**: #8 - Convert sync I/O to async in memory modules
- **CWE**: CWE-362 (Concurrent Execution Using Shared Resource with Improper Synchronization)
- **STRIDE Category**: Tampering
- **Description**: Async writes must preserve atomic write pattern (temp + rename) to prevent corruption
- **Required Safeguard**: Implement async atomic write (await writeFile temp, await rename)

---

## Library Code Quality Audit (2026-01-26)

### Important Issues for Next Sprint

**IMP-001: Missing JSDoc Documentation**

- Affects 25+ public API functions across memory-manager, memory-tiers, smart-pruner
- Add JSDoc comments with @param, @returns, @throws tags

**IMP-006: Missing Error Path Test Coverage**

- Test files exist but don't cover error conditions
- Add tests for module not found, permission errors, corrupted JSON

**IMP-007: workflow-validator Missing Step Schema Validation**

- Only validates phases, not step structure
- Add validation for required step fields (id, handler)

---

## Hook Code Quality Audit (2026-01-26)

### Important Issues (Should Fix)

**HOOK-001: Massive Code Duplication - parseHookInput()**

- **Severity**: High
- **Impact**: ~2000 lines duplicated across 40+ hooks
- **Fix**: Extract to `.claude/lib/utils/hook-input.cjs` shared utility
- **Estimated Effort**: 2 hours
- **Status**: OPEN

**HOOK-002: findProjectRoot() Duplication**

- **Severity**: Medium
- **Impact**: ~200 lines duplicated across 20+ hooks
- **Fix**: Use existing `.claude/lib/utils/project-root.cjs` or create if missing
- **Estimated Effort**: 1 hour
- **Status**: OPEN

**HOOK-004: State Cache Integration Incomplete**

- **Severity**: Medium
- **Files**: file-placement-guard.cjs, loop-prevention.cjs, research-enforcement.cjs
- **Issue**: evolution-state.json and loop-state.json read without caching
- **Impact**: ~40% redundant I/O on state files
- **Fix**: Add state-cache.cjs integration to getEvolutionState() and getLoopState()
- **Estimated Effort**: 4 hours
- **Status**: OPEN

**HOOK-006: Inconsistent Audit Logging Format**

- **Severity**: Low
- **Files**: session-memory-extractor.cjs, multiple reflection hooks
- **Issue**: Some hooks use plain console.error, others use JSON.stringify
- **Impact**: Inconsistent log parsing for monitoring tools
- **Fix**: Standardize on JSON.stringify for ALL audit logs
- **Estimated Effort**: 2 hours
- **Status**: OPEN

### Minor Issues (Nice to Have)

**HOOK-007: Magic Numbers - Timeout Values**

- **Files**: task-completion-reflection.cjs (L183), session-memory-extractor.cjs (L156), loop-prevention.cjs (L48)
- **Issue**: Hardcoded timeout values (100ms, 300000ms) without named constants
- **Fix**: Extract to module-level constants with documentation
- **Status**: OPEN

**HOOK-008: Missing JSDoc on Exported Functions**

- **Files**: Most hooks
- **Issue**: No JSDoc comments on module.exports functions
- **Impact**: Harder for developers to understand API
- **Fix**: Add JSDoc to all exported functions
- **Status**: OPEN

**HOOK-009: Inconsistent Module Exports**

- **Issue**: 60% of hooks export for testing, 40% don't
- **Fix**: Standardize on always exporting main/parseHookInput for testing
- **Status**: OPEN

### Test Coverage Gaps

**HOOK-TEST-001: session-memory-extractor.cjs Missing Tests**

- **File**: `.claude/hooks/memory/session-memory-extractor.cjs`
- **Current Coverage**: 0 tests
- **Target**: 10+ tests covering extractPatterns, extractGotchas, extractDiscoveries
- **Status**: OPEN

**HOOK-TEST-002: Untested Routing Hooks**

- **Files**: agent-context-tracker.cjs, agent-context-pre-tracker.cjs, documentation-routing-guard.cjs
- **Impact**: 3/12 routing hooks untested (25% gap)
- **Status**: OPEN

### Performance Opportunities

**HOOK-PERF-001: Hook Consolidation**

- **Current**: 80 hook files
- **Potential**: ~55 hook files (-31%)
- **Strategy**: Consolidate related hooks (router guards, reflection hooks, routing guards)
- **Impact**: ~45% fewer process spawns per Edit/Write operation
- **Estimated Time Savings**: 200-400ms per Edit/Write
- **Effort**: 8-12 hours
- **Status**: OPEN (future work)

---

## Process Enhancement Findings (2026-01-26)

### [PROC-001] Missing Hook Consolidation Workflow

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Workflow Gap
- **Description**: No documented workflow exists for consolidating related hooks despite HOOK-PERF-001 and PERF-001/002/003 identifying significant consolidation opportunities.
- **Expected Benefit**: 40-60% latency reduction on Edit/Write operations, improved maintainability
- **Implementation Complexity**: Medium
- **Priority**: P1

### [PROC-002] Missing Code Deduplication Process

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: HOOK-001 identified ~2000 lines of duplicated parseHookInput() code across 40+ files, HOOK-002 identified ~300 lines of duplicated findProjectRoot() code across 20+ files. No standardized process for identifying and resolving code duplication.
- **Expected Benefit**: 90% code reduction, single point of maintenance
- **Implementation Complexity**: Low
- **Priority**: P1

### [PROC-003] Missing Automated Security Review Trigger

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: OPEN
- **Category**: Workflow Gap
- **Description**: SEC-004 implemented security-review-guard.cjs but the system lacks automated detection of security-sensitive changes.
- **Expected Benefit**: Reduced security review bypass, faster security issue detection
- **Implementation Complexity**: Medium
- **Priority**: P1

### [PROC-004] Missing Error Recovery Standardization

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: Multiple patterns exist for error recovery across hooks - inconsistency documented in SEC-008, SEC-AUDIT-001 through SEC-AUDIT-004.
- **Expected Benefit**: Consistent security posture, easier auditing
- **Implementation Complexity**: Low
- **Priority**: P1

### [PROC-005] Missing Agent Spawning Verification

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: No automated verification that spawned agents complete their assigned tasks. Agents may fail to call TaskUpdate({ status: "completed" }), leaving tasks perpetually "in_progress".
- **Expected Benefit**: Better task tracking, reduced orphaned work
- **Implementation Complexity**: Medium
- **Priority**: P2

### [PROC-006] Missing Workflow Skill Documentation

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to ARCH-002)
- **Category**: Documentation Gap
- **Description**: 6 workflow files exist but are not documented in CLAUDE.md Section 8.6
- **Expected Benefit**: Better discoverability, reduced duplicate workflow creation
- **Implementation Complexity**: Low
- **Priority**: P3

### [PROC-007] Missing State Cache Integration for Evolution Hooks

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN (Related to PERF-004)
- **Category**: Performance Gap
- **Description**: Evolution hooks all read evolution-state.json independently without caching. State-cache.cjs exists and is integrated into router-state.cjs, but not evolution hooks.
- **Expected Benefit**: 83% reduction in evolution state I/O
- **Implementation Complexity**: Low
- **Priority**: P2

### [PROC-008] Missing Test Isolation Pattern for State-Dependent Tests

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to FIX-002)
- **Category**: Testing Gap
- **Description**: Test parallelization caused failures in router-state tests due to shared state files. Current fix uses `--test-concurrency=1` which slows test suite. Better pattern needed for state isolation.
- **Expected Benefit**: Faster test execution, reliable parallel testing
- **Implementation Complexity**: Medium
- **Priority**: P3

### [PROC-009] Missing Pre-Commit Hook for Security Compliance

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Automation Gap
- **Description**: Security fixes (SEC-001 through SEC-AUDIT-010) were applied manually. No automated check prevents regression.
- **Expected Benefit**: Prevents security regression, shifts security left
- **Implementation Complexity**: Medium
- **Priority**: P2

### [PROC-010] Missing Documentation for Hooks Development

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to HOOK-008)
- **Category**: Documentation Gap
- **Description**: 80 hooks exist but no developer guide explains exit code conventions, audit logging format, parseHookInput pattern, state file access patterns, testing patterns
- **Expected Benefit**: Faster onboarding, consistent hook quality
- **Implementation Complexity**: Low
- **Priority**: P3

---

## Pointer Gap Analysis - Agent-Skill-Workflow Connections (2026-01-26)

### [POINTER-001] Deprecated `writing` Skill Still Referenced

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to ARCH-004)
- **File**: `.claude/agents/core/technical-writer.md` line 11
- **Description**: Agent references deprecated `writing` skill alongside correct `writing-skills`
- **Impact**: Redundant skill reference; `writing` redirects to `writing-skills` via alias
- **Recommended Fix**: Remove `writing` from skills list, keep only `writing-skills`
- **Effort**: 5 minutes

### [POINTER-006] Orphaned Skills Not Referenced by Any Agent

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: INFORMATIONAL
- **Description**: Several skills exist but are not referenced in any agent skills list
- **Impact**: Skills remain discoverable via skill catalog but not auto-loaded
- **Action**: No action needed - skills are accessible via `Skill()` tool invocation

---

## Performance Optimization Analysis (2026-01-26)

### [PERF-003] Hook Consolidation - Reflection/Memory Hooks

**Status**: Open

**Current State:**

- 3 reflection hooks: task-completion-reflection.cjs, error-recovery-reflection.cjs, session-end-reflection.cjs
- 2 memory hooks: session-memory-extractor.cjs, session-end-recorder.cjs
- Similar input parsing, queue file handling patterns

**Target State:**

- unified-reflection-handler.cjs with event-based routing
- Shared reflection queue writer

**Estimated Improvement:**

- Process spawns: 5 -> 2 (60% reduction)
- Code deduplication: ~800 lines saved

**Effort**: 3-4 hours

---

### [PERF-004] State Cache Integration - evolution-state.json

**Status**: Open

**Current State (from HOOK-004):**

- Multiple hooks read evolution-state.json without caching
- ~40% redundant I/O on state files

**Estimated Improvement:**

- I/O reduction: 5-6 reads -> 1 read per TTL (83% reduction)
- Latency per hook: ~10ms -> ~2ms

**Effort**: 2 hours

---

### [PERF-005] State Cache Integration - loop-state.json

**Status**: Open

**Current State:**

- `.claude/hooks/self-healing/loop-prevention.cjs` - getState() reads synchronously with locking
- File locking adds ~100-200ms overhead per read

**Effort**: 1 hour

---

### [PERF-006] Code Deduplication - parseHookInput()

**Status**: Open

**Current State (from HOOK-001):**

- ~40 files contain nearly identical parseHookInput() function
- ~50 lines x 40 files = 2000 duplicated lines

**Effort**: 3-4 hours

---

### [PERF-007] Code Deduplication - findProjectRoot()

**Status**: Open

**Current State (from HOOK-002):**

- ~20 files contain findProjectRoot() function
- `.claude/lib/utils/project-root.cjs` already exists but not used in hooks

**Effort**: 1.5 hours

---

### [PERF-008] Critical Fix - Silent Error Swallowing in Metrics

**Status**: Open

**Location (from CRITICAL-003):**

- File: `.claude/lib/memory/memory-dashboard.cjs`
- Multiple catch blocks with empty or minimal handling

**Effort**: 30 minutes

---

### [PERF-009] Critical Fix - Path Traversal in CLI

**Status**: Open

**Location (from CRITICAL-001):**

- Files: memory-manager.cjs, memory-scheduler.cjs, smart-pruner.cjs
- Functions accepting file paths without validation

**Effort**: 1 hour

---

## Security Audit Findings (2026-01-26)

### SEC-AUDIT-011: router-state.cjs Non-Atomic Read-Modify-Write

- **Date**: 2026-01-26
- **Severity**: LOW
- **Status**: OPEN
- **File**: `.claude/hooks/routing/router-state.cjs` (lines 393-399)
- **CWE**: CWE-367 (Time-of-Check to Time-of-Use Race Condition)
- **STRIDE Category**: Tampering
- **Description**: The `recordTaskUpdate()` function performs a non-atomic read-modify-write sequence. Concurrent calls could lose updates.
- **Recommendation**: Low priority as this is informational tracking, not security-critical.

---

## Structural Issues (2026-01-26)

### [STRUCT-001] Skill Workflows in Root Workflows Directory

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN
- **Location**: `.claude/workflows/`
- **Description**: 5 skill-specific workflow files (\*-skill-workflow.md) are in the root workflows directory instead of their respective skill directories.
- **Impact**: Violates skill self-containment pattern.
- **Fix**: Move to `.claude/skills/{skill-name}/workflow.md` or create `.claude/workflows/skills/` subdirectory.
- **Priority**: P2 (Next Sprint)

### [STRUCT-002] Temporary Clone Directory Cleanup

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN
- **Location**: `.claude/context/tmp/claude-scientific-skills-analysis/`
- **Description**: Contains full git clone of external repository including .git directory from integration work.
- **Impact**: Repository bloat.
- **Fix**: Delete or add to .gitignore.
- **Priority**: P3 (Backlog)

---

## [NEW-MED-001] Duplicated findProjectRoot in Self-Healing Hooks

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Files**:
  - `.claude/hooks/self-healing/anomaly-detector.cjs` lines 35-44
  - `.claude/hooks/self-healing/auto-rerouter.cjs` lines 30-39
- **Description**: Both hooks have duplicated findProjectRoot() function instead of using shared utility
- **Impact**: Code duplication (~40 lines); inconsistency if logic changes
- **Fix**: Import `PROJECT_ROOT` from `.claude/lib/utils/project-root.cjs`, remove duplicated functions
- **Related**: HOOK-002, PERF-007 (same pattern across 20+ hooks)
- **Priority**: P3

---

## [NEW-MED-002] Missing Debug Logging for Silent Catch Blocks

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **File**: `.claude/lib/memory/memory-dashboard.cjs`
- **Lines**: 82-84, 102-104, 116-118
- **Description**: Empty catch blocks `catch (e) { /* ignore */ }` make debugging failures impossible
- **Impact**: When getFileSizeKB() or getJsonEntryCount() fail, errors are silently swallowed
- **Fix**: Add conditional debug logging with METRICS_DEBUG env var
- **Priority**: P3
- **Related**: CRITICAL-003 (partial resolution)

---

## 2026-01-28: ROUTING-001 Agent Routing Table Path Errors

**Context**: Task #10 audit of Agent Routing Table completeness in CLAUDE.md Section 3.

**Critical Finding**: 3 agents have INCORRECT file paths in CLAUDE.md routing table.

### Path Errors (Critical)

**File**: C:\dev\projects\agent-studio\.claude\CLAUDE.md

| Mapping in CLAUDE.md                                                | Actual Location                                    | Status    |
| ------------------------------------------------------------------- | -------------------------------------------------- | --------- |
| `code-reviewer` -> `.claude/agents/core/code-reviewer.md`           | `.claude/agents/specialized/code-reviewer.md`      | **WRONG** |
| `security-architect` -> `.claude/agents/core/security-architect.md` | `.claude/agents/specialized/security-architect.md` | **WRONG** |
| `devops` -> `.claude/agents/core/devops.md`                         | `.claude/agents/specialized/devops.md`             | **WRONG** |

**Action Required**: Update lines in CLAUDE.md Section 3 (Agent Routing Table)

### Audit Results Summary

**Total Agents**:

- In CLAUDE.md routing table: 45
- In filesystem (.claude/agents): 46
- Match: 100% (no missing agents, 3 path errors)

### Agents with NO Routing Table Entries (26)

These agents exist but are NOT documented in CLAUDE.md Section 3. See full list in issues-archive.md if needed.

### Router Intent Keyword Coverage (Important)

**File**: C:\dev\projects\agent-studio\.claude\hooks\routing\router-enforcer.cjs

**ROUTING_TABLE keyword coverage**:

- Agents with intent keywords: 20
- Agents WITHOUT intent keywords: 26

**Impact**: When users request work related to these domains, router-enforcer.cjs cannot recommend these agents because ROUTING_TABLE has no intent keywords for them.

### Severity

- **Critical**: Path errors (3 agents with wrong locations)
- **Important**: Missing intent keywords (26 agents unroutable by router)
- **Minor**: Missing routing table entries (26 agents not documented)

### Recommended Fixes

**Phase 1 (Critical)**: Fix 3 path errors in CLAUDE.md (10 minutes)
**Phase 2 (Important)**: Add missing intent keywords to router-enforcer.cjs (2 hours)
**Phase 3 (Minor)**: Add missing agents to CLAUDE.md routing table (1 hour)

---

## [TESTING-002] Hook Test Coverage Gaps - 13 Hooks Without Tests

- **Date**: 2026-01-28
- **Severity**: Critical (5 hooks) | High (6 hooks) | Medium (2 hooks)
- **Status**: Open
- **Total Hooks**: 49 (excluding validator utility files)
- **Hooks With Tests**: 36 (73.5%)
- **Hooks Without Tests**: 13 (26.5%)
- **Description**: Systematic audit identified 13 hooks without test files, including critical safety and blocking hooks

### CRITICAL Priority Hooks (5 hooks requiring 6-10 hours total)

**TESTING-CRIT-001: enforce-claude-md-update.cjs** (1-2 hours)
**TESTING-CRIT-002: security-trigger.cjs** (1-2 hours)
**TESTING-CRIT-003: tdd-check.cjs** (1 hour)
**TESTING-CRIT-004: validate-skill-invocation.cjs** (1-2 hours)
**TESTING-CRIT-005: agent-context-tracker.cjs** (2-3 hours)

### HIGH Priority Hooks (6 hooks requiring 5-8 hours total)

**TESTING-HIGH-001: format-memory.cjs** (1-2 hours)
**TESTING-HIGH-002: memory-health-check.cjs** (2-3 hours)
**TESTING-HIGH-003: memory-reminder.cjs** (30 minutes)
**TESTING-HIGH-004: database-validators.cjs** (1-1.5 hours)
**TESTING-HIGH-005: filesystem-validators.cjs** (1-1.5 hours)
**TESTING-HIGH-006: git-validators.cjs** (1-1.5 hours)

### MEDIUM Priority Hooks (2 hooks requiring 1.5 hours total)

**TESTING-MED-001: process-validators.cjs** (1 hour)
**TESTING-MED-002: windows-null-sanitizer.cjs** (30 minutes)

### Test Coverage Summary

| Category       | With Tests | Without Tests | Coverage |
| -------------- | ---------- | ------------- | -------- |
| Routing (11)   | 10         | 1             | 91%      |
| Safety (15)    | 9          | 6             | 60%      |
| Memory (5)     | 2          | 3             | 40%      |
| Evolution (7)  | 7          | 0             | 100%     |
| Reflection (4) | 4          | 0             | 100%     |
| Validators (7) | 3          | 4             | 43%      |

**Total**: 49 hooks, 36 with tests, 13 without = 73.5% coverage

---

## [DEBUG-001] Empty Catch Blocks Without Conditional Debug Logging

- **Date**: 2026-01-28
- **Severity**: Medium
- **Status**: Open
- **Description**: Task #6 and #11 found empty catch blocks that hide errors. Should use METRICS_DEBUG pattern from memory-dashboard.cjs.

### Affected Files

**Memory Manager (8 locations)**

- **File**: `.claude/lib/memory/memory-manager.cjs`
- **Lines**: 488, 502, 516, 539, 555, 921, 961, 973, 985

**Memory Tiers (3 locations)**

- **File**: `.claude/lib/memory/memory-tiers.cjs`
- **Lines**: 124, 163, 188

**Memory Scheduler (1 location)**

- **File**: `.claude/lib/memory/memory-scheduler.cjs`
- **Line**: 94

**Total Effort**: 2-3 hours

---

## [PERF-003] Hook Consolidation Opportunities

- **Date**: 2026-01-28
- **Severity**: Medium (Performance)
- **Status**: Open
- **Description**: Task #15 identified 8 consolidation opportunities following PERF-002 pattern (73% latency reduction).

### High Priority Consolidations (70% of gains)

**1. task-pre-use-guard.cjs** (consolidate 4 hooks) - Effort: 2-3 hours
**2. task-post-use-guard.cjs** (consolidate 5 hooks) - Effort: 3-4 hours
**3. prompt-submit-guard.cjs** (consolidate 5 hooks) - Effort: 2-3 hours

### Estimated Performance Improvement

- Before: ~300ms average hook latency per event
- After: ~80ms average (73% reduction, matches PERF-002)

**Total Effort**: 11-16 hours for all consolidations

---

## Security Audit Findings (2026-01-27)

### [SEC-AUDIT-012] Regex-Based Command Validation Bypass Risk

- **Date**: 2026-01-27
- **Severity**: CRITICAL
- **Status**: OPEN
- **Location**: `.claude/hooks/safety/validators/shell-validators.cjs:25-77`
- **Description**: The custom `parseCommand()` tokenizer does not account for here-documents, command substitution with backticks, ANSI-C quoting, or brace expansion. Attackers could craft commands that parse differently than expected.
- **PoC**: `bash -c $'rm\x20-rf\x20/'` bypasses tokenizer
- **Remediation**: Use proper shell parser library (shell-quote), blocklist ANSI-C quoting patterns
- **Effort**: 4-8 hours

### [SEC-AUDIT-013] Atomic Write Race Window on Windows

- **Date**: 2026-01-27
- **Severity**: HIGH
- **Status**: OPEN
- **Location**: `.claude/lib/utils/atomic-write.cjs:39-65`
- **Description**: `fs.renameSync()` is not atomic on Windows NTFS. On Windows, rename fails if destination exists, potentially causing state corruption during concurrent operations.
- **Remediation**: Add Windows-specific fallback with retry logic
- **Effort**: 2-4 hours

### [SEC-AUDIT-014] TOCTOU in Lock File Mechanism

- **Date**: 2026-01-27
- **Severity**: HIGH
- **Status**: OPEN
- **Location**: `.claude/hooks/self-healing/loop-prevention.cjs:177-211`
- **Description**: TOCTOU vulnerability in stale lock cleanup - two processes checking simultaneously could both delete the "stale" lock and proceed.
- **Remediation**: Use `proper-lockfile` package or remove stale lock cleanup
- **Effort**: 2-3 hours

### [SEC-AUDIT-015] Safe JSON Schema Allowlist Incomplete

- **Date**: 2026-01-27
- **Severity**: HIGH
- **Status**: OPEN
- **Location**: `.claude/lib/utils/safe-json.cjs:35-129`
- **Description**: `router-state` schema missing many actual fields (taskDescription, sessionId, etc.). Incomplete schemas could allow unexpected data injection.
- **Remediation**: Audit and complete all state file schemas
- **Effort**: 4-6 hours

### [SEC-AUDIT-016] Environment Variable Override Logging Inconsistent

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: Multiple hooks
- **Description**: Security override env vars logged inconsistently - some JSON to stderr (good), some console.warn, some not at all.
- **Remediation**: Create centralized `auditSecurityOverride()` function
- **Effort**: 2-3 hours

### [SEC-AUDIT-017] Validator Registry Allows Unvalidated Commands

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `.claude/hooks/safety/validators/registry.cjs:126-129`
- **Description**: Commands without registered validator allowed by default. Unregistered interpreters (perl -e, ruby -e, awk) could execute arbitrary code.
- **Remediation**: Implement deny-by-default for unregistered commands
- **Effort**: 4-8 hours

### [SEC-AUDIT-018] Evolution State Tampering Could Bypass Budget

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `.claude/context/evolution-state.json`
- **Description**: Evolution state file writable by agents. Malicious prompt could reset evolutionCount or bypass cooldowns.
- **Remediation**: Add HMAC signature to state file
- **Effort**: 6-10 hours

### [SEC-AUDIT-019] Rollback Manager Manifest Injection

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: MITIGATED
- **Location**: `.claude/lib/self-healing/rollback-manager.cjs:288-320`
- **Description**: Manifest paths could be tampered before rollback. Mitigation: Path validation (SEC-006) blocks escaping project root.
- **Remediation**: Add HMAC signing to manifests for complete fix
- **Effort**: 4-6 hours

### [SEC-AUDIT-020] Busy-Wait CPU Exhaustion

- **Date**: 2026-01-27
- **Severity**: LOW
- **Status**: OPEN
- **Location**: loop-prevention.cjs:200-202, router-state.cjs:250-253
- **Description**: Busy-wait loops for synchronous sleep consume CPU and could cause resource exhaustion.
- **Remediation**: Use `Atomics.wait()` for proper synchronous blocking
- **Effort**: 1-2 hours

### [SEC-AUDIT-021] Debug Override Discovery Risk

- **Date**: 2026-01-27
- **Severity**: LOW
- **Status**: OPEN
- **Location**: Multiple hooks
- **Description**: Override env vars documented in error messages, making them discoverable by attackers.
- **Remediation**: Remove override hints from user-facing messages
- **Effort**: 1-2 hours

### Security Audit Summary

| Priority | Issue                                | Effort |
| -------- | ------------------------------------ | ------ |
| P0       | SEC-AUDIT-012 (Command Bypass)       | 4-8h   |
| P0       | SEC-AUDIT-017 (Unvalidated Commands) | 4-8h   |
| P1       | SEC-AUDIT-014 (Lock TOCTOU)          | 2-3h   |
| P1       | SEC-AUDIT-015 (Schema Completeness)  | 4-6h   |
| P1       | SEC-AUDIT-016 (Audit Logging)        | 2-3h   |
| P2       | SEC-AUDIT-013 (Windows Atomic)       | 2-4h   |
| P2       | SEC-AUDIT-018 (Evolution Signing)    | 6-10h  |
| P2       | SEC-AUDIT-019 (Manifest Signing)     | 4-6h   |

**Total Estimated Effort**: 29-50 hours
