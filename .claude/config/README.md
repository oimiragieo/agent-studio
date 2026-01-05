# Agent Integration Configuration

This directory contains configuration files for the comprehensive agent integration system.

## Phase 1: Configuration Files

### plan-review-matrix.json
**Purpose**: Defines which agents review which aspects of plans and under what conditions.

**Contents**:
- **9 Review Domains**: technical_feasibility, security_implications, product_alignment, testability, ux_accessibility, performance_impact, database_design, api_contract, compliance_requirements
- **Reviewer Agents**: Assigns specific agents to each domain (architect, security-architect, pm, qa, etc.)
- **Workflow Mapping**: Defines mandatory vs optional reviews for each workflow
- **Scoring Rules**: 0-10 scale with minimum (7) and blocking (5) thresholds
- **Escalation Rules**: Automatic escalation for blocking reviews, compliance failures, security failures

**Key Features**:
- Weighted scoring across domains (security: 2.0x, compliance: 1.8x, technical: 1.5x)
- Skip conditions for low-impact changes (documentation-only, UI-only, hotfixes)
- Parallel review execution with 24-hour timeout

### signoff-matrix.json
**Purpose**: Defines which agents provide final approval for deliverables.

**Contents**:
- **7 Signoff Types**: quality, security, architecture, product, compliance, accessibility, performance
- **Signoff Agents**: Maps each signoff to specific agent (qa, security-architect, architect, pm, etc.)
- **Required Fields**: Schema-validated fields for each signoff type
- **Passing Conditions**: Specific criteria for approval (test coverage ≥80%, critical bugs = 0, etc.)
- **Workflow Requirements**: Per-workflow mapping of required vs optional signoffs

**Key Features**:
- Parallel signoff execution with 48-hour timeout
- Conditional approval for edge cases (reduced test coverage with PM approval)
- Blocking conditions for critical security/compliance issues
- Max 2 retries with escalation on failure

## Phase 2: Schema Files

Located in `.claude/schemas/`:

### Signoff Schemas
1. **quality-signoff.schema.json** - QA signoff with test results, bug counts, quality metrics
2. **security-signoff.schema.json** - Security signoff with vulnerability assessment, threat model, security controls
3. **architecture-signoff.schema.json** - Architecture signoff with design patterns, scalability, technical debt
4. **product-signoff.schema.json** - Product signoff with requirements, user stories, business value
5. **compliance-signoff.schema.json** - Compliance signoff with GDPR/HIPAA/SOC2/PCI-DSS assessment
6. **accessibility-signoff.schema.json** - Accessibility signoff with WCAG compliance, assistive tech testing
7. **performance-signoff.schema.json** - Performance signoff with SLA compliance, load testing, metrics

### Review Schema
8. **plan-review.schema.json** - Aggregates reviews from multiple domain experts with weighted scoring

## Security Triggers (Enhanced)

### security-triggers-v2.json
Located in `.claude/tools/`:

**Purpose**: Enhanced security trigger detection with 180+ keywords, file patterns, and task types.

**Contents**:
- **8 Keyword Categories**: 184 total keywords
  - authentication (50+ keywords): login, oauth, jwt, mfa, webauthn
  - authorization (30+ keywords): rbac, acl, permissions, roles
  - data_protection (40+ keywords): encryption, pii, gdpr, hipaa
  - injection_prevention (30+ keywords): sql injection, xss, csrf, sanitization
  - secrets_management (25+ keywords): api keys, vault, credentials
  - network_security (25+ keywords): cors, csp, firewall, tls
  - compliance_security (25+ keywords): gdpr, hipaa, soc2, pci-dss
  - vulnerability_management (15+ keywords): cve, exploit, patch
- **10 File Patterns**: Glob patterns for auth files, security configs, env files
- **12 Task Types**: Authentication, authorization, encryption, compliance tasks
- **Detection Rules**: Weighted scoring (threshold: 3.0) with keyword, file, and task matching
- **Trigger Actions**: Security architect review, compliance check, automated scans

**Key Features**:
- Weighted categories (data_protection: 2.0x, secrets_management: 2.0x)
- Exemptions for documentation-only, test-only, UI-only changes
- Fuzzy matching for task types (threshold: 0.8)
- 90%+ context savings vs verbose rules

## Usage

### Plan Review Flow
1. Planner creates plan → Master Orchestrator triggers review
2. Plan Review Matrix determines required reviewers based on workflow type
3. Reviewers execute in parallel (24-hour timeout)
4. Scores aggregated with weighted average
5. If blocking score (<5) or weighted average (<7), escalate to Master Orchestrator
6. Plan revised and re-reviewed until approved

### Signoff Flow
1. Developer completes implementation
2. Signoff Matrix determines required signoffs based on workflow type
3. Signoff agents execute in parallel (48-hour timeout)
4. Each signoff validates against schema
5. If any required signoff fails, escalate to Master Orchestrator
6. Implementation revised and re-signoff until all approved
7. Code Reviewer receives all signoffs for final review

### Security Trigger Detection
1. User request analyzed for keywords, file patterns, task types
2. Weighted scoring applied (keyword: 1.0x, file: 1.2x, task: 1.5x)
3. If score ≥ 3.0, trigger security-architect review
4. If compliance keywords matched, trigger compliance-auditor review
5. If score ≥ 1.5, run automated security scans (SAST, dependency check)
6. Exemptions applied for low-risk changes

## Integration Points

### Master Orchestrator
- Receives escalations from plan reviews and signoffs
- Coordinates revision cycles
- Manages workflow state

### Workflow Runner
- Validates artifacts against schemas
- Creates gate files with validation results
- Enforces retry limits (max 3)

### Agents
- Read matrices to understand review/signoff requirements
- Generate artifacts conforming to schemas
- Escalate blocking issues

## File Locations

```
.claude/
├── config/
│   ├── plan-review-matrix.json      # Plan review configuration
│   ├── signoff-matrix.json          # Signoff configuration
│   └── README.md                    # This file
├── tools/
│   └── security-triggers-v2.json    # Security trigger detection
└── schemas/
    ├── quality-signoff.schema.json
    ├── security-signoff.schema.json
    ├── architecture-signoff.schema.json
    ├── product-signoff.schema.json
    ├── compliance-signoff.schema.json
    ├── accessibility-signoff.schema.json
    ├── performance-signoff.schema.json
    └── plan-review.schema.json
```

## Version

- **Config Version**: 1.0.0
- **Schema Version**: Draft-07
- **Last Updated**: 2026-01-04
