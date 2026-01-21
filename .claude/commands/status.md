---
description: Show current run/job status + recent events (built-in quick observability).
---

Use `Bash` to run these commands and summarize the results in 6–10 lines:

1. `node .claude/tools/resume-status.mjs --json`
2. `node .claude/tools/events-tail.mjs --lines 60`

If `resume-status` reports a `run_id`, also run:

3. `node .claude/tools/workflow-dashboard.mjs --run-id <run_id>`

In your summary, include:

- whether anything is running, stalled, failed, or interrupted
- the most recent agent/tool activity
- the next best action to get the run unstuck (resume, retry, inspect logs, or rerun diagnostics)
