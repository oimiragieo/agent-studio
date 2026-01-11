# Error Recovery Implementation Task

## Objective

Add error recovery configuration to all 14 workflow YAML files and create CUJ-058 for error recovery validation.

## Requirements

### 1. Add to ALL Workflow Files (.claude/workflows/\*.yaml)

Add this recovery configuration block **at the top of each workflow file** (after name/description, before steps):

```yaml
recovery:
  enabled: true
  checkpoint_dir: '.claude/context/runs/{{run_id}}/checkpoints'

retry_config:
  max_attempts: 3
  backoff_strategy: exponential
  initial_delay_ms: 1000
  retryable_errors: [timeout, network_error, rate_limit]

fallback_agents:
  developer: [code-reviewer, qa]
  architect: [developer, security-architect]
  qa: [developer, code-reviewer]
  planner: [architect, pm]
```

**Workflow files to update (14 total):**

- ai-system-flow.yaml
- automated-enterprise-flow.yaml
- bmad-greenfield-standard.yaml
- brownfield-fullstack.yaml
- browser-testing-flow.yaml
- code-quality-flow.yaml
- enterprise-track.yaml
- greenfield-fullstack.yaml
- incident-flow.yaml
- legacy-modernization-flow.yaml
- mobile-flow.yaml
- performance-flow.yaml
- quick-flow.yaml
- ui-perfection-loop.yaml

### 2. Create CUJ-058.md

Create `.claude/docs/cujs/CUJ-058.md` with the following content:

```markdown
# CUJ-058: Error Recovery Validation

## Overview

Tests the error recovery system for workflow-based CUJs, validating checkpoint creation, fallback agent activation, and workflow resume capabilities.

## Execution Mode

workflow

## Workflow

error-recovery-test.yaml

## Trigger

User request: "Test error recovery system" or "Validate recovery workflow"

## Steps

### Step 0: Planning Phase

- **Agent**: Planner
- **Input**: Error recovery test requirements
- **Output**: Test plan with failure scenarios

### Step 0.1: Plan Rating Gate

- **Agent**: orchestrator
- **Type**: validation
- **Skill**: response-rater
- **Minimum Score**: 7/10

### Step 1: Setup Test Environment

- **Agent**: Developer
- **Actions**: Create test workflow with intentional failure points

### Step 2: Trigger Controlled Failure

- **Agent**: QA
- **Actions**: Execute workflow until failure point triggers

### Step 3: Verify Recovery Checkpoint

- **Agent**: QA
- **Validation**: Checkpoint file exists in checkpoint_dir

### Step 4: Verify Fallback Agent Activation

- **Agent**: QA
- **Validation**: Fallback agent from matrix was activated

### Step 5: Verify Workflow Resume

- **Agent**: QA
- **Validation**: Workflow resumed from checkpoint successfully

### Step 6: Final Validation

- **Agent**: QA
- **Validation**: All recovery mechanisms functioning

## Success Criteria

- [ ] Recovery checkpoint created on failure
- [ ] Checkpoint contains correct state data
- [ ] Fallback agent activated per fallback_agents matrix
- [ ] Workflow resumed from checkpoint without data loss
- [ ] Error logs captured with full context
- [ ] Retry logic executed with exponential backoff
- [ ] Plan rating >= 7/10

## Skills Used

- recovery - Workflow recovery and state reconstruction
- response-rater - Plan quality validation

## Related CUJs

- CUJ-027: Workflow Recovery After Context Loss
- CUJ-037: Multi-Phase Project Execution
```

## Implementation Steps

1. For each of the 14 workflow files:
   - Read the file
   - Add recovery configuration after description, before steps
   - Ensure proper YAML indentation
   - Save the file

2. Create CUJ-058.md in `.claude/docs/cujs/` directory

3. Create a dev-manifest.json listing all files modified/created

## Success Criteria

- All 14 workflow files updated with recovery config
- CUJ-058.md created with complete content
- All YAML files remain valid
- dev-manifest.json created

## Files to Modify

- 14 workflow YAML files in `.claude/workflows/`
- 1 new CUJ markdown file: `.claude/docs/cujs/CUJ-058.md`
