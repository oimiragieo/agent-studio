# Troubleshooting Guide

## Error Logging System

All errors are logged to:

- `.claude/context/logs/errors.log` - Human-readable log
- `.claude/context/runtime/runs/<run_id>/errors/` - Run-specific error files with full context

Related observability outputs (for auditing and deep debugging):

- `.claude/context/runtime/runs/<runId>/events.ndjson` - append-only run event log (includes `trace_id`/`span_id`)
- `.claude/context/artifacts/tool-events/run-<runId>.ndjson` - grep-friendly tool + guard stream (includes denials)
- `.claude/context/artifacts/failure-bundles/failure-*.json` - failure bundles (when `CLAUDE_OBS_FAILURE_BUNDLES=1`)
- `.claude/context/payloads/trace-<trace_id>/span-<span_id>.json` - sanitized tool inputs/outputs (when `CLAUDE_OBS_STORE_PAYLOADS=1`)

If you have a Claude debug log, generate a single audit bundle:

```bash
node .claude/tools/observability-bundle.mjs --debug-log "C:\\Users\\you\\.claude\\debug\\<session>.txt"
```

If you ran the framework integration prompt, verify its outputs:

```bash
node .claude/tools/verify-agent-integration.mjs --workflow-id agent-integration-v1-<YYYYMMDD-HHMMSS>
```

If you ran the integration **headlessly** (outside Claude Code UI), use:

```bash
node .claude/tools/verify-agent-integration.mjs --workflow-id agent-integration-v1-<YYYYMMDD-HHMMSS> --mode headless
```

### Export traces to OTLP (OpenTelemetry)

Export an `events.ndjson` file (Claude Code run or headless run) to OTLP/JSON:

```bash
node .claude/tools/otlp-export.mjs --events "<events.ndjson>" --out ".claude/context/artifacts/observability/<id>-otlp.json"
```

Optional: POST directly to an OTLP/HTTP JSON endpoint:

```bash
node .claude/tools/otlp-export.mjs --events "<events.ndjson>" --endpoint "https://<collector>/v1/traces"
```

### View Recent Errors

```bash
# View all recent errors for a run
node .claude/tools/error-logger.mjs --run-id <run_id> list

# Get error summary for a run
node .claude/tools/error-logger.mjs --run-id <run_id> summary
```

---

## Common Errors

### Integration test “PASS” but denial not verified

If an integration report claims the intentional denial ran, but `verify-agent-integration.mjs` warns that the denial was not verified via tool-events:

- The denial was likely triggered by a Node/FS error (e.g., `EISDIR`) instead of a PreToolUse hook denial.
- The intentional denial step must use the **Read tool** on a directory path (e.g., `.claude/agents/`) so `read-path-guard` can block it.
- Confirm in `.claude/context/artifacts/tool-events/run-<runId>.ndjson` that the denied entry includes:
  - `tool: "Read"`
  - `denied_by: "read-path-guard"`

### ROUTING HANDOFF REQUIRED (router-first enforcement)

If you see an error banner like:

```
ROUTING HANDOFF REQUIRED
Routing is complete, but execution must be handed off to: orchestrator
```

- This means the router finished, but the post-routing executor agent has not been entered/spawned yet.
- Fix: spawn the required coordinator via `Task` (usually `orchestrator`) and let it run the selected workflow.
- If the model tries `master-orchestrator` while routing expects `orchestrator` (or vice versa), treat them as equivalent coordinators and proceed with either one; the coordinator should then delegate work to worker agents.

### Integration prompt routed to diagnostics-runner

If an integration harness prompt is treated as “diagnostics” and tries to hand off to `diagnostics-runner`, you may see a handoff denial requiring `orchestrator`.

- Preferred: use the short integration prompt that directly requests running `@.claude/workflows/agent-framework-integration.yaml`.
- If you see a handoff denial, follow the banner and spawn `orchestrator`.

### ROUTER RE-RUN BLOCKED (routing loop / OOM guard)

If you see:

```
ROUTER RE-RUN BLOCKED
Routing is already in progress for this session.
```

- A coordinator tried to spawn the router again after routing started (or completed).
- This is blocked because repeated routing can explode token usage and crash Claude Code.
- Fix: proceed with the already-selected workflow and delegate only to step agents; if you truly need a different route, start a new session/request.

### Claude Code host OOM (JavaScript heap out of memory)

If Claude Code crashes with a Node error like:

```
FATAL ERROR: ... Allocation failed - JavaScript heap out of memory
```

Common mitigations:

- Use the short integration prompt (avoid verbose prompts that cause high-token router/coordinator outputs).
- Keep subagent outputs minimal (JSON receipt only).
- If background RAG indexing is contributing to memory pressure, disable it in a local override:
  - `.claude/settings.local.json`
- Reduce concurrency (never run multiple subagents in parallel during smoke tests).
- If the UI still OOMs, run the full integration **outside** Claude Code UI:
  - `node .claude/tools/run-agent-framework-integration-headless.mjs --workflow-id agent-integration-v1-<YYYYMMDD-HHMMSS>`
  - or the push-button script: `pnpm integration:headless:json`

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
   - Check step artifacts in `.claude/context/runtime/runs/<run_id>/artifacts/`
   - Check gate files in `.claude/context/runtime/runs/<run_id>/gates/`
   - Check error files in `.claude/context/runtime/runs/<run_id>/errors/`

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
   - Open `.claude/context/runtime/runs/<run_id>/errors/`
   - Find the error file by timestamp
   - Review `context`, `environment`, and `recovery` fields

3. **Check suggested fix**:
   - Each error includes a `recovery.suggested_action` field
   - Follow the recommendation

4. **Review workflow state**:
   - Check `.claude/context/runtime/runs/<run_id>/`
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
