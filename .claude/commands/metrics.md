---
description: Show tool timing + error metrics for the current run (no dashboard required).
---

Use `Bash` to run `node .claude/tools/metrics-summary.mjs` and summarize:

- top slow tools and top busy agents
- whether there are recent errors
- one actionable improvement (retry, reduce tool churn, or narrow scope)
