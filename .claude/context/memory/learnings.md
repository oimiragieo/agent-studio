## [2026-01-27] MCP-to-Skill Conversion Pattern (No Server Required)

### Key Insight

Many MCP servers are just **API wrappers**. Instead of requiring external MCP server installation (uvx, npm, pip), skills can use **existing tools** (WebFetch, Exa) to access the same APIs directly.

### Benefits

| MCP Server Approach                  | Skill with Existing Tools |
| ------------------------------------ | ------------------------- |
| ❌ Requires uvx/npm/pip installation | ✅ Works immediately      |
| ❌ Requires session restart          | ✅ No restart needed      |
| ❌ External dependency failures      | ✅ Self-contained         |
| ❌ Platform-specific issues          | ✅ Cross-platform         |

### Example: arXiv MCP → arXiv Skill

**Before (MCP server required):**

```json
"mcpServers": {
  "arxiv": { "command": "uvx", "args": ["mcp-arxiv"] }
}
```

- Requires `uvx` (uv package manager)
- Requires session restart
- Fails if uvx not installed

**After (existing tools):**

```javascript
// WebFetch for arXiv API
WebFetch({
  url: 'http://export.arxiv.org/api/query?search_query=ti:transformer&max_results=10',
  prompt: 'Extract paper titles, authors, abstracts',
});

// Exa for semantic search
mcp__Exa__web_search_exa({
  query: 'site:arxiv.org transformer attention mechanism',
  numResults: 10,
});
```

- Works immediately
- No installation required
- More reliable

### When to Convert MCP → Skill

Convert when the MCP server:

1. Wraps a public REST API (arXiv, GitHub, etc.)
2. Doesn't require authentication
3. Has simple request/response patterns

Keep MCP server when:

1. Complex state management required
2. Streaming/websocket connections
3. Local file system access needed
4. Authentication flows required

### Files Updated

- `.claude/skills/arxiv-mcp/SKILL.md` (v1.1 → v2.0.0)
- `.claude/settings.json` - Removed unused arxiv MCP server

---

## [2026-01-27] Claude-in-Chrome Native Messaging Host Conflict (Known Bug)

### Issue

When both **Claude.app (desktop)** and **Claude Code (CLI)** are installed, the Claude-in-Chrome extension fails to connect. Error: "Browser extension is not connected".

### Root Cause

Both applications register **competing native messaging hosts** at the same path:

- Windows: `%APPDATA%\Claude\ChromeNativeHost\com.anthropic.claude_browser_extension.json`
- macOS: `~/Library/Application Support/Claude/ChromeNativeHost/`

The Chrome extension connects to whichever application registered last, causing connection failures.

### GitHub Issues

- [#15336](https://github.com/anthropics/claude-code/issues/15336) - Windows Native Messaging Host not installing
- [#14894](https://github.com/anthropics/claude-code/issues/14894) - Reconnect extension fails on macOS
- [#20790](https://github.com/anthropics/claude-code/issues/20790) - Extension connects to Claude.app instead of Claude Code

### Workaround (macOS)

```bash
cd ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
mv com.anthropic.claude_browser_extension.json com.anthropic.claude_browser_extension.json.disabled
# Restart Chrome completely, then start Claude Code with --chrome
```

### Recommendation

**Use Chrome DevTools MCP instead** - it's always available, requires no extension, and provides similar functionality for most use cases. Only use Claude-in-Chrome when authenticated sessions are truly required.

### Files Updated

- `.claude/skills/chrome-browser/SKILL.md` - Added Troubleshooting section
- `.claude/context/memory/issues.md` - Added CHROME-001

---

## [2026-01-27] Chrome Browser Skill Updated to v2.0.0

### Two Chrome Integrations Documented

Updated the chrome-browser skill to document BOTH available browser automation integrations:

| Integration         | Tools Prefix               | Status                 | Best For                        |
| ------------------- | -------------------------- | ---------------------- | ------------------------------- |
| Chrome DevTools MCP | `mcp__chrome-devtools__*`  | ✅ Always available    | Testing, debugging, performance |
| Claude-in-Chrome    | `mcp__claude-in-chrome__*` | ⚠️ Requires `--chrome` | Auth sessions, GIF recording    |

### Key Differences

- **Chrome DevTools MCP**: Built-in, no setup, 26 tools, performance tracing, device emulation
- **Claude-in-Chrome**: Requires extension + flag, 19 tools, uses your logins, GIF recording

### Decision Guide Added

```
Public site testing?      → Chrome DevTools MCP
Performance analysis?     → Chrome DevTools MCP
Authenticated apps?       → Claude-in-Chrome (--chrome)
Record demo GIF?          → Claude-in-Chrome (--chrome)
Device/network emulation? → Chrome DevTools MCP
```

### Files Modified

- `.claude/skills/chrome-browser/SKILL.md` (v1.1 → v2.0.0)

---

## [2026-01-27] MCP Auto-Registration Pattern Established

### Issue

When creating skills that use MCP tools (`mcp__<server>__*`), the skill definition was created but the underlying MCP server was not registered in `settings.json`. This causes:

- Skill file exists with documented MCP tools
- But tools don't exist at runtime
- Skill invocation fails silently

### Solution: Skill-Creator Auto-Registration

Updated skill-creator workflow (SKILL.md) with:

1. **New Iron Law #11**: "NO MCP SKILL WITHOUT SERVER REGISTRATION"
2. **Step 10 (BLOCKING for MCP skills)**: Auto-register MCP server in settings.json
3. **Known MCP Server Configurations table**: Pre-defined configs for common servers
4. **Auto-registration flag**: `--no-register` to skip if needed

### Implementation Applied

Added arXiv MCP to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "uvx",
      "args": ["mcp-arxiv"]
    }
  }
}
```

### Pattern: MCP Server Registration by Source

| Source | Command Template                                            |
| ------ | ----------------------------------------------------------- |
| npm    | `{ "command": "npx", "args": ["-y", "<package>"] }`         |
| PyPI   | `{ "command": "uvx", "args": ["<package>"] }`               |
| Docker | `{ "command": "docker", "args": ["run", "-i", "<image>"] }` |

### Files Modified

- `.claude/settings.json` - Added arXiv MCP server
- `.claude/skills/skill-creator/SKILL.md` - Added Iron Law #11, Step 10, MCP configs
- `.claude/skills/arxiv-mcp/SKILL.md` - Updated to reflect configured status
- `.claude/context/artifacts/reports/research-tools-test-2026-01-27.md` - Updated status

### Key Learning

**Skills should "just work"** - users shouldn't need manual configuration. When creating skills that depend on external services (MCP servers), the skill-creator must:

1. Register the service automatically
2. Document the registration in the skill
3. Verify the service is available before marking complete
