---
name: track-manager
description: Higher-level work organization through track lifecycle management, context isolation, and workflow coordination
version: 1.0.0
category: workflow-orchestration
complexity: advanced
token_budget: 8000
allowed-tools: read, write, bash
---

# track-manager

## Identity

**Skill**: track-manager
**Purpose**: Higher-level work organization through track lifecycle management, context isolation, and workflow coordination
**Version**: 1.0.0
**Category**: workflow-orchestration
**Complexity**: advanced
**Token Budget**: 8000 tokens (architecture + manager implementation)

## Goal

Provide track-based organization above individual workflows, enabling:

- Resumable work streams across agent sessions
- Isolated context that prevents cross-contamination
- Coordinated multi-workflow execution toward unified goals
- Progress tracking with checkpointing for long-running initiatives

## Backstory

Tracks solve the "scattered context" problem where related work across multiple sessions loses cohesion. By providing an explicit organizational layer, tracks enable work continuity across context window boundaries.

**Key Innovation**: Single active track constraint ensures focus while checkpointing enables reliable resume.

## How It Works

### Track Lifecycle

```
draft → ready → active → paused → completed
  │       │       │         │          │
  │       │       │         ▼          ▼
  │       │       └──────▶ failed   archived
  │       └──────────────▶ cancelled
  └──────────────────────▶ cancelled
```

### Context Isolation

Tracks maintain isolated contexts in `.claude/conductor/tracks/`:

```
tracks/
├── track-registry.json          # Single source of truth
├── track-auth-feature-001/
│   ├── track.json              # Track definition
│   ├── context/
│   │   ├── decisions.json      # Track-scoped decisions
│   │   ├── artifacts/          # Track-scoped artifacts
│   │   └── assumptions.json
│   ├── workflows/
│   │   └── run-001/           # Workflow runs within track
│   └── checkpoints/
│       └── checkpoint-001.json
```

### Single Active Track Constraint

- **Only one track active at a time** - prevents context confusion
- **Switching**: Suspend current track → Activate new track
- **Enforcement**: Registry-level locking ensures atomic operations

## Usage

### Create Track

```bash
node .claude/skills/track-manager/manager.mjs create \
  --name "Authentication Feature" \
  --type feature \
  --goal "Add OAuth 2.0 authentication" \
  --priority P1
```

### Activate Track

```bash
node .claude/skills/track-manager/manager.mjs activate \
  --track-id track-auth-feature-001
```

### Execute Track Steps

```bash
# Execute next step
node .claude/skills/track-manager/manager.mjs next \
  --track-id track-auth-feature-001

# Execute specific step
node .claude/skills/track-manager/manager.mjs step \
  --track-id track-auth-feature-001 \
  --step-id step-002
```

### Pause/Resume

```bash
# Pause (creates checkpoint)
node .claude/skills/track-manager/manager.mjs pause \
  --track-id track-auth-feature-001 \
  --reason "Waiting for API review"

# Resume (restores from checkpoint)
node .claude/skills/track-manager/manager.mjs resume \
  --track-id track-auth-feature-001
```

### Switch Tracks

```bash
node .claude/skills/track-manager/manager.mjs switch \
  --to track-perf-optimization-002
```

### Track Registry Operations

```bash
# List all tracks
node .claude/skills/track-manager/registry.mjs list \
  --status active

# Get active track
node .claude/skills/track-manager/registry.mjs get-active

# Update track
node .claude/skills/track-manager/registry.mjs update \
  --track-id track-auth-feature-001 \
  --field status \
  --value paused
```

## Implementation

See:

- `manager.mjs` - Track lifecycle operations (create, activate, pause, resume, complete)
- `registry.mjs` - Track registry management with O(1) indexing
- `track-cli.mjs` - CLI interface for all track operations

## Integration Points

### With Run Manager

Tracks create workflow runs within their scope:

```javascript
import { createRunForTrack } from './track-integration.mjs';

const run = await createRunForTrack(trackId, runId, {
  workflowId: track.track_id,
  selectedWorkflow: step.action.workflow,
});
```

### With Snapshot Manager

Tracks use snapshots for checkpointing:

```javascript
import { createSnapshot } from '@.claude/tools/snapshot-manager.mjs';

const checkpoint = await createSnapshot({
  type: 'checkpoint',
  runId: trackRunId,
  description: 'Pre-step checkpoint',
});
```

### With Orchestrator

Orchestrator routes work through active track context:

```javascript
const activeTrack = await getActiveTrack();
if (activeTrack) {
  // Execute within track context
  return executeWithinTrack(activeTrack, request);
}
```

## Success Criteria

- Track lifecycle operations complete without errors
- Track registry maintains consistency (single active track)
- Context properly isolated between tracks
- Track switching completes <3 seconds
- Checkpoints enable accurate state reconstruction

## Performance Considerations

- **Registry Caching**: 5-second TTL reduces disk I/O
- **File Locking**: Prevents race conditions during concurrent operations
- **Atomic Writes**: Ensures registry consistency
- **Indexed Access**: O(1) track lookups by ID, type, status

## Error Handling

```javascript
try {
  await activateTrack(trackId);
} catch (error) {
  if (error instanceof ActiveTrackExistsError) {
    // Another track is active - suggest switch
    console.error(`Use 'switch --to ${trackId}' to activate this track`);
  } else if (error instanceof InvalidStateError) {
    // Track not in correct state
    console.error(`Track must be in 'ready' status to activate`);
  } else {
    throw error;
  }
}
```

## Security Considerations

- **Lock file detection**: Prevents concurrent registry modifications
- **Stale lock cleanup**: Removes locks older than 30 seconds
- **Checksum validation**: Ensures checkpoint integrity
- **Path validation**: Prevents directory traversal attacks

## Future Enhancements

- Track templates for common patterns
- Hierarchical tracks (sub-tracks)
- Track dependencies and conflict detection
- Track analytics (duration, success rates)
- Track import/export for sharing between projects

## Related Skills

- `@.claude/skills/workflow-executor` - Executes workflows within tracks
- `@.claude/skills/checkpoint-manager` - Creates and restores checkpoints
- `@.claude/skills/context-bridge` - Manages context across track boundaries

## References

- Architecture: `@.claude/docs/TRACK_SYSTEM_ARCHITECTURE.md`
- Schema: `@.claude/schemas/track.schema.json`
- Run Manager: `@.claude/tools/run-manager.mjs`
- Snapshot Manager: `@.claude/tools/snapshot-manager.mjs`

## Metadata

```json
{
  "skill": "track-manager",
  "version": "1.0.0",
  "category": "workflow-orchestration",
  "complexity": "advanced",
  "token_budget": 8000,
  "dependencies": ["run-manager", "snapshot-manager"],
  "agents": ["orchestrator", "master-orchestrator"],
  "platforms": ["claude-code"],
  "tags": ["tracks", "workflows", "state-management", "checkpoints"]
}
```
