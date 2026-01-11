# Hook Code Review - Deep Dive Analysis

## Date: 2026-01-XX

## Reviewer: AI Code Reviewer

## Status: Critical Issues Found - Fixes Required

---

## Executive Summary

**Overall Assessment**: ⚠️ **MIXED** - Some hooks are well-implemented, but critical memory leak issues remain in orchestrator-enforcement hook.

**Critical Issues**: 2  
**High Priority Issues**: 3  
**Medium Priority Issues**: 2  
**Low Priority Issues**: 1

---

## Hook-by-Hook Analysis

### 1. orchestrator-enforcement-pre-tool.mjs ⚠️ **CRITICAL ISSUES**

#### ✅ **Good Fixes Applied:**

- ✅ Recursion protection guard added
- ✅ Timeout protection (2 seconds)
- ✅ Improved agent role detection (env variables take precedence)
- ✅ Role change detection and reset
- ✅ Proper cleanup in finally block

#### ❌ **CRITICAL ISSUES:**

**Issue #1: Synchronous File I/O on Every Call** 🔴 **MEMORY LEAK**

```javascript
// Line 127, 161, 189, 296, 332, 360, 376, 397
readFileSync(SESSION_STATE_PATH, 'utf-8'); // BLOCKS
writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2)); // BLOCKS
```

**Problem**:

- Reads session state file on EVERY tool call (even for non-orchestrators)
- Writes session state on EVERY Read call (line 397)
- Synchronous I/O blocks Node.js event loop
- With 100+ Read calls, this causes memory buildup

**Impact**: **HIGH** - This is the primary cause of memory exhaustion crashes

**Recommendation**:

```javascript
// Use async I/O with caching
let sessionStateCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

async function loadSessionState() {
  const now = Date.now();
  if (sessionStateCache && now - lastCacheTime < CACHE_TTL) {
    return sessionStateCache;
  }

  try {
    const content = await readFile(SESSION_STATE_PATH, 'utf-8');
    sessionStateCache = JSON.parse(content);
    lastCacheTime = now;
    return sessionStateCache;
  } catch (e) {
    // Initialize new state
    return createNewState();
  }
}

// Batch writes - only write every N operations or after delay
let pendingWrite = null;
function saveSessionState(state, immediate = false) {
  sessionStateCache = state;

  if (immediate) {
    clearTimeout(pendingWrite);
    writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2)).catch(() => {});
  } else {
    // Debounce writes - batch multiple saves
    clearTimeout(pendingWrite);
    pendingWrite = setTimeout(() => {
      writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2)).catch(() => {});
    }, 1000); // Write after 1 second of inactivity
  }
}
```

**Issue #2: Unbounded Violations Array** 🔴 **MEMORY LEAK**

```javascript
// Line 295, 331, 375
state.violations.push(blockViolation); // No size limit!
```

**Problem**: Violations array grows indefinitely, consuming memory

**Impact**: **HIGH** - Long sessions accumulate thousands of violations

**Recommendation**:

```javascript
const MAX_VIOLATIONS = 100;

function addViolation(state, violation) {
  state.violations.push(violation);

  // Keep only last N violations
  if (state.violations.length > MAX_VIOLATIONS) {
    state.violations = state.violations.slice(-MAX_VIOLATIONS);
  }
}
```

**Issue #3: No Early Exit for Non-Orchestrators** 🟡 **PERFORMANCE**

```javascript
// Line 265 - Loads session state BEFORE checking if orchestrator
const state = loadSessionState(); // Reads file even for subagents!

if (state.agent_role !== 'orchestrator') {
  // Too late - already read file
  return;
}
```

**Problem**: Reads session state file even when agent is not an orchestrator

**Impact**: **MEDIUM** - Unnecessary file I/O for every subagent tool call

**Recommendation**:

```javascript
// Check role FIRST before loading state
const currentRole = detectAgentRole();
if (currentRole !== 'orchestrator') {
  console.log(JSON.stringify({ decision: 'allow' }));
  return;
}

// Only load state if we're an orchestrator
const state = loadSessionState();
```

**Issue #4: Saves State on Every Read Call** 🔴 **MEMORY LEAK**

```javascript
// Line 397 - Saves state on EVERY Read call, even when allowing
case 'COUNT_LIMITED':
  state.read_count += 1;
  if (state.read_count > rule.max_count) {
    // ... block logic
  } else {
    saveSessionState(state);  // WRITES FILE ON EVERY READ!
    console.log(JSON.stringify({ decision: 'allow' }));
  }
```

**Problem**: Writes to disk on every Read call (could be 100+ times per session)

**Impact**: **HIGH** - Excessive disk I/O causes memory buildup

**Recommendation**: Use batched/debounced writes (see Issue #1)

---

### 2. file-path-validator.js ✅ **GOOD**

#### ✅ **Strengths:**

- ✅ Recursion protection
- ✅ Timeout protection (1 second)
- ✅ Skips Task/TodoWrite tools
- ✅ Good error handling (fail-open)
- ✅ Proper cleanup in finally block
- ✅ Uses async stdin reading

#### 🟡 **Minor Issues:**

**Issue #1: Synchronous Schema Read at Module Load**

```javascript
// Line 66 - Runs at module load time
const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');
```

**Impact**: **LOW** - Only runs once, but could fail if schema missing

**Recommendation**: Wrap in try-catch (already done, but could be clearer)

**Verdict**: ✅ **APPROVED** - This hook is well-implemented

---

### 3. security-pre-tool.mjs ✅ **GOOD**

#### ✅ **Strengths:**

- ✅ Recursion protection
- ✅ Timeout protection (1 second)
- ✅ Skips Task/TodoWrite tools
- ✅ Good error handling (fail-open)
- ✅ Proper cleanup in finally block
- ✅ Uses async stdin reading
- ✅ Comprehensive dangerous pattern detection

#### 🟡 **Minor Issues:**

**Issue #1: Timeout Cleanup**

```javascript
// Line 18-23 - Timeout doesn't clean up env var
setTimeout(() => {
  stderr.write('[SECURITY HOOK] Timeout exceeded, allowing by default\n');
  stdout.write(JSON.stringify({ decision: 'allow', warning: 'Hook timeout' }));
  delete process.env.CLAUDE_SECURITY_HOOK_EXECUTING; // ✅ Good
  process.exit(0);
}, 1000);
```

**Verdict**: ✅ **APPROVED** - This hook is well-implemented

---

### 4. audit-post-tool.mjs ✅ **GOOD IMPROVEMENTS**

#### ✅ **Strengths:**

- ✅ Recursion protection
- ✅ Retry logic with exponential backoff (excellent!)
- ✅ Fire-and-forget trimming (non-blocking)
- ✅ Uses async file I/O
- ✅ Good error handling
- ✅ Skips Task/TodoWrite tools

#### 🟡 **Issues:**

**Issue #1: Timeout Exits with Error Code**

```javascript
// Line 28-31
setTimeout(() => {
  console.error('[AUDIT HOOK] Timeout exceeded, forcing exit');
  process.exit(1); // ❌ Should be 0 (fail-open)
}, 2000);
```

**Problem**: Exiting with code 1 might cause Claude Code to treat it as an error

**Impact**: **MEDIUM** - Could cause hook to be marked as failed

**Recommendation**:

```javascript
setTimeout(() => {
  console.error('[AUDIT HOOK] Timeout exceeded, forcing exit');
  delete process.env.CLAUDE_AUDIT_HOOK_EXECUTING;
  process.exit(0); // ✅ Fail-open
}, 2000);
```

**Issue #2: Missing Cleanup in Timeout**

```javascript
// Timeout doesn't clean up env var
setTimeout(() => {
  // ... should delete process.env.CLAUDE_AUDIT_HOOK_EXECUTING
}, 2000);
```

**Verdict**: 🟡 **NEEDS MINOR FIX** - Overall good, but timeout handling needs improvement

---

### 5. orchestrator-audit-post-tool.mjs ⚠️ **MISSING PROTECTIONS**

#### ✅ **Strengths:**

- ✅ Skips non-orchestrator sessions
- ✅ Good error handling

#### ❌ **CRITICAL ISSUES:**

**Issue #1: No Recursion Protection** 🔴

```javascript
// Missing recursion guard!
```

**Problem**: Could trigger itself if audit logging spawns tools

**Impact**: **HIGH** - Potential infinite loop

**Recommendation**:

```javascript
if (process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING === 'true') {
  process.exit(0);
}
process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING = 'true';
```

**Issue #2: No Timeout Protection** 🔴

```javascript
// Missing timeout!
```

**Problem**: Could hang indefinitely

**Impact**: **HIGH** - Could cause system hangs

**Recommendation**:

```javascript
const timeout = setTimeout(() => {
  delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  process.exit(0);
}, 2000);
```

**Issue #3: Synchronous File I/O** 🟡

```javascript
// Line 24, 47-49
readFileSync(SESSION_STATE_PATH, 'utf-8')
writeFileSync(AUDIT_LOG_PATH, ...)
```

**Problem**: Blocks event loop

**Impact**: **MEDIUM** - Performance issue

**Recommendation**: Use async I/O (`readFile`, `appendFile`)

**Issue #4: No Error Handling Wrapper** 🟡

```javascript
// Line 111-113
main().catch(error => {
  console.error('Audit hook error:', error);
  // ❌ Doesn't exit or clean up
});
```

**Problem**: Process might hang on error

**Impact**: **MEDIUM** - Could cause process leaks

**Recommendation**:

```javascript
main()
  .catch(error => {
    console.error('Audit hook error:', error);
    delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
    process.exit(0);
  })
  .finally(() => {
    clearTimeout(timeout);
    delete process.env.CLAUDE_ORCHESTRATOR_AUDIT_EXECUTING;
  });
```

**Verdict**: ❌ **NEEDS FIXES** - Missing critical protections

---

### 6. post-session-cleanup.js ✅ **GOOD**

#### ✅ **Strengths:**

- ✅ Uses async file I/O
- ✅ Good error handling (fail-silent)
- ✅ Non-blocking cleanup
- ✅ Proper logging

#### 🟡 **Minor Issues:**

**Issue #1: No Recursion Protection** 🟡

```javascript
// Missing recursion guard
```

**Impact**: **LOW** - Unlikely to recurse, but good practice

**Recommendation**: Add recursion guard for consistency

**Verdict**: ✅ **APPROVED** - Well-implemented, minor improvement possible

---

## Summary of Required Fixes

### 🔴 **CRITICAL (Must Fix Before Production):**

1. **orchestrator-enforcement-pre-tool.mjs**:
   - Replace synchronous file I/O with async + caching
   - Add early exit for non-orchestrators (check role before loading state)
   - Implement batched/debounced writes
   - Cap violations array size (max 100)

2. **orchestrator-audit-post-tool.mjs**:
   - Add recursion protection
   - Add timeout protection
   - Replace synchronous file I/O with async
   - Add proper error handling wrapper

### 🟡 **HIGH PRIORITY (Should Fix Soon):**

3. **audit-post-tool.mjs**:
   - Fix timeout to exit with code 0
   - Add cleanup in timeout handler

4. **post-session-cleanup.js**:
   - Add recursion protection (defensive)

### 🟢 **LOW PRIORITY (Nice to Have):**

5. **file-path-validator.js**:
   - Already good, no changes needed

6. **security-pre-tool.mjs**:
   - Already good, no changes needed

---

## Performance Impact Analysis

### Current Performance (Estimated):

| Hook                              | Calls/Session | File I/O               | Memory Impact | Status   |
| --------------------------------- | ------------- | ---------------------- | ------------- | -------- |
| orchestrator-enforcement-pre-tool | 100+          | 200+ sync reads/writes | 🔴 HIGH       | Critical |
| file-path-validator               | 100+          | 0 (cached)             | 🟢 LOW        | Good     |
| security-pre-tool                 | 50+           | 0                      | 🟢 LOW        | Good     |
| audit-post-tool                   | 100+          | 100+ async writes      | 🟡 MEDIUM     | Good     |
| orchestrator-audit-post-tool      | 100+          | 200+ sync reads/writes | 🔴 HIGH       | Critical |
| post-session-cleanup              | 20+           | 20+ async ops          | 🟢 LOW        | Good     |

### After Fixes (Projected):

| Hook                              | Calls/Session | File I/O           | Memory Impact | Status |
| --------------------------------- | ------------- | ------------------ | ------------- | ------ |
| orchestrator-enforcement-pre-tool | 100+          | ~10 batched writes | 🟢 LOW        | Fixed  |
| orchestrator-audit-post-tool      | 100+          | 100+ async writes  | 🟡 MEDIUM     | Fixed  |

---

## Code Quality Metrics

### Overall Scores:

| Hook                              | Error Handling | Performance | Memory Safety | Code Quality | Score |
| --------------------------------- | -------------- | ----------- | ------------- | ------------ | ----- |
| orchestrator-enforcement-pre-tool | ✅ Good        | ❌ Poor     | ❌ Poor       | ✅ Good      | 5/10  |
| file-path-validator               | ✅ Excellent   | ✅ Good     | ✅ Good       | ✅ Good      | 9/10  |
| security-pre-tool                 | ✅ Excellent   | ✅ Good     | ✅ Good       | ✅ Good      | 9/10  |
| audit-post-tool                   | ✅ Good        | ✅ Good     | ✅ Good       | ✅ Good      | 8/10  |
| orchestrator-audit-post-tool      | 🟡 Fair        | ❌ Poor     | 🟡 Fair       | 🟡 Fair      | 4/10  |
| post-session-cleanup              | ✅ Good        | ✅ Good     | ✅ Good       | ✅ Good      | 8/10  |

---

## Recommendations

### Immediate Actions:

1. **Fix orchestrator-enforcement-pre-tool.mjs** (Priority 1)
   - This is causing the memory crashes
   - Implement async I/O + caching
   - Add early exit optimization

2. **Fix orchestrator-audit-post-tool.mjs** (Priority 2)
   - Add missing protections
   - Convert to async I/O

3. **Fix audit-post-tool.mjs timeout** (Priority 3)
   - Quick fix, low risk

### Testing Plan:

1. **Load Testing**:
   - Simulate 500+ tool calls in a session
   - Monitor memory usage
   - Verify no crashes

2. **Performance Testing**:
   - Measure hook execution time
   - Verify async I/O doesn't block
   - Check file I/O frequency

3. **Edge Case Testing**:
   - Test with missing files
   - Test with corrupted state files
   - Test timeout scenarios
   - Test recursion scenarios

---

## Conclusion

**Overall Assessment**: The hooks show good architectural thinking and error handling patterns, but **critical memory leak issues** remain in the orchestrator enforcement hook. The synchronous file I/O and unbounded violations array are the primary causes of memory exhaustion crashes.

**Recommendation**: **Fix critical issues before re-enabling in production**. The fixes are straightforward and will significantly improve stability.

**Estimated Fix Time**: 2-3 hours for critical fixes, 1 hour for high-priority fixes.

---

## Appendix: Code Examples

### Example: Async Session State with Caching

```javascript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

let sessionStateCache = null;
let lastCacheTime = 0;
let pendingWrite = null;
const CACHE_TTL = 5000; // 5 seconds
const WRITE_DEBOUNCE = 1000; // 1 second

async function loadSessionState() {
  const now = Date.now();

  // Return cached state if fresh
  if (sessionStateCache && now - lastCacheTime < CACHE_TTL) {
    return sessionStateCache;
  }

  // Check role first (early exit optimization)
  const currentRole = detectAgentRole();
  if (currentRole !== 'orchestrator') {
    return null; // Don't even load state for non-orchestrators
  }

  try {
    if (existsSync(SESSION_STATE_PATH)) {
      const content = await readFile(SESSION_STATE_PATH, 'utf-8');
      const state = JSON.parse(content);

      // Update role if changed
      if (state.agent_role !== currentRole) {
        state.agent_role = currentRole;
        state.read_count = 0;
        state.violations = [];
      }

      // Cap violations array
      if (state.violations.length > 100) {
        state.violations = state.violations.slice(-100);
      }

      sessionStateCache = state;
      lastCacheTime = now;
      return state;
    }
  } catch (e) {
    // Ignore errors, create new state
  }

  // Create new state
  const newState = {
    session_id: `sess_${Date.now()}`,
    agent_role: currentRole,
    read_count: 0,
    violations: [],
    created_at: new Date().toISOString(),
  };

  sessionStateCache = newState;
  lastCacheTime = now;
  return newState;
}

function saveSessionState(state, immediate = false) {
  sessionStateCache = state;

  if (immediate) {
    clearTimeout(pendingWrite);
    writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2)).catch(() => {}); // Fail silently
  } else {
    // Debounce writes
    clearTimeout(pendingWrite);
    pendingWrite = setTimeout(() => {
      writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2)).catch(() => {}); // Fail silently
    }, WRITE_DEBOUNCE);
  }
}
```
