---
description: Universal engineering protocols - code quality, git conventions, PR templates, and documentation standards
globs: **/*
priority: global
load_for_all_agents: true
---

# Engineering Protocol Master Rules

**Consolidated from**: code-guidelines, code-style-consistency, git-conventional-commit-messages, github-code-quality, pr-template, writing, how-to-documentation.

**Load globally** for all agents - these are universal engineering standards.

## Code Quality Standards

### General Principles

1. **Verify Information**: Always verify information before making changes. Don't make assumptions.
2. **File-by-File Changes**: Make changes systematically, one file at a time.
3. **Preserve Existing Code**: Don't delete or modify code unnecessarily. Preserve existing functionality.
4. **No Unnecessary Updates**: Avoid unnecessary confirmations, whitespace changes, or summarizing changes made.
5. **Explicit Variable Names**: Use descriptive, explicit variable names over short, ambiguous ones.
6. **No Magic Numbers**: Replace hardcoded values with named constants.
7. **Modular Design**: Prefer modular design for maintainability and reusability.
8. **Edge Cases**: Handle edge cases and include assertions to catch errors early.
9. **Error Handling**: Implement comprehensive error handling and logging.
10. **Security First**: Always consider security implications when writing code.

### Code Review Practices

- **No Apologies**: Don't use apologies in code comments or documentation.
- **No Unnecessary Confirmations**: Avoid asking for confirmation unless absolutely necessary.
- **Real File Links**: Provide real file links instead of placeholders like `x.md`.
- **Single Chunk Edits**: Use single chunk edits for clarity.
- **No Whitespace Suggestions**: Avoid suggesting whitespace-only changes.
- **Context-Aware**: Use context from generated files to provide feedback on edits.

### Performance and Security

- **Performance Prioritization**: Optimize for performance where appropriate.
- **Security Considerations**: Always consider security implications.
- **Version Compatibility**: Ensure code changes are compatible with project's specified language/framework versions.
- **Test Coverage**: Ensure adequate test coverage for new or modified code.

### Code Style Consistency

- **Analyze Existing Patterns**: Before generating code, analyze the codebase for existing patterns.
- **Match Project Style**: Generated code must match the established style and conventions of the project.
- **Naming Conventions**: Follow project-specific naming conventions.
- **Formatting**: Match existing code formatting (indentation, spacing, etc.).
- **Architecture Patterns**: Follow established architectural patterns in the codebase.

## Git Conventions

### Conventional Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

**Format**: `<type>(<scope>): <subject>`

**Types**:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries
- `ci`: Changes to CI configuration files and scripts
- `build`: Changes that affect the build system or external dependencies
- `revert`: Reverts a previous commit

**Examples**:

```
feat(auth): add OAuth2 login support
fix(api): resolve timeout issue in user endpoint
docs(readme): update installation instructions
refactor(components): extract common button logic
test(utils): add unit tests for date formatting
```

**Rules**:

- Use imperative, present tense ("add" not "added" or "adds")
- Don't capitalize the first letter
- No period (.) at the end
- Reference issues/PRs: `fix: resolve login issue (#123)`
- Use co-author trailer when AI assists: `Co-authored-by: AI Assistant <ai@example.com>`

### Branch Naming

- Feature branches: `feature/add-auth`, `feature/user-profile`
- Bug fixes: `fix/login-bug`, `fix/api-timeout`
- Hotfixes: `hotfix/security-patch`
- Documentation: `docs/update-readme`
- Create from `main` or `develop`

### Commit Best Practices

- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issues when applicable
- Don't commit secrets or sensitive data
- Review changes before committing (`git diff`, `git status`)

## Pull Request Standards

### PR Template Structure

Every PR must include:

1. **Description**: Clear description of what changes were made and why
2. **Type of Change**: Feature, bug fix, refactor, documentation, etc.
3. **Testing**: How the changes were tested
4. **Checklist**: Pre-merge checklist items
5. **Screenshots** (if UI changes): Before/after screenshots
6. **Related Issues**: Links to related issues or tickets

### PR Best Practices

- **Clear Title**: Descriptive title that explains the change
- **Complete Description**: Include context, motivation, and approach
- **Small PRs**: Keep PRs focused and reasonably sized
- **Review Ready**: Ensure code is ready for review (tests pass, linting passes)
- **Address Feedback**: Respond to review comments and make requested changes
- **Update Documentation**: Update relevant documentation with code changes

### PR Checklist

Before requesting review:

- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Security review completed (if applicable)
- [ ] Performance implications considered
- [ ] Breaking changes documented (if any)

## Documentation Standards

### Writing Style

**Voice and Tone**:

- Write like humans speak. Avoid corporate jargon and marketing fluff.
- Be confident and direct. Avoid softening phrases like "I think," "maybe," or "could."
- Use active voice instead of passive voice.
- Use positive phrasing—say what something _is_ rather than what it _isn't_.
- Say "you" more than "we" when addressing external audiences.
- Use contractions like "I'll," "won't," and "can't" for a warmer tone.

**Specificity and Evidence**:

- Be specific with facts and data instead of vague superlatives.
- Back up claims with concrete examples or metrics.
- Use realistic, product-based examples instead of `foo/bar/baz` in code.
- Make content concrete, visual, and falsifiable.

**Banned Words and Phrases**:

- Avoid: `a bit`, `a little`, `actually`, `agile`, `arguably`, `assistance` (use "help"), `attempt` (use "try"), `best practices` (use "proven approaches"), `blazing fast` (be specific), `business logic`, `cognitive load`, `commence` (use "start"), `delve` (use "go into"), `disrupt`, `facilitate` (use "help"), `game-changing` (be specific), `great`, `implement` (use "do"), `innovative`, `just`, `leverage` (use "use"), `mission-critical` (use "important"), `modern`, `numerous` (use "many"), `out of the box`, `performant` (use "fast and reliable"), `pretty/quite/rather/really/very`, `robust` (use "strong"), `seamless` (use "automatic"), `sufficient` (use "enough"), `thing` (be specific), `utilize` (use "use").

**Avoid LLM Patterns**:

- Replace em dashes (—) with semicolons, commas, or sentence breaks.
- Avoid starting with "Great question!", "You're right!", or "Let me help you."
- Don't use phrases like "Let's dive into..."
- Skip cliché intros like "In today's fast-paced digital world"
- Avoid phrases like "it's not just [x], it's [y]."
- Don't use self-referential disclaimers like "As an AI"
- Don't use high-school essay closers: "In conclusion," "Overall," or "To summarize."
- Avoid numbered lists where bullets work better.
- Don't end with "Hope this helps!" or similar closers.

### How-To Documentation

**Structure**:

1. **Title**: Clear, specific title that describes what the user will learn
2. **Introduction**: Brief overview of what the document covers
3. **Prerequisites**: What the user needs before starting
4. **Steps**: Numbered, step-by-step instructions
5. **Troubleshooting**: Common issues and solutions
6. **Related Resources**: Links to related documentation

**Best Practices**:

- Use user-friendly language (avoid technical jargon)
- Include screenshots or visual references when helpful
- Test all steps to ensure accuracy
- Update documentation when features change
- Use consistent formatting and structure
- Make instructions actionable and specific

### Code Documentation

- **Comments**: Explain "why" not "what" (code should be self-documenting)
- **Function Documentation**: Document parameters, return values, and exceptions
- **API Documentation**: Include examples and use cases
- **README Files**: Keep README files up-to-date with setup and usage instructions

## Code Style Consistency

### Style Analysis Framework

When adding new code to an existing project:

1. **Analyze Representative Files**: Examine 3-5 representative files from the codebase
2. **Identify Patterns**: Document naming conventions, formatting, structure patterns
3. **Create Style Profile**: Document identified conventions
4. **Match Patterns**: Generate new code that matches existing patterns
5. **Verify Consistency**: Check that new code integrates seamlessly

### Style Profile Template

Document these aspects:

- **Naming Conventions**: Variables, functions, classes, files, directories
- **Formatting**: Indentation, spacing, line length, brace style
- **Structure**: File organization, import order, export patterns
- **Architecture**: Component patterns, state management, data flow
- **Dependencies**: Library usage, framework patterns

### Consistency Best Practices

1. **Analyze Before Generating**: Always analyze existing code patterns first
2. **Match Existing Style**: Generated code must match project style exactly
3. **Preserve Patterns**: Don't introduce new patterns unless necessary
4. **Adapt Existing Code**: When updating code, maintain its original style
5. **Document Deviations**: If deviating from style, document why
6. **Review for Consistency**: Always review generated code for style consistency
7. **Use Linters**: Configure linters to enforce style automatically
8. **Team Alignment**: Ensure all team members follow the same style guide

## Quality Gates

### Pre-Commit Checks

- Code compiles without errors
- All tests pass
- Linting passes
- Type checking passes (if TypeScript)
- No console.log statements (use proper logging)
- No commented-out code
- No TODO comments without tickets

### Pre-Merge Checks

- Code review approved
- All CI checks pass
- Documentation updated
- Breaking changes documented
- Migration guides provided (if needed)
- Security review completed (if applicable)

## Testing Standards

### Test Coverage

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test critical user flows
- **Coverage Target**: Aim for 80%+ coverage on critical paths

### Test Best Practices

- Write tests before or alongside code (TDD when possible)
- Test behavior, not implementation
- Use descriptive test names
- Keep tests isolated and independent
- Mock external dependencies
- Test edge cases and error scenarios

## Security Standards

### General Security

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs
- Implement proper authentication and authorization
- Keep dependencies up to date
- Review security implications of all changes

### Code Security

- Avoid SQL injection (use parameterized queries)
- Prevent XSS attacks (sanitize outputs)
- Implement CSRF protection
- Use HTTPS in production
- Implement proper CORS policies
- Follow OWASP Top 10 guidelines

## Migration Notes

This master file consolidates rules from:

- `code-guidelines-cursorrules-prompt-file`
- `code-style-consistency-cursorrules-prompt-file`
- `git-conventional-commit-messages`
- `github-code-quality-cursorrules-prompt-file`
- `pr-template-cursorrules-prompt-file`
- `writing.md`
- `how-to-documentation-cursorrules-prompt-file`

**Old rule files can be archived** - this master file is the single source of truth for engineering protocols.
