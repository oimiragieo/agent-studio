# Plan: Framework Deep Dive Analysis

## Executive Summary

Comprehensive analysis of the .claude framework to identify and remediate security vulnerabilities, code quality issues, architectural gaps, and performance bottlenecks. This plan addresses 11 known security issues, audits 82 hook files and 25 library modules, and establishes a framework health baseline.

## Objectives

- Fix all 11 open SEC-AUDIT security issues (P0 priority)
- Audit all hooks for fail-closed security pattern compliance
- Audit all library modules for code quality and integration gaps
- Identify and document all pointer gaps (agent-skill-workflow connections)
- Optimize hook execution performance (target: 40% reduction in process spawns)
- Create comprehensive framework health report

## Phases

### Phase 1: Security Deep Dive
**Dependencies**: None
**Parallel OK**: No (foundational security work)
**Estimated Time**: 4-6 hours
**Task ID**: #5

#### Context

11 security issues identified in previous audit remain OPEN:
- 2 CRITICAL (fail-open in guards)
- 4 HIGH (error handling, TOCTOU, deep copy)
- 4 MEDIUM (audit logging, input validation)
- 1 LOW (non-atomic writes)

#### Tasks

- [ ] **1.1** Fix SEC-AUDIT-001: planner-first-guard.cjs fail-open (~30 min)
  - **File**: `.claude/hooks/routing/planner-first-guard.cjs` lines 254-262
  - **Command**: Change catch block `process.exit(0)` to `process.exit(2)`
  - **Verify**: `grep -n "process.exit(2)" planner-first-guard.cjs | grep -q catch`
  - **Rollback**: `git checkout -- .claude/hooks/routing/planner-first-guard.cjs`

- [ ] **1.2** Fix SEC-AUDIT-002: security-review-guard.cjs fail-open (~30 min)
  - **File**: `.claude/hooks/routing/security-review-guard.cjs` lines 173-180
  - **Command**: Change catch block to fail-closed with audit logging
  - **Verify**: `node --test .claude/hooks/routing/security-review-guard.test.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/routing/security-review-guard.cjs`

- [ ] **1.3** Fix SEC-AUDIT-003: router-write-guard.cjs error handling (~45 min)
  - **File**: `.claude/hooks/safety/router-write-guard.cjs` lines 146-210
  - **Command**: Wrap main() in try-catch with fail-closed behavior
  - **Verify**: `node --test .claude/hooks/safety/router-write-guard.test.cjs`
  - **Rollback**: `git checkout -- .claude/hooks/safety/router-write-guard.cjs`

- [ ] **1.4** Fix SEC-AUDIT-004: task-create-guard.cjs no-input handling (~30 min)
  - **File**: `.claude/hooks/routing/task-create-guard.cjs` lines 127-129
  - **Command**: Return exit(2) when no input, add env var override
  - **Verify**: `node --test .claude/hooks/routing/task-create-guard.test.cjs`

- [ ] **1.5** Fix SEC-AUDIT-005: loop-prevention.cjs TOCTOU (~60 min)
  - **File**: `.claude/hooks/self-healing/loop-prevention.cjs` lines 189-197
  - **Command**: Implement file locking using proper-lockfile or atomic ops
  - **Verify**: `node --test .claude/hooks/self-healing/loop-prevention.test.cjs`

- [ ] **1.6** Fix SEC-AUDIT-006: safe-json.cjs deep copy (~45 min)
  - **File**: `.claude/lib/utils/safe-json.cjs` lines 119-129
  - **Command**: Add JSON.parse(JSON.stringify()) for nested objects
  - **Verify**: `node --test .claude/lib/utils/safe-json.test.cjs`

- [ ] **1.7** Fix SEC-AUDIT-007: security-review-guard.cjs readState (~30 min)
  - **File**: `.claude/hooks/routing/security-review-guard.cjs` lines 28-35
  - **Command**: Return `{requiresSecurityReview: true}` on error
  - **Verify**: Test error handling returns secure defaults

- [ ] **1.8** Fix SEC-AUDIT-008: planner-first-guard.cjs audit log (~20 min)
  - **File**: `.claude/hooks/routing/planner-first-guard.cjs` lines 203-205
  - **Command**: Add JSON audit log when PLANNER_FIRST_ENFORCEMENT=off
  - **Verify**: `grep -n "security_override_used" planner-first-guard.cjs`

- [ ] **1.9** Fix SEC-AUDIT-009: router-state.cjs audit log (~20 min)
  - **File**: `.claude/hooks/routing/router-state.cjs` lines 253-257
  - **Command**: Add audit log for ALLOW_ROUTER_WRITE=true
  - **Verify**: `grep -n "security_override_used" router-state.cjs`

- [ ] **1.10** Fix SEC-AUDIT-010: file-placement-guard.cjs input validation (~30 min)
  - **File**: `.claude/hooks/safety/file-placement-guard.cjs` lines 314-322
  - **Command**: Use safeParseJSON() with hook-input schema
  - **Verify**: `node --test .claude/hooks/safety/file-placement-guard.test.cjs`

- [ ] **1.11** Document SEC-AUDIT-011: router-state.cjs limitation (~15 min)
  - **File**: `.claude/hooks/routing/router-state.cjs` lines 393-399
  - **Command**: Add comment documenting known race condition (informational only)
  - **Verify**: Comment exists explaining the limitation

#### Phase 1 Error Handling

If any task fails:
1. Run rollback command for failed task
2. Document error: `echo "Phase 1 failed: [task] [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate

```bash
# All security tests must pass
node --test .claude/hooks/routing/*.test.cjs
node --test .claude/hooks/safety/*.test.cjs
node --test .claude/hooks/self-healing/*.test.cjs
node --test .claude/lib/utils/*.test.cjs
# Verify no fail-open patterns remain
grep -r "process.exit(0)" .claude/hooks/routing/*.cjs | grep -v test | wc -l  # Should be 0 for security hooks
```

---

### Phase 2: Hook Code Quality Audit
**Dependencies**: Phase 1
**Parallel OK**: Yes (with Phase 3)
**Estimated Time**: 4-6 hours
**Task ID**: #3

#### Context

82 hook files exist across 8 categories. Need comprehensive audit for:
- Consistent error handling patterns
- Proper audit logging
- Input validation
- Test coverage

#### Tasks

- [ ] **2.1** Audit routing/ hooks (15 files) (~90 min)
  - **Files**: router-state, task-create-guard, planner-first-guard, security-review-guard, router-self-check, task-update-tracker, task-completion-guard, router-mode-reset, agent-context-tracker, agent-context-pre-tracker, documentation-routing-guard, router-enforcer
  - **Command**: Create audit matrix with checklist scores
  - **Verify**: Audit matrix complete for all routing hooks
  - **Output**: `.claude/context/artifacts/reports/hook-audit-routing.md`

- [ ] **2.2** Audit safety/ hooks (12 files) (~60 min)
  - **Files**: router-write-guard, file-placement-guard, bash-command-validator, validate-skill-invocation, windows-null-sanitizer, enforce-claude-md-update, tdd-check, validators/*.cjs
  - **Command**: Create audit matrix
  - **Verify**: Audit matrix complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-safety.md`

- [ ] **2.3** Audit evolution/ hooks (10 files) (~45 min)
  - **Files**: research-enforcement, evolution-state-guard, conflict-detector, evolution-audit, quality-gate-validator, evolution-trigger-detector
  - **Command**: Create audit matrix
  - **Verify**: Audit matrix complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-evolution.md`

- [ ] **2.4** Audit reflection/ hooks (8 files) (~30 min)
  - **Files**: task-completion-reflection, error-recovery-reflection, session-end-reflection, reflection-queue-processor
  - **Command**: Create audit matrix
  - **Verify**: Audit matrix complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-reflection.md`

- [ ] **2.5** Audit self-healing/ hooks (6 files) (~30 min)
  - **Files**: loop-prevention, anomaly-detector, auto-rerouter
  - **Command**: Create audit matrix
  - **Verify**: Audit matrix complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-self-healing.md`

- [ ] **2.6** Audit memory/ hooks (8 files) (~30 min)
  - **Files**: session-memory-extractor, format-memory, memory-health-check, session-end-recorder, extract-workflow-learnings
  - **Command**: Create audit matrix
  - **Verify**: Audit matrix complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-memory.md`

- [ ] **2.7** Consolidate hook audit findings (~30 min)
  - **Command**: Merge all audit matrices into single report
  - **Verify**: Master audit report complete
  - **Output**: `.claude/context/artifacts/reports/hook-audit-master.md`

#### Phase 2 Verification Gate

```bash
# All audit reports exist
ls .claude/context/artifacts/reports/hook-audit-*.md | wc -l  # Should be 7
# Master report has all categories
grep -c "## " .claude/context/artifacts/reports/hook-audit-master.md  # Should be 6+
```

---

### Phase 3: Library Code Quality Audit
**Dependencies**: Phase 1
**Parallel OK**: Yes (with Phase 2)
**Estimated Time**: 3-4 hours
**Task ID**: #2

#### Tasks

- [ ] **3.1** Audit memory/ modules (6 files) (~60 min)
  - **Files**: memory-manager, memory-scheduler, memory-tiers, memory-dashboard, smart-pruner
  - **Focus**: Async patterns, error handling, PROJECT_ROOT usage
  - **Output**: `.claude/context/artifacts/reports/lib-audit-memory.md`

- [ ] **3.2** Audit workflow/ modules (9 files) (~90 min)
  - **Files**: workflow-engine, workflow-validator, checkpoint-manager, step-validators, saga-coordinator, cross-workflow-trigger, workflow-cli
  - **Focus**: Event handler limits, condition evaluation safety
  - **Output**: `.claude/context/artifacts/reports/lib-audit-workflow.md`

- [ ] **3.3** Audit utils/ modules (4 files) (~30 min)
  - **Files**: safe-json, state-cache, project-root, atomic-write
  - **Focus**: Schema completeness, cache TTL effectiveness
  - **Output**: `.claude/context/artifacts/reports/lib-audit-utils.md`

- [ ] **3.4** Audit self-healing/ modules (3 files) (~30 min)
  - **Files**: rollback-manager, validator, dashboard
  - **Focus**: Path validation, checkpoint integrity
  - **Output**: `.claude/context/artifacts/reports/lib-audit-self-healing.md`

- [ ] **3.5** Consolidate library audit findings (~30 min)
  - **Output**: `.claude/context/artifacts/reports/lib-audit-master.md`

#### Phase 3 Verification Gate

```bash
ls .claude/context/artifacts/reports/lib-audit-*.md | wc -l  # Should be 5
```

---

### Phase 4: Pointer Gap Analysis
**Dependencies**: Phase 2, Phase 3
**Parallel OK**: No
**Estimated Time**: 3-4 hours
**Task ID**: #4

#### Tasks

- [ ] **4.1** Create ROUTER_KEYWORD_GUIDE.md (~60 min)
  - **Source**: router-enforcer.cjs intentKeywords, INTENT_TO_AGENT
  - **Output**: `.claude/docs/ROUTER_KEYWORD_GUIDE.md`
  - **Verify**: File exists and CLAUDE.md reference is valid

- [ ] **4.2** Document undocumented skill workflows (~45 min)
  - **Files**: 6 skill workflows not in CLAUDE.md Section 8.6
  - **Command**: Add to workflows table or create workflows/skills/
  - **Verify**: All skill workflows documented

- [ ] **4.3** Fix deprecated skill references (~20 min)
  - **File**: technical-writer.md line 12
  - **Command**: Change 'writing' to 'writing-skills'
  - **Verify**: `grep -n "writing-skills" technical-writer.md`

- [ ] **4.4** Verify agent-skill pointers (~45 min)
  - **Check**: All agent skill lists against skill-catalog.md
  - **Output**: Broken pointer list
  - **Verify**: All pointers valid

- [ ] **4.5** Verify CLAUDE.md references (~30 min)
  - **Check**: All file references in CLAUDE.md exist
  - **Output**: Missing file list
  - **Verify**: All references valid

- [ ] **4.6** Create pointer gap summary (~30 min)
  - **Output**: `.claude/context/artifacts/reports/pointer-gap-analysis.md`

#### Phase 4 Verification Gate

```bash
ls .claude/docs/ROUTER_KEYWORD_GUIDE.md  # Must exist
grep -c "writing-skills" .claude/agents/core/technical-writer.md  # Should be 1+
```

---

### Phase 5: Performance Optimization
**Dependencies**: Phase 2, Phase 3
**Parallel OK**: Yes (with Phase 4)
**Estimated Time**: 4-5 hours
**Task ID**: #6

#### Tasks

- [ ] **5.1** Measure baseline hook performance (~30 min)
  - **Command**: Time Edit/Write operations, count process spawns
  - **Output**: Baseline measurements in report

- [ ] **5.2** Identify hook consolidation candidates (~45 min)
  - **Analysis**: Which hooks can be combined?
  - **Target**: 8 PreToolUse hooks → 3

- [ ] **5.3** Integrate state-cache into remaining hooks (~90 min)
  - **Files**: All hooks reading router-state.json, evolution-state.json
  - **Verify**: Cache hits reduce file I/O

- [ ] **5.4** Implement hook consolidation (~120 min)
  - **Create**: edit-write-guard.cjs combining multiple safety hooks
  - **Update**: settings.json hook registrations

- [ ] **5.5** Measure optimized performance (~30 min)
  - **Compare**: Before/after latency
  - **Output**: `.claude/context/artifacts/reports/performance-optimization.md`

#### Phase 5 Verification Gate

```bash
# Hook count reduced
grep -c "hooks/" .claude/settings.json  # Should be less than before
# All tests still pass
pnpm test:framework
```

---

### Phase 6: Process Enhancement
**Dependencies**: Phase 4
**Parallel OK**: No
**Estimated Time**: 3-4 hours
**Task ID**: #7

#### Tasks

- [ ] **6.1** Update router-decision.md for new guards (~45 min)
  - **Focus**: Add new security guards to decision tree
  - **Verify**: Document is current

- [ ] **6.2** Improve reflection queue processing (~60 min)
  - **Consider**: Integration with EVOLVE_AUTO_START
  - **Output**: Updated reflection-queue-processor.cjs

- [ ] **6.3** Add memory protocol improvements (~45 min)
  - **Focus**: Auto-pruning, health metrics
  - **Output**: Updated memory scheduler

- [ ] **6.4** Verify documentation completeness (~30 min)
  - **Check**: AGENTS.md, SKILLS.md current
  - **Output**: Documentation gap list

#### Phase 6 Verification Gate

```bash
# Key docs updated
git diff --name-only | grep -E "AGENTS.md|router-decision.md"
```

---

### Phase 7: Final Consolidation Report
**Dependencies**: All Previous Phases
**Parallel OK**: No
**Estimated Time**: 2-3 hours
**Task ID**: #8

#### Tasks

- [ ] **7.1** Calculate framework health score (~30 min)
  - **Metrics**: Security issues, test coverage, documentation completeness
  - **Output**: Numerical score 0-100

- [ ] **7.2** Create executive summary (~30 min)
  - **Content**: Key findings, critical fixes, remaining debt

- [ ] **7.3** Compile detailed findings (~45 min)
  - **Sections**: Security, code quality, architecture, performance

- [ ] **7.4** Create prioritized recommendations (~30 min)
  - **Categories**: P0 (immediate), P1 (1-2 weeks), P2 (1-2 months)

- [ ] **7.5** Finalize report (~15 min)
  - **Output**: `.claude/context/artifacts/reports/framework-deep-dive-report.md`
  - **Verify**: Report complete with all sections

#### Phase 7 Verification Gate

```bash
ls .claude/context/artifacts/reports/framework-deep-dive-report.md
wc -l .claude/context/artifacts/reports/framework-deep-dive-report.md  # Should be 500+
```

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Security fix breaks functionality | High | Run all tests after each fix | `git checkout -- <file>` |
| Hook consolidation causes regressions | Medium | Test thoroughly before deploy | Revert to original hooks |
| Performance measurements inaccurate | Low | Use consistent test conditions | N/A |
| Documentation changes miss updates | Low | Cross-reference verification | Git diff review |

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? | Task ID |
|-------|-------|-----------|-----------|---------|
| 1 - Security | 11 | 4-6 hours | No | #5 |
| 2 - Hook Audit | 7 | 4-6 hours | Yes (with P3) | #3 |
| 3 - Lib Audit | 5 | 3-4 hours | Yes (with P2) | #2 |
| 4 - Pointers | 6 | 3-4 hours | No | #4 |
| 5 - Performance | 5 | 4-5 hours | Yes (with P4) | #6 |
| 6 - Process | 4 | 3-4 hours | No | #7 |
| 7 - Report | 5 | 2-3 hours | No | #8 |
| **Total** | **43** | **23-32 hours** | | |

## Dependency Graph

```
Phase 1 (Security)
    |
    +-----> Phase 2 (Hooks) ----+
    |                           |
    +-----> Phase 3 (Libs) -----+----> Phase 4 (Pointers)
                                |              |
                                +----> Phase 5 (Performance)
                                               |
                                               v
                                       Phase 6 (Process)
                                               |
                                               v
                                       Phase 7 (Report)
```

## Agent Assignments

| Phase | Primary Agent | Supporting Agent |
|-------|---------------|------------------|
| 1 | SECURITY-ARCHITECT | DEVELOPER |
| 2 | CODE-REVIEWER | - |
| 3 | CODE-REVIEWER | ARCHITECT |
| 4 | ARCHITECT | CODE-REVIEWER |
| 5 | DEVELOPER | ARCHITECT |
| 6 | PLANNER | ARCHITECT |
| 7 | PLANNER | ARCHITECT |

---

**Plan Created**: 2026-01-26
**Plan Version**: 1.0
**Created By**: PLANNER Agent (Task #1)
