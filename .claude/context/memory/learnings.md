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
