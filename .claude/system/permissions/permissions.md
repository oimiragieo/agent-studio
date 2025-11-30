### Permissions Policy (Config Pack)

- **Default Posture**: Least privilege. Prefer read/search over edit/bash. Require human review for code/infra/auth edits.
- **Role Scoping**:
  - Analyst/Writer: Read/Search only.
  - Developer: Read/Edit; Bash limited to safe commands; no secrets.
  - Ops/Security: Read/Edit config/docs; Bash for diagnostics; no destructive ops without approval.
- **Blocked**: Force pushes, destructive Git, DB drops, broad `chmod/chown`, unreviewed scripts from network.
- **Approval Points**: Schema/data changes, authz/authn changes, prod-like infra changes.
- **Audit**: Use hooks (`security-pre-tool.sh`, `audit-post-tool.sh`) to log tool use and block high-risk commands.

Adapt this document to your org; keep it co-located with hooks and agent instructions.
