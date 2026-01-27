# Framework Deep Dive Analysis Plan

## Executive Summary

Systematic analysis of the .claude framework to identify bugs, security vulnerabilities, pointer gaps, dead code, optimization opportunities, and process improvements. The framework comprises 434 .cjs files, 69 test files, 285+ skills, 46 agents, 15 workflows, 13 schemas, and 77 hooks.

## Objectives

1. Identify and fix security vulnerabilities (fail-open, injection, bypass)
2. Find pointer gaps (references to non-existent files/functions)
3. Detect dead code and unused exports
4. Identify missing error handling patterns
5. Document performance optimization opportunities
6. Propose process improvements

## Phases

### Phase 1: Security Deep Dive
**Dependencies**: None
**Parallel OK**: Yes (all audits can run concurrently)
**Priority**: P0 - Critical
**Estimated Time**: 3-4 hours

#### Tasks
- [ ] **1.1** Audit hooks/routing/ for fail-open vulnerabilities (~30 min)
  - **Files**: `router-state.cjs`, `task-create-guard.cjs`, `security-review-guard.cjs`, `planner-first-guard.cjs`
  - **Command**: `Grep({ pattern: "process\\.exit\\(0\\)", path: ".claude/hooks/routing/" })`
  - **Verify**: All catch blocks fail-closed (exit code 2) or have audit logging

- [ ] **1.2** Audit hooks/safety/ for command injection (~30 min)
  - **Files**: `bash-command-validator.cjs`, `router-write-guard.cjs`, `file-placement-guard.cjs`
  - **Command**: `Grep({ pattern: "execSync|spawnSync", path: ".claude/hooks/safety/" })`
  - **Verify**: All shell calls use `shell: false` and array arguments

- [ ] **1.3** Audit hooks/self-healing/ for bypass vulnerabilities (~30 min)
  - **Files**: `loop-prevention.cjs`, `auto-rerouter.cjs`, `anomaly-detector.cjs`
  - **Command**: `Grep({ pattern: "JSON\\.parse", path: ".claude/hooks/self-healing/" })`
  - **Verify**: All JSON parsing uses safeParseJSON with schema validation

- [ ] **1.4** Audit lib/self-healing/ path validation (~30 min)
  - **Files**: `rollback-manager.cjs`, `validator.cjs`, `dashboard.cjs`
  - **Command**: `Grep({ pattern: "fs\\.(read|write|rm|unlink)", path: ".claude/lib/self-healing/" })`
  - **Verify**: All file operations validate paths within PROJECT_ROOT

- [ ] **1.5** Audit lib/workflow/ for code injection (~30 min)
  - **Files**: `workflow-engine.cjs`, `step-validators.cjs`, `saga-coordinator.cjs`
  - **Command**: `Grep({ pattern: "new Function|eval", path: ".claude/lib/workflow/" })`
  - **Verify**: No dynamic code execution; use predefined condition evaluators

- [ ] **1.6** Check OPEN security issues in issues.md (~15 min)
  - **File**: `.claude/context/memory/issues.md`
  - **Command**: `Grep({ pattern: "Status.*Open|Status.*In Progress", path: ".claude/context/memory/issues.md" })`
  - **Verify**: All security issues have resolution or mitigation

#### Phase 1 Error Handling
If any task fails:
1. Document finding in `.claude/context/memory/issues.md` with severity
2. Continue to next task (security audit is parallel)
3. Aggregate critical findings at phase end

#### Phase 1 Verification Gate
```bash
# All must pass before proceeding
grep -c "Status.*Open.*SEC-" .claude/context/memory/issues.md == 0  # No open security issues
```

---

### Phase 2: Hook Code Quality Audit
**Dependencies**: Phase 1 (security baseline established)
**Parallel OK**: Partial (by hook category)
**Priority**: P1 - High
**Estimated Time**: 4-5 hours

#### Hook Categories to Audit

| Category | Path | File Count | Focus Areas |
|----------|------|------------|-------------|
| routing/ | `.claude/hooks/routing/` | 16 files | State management, guard logic |
| safety/ | `.claude/hooks/safety/` | 13 files | Validators, guards |
| evolution/ | `.claude/hooks/evolution/` | 12 files | State machine, transitions |
| memory/ | `.claude/hooks/memory/` | 6 files | Persistence, extraction |
| reflection/ | `.claude/hooks/reflection/` | 6 files | Queue management |
| self-healing/ | `.claude/hooks/self-healing/` | 6 files | Loop prevention, anomaly detection |
| session/ | `.claude/hooks/session/` | 2 files | Session lifecycle |
| validators/ | `.claude/hooks/safety/validators/` | 8 files | Command validation |

#### Tasks
- [ ] **2.1** Audit routing hooks for state consistency (~45 min)
  - **Focus**: router-state.cjs state transitions, race conditions
  - **Check**: Thread-safe file operations, atomic writes
  - **Verify**: State mutations use atomic-write.cjs

- [ ] **2.2** Audit safety validators for bypass vectors (~45 min)
  - **Focus**: Registry completeness, validator chain
  - **Check**: All dangerous commands have validators
  - **Verify**: No gaps in command coverage

- [ ] **2.3** Audit evolution hooks for state machine integrity (~45 min)
  - **Focus**: EVOLVE state transitions, gate validation
  - **Check**: All transitions are valid, gates are enforced
  - **Verify**: State machine cannot be bypassed

- [ ] **2.4** Audit memory hooks for data consistency (~30 min)
  - **Focus**: Memory file writes, concurrent access
  - **Check**: No data corruption on concurrent writes
  - **Verify**: Memory operations use atomic writes

- [ ] **2.5** Audit reflection hooks for queue integrity (~30 min)
  - **Focus**: Queue file format, entry validation
  - **Check**: JSONL format preserved, no corruption
  - **Verify**: Queue entries have required fields

- [ ] **2.6** Audit self-healing hooks for loop prevention (~30 min)
  - **Focus**: Circuit breaker logic, threshold management
  - **Check**: Loops are detected and broken
  - **Verify**: Circuit breaker cannot be bypassed

#### Phase 2 Verification Gate
```bash
# All hook tests must pass
node --test --test-concurrency=1 ".claude/hooks/**/*.test.cjs"
```

---

### Phase 3: Library Code Quality Audit
**Dependencies**: Phase 1 (security baseline)
**Parallel OK**: Yes (by lib category)
**Priority**: P1 - High
**Estimated Time**: 3-4 hours

#### Library Categories to Audit

| Category | Path | File Count | Focus Areas |
|----------|------|------------|-------------|
| workflow/ | `.claude/lib/workflow/` | 16 files | Engine, validators, CLI |
| memory/ | `.claude/lib/memory/` | 8 files | Manager, tiers, scheduler |
| self-healing/ | `.claude/lib/self-healing/` | 6 files | Rollback, validator, dashboard |
| utils/ | `.claude/lib/utils/` | 8 files | Safe JSON, atomic write, cache |
| integration/ | `.claude/lib/integration/` | 2 files | System registration |

#### Tasks
- [ ] **3.1** Audit workflow engine for execution safety (~45 min)
  - **Files**: `workflow-engine.cjs`, `step-validators.cjs`
  - **Focus**: Condition evaluation, step execution
  - **Check**: No arbitrary code execution
  - **Verify**: Uses SAFE_CONDITIONS evaluator map

- [ ] **3.2** Audit memory manager for data integrity (~45 min)
  - **Files**: `memory-manager.cjs`, `memory-tiers.cjs`, `smart-pruner.cjs`
  - **Focus**: File operations, pruning logic
  - **Check**: No data loss during pruning
  - **Verify**: Atomic writes for all mutations

- [ ] **3.3** Audit self-healing for rollback safety (~45 min)
  - **Files**: `rollback-manager.cjs`, `validator.cjs`
  - **Focus**: Path validation, restore operations
  - **Check**: No path traversal vulnerabilities
  - **Verify**: All paths validated within PROJECT_ROOT

- [ ] **3.4** Audit utils for correctness (~30 min)
  - **Files**: `safe-json.cjs`, `atomic-write.cjs`, `state-cache.cjs`, `project-root.cjs`
  - **Focus**: Schema validation, write safety, cache TTL
  - **Check**: Schemas are complete, TTL works correctly
  - **Verify**: Edge cases handled (empty files, invalid JSON)

#### Phase 3 Verification Gate
```bash
# All lib tests must pass
node --test --test-concurrency=1 ".claude/lib/**/*.test.cjs"
```

---

### Phase 4: Pointer Gap Analysis
**Dependencies**: Phase 2, Phase 3 (code quality baseline)
**Parallel OK**: Yes
**Priority**: P1 - High
**Estimated Time**: 2-3 hours

#### Tasks
- [ ] **4.1** Validate CLAUDE.md agent references (~30 min)
  - **File**: `.claude/CLAUDE.md`
  - **Command**: Extract agent file paths, verify existence
  - **Check**: All 46 agent paths in routing table exist
  - **Verify**: `ls .claude/agents/*/*.md | wc -l == 46`

- [ ] **4.2** Validate agent skill references (~45 min)
  - **Files**: `.claude/agents/**/*.md`
  - **Command**: Extract skills arrays, verify in catalog
  - **Check**: All referenced skills exist in skill-catalog.md
  - **Verify**: No "skill not found" during agent skill resolution

- [ ] **4.3** Validate workflow agent references (~30 min)
  - **Files**: `.claude/workflows/**/*.md`
  - **Command**: Extract agent names from workflows
  - **Check**: All agents referenced in workflows exist
  - **Verify**: Workflow can spawn all referenced agents

- [ ] **4.4** Validate schema references (~30 min)
  - **Files**: `.claude/schemas/*.json`
  - **Command**: Check $ref paths in schemas
  - **Check**: All schema references resolve
  - **Verify**: Schema validation works for all artifact types

- [ ] **4.5** Validate hook imports (~30 min)
  - **Files**: `.claude/hooks/**/*.cjs`
  - **Command**: Extract require() statements
  - **Check**: All imported modules exist
  - **Verify**: No "module not found" errors

#### Phase 4 Verification Gate
```bash
# All pointer validations pass
node .claude/tools/cli/validate-agents.mjs && node .claude/tools/cli/detect-orphans.mjs
```

---

### Phase 5: Tools and CLI Audit
**Dependencies**: Phase 2, Phase 3 (baseline)
**Parallel OK**: Yes
**Priority**: P2 - Medium
**Estimated Time**: 2-3 hours

#### Tool Categories to Audit

| Category | Path | File Count | Focus Areas |
|----------|------|------------|-------------|
| analysis/ | `.claude/tools/analysis/` | 8 files | Project analyzer, repo-rag |
| cli/ | `.claude/tools/cli/` | 5 files | Doctor, validators |
| integrations/ | `.claude/tools/integrations/` | 8 files | GitHub, K8s, AWS, MCP |
| optimization/ | `.claude/tools/optimization/` | 4 files | Token optimizer, thinking |
| runtime/ | `.claude/tools/runtime/` | 4 files | Skills-core, swarm |
| visualization/ | `.claude/tools/visualization/` | 2 files | Diagrams, graphs |

#### Tasks
- [ ] **5.1** Audit analysis tools for path safety (~30 min)
  - **Focus**: File system operations, user input handling
  - **Check**: No path traversal vulnerabilities
  - **Verify**: All file paths validated

- [ ] **5.2** Audit CLI tools for argument injection (~30 min)
  - **Focus**: Command-line argument handling
  - **Check**: No shell injection via arguments
  - **Verify**: Arguments sanitized before use

- [ ] **5.3** Audit integration tools for credential handling (~45 min)
  - **Focus**: AWS, GitHub, K8s credentials
  - **Check**: No credentials in logs or errors
  - **Verify**: Credentials loaded from env only

- [ ] **5.4** Audit runtime tools for execution safety (~30 min)
  - **Focus**: Skills-core execution, swarm coordination
  - **Check**: No arbitrary code execution
  - **Verify**: Skill invocation is safe

#### Phase 5 Verification Gate
```bash
# All tool tests must pass
node --test ".claude/tools/**/*.test.mjs" ".claude/tools/**/*.test.cjs"
```

---

### Phase 6: Performance Analysis
**Dependencies**: Phase 2, Phase 3 (baseline)
**Parallel OK**: Yes
**Priority**: P2 - Medium
**Estimated Time**: 2-3 hours

#### Tasks
- [ ] **6.1** Measure hook execution overhead (~45 min)
  - **Focus**: Pre/PostToolUse hook latency
  - **Method**: Add timing instrumentation to hooks
  - **Metric**: P50, P95, P99 latency per hook type
  - **Target**: < 50ms per hook execution

- [ ] **6.2** Analyze state file I/O patterns (~45 min)
  - **Focus**: router-state.json, evolution-state.json
  - **Method**: Count reads/writes per operation
  - **Metric**: Redundant reads per Edit/Write
  - **Target**: < 3 reads per operation (using cache)

- [ ] **6.3** Evaluate memory usage patterns (~30 min)
  - **Focus**: Memory file sizes, pruning effectiveness
  - **Method**: Measure file sizes, pruning frequency
  - **Metric**: Memory growth rate, pruning efficiency
  - **Target**: Stable memory file sizes

- [ ] **6.4** Profile workflow engine execution (~30 min)
  - **Focus**: Step execution, validation overhead
  - **Method**: Add timing to workflow phases
  - **Metric**: Time per workflow step
  - **Target**: < 100ms per step validation

#### Phase 6 Verification Gate
```bash
# Performance baselines documented
cat .claude/context/artifacts/reports/performance-baseline.md
```

---

### Phase 7: Process Enhancement
**Dependencies**: Phase 4 (pointer gaps fixed)
**Parallel OK**: No (sequential recommendations)
**Priority**: P2 - Medium
**Estimated Time**: 2 hours

#### Tasks
- [ ] **7.1** Document hook consolidation opportunities (~30 min)
  - **Focus**: Redundant hooks, similar logic
  - **Output**: Consolidation recommendations
  - **Impact**: Fewer process spawns, lower latency

- [ ] **7.2** Propose workflow improvements (~30 min)
  - **Focus**: EVOLVE workflow, router-decision workflow
  - **Output**: Improvement recommendations
  - **Impact**: Clearer process, fewer errors

- [ ] **7.3** Identify documentation gaps (~30 min)
  - **Focus**: Undocumented APIs, missing ADRs
  - **Output**: Documentation roadmap
  - **Impact**: Better onboarding, fewer errors

- [ ] **7.4** Create remediation roadmap (~30 min)
  - **Focus**: Priority ordering of fixes
  - **Output**: Prioritized fix list with effort estimates
  - **Impact**: Clear path to improved framework health

#### Phase 7 Verification Gate
```bash
# Process enhancement document created
cat .claude/context/artifacts/reports/process-enhancements.md
```

---

### Phase 8: Test Infrastructure
**Dependencies**: Phase 1, 2, 3 (code quality baseline)
**Parallel OK**: Partial
**Priority**: P2 - Medium
**Estimated Time**: 2-3 hours

#### Tasks
- [ ] **8.1** Audit test coverage for hooks (~45 min)
  - **Focus**: Hooks with missing or incomplete tests
  - **Method**: Compare .cjs to .test.cjs files
  - **Metric**: Test file existence, test count
  - **Target**: 100% hooks have tests

- [ ] **8.2** Audit test coverage for libs (~45 min)
  - **Focus**: Libraries with missing tests
  - **Method**: Compare .cjs to .test.cjs files
  - **Metric**: Test file existence, test count
  - **Target**: 100% libs have tests

- [ ] **8.3** Fix broken or flaky tests (~30 min)
  - **Focus**: Tests that fail intermittently
  - **Method**: Run tests multiple times, identify flakes
  - **Fix**: Add proper isolation, remove shared state
  - **Target**: 0 flaky tests

- [ ] **8.4** Add security test coverage (~30 min)
  - **Focus**: Security-critical code paths
  - **Method**: Add tests for bypass scenarios
  - **Target**: All security issues have regression tests

#### Phase 8 Verification Gate
```bash
# All tests pass with no flakes
node --test --test-concurrency=1 ".claude/**/*.test.cjs" && echo "PASS"
```

---

### Phase 9: Final Report
**Dependencies**: All previous phases
**Parallel OK**: No
**Priority**: P0 - Critical
**Estimated Time**: 2 hours

#### Tasks
- [ ] **9.1** Consolidate security findings (~30 min)
  - **Output**: Security findings summary with severity
  - **Format**: Table with file, line, issue, severity, fix status

- [ ] **9.2** Consolidate code quality findings (~30 min)
  - **Output**: Code quality issues with categories
  - **Format**: Table with file, issue type, recommendation

- [ ] **9.3** Create remediation roadmap (~30 min)
  - **Output**: Prioritized fix list
  - **Format**: P0/P1/P2 with effort estimates

- [ ] **9.4** Update memory files with learnings (~30 min)
  - **Output**: Patterns to learnings.md, decisions to decisions.md
  - **Format**: Standard memory file formats

#### Phase 9 Verification Gate
```bash
# Final report exists with all sections
cat .claude/context/artifacts/reports/framework-analysis-final-report.md
```

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Security issue during audit | High | Document immediately in issues.md | N/A |
| Test failures block progress | Medium | Fix or skip with documentation | `git stash` |
| Performance regression | Medium | Benchmark before/after | Revert changes |
| Analysis scope creep | Medium | Timebox each phase | Defer to next phase |

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? |
|-------|-------|-----------|-----------|
| 1 | 6 | 3-4 hours | Yes |
| 2 | 6 | 4-5 hours | Partial |
| 3 | 4 | 3-4 hours | Yes |
| 4 | 5 | 2-3 hours | Yes |
| 5 | 4 | 2-3 hours | Yes |
| 6 | 4 | 2-3 hours | Yes |
| 7 | 4 | 2 hours | No |
| 8 | 4 | 2-3 hours | Partial |
| 9 | 4 | 2 hours | No |
| **Total** | **41** | **~23-30 hours** | |

## Agent Assignments

| Phase | Primary Agent | Secondary Agent |
|-------|--------------|-----------------|
| 1 | SECURITY-ARCHITECT | CODE-REVIEWER |
| 2 | CODE-REVIEWER | DEVELOPER (fixes) |
| 3 | CODE-REVIEWER | DEVELOPER (fixes) |
| 4 | ARCHITECT | CODE-REVIEWER |
| 5 | CODE-REVIEWER | DEVELOPER (fixes) |
| 6 | DEVELOPER | ARCHITECT |
| 7 | PLANNER | ARCHITECT |
| 8 | QA | DEVELOPER |
| 9 | PLANNER | ARCHITECT |

## Key Focus Areas

### 1. Security Priorities (Phase 1)

Based on `issues.md` analysis, these patterns need verification:

| Pattern | Risk | Files |
|---------|------|-------|
| Fail-open catch blocks | Bypass on error | All hooks with try/catch |
| JSON.parse without schema | State poisoning | State file readers |
| execSync with interpolation | Command injection | Shell execution |
| Path traversal | Arbitrary file access | File system operations |

### 2. Code Quality Priorities (Phase 2, 3)

| Issue Type | Impact | Detection Method |
|------------|--------|------------------|
| Missing error handling | Crashes | Grep for function without try/catch |
| Unused exports | Dead code | AST analysis or grep |
| Hardcoded paths | Portability | Grep for absolute paths |
| Missing tests | Regressions | Compare .cjs to .test.cjs |

### 3. Pointer Gap Priorities (Phase 4)

| Gap Type | Impact | Detection Method |
|----------|--------|------------------|
| Missing agent files | Route failures | Validate CLAUDE.md paths |
| Missing skill files | Skill() errors | Validate skill catalog |
| Invalid imports | Module errors | Parse require() statements |
| Schema ref errors | Validation failures | Validate $ref paths |

### 4. Performance Priorities (Phase 6)

Based on `learnings.md`, known hotspots:

| Hotspot | Current | Target | Fix |
|---------|---------|--------|-----|
| Hook execution | 500-1000ms/Edit | <200ms | Consolidation |
| State file reads | 10-15/Edit | <3/Edit | TTL caching |
| JSON parsing | Each hook | Once/operation | Cache parsed state |

## Success Criteria

1. **Security**: 0 open P0/P1 security issues
2. **Code Quality**: All tests passing, 0 flaky tests
3. **Pointer Gaps**: 0 dangling references
4. **Performance**: Documented baseline with improvement recommendations
5. **Documentation**: Complete remediation roadmap

## Deliverables

1. `.claude/context/artifacts/reports/framework-analysis-final-report.md`
2. `.claude/context/artifacts/reports/security-findings.md`
3. `.claude/context/artifacts/reports/code-quality-findings.md`
4. `.claude/context/artifacts/reports/performance-baseline.md`
5. `.claude/context/artifacts/reports/process-enhancements.md`
6. Updated `.claude/context/memory/learnings.md`
7. Updated `.claude/context/memory/issues.md`

---

*Plan created: 2026-01-26*
*Author: PLANNER Agent*
*Version: 1.0*
