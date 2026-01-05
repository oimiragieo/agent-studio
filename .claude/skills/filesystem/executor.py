"""
Executor for filesystem Skill - Handles dynamic MCP tool calls.

This executor connects to the filesystem MCP server and executes tool calls
on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'
"""

import json
import sys
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)


class FilesystemExecutor:
    """Executor for filesystem MCP server tools."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=self.config.get("args", []),
            env=self.config.get("env", {}),
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
                        content.append({"type": "data", "data": str(item.data)})
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

    parser = argparse.ArgumentParser(description=f"Execute filesystem MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")

    args = parser.parse_args()

    executor = FilesystemExecutor()

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
