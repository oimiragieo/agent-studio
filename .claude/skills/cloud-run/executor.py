"""
Executor for Cloud Run Skill - Handles dynamic MCP tool calls via npx.

This executor connects to the Google Cloud Run MCP server
and executes tool calls on-demand, outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'

Requirements:
    - Node.js 18+ installed
    - Google Cloud credentials configured via `gcloud auth application-default login`
"""

import json
import sys
import subprocess
import os
from pathlib import Path
from typing import Any, Dict, List, Optional


def check_node():
    """Check if Node.js is available."""
    try:
        # On Windows, may need to use shell=True or full path
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            shell=(sys.platform == "win32")
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def check_gcloud_auth():
    """Check if gcloud credentials are available."""
    # Check for application default credentials file
    adc_path = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")
    if os.path.exists(adc_path):
        return True

    # Check Windows path
    adc_path_win = os.path.expandvars("%APPDATA%/gcloud/application_default_credentials.json")
    if os.path.exists(adc_path_win):
        return True

    # Check environment variable
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return os.path.exists(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])

    return False


class CloudRunExecutor:
    """Executor for Cloud Run MCP server tools via npx using JSON-RPC."""

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize executor with MCP server configuration."""
        if config_path is None:
            config_path = Path(__file__).parent / "config.json"

        with open(config_path, "r") as f:
            self.config = json.load(f)

        # Check prerequisites
        if not check_node():
            raise RuntimeError("Node.js is not available. Please install Node.js 18+.")

        if not check_gcloud_auth():
            print(
                "Warning: Google Cloud credentials may not be configured. "
                "Run: gcloud auth application-default login",
                file=sys.stderr
            )

    def _build_cmd(self) -> List[str]:
        """Build the npx command."""
        # On Windows, use npx.cmd; on Unix, use npx
        npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
        cmd = [npx_cmd, "-y", "@google-cloud/cloud-run-mcp"]
        return cmd

    def _get_env(self) -> Dict[str, str]:
        """Get environment variables for the MCP server."""
        env = os.environ.copy()

        # Add optional env vars if set
        for env_var in ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_REGION",
                        "DEFAULT_SERVICE_NAME", "SKIP_IAM_CHECK",
                        "ENABLE_HOST_VALIDATION", "ALLOWED_HOSTS"]:
            if os.environ.get(env_var):
                env[env_var] = os.environ[env_var]

        return env

    def _send_jsonrpc(self, messages: List[Dict], wait_for_id: int = 2) -> List[Dict]:
        """Send JSON-RPC messages to the MCP server and get responses."""
        import time
        cmd = self._build_cmd()
        env = self._get_env()

        # Start the process
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # Line buffered
            env=env,
            shell=(sys.platform == "win32")
        )

        responses = []
        try:
            # Send all messages
            for msg in messages:
                proc.stdin.write(json.dumps(msg) + "\n")
                proc.stdin.flush()

            # Read responses until we get the one we're waiting for
            start_time = time.time()
            timeout = 60  # seconds (Cloud Run operations can be slow)
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
                    "clientInfo": {"name": "cloud-run-skill", "version": "1.0.0"}
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
                    "clientInfo": {"name": "cloud-run-skill", "version": "1.0.0"}
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

    def list_prompts(self) -> List[Dict[str, Any]]:
        """List all available prompts from the MCP server."""
        messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "cloud-run-skill", "version": "1.0.0"}
                }
            },
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "prompts/list",
                "params": {}
            }
        ]

        responses = self._send_jsonrpc(messages)

        # Find the prompts list response
        for resp in responses:
            if resp.get("id") == 2:
                if "error" in resp:
                    return []
                result = resp.get("result", {})
                prompts = result.get("prompts", [])
                return [
                    {
                        "name": prompt.get("name", ""),
                        "description": prompt.get("description", ""),
                        "arguments": prompt.get("arguments", []),
                    }
                    for prompt in prompts
                ]

        return []


def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute Cloud Run MCP tools via npx")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")
    parser.add_argument("--prompts", action="store_true", help="List available prompts")
    parser.add_argument("--project", help="GCP project ID")
    parser.add_argument("--region", help="Cloud Run region")

    args = parser.parse_args()

    # Set project/region if provided
    if args.project:
        os.environ["GOOGLE_CLOUD_PROJECT"] = args.project
    if args.region:
        os.environ["GOOGLE_CLOUD_REGION"] = args.region

    try:
        executor = CloudRunExecutor()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        tools = executor.list_tools()
        print(json.dumps(tools, indent=2))
        return

    if args.prompts:
        prompts = executor.list_prompts()
        print(json.dumps(prompts, indent=2))
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
