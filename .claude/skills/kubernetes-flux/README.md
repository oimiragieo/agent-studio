# Kubernetes Flux Skill

Kubernetes cluster management and troubleshooting via kubectl, converted from MCP server to Claude Code Skill.

## Quick Start

```bash
# Verify kubectl is installed and configured
kubectl cluster-info

# List available tools
python executor.py --list

# Get pods in current namespace
python executor.py --tool list_pods --args '{}'

# Get logs from a pod
python executor.py --tool get_logs --args '{"name": "my-pod", "tail": 50}'

# List recent events
python executor.py --tool list_events --args '{"namespace": "production", "limit": 20}'
```

## Installation

1. **Install kubectl**:
   ```bash
   # macOS
   brew install kubectl

   # Linux
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

   # Windows
   choco install kubernetes-cli
   ```

2. **Configure cluster access**:
   ```bash
   # Verify kubectl is working
   kubectl cluster-info

   # View available contexts
   kubectl config get-contexts

   # Set default namespace (optional)
   kubectl config set-context --current --namespace=my-namespace
   ```

3. **Test the skill**:
   ```bash
   python executor.py --tool get_current_context --args '{}'
   ```

## Features

- **18 tools** for Kubernetes operations
- **Progressive disclosure** - ~92% context savings vs MCP server
- **Safety controls** - Blocks destructive operations, masks secrets
- **Production safeguards** - Requires confirmation for production changes
- **Comprehensive troubleshooting** - Logs, events, pod exec, port forwarding

## Tool Categories

### Resource Discovery (6 tools)
- `list_pods` - List pods with status
- `list_deployments` - List deployments with replicas
- `list_services` - List services with IPs
- `list_configmaps` - List ConfigMaps
- `list_secrets` - List Secrets (names only)
- `list_namespaces` - List all namespaces

### Resource Inspection (5 tools)
- `describe_pod` - Detailed pod information
- `describe_deployment` - Detailed deployment information
- `describe_service` - Detailed service information
- `describe_configmap` - ConfigMap contents
- `describe_secret` - Secret metadata (values masked)

### Troubleshooting (4 tools)
- `get_logs` - Container logs
- `list_events` - Recent cluster events
- `watch_events` - Stream real-time events
- `exec_pod` - Execute commands in pod

### Management (3 tools)
- `scale_deployment` - Scale deployment replicas
- `rollout_status` - Check rollout status
- `port_forward` - Local port forwarding

### Context Management (3 tools)
- `get_current_context` - Show current context
- `switch_context` - Switch kubectl context
- `list_contexts` - List all contexts

## Safety Features

### Blocked Operations
- DELETE operations (kubectl delete)
- Destructive exec commands (rm, dd, mkfs, sudo)
- Secret value exposure

### Confirmation Required
- Scaling in production namespaces
- Switching to production contexts
- Exec with write operations

### Masked Output
- Secret values (always shown as `***MASKED***`)
- Authentication tokens
- Database passwords
- API keys

## Agent Integration

### Primary Agents
- **devops** - Infrastructure management, deployments, scaling
- **incident-responder** - Troubleshooting, debugging, post-mortems

### Secondary Agents
- **cloud-integrator** - Cloud-native Kubernetes (GKE, EKS, AKS)
- **developer** - Application deployment and debugging
- **qa** - Integration testing in Kubernetes
- **security-architect** - Security audits, RBAC

## Common Workflows

### Troubleshoot Failing Pod
```bash
# 1. Find the pod
python executor.py --tool list_pods --args '{"namespace": "production"}'

# 2. Describe pod details
python executor.py --tool describe_pod --args '{"name": "app-xyz", "namespace": "production"}'

# 3. Check events
python executor.py --tool list_events --args '{"namespace": "production", "limit": 20}'

# 4. Get logs
python executor.py --tool get_logs --args '{"name": "app-xyz", "tail": 200}'
```

### Monitor Deployment Rollout
```bash
# 1. Check deployment status
python executor.py --tool list_deployments --args '{"namespace": "production"}'

# 2. Get rollout status
python executor.py --tool rollout_status --args '{"name": "web-app", "namespace": "production"}'

# 3. Watch events
python executor.py --tool watch_events --args '{"namespace": "production", "duration": 60}'
```

### Debug Service Connectivity
```bash
# 1. List services
python executor.py --tool list_services --args '{"namespace": "default"}'

# 2. Describe service
python executor.py --tool describe_service --args '{"name": "api-service"}'

# 3. Check backing pods
python executor.py --tool list_pods --args '{"selector": "app=api"}'

# 4. Port forward for testing
python executor.py --tool port_forward --args '{"name": "api-pod", "local_port": 8080, "remote_port": 8080}'
```

## Configuration

### Environment Variables
- `KUBECONFIG` - Path to kubeconfig file (default: `~/.kube/config`)
- `KUBECTL_CONTEXT` - Default kubectl context
- `KUBECTL_NAMESPACE` - Default namespace
- `KUBECTL_TIMEOUT` - Command timeout in seconds (default: 30)

### Example Configuration
```bash
export KUBECONFIG=~/.kube/config
export KUBECTL_CONTEXT=production-cluster
export KUBECTL_NAMESPACE=my-app
export KUBECTL_TIMEOUT=60
```

## Troubleshooting

### kubectl not found
```bash
# Verify kubectl installation
kubectl version --client

# Install if missing (see Installation section)
```

### Unable to connect to server
```bash
# Check cluster connectivity
kubectl cluster-info

# Verify kubeconfig
kubectl config view

# Check VPN/network
```

### Forbidden (403)
```bash
# Check RBAC permissions
kubectl auth can-i get pods
kubectl auth can-i describe deployments

# Contact cluster admin for permissions
```

### Context issues
```bash
# List available contexts
python executor.py --tool list_contexts

# Switch context
python executor.py --tool switch_context --args '{"context": "my-cluster"}'
```

## Performance Tips

- Use `--tail` to limit log output
- Use `--limit` to restrict event counts
- Use label selectors to filter lists
- Set timeouts for long-running operations

## Sources

- [mcp-server-kubernetes](https://github.com/Flux159/mcp-server-kubernetes)
- [kubectl Reference](https://kubernetes.io/docs/reference/kubectl/)
- [Kubernetes API](https://kubernetes.io/docs/reference/kubernetes-api/)

## Related Skills

- **cloud-run** - Google Cloud Run deployment
- **chrome-devtools** - Browser debugging
- **computer-use** - Playwright automation
