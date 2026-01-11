# Guardrails Policy

This document defines safety guardrails for all agent operations in the Omega AI Platform.

## Command Safety

### Blocked Patterns

The following command patterns are blocked by default:

```bash
# Destructive file operations
rm -rf /
rm -rf *
rm -rf ~

# Disk operations
mkfs
dd if=
fdisk

# Privilege escalation
sudo rm
sudo chmod 777
sudo chown

# Network-based execution
curl | bash
wget | sh
curl | sh

# Force operations
git push --force
git push -f origin main
```

### Allowed with Confirmation

These require explicit user approval:

- `rm -rf` on specific directories (not root)
- `chmod` and `chown` operations
- Database drop/truncate commands
- Production deployments

### Safe Commands

These are allowed without restriction:

- Read operations (cat, less, head, tail)
- List operations (ls, find, grep)
- Git read operations (status, log, diff)
- Build commands (npm, yarn, make)
- Test commands (npm test, pytest)

## Secrets and PII Protection

### Never Commit

- API keys and tokens
- Passwords and credentials
- Private keys and certificates
- Connection strings with credentials

### Protected Files

These files require extra caution:

- `.env` and `.env.*` files
- `credentials.*` files
- `secrets.*` files
- SSH keys (`id_rsa`, `*.pem`)
- Certificate files (`*.crt`, `*.key`)

### PII Handling

- Redact personal information in logs
- Don't echo sensitive data to console
- Mask credentials in error messages
- Use placeholders in examples

## Protected Files

### Configuration Files

Require confirmation before editing:

- `package.json` (dependencies)
- `docker-compose.yml`
- CI/CD configuration files
- Kubernetes manifests

### Infrastructure Files

Require senior review:

- Terraform files
- CloudFormation templates
- Ansible playbooks
- Helm charts

### Authentication Files

Require security review:

- Auth configuration
- OAuth/OIDC settings
- RBAC policies
- API gateway config

## Output Discipline

### Source Citations

- Cite sources for non-trivial claims
- Reference documentation for APIs
- Link to official docs for frameworks
- Note when information may be outdated

### Avoiding Hallucination

- Don't invent API methods
- Verify package versions exist
- Check that imports are valid
- Test code before presenting

### Minimal Diffs

- Make targeted changes
- Avoid unnecessary reformatting
- Preserve existing patterns
- Document intentional changes

## Data Handling

### No Production Data

- Don't use real user data in prompts
- Create synthetic test data
- Anonymize any examples
- Use placeholder values

### Log Sanitization

- Strip identifiers from logs
- Remove IP addresses
- Mask email addresses
- Redact phone numbers

## Enforcement

### Pre-Execution Hooks

Before executing commands:

1. Check against blocked patterns
2. Identify sensitive operations
3. Request confirmation if needed
4. Log the operation

### Post-Execution Hooks

After operations:

1. Verify no secrets exposed
2. Check for unintended changes
3. Audit log updates
4. Alert on violations

## Violation Response

### Severity Levels

**Critical** - Immediate block and alert:

- Attempted access to sensitive files
- Destructive commands
- Credential exposure

**Warning** - Log and notify:

- Accessing protected directories
- Large-scale file operations
- Unusual patterns

**Info** - Log only:

- Normal operations
- Read-only access
- Safe commands

## Customization

Organizations should customize this policy by:

1. Adding org-specific blocked patterns
2. Defining protected file patterns
3. Setting up approval workflows
4. Configuring alerting thresholds

---

_This policy is enforced through hooks and agent instructions. Review and update regularly._
