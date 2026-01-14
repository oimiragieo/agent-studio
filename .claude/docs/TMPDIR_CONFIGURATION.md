# TMPDIR Configuration Guide

## Problem: tmpclaude-* Files in Project Root

Claude Code CLI's Bash tool creates temporary files named `tmpclaude-*-cwd` in your project root directory. These files:

- **Contain only the workspace path** (e.g., `/c/dev/projects/LLM-RULES`)
- **Are never read after creation** - they're orphaned artifacts
- **Accumulate over time** - one file per Bash command execution
- **Clutter your project root** - can reach 200+ files during active sessions
- **Should use OS temp directory** instead of project root

### Why This Happens

Claude Code CLI's Bash tool implementation:
1. Creates isolated working directories for each command
2. Uses `mkdtemp("tmpclaude-XXXXXX")` pattern
3. Defaults to current directory (project root) instead of OS temp directory
4. Does NOT clean up directories after command completes
5. Creates a new directory for EVERY Bash tool call

### Root Cause

The Bash tool uses the current working directory as the base for temporary file creation. When `TMPDIR` environment variable is not set, it falls back to the project root instead of the OS temp directory.

## Solution: Configure TMPDIR

Setting the `TMPDIR` environment variable tells Claude Code CLI (and other tools) to use the OS temp directory instead of the project root.

### Quick Check

Check your current TMPDIR configuration:

```bash
node .claude/scripts/configure-tmpdir.mjs --check
```

### Windows Configuration

#### PowerShell (Current Session)

```powershell
$env:TMPDIR = $env:TEMP
```

#### PowerShell (Permanent - User Profile)

Add to your PowerShell profile (`$PROFILE`):

```powershell
$env:TMPDIR = $env:TEMP
```

To edit your profile:
```powershell
notepad $PROFILE
```

#### CMD (Current Session)

```cmd
set TMPDIR=%TEMP%
```

#### CMD (Permanent - System Environment)

1. Open System Properties → Environment Variables
2. Under "User variables", click "New"
3. Variable name: `TMPDIR`
4. Variable value: `%TEMP%`
5. Click OK

### Unix/macOS Configuration

#### Current Session

```bash
export TMPDIR=/tmp
```

#### Permanent (Bash)

Add to `~/.bashrc` or `~/.bash_profile`:

```bash
export TMPDIR=/tmp
```

Then reload:
```bash
source ~/.bashrc
```

#### Permanent (Zsh)

Add to `~/.zshrc`:

```bash
export TMPDIR=/tmp
```

Then reload:
```bash
source ~/.zshrc
```

## Automatic Cleanup (Already Implemented)

Even with TMPDIR configured, we've added automatic cleanup as a safety measure:

### PostToolUse Hook

The `.claude/hooks/post-session-cleanup.js` hook automatically:
- Detects `tmpclaude-*` files after each Bash command
- Removes them immediately from project root
- Logs cleanup actions (non-blocking)

### Pre-commit Hook

The `.claude/hooks/pre-commit-cleanup.mjs` hook:
- Cleans temp files older than 24 hours
- Blocks commits if temp files found in root
- Runs automatically before every commit

## Verification

### 1. Check TMPDIR is Set

```bash
# Windows PowerShell
echo $env:TMPDIR

# Unix/macOS
echo $TMPDIR
```

Should show your OS temp directory (e.g., `C:\Users\YourName\AppData\Local\Temp` on Windows, `/tmp` on Unix/macOS).

### 2. Test Bash Command

Run a Bash command via Claude Code and check if tmpclaude files are created:

```bash
# After running a Bash command, check project root
ls tmpclaude-* 2>/dev/null || echo "No tmpclaude files found ✓"
```

### 3. Check Cleanup Log

View cleanup activity:

```bash
cat .claude/context/cleanup-log.json
```

## Troubleshooting

### TMPDIR Not Working

If tmpclaude files still appear after setting TMPDIR:

1. **Verify TMPDIR is set in Claude Code's environment**
   - Claude Code may not inherit your shell's environment variables
   - Try setting it in Claude Code's launch script or configuration

2. **Check Claude Code CLI version**
   - Older versions may not respect TMPDIR
   - Update to latest version if available

3. **Use automatic cleanup as fallback**
   - The PostToolUse hook will clean files even if TMPDIR isn't working
   - This is a workaround, not a permanent fix

### Cleanup Hook Not Running

If tmpclaude files accumulate:

1. **Verify hook is registered**
   ```bash
   cat .claude/hooks/hook-registry.json | grep session-cleanup
   ```

2. **Check hook matcher includes Bash**
   - Should show: `"matcher": "Write|Edit|Bash"`

3. **Verify hook is enabled**
   - Check `.claude/settings.json` or hook registry

## Best Practices

1. **Set TMPDIR permanently** - Prevents files from being created in the first place
2. **Keep automatic cleanup enabled** - Safety net if TMPDIR isn't working
3. **Run cleanup before commits** - Use `pnpm cleanup` or `pnpm precommit`
4. **Monitor cleanup log** - Check `.claude/context/cleanup-log.json` periodically

## Related Files

- **Cleanup Hook**: `.claude/hooks/post-session-cleanup.js`
- **Pre-commit Hook**: `.claude/hooks/pre-commit-cleanup.mjs`
- **Configuration Script**: `.claude/scripts/configure-tmpdir.mjs`
- **Cleanup Tool**: `.claude/tools/cleanup-repo.mjs`

## Summary

**Problem**: Claude Code CLI creates unnecessary tmpclaude-* files in project root

**Solution**:
1. ✅ Set `TMPDIR` environment variable (prevents creation)
2. ✅ Automatic cleanup hook (removes files if created)
3. ✅ Pre-commit validation (blocks commits with temp files)

**Result**: Clean project root, no accumulation of temp files
