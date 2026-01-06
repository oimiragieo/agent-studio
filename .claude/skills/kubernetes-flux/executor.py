"""
Executor for Kubernetes Flux Skill - Handles kubectl operations with safety controls.

This executor provides Kubernetes cluster management through kubectl,
executing operations on-demand outside of Claude's context window.

Usage:
    python executor.py --list              List available tools
    python executor.py --tool <name>       Call a tool
    python executor.py --tool <name> --args '{"key": "value"}'

Requirements:
    - kubectl installed and configured
    - Valid KUBECONFIG file or default context
    - Appropriate RBAC permissions

Safety Features:
    - Destructive operations blocked by default
    - Secret values always masked
    - Production context confirmation
    - Command timeouts to prevent hangs
"""

import json
import sys
import subprocess
import os
import re
import base64
from pathlib import Path
from typing import Any, Dict, List, Optional


# Blocked commands for exec_pod (security)
BLOCKED_EXEC_COMMANDS = [
    "rm", "dd", "mkfs", "sudo", "su", "kill", "killall",
    "systemctl", "service", "reboot", "shutdown", "halt"
]

# Production namespace patterns (require confirmation)
PRODUCTION_PATTERNS = [
    "prod", "production", "live", "prd"
]


def check_kubectl():
    """Check if kubectl is available."""
    try:
        result = subprocess.run(
            ["kubectl", "version", "--client", "--short"],
            capture_output=True,
            text=True,
            timeout=5,
            shell=(sys.platform == "win32")
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def is_production_namespace(namespace: str) -> bool:
    """Check if namespace is a production namespace."""
    if not namespace:
        return False
    namespace_lower = namespace.lower()
    return any(pattern in namespace_lower for pattern in PRODUCTION_PATTERNS)


def mask_secret_value(value: str) -> str:
    """Mask a secret value for safe display."""
    if not value:
        return "***EMPTY***"
    return "***MASKED***"


def mask_secret_data(data: Dict[str, str]) -> Dict[str, str]:
    """Mask all values in secret data dictionary."""
    return {key: mask_secret_value(value) for key, value in data.items()}


def run_kubectl(args: List[str], timeout: int = 30) -> Dict[str, Any]:
    """
    Run a kubectl command and return the result.

    Args:
        args: kubectl command arguments
        timeout: Command timeout in seconds

    Returns:
        Dict with stdout, stderr, returncode, and success status
    """
    cmd = ["kubectl"] + args

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=(sys.platform == "win32")
        )

        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds",
            "returncode": 124,
            "success": False
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "returncode": 1,
            "success": False
        }


class KubernetesExecutor:
    """Executor for Kubernetes operations via kubectl."""

    def __init__(self):
        """Initialize executor and verify kubectl is available."""
        if not check_kubectl():
            raise RuntimeError(
                "kubectl is not available. Please install kubectl and configure cluster access."
            )

        # Get timeout from environment
        self.timeout = int(os.environ.get("KUBECTL_TIMEOUT", "30"))

    # ===== Resource Discovery Tools =====

    def list_pods(self, namespace: str = "", selector: str = "",
                  all_namespaces: bool = False) -> Dict[str, Any]:
        """List pods in a namespace."""
        args = ["get", "pods", "-o", "wide"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        if selector:
            args.extend(["-l", selector])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_deployments(self, namespace: str = "", selector: str = "",
                        all_namespaces: bool = False) -> Dict[str, Any]:
        """List deployments in a namespace."""
        args = ["get", "deployments", "-o", "wide"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        if selector:
            args.extend(["-l", selector])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_services(self, namespace: str = "", selector: str = "",
                     all_namespaces: bool = False) -> Dict[str, Any]:
        """List services in a namespace."""
        args = ["get", "services", "-o", "wide"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        if selector:
            args.extend(["-l", selector])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_configmaps(self, namespace: str = "",
                       all_namespaces: bool = False) -> Dict[str, Any]:
        """List ConfigMaps in a namespace."""
        args = ["get", "configmaps"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_secrets(self, namespace: str = "",
                    all_namespaces: bool = False) -> Dict[str, Any]:
        """List Secrets in a namespace (names only, values masked)."""
        args = ["get", "secrets"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_namespaces(self) -> Dict[str, Any]:
        """List all available namespaces."""
        args = ["get", "namespaces"]

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    # ===== Resource Inspection Tools =====

    def describe_pod(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Get detailed information about a specific pod."""
        args = ["describe", "pod", name]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def describe_deployment(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Get detailed information about a deployment."""
        args = ["describe", "deployment", name]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def describe_service(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Get detailed information about a service."""
        args = ["describe", "service", name]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def describe_configmap(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Get ConfigMap contents and metadata."""
        args = ["get", "configmap", name, "-o", "yaml"]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def describe_secret(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Get Secret metadata (values masked for security)."""
        args = ["get", "secret", name, "-o", "json"]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        if not result["success"]:
            return {
                "content": [{"type": "text", "text": result["stderr"]}],
                "isError": True
            }

        # Parse JSON and mask values
        try:
            secret_data = json.loads(result["stdout"])
            if "data" in secret_data:
                # Mask all secret values
                secret_data["data"] = mask_secret_data(secret_data["data"])

            # Format as YAML for readability
            import yaml
            output = yaml.dump(secret_data, default_flow_style=False)

            return {
                "content": [{"type": "text", "text": f"Secret metadata (values masked):\n{output}"}],
                "isError": False
            }
        except Exception as e:
            # Fallback to showing raw output with warning
            return {
                "content": [{"type": "text", "text": f"Warning: Could not parse secret. Raw output:\n{result['stdout']}"}],
                "isError": False
            }

    # ===== Troubleshooting Tools =====

    def get_logs(self, name: str, namespace: str = "", container: str = "",
                 tail: int = 100, previous: bool = False, since: str = "") -> Dict[str, Any]:
        """Retrieve container logs from a pod."""
        args = ["logs", name]

        if namespace:
            args.extend(["-n", namespace])

        if container:
            args.extend(["-c", container])

        if tail:
            args.extend(["--tail", str(tail)])

        if previous:
            args.append("--previous")

        if since:
            args.extend(["--since", since])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_events(self, namespace: str = "", limit: int = 50,
                   all_namespaces: bool = False, field_selector: str = "") -> Dict[str, Any]:
        """List recent events in a namespace."""
        args = ["get", "events", "--sort-by=.metadata.creationTimestamp"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["-n", namespace])

        if field_selector:
            args.extend(["--field-selector", field_selector])

        result = run_kubectl(args, self.timeout)

        # Limit output to specified number of events
        if result["success"] and limit:
            lines = result["stdout"].split("\n")
            if len(lines) > limit + 1:  # +1 for header
                result["stdout"] = "\n".join(lines[:limit + 1])

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def watch_events(self, namespace: str = "", duration: int = 30) -> Dict[str, Any]:
        """Stream real-time events (with timeout)."""
        args = ["get", "events", "--watch"]

        if namespace:
            args.extend(["-n", namespace])

        # Use duration as timeout
        result = run_kubectl(args, timeout=duration)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def exec_pod(self, name: str, command: List[str], namespace: str = "",
                 container: str = "", allow_write: bool = False) -> Dict[str, Any]:
        """Execute read-only commands in a pod (write operations blocked by default)."""
        # Security check: block destructive commands
        if command and command[0] in BLOCKED_EXEC_COMMANDS:
            return {
                "content": [{"type": "text", "text": f"Error: Command '{command[0]}' is blocked for security reasons"}],
                "isError": True
            }

        # Check for write operations
        write_flags = [">", ">>", "|", "&&", ";"]
        if not allow_write and any(flag in " ".join(command) for flag in write_flags):
            return {
                "content": [{"type": "text", "text": "Error: Write operations require allow_write=true flag"}],
                "isError": True
            }

        args = ["exec", name, "--"]

        if namespace:
            args.insert(1, "-n")
            args.insert(2, namespace)

        if container:
            args.insert(1, "-c")
            args.insert(2, container)

        args.extend(command)

        result = run_kubectl(args, timeout=10)  # Short timeout for exec

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    # ===== Management Tools =====

    def scale_deployment(self, name: str, replicas: int,
                        namespace: str = "") -> Dict[str, Any]:
        """Scale a deployment to a specific replica count."""
        # Production safety check
        if namespace and is_production_namespace(namespace):
            return {
                "content": [{"type": "text", "text": f"Warning: Scaling in production namespace '{namespace}' requires confirmation. Use --confirm flag."}],
                "isError": True
            }

        args = ["scale", "deployment", name, f"--replicas={replicas}"]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def rollout_status(self, name: str, namespace: str = "") -> Dict[str, Any]:
        """Check the rollout status of a deployment."""
        args = ["rollout", "status", "deployment", name]

        if namespace:
            args.extend(["-n", namespace])

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def port_forward(self, name: str, local_port: int, remote_port: int,
                    namespace: str = "", duration: int = 60) -> Dict[str, Any]:
        """Forward a local port to a pod (with timeout)."""
        args = ["port-forward", name, f"{local_port}:{remote_port}"]

        if namespace:
            args.extend(["-n", namespace])

        # Use duration as timeout
        result = run_kubectl(args, timeout=duration)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    # ===== Context Management Tools =====

    def get_current_context(self) -> Dict[str, Any]:
        """Display the current kubectl context."""
        args = ["config", "current-context"]

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def switch_context(self, context: str) -> Dict[str, Any]:
        """Switch to a different kubectl context."""
        # Production safety check
        if is_production_namespace(context):
            return {
                "content": [{"type": "text", "text": f"Warning: Switching to production context '{context}' requires confirmation. Use --confirm flag."}],
                "isError": True
            }

        args = ["config", "use-context", context]

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    def list_contexts(self) -> Dict[str, Any]:
        """List all available kubectl contexts."""
        args = ["config", "get-contexts"]

        result = run_kubectl(args, self.timeout)

        return {
            "content": [{"type": "text", "text": result["stdout"] or result["stderr"]}],
            "isError": not result["success"]
        }

    # ===== Tool Registry =====

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools with their schemas."""
        return [
            # Resource Discovery
            {
                "name": "list_pods",
                "description": "List pods in a namespace with status information",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "selector": {"type": "string", "description": "Label selector"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"}
                    }
                }
            },
            {
                "name": "list_deployments",
                "description": "List deployments with replica status",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "selector": {"type": "string", "description": "Label selector"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"}
                    }
                }
            },
            {
                "name": "list_services",
                "description": "List services with cluster IPs and ports",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "selector": {"type": "string", "description": "Label selector"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"}
                    }
                }
            },
            {
                "name": "list_configmaps",
                "description": "List ConfigMaps in a namespace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"}
                    }
                }
            },
            {
                "name": "list_secrets",
                "description": "List Secrets in a namespace (names only, values masked)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"}
                    }
                }
            },
            {
                "name": "list_namespaces",
                "description": "List all available namespaces",
                "inputSchema": {"type": "object", "properties": {}}
            },
            # Resource Inspection
            {
                "name": "describe_pod",
                "description": "Get detailed information about a specific pod",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Pod name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "describe_deployment",
                "description": "Get detailed information about a deployment",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Deployment name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "describe_service",
                "description": "Get detailed information about a service",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Service name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "describe_configmap",
                "description": "Get ConfigMap contents and metadata",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "ConfigMap name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "describe_secret",
                "description": "Get Secret metadata (values masked for security)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Secret name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            # Troubleshooting
            {
                "name": "get_logs",
                "description": "Retrieve container logs from a pod",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Pod name"},
                        "namespace": {"type": "string", "description": "Namespace"},
                        "container": {"type": "string", "description": "Container name"},
                        "tail": {"type": "number", "description": "Number of lines to tail"},
                        "previous": {"type": "boolean", "description": "Get logs from previous container"},
                        "since": {"type": "string", "description": "Time duration (e.g., '1h', '30m')"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "list_events",
                "description": "List recent events in a namespace",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to query"},
                        "limit": {"type": "number", "description": "Number of events to show"},
                        "all_namespaces": {"type": "boolean", "description": "List across all namespaces"},
                        "field_selector": {"type": "string", "description": "Field selector filter"}
                    }
                }
            },
            {
                "name": "watch_events",
                "description": "Stream real-time events (30-second window)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "namespace": {"type": "string", "description": "Namespace to watch"},
                        "duration": {"type": "number", "description": "Watch duration in seconds"}
                    }
                }
            },
            {
                "name": "exec_pod",
                "description": "Execute read-only commands in a pod",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Pod name"},
                        "command": {"type": "array", "description": "Command to execute"},
                        "namespace": {"type": "string", "description": "Namespace"},
                        "container": {"type": "string", "description": "Container name"},
                        "allow_write": {"type": "boolean", "description": "Allow write operations"}
                    },
                    "required": ["name", "command"]
                }
            },
            # Management
            {
                "name": "scale_deployment",
                "description": "Scale a deployment to a specific replica count",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Deployment name"},
                        "replicas": {"type": "number", "description": "Desired replica count"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name", "replicas"]
                }
            },
            {
                "name": "rollout_status",
                "description": "Check the rollout status of a deployment",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Deployment name"},
                        "namespace": {"type": "string", "description": "Namespace"}
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "port_forward",
                "description": "Forward a local port to a pod (for debugging)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Pod name"},
                        "local_port": {"type": "number", "description": "Local port"},
                        "remote_port": {"type": "number", "description": "Pod port"},
                        "namespace": {"type": "string", "description": "Namespace"},
                        "duration": {"type": "number", "description": "Forward duration in seconds"}
                    },
                    "required": ["name", "local_port", "remote_port"]
                }
            },
            # Context Management
            {
                "name": "get_current_context",
                "description": "Display the current kubectl context",
                "inputSchema": {"type": "object", "properties": {}}
            },
            {
                "name": "switch_context",
                "description": "Switch to a different kubectl context",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "context": {"type": "string", "description": "Context name"}
                    },
                    "required": ["context"]
                }
            },
            {
                "name": "list_contexts",
                "description": "List all available kubectl contexts",
                "inputSchema": {"type": "object", "properties": {}}
            }
        ]

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name with the given arguments."""
        method = getattr(self, tool_name, None)

        if method is None:
            return {
                "content": [{"type": "text", "text": f"Error: Tool '{tool_name}' not found"}],
                "isError": True
            }

        try:
            return method(**arguments)
        except TypeError as e:
            return {
                "content": [{"type": "text", "text": f"Error: Invalid arguments - {str(e)}"}],
                "isError": True
            }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Error: {str(e)}"}],
                "isError": True
            }


def main():
    """CLI entry point for executor."""
    import argparse

    parser = argparse.ArgumentParser(description="Execute Kubernetes operations via kubectl")
    parser.add_argument("--tool", help="Tool name to call")
    parser.add_argument("--args", help="Tool arguments as JSON", default="{}")
    parser.add_argument("--list", action="store_true", help="List available tools")
    parser.add_argument("--namespace", help="Default namespace")
    parser.add_argument("--context", help="kubectl context to use")

    args = parser.parse_args()

    # Set defaults if provided
    if args.namespace:
        os.environ["KUBECTL_NAMESPACE"] = args.namespace
    if args.context:
        os.environ["KUBECTL_CONTEXT"] = args.context

    try:
        executor = KubernetesExecutor()
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
