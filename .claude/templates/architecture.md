<template_structure>
# System Architecture: {{system_name}}

## Metadata
- **Version**: {{version}}
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Status**: {{status}} (draft/review/approved)
- **Related Documents**: {{related_docs}}

## Overview
{{overview}}

## Architecture Principles
{{architecture_principles}}

## Architecture Decision Records (ADRs)
{{adrs}}

### ADR-001: {{decision_title}}
- **Status**: {{status}} (proposed/accepted/deprecated/superseded)
- **Context**: {{context}}
- **Decision**: {{decision}}
- **Consequences**: {{consequences}}

## System Design
{{system_design}}

## Technology Stack
{{technology_stack}}

## Component Architecture
{{component_architecture}}

## Database Design
{{database_design}}

## API Design
{{api_design}}

## Security Architecture
{{security_architecture}}

## Performance Considerations
{{performance_considerations}}

## Scalability Plan
{{scalability_plan}}

## Integration Points
{{integration_points}}

## Deployment Architecture
{{deployment_architecture}}

## C4 Model Diagrams
### Context Diagram
{{context_diagram}}

### Container Diagram
{{container_diagram}}

### Component Diagram
{{component_diagram}}

## Data Flow
- **Data Sources**: {{data_sources}}
- **Data Processing**: {{data_processing}}
- **Data Storage**: {{data_storage}}
- **Data Sinks**: {{data_sinks}}
- **Data Flow Diagram**: {{data_flow_diagram}}

## Observability Architecture
- **Logging Strategy**: {{logging_strategy}}
- **Metrics Strategy**: {{metrics_strategy}}
- **Tracing Strategy**: {{tracing_strategy}}
- **Alerting Strategy**: {{alerting_strategy}}
- **Dashboard Strategy**: {{dashboard_strategy}}

## Disaster Recovery
- **Backup Strategy**: {{backup_strategy}}
- **Recovery Time Objective (RTO)**: {{rto}}
- **Recovery Point Objective (RPO)**: {{rpo}}
- **Failover Procedures**: {{failover_procedures}}
- **Disaster Recovery Plan**: {{dr_plan}}

## Diagrams
{{diagrams}}

## Version History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {{date}} | {{author}} | Initial version |

## Related Documents
- Project Brief: {{project_brief_link}}
- PRD: {{prd_link}}
- Implementation Plan: {{implementation_plan_link}}
- Test Plan: {{test_plan_link}}

---
</template_structure>

<usage_instructions>
**When to Use**: When creating system architecture documents for new projects or major system redesigns.

**Required Sections**: Overview, Architecture Principles, System Design, Technology Stack, Component Architecture, Database Design, API Design, Security Architecture.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Related Templates**: This template references project-constitution.md for governance standards.
</usage_instructions>

<notes>
*This architecture document follows technical governance standards from `.claude/templates/project-constitution.md`.*
</notes>

