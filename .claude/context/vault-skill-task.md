# Task: Create vault-secrets Skill

## Objective
Create `.claude/skills/vault-secrets/SKILL.md` following the established skill documentation pattern.

## Requirements

### File Structure
Follow the terraform-infra skill format with YAML frontmatter and structured sections.

### Content Requirements

**YAML Frontmatter**:
```yaml
---
name: vault-secrets
description: HashiCorp Vault secrets management
allowed-tools: [Bash, Read]
---
```

**Tool Categories to Include**:
1. **Secret Operations**: kv-get, kv-put, kv-delete, kv-list
2. **Authentication**: token-lookup, auth-list, login
3. **Policies**: policy-list, policy-read
4. **PKI**: pki-issue, pki-revoke

**Security Constraints**:
- BLOCKED commands: `operator seal`, `operator step-down`, `secrets disable`
- NEVER log secret values in output
- All write/delete operations require confirmation

**Agent Integration**:
- Primary agents: security-architect, devops

## Acceptance Criteria
- [ ] File created at `.claude/skills/vault-secrets/SKILL.md`
- [ ] YAML frontmatter includes name, description, allowed-tools
- [ ] All tool categories documented
- [ ] Security constraints clearly specified
- [ ] Agent integration documented
- [ ] Follows existing skill documentation patterns

## Reference
See `.claude/skills/terraform-infra/SKILL.md` for format example.
