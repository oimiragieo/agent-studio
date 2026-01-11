<template_structure>

# Code Review Report: {{review_id}}

## Metadata

- **Reviewer**: {{reviewer_name}}
- **Date**: {{review_date}}
- **Scope**: {{files_reviewed}} ({{total_lines}} lines)
- **Review Type**: {{review_type}} (automated/manual/hybrid)
- **Version**: {{version}}
- **Status**: {{status}} (draft/review/approved)
- **Related Documents**: {{related_docs}}

## Summary

- **Overall Quality**: {{quality_rating}} (1-10)
- **Status**: {{status}} (approved/needs_changes/blocked)
- **Key Findings**: {{key_findings_summary}}

## Findings by Category

### Critical Issues (Blockers)

| Severity | File:Line         | Issue     | Recommendation     | Priority |
| -------- | ----------------- | --------- | ------------------ | -------- |
| Blocker  | {{file}}:{{line}} | {{issue}} | {{recommendation}} | P0       |

### Security Issues

| Severity     | File:Line         | Issue     | Recommendation     | Priority     |
| ------------ | ----------------- | --------- | ------------------ | ------------ |
| {{severity}} | {{file}}:{{line}} | {{issue}} | {{recommendation}} | {{priority}} |

**Security Checklist**:

- [ ] Input validation present
- [ ] Authentication/authorization correct
- [ ] No hardcoded secrets
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Dependency vulnerabilities checked

### Performance Issues

| Severity     | File:Line         | Issue     | Recommendation     | Priority     |
| ------------ | ----------------- | --------- | ------------------ | ------------ |
| {{severity}} | {{file}}:{{line}} | {{issue}} | {{recommendation}} | {{priority}} |

**Bottlenecks Identified**: {{bottlenecks}}
**Optimization Opportunities**: {{optimizations}}

### Code Quality Issues

| Severity     | File:Line         | Issue     | Recommendation     | Priority     |
| ------------ | ----------------- | --------- | ------------------ | ------------ |
| {{severity}} | {{file}}:{{line}} | {{issue}} | {{recommendation}} | {{priority}} |

### Maintainability Issues

| Severity     | File:Line         | Issue     | Recommendation     | Priority     |
| ------------ | ----------------- | --------- | ------------------ | ------------ |
| {{severity}} | {{file}}:{{line}} | {{issue}} | {{recommendation}} | {{priority}} |

## Code Quality Metrics

- **Cyclomatic Complexity**: {{complexity_score}}
- **Code Duplication**: {{duplication_percent}}%
- **Test Coverage**: {{test_coverage}}%
- **Documentation Coverage**: {{doc_coverage}}%

## Performance Analysis

- **Bottlenecks Identified**: {{bottlenecks}}
- **Optimization Opportunities**: {{optimizations}}
- **Memory Usage**: {{memory_usage}}
- **Response Time**: {{response_time}}ms

## Test Coverage Analysis

- **Existing Tests**: {{existing_tests}}
- **Missing Tests**: {{missing_tests}}
- **Test Quality**: {{test_quality}}
- **Test Coverage by File**: {{coverage_by_file}}

## Recommendations

### Must Fix (Before Merge)

{{must_fix_items}}

### Should Fix (Follow-up)

{{should_fix_items}}

### Nice to Have

{{nice_to_have_items}}

## Risks

- **Regression Risks**: {{regression_risks}}
- **Security Risks**: {{security_risks}}
- **Performance Risks**: {{performance_risks}}

## Next Steps

{{next_steps}}

## Related Documents

- Implementation Plan: {{implementation_plan_link}}
- Test Plan: {{test_plan_link}}
- Architecture: {{architecture_link}}

---

</template_structure>

<usage_instructions>
**When to Use**: When creating code review reports after reviewing code changes.

**Required Sections**: Summary, Findings by Category (Critical Issues, Security Issues, Performance Issues, Code Quality Issues).

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Related Templates**: This code review report follows quality standards from `.claude/templates/project-constitution.md`.
</usage_instructions>
