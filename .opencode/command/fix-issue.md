---
description: Analyze and fix a GitHub issue automatically
agent: developer
---

# Fix Issue: $ARGUMENTS

## Step 1: Fetch Issue Details
!`gh issue view $ARGUMENTS`

## Step 2: Understand the Problem
- Parse the issue description and comments
- Identify the root cause
- Check for related issues or PRs

## Step 3: Search Codebase
Find relevant files mentioned in the issue and search for similar patterns.

## Step 4: Implement Fix
- Make necessary code changes
- Follow project coding standards (see AGENTS.md)
- Ensure backward compatibility

## Step 5: Write Tests
- Add tests that verify the fix
- Include regression tests
- Ensure existing tests still pass

## Step 6: Verify Quality
- Run linter: `cd frontend && npm run lint`
- Run tests: `npm test`
- Check for security implications

## Step 7: Create Commit
- Reference issue number in commit message
- Follow conventional commit format

## Best Practices
- Understand the problem before coding
- Test locally before committing
- Keep changes focused and minimal
- Document non-obvious fixes
