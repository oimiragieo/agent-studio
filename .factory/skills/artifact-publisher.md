# Artifact Publisher Skill

Publishes artifacts to the project feed for sharing and traceability across platforms.

## When to Use

- After completing feature implementation
- Sharing design documents or specs
- Publishing test results or reports
- Creating handoff documentation
- Cross-platform artifact sync

## Invocation

```
Run Task tool with skill artifact-publisher to publish this spec
Run Task tool with skill artifact-publisher to share test results
```

Or after Auto-Run completion:

```
Publish the implementation artifacts to Claude Projects
```

## Process

1. **Prepare Content**: Format artifact for publication
2. **Add Metadata**: Timestamp, droid, tags, related files
3. **Publish**: Write to `.factory/context/artifacts/` or sync to Claude
4. **Notify**: Alert relevant team members or platforms

## Artifact Types

| Type           | Format   | Destination                   |
| -------------- | -------- | ----------------------------- |
| Specification  | Markdown | `.factory/specs/`             |
| Test Results   | JSON     | `.factory/context/artifacts/` |
| Implementation | Markdown | Claude Projects feed          |
| Handoff        | Markdown | Cross-platform sync           |

## Output Structure

```json
{
  "id": "artifact-2025-11-29-001",
  "type": "specification",
  "title": "User Authentication Feature",
  "created": "2025-11-29T10:00:00Z",
  "droid": "architect",
  "tags": ["auth", "feature", "nextjs"],
  "content": "...",
  "related_files": ["src/auth/", "src/components/login/"],
  "sync_targets": ["claude", "cursor"]
}
```

## Integration with Factory

- Auto-publish after Specification Mode completion
- Post-run hook artifact generation
- Cross-platform sync via context-bridge

## Platform-Specific Notes

**Factory Invocation**: Use Task tool with skill: "Run Task tool with skill artifact-publisher"
**Metadata**: Ensure consistent structure with Claude version (see `.claude/skills/artifact-publisher/SKILL.md`)
**Cross-Platform**: Published artifacts sync via `context-bridge` skill

## Related Skills

- `context-bridge` - Sync artifacts across platforms
- `context-router` - Route artifacts to appropriate destinations
