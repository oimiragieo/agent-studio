# Performance Plan: {{system_name}}

## Overview

{{overview}}

## Current State

### Performance Metrics

| Metric                  | Current                | Target                | Gap                |
| ----------------------- | ---------------------- | --------------------- | ------------------ |
| Page Load Time          | {{current_load}}       | < 2s                  | {{load_gap}}       |
| Time to Interactive     | {{current_tti}}        | < 3s                  | {{tti_gap}}        |
| API Response Time (p95) | {{current_api}}        | < 200ms               | {{api_gap}}        |
| Throughput              | {{current_throughput}} | {{target_throughput}} | {{throughput_gap}} |

### Bottleneck Analysis

{{bottleneck_analysis}}

## Performance Goals

1. {{goal_1}}
2. {{goal_2}}
3. {{goal_3}}

## Optimization Strategy

### Frontend Optimizations

#### Bundle Size

- Current: {{current_bundle}}
- Target: {{target_bundle}}
- Actions:
  - [ ] Code splitting
  - [ ] Tree shaking
  - [ ] Lazy loading
  - [ ] Remove unused dependencies

#### Rendering Performance

{{rendering_optimizations}}

#### Caching Strategy

{{frontend_caching}}

### Backend Optimizations

#### Database

- [ ] Query optimization
- [ ] Index improvements
- [ ] Connection pooling
- [ ] Read replicas

#### API

- [ ] Response compression
- [ ] Pagination
- [ ] Field selection
- [ ] Batch endpoints

#### Caching

| Cache Layer | TTL           | Invalidation           |
| ----------- | ------------- | ---------------------- |
| CDN         | {{cdn_ttl}}   | {{cdn_invalidation}}   |
| Redis       | {{redis_ttl}} | {{redis_invalidation}} |
| Application | {{app_ttl}}   | {{app_invalidation}}   |

### Infrastructure

#### Scaling

{{scaling_strategy}}

#### CDN Configuration

{{cdn_configuration}}

#### Load Balancing

{{load_balancing}}

## Implementation Plan

### Phase 1: Quick Wins

| Optimization | Impact       | Effort | Owner       |
| ------------ | ------------ | ------ | ----------- |
| {{quick_1}}  | {{impact_1}} | Low    | {{owner_1}} |
| {{quick_2}}  | {{impact_2}} | Low    | {{owner_2}} |

### Phase 2: Medium-Term

| Optimization | Impact       | Effort | Owner       |
| ------------ | ------------ | ------ | ----------- |
| {{medium_1}} | {{impact_3}} | Medium | {{owner_3}} |
| {{medium_2}} | {{impact_4}} | Medium | {{owner_4}} |

### Phase 3: Long-Term

| Optimization | Impact       | Effort | Owner       |
| ------------ | ------------ | ------ | ----------- |
| {{long_1}}   | {{impact_5}} | High   | {{owner_5}} |
| {{long_2}}   | {{impact_6}} | High   | {{owner_6}} |

## Benchmarking

### Load Testing

{{load_testing_plan}}

### Stress Testing

{{stress_testing_plan}}

### Monitoring

| Metric        | Tool       | Alert Threshold   |
| ------------- | ---------- | ----------------- |
| Response Time | {{tool_1}} | > {{threshold_1}} |
| Error Rate    | {{tool_2}} | > {{threshold_2}} |
| CPU Usage     | {{tool_3}} | > {{threshold_3}} |
| Memory Usage  | {{tool_4}} | > {{threshold_4}} |

## Success Criteria

- [ ] Page load time < {{target_load}}
- [ ] API p95 < {{target_api}}
- [ ] Throughput > {{target_throughput}}
- [ ] Error rate < {{target_error_rate}}
- [ ] Cost within budget

## Risk Assessment

| Risk       | Probability | Impact       | Mitigation       |
| ---------- | ----------- | ------------ | ---------------- |
| {{risk_1}} | {{prob_1}}  | {{impact_1}} | {{mitigation_1}} |
| {{risk_2}} | {{prob_2}}  | {{impact_2}} | {{mitigation_2}} |

---

_Performance plan created on {{date}}._
