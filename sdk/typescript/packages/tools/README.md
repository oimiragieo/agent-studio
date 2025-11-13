# @anthropic-ai/claude-agent-sdk-tools

**Enterprise-grade built-in tools** for the Claude Agent SDK with comprehensive security, performance optimization, and production-ready implementations.

## Features

✅ **Bash Tool** (`bash_20250124`) - Shell command execution with security validation
✅ **Text Editor Tool** - File operations with atomic updates
✅ **Web Fetch Tool** - HTTP requests with HTML→Markdown conversion and caching
✅ **Memory Tool** - Persistent key-value storage with namespaces and TTL

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk-tools
# or
pnpm add @anthropic-ai/claude-agent-sdk-tools
```

## Quick Start

### Using All Tools

```typescript
import { createAllTools } from '@anthropic-ai/claude-agent-sdk-tools';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Create all built-in tools
const tools = createAllTools({
  bash: {
    maxTimeout: 120000,
    auditLog: true,
    sandbox: false,
  },
  textEditor: {
    cwd: process.cwd(),
    protectedPaths: ['/etc', '/sys'],
  },
  webFetch: {
    maxSize: 5 * 1024 * 1024, // 5MB
    timeout: 30000,
  },
  memory: {
    persistPath: '.claude/memory.json',
  },
});

// Use with SDK
for await (const msg of query('Run ls command', {
  mcpServers: {
    tools: {
      tools: Object.values(tools),
    },
  },
})) {
  console.log(msg);
}
```

### Individual Tools

#### Bash Tool

```typescript
import { createBashTool } from '@anthropic-ai/claude-agent-sdk-tools';

const bash = createBashTool({
  maxTimeout: 120000, // 2 minutes max
  auditLog: true,
  sandbox: false,
  blockPatterns: [
    /rm\s+-rf\s+\//i,     // Block dangerous rm
    /dd\s+if=/i,          // Block disk operations
  ],
});

// Execute command
const result = await bash.handler({
  command: 'ls -la',
  timeout: 30000,
});

console.log(result.content[0].text);

// Check history
const history = bash.getHistory();
console.log('Command history:', history);
```

**Security Features:**
- Dangerous pattern blocking (rm -rf, dd, mkfs, fork bombs)
- Command injection detection
- Resource limits and timeouts
- Audit logging
- Sandboxed execution (optional)

**Blocked Commands:**
- `rm -rf /` - Dangerous file deletion
- `dd if=` - Disk operations
- `mkfs` - Filesystem formatting
- `:(){ :|:& };:` - Fork bombs
- `sudo` - Privilege escalation
- `curl ... | bash` - Pipe to bash
- And more...

#### Text Editor Tool

```typescript
import { createTextEditorTool } from '@anthropic-ai/claude-agent-sdk-tools';

const editor = createTextEditorTool({
  cwd: '/path/to/project',
  protectedPaths: ['/etc', '/sys', '/proc'],
});

// Read file
await editor.handler({
  operation: 'read',
  file_path: 'package.json',
  start_line: 1,
  end_line: 20,
});

// Write file
await editor.handler({
  operation: 'write',
  file_path: 'output.txt',
  content: 'Hello, World!',
});

// Edit file (string replacement)
await editor.handler({
  operation: 'edit',
  file_path: 'config.json',
  old_string: '"debug": false',
  new_string: '"debug": true',
});
```

**Features:**
- Line-numbered output for easy reference
- Atomic file updates with backups
- Unique string replacement (prevents ambiguity)
- Path validation and security
- Protected path blocking

#### Web Fetch Tool

```typescript
import { createWebFetchTool } from '@anthropic-ai/claude-agent-sdk-tools';

const webFetch = createWebFetchTool({
  maxSize: 5 * 1024 * 1024, // 5MB max
  timeout: 30000, // 30 seconds
});

// Fetch and process web content
const result = await webFetch.handler({
  url: 'https://example.com/article',
  prompt: 'Summarize the main points of this article',
  headers: {
    'User-Agent': 'My-Bot/1.0',
  },
});

console.log(result.content[0].text);
```

**Features:**
- HTML to Markdown conversion
- Response caching (15 minutes)
- Size limits and timeouts
- HTTPS upgrade
- Custom headers support

#### Memory Tool

```typescript
import { createMemoryTool } from '@anthropic-ai/claude-agent-sdk-tools';

const memory = createMemoryTool({
  persistPath: '.claude/memory.json',
});

// Store value
await memory.handler({
  operation: 'set',
  key: 'user_preference',
  value: { theme: 'dark', language: 'en' },
  namespace: 'settings',
  ttl: 3600, // 1 hour
});

// Retrieve value
await memory.handler({
  operation: 'get',
  key: 'user_preference',
  namespace: 'settings',
});

// List all keys
await memory.handler({
  operation: 'list',
  namespace: 'settings',
});

// Search
await memory.handler({
  operation: 'search',
  query: 'theme',
  namespace: 'settings',
});

// Delete
await memory.handler({
  operation: 'delete',
  key: 'user_preference',
  namespace: 'settings',
});
```

**Features:**
- Namespace isolation
- TTL (time-to-live) support
- Persistence to disk
- Search capabilities
- JSON-serializable values

## Tool Specifications

### Bash Tool (bash_20250124)

**Input Schema:**
```typescript
{
  command: string;        // Required: bash command to execute
  timeout?: number;       // Optional: timeout in ms (default: 120000, max: 600000)
  cwd?: string;          // Optional: working directory
  env?: Record<string, string>; // Optional: environment variables
}
```

**Security:**
- Command validation against dangerous patterns
- Command injection detection
- Timeout enforcement
- Resource limits
- Audit logging

**Token Cost:** 245 input tokens per invocation

### Text Editor Tool

**Input Schema:**
```typescript
{
  operation: 'read' | 'write' | 'edit';
  file_path: string;
  content?: string;       // For 'write'
  old_string?: string;    // For 'edit'
  new_string?: string;    // For 'edit'
  start_line?: number;    // For 'read'
  end_line?: number;      // For 'read'
}
```

**Operations:**
- **read**: Read file with optional line range
- **write**: Create or overwrite file atomically
- **edit**: Replace unique string with backup

### Web Fetch Tool

**Input Schema:**
```typescript
{
  url: string;            // Required: URL to fetch
  prompt: string;         // Required: what to extract
  headers?: Record<string, string>; // Optional: custom headers
}
```

**Features:**
- Converts HTML to Markdown
- 15-minute cache
- Size limits (default 5MB)
- Timeout protection

### Memory Tool

**Input Schema:**
```typescript
{
  operation: 'set' | 'get' | 'delete' | 'list' | 'search';
  key?: string;
  value?: any;            // JSON-serializable
  namespace?: string;     // Default: 'default'
  ttl?: number;          // Seconds
  query?: string;        // For search
}
```

**Storage:**
- In-memory with optional disk persistence
- Namespace isolation
- Automatic expiration
- Search by key or value

## Configuration

### Global Configuration

```typescript
import { createAllTools } from '@anthropic-ai/claude-agent-sdk-tools';

const tools = createAllTools({
  // Bash configuration
  bash: {
    maxTimeout: 120000,
    auditLog: true,
    sandbox: false,
    blockPatterns: [/custom-pattern/],
    resourceLimits: {
      maxMemory: '256m',
      maxCpu: 50,
    },
  },

  // Text Editor configuration
  textEditor: {
    cwd: process.cwd(),
    protectedPaths: ['/etc', '/sys', '/proc', '/dev'],
  },

  // Web Fetch configuration
  webFetch: {
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 60000, // 60 seconds
  },

  // Memory configuration
  memory: {
    persistPath: '.claude/memory.json',
  },
});
```

### Security Best Practices

1. **Bash Tool**
   - Always enable `auditLog` in production
   - Use `sandbox: true` for untrusted environments
   - Add custom `blockPatterns` for your use case
   - Set appropriate `maxTimeout`

2. **Text Editor Tool**
   - Configure `protectedPaths` to prevent system file access
   - Use absolute paths when possible
   - Validate file paths before operations

3. **Web Fetch Tool**
   - Set reasonable `maxSize` limits
   - Use domain allowlists for sensitive applications
   - Configure appropriate timeouts

4. **Memory Tool**
   - Use namespaces for data isolation
   - Set TTL for sensitive data
   - Implement size limits for production

## Performance

| Tool | Avg Latency | Memory Usage | Notes |
|------|-------------|--------------|-------|
| Bash | <100ms | <256MB | Persistent session |
| Text Editor | <50ms | <128MB | File I/O bound |
| Web Fetch | 500ms-2s | <64MB | Network dependent |
| Memory | <10ms | Variable | In-memory operations |

## Error Handling

All tools return consistent error responses:

```typescript
{
  content: [{
    type: 'text',
    text: 'Error: <error message>'
  }],
  is_error: true
}
```

## Examples

See `examples/` directory for complete usage examples:

- `bash-examples.ts` - Bash tool usage patterns
- `text-editor-examples.ts` - File operations
- `web-fetch-examples.ts` - Web scraping
- `memory-examples.ts` - Data persistence

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  BashInput,
  BashConfig,
  BashToolState,
  TextEditorInput,
  WebFetchInput,
  MemoryInput,
} from '@anthropic-ai/claude-agent-sdk-tools';
```

## Testing

```bash
pnpm test                # Run all tests
pnpm test:watch          # Watch mode
pnpm test bash           # Test specific tool
```

## License

MIT

## Support

- Documentation: https://docs.anthropic.com
- Issues: https://github.com/anthropics/claude-agent-sdk/issues
- Email: support@anthropic.com
