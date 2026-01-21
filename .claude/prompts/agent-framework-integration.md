# Agent Framework Integration (UI-Safe)

Paste into Claude Code at repo root.

Run the Agent Framework Integration suite in UI-safe mode.

Requirements:

- Route first (router-first enforcement), then hand off to the required coordinator.
- Use the deterministic headless runner (avoid UI fan-out).

Do this:

1. Run: `pnpm integration:headless:json`
2. Verify (use the printed workflow id): `node .claude/tools/verify-agent-integration.mjs --workflow-id agent-integration-v1-<YYYYMMDD-HHMMSS> --expected-agents core --json`
