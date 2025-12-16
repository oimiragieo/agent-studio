<template_structure>
# Performance Plan: {{feature_name}}

## Metadata
- **Version**: {{version}}
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Status**: {{status}} (draft/review/approved/in_progress)
- **Related Documents**: {{related_docs}}

## Performance Goals
### Service Level Indicators (SLIs)
- **Latency (p50)**: {{latency_p50_target}}ms
- **Latency (p95)**: {{latency_p95_target}}ms
- **Latency (p99)**: {{latency_p99_target}}ms
- **Throughput**: {{throughput_target}} req/s
- **Error Rate**: {{error_rate_target}}%
- **Availability**: {{availability_target}}%

### Service Level Objectives (SLOs)
- **Latency SLO**: {{latency_slo}} ({{slo_percentile}}% of requests)
- **Error Budget**: {{error_budget}}%
- **Availability SLO**: {{availability_slo}}%

## Current State Analysis
### Baseline Metrics
- **Current Latency (p50)**: {{current_latency_p50}}ms
- **Current Latency (p95)**: {{current_latency_p95}}ms
- **Current Latency (p99)**: {{current_latency_p99}}ms
- **Current Throughput**: {{current_throughput}} req/s
- **Current Error Rate**: {{current_error_rate}}%
- **Current Resource Usage**: {{resource_usage}}

### Performance Profiling
- **CPU Bottlenecks**: {{cpu_bottlenecks}}
- **Memory Bottlenecks**: {{memory_bottlenecks}}
- **I/O Bottlenecks**: {{io_bottlenecks}}
- **Network Bottlenecks**: {{network_bottlenecks}}
- **Database Bottlenecks**: {{database_bottlenecks}}

### Symptoms
{{symptoms}}

### Metrics & Traces
{{metrics_and_traces}}

## Bottleneck Analysis
| Rank | Bottleneck | Location | Impact | Evidence | Owner |
|------|------------|----------|--------|----------|-------|
| 1 | {{bottleneck}} | {{location}} | {{impact}} | {{evidence}} | {{owner}} |

## Optimization Experiments
| Experiment | Hypothesis | Expected Gain | Measurement Method | Rollback Plan | Status |
|------------|------------|---------------|---------------------|---------------|--------|
| {{exp_name}} | {{hypothesis}} | {{gain}} | {{measurement}} | {{rollback}} | {{status}} |

## Optimization Changes
### Code Optimizations
{{code_optimizations}}

### Configuration Changes
{{config_changes}}

### Schema/Indexing Changes
{{schema_changes}}

### Caching Strategy
{{caching_strategy}}

### Infrastructure Changes
{{infrastructure_changes}}

## Risk Assessment
- **Correctness Risks**: {{correctness_risks}}
- **Capacity Risks**: {{capacity_risks}}
- **Cost Risks**: {{cost_risks}}
- **Reliability Risks**: {{reliability_risks}}

## Verification Plan
### Benchmarks
{{benchmark_tests}}

### Load Testing
{{load_testing_plan}}

### Monitoring Dashboards
{{monitoring_dashboards}}

### Alerting
{{alerting_rules}}

## Success Criteria
- **Performance Targets Met**: {{performance_targets}}
- **SLO Compliance**: {{slo_compliance}}
- **Cost Efficiency**: {{cost_efficiency}}

## Related Documents
- Architecture: {{architecture_link}}
- Implementation Plan: {{implementation_plan_link}}
- Test Plan: {{test_plan_link}}

---
</template_structure>

<usage_instructions>
**When to Use**: When creating performance optimization plans for features or systems.

**Required Sections**: Performance Goals, Current State Analysis, Bottleneck Analysis, Optimization Strategy, Success Metrics.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Best Practices**: This performance plan follows SRE best practices for performance optimization.
</usage_instructions>
