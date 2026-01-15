# Default Plan Rating Rubric

## Purpose

This rubric provides default criteria for rating implementation plans when no workflow-specific rubric is provided. Plans must score 7/10 or higher to proceed to execution.

## Criteria (10 points total)

### 1. Completeness (3 points)

**Are all requirements addressed?**

- **3 points**: All requirements explicitly addressed with detailed approach
- **2 points**: Most requirements addressed, minor gaps acceptable
- **1 point**: Some requirements missing or vague
- **0 points**: Major requirements omitted

**Evaluation Questions**:

- Does the plan cover all user stories/requirements?
- Are edge cases and error scenarios included?
- Are all acceptance criteria addressable?

---

### 2. Feasibility (2 points)

**Is the plan technically achievable?**

- **2 points**: Technically sound with proven approaches
- **1 point**: Feasible but may require research or prototyping
- **0 points**: Contains infeasible or overly complex approaches

**Evaluation Questions**:

- Are proposed technologies mature and well-supported?
- Are dependencies available and compatible?
- Is the timeline realistic given scope?

---

### 3. Risk Mitigation (2 points)

**Are risks identified and mitigated?**

- **2 points**: Risks identified with concrete mitigation strategies
- **1 point**: Some risks identified, basic mitigation outlined
- **0 points**: Risks not addressed or mitigation absent

**Evaluation Questions**:

- Are technical risks (performance, security, scalability) identified?
- Are project risks (timeline, dependencies, resource) addressed?
- Do mitigations reduce risk to acceptable levels?

---

### 4. Agent Coverage (2 points)

**Are appropriate agents assigned to tasks?**

- **2 points**: All tasks have optimal agent assignments with clear roles
- **1 point**: Agents assigned but some mismatches or gaps
- **0 points**: Missing agents or significant misassignments

**Evaluation Questions**:

- Does each task have the most specialized agent?
- Are security-sensitive tasks assigned to security-architect?
- Are architecture decisions assigned to architect?
- Are implementation tasks assigned to developer?

---

### 5. Integration (1 point)

**Does it integrate with existing systems?**

- **1 point**: Integration points clearly defined and compatible
- **0 points**: Integration not addressed or conflicts present

**Evaluation Questions**:

- Are existing APIs/services properly integrated?
- Are database schema changes backward compatible?
- Are authentication/authorization flows consistent?

---

## Scoring Guide

| Score Range | Rating     | Action                                           |
| ----------- | ---------- | ------------------------------------------------ |
| **9-10**    | Excellent  | Ready to execute immediately                     |
| **7-8**     | Good       | Ready to execute, minor improvements recommended |
| **5-6**     | Acceptable | Requires refinement before execution             |
| **3-4**     | Poor       | Needs major rework before execution              |
| **0-2**     | Inadequate | Return to planning phase                         |

---

## Minimum Passing Score

**7/10** - Plans scoring below 7/10 MUST be returned to the Planner with specific feedback for improvement. Re-rate after improvements until passing score achieved.

---

## Usage

### For Orchestrators

1. Load this rubric when workflow-specific rubric is missing
2. Use response-rater skill to evaluate plan against criteria
3. Document rating in `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json`
4. If score < 7: Return plan with feedback
5. If score >= 7: Proceed with execution

### For Planners

Use this rubric as guidance when creating plans:

- Ensure completeness by addressing all requirement categories
- Validate feasibility of proposed approaches
- Identify and mitigate risks proactively
- Assign most specialized agents to tasks
- Define integration points clearly

---

## Examples

### Excellent Plan (9/10)

```
✓ All requirements addressed with detailed steps
✓ Technically sound with proven libraries/frameworks
✓ Risks identified (3) with concrete mitigations
✓ Optimal agent assignments (architect → developer → code-reviewer → qa)
✓ Integration points defined with backward compatibility
```

### Good Plan (7/10)

```
✓ Most requirements addressed (minor edge case missing)
✓ Feasible approach with minor research needed
✓ Key risks identified with basic mitigation
✓ Agents assigned correctly
✓ Integration defined
```

### Needs Improvement (5/10)

```
⚠ Some requirements vague or missing
✓ Feasible but lacks detail
⚠ Risks mentioned but mitigation unclear
⚠ Some agent assignments suboptimal
✓ Integration present
```

### Inadequate (3/10)

```
✗ Major requirements missing
✗ Infeasible approaches proposed
✗ No risk mitigation
✗ Wrong agents assigned to tasks
✗ Integration not addressed
```

---

## Customization

Workflows with specific needs should provide custom rubrics at:
`.claude/workflows/<workflow-name>-rubric.md`

Custom rubrics override this default rubric and may adjust:

- Scoring weights per category
- Minimum passing scores (e.g., 8/10 for security-critical workflows)
- Additional criteria specific to workflow type
- Domain-specific evaluation questions

---

## Validation

This rubric can be validated using:

```bash
node .claude/tools/enforcement-gate.mjs validate-plan \
  --run-id <run_id> \
  --plan-id <plan_id> \
  --rubric .claude/templates/default-plan-rubric.md
```

---

**Version**: 1.0.0
**Last Updated**: 2025-01-10
**Maintained By**: Orchestration Team
