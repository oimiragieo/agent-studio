# Hook Patterns Guide

Comprehensive guide to Claude Code hooks based on patterns from Claude Cookbooks Chief of Staff agent. Hooks enable automated, deterministic actions at lifecycle events.

## Overview

Hooks are Python scripts or shell scripts that execute automatically at specific lifecycle events. They provide a way to enforce guardrails, create audit trails, and automate compliance tracking.

### Hook Types

- **PreToolUse**: Execute before tool execution (can block operations)
- **PostToolUse**: Execute after tool execution (logging, tracking)
- **UserPromptSubmit**: Execute when user submits a prompt
- **Notification**: Execute for notifications
- **Stop**: Execute when agent stops

## Configuration

Hooks are configured in `.claude/settings.local.json`:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
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
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py"
          }
        ]
      }
    ]
  }
}
```

### Setting Sources

**IMPORTANT**: Hooks configured in `settings.local.json` require `setting_sources=["project", "local"]` in SDK configuration:

```python
options = ClaudeAgentOptions(
    setting_sources=["project", "local"],  # Required for hooks
    # ... other options
)
```

The SDK distinguishes between three setting sources:
- `"project"` → `.claude/settings.json` (version-controlled, team-shared)
- `"local"` → `.claude/settings.local.json` (gitignored, local settings like hooks)
- `"user"` → `~/.claude/settings.json` (global user settings)

## Pattern 1: Report Tracker (PostToolUse)

Tracks all file writes and edits for audit trail and compliance.

### Use Case

- Compliance tracking
- Audit trails
- Document change history
- Word count tracking

### Implementation

Create `.claude/hooks/report-tracker.py`:

```python
#!/usr/bin/env python3
"""
PostToolUse hook: Tracks ALL file writes and edits
Maintains history of all document changes for compliance
"""

import json
import os
import sys
from datetime import datetime


def track_report(tool_name, tool_input, tool_response):
    """Log ALL file creation/modification for audit trail"""
    
    # Get file path from tool input
    file_path = tool_input.get("file_path", "")
    
    if not file_path:
        return
    
    # Prepare history file path
    history_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 
        "../../audit/report_history.json"
    )
    
    try:
        # Load existing history or create new
        if os.path.exists(history_file):
            with open(history_file) as f:
                history = json.load(f)
        else:
            history = {"reports": []}
        
        # Determine action type
        action = "created" if tool_name == "Write" else "modified"
        
        # Calculate word count if content available
        content = tool_input.get("content", "") or tool_input.get("new_string", "")
        word_count = len(content.split()) if content else 0
        
        # Create history entry
        entry = {
            "timestamp": datetime.now().isoformat(),
            "file": os.path.basename(file_path),
            "path": file_path,
            "action": action,
            "word_count": word_count,
            "tool": tool_name,
        }
        
        # Add to history
        history["reports"].append(entry)
        
        # Keep only last 50 entries
        history["reports"] = history["reports"][-50:]
        
        # Save updated history
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        with open(history_file, "w") as f:
            json.dump(history, f, indent=2)
        
    except Exception as e:
        print(f"Report tracking error: {e}", file=sys.stderr)


# Main execution
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_response = input_data.get("tool_response", {})
        
        # Track the report
        track_report(tool_name, tool_input, tool_response)
        
        # Always exit successfully
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)
```

### Configuration

Add to `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py"
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/report-tracker.py"
          }
        ]
      }
    ]
  }
}
```

### Key Features

- Tracks file creation and modification
- Maintains history with timestamps
- Calculates word counts
- Keeps last 50 entries
- JSON format for easy parsing

## Pattern 2: Script Usage Logger (PostToolUse)

Logs when Python scripts are executed via Bash tool.

### Use Case

- Track script execution
- Monitor tool usage
- Audit Python script calls
- Performance monitoring

### Implementation

Create `.claude/hooks/script-usage-logger.py`:

```python
#!/usr/bin/env python3
"""
PostToolUse hook: Logs when Python scripts are executed via the Bash tool
"""

import json
import os
import sys
import re
from datetime import datetime


def log_script_usage(tool_name, tool_input, tool_response):
    """Log execution of Python scripts via Bash tool"""
    
    # Only track Bash tool
    if tool_name != "Bash":
        return
    
    # Get the command from tool input
    command = tool_input.get("command", "")
    
    # Check if it's executing a Python script from scripts/ directory
    script_match = re.search(r"(?:python\s+)?(?:\./)?scripts/(\w+\.py)", command)
    if not script_match:
        return
    
    script_file = script_match.group(1)
    
    # Prepare log file path
    log_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 
        "../../audit/script_usage_log.json"
    )
    
    try:
        # Load existing log or create new
        if os.path.exists(log_file):
            with open(log_file) as f:
                log_data = json.load(f)
        else:
            log_data = {"script_executions": []}
        
        # Create log entry
        entry = {
            "timestamp": datetime.now().isoformat(),
            "script": script_file,
            "command": command,
            "description": tool_input.get("description", "No description"),
            "tool_used": "Bash",
            "success": tool_response.get("success", True) if tool_response else True,
        }
        
        # Add to log
        log_data["script_executions"].append(entry)
        
        # Keep only last 100 entries
        log_data["script_executions"] = log_data["script_executions"][-100:]
        
        # Save updated log
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        with open(log_file, "w") as f:
            json.dump(log_data, f, indent=2)
        
    except Exception as e:
        print(f"Script logging error: {e}", file=sys.stderr)


# Main execution
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_response = input_data.get("tool_response", {})
        
        # Log the script usage
        log_script_usage(tool_name, tool_input, tool_response)
        
        # Always exit successfully
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)
```

### Configuration

Add to `.claude/settings.local.json`:

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

### Key Features

- Detects Python script execution
- Logs command and description
- Tracks success/failure
- Keeps last 100 entries
- Filters for scripts/ directory

## Pattern 3: Security Validation (PreToolUse)

Validates tool usage before execution to prevent dangerous operations.

### Use Case

- Block dangerous bash commands
- Prevent editing sensitive files
- Enforce security policies
- Guard against malicious operations

### Implementation

Create `.claude/hooks/security-validator.py`:

```python
#!/usr/bin/env python3
"""
PreToolUse hook: Validates tool usage before execution
Blocks dangerous operations and protects sensitive files
"""

import json
import sys


def validate_tool_usage(tool_name, tool_input):
    """Validate tool usage and return allow/block decision"""
    
    # Block dangerous bash commands
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        
        dangerous_patterns = [
            "rm -rf",
            "sudo rm",
            "mkfs",
            "dd if=",
            "> /dev/sd",
        ]
        
        for pattern in dangerous_patterns:
            if pattern in command:
                return {
                    "decision": "block",
                    "reason": f"Blocked dangerous command pattern: {pattern}"
                }
    
    # Block editing sensitive files
    if tool_name in ["Write", "Edit"]:
        file_path = tool_input.get("file_path", "")
        
        protected_patterns = [
            ".env",
            "secrets/",
            "credentials",
            ".ssh/",
        ]
        
        for pattern in protected_patterns:
            if pattern in file_path:
                return {
                    "decision": "block",
                    "reason": f"Blocked editing protected file: {pattern}"
                }
    
    # Allow by default
    return {"decision": "allow"}


# Main execution
if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        # Validate tool usage
        result = validate_tool_usage(tool_name, tool_input)
        
        # Output decision as JSON
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        # On error, block for safety
        print(json.dumps({
            "decision": "block",
            "reason": f"Validation error: {str(e)}"
        }))
        sys.exit(1)
```

### Configuration

Add to `.claude/settings.local.json`:

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

### Key Features

- Blocks dangerous bash commands
- Prevents editing sensitive files
- Returns allow/block decisions
- JSON output format

## Pattern 4: Notification Hook (PostToolUse)

Sends notifications for important events.

### Use Case

- Slack notifications
- Email alerts
- Webhook calls
- Event logging

### Implementation

Create `.claude/hooks/notification-hook.py`:

```python
#!/usr/bin/env python3
"""
PostToolUse hook: Sends notifications for important events
"""

import json
import os
import sys
from datetime import datetime


def send_notification(tool_name, tool_input, tool_response):
    """Send notification for important operations"""
    
    # Define important patterns
    important_patterns = [
        "deploy",
        "production",
        "critical",
        "security",
    ]
    
    # Check if operation is important
    command = tool_input.get("command", "")
    file_path = tool_input.get("file_path", "")
    content = tool_input.get("content", "")
    
    is_important = any(
        pattern in (command + file_path + content).lower()
        for pattern in important_patterns
    )
    
    if not is_important:
        return
    
    # Send notification (example: write to file, could be Slack/email/webhook)
    notification_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "../../notifications/notifications.json"
    )
    
    try:
        if os.path.exists(notification_file):
            with open(notification_file) as f:
                notifications = json.load(f)
        else:
            notifications = {"notifications": []}
        
        entry = {
            "timestamp": datetime.now().isoformat(),
            "tool": tool_name,
            "message": f"Important operation: {tool_name}",
            "details": {
                "command": command,
                "file_path": file_path,
            }
        }
        
        notifications["notifications"].append(entry)
        notifications["notifications"] = notifications["notifications"][-100:]
        
        os.makedirs(os.path.dirname(notification_file), exist_ok=True)
        with open(notification_file, "w") as f:
            json.dump(notifications, f, indent=2)
        
    except Exception as e:
        print(f"Notification error: {e}", file=sys.stderr)


# Main execution
if __name__ == "__main__":
    try:
        input_data = json.load(sys.stdin)
        
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_response = input_data.get("tool_response", {})
        
        send_notification(tool_name, tool_input, tool_response)
        sys.exit(0)
        
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)
```

## Best Practices

### 1. Always Exit Successfully

Hooks should exit with code 0 even on errors to avoid blocking agent execution:

```python
try:
    # Hook logic
    pass
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(0)  # Always exit successfully
```

### 2. Use JSON for Input/Output

Hooks receive JSON via stdin and should output JSON for PreToolUse:

```python
# Read input
input_data = json.load(sys.stdin)

# PreToolUse: Output decision
print(json.dumps({"decision": "allow"}))
```

### 3. Handle Missing Data Gracefully

Check for required fields before accessing:

```python
file_path = tool_input.get("file_path", "")
if not file_path:
    return  # Skip if no file path
```

### 4. Limit History Size

Keep only recent entries to prevent disk bloat:

```python
history["entries"] = history["entries"][-100:]  # Keep last 100
```

### 5. Create Audit Directories

Ensure directories exist before writing:

```python
os.makedirs(os.path.dirname(log_file), exist_ok=True)
```

## Testing Hooks

### Test Report Tracker

```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"test.md","content":"Test"}}' | python .claude/hooks/report-tracker.py
cat audit/report_history.json
```

### Test Security Validator

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | python .claude/hooks/security-validator.py
# Expected: {"decision": "block", "reason": "Blocked dangerous command pattern: rm -rf"}
```

### Test Script Logger

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"python scripts/test.py"}}' | python .claude/hooks/script-usage-logger.py
cat audit/script_usage_log.json
```

## Integration with Agent SDK

When using the Claude Agent SDK, ensure hooks are loaded:

```python
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

options = ClaudeAgentOptions(
    setting_sources=["project", "local"],  # Required for hooks
    cwd="./your_agent_directory",
    # ... other options
)

async with ClaudeSDKClient(options=options) as agent:
    await agent.query("Your prompt here")
```

## References

- [Claude Cookbooks - Chief of Staff Agent](https://github.com/anthropics/anthropic-cookbook/tree/main/claude_agent_sdk/chief_of_staff_agent)
- [Hooks README](../hooks/README.md)
- [Claude Code Settings Schema](https://json.schemastore.org/claude-code-settings.json)
