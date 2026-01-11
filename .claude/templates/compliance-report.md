<template_structure>

# Compliance Report: {{report_id}}

## Metadata

- **Auditor**: {{auditor_name}}
- **Report Date**: {{report_date}}
- **Overall Compliance Status**: {{overall_compliance_status}} (compliant/mostly_compliant/non_compliant/requires_review)
- **Standards Assessed**: {{standards_assessed}}
- **Scope**: {{scope_description}}
- **Related Documents**: {{related_docs}}

## Executive Summary

### Overall Compliance Status

**Status**: {{overall_compliance_status}}

**Summary**: {{executive_summary}}

### Key Findings

- **Compliant Standards**: {{compliant_standards}}
- **Non-Compliant Standards**: {{non_compliant_standards}}
- **Critical Issues**: {{critical_issues_count}}
- **High Priority Issues**: {{high_priority_issues_count}}

## Standards Assessment

### {{standard_name}} Assessment

**Compliance Status**: {{compliance_status}} (compliant/mostly_compliant/non_compliant/not_applicable)
**Compliance Score**: {{compliance_score}}/100

#### Findings

| Type     | Severity     | Requirement     | Description     | Location     | Recommendation     | Priority     |
| -------- | ------------ | --------------- | --------------- | ------------ | ------------------ | ------------ |
| {{type}} | {{severity}} | {{requirement}} | {{description}} | {{location}} | {{recommendation}} | {{priority}} |

**Summary**: {{standard_summary}}

---

## Coding Guidelines Compliance

**Adherence Score**: {{coding_guidelines_adherence_score}}/100

### Violations

| Guideline     | Violation Count     | Examples     |
| ------------- | ------------------- | ------------ |
| {{guideline}} | {{violation_count}} | {{examples}} |

**Summary**: {{coding_guidelines_summary}}

## Security Best Practices

**Adherence Score**: {{security_adherence_score}}/100

### Practices Assessed

| Practice     | Compliant     | Notes     |
| ------------ | ------------- | --------- |
| {{practice}} | {{compliant}} | {{notes}} |

**Summary**: {{security_practices_summary}}

## Documentation Requirements

**Adherence Score**: {{documentation_adherence_score}}/100
**Documentation Quality**: {{documentation_quality}} (excellent/good/adequate/poor/missing)

### Missing Documentation

{{missing_documentation_list}}

**Summary**: {{documentation_summary}}

## Recommendations

### High Priority (P0)

{{high_priority_recommendations}}

### Medium Priority (P1)

{{medium_priority_recommendations}}

### Low Priority (P2-P3)

{{low_priority_recommendations}}

## Remediation Priority

| Priority | Action     | Standard     | Estimated Effort     |
| -------- | ---------- | ------------ | -------------------- |
| P0       | {{action}} | {{standard}} | {{estimated_effort}} |
| P1       | {{action}} | {{standard}} | {{estimated_effort}} |
| P2       | {{action}} | {{standard}} | {{estimated_effort}} |
| P3       | {{action}} | {{standard}} | {{estimated_effort}} |

## Compliance Checklist

### Industry Standards

- [ ] OWASP Top 10 assessed
- [ ] GDPR requirements verified (if applicable)
- [ ] HIPAA requirements verified (if applicable)
- [ ] SOC 2 controls assessed (if applicable)
- [ ] PCI-DSS requirements verified (if applicable)
- [ ] ISO 27001 controls assessed (if applicable)
- [ ] NIST framework compliance (if applicable)
- [ ] CIS benchmarks assessed (if applicable)

### Coding Guidelines

- [ ] Project coding standards documented
- [ ] Code adheres to documented standards
- [ ] Linting rules configured and enforced
- [ ] Code review process in place
- [ ] Style guide followed

### Security Best Practices

- [ ] Input validation implemented
- [ ] Authentication/authorization correct
- [ ] No hardcoded secrets
- [ ] Encryption at rest and in transit
- [ ] Security headers configured
- [ ] Dependency vulnerabilities managed
- [ ] Security logging enabled

### Documentation Requirements

- [ ] API documentation complete
- [ ] Architecture documentation current
- [ ] Security documentation present
- [ ] Deployment documentation available
- [ ] Incident response procedures documented

## Next Steps

{{next_steps}}

## Related Documents

- Code Review Report: {{code_review_report_link}}
- Refactoring Plan: {{refactoring_plan_link}}
- Quality Report: {{quality_report_link}}
- Plan: {{plan_link}}

---

</template_structure>

<usage_instructions>
**When to Use**: When creating compliance reports after auditing code against regulatory standards, coding guidelines, and security best practices.

**Required Sections**: Executive Summary, Standards Assessment, Coding Guidelines Compliance, Security Best Practices, Documentation Requirements, Recommendations, Remediation Priority.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Related Templates**: This compliance report follows standards from `.claude/templates/project-constitution.md` and integrates with code review reports from `.claude/templates/code-review-report.md`.
</usage_instructions>
