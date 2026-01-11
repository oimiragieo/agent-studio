# Monitoring & Observability Integration Guide

## Overview

Phase 5 of Cursor 47 recommendations implements comprehensive monitoring and observability for Codex skills and workflows. This guide documents the monitoring infrastructure and integration points.

## Monitoring Tools (5 Total)

### 1. Structured Logger (`structured-logger.mjs`)

**Purpose**: JSONL-based logging for all skill executions

**Features**:

- Track skill name, params, result, duration, cache hits, agent context
- Query logs by skill, agent, run ID, CUJ ID, result type
- Aggregated statistics (by skill, by agent, by CUJ)
- Sanitize sensitive data (passwords, tokens, secrets)

**CLI Usage**:

```bash
# Query logs
node .claude/tools/structured-logger.mjs query --skill multi-ai-code-review --limit 10

# Get statistics
node .claude/tools/structured-logger.mjs stats --agent developer
node .claude/tools/structured-logger.mjs stats --cujId CUJ-005
```

**API Usage**:

```javascript
import { logSkillInvocation } from './structured-logger.mjs';

logSkillInvocation({
  skill: 'multi-ai-code-review',
  params: { code: 'function foo() {}' },
  result: 'success',
  duration: 1234,
  cacheHit: false,
  agent: 'developer',
  runId: 'run-001',
  cujId: 'CUJ-005',
});
```

### 2. Metrics Tracker (`metrics-tracker.mjs`)

**Purpose**: Track CUJ execution success/failure rates with historical trending

**Features**:

- Calculate success rates over time windows (1h, 24h, 7d, 30d)
- Generate trending data with time buckets
- Failure analysis with top error patterns
- Performance percentiles (p50, p75, p90, p95, p99)

**CLI Usage**:

```bash
# Get success rate
node .claude/tools/metrics-tracker.mjs rate CUJ-005

# Get all metrics
node .claude/tools/metrics-tracker.mjs all 86400000

# Get trending data (24 buckets, 1 hour each)
node .claude/tools/metrics-tracker.mjs trending CUJ-005 24 3600000

# Analyze failures
node .claude/tools/metrics-tracker.mjs failures CUJ-005

# Get performance percentiles
node .claude/tools/metrics-tracker.mjs percentiles CUJ-005
```

**API Usage**:

```javascript
import { recordCujExecution, getCujSuccessRate } from './metrics-tracker.mjs';

recordCujExecution('CUJ-005', true, 1234, null);
const rate = getCujSuccessRate('CUJ-005', 86400000); // Last 24 hours
```

### 3. Progress Emitter (`progress-emitter.mjs`)

**Purpose**: Real-time progress updates using Node.js EventEmitter

**Features**:

- Track workflow execution progress with step-level granularity
- Percentage-based progress tracking (0-100%)
- Persist progress to JSONL for historical queries
- ProgressTracker class for simplified tracking

**CLI Usage**:

```bash
# Watch progress (all runs)
node .claude/tools/progress-emitter.mjs watch

# Watch specific run
node .claude/tools/progress-emitter.mjs watch run-001

# Get progress history
node .claude/tools/progress-emitter.mjs history run-001 50

# Get current progress
node .claude/tools/progress-emitter.mjs current run-001
```

**API Usage**:

```javascript
import { emitProgress, createProgressTracker } from './progress-emitter.mjs';

// Manual progress
emitProgress({
  runId: 'run-001',
  step: 1,
  status: 'running',
  percentage: 25,
  message: 'Analyzing code',
});

// Using ProgressTracker
const tracker = createProgressTracker('run-001', 5);
tracker.start();
tracker.updateStep('Processing step 1');
tracker.completeStep('Step 1 complete');
tracker.complete();
```

### 4. Metrics Dashboard (`metrics-dashboard.mjs`)

**Purpose**: Unified dashboard aggregating all monitoring data

**Features**:

- Aggregate CUJ metrics across time windows
- Aggregate skill metrics from structured logger
- Performance highlights (fastest/slowest/most reliable CUJs)
- Top 10 most used skills with cache hit rates
- System resource usage (heap, RSS, CPU)

**CLI Usage**:

```bash
# Generate and save dashboard
node .claude/tools/metrics-dashboard.mjs generate

# View existing dashboard
node .claude/tools/metrics-dashboard.mjs view

# Output as JSON
node .claude/tools/metrics-dashboard.mjs json
```

**API Usage**:

```javascript
import { generateMetricsDashboard, saveDashboard } from './metrics-dashboard.mjs';

const dashboard = generateMetricsDashboard();
saveDashboard(dashboard);
```

### 5. Provider Health Monitor (`provider-health.mjs`)

**Purpose**: Track availability and performance of AI model providers

**Features**:

- Track provider availability (Anthropic, OpenAI, Google)
- Record success/failure rates per provider
- Calculate latency percentiles (p50, p95, p99)
- Maintain recent error history (last 10 errors)
- Overall system health status

**CLI Usage**:

```bash
# Get provider status
node .claude/tools/provider-health.mjs status anthropic

# Get all providers
node .claude/tools/provider-health.mjs status

# Get overall health
node .claude/tools/provider-health.mjs overall

# Compare providers
node .claude/tools/provider-health.mjs compare

# Record a call
node .claude/tools/provider-health.mjs record anthropic true 1234
```

**API Usage**:

```javascript
import { recordProviderCall, getProviderHealth } from './provider-health.mjs';

recordProviderCall('anthropic', true, 1234);
const health = getProviderHealth('anthropic');
```

## Integration with run-cuj.mjs

### Resource Tracking Function

Add this function to track CPU and memory usage:

```javascript
function trackResourceUsage(stepName) {
  const startMemory = process.memoryUsage();
  const startTime = process.hrtime.bigint();
  const startCpu = process.cpuUsage();

  return {
    end: () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);

      return {
        step: stepName,
        duration_ns: Number(endTime - startTime),
        duration_ms: Number(endTime - startTime) / 1000000,
        memory_delta_mb: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        heap_used_mb: endMemory.heapUsed / 1024 / 1024,
        cpu_user_ms: endCpu.user / 1000,
        cpu_system_ms: endCpu.system / 1000,
      };
    },
  };
}
```

### Enhanced executeSkillWithCache()

Add monitoring to skill execution:

```javascript
async function executeSkillWithCache(skillName, params, options = {}) {
  const {
    cache = cacheEnabled,
    ttlMs = SKILL_CACHE_TTL_MS,
    executor,
    agent,
    runId,
    cujId,
  } = options;

  // Track resources
  const resourceTracker = trackResourceUsage(skillName);

  // Check cache
  if (cache) {
    const cached = getCachedResult(skillName, params, ttlMs);
    if (cached) {
      const resources = resourceTracker.end();

      // Log cache hit
      logSkillInvocation({
        skill: skillName,
        params,
        result: 'success',
        duration: resources.duration_ms,
        cacheHit: true,
        agent,
        runId,
        cujId,
      });

      return { ...cached, _from_cache: true };
    }
  }

  // Execute skill
  let result,
    error = null;
  try {
    result = await executor(skillName, params);
  } catch (err) {
    error = err;
    result = { error: err.message };
  }

  const resources = resourceTracker.end();

  // Log invocation
  logSkillInvocation({
    skill: skillName,
    params,
    result: error ? 'failure' : 'success',
    duration: resources.duration_ms,
    cacheHit: false,
    agent,
    runId,
    cujId,
    error: error ? error.message : null,
    metadata: {
      memory_delta_mb: resources.memory_delta_mb,
      cpu_user_ms: resources.cpu_user_ms,
    },
  });

  // Cache result
  if (cache && !error) {
    setCachedResult(skillName, params, { ...result, _cached_duration_ms: resources.duration_ms });
  }

  if (error) throw error;
  return { ...result, _from_cache: false, _resources: resources };
}
```

### Enhanced runCUJ()

Add progress tracking and metrics:

```javascript
async function runCUJ(cujId) {
  const runId = `${cujId}-${Date.now()}`;

  // Pre-flight with progress
  emitProgress({
    runId,
    step: 0,
    status: 'running',
    percentage: 5,
    message: 'Running pre-flight checks',
  });
  const preflightResult = await preflightCheck(cuj);
  emitProgress({
    runId,
    step: 0,
    status: 'completed',
    percentage: 10,
    message: 'Pre-flight checks passed',
  });

  // Start workflow
  emitProgress({
    runId,
    step: 1,
    status: 'running',
    percentage: 15,
    message: `Starting workflow: ${cuj.workflow}`,
  });

  // Track resources
  const resourceTracker = trackResourceUsage(`CUJ-${cujId}`);
  const startTime = Date.now();

  // Spawn workflow...

  child.on('exit', code => {
    const duration = Date.now() - startTime;
    const resources = resourceTracker.end();

    // Record metrics
    recordCujExecution(cujId, code === 0, duration, code !== 0 ? new Error('CUJ failed') : null, {
      agents,
      warnings,
      resources,
    });

    // Emit final progress
    emitProgress({
      runId,
      step: 999,
      status: code === 0 ? 'completed' : 'failed',
      percentage: 100,
      message: code === 0 ? 'CUJ completed' : 'CUJ failed',
    });

    // Log resources
    console.log(`Memory Delta: ${resources.memory_delta_mb.toFixed(2)} MB`);
    console.log(`CPU User Time: ${resources.cpu_user_ms.toFixed(0)}ms`);
  });
}
```

## Data Storage

All monitoring data is stored in `.claude/context/analytics/` and `.claude/context/logs/`:

- `skill-invocations-YYYY-MM-DD.jsonl` - Structured skill logs (daily rotation)
- `cuj-metrics.jsonl` - CUJ execution metrics
- `provider-health.jsonl` - Provider health data
- `progress.jsonl` - Progress events
- `metrics-dashboard.json` - Latest dashboard snapshot
- `cuj-performance.json` - Legacy performance data

## Benefits

1. **Complete Observability**: Track every skill invocation, CUJ execution, and provider call
2. **Performance Analysis**: Identify slow skills, flaky CUJs, and provider issues
3. **Historical Trending**: Track success rates and performance over time
4. **Resource Monitoring**: Detect memory leaks and CPU bottlenecks
5. **Real-time Updates**: Watch workflow progress in real-time
6. **Unified Dashboard**: Single view of all monitoring data

## Next Steps

1. Integrate resource tracking into `run-cuj.mjs`
2. Add monitoring calls to workflow_runner.js
3. Create automated alerting based on metrics
4. Set up scheduled dashboard generation
5. Integrate with external monitoring tools (optional)

## Version History

| Version | Date       | Changes                           |
| ------- | ---------- | --------------------------------- |
| 1.0.0   | 2026-01-09 | Initial monitoring infrastructure |
