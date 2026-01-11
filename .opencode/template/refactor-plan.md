# Refactoring Plan: {{component_name}}

## Overview

{{overview}}

## Current State

### Code Metrics

| Metric                | Current                 | Target |
| --------------------- | ----------------------- | ------ |
| Cyclomatic Complexity | {{current_complexity}}  | < 10   |
| Lines per Function    | {{current_lines}}       | < 50   |
| Test Coverage         | {{current_coverage}}    | > 80%  |
| Duplication           | {{current_duplication}} | < 5%   |

### Code Smells Identified

{{code_smells}}

### Technical Debt Assessment

{{technical_debt}}

## Goals

1. {{goal_1}}
2. {{goal_2}}
3. {{goal_3}}

## Refactoring Strategy

### Phase 1: Safety Net

- [ ] Add characterization tests
- [ ] Ensure CI/CD passes
- [ ] Create baseline metrics

### Phase 2: Incremental Changes

#### Step 1: {{step_1_name}}

- **Technique**: {{technique_1}}
- **Affected Files**: {{files_1}}
- **Risk Level**: {{risk_1}}
- **Estimated Time**: {{time_1}}

#### Step 2: {{step_2_name}}

- **Technique**: {{technique_2}}
- **Affected Files**: {{files_2}}
- **Risk Level**: {{risk_2}}
- **Estimated Time**: {{time_2}}

### Phase 3: Verification

- [ ] Run all tests
- [ ] Compare metrics
- [ ] Verify behavior unchanged

## Refactoring Techniques to Apply

### Extract Method

{{extract_method_targets}}

### Replace Conditional with Polymorphism

{{polymorphism_targets}}

### Introduce Parameter Object

{{parameter_object_targets}}

### Extract Class

{{extract_class_targets}}

## Risk Assessment

| Risk       | Probability | Impact       | Mitigation       |
| ---------- | ----------- | ------------ | ---------------- |
| {{risk_1}} | {{prob_1}}  | {{impact_1}} | {{mitigation_1}} |
| {{risk_2}} | {{prob_2}}  | {{impact_2}} | {{mitigation_2}} |

## Dependencies

### Internal Dependencies

{{internal_deps}}

### External Dependencies

{{external_deps}}

### Breaking Changes

{{breaking_changes}}

## Timeline

| Phase        | Start              | End              | Status              |
| ------------ | ------------------ | ---------------- | ------------------- |
| Safety Net   | {{safety_start}}   | {{safety_end}}   | {{safety_status}}   |
| Refactoring  | {{refactor_start}} | {{refactor_end}} | {{refactor_status}} |
| Verification | {{verify_start}}   | {{verify_end}}   | {{verify_status}}   |

## Rollback Plan

{{rollback_plan}}

## Success Criteria

- [ ] All tests pass
- [ ] Complexity reduced by {{complexity_reduction}}%
- [ ] Duplication reduced by {{duplication_reduction}}%
- [ ] Coverage increased to {{coverage_target}}%
- [ ] No functional changes
- [ ] Performance unchanged or improved

## Before/After Comparison

### Before

```{{language}}
{{before_code}}
```

### After

```{{language}}
{{after_code}}
```

---

_Refactoring plan created on {{date}}._
