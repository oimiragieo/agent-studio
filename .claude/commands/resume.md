---
description: Show current run/job status and help resume work after time away.
---

Use `Bash` to run `node .claude/tools/resume-status.mjs` and summarize:

- last run id/status/activity
- any interrupted runs
- any running/failed jobs

If there is a failed run or failed job, propose the next best action (retry, inspect logs, or resume).
