# Task: Enhance Checkpoint Manager for Workflow Execution

**Task ID**: checkpoint-enhancement-2025-01-08
**Priority**: High
**Status**: Ready for Implementation
**Assigned To**: Developer Agent (pending spawn)
**Created**: 2025-01-08

## Context

The `checkpoint-manager.mjs` already exists with basic checkpoint creation and restoration functionality. However, it lacks several critical features required for production use in long-running workflow executions.

## Current State Analysis

**Existing Features** (in `.claude/tools/checkpoint-manager.mjs`):

- ✅ `createCheckpoint(runId, step, stepState)` - Creates checkpoint at step boundary
- ✅ `restoreFromCheckpoint(runId, checkpointId)` - Restores from checkpoint
- ✅ `listCheckpoints(runId)` - Lists all checkpoints for a run
- ✅ Checkpoint registration in artifact registry
- ✅ Recovery instructions included in checkpoint

**Missing Features** (requested in task):

- ❌ Automatic checkpoint pruning (keep only last 5)
- ❌ Checksum validation for checkpoint integrity
- ❌ Integration with workflow_runner.js for automatic checkpointing
- ❌ Resume capability with `--resume` and `--resume-step` flags
- ❌ Cleanup tool for old/failed run checkpoints (7-day retention)

## Required Enhancements

### Enhancement 1: Add Checkpoint Pruning

**File**: `.claude/tools/checkpoint-manager.mjs`

Add a `_pruneOldCheckpoints(runId)` function that:

- Lists all checkpoints for a run
- Sorts by timestamp (newest first)
- Keeps only the last 5 checkpoints
- Deletes older checkpoints from filesystem
- Updates artifact registry to remove deleted checkpoint entries

**Integration**: Call `_pruneOldCheckpoints()` at the end of `createCheckpoint()`

### Enhancement 2: Add Checksum Validation

**File**: `.claude/tools/checkpoint-manager.mjs`

Add checksum functions:

- `_computeChecksum(data)` - Computes SHA256 hash of checkpoint data
- `_validateChecksum(checkpoint)` - Validates checkpoint integrity

**Integration**:

- Compute checksum when creating checkpoint (add to checkpoint object)
- Validate checksum when restoring from checkpoint (throw error if mismatch)

Use Node.js `crypto` module:

```javascript
import crypto from 'crypto';

function _computeChecksum(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
```

### Enhancement 3: Integrate with Workflow Runner

**File**: `.claude/tools/workflow_runner.js` (NOTE: This is a large file - 31k+ tokens)

**Approach**: Read the workflow_runner.js in chunks or use Grep to find the right integration points.

**Integration Points**:

1. Import checkpoint-manager at top of file
2. After each successful step execution, create checkpoint:

   ```javascript
   import { createCheckpoint } from './checkpoint-manager.mjs';

   // After step execution succeeds:
   await createCheckpoint(runId, stepNumber, {
     artifacts: stepOutputs,
     state: workflowState,
     completed_at: new Date().toISOString(),
   });
   ```

### Enhancement 4: Add Resume Capability

**File**: `.claude/tools/workflow_runner.js`

**Command-line Interface**:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-flow.yaml \
  --id workflow-123 \
  --resume \
  --resume-step 3
```

**Implementation**:

1. Add `--resume` (boolean) and `--resume-step` (number) to argument parsing
2. If `--resume` is true:
   - Load latest checkpoint for the run (or specific step if `--resume-step` provided)
   - Restore run state from checkpoint
   - Start workflow execution from `checkpoint.step + 1`
   - Load artifact registry from checkpoint

**Pseudo-code**:

```javascript
if (args.resume) {
  const checkpointId = args['resume-step']
    ? `checkpoint-step-${args['resume-step']}-*` // Find by step
    : null; // Use latest checkpoint

  const restored = await restoreFromCheckpoint(runId, checkpointId);
  startStep = restored.restored_step + 1;
  workflowState = restored.checkpoint.run_record;
  console.log(`Resumed from step ${restored.restored_step}`);
}
```

### Enhancement 5: Create Checkpoint Cleanup Tool

**File**: `.claude/tools/checkpoint-cleanup.mjs` (NEW FILE)

**Purpose**: Clean up checkpoints from old or failed runs

**Functionality**:

- Scan `.claude/context/runs/` for all runs
- For each run:
  - Check run status (from `state.json` or `run.json`)
  - If run status is `failed` AND last updated > 7 days ago:
    - Delete entire run directory (including checkpoints)
    - Log cleanup action
- Generate cleanup report

**Command-line Interface**:

```bash
node .claude/tools/checkpoint-cleanup.mjs [--dry-run] [--max-age-days 7]
```

**Output**: Save report to `.claude/context/reports/checkpoint-cleanup-report.md`

**Example Report**:

```markdown
# Checkpoint Cleanup Report

**Date**: 2025-01-08T10:30:00Z
**Mode**: Live (or Dry Run)
**Max Age**: 7 days

## Summary

- Runs scanned: 42
- Runs cleaned: 5
- Disk space freed: 2.3 MB

## Cleaned Runs

1. run-001 (failed, age: 10 days, size: 450 KB)
2. run-007 (failed, age: 8 days, size: 320 KB)
   ...
```

## Testing Requirements

After implementation, test:

1. **Checkpoint Pruning**:
   - Create 10 checkpoints for a run
   - Verify only last 5 remain after pruning

2. **Checksum Validation**:
   - Create checkpoint
   - Manually corrupt checkpoint JSON file
   - Attempt restore - should fail with integrity error

3. **Workflow Integration**:
   - Run a 5-step workflow
   - Verify checkpoint created after each step
   - Verify only last 5 checkpoints exist

4. **Resume Capability**:
   - Start workflow, stop at step 3
   - Resume with `--resume --resume-step 3`
   - Verify workflow continues from step 4

5. **Cleanup Tool**:
   - Create test runs with failed status and old timestamps
   - Run cleanup with `--dry-run` - verify no deletion
   - Run cleanup without `--dry-run` - verify deletion

## Acceptance Criteria

- [ ] Checkpoint pruning implemented and tested (keeps last 5)
- [ ] Checksum validation implemented and tested
- [ ] Workflow runner integration complete (auto-checkpoint after each step)
- [ ] Resume capability working with `--resume` and `--resume-step` flags
- [ ] Checkpoint cleanup tool created and tested
- [ ] All changes follow file location rules (no root directory violations)
- [ ] Implementation report saved to `.claude/context/reports/checkpoint-implementation-report.md`
- [ ] No violations of subagent file rules

## File Locations (CRITICAL - Prevent SLOP)

**Allowed Locations**:

- ✅ `.claude/tools/checkpoint-manager.mjs` (modify existing)
- ✅ `.claude/tools/workflow_runner.js` (modify existing)
- ✅ `.claude/tools/checkpoint-cleanup.mjs` (create new)
- ✅ `.claude/context/reports/checkpoint-implementation-report.md` (report)
- ✅ `.claude/context/reports/checkpoint-cleanup-report.md` (generated by cleanup tool)

**PROHIBITED Locations**:

- ❌ Project root (/)
- ❌ Any malformed Windows paths (C:devprojects, etc.)

## References

- Checkpoint Manager (existing): `.claude/tools/checkpoint-manager.mjs`
- Workflow Runner: `.claude/tools/workflow_runner.js` (31k+ tokens - read in chunks)
- Run State Schema: `.claude/schemas/run-state.schema.json`
- Run Manager: `.claude/tools/run-manager.mjs`
- File Location Rules: `.claude/rules/subagent-file-rules.md`

## Implementation Notes for Developer

1. **Read workflow_runner.js carefully** - It's a large file. Use Grep or Read with offset/limit.
2. **Follow existing patterns** - checkpoint-manager.mjs has good structure. Extend it, don't rewrite.
3. **Test incrementally** - Test each enhancement before moving to the next.
4. **Document changes** - Update comments in code. Generate implementation report.
5. **Validate paths** - Use path.join(), never string concatenation. Check for malformed Windows paths.

## Estimated Effort

- **Enhancement 1** (Pruning): 30 minutes
- **Enhancement 2** (Checksum): 30 minutes
- **Enhancement 3** (Workflow Integration): 1 hour (large file, need to find integration points)
- **Enhancement 4** (Resume): 1 hour (argument parsing + state restoration logic)
- **Enhancement 5** (Cleanup Tool): 1 hour (new file, filesystem scanning, report generation)

**Total**: ~4 hours

## Success Metrics

- All 5 test cases pass
- No file location violations detected
- Implementation report generated with all required sections
- Code follows existing patterns in codebase
- Checkpoints enable reliable workflow recovery

---

**Task Status**: Ready for Developer Agent Assignment
**Next Step**: Spawn developer agent with this task brief
