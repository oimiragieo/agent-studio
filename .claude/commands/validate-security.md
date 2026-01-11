# Validate Security

Runs comprehensive security validation using security-architect and compliance-auditor skills.

## Usage

`/validate-security [scope] [--compliance GDPR|HIPAA|SOC2]`

## Examples

- `/validate-security` - Full security scan
- `/validate-security src/auth/` - Validate authentication code
- `/validate-security --compliance GDPR` - Check GDPR compliance

## What It Does

1. Analyzes code for security vulnerabilities:
   - SQL injection
   - XSS (Cross-Site Scripting)
   - CSRF (Cross-Site Request Forgery)
   - Insecure dependencies
   - Hardcoded secrets
2. Validates compliance with standards
3. Generates security report with:
   - Critical issues (must fix)
   - High priority issues (should fix)
   - Medium priority issues (consider fixing)
   - Recommendations

## Security Categories Checked

- Authentication & Authorization
- Data Encryption
- Input Validation
- Secret Management
- API Security
- Dependency Vulnerabilities

## Compliance Standards

- **GDPR** - Data privacy regulations
- **HIPAA** - Healthcare data protection
- **SOC2** - Security controls
- **PCI-DSS** - Payment card industry

## Related Skills

- security-architect - Security architecture review
- compliance-auditor - Compliance validation
