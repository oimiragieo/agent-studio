# Security Trigger System

Detailed documentation for the security trigger enforcement system.

## 12 Security Categories (136+ Keywords)

1. **Authentication & Authorization**: oauth, jwt, password, credentials, oidc, saml, rbac, acl, mfa, 2fa, biometric, sso, etc.
2. **Data Encryption & Privacy**: encrypt, decrypt, pii, sensitive, gdpr, ccpa, hipaa, personal data, anonymization, etc.
3. **Vulnerability Management**: sql injection, xss, csrf, directory traversal, buffer overflow, race condition, etc.
4. **API Security**: rate limiting, cors, authentication headers, api key management, api gateway, etc.
5. **Session Management**: session hijacking, cookie security, session timeout, token refresh, session fixation, etc.
6. **Network Security**: tls, ssl, https, firewall, network segmentation, vpn, dmz, etc.
7. **Code Injection**: eval, code execution, arbitrary code, remote code, deserialization, template injection, etc.
8. **Compliance & Auditing**: audit log, logging, traceability, compliance, certification, sox, pci-dss, etc.
9. **Dependency Security**: outdated, vulnerable, malware, supply chain, dependency scanning, sbom, etc.
10. **Input Validation**: validation, sanitization, input filtering, output encoding, parameterized queries, etc.
11. **Secrets Management**: api key, secret, token, credential, vault, key rotation, secrets scanning, etc.
12. **Access Control**: permission, authorization, privilege escalation, least privilege, role-based access, etc.

## How Security Triggers Work

1. **Keyword Scanning**: Task description is scanned for keywords in all 12 categories
2. **Agent Assignment**: Matching categories trigger required agent assignments
3. **Priority Calculation**: Single category = base priority; multiple categories = elevated priority
4. **Critical Combinations**: Specific keyword combinations (e.g., "sql injection" + "database") elevate priority to "critical"
5. **Blocking Decision**: If priority is "critical" and required agents missing → execution BLOCKED

## Agent Assignment by Category

- **Authentication & Authorization**: security-architect (required), developer (recommended)
- **Data Encryption & Privacy**: security-architect (required), compliance-auditor (recommended)
- **Vulnerability Management**: security-architect (required)
- **API Security**: security-architect (required), developer (recommended)
- **Session Management**: security-architect (required)
- **Network Security**: security-architect (required), devops (recommended)
- **Code Injection**: security-architect (required), code-reviewer (required)
- **Compliance & Auditing**: compliance-auditor (required), security-architect (recommended)
- **Dependency Security**: security-architect (required), devops (recommended)
- **Input Validation**: security-architect (required), developer (recommended)
- **Secrets Management**: security-architect (required), devops (recommended)
- **Access Control**: security-architect (required)

## Priority Levels and Blocking

- **critical**: BLOCKS execution if required agents missing; requires security-architect sign-off
- **high**: WARNING if agents missing; execution proceeds with caution flag
- **medium**: Logs warning only; no blocking
- **low**: Logs info only; no blocking

## Critical Combinations (Examples)

- "sql injection" + "database change" → critical
- "xss" + "user input" → critical
- "password" + "encryption" → high (not critical, but elevated)
- "oauth" + "authentication" → high

## Bypassing Security Blocks

Only orchestrator can override security blocks:
1. Requires documented justification
2. Requires security-architect approval
3. Requires compliance-auditor sign-off for critical priority
4. Override decision logged in run state with justification

## Configuration Files

- **Trigger Configuration**: `.claude/context/security-triggers-v2.json`
- **Enforcement Logic**: `.claude/tools/security-enforcement.mjs`
- **Validation Gate**: `.claude/tools/enforcement-gate.mjs`

## Validation Commands

**Check security triggers**:
```bash
node .claude/tools/enforcement-gate.mjs validate-security --task "<description>" [--agents <agent1,agent2>]
```

**Validate all gates (includes security)**:
```bash
node .claude/tools/enforcement-gate.mjs validate-all \
  --run-id <id> \
  --workflow <name> \
  --step <n> \
  --task "<description>" \
  --agents <agent1,agent2>
```

## Security-Sensitive Workflows

- `auth-flow.yaml`: Automatically includes security-architect
- `data-protection-flow.yaml`: Includes security-architect and compliance-auditor
- `legacy-modernization-flow.yaml`: Includes security-architect for breaking changes
- Any workflow with security keywords
