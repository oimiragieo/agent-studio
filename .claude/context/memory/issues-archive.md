# Archived Issues

This file contains resolved issues archived from issues.md.
Last archive date: 2026-01-27

**Total Archived Issues**: 60

---

## Archive Index

| Issue ID             | Title                                                        | Date Resolved | Original Severity    |
| -------------------- | ------------------------------------------------------------ | ------------- | -------------------- |
| SEC-WIN-001          | Windows Reserved Device Name Protection Gap                  | 2026-01-27    | HIGH                 |
| SEC-007              | Windows Path Regex Bypass in Filesystem Validators           | 2026-01-27    | HIGH                 |
| ROUTER-VIOLATION-001 | Router Bypassed Protocol Under User Pressure                 | 2026-01-27    | CRITICAL             |
| Test Infrastructure  | Broken npm test command                                      | 2026-01-26    | N/A                  |
| External Integration | Phase 6 Rollback Assumes Uncommitted Changes                 | 2026-01-26    | HIGH                 |
| External Integration | Security Review Missing Script Execution Checks              | 2026-01-24    | HIGH                 |
| External Integration | Version Comparison Logic Unspecified                         | 2026-01-26    | HIGH                 |
| External Integration | Related Workflows Reference Non-Existent File                | 2026-01-26    | MEDIUM               |
| SEC-001              | Bash Command Validator Fail-Open Vulnerability               | 2026-01-25    | CRITICAL             |
| SEC-002              | Shell Validator Inner Command Bypass                         | 2026-01-25    | HIGH                 |
| SEC-003              | Missing Network Command Validators                           | 2026-01-25    | HIGH                 |
| SEC-004              | Security Review Guard Hook Implemented                       | 2026-01-25    | HIGH                 |
| SEC-005              | Code Injection via new Function() in Workflow Engine         | 2026-01-26    | CRITICAL             |
| SEC-006              | Missing Path Validation in Rollback Manager                  | 2026-01-26    | CRITICAL             |
| SEC-007              | State File Poisoning via Unvalidated JSON Parsing            | 2026-01-26    | CRITICAL             |
| SEC-008              | Security Hooks Fail-Open on Errors                           | 2026-01-26    | HIGH                 |
| SEC-009              | execSync Command Injection Risk                              | 2026-01-26    | HIGH                 |
| BUG-001              | Nested .claude Folders Created by process.cwd() Default      | 2026-01-26    | MEDIUM               |
| SEC-010              | Environment Variable Security Overrides                      | 2026-01-26    | HIGH (Mitigated)     |
| FIX-001              | File Placement Guard Default Mode                            | 2026-01-26    | MEDIUM               |
| FIX-002              | Test Parallelization Interference                            | 2026-01-26    | MEDIUM               |
| FIX-003              | Retroactive EVOLVE Compliance for Utility Files              | 2026-01-26    | LOW                  |
| SEC-AS-001           | Circuit Breaker State File Tampering                         | 2026-01-26    | HIGH                 |
| SEC-AS-002           | Clock Manipulation Rate Limit Bypass                         | 2026-01-26    | MEDIUM               |
| SEC-AS-004           | Recursive Evolution Spawn Loop                               | 2026-01-26    | MEDIUM               |
| SEC-SF-001           | Evolution State JSON.parse Vulnerability                     | 2026-01-26    | HIGH                 |
| SEC-IV-001           | Unsanitized Path in Spawn Prompt                             | 2026-01-26    | MEDIUM               |
| SEC-IV-002           | Sensitive Path Auto-Spawn                                    | 2026-01-26    | MEDIUM               |
| SEC-AUDIT-001        | planner-first-guard.cjs Fail-Open                            | 2026-01-26    | CRITICAL             |
| SEC-AUDIT-002        | security-review-guard.cjs Fail-Open                          | 2026-01-26    | CRITICAL             |
| SEC-AUDIT-003        | router-write-guard.cjs Missing Error Handling                | 2026-01-26    | HIGH                 |
| SEC-AUDIT-004        | task-create-guard.cjs Fail-Open on No Input                  | 2026-01-26    | HIGH                 |
| SEC-AUDIT-005        | loop-prevention.cjs TOCTOU Race Condition                    | 2026-01-26    | HIGH                 |
| SEC-AUDIT-006        | safe-json.cjs Incomplete Deep Copy                           | 2026-01-26    | HIGH                 |
| SEC-AUDIT-007        | security-review-guard.cjs Silent Fail                        | 2026-01-26    | MEDIUM               |
| SEC-AUDIT-008        | planner-first-guard.cjs Missing Audit Log for Off Mode       | 2026-01-26    | MEDIUM               |
| SEC-AUDIT-009        | router-state.cjs Missing Audit Log for Override              | 2026-01-26    | MEDIUM               |
| SEC-AUDIT-010        | file-placement-guard.cjs Unvalidated Command-Line JSON       | 2026-01-26    | MEDIUM               |
| POINTER-002          | Workflow Skill References                                    | 2026-01-27    | N/A (FALSE POSITIVE) |
| CONFIG-002           | CLAUDE.md Agent Count Accuracy                               | 2026-01-27    | MEDIUM               |
| ARCH-001             | Missing ROUTER_KEYWORD_GUIDE.md File                         | 2026-01-26    | MEDIUM               |
| PERF-001             | Hook Consolidation - Routing Guards                          | 2026-01-27    | HIGH                 |
| PERF-002             | Hook Consolidation - Evolution Guards                        | 2026-01-27    | MEDIUM               |
| HOOK-003             | research-enforcement.cjs Missing SEC-007                     | 2026-01-26    | HIGH                 |
| HOOK-005             | router-write-guard.cjs Exit Code                             | 2026-01-26    | LOW                  |
| CRITICAL-001         | Path Traversal in memory-manager.cjs                         | 2026-01-26    | MEDIUM               |
| CRITICAL-003         | Silent Error Swallowing                                      | 2026-01-27    | MEDIUM               |
| NEW-CRIT-001         | Unsafe JSON Parsing in anomaly-detector.cjs                  | 2026-01-27    | CRITICAL             |
| NEW-CRIT-002         | Unsafe JSON Parsing in auto-rerouter.cjs                     | 2026-01-27    | CRITICAL             |
| NEW-CRIT-003         | Inconsistent Exit Code in tdd-check.cjs                      | 2026-01-27    | HIGH                 |
| NEW-HIGH-001         | Inconsistent Exit Code in enforce-claude-md-update.cjs       | 2026-01-27    | HIGH                 |
| NEW-HIGH-002         | Missing Safe JSON for Hook Input Parsing                     | 2026-01-26    | HIGH                 |
| NEW-HIGH-003         | Missing Atomic Write in Self-Healing Hooks                   | 2026-01-26    | MEDIUM               |
| SEC-007              | Safe JSON Parsing                                            | 2026-01-26    | HIGH                 |
| SEC-008              | Fail-Closed Pattern                                          | 2026-01-26    | HIGH                 |
| SEC-009              | Command Injection Prevention                                 | 2026-01-26    | HIGH                 |
| PERF-NEW-002         | routing-guard.cjs Not Activated                              | 2026-01-26    | N/A                  |
| DOC-001              | CLAUDE.md Section 1.3 Documents Deprecated Hook Architecture | 2026-01-27    | MEDIUM               |
| DOC-002              | Undocumented Workflows in CLAUDE.md Section 8.6              | 2026-01-27    | MEDIUM               |
| DOC-003              | Hooks Directory Structure Incomplete in Documentation        | 2026-01-27    | LOW                  |
| DOC-004              | lib/ Directory Structure Incomplete                          | 2026-01-27    | LOW                  |
| ATOMIC-001           | Missing Atomic Writes in State-Modifying Hooks               | 2026-01-27    | CRITICAL             |
| SEC-AUDIT-015        | Safe JSON Schema Incomplete                                  | 2026-01-27    | HIGH                 |
| ATOMIC-001d          | reflection-queue-processor.cjs                               | 2026-01-27    | N/A                  |

---

## [SEC-WIN-001] RESOLVED: Windows Reserved Device Name Protection Gap

- **Date**: 2026-01-27
- **Date Resolved**: 2026-01-27
- **Severity**: **HIGH**
- **Status**: **RESOLVED**
- **Category**: Security - Input Validation Gap
- **File**: `.claude/hooks/safety/file-placement-guard.cjs`
- **STRIDE Category**: Denial of Service, Information Disclosure

### Description

The `file-placement-guard.cjs` hook did not block Write/Edit operations targeting Windows reserved device names (NUL, CON, PRN, AUX, COM1-9, LPT1-9). This resulted in a file named `nul` being created at the project root when a Bash command redirected output to `/dev/null` and the `windows-null-sanitizer.cjs` hook failed to intercept it (non-Bash tools).

**Root Cause**:

The `windows-null-sanitizer.cjs` hook only handles Bash commands with `/dev/null` patterns. It does NOT protect against:

- Write tool creating files named "nul", "con", etc.
- Edit tool creating files named "nul", "con", etc.
- MCP filesystem tools creating files with reserved names

**Impact**:

- Files with reserved names cannot be properly accessed/deleted on Windows
- Denial of service (file system corruption)
- Cross-platform compatibility issues
- Unexpected device interactions (CON, PRN could access real devices)

### Resolution

Added Windows reserved device name validation to `file-placement-guard.cjs`:

1. **Added constant**: `WINDOWS_RESERVED_NAMES` array with all 22 reserved names
2. **Added function**: `isWindowsReservedName(filePath)` that:
   - Extracts basename from path
   - Removes extension (reserved names are blocked regardless of extension)
   - Performs case-insensitive comparison against reserved names
3. **Added check in main()**: Before other validations, block any Write/Edit to reserved names
4. **Added audit logging**: Security events logged with severity HIGH
5. **Added 21 test cases**: Comprehensive coverage including edge cases

### Files Modified

- `.claude/hooks/safety/file-placement-guard.cjs` (added validation)
- `.claude/hooks/safety/file-placement-guard.test.cjs` (added 21 tests)
- `.claude/context/memory/issues.md` (documented issue)
- `.claude/context/memory/learnings.md` (recorded pattern)

### Verification

All 129 tests pass including 21 new tests for Windows reserved name validation:

- Detects NUL, CON, PRN, AUX as reserved
- Detects COM1-9, LPT1-9 as reserved
- Case-insensitive (nul, NUL, Nul all blocked)
- Blocks with extensions (nul.txt, con.md blocked)
- Does NOT block similar names (null.txt, console.log allowed)

---

## [SEC-007] RESOLVED: Windows Path Regex Bypass in Filesystem Validators

- **Date**: 2026-01-27
- **Date Resolved**: 2026-01-27
- **Severity**: **HIGH**
- **Status**: **RESOLVED**
- **Category**: Security - Input Validation Bypass
- **File**: `.claude/hooks/safety/validators/filesystem-validators.cjs`
- **STRIDE Category**: Elevation of Privilege, Tampering

### Description

The `parseCommand()` function in filesystem-validators.cjs consumed backslash characters as escape sequences, causing Windows system paths like `C:\Windows` to become `C:Windows` after parsing. This bypassed all regex-based security checks for Windows system directories.

**Attack Vector**:

- Input: `rm -rf C:\Windows`
- After parseCommand(): Token `C:Windows` (backslash consumed)
- Pattern `/^C:\Windows/i` test against `C:Windows`: FALSE (no match)
- Result: Dangerous command ALLOWED instead of BLOCKED

**Root Cause**:
Lines 82-85 in parseCommand():

```javascript
if (char === '\\' && !inSingleQuote) {
  escaped = true;
  continue;  // Backslash consumed, never added to token
}
```

### Impact

- Commands like `rm -rf C:\Windows`, `rm -rf C:\Program Files`, etc. would NOT be blocked
- Windows system directories were completely unprotected despite having regex patterns
- Unix paths (/home, /etc, /usr) were NOT affected (no backslash parsing issue)

### Resolution

Modified parseCommand() to preserve backslashes in tokens:

```javascript
if (escaped) {
  // SECURITY FIX: Preserve the backslash in the token
  current += '\\' + char;  // Keep both backslash AND escaped char
  escaped = false;
  continue;
}
```

Also added handling for trailing backslash and added two new protected paths:

- `C:\System32`
- `C:\ProgramData`

### Files Modified

- `.claude/hooks/safety/validators/filesystem-validators.cjs` (parseCommand fix)
- `.claude/hooks/safety/validators/filesystem-validators.test.cjs` (updated tests)

### Verification

All 60 tests pass including new Windows path tests:

- `should block rm C:\Windows`
- `should block rm C:\Windows\System32`
- `should block rm C:\Program Files`
- `should block rm C:\Users`
- `should block rm C:\System32`
- `should block rm C:\ProgramData`
- `should be case-insensitive for Windows paths`

---

## [ROUTER-VIOLATION-001] Router Bypassed Protocol Under User Pressure

- **Date**: 2026-01-27
- **Date Resolved**: 2026-01-27
- **Severity**: **CRITICAL**
- **Status**: **RESOLVED**
- **Category**: Protocol Violation
- **Detected By**: User feedback
- **Router Iron Laws Score**: 2.5/10 (CRITICAL FAIL - Threshold: 4.0)

### Description

Router (main Claude instance) violated the Router-First protocol (CLAUDE.md Section 1.1-1.2) by directly executing blacklisted tool operations instead of spawning appropriate agents.

**Violations**:

1. **Edit Tool**: Directly modified `.claude/lib/utils/atomic-write.cjs` (BLACKLISTED - Router may never use Edit)
2. **Bash Tool**: Executed `pnpm test:framework:hooks` (NOT in whitelisted git commands)
3. **Bash Tool**: Executed `pnpm test:framework:lib` (NOT in whitelisted git commands)

**User Report**: "Somehow this last update you did broke our agent process. For some reason you as the router are running tests and making edits which violates our rules. FIX THIS !!!!!"

### Root Cause

**Primary**: Immediate task pressure (urgent bug fix + extreme user frustration) overrode documented protocol constraints. Router chose fastest path (direct action) over correct path (agent spawning).

**Contributing Factors**:

- **Availability Bias**: Direct tool use was cognitively "available" and faster
- **Goal Prioritization**: "Fix bug" goal weighted higher than "Follow protocol" goal
- **Rule Abstraction**: Router-First rules documented but not viscerally salient at decision moment
- **Temporal Discount**: Future consequences (broken architecture) discounted vs immediate reward (bug fixed)

### Impact

- Framework architectural integrity compromised
- Precedent set for future violations under urgency
- User trust impacted ("you as the router are running tests and making edits")
- Demonstrates enforcement gap: comprehensive docs/hooks insufficient under pressure

### Resolution

**Completed on 2026-01-27** via comprehensive remediation:

1. **ADR-030: Router Bash Whitelist Strictness** - IMPLEMENTED
   - Created exhaustive whitelist for Router Bash commands
   - Added visceral blocking messages with allowed commands list
   - Enforcement via routing-guard.cjs

2. **ADR-031: Visceral Decision-Time Prompting** - IMPLEMENTED
   - Added prominent self-check gates to CLAUDE.md
   - Created violation examples with correct patterns
   - Enhanced router.md with decision-time prompts

3. **ADR-032: Urgent Request Routing Pattern** - IMPLEMENTED
   - Created systematic handling for urgent user requests
   - Documented acknowledgment + spawning pattern
   - Integrated into router-decision.md workflow

4. **ROUTER_TRAINING_EXAMPLES.md** - CREATED
   - Comprehensive examples of correct routing patterns
   - Common violation scenarios with corrections

**Evidence**: All ADRs marked as "Implemented" in decisions.md (2026-01-27)

### Related Artifacts

- **Reflection Report**: `.claude/context/artifacts/reports/router-violation-reflection.md`
- **Learning Entry**: See "Router Protocol Violation Pattern" in learnings.md
- **ADRs**:
  - ADR-030: Router Bash Whitelist Strictness (Implemented)
  - ADR-031: Visceral Decision-Time Prompting (Implemented)
  - ADR-032: Urgent Request Routing Pattern (Implemented)
- **Training**: `.claude/docs/ROUTER_TRAINING_EXAMPLES.md`
- **Enforcement**: routing-guard.cjs (consolidated hook)

---

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

---

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

---

## [SEC-002] RESOLVED: Shell Validator Inner Command Bypass

- **Date**: 2026-01-25
- **Severity**: High
- **Status**: Resolved
- **File**: `.claude/hooks/safety/validators/shell-validators.cjs`
- **Lines**: 157-161
- **STRIDE Category**: Tampering
- **Description**: Shell commands like `bash -c "rm -rf /"` extracted the inner command but did not re-validate it through the validator registry. This allowed dangerous commands to bypass security checks by wrapping them in shell invocations.
- **Resolution**: Added recursive validation using `const { validateCommand } = require('./registry.cjs')` to re-validate extracted inner commands. The inner command is now blocked if any validator rejects it.

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## [FIX-001] RESOLVED: File Placement Guard Default Mode

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: Resolved
- **File**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Description**: Default enforcement mode was 'warn' instead of 'block', allowing invalid file placements to bypass enforcement
- **Resolution**: Changed default from 'warn' to 'block'. Added 4 tests for getEnforcementMode(). All 37 tests passing.

---

## [FIX-002] RESOLVED: Test Parallelization Interference

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: Resolved
- **Description**: Hook tests using shared state files (router-state.json) failed when run in parallel due to test interference
- **Resolution**: Added `test:framework` scripts to package.json that use `--test-concurrency=1` to run tests sequentially. All 164 framework tests now pass.

---

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

---

## Architecture Review Findings (2026-01-27)

### POINTER-002: Workflow Skill References (VERIFIED OK)

- **Date**: 2026-01-27
- **Category**: pointer_gap (FALSE POSITIVE)
- **Impact**: N/A
- **Status**: Resolved
- **Description**: Initial concern that workflows referenced non-existent skills (context-driven-development, consensus-voting, database-expert). Verification confirms ALL skill references in workflows exist as actual skill directories.
- **Evidence**: All checked skills verified to exist.

### [RESOLVED] CONFIG-002: CLAUDE.md Agent Count Accuracy

- **Date**: 2026-01-27
- **Date Resolved**: 2026-01-27
- **Category**: config_drift
- **Impact**: maintainability
- **Status**: RESOLVED (CLI Tool Created)
- **Description**: CLAUDE.md Section 3 routing table claims 45 agents. Glob of .claude/agents/ found 45 .md files. Counts match, but need to verify every table entry points to an actual file AND every agent file is in the table.
- **Remediation**: Create validation script:
  1. Extract agent names from CLAUDE.md routing table
  2. Glob all .md files in .claude/agents/
  3. Find agents in table but not in filesystem (broken pointers)
  4. Find agents in filesystem but not in table (missing routing)
- **Resolution**: CLI tool created at `.claude/tools/cli/validate-agent-routing.js`
  - Validates all agent routing entries against filesystem
  - Can be run with: `node .claude/tools/cli/validate-agent-routing.js`
  - Provides detailed report of broken pointers and missing routing entries

---

## Performance Optimization Analysis (2026-01-26)

### [PERF-001] Hook Consolidation - Routing Guards

**Status**: RESOLVED (2026-01-27)

**Original State:**

- 5 routing guard hooks fire on PreToolUse(Task): task-create-guard.cjs, planner-first-guard.cjs, security-review-guard.cjs, router-self-check.cjs, router-write-guard.cjs
- Each hook spawned a separate Node.js process (~50-100ms startup)
- All 5 hooks read the same router-state.json file
- Total overhead: ~500-1000ms per Task spawn

**Resolution:**

- Created unified `.claude/hooks/routing/routing-guard.cjs` consolidating all 5 checks
- Single process spawn for all routing validation
- Shared state file read via router-state.cjs
- Preserves individual enforcement modes via environment variables:
  - ROUTER_SELF_CHECK=block|warn|off
  - PLANNER_FIRST_ENFORCEMENT=block|warn|off
  - SECURITY_REVIEW_ENFORCEMENT=block|warn|off
  - ROUTER_WRITE_GUARD=block|warn|off

**Achieved Improvement:**

- Process spawns: 5 -> 1 (80% reduction)
- Latency: ~500ms -> ~100ms (80% reduction)
- I/O calls: 15 -> 3 (80% reduction)

**Files:**

- Primary: `.claude/hooks/routing/routing-guard.cjs` (583 lines)
- Tests: `.claude/hooks/routing/routing-guard.test.cjs` (42 tests passing)
- Legacy (not registered in settings.json): task-create-guard.cjs, planner-first-guard.cjs, security-review-guard.cjs, router-self-check.cjs, router-write-guard.cjs

**ADR**: ADR-026 documents the architecture decision

---

### [PERF-002] RESOLVED: Hook Consolidation - Evolution Guards

- **Date**: 2026-01-27
- **Severity**: Medium (Performance)
- **Status**: RESOLVED

**Problem:**

- 4 evolution hooks fired on PreToolUse(Edit/Write): evolution-state-guard.cjs, conflict-detector.cjs, quality-gate-validator.cjs, research-enforcement.cjs
- Note: evolution-trigger-detector.cjs fires on UserPromptSubmit (separate concern, not consolidated)
- Each read evolution-state.json independently (no caching)
- Total overhead: ~300-500ms per Edit/Write

**Resolution:**

Created `unified-evolution-guard.cjs` that consolidates 4 checks into 1:

1. Evolution state transitions (from evolution-state-guard.cjs)
2. Naming conflicts (from conflict-detector.cjs)
3. Quality gates in VERIFY phase (from quality-gate-validator.cjs)
4. Research enforcement (from research-enforcement.cjs)

**Files Created:**

- `.claude/hooks/evolution/unified-evolution-guard.cjs` (450 lines)
- `.claude/hooks/evolution/unified-evolution-guard.test.cjs` (21 tests)

**Files Modified:**

- `.claude/settings.json` - Replaced 4 individual hooks with unified hook

**Achieved Improvement:**

- Process spawns: 4 -> 1 (75% reduction)
- State file reads: 4 -> 1 (cached via state-cache.cjs)
- Latency: ~300ms -> ~80ms (73% reduction)
- All 149 evolution hook tests passing

---

## Verified Resolved Issues (2026-01-26)

### [VERIFIED-RESOLVED] HOOK-003: research-enforcement.cjs Missing SEC-007

- **Date Verified**: 2026-01-26
- **Original Issue**: Missing safe JSON parsing for evolution-state.json
- **Resolution**: Lines 40, 90 now use `safeReadJSON()` from safe-json.cjs with 'evolution-state' schema
- **Evidence**: Import at line 40, usage at line 90
- **Status**: RESOLVED

### [VERIFIED-RESOLVED] HOOK-005: router-write-guard.cjs Exit Code

- **Date Verified**: 2026-01-26
- **Original Issue**: Used exit(1) instead of exit(2) for blocking
- **Resolution**: Line 189 changed to `process.exit(2)` with comment "HOOK-005 FIX"
- **Evidence**: Line 189 now uses exit(2)
- **Status**: RESOLVED

### [VERIFIED-RESOLVED] CRITICAL-001: Path Validation in memory-manager.cjs

- **Date Verified**: 2026-01-26
- **Original Issue**: No path validation for projectRoot parameter
- **Resolution**: Added `validateProjectRoot()` function (lines 42-49) that calls `validatePathWithinProject()`
- **Evidence**: Line 121 calls validateProjectRoot(projectRoot) before file operations
- **Status**: RESOLVED

### [VERIFIED-RESOLVED] CRITICAL-003: Silent Error Swallowing

- **Date Verified**: 2026-01-26
- **Date Fully Resolved**: 2026-01-27
- **Original Issue**: Empty catch blocks with no logging
- **Resolution**: All 7 empty catch blocks in memory-dashboard.cjs now have conditional debug logging with METRICS_DEBUG env var
- **Functions Updated**: getFileSizeKB, getJsonEntryCount, countDirFiles, getFileLineCount, getMetricsHistory (2 catches), cleanupOldMetrics
- **Debug Pattern**: `if (process.env.METRICS_DEBUG === 'true') { console.error(JSON.stringify({ module, function, error, timestamp })); }`
- **Status**: RESOLVED

---

## [RESOLVED] SEC-007: Safe JSON Parsing

**Date Resolved**: 2026-01-26
**Original Issue**: Raw JSON.parse without prototype pollution protection
**Fix Applied**: safeReadJSON()/safeParseJSON() pattern
**Files Fixed**: dashboard.cjs, system-registration-handler.cjs

---

## [RESOLVED] SEC-008: Fail-Closed Pattern

**Date Resolved**: 2026-01-26
**Original Issue**: Security hooks exiting 0 on errors (fail-open)
**Fix Applied**: Exit code 2 on all error paths
**Files Fixed**: task-create-guard.cjs, router-write-guard.cjs

---

## [RESOLVED] SEC-009: Command Injection Prevention

**Date Resolved**: 2026-01-26
**Original Issue**: execSync() with string commands
**Fix Applied**: spawnSync() with array arguments and shell:false
**Files Fixed**: convert.cjs, validate-all.cjs, skills-core.js

---

## [RESOLVED] PERF-NEW-002: routing-guard.cjs Not Activated

**Date Resolved**: 2026-01-26
**Original Issue**: Hook created but not registered in settings.json
**Fix Applied**: Added to settings.json hooks array
**Result**: 80% Task spawn latency reduction

---

## Framework Deep Dive Code Review - NEW Issues (2026-01-26)

### [NEW-CRIT-001] Unsafe JSON Parsing in anomaly-detector.cjs

- **Date**: 2026-01-26
- **Severity**: Critical
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/hooks/self-healing/anomaly-detector.cjs`
- **Line**: 127
- **CWE**: CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes)
- **STRIDE**: Tampering
- **Description**: Uses raw `JSON.parse(content)` on anomaly-state.json without prototype pollution protection
- **Impact**: State file poisoning could bypass anomaly detection thresholds or inject malicious behavior
- **Resolution**:
  - Added import for `safeParseJSON` from `../../lib/utils/safe-json.cjs`
  - Replaced `JSON.parse(content)` with `safeParseJSON(content, 'anomaly-state')`
  - Added 'anomaly-state' schema to safe-json.cjs SCHEMAS object

### [NEW-CRIT-002] Unsafe JSON Parsing in auto-rerouter.cjs

- **Date**: 2026-01-26
- **Severity**: Critical
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/hooks/self-healing/auto-rerouter.cjs`
- **Line**: 111
- **CWE**: CWE-1321 (Improperly Controlled Modification of Object Prototype Attributes)
- **STRIDE**: Tampering
- **Description**: Uses raw `JSON.parse(content)` on rerouter-state.json without prototype pollution protection
- **Impact**: State file poisoning could alter agent failure tracking, causing incorrect rerouting suggestions
- **Resolution**:
  - Added import for `safeParseJSON` from `../../lib/utils/safe-json.cjs`
  - Replaced `JSON.parse(content)` with `safeParseJSON(content, 'rerouter-state')`
  - Added 'rerouter-state' schema to safe-json.cjs SCHEMAS object

### [NEW-CRIT-003] Inconsistent Exit Code in tdd-check.cjs

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/hooks/safety/tdd-check.cjs`
- **Line**: 226
- **CWE**: CWE-758 (Reliance on Undefined, Unspecified, or Implementation-Defined Behavior)
- **STRIDE**: Information Disclosure
- **Description**: Uses `process.exit(1)` instead of `process.exit(2)` for blocking operations
- **Impact**: Inconsistency with framework exit code convention (0=allow, 2=block)
- **Resolution**: Changed `process.exit(1)` to `process.exit(2)` with comment explaining convention

### [NEW-HIGH-001] Inconsistent Exit Code in enforce-claude-md-update.cjs

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/hooks/safety/enforce-claude-md-update.cjs`
- **Line**: 241
- **CWE**: CWE-758 (Reliance on Undefined, Unspecified, or Implementation-Defined Behavior)
- **STRIDE**: Information Disclosure
- **Description**: Uses `process.exit(1)` instead of `process.exit(2)` for blocking
- **Impact**: Inconsistent with framework exit code convention
- **Resolution**: Changed `process.exit(1)` to `process.exit(2)` with comment explaining convention

### [NEW-HIGH-002] Missing Safe JSON for Hook Input Parsing

- **Date**: 2026-01-26
- **Severity**: High
- **Status**: RESOLVED
- **Resolved Date**: 2026-01-26
- **Resolution**: Migrated all hooks to use shared hook-input.cjs utility with sanitizeObject() for prototype pollution prevention
- **Files Modified** (15 hooks total):
  - `.claude/hooks/safety/enforce-claude-md-update.cjs`
  - `.claude/hooks/routing/router-mode-reset.cjs`
  - `.claude/hooks/safety/file-placement-guard.cjs`
  - `.claude/hooks/safety/windows-null-sanitizer.cjs`
  - `.claude/hooks/self-healing/anomaly-detector.cjs`
  - `.claude/hooks/routing/task-completion-guard.cjs`
  - `.claude/hooks/routing/task-update-tracker.cjs`
  - `.claude/hooks/routing/router-enforcer.cjs`
  - `.claude/hooks/self-healing/auto-rerouter.cjs`
  - `.claude/hooks/safety/validate-skill-invocation.cjs`
  - `.claude/hooks/routing/documentation-routing-guard.cjs`
  - `.claude/hooks/reflection/task-completion-reflection.cjs`
  - `.claude/hooks/reflection/error-recovery-reflection.cjs`
  - `.claude/hooks/reflection/session-end-reflection.cjs`
  - `.claude/hooks/memory/session-memory-extractor.cjs`
- **CWE**: CWE-20 (Improper Input Validation)
- **STRIDE**: Tampering
- **Description**: Hook input from Claude Code is parsed with raw JSON.parse() without validation
- **Impact**: Malformed or malicious hook input could crash hooks or inject prototype pollution
- **Lines Removed**: ~600+ lines of duplicated parseHookInput functions eliminated
- **Security Improvement**: All hook input now goes through sanitizeObject() which filters **proto**, constructor, prototype keys

### [NEW-HIGH-003] Missing Atomic Write in Self-Healing Hooks

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED
- **Resolved Date**: 2026-01-26
- **Resolution**: Added atomic write pattern to all 3 self-healing hooks
- **Files Modified**:
  - `.claude/hooks/self-healing/anomaly-detector.cjs` - saveState() now uses atomicWriteJSONSync
  - `.claude/hooks/self-healing/auto-rerouter.cjs` - saveState() now uses atomicWriteJSONSync
  - `.claude/hooks/self-healing/loop-prevention.cjs` - \_saveState() now uses atomicWriteJSONSync
- **Verification**: All 103 tests pass (35+33+35)
- **CWE**: CWE-362 (Concurrent Execution Using Shared Resource with Improper Synchronization)
- **STRIDE**: Tampering
- **Description**: Both hooks use direct `fs.writeFileSync()` instead of atomic write pattern
- **Impact**: Process crash mid-write can corrupt state files

---

## Framework Architecture Review (2026-01-26)

### [DOC-001] CLAUDE.md Section 1.3 Documents Deprecated Hook Architecture

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/CLAUDE.md` (lines 130-133)
- **Description**: Section 1.3 Enforcement Hooks table documents 4 individual hooks (task-create-guard, planner-first-guard, security-review-guard, router-write-guard) as separately registered in settings.json. However, these have been consolidated into `routing-guard.cjs` which is the actual registered hook.
- **Impact**: Developers may try to modify individual hook files thinking they're active, or register them separately causing duplicate enforcement.
- **Resolution**: Updated CLAUDE.md Section 1.3 to document unified routing-guard.cjs architecture with explanation of consolidated checks and individual enforcement mode overrides.

### [DOC-002] Undocumented Workflows in CLAUDE.md Section 8.6

- **Date**: 2026-01-26
- **Severity**: Medium
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/CLAUDE.md` Section 8.6
- **Description**: 7 workflows exist in `.claude/workflows/` but are not documented in the Enterprise Workflows table
- **Impact**: Workflows are not discoverable through CLAUDE.md reference.
- **Resolution**: Added all 7 missing workflows to CLAUDE.md Section 8.6 Enterprise Workflows table. All workflow references verified via Glob before adding to documentation.

### [DOC-003] Hooks Directory Structure Incomplete in Documentation

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/CLAUDE.md` Section 10.2
- **Description**: Documentation shows 3 hook categories (routing/, safety/, validation/) but actual structure has 8 categories: evolution/, memory/, reflection/, routing/, safety/, self-healing/, session/, validation/.
- **Impact**: New hook placement may be incorrect.
- **Resolution**: Updated CLAUDE.md Section 10.2 hooks/ directory to show all 8 categories including safety/validators/ subdirectory. Structure now matches actual codebase organization.

### [DOC-004] lib/ Directory Structure Incomplete

- **Date**: 2026-01-26
- **Severity**: Low
- **Status**: RESOLVED (2026-01-27)
- **File**: `.claude/CLAUDE.md` Section 10.2
- **Description**: Missing directories: `_test-fixtures/`, `self-healing/`, `utils/`
- **Impact**: Library file placement guidance incomplete.
- **Resolution**: Updated CLAUDE.md Section 10.2 lib/ directory structure to include self-healing/ and utils/ subdirectories with descriptions of contained modules.

---

## [RESOLVED] ATOMIC-001: Missing Atomic Writes in State-Modifying Hooks

- **Date**: 2026-01-28
- **Date Resolved**: 2026-01-27
- **Severity**: Critical
- **Status**: RESOLVED
- **Description**: Deep dive Task #4 found 3 hooks writing state files without atomic writes. If process crashes mid-write, state corruption occurs.
- **Pattern**: Should use `atomicWriteJSONSync()` from `.claude/lib/utils/atomic-write.cjs`
- **Resolution**: All 4 instances fixed (3 verified already fixed, 1 fixed in Phase 1):
  - ATOMIC-001a: evolution-trigger-detector.cjs - Already fixed
  - ATOMIC-001b: memory-health-check.cjs (patterns.json) - Already fixed
  - ATOMIC-001c: memory-health-check.cjs (gotchas.json) - Already fixed
  - ATOMIC-001d: reflection-queue-processor.cjs - Fixed in Phase 1 (temp+rename for JSONL)

---

## Phase 1 Security Fixes - Resolution Report (2026-01-27)

**Task ID**: #3
**Agent**: SECURITY-ARCHITECT
**Date**: 2026-01-27

### Issues Verified and Resolved

### [RESOLVED] ATOMIC-001d: reflection-queue-processor.cjs

- **Date Resolved**: 2026-01-27
- **Original Issue**: Uses `fs.writeFileSync(tempFile, ...)` followed by `fs.renameSync` manually instead of atomicWriteSync utility
- **Resolution**: Replaced manual temp+rename pattern with `atomicWriteSync(queueFile, ...)` from atomic-write.cjs
- **Changes**:
  - Added import: `const { atomicWriteSync } = require('../../lib/utils/atomic-write.cjs');`
  - Replaced lines 249-251 with: `atomicWriteSync(queueFile, updatedLines.join('\n') + '\n');`
- **Status**: RESOLVED

### [VERIFIED-ALREADY-FIXED] ATOMIC-001a: evolution-trigger-detector.cjs

- **Date Verified**: 2026-01-27
- **Status**: Already uses `atomicWriteJSONSync` at line 221
- **Evidence**: Imports at line 10, usage at line 221

### [VERIFIED-ALREADY-FIXED] ATOMIC-001b,c: memory-health-check.cjs

- **Date Verified**: 2026-01-27
- **Status**: Already uses `atomicWriteJSONSync` at lines 215 and 255
- **Evidence**: Imports at line 19, usage at lines 215 and 255

### [VERIFIED-ALREADY-FIXED] HOOK-003: research-enforcement.cjs

- **Date Verified**: 2026-01-27
- **Status**: Already uses `safeReadJSON` from safe-json.cjs
- **Evidence**: Import at line 40, usage at line 90 for evolution-state parsing

### [VERIFIED-ALREADY-FIXED] CRITICAL-001: Path Traversal in Memory CLI

- **Date Verified**: 2026-01-27
- **Status**: Already fixed - memory-manager.cjs has `validatePathWithinProject` checks
- **Evidence**: Import at line 34, validateProjectRoot function at lines 42-49, called in all functions accepting projectRoot

### [RESOLVED] SEC-AUDIT-015: Safe JSON Schema Incomplete

- **Date Resolved**: 2026-01-27
- **Original Issue**: `router-state` schema in safe-json.cjs only had 3 fields (mode, complexity, plannerSpawned) but router-state.cjs has 16+ fields
- **Resolution**: Updated router-state schema in safe-json.cjs to include all 16 fields from getDefaultState():
  - mode, lastReset, taskSpawned, taskSpawnedAt, taskDescription, sessionId
  - complexity, requiresPlannerFirst, plannerSpawned, requiresSecurityReview, securitySpawned
  - lastTaskUpdateCall, lastTaskUpdateTaskId, lastTaskUpdateStatus, taskUpdatesThisSession, version
- **Test Update**: Updated safe-json.test.cjs to expect `complexity: 'trivial'` (correct default) instead of `'unknown'`
- **Status**: RESOLVED

### Verification

- **Test Suite**: All 714 framework tests pass (`pnpm test:framework --test-concurrency=1`)
- **Files Modified**:
  1. `C:\dev\projects\agent-studio\.claude\hooks\reflection\reflection-queue-processor.cjs`
  2. `C:\dev\projects\agent-studio\.claude\lib\utils\safe-json.cjs`
  3. `C:\dev\projects\agent-studio\.claude\lib\utils\safe-json.test.cjs`
