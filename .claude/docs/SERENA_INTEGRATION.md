# Serena Integration (Optional)

Serena is an external MCP server that adds **semantic code navigation and editing** (symbol-aware operations powered by LSP). It complements this repo well by reducing reliance on file-wide `Read`/`Grep`/`Search` workflows.

This repo includes an **optional** Serena MCP server entry in `.claude/.mcp.json` (`mcpServers.serena`). It is `optional: true` and `deferLoading: true`.

## Prerequisites

- Install `uv`/`uvx`: https://docs.astral.sh/uv/

## Recommended contexts

Serena supports contexts that tailor its toolset for the client:

- `claude-code`: recommended when using Claude Code (avoids duplicating built-in file tools)
- `ide`: recommended for Cursor/VSCode/Cline-style clients
- `codex`: recommended for Codex CLI

## Enable in Claude Code (per project)

From the project root:

```sh
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"
```

## Enable globally (all projects)

```sh
claude mcp add --scope user serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context=claude-code --project-from-cwd
```

## Notes for this agent framework

- Router-first enforcement applies to MCP tools too (the same routing + handoff rules still gate tool use).
- Prefer Serena symbol tools for “find the right code” tasks (e.g., “find symbol”, “find references”, “insert/replace at symbol”) and fall back to file-wide scans only when needed.
