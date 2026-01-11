# Artifact Cache Usage Guide

## Overview

The Artifact Cache system provides dual-purpose caching for workflow optimization:

1. **File-based caching**: Caches artifacts from disk to avoid redundant file I/O operations
2. **Workflow-based caching**: Caches workflow step outputs to avoid redundant agent executions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Artifact Cache System                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   File Cache     │         │ Workflow Cache   │         │
│  ├──────────────────┤         ├──────────────────┤         │
│  │ TTL: 5 minutes   │         │ TTL: 1 hour      │         │
│  │ Key: File path   │         │ Key: SHA-256     │         │
│  │ Storage: Memory  │         │ Storage: Mem+Disk│         │
│  └──────────────────┘         └──────────────────┘         │
│                                                              │
│  ┌───────────────────────────────────────────────┐         │
│  │         Shared Features                        │         │
│  ├───────────────────────────────────────────────┤         │
│  │ • LRU eviction (500 entries max)              │         │
│  │ • Memory management (50MB max per cache)      │         │
│  │ • Auto-cleanup (5 min interval)               │         │
│  │ • Cache statistics                            │         │
│  └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## File-Based Caching

### Use Cases

- Loading large JSON artifacts repeatedly
- Avoiding redundant file I/O during workflow execution
- Caching configuration files

### API

```javascript
import {
  loadArtifact,
  cacheArtifact,
  getCachedArtifact,
  invalidateArtifact,
} from './.claude/tools/artifact-cache.mjs';

// Load artifact with caching
const artifact = await loadArtifact('.claude/context/artifacts/plan.json');

// Manually cache an artifact
await cacheArtifact('.claude/context/artifacts/plan.json', planData, 300000); // 5 min TTL

// Get cached artifact (returns null if not cached or expired)
const cached = await getCachedArtifact('.claude/context/artifacts/plan.json');

// Invalidate specific artifact
invalidateArtifact('.claude/context/artifacts/plan.json');

// Invalidate all file cache
invalidateArtifact();
```

### Features

- **Automatic invalidation**: Cache is invalidated if file modification time changes
- **TTL-based expiration**: Default 5 minutes, configurable
- **Streaming support**: Large files (>1MB) use streaming JSON parser
- **Memory efficient**: LRU eviction when memory limit exceeded

## Workflow-Based Caching

### Use Cases

- Avoiding redundant agent executions with same inputs
- Caching expensive computation results
- Speeding up workflow re-runs during development

### API

```javascript
import {
  getWorkflowCache,
  setWorkflowCache,
  clearWorkflowCache,
  generateKey,
} from './.claude/tools/artifact-cache.mjs';

// Check for cached output before running agent
const workflowId = 'greenfield-dev-001';
const stepNumber = 2;
const inputs = {
  requirements: 'Build user authentication',
  tech_stack: 'React, Node.js',
};

const cachedOutput = await getWorkflowCache(workflowId, stepNumber, inputs);

if (cachedOutput) {
  console.log('Using cached output, skipping agent execution');
  return cachedOutput;
}

// Execute agent (expensive operation)
const output = await executeAgent(inputs);

// Cache the output for future use
await setWorkflowCache(workflowId, stepNumber, inputs, output);

// Clear cache for specific workflow
await clearWorkflowCache(workflowId);

// Clear all workflow cache
await clearWorkflowCache();

// Generate cache key manually
const cacheKey = generateKey(workflowId, stepNumber, inputs);
console.log(`Cache key: ${cacheKey}`);
```

### Features

- **SHA-256 key generation**: Deterministic keys from workflow ID + step + inputs
- **Persistent storage**: Cache survives process restarts
- **TTL-based expiration**: Default 1 hour, configurable
- **Input-sensitive**: Different inputs = different cache entries

## Cache Statistics

### Get Statistics

```javascript
import { getCacheStats } from './.claude/tools/artifact-cache.mjs';

const stats = getCacheStats();
console.log(stats);
```

### Example Output

```json
{
  "file_cache": {
    "total": 12,
    "valid": 10,
    "expired": 2,
    "memory_bytes": 524288,
    "memory_mb": "0.50"
  },
  "workflow_cache": {
    "total": 5,
    "valid": 5,
    "expired": 0,
    "memory_bytes": 1048576,
    "memory_mb": "1.00"
  },
  "combined": {
    "total": 17,
    "valid": 15,
    "expired": 2,
    "memory_bytes": 1572864,
    "memory_mb": "1.50"
  }
}
```

## Cache Cleanup

### Manual Cleanup

```javascript
import { cleanExpiredEntries } from './.claude/tools/artifact-cache.mjs';

const removed = cleanExpiredEntries();
console.log(`Removed ${removed.total} expired entries`);
// Output: { file_cache: 2, workflow_cache: 1, total: 3 }
```

### Auto-Cleanup

```javascript
import { startAutoCleanup, stopAutoCleanup } from './.claude/tools/artifact-cache.mjs';

// Start auto-cleanup (runs every 5 minutes)
startAutoCleanup();

// Custom interval (10 minutes)
startAutoCleanup(10 * 60 * 1000);

// Stop auto-cleanup
stopAutoCleanup();
```

## CLI Usage

### Clear Cache

```bash
# Clear all caches
node .claude/tools/artifact-cache.mjs clear

# Clear file cache only
node .claude/tools/artifact-cache.mjs clear file

# Clear workflow cache only
node .claude/tools/artifact-cache.mjs clear workflow

# Clear specific workflow cache
node .claude/tools/artifact-cache.mjs clear greenfield-dev-001
```

### View Statistics

```bash
node .claude/tools/artifact-cache.mjs stats
```

Output:

```
Artifact Cache Statistics:

File Cache:
  Total Entries: 12
  Valid: 10
  Expired: 2
  Memory Usage: 0.50 MB

Workflow Cache:
  Total Entries: 5
  Valid: 5
  Expired: 0
  Memory Usage: 1.00 MB

Combined:
  Total Entries: 17
  Valid: 15
  Expired: 2
  Memory Usage: 1.50 MB
```

### Clean Expired Entries

```bash
node .claude/tools/artifact-cache.mjs clean
```

Output:

```
Cleaned expired entries:
  File Cache: 2
  Workflow Cache: 0
  Total: 2
```

## Integration Examples

### Workflow Executor Integration

```javascript
import { getWorkflowCache, setWorkflowCache } from './.claude/tools/artifact-cache.mjs';

async function executeWorkflowStep(workflowId, stepNumber, inputs) {
  // Check cache first
  const cached = await getWorkflowCache(workflowId, stepNumber, inputs);
  if (cached) {
    console.log(`[Cache Hit] Step ${stepNumber}: Using cached output`);
    return cached;
  }

  console.log(`[Cache Miss] Step ${stepNumber}: Executing agent`);

  // Execute step (expensive operation)
  const agent = getAgentForStep(stepNumber);
  const output = await agent.execute(inputs);

  // Cache the output
  await setWorkflowCache(workflowId, stepNumber, inputs, output);

  return output;
}
```

### Artifact Loader Integration

```javascript
import { loadArtifact } from './.claude/tools/artifact-cache.mjs';

async function loadPlanArtifact(planId) {
  const artifactPath = `.claude/context/artifacts/plan-${planId}.json`;

  try {
    // loadArtifact automatically uses cache if available
    const plan = await loadArtifact(artifactPath);
    console.log(`Loaded plan: ${plan.title}`);
    return plan;
  } catch (error) {
    console.error(`Failed to load plan: ${error.message}`);
    throw error;
  }
}
```

### Cache Warming

```javascript
import { cacheArtifact } from './.claude/tools/artifact-cache.mjs';

async function warmCache(artifacts) {
  console.log(`Warming cache with ${artifacts.length} artifacts...`);

  for (const artifact of artifacts) {
    const data = await loadFromDisk(artifact.path);
    await cacheArtifact(artifact.path, data, 3600000); // 1 hour TTL
  }

  console.log('Cache warming complete');
}
```

## Performance Considerations

### File Cache

- **Hit rate**: 70-90% for frequently accessed artifacts
- **Memory usage**: ~0.5-2MB per 100 entries
- **Speed**: 10-100x faster than disk I/O (depends on file size)

### Workflow Cache

- **Hit rate**: 40-60% for development workflows (higher during testing)
- **Memory usage**: ~1-5MB per 100 entries (depends on artifact size)
- **Speed**: Skips entire agent execution (minutes saved)

### Best Practices

1. **Use file cache for**: Configuration files, schemas, templates
2. **Use workflow cache for**: Expensive agent executions, API calls
3. **Monitor memory**: Keep combined cache under 100MB
4. **Enable auto-cleanup**: Prevents cache bloat during long sessions
5. **Clear cache**: After major workflow changes or input schema updates

## Limitations

1. **No distributed caching**: Cache is process-local
2. **No persistence for file cache**: File cache is memory-only
3. **Input sensitivity**: Minor input changes invalidate workflow cache
4. **Memory limits**: LRU eviction at 50MB per cache

## Troubleshooting

### Cache not working

```javascript
import { getCacheStats } from './.claude/tools/artifact-cache.mjs';

const stats = getCacheStats();
if (stats.combined.total === 0) {
  console.log('Cache is empty - check if caching is enabled');
}
```

### High memory usage

```javascript
import { getCacheStats, cleanExpiredEntries } from './.claude/tools/artifact-cache.mjs';

const stats = getCacheStats();
if (parseFloat(stats.combined.memory_mb) > 100) {
  console.log('High memory usage - cleaning expired entries');
  cleanExpiredEntries();
}
```

### Cache misses

```javascript
import { generateKey } from './.claude/tools/artifact-cache.mjs';

// Debug cache key generation
const key1 = generateKey('workflow-001', 2, { foo: 'bar' });
const key2 = generateKey('workflow-001', 2, { foo: 'bar' });

if (key1 === key2) {
  console.log('Keys match - cache should hit');
} else {
  console.log('Keys differ - inputs may have changed');
}
```

## See Also

- **Workflow Execution**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Artifact Management**: `.claude/tools/artifact-registry.mjs`
- **Performance Optimization**: `.claude/docs/CONTEXT_OPTIMIZATION.md`
