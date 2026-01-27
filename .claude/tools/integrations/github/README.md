# GitHub MCP Integration

## Preferred Method: npx (via .mcp.json)

The primary GitHub integration uses the npx-based MCP server configured in `.claude/.mcp.json`:

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"]
}
```

This is:
- **Faster**: No Docker overhead
- **Simpler**: Just requires Node.js
- **Consistent**: Same mechanism as other MCP servers

## Alternative: Docker Executor (Deprecated)

The `executor.py` and `config.json` in this directory provide a Docker-based alternative.

**When to use Docker instead:**
- Need strict isolation
- Running in a container-based CI/CD environment
- Reproducibility requirements that npx can't meet

**Trade-offs:**
- ~2-5 second overhead per call
- Requires Docker to be running
- More complex error handling

## Environment Variables

Both methods require:
- `GITHUB_PERSONAL_ACCESS_TOKEN` - GitHub PAT with appropriate scopes

## Usage

```bash
# Use via Claude Code (preferred - uses .mcp.json)
# Just use the github tools directly in conversation

# Manual Docker test
python executor.py '{"method": "initialize", "params": {}}'
```

## Migration Notes

If you were using the Docker executor, switch to the npx method by:
1. Ensure `.claude/.mcp.json` has the github server configured
2. Remove any direct calls to `executor.py`
3. Let Claude Code's MCP integration handle the server lifecycle
