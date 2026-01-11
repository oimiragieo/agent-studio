# CLAUDE.md - [Your Agent Name] Context

## Agent Overview

- **Name**: [Your Agent Name]
- **Purpose**: [Brief description of agent's purpose]
- **Domain**: [Domain/industry]
- **Context**: [Additional context about the agent's role]

## Key Information

### [Section 1: Core Context]

[Add your agent's core context here. Examples:]

- Company/Organization details
- Project information
- Domain-specific knowledge
- Current state/situation

### [Section 2: Available Resources]

[Document what resources the agent has access to:]

#### Data Files

- `data/file1.csv`: [Description]
- `data/file2.json`: [Description]

#### Scripts

- `scripts/script1.py`: [Description and usage]
- `scripts/script2.py`: [Description and usage]

**Usage Example:**

```bash
python scripts/script1.py <arg1> <arg2>
```

**Output:** [Description of output format]

### [Section 3: Subagents]

[If using subagents, document them here:]

- **subagent-name**: [Description of subagent's role]
  - Use when: [When to delegate to this subagent]
  - Capabilities: [What this subagent can do]

### [Section 4: Current Priorities]

[Document current priorities or tasks:]

1. **Priority 1**: [Description]
2. **Priority 2**: [Description]
3. **Priority 3**: [Description]

### [Section 5: Constraints/Rules]

[Document any constraints or rules:]

- [Rule 1]
- [Rule 2]
- [Rule 3]

## Instructions

### How to Use This Agent

1. **Basic Queries**: [How to use for basic tasks]
2. **Complex Tasks**: [How to use for complex tasks]
3. **Slash Commands**: [List available slash commands]
   - `/command1`: [Description]
   - `/command2`: [Description]

### Output Styles

Available output styles (use with `output_style` parameter):

- **executive**: [Description]
- **technical**: [Description]
- **detailed**: [Description]

### Plan Mode

For complex tasks, use plan mode to get a plan before execution:

```python
result, messages = await send_query(
    "Complex task description",
    permission_mode="plan"
)
```

## Examples

### Example 1: [Task Name]

**Query**: "[Example query]"
**Expected Behavior**: [What the agent should do]

### Example 2: [Task Name]

**Query**: "[Example query]"
**Expected Behavior**: [What the agent should do]

## Notes

[Any additional notes or context]

---

**Remember**: This agent has access to:

- Financial data in the `data/` directory
- Python scripts in the `scripts/` directory
- Subagents for specialized analysis
- Custom slash commands for common operations
