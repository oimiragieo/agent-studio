# Monitoring and Observability Guide

**Version**: 1.0.0
**Status**: Production
**Last Updated**: 2026-01-28

---

## Overview

The Agent Studio monitoring system provides production-grade observability through:

1. **Hook Execution Metrics** - Performance tracking for all hooks
2. **Agent Performance Tracking** - Agent spawn time, completion time, token usage
3. **Error Rate Monitoring** - Comprehensive error tracking and classification
4. **Monitoring Dashboard** - Real-time CLI dashboard with alerts

## Quick Start

### View Dashboard

```bash
# 24-hour summary (default)
node .claude/tools/cli/monitoring-dashboard.js

# Live updates (refreshes every 5 seconds)
node .claude/tools/cli/monitoring-dashboard.js --live

# 7-day trends
node .claude/tools/cli/monitoring-dashboard.js --trends

# Current alerts only
node .claude/tools/cli/monitoring-dashboard.js --alerts
```

### Memory File Rotation

The memory rotation utility automatically archives old entries when files approach size limits:

```bash
# Check current status
node .claude/lib/memory/memory-rotator.cjs check

# Preview rotation (no changes)
node .claude/lib/memory/memory-rotator.cjs rotate --dry-run

# Execute rotation
node .claude/lib/memory/memory-rotator.cjs rotate

# Rotate specific files
node .claude/lib/memory/memory-rotator.cjs rotate-decisions
node .claude/lib/memory/memory-rotator.cjs rotate-issues
```

**Rotation Policies:**
- `decisions.md`: Archives ADRs older than 60 days when file > 1500 lines
- `issues.md`: Archives RESOLVED issues older than 7 days when file > 1500 lines
- **Archive Location**: `.claude/context/memory/archive/YYYY-MM/`

### Dashboard Output Example

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ Agent Studio Monitoring Dashboard - Last 24h                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║ HOOK PERFORMANCE:                                                            ║
║   Total calls:      1,245                                                    ║
║   Avg execution:    3.2ms                                                    ║
║   Failure rate:     0.8%                                                     ║
║                                                                              ║
║   Top hooks by frequency:                                                    ║
║     routing-guard.cjs                    7.2ms  412 calls                   ║
║     metrics-collector.cjs                2.1ms  1245 calls                  ║
║     error-tracker.cjs                    1.8ms  1245 calls                  ║
║                                                                              ║
║ ERROR STATISTICS:                                                            ║
║   Total errors:     23                                                       ║
║                                                                              ║
║   By severity:                                                               ║
║     HIGH         15                                                          ║
║     MEDIUM       5                                                           ║
║     LOW          3                                                           ║
║                                                                              ║
║   Top error types:                                                           ║
║     ValidationError              8 occurrences                              ║
║     RoutingError                 5 occurrences                              ║
║                                                                              ║
║ ALERTS:                                                                      ║
║   🟡 [HIGH] Hook routing-guard.cjs avg execution time 7.2ms exceeds 10ms    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

Last updated: 1/28/2026, 10:15:30 AM
```

## Components

### 1. Hook Execution Metrics

**File**: `.claude/hooks/monitoring/metrics-collector.cjs`

**Purpose**: Tracks performance of all hook executions

**Metrics Collected**:
- Execution time (ms)
- Success/failure status
- Tool being hooked
- Hook name
- Metadata (params size, result size)

**Storage**: `.claude/context/metrics/hook-metrics.jsonl`

**Format** (JSONL):
```json
{"timestamp":"2026-01-28T10:00:00.123Z","hook":"routing-guard.cjs","event":"PostToolUse","tool":"Task","executionTimeMs":7.2,"status":"success","metadata":{"paramsSize":256,"resultSize":128}}
```

**Security**:
- SEC-MON-001: Metrics schema validation
- Rate limiting: 10,000 entries/hour
- No sensitive data in metrics

### 2. Error Tracking

**File**: `.claude/hooks/monitoring/error-tracker.cjs`

**Purpose**: Tracks and classifies all errors

**Metrics Collected**:
- Error type (ValidationError, RoutingError, SecurityViolation, SystemError)
- Severity (CRITICAL, HIGH, MEDIUM, LOW)
- Source (which hook/file)
- Error message
- Stack trace (first 3 lines)

**Storage**: `.claude/context/metrics/error-metrics.jsonl`

**Format** (JSONL):
```json
{"timestamp":"2026-01-28T10:00:00.123Z","errorType":"ValidationError","source":"routing-guard.cjs","message":"Complexity gate triggered","severity":"HIGH","tool":"TaskCreate","metadata":{"errorName":"Error","stack":"..."}}
```

**Error Classification**:
| Error Type | Severity | Trigger |
|------------|----------|---------|
| SecurityViolation | CRITICAL | Source contains "security" or SEC- code |
| ValidationError | HIGH | Source contains "validation" |
| RoutingError | HIGH | Source contains "routing" |
| SystemError | MEDIUM | TypeError, ReferenceError |
| UnknownError | LOW | Other errors |

### 3. Metrics Reader

**File**: `.claude/lib/monitoring/metrics-reader.cjs`

**Purpose**: Parses JSONL files and calculates statistics

**Functions**:
- `readMetrics(file, options)` - Read and filter metrics by time
- `calculateHookStats(metrics)` - Calculate hook performance statistics
- `calculateErrorStats(metrics)` - Calculate error statistics
- `getMetricsSummary(options)` - Get complete summary for dashboard
- `findSlowHooks(stats, threshold)` - Find hooks exceeding threshold
- `detectAlerts(summary, thresholds)` - Detect threshold violations

**Statistics Calculated**:
- Average execution time
- Percentiles (P50, P95, P99)
- Success/failure rates
- Call counts
- Error rates by type/severity/source

### 4. Dashboard Renderer

**File**: `.claude/lib/monitoring/dashboard-renderer.cjs`

**Purpose**: Renders metrics in ASCII format

**Functions**:
- `renderDashboard(summary, alerts)` - Full dashboard
- `renderTable(headers, rows)` - Aligned tables
- `renderBox(title, content)` - Bordered boxes
- `renderAlert(alert)` - Alert with icon
- `formatNumber(num)` - Number formatting with commas
- `formatTime(ms)` - Time formatting (µs/ms/s)
- `formatPercent(percent)` - Percentage formatting

### 5. Monitoring Dashboard CLI

**File**: `.claude/tools/cli/monitoring-dashboard.js`

**Purpose**: Command-line interface for viewing metrics

**Commands**:
```bash
# Default: 24-hour summary
node .claude/tools/cli/monitoring-dashboard.js

# Live mode: Updates every 5 seconds
node .claude/tools/cli/monitoring-dashboard.js --live

# 7-day trends
node .claude/tools/cli/monitoring-dashboard.js --trends

# Alerts only
node .claude/tools/cli/monitoring-dashboard.js --alerts

# Custom time range
node .claude/tools/cli/monitoring-dashboard.js --hours=48
```

## Configuration

### Monitoring Thresholds

**File**: `.claude/config.yaml`

```yaml
monitoring:
  enabled: true
  thresholds:
    hookExecutionTimeMs: 10      # Alert if hook > 10ms
    hookFailureRate: 5           # Alert if failure rate > 5%
    agentFailureRate: 3          # Alert if agent failure > 3%
    errorRatePerHour: 10         # Alert if > 10 errors/hour
    tokenBudgetPerDay: 100000    # Daily token budget
  retention:
    metricsDays: 30              # Keep metrics for 30 days
    errorsDays: 90               # Keep errors for 90 days
  dashboard:
    refreshIntervalMs: 5000      # Live mode refresh interval
```

### Environment Variables

Override configuration via environment variables:

```bash
# Disable monitoring
MONITORING_ENABLED=false

# Adjust thresholds
HOOK_EXECUTION_THRESHOLD=20
ERROR_RATE_THRESHOLD=20
```

## Alert Severity Levels

| Severity | Icon | Trigger | Action |
|----------|------|---------|--------|
| CRITICAL | 🔴 | Security violations | Immediate investigation |
| HIGH | 🟡 | High error rate, validation failures | Review within 1 hour |
| MEDIUM | 🟠 | Slow hooks, elevated errors | Review within 24 hours |
| LOW | 🔵 | Minor issues | Review at convenience |

## Metrics Storage

### File Format

**JSONL** (JSON Lines) format:
- One JSON object per line
- Append-only (efficient for large files)
- Easy to parse incrementally
- No commas between entries

**Example**:
```jsonl
{"timestamp":"2026-01-28T10:00:00.123Z","hook":"routing-guard.cjs","executionTimeMs":7.2}
{"timestamp":"2026-01-28T10:00:01.456Z","hook":"security-trigger.cjs","executionTimeMs":3.1}
{"timestamp":"2026-01-28T10:00:02.789Z","hook":"error-tracker.cjs","executionTimeMs":1.8}
```

### Storage Locations

```
.claude/context/metrics/
  hook-metrics.jsonl       # Hook performance metrics
  error-metrics.jsonl      # Error tracking logs
  agent-metrics.jsonl      # Agent performance (future)
  alerts.jsonl             # Alert history (future)
```

### Retention Policy

- **Metrics**: 30 days (configurable)
- **Errors**: 90 days (configurable)
- **Rotation**: Monthly (1st of month)
- **Archive**: Move to `.claude/context/metrics/archive/YYYY-MM/`

**Rotation Script** (manual, for now):
```bash
# Archive last month's metrics
mkdir -p .claude/context/metrics/archive/2026-01
mv .claude/context/metrics/*-metrics.jsonl .claude/context/metrics/archive/2026-01/
```

## Performance Impact

| Component | Overhead | Impact |
|-----------|----------|--------|
| Metrics collection | ~0.5ms per hook | Negligible |
| Error tracking | ~0.3ms per error | Negligible |
| File writes | ~1ms per entry | Async, non-blocking |
| Dashboard rendering | ~50ms for 1000 entries | Only when viewing |

**Total overhead**: <1ms per hook execution (within target)

## Troubleshooting

### No metrics showing in dashboard

**Symptom**: Dashboard shows 0 calls or "No data"

**Causes & Solutions**:
1. **Metrics directory missing**
   ```bash
   mkdir -p .claude/context/metrics
   ```

2. **Hooks not registered**
   - Verify hooks are in `.claude/hooks/monitoring/`
   - Check hook registration in hook system

3. **No hook executions yet**
   - Run some commands to generate metrics
   - Use: `node .claude/tools/cli/kb-search.cjs --query "test"`

### Dashboard shows old data

**Symptom**: Dashboard not updating with recent metrics

**Solution**:
- Check file timestamps: `ls -lt .claude/context/metrics/`
- Verify hooks are executing: `tail -5 .claude/context/metrics/hook-metrics.jsonl`
- Clear dashboard cache: `rm -rf /tmp/monitoring-cache-*`

### High error rate alert

**Symptom**: Alert shows elevated error rate

**Investigation**:
1. View errors: `node .claude/tools/cli/monitoring-dashboard.js --alerts`
2. Check error log: `tail -50 .claude/context/metrics/error-metrics.jsonl`
3. Identify pattern: Which hook? Which error type?
4. Review recent changes: `git log --oneline -10`

### Slow hook alert

**Symptom**: Alert shows hook execution time exceeds threshold

**Investigation**:
1. Identify slow hook: Check dashboard "Top hooks by frequency"
2. Check P95/P99 times: `grep "hook-name" .claude/context/metrics/hook-metrics.jsonl | jq '.executionTimeMs' | sort -n | tail -5`
3. Profile hook: Add timing logs to hook code
4. Optimize: Cache data, reduce I/O, simplify logic

### Rate limit exceeded

**Symptom**: Warning message "Rate limit exceeded (10000/hour)"

**Causes**:
- Extremely high hook execution frequency
- Infinite loop triggering hooks
- Malicious activity

**Solutions**:
1. Check for loops: Review recent hook calls
2. Increase limit: Modify `RATE_LIMIT_PER_HOUR` in hook code
3. Batch writes: Aggregate multiple metrics into single write

## Integration with Other Systems

### Cost Tracking Integration

Monitoring complements cost tracking (`.claude/docs/COST_TRACKING.md`):
- Cost tracking: LLM usage and billing
- Monitoring: System performance and errors

**Combined view**:
```bash
# View both cost and performance
node .claude/tools/cli/cost-report.js --today
node .claude/tools/cli/monitoring-dashboard.js --summary
```

### Task Management Integration

Monitoring metrics can inform task management:
- High error rate → Create task for investigation
- Slow hook → Create optimization task
- Agent failure → Create debugging task

**Example**:
```javascript
// In task-completion handler
if (errorRate > threshold) {
  TaskCreate({
    subject: 'Investigate elevated error rate',
    description: `Error rate ${errorRate}/hour exceeds threshold`,
    priority: 'HIGH'
  });
}
```

### Memory Protocol Integration

Log monitoring insights to memory:

**learnings.md**:
```markdown
## Monitoring Patterns (2026-01-28)

- routing-guard.cjs consistently takes 7-8ms (complexity checks)
- error-tracker.cjs is very fast (<2ms) - good baseline
- Peak hook usage: 10am-12pm (200 calls/hour)
- Weekends: 50% fewer errors than weekdays
```

**decisions.md**:
```markdown
## ADR-063: Increase Hook Execution Threshold

**Date**: 2026-01-28
**Status**: Accepted

**Context**: routing-guard.cjs consistently exceeds 10ms threshold due to complex validation logic.

**Decision**: Increase threshold to 15ms for routing hooks specifically.

**Consequences**: Fewer false-positive alerts, more accurate performance monitoring.
```

## Router Debug Logging

**Purpose**: Diagnose routing decisions and enforcement violations

**Feature**: PROC-007 Option D - Debug logging enabled by default in development

### Enable/Disable

```bash
# Enabled by default (no action needed)
# Logs are written to stderr

# Disable debug logging (production)
export ROUTER_DEBUG=false
claude

# Re-enable (explicit)
export ROUTER_DEBUG=true
claude
```

### What Gets Logged

Debug logs show:
- Enforcement mode checks (block/warn/off)
- Router state (mode, taskSpawned, lastReset)
- Allow/block decisions with reasoning
- Tool and enforcement context

### Example Output

```
[2026-01-28T10:30:15.123Z] [routing-guard] checkRouterSelfCheck called {"tool":"Edit"}
[2026-01-28T10:30:15.124Z] [routing-guard] Enforcement mode check {"enforcement":"block"}
[2026-01-28T10:30:15.125Z] [routing-guard] Tool is blacklisted, checking context... {"tool":"Edit"}
[2026-01-28T10:30:15.126Z] [routing-guard] Router state check {"mode":"router","taskSpawned":false,"lastReset":"2026-01-28T10:30:00.000Z"}
[2026-01-28T10:30:15.127Z] [routing-guard] BLOCK: Router using blacklisted tool {"tool":"Edit","enforcement":"block"}
[2026-01-28T10:30:15.128Z] [routing-guard] Returning BLOCK decision
```

### Log Format

All debug logs use consistent format:
- **Timestamp**: ISO 8601 format with milliseconds
- **Source**: `[routing-guard]` for routing decisions
- **Message**: Human-readable decision description
- **Data**: JSON object with context (when applicable)

### Viewing Logs

```bash
# During execution, logs go to stderr
claude 2> routing-debug.log

# Filter routing logs only
claude 2>&1 | grep "\[routing-guard\]"

# Count enforcement decisions
grep "BLOCK\|ALLOW" routing-debug.log | wc -l
```

### Common Patterns

**Stale State Detection** (Problem that triggered PROC-007):
```
[routing-guard] Router state check {"mode":"router","taskSpawned":true,...}
[routing-guard] ALLOW: Agent mode or task spawned {"mode":"router","taskSpawned":true}
```
^ Shows state thinks task spawned even though mode is "router" (stale state bug)

**Successful Reset** (After Option A fix):
```
[routing-guard] Router state check {"mode":"router","taskSpawned":false,"lastReset":"2026-01-28T..."}
[routing-guard] BLOCK: Router using blacklisted tool {"tool":"Edit",...}
```
^ Shows state correctly reset with taskSpawned: false

**Whitelisted Tool**:
```
[routing-guard] ALLOW: tool is whitelisted {"tool":"Task"}
```

**Always-Allowed File Write**:
```
[routing-guard] ALLOW: write to always-allowed file {"tool":"Edit","filePath":".claude/context/memory/learnings.md"}
```

### Troubleshooting with Debug Logs

**Symptom**: Routing guard blocks legitimate agent writes

**Diagnosis**:
1. Enable debug logging (already enabled by default)
2. Run operation and check stderr logs
3. Look for state check: Is `taskSpawned` true?
4. Check `lastReset` timestamp: Recent?

**Symptom**: Router bypassing enforcement

**Diagnosis**:
1. Check logs for "ALLOW" decisions
2. Look for reason: "enforcement disabled"? "whitelisted"? "agent mode"?
3. Check state file: `.claude/context/runtime/router-state.json`
4. Verify state-reset hook running: Check lastReset timestamp

### Performance Impact

- **Overhead**: ~0.1ms per debug log (negligible)
- **Default**: Enabled in development, disabled in production
- **Output**: stderr only (doesn't pollute stdout)
- **Volume**: ~5-10 log lines per routing decision

### Integration with Monitoring

Debug logs complement monitoring metrics:
- **Metrics**: What happened (counts, times, rates)
- **Debug logs**: Why it happened (decisions, state, context)

Combined view for investigations:
1. Check metrics: "routing-guard.cjs blocked 15 operations"
2. Check debug logs: "Why? State shows taskSpawned: false"
3. Fix root cause: State-reset hook not registered

## Future Enhancements

1. **Agent Performance Tracking** (Phase 2)
   - Track agent spawn time
   - Monitor task completion duration
   - Token usage per agent

2. **Alerting Integration** (Phase 2)
   - Email/Slack notifications
   - Webhook support
   - Alert escalation rules

3. **Historical Analytics** (Phase 3)
   - Trend analysis
   - Anomaly detection
   - Capacity planning

4. **Cost-Performance Correlation** (Phase 3)
   - Link cost data with performance metrics
   - Identify expensive slow operations
   - Optimize for cost-performance ratio

5. **Distributed Tracing** (Phase 3)
   - Trace requests across hooks
   - Visualize hook execution chains
   - Identify cascading failures

## References

- **Production Hardening Plan**: `.claude/context/plans/production-hardening-plan-20260128.md`
- **Cost Tracking**: `.claude/docs/COST_TRACKING.md`
- **Hook Architecture**: `.claude/hooks/README.md` (future)
- **Task Management**: `.claude/skills/task-management-protocol/SKILL.md`

---

**Maintained by**: DevOps Agent
**Last Review**: 2026-01-28
**Next Review**: 2026-02-28
