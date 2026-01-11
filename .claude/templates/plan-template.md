<template_structure>

# Plan: [Plan Name]

## Metadata

- **Plan ID**: `plan-<timestamp>`
- **Created**: [ISO timestamp]
- **Status**: `draft|validated|in_execution|completed|cancelled`
- **Owner**: [Agent/User responsible]
- **Workflow**: [Associated workflow name]

## Objectives

[Clear, measurable objectives that this plan aims to achieve]

- [Objective 1]: [How to measure success]
- [Objective 2]: [How to measure success]
- [Objective 3]: [How to measure success]

## Context

### Background

[Background information and requirements that led to this plan]

### Requirements

- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

### Constraints

- [Constraint 1]
- [Constraint 2]
- [Constraint 3]

### Assumptions

- [Assumption 1]
- [Assumption 2]
- [Assumption 3]

## Steps

### Step 1: [Step Name]

- **Agent**: [assigned agent name]
- **Dependencies**: [prerequisites - list step numbers or "none"]
- **Tasks**:
  - [Task 1]
  - [Task 2]
  - [Task 3]
- **Success Criteria**:
  - [Criterion 1]: [How to measure]
  - [Criterion 2]: [How to measure]
- **Risks**:
  - [Risk 1]: [Description]
  - [Risk 2]: [Description]
- **Mitigation**:
  - [Mitigation 1]: [Strategy]
  - [Mitigation 2]: [Strategy]
- **Estimated Effort**: [time estimate]
- **Status**: `pending|in_progress|completed|blocked`

### Step 2: [Step Name]

[Same structure as Step 1]

### Step 3: [Step Name]

[Same structure as Step 1]

[Continue for all steps - keep ≤7 steps per plan section]

## Dependencies Graph

```
Step 1 (no dependencies)
  ↓
Step 2 (depends on Step 1)
  ↓
Step 3 (depends on Step 2)
  ↓
Step 4 (depends on Step 3)
```

Or for parallel steps:

```
Step 1
  ├─→ Step 2 (parallel)
  └─→ Step 3 (parallel)
      ↓
Step 4 (depends on Step 2 and Step 3)
```

## Risks & Mitigation

### High Priority Risks

- **[Risk Name]**: [Description]
  - **Impact**: [High/Medium/Low]
  - **Probability**: [High/Medium/Low]
  - **Mitigation**: [Strategy]
  - **Contingency**: [Backup plan]

### Medium Priority Risks

- **[Risk Name]**: [Description]
  - **Impact**: [High/Medium/Low]
  - **Probability**: [High/Medium/Low]
  - **Mitigation**: [Strategy]

### Low Priority Risks

- **[Risk Name]**: [Description]
  - **Impact**: [High/Medium/Low]
  - **Probability**: [High/Medium/Low]
  - **Mitigation**: [Strategy]

## Success Criteria

### Overall Success Criteria

- [Criterion 1]: [How to measure] - [Target value]
- [Criterion 2]: [How to measure] - [Target value]
- [Criterion 3]: [How to measure] - [Target value]

### Step-Level Success Criteria

- **Step 1**: [Criteria]
- **Step 2**: [Criteria]
- **Step 3**: [Criteria]

## Execution Status

### Progress Tracking

- **Started**: [Date]
- **Current Step**: [Step number]
- **Completion**: [X%]
- **Blockers**: [List any blockers]

### Step Status

- Step 1: [Status] - [Notes]
- Step 2: [Status] - [Notes]
- Step 3: [Status] - [Notes]

### Updates

- **[Date]**: [Update description]
- **[Date]**: [Update description]

## Resources

### Required Agents

- [Agent 1]: [Role/Responsibility]
- [Agent 2]: [Role/Responsibility]

### Required Skills

- [Skill 1]: [Purpose]
- [Skill 2]: [Purpose]

### Required Tools

- [Tool 1]: [Purpose]
- [Tool 2]: [Purpose]

## Validation

### Plan Validation Checklist

- [ ] All requirements addressed in plan steps
- [ ] All dependencies identified and sequenced
- [ ] Success criteria defined for each step
- [ ] Risks identified with mitigation strategies
- [ ] Agent assignments appropriate for each step
- [ ] Plan is feasible given constraints
- [ ] No circular dependencies
- [ ] Timeline is reasonable

### Validation Results

- **Validated By**: [Agent/User]
- **Validation Date**: [Date]
- **Issues Found**: [List any issues]
- **Resolution**: [How issues were resolved]

## Notes

[Any additional notes, considerations, or context]
</template_structure>

<usage_instructions>
**When to Use**: When creating structured plans for complex tasks or projects using the Planner agent.

**Required Sections**: Objectives, Context, Steps (≤7 per section), Dependencies Graph, Risks & Mitigation, Success Criteria.

**Template Variables**: All `[variable]` placeholders should be replaced with actual values when using this template.

**Agent Integration**: This template is used by the Planner agent to generate structured plans. Steps should be assigned to appropriate agents.
</usage_instructions>
