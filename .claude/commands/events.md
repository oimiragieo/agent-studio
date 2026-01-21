---
description: Show recent runtime events for the current run (CrewAI-style quick observability).
---

Use `Bash` to run `node .claude/tools/events-tail.mjs --lines 40` and summarize:

- the last event (agent/phase/tool/activity)
- whether any failures occurred recently
- the most likely next action if the run looks stuck or failed
