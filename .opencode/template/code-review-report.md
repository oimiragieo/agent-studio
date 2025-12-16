# Code Review Report: {{pr_title}}

## Overview

| Attribute | Value |
|-----------|-------|
| **PR/MR Number** | {{pr_number}} |
| **Author** | {{author}} |
| **Reviewer** | {{reviewer}} |
| **Date** | {{review_date}} |
| **Status** | {{status}} |

## Summary
{{summary}}

## Files Changed
| File | Changes | Type |
|------|---------|------|
| {{file_1}} | +{{additions_1}}/-{{deletions_1}} | {{type_1}} |
| {{file_2}} | +{{additions_2}}/-{{deletions_2}} | {{type_2}} |

## Review Checklist

### Code Quality
- [ ] Code follows project style guidelines
- [ ] No unnecessary code duplication
- [ ] Functions/methods are appropriately sized
- [ ] Variable/function names are descriptive
- [ ] Complex logic is well-commented

### Functionality
- [ ] Code works as described in the PR
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No obvious bugs

### Testing
- [ ] Unit tests added for new functionality
- [ ] Integration tests updated if needed
- [ ] All tests pass
- [ ] Test coverage is adequate

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication/authorization correct

### Performance
- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] No N+1 query problems
- [ ] Appropriate caching used

### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic is commented
- [ ] README updated if needed
- [ ] API documentation updated

## Issues Found

### Critical (Must Fix)
{{critical_issues}}

### Major (Should Fix)
{{major_issues}}

### Minor (Nice to Have)
{{minor_issues}}

### Nitpicks
{{nitpicks}}

## Suggestions

### Code Improvements
{{code_improvements}}

### Architecture Suggestions
{{architecture_suggestions}}

### Performance Optimizations
{{performance_optimizations}}

## Approval Status

| Category | Status |
|----------|--------|
| Code Quality | {{code_quality_status}} |
| Functionality | {{functionality_status}} |
| Testing | {{testing_status}} |
| Security | {{security_status}} |
| Performance | {{performance_status}} |

## Decision

- [ ] **APPROVED** - Ready to merge
- [ ] **APPROVED WITH SUGGESTIONS** - Can merge after addressing suggestions
- [ ] **REQUEST CHANGES** - Needs fixes before approval
- [ ] **BLOCKED** - Critical issues must be resolved

## Comments
{{reviewer_comments}}

---
*Review completed on {{completion_date}}.*
