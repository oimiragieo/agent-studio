# Claude Code Native Hooks

This directory contains **native Claude Code hooks** - shell scripts that execute at lifecycle events.

## Hook Execution Order (2.1.2+)

Hooks execute in a predictable sequence during tool execution:

### PreToolUse Hooks (Before Execution)

Hooks run in this order BEFORE any tool executes:

1. **security-pre-tool.sh** (blocks dangerous commands)
2. **orchestrator-enforcement-hook.mjs** (enforces orchestrator rules)
3. **skill-injection-hook.js** (injects skills into Task calls)

**Exclusions**: TodoWrite and Task tools are excluded from most PreToolUse hooks to prevent recursion.

### PostToolUse Hooks (After Execution)

Hooks run in this order AFTER tool execution completes:

1. **audit-post-tool.sh** (logs tool execution)
2. **skill-injection-hook.js** (validates injected skills)

## Hook Performance (Updated 2.1.2)

**Optimization**: Hook matchers now use specific tool patterns instead of wildcards

| Hook                     | Matcher                             | Execution Time | Runs On            |
| ------------------------ | ----------------------------------- | -------------- | ------------------ |
| security-pre-tool.sh     | Bash\|Write\|Edit                   | <5ms           | Only risky tools   |
| file-path-validator.js   | \*                                  | <10ms          | All tools (needed) |
| orchestrator-enforcement | Read\|Write\|Edit\|Bash\|Grep\|Glob | <10ms          | Orchestrator tools |
| skill-injection-hook.js  | Task                                | ~224ms         | Subagent spawning  |
| audit-post-tool.sh       | \*                                  | <5ms           | All tools (audit)  |
| post-session-cleanup.js  | Write\|Edit                         | <10ms          | File operations    |

**Total Overhead**:

- Without optimization: ~250ms per ANY tool call
- With optimization: ~15ms for most tools, ~250ms only for Task tool
- **Efficiency Gain**: ~50-60% reduction in hook overhead

---

## Available Hooks

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

### security-pre-tool.sh (PreToolUse)

Validates tool usage before execution:

- Blocks dangerous bash commands (`rm -rf`, `sudo rm`, `mkfs`, `dd`, etc.)
- Prevents force push to main/master branches
- Protects `.env` files and credential files from editing
- Blocks potentially malicious curl/wget piped to bash

### audit-post-tool.sh (PostToolUse)

Logs tool executions for audit trail:

- Records timestamp, tool name, and summary
- Stores logs in `~/.claude/audit/tool-usage.log`
- Auto-rotates logs to prevent disk bloat

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
        "command": "bash .claude/hooks/security-pre-tool.sh"
      }
    ],
    "PostToolUse": [
      {
        "command": "bash .claude/hooks/audit-post-tool.sh"
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
{"decision": "allow"}
// or
{"decision": "block", "reason": "Explanation for blocking"}
```

## Testing Hooks

```bash
# Test security hook
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | bash .claude/hooks/security-pre-tool.sh
# Expected: {"decision": "block", "reason": "Blocked dangerous command pattern: rm -rf /"}

echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | bash .claude/hooks/security-pre-tool.sh
# Expected: {"decision": "allow"}

# Test audit hook
echo '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' | bash .claude/hooks/audit-post-tool.sh
cat ~/.claude/audit/tool-usage.log
```

## Customization

### Adding Blocked Patterns

Edit `security-pre-tool.sh` and add patterns to `DANGEROUS_PATTERNS` array.

### Protecting Additional Files

Add patterns to the file protection section in `security-pre-tool.sh`.

### Custom Audit Format

Modify the logging format in `audit-post-tool.sh`.

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
