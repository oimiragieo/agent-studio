# Progressive Disclosure Skill Workflow

## Overview

This workflow demonstrates how to use the **progressive-disclosure** skill.

## Skill Location

`.claude/skills/progressive-disclosure/SKILL.md`

## Invocation Methods

### Method 1: Slash Command (User-Invocable)

```
/progressive-disclosure [arguments]
```

### Method 2: Via Agent Assignment

Agents with this skill in their `skills:` frontmatter can use it automatically.

### Method 3: Direct Script Execution

```bash
node .claude/skills/progressive-disclosure/scripts/main.cjs --help
```

## Example Usage

1. **Basic Invocation**

   ```
   /progressive-disclosure
   ```

2. **With Arguments**
   ```
   /progressive-disclosure --option value
   ```

## Assigning to Agents

To give an agent this skill, add to the agent's frontmatter:

```yaml
skills:
  - progressive-disclosure
```

Or use the CLI:

```bash
node .claude/skills/skill-creator/scripts/create.cjs --assign "progressive-disclosure" --agent "developer"
```

## Memory Integration

This skill follows the Memory Protocol:

- Reads: `.claude/context/memory/learnings.md`
- Writes to: `learnings.md`, `issues.md`, or `decisions.md`
