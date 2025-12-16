# Audit Logs

This folder contains audit logs and decision records.

## Structure

```
audit/
├── decisions/    # Architecture Decision Records (ADRs)
├── changes/      # Change logs
└── reviews/      # Review history
```

## Usage

Audit logs are automatically generated during agent operations.
Used for compliance, debugging, and process improvement.

## Retention

- Keep logs for 90 days active
- Archive older logs
- Purge after 1 year (unless compliance requires longer)
