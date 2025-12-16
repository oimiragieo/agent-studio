# Projects Configuration Guide

OpenCode Projects let us preload knowledge, style, and guardrails for each workspace. Follow these steps when standing up a new repository.

## Initial Setup

1. **Create a Project** and upload baseline context: README, architecture docs, API schemas.
2. **Define instruction sets** – map root instructions, directory-specific files, and agent prompts.
3. **Enable team memory** cautiously; ensure no regulated data persists longer than policy allows.
4. **Register Integrations** (Linear, GitHub, Slack) so hooks can tag activity feed items automatically.
5. **Assign subagents** (Architect, QA, PM, etc.) with tool permissions aligned to their role.
6. **Link other platforms** by storing plan artifacts and transcripts in the Project so other platforms can pull context.

## Best Practices

- Keep the Project knowledge base under 200 documents to avoid noisy retrieval
- Archive stale assets quarterly
- Update context documents when project requirements change
- Maintain clear ownership of each document

## Folder Structure

```
.opencode/
├── agent/           # Agent definitions
├── command/         # Slash commands
├── context/         # Session and artifact storage
├── hook/            # Pre/post execution hooks
├── instruction/     # Context-specific instructions
├── schema/          # Validation schemas
├── skill/           # Reusable capabilities
├── system/          # Guardrails and permissions
├── template/        # Document templates
├── tool/            # Custom tools
└── workflow/        # Multi-step workflows
```

## Context Files

### Session Context
The session context file (`context/session.json`) tracks:
- Current workflow state
- Agent handoff data
- Generated artifact references
- Quality gate results

### Artifacts
Generated artifacts are stored in `context/artifacts/` with:
- Unique identifiers
- Creation timestamps
- Agent ownership
- Validation status

## Integration Points

### GitHub Integration
- Automatic PR creation from artifacts
- Issue tracking and linking
- Commit message generation

### CI/CD Integration
- Quality gate validation
- Automated testing triggers
- Deployment pipelines

### Team Communication
- Slack notifications for gate results
- Progress updates to stakeholders
- Escalation for blocked workflows
