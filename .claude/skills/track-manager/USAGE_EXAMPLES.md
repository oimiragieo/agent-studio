# Track Manager - Usage Examples

This document provides practical examples of using the track-manager skill for organizing work across sessions.

---

## Example 1: Feature Development Track

### Scenario

You're implementing a new authentication feature that spans multiple workflows and sessions.

### Commands

```bash
# 1. Create the track
node .claude/skills/track-manager/manager.mjs create \
  --name "OAuth Authentication" \
  --type feature \
  --goal "Add OAuth 2.0 authentication with Google and GitHub providers" \
  --priority P1

# Output:
# {
#   "track_id": "track-oauth-authentication-1736899200000",
#   "name": "OAuth Authentication",
#   "type": "feature",
#   "status": "draft",
#   "priority": "P1",
#   ...
# }

# 2. Activate the track (assuming it's ready)
node .claude/skills/track-manager/manager.mjs activate \
  --track-id track-oauth-authentication-1736899200000

# 3. Work on the feature...
# (Execute workflows, create artifacts within track context)

# 4. Pause for code review
node .claude/skills/track-manager/manager.mjs pause \
  --track-id track-oauth-authentication-1736899200000 \
  --reason "Waiting for security review"

# Creates checkpoint automatically

# 5. Resume after review
node .claude/skills/track-manager/manager.mjs resume \
  --track-id track-oauth-authentication-1736899200000

# 6. Complete when done
node .claude/skills/track-manager/manager.mjs complete \
  --track-id track-oauth-authentication-1736899200000
```

---

## Example 2: Track Switching

### Scenario

You're working on a feature but need to switch to a critical bug fix.

### Commands

```bash
# 1. Check current active track
node .claude/skills/track-manager/registry.mjs get-active

# Output:
# {
#   "track_id": "track-oauth-authentication-1736899200000",
#   "name": "OAuth Authentication",
#   "status": "active",
#   ...
# }

# 2. Create bug fix track
node .claude/skills/track-manager/manager.mjs create \
  --name "Login Timeout Fix" \
  --type bugfix \
  --goal "Fix login session timeout after 5 minutes" \
  --priority P0

# 3. Switch to bug fix track (suspends current track)
node .claude/skills/track-manager/manager.mjs switch \
  --to track-login-timeout-fix-1736899300000

# Output:
# {
#   "suspended": "track-oauth-authentication-1736899200000",
#   "activated": "track-login-timeout-fix-1736899300000",
#   "checkpoint": "snap-checkpoint-1736899300123-abc456"
# }

# 4. Fix the bug...

# 5. Complete bug fix
node .claude/skills/track-manager/manager.mjs complete \
  --track-id track-login-timeout-fix-1736899300000

# 6. Switch back to feature track
node .claude/skills/track-manager/manager.mjs switch \
  --to track-oauth-authentication-1736899200000
```

---

## Example 3: Session Recovery

### Scenario

Your workflow was interrupted (computer crash, network issue). Recover the session.

### Commands

```bash
# 1. Detect interrupted sessions
node .claude/tools/session-recovery.mjs detect

# Output:
# Detected 2 interrupted session(s):
#
# - Track: OAuth Authentication (track-oauth-authentication-1736899200000)
#   Status: active
#   Progress: 45%
#   Last Updated: 2026-01-15T10:30:00Z (35 minutes ago)
#
# - Workflow Run: greenfield-fullstack-xyz123
#   Status: in_progress
#   Workflow: greenfield-fullstack.yaml
#   Current Step: 7
#   Last Updated: 2026-01-15T10:35:00Z (30 minutes ago)

# 2. Resume the track
node .claude/tools/session-recovery.mjs resume \
  --track-id track-oauth-authentication-1736899200000

# Output:
# {
#   "success": true,
#   "track_id": "track-oauth-authentication-1736899200000",
#   "track_name": "OAuth Authentication",
#   "progress_percentage": 45,
#   "checkpoint_restored": "snap-checkpoint-1736899200456-def789"
# }

# 3. Resume the workflow
node .claude/tools/session-recovery.mjs resume \
  --run-id greenfield-fullstack-xyz123

# Output:
# {
#   "success": true,
#   "run_id": "greenfield-fullstack-xyz123",
#   "resumed_from_step": 7,
#   "snapshot_used": "snap-auto-1736899250789-ghi012",
#   "snapshot_created_at": "2026-01-15T10:34:10Z",
#   "state": { ... }
# }
```

---

## Example 4: Track Registry Operations

### Scenario

Manage and query tracks across your project.

### Commands

```bash
# 1. List all active tracks
node .claude/skills/track-manager/registry.mjs list --status active

# 2. List all feature tracks
node .claude/skills/track-manager/registry.mjs list --type feature

# 3. Get registry statistics
node .claude/skills/track-manager/registry.mjs stats

# Output:
# {
#   "total_tracks": 5,
#   "active_count": 1,
#   "paused_count": 2,
#   "completed_count": 2,
#   "failed_count": 0,
#   "by_type": {
#     "feature": 3,
#     "bugfix": 1,
#     "refactor": 1
#   },
#   "by_priority": {
#     "P0": 1,
#     "P1": 2,
#     "P2": 2
#   },
#   "active_track": "track-oauth-authentication-1736899200000"
# }

# 4. Update track metadata
node .claude/skills/track-manager/registry.mjs update \
  --track-id track-oauth-authentication-1736899200000 \
  --field priority \
  --value P0
```

---

## Example 5: Programmatic Track Management

### JavaScript/Node.js

```javascript
import {
  createTrack,
  activateTrack,
  suspendTrack,
  resumeTrack,
  completeTrack,
  switchTrack,
} from './.claude/skills/track-manager/manager.mjs';
import { TrackRegistry, getActiveTrack } from './.claude/skills/track-manager/registry.mjs';

// Create a new feature track
const track = await createTrack({
  name: 'User Dashboard',
  type: 'feature',
  goal: 'Implement user dashboard with analytics widgets',
  priority: 'P1',
  successCriteria: [
    'Dashboard loads in <2 seconds',
    'All widgets display accurate data',
    'Mobile responsive design',
  ],
});

console.log(`Created track: ${track.track_id}`);

// Activate the track
await activateTrack(track.track_id);

// Work on the feature...
// (Execute workflows within track context)

// Pause for review
const { checkpoint } = await suspendTrack(track.track_id, 'Design review pending');
console.log(`Created checkpoint: ${checkpoint.snapshot_id}`);

// Resume after review
await resumeTrack(track.track_id);

// Complete the track
await completeTrack(track.track_id, {
  artifactsCreated: ['dashboard-component.tsx', 'analytics-widget.tsx', 'dashboard-tests.spec.ts'],
  filesModified: ['routes.tsx', 'app.tsx'],
  summary: 'User dashboard completed with 5 analytics widgets. Performance optimized.',
  lessonsLearned: [
    'Widget lazy loading reduced initial load time by 40%',
    'React.memo() prevented unnecessary re-renders',
  ],
});

console.log('Track completed successfully');

// Query tracks via registry
const registry = new TrackRegistry();

// Get active track
const activeTrack = await getActiveTrack();
console.log(`Active track: ${activeTrack?.name || 'None'}`);

// List paused tracks
const pausedTracks = await registry.listTracks({ status: 'paused' });
console.log(`Paused tracks: ${pausedTracks.length}`);

// Get registry statistics
const stats = await registry.getStats();
console.log(`Total tracks: ${stats.total_tracks}`);
console.log(`Completed: ${stats.completed_count}`);
```

---

## Example 6: Track with Multiple Workflows

### Scenario

Execute multiple workflows within a single track (e.g., architecture → implementation → testing).

### Directory Structure

```
.claude/conductor/tracks/
└── track-user-dashboard-1736899400000/
    ├── track.json                    # Track definition
    ├── context/
    │   ├── decisions.json            # Track-scoped decisions
    │   ├── assumptions.json          # Working assumptions
    │   └── artifacts/
    │       ├── project-brief.json    # From Step 1
    │       ├── system-architecture.json  # From Step 2
    │       └── prd.json              # From Step 3
    ├── workflows/
    │   ├── run-001-architecture/     # Architecture workflow
    │   │   ├── run.json
    │   │   ├── artifacts/
    │   │   └── reasoning/
    │   ├── run-002-implementation/   # Implementation workflow
    │   │   ├── run.json
    │   │   ├── artifacts/
    │   │   └── reasoning/
    │   └── run-003-testing/          # Testing workflow
    │       ├── run.json
    │       ├── artifacts/
    │       └── reasoning/
    └── checkpoints/
        ├── checkpoint-001.json       # Before implementation
        └── checkpoint-002.json       # Before testing
```

---

## Example 7: Track Context Isolation

### Scenario

Demonstrate that track artifacts are isolated and don't cross-contaminate.

### Commands

```bash
# Track 1: OAuth Feature
# Artifacts: oauth-config.json, auth-middleware.ts
# Location: .claude/conductor/tracks/track-oauth-authentication-001/context/artifacts/

# Track 2: Dashboard Feature
# Artifacts: dashboard-config.json, dashboard-component.tsx
# Location: .claude/conductor/tracks/track-user-dashboard-002/context/artifacts/

# Track 1 artifacts are NOT visible to Track 2
# Track 2 artifacts are NOT visible to Track 1

# Each track has isolated:
# - Artifacts
# - Decisions
# - Assumptions
# - Workflow runs
# - Checkpoints
```

---

## Best Practices

### 1. Track Naming

- Use descriptive names: "OAuth Authentication" not "Auth"
- Include scope: "User Dashboard Analytics Widgets" not "Dashboard"
- Be specific: "Fix Login Timeout Bug" not "Bug Fix"

### 2. Track Lifecycle

- Create track → Mark ready → Activate → Work → Pause/Resume as needed → Complete
- Always complete or cancel tracks (avoid abandoned active tracks)
- Use checkpoints before risky operations

### 3. Track Switching

- Complete urgent work before switching back
- Use descriptive pause reasons for context
- Review checkpoint before resuming

### 4. Session Recovery

- Run `detect` after interruptions
- Review snapshot age before resuming
- Validate state after recovery

### 5. Track Organization

- One track per major feature/initiative
- Use track types consistently (feature, bugfix, refactor, etc.)
- Set priorities accurately (P0 = critical, P3 = low)

---

## Troubleshooting

### Issue: "Cannot activate track - another track is active"

**Solution**: Use `switch` command instead of `activate`:

```bash
node .claude/skills/track-manager/manager.mjs switch --to <track-id>
```

### Issue: "Track not found"

**Solution**: List tracks to verify track ID:

```bash
node .claude/skills/track-manager/registry.mjs list
```

### Issue: "Failed to acquire registry lock"

**Solution**: Wait a few seconds and retry. If persists, check for stale lock:

```bash
# Remove stale lock manually (if older than 30 seconds)
rm .claude/conductor/tracks/track-registry.lock
```

### Issue: "No snapshots found for recovery"

**Solution**: Start workflow from scratch or manually restore state. Auto-save only creates snapshots on step completion.

---

## Performance Tips

### 1. Use Registry Caching

The registry is cached for 5 seconds. Repeated queries within this window use cached data.

### 2. Minimize Track Switches

Each switch creates a checkpoint (~1-2 seconds). Complete urgent work before switching.

### 3. Prune Old Snapshots

Auto-save creates snapshots on step completion. Prune old snapshots to save disk space:

```bash
node .claude/tools/snapshot-manager.mjs prune --keep-count 10
```

### 4. Use Track Templates (Future)

Once track templates are implemented, use them for common patterns to speed up track creation.

---

## Related Documentation

- **Track System Architecture**: `.claude/docs/TRACK_SYSTEM_ARCHITECTURE.md`
- **Track Schema**: `.claude/schemas/track.schema.json`
- **Snapshot Manager**: `.claude/tools/snapshot-manager.mjs`
- **Run Manager**: `.claude/tools/run-manager.mjs`
- **Session Recovery**: `.claude/tools/session-recovery.mjs`

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0
