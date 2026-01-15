---
name: memory-manager
description: Manages memory tool integration with CLAUDE.md files for dual persistence and redundancy. Handles cross-conversation learning, memory sync, and context persistence.
allowed-tools: read, write, memory, grep, glob
version: 1.0
best_practices:
  - Use memory tool for learned patterns and insights
  - Keep CLAUDE.md for static rules and standards
  - Sync important patterns from memory to CLAUDE.md
  - Validate memory file paths for security
error_handling: graceful
streaming: supported
---

# Memory Manager Skill

## Identity

Memory Manager - Provides dual persistence (CLAUDE.md + Memory Tool) for redundancy and cross-conversation learning.

## Capabilities

- **Memory Tool Integration**: Store and retrieve learned patterns via memory tool
- **CLAUDE.md Sync**: Sync important patterns from memory to CLAUDE.md
- **Cross-Conversation Learning**: Enable agents to learn from previous sessions
- **Dual Persistence**: Maintain knowledge in both memory tool and CLAUDE.md
- **Security Validation**: Validate memory file paths to prevent memory poisoning

## Dual Persistence Strategy

### CLAUDE.md Files (Primary - Version-Controlled)

- Hierarchical context loading (root → subdirectories)
- Version-controlled in git
- Project-specific, structured knowledge
- Loaded automatically by Claude Code
- Best for: Static rules, project structure, coding standards

### Memory Tool (Secondary - Dynamic Learning)

- Cross-conversation pattern persistence
- Dynamic knowledge accumulation
- Session-specific learnings
- File-based storage under `/memories/` directory
- Best for: Learned patterns, user preferences, task-specific insights

### How They Work Together

1. **CLAUDE.md**: Provides foundational context (rules, structure, standards)
2. **Memory Tool**: Captures learned patterns and insights from interactions
3. **Redundancy**: If one fails, the other provides backup context
4. **Synergy**: Memory tool can reference CLAUDE.md patterns, CLAUDE.md can reference memory insights

## Usage Patterns

### Storing Learned Patterns

**When to Store in Memory**:

- User preferences discovered during interaction
- Task-specific insights and solutions
- Patterns learned from codebase analysis
- Workflow optimizations discovered
- Common mistakes to avoid

**How to Store**:

```
Use memory tool to store: "User prefers TypeScript over JavaScript for new features"
```

### Reading from Memory

**When to Read from Memory**:

- Starting a new task (check for relevant patterns)
- Encountering similar problems (look for previous solutions)
- User preferences (check for known preferences)
- Workflow patterns (check for optimized approaches)

**How to Read**:

```
Use memory tool to read: "What patterns do we have for authentication implementation?"
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

## Memory File Organization

### Directory Structure

Memory files are stored in the run directory structure:

```
.claude/context/runtime/runs/{run-id}/
├── memory/
│   ├── patterns/
│   │   ├── authentication-patterns.md
│   │   ├── api-design-patterns.md
│   │   └── testing-patterns.md
│   ├── preferences/
│   │   ├── user-preferences.md
│   │   └── coding-style.md
│   └── insights/
│       ├── performance-insights.md
│       └── security-insights.md
```

**Note**: Use `path-resolver.mjs` to resolve memory paths within a run directory.

### Naming Conventions

- **Patterns**: `{category}-patterns.md` (e.g., `authentication-patterns.md`)
- **Preferences**: `{type}-preferences.md` (e.g., `user-preferences.md`)
- **Insights**: `{domain}-insights.md` (e.g., `performance-insights.md`)

## Security Best Practices

### Path Validation (Production-Ready)

Based on Claude Cookbooks patterns, always validate memory file paths:

**Required Validation:**

- Path must start with `/memories` prefix
- Reject paths with `..` (directory traversal attacks)
- Verify resolved path is within memory_root directory
- Validate file extensions (`.txt`, `.md`, `.json`, `.py`, `.yaml`, `.yml`)

**Implementation:**
See `.claude/skills/memory-manager/memory_tool_handler.py` for production-ready handler with:

- Path validation and sanitization
- Directory traversal protection
- Comprehensive error handling
- Security checks for all operations
- File operation security (view, create, str_replace, insert, delete, rename)

**Example Validation:**

```python
def _validate_path(self, path: str) -> Path:
    """Validate and resolve memory paths to prevent directory traversal attacks."""
    if not path.startswith("/memories"):
        raise ValueError("Path must start with /memories")

    # Remove /memories prefix and resolve
    relative_path = path[len("/memories"):].lstrip("/")
    full_path = (self.memory_root / relative_path).resolve()

    # Verify path is still within memory_root
    try:
        full_path.relative_to(self.memory_root.resolve())
    except ValueError:
        raise ValueError("Path would escape /memories directory")

    return full_path
```

**Using the Handler:**

```python
from .claude.skills.memory_manager.memory_tool_handler import MemoryToolHandler

handler = MemoryToolHandler(base_path="./memory_storage")
result = handler.execute(command="view", path="/memories/patterns/auth.md")
```

### Memory Poisoning Prevention

**Prevent malicious memory content**:

- Validate memory content before storing
- Sanitize user input in memory files
- Review memory files periodically
- Use structured formats (JSON, YAML) when possible
- Restrict file types to text-based formats only
- Validate string uniqueness for replacements (prevent ambiguous edits)

### Security Features

**Production-Ready Handler Includes:**

- ✅ Path validation with directory traversal protection
- ✅ File extension validation
- ✅ Root directory protection (cannot delete `/memories`)
- ✅ String uniqueness validation for replacements
- ✅ Comprehensive error handling
- ✅ UTF-8 encoding validation

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

The memory sync utility (`memory-sync.mjs`) can:

- Sync important patterns from memory to CLAUDE.md
- Merge memory insights into project documentation
- Archive old memory files
- Validate memory file integrity

### Manual Sync

Agents can manually sync:

1. Identify pattern in memory that should be in CLAUDE.md
2. Read pattern from memory tool
3. Add to appropriate CLAUDE.md file
4. Keep in memory for redundancy

## Examples

### Example 1: Storing User Preference

```
User: "I prefer using async/await over promises"

Agent stores in memory:
- File: `.claude/context/runtime/runs/{run-id}/memory/preferences/coding-style.md`
- Content: "User prefers async/await syntax over Promise chains for asynchronous code"
```

### Example 2: Storing Learned Pattern

```
Agent discovers: "Using Zod for validation reduces bugs by 40%"

Agent stores in memory:
- File: `.claude/context/runtime/runs/{run-id}/memory/patterns/validation-patterns.md`
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
