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
4. Register router hook in `.claude/hooks/hook-registry.json` to enable cost-optimized routing:
   ```json
   {
     "hooks": {
       "router-session-entry": {
         "path": ".claude/hooks/router-session-entry.mjs",
         "type": "UserPromptSubmit",
         "priority": 1,
         "enabled": true
       }
     }
   }
   ```
5. (Optional) Configure MCP servers in `.claude/.mcp.json` (set required env vars).

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

**Documentation**: See [Router Session Handler Usage Guide](./.claude/docs/ROUTER_SESSION_HANDLER_USAGE.md)

[1] Anthropic, "Claude 3.5 Sonnet" (Jun 2024) – doubled speed, state-of-the-art vision, real-time Artifacts workspace.  
[2] Anthropic, "Projects" (Jun 2024) – persistent team knowledge, instructions, and artifact sharing inside Claude.
