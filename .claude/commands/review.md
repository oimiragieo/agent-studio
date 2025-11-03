# Command: /review

Perform a comprehensive code review of recent changes.

## Steps

1. **Check Code Quality**
   - Verify code follows rules from `.claude/rules/`
   - Check adherence to project constitution standards
   - Validate against coding standards

2. **Verify Error Handling**
   - Ensure proper exception handling exists
   - Verify error messages are user-friendly
   - Check error logging is appropriate

3. **Ensure Tests Are Included**
   - Verify unit tests exist for new functionality
   - Check integration tests for API endpoints
   - Validate test coverage meets thresholds

4. **Review for Security Issues**
   - Check input validation and sanitization
   - Verify authentication and authorization
   - Review for common vulnerabilities (SQL injection, XSS, etc.)

5. **Documentation Review**
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

Use artifacts if the review is extensive.

