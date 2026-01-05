# CUJ Success Criteria Audit Report

**Audit Date**: 2026-01-03  
**Auditor**: QA Agent (Riley Thompson)  
**Scope**: First 18 CUJs analyzed for measurable success criteria

---

## Executive Summary

| Status | Count | Percentage |
|--------|-------|------------|
| PASS (Measurable) | 12 | 67% |
| NEEDS UPDATE (Vague) | 6 | 33% |

**Note**: 7 CUJs were updated during this audit to include measurable criteria.

---

## Assessment Criteria

CUJs were evaluated for presence of:
1. **Artifact Path References**: e.g., `plan-{{workflow_id}}.json`, `test-results.json`
2. **Gate File Validation**: e.g., `validated by gate file`, `gates/step-N.json`
3. **Schema References**: e.g., `matches .claude/schemas/plan.schema.json`
4. **Specific Field Validation**: e.g., `issues array with severity field`

---

## Detailed Findings

### PASS - Fully Measurable (12 CUJs)

| CUJ | Title | Measurable Elements |
|-----|-------|---------------------|
| CUJ-004 | New Feature Planning | `plan-{id}.json`, gate file, `plan.schema.json` |
| CUJ-005 | Greenfield Project Planning | Full workflow artifacts, gate files, 10 measurable criteria (UPDATED) |
| CUJ-006 | Architecture Review | `architecture-review-{{workflow_id}}.json`, diagrams, severity ratings (UPDATED) |
| CUJ-007 | Technical Debt Planning | `refactor-plan-{{workflow_id}}.json`, priority/effort fields (UPDATED) |
| CUJ-009 | Component Scaffolding | `component-files.json`, `test-files.json`, rule-auditor, gate file |
| CUJ-010 | API Endpoint Development | `validation-schema-{{workflow_id}}.json`, gate files, schema validation |
| CUJ-011 | Bug Fix Workflow | `test-results.json`, gate files, `code-review.schema.json` |
| CUJ-012 | Feature Implementation | `dev-manifest-{{workflow_id}}.json`, test coverage, QA gate (UPDATED) |
| CUJ-013 | Code Review | `code-review-report-{{workflow_id}}.json`, severity/security/recommendations (UPDATED) |
| CUJ-014 | Rule Compliance Audit | `audit-report-{{workflow_id}}.json`, compliance_score, violations (UPDATED) |
| CUJ-015 | Test Generation | `test-files.json`, `coverage-report.json`, `test-scenarios.json`, gate file |
| CUJ-016 | API Documentation | `openapi-{{workflow_id}}.json`, `api-docs-{{workflow_id}}.json`, examples (UPDATED) |

### NEEDS UPDATE - Vague Criteria (6 CUJs)

| CUJ | Title | Issue | Recommended Fix |
|-----|-------|-------|-----------------|
| CUJ-001 | First-Time Installation | Only checkmarks, no validation commands | Add `pnpm validate` exit code check, file existence validation |
| CUJ-002 | Rule Configuration | Good fallback logic but no artifact output | Add `manifest.yaml` validation, rules_selected array |
| CUJ-003 | Cross-Platform Setup | Only checkmarks | Add platform config file validation, sync status artifact |
| CUJ-008 | Database Schema Planning | Only checkmarks | Add `schema-design-{{workflow_id}}.json`, migration scripts validation |
| CUJ-017 | Module Documentation | Only checkmarks | Add `claude.md` path validation, structure check |
| CUJ-018 | Architecture Documentation | Only checkmarks | Add diagram artifact references, ADR template validation |

---

## Template for Updating Remaining CUJs

When updating CUJs with vague success criteria, use this pattern:

```markdown
## Success Criteria
- [ ] [Criterion description] (artifact: `<artifact-name>-{{workflow_id}}.json`)
- [ ] [Validation description] (validated by gate file: `gates/<step-name>.json`)
- [ ] [Schema compliance] (schema: `.claude/schemas/<schema-name>.schema.json`)
- [ ] [Field-level validation] (artifact: `<name>.json`, <field> array populated)
- [ ] [Computed metric] (artifact: `<name>.json`, <metric_field> >= <threshold>)
```

### Key Patterns for Measurable Criteria

| Pattern | Example |
|---------|---------|
| Artifact existence | `(artifact: plan-{{workflow_id}}.json)` |
| Gate validation | `(validated by gate file: gates/00-planner.json)` |
| Schema validation | `(schema: .claude/schemas/plan.schema.json)` |
| Array population | `(artifact: report.json, issues array populated)` |
| Field presence | `(artifact: report.json, each item has priority field)` |
| Numeric threshold | `(artifact: report.json, coverage >= 80%)` |
| Enum validation | `(artifact: report.json, severity: critical\|high\|medium\|low)` |

### Example Transformation

**BEFORE (Vague):**
```markdown
## Success Criteria
- [x] Architecture analyzed
- [x] Diagrams generated
- [x] Issues identified
- [x] Recommendations provided
```

**AFTER (Measurable):**
```markdown
## Success Criteria
- [ ] Architecture analyzed (artifact: `architecture-review-{{workflow_id}}.json`, files_analyzed array populated)
- [ ] Diagrams generated (artifacts: `diagrams/architecture-{{workflow_id}}.mmd`, file exists)
- [ ] Issues identified with severity (artifact: `architecture-review-{{workflow_id}}.json`, issues array with severity: critical|high|medium|low)
- [ ] Recommendations prioritized (artifact: `architecture-review-{{workflow_id}}.json`, recommendations array with priority field)
```

---

## Recommendations

### Immediate Actions
1. **Update 6 remaining vague CUJs** following the template above
2. **Create missing schemas** for artifact types referenced in updated CUJs
3. **Add gate file references** to all workflow-based CUJs

### Future Improvements
1. **Automate CUJ validation**: Create a script that parses CUJ files and validates success criteria format
2. **Schema coverage**: Ensure every artifact type has a corresponding schema
3. **Gate file templates**: Create gate file templates for common validation patterns

---

## Files Updated in This Audit

| File | Status |
|------|--------|
| `CUJ-005.md` | Updated with 10 measurable criteria |
| `CUJ-006.md` | Updated with 7 measurable criteria |
| `CUJ-007.md` | Updated with 8 measurable criteria |
| `CUJ-012.md` | Updated with 9 measurable criteria |
| `CUJ-013.md` | Updated with 8 measurable criteria |
| `CUJ-014.md` | Updated with 8 measurable criteria |
| `CUJ-016.md` | Updated with 9 measurable criteria |
| `AUDIT-REPORT.md` | Created (this file) |

---

## Next Steps for Remaining CUJs

The following CUJs (CUJ-019 through CUJ-055) should be audited following the same pattern. Priority should be given to:

1. **Workflow-based CUJs** (those referencing `.yaml` files) - require gate file validation
2. **Skill-based CUJs** - require artifact output validation
3. **Setup CUJs** - require command exit code and file existence validation

---

*Report generated by QA Agent as part of quality assurance workflow*
