# Ship-Readiness (UI-Safe)

Paste into Claude Code at repo root.

We're preparing a release of this workspace. Run a **ship-readiness audit** and produce an auditable report.

Requirements:

- Route first (router-first enforcement), then hand off to the required coordinator.
- For stability, do **not** spawn specialist agents via `Task` for ship readiness (no `qa`, `security-architect`, etc.). Use the headless runner command instead.
- Stay strictly within this repo.

Do this:

1. Run: `pnpm ship-readiness:headless:json`
2. Verify using the exact `workflow_id` printed by step (1):
   - `node .claude/tools/verify-ship-readiness.mjs --workflow-id "<workflow_id from step 1 JSON>" --json`

If a Claude debug log path is available, run instead:

- `node .claude/tools/run-ship-readiness-headless.mjs --json --denial-test --debug-log "<path>"`

For a fuller release checklist (includes git-tracking verification + core agent integration), use:

- `.claude/prompts/ship-readiness-validation-headless.md`
