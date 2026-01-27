"""
Skill Generator - Generates Claude Skill structure from MCP server information.

Creates SKILL.md, executor.py, and configuration files using progressive
disclosure pattern for optimal context usage.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class SkillGenerator:
    """Generates Claude Skill structure from MCP server information."""

    def __init__(self, output_dir: Path):
        """
        Initialize skill generator.

        Args:
            output_dir: Directory where Skill will be generated
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_skill(
        self, server_info: Dict[str, Any], mcp_config: Dict[str, Any]
    ) -> Dict[str, Path]:
        """
        Generate complete Skill structure from MCP server information.

        Args:
            server_info: Server information from MCP analyzer
            mcp_config: Original MCP server configuration

        Returns:
            Dictionary mapping file types to generated file paths
        """
        skill_name = server_info.get("name", "unknown")
        tools = server_info.get("tools", [])

        # Generate SKILL.md with progressive disclosure
        skill_md_path = self._generate_skill_md(skill_name, tools, server_info)

        # Generate executor.py
        executor_path = self._generate_executor(skill_name, tools, mcp_config)

        # Generate config.json
        config_path = self._generate_config(skill_name, mcp_config)

        return {
            "skill_md": skill_md_path,
            "executor": executor_path,
            "config": config_path,
        }

    def _generate_skill_md(
        self, skill_name: str, tools: List[Dict[str, Any]], server_info: Dict[str, Any]
    ) -> Path:
        """Generate SKILL.md with progressive disclosure pattern."""
        skill_md_path = self.output_dir / "SKILL.md"

        # Metadata section (~100 tokens)
        metadata = f"""---
name: {skill_name}
description: {server_info.get('description', f'Tools from {skill_name} MCP server')}
allowed-tools: read, write, bash
version: 1.0
best_practices:
  - Use for {len(tools)} tools from {skill_name} MCP server
  - Tools load on-demand with minimal context
  - Full instructions available when skill is used
error_handling: graceful
streaming: supported
---

# {skill_name.title()} Skill

## Identity

{skill_name.title()} - Provides access to {len(tools)} tools from the {skill_name} MCP server with progressive disclosure for optimal context usage.

## Capabilities

This skill provides access to the following tool categories:
"""

        # Tool categories (metadata only)
        tool_categories = self._categorize_tools(tools)
        for category, category_tools in tool_categories.items():
            metadata += f"\n- **{category}**: {len(category_tools)} tools\n"

        metadata += f"""
## Tool Count

- **Total Tools**: {len(tools)}
- **Estimated Tokens (MCP)**: ~{server_info.get('estimated_tokens', 0):,}
- **Estimated Tokens (Skill)**: ~{100 + (len(tools) * 50):,} (metadata only)
- **Context Savings**: ~{int((1 - (100 + len(tools) * 50) / max(server_info.get('estimated_tokens', 1), 1)) * 100)}%

## Usage

This skill uses progressive disclosure:
- **Initial Load**: ~100 tokens (metadata only)
- **When Used**: ~{len(tools) * 50 + 5000:,} tokens (full instructions)
- **Execution**: 0 tokens (runs externally via executor.py)

## Tool Categories

"""

        # Add tool categories with brief descriptions
        for category, category_tools in tool_categories.items():
            metadata += f"### {category}\n\n"
            for tool in category_tools[:5]:  # Show first 5 tools per category
                metadata += f"- `{tool['name']}`: {tool.get('description', '')[:100]}...\n"
            if len(category_tools) > 5:
                metadata += f"- ... and {len(category_tools) - 5} more tools\n"
            metadata += "\n"

        # Full tool documentation (loaded when skill is used)
        metadata += """
## Full Tool Documentation

<details>
<summary>Complete tool list and documentation (loaded when skill is used)</summary>

"""
        for tool in tools:
            metadata += f"### {tool['name']}\n\n"
            metadata += f"{tool.get('description', 'No description available')}\n\n"
            if tool.get("input_schema"):
                metadata += "**Input Schema:**\n```json\n"
                metadata += json.dumps(tool["input_schema"], indent=2)
                metadata += "\n```\n\n"

        metadata += """
</details>

## Integration

This skill was automatically generated from the {skill_name} MCP server.
Tools are executed via executor.py which connects to the original MCP server.

## Error Handling

If tool execution fails:
1. Check MCP server configuration
2. Verify environment variables are set
3. Ensure MCP server is accessible
4. Review executor.py logs for details
"""

        skill_md_path.write_text(metadata, encoding="utf-8")
        return skill_md_path

    def _generate_executor(
        self, skill_name: str, tools: List[Dict[str, Any]], mcp_config: Dict[str, Any]
    ) -> Path:
        """Generate executor.py for dynamic MCP tool execution."""
        executor_path = self.output_dir / "executor.py"

        executor_code = f'''"""
Executor for {skill_name} Skill - Handles dynamic MCP tool calls.

This executor connects to the {skill_name} MCP server and executes tool calls
on-demand, outside of Claude's context window.
"""

import json
import sys
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
except ImportError:
    print("Error: mcp package required. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)


class {skill_name.title().replace("-", "").replace("_", "")}Executor:
    """Executor for {skill_name} MCP server tools."""

    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize executor with MCP server configuration.

        Args:
            config_path: Path to config.json with MCP server settings
        """
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"
        
        with open(config_path, "r") as f:
            self.config = json.load(f)
        
        self.server_params = StdioServerParameters(
            command=self.config["command"],
            args=self.config.get("args", []),
            env=self.config.get("env", {{}}),
        )

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call an MCP tool with the given arguments.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            Tool execution result
        """
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # Call the tool
                result = await session.call_tool(tool_name, arguments)
                
                return {{
                    "content": result.content,
                    "isError": result.isError if hasattr(result, "isError") else False,
                }}

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        List all available tools from the MCP server.

        Returns:
            List of tool information dictionaries
        """
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                tools_result = await session.list_tools()
                
                return [
                    {{
                        "name": tool.name,
                        "description": tool.description or "",
                        "inputSchema": tool.inputSchema if hasattr(tool, "inputSchema") else {{}},
                    }}
                    for tool in tools_result.tools
                ]


async def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description=f"Execute {skill_name} MCP tools")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{{}}")
    parser.add_argument("--list", action="store_true", help="List available tools")

    args = parser.parse_args()

    executor = {skill_name.title().replace("-", "").replace("_", "")}Executor()

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
            print(f"Error calling tool: {{e}}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
'''

        executor_path.write_text(executor_code, encoding="utf-8")
        return executor_path

    def _generate_config(self, skill_name: str, mcp_config: Dict[str, Any]) -> Path:
        """Generate config.json with MCP server configuration."""
        config_path = self.output_dir / "config.json"

        config = {
            "skill_name": skill_name,
            "command": mcp_config.get("command"),
            "args": mcp_config.get("args", []),
            "env": mcp_config.get("env", {}),
            "description": mcp_config.get("description", ""),
        }

        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return config_path

    def _categorize_tools(self, tools: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Categorize tools by functionality."""
        categories: Dict[str, List[Dict[str, Any]]] = {
            "File Operations": [],
            "Code Operations": [],
            "Git Operations": [],
            "Communication": [],
            "Data Operations": [],
            "Other": [],
        }

        for tool in tools:
            name = tool.get("name", "").lower()
            description = tool.get("description", "").lower()

            categorized = False
            for category, keywords in [
                ("File Operations", ["file", "read", "write", "create", "delete"]),
                ("Code Operations", ["code", "search", "analyze", "parse"]),
                ("Git Operations", ["git", "commit", "branch", "pull", "push"]),
                ("Communication", ["message", "send", "notify", "slack", "email"]),
                ("Data Operations", ["data", "query", "database", "sql"]),
            ]:
                if any(keyword in name or keyword in description for keyword in keywords):
                    categories[category].append(tool)
                    categorized = True
                    break

            if not categorized:
                categories["Other"].append(tool)

        # Remove empty categories
        return {k: v for k, v in categories.items() if v}

