---
description: Comprehensive code review of recent changes
agent: code-reviewer
---

# Code Review

## Step 1: Get Changes
!`git diff --stat HEAD~1`

## Step 2: Check Code Quality
- Verify code follows project standards (AGENTS.md)
- Check adherence to coding conventions
- Validate against ESLint rules

## Step 3: Verify Error Handling
- Ensure proper exception handling exists
- Verify error messages are user-friendly
- Check error logging is appropriate

## Step 4: Ensure Tests Are Included
- Verify unit tests exist for new functionality
- Check integration tests for API endpoints
- Validate test coverage

## Step 5: Review for Security Issues
- Check input validation and sanitization
- Verify authentication and authorization
- Review for common vulnerabilities (SQL injection, XSS)
- Ensure no secrets are committed

## Step 6: Documentation Review
- Verify code is properly documented
- Check that complex logic has comments
- Ensure README/docs are updated if needed

## Output Format
Provide a structured review with:
- Summary of findings
- Critical issues (must fix)
- Suggestions (nice to have)
- Security concerns
- Test coverage assessment
- Verdict: APPROVE / REQUEST_CHANGES / COMMENT
