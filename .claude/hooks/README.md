# Claude Code Native Hooks

This directory contains **native Claude Code hooks** - shell scripts that execute at lifecycle events.

## Available Hooks

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
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py"}]
      },
      {
        "matcher": "Edit",
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py"}]
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
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/script-usage-logger.py"}]
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
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/security-validator.py"}]
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
