# Senior Review Prompt Template

## Purpose
Comprehensive code review from a senior engineer perspective.

## Template

```
Please perform a senior-level code review of [FILES/COMPONENT]. Focus on:

1. **Architecture & Design**:
   - Design patterns and their appropriateness
   - Component structure and organization
   - Separation of concerns
   - Scalability considerations

2. **Code Quality**:
   - Code clarity and readability
   - Naming conventions
   - Function/method complexity
   - DRY principles adherence

3. **Security**:
   - Input validation and sanitization
   - Authentication and authorization
   - Secrets management
   - Injection vulnerabilities
   - XSS/CSRF protection

4. **Performance**:
   - Algorithm efficiency
   - Database query optimization
   - Memory usage patterns
   - Caching opportunities

5. **Testing**:
   - Test coverage and quality
   - Test organization and structure
   - Edge case coverage
   - Integration test considerations

6. **Maintainability**:
   - Documentation quality
   - Error handling
   - Logging and observability
   - Future extensibility

Please provide specific, actionable feedback with code examples and suggestions.
```

## Usage
- Pre-merge code review
- Architecture review
- Security audit
- Performance review

## Agent
- code-reviewer
- security-architect
- performance-engineer

