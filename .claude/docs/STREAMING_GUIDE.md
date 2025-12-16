# Streaming Guide

Guide to using fine-grained streaming in LLM-RULES tools.

## Overview

Streaming provides real-time progress updates for tool execution, improving user experience and allowing for cancellation.

## Basic Streaming

### Creating Streaming Tools

```javascript
import { createStreamingTool } from '.claude/tools/native/streaming-wrapper.mjs';
import { bashTool } from '.claude/tools/native/bash-tool.mjs';

const streamingBash = createStreamingTool(bashTool);
```

### Consuming Streams

```javascript
for await (const event of streamingBash.execute({ command: 'npm test' })) {
  console.log('Event:', event.type, event);
}
```

## Event Types

### Start Event

```javascript
{
  type: 'start',
  tool: 'bash',
  timestamp: '2025-01-01T00:00:00Z',
  input: { command: 'npm test' }
}
```

### Progress Event

```javascript
{
  type: 'progress',
  message: 'Executing npm test...',
  timestamp: '2025-01-01T00:00:01Z'
}
```

### Complete Event

```javascript
{
  type: 'complete',
  tool: 'bash',
  result: { success: true, stdout: '...', stderr: '' },
  executionTime: 5000,
  timestamp: '2025-01-01T00:00:05Z'
}
```

### Error Event

```javascript
{
  type: 'error',
  tool: 'bash',
  error: { message: 'Command failed', stack: '...' },
  executionTime: 2000,
  timestamp: '2025-01-01T00:00:02Z'
}
```

## Collecting Streams

For simpler usage, collect all events:

```javascript
import { collectStream } from '.claude/tools/native/streaming-wrapper.mjs';

const { result, events, summary } = await collectStream(
  streamingBash.execute({ command: 'npm test' })
);

console.log('Final result:', result);
console.log('Total events:', summary.totalEvents);
```

## Cancellation

Streaming tools support cancellation:

```javascript
const streamingTool = createStreamingTool(bashTool);
const stream = streamingTool.execute({ command: 'long-running-command' });

// Cancel after 10 seconds
setTimeout(() => {
  streamingTool.cancel();
}, 10000);

try {
  for await (const event of stream) {
    // Process events
  }
} catch (error) {
  if (error.name === 'CancelledError') {
    console.log('Operation cancelled');
  }
}
```

## Custom Progress Events

Tools can emit custom progress events:

```javascript
async function* customTool(input) {
  yield { type: 'start', tool: 'custom' };
  
  // Emit progress
  yield { type: 'progress', message: 'Step 1/3', step: 1 };
  await doStep1();
  
  yield { type: 'progress', message: 'Step 2/3', step: 2 };
  await doStep2();
  
  yield { type: 'progress', message: 'Step 3/3', step: 3 };
  const result = await doStep3();
  
  yield { type: 'complete', result };
}
```

## Best Practices

1. **Always handle errors** - Streams can throw errors
2. **Show progress** - Update UI with progress events
3. **Allow cancellation** - Long operations should be cancellable
4. **Collect for simple cases** - Use `collectStream` when you don't need real-time updates
5. **Log events** - Track streaming events for debugging

## Integration with Agents

Agents can use streaming tools:

```javascript
const agent = await createSubagent('developer');
const streamingTool = createStreamingTool(bashTool);

// Agent can consume stream
for await (const event of streamingTool.execute({ command: 'npm test' })) {
  if (event.type === 'progress') {
    // Update agent context with progress
    await updateSDKSession(sessionId, { progress: event.message });
  }
}
```

