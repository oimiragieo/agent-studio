# Ship-Readiness Validation (Headless, Copy/Paste)

Use this prompt in Claude Code at repo root. It avoids multi-agent UI workflows and uses the repo’s headless harnesses instead.

Run a ship-readiness validation for this workspace using the repo’s built-in headless harness (do not run multi-agent UI workflows).

Requirements:

- Stay strictly within this workspace.
- Actually run the tooling (don’t describe).
- Do NOT invent or pre-generate a `workflow_id`.
  - Treat the headless harness `workflow_id` as authoritative and use it for all follow-on steps.
- Outputs must be written only under `.claude/context/` (the harness already does this).

Do:

1. Run: `pnpm ship-readiness:headless:json`
   - Capture the printed JSON and extract `workflow_id` from it (this id is the one to use everywhere).
2. Verify using that exact id:
   - `node .claude/tools/verify-ship-readiness.mjs --workflow-id <workflow_id> --json`
3. Run core agent integration headless:
   - `pnpm integration:headless:json`
4. Confirm run artifacts are not tracked by git:
   - `git ls-files -- .claude/context/artifacts/testing .claude/context/reports`
     - Expected output: empty (no tracked files)
   - `git status --porcelain=v1 --ignored .claude/context | head -40`
     - Expected: `!!` entries for `artifacts/testing`, `reports`, `runtime`, etc.
   - Optional spot-check:
     - `git status --porcelain=v1 --ignored .claude/context | grep -E '(artifacts/testing|reports)' | head -20`
       - Expected: `!! .claude/context/artifacts/testing/` and `!! .claude/context/reports/`

If a Claude debug log path is available, run ship-readiness with it:

- `node .claude/tools/run-ship-readiness-headless.mjs --json --denial-test --debug-log "<path>"`

If any step fails, stop and report the failing command and the log path under `.claude/context/artifacts/testing/<workflow_id>-logs/`.
