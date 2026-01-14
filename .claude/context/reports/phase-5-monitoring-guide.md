# Phase 5 Monitoring and Observability Guide

**System**: Phases 2-4 Memory System
**Version**: 1.0.0
**Date**: 2026-01-13
**Audience**: DevOps, On-Call Engineers, SREs

---

## Executive Summary

This guide provides comprehensive monitoring and observability recommendations for the Phase 2-4 memory system in production. It defines key metrics, alert thresholds, dashboard layouts, log aggregation patterns, and health check procedures.

**Monitoring Philosophy**: Proactive detection of performance degradation and failures before user impact.

**Key Objectives**:
1. Detect memory system failures within 60 seconds
2. Identify performance degradation before SLA violations
3. Provide actionable alerts with clear resolution steps
4. Enable data-driven capacity planning

---

## 1. Key Metrics to Monitor

### 1.1 Performance Metrics

#### 1.1.1 Memory Injection Latency

**Metric Name**: `memory.injection.latency`
**Type**: Histogram (milliseconds)
**Dimensions**: `agent_type`, `session_id`, `feature_flag_state`

**Percentiles to Track**:
- **p50 (median)**: Target <50ms, Alert if >100ms
- **p95**: Target <200ms, Alert if >500ms
- **p99**: Target <500ms, Alert if >1000ms
- **max**: Alert if >2000ms

**Thresholds**:
```
INFO:     p95 < 200ms (normal operation)
WARNING:  p95 200ms-500ms (degraded performance)
CRITICAL: p95 > 500ms for 5 consecutive minutes
```

**What It Measures**: Time to load and inject relevant memories before tool execution
**Why It Matters**: Directly impacts user-perceived latency; injection on critical path
**Alert Action**: Check database query performance, RAG service health, cache hit rate

**Dashboard Visualization**: Line chart with percentile bands (p50/p95/p99)

---

#### 1.1.2 Database Query Duration

**Metric Name**: `memory.db.query_duration`
**Type**: Histogram (milliseconds)
**Dimensions**: `query_type` (SELECT/INSERT/UPDATE), `table_name`

**Percentiles to Track**:
- **p50**: Target <5ms, Alert if >20ms
- **p95**: Target <10ms, Alert if >50ms
- **p99**: Target <20ms, Alert if >100ms

**Thresholds**:
```
INFO:     p95 < 10ms (optimal)
WARNING:  p95 10-50ms (acceptable)
CRITICAL: p95 > 50ms for 5 consecutive minutes
```

**What It Measures**: SQLite query execution time across all memory tables
**Why It Matters**: Database is bottleneck for memory retrieval; slow queries cascade to injection latency
**Alert Action**: Check for missing indexes, large table scans, lock contention

**Dashboard Visualization**: Heatmap by query type and table

---

#### 1.1.3 RAG Search Latency

**Metric Name**: `memory.rag.search_duration`
**Type**: Histogram (milliseconds)
**Dimensions**: `search_type` (semantic/hybrid), `result_count`

**Percentiles to Track**:
- **p50**: Target <200ms, Alert if >500ms
- **p95**: Target <500ms, Alert if >1000ms
- **p99**: Target <1000ms, Alert if >2000ms

**Thresholds**:
```
INFO:     p95 < 500ms (normal)
WARNING:  p95 500-1000ms (degraded)
CRITICAL: p95 > 1000ms for 10 consecutive minutes
```

**What It Measures**: Vector embedding search time for semantic memory retrieval
**Why It Matters**: RAG search enables long-term memory; slowdown impacts deep context
**Alert Action**: Check embedding service health, vector index size, query complexity

**Dashboard Visualization**: Line chart with search type breakdown

---

#### 1.1.4 Context Overflow Compaction Time

**Metric Name**: `memory.overflow.compaction_duration`
**Type**: Histogram (milliseconds)
**Dimensions**: `compaction_tier` (recent/mid-term/long-term)

**Percentiles to Track**:
- **p95**: Target <500ms, Alert if >2000ms
- **p99**: Target <1000ms, Alert if >5000ms

**Thresholds**:
```
INFO:     p95 < 500ms (fast compaction)
WARNING:  p95 500-2000ms (slow compaction)
CRITICAL: p95 > 2000ms for 3 consecutive events
```

**What It Measures**: Time to compact and summarize messages when context overflows
**Why It Matters**: Blocking operation; long compaction = UX freeze
**Alert Action**: Check message count, summarization service, database writes

**Dashboard Visualization**: Histogram with compaction tier breakdown

---

### 1.2 Throughput Metrics

#### 1.2.1 Memory Capture Rate

**Metric Name**: `memory.capture.rate`
**Type**: Counter (events per second)
**Dimensions**: `source` (tool_output/user_input/agent_reasoning)

**Thresholds**:
```
INFO:     10-100 captures/sec (normal)
WARNING:  >500 captures/sec (high load)
CRITICAL: >1000 captures/sec (potential memory leak or infinite loop)
```

**What It Measures**: Rate of new memory entries created
**Why It Matters**: High capture rate may indicate runaway processes or inefficient capture logic
**Alert Action**: Identify source of high capture rate, check for loops, validate capture logic

**Dashboard Visualization**: Stacked area chart by source

---

#### 1.2.2 Memory Injection Rate

**Metric Name**: `memory.injection.rate`
**Type**: Counter (injections per second)
**Dimensions**: `agent_type`, `feature_flag_state`

**Thresholds**:
```
INFO:     5-50 injections/sec (normal)
WARNING:  >200 injections/sec (high load)
CRITICAL: >500 injections/sec (potential DDoS or runaway loop)
```

**What It Measures**: Frequency of memory injection before tool execution
**Why It Matters**: Correlates with agent activity; spikes may indicate load or bugs
**Alert Action**: Investigate spike source, check for retry loops, validate rate limiting

**Dashboard Visualization**: Line chart with agent breakdown

---

#### 1.2.3 Cross-Agent Sharing Events

**Metric Name**: `memory.cross_agent.sharing_events`
**Type**: Counter (events per minute)
**Dimensions**: `source_agent`, `target_agent`, `shared_memory_type`

**Thresholds**:
```
INFO:     <10 sharing events/min (normal)
WARNING:  10-50 sharing events/min (active collaboration)
CRITICAL: >100 sharing events/min (potential sharing loop)
```

**What It Measures**: Frequency of memory shared between agents
**Why It Matters**: Cross-agent sharing is new feature; spikes may indicate bugs
**Alert Action**: Check sharing logic, validate agent handoffs, inspect shared memory content

**Dashboard Visualization**: Sankey diagram showing agent-to-agent flows

---

### 1.3 Resource Utilization Metrics

#### 1.3.1 Memory System Heap Usage

**Metric Name**: `memory.heap.used_mb`
**Type**: Gauge (megabytes)
**Dimensions**: `process_type` (supervisor/worker)

**Thresholds**:
```
INFO:     <100MB (optimal - target achieved in tests)
WARNING:  100-500MB (acceptable)
CRITICAL: >500MB (potential leak or excessive growth)
FATAL:    >1GB (approaching V8 limit even with flags)
```

**What It Measures**: V8 heap memory consumed by memory system
**Why It Matters**: Heap exhaustion crashes Node.js; this was the original Phase 2 motivation
**Alert Action**: Check for memory leaks, validate cleanup service, restart supervisor if needed

**Dashboard Visualization**: Area chart with warning/critical threshold lines

---

#### 1.3.2 Database File Size

**Metric Name**: `memory.db.file_size_mb`
**Type**: Gauge (megabytes)
**Dimensions**: None

**Thresholds**:
```
INFO:     <100MB (small database)
WARNING:  100-500MB (medium database, check cleanup)
CRITICAL: >500MB (large database, cleanup may be failing)
```

**What It Measures**: SQLite database file size on disk
**Why It Matters**: Unchecked growth impacts query performance and disk space
**Alert Action**: Verify cleanup service running, check archive policies, run manual cleanup if needed

**Dashboard Visualization**: Single stat with trend line

---

#### 1.3.3 Vector Index Size

**Metric Name**: `memory.rag.index_size_entries`
**Type**: Gauge (entry count)
**Dimensions**: None

**Thresholds**:
```
INFO:     <10,000 entries (small index)
WARNING:  10,000-50,000 entries (medium index)
CRITICAL: >50,000 entries (large index, performance impact)
```

**What It Measures**: Number of entries in vector embedding index
**Why It Matters**: Large indexes slow RAG search; cleanup should prevent unbounded growth
**Alert Action**: Verify cleanup service, check archive policies, rebuild index if corrupted

**Dashboard Visualization**: Single stat with growth rate

---

### 1.4 Error Rate Metrics

#### 1.4.1 Memory Injection Failures

**Metric Name**: `memory.injection.errors`
**Type**: Counter (errors per minute)
**Dimensions**: `error_type` (db_error/timeout/rag_failure)

**Thresholds**:
```
INFO:     0 errors/min (perfect health)
WARNING:  1-5 errors/min (occasional failures)
CRITICAL: >5 errors/min (systemic issue)
```

**What It Measures**: Failed memory injection attempts
**Why It Matters**: Injection failures break agent context; high error rate = broken feature
**Alert Action**: Check database connectivity, RAG service health, error logs for root cause

**Dashboard Visualization**: Stacked bar chart by error type

---

#### 1.4.2 Database Query Errors

**Metric Name**: `memory.db.errors`
**Type**: Counter (errors per minute)
**Dimensions**: `error_type` (connection/timeout/constraint_violation)

**Thresholds**:
```
INFO:     0 errors/min (healthy database)
WARNING:  1-3 errors/min (intermittent issues)
CRITICAL: >3 errors/min (database unhealthy)
```

**What It Measures**: Failed database operations (SELECT/INSERT/UPDATE)
**Why It Matters**: Database is critical dependency; errors cascade to all memory features
**Alert Action**: Check database locks, connection pool, schema integrity

**Dashboard Visualization**: Stacked bar chart by error type

---

#### 1.4.3 RAG Service Errors

**Metric Name**: `memory.rag.errors`
**Type**: Counter (errors per minute)
**Dimensions**: `error_type` (embedding_failure/search_timeout/index_error)

**Thresholds**:
```
INFO:     0 errors/min (healthy RAG)
WARNING:  1-5 errors/min (occasional failures)
CRITICAL: >5 errors/min (RAG service degraded)
```

**What It Measures**: Failed RAG operations (embedding generation, semantic search)
**Why It Matters**: RAG enables long-term memory; failures degrade memory quality
**Alert Action**: Check embedding service, vector index health, network connectivity

**Dashboard Visualization**: Stacked bar chart by error type

---

#### 1.4.4 Cross-Agent Sharing Failures

**Metric Name**: `memory.cross_agent.errors`
**Type**: Counter (errors per minute)
**Dimensions**: `error_type` (permission_denied/serialization_error/timeout)

**Thresholds**:
```
INFO:     0 errors/min (healthy sharing)
WARNING:  1-3 errors/min (occasional failures)
CRITICAL: >3 errors/min (sharing broken)
```

**What It Measures**: Failed cross-agent memory sharing attempts
**Why It Matters**: New feature; errors indicate bugs in Phase 4 implementation
**Alert Action**: Check permissions, serialization logic, agent handoff code

**Dashboard Visualization**: Bar chart by error type

---

### 1.5 Cache Performance Metrics

#### 1.5.1 Cache Hit Rate

**Metric Name**: `memory.cache.hit_rate`
**Type**: Gauge (percentage)
**Dimensions**: `cache_type` (recent/mid-term/embedding)

**Thresholds**:
```
INFO:     >70% (excellent caching)
WARNING:  50-70% (acceptable caching)
CRITICAL: <50% for 10 consecutive minutes (poor caching)
```

**What It Measures**: Percentage of memory requests served from cache vs. database
**Why It Matters**: Cache hits reduce database load and injection latency
**Alert Action**: Check cache size, eviction policy, cache key logic

**Dashboard Visualization**: Percentage gauge with threshold colors

---

#### 1.5.2 Cache Eviction Rate

**Metric Name**: `memory.cache.evictions`
**Type**: Counter (evictions per minute)
**Dimensions**: `cache_type`, `eviction_reason` (size/ttl/manual)

**Thresholds**:
```
INFO:     <10 evictions/min (stable cache)
WARNING:  10-50 evictions/min (high churn)
CRITICAL: >50 evictions/min (cache thrashing)
```

**What It Measures**: Rate of cache entries being evicted
**Why It Matters**: High eviction rate = cache too small or TTL too short
**Alert Action**: Increase cache size, adjust TTL, check for memory pressure

**Dashboard Visualization**: Line chart by eviction reason

---

### 1.6 Cleanup Service Metrics

#### 1.6.1 Cleanup Execution Success

**Metric Name**: `memory.cleanup.success_rate`
**Type**: Gauge (percentage)
**Dimensions**: `cleanup_type` (session/archive/vector_index)

**Thresholds**:
```
INFO:     100% success (healthy cleanup)
WARNING:  90-99% success (occasional failures)
CRITICAL: <90% success (cleanup broken)
```

**What It Measures**: Percentage of cleanup jobs completing successfully
**Why It Matters**: Failed cleanup = unbounded database growth and heap exhaustion
**Alert Action**: Check cleanup service logs, validate cron schedule, test cleanup manually

**Dashboard Visualization**: Percentage gauge by cleanup type

---

#### 1.6.2 Cleanup Execution Duration

**Metric Name**: `memory.cleanup.duration`
**Type**: Histogram (milliseconds)
**Dimensions**: `cleanup_type`

**Thresholds**:
```
INFO:     <5000ms (fast cleanup)
WARNING:  5000-30000ms (slow cleanup)
CRITICAL: >30000ms (very slow, may impact operations)
```

**What It Measures**: Time to complete cleanup operations
**Why It Matters**: Long cleanup may indicate large data volumes or inefficiency
**Alert Action**: Check database size, optimize cleanup queries, run manual cleanup

**Dashboard Visualization**: Histogram by cleanup type

---

#### 1.6.3 Cleanup Deleted Entry Count

**Metric Name**: `memory.cleanup.deleted_entries`
**Type**: Counter (entries per cleanup run)
**Dimensions**: `cleanup_type`

**Thresholds**:
```
INFO:     <1000 entries deleted (normal)
WARNING:  1000-10000 entries deleted (high volume)
CRITICAL: >10000 entries deleted (potential data retention issue)
```

**What It Measures**: Number of entries deleted in each cleanup run
**Why It Matters**: High deletion count may indicate capture runaway or retention policy issues
**Alert Action**: Validate retention policies, check capture rate, investigate high-volume sessions

**Dashboard Visualization**: Bar chart by cleanup type

---

## 2. Alert Configuration

### 2.1 Alert Severity Levels

| Severity | Response Time | Notification Channel | Escalation |
|----------|---------------|----------------------|------------|
| **INFO** | None (logged only) | Logs | None |
| **WARNING** | <30 minutes | Slack #monitoring | None |
| **CRITICAL** | <5 minutes | PagerDuty + Slack #oncall | 15min → L2 |
| **FATAL** | Immediate | PagerDuty (high priority) + Phone | Immediate → L2 + Manager |

### 2.2 Alert Routing Rules

```yaml
# Example alert routing configuration
alerts:
  - name: memory_injection_latency_high
    severity: CRITICAL
    condition: memory.injection.latency.p95 > 500ms for 5 minutes
    channels:
      - pagerduty: oncall-memory-system
      - slack: "#oncall"
    runbook_url: "https://wiki.internal/runbooks/memory-injection-latency"

  - name: database_query_slow
    severity: WARNING
    condition: memory.db.query_duration.p95 > 50ms for 5 minutes
    channels:
      - slack: "#monitoring"
    runbook_url: "https://wiki.internal/runbooks/database-slow-queries"

  - name: heap_usage_critical
    severity: CRITICAL
    condition: memory.heap.used_mb > 500MB
    channels:
      - pagerduty: oncall-memory-system
      - slack: "#oncall"
    runbook_url: "https://wiki.internal/runbooks/heap-exhaustion"

  - name: cleanup_service_failure
    severity: CRITICAL
    condition: memory.cleanup.success_rate < 90% for 1 hour
    channels:
      - pagerduty: oncall-memory-system
      - slack: "#oncall"
    runbook_url: "https://wiki.internal/runbooks/cleanup-service-failure"
```

### 2.3 Alert Escalation Policy

**Tier 1 (L1) - On-Call Engineer**:
- Response time: <5 minutes for CRITICAL
- Actions: Execute runbook, attempt immediate mitigation
- Escalate if: Runbook doesn't resolve, or issue persists >15 minutes

**Tier 2 (L2) - Senior On-Call Engineer**:
- Response time: <15 minutes for escalation
- Actions: Deep debugging, coordinate with dev team
- Escalate if: Root cause unclear, or fix requires code changes

**Tier 3 (L3) - Development Team**:
- Response time: <30 minutes for escalation
- Actions: Code fixes, architecture changes, hotfixes
- Escalate if: Requires rollback decision or product changes

**Tier 4 (L4) - Engineering Manager + Product**:
- Response time: <1 hour for escalation
- Actions: Rollback decisions, feature flag changes, user communication
- Authority: Can approve emergency rollbacks

---

## 3. Dashboard Recommendations

### 3.1 Real-Time Operations Dashboard

**Purpose**: Monitor system health in real-time
**Audience**: On-call engineers, DevOps
**Refresh Rate**: 1 minute

**Panels**:

1. **System Health Overview** (Top row)
   - Memory injection latency (p95) - Line chart
   - Database query duration (p95) - Line chart
   - RAG search latency (p95) - Line chart
   - Heap usage - Area chart with thresholds

2. **Throughput Metrics** (Second row)
   - Memory capture rate - Line chart
   - Memory injection rate - Line chart
   - Cross-agent sharing events - Line chart

3. **Error Rates** (Third row)
   - Injection errors - Bar chart
   - Database errors - Bar chart
   - RAG errors - Bar chart
   - Cross-agent sharing errors - Bar chart

4. **Cache Performance** (Fourth row)
   - Cache hit rate - Percentage gauge
   - Cache eviction rate - Line chart

5. **Alerts** (Bottom row)
   - Active alerts - Table
   - Recent alert history - Timeline

---

### 3.2 Performance Analysis Dashboard

**Purpose**: Investigate performance issues and trends
**Audience**: Performance engineers, SREs
**Refresh Rate**: 5 minutes

**Panels**:

1. **Latency Distribution** (Top row)
   - Injection latency percentiles (p50/p95/p99/max) - Heatmap
   - DB query duration percentiles - Heatmap
   - RAG search duration percentiles - Heatmap

2. **Latency Breakdown** (Second row)
   - Injection latency by agent type - Stacked area chart
   - DB query duration by table - Stacked area chart
   - RAG search duration by search type - Stacked area chart

3. **Correlation Analysis** (Third row)
   - Latency vs. cache hit rate - Scatter plot
   - Latency vs. heap usage - Scatter plot
   - Latency vs. database size - Scatter plot

4. **Historical Trends** (Bottom row)
   - 7-day latency trend - Line chart
   - 7-day throughput trend - Line chart
   - 7-day error rate trend - Line chart

---

### 3.3 Capacity Planning Dashboard

**Purpose**: Plan for future capacity needs
**Audience**: SREs, Engineering managers
**Refresh Rate**: 1 hour

**Panels**:

1. **Resource Growth** (Top row)
   - Database size over time - Line chart with linear projection
   - Vector index size over time - Line chart with linear projection
   - Heap usage over time - Line chart with linear projection

2. **Throughput Trends** (Second row)
   - Capture rate trend (7-day average) - Line chart
   - Injection rate trend (7-day average) - Line chart
   - Cross-agent sharing trend (7-day average) - Line chart

3. **Capacity Headroom** (Third row)
   - Heap usage vs. limit (500MB) - Percentage gauge
   - Database size vs. limit (500MB) - Percentage gauge
   - Vector index size vs. limit (50k entries) - Percentage gauge

4. **Projections** (Bottom row)
   - Days until heap limit reached - Single stat
   - Days until database limit reached - Single stat
   - Days until vector index limit reached - Single stat

---

### 3.4 Feature Flag Dashboard

**Purpose**: Monitor feature flag rollout impact
**Audience**: Product managers, DevOps
**Refresh Rate**: 1 minute

**Panels**:

1. **Flag Status** (Top row)
   - USE_ENHANCED_INJECTION - Percentage gauge (% of sessions enabled)
   - USE_CROSS_AGENT_SHARING - Percentage gauge
   - USE_HIERARCHICAL_TIERS - Percentage gauge

2. **Performance Comparison** (Second row)
   - Latency: Flag ON vs. OFF - Side-by-side line charts
   - Error rate: Flag ON vs. OFF - Side-by-side line charts

3. **Adoption Metrics** (Third row)
   - Sessions with flag enabled - Counter
   - Sessions with flag disabled - Counter
   - Flag toggle events - Timeline

4. **Rollback Readiness** (Bottom row)
   - Time since last flag change - Single stat
   - Active sessions with flag enabled - Counter
   - Rollback impact estimate - Percentage gauge

---

## 4. Log Aggregation Patterns

### 4.1 Structured Logging Schema

All memory system logs MUST use structured JSON format:

```json
{
  "timestamp": "2026-01-13T12:34:56.789Z",
  "level": "INFO",
  "component": "memory.injection",
  "event": "injection_complete",
  "session_id": "sess_abc123",
  "agent_type": "developer",
  "duration_ms": 45,
  "memory_count": 12,
  "cache_hit": true,
  "feature_flags": {
    "USE_ENHANCED_INJECTION": true,
    "USE_CROSS_AGENT_SHARING": false
  },
  "metadata": {
    "source": "pre-tool-hook",
    "tool_name": "read_file"
  }
}
```

### 4.2 Log Levels

| Level | Usage | Retention |
|-------|-------|-----------|
| **DEBUG** | Detailed execution traces | 1 day |
| **INFO** | Normal operations (injection, capture) | 7 days |
| **WARNING** | Performance degradation, retries | 30 days |
| **ERROR** | Failed operations (recoverable) | 90 days |
| **CRITICAL** | System failures (unrecoverable) | 1 year |

### 4.3 Key Log Events

#### Injection Events
```json
{
  "event": "injection_start",
  "session_id": "sess_abc123",
  "agent_type": "developer",
  "context_size_tokens": 50000
}
{
  "event": "injection_complete",
  "duration_ms": 45,
  "memory_count": 12,
  "cache_hit_rate": 0.75
}
{
  "event": "injection_error",
  "error_type": "db_timeout",
  "error_message": "Database query timeout after 5000ms",
  "retry_count": 3
}
```

#### Capture Events
```json
{
  "event": "capture_complete",
  "source": "tool_output",
  "content_size_bytes": 1024,
  "importance_score": 0.85
}
```

#### Cleanup Events
```json
{
  "event": "cleanup_complete",
  "cleanup_type": "session",
  "deleted_entries": 450,
  "duration_ms": 2345
}
```

### 4.4 Log Queries

**Find high-latency injections**:
```
level:INFO AND event:injection_complete AND duration_ms:>500
```

**Find database errors**:
```
level:ERROR AND component:memory.db
```

**Find cache misses**:
```
event:injection_complete AND cache_hit:false
```

**Find cross-agent sharing failures**:
```
level:ERROR AND component:memory.cross_agent
```

---

## 5. Performance Degradation Indicators

### 5.1 Early Warning Signs

**Latency Creep** (WARNING):
- Injection latency p95 increases >10% over 24 hours
- **Action**: Investigate database query performance, cache hit rate

**Cache Degradation** (WARNING):
- Cache hit rate drops below 60% for >1 hour
- **Action**: Check cache size, eviction policy, memory pressure

**Error Rate Increase** (WARNING):
- Any error rate increases >50% over baseline
- **Action**: Check logs for error patterns, validate service health

**Heap Growth** (WARNING):
- Heap usage increases >50MB over 24 hours
- **Action**: Check for memory leaks, validate cleanup service

### 5.2 Critical Degradation Indicators

**Latency Spike** (CRITICAL):
- Injection latency p95 >500ms for 5+ minutes
- **Action**: Execute runbook, consider feature flag rollback

**Database Failure** (CRITICAL):
- Database error rate >5 errors/min for 3+ minutes
- **Action**: Check database locks, connection pool, restart if needed

**Heap Exhaustion** (CRITICAL):
- Heap usage >500MB
- **Action**: Immediate restart, investigate memory leak, enable worker pattern

**RAG Service Down** (CRITICAL):
- RAG error rate >10 errors/min for 5+ minutes
- **Action**: Check embedding service, restart RAG service, fallback to non-RAG search

---

## 6. Health Check Endpoints

### 6.1 Liveness Probe

**Endpoint**: `GET /health/live`
**Purpose**: Check if service is running
**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-13T12:34:56.789Z"
}
```
**Failure Criteria**: HTTP 5xx or timeout >1s

### 6.2 Readiness Probe

**Endpoint**: `GET /health/ready`
**Purpose**: Check if service can handle traffic
**Response**:
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "rag_service": "ok",
    "cache": "ok",
    "heap_usage": "ok"
  },
  "timestamp": "2026-01-13T12:34:56.789Z"
}
```
**Failure Criteria**: Any check fails or timeout >5s

### 6.3 Deep Health Check

**Endpoint**: `GET /health/deep`
**Purpose**: Comprehensive health check for debugging
**Response**:
```json
{
  "status": "healthy",
  "metrics": {
    "injection_latency_p95_ms": 45,
    "db_query_duration_p95_ms": 8,
    "rag_search_duration_p95_ms": 320,
    "heap_used_mb": 42,
    "cache_hit_rate": 0.78,
    "error_rate_per_min": 0
  },
  "feature_flags": {
    "USE_ENHANCED_INJECTION": true,
    "USE_CROSS_AGENT_SHARING": false
  },
  "database": {
    "file_size_mb": 85,
    "entry_count": 12450,
    "last_cleanup": "2026-01-13T06:00:00.000Z"
  },
  "rag": {
    "index_size_entries": 8234,
    "last_index_rebuild": "2026-01-13T00:00:00.000Z"
  },
  "timestamp": "2026-01-13T12:34:56.789Z"
}
```
**Failure Criteria**: Any metric exceeds critical threshold

---

## 7. Incident Response Runbooks

### 7.1 High Injection Latency

**Alert**: `memory_injection_latency_high`
**Severity**: CRITICAL
**Threshold**: p95 >500ms for 5 minutes

**Diagnosis Steps**:
1. Check dashboard: Is database query duration also high?
2. Check cache hit rate: Is it below 70%?
3. Check heap usage: Is it above 100MB?
4. Check logs for database timeout errors

**Mitigation**:
- **If database slow**: Restart database, rebuild indexes
- **If cache hit rate low**: Increase cache size, adjust TTL
- **If heap high**: Restart supervisor, enable worker pattern
- **If all else fails**: Disable USE_ENHANCED_INJECTION flag

**Escalation**: If latency doesn't improve in 15 minutes → L2

---

### 7.2 Database Query Slow

**Alert**: `database_query_slow`
**Severity**: WARNING
**Threshold**: p95 >50ms for 5 minutes

**Diagnosis Steps**:
1. Check database size: Is it >500MB?
2. Check query logs: Are there full table scans?
3. Check cleanup service: Is it running?
4. Check database locks: Are there long-running transactions?

**Mitigation**:
- **If database large**: Run manual cleanup, archive old data
- **If missing indexes**: Rebuild indexes, optimize queries
- **If cleanup failing**: Restart cleanup service, run manual cleanup
- **If locks**: Kill long-running transactions

**Escalation**: If query duration doesn't improve in 30 minutes → L2

---

### 7.3 Heap Usage Critical

**Alert**: `heap_usage_critical`
**Severity**: CRITICAL
**Threshold**: Heap >500MB

**Diagnosis Steps**:
1. Check memory leak: Is heap growing continuously?
2. Check cleanup service: Is it running?
3. Check capture rate: Is it abnormally high?
4. Check for runaway processes

**Mitigation**:
- **If memory leak**: Restart supervisor immediately
- **If cleanup failing**: Run manual cleanup
- **If high capture rate**: Investigate capture source, add rate limiting
- **If runaway process**: Kill process, investigate root cause

**Escalation**: If heap >1GB → Immediate L2 + Manager notification

---

### 7.4 Cleanup Service Failure

**Alert**: `cleanup_service_failure`
**Severity**: CRITICAL
**Threshold**: Success rate <90% for 1 hour

**Diagnosis Steps**:
1. Check cleanup logs: What errors are occurring?
2. Check database: Are there locks blocking cleanup?
3. Check cron schedule: Is cleanup running?
4. Check disk space: Is disk full?

**Mitigation**:
- **If errors**: Fix error (lock timeout, permission, etc.)
- **If not running**: Restart cron service, verify schedule
- **If disk full**: Free disk space, increase disk size
- **If all else fails**: Run manual cleanup, investigate root cause

**Escalation**: If cleanup doesn't resume in 30 minutes → L2

---

## 8. Metrics Collection Infrastructure

### 8.1 Recommended Tools

**Time-Series Database**: Prometheus (recommended) or InfluxDB
**Visualization**: Grafana (recommended) or Kibana
**Log Aggregation**: Elasticsearch + Kibana (ELK) or Loki
**Alerting**: PagerDuty + Slack integration

### 8.2 Metrics Retention Policy

| Metric Type | Retention | Aggregation |
|-------------|-----------|-------------|
| Real-time (1min) | 7 days | Raw data |
| Medium-term (5min) | 30 days | Downsampled |
| Long-term (1hour) | 1 year | Downsampled |

### 8.3 Metrics Export Format

**Prometheus Format** (recommended):
```
# HELP memory_injection_latency_ms Memory injection latency in milliseconds
# TYPE memory_injection_latency_ms histogram
memory_injection_latency_ms_bucket{agent_type="developer",le="50"} 120
memory_injection_latency_ms_bucket{agent_type="developer",le="200"} 180
memory_injection_latency_ms_bucket{agent_type="developer",le="500"} 195
memory_injection_latency_ms_bucket{agent_type="developer",le="+Inf"} 200
memory_injection_latency_ms_sum{agent_type="developer"} 8450
memory_injection_latency_ms_count{agent_type="developer"} 200
```

---

## 9. Capacity Planning

### 9.1 Growth Projections

**Baseline Assumptions** (from Phase 2 testing):
- Average memory entry size: ~1KB
- Average session duration: 30 minutes
- Average agent spawns per session: 5
- Average memories per agent: 20

**Projected Growth**:
```
Daily memory entries = Sessions/day × Agents/session × Memories/agent
Daily memory entries = 1000 × 5 × 20 = 100,000 entries

Daily database growth = 100,000 × 1KB = 100MB
Monthly database growth = 100MB × 30 = 3GB

With 24h retention: Max database size = 100MB (sustainable)
With 7d retention: Max database size = 700MB (requires cleanup tuning)
```

### 9.2 Scaling Thresholds

**Vertical Scaling** (increase resources):
- Database size >500MB sustained → Increase disk IOPS
- Heap usage >500MB sustained → Increase max-old-space-size
- RAG index >50k entries → Increase embedding service capacity

**Horizontal Scaling** (add instances):
- Injection rate >500/sec → Add read replicas (Phase 5+ feature)
- Capture rate >1000/sec → Shard database by session ID (Phase 6+ feature)

---

## 10. Testing and Validation

### 10.1 Monitoring Validation Checklist

Before production deployment:

- [ ] All metrics emitting correctly in staging
- [ ] All alerts firing correctly in staging (test with synthetic failures)
- [ ] All dashboards rendering correctly
- [ ] Log aggregation working (test log queries)
- [ ] Health check endpoints responding
- [ ] PagerDuty integration tested
- [ ] Slack integration tested
- [ ] Runbooks accessible and accurate

### 10.2 Synthetic Monitoring

**Periodic Health Checks** (every 1 minute):
- Liveness probe
- Readiness probe
- Deep health check (every 5 minutes)

**Periodic Functionality Tests** (every 5 minutes):
- Inject sample memory
- Capture sample memory
- RAG search for sample query
- Validate cleanup ran in last hour

---

## Appendix A: Metric Reference Table

| Metric Name | Type | Unit | Target | Warning | Critical |
|-------------|------|------|--------|---------|----------|
| `memory.injection.latency.p95` | Histogram | ms | <200 | 200-500 | >500 |
| `memory.db.query_duration.p95` | Histogram | ms | <10 | 10-50 | >50 |
| `memory.rag.search_duration.p95` | Histogram | ms | <500 | 500-1000 | >1000 |
| `memory.heap.used_mb` | Gauge | MB | <100 | 100-500 | >500 |
| `memory.cache.hit_rate` | Gauge | % | >70 | 50-70 | <50 |
| `memory.injection.errors` | Counter | /min | 0 | 1-5 | >5 |
| `memory.db.errors` | Counter | /min | 0 | 1-3 | >3 |
| `memory.cleanup.success_rate` | Gauge | % | 100 | 90-99 | <90 |

---

**Guide Version**: 1.0.0
**Last Updated**: 2026-01-13
**Next Review**: Before production deployment
**Owner**: DevOps Team
