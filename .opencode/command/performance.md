# /performance

Launch a performance optimization workflow.

## Usage

```
/performance                     # Start performance workflow
/performance "api is slow"       # With context
```

## Workflow

This command coordinates multiple agents for performance optimization:

### 1. Performance Engineer

- Bottleneck identification
- Resource utilization assessment
- Latency hotspots
- Memory and CPU analysis
- Database query performance

### 2. Architect

- Caching strategy design
- Load balancing recommendations
- Async processing patterns
- Database optimization
- CDN and edge computing

### 3. Developer

- Performance-critical code changes
- Caching implementation
- Query optimization
- Resource pooling

### 4. QA

- Benchmark comparison (before/after)
- Load testing
- Stress testing
- SLA compliance check

## When to Use

- Application feels slow
- Preparing for scale
- Before major launches
- Cost optimization
- SLA compliance issues

## Focus Areas

- **frontend** - Bundle size, rendering, loading
- **backend** - API latency, throughput
- **database** - Query optimization, indexing
- **infrastructure** - Resource utilization, scaling

## Expected Outputs

- Profiling results
- Bottleneck report
- Optimization recommendations
- Before/after benchmark metrics

## See Also

- `/code-quality` - General code improvement
- `/review` - Quick review including performance
