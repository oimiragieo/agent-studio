"""
MCP Server Analyzer - Introspects MCP servers to discover tools and capabilities.

This module connects to MCP servers, discovers available tools, and analyzes
their structure for conversion to Claude Skills.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Warning: mcp package not installed. Install with: pip install mcp")
    sys.exit(1)


class MCPAnalyzer:
    """Analyzes MCP servers to discover tools and capabilities."""

    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize MCP analyzer.

        Args:
            config_path: Path to .mcp.json configuration file
        """
        self.config_path = config_path or Path(".claude/.mcp.json")
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Load MCP configuration from .mcp.json."""
        try:
            with open(self.config_path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return {"mcpServers": {}}

    def list_servers(self) -> List[str]:
        """List all configured MCP servers."""
        return list(self.config.get("mcpServers", {}).keys())

    def get_server_config(self, server_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific MCP server."""
        return self.config.get("mcpServers", {}).get(server_name)

    async def introspect_server(self, server_name: str) -> Dict[str, Any]:
        """
        Introspect an MCP server to discover tools.

        Args:
            server_name: Name of the MCP server to introspect

        Returns:
            Dictionary containing server information and tools
        """
        server_config = self.get_server_config(server_name)
        if not server_config:
            raise ValueError(f"MCP server '{server_name}' not found in configuration")

        # Extract server parameters
        command = server_config.get("command", "npx")
        args = server_config.get("args", [])
        env = server_config.get("env", {})

        # Create server parameters
        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env,
        )

        # Connect to server and introspect
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # Initialize session
                await session.initialize()

                # List available tools
                tools_result = await session.list_tools()

                # Get server info
                server_info = {
                    "name": server_name,
                    "command": command,
                    "args": args,
                    "tools": [],
                    "tool_count": len(tools_result.tools),
                    "estimated_tokens": 0,
                }

                # Analyze each tool
                for tool in tools_result.tools:
                    tool_info = {
                        "name": tool.name,
                        "description": tool.description or "",
                        "input_schema": tool.inputSchema if hasattr(tool, "inputSchema") else {},
                    }
                    server_info["tools"].append(tool_info)

                    # Estimate token usage (rough calculation)
                    tool_tokens = self._estimate_tool_tokens(tool_info)
                    server_info["estimated_tokens"] += tool_tokens

                return server_info

    def _estimate_tool_tokens(self, tool_info: Dict[str, Any]) -> int:
        """
        Estimate token usage for a tool definition.

        Args:
            tool_info: Tool information dictionary

        Returns:
            Estimated token count
        """
        # Rough estimation: ~4 tokens per character
        description = tool_info.get("description", "")
        name = tool_info.get("name", "")
        schema = json.dumps(tool_info.get("input_schema", {}))

        total_chars = len(description) + len(name) + len(schema)
        return int(total_chars / 4)

    def analyze_conversion_eligibility(
        self, server_info: Dict[str, Any], rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze if an MCP server should be converted to a Skill.

        Args:
            server_info: Server information from introspection
            rules: Conversion rules (tool_count threshold, exceptions, etc.)

        Returns:
            Eligibility analysis with recommendation
        """
        if not rules:
            rules = {
                "threshold": {"tool_count": 10, "estimated_tokens": 5000},
                "exceptions": [],
                "always_convert": [],
            }

        tool_count = server_info.get("tool_count", 0)
        estimated_tokens = server_info.get("estimated_tokens", 0)
        server_name = server_info.get("name", "")

        # Check exceptions
        if server_name in rules.get("exceptions", []):
            return {
                "eligible": False,
                "reason": "Server in exceptions list",
                "tool_count": tool_count,
                "estimated_tokens": estimated_tokens,
            }

        # Check always_convert
        if server_name in rules.get("always_convert", []):
            return {
                "eligible": True,
                "reason": "Server in always_convert list",
                "tool_count": tool_count,
                "estimated_tokens": estimated_tokens,
            }

        # Check thresholds
        threshold_tool_count = rules.get("threshold", {}).get("tool_count", 10)
        threshold_tokens = rules.get("threshold", {}).get("estimated_tokens", 5000)

        eligible = tool_count >= threshold_tool_count or estimated_tokens >= threshold_tokens

        return {
            "eligible": eligible,
            "reason": "Meets conversion thresholds" if eligible else "Below conversion thresholds",
            "tool_count": tool_count,
            "estimated_tokens": estimated_tokens,
            "threshold_tool_count": threshold_tool_count,
            "threshold_tokens": threshold_tokens,
        }

    def get_all_servers_info(self) -> List[Dict[str, Any]]:
        """
        Get information about all configured MCP servers.

        Returns:
            List of server information dictionaries
        """
        servers = []
        for server_name in self.list_servers():
            server_config = self.get_server_config(server_name)
            if server_config:
                servers.append(
                    {
                        "name": server_name,
                        "command": server_config.get("command"),
                        "args": server_config.get("args", []),
                        "description": server_config.get("description", ""),
                        "deferLoading": server_config.get("deferLoading", False),
                        "alwaysLoadTools": server_config.get("alwaysLoadTools", []),
                    }
                )
        return servers


async def main():
    """CLI entry point for MCP analyzer."""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze MCP servers")
    parser.add_argument("--server", help="Server name to introspect")
    parser.add_argument("--list", action="store_true", help="List all servers")
    parser.add_argument("--config", help="Path to .mcp.json file")

    args = parser.parse_args()

    analyzer = MCPAnalyzer(Path(args.config) if args.config else None)

    if args.list:
        servers = analyzer.list_servers()
        print(f"Configured MCP servers: {', '.join(servers)}")
        return

    if args.server:
        try:
            server_info = await analyzer.introspect_server(args.server)
            print(json.dumps(server_info, indent=2))
        except Exception as e:
            print(f"Error introspecting server: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see servers or --server <name> to introspect", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())

