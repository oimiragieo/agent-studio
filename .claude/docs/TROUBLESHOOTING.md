# Troubleshooting Guide

## Error Logging System

All errors are logged to:

- `.claude/context/logs/errors.log` - Human-readable log
- `.claude/context/runs/<run_id>/errors/` - Run-specific error files with full context

### View Recent Errors

```bash
# View all recent errors for a run
node .claude/tools/error-logger.mjs --run-id <run_id> list

# Get error summary for a run
node .claude/tools/error-logger.mjs --run-id <run_id> summary
```

---

## Common Errors

### Exit Code 127: Command Not Found

**Error Example**:

```
Error: Exit code 127
Command: git remote -v | grep origin | awk '{print $2}'
```

**Root Cause**: Unix commands (grep, awk, sed) not available on Windows.

**Solutions**:

1. **Use Git Bash** (recommended):

   ```bash
   # Run commands in Git Bash instead of cmd/PowerShell
   "C:\\Program Files\\Git\\bin\\bash.exe" -c "git remote -v | grep origin"
   ```

2. **Use Node.js alternatives**:

   ```javascript
   // Instead of: git remote -v | grep origin | awk '{print $2}'
   const { execSync } = require('child_process');
   const output = execSync('git remote -v', { encoding: 'utf-8' });
   const originUrl = output
     .split('\\n')
     .find(line => line.startsWith('origin'))
     ?.split(/\\s+/)[1];
   ```

3. **Install Unix tools for Windows**:
   - Install Git for Windows (includes bash, grep, awk, sed)
   - Or install WSL (Windows Subsystem for Linux)

4. **Use cross-platform git helpers**:

   ```javascript
   import { getRemoteUrl, getCurrentBranch, getRepoName } from './.claude/tools/git-helpers.mjs';

   const url = getRemoteUrl('origin');
   const branch = getCurrentBranch();
   const repo = getRepoName();
   ```

**Prevention**: Use cross-platform Node.js code instead of shell pipes.

---

### Exit Code 128: Git Error

**Error Example**:

```
Error: Exit code 128
fatal: not a git repository
```

**Root Cause**: Command run outside git repository or git not configured.

**Solutions**:

1. Verify you're in a git repository:

   ```bash
   git status
   ```

2. Check git configuration:

   ```bash
   git config --list
   ```

3. Initialize repository if needed:
   ```bash
   git init
   ```

---

### Workflow Step Failures

**Error Example**:

```
[workflow] pr-creation-workflow:02-lint: Lint failed with 15 errors
```

**Solutions**:

1. **Check error log**:

   ```bash
   # Get all errors for the run
   node .claude/tools/error-logger.mjs --run-id <run_id> list

   # Get error summary
   node .claude/tools/error-logger.mjs --run-id <run_id> summary
   ```

2. **Review specific step**:
   - Check step artifacts in `.claude/context/runs/<run_id>/artifacts/`
   - Check gate files in `.claude/context/runs/<run_id>/gates/`
   - Check error files in `.claude/context/runs/<run_id>/errors/`

3. **Re-run with verbose logging**:
   ```bash
   DEBUG=* node .claude/tools/workflow_runner.js --workflow <file> --step <N>
   ```

---

### Agent Spawn Failures

**Error Example**:

```
[agent] devops: Failed to spawn agent
```

**Solutions**:

1. **Check agent definition exists**:

   ```bash
   ls .claude/agents/devops.md
   ```

2. **Verify agent has required skills**:
   - Check `.claude/context/skill-integration-matrix.json`
   - Ensure required skills are available

3. **Check memory limits**:
   ```bash
   # View memory thresholds
   cat .claude/config/memory-thresholds.json
   ```

---

### Windows Path Issues

**Error Example**:

```
Error: ENOENT: no such file or directory
Path: C:devprojectsLLM-RULES.claudecontextartifactsplan.json
```

**Root Cause**: Malformed Windows path (missing backslashes).

**Solutions**:

1. **Use path.join()**:

   ```javascript
   const path = require('path');
   const filePath = path.join(
     'C:',
     'dev',
     'projects',
     'LLM-RULES',
     '.claude',
     'context',
     'artifacts',
     'plan.json'
   );
   ```

2. **Validate paths before use**:
   ```bash
   node .claude/tools/enforcement-gate.mjs validate-file-location --path "<path>"
   ```

---

## Error Categories

Errors are categorized for easier filtering:

| Category     | Description                   | Example                 |
| ------------ | ----------------------------- | ----------------------- |
| `workflow`   | Workflow execution errors     | Step validation failure |
| `agent`      | Agent spawn/execution errors  | Agent not found         |
| `tool`       | Tool/command execution errors | Git command failed      |
| `git`        | Git-specific errors           | Merge conflict          |
| `validation` | Schema/data validation errors | Invalid artifact        |
| `security`   | Security-related errors       | Secret detected         |
| `filesystem` | File operation errors         | ENOENT, EACCES          |

---

## Debugging Workflow

1. **Check recent errors**:

   ```bash
   node .claude/tools/error-logger.mjs --run-id <run_id> list
   ```

2. **Review error context**:
   - Open `.claude/context/runs/<run_id>/errors/`
   - Find the error file by timestamp
   - Review `context`, `environment`, and `recovery` fields

3. **Check suggested fix**:
   - Each error includes a `recovery.suggested_action` field
   - Follow the recommendation

4. **Review workflow state**:
   - Check `.claude/context/runs/<run_id>/`
   - Review artifact registry
   - Check gate validation results

5. **Re-run with fixes**:
   - Apply suggested fix
   - Re-run workflow step
   - Verify error is resolved

---

## Prevention Best Practices

1. **Use cross-platform code**:
   - Prefer Node.js APIs over shell commands
   - Use `path.join()` for paths
   - Avoid Unix-specific tools (grep, awk, sed)

2. **Add error handling**:

   ```javascript
   import { logError, logStepError } from './.claude/tools/error-logger.mjs';

   try {
     // Your code
   } catch (error) {
     await logStepError(error, step, runId, workflowId, {
       additionalContext: 'any relevant info',
     });
     throw error; // Re-throw if needed
   }
   ```

3. **Validate inputs**:
   - Check file paths exist before reading
   - Validate command availability before execution
   - Use schemas for data validation

4. **Log progress**:
   - Log start of each workflow step
   - Log completion with metrics
   - Log warnings for non-critical issues

---

## Getting Help

If you encounter an error not covered here:

1. **Export error details**:

   ```bash
   node .claude/tools/error-logger.mjs --run-id <run_id> list > error-report.json
   ```

2. **Include environment info**:
   - Platform (Windows/macOS/Linux)
   - Node.js version
   - Git version

3. **Describe what you were attempting**:
   - Workflow being executed
   - Step that failed
   - Expected vs actual behavior

4. **Check existing issues**:
   - Search project issues on GitHub
   - Check if error is already documented

---

## Hook Errors

### PreToolUse/PostToolUse Hook Errors on Windows

**Error Example**:

```
PreToolUse hook error: bash .claude/hooks/security-pre-tool.sh
PostToolUse hook error: bash .claude/hooks/audit-post-tool.sh
```

**Root Cause**: Bash shell scripts (.sh files) are not natively supported on Windows without WSL or Git Bash.

**What Was Broken**:

1. **security-pre-tool.sh** (PreToolUse):
   - Used `bash`, `jq`, `cat`, `grep` (Unix-only commands)
   - Blocked dangerous commands and validated file operations
   - Failed on Windows because bash is not available in PATH

2. **audit-post-tool.sh** (PostToolUse):
   - Used `bash`, `jq`, `cat`, `date`, `stat`, `mkdir`, `tail` (Unix-only)
   - Logged tool executions for security audit trail
   - Failed on Windows due to missing Unix commands

**How It Was Fixed** (2026-01-10):

✅ **Created Cross-Platform Node.js Versions**:

1. **security-pre-tool.mjs**:
   - Pure Node.js implementation (no external dependencies)
   - Uses built-in regex for pattern matching (replaced `grep`)
   - Uses JSON.parse() for input parsing (replaced `jq`)
   - Preserves all security validation logic:
     - Blocks dangerous commands (rm -rf, SQL injection, etc.)
     - Protects sensitive files (.env, credentials)
     - Prevents force push to protected branches

2. **audit-post-tool.mjs**:
   - Pure Node.js implementation
   - Uses fs/promises for file operations (replaced `mkdir`, `stat`, `tail`)
   - Uses Date.toISOString() for timestamps (replaced `date`)
   - Maintains audit logging functionality:
     - Logs tool executions with timestamps
     - Auto-trims log file when exceeding 10MB
     - Extracts summaries based on tool type

✅ **Updated .claude/settings.json**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/security-pre-tool.mjs" // Changed from .sh
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/audit-post-tool.mjs" // Changed from .sh
          }
        ]
      }
    ]
  }
}
```

**Verification**:

All hooks now work cross-platform:

- ✅ security-pre-tool.mjs - Node.js (cross-platform)
- ✅ audit-post-tool.mjs - Node.js (cross-platform)
- ✅ file-path-validator.js - Node.js (already cross-platform)
- ✅ orchestrator-enforcement-hook.mjs - Node.js ESM (already cross-platform)
- ✅ skill-injection-hook.js - Node.js (already cross-platform)
- ✅ post-session-cleanup.js - Node.js (already cross-platform)

**Test Results**:

Before fix:

```
❌ PreToolUse hook error: bash .claude/hooks/security-pre-tool.sh (exit code 127)
❌ PostToolUse hook error: bash .claude/hooks/audit-post-tool.sh (exit code 127)
```

After fix:

```
✅ All hooks execute successfully on Windows
✅ No dependency on bash, jq, or Unix commands
✅ All security and audit functionality preserved
```

**Benefits**:

1. **Cross-Platform Compatibility**: Hooks work on Windows, macOS, and Linux
2. **No External Dependencies**: Pure Node.js (no need for jq, bash, etc.)
3. **Faster Execution**: Node.js startup faster than spawning bash
4. **Better Error Handling**: Proper async/await and try/catch blocks
5. **Maintainability**: Single codebase for all platforms

**Deprecated Files**:

The following files are now deprecated (replaced by .mjs versions):

- ❌ .claude/hooks/security-pre-tool.sh (use security-pre-tool.mjs)
- ❌ .claude/hooks/audit-post-tool.sh (use audit-post-tool.mjs)

**Migration Notes**:

If you have custom hook modifications:

1. Port changes to the new .mjs files
2. Test hooks run successfully: `node .claude/hooks/security-pre-tool.mjs < test-input.json`
3. Update .claude/settings.json to use new .mjs files
4. Remove old .sh files after verification

---
