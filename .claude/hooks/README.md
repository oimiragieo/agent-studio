# Claude Code Hooks

## Format Note

The YAML files in this directory (`pre_tool_use.yaml`, `post_tool_use.yaml`, `user_prompt_submit.yaml`) define **workflow actions** for the BMAD orchestrator system. These are **not** native Claude Code hooks.

### Native Claude Code Hooks vs. BMAD Workflow Hooks

**Native Claude Code Hooks:**
- Are shell commands executed at lifecycle events
- Configured via `/hooks` command in Claude Code or in `settings.json`
- Simple bash/jq scripts that run automatically
- Example: `jq -r '"\(.tool_input.command)"' >> ~/.claude/command-log.txt`

**BMAD Workflow Hooks (these files):**
- Are YAML definitions for workflow orchestration
- Interpreted by the BMAD orchestrator system
- Define multi-step actions with validation
- Used for complex workflows requiring coordination

## Current Hook Definitions

### pre_tool_use.yaml
Triggers before tool execution to:
- Create implementation plans
- Scan for TODOs/FIXMEs
- Perform risk validation

### post_tool_use.yaml
Triggers after tool execution to:
- Summarize changes
- Publish artifacts
- Run linting and tests

### user_prompt_submit.yaml
Triggers when user submits prompts to:
- Enrich prompts with context
- Tag activities for analytics

## Integration with Native Claude Code Hooks

To use native Claude Code hooks alongside these workflow hooks:

1. Run `/hooks` in Claude Code
2. Add shell command hooks for specific events
3. These will execute in addition to BMAD workflow hooks

Example native hook (for PreToolUse):
```bash
# Log all tool usage
jq -r '"\(.tool_input.command // .tool_input.name) - \(.timestamp)" >> ~/.claude/tool-log.txt
```

## Configuration

Hook execution is controlled by `settings.json`:
```json
"hooks": {
  "enabled": true,
  "hooks_dir": ".claude/hooks"
}
```

