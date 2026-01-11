# Context Router Skill

Intelligently combines multiple context sources for optimal decision-making and code generation.

## Context Source Priority

Droid prioritizes context sources in this order:

1. **Repository snapshot** (default primary source)
   - Current codebase state
   - Documentation and `AGENTS.md` files
   - Test files and examples
   - Configuration and infrastructure

2. **Plan artifacts from Cursor** (`.cursor/plans/latest.md`)
   - Multi-file change plans
   - Implementation strategies
   - Dependency analysis
   - Test scenarios

3. **Claude Artifact references** (`.claude/context/artifacts/*`)
   - Specifications and requirements
   - Architecture documents
   - Test plans and quality reports
   - Previous agent outputs

4. **Knowledge base docs** (tagged with feature/project ID)
   - External documentation
   - Integration guides
   - Best practices and patterns
   - Historical decisions

## Conflict Resolution

When conflicting instructions appear:

1. **Claude hierarchy first**: Root `CLAUDE.md` → subdirectory `CLAUDE.md`
2. **Most recent artifacts**: Newer specifications override older ones
3. **Explicit over implicit**: Directly referenced files take precedence
4. **Repository code**: Current implementation patterns inform decisions

## Usage Patterns

### Repository + Plan Combination

When Cursor plan exists:

```
Use Cursor plan in .cursor/plans/latest.md for file structure,
combined with repository patterns in src/ for implementation details.
```

### Repository + Artifact Combination

When Claude artifact exists:

```
Follow architecture in .claude/context/artifacts/system-architecture.json,
implementing using patterns from repository codebase.
```

### Knowledge Base Integration

When external docs are available:

```
Use patterns from knowledge base docs tagged [feature-id],
applying them to current repository context.
```

## Best Practices

1. **Always attach repository context**: Ensures alignment with existing patterns
2. **Reference plans explicitly**: Mention Cursor plans or Claude artifacts in prompts
3. **Tag knowledge base docs**: Use consistent feature/project IDs for discoverability
4. **Resolve conflicts early**: Flag conflicts during planning phase, not implementation

## Configuration

Context router behavior can be customized in `AGENTS.md`:

```markdown
## Context Priority

1. Repository code (enforced patterns)
2. Specification artifacts (requirements)
3. External documentation (best practices)
```
