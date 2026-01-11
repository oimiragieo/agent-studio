# Performance Optimization Guidelines

## Overview

This document provides guidelines for optimizing performance across all aspects of the Omega AI Platform, including agent execution, code generation, and runtime performance of generated applications.

## Agent Execution Performance

### Context Management

- **Minimize Context Size**: Only load relevant files and documentation
- **Incremental Loading**: Load context progressively as needed
- **Cache Frequently Used Context**: Store commonly accessed information
- **Prune Stale Context**: Remove outdated or irrelevant information

### Prompt Optimization

- **Concise Instructions**: Clear, focused prompts reduce processing time
- **Structured Output**: Request specific formats to reduce parsing overhead
- **Batch Operations**: Combine related requests when possible
- **Avoid Redundancy**: Don't repeat information across prompts

### Parallel Processing

- **Independent Tasks**: Execute non-dependent tasks concurrently
- **Pipeline Architecture**: Stream results between stages
- **Async Operations**: Use non-blocking I/O for file and network operations

## Code Generation Performance

### Template Efficiency

- **Precompiled Templates**: Parse templates once, reuse compiled versions
- **Minimal Variable Substitution**: Reduce template complexity
- **Cached Outputs**: Store generated code for identical inputs

### File Operations

- **Batch Writes**: Combine multiple file operations
- **Streaming**: Use streams for large file generation
- **Incremental Updates**: Only modify changed sections

## Runtime Application Performance

### Frontend Optimization

#### React/Next.js

```typescript
// Good: Memoized component
const UserCard = memo(({ user }: { user: User }) => {
  return <div>{user.name}</div>
})

// Good: Lazy loading
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Good: Debounced input
const [query, setQuery] = useState('')
const debouncedQuery = useDebounce(query, 300)
```

#### Bundle Optimization

- Code splitting by route
- Tree shaking for unused exports
- Dynamic imports for large dependencies
- Image optimization (WebP, lazy loading)

#### Rendering Performance

- Virtual lists for large datasets
- Skeleton screens for perceived performance
- Optimistic updates for user actions
- Service workers for caching

### Backend Optimization

#### Database

```javascript
// Good: Indexed queries
const users = await db.users.findMany({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// Good: Selective fields
const users = await db.users.findMany({
  select: { id: true, name: true, email: true },
});

// Good: Batch operations
await db.users.updateMany({
  where: { lastActive: { lt: thirtyDaysAgo } },
  data: { status: 'inactive' },
});
```

#### Caching Strategy

```javascript
// Cache-aside pattern
async function getUser(id) {
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  const user = await db.users.findUnique({ where: { id } });
  await cache.set(`user:${id}`, user, { ttl: 3600 });
  return user;
}
```

#### API Optimization

- Connection pooling for databases
- Request batching and debouncing
- Pagination for large result sets
- Compression for responses

### Memory Management

#### Node.js Best Practices

```javascript
// Avoid: Memory leak with closures
function processLargeData(data) {
  return data.map(item => {
    // Large closure captures entire scope
    return () => expensiveOperation(item);
  });
}

// Better: Minimize closure scope
function processLargeData(data) {
  return data.map(item => {
    const needed = extractNeeded(item);
    return () => expensiveOperation(needed);
  });
}
```

#### Stream Processing

```javascript
// Good: Stream large files
const stream = fs.createReadStream('large-file.json');
const parser = new JSONStream();

stream.pipe(parser).on('data', chunk => {
  processChunk(chunk);
});
```

## Performance Monitoring

### Metrics to Track

- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Memory usage
- CPU utilization
- Database query time

### Alerting Thresholds

```yaml
alerts:
  response_time:
    warning: 500ms
    critical: 1000ms
  error_rate:
    warning: 1%
    critical: 5%
  memory_usage:
    warning: 80%
    critical: 90%
```

### Profiling Tools

- Node.js: `clinic`, `0x`, `node --inspect`
- React: React DevTools Profiler
- Database: Query analyzers, slow query logs
- Network: Lighthouse, WebPageTest

## Performance Testing

### Load Testing

```javascript
// k6 example
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://api.example.com/users');
  check(res, { 'status is 200': r => r.status === 200 });
  sleep(1);
}
```

### Benchmarking

- Establish baseline metrics
- Test after each significant change
- Compare against requirements
- Document performance regression causes

## Optimization Checklist

### Pre-Release

- [ ] Bundle size analysis completed
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] Load testing passed
- [ ] Memory leaks checked
- [ ] Performance budget met

### Production Monitoring

- [ ] APM tools configured
- [ ] Alerting rules set
- [ ] Dashboards created
- [ ] On-call procedures documented

## Anti-Patterns to Avoid

### Frontend

- Unnecessary re-renders
- Synchronous operations in render
- Large bundle sizes
- Unoptimized images

### Backend

- N+1 query problems
- Missing database indexes
- Synchronous file operations
- Unbounded result sets

### General

- Premature optimization
- Optimization without measurement
- Ignoring caching opportunities
- Over-engineering solutions
