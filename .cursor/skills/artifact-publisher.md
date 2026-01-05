# Artifact Publisher Skill

Publishes artifacts to the project feed for sharing and traceability.

## When to Use

- After completing a feature implementation
- Sharing design documents or specs
- Publishing test results or reports
- Creating handoff documentation

## Invocation

```
Use @artifact-publisher to publish this plan
Use @artifact-publisher to share these test results
Use @artifact-publisher to create a handoff artifact
```

## Process

1. **Prepare Content**: Format artifact for publication
2. **Add Metadata**: Timestamp, author, tags, related files
3. **Publish**: Write to `.cursor/context/artifacts/` or Claude Projects
4. **Notify**: Alert relevant team members or agents

## Artifact Types

| Type | Format | Destination |
|------|--------|-------------|
| Plan | Markdown | `.cursor/plans/` |
| Test Results | JSON | `.cursor/context/artifacts/` |
| Code Review | Markdown | Claude Projects feed |
| Handoff | Markdown | Cross-platform sync |

## Output Structure

```json
{
  "id": "artifact-2025-11-29-001",
  "type": "plan",
  "title": "User Authentication Feature",
  "created": "2025-11-29T10:00:00Z",
  "author": "cursor-agent",
  "tags": ["auth", "feature", "nextjs"],
  "content": "...",
  "related_files": ["src/auth/", "src/components/login/"]
}
```

## Integration with Cursor

- Automatic publication after Plan Mode completion
- Cloud Agent status updates
- Cross-platform sync with Claude/Factory

## Platform-Specific Notes

**Cursor Invocation**: Use `@artifact-publisher` mention in chat
**Metadata**: Ensure consistent structure with Claude version (see `.claude/skills/artifact-publisher/SKILL.md`)
**Cross-Platform**: Published artifacts sync via `context-bridge` skill

## Related Skills

- `context-bridge` - Sync artifacts across platforms
- `repo-rag` - Search published artifacts
