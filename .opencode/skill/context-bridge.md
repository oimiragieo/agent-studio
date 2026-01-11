---
name: context-bridge
description: Manages context transfer between agents and sessions. Ensures information continuity and proper handoffs throughout the development workflow.
allowed-tools: read, write, glob
---

# Context Bridge

Manages context transfer and information continuity across agent sessions.

## When to Use

- Handing off work between agents
- Resuming after session interruption
- Sharing context across parallel tasks
- Archiving completed work
- Restoring previous context

## Instructions

### Step 1: Capture Current Context

Gather relevant information:

```yaml
context_snapshot:
  timestamp: '2025-01-01T10:00:00Z'
  agent: architect
  workflow: feature-development
  step: 3

  artifacts:
    - type: prd
      path: .opencode/context/artifacts/prd-v1.md
      status: approved
    - type: architecture
      path: .opencode/context/artifacts/architecture-v1.md
      status: in_progress

  decisions:
    - 'Using PostgreSQL for primary database'
    - 'React 18 with Next.js 14 for frontend'
    - 'REST API with OpenAPI specification'

  open_questions:
    - 'Caching strategy pending user input'
    - 'Authentication provider selection'

  next_steps:
    - 'Complete API design'
    - 'Define data models'
```

### Step 2: Create Handoff Document

Structure for receiving agent:

```markdown
# Context Handoff: Architect → Developer

## Summary

Architecture phase complete. Ready for implementation.

## Key Decisions

1. **Database**: PostgreSQL with Prisma ORM
2. **API**: REST with OpenAPI 3.0
3. **Frontend**: Next.js 14 App Router

## Artifacts

- [PRD v1.0](./artifacts/prd-v1.md) - Approved
- [Architecture Doc](./artifacts/architecture-v1.md) - Approved
- [API Spec](./artifacts/api-spec.yaml) - Draft

## Implementation Notes

- Start with user authentication module
- Database schema in ./docs/schema.sql
- API contracts in ./docs/openapi.yaml

## Open Items

- [ ] Caching strategy (blocked on load testing)
- [ ] CDN configuration (deferred to deployment)
```

### Step 3: Transfer Context

Methods for context transfer:

**File-based Transfer**

- Write handoff document to context folder
- Reference in agent instructions
- Load on agent activation

**Inline Transfer**

- Include summary in agent prompt
- Pass key decisions as parameters
- Reference artifacts by path

### Step 4: Validate Transfer

Ensure receiving agent has:

- Access to all referenced artifacts
- Understanding of key decisions
- Clarity on next steps
- Awareness of open items

## Context Types

### Decision Context

Previous decisions that constrain future choices:

- Technology selections
- Architecture patterns
- Design principles
- Rejected alternatives

### Artifact Context

Documents and code produced:

- Requirements documents
- Design specifications
- Implementation code
- Test results

### Session Context

Current working state:

- Active task
- Progress status
- Pending actions
- Blocking issues

## Storage Locations

```
.opencode/context/
├── artifacts/         # Permanent artifacts
│   ├── requirements/
│   ├── architecture/
│   └── specs/
├── sessions/          # Session state
│   └── current.yaml
└── handoffs/          # Handoff documents
    └── YYYY-MM-DD-agent-to-agent.md
```

## Best Practices

1. **Be Explicit**: Don't assume context carries over
2. **Reference, Don't Copy**: Link to artifacts
3. **Summarize Key Points**: Highlight critical decisions
4. **Note Uncertainties**: Flag open questions
5. **Version Context**: Track context changes
