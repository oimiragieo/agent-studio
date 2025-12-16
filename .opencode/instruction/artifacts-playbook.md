# Artifacts Playbook

OpenCode supports Artifacts as a live workspace for code, docs, and designs. Use this guide to standardize how we create, review, and publish artifacts across agents.

## When to Create an Artifact
- Multi-file code changes or RFC drafts.
- UI proposals that benefit from live preview.
- Data analysis notebooks requiring iteration.

## Workflow
1. Generate a Plan Mode summary or plan artifact.
2. Produce implementation output inside the Artifact window; keep chat responses concise.
3. Tag the artifact with feature ID and owner.
4. Publish via `artifact-publisher` skill; share for continued execution.

## Review Checklist
- Linked to Jira/Linear ticket.
- Includes test coverage notes.
- Contains rollback strategy when relevant.

## Artifact Types

### Code Artifacts
- Implementation files (.js, .ts, .py, etc.)
- Configuration files
- Test files

### Documentation Artifacts
- Architecture diagrams
- API specifications
- User guides

### Design Artifacts
- UI mockups
- Wireframes
- Component specifications

## Storage

Artifacts are stored in `.opencode/context/artifacts/` with the following structure:
```
artifacts/
├── [session-id]/
│   ├── manifest.json    # Artifact manifest
│   ├── code/            # Code artifacts
│   ├── docs/            # Documentation
│   └── designs/         # Design artifacts
```

## Best Practices

1. **Tag artifacts** with feature ID for traceability
2. **Version control** - commit artifacts with meaningful messages
3. **Link dependencies** - reference related artifacts
4. **Include metadata** - add creation date, owner, status
5. **Review before publishing** - ensure quality standards met
