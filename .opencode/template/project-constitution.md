# Project Constitution: {{project_name}}

## Overview
This document establishes governance standards, coding conventions, and quality requirements for {{project_name}}.

## Core Principles

1. **Quality First**: Never sacrifice quality for speed
2. **Security by Default**: Security is a feature, not an afterthought
3. **User-Centric**: All decisions should benefit the end user
4. **Maintainability**: Code should be readable and maintainable
5. **Documentation**: If it's not documented, it doesn't exist

## Technology Stack

### Frontend
- **Framework**: {{frontend_framework}}
- **Language**: {{frontend_language}}
- **Styling**: {{styling_solution}}
- **State Management**: {{state_management}}

### Backend
- **Runtime**: {{backend_runtime}}
- **Framework**: {{backend_framework}}
- **Database**: {{database}}
- **Cache**: {{cache}}

## Coding Standards

### Naming Conventions
- **Variables**: camelCase
- **Functions**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case or snake_case

### Code Style
- Use `const` over `let`, never use `var`
- Prefer arrow functions
- Use async/await over .then()
- Maximum line length: 100 characters
- Maximum function length: 50 lines
- Maximum file length: 300 lines

### Comments
- Use JSDoc for public APIs
- Comment "why", not "what"
- Keep comments up to date

## Git Workflow

### Branches
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Production hotfixes

### Commit Messages
```
type(scope): subject

body (optional)

footer (optional)
```

Types: feat, fix, docs, style, refactor, test, chore

### Pull Requests
- [ ] Descriptive title
- [ ] Link to issue/ticket
- [ ] Description of changes
- [ ] Screenshots (for UI changes)
- [ ] Tests passing
- [ ] Code reviewed

## Testing Standards

### Coverage Requirements
- Unit Tests: 80% minimum
- Integration Tests: Critical paths covered
- E2E Tests: Happy paths covered

### Testing Practices
- Write tests before or with code
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

## Security Standards

### Authentication
{{auth_standards}}

### Authorization
{{authz_standards}}

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all connections
- Validate and sanitize all inputs
- No secrets in code

## Quality Gates

### Pre-Commit
- [ ] Linting passes
- [ ] Formatting applied
- [ ] No console.log statements

### Pre-Merge
- [ ] All tests pass
- [ ] Code review approved
- [ ] No security vulnerabilities
- [ ] Documentation updated

### Pre-Deploy
- [ ] Staging tested
- [ ] Performance benchmarks met
- [ ] Rollback plan documented

## API Standards

### REST Conventions
- Use plural nouns for resources
- Use HTTP methods correctly
- Version APIs in URL path
- Return appropriate status codes

### Response Format
```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

## Documentation Requirements

### Code Documentation
- README.md for all packages
- JSDoc for public APIs
- Inline comments for complex logic

### System Documentation
- Architecture diagrams
- API documentation
- Runbooks for operations

## Error Handling

### Frontend
- User-friendly error messages
- Graceful degradation
- Error boundaries

### Backend
- Structured error responses
- Proper logging
- No sensitive data in errors

## Performance Standards

| Metric | Target |
|--------|--------|
| Page Load | < 2s |
| API Response (p95) | < 200ms |
| Lighthouse Score | > 90 |

## Accessibility Standards

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast ratios

---
*This constitution governs development practices for {{project_name}}.*
