---
name: sequential-thinking
version: 1.0.0
description: Sequential thinking and structured problem solving. Break down complex problems into steps with revision and branching capabilities. Use for multi-step analysis, planning, and hypothesis verification.
context:fork: true
allowed-tools: read, write, bash
---

# Sequential Thinking Skill

## Overview

This skill provides structured problem-solving through a flexible thinking process that can adapt and evolve. Each thought can build on, question, or revise previous insights.

**Context Savings**: ~97% reduction
- **MCP Mode**: ~15,000 tokens always loaded
- **Skill Mode**: ~500 tokens metadata + on-demand loading

## When to Use

- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope isn't clear initially
- Multi-step solutions requiring maintained context
- Filtering irrelevant information
- Hypothesis generation and verification

## Quick Reference

```bash
# Use the sequential thinking tool
python executor.py --tool sequentialthinking --args '{
  "thought": "First, let me analyze the problem...",
  "thoughtNumber": 1,
  "totalThoughts": 5,
  "nextThoughtNeeded": true
}'
```

## Tool: sequentialthinking

A detailed tool for dynamic and reflective problem-solving through thoughts.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `thought` | string | Your current thinking step |
| `thoughtNumber` | integer | Current thought number (1, 2, 3...) |
| `totalThoughts` | integer | Estimated total thoughts needed |
| `nextThoughtNeeded` | boolean | Whether another thought step is needed |
| `isRevision` | boolean | If this thought revises previous thinking |
| `revisesThought` | integer | Which thought number is being reconsidered |
| `branchFromThought` | integer | Branching point thought number |
| `branchId` | string | Identifier for current branch |
| `needsMoreThoughts` | boolean | If more thoughts needed at the "end" |

### Key Features

- Adjust `totalThoughts` up or down as you progress
- Question or revise previous thoughts
- Add more thoughts even after reaching what seemed like the end
- Express uncertainty and explore alternatives
- Branch or backtrack (non-linear thinking)
- Generate and verify solution hypotheses

### Process

1. Start with initial estimate of needed thoughts
2. Feel free to question/revise previous thoughts
3. Add more thoughts if needed, even at the "end"
4. Mark thoughts that revise or branch
5. Generate solution hypothesis when appropriate
6. Verify hypothesis based on Chain of Thought
7. Repeat until satisfied
8. Set `nextThoughtNeeded: false` only when truly done

## Tool Execution

```bash
# List available tools
python executor.py --list

# Execute a thinking step
python executor.py --tool sequentialthinking --args '{"thought": "...", "thoughtNumber": 1, "totalThoughts": 5, "nextThoughtNeeded": true}'
```

## Configuration

MCP server configuration stored in `config.json`:
- **Command**: `npx -y @modelcontextprotocol/server-sequential-thinking`

## Related

- Original MCP server: `@modelcontextprotocol/server-sequential-thinking`
- MCP Converter Skill: `.claude/skills/mcp-converter/`
- Skill Manager: `.claude/skills/skill-manager/`
