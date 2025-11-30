# Factory Droid Configuration - Agent Instructions

This file provides specific instructions for Factory Droid agents working with this project.

## Build & Test

### Core Commands
- **Validate config**: `pnpm validate` (validates agent configuration files)
- **Validate verbose**: `pnpm validate:verbose` (verbose validation output)
- **Install agents**: `pnpm install-agents` (install agent configurations to a project)
- **Cross-platform sync**: `bash scripts/validate-sync.sh` (validates agent sync across platforms)

### Pre-Run Validation
- Run linting before making changes
- Verify existing tests pass before modifying code
- Check for merge conflicts in target files

### Post-Run Quality
- Generate coverage report after changes
- Run full lint and test suite
- Validate code quality before committing

## Custom Droids

Available specialized agents in `.factory/droids/`:

**Core Development Agents:**
- **analyst**: Market research, requirements gathering, competitive analysis
- **pm**: Product requirements, epic definition, business validation
- **architect**: System design, technology selection, security planning
- **developer**: Implementation, code quality, testing execution
- **qa**: Test planning, quality validation, compliance verification
- **ux-expert**: User experience design, accessibility, interface specification

**Enterprise Agents:**
- **security-architect**: Security design and threat modeling
- **devops**: Infrastructure, CI/CD, and deployments
- **database-architect**: Database design and optimization
- **sre-agent**: Reliability engineering and observability
- **data-engineer**: Data pipelines and analytics infrastructure

**Support Agents:**
- **technical-writer**: Documentation and knowledge management
- **release-manager**: Release coordination and versioning

**Code Quality Agents:**
- **code-reviewer**: Systematic code review and PR analysis
- **refactoring-specialist**: Code transformation and technical debt reduction
- **performance-engineer**: Performance optimization and profiling

**Specialized Agents:**
- **llm-architect**: AI/LLM system design, RAG, prompt engineering
- **api-designer**: REST/GraphQL/gRPC API design patterns
- **legacy-modernizer**: Legacy system modernization strategies
- **mobile-developer**: iOS/Android/React Native/Flutter development
- **accessibility-expert**: WCAG compliance, a11y testing
- **compliance-auditor**: GDPR/HIPAA/SOC2/PCI-DSS regulatory compliance
- **incident-responder**: Crisis management and post-mortems

**Total**: 22 specialized agents (includes Orchestrator for task routing and multi-agent coordination).

### Invoking Custom Droids

Use the Task tool with subagent specification:
```
Run the Task tool with subagent architect to design the authentication system.
```

## Specification Mode

For complex features:
1. Activate Specification Mode with `Shift+Tab`
2. Describe feature in 4-6 sentences
3. Review generated specification and plan
4. Approve to begin implementation

**When to use:**
- Features touching multiple files
- Architectural decisions required
- Coordination across components needed
- Significant business logic involved

## Auto-Run Levels

Choose autonomy based on task type:

- **Auto (Low)**: File edits and read-only commands (default for most work)
- **Auto (Medium)**: Reversible workspace changes (installs, local git)
- **Auto (High)**: All commands except safety blocks (infrastructure changes)

**Start conservative**, increase autonomy as you build trust.

## Context Layers

Droid automatically combines:
1. Repository code and documentation
2. Cursor plans (`.cursor/plans/latest.md`)
3. Claude artifacts (`.claude/context/artifacts/*`)
4. Knowledge base docs (tagged with feature ID)

Use `context-router` skill to intelligently prioritize sources.

## Hooks

### Pre-Run Hook (`hooks/pre-run.yaml`)
- Validates code quality (lint, test)
- Attaches context artifacts
- Checks for merge conflicts
- Blocks dangerous commands

### Post-Run Hook (`hooks/post-run.yaml`)
- Generates coverage reports
- Publishes artifacts to Claude Projects
- Syncs context to Cursor and Claude
- Notifies team via Slack

## Artifact Publishing

After completing work:
- Save specifications to `.factory/docs/`
- Publish artifacts to Claude Projects
- Sync context to `.cursor/context/` and `.claude/context/artifacts/`
- Link to GitHub issues or Linear tasks

## Integration Points

### GitHub
- Reference issues: `https://github.com/org/repo/issues/123`
- Read PRs and discussions automatically
- Use repository context for code analysis

### Linear
- Reference tasks: `Complete Linear task PROJ-123`
- Fetch acceptance criteria automatically
- Update task status after completion

### Claude Projects
- Publish artifacts for traceability
- Share decision history
- Reference artifacts in future work

## Security

### Droid Shield (Enabled)
- Secret scanning before commits
- Git guardrails (no force push to main)
- Dangerous command blocking
- Protected file validation

### Protected Operations
Commands always require confirmation:
- `rm -rf`, `sudo rm`, `format`, `dd`, `mkfs`
- Force push to protected branches
- Database migrations (unless explicitly approved)
- Deployment commands

## Best Practices

1. **Use Specification Mode** for complex features requiring planning
2. **Reference AGENTS.md** files instead of repeating conventions
3. **Start with Auto (Low)** and increase autonomy gradually
4. **Review changes** even in Auto-Run mode before committing
5. **Publish artifacts** for cross-platform context preservation
6. **Use Custom Droids** for specialized domain expertise
7. **Set clear boundaries** in prompts to contain change scope

## Troubleshooting

### Custom Droids not available
- Verify Custom Droids enabled: `/settings` → `enableCustomDroids: true`
- Restart droid after enabling
- Check droid files in `.factory/droids/` or `~/.factory/droids/`

### Context not syncing
- Verify directories exist (`.cursor/context/`, `.claude/context/artifacts/`)
- Check hook configurations
- Review file permissions

### Too many prompts in Auto-Run
- Check autonomy level in status banner
- Verify commands aren't in denylist
- Add safe commands to allowlist in settings

