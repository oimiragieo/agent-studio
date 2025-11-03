# Claude Code Drop-In

Drop the contents of this folder into your project's root (`CLAUDE.md` alongside `.claude/`). Assets are organized around Claude Code's hierarchical loader, hook lifecycle, and MCP tooling. Updated instructions assume Claude 3.5 Sonnet with Artifacts, Projects, and extended tool-use announced mid-2024 [1][2].

## Key Capabilities

- **Artifacts-first workflows** so code, docs, and UI previews render side-by-side in Claude's artifact pane for iterative editing [1].
- **Projects-aware instructions** that preload shared knowledge, role guidance, and memory-safe defaults scoped per directory [2].
- **Lifecycle hooks** (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`) to enforce plan reviews, test execution, and artifact publishing.
- **Skills modules** that wrap MCP calls for repo search, context diffing, and artifact management.

## Activation

1. Copy `CLAUDE.md` and the `.claude` contents into your repo root.
2. In Claude Code, open the workspace and confirm the hierarchy in the right-side navigator.
3. Enable hooks via `Preferences → Claude Code → Hooks` and point to `.claude/hooks`.
4. (Optional) Register MCP servers referenced inside `skills/*.yaml`.

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024) – doubled speed, state-of-the-art vision, real-time Artifacts workspace.  
[2] Anthropic, "Projects" (Jun 2024) – persistent team knowledge, instructions, and artifact sharing inside Claude.
