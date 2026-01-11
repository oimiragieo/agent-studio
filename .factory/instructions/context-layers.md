# Context Layers Guide

Factory Droid uses context layering to intelligently combine multiple knowledge sources for better decision-making and code generation.

## What Are Context Layers?

Context layers mix different sources of information:

- **Repository code** and documentation
- **Product docs** and specifications
- **Runtime telemetry** and logs
- **External knowledge bases** (GitHub, Linear, Confluence)
- **Previous agent outputs** and artifacts

Droid uses these layers together to understand full context and make informed decisions.

## How Context Layering Works

### Automatic Context Discovery

Droid automatically discovers and uses:

1. **Repository context**: Code, tests, documentation, `AGENTS.md` files
2. **Integration context**: GitHub issues, Linear tasks, Jira tickets (if integrated)
3. **Artifact context**: Previous specifications, plans, and outputs
4. **Runtime context**: Logs, telemetry, error reports

### Intelligent Context Routing

The context router (`skills/context-router.md`) intelligently combines layers:

- Prioritizes most relevant sources for the task
- Filters out noise and irrelevant information
- Combines insights from multiple sources
- Preserves context across agent handoffs

## Using Context Layers

### Repository Context

Document conventions in `AGENTS.md` files:

- Root `AGENTS.md`: Universal project conventions
- Subdirectory `AGENTS.md`: Area-specific rules

Droid reads these automatically and applies them to all decisions.

### Integration Context

Reference external resources directly:

```
Implement feature described in https://github.com/org/repo/issues/123
```

Droid fetches and uses information from:

- GitHub issues and pull requests
- Linear tasks and projects
- Jira tickets and epics
- Confluence documentation

### Artifact Context

Attach previous work for continuity:

```
Continue from the specification in .factory/docs/user-auth-spec.md
```

Droid uses:

- Previous specifications and plans
- Architecture documents
- Test plans and quality reports
- Implementation artifacts

### Runtime Context

Include logs and telemetry:

```
Fix the error shown in logs/error.log line 42
```

Droid analyzes:

- Application logs
- Error reports and stack traces
- Performance metrics
- Telemetry data

## Best Practices

### Document Once, Use Everywhere

Use `AGENTS.md` files to document:

- Build commands and testing procedures
- Coding standards and conventions
- Architecture patterns and principles
- Integration workflows and tooling

Droid reads these automatically, so you don't repeat yourself.

### Reference External Resources

Include links to:

- GitHub issues or PRs describing requirements
- Linear tasks with acceptance criteria
- Design documents and mockups
- Product requirements and specifications

Droid fetches and uses this context automatically.

### Preserve Context Across Agents

When using Custom Droids:

- Analyst creates project brief → PM uses for PRD
- Architect creates system design → Developer uses for implementation
- QA uses all previous artifacts for test planning

Context is preserved through the `context-router` skill.

### Layer Runtime Information

Combine code context with runtime data:

- Error logs help diagnose issues
- Performance metrics guide optimization
- User telemetry informs feature design

## Context Router Skill

The `context-router` skill (`skills/context-router.md`) intelligently combines layers:

### Prioritization

Automatically prioritizes most relevant sources:

- Repository code for implementation tasks
- Product docs for feature work
- Logs for debugging
- Specifications for planning

### Filtering

Filters out noise:

- Unrelated files and directories
- Outdated documentation
- Irrelevant external resources

### Combination

Combines insights from multiple sources:

- Code patterns + product requirements
- Architecture docs + runtime metrics
- Test results + error logs

### Preservation

Preserves context across agent handoffs:

- Passes artifacts between agents
- Maintains decision history
- Tracks dependencies and relationships

## Troubleshooting

### Droid misses important context

- Explicitly reference files using `@filename` syntax
- Include links to external resources in prompts
- Ensure `AGENTS.md` files are up-to-date
- Check that integrations are configured correctly

### Context is too broad

- Set explicit boundaries in prompts
- Use subdirectory `AGENTS.md` files for focused context
- Reference specific files instead of directories
- Filter context by mentioning what's not needed

### Context not preserved across agents

- Verify `context-router` skill is enabled
- Check that artifacts are saved in `.factory/docs/`
- Ensure agents reference previous artifacts explicitly
- Use AGENTS.md files for shared conventions
