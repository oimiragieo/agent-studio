# PR Creation Workflow

## Overview

Comprehensive PR creation workflow with quality gates before pushing to remote. This workflow ensures all code quality, security, and documentation standards are met before creating pull requests.

## Trigger

The orchestrator automatically triggers this workflow when the user says:

- "push PR"
- "create PR"
- "submit PR"
- "push the PR"
- "push PR with comments"

## Workflow Steps

### 1. Repository Cleanup (devops)

- Remove all temporary files in `.claude/context/tmp/`
- Clean build artifacts (node_modules/.cache, dist/, build/, out/)
- Verify .gitignore is respected
- List files to be committed

**Output**: `cleanup-report.txt`

### 2. Lint & Format Code (devops)

- **Prettier**: Formats all code files (.js, .mjs, .json, .md, .yaml, .yml)
- **ESLint**: Lints JavaScript files and auto-fixes issues
- Execute other configured linters
- Report non-fixable issues

**Output**: `lint-report.json`, `prettier-report.txt`

**Quality Gate**: All auto-fixable lint errors must be resolved, all files formatted with prettier

### 3. Security Review (security-architect)

- Review git diff for security vulnerabilities
- Check for hardcoded secrets or credentials
- Validate input sanitization in new code
- Review authentication/authorization changes
- Verify no sensitive data in logs
- Check for SQL injection, XSS, CSRF vulnerabilities

**Output**: `security-review-report.md`

**Quality Gate**: No critical security issues (BLOCKING)

### 4. Fix Issues (developer)

- Fix security issues from step 3
- Fix non-auto-fixable lint issues from step 2
- Re-run linters to verify fixes
- Request security re-review if needed

**Output**: `fix-report.md`

**Condition**: Only runs if issues found in steps 2 or 3

### 5. Update Documentation (technical-writer)

- Generate CHANGELOG entry from git diff
- Update README.md if public API changes detected
- Update architecture docs if structural changes detected
- Update user documentation if features added
- Verify all documentation links are valid
- Check documentation for clarity and completeness

**Output**:

- `CHANGELOG.md` (updated)
- `README.md` (if updated)
- `docs/` (if updated)
- `documentation-update-report.md`

**Quality Gate**: CHANGELOG entry created, documentation reflects all changes

### 6. Verify Tests (qa)

- Run all unit tests
- Run integration tests (if available)
- Run smoke tests
- Verify 100% test pass rate
- Check test coverage hasn't decreased

**Output**:

- `test-results.json`
- `coverage-report.html`

**Quality Gate**: All tests passing (BLOCKING)

### 7. Create Commits (devops)

- Stage all validated changes
- Create commits following conventional commit format
- Include detailed commit bodies
- Add Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
- Organize commits logically by feature/fix
- Reference issue numbers in commit messages

**Output**: `commit-summary.txt`

**Quality Gate**: All commits follow conventional format

### 8. Push & Create PRs (devops)

- Push all feature branches to remote
- Create PRs on GitHub using gh CLI
- Add PR descriptions from commit messages
- Add appropriate labels (enhancement, bug, docs, etc.)
- Add reviewers if configured
- Link PRs to issues if applicable

**Output**:

- `pr-urls.txt`
- `pr-summary-report.md`

**Quality Gate**: All branches pushed, all PRs created successfully

### 9. Generate Final Report (devops)

- Create comprehensive summary of PR creation
- List all PR URLs
- Document merge order recommendations
- Save report to `.claude/context/reports/`
- Display summary to user

**Output**: `.claude/context/reports/pr-creation-complete-report.md`

## Quality Gates

### Blocking (stops workflow if failed)

- ❌ **Critical security vulnerabilities** - Workflow will not proceed if found
- ❌ **Test failures** - Workflow will not proceed if tests fail

### Mandatory (must be addressed before completion)

- ⚠️ **Documentation updated** - CHANGELOG and relevant docs must be updated
- ⚠️ **All linting issues resolved** - Code must meet quality standards
- ⚠️ **No critical security issues** - All critical issues must be fixed

### Warnings (logged but not blocking)

- ℹ️ **Non-critical lint issues** - Minor style issues
- ℹ️ **Minor documentation gaps** - Non-essential documentation improvements

## Usage

### Automatic Invocation

The orchestrator will automatically invoke this workflow via the devops agent when appropriate. Simply say:

```
"Push PR with comments"
```

### Manual Invocation

You can manually run the workflow using the workflow runner:

```bash
node .claude/tools/workflow_runner.js --workflow .claude/workflows/pr-creation-workflow.yaml
```

### Step-by-Step Execution

To execute specific steps:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/pr-creation-workflow.yaml \
  --step 03-security
```

## Agents Involved

| Agent                  | Role                | Steps              |
| ---------------------- | ------------------- | ------------------ |
| **devops**             | Primary executor    | 01, 02, 07, 08, 09 |
| **security-architect** | Security validation | 03                 |
| **developer**          | Issue resolution    | 04                 |
| **technical-writer**   | Documentation       | 05                 |
| **qa**                 | Test verification   | 06                 |

## Output Artifacts

### Reports

- `.claude/context/reports/pr-creation-complete-report.md` - Final comprehensive report

### Per-Step Outputs

- `cleanup-report.txt` - Cleanup summary
- `lint-report.json` - Linting results
- `security-review-report.md` - Security findings
- `fix-report.md` - Issue fix summary
- `documentation-update-report.md` - Documentation changes
- `test-results.json` - Test results
- `coverage-report.html` - Test coverage report
- `commit-summary.txt` - Commit details
- `pr-urls.txt` - PR URLs
- `pr-summary-report.md` - PR creation summary

## Success Criteria

Workflow completes successfully when:

- ✅ All quality gates passed
- ✅ All PRs created successfully
- ✅ Zero critical issues remaining
- ✅ Documentation complete
- ✅ All tests passing
- ✅ No security vulnerabilities

## Rollback Strategy

### On Failure

1. Delete pushed branches (if push step failed)
2. Restore previous repository state
3. Clean up temporary artifacts
4. Report failure details to user

### Cleanup

- Remove all temporary files
- Restore backups if needed
- Document failure reason in failure report

## Best Practices

1. **Always run the full workflow** - Don't skip steps for thoroughness
2. **Review security report carefully** - Security issues can block deployment
3. **Ensure tests are up-to-date** - Write tests before running workflow
4. **Keep CHANGELOG updated** - Technical writer will generate entries, but review them
5. **Use conventional commit format** - Makes CHANGELOG generation easier

## Common Issues

### Lint Failures

- **Issue**: Non-fixable lint errors
- **Solution**: Developer agent fixes manually in step 04

### Security Blocks

- **Issue**: Critical security vulnerabilities found
- **Solution**: Workflow blocks; developer must fix issues before re-running

### Test Failures

- **Issue**: Tests fail in step 06
- **Solution**: Workflow blocks; fix tests before re-running

### Push Failures

- **Issue**: Branch push fails (conflicts, permissions)
- **Solution**: Resolve conflicts locally, ensure remote access permissions

## Integration with Enforcement System

This workflow integrates with the enforcement system:

- **Plan Rating**: Workflow execution plan must score ≥7/10 before starting
- **Security Triggers**: Automatically enforces security requirements
- **Signoff Matrix**: Requires security-architect signoff for security-sensitive changes

## See Also

- `.claude/workflows/WORKFLOW-GUIDE.md` - General workflow documentation
- `.claude/agents/devops.md` - DevOps agent documentation
- `.claude/agents/security-architect.md` - Security architect documentation
- `.claude/docs/ENFORCEMENT_EXAMPLES.md` - Enforcement system examples
