# Permissions Policy

This document defines permission levels and access controls for agents in the Omega AI Platform.

## Default Posture

**Principle of Least Privilege**

- Start with minimal permissions
- Grant additional access only when needed
- Prefer read over write
- Prefer search over edit
- Require review for destructive operations

## Role-Based Permissions

### Analyst/Writer Agents

**Primary Function**: Research, documentation, analysis

**Allowed**:

- Read all project files
- Search codebase
- Access documentation
- View git history

**Not Allowed**:

- Edit code files
- Execute bash commands
- Modify configuration
- Access secrets

### Developer Agents

**Primary Function**: Code implementation

**Allowed**:

- Read all project files
- Edit code files
- Run tests
- Execute safe bash commands
- View git history

**Restricted**:

- No access to secrets/credentials
- No destructive operations
- No production access
- Limited bash commands

**Bash Whitelist**:

```bash
# Allowed
npm install
npm run build
npm test
git status
git diff
git log

# Not Allowed
rm -rf
sudo
curl | bash
```

### Ops/Security Agents

**Primary Function**: Infrastructure, security, deployment

**Allowed**:

- Read all files including config
- Edit configuration files
- Edit documentation
- Diagnostic bash commands
- View infrastructure state

**Restricted**:

- No destructive operations without approval
- No direct production changes
- No credential modifications
- Audit logging required

### QA Agents

**Primary Function**: Testing, quality assurance

**Allowed**:

- Read all project files
- Run test suites
- Generate test reports
- Access test environments

**Restricted**:

- No code modifications
- No production access
- Test data only (no real data)

## Blocked Operations

### Always Blocked

- Force pushes to main/master
- Destructive git operations (reset --hard)
- Database drops on production
- Broad chmod/chown operations
- Executing unreviewed network scripts

### Require Approval

- Schema/database migrations
- Authentication/authorization changes
- Production-like infrastructure changes
- Security configuration changes
- Credential rotation

## Approval Workflows

### Standard Approval

1. Agent requests permission
2. User reviews operation
3. User approves or denies
4. Operation proceeds or aborts

### Elevated Approval

1. Agent requests permission with justification
2. Notification sent to user
3. User reviews with additional context
4. Approval or denial with notes
5. Audit log entry created

## Audit Requirements

### What to Log

- All tool invocations
- Permission escalations
- Blocked operations
- Approval decisions
- Sensitive file access

### Log Format

```json
{
  "timestamp": "2025-01-01T10:00:00Z",
  "agent": "developer",
  "operation": "bash",
  "command": "npm install lodash",
  "status": "allowed",
  "reason": "whitelisted command"
}
```

### Retention

- Keep audit logs for 90 days
- Archive to cold storage after
- Purge after 1 year
- Exceptions for compliance

## Environment Restrictions

### Development

- Full developer permissions
- Relaxed guardrails
- Local execution only

### Staging

- Standard permissions
- Full guardrails
- Shared resources

### Production

- Read-only by default
- Elevated approval required
- Full audit logging
- No direct access

## Custom Roles

Organizations can define custom roles:

```yaml
roles:
  junior_developer:
    extends: developer
    restrictions:
      - no_database_access
      - no_config_edits
      - review_required_for_commits

  senior_developer:
    extends: developer
    additional:
      - config_edits
      - database_read
      - deployment_staging

  security_reviewer:
    extends: ops
    additional:
      - security_config_read
      - audit_log_access
    restrictions:
      - no_code_edits
```

## Integration Points

### Pre-Tool Hook

Check permissions before tool execution:

```javascript
async function checkPermission(agent, tool, args) {
  const role = getAgentRole(agent)
  const allowed = isOperationAllowed(role, tool, args)

  if (!allowed) {
    throw new PermissionDeniedError(...)
  }
}
```

### Post-Tool Hook

Audit after execution:

```javascript
async function auditOperation(agent, tool, args, result) {
  await logAuditEntry({
    agent,
    tool,
    args: sanitize(args),
    result: result.status,
    timestamp: new Date(),
  });
}
```

---

_Adapt this policy to your organization's security requirements. Keep it co-located with guardrails and agent instructions._
