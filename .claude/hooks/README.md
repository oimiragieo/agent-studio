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

## Security Note

These hooks provide a defense-in-depth layer but should not be relied upon as the only security measure. Always:
- Review generated code before execution
- Use proper access controls on your system
- Keep sensitive files outside the project directory
