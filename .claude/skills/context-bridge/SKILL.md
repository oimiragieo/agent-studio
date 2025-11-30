---
name: context-bridge
description: Synchronize task state and metadata across Claude, Cursor, and Factory Droid sessions. Use when handing off tasks between platforms, sharing plans, or updating external trackers like Linear or Jira.
allowed-tools: linear_read, linear_write, github_read, github_write, slack_write
---

# Context Bridge

This skill ensures that "memory" is preserved when switching between different AI agents or platforms.

## Instructions

1. **Identify Handoff**: When a user indicates they are switching platforms (e.g., "I'll finish this in Cursor"), invoke this skill.
2. **Persist State**: Save the current plan, active artifacts, and next steps to `.claude/context/state.json`.
3. **Update Trackers**: If a ticket ID is present, update the external status (Linear/GitHub).
4. **Notify**: Send a summary to the appropriate channel if requested.

## Supported Integrations

- **Linear**: Read/Write issues.
- **GitHub**: Read repo context, update PRs/Issues.
- **Slack**: Send notifications to team channels.

## Best Practices

- **Always** update the central state file before sending notifications.
- **Never** overwrite existing state without reading it first to preserve history.
