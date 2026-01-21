# Getting Started with LLM-RULES

## Quick Start

This guide will help you get started with LLM-RULES Production Pack.

## Installation

1. Copy `.claude/` (and optionally `.cursor/`) into your project
2. Ensure CLAUDE.md is in your project root
3. Run validation: `pnpm validate`

See [CLAUDE_SETUP_GUIDE.md](./CLAUDE_SETUP_GUIDE.md) for detailed setup instructions.

## Running CUJs

The CUJ command wrapper provides an easy interface for working with Customer User Journeys:

### List Available CUJs

```bash
pnpm cuj:list
# or
node .claude/tools/run-cuj.mjs --list
```

### Run a CUJ Workflow

```bash
pnpm cuj CUJ-005
# or
node .claude/tools/run-cuj.mjs CUJ-005
```

### Simulate CUJ (Dry Run)

```bash
pnpm cuj:simulate CUJ-034
# or
node .claude/tools/run-cuj.mjs --simulate CUJ-034
```

### Validate CUJ Structure

```bash
pnpm cuj:validate CUJ-005
# or
node .claude/tools/run-cuj.mjs --validate CUJ-005
```

## Common CUJs

| CUJ ID  | Name                        | Purpose                                       |
| ------- | --------------------------- | --------------------------------------------- |
| CUJ-001 | First-Time Installation     | Install and configure LLM-RULES               |
| CUJ-002 | Rule Configuration          | Auto-detect tech stack and configure rules    |
| CUJ-005 | Greenfield Project Planning | Plan complete new project from scratch        |
| CUJ-009 | Component Scaffolding       | Generate rule-compliant component boilerplate |
| CUJ-013 | Code Review                 | Comprehensive code review with analysis       |
| CUJ-034 | Browser-Based UI Testing    | Test UI with Chrome DevTools                  |

See `.claude/docs/cujs/` for detailed documentation on each CUJ.

## Core Workflows

| Command       | Purpose                             |
| ------------- | ----------------------------------- |
| `/review`     | Comprehensive code review           |
| `/quick-ship` | Fast iteration for small changes    |
| `/audit`      | Validate code against loaded rules  |
| `/scaffold`   | Generate rule-compliant boilerplate |

See [WORKFLOW-GUIDE.md](../../workflows/WORKFLOW-GUIDE.md) for detailed workflow documentation.

## Skills and Tools

Skills provide 90%+ context savings vs MCP servers:

- **rule-selector**: Auto-detect tech stack and configure rules
- **scaffolder**: Generate rule-compliant boilerplate
- **rule-auditor**: Validate code against loaded rules
- **test-generator**: Generate comprehensive test suites
- **doc-generator**: Generate documentation

See `.claude/docs/AGENT_SKILL_MATRIX.md` for comprehensive agent-skill mapping.

## Next Steps

1. Run `pnpm cuj:list` to see all available CUJs
2. Try running `pnpm cuj CUJ-002` to configure rules for your project
3. Review [CLAUDE_SETUP_GUIDE.md](./CLAUDE_SETUP_GUIDE.md) for advanced setup
4. Explore [WORKFLOW-GUIDE.md](../../workflows/WORKFLOW-GUIDE.md) for workflow details

## Support

- **Setup Guide**: [CLAUDE_SETUP_GUIDE.md](./CLAUDE_SETUP_GUIDE.md)
- **Workflow Guide**: [WORKFLOW-GUIDE.md](../../workflows/WORKFLOW-GUIDE.md)
- **Agent-Skill Matrix**: [AGENT_SKILL_MATRIX.md](../AGENT_SKILL_MATRIX.md)
- **Security Triggers**: [SECURITY_TRIGGERS.md](../SECURITY_TRIGGERS.md)
