# Plan: Issue Remediation - 44 Open Issues

## Executive Summary

Prioritized remediation plan for 44 open issues identified in `.claude/context/memory/issues.md`. Issues categorized by severity and grouped for efficient parallel execution. Focus on security-critical issues first, then functional fixes, documentation, and performance.

## Current State Analysis

### Priority Breakdown

| Priority | Count | Issues |
|----------|-------|--------|
| CRITICAL/P0 | 5 | SEC-AUDIT-012, SEC-AUDIT-017, SEC-AUDIT-014, ENFORCEMENT-002, ENFORCEMENT-003 |
| HIGH/P1 | 8 | WORKFLOW-VIOLATION-001, ENFORCEMENT-001, SEC-REMEDIATION-001/002/003, SEC-AUDIT-013/015, TESTING-003 |
| MEDIUM/P2 | 20 | Documentation, pointer gaps, process improvements |
| LOW/P3 | 11 | Future enhancements, recommendations |

### Dependency Analysis

```
ENFORCEMENT-003 (blocking enforcement)
    └── blocks ENFORCEMENT-001, ENFORCEMENT-002

SEC-AUDIT-012 (command validation bypass)
    └── blocks SEC-AUDIT-017 (unvalidated commands)

PROC-002 (code deduplication)
    └── enables PERF-006, PERF-007

TESTING-002 (hook test coverage)
    └── should follow PROC-002 (shared utilities first)
```

## Phases

### Phase 1: Critical Security & Blocking Fixes (P0)

**Purpose**: Fix security vulnerabilities and enforcement gaps that undermine framework integrity
**Parallel OK**: Partial (SEC-AUDIT issues can run in parallel)

#### Tasks

- [ ] **1.1** Fix SEC-AUDIT-012: Regex command validation bypass (~4-8 hours)
  - **Files**: `.claude/hooks/safety/validators/shell-validators.cjs`
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Use shell-quote library, blocklist ANSI-C quoting patterns
  - **Verify**: `pnpm test -- --grep "shell-validator"` passes
  - **Rollback**: `git checkout -- .claude/hooks/safety/validators/shell-validators.cjs`

- [ ] **1.2** Fix ENFORCEMENT-003: Router-First Protocol advisory-only (~6-8 hours) [CRITICAL]
  - **Files**: `.claude/hooks/routing/routing-guard.cjs`, `user-prompt-unified.cjs`
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Modify hooks to exit 2 (block) when Router uses blacklisted tools without Task spawn
  - **Verify**: Headless test `claude -p "Use Glob to list files"` should block
  - **Rollback**: `git checkout -- .claude/hooks/routing/`

- [ ] **1.3** Fix SEC-AUDIT-014: Lock TOCTOU vulnerability (~2-3 hours) [PARALLEL OK]
  - **Files**: `.claude/hooks/self-healing/loop-prevention.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Use proper-lockfile package or remove stale lock cleanup
  - **Verify**: `pnpm test -- --grep "loop-prevention"` passes

- [ ] **1.4** Fix SEC-AUDIT-017: Validator deny-by-default (~4-8 hours) [PARALLEL OK]
  - **Files**: `.claude/hooks/safety/validators/registry.cjs`
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Implement deny-by-default for unregistered commands (perl -e, ruby -e, awk)
  - **Verify**: Unregistered interpreter commands are blocked

- [ ] **1.5** Fix ENFORCEMENT-002: skill-creation-guard state tracking (~8-10 hours)
  - **Files**: Multiple (skill-creation-guard.cjs, skill-invocation-tracker.cjs, settings.json)
  - **Command**: Spawn DEVELOPER
  - **Fix**: Complete state tracking implementation per issue description
  - **Verify**: Direct SKILL.md writes without skill-creator are blocked
  - **Depends On**: 1.2 (routing guard must work first)

#### Phase 1 Error Handling

If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 1 failed: [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate

```bash
# All must pass before proceeding
pnpm test -- --grep "shell-validator"
pnpm test -- --grep "routing-guard"
pnpm test -- --grep "loop-prevention"
# Headless test: Router should spawn agent, not use Glob directly
```

**Success Criteria**: All 5 CRITICAL issues resolved, blocking enforcement active

---

### Phase 2: High-Priority Functional Fixes (P1)

**Purpose**: Fix functional issues that impact daily framework operation
**Parallel OK**: Yes (issues are independent)
**Dependencies**: Phase 1 complete

#### Tasks

- [ ] **2.1** Fix TESTING-003: Add `claude` command to validator registry (~30 min) [QUICK WIN]
  - **Files**: `.claude/hooks/safety/validators/registry.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add `claude` to COMMAND_VALIDATORS with allow-all validator
  - **Verify**: `claude --version` no longer blocked

- [ ] **2.2** Fix SEC-AUDIT-013: Windows atomic write race (~2-4 hours) [PARALLEL OK]
  - **Files**: `.claude/lib/utils/atomic-write.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add Windows-specific fallback with retry logic
  - **Verify**: `pnpm test -- --grep "atomic-write"` passes on Windows

- [ ] **2.3** Fix SEC-AUDIT-015: Complete safe-json schema (~4-6 hours) [PARALLEL OK]
  - **Files**: `.claude/lib/utils/safe-json.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Audit and complete all state file schemas (router-state fields)
  - **Verify**: All state file reads/writes validated against schemas

- [ ] **2.4** Fix SEC-REMEDIATION-001: State file HMAC signing (~2-3 hours) [PARALLEL OK]
  - **Files**: `.claude/hooks/safety/skill-creation-guard.cjs`
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Implement HMAC signature verification, reduce time window to 3 min
  - **Verify**: State file tampering detected and blocked

- [ ] **2.5** Fix SEC-REMEDIATION-002: bashPath null byte sanitization (~30 min) [QUICK WIN]
  - **Files**: `.claude/lib/utils/platform.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add `filepath.replace(/\0/g, '')` before normalization
  - **Verify**: Null bytes stripped from paths

- [ ] **2.6** Fix SEC-REMEDIATION-003: Researcher agent URL allowlist (~4-6 hours)
  - **Files**: `.claude/agents/specialized/researcher.md`, new URL validator
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Create URL domain allowlist, block RFC 1918 ranges, add rate limiting
  - **Verify**: Researcher cannot POST to arbitrary URLs

- [ ] **2.7** Fix ROUTING-001: Agent routing table path errors (~10 min) [QUICK WIN]
  - **Files**: `.claude/CLAUDE.md`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Update 3 wrong paths (code-reviewer, security-architect, devops)
  - **Verify**: All paths in routing table resolve to existing files

#### Phase 2 Verification Gate

```bash
pnpm test -- --grep "atomic-write"
pnpm test -- --grep "safe-json"
claude --version  # Should work without SEC-AUDIT-017 error
```

**Success Criteria**: All 8 HIGH issues resolved, headless testing unblocked

---

### Phase 3: Documentation & Test Coverage (P2)

**Purpose**: Fill documentation gaps and add missing test coverage
**Parallel OK**: Yes (issues are independent)
**Dependencies**: Phase 2 complete (need working test infrastructure)

#### Tasks

- [ ] **3.1** Fix DOC-002: Add IRON LAW to CLAUDE.md Section 7 (~30 min) [QUICK WIN]
  - **Files**: `.claude/CLAUDE.md`
  - **Command**: Spawn TECHNICAL-WRITER
  - **Fix**: Add visceral workflow emphasis per issue description
  - **Verify**: Section 7 contains IRON LAW subsection

- [ ] **3.2** Fix DOC-003: Add skill creation anti-pattern to training examples (~30 min) [QUICK WIN]
  - **Files**: `.claude/docs/ROUTER_TRAINING_EXAMPLES.md`
  - **Command**: Spawn TECHNICAL-WRITER
  - **Fix**: Add "Anti-Pattern: Skill Creation Shortcut" section
  - **Verify**: Training examples document skill creation violation

- [ ] **3.3** Fix ARCH-002: Document 6 undocumented skill workflows (~1 hour)
  - **Files**: `.claude/CLAUDE.md` Section 8.6
  - **Command**: Spawn TECHNICAL-WRITER
  - **Fix**: Add all 6 workflow files to Enterprise Workflows table
  - **Verify**: All workflows documented in CLAUDE.md

- [ ] **3.4** Fix ARCH-003: Standardize workflow placement (~2 hours)
  - **Files**: `.claude/workflows/`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Move skill workflows to consistent location
  - **Verify**: All skill workflows in same directory

- [ ] **3.5** Fix ARCH-004: Update technical-writer deprecated skill ref (~5 min) [QUICK WIN]
  - **Files**: `.claude/agents/core/technical-writer.md`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Replace `writing` with `writing-skills`
  - **Verify**: No deprecated skill references

- [ ] **3.6** Fix POINTER-001: Create example diagrams (~2 hours)
  - **Files**: `.claude/context/artifacts/diagrams/`
  - **Command**: Spawn ARCHITECT
  - **Fix**: Generate framework architecture diagrams
  - **Verify**: Diagrams directory no longer empty

- [ ] **3.7** Fix POINTER-003: Add workflow refs to architect.md (~30 min)
  - **Files**: `.claude/agents/core/architect.md`
  - **Command**: Spawn TECHNICAL-WRITER
  - **Fix**: Add "Related Workflows" section
  - **Verify**: Architect references architecture-review-skill-workflow.md

- [ ] **3.8** Fix TESTING-002: Add tests for 13 untested hooks (~11-16 hours)
  - **Files**: Multiple test files
  - **Command**: Spawn QA + DEVELOPER
  - **Fix**: Create test files for all 13 hooks per issue breakdown
  - **Verify**: `pnpm test` shows 100% hook coverage
  - **Sub-tasks**:
    - CRITICAL hooks (5): enforce-claude-md-update, security-trigger, tdd-check, validate-skill-invocation, agent-context-tracker
    - HIGH hooks (6): format-memory, memory-health-check, memory-reminder, database/filesystem/git-validators
    - MEDIUM hooks (2): process-validators, windows-null-sanitizer

#### Phase 3 Verification Gate

```bash
# Documentation spot checks
grep -q "IRON LAW" .claude/CLAUDE.md
grep -q "Skill Creation Shortcut" .claude/docs/ROUTER_TRAINING_EXAMPLES.md

# Test coverage
pnpm test -- --coverage | grep "hooks"  # Should show 100%
```

**Success Criteria**: All documentation gaps filled, hook test coverage at 100%

---

### Phase 4: Performance & Cleanup (P2-P3)

**Purpose**: Reduce code duplication, improve performance, clean up structure
**Parallel OK**: Partial
**Dependencies**: Phase 3 complete

#### Tasks

- [ ] **4.1** Fix PROC-001: Create hook consolidation workflow (~2 hours)
  - **Files**: `.claude/workflows/operations/hook-consolidation.md`
  - **Command**: Spawn PLANNER
  - **Fix**: Document workflow for consolidating related hooks
  - **Verify**: Workflow file exists and is complete

- [ ] **4.2** Fix PROC-002: Code deduplication process (~4 hours)
  - **Command**: Spawn DEVELOPER
  - **Fix**: Extract shared utilities
  - **Sub-tasks**:
    - HOOK-001: parseHookInput() to `.claude/lib/utils/hook-input.cjs` (~2h)
    - HOOK-002: findProjectRoot() consolidation (~1.5h)
  - **Verify**: 90% code reduction in duplicated functions

- [ ] **4.3** Fix PERF-003: Consolidate reflection/memory hooks (~3-4 hours)
  - **Files**: `.claude/hooks/reflection/`, `.claude/hooks/memory/`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Create unified-reflection-handler.cjs
  - **Verify**: Process spawns reduced from 5 to 2

- [ ] **4.4** Fix PERF-004/005: State cache integration (~3 hours)
  - **Files**: Multiple evolution hooks, loop-prevention.cjs
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add state-cache.cjs integration
  - **Verify**: 83% reduction in state file I/O

- [ ] **4.5** Fix HOOK-004: State cache for evolution-state.json (~2 hours)
  - **Files**: file-placement-guard.cjs, loop-prevention.cjs, research-enforcement.cjs
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add getCachedState() calls
  - **Verify**: ~40% reduction in redundant I/O

- [ ] **4.6** Fix STRUCT-002: Clean up temporary clone directory (~10 min) [QUICK WIN]
  - **Files**: `.claude/context/tmp/`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Delete or add to .gitignore
  - **Verify**: No .git directories in context/tmp/

- [ ] **4.7** Fix SEC-AUDIT-016: Centralize audit logging (~2-3 hours)
  - **Files**: Multiple hooks
  - **Command**: Spawn DEVELOPER
  - **Fix**: Create auditSecurityOverride() function
  - **Verify**: All security overrides use consistent JSON logging

#### Phase 4 Verification Gate

```bash
# Code duplication check
grep -r "function parseHookInput" .claude/hooks/ | wc -l  # Should be 0

# Performance check
# (manual) Hook latency reduced from ~1000ms to ~400ms per Edit/Write
```

**Success Criteria**: Code duplication reduced 90%, hook latency reduced 60%

---

### Phase 5: Medium-Priority Issues (P2)

**Purpose**: Address remaining medium-severity security and process issues
**Parallel OK**: Yes
**Dependencies**: Phase 4 complete

#### Tasks

- [ ] **5.1** Fix SEC-AUDIT-018: Evolution state HMAC signing (~6-10 hours)
  - **Files**: `.claude/context/evolution-state.json`, evolution hooks
  - **Command**: Spawn SECURITY-ARCHITECT + DEVELOPER
  - **Fix**: Add HMAC signature to state file
  - **Verify**: State tampering detected

- [ ] **5.2** Fix SEC-IMPL-001 through SEC-IMPL-006: Implementation task safeguards (~4-6 hours)
  - **Files**: Multiple
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add retry limits, version validation, handler limits, TOCTOU prevention
  - **Verify**: All SEC-IMPL conditions met

- [ ] **5.3** Fix PROC-004: Error recovery standardization (~4 hours)
  - **Command**: Spawn DEVELOPER
  - **Fix**: Standardize error recovery patterns across hooks
  - **Verify**: Consistent fail-closed behavior

- [ ] **5.4** Fix PROC-005: Agent spawning verification (~4 hours)
  - **Command**: Spawn DEVELOPER
  - **Fix**: Create verification hook for TaskUpdate({ status: "completed" })
  - **Verify**: Orphaned tasks detected

- [ ] **5.5** Fix IMP-001/006/007: Library code quality (~6 hours)
  - **Files**: memory-manager.cjs, memory-tiers.cjs, smart-pruner.cjs, workflow-validator.cjs
  - **Command**: Spawn CODE-REVIEWER + DEVELOPER
  - **Fix**: Add JSDoc, error path tests, step schema validation
  - **Verify**: All public APIs documented

- [ ] **5.6** Fix DEBUG-001: Add conditional debug logging (~2-3 hours)
  - **Files**: memory-manager.cjs, memory-tiers.cjs, memory-scheduler.cjs
  - **Command**: Spawn DEVELOPER
  - **Fix**: Replace empty catch with METRICS_DEBUG logging
  - **Verify**: Errors logged when METRICS_DEBUG=true

#### Phase 5 Verification Gate

```bash
pnpm test -- --grep "memory-manager"
pnpm test -- --grep "workflow-validator"
```

**Success Criteria**: All MEDIUM issues resolved

---

### Phase 6: Low-Priority & Backlog (P3)

**Purpose**: Address remaining nice-to-have improvements
**Parallel OK**: Yes
**Dependencies**: None (can run in parallel with other phases)

#### Tasks

- [ ] **6.1** Fix PROC-006 through PROC-010: Process documentation (~8 hours)
  - **Command**: Spawn TECHNICAL-WRITER
  - **Sub-tasks**:
    - PROC-006: Document workflow skills in CLAUDE.md
    - PROC-007: State cache integration guide
    - PROC-008: Test isolation pattern
    - PROC-010: Hook development guide

- [ ] **6.2** Fix HOOK-006 through HOOK-009: Hook quality improvements (~6 hours)
  - **Command**: Spawn DEVELOPER
  - **Sub-tasks**:
    - HOOK-006: Standardize audit logging format
    - HOOK-007: Extract magic numbers to constants
    - HOOK-008: Add JSDoc to all hooks
    - HOOK-009: Standardize module exports

- [ ] **6.3** Fix ARCH-003: Skill catalog count audit (~1 hour)
  - **Command**: Spawn DEVELOPER
  - **Fix**: Verify 426 count matches actual skill directories
  - **Verify**: Catalog header accurate

- [ ] **6.4** Fix STRUCT-001: Move skill workflows (~2 hours)
  - **Files**: `.claude/workflows/`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Move *-skill-workflow.md to workflows/skills/ or keep in root with documentation
  - **Verify**: Consistent placement documented

- [ ] **6.5** Fix NEW-MED-002: Debug logging for dashboard (~1 hour)
  - **Files**: `.claude/lib/memory/memory-dashboard.cjs`
  - **Command**: Spawn DEVELOPER
  - **Fix**: Add METRICS_DEBUG conditional logging to catch blocks
  - **Verify**: Errors visible when debug enabled

**Success Criteria**: All LOW issues addressed

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
  subagent_type: "reflection-agent",
  description: "Session reflection and learning extraction",
  prompt: "You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan, extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created)."
})
```

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| ENFORCEMENT-003 fix breaks workflows | High | Test in warn mode first | `ROUTER_WRITE_GUARD=off` |
| Shell-quote library breaks existing commands | High | Keep custom parser as fallback | Git revert |
| Windows atomic write changes break Linux | Medium | Platform-specific paths | Conditional logic |
| State file HMAC breaks existing sessions | Medium | Migration script | Remove signature check |
| Hook consolidation breaks event handling | High | Keep original hooks for reference | Register original hooks |

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? | Priority |
|-------|-------|-----------|-----------|----------|
| 1 | 5 | 24-37h | Partial | P0 (CRITICAL) |
| 2 | 7 | 17-28h | Yes | P1 (HIGH) |
| 3 | 8 | 17-23h | Yes | P2 (MEDIUM) |
| 4 | 7 | 16-19h | Partial | P2-P3 |
| 5 | 6 | 26-37h | Yes | P2 |
| 6 | 5 | 18h | Yes | P3 (LOW) |
| FINAL | 1 | 1-2h | No | Required |
| **Total** | **39** | **~119-164h** | | |

## Quick Wins Summary (< 1 hour each)

These can be done immediately for fast progress:

1. **2.1** TESTING-003: Add claude to validator (~30 min)
2. **2.5** SEC-REMEDIATION-002: Null byte sanitization (~30 min)
3. **2.7** ROUTING-001: Fix 3 path errors (~10 min)
4. **3.1** DOC-002: IRON LAW section (~30 min)
5. **3.2** DOC-003: Anti-pattern example (~30 min)
6. **3.5** ARCH-004: Deprecated skill ref (~5 min)
7. **4.6** STRUCT-002: Clean temp directory (~10 min)

**Total Quick Wins**: ~2.5 hours for 7 issues

## Agent Assignment Matrix

| Phase | Primary Agent | Supporting Agents |
|-------|--------------|-------------------|
| 1 | SECURITY-ARCHITECT | DEVELOPER |
| 2 | DEVELOPER | SECURITY-ARCHITECT |
| 3 | TECHNICAL-WRITER | QA, DEVELOPER |
| 4 | DEVELOPER | ARCHITECT |
| 5 | DEVELOPER | CODE-REVIEWER, SECURITY-ARCHITECT |
| 6 | TECHNICAL-WRITER | DEVELOPER |
| FINAL | REFLECTION-AGENT | - |

---

**Plan Created**: 2026-01-28
**Total Issues**: 44 (5 CRITICAL, 8 HIGH, 20 MEDIUM, 11 LOW)
**Estimated Effort**: 119-164 hours
**Quick Wins Available**: 7 issues (~2.5 hours)
