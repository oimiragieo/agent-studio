# CUJ File Updates Report

**Date**: 2026-01-06
**Task**: Complete remaining file updates for CUJ analysis fixes

---

## Summary

All 4 tasks completed successfully:

1. ✅ Created PLAN_RATING_GUIDE.md (comprehensive plan rating documentation)
2. ✅ Updated response-rater SKILL.md (added plan rating sections)
3. ✅ Updated 13 workflow YAML files (standardized plan rating paths)
4. ✅ Fixed CUJ-041.md (corrected placeholder from `<run_id>` to `<plan_id>`)

---

## Task 1: PLAN_RATING_GUIDE.md

**Created**: `.claude/docs/PLAN_RATING_GUIDE.md`

**Content Sections**:
- Overview (purpose, why it matters, response-rater integration, minimum 7/10 requirement)
- Retry Logic (3-attempt retry flow with escalation)
- Feedback Loop (JSON feedback format, rubric dimensions, Planner interpretation)
- Score Thresholds (Emergency 5/10, Standard 7/10, Enterprise 8/10, Critical 9/10)
- Provider Configuration (default providers, timeout 180s, failure handling)
- Workflow Integration (Step 0.1 pattern, orchestrator responsibilities)
- CLI Usage Examples
- Troubleshooting
- Best Practices
- References

**Key Features**:
- Comprehensive 3-retry flow documentation
- Clear escalation path to user after 3 failures
- Force-proceed option with risk acknowledgment
- Provider timeout and failure handling
- Standard path format: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

---

## Task 2: response-rater SKILL.md Updates

**Updated**: `.claude/skills/response-rater/SKILL.md`

**New Sections Added**:
1. **Plan Rating for Orchestration** (overview, usage, rubric dimensions)
2. **Provider Configuration for Plan Rating** (default providers, selection strategy)
3. **Timeout and Failure Handling** (timeout config, 4 failure scenarios)
4. **Workflow Integration for Plan Rating** (Step 0.1 pattern, rating file location, orchestrator responsibilities, retry logic)

**Integration Points**:
- Rubric dimensions: completeness, feasibility, risk_mitigation, agent_coverage, integration (equal weight 20% each)
- Minimum scores by task type: Emergency 5/10, Standard 7/10, Enterprise 8/10, Critical 9/10
- Provider configuration: Standard (claude,gemini), Enterprise (claude,gemini,codex), Critical (all 5)
- Timeout: 180s default, 300s for enterprise, 600s for critical
- Retry logic: 3 attempts, escalate to user on failure

---

## Task 3: Workflow YAML Updates

**Updated 13 Workflow Files** with standardized plan rating path:

| Workflow File | Line | Status |
|---------------|------|--------|
| ai-system-flow.yaml | 71 | ✅ Updated |
| brownfield-fullstack.yaml | 68 | ✅ Updated |
| incident-flow.yaml | 71 | ✅ Updated |
| greenfield-fullstack.yaml | 74 | ✅ Updated |
| enterprise-track.yaml | 74 | ✅ Updated |
| automated-enterprise-flow.yaml | 104 | ✅ Updated |
| legacy-modernization-flow.yaml | 74 | ✅ Updated |
| mobile-flow.yaml | 71 | ✅ Updated |
| performance-flow.yaml | 68 | ✅ Updated |
| quick-flow.yaml | 62 | ✅ Updated |
| browser-testing-flow.yaml | 126 | ✅ Updated |
| ui-perfection-loop.yaml | 102 | ✅ Updated |
| code-quality-flow.yaml | 143 | ✅ Updated |

**Change Applied**:
```yaml
# Before (non-standard path)
outputs:
  - plan-rating-{{workflow_id}}.json

# After (standardized path)
outputs:
  - .claude/context/runs/<run_id>/plans/<plan_id>-rating.json
```

**Benefits**:
- Consistent path format across all workflows
- Clear run state organization
- Easier to find rating files
- Supports artifact registry integration

---

## Task 4: CUJ-041.md Fix

**Updated**: `.claude/docs/cujs/CUJ-041.md` (line 104)

**Change**:
```markdown
# Before (wrong placeholder)
| Plan rating | response-rater skill score | >= 7/10 (recorded in `.claude/context/runs/<run_id>/plans/<run_id>-rating.json`) |

# After (correct placeholder)
| Plan rating | response-rater skill score | >= 7/10 (recorded in `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`) |
```

**Context**: The filename should use `<plan_id>` (unique plan identifier) not `<run_id>` (workflow run identifier).

**Standard Path Format**: `.claude/context/runs/<run_id>/plans/<plan_id>-rating.json`

---

## Path Format Standardization

All files now use the standardized plan rating path format:

**Path Structure**:
```
.claude/context/runs/<run_id>/plans/<plan_id>-rating.json
                     ^^^^^^^       ^^^^^^^^^
                     run ID        plan ID (unique per plan)
```

**Example**:
```
.claude/context/runs/run-001/plans/plan-greenfield-2025-01-06-rating.json
```

**Key Components**:
- `<run_id>`: Workflow run identifier (e.g., `run-001`)
- `<plan_id>`: Unique plan identifier (e.g., `plan-greenfield-2025-01-06`)
- `-rating.json`: Suffix for rating files

---

## Files Modified Summary

| Category | Files Modified | Description |
|----------|----------------|-------------|
| Documentation | 1 new, 2 updated | PLAN_RATING_GUIDE.md (new), response-rater SKILL.md (updated), CUJ-041.md (fixed) |
| Workflows | 13 updated | All workflows now use standardized plan rating path |
| **Total** | **16 files** | 1 new, 15 updated |

---

## Validation

### Path Format Validation

All updated files follow the subagent file rules:
- ✅ Use forward slashes (`/`) in paths
- ✅ Proper `.claude/context/` hierarchy
- ✅ No root directory violations
- ✅ Consistent path format across all workflows

### Documentation Cross-References

All documentation is properly cross-referenced:
- PLAN_RATING_GUIDE.md references response-rater SKILL.md
- response-rater SKILL.md references PLAN_RATING_GUIDE.md
- Both reference enforcement-gate.mjs and plan-review-matrix.json
- CUJ-041.md uses standardized path format

---

## Next Steps

1. ✅ **Complete**: All 4 tasks finished
2. **Recommended**: Validate workflows with `node .claude/tools/validate-workflow-paths.mjs`
3. **Recommended**: Test plan rating integration with sample workflow
4. **Recommended**: Update any additional CUJs that reference plan rating paths

---

## Completion Status

- [x] Task 1: Create PLAN_RATING_GUIDE.md
- [x] Task 2: Update response-rater SKILL.md
- [x] Task 3: Update 13 workflow YAML files
- [x] Task 4: Fix CUJ-041.md

**All tasks completed successfully.**
