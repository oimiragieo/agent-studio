---
name: workflow-revert
description: Smart state restoration from snapshots with safety checks, dry-run mode, and atomic rollback capability. Enables 1-click undo of workflow changes through snapshot reversion.
version: 1.0.0
allowed-tools: read, bash
dependencies: snapshot-manager
---

# Workflow Revert Skill

Smart state restoration from snapshots with comprehensive safety checks and dry-run capabilities.

## When to Use

- Undo workflow changes that caused issues
- Restore previous working state after failed experiments
- Roll back breaking changes or bugs
- Recover from incorrect workflow execution
- Test different approaches by reverting to common baseline
- Restore state after accidental destructive operations

## Triggers

**Automatic Triggers** (invoke skill):

- User says "revert", "undo", "rollback", "restore snapshot"
- User says "go back to", "restore to", "undo changes"
- Workflow step validation fails and recovery needed
- User requests state restoration by snapshot ID

**Manual Invocation**:

```bash
# List available snapshots
node .claude/skills/workflow-revert/revert.mjs list

# Dry-run (show what would change)
node .claude/skills/workflow-revert/revert.mjs revert --snapshot-id snap-001 --dry-run

# Revert to snapshot
node .claude/skills/workflow-revert/revert.mjs revert --snapshot-id snap-001 --confirm
```

## Safety Protocols

### Pre-Revert Safety Checks

1. **Checksum Validation**: Verify snapshot integrity before restoration
2. **Pre-Revert Snapshot**: Automatically create safety snapshot for rollback
3. **User Confirmation**: Require explicit confirmation before destructive operations
4. **Dry-Run Mode**: Preview changes without executing
5. **Atomic Operations**: All-or-nothing restoration (no partial state)

### Revert Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. List Snapshots                                       │
│    → Show available snapshots sorted by date            │
│    → Display snapshot metadata and restore info         │
│                                                         │
│ 2. Dry-Run (Optional)                                   │
│    → Show files to restore                              │
│    → Show artifacts to restore                          │
│    → Display warnings                                   │
│                                                         │
│ 3. Create Pre-Revert Snapshot (Safety)                 │
│    → Capture current state                              │
│    → Tag as "pre-revert" type                           │
│    → Store pre-revert snapshot ID                       │
│                                                         │
│ 4. Validate Target Snapshot                            │
│    → Checksum verification                              │
│    → Dependency check                                   │
│    → Restore compatibility check                        │
│                                                         │
│ 5. Restore State (Atomic)                              │
│    → Restore files from snapshot                        │
│    → Restore artifacts                                  │
│    → Restore run state                                  │
│    → Rollback on any failure                            │
│                                                         │
│ 6. Verify Restoration                                  │
│    → Checksum verification                              │
│    → File existence checks                              │
│    → State consistency validation                       │
└─────────────────────────────────────────────────────────┘
```

## Instructions

### Step 1: List Available Snapshots

Use snapshot-manager to list available snapshots:

```javascript
import { listSnapshots } from '../../tools/snapshot-manager.mjs';

// List all snapshots
const snapshots = await listSnapshots();

// Filter by run ID (if applicable)
const runSnapshots = await listSnapshots({ runId: 'run-123' });

// Filter by type
const manualSnapshots = await listSnapshots({ type: 'manual' });
```

**Output Format**:

```javascript
[
  {
    snapshot_id: 'snap-manual-1234567890-abc123',
    type: 'manual',
    created_at: '2025-01-15T10:30:00Z',
    name: 'Before refactoring',
    description: 'Clean state before major refactor',
    size_mb: '2.45',
    compression: 'gzip',
    pinned: false,
    path: '.claude/conductor/context/snapshots/snap-manual-1234567890-abc123.json.gz',
  },
];
```

### Step 2: Dry-Run Mode (Preview Changes)

Preview what will change without executing:

```javascript
import { dryRun } from './revert.mjs';

const preview = await dryRun({ snapshot_id: 'snap-001' });

// Review preview
console.log('Files to restore:', preview.files_to_restore);
console.log('Artifacts to restore:', preview.artifacts_to_restore);
console.log('Warnings:', preview.warnings);
```

**Dry-Run Output**:

```javascript
{
  snapshot_id: 'snap-001',
  preview_mode: true,
  files_to_restore: [
    { path: '.claude/context/artifacts/plan-workflow-001.json', size_bytes: 1024 },
    { path: 'src/components/Button.tsx', size_bytes: 512 }
  ],
  artifacts_to_restore: [
    { path: '.claude/context/artifacts/dev-manifest.json', type: 'manifest' }
  ],
  run_state_to_restore: {
    workflow_name: 'code-quality',
    current_step: 3,
    status: 'running'
  },
  warnings: [
    'Git working tree has uncommitted changes',
    'Current state differs from snapshot by 5 files'
  ],
  estimated_restore_time_ms: 2500,
  destructive_operations: true
}
```

### Step 3: Create Pre-Revert Snapshot (Safety)

Before reverting, create a safety snapshot:

```javascript
import { createPreRevertSnapshot } from './revert.mjs';

const safetySnapshot = await createPreRevertSnapshot({
  targetSnapshotId: 'snap-001',
  reason: 'Safety snapshot before revert to snap-001',
});

console.log('Pre-revert snapshot created:', safetySnapshot.snapshot_id);
```

**Pre-Revert Snapshot Features**:

- Type: `pre-revert` or `recovery`
- High retention priority (50)
- Includes current state capture
- Automatic rollback capability
- Linked to target snapshot ID

### Step 4: Validate Target Snapshot

Validate snapshot integrity before restoration:

```javascript
import { validate } from './revert.mjs';

const validation = await validate({ snapshot_id: 'snap-001' });

if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  throw new Error('Snapshot validation failed - cannot restore');
}
```

**Validation Checks**:

- Checksum verification (SHA-256)
- Snapshot file exists
- Snapshot is restorable (restore_info.restorable === true)
- Dependencies available (if any)
- No corruption detected

### Step 5: Revert to Snapshot

Execute revert with safety checks:

```javascript
import { revert } from './revert.mjs';

// Revert with confirmation
const result = await revert({
  snapshot_id: 'snap-001',
  confirm: true,
  createPreRevertSnapshot: true,
});

console.log('Revert result:', result);
```

**Revert Options**:

```typescript
interface RevertOptions {
  snapshot_id: string; // Target snapshot ID
  confirm: boolean; // User confirmation (required)
  dry_run?: boolean; // Preview mode (default: false)
  createPreRevertSnapshot?: boolean; // Create safety snapshot (default: true)
  force?: boolean; // Skip safety checks (NOT recommended)
}
```

**Revert Result**:

```javascript
{
  status: 'success',
  snapshot_id: 'snap-001',
  pre_revert_snapshot: 'snap-recovery-1234567890-xyz789',
  restored_files: 12,
  restored_artifacts: 5,
  restored_run_state: true,
  restore_time_ms: 2340,
  warnings: []
}
```

### Step 6: Verify Restoration

Verify state after restoration:

```javascript
import { verifyRestoration } from './revert.mjs';

const verification = await verifyRestoration({
  snapshot_id: 'snap-001',
  result: result, // From step 5
});

if (!verification.verified) {
  console.error('Restoration verification failed:', verification.errors);
  // Rollback to pre-revert snapshot
  await revert({
    snapshot_id: result.pre_revert_snapshot,
    confirm: true,
    createPreRevertSnapshot: false, // Don't create another safety snapshot
  });
}
```

## API Reference

### `listSnapshots(options)`

List available snapshots for revert.

**Parameters**:

- `options.runId` (optional): Filter by run ID
- `options.type` (optional): Filter by snapshot type

**Returns**: Array of snapshot metadata

### `dryRun(options)`

Preview changes without executing.

**Parameters**:

- `options.snapshot_id`: Target snapshot ID

**Returns**: Preview object with files, artifacts, warnings

### `validate(options)`

Validate snapshot integrity.

**Parameters**:

- `options.snapshot_id`: Snapshot ID to validate

**Returns**: Validation result object

### `createPreRevertSnapshot(options)`

Create safety snapshot before revert.

**Parameters**:

- `options.targetSnapshotId`: Snapshot being reverted to
- `options.reason`: Description of why snapshot created

**Returns**: Created snapshot metadata

### `revert(options)`

Execute snapshot reversion.

**Parameters**:

- `options.snapshot_id`: Target snapshot ID
- `options.confirm`: User confirmation (required)
- `options.dry_run`: Preview mode (default: false)
- `options.createPreRevertSnapshot`: Create safety snapshot (default: true)
- `options.force`: Skip safety checks (NOT recommended)

**Returns**: Revert result object

### `verifyRestoration(options)`

Verify restoration succeeded.

**Parameters**:

- `options.snapshot_id`: Target snapshot ID
- `options.result`: Revert result from `revert()`

**Returns**: Verification result object

## Error Handling

### Common Errors

**Snapshot Not Found**:

```javascript
{
  error: 'snapshot_not_found',
  message: 'Snapshot snap-001 not found',
  available_snapshots: ['snap-002', 'snap-003']
}
```

**Checksum Mismatch**:

```javascript
{
  error: 'checksum_mismatch',
  message: 'Snapshot integrity check failed - possible corruption',
  snapshot_id: 'snap-001',
  expected_checksum: 'abc123...',
  actual_checksum: 'def456...'
}
```

**Confirmation Required**:

```javascript
{
  error: 'confirmation_required',
  message: 'Revert requires explicit confirmation (set confirm: true)',
  snapshot_id: 'snap-001',
  warnings: ['This operation is destructive']
}
```

**Restore Failed (Rollback)**:

```javascript
{
  error: 'restore_failed',
  message: 'Restore failed, rolling back to pre-revert snapshot',
  snapshot_id: 'snap-001',
  pre_revert_snapshot: 'snap-recovery-123',
  rollback_status: 'success'
}
```

### Recovery from Failed Revert

If revert fails:

1. **Automatic rollback**: Skill automatically reverts to pre-revert snapshot
2. **Manual rollback**: Use pre-revert snapshot ID from error message
3. **Contact support**: If automatic rollback fails, manual intervention required

## Performance Metrics

- **Average revert time**: <10 seconds (target)
- **Revert success rate**: 100% (atomic operations)
- **Checksum validation time**: <500ms
- **Pre-revert snapshot creation**: <3 seconds

## Validation Checklist

Before completing revert:

- [ ] Snapshot integrity validated (checksum verified)
- [ ] Pre-revert snapshot created successfully
- [ ] User confirmation received (if required)
- [ ] Dry-run previewed (if requested)
- [ ] Files restored to snapshot state
- [ ] Artifacts restored to snapshot state
- [ ] Run state restored (if applicable)
- [ ] Restoration verified successfully
- [ ] No errors or warnings

## Related Documentation

- [Snapshot Manager Tool](../../tools/snapshot-manager.mjs) - Snapshot creation and management
- [Snapshot Schema](../../schemas/snapshot.schema.json) - Snapshot data structure
- [Recovery Skill](../recovery/SKILL.md) - Workflow recovery after interruption
- [CUJ-028](../../docs/cujs/CUJ-028.md) - Revert Workflow Changes (hypothetical)

## Examples

### Example 1: Simple Revert

```bash
# List snapshots
node .claude/skills/workflow-revert/revert.mjs list

# Dry-run to preview
node .claude/skills/workflow-revert/revert.mjs revert --snapshot-id snap-manual-123 --dry-run

# Revert with confirmation
node .claude/skills/workflow-revert/revert.mjs revert --snapshot-id snap-manual-123 --confirm
```

### Example 2: Revert After Failed Experiment

```javascript
import { revert } from '.claude/skills/workflow-revert/revert.mjs';

// Experiment failed, revert to last known good state
const result = await revert({
  snapshot_id: 'snap-milestone-before-experiment',
  confirm: true,
  createPreRevertSnapshot: true,
});

console.log(`Reverted successfully. Restored ${result.restored_files} files.`);
console.log(`Safety snapshot created: ${result.pre_revert_snapshot}`);
```

### Example 3: Rollback from Failed Revert

```javascript
import { revert } from '.claude/skills/workflow-revert/revert.mjs';

// Revert failed, rollback to pre-revert snapshot
try {
  await revert({ snapshot_id: 'snap-001', confirm: true });
} catch (error) {
  if (error.rollback_status === 'success') {
    console.log('Revert failed but rollback succeeded - no data lost');
  } else {
    console.error('CRITICAL: Rollback failed - manual intervention required');
  }
}
```

## Agent Integration

### Orchestrator Usage

```javascript
// When user requests revert
if (userMessage.includes('revert') || userMessage.includes('undo')) {
  const snapshots = await listSnapshots();

  // Present options to user
  console.log('Available snapshots:');
  snapshots.forEach(s => {
    console.log(`- ${s.snapshot_id}: ${s.name || s.description} (${s.created_at})`);
  });

  // Get user selection
  const snapshotId = await getUserInput('Select snapshot ID to revert to:');

  // Execute revert
  const result = await revert({
    snapshot_id: snapshotId,
    confirm: true,
  });

  console.log('Revert completed successfully');
}
```

### Developer Usage

```javascript
// Create snapshot before risky operation
const beforeSnapshot = await createSnapshot({
  type: 'manual',
  name: 'Before risky refactor',
  description: 'Clean state before major code changes',
});

try {
  // Risky operation
  await performRiskyRefactor();
} catch (error) {
  // Revert on failure
  console.error('Refactor failed, reverting...');
  await revert({
    snapshot_id: beforeSnapshot.snapshot_id,
    confirm: true,
  });
}
```

## Success Criteria

- ✅ Can list available snapshots via snapshot-manager
- ✅ Can revert to specific snapshot by ID
- ✅ Creates pre-revert snapshot for safety (automatic rollback capability)
- ✅ Requires user confirmation before destructive revert
- ✅ Restores files, artifacts, and run state atomically
- ✅ Validation ensures snapshot integrity (checksum verification)
- ✅ Dry-run mode shows what will change without executing
- ✅ Average revert time <10 seconds
- ✅ 100% revert success rate (all-or-nothing atomicity)
- ✅ Added to skill-integration-matrix.json
