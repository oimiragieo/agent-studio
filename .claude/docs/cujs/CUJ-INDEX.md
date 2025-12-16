# Customer User Journey (CUJ) Index

This index maps all 24 Customer User Journeys (CUJs) to agents, skills, workflows, and expected outcomes.

## Overview

CUJs represent complete user workflows from initial request to successful completion. Each CUJ includes:
- User goal and trigger
- Agent workflow sequence
- Skills used
- Expected outputs
- Success criteria

## CUJ Categories

### Category 1: Onboarding & Setup (3 CUJs)
- [CUJ-001: First-Time Installation](#cuj-001-first-time-installation)
- [CUJ-002: Rule Configuration](#cuj-002-rule-configuration)
- [CUJ-003: Cross-Platform Setup](#cuj-003-cross-platform-setup)

### Category 2: Planning & Architecture (5 CUJs)
- [CUJ-004: New Feature Planning](#cuj-004-new-feature-planning)
- [CUJ-005: Greenfield Project Planning](#cuj-005-greenfield-project-planning)
- [CUJ-006: Architecture Review](#cuj-006-architecture-review)
- [CUJ-007: Technical Debt Planning](#cuj-007-technical-debt-planning)
- [CUJ-008: Database Schema Planning](#cuj-008-database-schema-planning)

### Category 3: Development (4 CUJs)
- [CUJ-009: Component Scaffolding](#cuj-009-component-scaffolding)
- [CUJ-010: API Endpoint Development](#cuj-010-api-endpoint-development)
- [CUJ-011: Bug Fix Workflow](#cuj-011-bug-fix-workflow)
- [CUJ-012: Feature Implementation](#cuj-012-feature-implementation)

### Category 4: Quality Assurance (3 CUJs)
- [CUJ-013: Code Review](#cuj-013-code-review)
- [CUJ-014: Rule Compliance Audit](#cuj-014-rule-compliance-audit)
- [CUJ-015: Test Generation](#cuj-015-test-generation)

### Category 5: Documentation (3 CUJs)
- [CUJ-016: API Documentation](#cuj-016-api-documentation)
- [CUJ-017: Module Documentation](#cuj-017-module-documentation)
- [CUJ-018: Architecture Documentation](#cuj-018-architecture-documentation)

### Category 6: Specialized Workflows (4 CUJs)
- [CUJ-019: Performance Optimization](#cuj-019-performance-optimization)
- [CUJ-020: Security Audit](#cuj-020-security-audit)
- [CUJ-021: Mobile Development](#cuj-021-mobile-development)
- [CUJ-022: AI System Development](#cuj-022-ai-system-development)

### Category 7: Maintenance & Operations (2 CUJs)
- [CUJ-023: Dependency Updates](#cuj-023-dependency-updates)
- [CUJ-024: Incident Response](#cuj-024-incident-response)

## Quick Reference

| CUJ | Name | Trigger | Primary Agents | Workflow |
|-----|------|---------|----------------|----------|
| CUJ-001 | First-Time Installation | Copy `.claude/` folder | - | Manual setup |
| CUJ-002 | Rule Configuration | `/select-rules` | - | rule-selector skill |
| CUJ-003 | Cross-Platform Setup | "Sync to Cursor" | - | context-bridge skill |
| CUJ-004 | New Feature Planning | "Plan feature X" | Planner → Analyst → PM → Architect | Standard planning |
| CUJ-005 | Greenfield Project | "Build new platform" | Planner → Analyst → PM → UX → Architect → DB → QA → Dev | greenfield-fullstack |
| CUJ-006 | Architecture Review | "Review architecture" | Planner → Architect | Architecture review |
| CUJ-007 | Technical Debt Planning | "Plan refactoring" | Planner → Refactoring Specialist | Refactoring plan |
| CUJ-008 | Database Schema Planning | "Design database" | Planner → Database Architect | Schema design |
| CUJ-009 | Component Scaffolding | "Scaffold component" | Developer | scaffolder skill |
| CUJ-010 | API Endpoint Development | "Create API endpoint" | Developer | scaffolder + developer |
| CUJ-011 | Bug Fix Workflow | `/quick-ship` | Developer → QA | quick-flow |
| CUJ-012 | Feature Implementation | "Implement feature" | Planner → Developer → QA | Feature workflow |
| CUJ-013 | Code Review | `/review` | Code Reviewer | Code review |
| CUJ-014 | Rule Compliance Audit | `/audit` | - | rule-auditor skill |
| CUJ-015 | Test Generation | "Generate tests" | QA | test-generator skill |
| CUJ-016 | API Documentation | "Document API" | Technical Writer | doc-generator skill |
| CUJ-017 | Module Documentation | "Document module" | Technical Writer | claude-md-generator skill |
| CUJ-018 | Architecture Documentation | "Document architecture" | Architect → Technical Writer | diagram-generator + doc-generator |
| CUJ-019 | Performance Optimization | `/performance` | Performance Engineer → Architect → Developer | performance-flow |
| CUJ-020 | Security Audit | "Audit security" | Security Architect | Security audit |
| CUJ-021 | Mobile Development | `/mobile` | Mobile Developer → UX → Developer | mobile-flow |
| CUJ-022 | AI System Development | `/ai-system` | Model Orchestrator → LLM Architect → API Designer | ai-system-flow |
| CUJ-023 | Dependency Updates | "Update dependencies" | DevOps | dependency-analyzer skill |
| CUJ-024 | Incident Response | `/incident` | Incident Responder → DevOps → Security | incident-flow |

## Detailed CUJ Documentation

Each CUJ has a dedicated documentation file:
- `.claude/docs/cujs/CUJ-001.md` through `.claude/docs/cujs/CUJ-024.md`

See individual CUJ files for:
- Complete workflow steps
- Agent responsibilities
- Skill usage
- Expected outputs
- Success criteria
- Example prompts

## CUJ Validation

All CUJs should be:
- ✅ Testable end-to-end
- ✅ Documented with examples
- ✅ Mapped to workflows
- ✅ Validated with success criteria

## Related Documentation

- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md)
- [Agent Documentation](../../agents/)
- [Skills Documentation](../../skills/)
- [Getting Started Guide](../../../GETTING_STARTED.md)

