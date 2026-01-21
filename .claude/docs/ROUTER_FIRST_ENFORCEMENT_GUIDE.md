# Router-First Enforcement Guide

Router-first enforcement ensures requests are classified before any non-router tool use proceeds.

## Where the Enforcement Lives

- Router enforcement hook: `../hooks/router-first-enforcer.mjs`
- Router agent: `../agents/router.md`
- Router state handler: `../tools/router-session-handler.mjs`

## UX Tip: Proactive Handoff

If the router decision includes `should_escalate: true` and an `escalation_target`, immediately `Task` spawn the target agent. This avoids the intentional **ROUTING HANDOFF REQUIRED** block message and keeps runs clean.

Recommended order:

1. Parse the router’s JSON (router is required to return one JSON object only; see `../agents/router.md`).
2. If parsing fails, the next blocked tool attempt includes **ROUTING HANDOFF REQUIRED** with the target agent name—spawn that target.

## OOM Prevention: Routing-Phase Glob Guard

Claude Code can crash if a tool returns extremely large output (for example, a repo-wide `Glob` over large rule libraries). During routing, `Glob` is restricted to patterns scoped to `.claude/` via `../hooks/router-glob-guard.mjs`.

## OOM Prevention: Routing Safety Guard

While routing is in progress, `../hooks/routing-safety-guard.mjs` blocks `Grep`/`Search` and restricts `Glob` to small routing config scopes (workflows/agents/schemas/config) to prevent high-fanout tool output and potential CLI OOM.

## UX Tip: Routing In Progress

If routing has started but is not complete yet, the hook may block unsafe tools with **ROUTING IN PROGRESS - LIMITED TOOLING**. During this phase, keep the router to `.claude/` scoped `Glob` + targeted `Read` only (avoid repo-wide `Grep`/`Glob`).

## Troubleshooting

- [Router Session State Migration](./ROUTER_SESSION_STATE_MIGRATION.md)
- [Router Session Handler Usage](./ROUTER_SESSION_HANDLER_USAGE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
