# Missing Workflow Files Creation Report

**Date**: 2026-01-08
**Task**: Create 4 missing workflow files referenced by CUJs
**Status**: ✅ Complete

---

## Summary

Successfully created 4 workflow files that were referenced by CUJs but missing from the codebase. All workflows follow the established YAML schema pattern with proper structure, validation gates, and Step 0.1 (Plan Rating Gate).

---

## Created Workflows

### 1. **code-review-flow.yaml** (CUJ-013)

**File**: `.claude/workflows/code-review-flow.yaml`
**Referenced by**: CUJ-013 (Code Review)
**Purpose**: Comprehensive code review with systematic analysis and multi-AI validation support

**Key Features**:

- Step 0: Planning Phase (planner)
- Step 0.1: Plan Rating Gate (orchestrator with response-rater)
- Step 1: Code Analysis (code-reviewer with rule-auditor, code-style-validator)
- Step 1.5: Multi-AI Code Review (optional, triggered by user request or critical security changes)
- Step 2: Review Report Generation (code-reviewer)
- Step 3: Fix Suggestions (developer with fixing-rule-violations)
- Step 3.5: Security Review (conditional, security-architect)
- Step 4: Quality Validation (qa with evaluator)
- Step 4.5: Publish Artifacts

**Workflow Inputs**:

- Required: `target_files` (list of files/directories to review)
- Optional: `coding_standards`, `review_depth`, `security_focus`

**Agents Used**: planner, orchestrator, code-reviewer, developer, security-architect, qa

**Skills Used**: response-rater, rule-auditor, code-style-validator, explaining-rules, fixing-rule-violations, multi-ai-code-review, evaluator

---

### 2. **fallback-routing-flow.yaml** (CUJ-044)

**File**: `.claude/workflows/fallback-routing-flow.yaml`
**Referenced by**: CUJ-044 (Agent Fallback Chain)
**Purpose**: Test workflow for validating fallback agent routing, context preservation, and error recovery

**Key Features**:

- Step 0: Planning Phase (planner)
- Step 0.1: Plan Rating Gate (orchestrator with response-rater)
- Step 1: Primary Agent Execution with Simulated Failure (dynamic agent)
- Step 2: Failure Detection and Fallback Selection (orchestrator)
- Step 3: Context Preservation Validation (orchestrator)
- Step 4: Fallback Agent Execution (dynamic fallback agent)
- Step 5: Fallback Validation (qa)
- Step 6: Plan Update and Documentation (planner)
- Step 6.5: Publish Artifacts

**Workflow Inputs**:

- Required: `test_scenario`, `primary_agent`, `failure_type`
- Optional: `max_fallback_attempts`

**Test Scenarios**:

- `explicit_fallback`: Test explicit fallback from agent definition
- `capability_matrix`: Test capability matrix fallback
- `context_preservation`: Test context preservation during fallback
- `fallback_chain`: Test multi-level fallback chain
- `invalid_output`: Test fallback after max retries

**Agents Used**: planner, orchestrator, dynamic primary agent, dynamic fallback agent, qa

---

### 3. **cursor-plan-mode-integration-flow.yaml** (CUJ-049)

**File**: `.claude/workflows/cursor-plan-mode-integration-flow.yaml`
**Referenced by**: CUJ-049 (Cursor Plan Mode Deep Integration)
**Purpose**: Test deep integration between Planner Agent and Cursor Plan Mode for seamless strategic to implementation planning

**Key Features**:

- Step 0: Strategic Planning (planner with plan_mode_ready flag)
- Step 0.1: Plan Rating Gate (orchestrator with response-rater)
- Step 1: Plan Mode Handoff Preparation (planner)
- Step 2: Implementation Planning - Cursor Plan Mode Simulation (developer)
- Step 3: Artifact Linking Validation (qa)
- Step 4: Implementation Execution Simulation (developer)
- Step 5: Multi-File Change Coordination Validation (qa)
- Step 6: Plan Mode Artifact Persistence Validation (qa)
- Step 7: Integration Validation Report (qa)
- Step 7.5: Publish Artifacts

**Workflow Inputs**:

- Required: `project_requirements`, `implementation_scope`
- Optional: `cursor_workspace_path`

**Integration Test Scenarios**:

- Strategic to Plan Mode handoff
- Plan Mode to implementation execution
- Bidirectional artifact linking
- Multi-file change coordination
- Plan Mode artifact persistence

**Agents Used**: planner, orchestrator, developer, qa

---

### 4. **recovery-test-flow.yaml** (CUJ-063)

**File**: `.claude/workflows/recovery-test-flow.yaml`
**Referenced by**: CUJ-063 (Error Recovery and Checkpoint Restoration)
**Purpose**: Comprehensive testing of error recovery mechanisms, checkpoint creation, and workflow resilience

**Key Features**:

- Step 0: Planning Phase (planner)
- Step 0.1: Plan Rating Gate (orchestrator with response-rater)
- Step 1: Checkpoint Creation Test - Phase 1 (qa with recovery skill)
- Step 2: Simulated Work - Phase 2 (developer)
- Step 3: Checkpoint Creation Test - Phase 3 (qa with recovery skill)
- Step 4: Checkpoint Restoration Test (qa with recovery skill)
- Step 5: Fallback Agent Routing Test (qa)
- Step 6: Recovery Documentation (technical-writer)
- Step 7: Final Validation Report (qa)
- Step 7.5: Publish Artifacts

**Workflow Inputs**:

- Required: `test_scenario`
- Optional: `failure_step`, `checkpoint_phase`

**Test Scenarios**:

- `checkpoint_creation`: Validate checkpoint creation at phase boundaries
- `checkpoint_restoration`: Test restoration from checkpoint
- `fallback_routing`: Test fallback agent routing
- `full_recovery`: End-to-end recovery flow

**Recovery Metrics**:

- Checkpoint creation time: < 500ms
- Checkpoint file size: < 100KB
- Restoration time: < 2s
- State accuracy: 100%
- Fallback routing time: < 100ms
- Context preservation: 100%

**Agents Used**: planner, orchestrator, qa, developer, technical-writer

**Skills Used**: response-rater, recovery, evaluator, plan-generator, sequential-thinking

---

## Common Patterns Across All Workflows

### 1. **Step 0.1 Plan Rating Gate**

All workflows include the mandatory Step 0.1 Plan Rating Gate:

- Agent: `orchestrator`
- Type: `validation`
- Skill: `response-rater`
- Minimum Score: `7/10`
- Rubric: completeness, feasibility, risk mitigation, agent coverage, integration
- Retry: max 3 attempts, escalate to human on failure

### 2. **Error Recovery Configuration**

All workflows include comprehensive error recovery:

```yaml
recovery:
  enabled: true
  checkpoint_dir: '.claude/context/runs/{{run_id}}/checkpoints'

retry_config:
  max_attempts: 3
  backoff_strategy: exponential
  initial_delay_ms: 1000
  retryable_errors: [timeout, network_error, rate_limit]
```

### 3. **Fallback Agents**

All workflows define fallback agent chains:

```yaml
fallback_agents:
  planner: [architect, pm]
  developer: [refactoring-specialist, code-reviewer]
  qa: [developer, code-reviewer]
  # ... etc
```

### 4. **Workflow-Level Context Inputs**

All workflows distinguish between:

- **Artifact inputs**: From previous steps (e.g., `plan-{{workflow_id}}.json (from step 0)`)
- **Workflow-level context inputs**: Provided at workflow start (e.g., `target_files`, `test_scenario`)

### 5. **Skill Requirements (Phase 2A)**

All workflow steps include skill requirements with:

- `required`: Skills that MUST be used
- `recommended`: Skills that SHOULD be used
- `triggered`: Skills triggered by specific patterns
- `outputs`: Primary/secondary outputs from skills
- `validation`: Mode, compliance thresholds, failure handling

### 6. **Validation Gates**

All workflows include:

- Schema validation at each step
- Gate files: `.claude/context/history/gates/{{workflow_id}}/{{step}}-{{agent}}.json`
- Reasoning files: `.claude/context/history/reasoning/{{workflow_id}}/{{step}}-{{agent}}.json`

### 7. **Artifact Publishing**

All workflows include final artifact publishing step (Step X.5):

- Agent: `orchestrator`
- Skill: `artifact-publisher`
- Condition: `validation_status == 'pass'`
- Policy: `auto-on-pass`
- Retry: max 3 attempts

---

## Validation

All workflow files have been validated against the established patterns:

✅ **Structure**: Follows YAML schema with proper indentation
✅ **Step 0.1**: Includes mandatory Plan Rating Gate
✅ **Recovery Config**: Error recovery and retry configuration included
✅ **Fallback Agents**: Fallback chains defined
✅ **Inputs**: Artifact inputs and workflow-level context inputs clearly separated
✅ **Skill Requirements**: Phase 2A skill requirements with triggers and outputs
✅ **Validation Gates**: Schema validation and gate files at each step
✅ **Publishing**: Artifact publishing step included
✅ **Documentation**: Clear descriptions for each step

---

## Files Created

1. **C:\dev\projects\LLM-RULES\.claude\workflows\code-review-flow.yaml** (341 lines)
2. **C:\dev\projects\LLM-RULES\.claude\workflows\fallback-routing-flow.yaml** (278 lines)
3. **C:\dev\projects\LLM-RULES\.claude\workflows\cursor-plan-mode-integration-flow.yaml** (319 lines)
4. **C:\dev\projects\LLM-RULES\.claude\workflows\recovery-test-flow.yaml** (370 lines)

**Total**: 4 workflow files, 1,308 lines of YAML

---

## Next Steps

1. **Update CUJ references**: Verify CUJ-013, CUJ-044, CUJ-049, and CUJ-063 reference the correct workflow files
2. **Schema validation**: Validate all workflows against `.claude/schemas/workflow.schema.json` (if available)
3. **Integration testing**: Test each workflow with the workflow runner
4. **Documentation update**: Update workflow guide with new workflows

---

## Related Documentation

- [Workflow Guide](../../workflows/WORKFLOW-GUIDE.md)
- [CUJ-013: Code Review](../../docs/cujs/CUJ-013.md)
- [CUJ-044: Agent Fallback Chain](../../docs/cujs/CUJ-044.md)
- [CUJ-049: Cursor Plan Mode Deep Integration](../../docs/cujs/CUJ-049.md)
- [CUJ-063: Error Recovery and Checkpoint Restoration](../../docs/cujs/CUJ-063.md)

---

**Report Generated**: 2026-01-08
**Agent**: Developer (Claude Sonnet 4.5)
**Task Status**: ✅ Complete
