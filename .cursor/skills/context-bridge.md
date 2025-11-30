# Context Bridge Skill

Synchronizes task state and metadata across Claude, Cursor, and Factory sessions.

## When to Use

- Handing off tasks between platforms
- Sharing plans across team members
- Updating external trackers (Linear, Jira)
- Preserving context between sessions

## Invocation

```
Use @context-bridge to sync to Claude
Use @context-bridge to export this session
Use @context-bridge to import from Factory
Use @context-bridge to update Linear
```

## Process

1. **Export State**: Capture current session context
2. **Transform**: Convert to target platform format
3. **Sync**: Write to shared location or API
4. **Verify**: Confirm sync completed successfully

## Sync Targets

| Target | Location | Format |
|--------|----------|--------|
| Claude | `.claude/context/` | JSON artifacts |
| Cursor | `.cursor/context/` | Plan files |
| Factory | `.factory/context/` | Spec files |
| Linear | API | Issue updates |
| GitHub | API | PR/Issue comments |

## State Captured

```json
{
  "session_id": "cursor-2025-11-29-001",
  "platform": "cursor",
  "timestamp": "2025-11-29T10:00:00Z",
  "current_task": "Implement user authentication",
  "progress": {
    "completed": ["Design spec", "API routes"],
    "in_progress": ["Frontend components"],
    "pending": ["Tests", "Documentation"]
  },
  "artifacts": ["plan-auth-001.md", "spec-auth-001.json"],
  "files_modified": ["src/auth/", "src/api/users/"]
}
```

## Cross-Platform Handoff

**Cursor to Claude:**
```
Use @context-bridge to hand off to Claude for architecture review
```

**Claude to Factory:**
```
Use @context-bridge to sync implementation to Factory for deployment
```

## Integration with Cursor

- Auto-sync on Plan Mode completion
- Cloud Agent handoffs
- Multi-agent coordination

## Related Skills

- `artifact-publisher` - Publish before sync
- `repo-rag` - Search synced context
