<template_structure>
# Feature Specification: {{feature_name}}

## Metadata
- **Version**: {{version}}
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Status**: {{status}} (draft/review/approved)
- **Related Documents**: {{related_docs}}

## Overview
{{overview}}

## User Story
{{user_story}}

## Acceptance Criteria
{{acceptance_criteria}}

## Technical Specification
{{technical_specification}}

## UI/UX Requirements
{{ui_ux_requirements}}

## API Specification
### Endpoints
| Method | Path | Description | Request Body | Response | Status Codes | Auth Required |
|--------|------|-------------|--------------|----------|--------------|---------------|
| {{method}} | {{path}} | {{description}} | {{request}} | {{response}} | {{status_codes}} | {{auth_required}} |

### Authentication
{{authentication_method}}

### Rate Limiting
- **Rate Limit**: {{rate_limit}}
- **Throttling Strategy**: {{throttling}}
- **Quota Management**: {{quota_management}}

### Error Handling
| Error Code | Description | Resolution |
|------------|-------------|------------|
| {{code}} | {{description}} | {{resolution}} |

### API Versioning
{{api_versioning}}

## Database Changes
{{database_changes}}

## Testing Requirements
{{testing_requirements}}

## Performance Requirements
{{performance_requirements}}

## Data Models
{{data_models_specification}}

### Schema Definitions
{{schema_definitions}}

### Data Validation
{{data_validation}}

## Security Considerations
{{security_considerations}}

## Related Documents
- PRD: {{prd_link}}
- Architecture: {{architecture_link}}
- Implementation Plan: {{implementation_plan_link}}
- Test Plan: {{test_plan_link}}

## Version History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {{date}} | {{author}} | Initial version |

---
</template_structure>

<usage_instructions>
**When to Use**: When creating detailed feature specifications for implementation.

**Required Sections**: Overview, User Story, Acceptance Criteria, Technical Specification, UI/UX Requirements, API Specification.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Agent Integration**: This feature specification provides detailed implementation guidance for the Developer agent.
</usage_instructions>

