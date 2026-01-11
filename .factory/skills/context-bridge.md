# Context Bridge Skill

Synchronizes task state and metadata across Claude, Cursor, and Factory sessions.

## When to Use

- Handing off tasks between platforms
- Sharing specs with Claude for review
- Importing plans from Cursor
- Updating external trackers (Linear, GitHub)

## Invocation

```
Run Task tool with skill context-bridge to sync to Claude
Run Task tool with skill context-bridge to import from Cursor
Run Task tool with skill context-bridge to update Linear
```

## Process

1. **Export State**: Capture current droid session context
2. **Transform**: Convert to target platform format
3. **Sync**: Write to shared location or API
4. **Verify**: Confirm sync completed successfully

## Sync Targets

| Target  | Location            | Format            |
| ------- | ------------------- | ----------------- |
| Claude  | `.claude/context/`  | JSON artifacts    |
| Cursor  | `.cursor/context/`  | Plan files        |
| Factory | `.factory/context/` | Spec files        |
| Linear  | API                 | Issue updates     |
| GitHub  | API                 | PR/Issue comments |

## State Captured

```json
{
  "session_id": "factory-2025-11-29-001",
  "platform": "factory",
  "droid": "developer",
  "timestamp": "2025-11-29T10:00:00Z",
  "current_task": "Implement user authentication",
  "autonomy_level": "auto-medium",
  "progress": {
    "completed": ["Design spec", "API routes"],
    "in_progress": ["Frontend components"],
    "pending": ["Tests", "Documentation"]
  },
  "artifacts": ["spec-auth-001.md"],
  "files_modified": ["src/auth/", "src/api/users/"]
}
```

## Cross-Platform Handoff

**Factory to Claude:**

```
Run Task tool with skill context-bridge to hand off to Claude for security review
```

**Cursor to Factory:**

```
Run Task tool with skill context-bridge to import Cursor plan for implementation
```

## Integration with Factory

- Auto-sync on Specification Mode completion
- Post-run hook context publishing
- Multi-droid coordination

## Related Skills

- `artifact-publisher` - Publish before sync
- `context-router` - Route context appropriately
