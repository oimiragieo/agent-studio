# Known Issues and Blockers

## Summary (as of 2026-01-27)

| Status Category | Count | Notes                                   |
| --------------- | ----- | --------------------------------------- |
| **OPEN**        | 50    | Active issues requiring attention       |
| **RESOLVED**    | 60    | Archived in issues-archive.md           |
| **Won't Fix**   | 2     | Documented as not requiring remediation |
| **Total**       | 112   | All tracked issues                      |

**Historical issues**: See `issues-archive.md` for 60 resolved issues archived on 2026-01-27.

### Priority Breakdown (OPEN Issues)

- **CRITICAL**: 5 (SEC-AUDIT-012, SEC-AUDIT-017, SEC-AUDIT-014, ENFORCEMENT-002, ENFORCEMENT-003)
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

## [ENFORCEMENT-003] Router-First Protocol Is Advisory-Only, Not Blocking (CRITICAL)

- **Date**: 2026-01-27
- **Severity**: CRITICAL
- **Status**: Open
- **Category**: enforcement_gap
- **Description**: All routing hooks (user-prompt-unified.cjs, routing-guard.cjs, skill-creation-guard.cjs) exit with code 0 (allow) in ALL cases. This means the Router-First Protocol is a DOCUMENTATION-ONLY CONVENTION, not a technically enforced constraint. Claude can bypass the protocol at will because no hook actually blocks tool usage without prior Task spawn.
- **Root Cause**: Hooks were designed as advisory recommendations, not blocking constraints. The `process.exit(0)` at the end of each routing hook allows all actions regardless of protocol violations.
- **Detection**: Reflection-Agent diagnosis (Task #1) 2026-01-27
- **Impact**:
  - Router can execute directly without spawning agents
  - Protocol compliance depends entirely on LLM instruction following
  - CLAUDE.md instructions are unenforceable
  - All prior "enforcement" work (ENFORCEMENT-001, ENFORCEMENT-002) is ineffective without blocking exit codes
- **Evidence**:
  - `user-prompt-unified.cjs` line 838: `process.exit(0)` unconditionally
  - `routing-guard.cjs`: Sets state and logs warnings but exits 0
  - No PreToolUse hook returns non-zero for Router blacklist violations
  - **HEADLESS TEST PROOF (2026-01-27)**: QA Agent ran `claude -p "List all TypeScript files using Glob tool"` and Router successfully executed Glob search, proving blocking is not implemented
- **Remediation** (P0 - Urgent):
  1. Modify routing-guard.cjs to exit 2 (block) when Router uses blacklisted tools without Task spawn
  2. Add proper mode checking: if (mode === 'router' && !taskSpawned && isBlacklistedTool) exit(2)
  3. Register blocking hook for PreToolUse(Edit|Write|Bash) matchers
  4. Add integration tests verifying blocking behavior
- **Workaround**: None - protocol cannot be enforced until hooks are modified to block
- **Related Issues**: ENFORCEMENT-001, ENFORCEMENT-002, WORKFLOW-VIOLATION-001, ROUTING-002 (claimed fix but only addressed state reset)
- **Diagnosis Report**: `.claude/context/artifacts/reports/router-diagnosis-2026-01-27.md`
- **Verification Test Report**: `.claude/context/artifacts/reports/routing-fix-verification-2026-01-27.md` (2026-01-27)

---

## [TESTING-003] Claude Command Blocked by bash-command-validator

- **Date**: 2026-01-27
- **Severity**: High
- **Status**: Open
- **Category**: testing_blocker
- **Task**: Task #2 - Router tests
- **Description**: The bash-command-validator.cjs hook blocks the `claude` command itself, preventing headless testing of the framework. Attempting to run `claude --version` or `claude -p "prompt"` returns SEC-AUDIT-017 error: "Unregistered command 'claude'".
- **Root Cause**: SEC-AUDIT-017 security hardening implemented deny-by-default for unregistered commands. The `claude` CLI was never added to the validator's COMMAND_VALIDATORS registry.
- **Impact**: Cannot execute any of the 5 planned headless Router-First Protocol tests:
  1. Memory loading test - BLOCKED
  2. Router behavior test - BLOCKED
  3. Agent spawning test - BLOCKED
  4. Self-check gate test - BLOCKED
  5. Hook execution test - BLOCKED
- **Remediation** (P1 - High Priority):
  1. Add `claude` command to `.claude/hooks/safety/validators/registry.cjs`
  2. Create validator that allows all `claude` arguments (framework self-testing)
  3. Re-run router tests after fix
- **Workaround**: Use `BASH_VALIDATOR_OVERRIDE=warn` to bypass validator for manual testing (defeats security purpose)
- **Report**: `.claude/context/artifacts/reports/router-tests-2026-01-27.md`
- **Related Issues**: SEC-AUDIT-017 (validator deny-by-default implementation)

---

## Reflection Agent Findings - Skill Creation Workflow (2026-01-27)

### [WORKFLOW-VIOLATION-001] Router Bypassing Skill-Creator Workflow

- **Date**: 2026-01-27
- **Severity**: High
- **Status**: Open
- **Category**: routing_violation
- **Description**: Router attempted to create ripgrep skill by directly copying archived files and writing SKILL.md manually, bypassing the entire skill-creator workflow. This skipped ALL mandatory post-creation steps: CLAUDE.md update, skill catalog update, agent assignment, validation, and memory update. The skill would have been invisible to Router and unusable by agents.
- **Root Cause**: Optimization bias - Router perceived workflow as "unnecessary overhead" when archived files existed. This is a systems thinking failure where shortcuts are prioritized over process compliance.
- **Detection**: User intervention caught the violation. No automated safeguards exist.
- **Impact**:
  - Skill not in CLAUDE.md → Invisible to Router
  - Skill not in catalog → Hard to discover
  - Skill not assigned to agents → Never invoked
  - No validation → Broken references undetected
- **Remediation** (P0 - Critical):
  1. Add Gate 4 (Skill Creation Check) to router-decision.md
  2. Update CLAUDE.md Section 7 with visceral "IRON LAW" language
  3. Create skill-creation-guard.cjs hook to block direct SKILL.md writes
  4. Add ASCII box warning to top of skill-creator SKILL.md
  5. Add "Skill Creation Shortcut" anti-pattern to ROUTER_TRAINING_EXAMPLES.md
- **Related Issues**: ROUTER-VIOLATION-001 (resolved), DOC-001 (pointer gaps)
- **Reflection Score**: Iteration 1: 4.6/10 (Critical Fail), Iteration 2: 9.8/10 (Excellent after correction)

### [ENFORCEMENT-001] No Hook to Prevent Direct SKILL.md Writes

- **Date**: 2026-01-27
- **Severity**: High
- **Status**: Open (Partially Implemented)
- **Category**: enforcement_gap
- **Description**: No enforcement hook exists to prevent Router from writing SKILL.md files directly without invoking skill-creator. This allows workflow bypasses that create invisible skills.
- **Root Cause**: Safety hooks focus on security (path traversal, Windows reserved names) but not workflow compliance.
- **Detection**: Manual review during reflection discovered the gap.
- **Remediation** (P0):
  1. Create `.claude/hooks/safety/skill-creation-guard.cjs`
  2. Block Write/Edit tools for `/skills/*/SKILL.md` paths
  3. Check if skill-creator was invoked in recent history
  4. Return BLOCKING error if not invoked
  5. Register hook in settings.json
  6. Add tests to skill-creation-guard.test.cjs
- **Example Hook Logic**:
  ```javascript
  if (tool === 'Write' || tool === 'Edit') {
    const filePath = extractFilePath(input);
    if (filePath.includes('/skills/') && filePath.endsWith('SKILL.md')) {
      const skillCreatorInvoked = checkRecentSkillInvocation();
      if (!skillCreatorInvoked) {
        return {
          action: 'block',
          error:
            'BLOCKING: Cannot write SKILL.md directly. Invoke skill-creator first: Skill({ skill: "skill-creator" })',
        };
      }
    }
  }
  ```
- **Related Issues**: WORKFLOW-VIOLATION-001, ENFORCEMENT-002

### [ENFORCEMENT-002] skill-creation-guard State Tracking Not Implemented (CRITICAL)

- **Date**: 2026-01-27
- **Severity**: CRITICAL
- **Status**: Open (Security Review Complete 2026-01-27)
- **Category**: enforcement_gap
- **Description**: Security audit revealed that `skill-creation-guard.cjs` hook is registered and contains correct logic, BUT the state tracking mechanism is completely non-functional:
  1. State file `.claude/context/runtime/skill-creator-active.json` is NEVER created
  2. `markSkillCreatorActive()` function exists but is NEVER called
  3. No Skill tool hook exists in settings.json to trigger state marking
  4. skill-creator pre-execute.cjs hook contains only TODO placeholder
- **Root Cause**: Incomplete implementation - the guard was designed with state tracking but the integration was never completed.
- **Detection**: Security-Architect audit (Task #5) on 2026-01-27
- **Impact**: The skill-creation-guard provides ZERO protection because `checkSkillCreatorActive()` always returns `{ active: false }`
- **Remediation** (P0 - All Required):
  1. Add Skill tool to settings.json PreToolUse hooks
  2. Create `skill-invocation-tracker.cjs` to call `markSkillCreatorActive()` when skill-creator is invoked
  3. Update skill-creator post-execute.cjs to call `clearSkillCreatorActive()` on completion
  4. Implement specific skill name tracking (not just "active" flag)
  5. Broaden guard scope to block ALL writes to `/skills/*/` directory
- **Effort Estimate**: 8-10 hours
- **Related Issues**: ENFORCEMENT-001, WORKFLOW-VIOLATION-001
- **Audit Report**: `.claude/context/artifacts/reports/router-protocol-audit-2026-01-27.md`
- **Security Review**: `.claude/context/artifacts/reports/remediation-security-review-2026-01-27.md`

### [SEC-REMEDIATION-001] State File Tampering Risk (HIGH)

- **Date**: 2026-01-27
- **Severity**: HIGH
- **Status**: Open
- **Category**: security_gap
- **Description**: Security review of ENFORCEMENT-002 remediation identified that the proposed state file (`skill-creator-active.json`) can be tampered with by an attacker to bypass the skill-creation-guard. Attack vectors include:
  1. Pre-emptive state file creation before SKILL.md write
  2. Time window exploitation (10-minute window is generous)
  3. State file persistence (no automatic cleanup on failures)
- **Root Cause**: State file relies on writable JSON with no integrity verification
- **Detection**: Security-Architect parallel review (Task #3 remediation) 2026-01-27
- **Impact**: Attacker with file system access can bypass skill-creation-guard entirely
- **Remediation** (P0 - Critical):
  1. Implement HMAC signature verification for state file
  2. Reduce time window from 10 minutes to 3 minutes
  3. Add automatic state file cleanup on TTL expiration
- **Effort Estimate**: 2-3 hours
- **Related Issues**: ENFORCEMENT-002
- **Security Review**: `.claude/context/artifacts/reports/remediation-security-review-2026-01-27.md`

### [SEC-REMEDIATION-002] bashPath Null Byte Injection (MEDIUM)

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: Open
- **Category**: security_gap
- **Description**: The proposed `bashPath()` utility in `platform.cjs` lacks null byte sanitization. Null bytes (\0) are a common command injection vector that could be used to truncate paths or bypass validation.
- **Root Cause**: Incomplete input sanitization in proposed implementation
- **Detection**: Security-Architect parallel review (Task #3 remediation) 2026-01-27
- **Impact**: Potential path injection via null bytes
- **Remediation** (P0):
  1. Add `filepath.replace(/\0/g, '')` before path normalization
  2. Add input type and length validation
  3. Log warning for shell metacharacters ($, `, !, etc.)
- **Effort Estimate**: 30 minutes
- **Related Issues**: Windows Bash Path Handling Pattern (learnings.md)
- **Security Review**: `.claude/context/artifacts/reports/remediation-security-review-2026-01-27.md`

### [SEC-REMEDIATION-003] Researcher Agent Data Exfiltration Risk (MEDIUM)

- **Date**: 2026-01-27
- **Severity**: MEDIUM
- **Status**: Open
- **Category**: security_gap
- **Description**: Proposed researcher agent has WebFetch capability without URL allowlist. A malicious prompt could instruct the agent to read sensitive files and POST them to attacker-controlled URLs.
- **Root Cause**: No URL domain allowlist for WebFetch in research context
- **Detection**: Security-Architect parallel review (Task #3 remediation) 2026-01-27
- **Impact**: Potential data exfiltration via WebFetch
- **Remediation** (P1):
  1. Create URL domain allowlist for research (_.exa.ai, _.github.com, \*.arxiv.org)
  2. Block RFC 1918 private network ranges
  3. Implement rate limiting (20 requests/minute)
  4. Document that researcher should NOT have Write/Edit tools
- **Effort Estimate**: 4-6 hours
- **Related Issues**: ADR-037 MCP Tool Access Control
- **Security Review**: `.claude/context/artifacts/reports/remediation-security-review-2026-01-27.md`

### [DOC-002] CLAUDE.md Section 7 Lacks Visceral Workflow Emphasis

- **Date**: 2026-01-27
- **Severity**: Medium
- **Status**: Open
- **Category**: documentation_gap
- **Description**: CLAUDE.md Section 7 (Skill Invocation Protocol) mentions "invoke skill-creator" but doesn't emphasize the BLOCKING nature of post-creation steps. Router interpreted workflow as optional overhead.
- **Root Cause**: Documentation doesn't convey that post-creation steps ARE the value, not just bureaucracy.
- **Remediation** (P1):
  1. Add "IRON LAW" subsection to Section 7
  2. Include before/after violation example
  3. Explain WHY workflow matters (discoverability, integration, validation)
  4. Use visceral language: "INVISIBLE", "NEVER USED", "RUNTIME ERRORS"
- **Proposed Addition**:

  ```markdown
  **IRON LAW**: When creating a skill, you MUST invoke skill-creator FIRST. Direct file creation bypasses critical integration steps and renders the skill INVISIBLE to the Router.

  ❌ WRONG: Copy files, write SKILL.md directly
  ✅ CORRECT: Skill({ skill: "skill-creator" })

  **Why this matters**: Skills not in CLAUDE.md and skill catalog are invisible to Router. Skills not assigned to agents are never used. The workflow exists to prevent these failures.
  ```

- **Related Issues**: WORKFLOW-VIOLATION-001

### [DOC-003] Router Training Examples Missing Skill Creation Anti-Pattern

- **Date**: 2026-01-27
- **Severity**: Low
- **Status**: Open
- **Category**: documentation_gap
- **Description**: `.claude/docs/ROUTER_TRAINING_EXAMPLES.md` doesn't include "Skill Creation Shortcut" anti-pattern. Router needs explicit training that shortcuts are harmful.
- **Remediation** (P1):
  1. Add "Anti-Pattern: Skill Creation Shortcut" section
  2. Show WRONG reasoning (copy files to save time)
  3. Explain why it's wrong (invisible skill, never used)
  4. Show CORRECT reasoning (invoke skill-creator for proper integration)
- **Related Issues**: WORKFLOW-VIOLATION-001, DOC-002

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

## 2026-01-27: CHROME-001 Claude-in-Chrome Native Messaging Host Conflict

- **Date**: 2026-01-27
- **Severity**: Medium
- **Status**: Won't Fix (Known External Bug)
- **Category**: external_dependency
- **Description**: Claude-in-Chrome extension fails to connect when both Claude.app (desktop) and Claude Code are installed. Both applications register competing native messaging hosts at the same path, causing the extension to connect to whichever registered last.
- **Detection**: User reported "Browser extension is not connected" error despite extension being installed and `--chrome` flag enabled.
- **Root Cause**: Native Messaging Host registration conflict between Claude.app and Claude Code. Both write to:
  - Windows: `%APPDATA%\Claude\ChromeNativeHost\com.anthropic.claude_browser_extension.json`
  - macOS: `~/Library/Application Support/Claude/ChromeNativeHost/`
- **GitHub Issues**:
  - [#15336](https://github.com/anthropics/claude-code/issues/15336) - Windows Native Messaging Host not installing
  - [#14894](https://github.com/anthropics/claude-code/issues/14894) - Reconnect extension fails on macOS
  - [#20790](https://github.com/anthropics/claude-code/issues/20790) - Extension connects to Claude.app instead of Claude Code
- **Workaround (macOS)**: Rename Claude.app's native host config to `.disabled` and restart Chrome
- **Workaround (Windows)**: Similar rename approach, not fully tested
- **Alternative**: Use Chrome DevTools MCP (`mcp__chrome-devtools__*`) instead - always available, no extension required
- **Documentation**: Troubleshooting section added to `.claude/skills/chrome-browser/SKILL.md`
- **Resolution**: External bug in Claude Code/Claude.app - requires Anthropic fix

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

---

## [ROUTING-002] Router Uses Blacklisted Tools When User Explicitly Requests Them

- **Date**: 2026-01-27
- **Severity**: High
- **Status**: RESOLVED
- **Resolution Date**: 2026-01-28 (Complete Fix Verified)
- **Category**: routing_violation
- **Task**: Task #1 - Post-fix Router-First Protocol verification
- **Description**: Headless test revealed Router using Glob tool directly when user prompt explicitly mentioned "using Glob". Command: `claude -p "List all TypeScript files in the project using Glob"`. Router executed Glob instead of spawning DEVELOPER agent or refusing blacklisted tool.
- **Root Cause Found**: Two-part issue in state lifecycle management:
  1. **user-prompt-unified.cjs**: 30-minute "active agent context" window preserved `state.taskSpawned=true` across user prompts
  2. **post-task-unified.cjs**: Called `enterAgentMode()` AFTER task completion instead of `exitAgentMode()`, keeping agent mode active
- **Resolution Applied** (COMPLETE - Two-Part Fix):
  1. **Modified `user-prompt-unified.cjs`**: Removed 30-minute window check that skipped state reset ✅
  2. **Added `exitAgentMode()` to `router-state.cjs`**: Resets mode to 'router' while preserving planner/security spawn tracking ✅
  3. **Modified `post-task-unified.cjs`**: Changed `enterAgentMode()` → `exitAgentMode()` after task completion ✅
  4. **Tests Added**: 8 new tests for ROUTING-002 fix (7 unit + 1 integration, all passing) ✅
  5. **Debug Logging**: Added `ROUTER_DEBUG=true` for troubleshooting ✅
- **Files Modified**:
  - `.claude/hooks/routing/user-prompt-unified.cjs` (removed active_agent_context check)
  - `.claude/hooks/routing/post-task-unified.cjs` (changed enterAgentMode() → exitAgentMode())
  - `.claude/hooks/routing/router-state.cjs` (added exitAgentMode() function and export)
  - `.claude/hooks/routing/user-prompt-unified.test.cjs` (added ROUTING-002 tests)
  - `.claude/hooks/routing/routing-guard.test.cjs` (added ROUTING-002 tests)
  - `.claude/hooks/routing/router-state.test.cjs` (added Test 18 - exitAgentMode preserves spawn tracking)
- **Test Results After Fix**: 83/83 tests pass (added 8 new tests)
- **HEADLESS TEST RESULT (2026-01-28)**: Router correctly spawns DEVELOPER agent instead of using Glob directly ✅
- **Verification**: Fix complete and verified via headless test
- **Related Issues**: ENFORCEMENT-003 (clarified - hooks were correct, state was wrong), ROUTING-003 (separate session boundary issue)

---

## [ROUTING-003] router-mode-reset Fails to Detect Session Boundaries (CRITICAL)

- **Date**: 2026-01-28
- **Severity**: CRITICAL
- **Status**: OPEN
- **Category**: state_management
- **Task**: Task #1 - Diagnostic investigation (devops-troubleshooter)
- **Description**: Fresh `claude -p "Use Glob..."` sessions bypass router-self-check because `router-mode-reset.cjs` fails to detect session boundaries. The hook preserves agent state from previous sessions, causing fresh Router prompts to inherit agent mode and bypass blacklisted tool restrictions.
- **Root Cause**: `router-mode-reset.cjs` has a "bug fix" (lines 38-55) that skips state reset if:
  1. Current state shows `mode === 'agent'` AND `taskSpawned === true`
  2. The task was spawned within the last 30 minutes

  **The bug**: This check uses file-based state which **persists across sessions**. The hook cannot distinguish between:
  - An active agent running in the **current** session (should skip reset)
  - **Stale state** from a **previous** session (should reset)

- **Impact**:
  - Fresh sessions inherit agent mode from previous sessions
  - Router can use blacklisted tools (Glob, Grep, etc.) directly
  - Router-self-check is bypassed until 30 minutes elapse
  - Enforcement-003 blocking cannot work if state is wrong
- **Evidence**:
  - State file shows `mode: "agent", taskSpawned: true` after previous session
  - Fresh session UserPromptSubmit fires
  - router-mode-reset.cjs reads stale state
  - Sees recent timestamp (< 30 minutes) → SKIPS reset
  - State remains `mode: "agent"`
  - routing-guard.cjs sees `taskSpawned: true` → ALLOWS blacklisted tools
- **Detection**: Systematic debugging by devops-troubleshooter (Task #1) on 2026-01-28
- **Diagnosis Report**: `.claude/context/artifacts/reports/routing-debug-diagnostic-2026-01-27.md`
- **Files Affected**:
  - `.claude/hooks/routing/router-mode-reset.cjs` (lines 38-55)
  - `.claude/hooks/routing/routing-guard.cjs` (correct logic, wrong state input)
  - `.claude/context/runtime/router-state.json` (persists across sessions)
- **Recommended Fix** (P0 - Critical):
  1. **Add Session ID validation** to router-mode-reset.cjs
  2. Reset state if `currentState.sessionId !== process.env.CLAUDE_SESSION_ID`
  3. Only skip reset if SAME session AND recent task
  4. Alternative: Track active Task subprocesses instead of file state
- **Workaround**: Wait 30 minutes between sessions, or manually delete `router-state.json`
- **Related Issues**: ENFORCEMENT-003 (blocking ineffective with wrong state), ROUTING-002 (symptom of this root cause)
- **Priority**: P0 - Must fix before ENFORCEMENT-003 blocking can work
