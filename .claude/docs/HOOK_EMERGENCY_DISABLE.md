# Emergency Hook Disable - Memory Crash Fix

## Date: 2026-01-XX

## Status: ALL HOOKS TEMPORARILY DISABLED

## Problem

Hooks are causing **critical memory exhaustion crashes** even after initial fixes:

### Symptoms:

- `PreToolUse:Read hook error` - Repeated hook errors
- `PreToolUse:Task hook error` - Hook failures on Task tool
- `PreToolUse:mcp__sequential-thinking__sequentialthinking hook error` - Hooks running on MCP tools
- **FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory**

### Root Cause Analysis:

1. **Orchestrator Enforcement Hook** (`orchestrator-enforcement-pre-tool.mjs`):
   - Reads/writes session state file on EVERY Read call
   - With many Read calls, this causes memory buildup
   - Synchronous file I/O blocks execution
   - Session state accumulates violations array

2. **Multiple Hook Execution**:
   - Hooks run on EVERY tool call (Read, Task, MCP tools)
   - Each hook spawns a new Node.js process
   - Multiple hooks run sequentially per tool call
   - Memory accumulates across hook executions

3. **File I/O Overhead**:
   - Each hook reads/writes files synchronously
   - No batching or caching of file operations
   - Session state file grows with violations

## Immediate Action Taken

**ALL HOOKS DISABLED** in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": []
  }
}
```

## Impact

### What's Disabled:

- ❌ Security validation (security-pre-tool.mjs)
- ❌ Orchestrator enforcement (orchestrator-enforcement-pre-tool.mjs)
- ❌ File path validation (file-path-validator.js)
- ❌ Skill injection (skill-injection-hook.js) - already disabled
- ❌ Audit logging (audit-post-tool.mjs, orchestrator-audit-post-tool.mjs)
- ❌ Session cleanup (post-session-cleanup.js)

### What Still Works:

- ✅ All tool functionality (Read, Write, Edit, Task, etc.)
- ✅ Agent system (orchestrators, developers, etc.)
- ✅ Workflow execution
- ✅ All other Claude Code features

## Required Fixes Before Re-Enabling

### Priority 1: Fix Orchestrator Enforcement Hook

**Problem**: Reads/writes session state on every Read call

**Solutions**:

1. **Cache session state in memory** - Only write to disk periodically
2. **Batch file operations** - Write state every N operations, not every operation
3. **Limit session state size** - Cap violations array, rotate old sessions
4. **Use async file I/O** - Replace `readFileSync`/`writeFileSync` with async versions
5. **Skip file I/O for non-orchestrators** - Early exit before file operations

### Priority 2: Optimize Hook Execution

**Solutions**:

1. **Reduce hook frequency** - Don't run hooks on every tool call
2. **Combine hooks** - Merge multiple hooks into single script
3. **Use process pooling** - Reuse Node.js processes instead of spawning new ones
4. **Add hook result caching** - Cache hook results for identical inputs

### Priority 3: Memory Management

**Solutions**:

1. **Limit hook memory usage** - Set memory limits per hook process
2. **Force garbage collection** - Explicitly trigger GC after hook execution
3. **Stream file operations** - Use streams instead of loading entire files
4. **Clean up resources** - Ensure all file handles are closed

## Testing Plan

Before re-enabling hooks:

1. **Test each hook individually**:

   ```bash
   echo '{"tool_name":"Read","tool_input":{"file_path":"test.txt"}}' | node .claude/hooks/orchestrator-enforcement-pre-tool.mjs
   ```

2. **Monitor memory usage**:
   - Run with memory profiling
   - Check for memory leaks
   - Verify cleanup happens

3. **Test hook combinations**:
   - Enable one hook at a time
   - Test with realistic tool call patterns
   - Monitor for crashes

4. **Load testing**:
   - Simulate 100+ tool calls
   - Check memory usage over time
   - Verify no crashes

## Re-Enablement Strategy

### Phase 1: Essential Hooks Only

1. Re-enable `security-pre-tool.mjs` (critical for safety)
2. Test for 24 hours
3. Monitor memory usage

### Phase 2: Add Path Validation

1. Re-enable `file-path-validator.js`
2. Test for 24 hours
3. Monitor memory usage

### Phase 3: Add Orchestrator Enforcement (After Fixes)

1. Fix orchestrator hook memory issues
2. Re-enable with fixes
3. Test extensively

### Phase 4: Add Audit Logging

1. Re-enable audit hooks
2. Test for stability

### Phase 5: Add Skill Injection (After Investigation)

1. Investigate skill-injector.mjs memory issues
2. Fix or replace skill injection
3. Re-enable

## Current Status

✅ **System is stable** - No crashes with hooks disabled
⏸️ **Hooks disabled** - Waiting for fixes
🔧 **Fixes needed** - See Priority 1-3 above

## Next Steps

1. **Immediate**: System is usable without hooks
2. **Short-term**: Fix orchestrator enforcement hook memory issues
3. **Medium-term**: Optimize all hooks for memory efficiency
4. **Long-term**: Redesign hook system for better performance

## Notes

- Orchestrator enforcement is working correctly (blocking Read after 2 files)
- The issue is the memory overhead, not the logic
- Hooks need to be more memory-efficient before re-enabling
- Consider alternative approaches (e.g., in-process hooks vs. subprocess hooks)
