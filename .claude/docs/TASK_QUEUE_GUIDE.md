# Task Queue Guide

This workspace uses a lightweight “task queue” pattern to keep long-running or multi-phase work reliable and observable.

## What “task queue” means here

- **Queueing**: a coordinator (router/job-runner/orchestrator) schedules work as discrete steps.
- **Execution**: steps run sequentially by default to avoid Claude Code UI instability/OOM during heavy runs.
- **Receipts**: headless runs write auditable outputs under `.claude/context/` (reports, results JSON, logs).

## When to use the queue

Use the queue pattern when you need one or more of:

- repeatable validation runs (ship readiness, integration)
- long or multi-command workflows (tests + validation + bundling)
- reliable “stop on first failure” behavior
- minimal UI output while still capturing full logs

## Recommended path: headless harnesses

For production-like validation without Claude Code UI memory pressure:

- Ship readiness: `pnpm ship-readiness:headless:json`
- Core integration: `pnpm integration:headless:json`

Both write artifacts under `.claude/context/` and are designed to be “queue-like” (sequential, deterministic).

## Related docs

- [Tracks Guide](./TRACKS_GUIDE.md)
- [Track System Architecture](./TRACK_SYSTEM_ARCHITECTURE.md)
- [Heap Management](./HEAP_MANAGEMENT.md)
