# Performance Benchmarking System

## Overview

The Performance Benchmarking System (`performance-benchmarker.mjs`) provides comprehensive tracking and analysis of CUJ (Customer User Journey) execution performance. It monitors execution time, memory usage, and identifies performance bottlenecks across workflow steps.

## Features

- **Benchmark Lifecycle Management**: Start, record steps, and end benchmarks with automatic metric collection
- **Step-Level Metrics**: Track timing and memory usage for each workflow step
- **Performance Reports**: Generate formatted reports with key metrics
- **Aggregated Statistics**: Analyze performance across multiple CUJ executions
- **Percentile Analysis**: Track median and P95 execution times
- **Slowest Step Detection**: Identify bottlenecks in workflow execution
- **CLI and Programmatic APIs**: Use from command line or integrate into code

## Installation

The performance benchmarker is included in the LLM-RULES toolkit. No additional installation required.

```bash
# Verify installation
node .claude/tools/performance-benchmarker.mjs help
```

## Usage

### Programmatic API

```javascript
import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';

const benchmarker = new PerformanceBenchmarker();

// Start benchmarking a CUJ
const benchmark = await benchmarker.startBenchmark('CUJ-001');

// Record step completion with metadata
benchmarker.recordStep(benchmark, 1, {
  action: 'parse_workflow',
  agent: 'planner',
  workflow: 'greenfield-workflow',
});

benchmarker.recordStep(benchmark, 2, {
  action: 'validate_schema',
  agent: 'qa',
});

benchmarker.recordStep(benchmark, 3, {
  action: 'execute_agent',
  agent: 'developer',
});

// End benchmark and get report
const report = await benchmarker.endBenchmark(benchmark);
console.log(report);
```

### CLI Interface

```bash
# Show aggregated statistics
node .claude/tools/performance-benchmarker.mjs stats

# Show help
node .claude/tools/performance-benchmarker.mjs help
```

## API Reference

### `PerformanceBenchmarker`

Main class for performance tracking.

#### Constructor

```javascript
const benchmarker = new PerformanceBenchmarker();
```

Creates a new benchmarker instance. Metrics are stored in `.claude/context/performance/cuj-metrics.json`.

#### Methods

##### `startBenchmark(cujId)`

Start benchmarking a CUJ execution.

**Parameters**:

- `cujId` (string): CUJ identifier (e.g., 'CUJ-001')

**Returns**: `Benchmark` object for tracking

**Example**:

```javascript
const benchmark = await benchmarker.startBenchmark('CUJ-001');
```

##### `recordStep(benchmark, stepNumber, stepData)`

Record completion of a workflow step.

**Parameters**:

- `benchmark` (Benchmark): Active benchmark object
- `stepNumber` (number): Step number/sequence
- `stepData` (Object): Additional step metadata (optional)

**Example**:

```javascript
benchmarker.recordStep(benchmark, 1, {
  action: 'parse_workflow',
  agent: 'planner',
});
```

##### `endBenchmark(benchmark)`

End benchmarking and save metrics.

**Parameters**:

- `benchmark` (Benchmark): Completed benchmark object

**Returns**: `Promise<PerformanceReport>` - Formatted performance report

**Example**:

```javascript
const report = await benchmarker.endBenchmark(benchmark);
```

##### `generateReport(benchmark)`

Generate performance report from benchmark data.

**Parameters**:

- `benchmark` (Benchmark): Completed benchmark

**Returns**: `PerformanceReport` object

**Report Structure**:

```javascript
{
  cuj_id: "CUJ-001",
  total_time: "5.42s",
  steps_count: 3,
  avg_step_time: "1.81s",
  memory_used: "2.34 MB",
  slowest_step: {
    step: 2,
    duration: "3.21s",
    action: "validate_schema"
  }
}
```

##### `getStatistics()`

Get aggregated statistics across all benchmarked CUJs.

**Returns**: `Promise<Object>` - Aggregated statistics

**Statistics Structure**:

```javascript
{
  total_cujs: 25,
  avg_execution_time: "4.32s",
  min_execution_time: "1.23s",
  max_execution_time: "12.45s",
  avg_memory_usage: "3.45 MB",
  median_execution_time: "3.98s",
  p95_execution_time: "9.87s",
  most_common_slowest_step: {
    step: 2,
    count: 15,
    percentage: "60.0%"
  }
}
```

## Data Types

### Benchmark

```typescript
interface Benchmark {
  cuj_id: string;
  start_time: number; // Unix timestamp
  start_memory: NodeJS.MemoryUsage;
  steps: BenchmarkStep[];
  end_time?: number; // Unix timestamp
  total_duration_ms?: number;
  end_memory?: NodeJS.MemoryUsage;
}
```

### BenchmarkStep

```typescript
interface BenchmarkStep {
  step: number;
  timestamp: number; // Unix timestamp
  duration_ms: number; // Time from benchmark start
  memory: NodeJS.MemoryUsage;
  [key: string]: any; // Additional metadata
}
```

### PerformanceReport

```typescript
interface PerformanceReport {
  cuj_id: string;
  total_time: string; // Formatted (e.g., "5.42s")
  steps_count: number;
  avg_step_time: string; // Formatted
  memory_used: string; // Formatted (e.g., "2.34 MB")
  slowest_step: {
    step: number;
    duration: string; // Formatted
    action?: string;
  };
}
```

## File Locations

- **Tool**: `.claude/tools/performance-benchmarker.mjs`
- **Metrics Storage**: `.claude/context/performance/cuj-metrics.json`
- **Documentation**: `.claude/docs/PERFORMANCE_BENCHMARKING.md`

## Integration Examples

### CUJ Validator Integration

```javascript
import { CUJValidator } from './.claude/tools/cuj-validator.mjs';
import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';

const validator = new CUJValidator();
const benchmarker = new PerformanceBenchmarker();

// Start benchmark
const benchmark = await benchmarker.startBenchmark(cujId);

// Validate CUJ steps
for (let i = 0; i < steps.length; i++) {
  await validator.validateStep(steps[i]);

  benchmarker.recordStep(benchmark, i + 1, {
    action: steps[i].action,
    agent: steps[i].agent,
  });
}

// End and report
const report = await benchmarker.endBenchmark(benchmark);
```

### Workflow Execution Tracking

```javascript
import { executeWorkflow } from './.claude/tools/workflow-executor.mjs';
import { PerformanceBenchmarker } from './.claude/tools/performance-benchmarker.mjs';

async function runTrackedWorkflow(workflowId, cujId) {
  const benchmarker = new PerformanceBenchmarker();
  const benchmark = await benchmarker.startBenchmark(cujId);

  try {
    const result = await executeWorkflow(workflowId, {
      onStepComplete: (stepNum, stepData) => {
        benchmarker.recordStep(benchmark, stepNum, stepData);
      },
    });

    return await benchmarker.endBenchmark(benchmark);
  } catch (error) {
    // Still save metrics even on failure
    await benchmarker.endBenchmark(benchmark);
    throw error;
  }
}
```

## Performance Analysis

### Identifying Bottlenecks

```javascript
const stats = await benchmarker.getStatistics();

console.log(`Most common slowest step: ${stats.most_common_slowest_step.step}`);
console.log(`Occurs in ${stats.most_common_slowest_step.percentage} of executions`);
```

### Comparing CUJ Performance

```javascript
// Load metrics file
const metrics = JSON.parse(await readFile('.claude/context/performance/cuj-metrics.json', 'utf-8'));

// Filter by CUJ
const cuj001Metrics = metrics.filter(m => m.cuj_id === 'CUJ-001');
const cuj002Metrics = metrics.filter(m => m.cuj_id === 'CUJ-002');

// Compare average times
const avg001 =
  cuj001Metrics.reduce((sum, m) => sum + m.total_duration_ms, 0) / cuj001Metrics.length;
const avg002 =
  cuj002Metrics.reduce((sum, m) => sum + m.total_duration_ms, 0) / cuj002Metrics.length;

console.log(`CUJ-001 avg: ${(avg001 / 1000).toFixed(2)}s`);
console.log(`CUJ-002 avg: ${(avg002 / 1000).toFixed(2)}s`);
```

## Metrics File Format

The metrics file (`.claude/context/performance/cuj-metrics.json`) stores an array of benchmark objects:

```json
[
  {
    "cuj_id": "CUJ-001",
    "start_time": 1768153709710,
    "start_memory": {
      "rss": 46313472,
      "heapTotal": 5832704,
      "heapUsed": 5012552,
      "external": 1847626,
      "arrayBuffers": 27453
    },
    "steps": [
      {
        "step": 1,
        "timestamp": 1768153709818,
        "duration_ms": 108,
        "memory": { "..." },
        "action": "parse_workflow",
        "agent": "planner"
      }
    ],
    "end_time": 1768153710177,
    "total_duration_ms": 467,
    "end_memory": { "..." },
    "saved_at": "2025-01-11T12:48:30.177Z"
  }
]
```

## Best Practices

1. **Always End Benchmarks**: Even if workflow execution fails, call `endBenchmark()` to save partial metrics

2. **Include Metadata**: Add relevant metadata to steps for better analysis:

   ```javascript
   benchmarker.recordStep(benchmark, 1, {
     action: 'validate_schema',
     agent: 'qa',
     schema: 'workflow.schema.json',
     validation_errors: 0,
   });
   ```

3. **Regular Analysis**: Review aggregated statistics regularly to identify performance trends:

   ```bash
   node .claude/tools/performance-benchmarker.mjs stats
   ```

4. **Clean Old Metrics**: Periodically archive or clean old metrics to keep file size manageable

5. **Use Unique CUJ IDs**: Ensure CUJ IDs are unique and descriptive (e.g., 'CUJ-001-greenfield-workflow')

## Troubleshooting

### Metrics File Not Found

If `getStatistics()` returns zero counts, the metrics file may not exist yet. Run at least one benchmark to create it.

### Memory Usage Always Zero

Ensure you're calling `endBenchmark()` to finalize memory calculations.

### Slowest Step Detection Incorrect

The slowest step is calculated based on duration between consecutive steps. Ensure steps are recorded in chronological order.

## CLI Examples

```bash
# View aggregated statistics
node .claude/tools/performance-benchmarker.mjs stats

# Output:
# {
#   "total_cujs": 25,
#   "avg_execution_time": "4.32s",
#   "median_execution_time": "3.98s",
#   "p95_execution_time": "9.87s",
#   ...
# }

# Show help
node .claude/tools/performance-benchmarker.mjs help
```

## Related Documentation

- [CUJ Validation System](../tools/README-CUJ-VALIDATION.md)
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md)
- [Context Optimization](./CONTEXT_OPTIMIZATION.md)

## Version History

| Version | Date       | Changes                            |
| ------- | ---------- | ---------------------------------- |
| 1.0.0   | 2025-01-11 | Initial release with core features |
