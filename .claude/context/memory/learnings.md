## SEC-AUDIT-013/014: Windows Atomic Write and TOCTOU Lock Fix (2026-01-27)

**Problem #1 (SEC-AUDIT-013)**: `fs.renameSync()` is not truly atomic on Windows NTFS. Can fail if:

- Destination file exists
- Another process has the file open (EBUSY/EPERM)

**Problem #2 (SEC-AUDIT-014)**: Lock file cleanup used time-based staleness detection (TOCTOU race):

```javascript
// VULNERABLE CODE:
const stats = fs.statSync(lockFile);
if (Date.now() - stats.mtimeMs > 5000) {
  fs.unlinkSync(lockFile); // RACE: Another process may acquire between check and delete
}
```

**Solution #1 (SEC-AUDIT-013)**: Windows-specific handling in `atomic-write.cjs`:

```javascript
if (process.platform === 'win32') {
  if (fs.existsSync(filePath)) {
    let retries = 3;
    while (retries > 0) {
      try {
        fs.unlinkSync(filePath); // Unlink destination first
        break;
      } catch (unlinkErr) {
        if ((unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EPERM') && retries > 1) {
          sleep(50); // Wait and retry if file is locked
          retries--;
        } else {
          throw unlinkErr;
        }
      }
    }
  }
}
fs.renameSync(tempFile, filePath); // Now safe to rename
```

**Solution #2 (SEC-AUDIT-014)**: Process-based lock staleness in `loop-prevention.cjs`:

```javascript
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);  // Signal 0 checks existence without sending signal
    return true;
  } catch {
    return false;
  }
}

function acquireLock(filePath) {
  // ...
  if (e.code === 'EEXIST') {
    const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (lockData.pid && !isProcessAlive(lockData.pid)) {
      fs.unlinkSync(lockFile);  // SAFE: Process is actually dead
      continue;
    }
    // Process alive, wait and retry
  }
}
```

**Key Insight**: Never use time-based cleanup for locks. Always check process liveness.

**Test Coverage**:

- atomic-write.test.cjs: 16 tests (4 new for SEC-AUDIT-013)
- loop-prevention.test.cjs: 39 tests (4 new for SEC-AUDIT-014)

**Files Modified**:

- `C:\dev\projects\agent-studio\.claude\lib\utils\atomic-write.cjs`
- `C:\dev\projects\agent-studio\.claude\lib\utils\atomic-write.test.cjs`
- `C:\dev\projects\agent-studio\.claude\hooks\self-healing\loop-prevention.cjs`
- `C:\dev\projects\agent-studio\.claude\hooks\self-healing\loop-prevention.test.cjs`

---

## SEC-AUDIT-012: Shell Tokenizer Bypass Fix (2026-01-27)

**Problem**: The `parseCommand()` function in `shell-validators.cjs` used a custom tokenizer that did not handle dangerous shell syntax patterns that can bypass validation:

1. **ANSI-C quoting** (`$'...'`) - allows hex escapes like `$'rm\x20-rf\x20/'`
2. **Command substitution with backticks** (`` `cmd` ``)
3. **$() command substitution** - `$(malicious_cmd)`
4. **Here-documents** (`<<EOF`)
5. **Dangerous brace expansion** (`{a,b,c}`)

**Solution**: Added `checkDangerousPatterns()` function that detects and BLOCKS these patterns BEFORE tokenization occurs.

**Key Implementation Patterns**:

```javascript
const DANGEROUS_PATTERNS = [
  { pattern: /\$'/, name: 'ANSI-C quoting', reason: '...' },
  { pattern: /`[^`]*`/, name: 'Backtick substitution', reason: '...' },
  { pattern: /\$\([^)]*\)/, name: 'Command substitution', reason: '...' },
  { pattern: /<<-?\s*\w/, name: 'Here-document', reason: '...' },
  { pattern: /\{[^}]*,[^}]*\}/, name: 'Brace expansion', reason: '...' },
];

function checkDangerousPatterns(command) {
  for (const { pattern, name, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { valid: false, error: `SEC-AUDIT-012: ${name} blocked - ${reason}` };
    }
  }
  return { valid: true, error: '' };
}
```

**API Changes**:

- `parseCommand()` now returns `{tokens: string[]|null, error: string|null}` instead of just `string[]|null`
- `extractCArgument()` now returns `{command: string|null, error: string|null}` instead of just `string|null`
- Legacy wrappers `parseCommandLegacy()` and `extractCArgumentLegacy()` provided for backward compatibility

**Defense-in-Depth**: Dangerous patterns are checked:

1. At the outer command level (in `validateShellCommand()`)
2. At the inner command level (for `-c` arguments)

**Test Coverage**: 64 tests covering all dangerous patterns, edge cases, and backward compatibility.

**Files Modified**:

- `C:\dev\projects\agent-studio\.claude\hooks\safety\validators\shell-validators.cjs`
- `C:\dev\projects\agent-studio\.claude\hooks\safety\validators\shell-validators.test.cjs`

---

When creating tests for hooks that call `process.exit()` during module load:

```javascript
// BEFORE import
const originalExit = process.exit;
process.exit = () => {}; // Prevent exit

// IMPORT module
const { functionToTest } = require('./hook-file.cjs');

// AFTER import
process.exit = originalExit; // Restore original
```

**Security Pattern Categories Verified**:

| Category            | Patterns | Examples                                 |
| ------------------- | -------- | ---------------------------------------- |
| Auth/Authorization  | 13       | auth, login, session, jwt, oauth, rbac   |
| Cryptography        | 12       | encrypt, hash, bcrypt, ssl, tls          |
| Secrets/Credentials | 8        | secret, password, apikey, private-key    |
| Input Validation    | 8        | sanitize, validate, xss, csrf, injection |
| Security Infra      | 5        | firewall, guard, security, audit         |
| File Extensions     | 10       | .env, .pem, .key, .crt, .jks             |
| Directories         | 9        | /auth/, /security/, /crypto/             |

**Edge Cases Handled**:

- Null/undefined/empty inputs → Returns `{ isSensitive: false, reasons: [] }`
- Windows vs Unix paths → Both detected correctly
- Paths with spaces/special chars → Handled correctly
- Case insensitivity → AUTH, Auth, auth all detected
- Multiple dots in filename → app.config.production.js handled
- Relative paths with .. → Detected correctly

**Real-World File Examples Tested**:

- NextAuth.js: `app/api/auth/[...nextauth]/route.ts` ✓
- Firebase: `lib/firebase-auth.ts` ✓
- AWS: `.aws/credentials` ✓
- Express: `middleware/session-store.js` ✓
- JWT: `middleware/jwt-verify.ts` ✓

**Test File Location**: `.claude/hooks/safety/security-trigger.test.cjs` (120 tests, 100% pass rate)

**Run Command**: `node .claude/hooks/safety/security-trigger.test.cjs`

**Key Takeaway**: The security-trigger.cjs hook has comprehensive security pattern detection covering all major categories (auth, crypto, secrets, validation). The test suite provides 120 test cases verifying both positive detection (security files) and negative cases (non-sensitive files). The hook correctly flags security-sensitive files without blocking operations (always exits 0).

---

## Router Hook Tests Require Sequential Execution (2026-01-27)

**Problem**: Running hook tests with default `node --test` causes "13 failing tests" due to concurrent modification of `router-state.json`.

**Root Cause**: Multiple test files simultaneously read/write `router-state.json`, causing `saveStateWithRetry()` to exhaust its 5 retry limit under high contention.

**Symptoms**:

- `Error: Save failed after 5 retries - concurrent modification conflict`
- Tests pass individually but fail when run together
- Failures appear random (different tests fail on different runs)

**Solution**: Always use `--test-concurrency=1` for hook tests:

```bash
# CORRECT - use npm scripts
pnpm test:framework:hooks    # Runs with concurrency=1
pnpm test:framework          # Runs hooks + lib with concurrency=1

# WRONG - raw node --test (will fail)
node --test .claude/hooks/**/*.test.cjs  # Races on router-state.json

# MANUAL FIX if running directly
node --test --test-concurrency=1 .claude/hooks/**/*.test.cjs
```

**Why Sequential**: Routing hooks share a single state file (`router-state.json`) that tracks:

- Router/agent mode
- Complexity level
- Planner/security spawn status
- TaskUpdate tracking

This file uses optimistic concurrency with version checking, but under high contention (10+ parallel test files), retries exhaust.

**Test Count**: 637 tests pass (489 hook + 148 lib) when run sequentially.

---

## Hook Consolidation Pattern (2026-01-27)

When consolidating multiple hooks into a single unified hook:

1. **Analyze source hooks** - Read all hooks to understand:
   - What triggers they share (Event + Matcher)
   - What shared utilities they use
   - What state they read/modify
   - What side effects they produce

2. **Create unified hook structure**:

   ```javascript
   // Shared utilities at top
   const { parseHookInputAsync, getToolName, getToolInput, getToolOutput } = require('...');

   // Logic from each hook in separate sections
   // 1. Hook A logic
   function runHookALogic(input) { ... }

   // 2. Hook B logic
   function runHookBLogic(input) { ... }

   // Main execution runs all
   async function main() {
     const input = await parseHookInputAsync();
     runHookALogic(input);
     runHookBLogic(input);
     process.exit(0);
   }
   ```

3. **Export all functions** for testability - each original hook's functions should be exported.

4. **Update settings.json** - Replace N hooks with 1 unified hook.

**Performance Impact**: PostToolUse(Task) consolidation reduced 5 process spawns to 1 (80% reduction).

**Files Created**:

- `post-task-unified.cjs` - Unified PostToolUse(Task) hook
- `post-task-unified.test.cjs` - 40 tests covering all consolidated functionality
- `pre-task-unified.cjs` - Unified PreToolUse(Task) hook
- `pre-task-unified.test.cjs` - 26 tests covering all consolidated functionality

---

## Architecture Review Pattern: Bidirectional Documentation Cross-References (2026-01-27)

**IMPORTANT**: When creating artifacts that reference each other (skills ↔ workflows, agents ↔ workflows), ALWAYS establish bidirectional cross-references for discoverability.

**Problem**: Skills and workflows created independently without linking. Example:

- `architecture-review` skill exists
- `architecture-review-skill-workflow.md` workflow exists
- Neither references the other → discovery failure

**Pattern**:

1. **In Skills**: Add "Workflow Integration" section:

   ```markdown
   ## Workflow Integration

   This skill is used in the following workflows:

   - **Multi-Agent Architecture Review**: `.claude/workflows/architecture-review-skill-workflow.md`
   - **Consensus Decision Making**: `.claude/workflows/consensus-voting-skill-workflow.md`
   ```

2. **In Workflows**: Add "Related Skills" section:

   ```markdown
   ## Related Skills

   This workflow uses:

   - `architecture-review` - Core architecture evaluation
   - `diagram-generator` - Visual documentation
   - `swarm-coordination` - Parallel agent spawning
   ```

3. **In Agent Definitions**: Add "Related Workflows" section:

   ```markdown
   ## Related Workflows

   For complex tasks, use these workflows:

   - **Architecture Review**: `.claude/workflows/architecture-review-skill-workflow.md`
   - **Consensus Decisions**: `.claude/workflows/consensus-voting-skill-workflow.md`
   ```

**Impact**: 4 skills and architect.md currently missing these cross-references (POINTER-003, DOC-001 in issues.md).

**Enforcement**: Add to creator skill templates (skill-creator, workflow-creator, agent-creator) to include cross-reference sections by default.

---

## Architecture Review Method: Systematic Cross-Reference Validation (2026-01-27)

**Pattern for architecture reviews**:

1. **Context Gathering** (Read memory, CLAUDE.md, agent definitions, settings.json)
2. **Cross-Reference Matrix**:
   | Source | Target | Method | Pass/Fail |
   |--------|--------|--------|-----------|
   | settings.json hooks | .claude/hooks/ files | Path resolution | PASS |
   | CLAUDE.md agents | .claude/agents/ files | Glob count + sample check | PASS (counts match) |
   | Workflows | Skills | Existence check | PASS |
   | Hooks | lib imports | Relative path resolution | PASS |
   | Agent definitions | Workflows | Reference scan | FAIL (missing) |
   | Skills | Workflows | Cross-reference scan | FAIL (missing) |

3. **Impact Classification**:
   - **Runtime Break**: Pointer causes exception/crash (CRITICAL)
   - **Silent Failure**: Pointer missing, feature doesn't work (HIGH)
   - **Maintainability**: Pointer gap, discovery impacted (MEDIUM/LOW)

4. **Evidence Collection**: Include bash commands and file paths in findings

**Key Insight**: Framework had ZERO runtime breaks. All pointer gaps were documentation/discoverability issues. This indicates strong consolidation work (ADR-026) and recent doc sync (ADR-027) are effective.

---

## PreToolUse(Task) Hook Consolidation (2026-01-27)

Consolidated 4 hooks into 1 unified hook:

| Original Hook                   | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| agent-context-pre-tracker.cjs   | Sets mode='agent' BEFORE task starts (race condition fix) |
| routing-guard.cjs               | Planner-first, security review enforcement                |
| documentation-routing-guard.cjs | Routes docs to technical-writer                           |
| loop-prevention.cjs             | Prevents runaway loops (depth, patterns, budget)          |

**Key Learning - State Caching**:

- Cache router-state.json read per invocation (multiple checks need same state)
- Use `invalidateCachedState()` function for tests
- Also invalidate router-state module's internal cache

```javascript
let _cachedRouterState = null;

function getCachedRouterState() {
  if (_cachedRouterState === null) {
    _cachedRouterState = routerState.getState();
  }
  return _cachedRouterState;
}

function invalidateCachedState() {
  _cachedRouterState = null;
  routerState.invalidateStateCache(); // Also invalidate module's cache
}
```

**Key Learning - Test Pattern Detection Gotcha**:
The TECH_WRITER_PATTERNS.description includes "documentation" which causes false positives when the description contains "documentation" (e.g., "Developer writing API documentation"). Test cases must avoid this pattern when testing documentation routing blocking.

**Performance**: 4 processes -> 1 process (75% reduction in process spawns)

---

## SEC-AUDIT-017: Deny-by-Default for Unregistered Commands (2026-01-27)

**Problem**: Command validator registry was ALLOWING unregistered commands by default. This created a security hole where arbitrary code execution commands like `perl -e`, `ruby -e`, `awk`, etc. could execute without any validation.

**Root Cause**: Lines 126-129 in `.claude/hooks/safety/validators/registry.cjs`:

```javascript
if (!validator) {
  return { valid: true, error: '', hasValidator: false }; // ALLOWS unregistered!
}
```

**Fix Implemented**: Deny-by-default with explicit allowlist

1. Created `SAFE_COMMANDS_ALLOWLIST` with 40+ known-safe commands (ls, npm, git, etc.)
2. Changed default from ALLOW to DENY for unregistered commands
3. Added environment variable override: `ALLOW_UNREGISTERED_COMMANDS=true` (with security warning)
4. Added clear error message citing SEC-AUDIT-017

**Safe Commands Categories**:

- Read-only filesystem: ls, cat, grep, find, pwd
- Development tools: git, npm, node, python, cargo, go
- Basic file ops: mkdir, touch, cp, mv, rm (path validation elsewhere)
- Editors: code, vim, nano
- Build tools: make, cmake, cargo, mvn, gradle, dotnet
- Archive tools: tar, zip, gzip

**Security Logic**:

```
Command validation flow:
1. Check if registered validator exists → Use validator
2. Check if in SAFE_COMMANDS_ALLOWLIST → Allow
3. Check if ALLOW_UNREGISTERED_COMMANDS=true → Allow + log warning
4. Otherwise → DENY with SEC-AUDIT-017 error
```

**Test Coverage**: 8 new tests added to `registry.test.cjs`

- ✅ Blocks perl, ruby, awk (dangerous interpreters)
- ✅ Allows ls, npm, git (safe allowlist)
- ✅ Override works with env var
- ✅ Registered validators still work

**Files Modified**:

- `.claude/hooks/safety/validators/registry.cjs` (added allowlist + deny logic)
- `.claude/hooks/safety/validators/registry.test.cjs` (8 new tests)

**Impact**: Closes critical security gap where unregistered commands could bypass all validation. Now requires explicit opt-in via allowlist or validator registration.

---

## Legacy Hook Directory Pattern (ARCH-002 Resolution) (2026-01-27)

When consolidating hooks into a single unified hook:

1. **Create \_legacy directory** - Store original hook files for reference/rollback
2. **Move all files** - Hook .cjs files + all corresponding .test.cjs and .integration.test.cjs files
3. **Create README.md** - Document which hooks were consolidated and where
4. **Verify imports** - Ensure unified hook loads without errors
5. **Run tests** - Confirm unified hook's tests still pass (42 tests for routing-guard.cjs)
6. **Check settings.json** - Verify old hooks are NOT registered, only unified hook is registered

**Files Moved**:

- 4 consolidated hooks: planner-first-guard.cjs, task-create-guard.cjs, router-self-check.cjs, security-review-guard.cjs
- 6 test files: .test.cjs and .integration.test.cjs variants
- Total: 10 files moved to `.claude/hooks/routing/_legacy/`

**Verification**:

- routing-guard.cjs imports successfully
- routing-guard tests: 42/42 pass
- router-state tests: 1/1 pass (dependency check)
- No consolidated hooks found in settings.json
- routing-guard properly registered 3 times (PreToolUse Task, TaskCreate, etc.)

**Result**: ARCH-002 resolved. Consolidated hooks marked as legacy, reference maintained, unified hook functional.

---

## Documentation Pattern: Bidirectional Cross-References (DOC-001 Resolution) (2026-01-27)

**Completed**: Fixed 4 skill-workflow pairs + architect.md missing cross-references

**Files Updated**:

- Skills (4): architecture-review, consensus-voting, database-architect, swarm-coordination
- Workflows (4): architecture-review-skill-workflow, consensus-voting-skill-workflow, database-architect-skill-workflow, swarm-coordination-skill-workflow
- Agents (1): architect.md

**Pattern Applied**:

1. **In Skills** - Add "Related Workflow" section:

   ```markdown
   ## Related Workflow

   This skill has a corresponding workflow for complex multi-agent scenarios:

   - **Workflow**: `.claude/workflows/<name>-skill-workflow.md`
   - **When to use workflow**: For comprehensive [use case description]
   - **When to use skill directly**: For quick [simple use case]
   ```

2. **In Workflows** - Add "Related Skill" section (BEFORE Agent-Skill Mapping):

   ```markdown
   ## Related Skill

   This workflow implements the structured process for the corresponding skill:

   - **Skill**: `.claude/skills/<name>/SKILL.md`
   - **Invoke skill**: `Skill({ skill: "<name>" })`
   - **Relationship**: Workflow provides multi-agent orchestration; skill provides core capabilities
   ```

3. **In Agents** - Add "Related Workflows" section (AFTER Skill Invocation Protocol):

   ```markdown
   ## Related Workflows

   The [agent-name] agent can leverage these workflows for comprehensive analysis:

   - **[Workflow Name]**: `.claude/workflows/<path>/<workflow>.md`
   - **[Workflow Name]**: `.claude/workflows/<path>/<workflow>.md` (for [use case])
   ```

**Result**: All 8 pointer gaps resolved (DOC-001, POINTER-003). Framework now has complete bidirectional cross-references between skills, workflows, and agents.

**Next Steps**: Template this pattern into creator skills (skill-creator, workflow-creator, agent-creator) to prevent future gaps.
