# LLM-RULES (Agent Studio)

This repository is a **drop-in Claude Code agent ecosystem**: agents, hooks, workflows, schemas, prompts, and headless test harnesses.

The goal is simple: copy `.claude/` into another repo and get consistent routing, guardrails, and auditable diagnostics.

## What You Get

- Agent definitions: `.claude/agents/*.md`
- Hooks/guards (router-first, path guards, audit logging, etc.): `.claude/hooks/`
- Workflows + runners: `.claude/workflows/`, `.claude/tools/`
- Schemas for structured artifacts: `.claude/schemas/`
- Copy/paste prompts (UI-friendly): `.claude/prompts/`
- Headless verification (recommended for CI + reliability): `pnpm ship-readiness:headless:json`, `pnpm integration:headless:json`

Notes:

- `.tmp/` contains experimental/vendor comparisons and is **not shipped** (gitignored).
- `.opencode*` / `.factory*` are **not part of the release** (gitignored/removed from tracked files).

## Quick Start (Copy Into Another Repo)

1. Copy `.claude/` into your target project.
2. (Optional) Copy `.cursor/` if you also support Cursor IDE.
3. Open the project in Claude Code and run a normal request; routing + hooks + workflows apply automatically.

If you also want the repo’s CLI validation utilities (recommended), install deps:

```bash
pnpm install
```

## Production Validation (Headless, Auditable)

These are the recommended “ship it” checks. They write reports/results under `.claude/context/` (which is gitignored).

```bash
# Runs baseline suites + denial + observability bundle, writes report/results JSON.
pnpm ship-readiness:headless:json

# Exercises the agent framework headlessly (core agents) and writes report/results JSON.
pnpm integration:headless:json
```

Important:

- Treat the `workflow_id` printed by each headless command as the source of truth for follow-on verification.
- Use the corresponding verify tool with that exact id:

```bash
node .claude/tools/verify-ship-readiness.mjs --workflow-id <workflow_id> --json
node .claude/tools/verify-agent-integration.mjs --workflow-id <workflow_id> --expected-agents core --json
```

## Prompts (Claude Code UI)

Use these when you want a user-like UI run (not CI):

- `.claude/prompts/ship-readiness.md`
- `.claude/prompts/ship-readiness-validation-headless.md` (headless-first prompt)
- `.claude/prompts/agent-framework-integration.md`

For stability, prefer the **headless harnesses** above. UI multi-agent orchestration can hit platform memory limits depending on model/context.

## Observability / Debugging

Headless runs write artifacts under:

- `.claude/context/reports/` (human-readable)
- `.claude/context/artifacts/` (structured JSON/logs)
- `.claude/context/runtime/` (run state; ephemeral)

If you launch Claude Code in debug mode (`claude -d`), you’ll also get a platform debug log path. Many tools support passing it through where applicable.

Optional env flags (for deeper local debugging):

```powershell
$env:CLAUDE_OBS_STORE_PAYLOADS='1'
$env:CLAUDE_OBS_FAILURE_BUNDLES='1'
```

## Repo Hygiene (Do Not Commit Run Artifacts)

This repo intentionally ignores `.claude/context/**` runtime output. You can sanity-check:

```bash
git ls-files -- .claude/context/artifacts/testing .claude/context/reports
```

Expected output: empty.

## Contributing / Development

Useful commands:

```bash
pnpm format
pnpm test
pnpm validate
pnpm validate:docs-links
node .claude/tools/workflow-dryrun-suite.mjs
```

See also: `GETTING_STARTED.md` and `CHANGELOG.md`.
