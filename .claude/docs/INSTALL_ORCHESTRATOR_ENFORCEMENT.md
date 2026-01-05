# Installing Orchestrator Enforcement Hook

## Overview

This guide walks you through installing and verifying the orchestrator enforcement hook, which prevents orchestrators from executing implementation work directly.

## Prerequisites

- Claude Code installed and configured
- Project cloned with `.claude/` directory
- Node.js installed (for testing)

## Installation Steps

### Step 1: Verify Hook Files Exist

Check that the following files are present:

```bash
# Main hook implementation
ls .claude/hooks/orchestrator-enforcement-hook.mjs

# Test suite
ls .claude/hooks/test-orchestrator-enforcement-hook.mjs

# Documentation
ls .claude/hooks/README.md
ls .claude/docs/ORCHESTRATION_ENFORCEMENT_SUMMARY.md
ls .claude/docs/ORCHESTRATOR_QUICK_REFERENCE.md
```

**Expected**: All files exist

### Step 2: Run Tests (Pre-Installation)

Verify the hook works correctly before installation:

```bash
node .claude/hooks/test-orchestrator-enforcement-hook.mjs
```

**Expected Output**:
```
🧪 Testing Orchestrator Enforcement Hook

✅ PASS: Write tool blocked for orchestrator
✅ PASS: Write block message contains violation warning
✅ PASS: Write tool allowed for developer
...
============================================================
📊 Test Summary
============================================================
✅ Passed: 20
❌ Failed: 0
📈 Total: 20

🎉 All tests passed! Orchestrator enforcement is working correctly.
```

**If tests fail**: Review error output, check hook implementation

### Step 3: Register Hook in Claude Code Settings

#### Option A: Using .claude/settings.json (Project-Level)

Create or edit `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true,
        "description": "Blocks orchestrators from using implementation tools"
      }
    ],
    "PostToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true,
        "description": "Resets Read counter after Task tool delegation"
      }
    ]
  }
}
```

**Benefits**: Project-specific, version controlled

#### Option B: Using Claude Code UI

1. Open Claude Code
2. Navigate to Settings → Hooks
3. Add PreToolUse Hook:
   - **Path**: `.claude/hooks/orchestrator-enforcement-hook.mjs`
   - **Enabled**: ✅
   - **Description**: "Orchestrator enforcement - blocks implementation tools"
4. Add PostToolUse Hook:
   - **Path**: `.claude/hooks/orchestrator-enforcement-hook.mjs`
   - **Enabled**: ✅
   - **Description**: "Orchestrator enforcement - resets Read counter"
5. Save settings

**Benefits**: GUI-based, easier for beginners

#### Option C: Using settings.local.json (User-Level)

Create or edit `~/.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "path": "/absolute/path/to/project/.claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true
      }
    ],
    "PostToolUse": [
      {
        "path": "/absolute/path/to/project/.claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true
      }
    ]
  }
}
```

**Benefits**: User-level, applies to all projects

**Note**: Requires `setting_sources=["project", "local"]` in SDK configuration

### Step 4: Verify Hook Registration

Start Claude Code and check logs:

```bash
# Start Claude Code with verbose logging
VERBOSE=1 claude-code
```

**Expected Log Output**:
```
[INFO] Loading hooks from .claude/settings.json
[INFO] Registered PreToolUse hook: orchestrator-enforcement-hook.mjs
[INFO] Registered PostToolUse hook: orchestrator-enforcement-hook.mjs
```

**If hooks not loaded**: Check file path, verify settings.json syntax

### Step 5: Test Hook in Live Session

#### Test 1: Orchestrator Attempts Write (Should Block)

1. Start Claude Code as orchestrator
2. Attempt to use Write tool:
   ```
   Write: { file_path: "test.txt", content: "test" }
   ```
3. **Expected**: Hook blocks with violation message:
   ```
   ╔═══════════════════════════════════════════════════════════════════╗
   ║  ORCHESTRATOR VIOLATION DETECTED                                  ║
   ║  Tool: Write                                                      ║
   ║  Reason: Orchestrators MUST NOT write files directly              ║
   ║  Action: Spawn developer subagent via Task tool                   ║
   ╚═══════════════════════════════════════════════════════════════════╝
   ```

#### Test 2: Orchestrator Uses Task Tool (Should Allow)

1. Use Task tool to spawn developer:
   ```
   Task: developer
   Prompt: "Create test.txt with content 'test'"
   ```
2. **Expected**: Task tool executes successfully, Read counter resets

#### Test 3: 2-File Rule (Should Block 3rd Read)

1. Read first file: `Read: { file_path: "file1.txt" }` → ✅ Allowed
2. Read second file: `Read: { file_path: "file2.txt" }` → ✅ Allowed
3. Read third file: `Read: { file_path: "file3.txt" }` → ❌ Blocked
4. **Expected**: Third Read blocked with 2-FILE RULE message

### Step 6: Verify Documentation

Check that orchestrators can access documentation:

```bash
# Quick reference
cat .claude/docs/ORCHESTRATOR_QUICK_REFERENCE.md

# Full summary
cat .claude/docs/ORCHESTRATION_ENFORCEMENT_SUMMARY.md

# Installation guide (this file)
cat .claude/docs/INSTALL_ORCHESTRATOR_ENFORCEMENT.md
```

**Expected**: All documentation accessible and readable

## Verification Checklist

After installation, verify:

- [ ] Hook files exist in `.claude/hooks/`
- [ ] Tests pass (20/20)
- [ ] Hook registered in settings.json
- [ ] Claude Code logs show hook loading
- [ ] Write tool blocked for orchestrator (live test)
- [ ] Edit tool blocked for orchestrator (live test)
- [ ] Bash with rm/git blocked (live test)
- [ ] Read tool blocked after 2 uses (live test)
- [ ] Task tool allowed (live test)
- [ ] Documentation accessible

## Troubleshooting

### Issue: Hook Not Loading

**Symptoms**: No hook logs in Claude Code output

**Causes & Fixes**:
1. **File path incorrect**
   - Verify path in settings.json
   - Use absolute path if relative path fails
   - Check file exists: `ls .claude/hooks/orchestrator-enforcement-hook.mjs`

2. **Settings.json syntax error**
   - Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json'))"`
   - Fix syntax errors (missing commas, quotes)

3. **Hook not enabled**
   - Check `"enabled": true` in settings.json
   - Restart Claude Code after enabling

### Issue: Hook Not Blocking

**Symptoms**: Orchestrator can use Write/Edit tools

**Causes & Fixes**:
1. **Agent not identified as orchestrator**
   - Check agent name matches: `orchestrator`, `master-orchestrator`, `model-orchestrator`
   - Update `ORCHESTRATOR_AGENTS` array in hook if using custom orchestrator

2. **PreToolUse hook not firing**
   - Verify hook registered in PreToolUse (not just PostToolUse)
   - Check Claude Code logs for hook execution

3. **Hook errors ignored**
   - Check stderr for hook errors
   - Hook fails gracefully on errors (logs to stderr but doesn't block)

### Issue: Tests Failing

**Symptoms**: Test suite shows failures

**Causes & Fixes**:
1. **Node.js version incompatible**
   - Requires Node.js 16+
   - Check version: `node --version`
   - Upgrade if needed

2. **Hook file modified**
   - Compare with original version
   - Re-download hook file if corrupted

3. **Import errors**
   - Verify file is `.mjs` (ES modules)
   - Check import statements use `.mjs` extension

### Issue: Read Counter Not Resetting

**Symptoms**: Read counter stays at 2 after Task tool

**Causes & Fixes**:
1. **PostToolUse hook not registered**
   - Verify PostToolUse hook in settings.json
   - Restart Claude Code after adding

2. **Task tool not detected**
   - Check hook logs for PostToolUse execution
   - Verify Task tool name matches exactly

## Uninstallation

To remove the hook:

### Step 1: Disable in Settings

Edit `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": false  // Changed to false
      }
    ],
    "PostToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": false  // Changed to false
      }
    ]
  }
}
```

Or remove the hook entries entirely.

### Step 2: Restart Claude Code

```bash
# Kill Claude Code process
pkill claude-code

# Restart
claude-code
```

### Step 3: Verify Uninstallation

Check logs show no hook loading:
```
[INFO] No PreToolUse hooks registered
```

**Note**: Documentation changes remain (they're just guidelines without the hook)

## Advanced Configuration

### Custom Orchestrator Names

If using custom orchestrator agent names, update the hook:

```javascript
// In orchestrator-enforcement-hook.mjs
const ORCHESTRATOR_AGENTS = [
  'orchestrator',
  'master-orchestrator',
  'model-orchestrator',
  'my-custom-orchestrator'  // Add custom name
];
```

### Custom Blocked Commands

To block additional Bash commands:

```javascript
// In orchestrator-enforcement-hook.mjs
const DANGEROUS_BASH_COMMANDS = [
  'rm -f',
  'rm -rf',
  'git add',
  'git commit',
  'my-custom-command'  // Add custom command
];
```

### Adjust Read Limit

To change the 2-file limit:

```javascript
// In orchestrator-enforcement-hook.mjs (PreToolUse function)
if (newCount > 3) {  // Changed from 2 to 3
  return {
    decision: 'block',
    message: `3-FILE RULE violation...`  // Update message
  };
}
```

## Support

**Documentation**:
- Quick Reference: `.claude/docs/ORCHESTRATOR_QUICK_REFERENCE.md`
- Full Summary: `.claude/docs/ORCHESTRATION_ENFORCEMENT_SUMMARY.md`
- Hook Source: `.claude/hooks/orchestrator-enforcement-hook.mjs`

**Testing**:
```bash
node .claude/hooks/test-orchestrator-enforcement-hook.mjs
```

**Changelog**:
- `ORCHESTRATION_ENFORCEMENT_CHANGELOG.md`

## Summary

Installation complete! The orchestrator enforcement hook is now active and will:
- ✅ Block Write/Edit tools for orchestrators
- ✅ Block Bash with rm/git commands
- ✅ Block Read after 2 uses (2-FILE RULE)
- ✅ Block Grep/Glob tools
- ✅ Allow Task/Search tools
- ✅ Provide clear violation messages with correct patterns

**Next Steps**:
1. Review quick reference: `.claude/docs/ORCHESTRATOR_QUICK_REFERENCE.md`
2. Test hook with live orchestrator session
3. Monitor violations and adjust if needed

**Remember**: The hook enforces the rule: **"Orchestrators manage, they don't implement"**
