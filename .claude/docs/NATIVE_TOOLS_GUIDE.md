# Native Tools Guide

Complete reference for all native tools in LLM-RULES.

## Bash Tool

Execute bash commands with security validation.

### Usage

```javascript
import { bashTool } from '.claude/tools/native/bash-tool.mjs';

const result = await bashTool.execute({
  command: 'npm test',
  workingDirectory: './src',
  timeout: 30000,
  captureOutput: true
});
```

### Features

- Security validation via hooks
- Timeout handling
- Working directory support
- Structured output

### Security

All commands are validated through `security-pre-tool.sh` hook before execution.

## Code Execution Tool

Execute code in isolated environments.

### Usage

```javascript
import { codeExecutionTool } from '.claude/tools/native/code-execution-tool.mjs';

const result = await codeExecutionTool.execute({
  code: 'print("Hello, World!")',
  language: 'python',
  timeout: 10000,
  memoryLimit: 128 * 1024 * 1024
});
```

### Supported Languages

- Python (python, python3)
- Node.js (node, javascript)
- TypeScript (typescript)
- Bash (bash, shell)

## Text Editor Tool

Edit files with validation, diff generation, and backup.

### Usage

```javascript
import { textEditorTool } from '.claude/tools/native/text-editor-tool.mjs';

const result = await textEditorTool.execute({
  file_path: './src/App.tsx',
  edits: [
    {
      type: 'replace',
      old_text: 'const App = () => {',
      new_text: 'const App: React.FC = () => {'
    }
  ],
  create_backup: true,
  validate: true
});
```

### Edit Types

- **replace** - Replace text
- **insert** - Insert at line
- **delete** - Delete line

## Web Fetch Tool

Fetch URLs with security, rate limiting, and caching.

### Usage

```javascript
import { webFetchTool } from '.claude/tools/native/web-fetch-tool.mjs';

const result = await webFetchTool.execute({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
  timeout: 30000,
  use_cache: true,
  cache_ttl: 300000
});
```

### Security

- Blocks localhost/private IPs by default
- Rate limiting (60 requests/minute)
- Caching for performance

## Web Search Tool

Search the web with multiple providers.

### Usage

```javascript
import { webSearchTool } from '.claude/tools/native/web-search-tool.mjs';

const result = await webSearchTool.execute({
  query: 'React hooks best practices',
  provider: 'exa', // or 'google', 'duckduckgo'
  num_results: 10,
  filter_domains: ['github.com', 'stackoverflow.com'],
  language: 'en'
});
```

### Providers

- **Exa** - Requires `EXA_API_KEY`
- **Google** - Requires `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`
- **DuckDuckGo** - No API key required

## Memory Tool

Store and retrieve long-term memories.

### Usage

```javascript
import { memoryTool } from '.claude/tools/native/memory-tool.mjs';

// Store
await memoryTool.execute({
  operation: 'store',
  content: 'User prefers dark mode',
  tags: ['preferences', 'ui'],
  importance: 'medium'
});

// Retrieve
const memories = await memoryTool.execute({
  operation: 'retrieve',
  query: 'user preferences',
  limit: 10
});
```

### Operations

- **store** - Store a memory
- **retrieve** - Search and retrieve memories
- **update** - Update existing memory
- **delete** - Delete a memory

## Computer Use Tool

UI automation and screenshot capture (requires browser automation).

### Usage

```javascript
import { computerUseTool } from '.claude/tools/native/computer-use-tool.mjs';

// Screenshot
await computerUseTool.execute({
  action: 'screenshot',
  url: 'https://example.com',
  full_page: true
});

// Click element
await computerUseTool.execute({
  action: 'click',
  selector: '#submit-button'
});
```

### Actions

- **screenshot** - Capture screenshot
- **click** - Click element
- **type** - Type text
- **navigate** - Navigate to URL
- **get_content** - Extract page content

## Streaming Support

All tools support streaming:

```javascript
import { createStreamingTool } from '.claude/tools/native/streaming-wrapper.mjs';

const streamingTool = createStreamingTool(bashTool);

for await (const event of streamingTool.execute({ command: 'npm test' })) {
  switch (event.type) {
    case 'start':
      console.log('Starting execution...');
      break;
    case 'progress':
      console.log('Progress:', event.message);
      break;
    case 'complete':
      console.log('Result:', event.result);
      break;
    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

## Error Handling

All tools return structured error responses:

```javascript
const result = await tool.execute(input);

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Details:', result.details);
}
```

## Best Practices

1. Always use timeouts for long-running operations
2. Enable caching for web fetch when appropriate
3. Create backups before editing files
4. Use streaming for better user experience
5. Validate inputs before tool execution
6. Handle errors gracefully
7. Monitor tool usage with analytics

