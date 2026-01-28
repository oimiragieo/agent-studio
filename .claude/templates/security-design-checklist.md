# Security-First Design Checklist

**Purpose**: Prevent "security as afterthought" antipattern by asking "What could go wrong?" during Phase E (Evaluate) of the EVOLVE workflow.

**When to Use**: Every time a new agent, skill, workflow, hook, schema, or template is being created.

**How to Use**: Work through each STRIDE category and answer the relevant questions BEFORE creating the artifact.

---

## STRIDE Threat Model

STRIDE is a threat modeling framework that helps identify security risks systematically. For each category below, ask: **"What could go wrong?"**

### S - Spoofing (Identity)

**Threat**: Can someone impersonate a user, agent, or system component?

**Questions**:
1. Does this artifact handle authentication credentials or tokens?
2. Could an attacker fake their identity to gain unauthorized access?
3. Are agent identities verified before spawning or delegation?
4. Does this artifact trust input from external sources without validation?
5. Are API keys, tokens, or secrets properly managed (not hardcoded)?

**Mitigations**:
- Validate authentication tokens before processing
- Use environment variables for secrets (never hardcode)
- Implement agent identity verification in spawn prompts
- Sanitize all external inputs (user input, API responses, file contents)

**OWASP Reference**: [A07:2021 – Identification and Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)

---

### T - Tampering (Data Integrity)

**Threat**: Can someone modify data or code without authorization?

**Questions**:
1. Does this artifact write to files? Can path traversal attacks occur?
2. Are file paths validated against whitelists?
3. Could template injection or code injection happen?
4. Are inputs sanitized before being used in commands, queries, or templates?
5. Can configuration files or schemas be tampered with?

**Mitigations**:
- Validate all file paths within allowed directories (e.g., `.claude/templates/`)
- Reject path traversal patterns (`..`, `//`, `\\`)
- Sanitize inputs before template rendering or command execution
- Use JSON Schema validation for configuration integrity
- Implement atomic writes with rollback for critical files

**OWASP Reference**: [A03:2021 – Injection](https://owasp.org/Top10/A03_2021-Injection/)

---

### R - Repudiation (Audit & Logging)

**Threat**: Can someone deny performing an action?

**Questions**:
1. Are sensitive operations logged for audit trails?
2. Is it clear which agent/user performed an action?
3. Are task status updates properly tracked (TaskUpdate protocol)?
4. Can we trace artifact creation back to the original request?
5. Are security events (failures, access denials) logged?

**Mitigations**:
- Log all artifact creation events to evolution-state.json
- Use TaskUpdate with metadata for action attribution
- Record ADRs for significant decisions (decisions.md)
- Implement audit logs for security-sensitive operations
- Include timestamps and agent identifiers in all logs

**OWASP Reference**: [A09:2021 – Security Logging and Monitoring Failures](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)

---

### I - Information Disclosure (Confidentiality)

**Threat**: Can someone access information they shouldn't see?

**Questions**:
1. Does this artifact handle sensitive data (credentials, PII, secrets)?
2. Are error messages verbose enough to leak implementation details?
3. Could logs or debug output expose sensitive information?
4. Are temporary files or caches properly cleaned up?
5. Does this artifact expose internal file paths or system details?

**Mitigations**:
- Never log sensitive data (passwords, tokens, API keys)
- Use generic error messages for user-facing errors
- Sanitize file paths in logs (use relative paths from PROJECT_ROOT)
- Clean up temporary files after use
- Validate schema examples don't contain real secrets
- Use `.gitignore` for sensitive files

**OWASP Reference**: [A01:2021 – Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

---

### D - Denial of Service (Availability)

**Threat**: Can someone make the system unavailable or unresponsive?

**Questions**:
1. Can this artifact be exploited for resource exhaustion (infinite loops, memory leaks)?
2. Are there limits on input size (file uploads, token counts)?
3. Can malicious input cause crashes or hangs?
4. Does this artifact spawn unbounded numbers of agents or tasks?
5. Are there safeguards against recursive or circular dependencies?

**Mitigations**:
- Implement input size limits (max tokens, max file size)
- Add timeouts for long-running operations
- Use circuit breakers for external API calls
- Limit agent spawn depth (prevent infinite recursion)
- Validate dependencies for circular references

**OWASP Reference**: [Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)

---

### E - Elevation of Privilege (Authorization)

**Threat**: Can someone gain unauthorized permissions or capabilities?

**Questions**:
1. Does this artifact enforce least privilege (minimal permissions)?
2. Can an agent escalate privileges by spawning other agents?
3. Are tool permissions properly restricted (allowed_tools whitelist)?
4. Does this artifact bypass security gates or hooks?
5. Can environment variables or configuration be manipulated to gain elevated access?

**Mitigations**:
- Define minimal `allowed_tools` for each agent spawn
- Enforce routing-guard.cjs for tool restrictions
- Validate agent permissions before delegation
- Use hooks to enforce security policies (cannot be bypassed)
- Document privilege requirements in agent definitions

**OWASP Reference**: [A04:2021 – Insecure Design](https://owasp.org/Top10/A04_2021-Insecure_Design/)

---

## Security Controls Reference

After answering STRIDE questions, check if existing security controls apply:

### Existing Controls

| Control ID          | Description                                     | Location                                      |
| ------------------- | ----------------------------------------------- | --------------------------------------------- |
| **SEC-SPEC-002**    | Path validation (whitelist `.claude/` paths)   | template-renderer skill                       |
| **SEC-SPEC-003**    | Token whitelist validation                      | template-renderer skill                       |
| **SEC-SPEC-004**    | Input sanitization (XSS protection)             | template-renderer skill                       |
| **SEC-CATALOG-001** | File path validation for catalogs               | Template catalog, security registry           |
| **SEC-CATALOG-002** | Path traversal rejection (`..`, `//`, `\\`)     | Template catalog, security registry           |
| **ROUTING-001**     | Tool whitelist enforcement                      | routing-guard.cjs                             |
| **ROUTING-002**     | Security review enforcement                     | routing-guard.cjs                             |
| **CREATOR-001**     | Artifact output path validation                 | unified-creator-guard.cjs                     |
| **PLANNER-001**     | Complexity-based task creation guard            | routing-guard.cjs (planner-first enforcement) |

**Reference**: `.claude/context/artifacts/security-controls-catalog.md` (created in Sprint 3, Enhancement #8)

### New Controls Needed?

If STRIDE analysis reveals gaps, create new security controls:

1. **Document** the threat and mitigation in security-controls-catalog.md
2. **Assign** a control ID (SEC-XXX-YYY format)
3. **Implement** the control in appropriate hooks or validators
4. **Test** the control with both valid and attack scenarios
5. **Reference** the control in relevant agent/skill documentation

---

## Integration with EVOLVE Workflow

### Phase E (Evaluate) - Security-First Checkpoint

**BEFORE** confirming gap and proceeding to Phase V (Validate):

1. **Read** this security-design-checklist.md
2. **Answer** all STRIDE questions for the proposed artifact
3. **Document** security considerations in Phase 0 research report
4. **Identify** which existing controls apply
5. **Create** new controls if gaps found

**Output**: Security assessment section in research report with:
- STRIDE threat analysis (which categories apply)
- Existing controls that will be used
- New controls to be implemented (if any)
- Mitigation strategies for identified threats

### Example Security Assessment

```markdown
## Security Assessment (STRIDE)

**Artifact**: template-renderer skill

### S - Spoofing
- N/A (no authentication handled)

### T - Tampering
- **Threat**: Template injection attacks
- **Mitigation**: SEC-SPEC-003 (token whitelist), SEC-SPEC-004 (input sanitization)

### R - Repudiation
- **Threat**: No audit trail for template usage
- **Mitigation**: NEW CONTROL (SEC-TEMPLATE-001) - Log template rendering events

### I - Information Disclosure
- **Threat**: Sensitive data in template examples
- **Mitigation**: Review all template examples, redact secrets

### D - Denial of Service
- **Threat**: Large template files causing memory exhaustion
- **Mitigation**: Add file size limit (1MB max)

### E - Elevation of Privilege
- **Threat**: Template paths escaping allowed directories
- **Mitigation**: SEC-SPEC-002 (path whitelist validation)

**Controls Created**: 1 new (SEC-TEMPLATE-001)
**Controls Reused**: 3 existing (SEC-SPEC-002, SEC-SPEC-003, SEC-SPEC-004)
```

---

## OWASP Top 10 Quick Reference

For deeper security analysis, cross-reference with OWASP Top 10:

1. **A01:2021 – Broken Access Control** → STRIDE: I (Information Disclosure), E (Elevation of Privilege)
2. **A02:2021 – Cryptographic Failures** → STRIDE: I (Information Disclosure)
3. **A03:2021 – Injection** → STRIDE: T (Tampering)
4. **A04:2021 – Insecure Design** → STRIDE: E (Elevation of Privilege), D (Denial of Service)
5. **A05:2021 – Security Misconfiguration** → STRIDE: E (Elevation of Privilege), D (Denial of Service)
6. **A06:2021 – Vulnerable Components** → All STRIDE categories
7. **A07:2021 – Authentication Failures** → STRIDE: S (Spoofing)
8. **A08:2021 – Software/Data Integrity** → STRIDE: T (Tampering), R (Repudiation)
9. **A09:2021 – Logging Failures** → STRIDE: R (Repudiation)
10. **A10:2021 – SSRF** → STRIDE: T (Tampering), I (Information Disclosure)

**Full Guide**: https://owasp.org/Top10/

---

## Related Documentation

- **Security Architect Skill**: `.claude/skills/security-architect/SKILL.md`
- **Security Audit Workflow**: `.claude/workflows/security-architect-skill-workflow.md`
- **Security Controls Catalog**: `.claude/context/artifacts/security-controls-catalog.md` (Sprint 3)
- **Verification Before Completion**: `.claude/skills/verification-before-completion/SKILL.md`

---

**Usage Note**: This checklist is invoked during EVOLVE Phase E (Evaluate). It is MANDATORY for all artifact creation to prevent "security as afterthought" antipattern.
