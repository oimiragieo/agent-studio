# Agent Template

Template for creating new agents based on Claude Cookbooks Chief of Staff pattern. This template includes all features: memory, subagents, hooks, output styles, and slash commands.

## Agent Overview

**Agent Name**: [Your Agent Name]
**Purpose**: [Brief description of agent's purpose]
**Model**: [claude-sonnet-4-5 | claude-opus-4-5 | claude-haiku-4-5]

## Features Included

- ✅ Memory: CLAUDE.md context loading
- ✅ Subagents: Specialized agent delegation
- ✅ Custom Scripts: Python scripts via Bash tool
- ✅ Slash Commands: User-friendly shortcuts
- ✅ Output Styles: Tailored communication formats
- ✅ Hooks: Automated compliance tracking
- ✅ Plan Mode: Strategic planning without execution

## Directory Structure

```
your_agent/
├── agent.py                 # Main agent implementation
├── CLAUDE.md                # Agent context and instructions
├── scripts/                 # Python scripts for procedural knowledge
│   ├── script1.py
│   └── script2.py
├── data/                    # Agent-specific data files
├── output_reports/          # Generated reports
├── audit/                   # Hook-generated audit logs
│   ├── report_history.json
│   └── script_usage_log.json
└── .claude/                 # Claude Code configuration
    ├── agents/              # Subagent definitions
    │   └── subagent-name.md
    ├── commands/            # Custom slash commands
    │   └── custom-command.md
    ├── hooks/               # Hook scripts
    │   ├── report-tracker.py
    │   └── script-usage-logger.py
    ├── output-styles/       # Output style definitions
    │   ├── executive.md
    │   └── technical.md
    └── settings.local.json  # Hook configuration
```

## Implementation Steps

### 1. Create Agent Directory

```bash
mkdir -p your_agent/{scripts,data,output_reports,audit,.claude/{agents,commands,hooks,output-styles}}
```

### 2. Create CLAUDE.md

See `agent-claude-md-template.md` for template.

### 3. Create agent.py

See `agent-template.py` for implementation.

### 4. Configure Hooks

Create hook scripts in `.claude/hooks/` and configure in `.claude/settings.local.json`.

### 5. Define Subagents

Create subagent definitions in `.claude/agents/`.

### 6. Create Slash Commands

Define custom commands in `.claude/commands/`.

### 7. Define Output Styles

Create output style definitions in `.claude/output-styles/`.

## Usage Example

```python
from your_agent.agent import send_query

# Basic usage
result, messages = await send_query("Your prompt here")

# With output style
result, messages = await send_query(
    "Generate a report",
    output_style="executive"
)

# With plan mode
result, messages = await send_query(
    "Plan a complex task",
    permission_mode="plan"
)
```

## Key Configuration

### Setting Sources

**CRITICAL**: Must include `"project"` and `"local"` to load:
- Slash commands from `.claude/commands/`
- CLAUDE.md project instructions
- Subagent definitions from `.claude/agents/`
- Hooks from `.claude/settings.local.json`

```python
options = ClaudeAgentOptions(
    setting_sources=["project", "local"],  # Required!
    # ... other options
)
```

### Allowed Tools

Configure tools based on agent needs:

```python
allowed_tools=[
    "Task",      # Enables subagent delegation
    "Read",
    "Write",
    "Edit",
    "Bash",      # For Python scripts
    "WebSearch",
]
```

## Testing

### Test Basic Functionality

```python
result, messages = await send_query("Hello, what can you do?")
print(result)
```

### Test Hooks

```python
# Trigger a Write operation
result, messages = await send_query("Create a test report")

# Check audit log
import json
with open("audit/report_history.json") as f:
    history = json.load(f)
    print(history["reports"][-1])
```

### Test Subagents

```python
result, messages = await send_query(
    "Use the financial-analyst subagent to analyze Q3 budget"
)
```

## Next Steps

1. Customize CLAUDE.md with your agent's context
2. Add domain-specific scripts to `scripts/`
3. Define subagents for specialized tasks
4. Create custom slash commands
5. Configure hooks for your use case
6. Test and iterate

## References

- [Claude Cookbooks - Chief of Staff Agent](https://github.com/anthropics/anthropic-cookbook/tree/main/claude_agent_sdk/chief_of_staff_agent)
- [Hook Patterns Guide](../docs/HOOK_PATTERNS.md)
- [Advanced Tool Use](../docs/ADVANCED_TOOL_USE.md)
