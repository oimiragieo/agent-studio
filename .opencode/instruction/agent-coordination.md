# Agent Coordination System

## Overview

This document defines how agents collaborate, validate each other's work, resolve conflicts, and maintain quality gates throughout the development workflow.

## Current Problems Addressed

1. **No cross-agent validation** - PM agent doesn't validate Analyst's technical feasibility assessments
2. **Conflicting outputs** - Architect might specify technologies that contradict PM's requirements
3. **No consensus mechanism** - When agents disagree, no resolution process
4. **No quality gates** - Poor output from one agent cascades to others

## Cross-Agent Validation Protocol

```yaml
# Enhanced workflow with validation checkpoints
- step: 2
  name: 'Requirements Documentation'
  agent: pm
  validators:
    - agent: analyst
      validates: ['technical_feasibility', 'market_assumptions']
      threshold: 0.8
    - agent: architect
      validates: ['technical_constraints', 'scalability_requirements']
      threshold: 0.7
  conflict_resolution:
    method: 'consensus_building'
    facilitator: 'analyst'
    max_iterations: 3
```

## Agent Conflict Resolution Matrix

```yaml
conflicts:
  technical_feasibility:
    participants: [pm, architect]
    resolution: 'architect_has_final_authority'
    escalation: 'create_technical_spike'

  user_requirements:
    participants: [analyst, pm, ux_expert]
    resolution: 'majority_vote_with_user_research'
    escalation: 'additional_user_interviews'

  implementation_approach:
    participants: [architect, developer]
    resolution: 'developer_implementation_preference'
    escalation: 'prototype_both_approaches'
```

## Quality Gate System

```yaml
quality_gates:
  analyst_output:
    validators: [pm, architect]
    criteria:
      - testable_requirements: true
      - market_validation: score > 7
      - technical_feasibility: confirmed
    failure_action: 'iterate_with_feedback'

  pm_output:
    validators: [analyst, ux_expert, architect]
    criteria:
      - requirements_traceability: 100%
      - user_story_completeness: score > 8
      - technical_alignment: confirmed
    failure_action: 'requirements_workshop'

  architect_output:
    validators: [developer, security, devops]
    criteria:
      - implementation_feasibility: confirmed
      - security_review: passed
      - scalability_validated: true
    failure_action: 'architecture_review_session'
```

## Collaborative Decision Making

### Architect Collaboration Protocol

When reviewing PM outputs, specifically validate:

1. Technical feasibility of all user stories
2. Performance requirements against user expectations
3. Security implications of specified features
4. Scalability alignment with business projections

If conflicts arise:

1. Document specific technical concerns
2. Propose alternative approaches with trade-offs
3. Request PM clarification on priority conflicts
4. Escalate to consensus building if unresolved

### Developer Collaboration Protocol

When receiving Architect specifications:

1. Validate implementation timeline estimates
2. Identify potential technical blockers early
3. Propose alternative implementations if more efficient
4. Flag any unclear requirements before starting

### QA Collaboration Protocol

Throughout the development cycle:

1. Review specifications for testability
2. Identify edge cases and potential failure modes
3. Ensure acceptance criteria are measurable
4. Validate test coverage against requirements

## Handoff Procedures

### Agent-to-Agent Handoffs

1. **Completion Checklist**: Verify all required outputs are complete
2. **Context Summary**: Provide key decisions and rationale
3. **Open Items**: List any unresolved questions or concerns
4. **Validation Request**: Request explicit acknowledgment from receiving agent

### Handoff Documentation

```yaml
handoff:
  from_agent: analyst
  to_agent: pm
  timestamp: '2025-01-01T10:00:00Z'
  artifacts:
    - project_brief.md
    - market_analysis.md
  key_decisions:
    - 'Target audience: Enterprise developers'
    - 'Primary platform: Web-first, mobile secondary'
  open_questions:
    - 'Budget constraints need clarification'
  validation_status: pending
```

## Escalation Paths

### Technical Escalation

1. Developer → Architect → Technical Lead → User
2. Security concerns → Security Agent → Architect → User

### Product Escalation

1. PM → Analyst → Product Owner → User
2. UX concerns → UX Expert → PM → User

### Process Escalation

1. Any Agent → Orchestrator → User
2. Quality concerns → QA → PM → User
