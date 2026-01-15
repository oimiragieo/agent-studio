---
name: recovery
description: Workflow recovery protocol for resuming workflows after context loss, session interruption, or errors. Handles state reconstruction, artifact recovery, and seamless workflow continuation.
version: 1.0.0
allowed-tools: read, grep, glob, search
---

# Recovery Skill

Workflow recovery protocol for resuming workflows after context loss, session interruption, or errors.

## When to Use

- Context window exhausted mid-workflow
- Session interrupted or lost
- Need to resume from last completed step
- Workflow state needs reconstruction

## Instructions

### Step 1: Identify Last Completed Step

1. **Check gate files** for last successful validation:
   - Location: `.claude/context/history/gates/{workflow_id}/`
   - Find highest step number with validation_status: "pass"
   - This is the last successfully completed step

2. **Review reasoning files** for progress:
   - Location: `.claude/context/history/reasoning/{workflow_id}/`
   - Read reasoning files up to last completed step
   - Extract context and decisions made

3. **Identify artifacts created**:
   - Check artifact registry: `.claude/context/artifacts/registry-{workflow_id}.json`
   - List all artifacts created up to last step
   - Verify artifact files exist

### Step 2: Load Plan Documents

1. **Read plan document** (stateless):
   - Load `plan-{workflow_id}.json` from artifact registry
   - Extract current workflow state
   - Identify completed vs pending tasks

2. **Load relevant phase plan** (if multi-phase):
   - Check if project is multi-phase (exceeds phase_size_max_lines threshold)
   - Load active phase plan: `plan-{workflow_id}-phase-{n}.json`
   - Understand phase boundaries and dependencies

3. **Understand current state**:
   - Map completed tasks to plan
   - Identify next steps
   - Check for dependencies

### Step 3: Context Recovery

1. **Load artifacts from last completed step**:
   - Read artifact registry
   - Load all artifacts with validation_status: "pass"
   - Verify artifact integrity

2. **Read reasoning files for context**:
   - Load reasoning files from completed steps
   - Extract key decisions and context
   - Understand workflow progression

3. **Reconstruct workflow state**:
   - Combine plan, artifacts, and reasoning
   - Create recovery state document
   - Validate state consistency

### Step 4: Resume Execution

1. **Continue from next step**:
   - Identify next step after last completed
   - Load step requirements from plan
   - Prepare inputs for next step

2. **Planner updates plan status** (stateless):
   - Update plan-{workflow_id}.json with current status
   - Mark completed steps
   - Update progress tracking

3. **Orchestrator coordinates next agents**:
   - Pass recovered artifacts to next step
   - Resume workflow execution
   - Monitor for additional interruptions

## Recovery Validation Checklist

- [ ] Last completed step identified correctly
- [ ] Plan document loaded and validated
- [ ] All artifacts from completed steps available
- [ ] Reasoning files reviewed for context
- [ ] Workflow state reconstructed accurately
- [ ] No duplicate work will be performed
- [ ] Next step inputs prepared
- [ ] Recovery logged in reasoning file

## Error Handling

- **Missing plan document**: Request planner to recreate plan from requirements
- **Missing artifacts**: Request artifact recreation from source agent
- **Corrupted artifacts**: Request artifact recreation with validation
- **Incomplete reasoning**: Use artifact registry and gate files to reconstruct state

## Related Documentation

- [Planner Agent](../../agents/planner.md) - Stateless Behavior Rule
- [Orchestrator Agent](../../agents/orchestrator.md) - Context Recovery
- [CUJ-027](../../docs/cujs/CUJ-027.md) - Workflow Recovery After Context Loss
