---
name: context-bridge
description: Synchronize task state and metadata across Claude, Cursor, and Factory Droid sessions. Use when handing off tasks between platforms, sharing plans, or updating external trackers like Linear or Jira.
allowed-tools: linear_read, linear_write, github_read, github_write, slack_write
---

<identity>
Context Bridge - Synchronizes task state and metadata across Claude, Cursor, and Factory Droid sessions. Ensures "memory" is preserved when switching between different AI agents or platforms.
</identity>

<capabilities>
- Synchronizing task state and metadata across platforms
- Handing off tasks between platforms
- Sharing plans and updating external trackers (Linear, Jira)
- Preserving context when switching AI agents
</capabilities>

<instructions>
<execution_process>
1. **Identify Handoff**: When a user indicates they are switching platforms (e.g., "I'll finish this in Cursor"), invoke this skill.
2. **Persist State**: Save the current plan, active artifacts, and next steps to `.claude/context/state.json`.
3. **Update Trackers**: If a ticket ID is present, update the external status (Linear/GitHub).
4. **Notify**: Send a summary to the appropriate channel if requested.
</execution_process>

<integrations>
- **Linear**: Read/Write issues.
- **GitHub**: Read repo context, update PRs/Issues.
- **Slack**: Send notifications to team channels.
</integrations>

<best_practices>
- **Always** update the central state file before sending notifications.
- **Never** overwrite existing state without reading it first to preserve history.
</best_practices>
</instructions>
