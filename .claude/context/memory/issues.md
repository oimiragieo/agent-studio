# Known Issues and Blockers

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

<!-- Add issues below this line -->

## [2026-01-24] Test Infrastructure Issue

### Issue: Broken npm test command

- **File**: package.json
- **Problem**: References non-existent .claude/tests/test-all-hooks.mjs
- **Impact**: npm test fails completely
- **Status**: RESOLVED (2026-01-26)
- **Resolution**: Fixed by QA Agent (Task #10)
  - Updated test:tools pattern to use recursive globs: ".claude/tools/**/\*.test.mjs" ".claude/tools/**/\*.test.cjs"
  - Updated test:all to run: pnpm test && pnpm test:framework && pnpm test:tools
  - Excluded .test.js files (Jest format) to avoid ESM/CJS conflicts
  - All 203 tests now passing (21 main + 164 framework + 18 tools)

## 2026-01-24: External Integration Workflow Issues

**Source:** Code review of `.claude/workflows/core/external-integration.md`

### Important Issues

**1. Phase 6 Rollback Assumes Uncommitted Changes**

- **Location:** Lines 902-1044 (Rollback Procedure section)
- **Issue:** Uses `git restore` which only works for uncommitted changes
- **Impact:** If agent commits mid-phase, rollback fails to revert changes
- **Fix:** Add git status check, use git revert for commits, git restore for uncommitted
- **Priority:** High
- **Status:** RESOLVED (2026-01-26)
- **Resolution:** Added Rollback Strategy Selection section with decision tree for committed vs uncommitted changes. Now uses git revert for committed changes and git restore for uncommitted. Added safety rules preventing destructive commands like git reset --hard. See lines 906-1044.

**2. Security Review Missing Script Execution Checks**

- **Location:** Lines 403-430 (security review checklist) - NOW ENHANCED
- **Issue:** Checklist does not explicitly cover script command injection, permissions, sandboxing
- **Impact:** Malicious scripts in external skills could execute arbitrary commands
- **Fix:** Add checklist items for script review, command injection, eval/exec, sandboxing
- **Priority:** High
- **Status:** RESOLVED (2026-01-24)
- **Resolution:** Enhanced Phase 4 Security Review with three new security check categories:
  1. **Script Execution Security** - 5 checklist items + 8 dangerous patterns to flag
  2. **Dependency Security** - 7 checklist items for supply chain protection
  3. **Data Exfiltration Prevention** - 8 checklist items for data leakage detection
  - Updated security-architect task prompt (steps 5-8) with explicit instructions
  - Added BLOCKING severity rules: script execution vulns, CVSS>=7.0, data exfil patterns

**3. Version Comparison Logic Unspecified**

- **Location:** Lines 136-170 (Phase 0 pre-check)
- **Issue:** Mentions version comparison but does not specify method or format
- **Impact:** Incorrect artifact status determination (skip needed updates or duplicate integrations)
- **Fix:** Specify semver comparison, fallback to SHA/date/checksum, document method
- **Priority:** High
- **Status:** RESOLVED (2026-01-26)
- **Resolution:** Added Version Comparison Protocol section with 4-priority fallback system: semver (Priority 1) > Git commit SHA (Priority 2) > file modification date (Priority 3) > content checksum (Priority 4). Requires documenting comparison method used in pre-check-results.md. See lines 136-170.

### Minor Issues

**4. Related Workflows Reference Non-Existent File**

- **Location:** Lines 1046-1052
- **Issue:** References "Codebase Integration Workflow" which does not exist
- **Fix:** Update to reference actual workflows: skill-lifecycle.md, feature-development-workflow.md, router-decision.md
- **Priority:** Medium
- **Status:** RESOLVED (2026-01-26)
- **Resolution:** Updated Related Workflows section to reference existing workflows: skill-lifecycle.md, feature-development-workflow.md, router-decision.md. See lines 1046-1052.

---

## [SEC-001] RESOLVED: Bash Command Validator Fail-Open Vulnerability

- **Date**: 2026-01-25
- **Severity**: Critical
- **Status**: Resolved
- **File**: `.claude/hooks/safety/bash-command-validator.cjs`
- **Lines**: 166-173
- **STRIDE Category**: Elevation of Privilege
- **Description**: The bash command validator had a fail-open pattern where catch blocks would call `process.exit(0)`, allowing all commands through on any error. An attacker could craft malformed input to trigger errors and bypass security validation entirely.
- **Resolution**: Changed `process.exit(0)` to `process.exit(2)` (block) in the catch block. Added security rationale comments explaining defense-in-depth principle: "deny by default when security state is unknown."

## [SEC-002] RESOLVED: Shell Validator Inner Command Bypass

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Resolved
- **File**: `.claude/hooks/safety/validators/shell-validators.cjs`
- **Lines**: 157-161
- **STRIDE Category**: Tampering
- **Description**: Shell commands like `bash -c "rm -rf /"` extracted the inner command but did not re-validate it through the validator registry. This allowed dangerous commands to bypass security checks by wrapping them in shell invocations.
- **Resolution**: Added recursive validation using `const { validateCommand } = require('./registry.cjs')` to re-validate extracted inner commands. The inner command is now blocked if any validator rejects it.

## [SEC-003] RESOLVED: Missing Network Command Validators

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Resolved
- **File**: `.claude/hooks/safety/validators/network-validators.cjs` (NEW)
- **STRIDE Category**: Information Disclosure, Tampering, Elevation of Privilege
- **Description**: Dangerous network and system commands had no validators:
  - `curl`/`wget`: Data exfiltration, remote code execution via `curl | bash`
  - `nc`/`netcat`: Reverse shells, data exfiltration
  - `ssh`/`scp`: Remote access, unauthorized file transfer
  - `sudo`: Privilege escalation
  - `rsync`: Data exfiltration to remote hosts
- **Resolution**: Created comprehensive `network-validators.cjs` with:
  - `curl`/`wget`: Allowlist of safe package registry domains, block piping to shell
  - `nc`/`netcat`: Blocked entirely (reverse shell risk)
  - `ssh`/`scp`: Blocked entirely (remote access risk)
  - `sudo`: Blocked entirely (privilege escalation)
  - `rsync`: Block remote syncs, allow local-only operations
- **Registry Update**: All 8 commands registered in `registry.cjs`

## [SEC-004] RESOLVED: Security Review Guard Hook Implemented

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Resolved
- **STRIDE Category**: Elevation of Privilege
- **Description**: Implementation agents (DEVELOPER, QA, DEVOPS) could be spawned without mandatory security review for security-sensitive tasks. This allowed developers to implement security-critical features without security architect oversight.
- **Resolution**: Created `security-review-guard.cjs` PreToolUse(Task) hook that:
  - Blocks DEVELOPER/QA/DEVOPS spawns when `requiresSecurityReview=true` and `securitySpawned=false`
  - Allows SECURITY-ARCHITECT spawns even when security review not done (to enable the review)
  - Supports enforcement modes: block (default), warn, off via `SECURITY_REVIEW_ENFORCEMENT` env var
  - Registered in `.claude/settings.json` for PreToolUse(Task)
- **Test Coverage**: 13 tests (7 unit + 6 integration), all passing
  - ✓ Allow when security review not required
  - ✓ Block DEVELOPER when security review required but not done
  - ✓ Allow DEVELOPER when security review done
  - ✓ Block QA when security review required but not done
  - ✓ Allow SECURITY-ARCHITECT spawn even when security not done
  - ✓ Warn mode allows but shows warning
  - ✓ Off mode always allows
- **Files Created**:
  - `.claude/hooks/routing/security-review-guard.cjs`
  - `.claude/hooks/routing/security-review-guard.test.cjs`
  - `.claude/hooks/routing/security-review-guard.integration.test.cjs`
- **Files Modified**: `.claude/settings.json` (registered hook)

---

## [SEC-005] RESOLVED: Code Injection via new Function() in Workflow Engine

- **Date**: 2026-01-25
- **Severity**: Critical
- **Status**: Resolved
- **Files**:
  - `.claude/lib/workflow/step-validators.cjs` (lines 388, 515)
  - `.claude/lib/workflow/workflow-engine.cjs` (line 571)
- **STRIDE Category**: Elevation of Privilege, Tampering
- **Description**: The workflow engine uses `new Function()` (equivalent to `eval()`) to evaluate gate conditions and assertions. This allows arbitrary JavaScript code execution if workflow definitions contain malicious conditions. An attacker who can inject or modify workflow definitions can execute arbitrary code on the system.
- **Attack Vector**: Malicious `gate.condition` like `"(function(){require('child_process').execSync('whoami')})() || true"`
- **Workaround**: Manually review all workflow definitions before loading; do not allow untrusted workflow files
- **Recommendation**: Replace `new Function()` with a safe expression parser (e.g., `expr-eval`); implement allowlist of permitted operations; validate workflow definitions against strict JSON Schema
- **Resolution** (2026-01-26):
  - Replaced `new Function()` with `SAFE_CONDITIONS` predefined evaluator map
  - Added `safeEvaluateCondition()` function that uses whitelist lookup
  - Created `step-validators.security.test.cjs` with 19 security tests
  - All tests passing (19/19 security + 29/29 validators + 55/55 workflow engine)

## [SEC-006] RESOLVED: Missing Path Validation in Rollback Manager

- **Date**: 2026-01-25
- **Severity**: Critical
- **Status**: Resolved
- **File**: `.claude/lib/self-healing/rollback-manager.cjs`
- **STRIDE Category**: Tampering, Elevation of Privilege
- **Description**: The `RollbackManager` class performs file read/write operations without validating that file paths are within the project root. The `_restoreFile()` method (line 268-269) writes to `fileEntry.path` without validation. The `_deleteCheckpoint()` method (line 438) uses `fs.rmSync(recursive: true)` without path validation.
- **Attack Vector**: Malicious manifest with path `../../../../../../etc/cron.d/malicious` could write files outside PROJECT_ROOT. Malicious checkpointId like `../../important-data` could delete arbitrary directories.
- **Workaround**: Do not use rollback manager with untrusted manifest files
- **Recommendation**: Import and use `validatePath()` from `validator.cjs` before any file operation; validate checkpointId format (alphanumeric with hyphens only)
- **Resolution** (2026-01-26):
  - Added `validatePathWithinRoot()` function to check paths stay within PROJECT_ROOT
  - Added `validateCheckpointId()` to validate alphanumeric + hyphens only
  - Created 16 tests covering path traversal prevention

## [SEC-007] RESOLVED: State File Poisoning via Unvalidated JSON Parsing

- **Date**: 2026-01-25
- **Severity**: Critical
- **Status**: Resolved
- **Files**:
  - `.claude/hooks/routing/router-state.cjs`
  - `.claude/hooks/self-healing/loop-prevention.cjs`
  - `.claude/hooks/self-healing/auto-rerouter.cjs`
  - `.claude/hooks/self-healing/anomaly-detector.cjs`
- **STRIDE Category**: Tampering, Spoofing
- **Description**: All state files are parsed with `JSON.parse()` without schema validation. The spread pattern `{ ...getDefaultState(), ...state }` allows property injection. Malicious state files can alter system behavior, including bypassing security guards.
- **Attack Vector**: Poisoning `router-state.json` with `{"plannerSpawned": true}` bypasses task-create-guard.cjs enforcement
- **Workaround**: Protect state files with filesystem permissions; monitor state files for unexpected modifications
- **Recommendation**: Define JSON schemas for all state files; use `validateOutput()` from `validator.cjs`; implement integrity checks (checksums)
- **Resolution** (2026-01-26):
  - Created `.claude/lib/utils/safe-json.cjs` with schema validation
  - Added `safeParseJSON()` that strips unknown properties and uses defaults
  - Updated `router-state.cjs` with `safeJSONParse()` to prevent prototype pollution
  - Created 17 tests covering JSON schema validation

## [SEC-008] RESOLVED: Security Hooks Fail-Open on Errors

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Resolved
- **Files**:
  - `.claude/hooks/routing/task-create-guard.cjs` (line 162-165)
  - `.claude/hooks/self-healing/loop-prevention.cjs`
  - `.claude/hooks/self-healing/auto-rerouter.cjs` (NOT FIXED - advisory hook, fail-open acceptable)
- **STRIDE Category**: Elevation of Privilege
- **Description**: Security hooks fail open (`process.exit(0)`, allowing action) when errors occur rather than fail-closed. Comment states "Fail open on errors to avoid blocking legitimate work" but this allows security bypass via induced errors.
- **Attack Vector**: Attacker induces errors (malformed input, disk full) to bypass security checks
- **Resolution** (2026-01-26):
  - Changed `task-create-guard.cjs` catch block from `process.exit(0)` to `process.exit(2)` (fail closed)
  - Changed `loop-prevention.cjs` catch block from `process.exit(0)` to `process.exit(2)` (fail closed)
  - Added JSON audit logging for error events
  - Added debug override: `TASK_CREATE_GUARD_FAIL_OPEN=true` and `LOOP_PREVENTION_FAIL_OPEN=true` for debugging
  - Note: `auto-rerouter.cjs` is advisory-only (never blocks), fail-open is acceptable by design

## [SEC-009] RESOLVED: execSync Command Injection Risk

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: RESOLVED
- **Files**:
  - `.claude/tools/runtime/swarm-coordination/swarm-coordination.cjs` (lines 155, 197) - FIXED
  - `.claude/hooks/memory/format-memory.cjs` (lines 78, 87) - FIXED
  - `.claude/skills/skill-creator/scripts/create.cjs` (6 execSync calls) - FIXED
- **STRIDE Category**: Elevation of Privilege, Tampering
- **Description**: Multiple files use `execSync()` with string interpolation that includes external input (paths, arguments). Shell metacharacters in input could execute arbitrary commands.
- **Resolution** (2026-01-26):
  - `swarm-coordination.cjs`: Replaced `execSync()` with `spawnSync()` using array args and `shell: false`
  - `format-memory.cjs`: Replaced `execSync()` with `spawnSync()` using array args and `shell: false`
  - Both files: Added `isPathSafe()` validation function to reject dangerous characters
  - `skill-creator/scripts/create.cjs` (2026-01-26):
    - Replaced ALL 6 `execSync()` calls with `spawnSync()` + `shell: false`
    - Added `isPathSafe()` function with DANGEROUS_CHARS list
    - Added `isUrlSafe()` function for git clone URL validation
    - Fixed calls: formatFile(), formatDirectory(), installSkill() (git clone)
    - Fixed generated code template: runSkill(), validateInputs()
    - Updated documentation example to use spawnSync pattern
- **Verification**: `grep -n execSync create.cjs` returns no matches

## [BUG-001] RESOLVED: Nested .claude Folders Created by process.cwd() Default

- **Date**: 2026-01-25
- **Severity**: Medium
- **Status**: Resolved
- **Files**:
  - `.claude/hooks/memory/session-memory-extractor.cjs` (lines 180, 186, 192)
  - `.claude/lib/memory/memory-manager.cjs` (multiple functions with `projectRoot = process.cwd()`)
- **Description**: Memory manager functions default to `process.cwd()` for project root. When hooks run from within the `.claude` folder (e.g., during tests or certain execution contexts), this creates nested `.claude/context/memory` folders inside `.claude` or `.claude/context/memory`.
- **Evidence Found**:
  1. `.claude/.claude/context/memory/learnings.md` - Auto-Extracted learnings
  2. `.claude/.claude/context/runtime/router-state.json` - Router state
  3. `.claude/.claude/context/self-healing/loop-state.json` - Loop state
  4. `.claude/context/memory/.claude/context/memory/codebase_map.json` - Test file discoveries
- **Resolution (Cleanup)**: Deleted nested folders on 2026-01-25
- **Root Cause**: `session-memory-extractor.cjs` calls `recordPattern()`, `recordGotcha()`, `recordDiscovery()` without passing `projectRoot`, relying on `process.cwd()` default
- **Recommendation**: Add `findProjectRoot()` to `session-memory-extractor.cjs` and pass it to all memory manager calls. Consider making `findProjectRoot()` a shared utility.
- **Resolution** (2026-01-26):
  - Created `.claude/lib/utils/project-root.cjs` with `findProjectRoot()` utility
  - Replaced 38 `process.cwd()` defaults with `findProjectRoot()` in:
    - memory-manager.cjs (11 functions)
    - memory-scheduler.cjs (9 functions)
    - memory-tiers.cjs (11 functions)
    - memory-dashboard.cjs (7 functions)
  - Created 6 tests for project root resolution

## [SEC-010] MITIGATED: Environment Variable Security Overrides

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Mitigated (Audit Logging Added)
- **Files**:
  - `.claude/hooks/safety/file-placement-guard.cjs` - AUDIT LOGGING ADDED
  - `.claude/hooks/safety/router-write-guard.cjs` - AUDIT LOGGING ADDED
  - `.claude/hooks/routing/task-create-guard.cjs` - AUDIT LOGGING ADDED
  - `.claude/hooks/self-healing/loop-prevention.cjs` - AUDIT LOGGING ADDED
- **STRIDE Category**: Elevation of Privilege
- **Description**: Multiple security hooks can be completely disabled via environment variables (FILE_PLACEMENT_OVERRIDE, FILE_PLACEMENT_GUARD=off, ROUTER_WRITE_GUARD=off). While documented, this creates bypass mechanisms.
- **Resolution** (2026-01-26):
  - Added JSON audit logging when security overrides are used
  - Each override logs: hook name, event type, override variable, timestamp, warning message
  - Audit logs output to stderr in JSON format for easy aggregation
  - Overrides remain functional (by design) but are now auditable
- **Audit Log Format**:
  ```json
  {
    "hook": "<hook-name>",
    "event": "security_override_used",
    "override": "<ENV_VAR>=<value>",
    "timestamp": "...",
    "warning": "..."
  }
  ```
- **Remaining Risk**: Overrides still exist by design; recommendation to monitor audit logs in production

## [FIX-001] RESOLVED: File Placement Guard Default Mode

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: Resolved
- **File**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Description**: Default enforcement mode was 'warn' instead of 'block', allowing invalid file placements to bypass enforcement
- **Resolution**: Changed default from 'warn' to 'block'. Added 4 tests for getEnforcementMode(). All 37 tests passing.

## [FIX-002] RESOLVED: Test Parallelization Interference

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: Resolved
- **Description**: Hook tests using shared state files (router-state.json) failed when run in parallel due to test interference
- **Resolution**: Added `test:framework` scripts to package.json that use `--test-concurrency=1` to run tests sequentially. All 164 framework tests now pass.

## [FIX-003] RESOLVED: Retroactive EVOLVE Compliance for Utility Files

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: Resolved
- **Description**: Utility files in .claude/lib/utils/ (project-root.cjs, safe-json.cjs, atomic-write.cjs) were created without going through EVOLVE workflow
- **Resolution**: Added retroactive evolution entry to evolution-state.json documenting the utility module creation with phase completion notes.

---

## EVOLVE Auto-Start Security Review Findings (2026-01-26)

**Task**: #4 - Security review of EVOLVE auto-start feature (Task #2)
**Report**: `.claude/context/artifacts/reports/security-review-evolve-auto-start.md`

### SEC-AS-001: Circuit Breaker State File Tampering

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: RESOLVED (2026-01-26)
- **Description**: Circuit breaker counter stored in evolution-state.json can be tampered with to bypass rate limits
- **STRIDE Category**: Tampering
- **Resolution**: Changed from counter-based to timestamp array-based circuit breaker. Each evolution attempt is tracked as an ISO timestamp. Timestamps are pruned on read - only those within the last hour count. This is more tamper-resistant because attackers cannot simply reset a counter; they must provide valid ISO timestamps within the time window.
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Test Coverage**: 4 new tests in SEC-AS-001 test suite

### SEC-AS-002: Clock Manipulation Rate Limit Bypass

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-26)
- **Description**: Rate limit based on wall-clock time can be bypassed by manipulating system clock
- **STRIDE Category**: Tampering
- **Resolution**: Updated `checkCircuitBreaker()` to filter timestamps with `isNaN()` check and prune old timestamps on read. Combined with timestamp array approach, this mitigates clock manipulation by requiring valid timestamps that fall within the window at time of check.
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`

### SEC-AS-004: Recursive Evolution Spawn Loop

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-26)
- **Description**: Auto-spawned evolution-orchestrator could create artifact that triggers another auto-spawn, causing recursive loop
- **STRIDE Category**: Denial of Service
- **Resolution**: Added `checkSpawnDepth()` function that reads `spawnDepth` from evolution state. If `spawnDepth > 0`, auto-spawn is blocked. The `buildEvolveTriggerData()` function now checks spawn depth and includes it in trigger data. Evolution-orchestrator must increment spawnDepth when entering and decrement when exiting.
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`, `.claude/lib/utils/safe-json.cjs` (added spawnDepth to schema)
- **Test Coverage**: 3 new tests in SEC-AS-004 test suite

### SEC-SF-001: Evolution State JSON.parse Vulnerability

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Description**: evolution-state.json parsed with raw JSON.parse() without prototype pollution protection
- **STRIDE Category**: Tampering, Spoofing
- **Resolution**:
  1. Added `evolution-state` schema to `.claude/lib/utils/safe-json.cjs` with proper defaults
  2. Updated `getEvolutionState()` to use `safeParseJSON()` with the evolution-state schema
  3. The safe parser strips `__proto__`, `constructor`, and unknown properties
  4. Returns safe defaults on parse error (fail closed)
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`, `.claude/lib/utils/safe-json.cjs`
- **Test Coverage**: 4 new tests in SEC-SF-001 test suite

### SEC-IV-001: Unsanitized Path in Spawn Prompt

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-26)
- **Description**: Artifact path passed to evolution-orchestrator spawn prompt without sanitization (shell metacharacters, newlines)
- **STRIDE Category**: Injection
- **Resolution**: Added `sanitizePathForPrompt()` function that:
  1. Strips all dangerous characters: `$`, backticks, `|`, `&`, `;`, `()`, `<>`, `!`, `*`, `?`, `[]`, `{}`, newlines, quotes
  2. Truncates to 500 characters maximum
  3. The `buildEvolveTriggerData()` function now sanitizes artifact path before including in trigger data
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Test Coverage**: 7 new tests in SEC-IV-001 test suite

### SEC-IV-002: Sensitive Path Auto-Spawn

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-26)
- **Description**: No blocklist for sensitive paths (.env, credentials, security hooks) that should never trigger auto-spawn
- **STRIDE Category**: Elevation of Privilege
- **Resolution**:
  1. Added `SENSITIVE_PATH_PATTERNS` constant with patterns for: `.env`, credentials, secrets, passwords, `.pem`, `.key`, safety hooks, routing hooks
  2. Added `isSensitivePath()` function to check paths against blocklist
  3. Updated `buildEvolveTriggerData()` to set `autoStart=false` for sensitive paths
  4. This ensures safety and routing hooks cannot be auto-evolved, preventing privilege escalation
- **Files Modified**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Test Coverage**: 12 new tests in SEC-IV-002 test suite

---

## Security Audit Findings (2026-01-26) - Enforcement Hooks

**Task**: #5 - Security audit of enforcement hooks and guards
**Report**: `.claude/context/artifacts/security-audit-findings.md`

### SEC-AUDIT-001: planner-first-guard.cjs Fail-Open

- **Date**: 2026-01-26
- **Severity**: CRITICAL
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/planner-first-guard.cjs` (lines 263-280)
- **CWE**: CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **STRIDE Category**: Elevation of Privilege
- **Description**: The `main()` function's catch block exits with code 0 (allow), enabling security bypass by inducing errors. An attacker could poison router-state.json with malformed data to trigger an exception and bypass planner-first enforcement.
- **Resolution**: Changed catch block to fail closed with `process.exit(2)`. Added `HOOK_FAIL_OPEN=true` env var for debugging override. Added JSON audit logging for both error and override events.

### SEC-AUDIT-002: security-review-guard.cjs Fail-Open

- **Date**: 2026-01-26
- **Severity**: CRITICAL
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/security-review-guard.cjs` (lines 183-200)
- **CWE**: CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **STRIDE Category**: Elevation of Privilege
- **Description**: The `main()` function's catch block exits with code 0, allowing security-sensitive DEVELOPER/QA/DEVOPS spawns without security review when errors occur.
- **Resolution**: Changed catch block to fail closed with `process.exit(2)`. Added `HOOK_FAIL_OPEN=true` env var for debugging override. Added JSON audit logging for both error and override events.

### SEC-AUDIT-003: router-write-guard.cjs Missing Error Handling

- **Date**: 2026-01-26
- **Severity**: HIGH
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/safety/router-write-guard.cjs`
- **CWE**: CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **STRIDE Category**: Tampering
- **Description**: The `main()` function has no try-catch wrapper. Any thrown error will crash the hook with exit code 1 but loses audit trail.
- **Resolution**: Wrapped entire main() body in try-catch with fail-closed behavior (`process.exit(2)`). Added `ROUTER_WRITE_GUARD_FAIL_OPEN=true` env var for debugging override. Added JSON audit logging for both error and override events.

### SEC-AUDIT-004: task-create-guard.cjs Fail-Open on No Input

- **Date**: 2026-01-26
- **Severity**: HIGH
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/task-create-guard.cjs`
- **CWE**: CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **STRIDE Category**: Elevation of Privilege
- **Description**: When no hook input is provided (e.g., stdin closed prematurely), the guard exits with code 0 allowing all TaskCreate operations.
- **Resolution**: Changed to fail closed with `process.exit(2)` when no input is available. Added `TASK_CREATE_GUARD_ALLOW_NO_INPUT=true` env var for debugging override. Added JSON audit logging for both no-input and override events.

### SEC-AUDIT-005: loop-prevention.cjs TOCTOU Race Condition

- **Date**: 2026-01-26
- **Severity**: HIGH
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/self-healing/loop-prevention.cjs`
- **CWE**: CWE-367 (Time-of-Check to Time-of-Use Race Condition)
- **STRIDE Category**: Tampering
- **Description**: State is read in `getState()`, checked, then modified in separate operations without locking. Concurrent hook executions could both pass budget checks before either records the evolution.
- **Resolution**: Implemented file locking using exclusive file creation (`fs.writeFileSync` with `flag: 'wx'`). Added `acquireLock()` and `releaseLock()` functions. Lock operations use `.lock` suffix files with stale lock detection (5 second timeout) and retry logic (50ms intervals, 2s max wait).

### SEC-AUDIT-006: safe-json.cjs Incomplete Deep Copy

- **Date**: 2026-01-26
- **Severity**: HIGH
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/lib/utils/safe-json.cjs`
- **CWE**: CWE-20 (Improper Input Validation)
- **STRIDE Category**: Tampering
- **Description**: The `safeParseJSON()` function only deep-copies arrays. Nested objects are copied by reference, potentially allowing prototype pollution through nested object manipulation.
- **Resolution**: Added deep copy for ALL nested objects using `JSON.parse(JSON.stringify())`. Both arrays and objects now use this pattern with try-catch fallback to schema defaults on circular reference errors.

### SEC-AUDIT-007: security-review-guard.cjs Silent Fail

- **Date**: 2026-01-26
- **Severity**: MEDIUM
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/security-review-guard.cjs`
- **CWE**: CWE-755 (Improper Handling of Exceptional Conditions)
- **STRIDE Category**: Spoofing
- **Description**: The `readState()` function silently returns permissive defaults (`requiresSecurityReview: false`) on any error.
- **Resolution**: Changed `readState()` to fail closed - now returns `{requiresSecurityReview: true, securitySpawned: false}` on error, forcing security review when state is unknown. Added JSON audit logging for state read errors.

### SEC-AUDIT-008: planner-first-guard.cjs Missing Audit Log for Off Mode

- **Date**: 2026-01-26
- **Severity**: MEDIUM
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/planner-first-guard.cjs`
- **CWE**: CWE-778 (Insufficient Logging)
- **STRIDE Category**: Repudiation
- **Description**: When PLANNER_FIRST_ENFORCEMENT=off, no audit log is emitted, making security bypass undetectable.
- **Resolution**: Added JSON audit log to stderr when `PLANNER_FIRST_ENFORCEMENT=off`. Log includes hook name, event type (`security_override_used`), override variable, timestamp, and warning message. Consistent with SEC-010 audit pattern.

### SEC-AUDIT-009: router-state.cjs Missing Audit Log for Override

- **Date**: 2026-01-26
- **Severity**: MEDIUM
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/routing/router-state.cjs`
- **CWE**: CWE-778 (Insufficient Logging)
- **STRIDE Category**: Repudiation
- **Description**: The `checkWriteAllowed()` function returns success for `ALLOW_ROUTER_WRITE=true` without audit logging.
- **Resolution**: Added JSON audit log to stderr when `ALLOW_ROUTER_WRITE=true`. Log includes hook name, event type (`security_override_used`), override variable, timestamp, and warning message. Consistent with SEC-010 audit pattern.

### SEC-AUDIT-010: file-placement-guard.cjs Unvalidated Command-Line JSON

- **Date**: 2026-01-26
- **Severity**: MEDIUM
- **Status**: RESOLVED (2026-01-26)
- **File**: `.claude/hooks/safety/file-placement-guard.cjs`
- **CWE**: CWE-20 (Improper Input Validation)
- **STRIDE Category**: Tampering
- **Description**: The `parseHookInput()` function directly parses command-line JSON without schema validation.
- **Resolution**: Added `HOOK_INPUT_SCHEMA` constant with expected fields and defaults. Added `validateHookInput()` function that strips dangerous keys (`__proto__`, `constructor`, `prototype`), validates object structure, and deep-copies nested objects. Returns null on parse error (fail closed).

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

## Architecture Review Pointer Gaps (2026-01-26)

**Task**: #2 - Architecture review of agent definitions and routing
**Report**: `.claude/context/artifacts/architecture-review-findings.md`

### [ARCH-001] Missing ROUTER_KEYWORD_GUIDE.md File

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-26)
- **Location**: Referenced in CLAUDE.md Section 3
- **Description**: CLAUDE.md references `.claude/docs/ROUTER_KEYWORD_GUIDE.md` but the file did not exist
- **Resolution**: File now exists at `.claude/docs/ROUTER_KEYWORD_GUIDE.md` (36873 bytes). Contains complete routing keyword documentation extracted from router-enforcer.cjs intentKeywords and INTENT_TO_AGENT mappings.

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

**Task**: Security review of 3 pending implementation tasks
**Report**: `.claude/context/artifacts/security-review-implementation.md`

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

## Library Code Quality Audit (2026-01-26)

### Critical Issues Requiring Immediate Fix

**CRITICAL-001: Missing Input Validation in CLI Interfaces**

- **Files**: memory-manager.cjs, memory-scheduler.cjs, smart-pruner.cjs
- **Risk**: Path traversal, command injection
- **Fix**: Add path.normalize() and traversal checks before file operations
- **Estimated Fix Time**: < 1 hour

**CRITICAL-003: Silent Error Swallowing in Metrics Collection**

- **File**: memory-dashboard.cjs (multiple catch blocks)
- **Risk**: Failures invisible, incorrect health scores
- **Fix**: Add debug logging with METRICS_DEBUG env var
- **Estimated Fix Time**: < 30 minutes

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

**Task**: #3 Phase 2 - Hook Code Quality Audit
**Auditor**: CODE-REVIEWER Agent
**Files Reviewed**: 80 hooks across 8 categories

### Executive Summary

**Overall Assessment:** GOOD - Functionally correct, security-hardened (95% compliance), 44% test coverage
**Ready to Merge**: YES (with follow-up deduplication tasks)

**Key Metrics:**

- Dead Code: 0 instances
- Code Duplication: ~45% (parseHookInput across 40+ files)
- Security Compliance: 95% (5% legacy JSON.parse remaining)
- Test Coverage: 44% (35/80 files)

### Important Issues (Should Fix)

**HOOK-001: Massive Code Duplication - parseHookInput()**

- **Severity**: High
- **Impact**: ~2000 lines duplicated across 40+ hooks
- **Files**: task-create-guard.cjs, session-memory-extractor.cjs, task-completion-reflection.cjs, loop-prevention.cjs, research-enforcement.cjs, +35 more
- **Fix**: Extract to `.claude/lib/utils/hook-input.cjs` shared utility
- **Estimated Effort**: 2 hours
- **Status**: OPEN

**HOOK-002: findProjectRoot() Duplication**

- **Severity**: Medium
- **Impact**: ~200 lines duplicated across 20+ hooks
- **Files**: router-state.cjs, file-placement-guard.cjs, session-memory-extractor.cjs, task-completion-reflection.cjs, loop-prevention.cjs, +15 more
- **Fix**: Use existing `.claude/lib/utils/project-root.cjs` or create if missing
- **Estimated Effort**: 1 hour
- **Status**: OPEN

**HOOK-003: research-enforcement.cjs Missing SEC-007**

- **Severity**: High
- **CWE**: CWE-20 (Improper Input Validation)
- **File**: `.claude/hooks/evolution/research-enforcement.cjs` line 88
- **Issue**: Uses raw JSON.parse for evolution-state.json (prototype pollution risk)
- **Fix**: Replace with `safeParseJSON(content, 'evolution-state')`
- **Estimated Effort**: 30 minutes
- **Status**: OPEN

**HOOK-004: State Cache Integration Incomplete**

- **Severity**: Medium
- **Files**: file-placement-guard.cjs, loop-prevention.cjs, research-enforcement.cjs
- **Issue**: evolution-state.json and loop-state.json read without caching
- **Impact**: ~40% redundant I/O on state files
- **Fix**: Add state-cache.cjs integration to getEvolutionState() and getLoopState()
- **Estimated Effort**: 4 hours
- **Status**: OPEN
- **Note**: router-state.cjs already uses state cache internally, consumers benefit automatically

**HOOK-005: Inconsistent Exit Code - router-write-guard.cjs**

- **Severity**: Low
- **File**: `.claude/hooks/safety/router-write-guard.cjs` line 207
- **Issue**: Uses `process.exit(1)` instead of `process.exit(2)` for blocking
- **Impact**: Inconsistency with all other blocking hooks
- **Fix**: Change to `process.exit(2)`
- **Estimated Effort**: 5 minutes
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

### Recommendations

**Immediate (Priority 1):**

1. Extract parseHookInput() to shared utility (HOOK-001)
2. Apply SEC-007 to research-enforcement.cjs (HOOK-003)
3. Fix router-write-guard.cjs exit code (HOOK-005)

**Short-Term (Priority 2):** 4. Create hook-input.cjs, enforcement-mode.cjs shared utilities 5. Add tests for session-memory-extractor.cjs (HOOK-TEST-001) 6. Apply SEC-007 safe JSON parsing to ALL state file reads

**Medium-Term (Priority 3):** 7. Consolidate related hooks (HOOK-PERF-001) 8. Create HOOK_DEVELOPMENT_GUIDE.md 9. Standardize audit logging format (HOOK-006)

**Long-Term (Priority 4):** 10. Implement evolution-state.json and loop-state.json caching (HOOK-004) 11. Add JSDoc to all exported functions (HOOK-008)

---

## Process Enhancement Findings (2026-01-26)

**Task**: #7 - Phase 6: Process Enhancement - Workflow Improvements
**Analyst**: PLANNER Agent

### [PROC-001] Missing Hook Consolidation Workflow

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Workflow Gap
- **Description**: No documented workflow exists for consolidating related hooks despite HOOK-PERF-001 and PERF-001/002/003 identifying significant consolidation opportunities. Current state: 80 hook files could be reduced to ~55 files, saving 200-400ms per Edit/Write operation.
- **Expected Benefit**: 40-60% latency reduction on Edit/Write operations, improved maintainability
- **Implementation Complexity**: Medium
- **Priority**: P1
- **Recommendation**: Create `.claude/workflows/core/hook-consolidation-workflow.md` with:
  1. Identification phase (group related hooks by trigger and purpose)
  2. Analysis phase (map shared code, identify unique logic)
  3. Design phase (unified hook architecture)
  4. Implementation phase (create unified hook, migrate tests)
  5. Validation phase (verify equivalent behavior)
  6. Cleanup phase (remove deprecated hooks, update settings.json)

### [PROC-002] Missing Code Deduplication Process

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: HOOK-001 identified ~2000 lines of duplicated parseHookInput() code across 40+ files, HOOK-002 identified ~300 lines of duplicated findProjectRoot() code across 20+ files. No standardized process for identifying and resolving code duplication.
- **Expected Benefit**: 90% code reduction, single point of maintenance
- **Implementation Complexity**: Low
- **Priority**: P1
- **Recommendation**: Create deduplication checklist:
  1. Run `grep -r "function parseHookInput" .claude/hooks/ | wc -l` to quantify duplication
  2. Create shared utility in `.claude/lib/utils/hook-input.cjs`
  3. Update all hooks to import from shared utility
  4. Add to code review checklist: "Check for duplicated utilities"

### [PROC-003] Missing Automated Security Review Trigger

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: OPEN
- **Category**: Workflow Gap
- **Description**: SEC-004 implemented security-review-guard.cjs but the system lacks automated detection of security-sensitive changes. Currently relies on manual classification. Security review should auto-trigger for:
  - Changes to `.claude/hooks/safety/` or `.claude/hooks/routing/`
  - Files containing authentication, authorization, crypto keywords
  - Changes to environment variable handling
- **Expected Benefit**: Reduced security review bypass, faster security issue detection
- **Implementation Complexity**: Medium
- **Priority**: P1
- **Recommendation**: Enhance file-placement-guard.cjs or create dedicated hook to:
  1. Detect security-sensitive file patterns
  2. Auto-set `requiresSecurityReview=true` in router state
  3. Log security-sensitive change detection to audit trail

### [PROC-004] Missing Error Recovery Standardization

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: Multiple patterns exist for error recovery across hooks:
  - Some use fail-closed (exit 2) - correct
  - Some use fail-open (exit 0) - incorrect for security hooks
  - Some have no error handling - dangerous
    Inconsistency documented in SEC-008, SEC-AUDIT-001 through SEC-AUDIT-004.
- **Expected Benefit**: Consistent security posture, easier auditing
- **Implementation Complexity**: Low
- **Priority**: P1
- **Recommendation**: Create `.claude/templates/hook-error-handling.md` with:
  1. Standard try-catch pattern for security hooks (fail-closed)
  2. Standard try-catch pattern for advisory hooks (fail-open with logging)
  3. Audit logging format specification
  4. Debug override pattern (HOOK_FAIL_OPEN env var)

### [PROC-005] Missing Agent Spawning Verification

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Process Gap
- **Description**: No automated verification that spawned agents complete their assigned tasks. Agents may fail to call TaskUpdate({ status: "completed" }), leaving tasks perpetually "in_progress". Current mitigation is manual documentation in spawn prompts.
- **Expected Benefit**: Better task tracking, reduced orphaned work
- **Implementation Complexity**: Medium
- **Priority**: P2
- **Recommendation**: Create task-completion-guard.cjs enhancement:
  1. Track task start time
  2. Alert on tasks in_progress > threshold (e.g., 30 minutes)
  3. Optionally auto-fail stale tasks
  4. Generate report of completion rate by agent type

### [PROC-006] Missing Workflow Skill Documentation

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to ARCH-002)
- **Category**: Documentation Gap
- **Description**: 6 workflow files exist but are not documented in CLAUDE.md Section 8.6:
  - security-architect-skill-workflow.md
  - architecture-review-skill-workflow.md
  - consensus-voting-skill-workflow.md
  - swarm-coordination-skill-workflow.md
  - database-architect-skill-workflow.md
  - context-compressor-skill-workflow.md
- **Expected Benefit**: Better discoverability, reduced duplicate workflow creation
- **Implementation Complexity**: Low
- **Priority**: P3
- **Recommendation**: Either add to CLAUDE.md Section 8.6 or create `.claude/workflows/skills/` directory to distinguish skill-specific workflows from core workflows.

### [PROC-007] Missing State Cache Integration for Evolution Hooks

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN (Related to PERF-004)
- **Category**: Performance Gap
- **Description**: Evolution hooks (file-placement-guard, research-enforcement, evolution-state-guard, evolution-audit, quality-gate-validator) all read evolution-state.json independently without caching. State-cache.cjs exists and is integrated into router-state.cjs, but not evolution hooks.
- **Expected Benefit**: 83% reduction in evolution state I/O
- **Implementation Complexity**: Low
- **Priority**: P2
- **Recommendation**: Update evolution hooks to use state-cache.cjs pattern:
  ```javascript
  const { getCachedState, invalidateCache } = require('../../lib/utils/state-cache.cjs');
  const state = getCachedState(EVOLUTION_STATE_PATH, { state: 'idle' });
  ```

### [PROC-008] Missing Test Isolation Pattern for State-Dependent Tests

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to FIX-002)
- **Category**: Testing Gap
- **Description**: Test parallelization caused failures in router-state tests due to shared state files. Current fix uses `--test-concurrency=1` which slows test suite. Better pattern needed for state isolation.
- **Expected Benefit**: Faster test execution, reliable parallel testing
- **Implementation Complexity**: Medium
- **Priority**: P3
- **Recommendation**: Create test helper for state isolation:
  1. `createTestStateDir()` - creates temp dir with unique suffix
  2. `cleanupTestState()` - removes temp dir after test
  3. Update state modules to accept optional basePath parameter
  4. Update tests to use isolated state directories

### [PROC-009] Missing Pre-Commit Hook for Security Compliance

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: OPEN
- **Category**: Automation Gap
- **Description**: Security fixes (SEC-001 through SEC-AUDIT-010) were applied manually. No automated check prevents regression. Git pre-commit hook could enforce:
  - No fail-open catch blocks in security hooks
  - No raw JSON.parse on state files
  - No execSync with string interpolation
- **Expected Benefit**: Prevents security regression, shifts security left
- **Implementation Complexity**: Medium
- **Priority**: P2
- **Recommendation**: Create `.claude/tools/cli/security-lint.cjs`:
  1. Scan hooks for fail-open patterns
  2. Scan for raw JSON.parse on state files
  3. Scan for execSync with template literals
  4. Integrate with git pre-commit hook

### [PROC-010] Missing Documentation for Hooks Development

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to HOOK-008)
- **Category**: Documentation Gap
- **Description**: 80 hooks exist but no developer guide explains:
  - Exit code conventions (0 allow, 2 block)
  - Audit logging format
  - parseHookInput pattern
  - State file access patterns
  - Testing patterns
- **Expected Benefit**: Faster onboarding, consistent hook quality
- **Implementation Complexity**: Low
- **Priority**: P3
- **Recommendation**: Create `.claude/docs/HOOK_DEVELOPMENT_GUIDE.md` covering:
  1. Hook lifecycle and triggers
  2. Exit code conventions
  3. Audit logging standards
  4. Shared utilities (parseHookInput, findProjectRoot, state-cache)
  5. Testing patterns (isolation, mocking, coverage)

---

## Pointer Gap Analysis - Agent-Skill-Workflow Connections (2026-01-26)

**Task**: #4 - Phase 4: Pointer Gap Analysis
**Analyst**: Architect Agent

### Executive Summary

Cross-reference analysis of agent-skill-workflow connections identified 6 pointer gaps (4 broken references, 2 orphaned artifacts). Overall connectivity is good with 95%+ of referenced skills existing. Key finding: ARCH-001 (ROUTER_KEYWORD_GUIDE.md) has been resolved - file now exists.

### Agent-Skill Connection Analysis

**Skills Referenced by Agents (Complete List)**:

- task-management-protocol (38 agents - UNIVERSAL)
- verification-before-completion (35 agents)
- tdd (23 agents)
- debugging (13 agents)
- git-expert (6 agents)
- diagram-generator (8 agents)
- doc-generator (8 agents)
- context-compressor (4 agents)
- code-analyzer (5 agents)
- security-architect (3 agents)
- api-development-expert (4 agents)
- architecture-review (3 agents)
- swarm-coordination (4 agents)
- plan-generator (3 agents)
- sequential-thinking (4 agents)
- Many domain-specific skills (1-2 agents each)

**Skills Confirmed Existing**:
All major skills referenced by agents exist in `.claude/skills/` directory.

### [POINTER-001] Deprecated `writing` Skill Still Referenced

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: OPEN (Related to ARCH-004)
- **File**: `.claude/agents/core/technical-writer.md` line 11
- **Description**: Agent references deprecated `writing` skill alongside correct `writing-skills`
- **Impact**: Redundant skill reference; `writing` redirects to `writing-skills` via alias
- **Recommended Fix**: Remove `writing` from skills list, keep only `writing-skills`
- **Effort**: 5 minutes

### [POINTER-002] `gamedev-expert` Skill Exists - VERIFIED

- **Date**: 2026-01-26
- **Severity**: None
- **Status**: VERIFIED (Skill exists)
- **File**: `.claude/agents/domain/gamedev-pro.md` line 31
- **Evidence**: `.claude/skills/gamedev-expert/SKILL.md` exists (2745 bytes)
- **Result**: No action needed - skill properly connected

### [POINTER-003] `database-expert` Skill Exists - VERIFIED

- **Date**: 2026-01-26
- **Severity**: None
- **Status**: VERIFIED (Skill exists)
- **File**: `.claude/agents/specialized/database-architect.md` line 27
- **Evidence**: `.claude/skills/database-expert/SKILL.md` exists (3524 bytes)
- **Result**: No action needed - skill properly connected

### [POINTER-004] `sentry-monitoring` Skill Exists - VERIFIED

- **Date**: 2026-01-26
- **Severity**: None
- **Status**: VERIFIED (Skill exists)
- **File**: `.claude/agents/specialized/devops-troubleshooter.md` line 26
- **Evidence**: `.claude/skills/sentry-monitoring/SKILL.md` exists (6844 bytes)
- **Result**: No action needed - skill properly connected

### [POINTER-005] `recovery` Skill Exists - VERIFIED

- **Date**: 2026-01-26
- **Severity**: None
- **Status**: VERIFIED (Skill exists)
- **Files**:
  - `.claude/agents/specialized/devops-troubleshooter.md` line 27
  - `.claude/agents/orchestrators/master-orchestrator.md` line 16
- **Evidence**: `.claude/skills/recovery/SKILL.md` exists (7267 bytes)
- **Result**: No action needed - skill properly connected

### [POINTER-006] Orphaned Skills Not Referenced by Any Agent

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: INFORMATIONAL
- **Description**: Several skills exist but are not referenced in any agent skills list
- **Orphaned Skills Found**:
  - Many specialized rule skills (e.g., `fiber-logging-and-project-structure`, `htmx-*` skills)
  - Framework-specific skills available via Skill() invocation but not pre-loaded
- **Impact**: Skills remain discoverable via skill catalog but not auto-loaded
- **Action**: No action needed - skills are accessible via `Skill()` tool invocation

### Agent-Workflow Connection Analysis

**Workflows Referenced by Agents**:

- Most agents do not directly reference workflows in frontmatter
- Workflows are invoked via Router based on task type (see `router-decision.md`)
- Core workflows (router-decision.md, skill-lifecycle.md) are properly connected

### Skill-Workflow Dependencies

**No Circular Dependencies Found**: Cross-reference analysis confirmed no circular skill-workflow dependencies.

### Summary Statistics

| Metric                  | Count                                         |
| ----------------------- | --------------------------------------------- |
| Total Agents            | 46                                            |
| Total Skills Referenced | 85+ unique                                    |
| Missing Skills          | 0 (all verified to exist)                     |
| Deprecated References   | 1 (POINTER-001 - `writing` skill)             |
| Orphaned Skills         | Many (by design - available via Skill() tool) |
| Circular Dependencies   | 0                                             |
| ARCH Issues Resolved    | 1 (ARCH-001)                                  |

### Recommended Priority

1. **Low**: Remove deprecated `writing` reference (POINTER-001) - 5 minutes
2. **Low**: Update ARCH-004 status to reflect `writing` has alias to `writing-skills`

### Overall Assessment

**HEALTHY** - Agent-skill-workflow connections are well-maintained:

- All referenced skills exist
- ARCH-001 (ROUTER_KEYWORD_GUIDE.md) has been resolved
- Only one deprecated reference found (minor)
- No circular dependencies
- No broken pointers

---

## Performance Optimization Analysis (2026-01-26)

**Task**: #6 - Phase 5: Performance Optimization - Hook Consolidation and Cache Integration Analysis
**Analyst**: Developer Agent (Performance Focus)

### Executive Summary

This analysis identifies performance optimization opportunities across the .claude framework infrastructure, specifically focusing on:

1. Hook consolidation to reduce process spawn overhead
2. State cache integration to reduce redundant I/O
3. Code deduplication to improve maintainability
4. Critical fixes for security and reliability

**Overall Performance Estimate**: 50-60% latency reduction achievable for Edit/Write operations

---

### [PERF-001] Hook Consolidation - Routing Guards

**Current State:**

- 5 routing guard hooks fire on PreToolUse(Task): task-create-guard.cjs, planner-first-guard.cjs, security-review-guard.cjs, documentation-routing-guard.cjs, router-self-check.cjs
- Each hook spawns a separate Node.js process (~50-100ms startup)
- All 5 hooks read the same router-state.json file
- Total overhead: ~500-1000ms per Task spawn

**Target State:**

- Single unified-routing-guard.cjs combining all routing checks
- One process spawn for all routing validation
- Single state file read (already cached by router-state.cjs)

**Estimated Improvement:**

- Process spawns: 5 -> 1 (80% reduction)
- Latency: 500ms -> 100ms (80% reduction)
- I/O calls: 15 -> 3 (80% reduction)

**Effort**: 4-6 hours

**Implementation Notes:**

- All hooks share: parseHookInput(), routerState.getState(), enforcement mode pattern
- Each hook has unique validation logic that should be preserved as functions
- Exit codes must remain consistent (0 allow, 2 block)

---

### [PERF-002] Hook Consolidation - Evolution Guards

**Current State:**

- 5 evolution hooks fire on PreToolUse(Edit/Write): evolution-state-guard.cjs, conflict-detector.cjs, quality-gate-validator.cjs, research-enforcement.cjs, evolution-trigger-detector.cjs
- Each reads evolution-state.json independently (no caching)
- Total overhead: ~300-500ms per Edit/Write

**Target State:**

- Single unified-evolution-guard.cjs
- Shared evolution state read with state-cache.cjs integration
- Combines state validation, conflict detection, quality gates, research checks

**Estimated Improvement:**

- Process spawns: 5 -> 1 (80% reduction)
- Latency: 300ms -> 80ms (73% reduction)

**Effort**: 4-6 hours

---

### [PERF-003] Hook Consolidation - Reflection/Memory Hooks

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

**Current State (from HOOK-004):**

- `.claude/hooks/safety/file-placement-guard.cjs` - getEvolutionState() reads without caching
- `.claude/hooks/evolution/research-enforcement.cjs` - reads evolution-state.json without caching
- `.claude/hooks/evolution/evolution-state-guard.cjs` - getEvolutionState() without caching
- `.claude/hooks/evolution/evolution-audit.cjs` - reads without caching
- `.claude/hooks/evolution/quality-gate-validator.cjs` - reads without caching

**Files Reading evolution-state.json Without Caching:**

1. file-placement-guard.cjs (line 173)
2. research-enforcement.cjs (line 88)
3. evolution-state-guard.cjs (line 110)
4. evolution-audit.cjs (line varies)
5. quality-gate-validator.cjs (line varies)
6. evolution-trigger-detector.cjs (line varies)

**Target State:**

- All evolution hooks use getCachedState() from state-cache.cjs
- Single read per TTL window (1 second default)

**Estimated Improvement:**

- I/O reduction: 5-6 reads -> 1 read per TTL (83% reduction)
- Latency per hook: ~10ms -> ~2ms

**Implementation:**

```javascript
// Before (each hook)
const content = fs.readFileSync(EVOLUTION_STATE_PATH, 'utf8');
const state = JSON.parse(content);

// After (shared cached read)
const { getCachedState } = require('../../lib/utils/state-cache.cjs');
const state = getCachedState(EVOLUTION_STATE_PATH, { state: 'idle' });
```

**Effort**: 2 hours

---

### [PERF-005] State Cache Integration - loop-state.json

**Current State:**

- `.claude/hooks/self-healing/loop-prevention.cjs` - getState() reads synchronously with locking
- File locking adds ~100-200ms overhead per read

**Target State:**

- Use state-cache.cjs with TTL for frequently-read state
- Keep file locking only for writes (already atomic)

**Estimated Improvement:**

- Read latency: 100-200ms -> 10ms (when cached)
- Note: Write operations must remain locked for concurrency safety

**Effort**: 1 hour

---

### [PERF-006] Code Deduplication - parseHookInput()

**Current State (from HOOK-001):**

- ~40 files contain nearly identical parseHookInput() function
- ~50 lines x 40 files = 2000 duplicated lines
- Patterns vary slightly (timeout values, error handling)

**Files with parseHookInput() Duplication:**

1. task-create-guard.cjs (lines 36-90)
2. planner-first-guard.cjs (lines 79-133)
3. security-review-guard.cjs (lines 87-141)
4. evolution-state-guard.cjs (lines 155-192)
5. loop-prevention.cjs (lines 653-695)
6. research-enforcement.cjs (lines 43-95)
7. task-completion-reflection.cjs
8. error-recovery-reflection.cjs
9. session-end-reflection.cjs
10. session-memory-extractor.cjs
11. (30+ more hooks)

**Target State:**

- Create `.claude/lib/utils/hook-input.cjs` with:
  - parseHookInput(options) - stdin/argv JSON parsing
  - validateHookInput(input, schema) - schema validation
  - getToolInput(hookInput) - extract tool_input safely

**Estimated Improvement:**

- Code reduction: 2000 lines -> 200 lines (90% reduction)
- Maintenance: Single point of change for input handling
- Testing: Single test file for shared utility

**Effort**: 3-4 hours

---

### [PERF-007] Code Deduplication - findProjectRoot()

**Current State (from HOOK-002):**

- ~20 files contain findProjectRoot() function
- ~15 lines x 20 files = 300 duplicated lines
- `.claude/lib/utils/project-root.cjs` already exists but not used in hooks

**Files with findProjectRoot() Duplication:**

1. router-state.cjs (lines 69-78)
2. file-placement-guard.cjs
3. evolution-state-guard.cjs (lines 62-71)
4. loop-prevention.cjs (lines 80-89)
5. research-enforcement.cjs
6. session-memory-extractor.cjs
7. (14+ more hooks)

**Target State:**

- All hooks import from `.claude/lib/utils/project-root.cjs`
- Remove duplicated findProjectRoot() functions

**Estimated Improvement:**

- Code reduction: 300 lines -> 20 lines (93% reduction)
- Consistency: Single source of truth for project root

**Effort**: 1.5 hours

---

### [PERF-008] Critical Fix - Silent Error Swallowing in Metrics

**Location (from CRITICAL-003):**

- File: `.claude/lib/memory/memory-dashboard.cjs`
- Multiple catch blocks with empty or minimal handling

**Current State:**

```javascript
} catch (e) {
  // Empty catch or console.error only
}
```

**Target State:**

```javascript
} catch (e) {
  if (process.env.METRICS_DEBUG === 'true') {
    console.error(JSON.stringify({
      module: 'memory-dashboard',
      error: e.message,
      stack: e.stack
    }));
  }
  // Return safe default
}
```

**Impact:**

- Debugging: Errors visible when METRICS_DEBUG=true
- Production: Silent failure with safe defaults (current behavior)

**Effort**: 30 minutes

---

### [PERF-009] Critical Fix - Path Traversal in CLI

**Location (from CRITICAL-001):**

- Files: memory-manager.cjs, memory-scheduler.cjs, smart-pruner.cjs
- Functions accepting file paths without validation

**Current State:**

```javascript
function readMemoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // No path validation
}
```

**Target State:**

```javascript
function readMemoryFile(filePath) {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(PROJECT_ROOT, normalized);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error('Path traversal detected');
  }
  const content = fs.readFileSync(resolved, 'utf8');
}
```

**Impact:**

- Security: Prevents ../../../etc/passwd style attacks
- Compatibility: No behavior change for legitimate paths

**Effort**: 1 hour

---

### Optimization Priority Matrix

| ID       | Optimization                    | Impact                     | Effort | Priority |
| -------- | ------------------------------- | -------------------------- | ------ | -------- |
| PERF-001 | Routing Guard Consolidation     | High (80% spawn reduction) | 4-6h   | **P1**   |
| PERF-006 | parseHookInput() Deduplication  | High (maintainability)     | 3-4h   | **P1**   |
| PERF-004 | evolution-state.json Caching    | Medium (83% I/O reduction) | 2h     | **P1**   |
| PERF-002 | Evolution Guard Consolidation   | High (73% latency)         | 4-6h   | **P2**   |
| PERF-007 | findProjectRoot() Deduplication | Medium (maintainability)   | 1.5h   | **P2**   |
| PERF-009 | CLI Path Traversal Fix          | High (security)            | 1h     | **P2**   |
| PERF-003 | Reflection/Memory Consolidation | Medium (60% spawn)         | 3-4h   | **P3**   |
| PERF-005 | loop-state.json Caching         | Low (single file)          | 1h     | **P3**   |
| PERF-008 | Metrics Error Logging           | Low (debugging)            | 30m    | **P3**   |

---

### Implementation Roadmap

**Phase 1: Quick Wins (1 day)**

1. PERF-006: Create hook-input.cjs shared utility
2. PERF-007: Consolidate findProjectRoot() usage
3. PERF-008: Add debug logging to metrics

**Phase 2: Cache Integration (0.5 days)**

1. PERF-004: Add state-cache to evolution hooks
2. PERF-005: Add state-cache to loop-prevention

**Phase 3: Hook Consolidation (2-3 days)**

1. PERF-001: Create unified-routing-guard.cjs
2. PERF-002: Create unified-evolution-guard.cjs
3. Update settings.json hook registrations

**Phase 4: Security Fixes (0.5 days)**

1. PERF-009: Add path traversal protection

---

### Total Estimated Savings

| Metric                     | Before      | After     | Improvement |
| -------------------------- | ----------- | --------- | ----------- |
| Edit/Write latency         | ~1000ms     | ~400ms    | **60%**     |
| Task spawn latency         | ~500ms      | ~100ms    | **80%**     |
| State file I/O             | 15-20 reads | 3-5 reads | **75%**     |
| Duplicated code lines      | ~2300       | ~220      | **90%**     |
| Hook processes per session | 80+         | ~35       | **56%**     |

---

### Related Issues

- HOOK-001: parseHookInput duplication (incorporated as PERF-006)
- HOOK-002: findProjectRoot duplication (incorporated as PERF-007)
- HOOK-004: State cache integration (incorporated as PERF-004, PERF-005)
- HOOK-PERF-001: Hook consolidation (expanded as PERF-001, PERF-002, PERF-003)
- CRITICAL-001: CLI path traversal (incorporated as PERF-009)
- CRITICAL-003: Silent error swallowing (incorporated as PERF-008)

---

## Security Review - Phase 1 (2026-01-26)

**Reviewer**: SECURITY-ARCHITECT Agent
**Review Type**: Pre-Implementation Security Assessment
**Scope**: Phase 1 Critical Security & Reliability Issues (SEC-AUDIT-011, HOOK-003, CRITICAL-001, CRITICAL-003, HOOK-005)

### Executive Summary

Phase 1 targets 5 issues with significant security implications. This review provides security guidance for the DEVELOPER implementing these fixes. Overall risk mitigation strategy is sound; implementation details require careful attention.

---

### 1. SEC-AUDIT-011 Review: Non-Atomic State Operations in router-state.cjs

**Current State Analysis:**

The file at `C:\dev\projects\agent-studio\.claude\hooks\routing\router-state.cjs` has ALREADY implemented significant security improvements:

- **Lines 26-27**: Uses `atomicWriteJSONSync()` from atomic-write.cjs for crash-safe writes
- **Lines 98-138**: Defines `MAX_RETRIES=5` and `BASE_BACKOFF=100` for optimistic concurrency
- **Lines 207-228**: Implements `validateVersion()` with security safeguards against NaN, Infinity, negative values
- **Lines 286-331**: Implements `saveStateWithRetry()` with full optimistic concurrency control

**Security Assessment: PARTIALLY RESOLVED**

The atomic write pattern is correctly implemented using temp file + rename (POSIX atomic). However, there is a TOCTOU (Time-of-Check-Time-of-Use) window in `saveStateWithRetry()`:

```javascript
// Lines 295-315: The window between step 5 (recheck) and step 6 (write) is vulnerable
const recheck = loadStateFromFile();
const recheckVersion = validateVersion(recheck.version);
if (recheckVersion !== currentVersion) {
  continue; // Conflict detected, retry
}
// TOCTOU WINDOW HERE - another process could write between check and write
atomicWriteJSONSync(STATE_FILE, merged);
```

**Risk Level**: LOW (single-user CLI tool, not high-concurrency server)

**Recommendations for DEVELOPER**:

1. The current implementation is ACCEPTABLE for the use case (CLI tool)
2. If stricter guarantees needed in future, use file locking via `proper-lockfile` npm package
3. Consider adding audit logging when retry exhaustion occurs (currently throws, but could leak)

**Verification Command (for DEVELOPER)**:

```bash
node -e "const rs = require('./.claude/hooks/routing/router-state.cjs'); console.log('MAX_RETRIES:', rs.MAX_RETRIES); console.log('saveStateWithRetry exists:', typeof rs.saveStateWithRetry === 'function');"
```

---

### 2. HOOK-003 Review: research-enforcement.cjs Missing SEC-007

**Current State Analysis:**

File: `C:\dev\projects\agent-studio\.claude\hooks\evolution\research-enforcement.cjs`

**Line 88** contains the vulnerability:

```javascript
return JSON.parse(content);
```

This raw JSON.parse is susceptible to prototype pollution via malicious JSON like:

```json
{ "__proto__": { "isAdmin": true } }
```

**Risk Level**: HIGH for evolution system integrity

**Required Fix Pattern**:

The fix should import `safeParseJSON` from safe-json.cjs which already has the 'evolution-state' schema defined (lines 57-72 of safe-json.cjs). The correct import would be:

```javascript
const { safeParseJSON } = require('../../lib/utils/safe-json.cjs');
```

And replace line 88:

```javascript
// BEFORE (vulnerable):
return JSON.parse(content);

// AFTER (safe):
return safeParseJSON(content, 'evolution-state');
```

**Security Controls in safe-json.cjs**:

- Creates objects with `Object.create(null)` to prevent prototype chain pollution
- Only copies known schema properties (strips **proto**, constructor, prototype)
- Uses deep copy via JSON.parse(JSON.stringify()) for nested objects
- Returns schema defaults on parse error (fail-safe)

**Verification Command (for DEVELOPER)**:

```bash
node -e "require('./.claude/hooks/evolution/research-enforcement.cjs'); console.log('import ok')" && grep -n "safeParseJSON" .claude/hooks/evolution/research-enforcement.cjs
```

---

### 3. CRITICAL-001 Review: Path Traversal Validation

**Current State Analysis:**

Files affected:

- `C:\dev\projects\agent-studio\.claude\lib\memory\memory-manager.cjs`
- `C:\dev\projects\agent-studio\.claude\lib\memory\memory-scheduler.cjs`
- `C:\dev\projects\agent-studio\.claude\lib\memory\smart-pruner.cjs`

These files use `PROJECT_ROOT` from project-root.cjs (good), but functions like `getMemoryDir(projectRoot)` accept external `projectRoot` parameter without validation.

**Attack Vector**:

```javascript
// Malicious call could escape memory directory:
getMemoryDir('../../etc');
// Results in: ../../etc/.claude/context/memory
```

**Required Fix Pattern**:

Create or use a path validation utility:

```javascript
/**
 * Validate path is within PROJECT_ROOT
 * @param {string} targetPath - Path to validate
 * @param {string} projectRoot - Expected root directory
 * @returns {boolean} True if path is safe
 */
function validatePathWithinRoot(targetPath, projectRoot) {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(projectRoot);
  return (
    normalizedTarget.startsWith(normalizedRoot + path.sep) || normalizedTarget === normalizedRoot
  );
}
```

Apply to all functions accepting external paths:

- `saveSession(insights, projectRoot)`
- `checkAndArchiveLearnings(projectRoot)`
- `getMemoryDir(projectRoot)`
- All scheduler and pruner functions with `projectRoot` parameter

**Risk Level**: MEDIUM (CLI tool, but memory contains sensitive context)

**OWASP Reference**: A01:2021-Broken Access Control, CWE-22 (Path Traversal)

**Verification Command (for DEVELOPER)**:

```bash
pnpm test:framework -- --test-name-pattern "path"
```

---

### 4. CRITICAL-003 Review: Silent Error Swallowing

**Current State Analysis:**

File: `C:\dev\projects\agent-studio\.claude\lib\memory\memory-dashboard.cjs`

Multiple catch blocks with empty or minimal handling (lines 82-83, 99-101, 113-114):

```javascript
} catch (e) { /* ignore */ }
```

**Risk Level**: MEDIUM - Silent failures lead to incorrect health scores, masking real issues

**Required Fix Pattern**:

Replace empty catches with conditional debug logging:

```javascript
} catch (e) {
  if (process.env.METRICS_DEBUG === 'true') {
    console.error(JSON.stringify({
      module: 'memory-dashboard',
      function: 'getFileSizeKB', // or relevant function name
      error: e.message,
      path: filePath, // relevant context
      timestamp: new Date().toISOString()
    }));
  }
}
```

**Key Requirements**:

1. Use JSON format to stderr (consistent with hook audit logging)
2. Never log sensitive data (file contents, credentials)
3. Include context (function name, file path, timestamp)
4. Make debug logging opt-in via `METRICS_DEBUG` env var

**Verification Command (for DEVELOPER)**:

```bash
METRICS_DEBUG=true node -e "require('./.claude/lib/memory/memory-dashboard.cjs')" 2>&1 | head -5
```

---

### 5. HOOK-005 Review: Exit Code Inconsistency

**Current State Analysis:**

File: `C:\dev\projects\agent-studio\.claude\hooks\safety\router-write-guard.cjs`

**Line 207** (in block mode):

```javascript
process.exit(1);
```

However, **line 236** (fail-closed error handling) correctly uses:

```javascript
process.exit(2);
```

**Hook Exit Code Convention**:

- `0` = Allow operation (continue)
- `2` = Block operation (halt execution)
- `1` = Generic error (ambiguous in hook context)

**Risk Level**: LOW - Inconsistency may cause confusion but both codes block

**Required Fix**:

Change line 207 from `process.exit(1)` to `process.exit(2)` for consistency with:

- Line 236 (same file, fail-closed behavior)
- research-enforcement.cjs line 215 (blocking exit)
- Other hooks using exit(2) for blocking

**Verification Command (for DEVELOPER)**:

```bash
grep -n "process.exit(1)" .claude/hooks/safety/router-write-guard.cjs
# Should return 0 lines after fix

grep -n "process.exit(2)" .claude/hooks/safety/router-write-guard.cjs
# Should show lines 207 and 236
```

---

### Security Review Summary

| Issue         | Severity | Current State                                     | Required Action                                  |
| ------------- | -------- | ------------------------------------------------- | ------------------------------------------------ |
| SEC-AUDIT-011 | LOW      | Partially fixed (atomic write done, minor TOCTOU) | Accept current implementation                    |
| HOOK-003      | HIGH     | Open (raw JSON.parse)                             | Import safeParseJSON with evolution-state schema |
| CRITICAL-001  | MEDIUM   | Open (no path validation)                         | Add validatePathWithinRoot() checks              |
| CRITICAL-003  | MEDIUM   | Open (silent catches)                             | Add METRICS_DEBUG conditional logging            |
| HOOK-005      | LOW      | Open (exit(1) vs exit(2))                         | Change line 207 to exit(2)                       |

### Additional Security Observations

1. **Positive Finding**: router-state.cjs already implements SEC-007 safe JSON parsing via `safeJSONParse()` (lines 41-66) and `sanitizeParsedState()` (lines 172-185). Good defense-in-depth.

2. **Positive Finding**: atomic-write.cjs correctly implements temp file + rename pattern, essential for crash-safe state management.

3. **Positive Finding**: Fail-closed error handling (SEC-008) is correctly implemented in router-write-guard.cjs (lines 213-236) with audit logging.

4. **Positive Finding**: Security override audit logging (SEC-010) is implemented at lines 156-164 when ROUTER_WRITE_GUARD=off.

5. **Watch Item**: The `recordTaskUpdate()` function (router-state.cjs lines 550-558) still uses simple `saveState()` instead of `saveStateWithRetry()`. This is the specific issue mentioned in SEC-AUDIT-011 (line 393-399 in the plan refers to older line numbers). DEVELOPER should verify if this needs updating.

### Follow-Up Tasks

If DEVELOPER encounters issues or makes design changes:

1. Document in `.claude/context/memory/learnings.md`
2. Update this review section with resolution details
3. Run verification commands before marking complete

---

**Review completed**: 2026-01-26
**Next review**: After Phase 1 implementation complete

---

## [RESOLVED] SEC-007: Safe JSON Parsing

**Date Resolved**: 2026-01-26
**Original Issue**: Raw JSON.parse without prototype pollution protection
**Fix Applied**: safeReadJSON()/safeParseJSON() pattern
**Files Fixed**: dashboard.cjs, system-registration-handler.cjs

## [RESOLVED] SEC-008: Fail-Closed Pattern

**Date Resolved**: 2026-01-26
**Original Issue**: Security hooks exiting 0 on errors (fail-open)
**Fix Applied**: Exit code 2 on all error paths
**Files Fixed**: task-create-guard.cjs, router-write-guard.cjs

## [RESOLVED] SEC-009: Command Injection Prevention

**Date Resolved**: 2026-01-26
**Original Issue**: execSync() with string commands
**Fix Applied**: spawnSync() with array arguments and shell:false
**Files Fixed**: convert.cjs, validate-all.cjs, skills-core.js

## [RESOLVED] PERF-NEW-002: routing-guard.cjs Not Activated

**Date Resolved**: 2026-01-26
**Original Issue**: Hook created but not registered in settings.json
**Fix Applied**: Added to settings.json hooks array
**Result**: 80% Task spawn latency reduction
