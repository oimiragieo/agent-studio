# Advanced Orchestration Patterns

## Overview

Comprehensive guide to advanced orchestration patterns from Claude Agent SDK, including subagent coordination, output styles, plan mode, hooks, and MCP integration.

## Subagent Orchestration

### Task Tool Delegation

**Pattern**: Use Task tool to delegate work to specialized subagents.

**How It Works**:
1. Orchestrator receives complex request
2. Identifies which subagents are needed
3. Uses Task tool to delegate to subagents
4. Subagents execute in separate context windows
5. Results returned to orchestrator
6. Orchestrator synthesizes final output

**Example**:
```
Orchestrator → Task Tool → Financial Analyst Subagent
                         → Recruiter Subagent
                         → Synthesize Results
```

### Subagent Configuration

Subagents are defined in `.claude/agents/`:
- Each subagent has its own agent definition
- Subagents can have their own tools and context
- Subagents execute in fresh context windows
- Results passed back to orchestrator

### Best Practices

1. **Clear Delegation**: Provide clear objectives to subagents
2. **Context Handoff**: Pass necessary context to subagents
3. **Result Synthesis**: Combine subagent outputs effectively
4. **Error Handling**: Handle subagent failures gracefully

## Output Styles

### Overview

Output styles allow different output formats for different audiences without creating separate agents.

### Configuration

Output styles are defined in `.claude/output-styles/`:

**Example**: `.claude/output-styles/executive.md`
```markdown
---
name: executive
description: Executive summary format for C-level audience
---

# Executive Output Style

Focus on:
- High-level insights
- Business impact
- Strategic recommendations
- Concise summaries
```

### Usage

**In Agent Configuration**:
```yaml
output_styles:
  - executive
  - technical
  - board-report
```

**In API Calls**:
```python
settings = json.dumps({"outputStyle": "executive"})
options = ClaudeAgentOptions(
    settings=settings,
    setting_sources=["project", "local"]
)
```

### Benefits

- **Single Agent, Multiple Formats**: One agent, multiple output styles
- **Audience-Specific**: Tailor output to audience needs
- **Flexible**: Easy to add new styles
- **Consistent**: Maintains agent capabilities across styles

## Plan Mode

### Overview

Plan mode allows agents to create execution plans for approval before taking action.

### Configuration

**Permission Mode**: `"plan"` (think only, no execution)

```python
options = ClaudeAgentOptions(
    permission_mode="plan",  # "default" | "plan" | "acceptEdits"
    setting_sources=["project", "local"]
)
```

### Usage

1. **Agent Creates Plan**: Agent generates execution plan
2. **User Reviews**: User reviews and approves plan
3. **Execution**: Agent executes approved plan
4. **Iteration**: Can iterate on plan before execution

### Benefits

- **Safety**: Review before execution
- **Control**: User approval for critical actions
- **Transparency**: See agent's planned actions
- **Iteration**: Refine plans before execution

## Hooks

### Overview

Hooks allow executing custom code after specific agent actions (e.g., after file writes, tool usage).

### Configuration

Hooks are defined in `.claude/hooks/` and configured in `.claude/settings.local.json`:

**Hook Definition**: `.claude/hooks/audit-write.md`
```markdown
---
name: audit-write
trigger: after_write
description: Audit trail for file writes
---

Log all file writes to audit trail.
```

**Hook Configuration**: `.claude/settings.local.json`
```json
{
  "hooks": {
    "after_write": ["audit-write"],
    "after_tool_use": ["audit-tool"]
  }
}
```

### Hook Types

- **after_write**: Triggered after file writes
- **after_tool_use**: Triggered after tool usage
- **before_execution**: Triggered before execution
- **after_execution**: Triggered after execution

### Use Cases

- **Audit Trails**: Log all agent actions
- **Compliance**: Track compliance-related actions
- **Notifications**: Send notifications on events
- **Validation**: Validate actions before completion

## Custom Scripts

### Overview

Agents can execute custom Python/JavaScript scripts via Bash tool.

### Pattern

1. **Script Location**: Place scripts in `scripts/` directory
2. **Agent Execution**: Agent calls scripts via Bash tool
3. **Script Results**: Scripts return results to agent
4. **Agent Processing**: Agent processes script results

### Example

**Script**: `scripts/financial_forecast.py`
```python
def calculate_forecast(data):
    # Complex financial modeling
    return forecast_results
```

**Agent Usage**:
```
Agent: "Run financial forecast script with Q4 data"
Bash: python scripts/financial_forecast.py --data q4_data.json
Script: Returns forecast results
Agent: Processes and presents results
```

## Slash Commands

### Overview

Slash commands provide shortcuts for common agent actions.

### Configuration

Slash commands are defined in `.claude/commands/`:

**Example**: `.claude/commands/budget-impact.md`
```markdown
---
name: budget-impact
description: Analyze budget impact of a decision
---

Analyze the budget impact of: {{decision}}

Include:
- Cost analysis
- Revenue impact
- Risk assessment
- Recommendations
```

### Usage

Users can invoke slash commands:
```
/budget-impact hiring 5 engineers
```

Expands to full prompt defined in command file.

### Benefits

- **Convenience**: Quick access to common actions
- **Consistency**: Standardized prompts
- **Efficiency**: Faster user interaction
- **Documentation**: Self-documenting commands

## MCP Integration

### Overview

MCP (Model Context Protocol) servers can be integrated for external tool access.

### Configuration

MCP servers configured in `.claude/.mcp.json`:
```json
{
  "mcpServers": {
    "github": {
      "deferLoading": true,
      "alwaysLoadTools": ["create_pull_request"]
    }
  }
}
```

### Integration Patterns

1. **Tool Discovery**: Use Tool Search Tool to discover MCP tools
2. **On-Demand Loading**: Load MCP tools only when needed
3. **Tool Composition**: Combine multiple MCP tools
4. **Error Handling**: Handle MCP tool failures gracefully

## Setting Sources

### Overview

`setting_sources` controls which filesystem settings are loaded.

### Configuration

```python
options = ClaudeAgentOptions(
    setting_sources=["project", "local"]
)
```

**Sources**:
- **"project"**: Loads from `.claude/` directory:
  - Slash commands from `.claude/commands/`
  - CLAUDE.md project instructions
  - Subagent definitions from `.claude/agents/`
  - Output styles from `.claude/output-styles/`
  - Hooks from `.claude/hooks/`
- **"local"**: Loads from local settings:
  - `.claude/settings.local.json`
  - User-specific configurations

**IMPORTANT**: Without `setting_sources=["project"]`, SDK operates in isolation mode with no filesystem settings loaded.

## Advanced Patterns

### Pattern 1: Hierarchical Subagent Coordination

```
Orchestrator
  ├─→ Frontend Lead → [Frontend Specialist, UX Expert]
  ├─→ Backend Lead → [Backend Specialist, Architect]
  └─→ QA Lead → [Test Architect, Security Expert]
```

### Pattern 2: Parallel Subagent Execution

```
Orchestrator
  ├─→ Analyst (parallel)
  ├─→ Architect (parallel)
  └─→ PM (parallel)
      → Synthesize Results
```

### Pattern 3: Iterative Refinement

```
Orchestrator → Architect → QA → [Issues?] → Architect (refine) → QA
```

### Pattern 4: Pipeline Pattern

```
Orchestrator → Analyst → PM → Architect → Developer → QA
```

## Best Practices

1. **Clear Delegation**: Provide clear objectives to subagents
2. **Context Management**: Pass necessary context efficiently
3. **Error Handling**: Handle subagent failures gracefully
4. **Result Synthesis**: Combine outputs effectively
5. **Output Styles**: Use appropriate styles for audience
6. **Plan Mode**: Use for critical or risky operations
7. **Hooks**: Implement audit trails and compliance
8. **MCP Integration**: Leverage external tools when needed

## Examples

### Example 1: Financial Analysis with Subagents

```
User: "/budget-impact hiring 5 engineers"

Orchestrator:
1. Expands slash command
2. Delegates to Financial Analyst subagent
3. Financial Analyst runs hiring_impact.py script
4. Financial Analyst returns analysis
5. Orchestrator synthesizes executive summary
6. Writes report to disk
7. Hook logs to audit trail
```

### Example 2: Multi-Agent Workflow

```
User: "Build a task management app"

Orchestrator:
1. Delegates to Analyst for requirements
2. Delegates to PM for user stories
3. Delegates to Architect for system design
4. Delegates to Developer for implementation
5. Delegates to QA for testing
6. Synthesizes final deliverable
```

### Example 3: Plan Mode Workflow

```
User: "Refactor authentication system"

Orchestrator (Plan Mode):
1. Creates execution plan
2. User reviews and approves
3. Orchestrator executes plan
4. Reports progress
```

## Related Documentation

- [Everlasting Agent System](EVERLASTING_AGENTS.md) - Context window management
- [Memory Patterns](MEMORY_PATTERNS.md) - Dual persistence
- [Extended Thinking](EXTENDED_THINKING.md) - Complex reasoning

## References

- [Claude Agent SDK](https://github.com/anthropics/anthropic-cookbook/tree/main/claude_agent_sdk)
- [Chief of Staff Agent](https://github.com/anthropics/anthropic-cookbook/tree/main/claude_agent_sdk/chief_of_staff_agent)

