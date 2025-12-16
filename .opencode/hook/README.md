# OpenCode Native Hooks

This directory contains native hooks - shell scripts that execute at lifecycle events.

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
- Stores logs in `~/.opencode/audit/tool-usage.log`
- Auto-rotates logs to prevent disk bloat

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
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | bash .opencode/hook/security-pre-tool.sh
# Expected: {"decision": "block", "reason": "Blocked dangerous command pattern: rm -rf /"}

echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | bash .opencode/hook/security-pre-tool.sh
# Expected: {"decision": "allow"}
```

## Customization

### Adding Blocked Patterns
Edit `security-pre-tool.sh` and add patterns to `DANGEROUS_PATTERNS` array.

### Protecting Additional Files
Add patterns to the file protection section in `security-pre-tool.sh`.
