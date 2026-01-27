# Plan: Framework Deep Dive Analysis v2 - Targeted Remediation

## Overview

Refined analysis plan focusing on **remaining high-value work** after Phase 1 completion (ADR-029). This plan addresses the 23 open security issues (per open-security-issues.md) and completes the remediation roadmap established in architecture-review-2026-01-27.md.

**Context**: Previous plan (ADR-029) defined 8 phases. Phase 1 (Security & Reliability) has been partially executed:

- Architecture review completed (architecture-review-2026-01-27.md)
- 4 pointer gaps identified (POINTER-001, POINTER-003, DOC-001, ARCH-002)
- 10 security issues resolved (SEC-001 through SEC-010)
- 3 CRITICAL security fixes completed (SEC-AUDIT-012, SEC-013/014, SEC-017)
- Router violation remediation in progress (ADR-030, ADR-031, ADR-032)

**Remaining Scope**:

- Complete remediation of identified pointer gaps
- Address remaining HIGH severity issues (5 open)
- Fix test coverage gaps (13 hooks without tests)
- Performance optimization (hook latency, code duplication)
- Process documentation updates

## Executive Summary - Remaining Work

| Category            | Open Issues      | Effort Est. | Priority |
| ------------------- | ---------------- | ----------- | -------- |
| Security (CRITICAL) | 0 (all resolved) | 0h          | -        |
| Security (HIGH)     | 5                | 12-18h      | P0       |
| Security (MEDIUM)   | 9                | 22-35h      | P1       |
| Pointer Gaps        | 4                | 4-6h        | P1       |
| Testing Gaps        | 13 hooks         | 11-18h      | P1       |
| Performance         | 4 optimizations  | 8-12h       | P2       |
| Process/Docs        | 5 items          | 10-15h      | P2       |
| **TOTAL**           | **40 items**     | **67-104h** | -        |

## Phases

### Phase 1: Complete HIGH Severity Security (P0 Priority)

**Purpose**: Address remaining HIGH severity security issues before any other work.

**Agent Assignment**: SECURITY-ARCHITECT + DEVELOPER (parallel)

**Tasks**:

1. **Task 1.1**: Fix ATOMIC-001 - Missing atomic writes in 4 hooks (~1.5h)
   - **Command**: `Task({ agent: "developer", prompt: "Replace fs.writeFileSync() with atomicWriteJSONSync() in evolution-trigger-detector.cjs:220, memory-health-check.cjs:214,254, reflection-queue-processor.cjs:249" })`
   - **Verify**: `grep -n "fs.writeFileSync" .claude/hooks/evolution/evolution-trigger-detector.cjs .claude/hooks/memory/memory-health-check.cjs .claude/hooks/reflection/reflection-queue-processor.cjs | wc -l` (should be 0)
   - **Rollback**: `git checkout -- .claude/hooks/evolution/ .claude/hooks/memory/ .claude/hooks/reflection/`

2. **Task 1.2**: Fix HOOK-003 - research-enforcement.cjs prototype pollution (~30m)
   - **Command**: `Task({ agent: "developer", prompt: "Replace raw JSON.parse with safeParseJSON in research-enforcement.cjs:88 for evolution-state.json" })`
   - **Verify**: `grep -n "JSON.parse" .claude/hooks/evolution/research-enforcement.cjs | wc -l` (should be 0)

3. **Task 1.3**: Fix CRITICAL-001 - Path traversal in Memory CLI (~1h)
   - **Command**: `Task({ agent: "security-architect", prompt: "Add validatePathWithinRoot() checks to memory-manager.cjs, memory-scheduler.cjs, smart-pruner.cjs for all functions accepting external paths" })`
   - **Verify**: `grep -n "validatePathWithinRoot" .claude/lib/memory/*.cjs | wc -l` (should be >= 10)

4. **Task 1.4**: Fix SEC-AUDIT-015 - Safe JSON schema incomplete (~4h) [Parallel OK]
   - **Command**: `Task({ agent: "security-architect", prompt: "Audit router-state schema in safe-json.cjs. Add missing fields: taskDescription, sessionId, etc. based on actual router-state.json content" })`
   - **Verify**: `node -e "const s=require('./.claude/lib/utils/safe-json.cjs').SCHEMAS['router-state']; console.log(Object.keys(s.properties).length)" | grep -E '^[0-9]+$'` (should be >= 10)

5. **Task 1.5**: Verify all CRITICAL/HIGH security fixes with tests (~2h)
   - **Command**: `Task({ agent: "qa", prompt: "Run security-specific tests. Verify: SEC-AUDIT-012 shell bypass blocked, SEC-AUDIT-017 deny-by-default works, SEC-AUDIT-013/014 atomic write tests pass" })`
   - **Verify**: `pnpm test:framework:hooks --test-concurrency=1 2>&1 | tail -5`

#### Phase 1 Error Handling

If any task fails:

1. Document error in `.claude/context/memory/issues.md` with `SEC-FIX-FAIL-XXX` prefix
2. Continue with remaining tasks (independent fixes)
3. Create follow-up task for failed fixes

#### Phase 1 Verification Gate

```bash
# All must pass before proceeding
pnpm test:framework --test-concurrency=1 2>&1 | grep -E "^test result: " | grep "ok"
grep -r "fs.writeFileSync" .claude/hooks/evolution/ .claude/hooks/memory/ .claude/hooks/reflection/ | wc -l  # should be 0
grep "validatePathWithinRoot" .claude/lib/memory/memory-manager.cjs | wc -l  # should be > 0
```

**Success Criteria**:

- All 5 HIGH severity fixes implemented
- All framework tests pass (685/685)
- No new security regressions

**Dependencies**: None (unblocked)

---

### Phase 2: Complete Pointer Gap Remediation (P1 Priority)

**Purpose**: Address the 4 pointer gaps identified in architecture-review-2026-01-27.md. These affect maintainability and discoverability.

**Agent Assignment**: TECHNICAL-WRITER (primary) + DEVELOPER (verification scripts)

**Dependencies**: None (unblocked, can run parallel with Phase 1)

**Tasks**:

1. **Task 2.1**: Fix POINTER-003 - Add Related Workflows to architect.md (~30m)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Add 'Related Workflows' section to .claude/agents/core/architect.md listing: architecture-review-skill-workflow.md, consensus-voting-skill-workflow.md, database-architect-skill-workflow.md, swarm-coordination-skill-workflow.md" })`
   - **Verify**: `grep -c "Related Workflows" .claude/agents/core/architect.md` (should be 1)

2. **Task 2.2**: Fix DOC-001 - Add bidirectional cross-references (~1h)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Add 'Workflow Integration' section to skills: architecture-review, consensus-voting, database-architect, swarm-coordination. Add 'Related Skill' section to corresponding workflows." })`
   - **Verify**: `grep -l "Workflow Integration" .claude/skills/architecture-review/SKILL.md .claude/skills/consensus-voting/SKILL.md .claude/skills/database-architect/SKILL.md .claude/skills/swarm-coordination/SKILL.md | wc -l` (should be 4)

3. **Task 2.3**: Fix ARCH-002 - Move consolidated hooks to \_legacy (~45m)
   - **Command**: `Task({ agent: "developer", prompt: "Move individual hooks (planner-first-guard.cjs, task-create-guard.cjs, router-self-check.cjs, security-review-guard.cjs) and their test files to .claude/hooks/routing/_legacy/. Create README.md explaining consolidation per ADR-026" })`
   - **Verify**: `ls .claude/hooks/routing/_legacy/*.cjs | wc -l` (should be >= 4)
   - **Rollback**: `git checkout -- .claude/hooks/routing/`

4. **Task 2.4**: Fix POINTER-001 - Generate framework architecture diagrams (~1h)
   - **Command**: `Task({ agent: "architect", prompt: "Invoke Skill({ skill: 'diagram-generator' }). Create Mermaid diagrams for: 1) Agent hierarchy, 2) Hook system flow, 3) Skill invocation flow, 4) EVOLVE state machine. Save to .claude/context/artifacts/diagrams/" })`
   - **Verify**: `ls .claude/context/artifacts/diagrams/*.md | wc -l` (should be >= 4)

5. **Task 2.5**: Create CONFIG-002 validation script (~1h)
   - **Command**: `Task({ agent: "developer", prompt: "Create .claude/tools/cli/validate-agent-routing.js that compares CLAUDE.md Section 3 table entries with actual .claude/agents/**/*.md files. Report missing, extra, and mismatched entries." })`
   - **Verify**: `node .claude/tools/cli/validate-agent-routing.js 2>&1 | grep -E "^(OK|ERROR)"`

#### Phase 2 Verification Gate

```bash
# All must pass
grep "Related Workflows" .claude/agents/core/architect.md
ls .claude/hooks/routing/_legacy/README.md
ls .claude/context/artifacts/diagrams/ | wc -l  # >= 4
node .claude/tools/cli/validate-agent-routing.js 2>&1 | grep "OK"
```

**Success Criteria**:

- All 4 pointer gaps resolved
- Validation script passes
- Framework architecture diagrams generated

---

### Phase 3: Test Coverage Remediation (P1 Priority)

**Purpose**: Address TESTING-002 - 13 hooks without tests including 5 safety-critical.

**Agent Assignment**: QA + DEVELOPER (parallel)

**Dependencies**: Phase 1 complete (security fixes needed before testing)

**Tasks**:

1. **Task 3.1**: Create tests for safety-critical hooks (~4h) [CRITICAL]
   - **Command**: `Task({ agent: "qa", prompt: "Invoke Skill({ skill: 'tdd' }). Create test files for: 1) security-trigger.cjs, 2) tdd-check.cjs, 3) validate-skill-invocation.cjs. Focus on core functionality and edge cases." })`
   - **Verify**: `ls .claude/hooks/safety/security-trigger.test.cjs .claude/hooks/safety/tdd-check.test.cjs .claude/hooks/safety/validate-skill-invocation.test.cjs 2>/dev/null | wc -l` (should be 3)

2. **Task 3.2**: Fix enforce-claude-md-update.cjs exit code bug + tests (~2h)
   - **Command**: `Task({ agent: "developer", prompt: "Fix exit code bug at line 241 (exit(1) should be exit(2) for blocking). Create test file to verify blocking behavior." })`
   - **Verify**: `grep "exit(2)" .claude/hooks/validation/enforce-claude-md-update.cjs | wc -l` (should be >= 1)

3. **Task 3.3**: Create tests for agent-context-tracker.cjs (~2h) [CRITICAL]
   - **Command**: `Task({ agent: "qa", prompt: "Create comprehensive test file for agent-context-tracker.cjs covering: mode tracking, state transitions, TaskUpdate behavior, error handling." })`
   - **Verify**: `ls .claude/hooks/routing/agent-context-tracker.test.cjs && node --test .claude/hooks/routing/agent-context-tracker.test.cjs`

4. **Task 3.4**: Create tests for remaining 7 untested hooks (~4h) [Parallel OK]
   - **Command**: `Task({ agent: "qa", prompt: "Create test files for: evolution-trigger-detector.cjs, memory-health-check.cjs, session-end-reflection.cjs, task-completion-reflection.cjs, error-recovery-reflection.cjs, session-start.cjs, unified-evolution-guard.cjs" })`
   - **Verify**: `ls .claude/hooks/*/*.test.cjs | wc -l` (should increase by 7)

5. **Task 3.5**: Run full test suite and verify coverage (~1h)
   - **Command**: `Task({ agent: "qa", prompt: "Run full framework tests with coverage. Generate coverage report. Target: >60% coverage on safety-critical hooks." })`
   - **Verify**: `pnpm test:framework --test-concurrency=1 2>&1 | grep -E "tests.*pass"`

#### Phase 3 Verification Gate

```bash
# All must pass
pnpm test:framework --test-concurrency=1 2>&1 | grep "pass"
ls .claude/hooks/safety/security-trigger.test.cjs
ls .claude/hooks/routing/agent-context-tracker.test.cjs
```

**Success Criteria**:

- All 13 hooks now have test files
- Exit code bug fixed
- Framework tests all pass
- Coverage >= 60% on safety-critical hooks

---

### Phase 4: MEDIUM Severity Issues (P1/P2 Priority)

**Purpose**: Address remaining MEDIUM severity issues from open-security-issues.md.

**Agent Assignment**: DEVELOPER (primary) + SECURITY-ARCHITECT (review)

**Dependencies**: Phase 1 complete

**Tasks**:

1. **Task 4.1**: Audit and fix input validation gaps (~3h)
   - **Command**: `Task({ agent: "developer", prompt: "Review MEDIUM issues in open-security-issues.md. Fix input validation issues: HOOK-008 (async/await without try-catch), HOOK-010 (error message information disclosure), HOOK-012 (cross-platform path handling)" })`
   - **Verify**: Grep for fixed patterns

2. **Task 4.2**: Fix logging/audit trail issues (~2h)
   - **Command**: `Task({ agent: "developer", prompt: "Address HOOK-007 (inconsistent logging formats), HOOK-009 (missing audit logging in security hooks). Standardize JSON logging format." })`
   - **Verify**: `grep -r "JSON.stringify" .claude/hooks/safety/*.cjs | wc -l` (should increase)

3. **Task 4.3**: Fix state management issues (~2h)
   - **Command**: `Task({ agent: "developer", prompt: "Address HOOK-005 (state file write race conditions), HOOK-006 (missing state file backup). Use atomicWriteJSONSync() consistently." })`
   - **Verify**: `grep -r "atomicWriteJSONSync" .claude/hooks/*.cjs | wc -l`

4. **Task 4.4**: Security architect review of all fixes (~2h)
   - **Command**: `Task({ agent: "security-architect", prompt: "Review all MEDIUM severity fixes from Tasks 4.1-4.3. Verify no new vulnerabilities introduced. Sign off on fixes." })`
   - **Verify**: `grep "REVIEWED" .claude/context/artifacts/reports/medium-severity-review.md`

#### Phase 4 Verification Gate

```bash
pnpm test:framework --test-concurrency=1 2>&1 | grep "pass"
ls .claude/context/artifacts/reports/medium-severity-review.md
```

**Success Criteria**:

- All 9 MEDIUM severity issues addressed
- Security architect sign-off obtained
- No test regressions

---

### Phase 5: Performance Optimization (P2 Priority)

**Purpose**: Address performance issues identified in hook latency profiling.

**Agent Assignment**: DEVELOPER + ARCHITECT (parallel)

**Dependencies**: Phases 1-3 complete (stable codebase needed)

**Tasks**:

1. **Task 5.1**: Profile hook execution latency (~1h)
   - **Command**: `Task({ agent: "developer", prompt: "Create hook profiling script. Measure P50, P95, P99 latencies for: PreToolUse(Task) routing-guard, PreToolUse(Edit) safety hooks, PostToolUse(Task) unified hook. Save baseline to .claude/context/artifacts/reports/hook-latency-baseline.md" })`
   - **Verify**: `ls .claude/context/artifacts/reports/hook-latency-baseline.md`

2. **Task 5.2**: Identify and reduce code duplication (~2h)
   - **Command**: `Task({ agent: "code-reviewer", prompt: "Use jscpd or similar to detect code duplication in .claude/hooks/ and .claude/lib/. Create report with top 10 duplication hotspots." })`
   - **Verify**: `ls .claude/context/artifacts/reports/code-duplication.md`

3. **Task 5.3**: Optimize state file I/O (~2h)
   - **Command**: `Task({ agent: "developer", prompt: "Analyze state file access patterns. Implement caching for router-state.json reads within same hook invocation. Reduce redundant reads." })`
   - **Verify**: `grep "cachedState" .claude/hooks/routing/routing-guard.cjs`

4. **Task 5.4**: Measure and document performance improvements (~1h)
   - **Command**: `Task({ agent: "developer", prompt: "Re-run profiling script from Task 5.1. Compare against baseline. Document improvements in hook-performance-report.md" })`
   - **Verify**: `ls .claude/context/artifacts/reports/hook-performance-report.md`

#### Phase 5 Verification Gate

```bash
ls .claude/context/artifacts/reports/hook-latency-baseline.md
ls .claude/context/artifacts/reports/hook-performance-report.md
pnpm test:framework --test-concurrency=1 2>&1 | grep "pass"
```

**Success Criteria**:

- Latency baseline established
- P95 latency reduced by >= 20%
- Code duplication reduced by >= 50%
- No test regressions

---

### Phase 6: Process & Documentation Updates (P2 Priority)

**Purpose**: Update documentation to reflect all changes, add missing guides.

**Agent Assignment**: TECHNICAL-WRITER (primary)

**Dependencies**: Phases 1-4 complete

**Tasks**:

1. **Task 6.1**: Update CLAUDE.md with all changes (~2h)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Review all changes from Phases 1-5. Update CLAUDE.md sections: 1.3 (hook enforcement), 3 (agent routing table verification), 10.2 (directory structure accuracy)" })`
   - **Verify**: `git diff .claude/CLAUDE.md | wc -l` (should be > 0)

2. **Task 6.2**: Update ADRs for completed work (~1h)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Create ADR-033 documenting deep dive v2 remediation. Update ADR-030, ADR-031, ADR-032 status to Accepted (Implemented) if complete." })`
   - **Verify**: `grep "ADR-033" .claude/context/memory/decisions.md`

3. **Task 6.3**: Create ROUTER_TRAINING_EXAMPLES.md (~2h)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Create .claude/docs/ROUTER_TRAINING_EXAMPLES.md with 10+ examples of correct router behavior including: urgency handling, security-sensitive routing, complexity assessment" })`
   - **Verify**: `ls .claude/docs/ROUTER_TRAINING_EXAMPLES.md`

4. **Task 6.4**: Update issues.md with resolution notes (~1h)
   - **Command**: `Task({ agent: "technical-writer", prompt: "Mark all resolved issues in issues.md with Status: RESOLVED and resolution notes. Archive resolved issues to issues-archive.md if file exceeds 50KB." })`
   - **Verify**: `grep "Status.*Resolved" .claude/context/memory/issues.md | wc -l` (should increase)

5. **Task 6.5**: Create framework health scorecard (~1h)
   - **Command**: `Task({ agent: "architect", prompt: "Create .claude/context/artifacts/framework-health-scorecard.md with metrics: Test coverage %, Open CRITICAL/HIGH bugs, Pointer gap count, Hook latency P95, Code duplication %, Documentation completeness." })`
   - **Verify**: `ls .claude/context/artifacts/framework-health-scorecard.md`

#### Phase 6 Verification Gate

```bash
ls .claude/docs/ROUTER_TRAINING_EXAMPLES.md
ls .claude/context/artifacts/framework-health-scorecard.md
grep "ADR-033" .claude/context/memory/decisions.md
```

**Success Criteria**:

- All documentation updated
- ADRs created/updated
- Health scorecard baseline established

---

### Phase 7: Consolidation & Sign-Off

**Purpose**: Create master remediation report, verify all work, obtain sign-off.

**Agent Assignment**: PLANNER (consolidation) + ARCHITECT (sign-off)

**Dependencies**: ALL previous phases complete

**Tasks**:

1. **Task 7.1**: Consolidate all findings and fixes (~2h)
   - **Command**: `Task({ agent: "planner", prompt: "Read all reports from Phases 1-6. Create consolidated-remediation-report.md with: summary of fixes, remaining open items, metrics comparison (before/after)" })`
   - **Verify**: `ls .claude/context/artifacts/reports/consolidated-remediation-report.md`

2. **Task 7.2**: Run full verification suite (~1h)
   - **Command**: `Task({ agent: "qa", prompt: "Run: 1) Full framework tests, 2) Agent routing validation, 3) Hook latency check, 4) Security regression check. Report any failures." })`
   - **Verify**: `pnpm test:framework --test-concurrency=1 2>&1 | grep "pass"`

3. **Task 7.3**: Architecture review & sign-off (~1h)
   - **Command**: `Task({ agent: "architect", prompt: "Review consolidated-remediation-report.md. Validate: 1) No systemic issues missed, 2) All P0/P1 items addressed, 3) Framework health improved. Add 'APPROVED: [date]' to report." })`
   - **Verify**: `grep "APPROVED" .claude/context/artifacts/reports/consolidated-remediation-report.md`

#### Phase 7 Verification Gate

```bash
grep "APPROVED" .claude/context/artifacts/reports/consolidated-remediation-report.md
pnpm test:framework --test-concurrency=1 2>&1 | grep "685/685"
```

**Success Criteria**:

- Consolidated report created with APPROVED status
- All framework tests pass (685/685)
- No P0/P1 items remain open

---

### Phase [FINAL]: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction

**Tasks**:

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities (new agents/skills needed)

**Spawn Command**:

```javascript
Task({
  subagent_type: 'reflection-agent',
  description: 'Session reflection and learning extraction',
  prompt:
    'You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan (deep-dive-analysis-plan-v2.md), extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created).',
});
```

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

---

## Risks

| Risk                                               | Impact | Mitigation                          | Rollback                        |
| -------------------------------------------------- | ------ | ----------------------------------- | ------------------------------- |
| Security fix introduces regression                 | High   | Full test suite after each fix      | `git revert HEAD`               |
| Hook consolidation breaks routing                  | High   | Test routing scenarios before merge | Restore from `_legacy/`         |
| Performance optimization reduces stability         | Medium | Profile before/after, keep baseline | Revert optimization commits     |
| Documentation updates conflict with recent changes | Low    | Pull latest before doc updates      | `git checkout -- .claude/docs/` |

## Timeline Summary

| Phase     | Tasks  | Est. Time   | Parallel?     | Dependencies |
| --------- | ------ | ----------- | ------------- | ------------ |
| 1         | 5      | 9-13h       | Partial       | None         |
| 2         | 5      | 4-6h        | Yes (with P1) | None         |
| 3         | 5      | 13-18h      | Partial       | P1           |
| 4         | 4      | 9-12h       | No            | P1           |
| 5         | 4      | 6-8h        | Partial       | P1-3         |
| 6         | 5      | 7-9h        | No            | P1-4         |
| 7         | 3      | 4-5h        | Sequential    | ALL          |
| FINAL     | 1      | 30 min      | No            | P7           |
| **Total** | **32** | **~52-71h** |               |              |

**Notes**:

- Sequential execution: ~52-71 hours
- Maximum parallelization: ~35-50 hours (Phases 1+2 parallel, Phase 3+4 overlapping)
- Recommended approach: 3-4 focused sessions over 5-7 days
- Each phase independently rollback-able

## Key Deliverables

1. **Security Fixes**: 5 HIGH severity issues resolved (Phase 1)
2. **Pointer Gaps**: 4 gaps resolved + validation script (Phase 2)
3. **Test Coverage**: 13 new test files, >60% coverage (Phase 3)
4. **Medium Fixes**: 9 issues addressed with security review (Phase 4)
5. **Performance**: Latency baseline + optimization report (Phase 5)
6. **Documentation**: Updated CLAUDE.md, ADRs, training examples (Phase 6)
7. **Consolidated**: Master report + health scorecard + sign-off (Phase 7)

**Total Deliverables**: 7 major outcomes + ~15 reports/scripts

---

**PLAN STATUS**: Ready for execution. Phases 1 and 2 are unblocked and can start immediately (parallel execution recommended).
