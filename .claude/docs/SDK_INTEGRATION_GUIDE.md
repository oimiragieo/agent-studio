# SDK Integration Guide

This guide explains how to use the Agent SDK integration features in LLM-RULES.

## Overview

LLM-RULES now includes native Agent SDK integration, providing:
- Native tool implementations
- Fine-grained streaming support
- Subagent management
- Permission system
- Session management
- MCP connector
- Enterprise APIs

## Native Tools

All native tools are located in `.claude/tools/native/`:

### Available Tools

- **bash-tool.mjs** - Execute bash commands with security validation
- **code-execution-tool.mjs** - Execute code in isolated environments
- **text-editor-tool.mjs** - Edit files with validation and backup
- **web-fetch-tool.mjs** - Fetch URLs with rate limiting and caching
- **web-search-tool.mjs** - Search the web with multiple providers
- **memory-tool.mjs** - Store and retrieve long-term memories
- **computer-use-tool.mjs** - UI automation and screenshot capture

### Using Native Tools

```javascript
import { bashTool } from '.claude/tools/native/bash-tool.mjs';

const result = await bashTool.execute({
  command: 'ls -la',
  workingDirectory: process.cwd(),
  timeout: 30000
});
```

### Tool Registry

```javascript
import { getTool, getAllTools } from '.claude/tools/native/registry.mjs';

const tool = getTool('bash');
const allTools = getAllTools();
```

## Streaming Support

All tools support fine-grained streaming:

```javascript
import { createStreamingTool } from '.claude/tools/native/streaming-wrapper.mjs';
import { bashTool } from '.claude/tools/native/bash-tool.mjs';

const streamingBash = createStreamingTool(bashTool);

for await (const event of streamingBash.execute({ command: 'npm test' })) {
  if (event.type === 'progress') {
    console.log('Progress:', event.message);
  } else if (event.type === 'complete') {
    console.log('Result:', event.result);
  }
}
```

## Agent SDK Integration

### Creating Subagents

```javascript
import { createSubagent } from '.claude/agents/sdk/subagent-manager.mjs';

const agent = await createSubagent('developer', {
  model: 'claude-sonnet-4',
  temperature: 0.3
});
```

### Permissions

```javascript
import { checkPermission } from '.claude/agents/sdk/permissions.mjs';

const result = await checkPermission('developer', 'Bash');
if (result.allowed) {
  // Tool is allowed
} else {
  console.error('Blocked:', result.reason);
}
```

### Sessions

```javascript
import { createSDKSession } from '.claude/agents/sdk/session-handler.mjs';

const session = await createSDKSession('developer', {
  project: 'my-project',
  feature: 'user-auth'
});
```

## Skills SDK

### Registering Skills

```javascript
import { registerSkill } from '.claude/skills/sdk/skill-registry.mjs';

const skill = await registerSkill('rule-auditor');
```

### Using Skills

Skills are automatically discovered and can be invoked via natural language or the Skill tool.

## MCP Integration

### Connecting to MCP Servers

```javascript
import { createMCPConnector } from '.claude/tools/mcp/connector.mjs';

const connector = createMCPConnector();
await connector.connect('shadcn');
const tools = await connector.getAllTools();
```

### Remote MCP Servers

```javascript
import { RemoteMCPServerManager } from '.claude/tools/mcp/remote-servers.mjs';

const manager = new RemoteMCPServerManager();
manager.addFailover('primary-server', 'backup-server');
const result = await manager.connectWithFailover('primary-server');
```

## Enterprise APIs

### Administration API

```javascript
import { getOrganization, listOrganizationMembers } from '.claude/tools/admin-api.mjs';

const org = await getOrganization('org-id');
const members = await listOrganizationMembers('org-id');
```

### Usage Cost API

```javascript
import { getRealTimeCost, checkBudgetAlerts } from '.claude/tools/usage-cost-api.mjs';

const cost = await getRealTimeCost('developer', 60); // Last 60 minutes
const alerts = await checkBudgetAlerts({
  daily_limit: 100,
  hourly_limit: 10
});
```

### Analytics API

```javascript
import { trackEvent, getAgentMetrics } from '.claude/tools/analytics-api.mjs';

trackEvent('tool_execution', {
  agent: 'developer',
  tool: 'bash',
  sessionId: 'session-123'
});

const metrics = await getAgentMetrics('developer', '7d');
```

## Hooks System

### Available Hooks

- **PreToolUse** - `security-pre-tool.sh` - Validates commands before execution
- **PostToolUse** - `audit-post-tool.sh` - Logs tool executions
- **UserPromptSubmit** - `user-prompt-submit.sh` - Validates user prompts
- **Notification** - `notification.sh` - Handles notifications
- **Stop** - `stop.sh` - Handles graceful shutdown

### Using Hook Orchestrator

```javascript
import { executeHook, HookTypes } from '.claude/hooks/orchestrator.mjs';

const result = await executeHook(HookTypes.PreToolUse, {
  tool_name: 'Bash',
  tool_input: { command: 'ls -la' }
});
```

## Guardrails

### Checking Guardrails

```javascript
import { checkAllGuardrails } from '.claude/tools/guardrails-enforcer.mjs';

const result = checkAllGuardrails(
  'User prompt text',
  'command to execute',
  { hasSource: true }
);

if (!result.allowed) {
  console.error('Blocked:', result.issues);
}
```

## Best Practices

1. **Always use native tools** when available instead of direct system calls
2. **Enable streaming** for long-running operations
3. **Check permissions** before executing tools
4. **Use sessions** to track agent interactions
5. **Monitor costs** with Usage Cost API
6. **Track events** with Analytics API
7. **Register hooks** for security and audit trails

## Migration from Legacy

If you're using the old configuration-based approach:

1. Update agent files to use XML structure
2. Register skills with SDK
3. Use native tools instead of direct system calls
4. Enable streaming for better UX
5. Set up enterprise APIs for monitoring

See `MIGRATION_TO_SDK.md` for detailed migration steps.

