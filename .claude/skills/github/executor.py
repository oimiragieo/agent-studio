"""
Executor for GitHub Skill - Handles dynamic MCP tool calls via Docker.

This executor connects to the official GitHub MCP server running in Docker
and executes tool calls on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'

Requirements:
    - Docker installed and running
    - GITHUB_PERSONAL_ACCESS_TOKEN environment variable set
"""

import json
import sys
import subprocess
import os
from pathlib import Path
from typing import Any, Dict, List, Optional


def check_docker():
    """Check if Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def check_github_token():
    """Check if GitHub token is set (checks both common variable names)."""
    token = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        return False
    return len(token) > 10  # Basic sanity check


def get_github_token():
    """Get GitHub token from environment."""
    return os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN") or os.environ.get("GITHUB_TOKEN")


class GitHubExecutor:
    """Executor for GitHub MCP server tools via Docker using JSON-RPC."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        # Check prerequisites
        if not check_docker():
            raise RuntimeError("Docker is not available. Please install and start Docker.")

        if not check_github_token():
            raise RuntimeError(
                "GITHUB_PERSONAL_ACCESS_TOKEN not set. "
                "Export it with: export GITHUB_PERSONAL_ACCESS_TOKEN=your_token"
            )

        self.token = get_github_token()

    def _build_docker_cmd(self) -> List[str]:
        """Build the Docker command."""
        cmd = ["docker", "run", "-i", "--rm"]

        # Add token
        cmd.extend(["-e", f"GITHUB_PERSONAL_ACCESS_TOKEN={self.token}"])

        # Add optional env vars
        for env_var in ["GITHUB_HOST", "GITHUB_TOOLSETS", "GITHUB_READ_ONLY"]:
            if os.environ.get(env_var):
                cmd.extend(["-e", f"{env_var}={os.environ[env_var]}"])

        cmd.append("ghcr.io/github/github-mcp-server")
        return cmd

    def _send_jsonrpc(self, messages: List[Dict], wait_for_id: int = 2) -> List[Dict]:
        """Send JSON-RPC messages to the MCP server and get responses."""
        import time
        cmd = self._build_docker_cmd()

        # Start the process
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line buffered
        )

        responses = []
        try:
            # Send all messages
            for msg in messages:
                proc.stdin.write(json.dumps(msg) + "\n")
                proc.stdin.flush()

            # Read responses until we get the one we're waiting for
            start_time = time.time()
            timeout = 30  # seconds
            found_response = False

            while time.time() - start_time < timeout and not found_response:
                line = proc.stdout.readline()
                if not line:
                    time.sleep(0.1)
                    continue

                line = line.strip()
                if line and line.startswith("{"):
                    try:
                        resp = json.loads(line)
                        responses.append(resp)
                        # Check if this is the response we're waiting for
                        if resp.get("id") == wait_for_id:
                            found_response = True
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            responses.append({"error": str(e)})
        finally:
            proc.stdin.close()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

        return responses

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool with the given arguments."""
        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "github-skill", "version": "1.0.0"}
                }
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
        ]

        responses = self._send_jsonrpc(messages)

        # Find the tool call response
        for resp in responses:
            if resp.get("id") == 2:
                if "error" in resp:
                    return {
                        "content": [{"type": "text", "text": f"Error: {resp['error']}"}],
                        "isError": True
                    }
                result = resp.get("result", {})
                content = result.get("content", [])
                return {
                    "content": content,
                    "isError": result.get("isError", False)
                }

        return {
            "content": [{"type": "text", "text": "No response received"}],
            "isError": True
        }

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools from the MCP server."""
        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "github-skill", "version": "1.0.0"}
                }
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            }
        ]

        responses = self._send_jsonrpc(messages)

        # Find the tools list response
        for resp in responses:
            if resp.get("id") == 2:
                if "error" in resp:
                    return []
                result = resp.get("result", {})
                tools = result.get("tools", [])
                return [
                    {
                        "name": tool.get("name", ""),
                        "description": tool.get("description", ""),
                        "inputSchema": tool.get("inputSchema", {}),
                    }
                    for tool in tools
                ]

        return []


def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute GitHub MCP tools via Docker")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")
    parser.add_argument("--toolsets", help="Comma-separated toolsets to enable")

    args = parser.parse_args()

    # Set toolsets if provided
    if args.toolsets:
        os.environ["GITHUB_TOOLSETS"] = args.toolsets

    try:
        executor = GitHubExecutor()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        tools = executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.tool:
        try:
            arguments = json.loads(args.args)
            result = executor.call_tool(args.tool, arguments)
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"Error calling tool: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Use --list to see tools or --tool <name> --args <json> to call", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
