# Enterprise Agent SDK Architecture

## Overview

This is an **enterprise-grade, production-ready Agent SDK** implementing all Claude Agent capabilities with:

- ✅ **Dual-language support** - TypeScript & Python with feature parity
- ✅ **Fine-grained streaming** - 67% latency reduction
- ✅ **Enterprise security** - 4 permission modes, tool-level access control, guardrails
- ✅ **Built-in tools** - Bash, Computer Use, Text Editor, Web Fetch, Web Search, Memory
- ✅ **MCP integration** - stdio, HTTP/SSE, and in-process servers
- ✅ **Subagents** - Isolated contexts, parallel execution
- ✅ **Cost tracking** - Token usage, pricing calculations
- ✅ **Skills & plugins** - Extensible capabilities
- ✅ **Production-ready** - Error handling, logging, monitoring

## Directory Structure

```
sdk/
├── typescript/               # TypeScript SDK
│   ├── packages/
│   │   ├── core/            # Core SDK functionality
│   │   │   ├── src/
│   │   │   │   ├── client/  # Main SDK client
│   │   │   │   ├── tools/   # Tool implementations
│   │   │   │   ├── streaming/ # Fine-grained streaming
│   │   │   │   ├── permissions/ # Permission system
│   │   │   │   ├── session/ # Session management
│   │   │   │   └── types/   # TypeScript types
│   │   │   ├── tests/
│   │   │   └── package.json
│   │   ├── tools/           # Built-in tools
│   │   │   ├── src/
│   │   │   │   ├── bash/
│   │   │   │   ├── computer-use/
│   │   │   │   ├── text-editor/
│   │   │   │   ├── web-fetch/
│   │   │   │   ├── web-search/
│   │   │   │   └── memory/
│   │   │   └── package.json
│   │   ├── mcp/             # MCP connector
│   │   │   ├── src/
│   │   │   │   ├── stdio/
│   │   │   │   ├── http/
│   │   │   │   └── sdk/
│   │   │   └── package.json
│   │   ├── subagents/       # Subagent system
│   │   ├── skills/          # Skills framework
│   │   ├── plugins/         # Plugin system
│   │   ├── guardrails/      # Security guardrails
│   │   └── prompt-engineering/ # Prompt utilities
│   ├── examples/            # Usage examples
│   ├── docs/                # Documentation
│   ├── pnpm-workspace.yaml
│   ├── tsconfig.json
│   └── package.json
│
├── python/                  # Python SDK
│   ├── claude_agent_sdk/
│   │   ├── __init__.py
│   │   ├── client.py        # Main SDK client
│   │   ├── tools/           # Tool implementations
│   │   ├── streaming/       # Fine-grained streaming
│   │   ├── permissions/     # Permission system
│   │   ├── session/         # Session management
│   │   ├── mcp/             # MCP connector
│   │   ├── subagents/       # Subagent system
│   │   ├── skills/          # Skills framework
│   │   ├── plugins/         # Plugin system
│   │   ├── guardrails/      # Security guardrails
│   │   └── prompt_engineering/ # Prompt utilities
│   ├── tests/
│   ├── examples/
│   ├── docs/
│   ├── pyproject.toml
│   └── README.md
│
├── shared/                  # Shared schemas and configs
│   ├── schemas/             # JSON schemas
│   └── configs/             # Configuration templates
│
├── docs/                    # Comprehensive documentation
│   ├── getting-started.md
│   ├── tool-use.md
│   ├── streaming.md
│   ├── permissions.md
│   ├── subagents.md
│   ├── mcp-integration.md
│   ├── security.md
│   └── api-reference/
│
└── ARCHITECTURE.md          # This file
```

## Core Components

### 1. Client (query, ClaudeSDKClient)

**Purpose**: Main entry point for SDK interactions

**Key Features**:
- Single-turn (`query()`) and multi-turn (`ClaudeSDKClient`) modes
- Streaming and non-streaming support
- Session management with persistence
- Automatic context compaction
- Hook integration
- Error handling and retries

**TypeScript API**:
```typescript
import { query, ClaudeSDKClient } from '@anthropic-ai/claude-agent-sdk';

// Single-turn
for await (const message of query('Your prompt', options)) {
  console.log(message);
}

// Multi-turn
const client = new ClaudeSDKClient(options);
await client.connect();
await client.query('First message');
for await (const msg of client.receiveResponse()) {
  console.log(msg);
}
await client.disconnect();
```

**Python API**:
```python
from claude_agent_sdk import query, ClaudeSDKClient

# Single-turn
async for message in query('Your prompt', options):
    print(message)

# Multi-turn
async with ClaudeSDKClient(options) as client:
    await client.query('First message')
    async for msg in client.receive_response():
        print(msg)
```

### 2. Tool System

**Purpose**: Extensible tool framework with built-in and custom tools

**Built-in Tools**:
- **Bash** (`bash_20250124`) - Shell command execution
- **Computer Use** (`computer_20250124`) - Desktop automation
- **Text Editor** - File editing operations
- **Web Fetch** - HTTP requests with AI processing
- **Web Search** - Internet search integration
- **Memory** - Persistent agent memory

**Custom Tools**:
```typescript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  schema: z.object({
    location: z.string(),
    unit: z.enum(['celsius', 'fahrenheit']).optional()
  }),
  handler: async (args) => {
    // Implementation
    return { content: [{ type: 'text', text: 'Sunny, 72°F' }] };
  }
});

const server = createSdkMcpServer({
  name: 'weather-server',
  version: '1.0.0',
  tools: [weatherTool]
});
```

### 3. Fine-Grained Streaming

**Purpose**: 67% latency reduction for large tool parameters

**Implementation**:
- Stream tool use blocks incrementally
- Process partial parameters as they arrive
- Validate and execute before full completion
- Fallback to standard streaming for small parameters

**Benefits**:
- 15s → 3s for large parameter transmission
- Improved UX for real-time applications
- Automatic optimization based on parameter size

### 4. Permission System

**Permission Modes**:
1. **default** - Standard permission checks
2. **plan** - Read-only, present plan before execution
3. **acceptEdits** - Auto-approve file operations
4. **bypassPermissions** - Auto-approve all tools (use with caution)

**Permission Flow**:
```
PreToolUse Hook → Deny Rules → Allow Rules → Ask Rules →
Permission Mode → canUseTool Callback → PostToolUse Hook
```

**Configuration**:
```typescript
{
  permissionMode: 'default',
  allowedTools: ['Read', 'Write', 'Bash'],
  disallowedTools: ['rm', 'format'],
  canUseTool: async (name, input) => {
    // Custom logic
    return { allow: true };
  }
}
```

### 5. Subagents

**Purpose**: Specialized agents with isolated contexts

**Features**:
- Independent context windows
- Parallel execution
- Tool scoping
- Model selection per agent

**Configuration**:
```typescript
{
  agents: {
    'code-reviewer': {
      description: 'Reviews code for quality and security',
      prompt: 'You are an expert code reviewer...',
      tools: ['Read', 'Grep', 'Glob'],
      model: 'sonnet'
    },
    'security-scanner': {
      description: 'Scans for security vulnerabilities',
      prompt: 'You are a security expert...',
      tools: ['Read', 'Grep'],
      model: 'opus'
    }
  }
}
```

### 6. MCP Integration

**Transport Types**:
1. **stdio** - External processes via stdin/stdout
2. **HTTP/SSE** - Remote servers via HTTP
3. **SDK** - In-process servers within application

**Configuration**:
```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/path/to/github-mcp/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "remote-api": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

### 7. Session Management

**Features**:
- Session persistence across invocations
- Context compaction to prevent token exhaustion
- Session metadata tracking
- Multi-session support

**Session State**:
```typescript
interface SessionState {
  id: string;
  startTime: Date;
  messageHistory: Message[];
  tokenUsage: TokenUsage;
  cost: number;
  tools: ToolUse[];
}
```

### 8. Cost Tracking

**Metrics Tracked**:
- Input tokens (base, cached)
- Output tokens
- Cache creation/read tokens
- Per-message costs
- Cumulative session costs

**Deduplication**:
- Same message ID = same usage data
- Only charge once per step
- Use result message for authoritative totals

### 9. Hooks System

**Hook Types**:
- **PreToolUse** - Before tool execution
- **PostToolUse** - After tool execution
- **UserPromptSubmit** - Before prompt processing
- **Notification** - System notifications
- **Stop** - Session termination
- **PreCompact** - Before context compaction

**Usage**:
```typescript
{
  hooks: {
    PreToolUse: async (event) => {
      console.log(`Tool: ${event.tool.name}`);
      // Return { cancel: true } to block execution
    },
    PostToolUse: async (event) => {
      console.log(`Result: ${event.result}`);
    }
  }
}
```

### 10. Skills Framework

**Purpose**: Packaged, reusable agent capabilities

**Structure**:
```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
allowed-tools:
  - Read
  - Grep
  - Glob
model: sonnet
---

# Code Reviewer Skill

You are an expert code reviewer. Analyze the code for:
1. Code quality and maintainability
2. Performance issues
3. Security vulnerabilities
4. Best practice violations

Provide actionable feedback with specific line references.
```

### 11. Security Guardrails

**Features**:
- **Jailbreak mitigation** - Input validation and filtering
- **Hallucination prevention** - Source grounding, citations
- **Prompt leak protection** - Output sanitization
- **Command validation** - Bash command filtering
- **PII detection** - Automatic redaction

**Implementation**:
```typescript
{
  guardrails: {
    enableJailbreakMitigation: true,
    enableHallucinationPrevention: true,
    enableCommandValidation: true,
    blockPatterns: ['rm -rf /', 'dd if=', 'mkfs'],
    piiDetection: {
      enabled: true,
      redact: true
    }
  }
}
```

### 12. Prompt Engineering Utilities

**Features**:
- **Prompt Generator** - AI-assisted prompt creation
- **Prompt Improver** - Optimization suggestions
- **Prompt Templates** - Reusable patterns
- **Variable Interpolation** - Dynamic prompts

**Example**:
```typescript
import { PromptGenerator, PromptTemplate } from '@anthropic-ai/claude-agent-sdk/prompt-engineering';

const generator = new PromptGenerator();
const optimized = await generator.improve(
  'Write a function to sort an array',
  { goal: 'clarity', audience: 'senior-developer' }
);

const template = new PromptTemplate(`
You are a {{role}} with {{years}} years of experience.
Task: {{task}}
Requirements: {{requirements}}
`);

const prompt = template.render({
  role: 'senior architect',
  years: 10,
  task: 'Design a microservices system',
  requirements: ['scalable', 'fault-tolerant']
});
```

## Performance Characteristics

| Metric | Target | Implementation |
|--------|--------|----------------|
| Streaming Latency Reduction | >60% | 67% via fine-grained streaming |
| Context Utilization | <70% | Automatic compaction |
| Permission Check Latency | <10ms | Optimized flow hierarchy |
| Tool Execution Overhead | <50ms | Parallel processing |
| Cost per Workflow | <$3 | Token optimization, caching |
| Security Compliance | >95% | Multi-layer guardrails |

## Error Handling Strategy

1. **Graceful degradation** - Fallback to standard streaming if fine-grained fails
2. **Automatic retries** - Network errors, transient failures
3. **Comprehensive logging** - All errors logged with context
4. **User-friendly messages** - Technical details hidden, actionable guidance shown
5. **Error recovery** - Session state preserved across failures

## Testing Strategy

1. **Unit tests** - 80%+ coverage for all modules
2. **Integration tests** - E2E workflows with real API calls
3. **Security tests** - Guardrail effectiveness, permission enforcement
4. **Performance tests** - Latency, throughput, cost benchmarks
5. **Compatibility tests** - Cross-platform, multi-model support

## Deployment Options

1. **Standalone** - Direct API integration
2. **Serverless** - AWS Lambda, Google Cloud Functions
3. **Containers** - Docker, Kubernetes
4. **Desktop** - Electron, native applications
5. **Web** - Browser-based with CORS handling

## Security Considerations

1. **API Key Management** - Environment variables, secret managers
2. **Sandboxing** - Isolated execution environments for tools
3. **Input Validation** - All user inputs sanitized
4. **Output Sanitization** - PII redaction, prompt leak prevention
5. **Audit Logging** - Comprehensive security event tracking
6. **Least Privilege** - Minimal tool permissions by default

## Extensibility Points

1. **Custom Tools** - Via MCP server pattern
2. **Custom Hooks** - Lifecycle event handling
3. **Custom Skills** - Packaged capabilities
4. **Custom Plugins** - Extended functionality
5. **Custom Guardrails** - Domain-specific security
6. **Custom Transports** - New MCP transport types

## Monitoring & Observability

1. **Token Usage** - Real-time tracking
2. **Cost Metrics** - Per-session, per-user
3. **Performance Metrics** - Latency, throughput
4. **Error Rates** - Tool failures, API errors
5. **Security Events** - Blocked commands, jailbreak attempts
6. **User Analytics** - Usage patterns, feature adoption

## Roadmap

### Phase 1: Core SDK (Current)
- ✅ Client implementation
- ✅ Tool system
- ✅ Streaming support
- ✅ Permission system

### Phase 2: Advanced Features
- ✅ Fine-grained streaming
- ✅ Subagents
- ✅ MCP integration
- ✅ Skills framework

### Phase 3: Enterprise Features
- ✅ Security guardrails
- ✅ Cost tracking
- ✅ Admin APIs
- ✅ Audit logging

### Phase 4: Optimization
- Advanced caching strategies
- Multi-region deployment
- Performance tuning
- Cost optimization

## Contributing

See `CONTRIBUTING.md` for guidelines on:
- Code style
- Testing requirements
- Documentation standards
- PR process

## License

MIT License - See `LICENSE` file for details
