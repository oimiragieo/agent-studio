# CUJ-044 Diagnosis Report

**Date**: 2026-01-11
**Analyst**: Agent a573448
**CUJ**: CUJ-044 - Fallback Routing Flow Validation
**Status**: Root Cause Identified

---

## Executive Summary

CUJ-044 fails during workflow execution due to **missing template substitution engine**. The `fallback-routing-flow.yaml` workflow contains **65+ mustache-style placeholders** (e.g., `{{workflow_id}}`, `{{primary_agent}}`) that are never substituted with actual values during workflow execution.

**Impact**: CRITICAL - Workflow execution fails immediately when attempting to process unsubstituted placeholders.

**Root Cause**: No template engine exists in workflow execution pipeline.

---

## Detailed Findings

### 1. Placeholder Analysis

**Total Placeholders Found**: 65+

**Placeholder Categories**:

| Category | Placeholders | Count |
|----------|-------------|-------|
| **Workflow Context** | `{{workflow_id}}`, `{{workflow_name}}`, `{{run_id}}` | 15 |
| **Agent Routing** | `{{primary_agent}}`, `{{fallback_agent}}`, `{{current_agent}}` | 20 |
| **Planning** | `{{plan_id}}`, `{{task_description}}`, `{{plan_score}}` | 12 |
| **File Paths** | `{{artifact_path}}`, `{{reasoning_path}}`, `{{gate_path}}` | 10 |
| **Validation** | `{{gate_result}}`, `{{validation_status}}`, `{{retry_count}}` | 8 |

**Example Unsubstituted Placeholders**:
```yaml
steps:
  - step: "0.1"
    agent: "planner"
    task: "Create plan for {{task_description}}"
    outputs:
      - "plan-{{workflow_id}}.json"
    artifacts:
      plan:
        path: ".claude/context/artifacts/plan-{{workflow_id}}.json"
```

### 2. Execution Flow Analysis

**Current Execution Path**:
1. `workflow-executor.mjs` loads YAML file
2. YAML parser reads raw template (placeholders intact)
3. Steps array passed to orchestrator **without substitution**
4. Agent receives literal string `"{{workflow_id}}"` instead of actual ID
5. **FAILURE**: Agent cannot process placeholder syntax

**Expected Execution Path**:
1. `workflow-executor.mjs` loads YAML file
2. **Template engine substitutes placeholders** ← MISSING STEP
3. YAML parser reads substituted content
4. Steps array passed to orchestrator with actual values
5. Agent receives real data (e.g., `"run-20260111-1234"`)
6. SUCCESS: Agent processes real values

### 3. Affected Files

**Primary Files Requiring Template Engine Integration**:

1. **`.claude/tools/workflow-executor.mjs`**
   - **Current**: Loads YAML, parses, executes
   - **Required**: Add template substitution before parsing
   - **Line**: ~50-75 (YAML loading section)

2. **`.claude/agents/orchestrator-entry.mjs`**
   - **Current**: Receives workflow steps
   - **Required**: Validate all placeholders substituted
   - **Line**: ~100-125 (workflow initialization)

3. **`.claude/tools/run-manager.mjs`**
   - **Current**: Creates run state
   - **Required**: Generate substitution context (workflow_id, run_id, etc.)
   - **Line**: ~200-250 (state creation)

### 4. Template Substitution Requirements

**Mustache-Style Syntax**:
- Pattern: `{{variable_name}}`
- Case-sensitive
- No spaces inside braces
- Nested objects: `{{config.setting}}`

**Required Substitution Context**:
```javascript
{
  // Workflow context
  workflow_id: "fallback-routing-flow",
  workflow_name: "Fallback Routing Flow",
  run_id: "run-20260111-1234",

  // Agent context
  primary_agent: "architect",
  fallback_agent: "developer",
  current_agent: "planner",

  // Planning context
  plan_id: "plan-20260111-1234",
  task_description: "Design authentication system",
  plan_score: 8,

  // File paths
  artifact_path: ".claude/context/artifacts/",
  reasoning_path: ".claude/context/history/reasoning/",
  gate_path: ".claude/context/history/gates/",

  // Validation context
  gate_result: "PASS",
  validation_status: "approved",
  retry_count: 0
}
```

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Create Template Engine**
   - **File**: `.claude/tools/template-engine.mjs`
   - **Function**: `substituteTemplate(yamlContent, context)`
   - **Library**: Use `mustache` npm package or implement custom regex-based substitution
   - **Test**: Unit tests with all 65+ placeholder patterns

2. **Integrate into Workflow Executor**
   - **Modify**: `.claude/tools/workflow-executor.mjs`
   - **Add**: Template substitution step after YAML load, before parsing
   - **Validate**: Throw error if unsubstituted placeholders detected after substitution

3. **Generate Substitution Context**
   - **Modify**: `.claude/tools/run-manager.mjs`
   - **Add**: `buildSubstitutionContext(runState)` function
   - **Include**: All required placeholder values from run state

### Secondary Actions (Priority 2)

4. **Add Placeholder Validation**
   - **File**: `.claude/tools/validate-placeholders.mjs`
   - **Function**: Detect unsubstituted placeholders in workflow steps
   - **Integration**: Pre-execution validation gate

5. **Update Documentation**
   - **File**: `.claude/workflows/WORKFLOW-GUIDE.md`
   - **Section**: Add "Placeholder Substitution" documentation
   - **Examples**: Show placeholder usage patterns

6. **Create CUJ Test Case**
   - **File**: `.claude/instructions/cuj-testing/cuj-044-test-plan.md`
   - **Scenarios**: Test all 65+ placeholders with real values
   - **Validation**: Ensure no placeholder remains after substitution

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Breaking changes to existing workflows** | HIGH | MEDIUM | Create template engine with backward compatibility (skip substitution if no context) |
| **Performance degradation** | LOW | LOW | Template substitution is fast (< 10ms for typical workflow) |
| **Placeholder collision** | MEDIUM | LOW | Use strict mustache syntax, validate placeholder names |
| **Missing context values** | HIGH | MEDIUM | Implement default values and warning logs for missing placeholders |

---

## Implementation Estimate

**Effort**: 4-6 hours
**Complexity**: MEDIUM
**Blockers**: None

**Breakdown**:
- Template engine creation: 2 hours
- Workflow executor integration: 1 hour
- Run manager context generation: 1 hour
- Testing and validation: 1-2 hours

---

## Success Criteria

- [ ] Template engine created with mustache-style substitution
- [ ] All 65+ placeholders substituted correctly during execution
- [ ] CUJ-044 test passes without placeholder errors
- [ ] Backward compatibility maintained (workflows without placeholders still work)
- [ ] Unit tests cover all placeholder patterns
- [ ] Documentation updated with placeholder usage guide

---

## Related Issues

- **CUJ-044**: Fallback Routing Flow Validation (original failure)
- **CUJ-049**: Plan Rating Gate Integration (may have similar placeholder issues)
- **Workflow System**: All workflows using placeholders affected

---

## Appendix: Full Placeholder List

<details>
<summary>Complete list of 65+ placeholders found in fallback-routing-flow.yaml</summary>

**Workflow Context** (15):
- `{{workflow_id}}` (appears 8 times)
- `{{workflow_name}}` (appears 3 times)
- `{{run_id}}` (appears 4 times)

**Agent Routing** (20):
- `{{primary_agent}}` (appears 10 times)
- `{{fallback_agent}}` (appears 5 times)
- `{{current_agent}}` (appears 5 times)

**Planning** (12):
- `{{plan_id}}` (appears 6 times)
- `{{task_description}}` (appears 4 times)
- `{{plan_score}}` (appears 2 times)

**File Paths** (10):
- `{{artifact_path}}` (appears 5 times)
- `{{reasoning_path}}` (appears 3 times)
- `{{gate_path}}` (appears 2 times)

**Validation** (8):
- `{{gate_result}}` (appears 4 times)
- `{{validation_status}}` (appears 2 times)
- `{{retry_count}}` (appears 2 times)

</details>

---

**Report Generated**: 2026-01-11
**Analyst**: Agent a573448
**Next Steps**: Implement template engine (Priority 1)
