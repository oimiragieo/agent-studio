# Plan: Framework Issue Resolution - Deep Dive Findings

## Executive Summary

Fix all 50 open issues identified in the framework deep dive, organized into 5 phases prioritized by security impact, performance gains, and effort. Total estimated effort: ~64 hours across 5 phases.

**Issue Inventory Summary:**
| Category | Total | Resolved | Open |
|----------|-------|----------|------|
| SEC-AUDIT | 11 | 10 | 1 |
| HOOK-* | 12 | 0 | 12 |
| CRITICAL-* | 3 | 0 | 3 |
| IMP-* | 7 | 0 | 7 |
| ARCH-* | 4 | 1 | 3 |
| POINTER-* | 6 | 5 | 1 |
| PERF-* | 9 | 0 | 9 |
| PROC-* | 10 | 0 | 10 |
| SEC-IMPL-* | 6 | 0 | 6 |

## Objectives

- Fix remaining security issue (SEC-AUDIT-011)
- Resolve 3 critical library issues (path validation, error handling)
- Reduce code duplication by 90% (~2300 lines -> ~230 lines)
- Achieve 60% latency reduction on Edit/Write operations
- Establish process automation for security and testing

---

## Phases

### Phase 1: Critical Security & Reliability (P1) - Immediate
**Dependencies**: None
**Parallel OK**: Partial
**Estimated Time**: 4 hours

These issues MUST be fixed first as they affect system security and reliability.

#### Tasks

- [ ] **1.1** Fix SEC-AUDIT-011: Non-atomic state operations in router-state.cjs (~1h)
  - **File**: `.claude/hooks/routing/router-state.cjs` (lines 393-399)
  - **Issue**: Read-modify-write race condition in recordTaskUpdate()
  - **Command**: `Task({ agent: "developer", prompt: "Fix TOCTOU race in router-state.cjs recordTaskUpdate() by implementing file locking similar to loop-prevention.cjs" })`
  - **Verify**: `node -e "require('./.claude/hooks/routing/router-state.cjs'); console.log('import ok')"`
  - **Rollback**: `git checkout -- .claude/hooks/routing/router-state.cjs`

- [ ] **1.2** Fix HOOK-003: Apply SEC-007 to research-enforcement.cjs (~30m)
  - **File**: `.claude/hooks/evolution/research-enforcement.cjs` (line 88)
  - **Issue**: Raw JSON.parse for evolution-state.json (prototype pollution risk)
  - **Command**: Replace `JSON.parse(content)` with `safeParseJSON(content, 'evolution-state')` from `../../lib/utils/safe-json.cjs`
  - **Verify**: `node -e "require('./.claude/hooks/evolution/research-enforcement.cjs'); console.log('import ok')"`
  - **Rollback**: `git checkout -- .claude/hooks/evolution/research-enforcement.cjs`

- [ ] **1.3** Fix CRITICAL-001: Path traversal validation in CLI interfaces (~1h)
  - **Files**:
    - `.claude/lib/memory/memory-manager.cjs`
    - `.claude/lib/memory/memory-scheduler.cjs`
    - `.claude/lib/memory/smart-pruner.cjs`
  - **Issue**: Missing path.normalize() and traversal checks
  - **Command**: Add `validatePathWithinRoot()` from safe-json.cjs before all file operations accepting external paths
  - **Verify**: `pnpm test:framework -- --test-name-pattern "path"`
  - **Rollback**: `git checkout -- .claude/lib/memory/`

- [ ] **1.4** Fix CRITICAL-003: Silent error swallowing in metrics (~30m)
  - **File**: `.claude/lib/memory/memory-dashboard.cjs`
  - **Issue**: Empty catch blocks hide failures
  - **Command**: Add METRICS_DEBUG env var logging to all catch blocks
  - **Verify**: `METRICS_DEBUG=true node -e "require('./.claude/lib/memory/memory-dashboard.cjs')"`
  - **Rollback**: `git checkout -- .claude/lib/memory/memory-dashboard.cjs`

- [ ] **1.5** Fix HOOK-005: router-write-guard.cjs exit code (~5m)
  - **File**: `.claude/hooks/safety/router-write-guard.cjs` (line 207)
  - **Issue**: Uses exit(1) instead of exit(2) for blocking
  - **Command**: Change `process.exit(1)` to `process.exit(2)`
  - **Verify**: `grep -n "process.exit(2)" .claude/hooks/safety/router-write-guard.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/safety/router-write-guard.cjs`

#### Phase 1 Error Handling
If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document: `echo "Phase 1 failed: $(date)" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate
```bash
# All must pass before proceeding
pnpm test:framework 2>&1 | grep -E "passing|PASS" && \
node -e "require('./.claude/hooks/routing/router-state.cjs')" && \
node -e "require('./.claude/hooks/evolution/research-enforcement.cjs')" && \
echo "Phase 1 PASSED"
```

---

### Phase 2: Performance Quick Wins (P1) - Same Day
**Dependencies**: Phase 1
**Parallel OK**: Yes (tasks 2.1-2.3 can run in parallel)
**Estimated Time**: 6 hours

High-impact performance improvements with moderate effort.

#### Tasks

- [ ] **2.1** PERF-006: Create hook-input.cjs shared utility (~3h) [parallel OK]
  - **Issue**: ~2000 lines of parseHookInput() duplicated across 40+ hooks
  - **Files to Create**: `.claude/lib/utils/hook-input.cjs`, `.claude/lib/utils/hook-input.test.cjs`
  - **Command**:
    ```
    Task({ agent: "developer", prompt: "Create .claude/lib/utils/hook-input.cjs with:
    - parseHookInput(options) - stdin/argv JSON parsing
    - validateHookInput(input, schema) - schema validation
    - getToolInput(hookInput) - extract tool_input safely

    Extract from .claude/hooks/routing/task-create-guard.cjs lines 36-90 as reference.
    Create 15+ tests covering all edge cases." })
    ```
  - **Verify**: `pnpm test -- .claude/lib/utils/hook-input.test.cjs 2>&1 | grep -E "passing|PASS"`
  - **Rollback**: `rm -f .claude/lib/utils/hook-input.cjs .claude/lib/utils/hook-input.test.cjs`

- [ ] **2.2** PERF-007: Consolidate findProjectRoot() usage (~1.5h) [parallel OK]
  - **Issue**: ~300 lines duplicated across 20+ hooks
  - **Command**: Update all hooks to import from `.claude/lib/utils/project-root.cjs` and remove duplicated functions
  - **Target Files**: router-state.cjs, file-placement-guard.cjs, evolution-state-guard.cjs, loop-prevention.cjs, research-enforcement.cjs, session-memory-extractor.cjs
  - **Verify**: `grep -r "function findProjectRoot" .claude/hooks/ | wc -l` should return 0
  - **Rollback**: `git checkout -- .claude/hooks/`

- [ ] **2.3** PERF-004: Add state-cache for evolution-state.json (~2h) [parallel OK]
  - **Issue**: 5+ hooks read evolution-state.json independently
  - **Files to Update**:
    - `.claude/hooks/safety/file-placement-guard.cjs`
    - `.claude/hooks/evolution/research-enforcement.cjs`
    - `.claude/hooks/evolution/evolution-state-guard.cjs`
    - `.claude/hooks/evolution/evolution-audit.cjs`
    - `.claude/hooks/evolution/quality-gate-validator.cjs`
  - **Command**: Import `getCachedState` from `../../lib/utils/state-cache.cjs`, replace direct reads
  - **Verify**: `grep -r "getCachedState.*evolution" .claude/hooks/ | wc -l` should be 5+
  - **Rollback**: `git checkout -- .claude/hooks/evolution/ .claude/hooks/safety/file-placement-guard.cjs`

#### Phase 2 Error Handling
If any task fails:
1. Run rollback for that specific task
2. Continue with other parallel tasks
3. Document partial failures in issues.md

#### Phase 2 Verification Gate
```bash
# All must pass
ls .claude/lib/utils/hook-input.cjs && \
grep -r "function findProjectRoot" .claude/hooks/ | wc -l | grep -E "^0$" && \
pnpm test:framework 2>&1 | grep -E "passing|PASS" && \
echo "Phase 2 PASSED"
```

---

### Phase 3: Code Quality & Hook Fixes (P2) - Short Term
**Dependencies**: Phase 2
**Parallel OK**: Partial
**Estimated Time**: 12 hours

Address hook quality issues and important library fixes.

#### Tasks

- [ ] **3.1** HOOK-001: Migrate hooks to use hook-input.cjs (~4h)
  - **Issue**: 40+ hooks with duplicated parseHookInput()
  - **Command**:
    ```
    Task({ agent: "developer", prompt: "Update ALL hooks in .claude/hooks/ to:
    1. Import { parseHookInput, validateHookInput } from '../../lib/utils/hook-input.cjs'
    2. Remove local parseHookInput() function
    3. Ensure tests still pass

    Priority order: routing/, safety/, evolution/, self-healing/, memory/, reflection/, validation/, tools/" })
    ```
  - **Verify**: `grep -r "function parseHookInput" .claude/hooks/ | wc -l` should return 0
  - **Rollback**: `git checkout -- .claude/hooks/`

- [ ] **3.2** HOOK-006: Standardize audit logging format (~2h)
  - **Files**: session-memory-extractor.cjs, reflection hooks
  - **Issue**: Inconsistent log formats (some plain text, some JSON)
  - **Command**: Standardize all audit logs to JSON.stringify format
  - **Verify**: `grep -r "console.error" .claude/hooks/ | grep -v "JSON.stringify" | wc -l` should be 0 (for audit logs)
  - **Rollback**: `git checkout -- .claude/hooks/memory/ .claude/hooks/reflection/`

- [ ] **3.3** IMP-007: Add step schema validation to workflow-validator (~2h)
  - **File**: `.claude/lib/workflow/workflow-validator.cjs`
  - **Issue**: Only validates phases, not step structure
  - **Command**: Add validation for required step fields (id, handler) in validatePhase()
  - **Verify**: `pnpm test -- .claude/lib/workflow/workflow-validator.test.cjs`
  - **Rollback**: `git checkout -- .claude/lib/workflow/workflow-validator.cjs`

- [ ] **3.4** HOOK-TEST-001: Add tests for session-memory-extractor (~2h)
  - **File to Create**: `.claude/hooks/memory/session-memory-extractor.test.cjs`
  - **Target Coverage**: extractPatterns, extractGotchas, extractDiscoveries functions
  - **Command**: Create 10+ tests covering all exported functions and error cases
  - **Verify**: `pnpm test -- .claude/hooks/memory/session-memory-extractor.test.cjs`
  - **Rollback**: `rm -f .claude/hooks/memory/session-memory-extractor.test.cjs`

- [ ] **3.5** HOOK-007/008/009: Minor hook improvements (~2h)
  - **HOOK-007**: Replace magic numbers with named constants
  - **HOOK-008**: Add JSDoc to exported functions
  - **HOOK-009**: Standardize module exports for testing
  - **Files**: task-completion-reflection.cjs, session-memory-extractor.cjs, loop-prevention.cjs
  - **Verify**: `grep -E "const.*TIMEOUT|@param|module.exports" .claude/hooks/memory/ | wc -l` should increase
  - **Rollback**: `git checkout -- .claude/hooks/memory/`

#### Phase 3 Error Handling
If any task fails:
1. Run rollback command
2. Document in issues.md with specific task reference
3. Continue with unblocked tasks

#### Phase 3 Verification Gate
```bash
# All must pass
pnpm test:framework 2>&1 | grep -E "passing|PASS" && \
grep -r "function parseHookInput" .claude/hooks/ | wc -l | grep -E "^0$" && \
ls .claude/hooks/memory/session-memory-extractor.test.cjs && \
echo "Phase 3 PASSED"
```

---

### Phase 4: Hook Consolidation (P2) - Medium Term
**Dependencies**: Phase 3
**Parallel OK**: No (sequential consolidation)
**Estimated Time**: 16 hours

Major hook consolidation for 60% latency reduction on Edit/Write operations.

#### Tasks

- [ ] **4.1** PERF-001: Consolidate routing guard hooks (~6h)
  - **Current**: 5 hooks fire on PreToolUse(Task)
    - task-create-guard.cjs
    - planner-first-guard.cjs
    - security-review-guard.cjs
    - documentation-routing-guard.cjs
    - router-self-check.cjs
  - **Target**: Single unified-routing-guard.cjs
  - **Command**:
    ```
    Task({ agent: "developer", prompt: "Create .claude/hooks/routing/unified-routing-guard.cjs that:
    1. Combines all 5 routing guard logics
    2. Single process spawn, single state read
    3. Preserves all individual validation logic as functions
    4. Maintains same exit codes and audit logging
    5. Create comprehensive test file with 30+ tests

    After creation, update .claude/settings.json to use new hook and deprecate old ones." })
    ```
  - **Verify**: `pnpm test -- .claude/hooks/routing/unified-routing-guard.test.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/routing/ .claude/settings.json`

- [ ] **4.2** PERF-002: Consolidate evolution guard hooks (~6h)
  - **Current**: 5 hooks fire on PreToolUse(Edit/Write)
    - evolution-state-guard.cjs
    - conflict-detector.cjs
    - quality-gate-validator.cjs
    - research-enforcement.cjs
    - evolution-trigger-detector.cjs
  - **Target**: Single unified-evolution-guard.cjs
  - **Command**: Similar consolidation pattern as 4.1
  - **Verify**: `pnpm test -- .claude/hooks/evolution/unified-evolution-guard.test.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/evolution/ .claude/settings.json`

- [ ] **4.3** PERF-003: Consolidate reflection/memory hooks (~4h)
  - **Current**: 5 hooks
    - task-completion-reflection.cjs
    - error-recovery-reflection.cjs
    - session-end-reflection.cjs
    - session-memory-extractor.cjs
    - session-end-recorder.cjs
  - **Target**: 2 unified hooks (unified-reflection.cjs, unified-memory.cjs)
  - **Command**: Consolidate based on trigger event (PostToolUse vs SessionEnd)
  - **Verify**: `pnpm test -- .claude/hooks/memory/unified-*.test.cjs .claude/hooks/reflection/unified-*.test.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/memory/ .claude/hooks/reflection/ .claude/settings.json`

#### Phase 4 Error Handling
If any task fails:
1. DO NOT modify settings.json until consolidation is verified
2. Run full rollback of affected hook directory
3. Keep old hooks active, document failure

#### Phase 4 Verification Gate
```bash
# Performance validation
pnpm test:framework 2>&1 | grep -E "passing|PASS" && \
# Hook count reduction (80 -> ~55)
find .claude/hooks -name "*.cjs" -not -name "*.test.cjs" | wc -l && \
# Verify settings.json updated
grep "unified-routing-guard" .claude/settings.json && \
echo "Phase 4 PASSED"
```

---

### Phase 5: Process Automation & Documentation (P3) - Strategic
**Dependencies**: Phase 4
**Parallel OK**: Yes (all tasks can run in parallel)
**Estimated Time**: 26 hours

Long-term process improvements and automation.

#### Tasks

- [ ] **5.1** PROC-001: Create hook consolidation workflow (~3h) [parallel OK]
  - **File to Create**: `.claude/workflows/core/hook-consolidation-workflow.md`
  - **Purpose**: Document the consolidation process used in Phase 4 for future use
  - **Command**:
    ```
    Task({ agent: "planner", prompt: "Create hook consolidation workflow based on Phase 4 learnings. Include:
    - Identification phase (group related hooks)
    - Analysis phase (map shared code)
    - Design phase (unified hook architecture)
    - Implementation phase (create + migrate tests)
    - Validation phase (verify behavior)
    - Cleanup phase (deprecate old hooks)" })
    ```
  - **Verify**: `ls .claude/workflows/core/hook-consolidation-workflow.md`
  - **Rollback**: N/A (documentation only)

- [ ] **5.2** PROC-003: Implement automated security review trigger (~4h) [parallel OK]
  - **Enhancement to**: `.claude/hooks/safety/file-placement-guard.cjs`
  - **Purpose**: Auto-detect security-sensitive changes and set requiresSecurityReview flag
  - **Patterns to Detect**:
    - Changes to `.claude/hooks/safety/` or `.claude/hooks/routing/`
    - Files with auth/security/credential keywords
    - Environment variable handling code
  - **Command**: Add security pattern detection to file-placement-guard.cjs
  - **Verify**: Test with mock security-sensitive file write
  - **Rollback**: `git checkout -- .claude/hooks/safety/file-placement-guard.cjs`

- [ ] **5.3** PROC-004: Create error recovery template (~2h) [parallel OK]
  - **File to Create**: `.claude/templates/hook-error-handling.md`
  - **Purpose**: Standardize error handling patterns across all hooks
  - **Content**:
    - Standard try-catch for security hooks (fail-closed)
    - Standard try-catch for advisory hooks (fail-open with logging)
    - Audit logging format specification
    - Debug override pattern
  - **Verify**: `ls .claude/templates/hook-error-handling.md`
  - **Rollback**: N/A (documentation only)

- [ ] **5.4** PROC-009: Create pre-commit security lint (~4h) [parallel OK]
  - **File to Create**: `.claude/tools/cli/security-lint.cjs`
  - **Purpose**: Prevent security regression
  - **Checks**:
    - No fail-open catch blocks in security hooks
    - No raw JSON.parse on state files
    - No execSync with string interpolation
  - **Command**: Create linter with 20+ tests, integrate with git hooks
  - **Verify**: `node .claude/tools/cli/security-lint.cjs .claude/hooks/`
  - **Rollback**: `rm -f .claude/tools/cli/security-lint.cjs`

- [ ] **5.5** PROC-010: Create HOOK_DEVELOPMENT_GUIDE.md (~3h) [parallel OK]
  - **File to Create**: `.claude/docs/HOOK_DEVELOPMENT_GUIDE.md`
  - **Purpose**: Developer documentation for hook creation
  - **Content**:
    - Hook lifecycle and triggers
    - Exit code conventions (0 allow, 2 block)
    - Audit logging standards
    - Shared utilities (hook-input, project-root, state-cache)
    - Testing patterns
  - **Verify**: `ls .claude/docs/HOOK_DEVELOPMENT_GUIDE.md`
  - **Rollback**: N/A (documentation only)

- [ ] **5.6** ARCH-002/PROC-006: Document skill workflows (~2h) [parallel OK]
  - **Files to Update**: `.claude/CLAUDE.md` Section 8.6
  - **Add**: 6 undocumented skill workflows
    - security-architect-skill-workflow.md
    - architecture-review-skill-workflow.md
    - consensus-voting-skill-workflow.md
    - swarm-coordination-skill-workflow.md
    - database-architect-skill-workflow.md
    - context-compressor-skill-workflow.md
  - **Verify**: `grep "skill-workflow" .claude/CLAUDE.md | wc -l` should be 6+
  - **Rollback**: `git checkout -- .claude/CLAUDE.md`

- [ ] **5.7** POINTER-001/ARCH-004: Fix deprecated skill reference (~10m) [parallel OK]
  - **File**: `.claude/agents/core/technical-writer.md` line 11
  - **Issue**: References deprecated `writing` skill
  - **Command**: Replace `writing` with `writing-skills` in skills list
  - **Verify**: `grep "writing-skills" .claude/agents/core/technical-writer.md`
  - **Rollback**: `git checkout -- .claude/agents/core/technical-writer.md`

- [ ] **5.8** IMP-001: Add JSDoc to public APIs (~4h) [parallel OK]
  - **Files**: memory-manager.cjs, memory-tiers.cjs, smart-pruner.cjs
  - **Target**: JSDoc comments for 25+ public functions
  - **Format**: @param, @returns, @throws tags
  - **Verify**: `grep -c "@param" .claude/lib/memory/*.cjs` should increase significantly
  - **Rollback**: `git checkout -- .claude/lib/memory/`

- [ ] **5.9** IMP-006: Add error path test coverage (~4h) [parallel OK]
  - **Files**: Existing test files in .claude/lib/
  - **Add Tests For**:
    - Module not found scenarios
    - Permission errors
    - Corrupted JSON handling
  - **Verify**: `pnpm test:framework -- --test-name-pattern "error"` should have new tests
  - **Rollback**: `git checkout -- .claude/lib/**/*.test.cjs`

#### Phase 5 Error Handling
If any task fails:
1. Tasks are independent - continue with others
2. Document specific failure in issues.md
3. Low-risk phase - no cascading failures

#### Phase 5 Verification Gate
```bash
# Documentation created
ls .claude/workflows/core/hook-consolidation-workflow.md && \
ls .claude/templates/hook-error-handling.md && \
ls .claude/docs/HOOK_DEVELOPMENT_GUIDE.md && \
# Tools created
ls .claude/tools/cli/security-lint.cjs && \
# All tests pass
pnpm test:framework 2>&1 | grep -E "passing|PASS" && \
echo "Phase 5 PASSED"
```

---

## Phase [FINAL]: Evolution & Reflection Check
**Dependencies**: All previous phases
**Parallel OK**: No

#### Tasks

- [ ] **F.1** Spawn reflection agent for quality assessment (~15m)
  - **Command**:
    ```javascript
    Task({
      agent: "reflection-agent",
      prompt: "Assess quality of framework issue resolution work:
      1. Review all 5 phases completed
      2. Verify all 50 open issues addressed
      3. Extract learnings to .claude/context/memory/learnings.md
      4. Update issues.md with final status
      5. Create session summary"
    })
    ```
  - **Verify**: Check for updated learnings.md and issues.md

- [ ] **F.2** Update framework deep dive report (~10m)
  - **File**: `.claude/context/artifacts/FRAMEWORK-DEEP-DIVE-REPORT.md`
  - **Update**: Resolution status for all fixed issues
  - **Verify**: Issue counts show reduced open items

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Hook consolidation breaks functionality | HIGH | Comprehensive test coverage before deprecating old hooks | `git checkout -- .claude/hooks/ .claude/settings.json` |
| State cache causes stale reads | MEDIUM | Explicit invalidation on writes, short TTL (1s) | Remove getCachedState calls |
| Pre-commit hook slows development | LOW | Make lint configurable via env var | Disable git hook |
| Documentation becomes stale | LOW | Link to source code, auto-generate where possible | N/A |
| Parallel hook migration causes conflicts | MEDIUM | Sequential execution for Phase 4 | Rollback entire phase |

---

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? | Dependencies |
|-------|-------|-----------|-----------|--------------|
| 1 - Critical Security | 5 | 4h | Partial | None |
| 2 - Performance Quick Wins | 3 | 6h | Yes | Phase 1 |
| 3 - Code Quality | 5 | 12h | Partial | Phase 2 |
| 4 - Hook Consolidation | 3 | 16h | No | Phase 3 |
| 5 - Process Automation | 9 | 26h | Yes | Phase 4 |
| FINAL - Reflection | 2 | 25m | No | All |
| **Total** | **27** | **~64h** | | |

---

## Success Criteria

After all phases complete:

1. **Security**: All SEC-* issues resolved (11/11)
2. **Performance**: 60% latency reduction on Edit/Write operations
3. **Code Quality**: <300 lines duplicated code (down from 2300)
4. **Test Coverage**: >60% hook test coverage (up from 44%)
5. **Documentation**: HOOK_DEVELOPMENT_GUIDE.md and hook-consolidation-workflow.md exist
6. **Automation**: security-lint.cjs operational and integrated

---

## Implementation Notes

### Agent Assignments

| Phase | Primary Agent | Supporting Agents |
|-------|--------------|-------------------|
| 1 | DEVELOPER | SECURITY-ARCHITECT (review) |
| 2 | DEVELOPER | CODE-REVIEWER |
| 3 | DEVELOPER | QA (tests) |
| 4 | DEVELOPER | ARCHITECT (design), QA (tests) |
| 5 | DEVELOPER, PLANNER | TECHNICAL-WRITER (docs) |
| FINAL | REFLECTION-AGENT | - |

### Key File References

| Issue Category | Primary Files |
|---------------|---------------|
| SEC-AUDIT-011 | `.claude/hooks/routing/router-state.cjs` |
| HOOK-003 | `.claude/hooks/evolution/research-enforcement.cjs` |
| CRITICAL-001 | `.claude/lib/memory/memory-manager.cjs`, `memory-scheduler.cjs`, `smart-pruner.cjs` |
| PERF-006/007 | `.claude/lib/utils/hook-input.cjs`, `.claude/lib/utils/project-root.cjs` |
| PERF-001/002/003 | `.claude/hooks/routing/`, `.claude/hooks/evolution/`, `.claude/hooks/memory/` |

---

*Plan generated: 2026-01-26*
*Deep Dive Report: .claude/context/artifacts/FRAMEWORK-DEEP-DIVE-REPORT.md*
*Issues Inventory: .claude/context/memory/issues.md*
