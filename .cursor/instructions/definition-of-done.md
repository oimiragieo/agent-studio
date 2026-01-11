# Definition of Done Checklist

Standard quality gates that must be satisfied before work is considered complete. Adapted from BMAD-Spec quality standards and best practices.

## Universal Definition of Done

### Code Quality

- [ ] Code follows project coding standards (check `.cursor/rules/`)
- [ ] Code is readable, maintainable, and well-documented
- [ ] No hardcoded values (use constants, config, environment variables)
- [ ] Proper error handling and logging implemented
- [ ] Edge cases considered and handled
- [ ] Performance implications considered

### Testing

- [ ] Unit tests written and passing
- [ ] Integration tests added where applicable
- [ ] Test coverage meets project standards (typically >80% for business logic)
- [ ] Tests are meaningful and test behavior, not implementation
- [ ] E2E tests added for critical user flows (if applicable)

### Quality Checks

- [ ] Linting passes with no errors (`pnpm lint` or equivalent)
- [ ] Type checking passes (`pnpm typecheck` or equivalent)
- [ ] Build succeeds without warnings (`pnpm build` or equivalent)
- [ ] No console errors or warnings in browser/terminal

### Security

- [ ] No secrets, tokens, or credentials committed
- [ ] Input validation implemented
- [ ] Security best practices followed
- [ ] Authentication/authorization handled correctly (if applicable)
- [ ] Security review completed for sensitive changes

### Documentation

- [ ] Code comments added for complex logic
- [ ] README updated if needed
- [ ] API documentation updated (if applicable)
- [ ] JSDoc/Typedoc comments added for public APIs
- [ ] Migration guides or breaking changes documented

### Cursor-Specific

- [ ] Plan Mode plan reviewed and approved (for multi-file changes)
- [ ] Agent prompt references checked (if modifying agent behavior)
- [ ] Plan artifacts stored in `.cursor/plans/` (if applicable)
- [ ] Handoff artifacts created for multi-agent workflows

### Git & Version Control

- [ ] Commit messages follow project conventions (Conventional Commits recommended)
- [ ] Branches named appropriately
- [ ] PR description includes context and changes summary
- [ ] Related issues/tickets referenced

## Agent-Specific Definition of Done

### Developer Agent

- [ ] Implementation matches architecture specifications
- [ ] All acceptance criteria met
- [ ] Code review checklist completed
- [ ] Tests written alongside implementation
- [ ] Performance benchmarks met (if applicable)

### Architect Agent

- [ ] Architecture document created with Mermaid diagrams
- [ ] Technology selections justified with rationale
- [ ] Security considerations documented
- [ ] Scalability and performance implications addressed
- [ ] Migration path documented (if applicable)

### QA Agent

- [ ] Test plan created and reviewed
- [ ] Test cases traceable to requirements
- [ ] Quality gate decision documented (PASS/CONCERNS/FAIL)
- [ ] Risk assessment completed
- [ ] Test coverage analysis performed

### PM Agent

- [ ] Product requirements document complete
- [ ] User stories created with acceptance criteria
- [ ] Prioritization rationale documented
- [ ] Stakeholder alignment confirmed
- [ ] Requirements traceable to business objectives

### Analyst Agent

- [ ] Project brief created
- [ ] Market research completed
- [ ] Competitive analysis documented
- [ ] Requirements validated and testable
- [ ] Risk assessment completed

## Pre-PR Checks

Run these commands before creating a PR:

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test

# Build verification
pnpm build

# Full pre-PR check (if configured)
pnpm pre-pr-check
```

### For Monorepos

```bash
# Type check affected packages
pnpm --filter "@scope/web" typecheck
pnpm --filter "@scope/api" typecheck

# Test affected packages
pnpm --filter "@scope/web" test
pnpm --filter "@scope/api" test

# Build affected packages
pnpm --filter "@scope/web" build
pnpm --filter "@scope/api" build
```

## Common Gotchas

### When Implementing Features

- **Missing Tests**: Always write tests alongside code, not after
- **Hardcoded Values**: Use environment variables or config files
- **No Error Handling**: Implement try-catch blocks and error boundaries
- **Forgotten Edge Cases**: Consider null, undefined, empty arrays, boundary conditions

### When Modifying Agents

- **Icon Format**: Must be single emoji in quotes: `icon: '📊'`
- **Tool Lists**: Use array format, not `all: true`
- **Actions**: Must be boolean, not strings
- **File Extension**: Must be `.mdc` for Cursor agents

### When Using Plan Mode

- **Review Before Approval**: Always review generated plans
- **Update Plans**: Create plan v2 if requirements change
- **Store Plans**: Plans saved to `.cursor/plans/` automatically
- **Link to Issues**: Reference plans in GitHub/Linear issues

### When Working with Rules

- **Glob Patterns**: Rules loaded based on file patterns
- **Stack Profiles**: Manifest defines which rules load for which stack
- **Test Changes**: Always test rule changes in isolation
- **No Duplication**: Don't duplicate rules across multiple files

## Escalation Criteria

If any of these occur, escalate to appropriate agent:

- **Technical Block**: Consult Architect agent
- **Requirements Conflict**: Engage PM or PO agent
- **Quality Concerns**: Involve QA agent
- **Security Question**: Review with security guidelines first, then escalate
- **User Concerns**: Address directly and transparently

## Success Metrics

Work is considered done when:

- ✅ All checklist items completed
- ✅ Code review approved (if required)
- ✅ Tests passing in CI/CD
- ✅ Deployment successful (if applicable)
- ✅ Stakeholder sign-off obtained (if required)
