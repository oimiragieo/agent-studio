# Cursor Security Guidelines

Security boundaries and safe operation practices for Cursor agents.

## Protected Files

**NEVER** allow agents to modify:
- `.env*` files (environment variables)
- `secrets/` directory
- `*.pem`, `*.key` files (private keys)
- Production configuration files

## Blocked Commands

The following commands are automatically blocked:
- `rm -rf *` (dangerous deletion)
- `sudo rm` (privileged deletion)
- `format *` (disk formatting)
- `dd *` (raw disk operations)
- `mkfs *` (filesystem creation)

## Require Confirmation

These operations require explicit user confirmation:
- `git push --force` or `git push -f`
- `npm publish` (package publishing)
- Database drop operations
- Infrastructure destruction commands

## Terminal Safety

- Limit terminal access to specific agents (Developer, QA)
- Review terminal commands before execution
- Use command whitelists where possible
- Monitor terminal output for sensitive data

## Agent-Specific Security

### Developer Agent
- Can edit code files
- Cannot modify `.env` or secrets
- Requires confirmation for destructive operations

### QA Agent
- Can run tests and read files
- Cannot modify production code
- Can execute test commands only

### Architect Agent
- Read-only access (documentation)
- Cannot execute code or commands
- Can reference codebase for design decisions

## Best Practices

1. **Review before approve**: Always review agent-generated commands
2. **Principle of least privilege**: Limit agent tool access to minimum needed
3. **Audit logs**: Review agent action logs regularly
4. **Environment separation**: Use different configurations for dev/staging/prod

## Configuration

Security settings are defined in `.cursor/settings.json`:
- `security.blockedCommands`: List of blocked command patterns
- `security.protectedFiles`: File patterns that cannot be edited
- `security.requireConfirmation`: Commands requiring approval

