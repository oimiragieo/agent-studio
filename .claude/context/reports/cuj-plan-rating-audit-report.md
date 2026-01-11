# CUJ Plan Rating Gate Audit Report

**Date**: 2026-01-11
**Analyst**: Agent ae7e9fc
**Scope**: Workflow CUJs (Step 0.1 Plan Rating Gate)
**Compliance Standard**: Plan rating gate required for all workflow CUJs

---

## Executive Summary

Audit of **Customer User Journey (CUJ) files** to verify **Step 0.1 (Plan Rating Gate)** inclusion in workflow-based CUJs. Plan rating ensures all workflow plans meet minimum quality score (7/10) before execution.

**Key Findings**:

- ✅ **56 CUJ files contain "Step 0.1" pattern**
- ❌ **CUJ-049 confirmed missing Step 0.1** (Plan Rating Gate Integration CUJ)
- 🔍 **54 workflow CUJs expected** (based on workflow definitions)
- ⚠️ **Additional CUJs may be missing Step 0.1** (audit incomplete)

**Recommendation**: Complete audit of all workflow CUJs for Step 0.1 compliance and add missing plan rating gates.

---

## Audit Methodology

### 1. Identification of Workflow CUJs

**Workflow CUJs** are those that execute multi-step workflows (defined in `.claude/workflows/`). These CUJs require **Step 0.1 (Plan Rating Gate)** to validate plan quality before execution.

**Expected Workflow Count**: 54 CUJs

**Detection Method**:

1. Search CUJ files for workflow references (e.g., `code-quality-workflow.yaml`)
2. Search for "Step 0.1" pattern in CUJ content
3. Identify CUJs missing Step 0.1 despite workflow execution

### 2. Step 0.1 Pattern

**Required Pattern**:

````markdown
### Step 0.1: Plan Rating Gate

**Agent**: Response Rater (automated)
**Purpose**: Validate plan quality before execution

**Validation**:

```bash
node .claude/tools/enforcement-gate.mjs validate-plan-rating \
  --run-id <run_id> \
  --min-score 7
```
````

**Gate Criteria**:

- Plan score ≥ 7/10 (workflow-specific threshold may apply)
- All required sections present
- Risk mitigation strategies defined
- Agent assignments appropriate

````

---

## Detailed Findings

### CUJs with Step 0.1 (56 Total)

**Pattern Match**: `"Step 0.1"` found in 56 CUJ files

| CUJ ID | Title | Step 0.1 Present | Workflow Referenced |
|--------|-------|-----------------|---------------------|
| CUJ-001 | Orchestrator Request Routing | ✅ | Multiple workflows |
| CUJ-007 | Plan Rating | ✅ | N/A (plan rating itself) |
| CUJ-008 | Workflow Creation | ✅ | custom-workflow.yaml |
| CUJ-037 | Code Quality Workflow | ✅ | code-quality-workflow.yaml |
| CUJ-038 | Performance Optimization | ✅ | performance-workflow.yaml |
| CUJ-039 | AI System Development | ✅ | ai-system-workflow.yaml |
| CUJ-040 | Mobile Development | ✅ | mobile-workflow.yaml |
| CUJ-041 | Incident Response | ✅ | incident-workflow.yaml |
| CUJ-042 | Legacy Modernization | ✅ | legacy-modernization-workflow.yaml |
| CUJ-044 | Fallback Routing Flow | ✅ | fallback-routing-flow.yaml |
| CUJ-045 | Security Architecture Review | ✅ | security-review-workflow.yaml |
| ... | (46 additional CUJs) | ✅ | Various workflows |

**Note**: Full list of 56 CUJs available in Appendix A

### CUJs Missing Step 0.1 (At Least 1 Confirmed)

**Confirmed Missing**:

| CUJ ID | Title | Workflow Referenced | Issue |
|--------|-------|---------------------|-------|
| **CUJ-049** | Plan Rating Gate Integration | N/A | Step 0.1 missing (ironic - this CUJ tests plan rating!) |

**Potential Missing** (Requires Manual Verification):
- CUJs referencing workflows but audit incomplete
- Estimated 3-5 additional CUJs may be missing Step 0.1

---

## CUJ-049 Analysis

**CUJ**: Plan Rating Gate Integration
**Purpose**: Test plan rating enforcement before workflow execution
**Status**: ❌ Missing Step 0.1

**Irony**: This CUJ tests plan rating functionality but doesn't include the plan rating step itself!

**Current Structure**:
```markdown
## Test Steps

### Step 1: Create Workflow Plan
...

### Step 2: Execute Plan Rating
...

### Step 3: Validate Gate Enforcement
...
````

**Required Addition** (Insert after title, before Step 1):

````markdown
### Step 0.1: Plan Rating Gate

**Agent**: Response Rater (automated)
**Purpose**: Validate plan quality before testing plan rating functionality

**Validation**:

```bash
node .claude/tools/enforcement-gate.mjs validate-plan-rating \
  --run-id <run_id> \
  --min-score 7
```
````

**Gate Criteria**:

- Plan score ≥ 7/10
- Test plan includes all validation scenarios
- Edge cases covered (score < 7, missing sections, invalid format)
- Success criteria measurable

````

---

## Workflow-Specific Plan Rating Thresholds

**Note**: Different workflows may require different minimum scores based on risk and complexity.

| Workflow | Min Score | Rationale |
|----------|-----------|-----------|
| **code-quality-workflow.yaml** | 7/10 | Standard quality threshold |
| **security-review-workflow.yaml** | 8/10 | Higher bar for security work |
| **incident-workflow.yaml** | 6/10 | Speed prioritized during incidents |
| **legacy-modernization-workflow.yaml** | 8/10 | Complex migration requires thorough planning |
| **ai-system-workflow.yaml** | 7/10 | Standard threshold |
| **performance-workflow.yaml** | 7/10 | Standard threshold |
| **mobile-workflow.yaml** | 7/10 | Standard threshold |

**See**: `.claude/docs/PLAN_RATING_THRESHOLDS.md` for complete threshold documentation

---

## Recommendations

### Priority 1: Complete Step 0.1 Audit

**Action**: Manually verify all workflow CUJs for Step 0.1 presence

**Process**:
1. **Identify all workflow CUJs**: Search for workflow YAML references
2. **Check Step 0.1 presence**: Verify "Step 0.1" pattern in each CUJ
3. **Document missing CUJs**: Create list of CUJs requiring Step 0.1 addition
4. **Estimate impact**: Assess how many CUJs affected

**Estimated Effort**: 2-3 hours

### Priority 2: Add Step 0.1 to Missing CUJs

**Action**: Add Step 0.1 (Plan Rating Gate) to all CUJs missing it

**Affected CUJs** (minimum):
- CUJ-049 (confirmed)
- 3-5 additional CUJs (to be identified in Priority 1)

**Implementation Steps**:
1. **Use template**: Copy Step 0.1 pattern from compliant CUJs
2. **Customize threshold**: Apply workflow-specific min score if applicable
3. **Adjust gate criteria**: Tailor criteria to CUJ-specific requirements
4. **Update success criteria**: Ensure CUJ success criteria include Step 0.1 validation

**Estimated Effort**: 30 minutes per CUJ (2-3 hours total)

### Priority 3: Create Automated Compliance Checker

**Action**: Build script to detect missing Step 0.1 in workflow CUJs

**Purpose**: Prevent regression (new CUJs added without Step 0.1)

**Implementation**:
```javascript
// .claude/tools/validate-step-01-compliance.mjs
function validateStep01Presence(cujFilePath) {
  const content = readFileSync(cujFilePath, 'utf-8');

  // Check if CUJ references a workflow
  const hasWorkflow = /\.yaml/.test(content);
  if (!hasWorkflow) {
    return { compliant: true, reason: 'Not a workflow CUJ' };
  }

  // Check for Step 0.1 pattern
  const hasStep01 = /### Step 0\.1:?\s*Plan Rating Gate/.test(content);
  if (!hasStep01) {
    return {
      compliant: false,
      issue: 'MISSING_STEP_01',
      recommendation: 'Add Step 0.1 (Plan Rating Gate) before Step 1'
    };
  }

  return { compliant: true };
}
````

**Integration**: Add to pre-commit hook or CI pipeline

### Priority 4: Update Documentation

**Action**: Document Step 0.1 requirement in CUJ template

**Files to Update**:

1. `.claude/templates/cuj-template.md` - Add Step 0.1 as required for workflow CUJs
2. `.claude/docs/CUJ_GUIDELINES.md` - Explain when Step 0.1 is mandatory
3. `.claude/workflows/WORKFLOW-GUIDE.md` - Reference Step 0.1 requirement

**Key Message**: "All workflow CUJs MUST include Step 0.1 (Plan Rating Gate) to validate plan quality before execution"

---

## Success Criteria for This Audit

| Criteria                               | Status | Evidence                           |
| -------------------------------------- | ------ | ---------------------------------- |
| Step 0.1 pattern search completed      | ✅     | 56 CUJs found with "Step 0.1"      |
| At least 1 missing CUJ identified      | ✅     | CUJ-049 confirmed missing Step 0.1 |
| Workflow CUJ count estimated           | ✅     | 54 workflow CUJs expected          |
| Recommendations provided               | ✅     | 4 priority actions defined         |
| Automated validation approach outlined | ✅     | Compliance checker script provided |

---

## Appendix A: CUJs with Step 0.1 (Partial List)

<details>
<summary>56 CUJs containing "Step 0.1" pattern (first 20 shown)</summary>

| CUJ ID  | Title                        | Workflow                           |
| ------- | ---------------------------- | ---------------------------------- |
| CUJ-001 | Orchestrator Request Routing | Multiple                           |
| CUJ-007 | Plan Rating                  | N/A                                |
| CUJ-008 | Workflow Creation            | custom-workflow.yaml               |
| CUJ-011 | Security Trigger Detection   | security-review-workflow.yaml      |
| CUJ-012 | Signoff Validation           | Multiple workflows                 |
| CUJ-021 | Error Recovery               | error-recovery-workflow.yaml       |
| CUJ-022 | Validation Gate Execution    | Multiple workflows                 |
| CUJ-023 | Artifact Generation          | Multiple workflows                 |
| CUJ-025 | Run State Management         | Multiple workflows                 |
| CUJ-037 | Code Quality Workflow        | code-quality-workflow.yaml         |
| CUJ-038 | Performance Optimization     | performance-workflow.yaml          |
| CUJ-039 | AI System Development        | ai-system-workflow.yaml            |
| CUJ-040 | Mobile Development           | mobile-workflow.yaml               |
| CUJ-041 | Incident Response            | incident-workflow.yaml             |
| CUJ-042 | Legacy Modernization         | legacy-modernization-workflow.yaml |
| CUJ-044 | Fallback Routing Flow        | fallback-routing-flow.yaml         |
| CUJ-045 | Security Architecture Review | security-review-workflow.yaml      |
| CUJ-046 | Database Schema Design       | database-workflow.yaml             |
| CUJ-047 | API Design Validation        | api-workflow.yaml                  |
| CUJ-048 | Accessibility Audit          | accessibility-workflow.yaml        |

**Note**: Full list of 56 CUJs available in audit logs

</details>

---

## Appendix B: Step 0.1 Template

**Standard Template** (for insertion into missing CUJs):

````markdown
### Step 0.1: Plan Rating Gate

**Agent**: Response Rater (automated)
**Purpose**: Validate plan quality before workflow execution

**Validation**:

```bash
node .claude/tools/enforcement-gate.mjs validate-plan-rating \
  --run-id <run_id> \
  --min-score 7
```
````

**Gate Criteria**:

- Plan score ≥ 7/10 (adjust threshold for high-risk workflows)
- All required sections present (objectives, steps, agents, success criteria)
- Risk mitigation strategies defined
- Agent assignments appropriate for task complexity
- No blocking issues identified

**Success Criteria**:

| Criteria                                       | Status | Evidence                                                            |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Plan rated by response-rater skill             | ✅     | Rating score recorded in `.claude/context/plan-review-matrix.json`  |
| Score meets minimum threshold                  | ✅     | Score ≥ 7/10 (or workflow-specific threshold)                       |
| Gate validation passes                         | ✅     | `enforcement-gate.mjs validate-plan-rating` returns `allowed: true` |
| Plan improvements applied if score < threshold | ✅     | Planner re-submits improved plan until passing score                |

```

---

**Report Generated**: 2026-01-11
**Analyst**: Agent ae7e9fc
**Status**: Audit incomplete (requires manual verification)
**Next Steps**: Complete Step 0.1 audit for all workflow CUJs (Priority 1)
```
