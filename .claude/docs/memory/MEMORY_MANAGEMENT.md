# Memory Management Guide

## Overview

This guide explains memory management features and best practices for preventing memory exhaustion crashes during long-running CUJ executions.

**⚠️ CRITICAL UPDATE (2026-01-09)**: Memory management system rebuilt to track **RSS (Resident Set Size)** instead of JavaScript heap only. This fixes a critical bug where monitoring reported 0.2% usage while actual memory was at 100% (4GB), causing crashes.

**Priority Levels**:

- **Priority 0 (P0)**: Critical Crash Prevention - RSS monitoring, pre-spawn/pre-load checks
- **Priority 1 (P1)**: Safety & Robustness - Safe file loader, aggressive cleanup at 85% RSS
- **Priority 2 (P2)**: Testing & Monitoring - Stress test updates, emergency fallback

All three priority levels are implemented and tested.

## What Changed (2026-01-09)

### Critical Fixes

1. **RSS-Based Monitoring** - Changed from JS heap (~10MB) to RSS (actual memory ~4GB)
   - `memory-monitor.mjs`: Now tracks `rssMB` as primary metric
   - `memory-pressure-handler.mjs`: Uses RSS for pressure calculation
   - Thresholds lowered: 75% high (was 80%), 85% critical (was 90%)

2. **Pre-Spawn Validation** - Memory checks BEFORE spawning subagents
   - `run-cuj.mjs`: Validates 800MB free before spawn
   - Includes aggressive cleanup and retry logic

3. **Pre-Load Guards** - Memory checks BEFORE loading large files
   - `workflow_runner.js`: Validates 1GB free before artifact loading
   - Prevents crashes from large artifact registries

4. **Safe File Loader** - Memory-aware file loading with streaming
   - NEW: `safe-file-loader.mjs` - Validates memory before loading
   - Automatic streaming for files > 10MB
   - Integrated into `agent-executor.mjs`

5. **Aggressive Cleanup at 85%** - Automatic cleanup on critical pressure
   - `memory-pressure-handler.mjs`: Triggers at 85% RSS
   - Double GC + cache cleanup
   - Continues execution (no checkpoint/exit)

6. **Updated Stress Tests** - Now track RSS metrics
   - `test-phase7-stress.mjs`: Reports `rssPeak` alongside `heapPeak`
   - Pass/fail based on RSS < 3500MB (85% threshold)

## Configuration

Memory management settings are configured in `.claude/config.yaml` under the `memory` section:

```yaml
memory:
  max_heap_size_mb: 4096
  cache_limits:
    git_cache_max_entries: 100
    artifact_cache_max_entries: 500
    skill_cache_max_entries: 200
    artifact_cache_max_memory_mb: 50
  cleanup:
    enabled: true
    interval_seconds: 600 # 10 minutes
    cleanup_after_step: true
  monitoring:
    enabled: true
    warn_threshold_mb: 3500
    check_interval_seconds: 60
  file_handling:
    streaming_threshold_mb: 1
    max_artifact_size_mb: 10
    max_json_file_size_mb: 100
  gc:
    expose_gc: true # Requires --expose-gc flag
    gc_on_warning: true
```

## Features

### 1. Heap Size Configuration

All Node.js scripts in `package.json` are configured with `--max-old-space-size=4096` to increase the heap limit to 4GB.

**Usage**: Scripts automatically use the increased heap size when run via `pnpm` commands.

### 2. Memory Monitoring (Updated 2026-01-09)

Memory monitoring runs automatically during CUJ execution and provides warnings when approaching limits.

**Location**: `.claude/tools/memory-monitor.mjs`

**Features**:

- **PRIMARY METRIC: RSS (Resident Set Size)** - Actual process memory usage
- Tracks heap usage (secondary), RSS (primary), and external memory
- Warns when **RSS usage** exceeds threshold (default: 3.5GB = 85% of 4GB)
- Automatically triggers garbage collection if available
- Logs memory usage at start and end of execution

**Key Functions**:

- `canSpawnSubagent(minFreeMB)` - **Now uses RSS** to determine if spawn is safe
- `getMemoryUsage()` - Returns heap, RSS, and external metrics
- `getEffectiveMemoryPercent()` - Returns RSS usage as percentage (0-100)

**Breaking Change**: `canSpawnSubagent()` return object now includes:

- `currentUsageMB` = `rssMB` (changed from `heapUsedMB`)
- `freeMB` = `freeRSSMB` (changed from heap-based calculation)
- `maxRSSMB` = 4096 (new field)
- Old fields (`heapUsedMB`, `maxHeapMB`) kept for backward compatibility

**Usage**: Integrated into `run-cuj.mjs` - no manual configuration needed.

### 3. Cache Management

All caches have size limits and automatic eviction:

#### Git Cache

- **Max Entries**: 100
- **Eviction**: LRU (Least Recently Used)
- **Location**: `.claude/tools/git-cache.mjs`

#### Artifact Cache

- **Max Entries**: 500
- **Max Memory**: 50MB
- **Eviction**: LRU with memory-based pruning
- **Location**: `.claude/tools/artifact-cache.mjs`

#### Skill Cache

- **Max Entries**: 200
- **Eviction**: LRU (file-based)
- **Location**: `.claude/tools/skill-cache.mjs`

### 4. File Handling (Updated 2026-01-09)

Large files are automatically handled with memory validation and streaming.

**Safe File Loader** (NEW): `.claude/tools/safe-file-loader.mjs`

**Features**:

- **Pre-load memory validation** - Checks available memory BEFORE loading
- **Automatic streaming** - Files > 10MB use streaming parser
- **Memory estimation** - JSON: 3x file size, Text: 1.5x file size
- **Aggressive cleanup** - Clears caches if memory insufficient
- **Fallback to streaming** - Uses streaming if cleanup doesn't free enough memory
- **Size limits** - Default max: 50MB per file

**Key Functions**:

- `loadJSONSafely(filePath, options)` - Memory-safe JSON loading
- `loadTextSafely(filePath, options)` - Memory-safe text loading

**Usage**:

```javascript
import { loadJSONSafely, loadTextSafely } from './safe-file-loader.mjs';

// Load JSON with memory validation
const data = await loadJSONSafely('./large-file.json', {
  maxSizeMB: 50,
  forceStreaming: false,
  onProgress: progress => console.log(progress),
});

// Load text with memory validation
const content = await loadTextSafely('./agent.md', { maxSizeMB: 10 });
```

**Integrated into**:

- `agent-executor.mjs` - Agent personas and constraint files
- Future: All large file operations

**Streaming Parser**: `.claude/tools/streaming-json-parser.mjs`

**Features**:

- Streams files in 64KB chunks
- Enforces size limits (default: 100MB max)
- Used automatically by safe file loader for large files

**Legacy Usage** (still supported):

- `artifact-cache.mjs` - Artifact loading
- `workflow_runner.js` - Gate and plan file loading
- `run-cuj.mjs` - Registry and analytics loading

### 5. Periodic Cleanup

Automatic cache cleanup runs every 10 minutes during CUJ execution.

**Location**: `.claude/tools/memory-cleanup.mjs`

**Features**:

- Clears all caches (git, artifact, skill)
- Triggers garbage collection if available
- Logs cleanup results

**Usage**: Integrated into `run-cuj.mjs` - runs automatically.

### 6. Checkpoint System

Workflow state can be saved and resumed to break up long-running processes.

**Location**: `.claude/tools/workflow-checkpoint.mjs`

**Features**:

- Save workflow state at any step
- Load and resume from checkpoint
- Includes memory usage snapshot

**Usage**: Can be integrated into workflows for resumable execution.

### 7. Memory Pressure Handling (Updated 2026-01-09)

Automatic detection and response to memory pressure conditions.

**Location**: `.claude/tools/memory-pressure-handler.mjs`

**Features**:

- **Monitors RSS** (actual memory) instead of heap only
- **Lowered thresholds**: 75% high (was 80%), 85% critical (was 90%)
- 10-second polling interval
- **Automatic aggressive cleanup** at critical level
- Callback-based architecture for flexible responses
- Returns cleanup function to stop monitoring

**Thresholds**:

- **Normal**: < 75% RSS usage - no action needed
- **High** (75%): Warning logged, callback triggered
- **Critical** (85%): **Automatic aggressive cleanup** triggered (NEW):
  1. Clear all caches (git, artifact, skill)
  2. Force double GC (with delay between calls)
  3. Log memory freed
  4. **Continue execution** (no checkpoint/exit by default)
  5. If still > 90% after cleanup: Log emergency warnings but continue

**Emergency Fallback** (NEW):
If cleanup doesn't free enough memory (still > 90% RSS):

- Logs emergency guidance (reduce concurrent subagents, clear registry, restart)
- Continues anyway (user-configurable to checkpoint/exit instead)

**Usage**:

```javascript
import { setupMemoryPressureHandling } from './memory-pressure-handler.mjs';

const cleanup = setupMemoryPressureHandling((level, usage, stats) => {
  if (level === 'high') {
    console.warn('High memory pressure detected');
    // Callback for logging/monitoring
  } else if (level === 'critical') {
    console.error('Critical memory pressure - aggressive cleanup will run automatically');
    // Aggressive cleanup happens automatically now
    // No need to manually call cleanup or exit
  }
});

// Later: cleanup() to stop monitoring
```

**Breaking Change**: Critical pressure no longer exits by default. To restore old behavior (checkpoint + exit):

```javascript
const cleanup = setupMemoryPressureHandling((level, usage, stats) => {
  if (level === 'critical') {
    // Manual checkpoint/exit (if desired)
    await saveCheckpoint(runId, currentStep, 'memory_pressure');
    process.exit(42);
  }
});
```

**Integration**: Automatically enabled in `run-cuj.mjs` during workflow execution.

### 8. Graceful Degradation

Workflows automatically handle memory pressure by creating checkpoints and restarting.

**Process**:

1. Memory pressure reaches critical level (90%+ heap usage)
2. Current workflow state saved to checkpoint
3. Process exits with code 42 (restart signal)
4. Operator can restart workflow from checkpoint
5. Execution resumes from saved state

**Exit Code Convention**:

- **0**: Success
- **1**: Error/failure
- **42**: Memory pressure restart needed (checkpoint saved)

**Checkpoint Location**: `.claude/context/runtime/runs/<run_id>/checkpoints/`

**Resume Command**:

```bash
node .claude/tools/workflow_runner.js --resume --run-id <run_id>
```

### 9. Memory Metrics in Analytics (Updated 2026-01-09)

CUJ performance analytics now include detailed memory tracking with **RSS metrics**.

**Metrics Tracked**:

- `heapUsedStartMB` - Heap usage at CUJ start
- `heapUsedEndMB` - Heap usage at CUJ end
- `heapPeakMB` - Peak heap usage during execution
- **`rssStartMB`** - RSS at CUJ start (NEW)
- **`rssEndMB`** - RSS at CUJ end (NEW)
- **`rssPeakMB`** - Peak RSS during execution (NEW)
- `heapLimitMB` - Configured heap limit
- **`rssLimitMB`** - Configured RSS limit (NEW)
- `memoryCleanupCount` - Number of cleanup cycles triggered
- `memoryPressureEvents` - Number of pressure events (high/critical)

**Location**: `.claude/context/analytics/cuj-performance.json`

**Example Entry**:

```json
{
  "cuj_id": "CUJ-005",
  "duration_ms": 45000,
  "memory": {
    "heapUsedStartMB": 120.5,
    "heapUsedEndMB": 450.2,
    "heapPeakMB": 850.1,
    "rssStartMB": 280.3,
    "rssEndMB": 1250.7,
    "rssPeakMB": 2100.4,
    "heapLimitMB": 4096,
    "rssLimitMB": 4096,
    "heapPeakPercent": 20.8,
    "rssPeakPercent": 51.3,
    "memoryCleanupCount": 3,
    "memoryPressureEvents": { "high": 2, "critical": 1 }
  }
}
```

**Stress Test Results**: `.claude/context/reports/phase7-stress-test-results.json`

Now includes:

- `rss_start_mb`, `rss_peak_mb`, `rss_end_mb`
- `rss_peak_usage_percent` - Primary pass/fail metric
- Pass threshold: RSS < 3500MB (85%)

## Monitoring (Updated 2026-01-09)

Memory usage is logged automatically with **RSS as primary metric**:

```
[Memory Initial] Heap: 45.23MB / 512.00MB, RSS: 125.67MB
[Memory] WARNING: RSS usage 3520.45MB exceeds threshold 3500MB
[Memory] After GC: RSS 3380.12MB (freed 140.33MB)
[Memory Final] Heap: 120.45MB / 512.00MB, RSS: 180.23MB

[Memory Pressure] High level reached
  RSS usage: 3100.23MB / 4096MB (75.7%)
[Memory Pressure] Critical level reached
  RSS usage: 3520.45MB / 4096MB (86.0%)
[MemoryPressure] CRITICAL: Aggressive cleanup initiated
[MemoryPressure] Before cleanup: RSS 3520.45MB
[MemoryPressure] After cleanup: RSS 2980.12MB
[MemoryPressure] Freed: 540.33MB
[MemoryPressure] Continuing after cleanup
```

## Troubleshooting (Updated 2026-01-09)

### Memory Exhaustion Crashes

**Problem**: Still getting "JavaScript heap out of memory" or process crashes

**Root Cause Analysis**:

- Check if monitoring shows RSS usage (not just heap)
- If warnings show heap but not RSS: monitoring may be using old code
- If no warnings before crash: memory spikes too fast for monitoring

**Solutions**:

1. **Verify RSS monitoring is active**: Check logs for "RSS usage" warnings (not "Heap usage")
2. **Lower pressure thresholds**: Reduce from 85% to 80% in `memory-pressure-handler.mjs`
3. **Increase heap size**: Update `--max-old-space-size=4096` to `8192` in `package.json` scripts
4. **Reduce cache limits**: Lower cache sizes in `config.yaml`
5. **Enable more aggressive cleanup**: Reduce `cleanup.interval_seconds` to 300 (5 minutes)
6. **Check for memory leaks**: Profile with `node --heap-prof` or Chrome DevTools

### Slow Performance

**Problem**: Performance degraded after enabling memory management

**Solutions**:

1. Check cache hit rates - low hit rates may indicate cache limits too low
2. Increase cache limits if system has available memory
3. Disable cleanup during execution (set `cleanup.enabled: false`)
4. Reduce monitoring frequency (increase `monitoring.check_interval_seconds`)

### Memory Warnings (RSS-Based)

**Problem**: Frequent RSS memory warnings during execution

**Diagnosis**:

- Check warning frequency: < 5% of execution time is normal
- Check memory freed per cleanup: Should be ≥ 500MB
- Check if warnings correlate with specific operations (artifact loading, subagent spawning)

**Solutions**:

1. **Increase warn threshold**: Change from 3500MB to 3700MB in `memory-monitor.mjs`
2. **Enable GC on warning**: Set `gc.gc_on_warning: true` in config
3. **Reduce cache sizes**: Lower `artifact_cache_max_memory_mb` to 25MB
4. **Enable more frequent cleanup**: Reduce interval to 300s (5 minutes)
5. **Use safe file loader**: Ensure `agent-executor.mjs` uses `loadTextSafely()`/`loadJSONSafely()`
6. **Pre-spawn checks**: Verify `run-cuj.mjs` has pre-spawn memory validation

### Large File Errors

**Problem**: Errors loading large artifacts

**Solutions**:

1. Increase `file_handling.max_artifact_size_mb`
2. Increase `file_handling.max_json_file_size_mb`
3. Check file size before loading
4. Consider splitting large artifacts

## Best Practices (Updated 2026-01-09)

1. **Monitor RSS Usage**: Check logs for **RSS usage** warnings (not just heap)
2. **Validate Pre-Spawn**: Ensure memory checks run BEFORE spawning subagents
3. **Use Safe File Loader**: Replace `readFile()` with `loadTextSafely()`/`loadJSONSafely()`
4. **Tune Cache Limits**: Adjust based on available system memory
5. **Enable Aggressive Cleanup**: Automatic cleanup at 85% RSS prevents crashes
6. **Track RSS Metrics**: Monitor `rssPeakMB` in analytics (not just `heapPeakMB`)
7. **Test with Stress Test**: Run `test-phase7-stress.mjs` to verify RSS < 3500MB
8. **Watch Cleanup Effectiveness**: Should free ≥ 500MB per cleanup cycle

### For Large File Operations

1. **Always use safe loader**: `loadJSONSafely()` / `loadTextSafely()`
2. **Set reasonable limits**: Default 50MB, adjust per use case
3. **Enable streaming**: Force streaming for files > 10MB
4. **Estimate memory**: JSON = 3x file size, text = 1.5x file size
5. **Pre-validate**: Check available memory before loading

### For Subagent Spawning

1. **Check before spawn**: Use `canSpawnSubagent(800)` before spawn
2. **Cleanup on failure**: Run `cleanupAllCaches()` if spawn blocked
3. **Limit concurrency**: Max 3 concurrent subagents recommended
4. **Monitor spawn count**: Track in metrics for tuning

### Critical Memory Pressure (Updated 2026-01-09)

**Problem**: Critical memory pressure warnings (85% RSS) appear

**Expected Behavior** (NEW):

- System now continues execution after aggressive cleanup (no exit by default)
- Cleanup should free ≥ 500MB
- If cleanup insufficient (still > 90%): Emergency warnings logged but continues

**Action Required**:

1. **Monitor cleanup effectiveness**: Check logs for "Freed: XXX MB"
2. **If freed < 500MB**: Reduce cache sizes or concurrent subagents
3. **If emergency warnings appear**: Consider manual intervention:
   - Reduce concurrent operations
   - Clear artifact registry manually
   - Restart process if instability persists

**Problem** (Old behavior): Process exits with code 42 during workflow execution

**Solution** (if you re-enabled checkpoint/exit behavior):

1. This is expected behavior - checkpoint was saved due to memory pressure
2. Check checkpoint location: `.claude/context/runtime/runs/<run_id>/checkpoints/`
3. Resume from checkpoint: `node .claude/tools/workflow_runner.js --resume --run-id <run_id>`
4. Consider increasing heap size if exits are frequent
5. Review memory pressure logs for patterns

**Problem**: Memory pressure warnings (high level) appear frequently

**Solution**:

1. Check cache sizes - may need tuning
2. Enable more aggressive cleanup (reduce interval in config.yaml)
3. Review CUJ for memory-intensive operations
4. Consider breaking workflow into smaller steps
5. Monitor memory metrics in analytics to identify bottlenecks

**Problem**: Critical memory pressure reached but no checkpoint saved

**Solution**:

1. Ensure workflow has `--run-id` parameter
2. Check checkpoint directory permissions
3. Verify checkpoint-manager.mjs is properly integrated
4. Check logs for checkpoint creation errors

## Related Files (Updated 2026-01-09)

**Core Memory Management**:

- `.claude/tools/memory-monitor.mjs` - **RSS-based monitoring** (P0, updated)
- `.claude/tools/memory-pressure-handler.mjs` - **RSS-based pressure detection + aggressive cleanup** (P0/P1, updated)
- `.claude/tools/safe-file-loader.mjs` - **Memory-aware file loading** (P1, NEW)
- `.claude/tools/memory-cleanup.mjs` - Cache cleanup utility (P2)
- `.claude/tools/streaming-json-parser.mjs` - Large file parser (P2)
- `.claude/tools/workflow-checkpoint.mjs` - Checkpoint system (P3)
- `.claude/tools/checkpoint-manager.mjs` - Checkpoint persistence (P3)

**Integration Points**:

- `.claude/tools/run-cuj.mjs` - **Pre-spawn validation** (P0, updated)
- `.claude/tools/workflow_runner.js` - **Pre-load validation** (P0, updated)
- `.claude/tools/agent-executor.mjs` - **Safe file loader integration** (P1, updated)

**Configuration**:

- `.claude/config.yaml` - Memory configuration settings
- `package.json` - Node.js heap size flags (--max-old-space-size=4096 --expose-gc)

**Testing**:

- `.claude/tools/test-phase7-stress.mjs` - **RSS-based stress test** (P2, updated)
- `.claude/tools/test-memory-management.mjs` - Comprehensive test suite (P1+P2+P3)
- `.claude/tools/test-memory-integration.mjs` - Integration tests

**Documentation**:

- This file (`.claude/docs/MEMORY_MANAGEMENT.md`) - Updated 2026-01-09 with RSS-based guidance
- Implementation plan: `C:\Users\oimir\.claude\plans\unified-snuggling-penguin.md`

## See Also

- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md) - Workflow execution details
- [CUJ Index](../cujs/CUJ-INDEX.md) - Customer User Journey documentation
