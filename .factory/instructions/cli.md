# Factory Droid CLI Guide

Factory's Droid CLI enables powerful AI-assisted development with specialized agents, context layering, and enterprise integrations.

## Core Principles

### Writing Effective Prompts

**Be explicit about what you want:**
```
❌ Bad: "can you improve the auth system?"
✅ Good: "add rate limiting to login attempts with exponential backoff following the pattern in middleware/rateLimit.ts"
```

**Provide context upfront:**
- Include error messages, file paths, screenshots
- Paste links to Jira tickets, design docs, or specifications
- Reference existing code patterns and conventions

**Choose your approach:**
- **Specification Mode**: For complex features requiring planning
- **Direct execution**: For routine tasks with clear requirements
- **Auto-Run**: When you trust droid to proceed with appropriate autonomy

**Define success criteria:**
- Specify tests to run
- Define verification steps
- Include acceptance criteria

## Common Workflows

### Understanding Code

```
Explain how user authentication flows through this system.
```

```
What are the main components in the frontend and how do they interact?
```

### Implementing Features

```
Add a PATCH /users/:id endpoint with email uniqueness validation. Update the OpenAPI spec and add integration tests.
```

### Code Review

```
Review my uncommitted changes with git diff and suggest improvements before I commit.
```

### Bug Fixes

```
The login form allows empty submissions. Add client-side validation and return proper error messages. Check that localhost:3000/login shows validation errors when fields are empty.
```

## Managing Context

### AGENTS.md Files

Use hierarchical `AGENTS.md` files to document:
- Build commands and testing procedures
- Coding standards and conventions
- Project structure and architecture
- Integration patterns and workflows

Droid reads these automatically, so you don't have to repeat project conventions.

### File References

- Use `@filename` to reference files directly
- Include file paths in prompts for focused attention
- Set boundaries: "Only modify files in the auth directory"

### External Resources

- Include URLs to tickets, docs, designs, or specs
- Droid can fetch and use information from integrated platforms
- Reference GitHub issues, Linear tasks, or Jira tickets

## Custom Droids (Subagents)

Access specialized agents via the Task tool:

```
Run the Task tool with subagent analyst to perform a competitive analysis.
```

Available agents match the BMAD-Spec system:
- **analyst**: Market research, requirements gathering, project briefing
- **pm**: Product requirements, epic definition, business validation
- **architect**: System design, technology selection, security planning
- **developer**: Implementation, code quality, testing execution
- **qa**: Test planning, quality validation, compliance verification
- **ux-expert**: User experience design, accessibility, interface specification

## Enterprise Integration

### Context Layering

Droid can layer multiple context sources:
- Repository code and documentation
- Product docs and specifications
- Runtime telemetry and logs
- External knowledge bases

Use the context router to combine sources intelligently.

### Hooks and Checkpoints

- **Pre-run hooks**: Validate code quality, run tests, attach context
- **Post-run hooks**: Generate reports, publish artifacts, notify teams

Configure hooks in `.factory/hooks/` to gate commits on quality checks.

### Cross-Platform Handoff

- Publish artifacts to Claude Projects for traceability
- Sync context with Cursor IDE sessions
- Bridge metadata across Claude, Cursor, and Droid

## Session Management

### Starting Sessions

```bash
droid
# Or specify a task directly
droid "Add authentication middleware"
```

### Mode Switching

Press `Shift+Tab` (or `Ctrl+T` on Windows) to cycle through:
- **Normal**: Manual confirmation for each action
- **Spec**: Specification Mode for complex features
- **Auto (Low)**: File edits and read-only commands
- **Auto (Medium)**: Reversible workspace changes
- **Auto (High)**: All commands except safety blocks

### Session Persistence

Sessions are saved and can be resumed:
- Web app sync: Enable `cloudSessionSync` in settings
- Local storage: Sessions stored in `~/.factory/sessions/`

## Security and Safety

### Droid Shield

Enabled by default (`enableDroidShield: true`):
- Secret scanning before commits
- Git guardrails (no force push to main, etc.)
- Dangerous command blocking

### Command Restrictions

- **Allowlist**: Commands that run without confirmation
- **Denylist**: Commands that always require confirmation
- Safety interlocks always trigger for dangerous patterns

## Best Practices

1. **Start with Specification Mode** for complex features
2. **Use AGENTS.md** to document conventions once
3. **Reference existing patterns** instead of describing from scratch
4. **Set clear boundaries** to contain change scope
5. **Verify with tests** - always include test requirements
6. **Review changes** before committing (even in Auto-Run)
7. **Use Custom Droids** for specialized tasks requiring domain expertise

## Troubleshooting

### Droid doesn't understand context

- Check that `AGENTS.md` files are present and up-to-date
- Explicitly reference files using `@filename` syntax
- Include relevant file paths in your prompt

### Changes are too broad

- Set explicit boundaries: "Only modify files in the auth directory"
- Use Specification Mode to review plan before execution
- Break large features into smaller, focused requests

### Custom Droids not available

- Verify Custom Droids are enabled: `/settings` → `enableCustomDroids: true`
- Restart droid after enabling
- Check that droid files are in `.factory/droids/` or `~/.factory/droids/`
