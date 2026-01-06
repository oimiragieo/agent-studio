# Task: Implement Error Recovery Steps in All Workflow YAML Files

## Objective
Add comprehensive error recovery capabilities to all 14 workflow YAML files in `.claude/workflows/`.

## Requirements

### 1. Recovery Configuration (Add to top of each workflow)
```yaml
recovery:
  enabled: true
  checkpoint_dir: ".claude/context/runs/{{run_id}}/checkpoints"

retry_config:
  max_attempts: 3
  backoff_strategy: exponential
  initial_delay_ms: 1000
  retryable_errors: [timeout, network_error, rate_limit]

fallback_agents:
  developer: [code-reviewer, qa]
  architect: [developer, security-architect]
  qa: [developer, code-reviewer]
```

### 2. Recovery Steps (Add after major phases in each workflow)
```yaml
  - step: recovery
    name: "Error Recovery Checkpoint"
    agent: orchestrator
    skill: recovery
    condition: "previous_step.status == 'failed'"
    inputs:
      - previous-step-outputs
      - error-logs
    actions:
      - save_checkpoint
      - notify_orchestrator
      - attempt_fallback
```

### 3. Create CUJ-058.md
Location: `.claude/docs/cujs/CUJ-058.md`

Content:
```markdown
# CUJ-058: Error Recovery Validation

## Overview
Tests the error recovery system for workflow CUJs.

## Execution Mode
workflow

## Steps
- Step 0: Planning Phase (Planner)
- Step 0.1: Plan Rating Gate (response-rater)
- Step 1: Trigger intentional failure
- Step 2: Verify recovery checkpoint created
- Step 3: Verify fallback agent activated
- Step 4: Verify workflow resumes from checkpoint

## Success Criteria
- [ ] Recovery checkpoint created on failure
- [ ] Fallback agent activated correctly
- [ ] Workflow resumed from checkpoint
- [ ] Error logs captured
```

## Workflow Files to Update (14 total)
1. ai-system-flow.yaml
2. automated-enterprise-flow.yaml
3. bmad-greenfield-standard.yaml
4. brownfield-fullstack.yaml
5. browser-testing-flow.yaml
6. code-quality-flow.yaml
7. enterprise-track.yaml
8. greenfield-fullstack.yaml
9. incident-flow.yaml
10. legacy-modernization-flow.yaml
11. mobile-flow.yaml
12. performance-flow.yaml
13. quick-flow.yaml
14. ui-perfection-loop.yaml

## Implementation Notes
- Add recovery configuration at the top of each YAML file (after `trigger_keywords` or `project_type`)
- Insert recovery steps after major phases (typically after steps 3, 6, 9, etc.)
- Ensure conditional logic for recovery steps: `condition: "previous_step.status == 'failed'"`
- Maintain YAML indentation consistency (2 spaces)
- Create CUJ-058.md in `.claude/docs/cujs/`

## Validation
After implementation:
- Verify all 14 workflows have recovery configuration
- Verify recovery steps added at appropriate locations
- Verify CUJ-058.md created
- Run YAML lint check if available
