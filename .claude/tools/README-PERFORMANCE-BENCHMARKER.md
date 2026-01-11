# Performance Benchmarker - Quick Reference

## Overview

Track and analyze CUJ execution performance with step-level metrics, memory usage, and aggregated statistics.

## Quick Start

### Programmatic API

```javascript
import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';

const benchmarker = new PerformanceBenchmarker();

// Start → Record Steps → End
const benchmark = await benchmarker.startBenchmark('CUJ-001');
benchmarker.recordStep(benchmark, 1, { action: 'parse_workflow' });
benchmarker.recordStep(benchmark, 2, { action: 'validate_schema' });
const report = await benchmarker.endBenchmark(benchmark);
```

### CLI

```bash
# View statistics
node .claude/tools/performance-benchmarker.mjs stats

# Help
node .claude/tools/performance-benchmarker.mjs help
```

## Core Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `startBenchmark(cujId)` | Begin tracking | `await benchmarker.startBenchmark('CUJ-001')` |
| `recordStep(benchmark, step, data)` | Record step | `benchmarker.recordStep(benchmark, 1, {...})` |
| `endBenchmark(benchmark)` | Finish & save | `await benchmarker.endBenchmark(benchmark)` |
| `getStatistics()` | Get all stats | `await benchmarker.getStatistics()` |

## Performance Report

```javascript
{
  cuj_id: "CUJ-001",
  total_time: "5.42s",
  steps_count: 3,
  avg_step_time: "1.81s",
  memory_used: "2.34 MB",
  slowest_step: { step: 2, duration: "3.21s" }
}
```

## Aggregated Statistics

```javascript
{
  total_cujs: 25,
  avg_execution_time: "4.32s",
  min_execution_time: "1.23s",
  max_execution_time: "12.45s",
  median_execution_time: "3.98s",
  p95_execution_time: "9.87s",
  most_common_slowest_step: { step: 2, count: 15, percentage: "60.0%" }
}
```

## Common Patterns

### Basic Workflow Tracking

```javascript
const benchmark = await benchmarker.startBenchmark('CUJ-001');

for (let i = 0; i < steps.length; i++) {
  await executeStep(steps[i]);
  benchmarker.recordStep(benchmark, i + 1, {
    action: steps[i].action,
    agent: steps[i].agent
  });
}

const report = await benchmarker.endBenchmark(benchmark);
```

### Error Handling

```javascript
const benchmark = await benchmarker.startBenchmark('CUJ-001');

try {
  // Execute workflow
} catch (error) {
  // Still save partial metrics
  await benchmarker.endBenchmark(benchmark);
  throw error;
}
```

### Enhanced Metadata

```javascript
benchmarker.recordStep(benchmark, 1, {
  action: 'validate_schema',
  agent: 'qa',
  schema: 'workflow.schema.json',
  validation_errors: 0,
  tests_run: 15
});
```

## Files

- **Tool**: `.claude/tools/performance-benchmarker.mjs`
- **Metrics**: `.claude/context/performance/cuj-metrics.json`
- **Docs**: `.claude/docs/PERFORMANCE_BENCHMARKING.md`
- **Example**: `.claude/tools/examples/performance-benchmarker-example.mjs`

## Examples

```bash
# Run example
node .claude/tools/examples/performance-benchmarker-example.mjs

# View current stats
node .claude/tools/performance-benchmarker.mjs stats
```

## Best Practices

1. ✅ Always end benchmarks (even on error)
2. ✅ Include metadata for better analysis
3. ✅ Use unique CUJ IDs
4. ✅ Review stats regularly
5. ✅ Clean old metrics periodically

## Documentation

Full documentation: `.claude/docs/PERFORMANCE_BENCHMARKING.md`
