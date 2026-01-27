# Framework Deep Dive Analysis Plan

**Created**: 2026-01-26
**Status**: Active
**ADR Reference**: ADR-018

## Executive Summary

This plan outlines a comprehensive 9-phase analysis of the `.claude` framework to identify:
- Security vulnerabilities (3 OPEN issues + new discoveries)
- Code quality issues and bugs
- Pointer gaps (missing agent-skill-workflow connections)
- Performance optimization opportunities
- Process and workflow enhancements

## Scope Summary

| Category | Directory | Files | Key Components |
|----------|-----------|-------|----------------|
| **Hooks** | `.claude/hooks/` | ~50 files | routing (25), safety (9), memory (8), reflection (6), evolution (12), self-healing (6), session (1) |
| **Libraries** | `.claude/lib/` | ~30 files | memory (10), workflow (18), integration (3), utils (6), self-healing (6), context (2) |
| **Tools** | `.claude/tools/` | ~20 items | cli (5), analysis (4 dirs), runtime (3 dirs), optimization (2 dirs), visualization (2 dirs), integrations (4 dirs) |
| **Agents** | `.claude/agents/` | ~45 agents | core, domain, specialized, orchestrators |
| **Skills** | `.claude/skills/` | 280+ skills | Various categories |
| **Workflows** | `.claude/workflows/` | ~15 workflows | core, enterprise, operations, creators |
| **Schemas** | `.claude/schemas/` | 13 schemas | Validation for agents, skills, hooks, workflows, etc. |

## Known Issues (Pre-existing)

### OPEN Security Issues (P0)
| ID | Severity | Description |
|----|----------|-------------|
| SEC-008 | High | Security hooks fail-open on errors |
| SEC-009 | High | execSync command injection risk |
| SEC-010 | High | Environment variable security overrides |

### Other Open Issues
| ID | Severity | Description |
|----|----------|-------------|
| TEST-001 | Medium | Broken npm test command (references non-existent file) |
| WF-001 | High | Phase 6 rollback assumes uncommitted changes |
| WF-002 | High | Version comparison logic unspecified |
| WF-003 | Medium | Related workflows reference non-existent files |

## Phase Breakdown

### Phase 1: Security Deep Dive (Task #2)
**Priority**: P0 (Immediate)
**Status**: Pending
**Blocked By**: None

**Objective**: Remediate 3 OPEN security issues

| Issue | Files | Fix Strategy |
|-------|-------|--------------|
| SEC-008 | task-create-guard.cjs, loop-prevention.cjs, auto-rerouter.cjs | Change fail-open to fail-closed |
| SEC-009 | swarm-coordination.cjs, format-memory.cjs, create.cjs | Replace execSync with spawn() |
| SEC-010 | file-placement-guard.cjs, router-write-guard.cjs, task-create-guard.cjs | Add audit logging |

**Agent Assignment**: SECURITY-ARCHITECT (primary), CODE-REVIEWER (secondary)

**Deliverables**:
1. Security analysis report
2. Remediation code changes
3. Test coverage for fixes
4. Updated issues.md

---

### Phase 2: Hook Code Quality Audit (Task #3)
**Priority**: P1
**Status**: Pending
**Blocked By**: Phase 1

**Directories to Analyze**:
```
hooks/
├── routing/   (25 files - 12 hooks, 13 tests)
├── safety/    (9 files)
├── memory/    (8 files)
├── reflection/ (6 files)
├── evolution/ (12 files)
├── self-healing/ (6 files)
└── session/   (1 file)
```

**Review Criteria**:
- [ ] Error handling patterns (fail-open vs fail-closed)
- [ ] Input validation completeness
- [ ] State file integrity protection
- [ ] Resource cleanup
- [ ] Race condition potential
- [ ] Test coverage gaps
- [ ] Dead code detection
- [ ] Code duplication
- [ ] Performance bottlenecks

**Agent Assignment**: CODE-REVIEWER

---

### Phase 3: Library Code Quality Audit (Task #4)
**Priority**: P1
**Status**: Pending
**Blocked By**: Phase 1

**Directories to Analyze**:
```
lib/
├── memory/      (10 files - manager, scheduler, tiers, dashboard, pruner)
├── workflow/    (18 files - engine, checkpoint, saga, validators, triggers)
├── integration/ (3 files - system-registration-handler)
├── utils/       (6 files - atomic-write, project-root, safe-json)
├── self-healing/ (6 files - dashboard, rollback-manager, validator)
└── context/     (2 subdirs)
```

**Review Criteria**:
- [ ] API contract consistency
- [ ] Error propagation patterns
- [ ] Memory leaks
- [ ] File locking/atomic operations
- [ ] Schema validation
- [ ] Circular dependencies
- [ ] Performance (O(n) vs O(n^2))
- [ ] Platform compatibility (Windows/Unix)

**Agent Assignment**: CODE-REVIEWER, DEVELOPER (for fixes)

---

### Phase 4: Pointer Gap Analysis (Task #5)
**Priority**: P2
**Status**: Pending
**Blocked By**: Phases 2, 3

**Analysis Areas**:
1. **Agent-to-Skill Mapping**
   - Cross-reference agent-skill-matrix.json
   - Verify skill invocation protocols

2. **Workflow-to-Agent Routing**
   - Verify workflow agent references
   - Identify orphaned workflows

3. **Hook Registration**
   - Cross-reference settings.json
   - Find unregistered/duplicate hooks

4. **Router Keyword Coverage**
   - Analyze router-enforcer.cjs
   - Map keywords to agents

5. **Schema Validation Coverage**
   - Identify schema-less artifacts

**Agent Assignment**: ARCHITECT, CODE-REVIEWER

---

### Phase 5: Tools and CLI Quality Audit (Task #7)
**Priority**: P2
**Status**: Pending
**Blocked By**: Phases 2, 3

**Directories to Analyze**:
```
tools/
├── cli/           (5 files)
├── analysis/      (4 subdirs)
├── runtime/       (3 subdirs)
├── optimization/  (2 subdirs)
├── visualization/ (2 subdirs)
└── integrations/  (4 subdirs)
```

**Agent Assignment**: CODE-REVIEWER

---

### Phase 6: Performance Optimization Analysis (Task #6)
**Priority**: P2
**Status**: Pending
**Blocked By**: Phases 2, 3

**Analysis Areas**:
1. Hook execution latency
2. File I/O patterns
3. JSON parsing overhead
4. Memory usage patterns
5. Token optimization

**Key Files to Profile**:
- router-state.cjs (high frequency)
- memory-manager.cjs (I/O heavy)
- workflow-engine.cjs (complex logic)
- step-validators.cjs (repeated validation)

**Agent Assignment**: DEVELOPER, ARCHITECT

---

### Phase 7: Process Enhancement (Task #8)
**Priority**: P3
**Status**: Pending
**Blocked By**: Phase 4

**Workflow Analysis**:
- Core workflows (router-decision, evolution, skill-lifecycle)
- Enterprise workflows (feature-development, c4-architecture)
- Operations workflows (incident-response)
- Creator workflows

**Process Improvements**:
- Task handoff patterns
- Error recovery procedures
- Memory protocol compliance
- Testing gates enforcement

**Agent Assignment**: PLANNER, ARCHITECT

---

### Phase 8: Test Infrastructure Fix (Task #10)
**Priority**: P2
**Status**: Pending
**Blocked By**: Phases 1, 2, 3

**Issues to Fix**:
1. Broken npm test command
2. Test parallelization verification
3. Test coverage gaps

**Agent Assignment**: QA, DEVELOPER

---

### Phase 9: Final Report (Task #9)
**Priority**: P3
**Status**: Pending
**Blocked By**: All phases (1-8)

**Report Sections**:
1. Executive Summary
2. Security Findings
3. Code Quality Findings
4. Architecture Findings
5. Performance Findings
6. Process Findings

**Roadmap Format**:
- P0: Security Critical
- P1: Bugs causing failures
- P2: Quality improvements
- P3: Nice-to-have enhancements

**Agent Assignment**: PLANNER, ARCHITECT

---

## Dependency Graph

```
          ┌──────────────────────────────────────────────────────┐
          │                                                      │
          │                  Phase 1: Security                   │
          │                  (SEC-008,009,010)                   │
          │                                                      │
          └──────────────┬───────────────────┬───────────────────┘
                         │                   │
            ┌────────────▼────────┐ ┌────────▼─────────┐
            │  Phase 2: Hooks     │ │  Phase 3: Libs   │
            │  Code Quality       │ │  Code Quality    │
            └────────┬────────────┘ └────────┬─────────┘
                     │                       │
         ┌───────────┴───────────────────────┴────────────┐
         │                       │                        │
   ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
   │ Phase 4:  │          │  Phase 5:   │          │  Phase 6:   │
   │ Pointer   │          │  Tools/CLI  │          │ Performance │
   │ Gaps      │          │  Audit      │          │ Analysis    │
   └─────┬─────┘          └──────┬──────┘          └──────┬──────┘
         │                       │                        │
   ┌─────▼─────┐                 │                        │
   │ Phase 7:  │                 │                        │
   │ Process   │                 │                        │
   │ Enhance   │                 │                        │
   └─────┬─────┘                 │                        │
         │                       │                        │
         │    ┌─────────────────▼────────────────────────┤
         │    │           Phase 8: Test Fix              │
         │    │                                          │
         │    └─────────────────┬─────────────────────────┘
         │                      │
         └──────────────────────┴──────────────────────────┐
                                                           │
                           ┌───────────────────────────────▼─────┐
                           │        Phase 9: Final Report        │
                           │        (Consolidate All)            │
                           └─────────────────────────────────────┘
```

## Parallel Execution Opportunities

| Wave | Phases | Prerequisites |
|------|--------|---------------|
| Wave 1 | Phase 1 | None |
| Wave 2 | Phases 2, 3 | Phase 1 complete |
| Wave 3 | Phases 4, 5, 6 | Phases 2, 3 complete |
| Wave 4 | Phase 7, 8 | Wave 3 complete |
| Wave 5 | Phase 9 | All complete |

## Estimated Effort

| Phase | Agent Sessions | Hours |
|-------|----------------|-------|
| Phase 1 | 1-2 | 2-4 |
| Phase 2 | 2-3 | 4-6 |
| Phase 3 | 2-3 | 4-6 |
| Phase 4 | 1-2 | 2-4 |
| Phase 5 | 1-2 | 2-4 |
| Phase 6 | 1-2 | 2-4 |
| Phase 7 | 1-2 | 2-4 |
| Phase 8 | 1-2 | 2-4 |
| Phase 9 | 1-2 | 2-4 |
| **Total** | **11-20** | **22-40** |

## Success Criteria

1. All OPEN security issues (SEC-008, SEC-009, SEC-010) resolved
2. Code quality audit complete with bug counts per category
3. Pointer gap matrix generated with fix priorities
4. Performance baseline established
5. Test infrastructure functional
6. Final report with actionable remediation roadmap
7. Framework health score calculated

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Security fixes break functionality | Write tests before fixes, run full test suite |
| Scope creep | Strict phase boundaries, defer new discoveries to backlog |
| False positives in code analysis | Manual review of critical findings |
| Performance regressions | Baseline before changes, compare after |

---

*Plan created by PLANNER agent following ADR-018*
