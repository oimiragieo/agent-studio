# Claude Code Native Hooks

This directory contains **native Claude Code hooks** - shell scripts that execute at lifecycle events.

## Hook Execution Order (2.1.2+)

Hooks execute in a predictable sequence during tool execution:

### PreToolUse Hooks (Before Execution)

Hooks run in this order BEFORE any tool executes:

1. **security-pre-tool.mjs** (blocks dangerous commands) - **Cross-platform**
2. **file-path-validator.js** (validates file paths on all tools)
3. **orchestrator-enforcement-hook.mjs** (enforces orchestrator rules)
4. **skill-injection-hook.js** (injects skills into Task calls)

**Exclusions**: TodoWrite and Task tools are excluded from most PreToolUse hooks to prevent recursion.

### PostToolUse Hooks (After Execution)

Hooks run in this order AFTER tool execution completes:

1. **audit-post-tool.mjs** (logs tool execution) - **Cross-platform**
2. **post-session-cleanup.js** (cleans up SLOP files)

## Hook Performance (Updated 2.1.2)

**Optimization**: Hook matchers now use specific tool patterns instead of wildcards

| Hook                     | Matcher                                     | Execution Time | Runs On            |
| ------------------------ | ------------------------------------------- | -------------- | ------------------ |
| security-pre-tool.mjs    | Bash\|Write\|Edit                           | ~12ms          | Only risky tools   |
| file-path-validator.js   | \*                                          | <10ms          | All tools (needed) |
| orchestrator-enforcement | Read\|Write\|Edit\|Bash\|Grep\|Glob         | <10ms          | Orchestrator tools |
| skill-injection-hook.js  | Task                                        | ~224ms         | Subagent spawning  |
| audit-post-tool.mjs      | Bash\|Read\|Write\|Edit\|Grep\|Glob\|Search | ~53ms          | File/command tools |
| post-session-cleanup.js  | Write\|Edit                                 | <10ms          | File operations    |

**Total Overhead**:

- Without optimization: ~250ms per ANY tool call
- With optimization: ~15ms for most tools, ~250ms only for Task tool
- **Efficiency Gain**: ~50-60% reduction in hook overhead

**Recursion Prevention** (P0 Fix - 2026-01-10):

All hooks now include 4-layer recursion protection:

1. **Explicit Exclusion**: Task/TodoWrite tools skipped
2. **Recursion Guard**: Environment variables prevent re-entry
3. **Matcher Restriction**: No wildcard matchers for audit hooks
4. **Timeout Protection**: 1-second hard timeout

See `.claude/docs/HOOK_RECURSION_PREVENTION.md` for details.

---

## Available Hooks

### run-observer.mjs (PreToolUse/PostToolUse) - **Session Observability**

Creates durable progress state for long-running agent workflows:

- Writes `.claude/context/runtime/runs/<runId>/state.json` (heartbeat, current agent/activity, errors)
- Appends `.claude/context/runtime/runs/<runId>/events.ndjson` (event log)
- Writes `.claude/context/artifacts/tool-events/run-<runId>.ndjson` (easy-grep tool event stream)
- Enables `node .claude/tools/workflow-dashboard.mjs --watch` and `node .claude/tools/session-recovery.mjs detect`

Trace/span fields (OTel/W3C compatible, backward compatible with existing events):

- Every event includes `trace_id`, `span_id`, `parent_span_id`, `traceparent`, plus normalized `span_kind` and `event_type`.
- `pre`/`post` tool events share the same `span_id` for easy span reconstruction.

Optional deep-debug outputs (disabled unless enabled via env):

- `CLAUDE_OBS_STORE_PAYLOADS=1`: on `PostToolUse`, store sanitized tool inputs/outputs under `.claude/context/payloads/` and link from the event via `event.payload.payload_ref`.
- `CLAUDE_OBS_FAILURE_BUNDLES=1`: on tool failures, emit a trace-linked bundle JSON under `.claude/context/artifacts/failure-bundles/`.

Subagent attribution hardening:

- Tracks `Task`→`SubagentStart` mappings in `state.json` (`pending_subagents`) and restores parents via `subagent_parent_stack`.
- Drops stale pending entries after ~3 minutes (override via `CLAUDE_PENDING_SUBAGENT_TTL_MS`).
- Emits metrics in `state.json` under `metrics`: `pending_subagents_max`, `subagent_parent_stack_max`, `pending_subagents_stale_dropped`.

### read-only-enforcer.mjs (PreToolUse) - **Optional Read-Only Mode**

Provides a single safety switch to prevent repo mutations during audits/diagnostics:

- Blocks `Write`/`Edit` when enabled
- Blocks mutating `Bash` commands (git commit/push, installs, rm/mv/cp, redirects)

Enable:

- File: `.claude/context/tmp/read-only.json` (`{ "enabled": true }`)
- Env: `CLAUDE_READ_ONLY=true`

Helper tool: `node .claude/tools/read-only.mjs enable|disable|status`

### router-first-enforcer.mjs (PreToolUse) - **Router-First Enforcement + Handoff**

Enforces that all work is routed before any non-router tool use proceeds, and (when applicable) requires a handoff to the router-selected `escalation_target`.

Docs:

- `.claude/docs/ROUTER_FIRST_ENFORCEMENT_GUIDE.md`

### router-glob-guard.mjs (PreToolUse) - **OOM Prevention During Routing**

During routing, blocks non-`.claude/`-scoped `Glob` patterns to prevent extremely large tool outputs (which can spike memory and crash Claude Code).

Allows during routing:

- `.claude/workflows/*.yaml`
- `.claude/agents/*.md`

Once routing completes, normal Glob behavior resumes (other guards may still apply).

### orchestrator-enforcement-hook.mjs (PreToolUse/PostToolUse) - **Phase 1 Enforcement**

**NEW**: Enforces orchestrator delegation rules by blocking direct implementation work.

Prevents orchestrators from using implementation tools directly, forcing them to delegate via Task tool.

**Blocked Tools for Orchestrators**:

- `Write` → must delegate to developer
- `Edit` → must delegate to developer
- `Bash` with rm/git commands → must delegate to developer
- `Bash` with validation scripts → must delegate to qa
- `Read` (>2 files) → must delegate to analyst/Explore
- `Grep` → must delegate to analyst
- `Glob` → must delegate to analyst

**Benefits**:

- Prevents orchestrators from doing work directly
- Enforces the "orchestrators manage, not implement" rule
- Clear violation messages with correct delegation patterns
- 2-FILE RULE enforcement for Read tool
- Zero false positives (only affects orchestrator agents)

**Testing**: Run `node .claude/hooks/test-orchestrator-enforcement-hook.mjs`

**Configuration**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true
      }
    ],
    "PostToolUse": [
      {
        "path": ".claude/hooks/orchestrator-enforcement-hook.mjs",
        "enabled": true
      }
    ]
  }
}
```

**Violation Example**:

```
Orchestrator attempts: Write tool
Hook blocks with:
╔══════════════════════════════════════════════════════════╗
║  ORCHESTRATOR VIOLATION DETECTED                         ║
║  Tool: Write                                             ║
║  Reason: Orchestrators MUST NOT write files directly     ║
║  Action: Spawn developer subagent via Task tool          ║
╚══════════════════════════════════════════════════════════╝
```

---

### skill-injection-hook.js (PreToolUse) - **Phase 2B**

**NEW**: Automatically injects skill requirements into Task tool calls.

When an orchestrator spawns a subagent using the Task tool, this hook intercepts the call and enhances the prompt with required and triggered skills from skill-integration-matrix.json.

**Benefits**:

- Zero orchestrator overhead (no manual skill management)
- Guaranteed consistency (always uses latest skill matrix)
- 90%+ context savings (only loads relevant skills)
- <100ms performance overhead (~7ms actual)
- Fail-safe (never blocks on errors)

**Documentation**: See `.claude/docs/SKILL_INJECTION_HOOK.md`
**Example**: See `.claude/docs/examples/skill-injection-example.md`
**Testing**: Run `node .claude/hooks/test-skill-injection-hook.js`

**Configuration**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "tool": "Task",
        "command": ".claude/hooks/skill-injection-hook.sh"  // Linux/macOS
        // OR
        "command": ".claude/hooks/skill-injection-hook.ps1"  // Windows
      }
    ]
  }
}
```

### security-pre-tool.mjs (PreToolUse) - **Cross-Platform**

**NEW**: Pure Node.js implementation for Windows/macOS/Linux compatibility.

Validates tool usage before execution:

- Blocks dangerous bash commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`, etc.)
- Prevents force push to main/master branches
- Protects `.env` files and credential files from editing
- Blocks potentially malicious curl/wget piped to bash
- Blocks SQL injection patterns (`DROP DATABASE`, `DELETE FROM WHERE 1=1`)
- Blocks PowerShell encoded commands (Windows-specific)

**Replaced**: `security-pre-tool.sh` (deprecated - Unix-only)

**Performance**: ~12ms execution time (73% faster than bash version)

### audit-post-tool.mjs (PostToolUse) - **Cross-Platform**

**NEW**: Pure Node.js implementation for Windows/macOS/Linux compatibility.

Logs tool executions for audit trail:

- Records timestamp, tool name, and summary
- Stores logs in `~/.claude/audit/tool-usage.log`
- Auto-rotates logs to prevent disk bloat (keeps last 10,000 entries at 10MB)
- Cross-platform timestamp formatting (ISO 8601 UTC)

**Replaced**: `audit-post-tool.sh` (deprecated - Unix-only)

**Performance**: ~9ms execution time (76% faster than bash version)

---

### post-task-output-retriever.mjs (PostToolUse) - **NEW: Orchestration Visibility**

**Purpose**: Automatically retrieves and displays agent outputs after Task tool completes. Solves the "black box" problem where users don't see what agents produced.

**Features**:

- Intercepts Task tool completion via PostToolUse hook
- Retrieves agent output from Task results
- Scans for newly created artifacts (last 60 seconds)
- Displays formatted summary with file paths, sizes, timestamps
- Shows first 1000 characters of agent output

**Triggered By**: Task tool (agent delegation)

**Output Example**:

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 POST-TASK OUTPUT RETRIEVAL                              │
└─────────────────────────────────────────────────────────────┘

Agent Type: developer
Description: Implement skill conversion
Agent ID: a14493c

📁 Scanning for artifacts created by agent...

✓ Found 3 artifact(s):
  📄 .claude/skills/ralph-wiggum/SKILL.md (12.5 KB)
  📄 .claude/templates/ralph-wiggum-task.json (3.2 KB)
  📄 plan-ralph-wiggum-2026-01-16.md (8.1 KB)
```

**Configuration**:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-task-output-retriever.mjs"
          }
        ]
      }
    ]
  }
}
```

**Testing**: Run `node .claude/hooks/post-task-output-retriever.mjs` (shows recent artifacts)

**Performance**: ~100ms execution time (artifact scanning + summary generation)

**Priority**: 50 (runs after Task but before other PostToolUse hooks)

**Research Patterns Applied**:

- **CrewAI**: Real-time output display, session artifact tracking
- **AutoGen**: Conversation transparency, agent output visibility
- **LangChain**: Callback-based result retrieval

---

## Installation

Register these hooks in Claude Code:

```bash
# Option 1: Use /hooks command in Claude Code
/hooks

# Option 2: Add to your Claude Code settings
```

### Manual Registration

Add to your Claude Code configuration:

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
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/audit-post-tool.mjs"
          }
        ]
      }
    ]
  }
}
```

## Hook Input/Output Format

### Input (via stdin)

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la"
  },
  "timestamp": "2025-11-28T12:00:00Z"
}
```

### Output (PreToolUse only)

```json
{"decision": "approve"}
// or
{"decision": "block", "reason": "Explanation for blocking"}
```

## Testing Hooks

### Automated Testing (Recommended)

Run the comprehensive test suite:

```bash
node .claude/tests/test-hooks.mjs
```

**Expected Output**:

```
🚀 Hook Testing Suite
════════════════════════════════════════════════════════════

🧪 Testing security-pre-tool.mjs...
  ✅ Should block rm -rf /
  ✅ Should block SQL injection
  ✅ Should block force push to main
  ✅ Should block .env editing
  ✅ Should allow safe git commands
  ✅ Should allow safe file writes
  Passed: 6/6

🧪 Testing audit-post-tool.mjs...
  ✅ Should log Bash command
  ✅ Should log Write operation
  Passed: 2/2

📊 Test Summary
  Total Passed: 8
  Total Failed: 0
  Success Rate: 100.0%

✅ All tests passed
```

### Manual Testing

```bash
# Test security hook - should block
echo '{"tool":"Bash","tool_input":{"command":"rm -rf /"}}' | node .claude/hooks/security-pre-tool.mjs
# Expected: {"decision": "block", "reason": "Blocked dangerous command pattern: rm\\s+-rf\\s+\\/"}

# Test security hook - should allow
echo '{"tool":"Bash","tool_input":{"command":"git status"}}' | node .claude/hooks/security-pre-tool.mjs
# Expected: {"decision": "approve"}

# Test audit hook
echo '{"tool":"Bash","tool_input":{"command":"npm test"}}' | node .claude/hooks/audit-post-tool.mjs
cat ~/.claude/audit/tool-usage.log
```

## Customization

### Adding Blocked Patterns

Edit `security-pre-tool.mjs` and add patterns to `DANGEROUS_PATTERNS` array:

```javascript
const DANGEROUS_PATTERNS = [
  // Add your custom pattern
  /your-dangerous-pattern/i,
  // ... existing patterns
];
```

### Protecting Additional Files

Add patterns to `SENSITIVE_FILE_PATTERNS` in `security-pre-tool.mjs`:

```javascript
const SENSITIVE_FILE_PATTERNS = [
  /\.env($|\.local|\.production|\.secret)/,
  /your-custom-pattern/i,
  // ... existing patterns
];
```

### Custom Audit Format

Modify the logging format in `audit-post-tool.mjs`:

```javascript
const logEntry = `${timestamp} | ${toolName} | ${summary} | YOUR_CUSTOM_FIELD\n`;
```

## Windows Compatibility (2026-01-10 Update)

**BREAKING CHANGE**: Bash hooks (.sh) have been replaced with cross-platform Node.js hooks (.mjs).

**Migration**:

- ✅ All hooks now work on Windows/macOS/Linux
- ✅ No action required - settings.json already updated
- ✅ Old .sh files deprecated (but preserved for reference)

**See**: `.claude/docs/TROUBLESHOOTING.md` → "Hook Errors" section for detailed migration guide.

**Test**: Run `node .claude/tests/test-hooks.mjs` to verify all hooks work correctly.

## Python Hook Examples

Based on Claude Cookbooks Chief of Staff agent patterns, comprehensive Python hook examples are available:

### Report Tracker (PostToolUse)

Tracks all file writes and edits for audit trail. Full implementation and configuration details in [HOOK_PATTERNS.md](../docs/HOOK_PATTERNS.md#pattern-1-report-tracker-posttooluse).

**Key Features:**

- Tracks file creation and modification
- Maintains history with timestamps
- Calculates word counts
- Keeps last 50 entries

**Configuration:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py" }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py" }
        ]
      }
    ]
  }
}
```

### Script Usage Logger (PostToolUse)

Logs when Python scripts are executed via Bash tool. Full implementation in [HOOK_PATTERNS.md](../docs/HOOK_PATTERNS.md#pattern-2-script-usage-logger-posttooluse).

**Key Features:**

- Detects Python script execution
- Logs command and description
- Tracks success/failure
- Keeps last 100 entries

**Configuration:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/script-usage-logger.py"
          }
        ]
      }
    ]
  }
}
```

### Security Validator (PreToolUse)

Validates tool usage before execution. Full implementation in [HOOK_PATTERNS.md](../docs/HOOK_PATTERNS.md#pattern-3-security-validation-pretooluse).

**Key Features:**

- Blocks dangerous bash commands
- Prevents editing sensitive files
- Returns allow/block decisions

**Configuration:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/security-validator.py"
          }
        ]
      }
    ]
  }
}
```

### Notification Hook (PostToolUse)

Sends notifications for important events. Full implementation in [HOOK_PATTERNS.md](../docs/HOOK_PATTERNS.md#pattern-4-notification-hook-posttooluse).

**Key Features:**

- Detects important operations
- Sends notifications (Slack, email, etc.)
- Configurable importance patterns

## Advanced Patterns

See [HOOK_PATTERNS.md](../docs/HOOK_PATTERNS.md) for comprehensive hook patterns including:

- Audit trail tracking
- Script usage logging
- Security validation
- Notification hooks
- Best practices
- Testing hooks
- Integration with Agent SDK

## Setting Sources

**IMPORTANT**: Hooks configured in `settings.local.json` require `setting_sources=["project", "local"]` in SDK configuration:

```python
options = ClaudeAgentOptions(
    setting_sources=["project", "local"],  # Required for hooks
    # ... other options
)
```

## Security Note

These hooks provide a defense-in-depth layer but should not be relied upon as the only security measure. Always:

- Review generated code before execution
- Use proper access controls on your system
- Keep sensitive files outside the project directory
