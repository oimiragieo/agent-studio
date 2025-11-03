# Production Drop-In Agent Pack

This pack assembles synchronized agent assets for Claude Code, Cursor IDE, and Factory Droid. Each platform folder exposes the same core roles (analyst, architect, developer, etc.) plus shared execution rules so teams can enable multi-agent workflows without regeneration scripts. Platform-specific instructions extend upstream backups with 2025 feature updates such as Claude Projects and Artifacts, Cursor 2.0 Composer/Plan Mode, and Factory's context-layered Droid orchestration.

## Folder Map

```
production-dropin/
  .claude/        # Claude Code Projects-ready assets (.claude + hooks)
  .cursor/        # Cursor 2.0 multi-agent bundle (.mdc + plan hooks)
  .factory/       # Factory Droid CLI/Cloud pack (markdown configs)
```

Copy the relevant platform folder into your repository root to enable the agents. Each folder includes:

- `subagents/` – ready-to-run role prompts
- `instructions/` – global guidance & platform primers
- `hooks/` – lifecycle automation definitions per platform
- `skills/` – reusable capability modules or tool notes
- `rules/` – framework-specific guardrails (mirrored across platforms where formats align)

See the platform READMEs for activation details.
