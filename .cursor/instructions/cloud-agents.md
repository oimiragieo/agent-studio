# Cloud Agents Playbook

Cloud Agents let Cursor continue long-running work in the cloud, Slack, Linear, or GitHub so you can disconnect locally [5].

## When to Use

- Regression suites or code generation expected to run >10 minutes.
- Multi-agent projects where PM/QA need visibility without opening the IDE.
- After-hours monitoring for production hotfixes.

## Steps

1. In the agent panel, choose **Cloud Agent** and select the integration (Cursor Web, Slack, Linear, GitHub).
2. Provide the plan link or artifact reference plus success criteria.
3. Monitor progress via integration notifications; Cloud Agents post diff previews and test logs back to the chat.
4. When complete, sync the transcript to Claude Projects for archival.

[5] Cursor, "Cloud Agents" (Oct 30, 2025).
