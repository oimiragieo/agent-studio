# Conductor - Track-Based Work Organization

The Conductor directory houses the **Track System**, which provides higher-level work organization above individual workflows.

---

## What is a Track?

A **track** is a named, bounded work context that:

1. **Groups related workflows** - Multiple workflows working toward a shared goal
2. **Maintains isolated context** - Artifacts, decisions, and state scoped to the track
3. **Persists across sessions** - Resumable work that survives context window limits
4. **Tracks progress** - Percentage completion, step status, and outcomes

**Track vs Workflow vs Run**:

| Concept      | Scope            | Lifetime         | Purpose                               |
| ------------ | ---------------- | ---------------- | ------------------------------------- |
| **Run**      | Single execution | Minutes to hours | Execute one workflow instance         |
| **Workflow** | Step sequence    | Defined by steps | Define agent coordination pattern     |
| **Track**    | Work initiative  | Days to weeks    | Group related workflows toward a goal |

---

## Directory Structure

```
.claude/conductor/
├── README.md                    # This file
├── context/
│   └── snapshots/              # Shared snapshots directory
└── tracks/
    ├── track-registry.json     # Single source of truth for all tracks
    │
    ├── track-auth-feature-001/
    │   ├── track.json          # Track definition
    │   ├── context/
    │   │   ├── decisions.json  # Track-scoped decisions
    │   │   ├── assumptions.json
    │   │   └── artifacts/
    │   │       ├── project-brief.json
    │   │       └── prd.json
    │   ├── workflows/
    │   │   └── run-001/        # Workflow runs within track
    │   │       ├── run.json
    │   │       ├── artifacts/
    │   │       └── reasoning/
    │   └── checkpoints/
    │       └── checkpoint-001.json
    │
    └── track-perf-optimization-002/
        └── ...
```

---

## Track Lifecycle

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
    ┌────────┐      │      ┌────────┐      ┌────────┐      ┌────────────┐
    │ draft  │──────┼─────▶│ ready  │─────▶│ active │─────▶│ completed  │
    └────────┘      │      └────────┘      └────────┘      └────────────┘
         │          │           │              │ │               │
         │          │           │              │ │               │
         ▼          │           ▼              ▼ │               ▼
    ┌────────────┐  │      ┌────────┐      ┌────────┐      ┌──────────┐
    │ cancelled  │◀─┼──────│ failed │◀─────│ paused │      │ archived │
    └────────────┘  │      └────────┘      └────────┘      └──────────┘
                    │                           │
                    │                           │ resume
                    │                           ▼
                    │                      ┌────────┐
                    └──────────────────────│ active │
                                           └────────┘
```

---

## Single Active Track Constraint

**Only one track can be active at a time.**

**Rationale**:

- Prevents context confusion
- Prevents competing workflows from conflicting
- Enforces focus
- Simplifies state management

**Switching Tracks**:

1. Current track is suspended (creates checkpoint)
2. New track is activated (restores checkpoint if resuming)
3. Context switches in <3 seconds

---

## Track Types

| Type            | Description              | Typical Duration | Example                        |
| --------------- | ------------------------ | ---------------- | ------------------------------ |
| `onboarding`    | New project setup        | 1-3 days         | Set up development environment |
| `feature`       | New feature              | 3-14 days        | Add authentication system      |
| `bugfix`        | Bug investigation        | 1-5 days         | Fix login flow timeout         |
| `refactor`      | Code restructuring       | 2-7 days         | Migrate to TypeScript          |
| `migration`     | System migration         | 5-21 days        | Upgrade to Next.js 15          |
| `testing`       | Testing campaign         | 2-7 days         | Integration test coverage      |
| `documentation` | Documentation            | 1-5 days         | API documentation refresh      |
| `security`      | Security audit           | 3-14 days        | OWASP compliance               |
| `performance`   | Performance optimization | 3-10 days        | Core Web Vitals                |
| `maintenance`   | Routine maintenance      | 1-3 days         | Dependency updates             |
| `learning`      | Exploration              | 1-7 days         | Evaluate new framework         |
| `exploration`   | Research                 | 1-14 days        | Spike on microservices         |
| `custom`        | User-defined             | Variable         | Custom workflow                |

---

## Context Isolation

Tracks maintain isolated contexts to prevent cross-contamination:

```
Project Context (CLAUDE.md, rules, config)
         │
         ▼
   Track Context (track.json, decisions, assumptions)
         │
         ▼
   Workflow Context (run.json, artifacts)
         │
         ▼
   Step Context (agent state, reasoning)
```

**Inheritance Rules**:

| Context Type         | Inheritance   | Override Allowed   |
| -------------------- | ------------- | ------------------ |
| Project rules        | Inherited     | No                 |
| Technology stack     | Inherited     | Track can extend   |
| Agent configurations | Inherited     | Track can override |
| Artifacts            | Not inherited | Track creates own  |
| Decisions            | Not inherited | Track-scoped       |

---

## Track Registry

**Location**: `.claude/conductor/tracks/track-registry.json`

**Schema**:

```json
{
  "version": "1.0",
  "active_track": "track-auth-feature-001",
  "tracks": {
    "track-auth-feature-001": {
      "track_id": "track-auth-feature-001",
      "name": "Authentication Feature",
      "type": "feature",
      "status": "active",
      "priority": "P1",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T14:30:00Z",
      "started_at": "2025-01-15T10:15:00Z",
      "path": "track-auth-feature-001",
      "progress": {
        "percentage": 35,
        "completed_steps": 3,
        "total_steps": 8
      },
      "last_checkpoint": "checkpoint-003"
    }
  },
  "metadata": {
    "total_tracks": 2,
    "active_count": 1,
    "completed_count": 0,
    "last_updated": "2025-01-15T14:30:00Z"
  }
}
```

---

## Track Manager Skill

**Location**: `.claude/skills/track-manager/`

**Files**:

- `SKILL.md` - Skill documentation
- `manager.mjs` - Track lifecycle operations
- `registry.mjs` - Track registry management
- `USAGE_EXAMPLES.md` - Practical usage examples

**CLI Commands**:

```bash
# Create track
node .claude/skills/track-manager/manager.mjs create --name "..." --type feature

# Activate track
node .claude/skills/track-manager/manager.mjs activate --track-id <id>

# Pause track
node .claude/skills/track-manager/manager.mjs pause --track-id <id> --reason "..."

# Resume track
node .claude/skills/track-manager/manager.mjs resume --track-id <id>

# Complete track
node .claude/skills/track-manager/manager.mjs complete --track-id <id>

# Switch tracks
node .claude/skills/track-manager/manager.mjs switch --to <id>

# List tracks
node .claude/skills/track-manager/registry.mjs list [--status active] [--type feature]

# Get active track
node .claude/skills/track-manager/registry.mjs get-active

# Registry stats
node .claude/skills/track-manager/registry.mjs stats
```

---

## Session Recovery

**Location**: `.claude/tools/session-recovery.mjs`

Detects interrupted sessions and offers recovery via snapshot restoration.

**Commands**:

```bash
# Detect interrupted sessions
node .claude/tools/session-recovery.mjs detect

# Resume workflow
node .claude/tools/session-recovery.mjs resume --run-id <id>

# Resume track
node .claude/tools/session-recovery.mjs resume --track-id <id>

# List interrupted sessions
node .claude/tools/session-recovery.mjs list-interrupted
```

---

## Integration Points

### With Snapshot Manager

Tracks use snapshots for checkpointing:

```javascript
import { createSnapshot } from '@.claude/tools/snapshot-manager.mjs';

// Create checkpoint when suspending track
const checkpoint = await createSnapshot({
  type: 'checkpoint',
  runId: trackId,
  description: 'Pre-suspension checkpoint',
});
```

### With Run Manager

Tracks create workflow runs within their scope:

```javascript
import { createRun } from '@.claude/tools/run-manager.mjs';

// Create run within track context
const run = await createRun(runId, {
  workflowId: track.track_id,
  trackId: track.track_id,
});
```

### With Orchestrator (Planned)

Orchestrator routes work through active track context:

```javascript
const activeTrack = await getActiveTrack();
if (activeTrack) {
  // Execute within track context
  return executeWithinTrack(activeTrack, request);
}
```

---

## Performance Characteristics

| Metric               | Value      | Impact                       |
| -------------------- | ---------- | ---------------------------- |
| Registry Cache TTL   | 5 seconds  | 80% reduction in disk I/O    |
| Track Switch Time    | <3 seconds | Includes checkpoint creation |
| Registry Lookup      | O(1)       | Map-based indexing           |
| Snapshot Compression | ~70% ratio | Reduces storage overhead     |
| Lock Timeout         | 5 seconds  | Prevents indefinite blocking |
| Stale Lock Threshold | 30 seconds | Automatic deadlock recovery  |

---

## Security Considerations

1. **File Locking**: Prevents concurrent modifications to track registry
2. **Stale Lock Detection**: Removes locks older than 30 seconds to prevent deadlocks
3. **Checksum Validation**: Ensures checkpoint integrity (via snapshot-manager)
4. **Path Validation**: Prevents directory traversal attacks
5. **Atomic Writes**: Prevents partial state corruption

---

## Best Practices

### Track Naming

- Use descriptive names: "OAuth Authentication" not "Auth"
- Include scope: "User Dashboard Analytics Widgets" not "Dashboard"
- Be specific: "Fix Login Timeout Bug" not "Bug Fix"

### Track Lifecycle

- Create track → Mark ready → Activate → Work → Pause/Resume as needed → Complete
- Always complete or cancel tracks (avoid abandoned active tracks)
- Use checkpoints before risky operations

### Track Switching

- Complete urgent work before switching back
- Use descriptive pause reasons for context
- Review checkpoint before resuming

### Session Recovery

- Run `detect` after interruptions
- Review snapshot age before resuming
- Validate state after recovery

---

## Related Documentation

- **Track System Architecture**: `.claude/docs/TRACK_SYSTEM_ARCHITECTURE.md`
- **Track Schema**: `.claude/schemas/track.schema.json`
- **Snapshot Manager**: `.claude/tools/snapshot-manager.mjs`
- **Run Manager**: `.claude/tools/run-manager.mjs`
- **Session Recovery**: `.claude/tools/session-recovery.mjs`
- **Usage Examples**: `.claude/skills/track-manager/USAGE_EXAMPLES.md`

---

## Future Enhancements

1. **Track Templates**: Reusable templates for common patterns (feature, bugfix, refactor)
2. **Hierarchical Tracks**: Sub-tracks for complex initiatives
3. **Track Dependencies**: Formal dependency graph with conflict detection
4. **Track Analytics**: Metrics on duration, success rates, common patterns
5. **Track Import/Export**: Share track definitions between projects
6. **Track Hooks**: Custom pre/post hooks for track lifecycle events

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0
