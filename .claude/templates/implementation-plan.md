<template_structure>

# Implementation Plan: {{feature_name}}

## Metadata

- **Version**: {{version}}
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}
- **Author**: {{author}}
- **Status**: {{status}} (draft/review/approved/in_progress)
- **Related Documents**: {{related_docs}}

## Overview

{{overview}}

## Implementation Scope

{{implementation_scope}}

## Architecture Decisions

{{architecture_decisions}}

## File Structure

{{file_structure}}

## Dependencies

{{dependencies}}

## Implementation Steps

{{implementation_steps}}

### Step 1: {{step_1_name}}

- **Dependencies**: {{dependencies}}
- **Estimated Time**: {{time_estimate}}
- **Risks**: {{risks}}
- **Rollback Plan**: {{rollback_plan}}
- **Code Review Checkpoint**: {{review_checkpoint}}
- **Performance Benchmarks**: {{benchmarks}}
  {{step_1_details}}

### Step 2: {{step_2_name}}

- **Dependencies**: {{dependencies}}
- **Estimated Time**: {{time_estimate}}
- **Risks**: {{risks}}
- **Rollback Plan**: {{rollback_plan}}
- **Code Review Checkpoint**: {{review_checkpoint}}
- **Performance Benchmarks**: {{benchmarks}}
  {{step_2_details}}

### Step 3: {{step_3_name}}

- **Dependencies**: {{dependencies}}
- **Estimated Time**: {{time_estimate}}
- **Risks**: {{risks}}
- **Rollback Plan**: {{rollback_plan}}
- **Code Review Checkpoint**: {{review_checkpoint}}
- **Performance Benchmarks**: {{benchmarks}}
  {{step_3_details}}

## Testing Strategy

{{testing_strategy}}

## Local Development Setup (Emulator-First)

**CRITICAL: For cloud-connected applications, use emulators for local development.**

### Emulator Configuration

**Environment Variables** (for local development):

```bash
# GCP Emulators
export PUBSUB_EMULATOR_HOST=localhost:8085
export DATASTORE_EMULATOR_HOST=localhost:8081
export STORAGE_EMULATOR_HOST=http://localhost:9023

# Database (Testcontainers or local)
export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Disable real cloud credentials for local dev
unset GOOGLE_APPLICATION_CREDENTIALS
```

### Connection String Examples

**Emulator vs Production**:

- **Emulator**: `pubsub://localhost:8085` or use `PUBSUB_EMULATOR_HOST` env var
- **Production**: Use Application Default Credentials (ADC) or service account key

**Code Pattern**:

```typescript
// Automatically uses emulator if PUBSUB_EMULATOR_HOST is set
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID || 'test-project',
});
```

### Docker Compose Setup

Include `docker-compose.dev.yml` for local emulator stack:

```yaml
version: '3.8'
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/cloud-sdk:emulators
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
    ports:
      - '8085:8085'

  datastore-emulator:
    image: gcr.io/google.com/cloudsdktool/cloud-sdk:emulators
    command: gcloud beta emulators datastore start --host-port=0.0.0.0:8081
    ports:
      - '8081:8081'

  postgres-dev:
    image: postgres:15
    environment:
      POSTGRES_DB: devdb
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpass
    ports:
      - '5432:5432'
```

**Start emulators**: `docker-compose -f docker-compose.dev.yml up -d`

### Testing Strategy with Emulators

1. **Unit Tests**: Use emulators for all cloud service mocks
2. **Integration Tests**: Run against emulators, not live cloud
3. **Local Development**: Always use emulators to avoid costs and credentials
4. **Production Deployment**: Only use real cloud services in deployed environments

### Benefits

- **No Cloud Costs**: Develop and test without incurring cloud charges
- **Faster Feedback**: Local emulators are faster than cloud API calls
- **Offline Development**: Work without internet connectivity
- **Consistent Environment**: Same emulator behavior across all developers

## Deployment Plan

{{deployment_plan}}

## Dependency Graph

{{dependency_graph_mermaid}}

## Risk Matrix

| Step | Risk     | Impact     | Probability | Mitigation     |
| ---- | -------- | ---------- | ----------- | -------------- |
| 1    | {{risk}} | {{impact}} | {{prob}}    | {{mitigation}} |

## Rollback Strategy

{{rollback_strategy}}

## Version History

| Version | Date     | Author     | Changes         |
| ------- | -------- | ---------- | --------------- |
| 1.0     | {{date}} | {{author}} | Initial version |

## Related Documents

- Architecture: {{architecture_link}}
- PRD: {{prd_link}}
- Test Plan: {{test_plan_link}}

---

</template_structure>

<usage_instructions>
**When to Use**: When creating implementation plans for new features or system changes.

**Required Sections**: Overview, Implementation Scope, Architecture Decisions, Implementation Steps, Testing Strategy, Deployment Plan.

**Template Variables**: All `{{variable}}` placeholders should be replaced with actual values when using this template.

**Related Templates**: This implementation plan follows project constitution standards from `.claude/templates/project-constitution.md`.
</usage_instructions>
