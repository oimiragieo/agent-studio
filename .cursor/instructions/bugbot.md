# Bugbot Usage Guide

Cursor's Bugbot is an automated bug detection and fixing system that can help identify and resolve issues in your codebase.

## When to Use Bugbot

- Automatic bug detection after code changes
- Pre-commit bug scanning
- Continuous code quality monitoring
- Integration with CI/CD pipelines

## Configuration

Bugbot can be configured in Cursor settings to:

- Run automatically on file save
- Scan specific file types
- Exclude certain directories
- Define severity thresholds

## Integration with Agents

Agents can leverage Bugbot by:

- Running Bugbot scans as part of quality gates
- Reviewing Bugbot findings during code review
- Auto-fixing issues flagged by Bugbot (if safe)

## Best Practices

- Review Bugbot findings before auto-applying fixes
- Use Bugbot in combination with manual code review
- Configure severity levels appropriate for your project
- Integrate Bugbot findings into quality gate decisions
