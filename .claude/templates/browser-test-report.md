<template_structure>
# Browser Test Report: {{report_id}}

## Metadata
- **Tester**: {{tester_agent}}
- **Date**: {{report_date}}
- **Target URL**: {{target_url}}
- **Browser**: {{browser_info.browser}} {{browser_info.version}}
- **Session Duration**: {{session_duration.total_seconds}} seconds
- **Testing Method**: {{testing_method}} ({{automation_tool}})
- **Status**: {{status}} (draft/complete/reviewed)

## Executive Summary
- **Features Tested**: {{summary.total_features_tested}} ({{summary.features_passed}} passed, {{summary.features_failed}} failed, {{summary.features_warning}} warnings)
- **Bugs Found**: {{summary.bugs_found_count}} ({{summary.critical_bugs}} critical, {{summary.high_priority_bugs}} high priority)
- **Performance Issues**: {{summary.performance_issues_count}}
- **Documentation Discrepancies**: {{summary.documentation_discrepancies_count}}
- **Optimization Opportunities**: {{summary.optimization_opportunities_count}}
- **Test Duration**: {{summary.test_duration_minutes}} minutes

## Browser Session Details
- **Session ID**: {{browser_session.session_id}}
- **Pages Tested**: {{browser_session.pages_tested.length}}
- **Screenshots Captured**: {{browser_session.screenshots_count}}
- **DevTools Enabled**: Network Monitoring: {{devtools_enabled.network_monitoring}}, Console Logging: {{devtools_enabled.console_logging}}, Performance Profiling: {{devtools_enabled.performance_profiling}}

### Initial Page Load
- **Load Time**: {{initial_load.load_time_ms}}ms
- **Time to First Byte**: {{initial_load.time_to_first_byte_ms}}ms
- **Resources Loaded**: {{initial_load.resources_count}} ({{initial_load.resources_total_size_bytes}} bytes)
- **Network Requests**: {{initial_load.network_requests}} ({{initial_load.failed_requests}} failed)

## UI Feature Testing Results

### Test Summary
- **Total Features**: {{test_summary.total_features}}
- **Passed**: {{test_summary.passed}} ({{test_summary.pass_rate}}%)
- **Failed**: {{test_summary.failed}}
- **Warnings**: {{test_summary.warnings}}
- **Coverage**: {{coverage.coverage_percentage}}% of documented features tested

### Features by Category

#### Navigation Features
| Feature | Status | Location | Issues |
|---------|--------|----------|--------|
| {{feature_name}} | {{status}} | {{location}} | {{issues_found}} |

#### Form Features
| Feature | Status | Location | Issues |
|---------|--------|----------|--------|
| {{feature_name}} | {{status}} | {{location}} | {{issues_found}} |

#### Interactive Elements
| Feature | Status | Location | Issues |
|---------|--------|----------|--------|
| {{feature_name}} | {{status}} | {{location}} | {{issues_found}} |

#### Data Display Features
| Feature | Status | Location | Issues |
|---------|--------|----------|--------|
| {{feature_name}} | {{status}} | {{location}} | {{issues_found}} |

### Detailed Feature Test Results
{{#features_tested}}
#### {{feature_name}} ({{feature_type}})
- **Location**: {{location}}
- **Status**: {{status}}
- **Expected Behavior**: {{expected_behavior}}
- **Actual Behavior**: {{actual_behavior}}
- **Test Steps**:
  {{#test_steps}}
  1. {{action}}: {{description}} → {{result}}
  {{/test_steps}}
- **Timing**: Interaction: {{timing.interaction_time_ms}}ms, Response: {{timing.response_time_ms}}ms, Render: {{timing.render_time_ms}}ms
- **Console Errors**: {{console_errors.length}}
- **Screenshots**: {{screenshots.length}} captured
{{/features_tested}}

## Log Analysis Summary

### Console Logs
- **Total Entries**: {{console_logs.total_count}}
- **Errors**: {{console_logs.errors.length}} ({{critical_errors}} critical)
- **Warnings**: {{console_logs.warnings.length}}

#### Critical Console Errors
| Message | Source | Line | Severity | Category |
|---------|--------|------|----------|----------|
| {{message}} | {{source}} | {{line}} | {{severity}} | {{category}} |

### Network Logs
- **Total Requests**: {{network_logs.total_requests}}
- **Failed Requests**: {{network_logs.failed_requests.length}}
- **Slow Requests**: {{network_logs.slow_requests.length}} (>1000ms)
- **CORS Errors**: {{network_logs.cors_errors.length}}

#### Failed Network Requests
| URL | Method | Status | Error Type | Duration |
|-----|--------|-------|------------|----------|
| {{url}} | {{method}} | {{status}} | {{error_type}} | {{duration_ms}}ms |

#### Slow Network Requests
| URL | Method | Duration | Threshold Exceeded |
|-----|--------|---------|-------------------|
| {{url}} | {{method}} | {{duration}}ms | +{{threshold_exceeded}}ms |

### Performance Logs
- **Long Tasks**: {{performance_logs.long_tasks.length}}
- **Layout Shifts**: {{performance_logs.layout_shifts.length}}
- **Memory Usage**: Peak: {{performance_logs.memory_usage.peak_memory_mb}}MB, Average: {{performance_logs.memory_usage.average_memory_mb}}MB
- **Memory Leaks Suspected**: {{performance_logs.memory_usage.memory_leaks_suspected}}

## Performance Metrics

### Core Web Vitals
- **LCP (Largest Contentful Paint)**: {{core_web_vitals.lcp.value_ms}}ms - **{{core_web_vitals.lcp.score}}** (Target: <2500ms)
- **FID (First Input Delay)**: {{core_web_vitals.fid.value_ms}}ms - **{{core_web_vitals.fid.score}}** (Target: <100ms)
- **CLS (Cumulative Layout Shift)**: {{core_web_vitals.cls.value}} - **{{core_web_vitals.cls.score}}** (Target: <0.1)
- **FCP (First Contentful Paint)**: {{core_web_vitals.fcp.value_ms}}ms - **{{core_web_vitals.fcp.score}}** (Target: <1800ms)
- **TTI (Time to Interactive)**: {{core_web_vitals.tti.value_ms}}ms - **{{core_web_vitals.tti.score}}** (Target: <3800ms)

### Response Times
- **Page Load**: {{response_times.page_load.total_ms}}ms
- **Time to First Byte (TTFB)**: {{response_times.ttfb}}ms
- **Average API Response**: {{response_times.api_average}}ms
- **Slowest API**: {{response_times.api_slowest.url}} ({{response_times.api_slowest.duration_ms}}ms)
- **Component Render Average**: {{response_times.component_render.average_ms}}ms
- **Slowest Component**: {{response_times.component_render.slowest_component}} ({{response_times.component_render.slowest_render_time_ms}}ms)

### Resource Analysis
- **Total JavaScript**: {{resource_analysis.bundle_sizes.total_js_kb}}KB
- **Total CSS**: {{resource_analysis.bundle_sizes.total_css_kb}}KB
- **Largest JS Bundle**: {{resource_analysis.bundle_sizes.largest_js_bundle.name}} ({{resource_analysis.bundle_sizes.largest_js_bundle.size_kb}}KB)
- **Total Images**: {{resource_analysis.image_sizes.total_size_mb}}MB ({{resource_analysis.image_sizes.image_count}} images)
- **Unused CSS**: {{resource_analysis.unused_css_js.unused_css_kb}}KB
- **Unused JavaScript**: {{resource_analysis.unused_css_js.unused_js_kb}}KB
- **Cache Hit Rate**: {{resource_analysis.cache_efficiency.cache_hit_rate}}%

## Bugs Found

### Critical Bugs (P0)
| Bug ID | Title | Location | Severity | Effort |
|--------|-------|----------|----------|--------|
| {{bug_id}} | {{title}} | {{location}} | {{severity}} | {{estimated_effort}} |

### High Priority Bugs (P1)
| Bug ID | Title | Location | Severity | Effort |
|--------|-------|----------|----------|--------|
| {{bug_id}} | {{title}} | {{location}} | {{severity}} | {{estimated_effort}} |

### Medium Priority Bugs (P2)
| Bug ID | Title | Location | Severity | Effort |
|--------|-------|----------|----------|--------|
| {{bug_id}} | {{title}} | {{location}} | {{severity}} | {{estimated_effort}} |

### Bug Details
{{#bugs_found}}
#### {{bug_id}}: {{title}}
- **Severity**: {{severity}}
- **Priority**: {{priority}}
- **Location**: {{location}}
- **Feature Affected**: {{feature_affected}}
- **Description**: {{description}}
- **Steps to Reproduce**:
  {{#steps_to_reproduce}}
  1. {{.}}
  {{/steps_to_reproduce}}
- **Expected Behavior**: {{expected_behavior}}
- **Actual Behavior**: {{actual_behavior}}
- **Screenshots**: {{screenshots.length}} captured
- **Console Errors**: {{console_errors.length}}
- **Estimated Effort**: {{estimated_effort}}
{{/bugs_found}}

## Documentation Comparison Results

### Summary
- **Total Features Compared**: {{summary.total_features_compared}}
- **Discrepancies Found**: {{summary.discrepancies_count}}
- **Undocumented Features**: {{summary.undocumented_features_count}}
- **Missing Features**: {{summary.missing_features_count}}
- **Documentation Accuracy Score**: {{documentation_accuracy_score.score}}/100

### Discrepancies
{{#discrepancies}}
#### {{feature_name}} ({{discrepancy_type}})
- **Severity**: {{severity}}
- **Location**: {{location}}
- **Documented**: {{documented_behavior}}
- **Actual**: {{actual_behavior}}
- **Impact**: {{impact}}
- **Recommendation**: {{recommendation}}
{{/discrepancies}}

### Undocumented Features
{{#undocumented_features}}
- **{{feature_name}}** ({{location}}): {{description}} - Severity: {{severity}}
{{/undocumented_features}}

### Missing Features
{{#missing_features}}
- **{{feature_name}}**: {{description}} - Priority: {{priority}}, Effort: {{estimated_effort}}
{{/missing_features}}

## Optimization Opportunities

### UI/UX Improvements
{{#optimization_opportunities.ui_ux_improvements}}
- **[{{priority}}] {{improvement}}** ({{category}})
  - Impact: {{impact}}
  - Effort: {{estimated_effort}}
{{/optimization_opportunities.ui_ux_improvements}}

### Performance Optimizations
{{#optimization_opportunities.performance_optimizations}}
- **[{{priority}}] {{optimization}}** ({{category}})
  - Expected Improvement: {{estimated_improvement}}
  - Effort: {{estimated_effort}}
{{/optimization_opportunities.performance_optimizations}}

## Recommendations

### Prioritized Action Items
{{#recommendations}}
#### [{{priority}}] {{action}} ({{category}})
- **Rationale**: {{rationale}}
- **Estimated Effort**: {{estimated_effort}}
- **Phase**: {{phase}}
- **Related Bugs**: {{related_bugs}}
{{/recommendations}}

### Implementation Phases
{{#implementation_phases}}
#### Phase {{phase_number}}: {{phase_name}} ({{priority}})
- **Items**: {{items.length}} items
- **Estimated Time**: {{estimated_time}} ({{estimated_effort_hours}} hours)
- **Items**:
  {{#items}}
  - {{.}}
  {{/items}}
{{/implementation_phases}}

## Screenshots & Evidence
- **Total Screenshots**: {{browser_session.screenshots_count}}
- **Screenshot Directory**: `.claude/context/history/screenshots/{{workflow_id}}/`

### Key Screenshots
{{#browser_session.screenshots}}
- **{{screenshot_id}}**: {{description}} ({{timestamp}})
  - Path: {{path}}
  - URL: {{url}}
  - Feature: {{feature_tested}}
{{/browser_session.screenshots}}

## Appendix

### Testing Tools Used
{{#metadata.testing_tools_used}}
- {{.}}
{{/metadata.testing_tools_used}}

### Documentation Sources Referenced
{{#metadata.documentation_sources}}
- {{.}}
{{/metadata.documentation_sources}}

### Notes
{{metadata.notes}}

---

**Report Generated**: {{report_date}}
**Next Steps**: Review recommendations, prioritize fixes, implement optimizations
</template_structure>

