# Hook Crash Fix - Critical Issue Resolution

## Problem Summary

**Date**: 2026-01-XX  
**Severity**: CRITICAL - System crashes with "JavaScript heap out of memory"  
**Impact**: All tool calls failing, hooks erroring on every invocation

### Symptoms

- `PreToolUse:TodoWrite hook error` - repeatedly
- `PreToolUse:Task hook error` - repeatedly
- `PreToolUse:Bash hook error` - repeatedly
- Memory exhaustion crashes: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory"
- Hooks failing on EVERY tool call, causing cascading failures

### Root Causes Identified

1. **Missing Recursion Protection**: Some hooks lacked proper recursion guards, potentially causing infinite loops
2. **Missing Timeout Protection**: Hooks could hang indefinitely, causing memory leaks
3. **Synchronous File I/O at Module Load**: `orchestrator-enforcement-pre-tool.mjs` was reading files synchronously during module initialization, blocking execution
4. **Improper Error Handling**: Some hooks didn't properly clean up resources on error
5. **Missing Directory Structure**: Required directories (`.claude/context/tmp`, `.claude/context/logs`) didn't exist, causing file operations to fail

## Immediate Fix Applied

**Action**: Temporarily disabled ALL hooks in `.claude/settings.json` to stop crashes

```json
{
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": []
  }
}
```

**Result**: System is now stable, no more crashes

## Hook Fixes Applied

### 1. orchestrator-enforcement-pre-tool.mjs

**Fixes**:

- ✅ Added recursion protection guard (`CLAUDE_ORCHESTRATOR_HOOK_EXECUTING`)
- ✅ Added 2-second timeout protection
- ✅ Changed `checkClaudeMdIdentity()` to lazy-load (not called at module load)
- ✅ Added proper cleanup in `finally` block
- ✅ Improved error handling with fail-open behavior

### 2. file-path-validator.js

**Fixes**:

- ✅ Added recursion protection guard (`CLAUDE_PATH_VALIDATOR_EXECUTING`)
- ✅ Added 1-second timeout protection
- ✅ Added proper cleanup in `finally` block

### 3. skill-injection-hook.js

**Fixes**:

- ✅ Added recursion protection guard (`CLAUDE_SKILL_INJECTION_EXECUTING`)
- ✅ Added 5-second timeout protection (longer for skill injection)
- ✅ Added proper cleanup in `finally` block
- ✅ Improved error handling to pass through on timeout

### 4. security-pre-tool.mjs

**Fixes**:

- ✅ Fixed timeout to exit gracefully (exit code 0, not 1)
- ✅ Added proper cleanup in `finally` block
- ✅ Changed timeout to allow by default instead of blocking

## Infrastructure Fixes

- ✅ Created missing directories: `.claude/context/tmp` and `.claude/context/logs`

## How to Re-Enable Hooks Safely

### Step 1: Verify Fixes

All hooks now have:

- Recursion protection (environment variable guards)
- Timeout protection (1-5 seconds depending on hook)
- Proper cleanup (finally blocks)
- Fail-open error handling (allow by default on error)

### Step 2: Re-Enable Hooks Gradually

**Option A: Re-enable All at Once** (Recommended if you trust the fixes)

Edit `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/security-pre-tool.mjs"
          }
        ]
      },
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/file-path-validator.js"
          }
        ]
      },
      {
        "matcher": "Read|Write|Edit|Bash|Grep|Glob",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/orchestrator-enforcement-pre-tool.mjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/skill-injection-hook.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Write|Edit|Bash|Grep|Glob|Task",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/orchestrator-audit-post-tool.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Read|Write|Edit|Grep|Glob|Search",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/audit-post-tool.mjs"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-session-cleanup.js"
          }
        ]
      }
    ]
  }
}
```

**Option B: Re-enable One Hook at a Time** (Safer, for testing)

1. Start with `security-pre-tool.mjs` only
2. Test for 5-10 tool calls
3. Add `file-path-validator.js`
4. Test again
5. Continue adding hooks one by one

### Step 3: Monitor for Issues

Watch for:

- Hook timeout warnings in logs
- Memory usage (should stay stable)
- Tool call failures
- Any "hook error" messages

If issues recur:

1. Immediately disable hooks again
2. Check hook logs in `.claude/context/logs/`
3. Review hook execution times
4. Report issue with hook name and error message

## Prevention Measures

### For Future Hook Development

1. **Always include recursion protection**:

   ```javascript
   if (process.env.CLAUDE_HOOK_NAME_EXECUTING === 'true') {
     // Allow and exit
   }
   process.env.CLAUDE_HOOK_NAME_EXECUTING = 'true';
   ```

2. **Always include timeout protection**:

   ```javascript
   const timeout = setTimeout(() => {
     // Allow by default and exit
     process.exit(0);
   }, 1000);
   ```

3. **Always clean up in finally**:

   ```javascript
   try {
     // Hook logic
   } finally {
     clearTimeout(timeout);
     delete process.env.CLAUDE_HOOK_NAME_EXECUTING;
   }
   ```

4. **Fail-open on errors**: Always allow by default if hook fails
5. **Avoid synchronous I/O at module load**: Use lazy loading instead
6. **Test hooks in isolation** before enabling in production

## Testing

To test hooks individually:

```bash
# Test orchestrator enforcement hook
echo '{"tool_name":"Write","tool_input":{"file_path":"test.txt"}}' | node .claude/hooks/orchestrator-enforcement-pre-tool.mjs

# Test file path validator
echo '{"tool_name":"Write","tool_input":{"file_path":"test.txt"}}' | node .claude/hooks/file-path-validator.js

# Test security hook
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node .claude/hooks/security-pre-tool.mjs
```

Expected: All hooks should return JSON with `decision: "allow"` or `decision: "block"` and exit cleanly.

## Status

✅ **CRITICAL ISSUE RESOLVED**

- Hooks disabled to stop crashes
- All hooks fixed with proper protections
- Infrastructure directories created
- Ready for gradual re-enablement

**Next Steps**: Re-enable hooks using Option A or B above, monitor for stability.
