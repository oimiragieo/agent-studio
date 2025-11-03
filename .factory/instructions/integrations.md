# Integrations Guide

Factory Droid integrates with Claude, Cursor, GitHub, Linear, Confluence, and other tools to create a unified development workflow.

## Cross-Platform Integration

### Claude Code Integration

**Artifact Publishing:**
- Droid publishes specifications and artifacts to Claude Projects
- Claude Code can reference Droid outputs for context
- Shared artifact history for traceability

**Context Bridging:**
- Sync artifacts from `.factory/docs/` to `.claude/context/artifacts/`
- Reference Claude Artifacts in Droid sessions
- Preserve decision history across platforms

**Workflow:**
1. Droid generates specification in `.factory/docs/`
2. Artifact published to Claude Project
3. Claude Code uses specification for implementation
4. Context synced back for QA and review

### Cursor IDE Integration

**Plan Integration:**
- Droid specifications can reference Cursor plans
- Cursor Plan Mode outputs usable in Droid sessions
- Shared planning context for consistency

**Context Sync:**
- Sync artifacts from `.factory/docs/` to `.cursor/context/`
- Reference Cursor plans in Droid specifications
- Cross-platform context preservation

**Workflow:**
1. Cursor generates plan in `.cursor/plans/`
2. Droid uses plan context for specification
3. Implementation artifacts synced to both platforms
4. Shared quality gates and validation

## Source Control Integration

### GitHub

**Issue References:**
```
Implement feature described in https://github.com/org/repo/issues/123
```

Droid automatically:
- Fetches issue description and comments
- Reads linked PRs and discussions
- Uses labels and milestones for context
- References commit history and code changes

**Pull Request Integration:**
- Droid can review PRs and suggest improvements
- Generate code changes based on PR feedback
- Sync implementation back to PR branches

**Repository Context:**
- Reads repository structure and conventions
- Analyzes existing code patterns
- Uses `.github/` workflows and templates

### Git Workflow

**Branch Management:**
- Create feature branches from specifications
- Commit with descriptive messages
- Push changes with co-author trailer (if enabled)

**Change Tracking:**
- Review uncommitted changes with `git diff`
- Validate before committing
- Generate commit messages from changes

## Project Management Integration

### Linear

**Task References:**
```
Complete Linear task PROJ-123 with acceptance criteria from Linear
```

Droid automatically:
- Fetches task description and acceptance criteria
- Reads linked issues and dependencies
- Uses project context and labels
- References team conventions and standards

**Status Updates:**
- Update task status after completion
- Add implementation notes and artifacts
- Link to specifications and code changes

### Jira

**Ticket Integration:**
- Reference Jira tickets in prompts
- Fetch requirements and acceptance criteria
- Use ticket context for implementation
- Update tickets with completion status

## Documentation Integration

### Confluence

**Document References:**
```
Follow the architecture documented in [Confluence page URL]
```

Droid automatically:
- Fetches Confluence page content
- Uses diagrams and specifications
- References related documentation
- Maintains links to source docs

## Communication Integration

### Slack

**Notifications:**
- Post-run hooks can notify Slack channels
- Share execution summaries and results
- Alert teams to completed work

**Workflow:**
Configure in `hooks/post-run.yaml`:
```yaml
- notify:
    channel: slack
    template: 'Droid run {{run_id}} completed. Coverage: {{coverage}}%.'
```

## MCP Integration

### Model Context Protocol

Factory supports MCP servers for extended capabilities:

**Repository MCP:**
- Enhanced code search and analysis
- Knowledge graph integration
- Cross-repository context

**Artifact Publisher MCP:**
- Automated artifact publishing
- Claude Project integration
- Context synchronization

**GitHub MCP:**
- Issue and PR integration
- Repository analysis
- Code review capabilities

**Linear MCP:**
- Task and project integration
- Project context analysis
- Status updates and tracking

## Best Practices

### Unified Workflow

1. **Planning**: Use Droid Specification Mode or Cursor Plan Mode
2. **Implementation**: Use appropriate platform for task type
3. **Review**: Cross-reference artifacts across platforms
4. **Deployment**: Use unified quality gates

### Context Preservation

- Save artifacts in platform-agnostic locations
- Use common formats (Markdown, JSON) for artifacts
- Reference artifacts by path, not platform-specific locations
- Sync context directories regularly

### Integration Configuration

- Configure integrations in Factory dashboard
- Enable MCP servers for extended capabilities
- Set up hooks for cross-platform notifications
- Document integration workflows in `AGENTS.md`

## Troubleshooting

### GitHub integration not working

- Verify GitHub integration is configured in Factory dashboard
- Check authentication tokens are valid
- Ensure repository access permissions are correct
- Review issue/PR references are using correct URLs

### Context not syncing

- Verify sync directories exist (`.cursor/context/`, `.claude/context/artifacts/`)
- Check hook configurations are correct
- Ensure artifacts are saved in platform-agnostic locations
- Review file permissions and access

### Linear/Jira references fail

- Verify integration is configured in Factory dashboard
- Check API tokens and authentication
- Ensure task/ticket IDs are correct format
- Review access permissions for linked resources
