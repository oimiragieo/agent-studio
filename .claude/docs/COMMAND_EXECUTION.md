# Command Execution in Claude Code

This document explains how slash commands work in Claude Code and how they are discovered and executed.

## Overview

Claude Code supports slash commands (e.g., `/code-quality`, `/performance`) that trigger specific workflows or skills. These commands are defined in `.claude/commands/` and are automatically discovered by Claude Code.

## Command Discovery

### Automatic Discovery

Claude Code automatically discovers slash commands by:

1. **Scanning `.claude/commands/` directory**: Claude Code looks for command definition files in this directory
2. **Reading command metadata**: Each command file contains metadata about the command (name, description, workflow/skill to trigger)
3. **Registering commands**: Commands are registered and made available in the Claude Code interface

### Command File Structure

Command files are typically markdown files (`.md`) or YAML files (`.yaml`) that define:

- **Command name**: The slash command identifier (e.g., `code-quality`)
- **Description**: What the command does
- **Workflow/Skill**: Which workflow or skill to execute
- **Parameters**: Optional parameters the command accepts

**Example Command File** (`.claude/commands/code-quality.md`):
```markdown
# Code Quality Workflow

**Command**: `/code-quality`

**Description**: Runs the code quality improvement workflow

**Workflow**: `code-quality-flow.yaml`

**Agents**: planner → code-reviewer → refactoring-specialist → compliance-auditor → qa

**Outputs**: Code review report, refactoring plan, compliance audit
```

## Command Execution Flow

### 1. User Invokes Command

User types a slash command in Claude Code:
```
/code-quality
```

### 2. Command Resolution

Claude Code:
1. Looks up the command in `.claude/commands/`
2. Reads the command definition
3. Identifies the associated workflow or skill

### 3. Workflow/Skill Execution

For workflows:
1. Loads the workflow YAML file from `.claude/workflows/`
2. Executes the workflow using the workflow execution system
3. Runs steps sequentially with validation gates

For skills:
1. Loads the skill definition from `.claude/skills/`
2. Executes the skill's functionality
3. Returns results to the user

### 4. Result Handling

- Workflow results are saved as artifacts in `.claude/context/artifacts/`
- Skill results are returned directly to the user
- Validation gates create gate files in `.claude/context/history/gates/`

## Available Commands

### Workflow Commands

| Command | Workflow | Purpose |
|---------|----------|---------|
| `/code-quality` | `code-quality-flow.yaml` | Code quality improvement |
| `/performance` | `performance-flow.yaml` | Performance optimization |
| `/ai-system` | `ai-system-flow.yaml` | AI/LLM system development |
| `/mobile` | `mobile-flow.yaml` | Mobile application workflow |
| `/incident` | `incident-flow.yaml` | Incident response |

### Skill Commands

| Command | Skill | Purpose |
|---------|-------|---------|
| `/select-rules` | `rule-selector` | Auto-detect tech stack and configure rules |
| `/audit` | `rule-auditor` | Validate code against loaded rules |
| `/scaffold` | `scaffolder` | Generate rule-compliant boilerplate |

## Creating Custom Commands

### Step 1: Create Command File

Create a new file in `.claude/commands/`:

```markdown
# My Custom Command

**Command**: `/my-command`

**Description**: Does something useful

**Workflow**: `my-workflow.yaml`
```

### Step 2: Define Workflow or Skill

If using a workflow:
- Create workflow YAML in `.claude/workflows/my-workflow.yaml`
- Define steps, agents, inputs, outputs, validation

If using a skill:
- Create skill definition in `.claude/skills/my-skill/`
- Implement skill functionality

### Step 3: Test Command

1. Restart Claude Code to reload commands
2. Type `/my-command` in Claude Code
3. Verify execution flow

## Command Parameters

Some commands accept parameters:

```
/code-quality --verbose
/audit --strict
```

Parameters are passed to the underlying workflow or skill execution system.

## Integration with Workflow System

Commands that trigger workflows integrate with the workflow execution system:

1. **Workflow Selection**: Command maps to a specific workflow YAML file
2. **Step Execution**: Workflow steps execute sequentially
3. **Validation**: Each step is validated using `workflow_runner.js`
4. **Artifact Management**: Outputs are saved and passed between steps

See `.claude/workflows/WORKFLOW-GUIDE.md` for detailed workflow execution information.

## Troubleshooting

### Command Not Found

**Problem**: Slash command doesn't appear in Claude Code

**Solutions**:
1. Check that command file exists in `.claude/commands/`
2. Verify command file format is correct
3. Restart Claude Code to reload commands
4. Check Claude Code logs for errors

### Command Execution Fails

**Problem**: Command executes but workflow/skill fails

**Solutions**:
1. Check workflow YAML syntax is valid
2. Verify all referenced agents exist (`.claude/agents/<agent>.md`)
3. Check that required inputs are available
4. Review validation gate files for errors
5. Run `pnpm validate:workflow` to check workflow configuration

### Command Not Executing Workflow

**Problem**: Command runs but workflow doesn't start

**Solutions**:
1. Verify workflow file path in command definition is correct
2. Check workflow YAML file exists and is valid
3. Ensure workflow has at least one step defined
4. Check Claude Code has permissions to read workflow files

## Best Practices

1. **Clear Naming**: Use descriptive command names that indicate their purpose
2. **Documentation**: Include clear descriptions in command files
3. **Error Handling**: Ensure workflows handle errors gracefully
4. **Validation**: Always validate workflow YAML before deploying commands
5. **Testing**: Test commands thoroughly before making them available

## Related Documentation

- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Agent System**: `.claude/agents/` (agent definitions)
- **Skills**: `.claude/skills/` (skill definitions)
- **Workflow Validation**: `scripts/validate-workflow.mjs`

