---
description: Security audit of the codebase
agent: security
---

# Security Audit

Perform a comprehensive security review of the Omega codebase.

## Audit Scope

### Authentication & Authorization
- JWT implementation in `server/middleware/auth.js`
- Session management
- API key handling
- Role-based access control

### Input Validation
- Request validation with Joi
- SQL injection prevention
- XSS prevention
- Path traversal checks

### Secrets Management
- Environment variables usage
- No hardcoded secrets
- `.env` not in git

### API Security
- Rate limiting in `server/middleware/rateLimiter.js`
- CORS configuration
- Helmet security headers

## Check Commands

**Search for potential secrets:**
!`rg -i "(password|secret|api.?key|token)" --type js -l`

**Check for console.log (may leak info):**
!`rg "console\.log" server/ --type js -c`

**Find SQL queries:**
!`rg "query\(|execute\(" server/ --type js -l`

## Output

Provide a security report with:
- Critical vulnerabilities
- High-risk issues
- Medium-risk issues
- Recommendations
- Compliance considerations
