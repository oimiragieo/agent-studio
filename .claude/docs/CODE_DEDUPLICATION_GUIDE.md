# Code Deduplication Guide

Step-by-step process for identifying and resolving code duplication across the framework.

## Overview

Code duplication leads to:

- Maintenance burden (fix in N places instead of 1)
- Inconsistent behavior when fixes are applied to some but not all copies
- Increased codebase size and cognitive load
- Higher risk of bugs (divergent implementations)

This guide provides a systematic approach to identifying duplication and consolidating it into shared utilities.

## When to Deduplicate

**High Priority**:

- Same function copy-pasted across 5+ files
- Utility logic duplicated across hooks (parseHookInput, findProjectRoot)
- State file access patterns repeated in multiple hooks
- Error handling patterns duplicated

**Medium Priority**:

- Similar but not identical implementations across 3-4 files
- Configuration patterns duplicated across modules
- Test helper code duplicated across test files

**Lower Priority**:

- Simple one-liner utilities (may not be worth abstracting)
- Code that varies slightly by context (may need parameterization)

## Identification Techniques

### Technique 1: Grep for Known Patterns

Search for common duplicated function names:

```bash
# Find duplicated parseHookInput functions
grep -r "function parseHookInput" .claude/hooks/

# Find duplicated findProjectRoot functions
grep -r "function findProjectRoot" .claude/

# Find duplicated state file reading
grep -r "fs.readFileSync.*router-state.json" .claude/hooks/

# Find duplicated atomic write patterns
grep -r "writeFileSync.*tmp-" .claude/
```

### Technique 2: Line Count Analysis

Identify functions with similar line counts:

```bash
# Count lines per function (approximate)
grep -n "^function\|^async function\|const .* = function\|const .* = async" .claude/hooks/**/*.cjs
```

### Technique 3: Code Review Patterns

Look for these patterns during code review:

- Multiple hooks requiring the same utility
- Copy-paste comments like "// Same as in X.cjs"
- Similar try-catch patterns for state file operations
- Repeated path resolution logic

### Technique 4: Issue Tracking

Track duplication issues:

```markdown
## [HOOK-001] parseHookInput() Duplication

- **Files**: 40+ hooks
- **Lines Duplicated**: ~2000 lines total
- **Fix**: Use shared .claude/lib/utils/hook-input.cjs
```

## Resolution Process

### Step 1: Identify the Canonical Implementation

Choose the best existing implementation or write a new one:

- Most complete feature set
- Best error handling
- Best test coverage
- Cleanest code structure

### Step 2: Create Shared Utility

Location: `.claude/lib/utils/<utility-name>.cjs`

Template:

```javascript
#!/usr/bin/env node
/**
 * <Utility Name> - Shared utility for <purpose>
 *
 * Eliminates duplicated <function-name>() function across <N>+ files.
 * Provides <list key features>.
 *
 * Usage:
 *   const { functionName, anotherFunction } = require('../../lib/utils/<utility-name>.cjs');
 *
 * @module <utility-name>
 */

'use strict';

/**
 * <Description>
 * @param {<type>} param - <description>
 * @returns {<type>} <description>
 */
function functionName(param) {
  // Implementation
}

module.exports = {
  functionName,
  // Export constants too
  SOME_CONSTANT,
};
```

### Step 3: Add Comprehensive Tests

Location: `.claude/lib/utils/<utility-name>.test.cjs`

```javascript
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const { functionName } = require('./<utility-name>.cjs');

describe('<utility-name>', () => {
  describe('functionName', () => {
    it('should handle normal input', () => {
      const result = functionName(normalInput);
      assert.strictEqual(result, expectedOutput);
    });

    it('should handle edge cases', () => {
      // Test null, undefined, empty, malformed input
    });

    it('should handle errors gracefully', () => {
      // Test error paths
    });
  });
});
```

### Step 4: Refactor Consumers

Replace duplicated code with imports:

```javascript
// BEFORE (12+ lines in each file):
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();

// AFTER (1 line):
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');
```

### Step 5: Verify All Consumers

Run tests for all refactored files:

```bash
# Run specific test file
node --test .claude/hooks/routing/hook-name.test.cjs

# Run all hook tests
node --test .claude/hooks/**/*.test.cjs

# Run all tests
npm test
```

### Step 6: Document the Consolidation

Update memory:

```markdown
## [Date] Consolidated <utility-name>

- **Pattern**: Duplicated <function-name>() across <N> files
- **Resolution**: Created shared utility at .claude/lib/utils/<utility-name>.cjs
- **Files Modified**: <list>
- **Lines Saved**: ~<N> lines
- **Tests**: <N>/<N> pass
```

## Case Studies

### Case Study 1: parseHookInput() Consolidation (HOOK-001)

**Problem**: ~2000 lines duplicated across 40+ hook files

**Pattern Before**:

```javascript
// Each hook had this ~50 lines:
function parseHookInput() {
  const chunks = [];
  process.stdin.setEncoding('utf8');
  // ... parsing logic ...
  return input;
}
```

**Solution Created**: `.claude/lib/utils/hook-input.cjs`

**Features**:

- `parseHookInputSync()` - Synchronous parsing
- `parseHookInputAsync()` - Async with timeout
- `getToolName(input)` - Extract tool name from various input formats
- `getToolInput(input)` - Extract tool parameters
- `getToolOutput(input)` - Extract tool result
- `isEnabled(envVar, defaultMode)` - Check enforcement mode
- `auditLog(hook, event, extra)` - Structured audit logging
- `debugLog(hook, message, error)` - Conditional debug logging
- `auditSecurityOverride(hook, envVar, value, impact)` - Security override audit

**Usage**:

```javascript
const { parseHookInputAsync, getToolName, auditLog } = require('../../lib/utils/hook-input.cjs');

async function main() {
  const input = await parseHookInputAsync();
  const toolName = getToolName(input);
  auditLog('my-hook', 'tool_used', { tool: toolName });
}
```

**Result**: 44 hooks refactored, ~2000 lines eliminated

### Case Study 2: findProjectRoot() Consolidation (HOOK-002/PERF-007)

**Problem**: ~200 lines duplicated across 20+ files

**Pattern Before**:

```javascript
// Each file had this ~12 lines:
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();
```

**Solution Created**: `.claude/lib/utils/project-root.cjs`

**Features**:

- `PROJECT_ROOT` - Pre-computed project root (use this for efficiency)
- `findProjectRoot(startDir)` - Dynamic lookup from any starting point
- `validatePathWithinProject(path)` - Path traversal prevention (CRITICAL-001)
- `sanitizePath(path)` - Safe path resolution with validation

**Usage**:

```javascript
// Most common usage (pre-computed, efficient):
const { PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');

// Dynamic lookup (rare):
const { findProjectRoot } = require('../../lib/utils/project-root.cjs');
const root = findProjectRoot(someOtherDir);

// Path validation (security):
const { sanitizePath } = require('../../lib/utils/project-root.cjs');
const safePath = sanitizePath(userProvidedPath);
```

**Result**: 5+ files refactored, ~49 lines eliminated, path traversal prevention added

### Case Study 3: Audit Logging Consolidation (HOOK-006)

**Problem**: Inconsistent logging formats across hooks

**Pattern Before**:

```javascript
// Some hooks:
console.error(JSON.stringify({ event: 'blocked', reason: 'x' }));

// Other hooks:
console.warn('Hook blocked: x');

// Others:
// No logging at all
```

**Solution**: Added to `hook-input.cjs`

**Features**:

- `auditLog(hookName, event, extra)` - JSON to stderr with timestamp
- `debugLog(hookName, message, error)` - Conditional on DEBUG_HOOKS
- `auditSecurityOverride(hookName, envVar, value, impact)` - Security audit trail

**Format**:

```json
{
  "hook": "routing-guard",
  "event": "tool_blocked",
  "timestamp": "2026-01-28T10:30:00.000Z",
  "tool": "Glob",
  "reason": "blacklisted for Router"
}
```

**Result**: 9 hooks standardized, 28 logging calls updated, consistent audit trail

## Shared Utilities Reference

| Utility      | Location                             | Exports                                                                | Purpose                                    |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------ |
| hook-input   | `.claude/lib/utils/hook-input.cjs`   | parseHookInputSync, parseHookInputAsync, getToolName, auditLog, etc.   | Hook input parsing and logging             |
| project-root | `.claude/lib/utils/project-root.cjs` | PROJECT_ROOT, findProjectRoot, validatePathWithinProject, sanitizePath | Project root discovery and path validation |
| safe-json    | `.claude/lib/utils/safe-json.cjs`    | safeParseState, safeStringifyState, STATE_SCHEMAS                      | State file parsing with schema validation  |
| atomic-write | `.claude/lib/utils/atomic-write.cjs` | atomicWriteSync, atomicWriteAsync                                      | Atomic file operations with locking        |
| state-cache  | `.claude/lib/utils/state-cache.cjs`  | getCachedState, setCachedState, invalidateCache                        | State file caching to reduce I/O           |
| platform     | `.claude/lib/utils/platform.cjs`     | isWindows, bashPath, normalizePathForPlatform                          | Cross-platform utilities                   |

## Import Path Convention

From hooks: `require('../../lib/utils/<utility>.cjs')`
From lib modules: `require('../utils/<utility>.cjs')`
From tools: `require('../../lib/utils/<utility>.cjs')`

## Checklist

### Before Starting

- [ ] Identified all files with duplication
- [ ] Chose canonical implementation
- [ ] Planned shared utility location

### During Implementation

- [ ] Created shared utility with JSDoc
- [ ] Added comprehensive tests
- [ ] Refactored all consumers
- [ ] Ran tests for each refactored file

### After Completion

- [ ] All tests pass
- [ ] Documentation updated (this guide, learnings.md)
- [ ] Issue marked as RESOLVED in issues.md

## Related Documentation

- **Hook Consolidation Workflow**: `.claude/workflows/operations/hook-consolidation.md`
- **File Placement Rules**: `.claude/docs/FILE_PLACEMENT_RULES.md`
- **Memory Learnings**: `.claude/context/memory/learnings.md`
