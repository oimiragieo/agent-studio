"""
Executor for chrome-devtools Skill - Handles dynamic MCP tool calls for Chrome DevTools.

This executor connects to the chrome-devtools MCP server and executes tool calls
on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'
    python executor.py --headless          Run Chrome in headless mode
"""

import json
import sys
import asyncio
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)


class ChromeDevToolsExecutor:
    """Executor for chrome-devtools MCP server tools."""

    def __init__(self, config_path: Optional[Path] = None, headless: bool = False):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        # Build args list
        args = self.config.get("args", []).copy()
        if headless and "--headless" not in args:
            args.append("--headless")

        self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=args,
            env={**os.environ, **self.config.get("env", {})},
        )

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with the given arguments."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments)

                # Serialize content objects to JSON-compatible format
                content = []
                for item in result.content:
                    if hasattr(item, "text"):
                        content.append({"type": "text", "text": item.text})
                    elif hasattr(item, "data"):
                        # Handle binary data (screenshots)
                        content.append({"type": "data", "data": str(item.data)[:1000] + "..." if len(str(item.data)) > 1000 else str(item.data)})
                    elif hasattr(item, "image"):
                        content.append({"type": "image", "mimeType": getattr(item, "mimeType", "image/png")})
                    else:
                        content.append({"type": "unknown", "value": str(item)})

                return {
                    "content": content,
                    "isError": result.isError if hasattr(result, "isError") else False,
                }

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from the MCP server."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                return [
                    {
                        "name": tool.name,
                        "description": tool.description or "",
                        "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
                    }
                    for tool in tools_result.tools
                ]


async def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute chrome-devtools MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")

    args = parser.parse_args()

    executor = ChromeDevToolsExecutor(headless=args.headless)

    if args.list:
        tools = await executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = await executor.call_tool(args.tool, arguments)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
