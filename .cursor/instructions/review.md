# Review Mode Guide

Cursor's Review Mode provides structured code review workflows for agents.

## When to Use Review Mode

- Before merging code changes
- When reviewing pull requests
- For quality gate validation
- Before deploying to production

## Review Process

1. **Activate Review Mode**: Select Review agent or use review hook
2. **Analyze Changes**: Agent examines diffs and new code
3. **Check Standards**: Verify adherence to coding rules
4. **Security Scan**: Identify potential security issues
5. **Performance Review**: Check for performance regressions
6. **Provide Feedback**: Generate review comments with suggestions

## Review Criteria

### Code Quality

- Follows project coding standards
- Proper error handling
- Comprehensive testing
- Clear documentation

### Security

- No exposed secrets or credentials
- Input validation present
- Secure authentication patterns
- No SQL injection or XSS vulnerabilities

### Performance

- No unnecessary re-renders or queries
- Efficient algorithms and data structures
- Proper caching strategies
- Bundle size considerations

### Architecture

- Follows established patterns
- Proper separation of concerns
- Maintainable code structure
- Scalability considerations

## Integration with QA Agent

QA Agent can leverage Review Mode to:

- Validate test coverage
- Check requirements traceability
- Perform security assessments
- Generate quality gate decisions

## Best Practices

- Review before approving PRs
- Use Review Mode for significant changes
- Combine with automated testing
- Document review findings
- Track review metrics over time
