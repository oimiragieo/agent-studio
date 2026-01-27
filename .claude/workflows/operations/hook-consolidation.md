# Hook Consolidation Workflow

Step-by-step process for safely consolidating hooks to reduce I/O overhead and improve performance.

## Overview

Hook consolidation reduces the number of hook invocations per tool operation by combining related hooks into unified modules. This workflow ensures safe consolidation without breaking existing functionality.

## When to Use

- Multiple hooks share the same event and matcher
- Hooks have redundant file I/O operations
- Performance profiling identifies hook overhead as a bottleneck
- Code review identifies hook duplication

## Prerequisites

1. **Test Coverage**: All hooks being consolidated must have passing tests
2. **Backup**: Create backup of hooks before consolidation
3. **State Understanding**: Understand shared state dependencies between hooks

## Workflow Phases

```
[Phase 1: Analysis] --> [Phase 2: Planning] --> [Phase 3: Implementation] --> [Phase 4: Testing] --> [Phase 5: Deployment]
```

## Phase 1: Analysis

### Step 1.1: Identify Consolidation Candidates

Find hooks that can be consolidated:

```bash
# List all hooks by event type
grep -r "Event:" .claude/hooks/ | sort

# Find hooks with same matcher pattern
grep -r "matcher" .claude/settings.json
```

**Consolidation Candidates Criteria**:

- Same event type (PreToolUse, PostToolUse, etc.)
- Same or compatible matcher patterns
- Related functionality (e.g., all routing hooks)
- Shared state dependencies

### Step 1.2: Analyze Dependencies

Map dependencies between hooks:

```
Hook A --> router-state.cjs
Hook B --> router-state.cjs
Hook C --> safe-json.cjs, atomic-write.cjs

Shared State:
- router-state.json (read by A, B)
- loop-state.json (read by C)
```

### Step 1.3: Measure Current Performance

Benchmark before consolidation:

```bash
# Enable hook timing
DEBUG_HOOKS=true HOOK_TIMING=true claude

# Measure individual hook execution times
time node .claude/hooks/routing/hook-a.cjs < test-input.json
time node .claude/hooks/routing/hook-b.cjs < test-input.json
```

Document baseline metrics:

- Total hook execution time per tool operation
- Number of file I/O operations
- Memory usage

## Phase 2: Planning

### Step 2.1: Design Consolidated Architecture

Create consolidation design:

```markdown
## Consolidation: Router Enforcement Hooks

### Before (3 hooks, 3 processes, 6 file reads)

1. router-mode-reset.cjs - reads router-state.json
2. router-enforcer.cjs - reads router-state.json, CLAUDE.md
3. task-create-guard.cjs - reads router-state.json

### After (1 hook, 1 process, 2 file reads)

1. router-enforcement-unified.cjs
   - Combines all router enforcement logic
   - Single router-state.json read (cached)
   - Single CLAUDE.md read (cached)
```

### Step 2.2: Create Migration Plan

Document the migration:

```markdown
## Migration Plan

### Phase A: Create unified hook

- [ ] Create router-enforcement-unified.cjs
- [ ] Implement combined validation logic
- [ ] Add comprehensive tests

### Phase B: Parallel testing

- [ ] Run both old and new hooks in parallel
- [ ] Compare results for discrepancies
- [ ] Fix any inconsistencies

### Phase C: Switchover

- [ ] Update settings.json to use unified hook
- [ ] Keep old hooks as backup (renamed with .bak)
- [ ] Monitor for issues

### Phase D: Cleanup

- [ ] Remove backup hooks after 1 week
- [ ] Update documentation
- [ ] Archive migration notes
```

### Step 2.3: Define Rollback Plan

```markdown
## Rollback Plan

### Trigger Conditions

- Unified hook fails validation tests
- Production errors increase after deployment
- Performance regression detected

### Rollback Steps

1. Restore original settings.json from backup
2. Restart Claude Code session
3. Verify original hooks functioning
4. Investigate unified hook issues
```

## Phase 3: Implementation

### Step 3.1: Create Unified Hook

Template for consolidated hook:

```javascript
#!/usr/bin/env node
/**
 * Unified Router Enforcement Hook
 *
 * Consolidates:
 * - router-mode-reset.cjs
 * - router-enforcer.cjs
 * - task-create-guard.cjs
 *
 * Event: PreToolUse
 * Matcher: Task|TaskCreate
 *
 * Performance: Reduces 3 processes to 1, 6 file reads to 2
 */

'use strict';

const routerState = require('./router-state.cjs');
const { getCachedState } = require('../../lib/utils/state-cache.cjs');

// =============================================================================
// Consolidated Validation Logic
// =============================================================================

/**
 * Run all router enforcement checks
 */
function runEnforcementChecks(hookInput) {
  const results = [];

  // Check 1: Mode reset (from router-mode-reset.cjs)
  results.push(checkModeReset(hookInput));

  // Check 2: Router enforcement (from router-enforcer.cjs)
  results.push(checkRouterEnforcement(hookInput));

  // Check 3: Task create guard (from task-create-guard.cjs)
  results.push(checkTaskCreateGuard(hookInput));

  // Return first failure, or success
  const failure = results.find(r => !r.valid);
  return failure || { valid: true };
}

// ... implementation of individual checks ...

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  try {
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // Fail closed for security
      process.exit(2);
    }

    const result = runEnforcementChecks(hookInput);

    if (!result.valid) {
      console.log(result.message);
      process.exit(2);
    }

    process.exit(0);
  } catch (err) {
    console.error('Unified enforcement error:', err.message);
    process.exit(2); // Fail closed
  }
}

if (require.main === module) {
  main();
}

module.exports = { runEnforcementChecks };
```

### Step 3.2: Preserve Original Logic

When consolidating, preserve exact behavior:

```javascript
// ORIGINAL (router-mode-reset.cjs)
function resetMode() {
  routerState.resetToRouterMode();
}

// CONSOLIDATED (preserve exact logic)
function checkModeReset(hookInput) {
  // Exact same logic as original
  routerState.resetToRouterMode();
  return { valid: true };
}
```

### Step 3.3: Add Comprehensive Tests

```javascript
// unified-hook.test.cjs

const { runEnforcementChecks } = require('./unified-hook.cjs');

// Test that consolidated behavior matches original
async function testConsolidatedBehavior() {
  // Run original hooks
  const originalResults = await runOriginalHooks(testInput);

  // Run consolidated hook
  const consolidatedResult = runEnforcementChecks(testInput);

  // Compare results
  assert.deepStrictEqual(
    consolidatedResult,
    originalResults,
    'Consolidated behavior must match original'
  );
}
```

## Phase 4: Testing

### Step 4.1: Unit Tests

Run tests for consolidated hook:

```bash
node .claude/hooks/routing/unified-hook.test.cjs
```

### Step 4.2: Integration Tests

Test with actual Claude Code operations:

```bash
# Test with various tool operations
DEBUG_HOOKS=true claude -p "Create a simple test file"
DEBUG_HOOKS=true claude -p "List files in current directory"
DEBUG_HOOKS=true claude -p "Fix a bug in app.ts"
```

### Step 4.3: Performance Comparison

Compare before/after metrics:

```bash
# Before consolidation
HOOK_TIMING=true claude -p "test" > before.log 2>&1

# After consolidation
HOOK_TIMING=true claude -p "test" > after.log 2>&1

# Compare timing
grep "hook execution" before.log after.log
```

### Step 4.4: Parallel Running

Run both old and new hooks to compare:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task|TaskCreate",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/routing/unified-hook.cjs" },
          { "type": "command", "command": "node .claude/hooks/routing/original-hook-a.cjs" }
        ]
      }
    ]
  }
}
```

## Phase 5: Deployment

### Step 5.1: Backup Original Hooks

```bash
# Create backup directory
mkdir -p .claude/hooks/_backup/$(date +%Y%m%d)

# Backup original hooks
cp .claude/hooks/routing/router-mode-reset.cjs .claude/hooks/_backup/$(date +%Y%m%d)/
cp .claude/hooks/routing/router-enforcer.cjs .claude/hooks/_backup/$(date +%Y%m%d)/
cp .claude/hooks/routing/task-create-guard.cjs .claude/hooks/_backup/$(date +%Y%m%d)/

# Backup settings.json
cp .claude/settings.json .claude/hooks/_backup/$(date +%Y%m%d)/
```

### Step 5.2: Update settings.json

Replace individual hooks with unified hook:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task|TaskCreate",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/routing/unified-enforcement.cjs" }
        ]
      }
    ]
  }
}
```

### Step 5.3: Verify Deployment

```bash
# Test basic operations
claude -p "Hello" && echo "Basic test passed"

# Test hook-specific functionality
claude -p "Create a complex feature" && echo "Complex test passed"

# Check for errors
grep -i error ~/.claude/logs/*.log | tail -20
```

### Step 5.4: Monitor for Issues

Monitor for 24-48 hours:

- Check for unexpected blocking
- Monitor error rates
- Verify memory usage is stable
- Check hook execution times

### Step 5.5: Cleanup

After successful monitoring period:

```bash
# Remove backup files (after 1 week)
rm -rf .claude/hooks/_backup/YYYYMMDD/

# Update documentation
# Record consolidation in learnings.md
```

## Consolidation Checklist

### Before Starting

- [ ] All hooks have passing tests
- [ ] Performance baseline documented
- [ ] Rollback plan defined
- [ ] Backup created

### During Implementation

- [ ] Unified hook preserves exact behavior
- [ ] All original tests pass on unified hook
- [ ] New tests cover edge cases
- [ ] Performance improved

### After Deployment

- [ ] settings.json updated
- [ ] Parallel testing completed
- [ ] No production errors
- [ ] Documentation updated

## Performance Targets

| Metric              | Before | After | Target               |
| ------------------- | ------ | ----- | -------------------- |
| Hooks per operation | N      | 1     | Minimize             |
| File reads          | M      | 2-3   | Maximize cache usage |
| Execution time      | X ms   | Y ms  | 50% reduction        |
| Process spawns      | N      | 1     | Single process       |

## Related Documentation

- **Hooks Reference**: `.claude/docs/HOOKS_REFERENCE.md`
- **Hook Development Guide**: `.claude/docs/HOOK_DEVELOPMENT_GUIDE.md`
- **State Cache Utility**: `.claude/lib/utils/state-cache.cjs`
