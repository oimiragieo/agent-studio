# Incident Report: {{incident_id}}

## Metadata
- **Incident Title**: {{title}}
- **Severity**: {{severity}} (P0/P1/P2/P3)
- **Status**: {{status}} (resolved/mitigated/ongoing)
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Version**: {{version}}
- **Related Documents**: {{related_docs}}

## Executive Summary
- **Duration**: {{start_time}} - {{end_time}} ({{duration}})
- **User Impact**: {{user_impact}}
- **Root Cause**: {{root_cause_summary}}
- **Resolution**: {{resolution_summary}}

## Impact Metrics
- **Users Affected**: {{users_affected}}
- **Revenue Impact**: {{revenue_impact}}
- **Error Rate**: {{error_rate}}%
- **Response Time Degradation**: {{response_time}}ms
- **Availability**: {{availability}}%
- **Service Degradation**: {{service_degradation}}

## Timeline
| Time (UTC) | Event | Actor | Action Taken | Result |
|------------|-------|-------|-------------|--------|
| {{time}} | {{event}} | {{actor}} | {{action}} | {{result}} |

## Detection
- **How Detected**: {{detection_method}}
- **Detection Time**: {{detection_time}}
- **Time to Detection**: {{ttd}}
- **Detection Gaps**: {{detection_gaps}}
- **Alerting Effectiveness**: {{alerting_effectiveness}}

## Root Cause Analysis
### Primary Root Cause
{{primary_root_cause}}

### Contributing Factors
{{contributing_factors}}

### Why It Wasn't Prevented
{{prevention_gaps}}

## Mitigation Actions
| Time | Action | Owner | Result | Status |
|------|--------|-------|--------|--------|
| {{time}} | {{action}} | {{owner}} | {{result}} | {{status}} |

## Resolution
- **Resolution Time**: {{resolution_time}}
- **Resolution Method**: {{resolution_method}}
- **Verification**: {{verification}}
- **Post-Resolution Monitoring**: {{post_resolution_monitoring}}

## Action Items
| ID | Action Item | Owner | Due Date | Status | Verification |
|----|-------------|-------|----------|--------|--------------|
| AI-1 | {{action}} | {{owner}} | {{due_date}} | {{status}} | {{verification}} |

## Prevention Measures
### Monitoring Improvements
{{monitoring_improvements}}

### Runbook Updates
{{runbook_updates}}

### Test Coverage
{{test_coverage_improvements}}

### Guardrails
{{guardrails_added}}

## Lessons Learned
- **What Went Well**: {{what_went_well}}
- **What Could Be Improved**: {{improvements}}
- **Process Changes**: {{process_changes}}
- **Team Feedback**: {{team_feedback}}

## Follow-up
- **Next Review Date**: {{review_date}}
- **Stakeholder Communication**: {{communication_plan}}
- **Documentation Updates**: {{documentation_updates}}

## Related Documents
- Architecture: {{architecture_link}}
- Runbooks: {{runbook_links}}
- Monitoring Dashboards: {{dashboard_links}}

---
</template_structure>

<usage_instructions>
**When to Use**: When creating incident reports after system outages or service disruptions.

**Required Sections**: Executive Summary, Impact Metrics, Timeline, Root Cause Analysis, Mitigation Actions, Post-Incident Actions.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Best Practices**: This incident report follows SRE best practices for blameless postmortems.
</usage_instructions>
