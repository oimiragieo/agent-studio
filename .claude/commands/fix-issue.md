# Command: /fix-issue

Analyze and fix a GitHub issue automatically.

## Arguments
$ARGUMENTS - GitHub issue number or URL

## Workflow

1. **Fetch Issue Details**
   ```bash
   gh issue view $ARGUMENTS
   ```

2. **Understand the Problem**
   - Parse issue description and comments
   - Identify root cause
   - Check for related issues or PRs

3. **Search Codebase**
   - Find relevant files mentioned in issue
   - Search for similar problems or patterns
   - Identify impacted areas

4. **Implement Fix**
   - Make necessary code changes
   - Follow project coding standards
   - Ensure backward compatibility when possible

5. **Write Tests**
   - Add tests that verify the fix
   - Include regression tests
   - Ensure existing tests still pass

6. **Verify Quality**
   - Run linter and type checker
   - Ensure code follows rules from `.claude/rules/`
   - Check security implications

7. **Create Commit**
   - Write descriptive commit message
   - Reference issue number in commit
   - Follow project commit message conventions

8. **Prepare PR**
   - Push changes to feature branch
   - Create pull request
   - Link PR to original issue
   - Add appropriate reviewers

## Best Practices

- Always understand the problem before coding
- Test locally before committing
- Keep changes focused and minimal
- Document non-obvious fixes
- Consider edge cases and error scenarios

