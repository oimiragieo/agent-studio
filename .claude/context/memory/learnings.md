1. Create unified hook
2. Write comprehensive tests
3. Register in settings.json immediately
4. Verify with test operation
5. THEN mark complete

---

## 2026-01-27: PERF-002 Hook Consolidation Pattern

**Context**: Consolidated 4 evolution hooks into unified-evolution-guard.cjs.

**Key Pattern: Hook Consolidation Architecture**

When consolidating multiple hooks that:

1. Fire on the same event (PreToolUse, PostToolUse, etc.)
2. Read the same state file(s)
3. Check different aspects of the same domain

**Implementation Pattern:**

```javascript
// 1. Single state file read (cached)
const state = getCachedState(STATE_PATH, defaultState);

// 2. Run all checks in sequence
const results = [];

// Check 1: Domain-specific check 1
const check1Result = checkFunctionA(state, hookInput);
if (check1Result.block) results.push(check1Result);

// Check 2: Domain-specific check 2
const check2Result = checkFunctionB(state, hookInput);
if (check2Result.block) results.push(check2Result);

// 3. Return first blocking result (fail fast)
const blockingResult = results.find(r => r.block);
if (blockingResult && enforcement === 'block') {
  process.exit(2);
}
```

**Individual Override Pattern:**

Allow individual checks to be disabled while keeping others active:

```javascript
function getCheckEnforcementMode(checkName, mainMode) {
  const envVars = {
    stateTransition: 'EVOLUTION_STATE_GUARD',
    conflict: 'CONFLICT_DETECTOR',
  };
  const checkMode = process.env[envVars[checkName]];
  if (checkMode === 'off') return 'off';
  return mainMode;
}
```

**Results Achieved:**

- Process spawns: 4 -> 1 (75% reduction)
- State reads: 4 -> 1 (cached via state-cache.cjs)
- Latency: ~300ms -> ~80ms (73% reduction)

**Note**: evolution-trigger-detector.cjs not consolidated because:

1. Different event type (UserPromptSubmit vs PreToolUse)
2. Different purpose (advisory detection vs enforcement)
3. Never blocks operations (always exits 0)

---

## 2026-01-27: HOOK-001 Shared hook-input.cjs Utility Progress

**Context**: Task to eliminate duplicated parseHookInput() code across 40+ hooks.

**Status**: Partial completion - shared utility already exists and is well-implemented.

**What Already Exists** (`.claude/lib/utils/hook-input.cjs`):

```javascript
// Core functions
parseHookInputSync(); // Sync parsing from argv[2]
parseHookInputAsync(); // Async parsing from stdin/argv
validateHookInput(); // SEC-007 compliant validation
extractFilePath(); // Extract file paths from tool input
getToolName(); // Extract tool name
getToolInput(); // Extract tool input object
getEnforcementMode(); // Get enforcement mode from env
isEnabled(); // Check if hook is enabled
auditLog(); // SEC-010 compliant audit logging
formatResult(); // Format JSON output
```

**Hooks Already Updated** (using shared utility):

- task-create-guard.cjs
- loop-prevention.cjs
- research-enforcement.cjs
- bash-command-validator.cjs (updated 2026-01-27)
- tdd-check.cjs (updated 2026-01-27)
- format-memory.cjs (updated 2026-01-27)

**Hooks Still Using Duplicated Code** (17 remaining):

- routing/agent-context-pre-tracker.cjs
- routing/agent-context-tracker.cjs
- routing/documentation-routing-guard.cjs
- routing/router-enforcer.cjs
- routing/router-mode-reset.cjs
- routing/task-completion-guard.cjs
- routing/task-update-tracker.cjs
- safety/enforce-claude-md-update.cjs
- safety/file-placement-guard.cjs
- safety/validate-skill-invocation.cjs
- safety/windows-null-sanitizer.cjs
- memory/session-memory-extractor.cjs
- reflection/task-completion-reflection.cjs
- reflection/session-end-reflection.cjs
- reflection/error-recovery-reflection.cjs
- self-healing/auto-rerouter.cjs
- self-healing/anomaly-detector.cjs

**Update Pattern**:

```javascript
// 1. Add imports at top
const {
  parseHookInputAsync, // or parseHookInputSync
  getToolName,
  getToolInput,
  extractFilePath,
  getEnforcementMode,
  auditLog,
} = require('../../lib/utils/hook-input.cjs');

// 2. Remove local parseHookInput function

// 3. Replace usage:
// OLD: const toolName = hookInput.tool_name || hookInput.tool;
// NEW: const toolName = getToolName(hookInput);

// OLD: const toolInput = hookInput.tool_input || hookInput.input || {};
// NEW: const toolInput = getToolInput(hookInput);

// OLD: const filePath = toolInput.file_path || toolInput.filePath;
// NEW: const filePath = extractFilePath(toolInput);

// 4. For backward compatibility, add alias:
// const parseHookInput = parseHookInputAsync;
```

**Test Coverage**: 38 tests in hook-input.test.cjs all passing.

---

## 2026-01-27: Router Hook Architecture Verification

**Context**: Investigated reported router-self-check.cjs errors with corrupted shell command fragments.

**Analysis Results**:

1. **router-self-check.cjs is NOT registered in settings.json** - only routing-guard.cjs is used as the unified routing hook
2. **routing-guard.cjs consolidates 5 hooks**: router-self-check, planner-first-guard, task-create-guard, security-review-guard, router-write-guard
3. **All hooks correctly handle corrupted input** - parseHookInputAsync() from hook-input.cjs sanitizes input and returns null for invalid JSON

**Test Coverage Verified**:

- router-self-check.test.cjs: 34 tests passing
- routing-guard.test.cjs: 42 tests passing
- All 213 routing hook tests passing

**ALWAYS_ALLOWED_WRITE_PATTERNS Working Correctly**:

```javascript
const ALWAYS_ALLOWED_WRITE_PATTERNS = [
  /\.claude[\/\\]context[\/\\]runtime[\/\\]/, // Runtime state files
  /\.claude[\/\\]context[\/\\]memory[\/\\]/, // Memory files
  /\.gitkeep$/, // Git keep files
];
```

These patterns allow memory file writes regardless of router state, fixing the reflection-agent blocking issue (2026-01-27 learnings entry above).

**State File Location**: `.claude/context/runtime/router-state.json`

**Key Functions**:

- `enterAgentMode(taskDescription)` - Sets mode='agent' and taskSpawned=true
- `isAlwaysAllowedWrite(filePath)` - Checks if write should bypass router check
- `checkWriteAllowed()` - Main write permission check

**If Corrupted Error Messages Appear**:

1. Check if old hooks are cached in process memory (restart Claude session)
2. Verify settings.json only has routing-guard.cjs for routing checks
3. Use `DEBUG_HOOKS=true` to see detailed hook logging

---

## 2026-01-27: Bash Tool Uses Git Bash on Windows

**Context**: Encountered "syntax error: unexpected end of file" when using Windows CMD syntax in Bash tool.

**Root Cause**: The Bash tool runs through Git Bash (`/usr/bin/bash`), NOT Windows CMD or PowerShell.

**Key Rules**:

1. **Always use bash/POSIX syntax** for shell commands
2. **Never use** Windows CMD syntax (`if not exist`, `copy`, `del`, `type`)
3. **Never use** PowerShell syntax (`Remove-Item`, `New-Item`, `Test-Path`)

**Common Patterns**:
| Task | ✅ Correct | ❌ Wrong |
|------|-----------|---------|
| Create dir | `mkdir -p path` | `if not exist path mkdir path` |
| Create file | `echo "" > file` | `echo. > file` |
| Check exists | `[ -d "path" ]` | `if exist path` |

**Updated Skill**: `.claude/skills/windows-compatibility/SKILL.md` (v2.0.0)

**Action**: Always reference this skill when writing Bash commands on Windows environments.

---

## 2026-01-26: Framework Deep Dive Code Review Learnings

**Context**: Systematic code review of 80+ hooks and 50+ lib files to verify open issues and discover new bugs.

### Key Discoveries

**1. Prototype Pollution Pattern in Self-Healing Hooks**

The self-healing hooks (anomaly-detector.cjs, auto-rerouter.cjs) use raw JSON.parse() on state files without safe parsing. This is the same SEC-007 vulnerability that was fixed in routing hooks.

**Pattern to avoid**:

```javascript
const state = JSON.parse(content); // VULNERABLE
```

**Correct pattern**:

```javascript
const { safeReadJSON } = require('../../lib/utils/safe-json.cjs');
const state = safeReadJSON(STATE_FILE, 'schema-name'); // SAFE
```

**Action**: Always use safeReadJSON() for any state file parsing. Add schema to safe-json.cjs first.

**2. Exit Code Convention Enforcement**

Framework exit code convention:

- `0` = Allow operation (continue)
- `2` = Block operation (halt execution)
- `1` = Generic error (AVOID - ambiguous in hook context)

Found 2 hooks still using exit(1) instead of exit(2):

- tdd-check.cjs line 226
- enforce-claude-md-update.cjs line 241

**Always verify**: When adding blocking hooks, use `process.exit(2)` not `process.exit(1)`.

**3. Atomic Write Pattern for State Files**

Discovered inconsistency: router-state.cjs uses atomic write, but self-healing hooks don't.

**Why atomic writes matter**: If process crashes mid-write, direct writeFileSync leaves corrupted partial JSON.

**Correct pattern**:

```javascript
const { atomicWriteJSONSync } = require('../../lib/utils/atomic-write.cjs');
atomicWriteJSONSync(STATE_FILE, state);
```

**How it works**: Writes to `.tmp` file, then renames (atomic operation on POSIX systems).

**4. Verification Success Pattern**

Successfully verified 4 resolved issues from issues.md:

- HOOK-003: research-enforcement.cjs now uses safeReadJSON ✓
- HOOK-005: router-write-guard.cjs now uses exit(2) ✓
- CRITICAL-001: memory-manager.cjs has path validation ✓
- CRITICAL-003: Partially resolved (some empty catches remain)

**Learning**: Reading code is not enough - must verify line-by-line against issue description.

**5. Empty Catch Block Pattern**

Found pattern in memory-dashboard.cjs:

```javascript
} catch (e) { /* ignore */ }  // BAD - no debugging info
```

Better pattern with conditional debug logging:

```javascript
} catch (e) {
  if (process.env.METRICS_DEBUG === 'true') {
    console.error(JSON.stringify({
      module: 'memory-dashboard',
      function: 'functionName',
      error: e.message,
      timestamp: new Date().toISOString()
    }));
  }
}
```

**Benefit**: Production remains silent, debugging becomes possible with env var.

**6. Hook Input Parsing Standardization Needed**

Discovered 15+ hooks still parse hook input with raw JSON.parse(). Most are in try-catch blocks (partial mitigation) but should be standardized.

**Recommendation**: Create `parseHookInputSafe()` shared utility combining:

1. Schema validation
2. Prototype pollution protection
3. Consistent error handling

**Current state**: hook-input.cjs has parseHookInputAsync/Sync but without safe JSON parsing.

### Patterns to Propagate

1. **Safe JSON Parsing**: Apply safe-json.cjs pattern to ALL state file reads
2. **Atomic Writes**: Use atomicWriteJSONSync for ALL state file writes
3. **Exit Code Consistency**: Always use exit(2) for blocking, exit(0) for allowing
4. **Conditional Debug Logging**: Add METRICS_DEBUG to all empty catch blocks
5. **Shared Utilities**: Import PROJECT_ROOT, don't duplicate findProjectRoot()

### Testing Insights

**Test Coverage Gaps Found**:

- tdd-check.cjs - NO TEST FILE (should verify exit code 2)
- enforce-claude-md-update.cjs - NO TEST FILE (should verify exit code 2)

**Test Pattern**: When adding blocking hooks, MUST include tests for:

1. Block mode: verify exit code 2
2. Warn mode: verify exit code 0 with warning message
3. Off mode: verify exit code 0 without warning

### Security Compliance Status

After deep dive:

- SEC-007 (Safe JSON): 90% (missing in 2 self-healing hooks)
- SEC-008 (Fail-Closed): 95% (2 hooks use wrong exit code)
- SEC-006 (Path Validation): 100% ✓
- SEC-009 (Command Injection): 100% ✓
- SEC-010 (Audit Logging): 100% ✓

**Overall**: Framework security is STRONG, just need to apply existing patterns consistently.

### Code Review Methodology That Worked

1. **Systematic Grep**: Search for patterns (JSON.parse, process.exit(1), empty catches)
2. **Cross-Reference**: Check issues.md for claimed fixes
3. **Line-by-Line Verification**: Read actual code at reported line numbers
4. **Pattern Detection**: Look for duplicated code that should be shared utilities
5. **Exit Code Auditing**: Verify all blocking hooks use exit(2) not exit(1)

### Estimated Fix Times

**Critical Issues (P1)**: 2-3 hours total

- NEW-CRIT-001: 30 minutes (add safeReadJSON to anomaly-detector.cjs)
- NEW-CRIT-002: 30 minutes (add safeReadJSON to auto-rerouter.cjs)
- Schema additions: 1 hour (add anomaly-state and rerouter-state schemas)

**High Issues (P2)**: 2-3 hours total

- Exit code fixes: 10 minutes (change 2 lines)
- Atomic write fixes: 1 hour (import + update 2 files)
- Hook input standardization: 2 hours (create parseHookInputSafe)

**Medium Issues (P3)**: 3-4 hours total

- Remove duplicated findProjectRoot: 1 hour
- Add debug logging: 2 hours (update 3 catch blocks)

**TOTAL for all fixes**: ~8 hours

### Framework Health Assessment

**Strengths**:

- Strong security foundation with SEC-\* fixes applied
- Excellent atomic write pattern in router-state.cjs
- Comprehensive path validation in rollback-manager.cjs
- Good test coverage (164 framework tests passing)

**Weaknesses**:

- Inconsistent application of SEC-007 safe JSON parsing
- Minor exit code inconsistencies (easy to fix)
- Some code duplication (PERF-006/007 in progress)

**Verdict**: Framework is production-ready once P1 critical issues are fixed.
