# Memory Patterns Guide - Dual Persistence (CLAUDE.md + Memory Tool)

## Overview

This guide explains how to use both CLAUDE.md files and the memory tool for redundancy and cross-conversation learning. All agents use **BOTH** systems to ensure knowledge persistence and fault tolerance.

## Dual Persistence Strategy

### CLAUDE.md Files (Primary - Version-Controlled)

**Purpose**: Static, version-controlled context

**Characteristics**:
- Hierarchical context loading (root → subdirectories)
- Version-controlled in git
- Project-specific, structured knowledge
- Loaded automatically by Claude Code
- Best for: Static rules, project structure, coding standards

**Location**:
- Root: `.claude/CLAUDE.md`
- Project: `.claude/projects/{project}/CLAUDE.md`
- Phase: `.claude/projects/{project}/phase-*/claude.md`
- Module: `{module}/claude.md`

### Memory Tool (Secondary - Dynamic Learning)

**Purpose**: Dynamic, learned patterns

**Characteristics**:
- Cross-conversation pattern persistence
- Dynamic knowledge accumulation
- Session-specific learnings
- File-based storage under `/memories/` directory
- Best for: Learned patterns, user preferences, task-specific insights

**Location**:
- `.claude/orchestrators/{session-id}/memory/`

**Tool ID**: `memory_20250818`

## How They Work Together

### 1. Initial Context Loading

- **CLAUDE.md files**: Load automatically (hierarchical: root → subdirectories)
- **Memory tool**: Available but not loaded until needed

### 2. During Task Execution

- **Agent references CLAUDE.md**: For rules and standards
- **Agent uses memory tool**: To store learned patterns
- **Agent can read from memory tool**: For previous insights

### 3. Pattern Learning

- **When agent discovers useful pattern**: Writes to memory tool
- **If pattern is project-wide**: Also documented in CLAUDE.md
- **Both systems maintain knowledge**: Redundancy ensures persistence

### 4. Context Retrieval

- **CLAUDE.md**: Provides immediate, structured context
- **Memory tool**: Provides learned, dynamic context
- **Agent combines both**: For comprehensive understanding

## Redundancy Benefits

### 1. Fault Tolerance

If memory tool fails, CLAUDE.md provides context:
- Memory tool unavailable → Use CLAUDE.md
- CLAUDE.md missing → Use memory tool
- Both available → Use both for comprehensive context

### 2. Version Control

CLAUDE.md changes are tracked in git:
- All rule changes versioned
- Project standards documented
- Team collaboration enabled

### 3. Dynamic Learning

Memory tool captures insights not in CLAUDE.md:
- User preferences discovered during interaction
- Task-specific solutions
- Workflow optimizations
- Common mistakes to avoid

### 4. Cross-Project Sharing

Memory tool can share patterns across projects:
- Patterns learned in one project
- Can be referenced in other projects
- Enables knowledge transfer

### 5. Performance

CLAUDE.md loads faster, memory tool provides depth:
- CLAUDE.md: Fast, structured, always available
- Memory tool: Deep, learned, on-demand

## Usage Patterns

### Storing Learned Patterns

**When to Store in Memory**:
- User preferences discovered during interaction
- Task-specific insights and solutions
- Patterns learned from codebase analysis
- Workflow optimizations discovered
- Common mistakes to avoid

**Example**:
```
User: "I prefer using async/await over promises"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/preferences/coding-style.md
- Content: "User prefers async/await syntax over Promise chains"
```

### Reading from Memory

**When to Read from Memory**:
- Starting a new task (check for relevant patterns)
- Encountering similar problems (look for previous solutions)
- User preferences (check for known preferences)
- Workflow patterns (check for optimized approaches)

**Example**:
```
Agent needs to implement authentication

Agent reads from memory:
- Query: "authentication implementation patterns"
- Returns: Relevant patterns from memory files
- Uses patterns to guide implementation
```

### Syncing to CLAUDE.md

**When to Sync**:
- Pattern is project-wide and should be version-controlled
- Rule discovered that applies to all future work
- Standard that should be part of project documentation
- Important decision that affects project structure

**How to Sync**:
1. Read pattern from memory tool
2. Determine if it should be in CLAUDE.md
3. Add to appropriate CLAUDE.md file (root or phase-specific)
4. Keep in memory tool for redundancy

**Example**:
```
Agent discovers: "Always use TypeScript strict mode"

Agent syncs:
1. Reads from memory: "typescript-strict-mode-pattern.md"
2. Adds to .claude/CLAUDE.md: "TypeScript Configuration: Always use strict mode"
3. Keeps in memory for redundancy
```

## Memory File Organization

### Directory Structure

```
.claude/orchestrators/{session-id}/memory/
├── patterns/
│   ├── authentication-patterns.md
│   ├── api-design-patterns.md
│   └── testing-patterns.md
├── preferences/
│   ├── user-preferences.md
│   └── coding-style.md
└── insights/
    ├── performance-insights.md
    └── security-insights.md
```

### Naming Conventions

- **Patterns**: `{category}-patterns.md` (e.g., `authentication-patterns.md`)
- **Preferences**: `{type}-preferences.md` (e.g., `user-preferences.md`)
- **Insights**: `{domain}-insights.md` (e.g., `performance-insights.md`)

## Security Best Practices

### Path Validation

**Always validate memory file paths**:
- Only allow paths under `.claude/orchestrators/{session-id}/memory/`
- Reject paths with `..` (directory traversal)
- Reject absolute paths outside project
- Validate file extensions (only `.md`, `.json`, `.yaml` files)

### Memory Poisoning Prevention

**Prevent malicious memory content**:
- Validate memory content before storing
- Sanitize user input in memory files
- Review memory files periodically
- Use structured formats (JSON, YAML) when possible

## Integration with Agents

### All Agents Use Both

Every agent should:
1. **Load CLAUDE.md files** automatically (via Claude Code)
2. **Use memory tool** for learned patterns
3. **Store insights** in memory tool
4. **Sync important patterns** to CLAUDE.md when appropriate

### Agent-Specific Memory

- **Orchestrator**: Workflow patterns, routing decisions, coordination strategies
- **Developer**: Implementation patterns, code solutions, debugging insights
- **Architect**: Design patterns, technology choices, architecture decisions
- **QA**: Testing patterns, quality insights, bug patterns

## Memory Sync Utility

### Automatic Sync

The memory sync utility (`.claude/tools/memory-sync.mjs`) can:
- Sync important patterns from memory to CLAUDE.md
- Merge memory insights into project documentation
- Archive old memory files
- Validate memory file integrity

### Usage

```bash
# Sync patterns to CLAUDE.md
node .claude/tools/memory-sync.mjs --session-id <id> --sync-to-claude --project <name>

# Validate memory files
node .claude/tools/memory-sync.mjs --session-id <id> --validate
```

## Configuration

Memory tool is configured in `.claude/config.yaml`:

```yaml
memory_tool:
  enabled: true
  tool_id: "memory_20250818"
  storage_path: ".claude/orchestrators/{session-id}/memory"
  sync_with_claude_md: true
  agents_with_memory:
    - planner
    - orchestrator
    - developer
    # ... all agents
```

## Best Practices

1. **Store Frequently**: Store patterns as you discover them
2. **Read Before Starting**: Check memory for relevant patterns before new tasks
3. **Sync Important Patterns**: Move project-wide patterns to CLAUDE.md
4. **Organize by Category**: Use directory structure for organization
5. **Validate Paths**: Always validate memory file paths
6. **Review Periodically**: Clean up old or outdated memory files
7. **Maintain Redundancy**: Keep important patterns in both systems

## Troubleshooting

### Memory Tool Not Available

- Check that memory tool is enabled in `.claude/config.yaml`
- Verify memory tool is available in agent's tool list
- Ensure memory directory exists and is writable

### Memory Files Not Persisting

- Check file permissions on memory directory
- Verify memory tool is writing to correct location
- Check for errors in memory tool execution

### CLAUDE.md Sync Fails

- Verify CLAUDE.md file is writable
- Check that pattern is appropriate for CLAUDE.md
- Ensure proper formatting when adding to CLAUDE.md

## Examples

### Example 1: Storing User Preference

```
User: "I prefer using async/await over promises"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/preferences/coding-style.md
- Content: "User prefers async/await syntax over Promise chains for asynchronous code"
```

### Example 2: Storing Learned Pattern

```
Agent discovers: "Using Zod for validation reduces bugs by 40%"

Agent stores in memory:
- File: .claude/orchestrators/{session-id}/memory/patterns/validation-patterns.md
- Content: "Zod validation pattern: Use Zod schemas for all API input validation. Reduces bugs by 40%."
```

### Example 3: Reading from Memory

```
Agent needs to implement authentication

Agent reads from memory:
- Query: "authentication implementation patterns"
- Returns: Relevant patterns from memory files
- Uses patterns to guide implementation
```

### Example 4: Syncing to CLAUDE.md

```
Agent discovers important pattern: "Always use TypeScript strict mode"

Agent syncs:
1. Reads from memory: "typescript-strict-mode-pattern.md"
2. Adds to .claude/CLAUDE.md: "TypeScript Configuration: Always use strict mode"
3. Keeps in memory for redundancy
```

## Related Documentation

- [Everlasting Agent System](EVERLASTING_AGENTS.md) - Context window management
- [Phase-Based Projects](PHASE_BASED_PROJECTS.md) - Project structure
- [Context Optimization](CONTEXT_OPTIMIZATION.md) - Context management best practices

