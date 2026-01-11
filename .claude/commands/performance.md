<command_description>
Command: /performance - Launch a performance optimization workflow.
</command_description>

<instructions>
<execution_steps>

```
/performance                     # Start performance workflow
/performance --target api/       # Focus on specific area
```

## What This Command Does

Invokes the **performance-flow** workflow with this agent sequence:

1. **Performance Engineer** - Analysis and profiling
   - Bottleneck identification
   - Resource utilization assessment
   - Latency hotspots
   - Memory and CPU analysis
   - Database query performance

2. **Architect** - Optimization strategy
   - Caching strategy design
   - Load balancing recommendations
   - Async processing patterns
   - Database optimization
   - CDN and edge computing

3. **Developer** - Implementation
   - Performance-critical code changes
   - Caching implementation
   - Query optimization
   - Resource pooling

4. **QA** - Performance validation
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

## Outputs

- `performance-analysis.json` - Profiling results
- `bottleneck-report.json` - Identified issues
- `optimization-architecture.json` - Improvement plan
- `benchmark-results.json` - Before/after metrics

</execution_steps>

<output_format>
**Outputs**:

- `performance-analysis.json` - Profiling results
- `bottleneck-report.json` - Identified issues
- `optimization-architecture.json` - Improvement plan
- `benchmark-results.json` - Before/after metrics
  </output_format>
  </instructions>
