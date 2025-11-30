# Agent Generation Process

## Overview

This document explains how agents are structured across the three platforms (Claude Code, Cursor IDE, Factory Droid) and how to generate platform-specific variants from the canonical source.

## Canonical Source

**`.claude/agents/`** is the **canonical source** for all agent definitions. All agents should be created or updated here first, then adapted for other platforms.

### Current Agent Inventory

**Total**: 22 agents in `.claude/agents/`

**Core Development Agents** (9):
- `analyst.md` - Market research and business analysis
- `pm.md` - Product requirements and roadmaps
- `ux-expert.md` - Interface design and user experience
- `architect.md` - System architecture and technical design
- `database-architect.md` - Database design and optimization
- `developer.md` - Code implementation and testing
- `qa.md` - Quality assurance and validation
- `orchestrator.md` - Task routing and multi-agent coordination
- `model-orchestrator.md` - Multi-model routing (Gemini, Cursor, etc.)

**Enterprise Agents** (3):
- `security-architect.md` - Security design and threat modeling
- `devops.md` - Infrastructure, CI/CD, and deployments
- `technical-writer.md` - Documentation and knowledge management

**Code Quality Agents** (3):
- `code-reviewer.md` - Systematic code review and PR analysis
- `refactoring-specialist.md` - Code transformation and debt reduction
- `performance-engineer.md` - Performance optimization and profiling

**Specialized Agents** (7):
- `llm-architect.md` - AI/LLM system design, RAG, prompt engineering
- `api-designer.md` - REST/GraphQL/gRPC API design
- `legacy-modernizer.md` - Legacy system modernization
- `mobile-developer.md` - iOS/Android/React Native/Flutter
- `accessibility-expert.md` - WCAG compliance and a11y testing
- `compliance-auditor.md` - GDPR/HIPAA/SOC2/PCI-DSS
- `incident-responder.md` - Crisis management and post-mortems

## Platform-Specific Formats

### Claude Code (`.claude/agents/*.md`)

**Format**: Flat markdown files with YAML frontmatter

**Frontmatter Structure**:
```yaml
---
name: agent-name
description: Brief description of agent's role
tools: Tool1, Tool2, Tool3
model: claude-sonnet-4 | claude-opus-4
temperature: 0.5
extended_thinking: true | false
priority: highest | high | medium | low
---
```

**Content Structure**:
- Identity section
- Core Persona
- Core Capabilities
- Execution Process
- MCP Integration patterns
- Output Requirements

**Example**: `.claude/agents/architect.md`

### Cursor IDE (`.cursor/subagents/*.mdc`)

**Format**: Markdown files with Cursor-specific YAML frontmatter

**Frontmatter Structure**:
```yaml
---
name: Agent Name
model: claude-opus-4
description: Brief description
type: Architecture | Development | Design | etc.
icon: '🏗️'
actions:
  auto_apply_edits: false
  auto_run: false
  auto_fix_errors: false
tools:
  - read
  - search
  - codebase
integrations: {}
---
```

**Content Structure**:
- Uses XML-style tags: `<task>`, `<persona>`, `<core_capabilities>`, `<execution_process>`
- Adapts Claude content to Cursor's format
- Maintains same core persona and capabilities

**Example**: `.cursor/subagents/architect.mdc`

**Note**: Cursor has 22 agents (mirrors Claude agent structure)

### Factory Droid (`.factory/droids/*.md`)

**Format**: Minimal markdown files with simple YAML frontmatter

**Frontmatter Structure**:
```yaml
---
name: agent-name
description: Brief description
model: claude-opus-4
---
```

**Content Structure**:
- Uses XML-style tags: `<task>`, `<persona>`, `<core_capabilities>`, `<execution_process>`
- Minimal frontmatter (name, description, model only)
- Same core content as Claude version

**Example**: `.factory/droids/architect.md`

**Note**: Factory has 22 agents (mirrors Claude agent structure)

## Generation Process

### Manual Process

1. **Create/Update Claude Agent**:
   - Create or edit `.claude/agents/[agent-name].md`
   - Follow Claude format with YAML frontmatter
   - Include all sections: Identity, Persona, Capabilities, Execution Process, Output Requirements

2. **Generate Cursor Version**:
   - Copy content from Claude agent
   - Adapt YAML frontmatter to Cursor format:
     - Add `type`, `icon`, `actions`, `tools`, `integrations`
     - Adjust `name` to proper case (e.g., "Architect" not "architect")
   - Convert content sections to XML-style tags (`<task>`, `<persona>`, etc.)
   - Save as `.cursor/subagents/[agent-name].mdc`

3. **Generate Factory Version**:
   - Copy content from Claude agent
   - Adapt YAML frontmatter to Factory format:
     - Keep only `name`, `description`, `model`
   - Convert content sections to XML-style tags
   - Save as `.factory/droids/[agent-name].md`

### Automated Process (Future)

A script could automate this process:

```bash
# Generate Cursor and Factory versions from Claude agent
node scripts/generate-agent-variants.mjs .claude/agents/architect.md
```

**Planned Features**:
- Parse Claude agent frontmatter
- Generate Cursor frontmatter with defaults
- Generate Factory frontmatter (minimal)
- Convert markdown sections to XML tags
- Validate output files

## Content Consistency Rules

### Must Match Across Platforms

1. **Core Persona**: Identity, style, approach, values
2. **Core Capabilities**: List of capabilities should be identical
3. **Execution Process**: Step-by-step workflow should match
4. **Output Requirements**: Expected deliverables should match

### Platform-Specific Adaptations

1. **Tool References**: 
   - Claude: Uses tool names from config (Task, Read, Search, etc.)
   - Cursor: Uses Cursor tool names (read, search, codebase)
   - Factory: Uses Factory tool names (Task tool with subagent specification)

2. **Context Paths**:
   - Claude: `.claude/context/artifacts/`
   - Cursor: `.cursor/plans/`
   - Factory: `.factory/docs/`

3. **Invocation Methods**:
   - Claude: Auto-routing via trigger words in config.yaml
   - Cursor: Manual selection or auto-trigger via Plan Mode
   - Factory: Task tool with subagent specification

## Verification Checklist

After generating platform variants, verify:

- [ ] All 18 Claude agents exist in `.claude/agents/`
- [ ] All 18 Cursor agents exist in `.cursor/subagents/` (or 17 if orchestrator excluded)
- [ ] All 18 Factory agents exist in `.factory/droids/` (or 17 if orchestrator excluded)
- [ ] Agent names match across platforms (kebab-case for files)
- [ ] Core persona and capabilities match across platforms
- [ ] Platform-specific adaptations are correct (tools, paths, invocation)
- [ ] YAML frontmatter is valid for each platform
- [ ] Content sections are properly formatted (XML tags for Cursor/Factory)

## Special Cases

### Orchestrator Agent

The `orchestrator` agent is Claude-specific but has been adapted for Cursor and Factory:

- **Claude**: Primary coordination agent, auto-invoked for complex tasks
- **Cursor**: Available for manual selection, coordinates Plan Mode workflows
- **Factory**: Available via Task tool, coordinates multi-agent workflows

## Maintenance

### When to Regenerate

Regenerate platform variants when:
- Core agent content changes (persona, capabilities, execution process)
- New agents are added to Claude
- Agent structure is refactored

### When NOT to Regenerate

Don't regenerate if only:
- Platform-specific paths change (these are intentional differences)
- Tool names change (platform-specific)
- Minor formatting adjustments

## Related Documentation

- **Agent Overview**: `AGENTS.md` - Cross-platform agent overview
- **Claude Setup**: `.claude/docs/setup-guides/CLAUDE_SETUP_GUIDE.md`
- **Cursor Setup**: `.cursor/README.md`
- **Factory Setup**: `.factory/AGENTS.md`

