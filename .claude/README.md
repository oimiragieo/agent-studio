# Claude Code Drop-In

Drop the contents of this folder into your project's root (`CLAUDE.md` alongside `.claude/`). Assets are organized around Claude Code's hierarchical loader, hook lifecycle, and MCP tooling. Updated instructions assume Claude 3.5 Sonnet with Artifacts, Projects, and extended tool-use announced mid-2024 [1][2].

## Key Capabilities

- **Artifacts-first workflows** so code, docs, and UI previews render side-by-side in Claude's artifact pane for iterative editing [1].
- **Projects-aware instructions** that preload shared knowledge, role guidance, and memory-safe defaults scoped per directory [2].
- **Lifecycle hooks** (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`) to enforce plan reviews, test execution, and artifact publishing.
- **Skills modules** that wrap MCP calls for repo search, context diffing, and artifact management.
- **Always-on observability** via a statusline + file-backed run tracking (`.claude/context/runtime/last-run.json`).
- **Durable long-running jobs** via `.claude/tools/job-daemon.mjs` (keeps running even if the interactive session stalls).

## Activation

1. Copy `CLAUDE.md` and the `.claude` contents into your repo root.
2. In Claude Code, open the workspace and confirm the hierarchy in the right-side navigator.
3. Claude Code auto-loads repo-scoped config from `.claude/settings.json` when you open the workspace.
4. Do **not** wire `router-session-entry.mjs` into Claude Code hooks; it targets `UserPromptSubmit` (not stable across Claude Code environments). This repo’s supported routing entrypoint is **router-first enforcement** + the `router` agent.
   - `.claude/hooks/hook-registry.json` is kept for legacy tooling/human reference, but `.claude/settings.json` is the authoritative Claude Code configuration here.
5. (Optional) Configure MCP servers in `.claude/.mcp.json` (set required env vars).

## Observability (No Manual Monitoring Required)

- **Statusline**: configured in `.claude/settings.json` to run `node .claude/hooks/statusline.mjs`.
  - Shows: model, current directory, last run status/activity, and job counts.
- **Resume/status command**: run `/resume` to print a compact summary from disk:
  - `node .claude/tools/resume-status.mjs`
- **Events command**: run `/events` to see recent run events (no separate watcher needed):
  - `node .claude/tools/events-tail.mjs --lines 40`
- **Metrics command**: run `/metrics` to see tool timing + recent errors (no dashboard required):
  - `node .claude/tools/metrics-summary.mjs`
- **One-shot bundle**: create an auditable snapshot (debug log + run artifacts):
  - `node .claude/tools/observability-bundle.mjs --debug-log "C:\\Users\\you\\.claude\\debug\\<session>.txt"`
- **Payloads (optional)**: if `CLAUDE_OBS_STORE_PAYLOADS=1`, `run-observer.mjs` writes sanitized tool inputs/outputs to `.claude/context/payloads/` and links them from events via `event.payload.payload_ref`.
- **Failure bundles (optional)**: if `CLAUDE_OBS_FAILURE_BUNDLES=1`, tool failures and denials create trace-linked bundles under `.claude/context/artifacts/failure-bundles/`.
- **Preventing Claude Code UI OOM**: by default this repo limits orchestrator subagent fan-out to keep the host process stable.
  - Default: `CLAUDE_MAX_ACTIVE_SUBAGENTS=1` (sequential Task spawns)
  - Override (faster but riskier): set `CLAUDE_MAX_ACTIVE_SUBAGENTS=4` before launching Claude Code
- **Instruments command**: run `/instruments` to list/run on-disk helpers (keeps prompts lean):
  - `node .claude/tools/instruments.mjs list`
- **Project command**: run `/project` to isolate runtime runs/jobs inside this repo:
  - `node .claude/tools/project.mjs use "my-feature"`
- **Durable jobs**: for multi-hour commands, start a job that persists state + logs:
  - `node .claude/tools/job-daemon.mjs start --name "pnpm test" -- "pnpm test"`
  - State/logs: `.claude/context/runtime/jobs/` and `.claude/context/runtime/jobs/logs/`

## Diagnostics Depth

`system-diagnostics.mjs` runs more than just `pnpm test`:

- Workflow dry-run validation across all workflows (`workflow_runner.js --dry-run`)
- `pnpm validate` plus deeper checks (`pnpm validate:workflow`, `pnpm validate:references`)

If you need a quicker run, add `--skip-deep-validate` (keeps core validate + workflow dry-run).

## Ship Readiness (Headless)

For release/ship readiness audits, prefer the headless runner (minimizes Claude Code UI memory pressure and produces auditable artifacts under `.claude/context/`):

- Run: `pnpm ship-readiness:headless:json`
- Verify: `node .claude/tools/verify-ship-readiness.mjs --workflow-id ship-readiness-v1-<YYYYMMDD-HHMMSS> --json`
- Workflow: `@.claude/workflows/ship-readiness-headless.yaml`

## Router Session Handler (Cost Optimization)

The Router Session Handler uses a lightweight Haiku classification layer to intercept user prompts before routing to the orchestrator. This provides 60-70% cost savings on average workloads.

**Key Features**:

- Automatic intent classification (< 100ms)
- Complexity-based routing decisions
- Direct Haiku handling for simple requests
- Orchestrator routing for complex tasks
- Comprehensive cost tracking

**Setup**:

1. Register router hook (step 4 above)
2. Configure complexity threshold in `.claude/settings.json`:
   ```json
   {
     "routing": {
       "complexity_threshold": 0.7
     }
   }
   ```

**Usage**: The router executes automatically on every user prompt. For manual testing:

```bash
# Test intent classification
node .claude/tools/router-session-handler.mjs classify "build a web app"

# Monitor session costs
node .claude/tools/router-session-handler.mjs get-summary session-id

# Clean old sessions
node .claude/tools/router-session-handler.mjs cleanup
```

**Documentation**: See [Router Session Handler Usage Guide](./docs/ROUTER_SESSION_HANDLER_USAGE.md)

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024) – doubled speed, state-of-the-art vision, real-time Artifacts workspace.  
[2] Anthropic, "Projects" (Jun 2024) – persistent team knowledge, instructions, and artifact sharing inside Claude.
