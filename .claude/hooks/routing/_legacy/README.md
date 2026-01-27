# Legacy Routing Hooks

These hooks have been **CONSOLIDATED** into `routing-guard.cjs` per ADR-026.

**DO NOT REGISTER** these hooks in settings.json - they are kept for:
1. Reference implementation
2. Test isolation
3. Rollback if needed

## Consolidated Hooks

| Original File | Now In | Date |
|--------------|--------|------|
| planner-first-guard.cjs | routing-guard.cjs | 2026-01-27 |
| task-create-guard.cjs | routing-guard.cjs | 2026-01-27 |
| router-self-check.cjs | routing-guard.cjs | 2026-01-27 |
| security-review-guard.cjs | routing-guard.cjs | 2026-01-27 |
| router-write-guard.cjs | routing-guard.cjs | 2026-01-27 |

## To Restore

If you need to use an individual hook:
1. Move it back to `.claude/hooks/routing/`
2. Remove the consolidated check from routing-guard.cjs
3. Register in settings.json

See ADR-026 in `.claude/context/memory/decisions.md` for details.
