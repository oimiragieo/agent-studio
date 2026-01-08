# Customer User Journey (CUJ) Index

This index maps all 62 Customer User Journeys (CUJs) to agents, skills, workflows, and expected outcomes.

**Note**: CUJ-031, CUJ-032, CUJ-033 are reserved for future use and not included in active documentation.

## Implementation Status Summary

**All CUJs Implemented**: ✅ 62/62 CUJs defined and documented
- **Workflow-Based CUJs**: 49 (multi-agent workflows)
- **Skill-Only CUJs**: 10 (direct skill invocation without workflow)
- **Manual CUJs**: 3 (require manual setup/execution)

**Execution Modes**:
- ✅ `workflow`: Direct YAML workflow execution (49 CUJs) - Load and execute full multi-step workflows
- ✅ `skill`: Direct skill invocation (10 CUJs) - Invoke single skill without agents or planning
- ✅ `manual`: Manual setup/execution (3 CUJs) - Require user-driven steps

**Performance Comparison**:
- Workflow-based: 2-10 minutes (includes planning and multi-agent coordination)
- Skill-only: 2-60 seconds (direct execution, no planning)

## Overview

CUJs represent complete user workflows from initial request to successful completion. Each CUJ includes:
- User goal and trigger
- Agent workflow sequence
- Skills used
- Expected outputs
- Success criteria

## Platform Compatibility

**Claude-Only CUJs**: Some CUJs require skills that are not yet ported to Cursor:
- **CUJ-027**: Requires `recovery` skill (Cursor: use manual recovery workflow)
- **CUJ-038**: Requires `optional-artifact-handler` skill (Cursor: use manual optional artifact handling)
- **CUJ-047**: Requires `conflict-resolution` skill (Cursor: use manual conflict resolution via AI Council)
- **CUJ-010**: Uses `api-contract-generator` skill (Cursor: use manual OpenAPI/Swagger generation)

**Platform-Specific CUJs**:
- **CUJ-042**: Cursor-specific (Cursor subagent coordination, Plan Mode integration)
- **CUJ-049**: Cursor-specific (Cursor Plan Mode deep integration)

**Cross-Platform CUJs**: All other CUJs work on both Claude and Cursor platforms with equivalent functionality.

## Platform Compatibility Matrix

### Platform Compatibility Legend
- ✅ **Full support** - CUJ works without limitations on this platform
- ❌ **Not supported** - CUJ cannot run on this platform
- ⚠️ **Partial/Limited support** - CUJ works with workarounds or reduced functionality

This matrix shows which platforms support each CUJ:

| CUJ | Name | Claude | Cursor | Factory | Notes |
|-----|------|--------|--------|---------|-------|
| **Onboarding & Setup** |
| CUJ-001 | First-Time Installation | ✅ | ✅ | ❌ | Manual setup required |
| CUJ-002 | Rule Configuration | ✅ | ✅ | ❌ | Universal - rule-selector skill |
| CUJ-003 | Cross-Platform Setup | ✅ | ✅ | ❌ | Universal - context-bridge skill |
| **Planning & Architecture** |
| CUJ-004 | New Feature Planning | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-005 | Greenfield Project Planning | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-006 | Architecture Review | ✅ | ✅ | ❌ | Skill-only - diagram-generator |
| CUJ-007 | Technical Debt Planning | ✅ | ✅ | ❌ | Skill-only - plan-generator |
| CUJ-008 | Database Schema Planning | ✅ | ✅ | ❌ | Skill-only - diagram-generator |
| **Development** |
| CUJ-009 | Component Scaffolding | ✅ | ✅ | ❌ | Skill-only - scaffolder |
| CUJ-010 | API Endpoint Development | ✅ | ❌ | ❌ | Requires api-contract-generator (Claude-only) |
| CUJ-011 | Bug Fix Workflow | ✅ | ✅ | ❌ | Workflow-based - quick-flow |
| CUJ-012 | Feature Implementation | ✅ | ✅ | ❌ | Workflow-based |
| **Quality Assurance** |
| CUJ-013 | Code Review | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-014 | Rule Compliance Audit | ✅ | ✅ | ❌ | Skill-only - rule-auditor |
| CUJ-015 | Test Generation | ✅ | ✅ | ❌ | Skill-only - test-generator |
| CUJ-034 | Browser-Based UI Testing | ✅ | ✅ | ❌ | Workflow-based - browser-testing-flow |
| **Documentation** |
| CUJ-016 | API Documentation | ✅ | ✅ | ❌ | Skill-only - doc-generator |
| CUJ-017 | Module Documentation | ✅ | ✅ | ❌ | Skill-only - claude-md-generator |
| CUJ-018 | Architecture Documentation | ✅ | ✅ | ❌ | Skill-only - diagram-generator |
| **Specialized Workflows** |
| CUJ-019 | Performance Optimization | ✅ | ✅ | ❌ | Workflow-based - performance-flow |
| CUJ-020 | Security Audit | ✅ | ✅ | ❌ | Skill-only - rule-auditor |
| CUJ-021 | Mobile Development | ✅ | ✅ | ❌ | Workflow-based - mobile-flow |
| CUJ-022 | AI System Development | ✅ | ✅ | ❌ | Workflow-based - ai-system-flow |
| **Maintenance & Operations** |
| CUJ-023 | Dependency Updates | ✅ | ✅ | ❌ | Skill-only - dependency-analyzer |
| CUJ-024 | Incident Response | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| **Advanced Workflows** |
| CUJ-025 | Large Requirements Document Processing | ✅ | ✅ | ❌ | Skill-only - summarizer |
| CUJ-026 | Multi-Phase Project Planning | ✅ | ✅ | ❌ | Workflow-based - enterprise-track |
| CUJ-027 | Workflow Recovery After Context Loss | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-028 | Infrastructure-First Development | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-029 | Cloud Integration Workflow | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-030 | Multi-AI Validation Workflow | ✅ | ✅ | ❌ | Skill-only |
| **Testing & Validation** |
| CUJ-035 | Planner-First Workflow Validation | ✅ | ✅ | ❌ | Skill-only - plan-generator |
| CUJ-036 | Validation Failure Recovery | ✅ | ✅ | ❌ | Skill-only |
| CUJ-037 | Multi-Phase Project Execution | ✅ | ✅ | ❌ | Workflow-based - enterprise-track |
| CUJ-038 | Optional Artifact Handling | ✅ | ❌ | ❌ | Requires optional-artifact-handler (Claude-only) |
| CUJ-039 | Cross-Agent Validation | ✅ | ❌ | ❌ | Requires conflict-resolution (Claude-only) |
| CUJ-040 | Stateless Recovery Test | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-041 | Complex Artifact Dependency Chain | ✅ | ✅ | ❌ | Skill-only |
| CUJ-042 | Cursor Subagent Coordination | ❌ | ✅ | ❌ | Cursor-specific |
| CUJ-043 | Workflow Interruption Recovery | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-044 | Agent Fallback Chain | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-045 | Missing Required Artifact Recovery | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-046 | Feature Distillation Edge Cases | ✅ | ✅ | ❌ | Skill-only |
| CUJ-047 | Multi-Agent Conflict Resolution | ✅ | ❌ | ❌ | Requires conflict-resolution (Claude-only) |
| CUJ-048 | Artifact Registry Comprehensive Test | ✅ | ✅ | ❌ | Skill-only |
| CUJ-049 | Cursor Plan Mode Deep Integration | ❌ | ✅ | ❌ | Workflow-based (Cursor-specific) |
| CUJ-050 | End-to-End Workflow Robustness | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-051 | Artifact Publishing Validation | ✅ | ✅ | ❌ | Workflow-based - artifact-publisher |
| CUJ-052 | Artifact Registry Migration Test | ✅ | ✅ | ❌ | Workflow-based |
| CUJ-053 | Publishing Metadata Persistence Test | ✅ | ✅ | ❌ | Workflow-based - artifact-publisher |
| CUJ-054 | Cross-Platform Publishing Sync Test | ✅ | ✅ | ❌ | Workflow-based - artifact-publisher + context-bridge |
| CUJ-055 | Publishing Retry Logic Test | ✅ | ✅ | ❌ | Workflow-based - artifact-publisher |
| CUJ-056 | Workflow Recovery Protocol Test | ✅ | ❌ | ❌ | Requires recovery skill (Claude-only) |
| CUJ-057 | Plan Rating Validation | ✅ | ✅ | ❌ | Workflow-based - response-rater |
| CUJ-058 | Error Recovery and Workflow Resilience | ✅ | ✅ | ❌ | Workflow-based - recovery |
| CUJ-059 | Workflow Performance Optimization | ✅ | ✅ | ❌ | Workflow-based - performance-flow |
| CUJ-060 | Cross-Platform CUJ Testing | ✅ | ✅ | ❌ | Workflow-based - context-bridge |
| CUJ-061 | Artifact Publishing Workflow | ✅ | ✅ | ❌ | Workflow-based - artifact-publisher |
| CUJ-062 | Skill Integration Validation | ✅ | ✅ | ❌ | Workflow-based - skill-manager |
| CUJ-063 | Error Recovery and Checkpoint Restoration | ✅ | ❌ | ❌ | Workflow-based - recovery |

### Platform-Specific Notes

**Claude-Only CUJs** (12 CUJs):
- **CUJ-010**: Requires `api-contract-generator` skill (Cursor: use manual OpenAPI/Swagger generation)
- **CUJ-024**: Requires `recovery` skill (Cursor: use manual incident response workflow)
- **CUJ-027**: Requires `recovery` skill (Cursor: use manual recovery workflow)
- **CUJ-038**: Requires `optional-artifact-handler` skill (Cursor: use manual optional artifact handling)
- **CUJ-039**: Requires `conflict-resolution` skill (Cursor: use manual conflict resolution via AI Council)
- **CUJ-040**: Requires `recovery` skill (Cursor: use manual stateless recovery)
- **CUJ-043**: Requires `recovery` skill (Cursor: use manual checkpoint recovery)
- **CUJ-045**: Requires `recovery` skill (Cursor: use manual artifact recovery)
- **CUJ-047**: Requires `conflict-resolution` skill (Cursor: use manual conflict resolution)
- **CUJ-050**: Requires `recovery` skill (Cursor: use manual end-to-end recovery)
- **CUJ-056**: Requires `recovery` skill (Cursor: use manual recovery protocol)
- **CUJ-063**: Requires `recovery` skill (Cursor: use manual checkpoint restoration)

**Cursor-Only CUJs** (2 CUJs):
- **CUJ-042**: Cursor subagent coordination and Plan Mode integration (Claude: N/A)
- **CUJ-049**: Cursor Plan Mode deep integration (Claude: N/A)

**Universal CUJs** (48 CUJs):
All other CUJs work on both Claude and Cursor platforms with equivalent functionality.

**Factory Droid Compatibility**:
Currently, 0 CUJs have explicit Factory support (`platform_compatibility.factory: true`). However, 50 CUJs may be runnable on Factory Droid with manual adaptation:
- **Skill-only CUJs** (10 total): May work if skills are ported to Factory
- **Manual CUJs** (3 total): Require manual setup regardless of platform
- **Workflow CUJs** (49 total): Require Factory workflow engine support

Factory native support is planned for Phase 2+. Current status: 0/62 CUJs with official Factory support.

### Compatibility Summary

| Platform | Total CUJs Supported | Exclusive CUJs | Universal CUJs | Potentially Runnable |
|----------|---------------------|----------------|----------------|---------------------|
| **Claude** | 60/62 (97%) | 12 Claude-only | 48 universal | N/A |
| **Cursor** | 50/62 (81%) | 2 Cursor-only | 48 universal | N/A |
| **Factory** | 0/62 (0%) | 0 | 0 | 50 (with adaptation) |

**Note**:
- Factory Droid support is planned for future releases. Claude remains the primary platform with the most comprehensive CUJ coverage.
- Factory "potentially runnable" count (42) includes skill-only and manual CUJs that may work with skill porting and manual adaptation.

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

### Category 4: Quality Assurance (4 CUJs)
- [CUJ-013: Code Review](#cuj-013-code-review)
- [CUJ-014: Rule Compliance Audit](#cuj-014-rule-compliance-audit)
- [CUJ-015: Test Generation](#cuj-015-test-generation)
- [CUJ-034: Browser-Based UI Testing](#cuj-034-browser-based-ui-testing)

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

### Category 8: Advanced Workflows (6 CUJs)
- [CUJ-025: Large Requirements Document Processing](#cuj-025-large-requirements-document-processing)
- [CUJ-026: Multi-Phase Project Planning](#cuj-026-multi-phase-project-planning)
- [CUJ-027: Workflow Recovery After Context Loss](#cuj-027-workflow-recovery-after-context-loss)
- [CUJ-028: Infrastructure-First Development](#cuj-028-infrastructure-first-development)
- [CUJ-029: Cloud Integration Workflow](#cuj-029-cloud-integration-workflow)
- [CUJ-030: Multi-AI Validation Workflow](#cuj-030-multi-ai-validation-workflow)

### Category 9: Testing & Validation (24 CUJs)
- [CUJ-035: Planner-First Workflow Validation](#cuj-035-planner-first-workflow-validation)
- [CUJ-036: Validation Failure Recovery](#cuj-036-validation-failure-recovery)
- [CUJ-037: Multi-Phase Project Execution](#cuj-037-multi-phase-project-execution)
- [CUJ-038: Optional Artifact Handling](#cuj-038-optional-artifact-handling)
- [CUJ-039: Cross-Agent Validation](#cuj-039-cross-agent-validation)
- [CUJ-040: Stateless Recovery Test](#cuj-040-stateless-recovery-test)
- [CUJ-041: Complex Artifact Dependency Chain](#cuj-041-complex-artifact-dependency-chain)
- [CUJ-042: Cursor Subagent Coordination](#cuj-042-cursor-subagent-coordination)
- [CUJ-043: Workflow Interruption Recovery](#cuj-043-workflow-interruption-recovery)
- [CUJ-044: Agent Fallback Chain](#cuj-044-agent-fallback-chain)
- [CUJ-045: Missing Required Artifact Recovery](#cuj-045-missing-required-artifact-recovery)
- [CUJ-046: Feature Distillation Edge Cases](#cuj-046-feature-distillation-edge-cases)
- [CUJ-047: Multi-Agent Conflict Resolution](#cuj-047-multi-agent-conflict-resolution)
- [CUJ-048: Artifact Registry Comprehensive Test](#cuj-048-artifact-registry-comprehensive-test)
- [CUJ-049: Cursor Plan Mode Deep Integration](#cuj-049-cursor-plan-mode-deep-integration)
- [CUJ-050: End-to-End Workflow Robustness](#cuj-050-end-to-end-workflow-robustness)
- [CUJ-051: Orchestration Enforcement Gate Validation](#cuj-051-orchestration-enforcement-gate-validation)
- [CUJ-052: Artifact Publishing Validation](#cuj-052-artifact-publishing-validation)
- [CUJ-053: Publishing Metadata Persistence Test](#cuj-053-publishing-metadata-persistence-test)
- [CUJ-054: Cross-Platform Publishing Sync Test](#cuj-054-cross-platform-publishing-sync-test)
- [CUJ-055: Publishing Retry Logic Test](#cuj-055-publishing-retry-logic-test)
- [CUJ-056: Workflow Recovery Protocol Test](#cuj-056-workflow-recovery-protocol-test)
- [CUJ-057: Plan Rating Validation](#cuj-057-plan-rating-validation)
- [CUJ-058: Error Recovery and Workflow Resilience](#cuj-058-error-recovery-and-workflow-resilience)
- [CUJ-059: Workflow Performance Optimization](#cuj-059-workflow-performance-optimization)
- [CUJ-060: Cross-Platform CUJ Testing](#cuj-060-cross-platform-cuj-testing)
- [CUJ-061: Artifact Publishing Workflow](#cuj-061-artifact-publishing-workflow)
- [CUJ-062: Skill Integration Validation](#cuj-062-skill-integration-validation)
- [CUJ-063: Error Recovery and Checkpoint Restoration](#cuj-063-error-recovery-and-checkpoint-restoration)

## Quick Reference

| CUJ | Name | Trigger | Primary Agents | Workflow |
|-----|------|---------|----------------|----------|
| CUJ-001 | First-Time Installation | Copy `.claude/` folder | - | Manual setup |
| CUJ-002 | Rule Configuration | `/select-rules` | - | rule-selector skill |
| CUJ-003 | Cross-Platform Setup | "Sync to Cursor" | - | context-bridge skill |
| CUJ-004 | New Feature Planning | "Plan feature X" | Planner -> Analyst -> PM -> Architect | Standard planning |
| CUJ-005 | Greenfield Project | "Build new platform" | Planner -> Analyst -> PM -> UX -> Architect -> DB -> QA -> Dev | greenfield-fullstack |
| CUJ-006 | Architecture Review | "Review architecture" | Planner -> Architect | Architecture review |
| CUJ-007 | Technical Debt Planning | "Plan refactoring" | Planner -> Refactoring Specialist | Refactoring plan |
| CUJ-008 | Database Schema Planning | "Design database" | Planner -> Database Architect | Schema design |
| CUJ-009 | Component Scaffolding | "Scaffold component" | Developer | scaffolder skill |
| CUJ-010 | API Endpoint Development | "Create API endpoint" | Planner -> Developer -> Technical Writer | brownfield-fullstack.yaml |
| CUJ-011 | Bug Fix Workflow | `/quick-ship` | Developer -> QA | quick-flow |
| CUJ-012 | Feature Implementation | "Implement feature" | Planner -> Developer -> QA | Feature workflow |
| CUJ-013 | Code Review | `/review` | Code Reviewer | Code review |
| CUJ-014 | Rule Compliance Audit | `/audit` | - | rule-auditor skill |
| CUJ-015 | Test Generation | "Generate tests" | QA | test-generator skill |
| CUJ-016 | API Documentation | "Document API" | Technical Writer | doc-generator skill |
| CUJ-017 | Module Documentation | "Document module" | Technical Writer | claude-md-generator skill |
| CUJ-018 | Architecture Documentation | "Document architecture" | Architect → Technical Writer | diagram-generator + doc-generator |
| CUJ-019 | Performance Optimization | `/performance` | Performance Engineer → Architect → Developer | performance-flow |
| CUJ-020 | Security Audit | "Audit security" | Security Architect | Security audit |
| CUJ-021 | Mobile Development | `/mobile` | Mobile Developer -> UX -> Developer | mobile-flow |
| CUJ-022 | AI System Development | `/ai-system` | Model Orchestrator -> LLM Architect -> API Designer | ai-system-flow |
| CUJ-023 | Dependency Updates | "Update dependencies" | DevOps | dependency-analyzer skill |
| CUJ-024 | Incident Response | `/incident` | Incident Responder -> DevOps -> Security | incident-flow |
| CUJ-025 | Large Requirements Document Processing | "Plan features from large document" (>15KB) | Analyst → Planner | Feature distillation |
| CUJ-026 | Multi-Phase Project Planning | "Plan large-scale project" (>3000 lines) | Planner → Orchestrator | Hierarchical planning |
| CUJ-027 | Workflow Recovery After Context Loss | Context exhausted/session lost | Orchestrator → Planner | Recovery protocol |
| CUJ-028 | Infrastructure-First Development | "Build cloud-connected application" | Architect → DevOps → Developer → Cloud-Integrator | Infrastructure-first |
| CUJ-029 | Cloud Integration Workflow | "Implement cloud storage integration" | Developer → Cloud-Integrator | Cloud integration |
| CUJ-030 | Multi-AI Validation Workflow | "Validate the implementation" | Model-Orchestrator → Validators | Multi-AI validation |
| CUJ-034 | Browser-Based UI Testing | "Find bugs using Chrome DevTools, test all UI features" | Developer → QA → Performance Engineer | browser-testing-flow |
| CUJ-035 | Planner-First Workflow Validation | "Test planner-first workflow" | Planner → Orchestrator | Planner-first validation |
| CUJ-036 | Validation Failure Recovery | "Test validation failure recovery" | Planner → [Test agents] → QA | Validation retry |
| CUJ-037 | Multi-Phase Project Execution | "Plan large project with phases" | Planner → Orchestrator | Multi-phase execution |
| CUJ-038 | Optional Artifact Handling | "Test optional artifact handling" | Planner → [Agents with optional inputs] | Optional input handling |
| CUJ-039 | Cross-Agent Validation | "Test cross-agent validation" | Planner → Primary Agent → Validators | Cross-agent validation |
| CUJ-040 | Stateless Recovery Test | "Test stateless recovery" | Orchestrator → Planner | Stateless recovery |
| CUJ-041 | Complex Artifact Dependency Chain | "Test complex artifact dependencies" | Planner → Analyst → PM → UX → Architect → Developer | Dependency chain |
| CUJ-042 | Cursor Subagent Coordination | "Test Cursor subagent coordination" | Planner → Orchestrator → [Cursor subagents] | Cursor coordination |
| CUJ-043 | Workflow Interruption Recovery | "Test workflow interruption recovery" | Planner → Orchestrator → Developer | Checkpoint recovery |
| CUJ-044 | Agent Fallback Chain | "Test agent fallback routing" | Planner → Orchestrator → [Primary/Fallback agents] | Fallback routing |
| CUJ-045 | Missing Required Artifact Recovery | "Test missing artifact recovery" | Planner → Orchestrator → [Recreation agents] | Artifact recovery |
| CUJ-046 | Feature Distillation Edge Cases | "Test feature distillation edge cases" | Planner → Analyst → QA | Edge case handling |
| CUJ-047 | Multi-Agent Conflict Resolution | "Test multi-agent conflict resolution" | Planner → Orchestrator → [Conflicting agents] → Resolution agents | Conflict resolution |
| CUJ-048 | Artifact Registry Comprehensive Test | "Test artifact registry robustness" | Planner → Orchestrator → [Test agents] | Registry robustness |
| CUJ-049 | Cursor Plan Mode Deep Integration | "Test Cursor Plan Mode integration" | Planner → Developer (Plan Mode) | Plan Mode integration |
| CUJ-050 | End-to-End Workflow Robustness | "Test end-to-end workflow resilience" | Planner → Orchestrator → [All agents] | End-to-end resilience |
| CUJ-051 | Orchestration Enforcement Gate Validation | "Test orchestration enforcement gates" | Orchestrator → Task Classifier → [All agents] | Enforcement gate validation |
| CUJ-052 | Artifact Publishing Validation | "Test artifact publishing" | Planner → QA | Artifact publishing validation |
| CUJ-053 | Publishing Metadata Persistence Test | "Test publishing persistence" | Planner → QA | Publishing persistence validation |
| CUJ-054 | Cross-Platform Publishing Sync Test | "Test cross-platform sync" | Planner → QA | Cross-platform sync validation |
| CUJ-055 | Publishing Retry Logic Test | "Test publishing retry" | Planner → QA | Retry logic validation |
| CUJ-056 | Workflow Recovery Protocol Test | "Test recovery protocol" | Planner → Orchestrator → QA | Stateless recovery validation |
| CUJ-057 | Plan Rating Validation | "Test plan rating" | Planner → Orchestrator → QA | response-rater validation |
| CUJ-058 | Error Recovery and Workflow Resilience | "Test workflow recovery" | Orchestrator → [All agents with fallbacks] | Recovery and resilience |
| CUJ-059 | Workflow Performance Optimization | "Optimize workflow performance" | Planner → Performance Engineer → Architect → DevOps | Performance optimization |
| CUJ-060 | Cross-Platform CUJ Testing | "Test CUJ across platforms" | Planner → QA → Cursor-Validator → Analyst | Cross-platform validation |
| CUJ-061 | Artifact Publishing Workflow | "Publish artifacts to project feed" | Planner → Developer → QA → Technical Writer | Artifact publishing |
| CUJ-062 | Skill Integration Validation | "Validate skill integration" | Planner → Developer → QA → Performance Engineer | Skill integration testing |
| CUJ-063 | Error Recovery and Checkpoint Restoration | "Test error recovery" | Planner → Orchestrator → [All agents with fallbacks] | Checkpoint recovery |

## Skill-Only CUJ Execution

Skill-only CUJs provide fast, focused task execution without multi-agent workflows. Here are concrete execution examples:

### Example 1: CUJ-002 - Rule Configuration (2-5 seconds)

**Trigger**: `/select-rules`

**What It Does**:
- Scans project for `package.json`, `requirements.txt`, `go.mod`, etc.
- Auto-detects tech stack (React, Python, Go, etc.)
- Loads rule index and selects matching rules
- Updates `manifest.yaml` with active rules

**Execution Flow**:
```
User Input: "/select-rules"
   ↓
Orchestrator detects CUJ-002
   ↓
Looks up: execution_mode=skill, skill=rule-selector
   ↓
Invokes rule-selector skill
   ↓
Skill detects: Next.js, TypeScript, React
   ↓
Skill loads rule-index.json
   ↓
Skill selects 15 relevant rules, excludes 8 irrelevant ones
   ↓
Skill updates manifest.yaml
   ↓
Output: Rule configuration report
```

**Example Output**:
```
✅ Detected technologies: Next.js, React, TypeScript, Node.js
✅ Selected 15 relevant rules
✅ Excluded 8 irrelevant rules (Python, Rust, Go, etc.)
✅ Updated manifest.yaml
✅ Rule hierarchy configured

Active Rules:
- TECH_STACK_NEXTJS.md
- LANG_TYPESCRIPT_GENERAL.md
- TOOL_JEST_MASTER.md
```

---

### Example 2: CUJ-013 - Code Review (10-30 seconds)

**Trigger**: `/review src/components/auth`

**What It Does**:
- Analyzes all files in specified directory
- Checks against active rules
- Identifies issues with severity levels
- Provides specific fix suggestions

**Execution Flow**:
```
User Input: "/review src/components/auth"
   ↓
Orchestrator detects CUJ-013
   ↓
Looks up: execution_mode=skill, skill=code-reviewer
   ↓
Invokes code-reviewer skill
   ↓
Skill reads files: Login.tsx, Logout.tsx, useAuth.ts
   ↓
Skill analyzes against loaded rules
   ↓
Skill identifies: 3 critical, 7 high-priority issues
   ↓
Skill generates review report with fixes
   ↓
Output: Structured code review JSON
```

**Example Output**:
```json
{
  "files_reviewed": 3,
  "issues_found": 10,
  "critical": 3,
  "high_priority": 7,
  "issues": [
    {
      "file": "Login.tsx",
      "line": 45,
      "severity": "critical",
      "issue": "Unencrypted password logging",
      "suggested_fix": "Remove console.log(password)"
    },
    {
      "file": "useAuth.ts",
      "line": 12,
      "severity": "high",
      "issue": "Missing error handling",
      "suggested_fix": "Add try-catch block"
    }
  ]
}
```

---

### Example 3: CUJ-017 - Module Documentation (5-10 seconds)

**Trigger**: `Generate claude.md for src/services/StorageService`

**What It Does**:
- Reads module structure and exports
- Extracts functions, classes, dependencies
- Reads parent `claude.md` for context
- Generates comprehensive `claude.md` file

**Execution Flow**:
```
User Input: "Generate claude.md for src/services/StorageService"
   ↓
Orchestrator detects CUJ-017
   ↓
Looks up: execution_mode=skill, skill=claude-md-generator
   ↓
Invokes claude-md-generator skill
   ↓
Skill reads StorageService directory
   ↓
Skill extracts: 8 exported functions, 2 classes, 5 dependencies
   ↓
Skill reads parent claude.md for patterns
   ↓
Skill generates detailed claude.md
   ↓
Output: Generated claude.md file
```

**Example Output** (generated file):
```markdown
# StorageService

## Purpose
Handles cloud storage operations with encryption and CDN integration.

## Key Functions

### uploadFile(bucket, file)
- Description: Uploads file with automatic encryption
- Returns: Promise<string> (CDN URL)
- Usage: `await service.uploadFile('bucket', file)`

### downloadFile(url)
- Description: Downloads and decrypts file
- Returns: Promise<Buffer>
- Caches for performance

## Dependencies
- @google-cloud/storage
- crypto
- axios

## Patterns
- Dependency injection for cloud client
- Retry logic with exponential backoff
- Automatic caching of accessed files

## Testing
- Unit tests: __tests__/StorageService.test.ts
- Uses mocks for cloud storage
```

---

### Example 4: CUJ-015 - Test Generation (15-30 seconds)

**Trigger**: `Generate tests for src/utils/validation.ts`

**What It Does**:
- Analyzes functions in target file
- Generates comprehensive test cases
- Covers happy paths, edge cases, error cases
- Creates test file with high coverage

**Execution Flow**:
```
User Input: "Generate tests for src/utils/validation.ts"
   ↓
Orchestrator detects CUJ-015
   ↓
Looks up: execution_mode=skill, skill=test-generator
   ↓
Invokes test-generator skill
   ↓
Skill analyzes: validateEmail, validatePhone, validatePassword
   ↓
Skill generates tests for:
  - Valid inputs (happy path)
  - Invalid inputs (error cases)
  - Boundary conditions (edge cases)
  - Security considerations
   ↓
Skill creates test file with setup/teardown
   ↓
Output: Generated test file with 100%+ coverage
```

**Example Output**:
```typescript
// Generated test file
describe('validation', () => {
  describe('validateEmail', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(validateEmail('User@EXAMPLE.COM')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('requires minimum 8 characters', () => {
      expect(validatePassword('short')).toBe(false);
    });

    it('requires uppercase letter', () => {
      expect(validatePassword('lowercase')).toBe(false);
    });
  });
});
```

---

### All Skill-Only CUJs

| CUJ | Skill | Trigger | Speed | Use Case |
|-----|-------|---------|-------|----------|
| CUJ-002 | rule-selector | `/select-rules` | 2-5 sec | Configure rules for tech stack |
| CUJ-003 | context-bridge | "Sync to Cursor" | 5-10 sec | Sync context to Cursor |
| CUJ-009 | scaffolder | `/scaffold ComponentName` | 5-10 sec | Generate component boilerplate |
| CUJ-013 | code-reviewer | `/review src/` | 10-30 sec | Code review with issues |
| CUJ-014 | rule-auditor | `/audit` | 10-30 sec | Compliance check |
| CUJ-015 | test-generator | "Generate tests for X" | 15-30 sec | Generate test files |
| CUJ-016 | doc-generator | "Document API X" | 10-20 sec | Generate API docs |
| CUJ-017 | claude-md-generator | "Generate claude.md for X" | 5-10 sec | Generate module docs |
| CUJ-023 | dependency-analyzer | "Check dependencies" | 5-10 sec | Audit dependencies |
| CUJ-027 | recovery | "Recover workflow" | 10-20 sec | Recover from context loss |
| CUJ-038 | optional-artifact-handler | "Handle optional artifacts" | 5-10 sec | Test optional inputs |
| CUJ-047 | conflict-resolution | "Resolve conflicts" | 10-20 sec | Resolve agent conflicts |

## How to Run CUJs Directly

You can execute CUJs directly by referencing them in your prompts using any of these formats:

### Supported Syntax

- **Slash command**: `/cuj-001`
- **Standalone reference**: `CUJ-001`
- **Natural language**: `run cuj-001`, `execute CUJ-013`, `test cuj-027`

### Examples

```
"Run CUJ-004"                                    → Triggers new feature planning workflow
"/cuj-013"                                       → Triggers code review
"Execute CUJ-022 to build the AI system"        → Triggers AI system development workflow
"Test CUJ-027 for recovery"                     → Triggers recovery skill
"Please run CUJ-002 to configure rules"         → Triggers rule-selector skill
```

### What Happens

1. **CUJ Detection**: Orchestrator detects CUJ reference in your prompt
2. **Mapping Lookup**: Looks up CUJ in the Run CUJ Mapping table below
3. **Execution Mode**: Determines how to execute (workflow, skill, or manual)
4. **Routing**: Routes to the appropriate workflow or skill
5. **Fallback**: If CUJ not found or mapping fails, falls back to semantic routing

### Benefits

- **Fast**: Direct routing without semantic analysis overhead
- **Deterministic**: Pre-validated workflows ensure consistent execution
- **Traceable**: CUJ ID tracked throughout execution for debugging
- **User-Friendly**: Natural language syntax

## Detailed CUJ Documentation

Each CUJ has a dedicated documentation file:
- `.claude/docs/cujs/CUJ-001.md` through `.claude/docs/cujs/CUJ-030.md`
- `.claude/docs/cujs/CUJ-034.md` (Browser-Based UI Testing)
- `.claude/docs/cujs/CUJ-035.md` through `.claude/docs/cujs/CUJ-055.md` (Testing & Validation)

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

## Run CUJ Mapping

This table maps each CUJ to its execution mode (workflow file or skill-only), workflow file path, and primary skill used.

| CUJ ID | Execution Mode | Workflow File Path | Primary Skill |
|--------|----------------|-------------------|---------------|
| CUJ-001 | manual-setup | null | null |
| CUJ-002 | skill-only | null | rule-selector |
| CUJ-003 | skill-only | null | context-bridge |
| CUJ-004 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-005 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-006 | skill-only | null | diagram-generator |
| CUJ-007 | workflow | `.claude/workflows/code-quality-flow.yaml` | null |
| CUJ-008 | manual-setup | null | null |
| CUJ-009 | skill-only | null | scaffolder |
| CUJ-010 | workflow | `.claude/workflows/brownfield-fullstack.yaml` | scaffolder |
| CUJ-011 | workflow | `.claude/workflows/quick-flow.yaml` | null |
| CUJ-012 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-013 | skill-only | null | rule-auditor |
| CUJ-014 | skill-only | null | rule-auditor |
| CUJ-015 | skill-only | null | test-generator |
| CUJ-016 | skill-only | null | doc-generator |
| CUJ-017 | skill-only | null | claude-md-generator |
| CUJ-018 | skill-only | null | diagram-generator |
| CUJ-019 | workflow | `.claude/workflows/performance-flow.yaml` | null |
| CUJ-020 | manual-setup | null | null |
| CUJ-021 | workflow | `.claude/workflows/mobile-flow.yaml` | null |
| CUJ-022 | workflow | `.claude/workflows/ai-system-flow.yaml` | null |
| CUJ-023 | skill-only | null | dependency-analyzer |
| CUJ-024 | workflow | `.claude/workflows/incident-flow.yaml` | null |
| CUJ-025 | manual-setup | null | null |
| CUJ-026 | workflow | `.claude/workflows/enterprise-track.yaml` | null |
| CUJ-027 | skill-only | null | recovery |
| CUJ-028 | manual-setup | null | null |
| CUJ-029 | manual-setup | null | null |
| CUJ-030 | manual-setup | null | null |
| CUJ-034 | workflow | `.claude/workflows/browser-testing-flow.yaml` | null |
| CUJ-035 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-036 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-037 | workflow | `.claude/workflows/enterprise-track.yaml` | null |
| CUJ-038 | skill-only | null | optional-artifact-handler |
| CUJ-039 | workflow | `.claude/workflows/code-quality-flow.yaml` | null |
| CUJ-040 | skill-only | null | recovery |
| CUJ-041 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-042 | manual-setup | null | null |
| CUJ-043 | skill-only | null | recovery |
| CUJ-044 | manual-setup | null | null |
| CUJ-045 | skill-only | null | recovery |
| CUJ-046 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | null |
| CUJ-047 | skill-only | null | conflict-resolution |
| CUJ-048 | workflow | `.claude/workflows/automated-enterprise-flow.yaml` | null |
| CUJ-049 | manual-setup | null | null |
| CUJ-050 | workflow | `.claude/workflows/enterprise-track.yaml` | null |
| CUJ-051 | workflow | `.claude/workflows/brownfield-fullstack.yaml` | null |
| CUJ-052 | workflow | `.claude/workflows/legacy-modernization-flow.yaml` | artifact-publisher |
| CUJ-053 | workflow | `.claude/workflows/artifact-publishing-flow.yaml` | artifact-publisher |
| CUJ-054 | workflow | `.claude/workflows/artifact-publishing-flow.yaml` | context-bridge |
| CUJ-055 | workflow | `.claude/workflows/artifact-publishing-flow.yaml` | artifact-publisher |
| CUJ-056 | workflow | `.claude/workflows/recovery-test-flow.yaml` | recovery |
| CUJ-057 | workflow | `.claude/workflows/greenfield-fullstack.yaml` | response-rater |
| CUJ-058 | workflow | `.claude/workflows/enterprise-track.yaml` | recovery |
| CUJ-059 | workflow | `.claude/workflows/performance-flow.yaml` | null |
| CUJ-060 | workflow | `.claude/workflows/automated-enterprise-flow.yaml` | context-bridge |
| CUJ-061 | workflow | `.claude/workflows/brownfield-fullstack.yaml` | artifact-publisher |
| CUJ-062 | workflow | `.claude/workflows/automated-enterprise-flow.yaml` | skill-manager |
| CUJ-063 | workflow | `.claude/workflows/recovery-test-flow.yaml` | recovery |

**Notes**:
- **skill-only**: CUJ executes via skill invocation without workflow
- **manual-setup**: CUJ requires manual setup steps (e.g., installation)
- **null**: No workflow file or skill applies
- **Workflow files**: Listed paths are canonical locations in `.claude/workflows/`
- **Primary Skill**: Indicates the main skill used when execution mode is skill-only

## Skill Portability

Some skills are Claude-only and do not have Cursor equivalents:

- `recovery` - Workflow recovery protocol (Claude-only)
- `optional-artifact-handler` - Optional artifact handling (Claude-only)
- `conflict-resolution` - Multi-agent conflict resolution (Claude-only)
- `api-contract-generator` - OpenAPI/Swagger generation (Claude-only)

CUJs that reference these skills are Claude-specific. For Cursor compatibility, equivalent capabilities may be available through agent coordination or manual steps.

## Response-Rater Provider Configuration

The `response-rater` skill is used for validating plan quality with a minimum score of 7/10. Provider configuration and selection strategies are critical for consistent plan validation.

### Default Provider Configuration

```json
{
  "default_providers": ["claude", "gemini"],
  "provider_timeout": 180,
  "min_consensus_score": 7.0,
  "consensus_strategy": "average"
}
```

### Provider Selection Strategy

**Plan Rating (CUJ-005, CUJ-035, CUJ-057)**:
- **Default**: Use 2+ providers (["claude", "gemini"]) for consensus validation
- **Consensus Method**: Average scores from multiple providers
- **Minimum Score**: 7/10 across consensus
- **Timeout**: 180 seconds per provider, 360 seconds total

**Response Review (Validation Tasks)**:
- **Default**: Use 1 provider (fast path) - Primary: "claude"
- **Purpose**: Quick validation without consensus overhead
- **Timeout**: 60 seconds
- **Use Case**: CUJ-036, CUJ-038 validation steps

**Critical Plans (Multi-Phase, Enterprise)**:
- **Default**: Use all available providers (["claude", "gemini", "gpt-4"]) for maximum validation
- **Consensus Method**: Highest score of multiple providers
- **Minimum Score**: 7/10 from primary provider (Claude)
- **Timeout**: 180 seconds per provider, 540 seconds total
- **Use Case**: CUJ-026, CUJ-037, CUJ-048, CUJ-050 (complex enterprise workflows)

### Timeout Handling Per Provider

| Provider | Timeout (seconds) | Retry Policy | Fallback |
|----------|------------------|--------------|----------|
| Claude | 180 | 1 retry with exponential backoff | Continue with other providers |
| Gemini | 180 | 1 retry with exponential backoff | Continue with other providers |
| GPT-4 | 180 | No retry (slower) | Use Claude score as primary |

**Timeout Recovery**: If primary provider times out, system automatically escalates to fallback provider(s). If all providers timeout, use cached score from previous rating or manual review.

## Platform-Specific Execution Notes

### What Makes a CUJ Claude-Only?

Certain CUJs require Claude-specific features that are not yet ported to other platforms:

**Claude-Only Due to Skills**:
- **CUJ-010** (API Endpoint Development): Requires `api-contract-generator` skill
- **CUJ-024** (Incident Response): Requires `recovery` skill for workflow recovery
- **CUJ-027** (Workflow Recovery): Requires `recovery` skill (core functionality)
- **CUJ-038** (Optional Artifact Handling): Requires `optional-artifact-handler` skill
- **CUJ-039** (Cross-Agent Validation): Requires `conflict-resolution` skill
- **CUJ-040** (Stateless Recovery): Requires `recovery` skill
- **CUJ-043** (Workflow Interruption Recovery): Requires `recovery` skill
- **CUJ-045** (Missing Artifact Recovery): Requires `recovery` skill
- **CUJ-047** (Multi-Agent Conflict Resolution): Requires `conflict-resolution` skill
- **CUJ-050** (End-to-End Robustness): Requires `recovery` skill
- **CUJ-056** (Workflow Recovery Protocol): Requires `recovery` skill
- **CUJ-063** (Error Recovery and Checkpoint Restoration): Requires `recovery` skill

**Claude-Only Due to Agents**:
- These CUJs use specialized agents that coordinate complex multi-step workflows requiring Claude-level reasoning

### Cursor Workarounds

For CUJs that are Claude-only, Cursor users have the following alternatives:

| Claude-Only CUJ | Cursor Workaround | Notes |
|-----------------|-------------------|-------|
| **CUJ-010** (API Endpoint Development) | Manual OpenAPI/Swagger generation via Swagger Editor | Use online Swagger Editor to define API contracts manually; developer agent still available for implementation |
| **CUJ-024** (Incident Response) | Manual incident response workflow via Cursor Plan Mode | Use Cursor's Plan Mode to manually coordinate incident response steps |
| **CUJ-027** (Workflow Recovery) | Manual recovery workflow via checkpoints | Save checkpoints manually; resume from last known good state |
| **CUJ-038** (Optional Artifact Handling) | Manual optional input handling | Check for artifact existence manually; skip optional inputs if missing |
| **CUJ-039** (Cross-Agent Validation) | AI Council via manual agent calls | Use Cursor's subagent feature to manually call validator agents |
| **CUJ-040** (Stateless Recovery) | Manual state reconstruction | Reconstruct state from checkpoint files and git history |
| **CUJ-043** (Workflow Interruption) | Manual checkpoint recovery | Load checkpoint manually from run state |
| **CUJ-045** (Missing Artifact Recovery) | Regenerate artifacts manually | Manually invoke agents to recreate missing artifacts |
| **CUJ-047** (Multi-Agent Conflict) | Manual conflict resolution via debate | Use Cursor's AI Council feature to mediate agent disagreements |
| **CUJ-050** (End-to-End Robustness) | Manual testing via Plan Mode | Use Cursor Plan Mode to manually execute end-to-end test scenarios |
| **CUJ-056** (Workflow Recovery Protocol) | Manual recovery protocol via checkpoints | Load recovery protocol manually; validate state from file system |
| **CUJ-063** (Error Recovery and Checkpoint Restoration) | Manual checkpoint restoration | Restore from checkpoint files manually; use fallback routing for agent failures |

### Factory Droid Compatibility

**Current Status**: 0/62 CUJs have explicit Factory Droid support

**Potential for Adaptation**:
- **Skill-Only CUJs** (13 total): May work if skills are ported to Factory
  - CUJ-002, CUJ-003, CUJ-006, CUJ-009, CUJ-013, CUJ-014, CUJ-015, CUJ-016, CUJ-017, CUJ-018, CUJ-023, CUJ-030, CUJ-044, CUJ-046, CUJ-048, CUJ-051, CUJ-052, CUJ-054, CUJ-055, CUJ-056
  - **Path to Support**: Port core skills to Factory; integrate with Factory's native skill system

- **Manual CUJs** (3 total): Work without platform-specific features
  - CUJ-001, CUJ-008, CUJ-020, CUJ-025, CUJ-028, CUJ-029, CUJ-030, CUJ-042, CUJ-044, CUJ-049
  - **Path to Support**: Minimal - just follow manual steps, no automation needed

- **Workflow CUJs** (44 total): Require Factory workflow engine support
  - **Path to Support**: Implement workflow engine in Factory; port agent system; integrate enforcement gates

**Recommended Factory Support Phases**:
1. **Phase 1**: Port core skills → Enable skill-only CUJs
2. **Phase 2**: Implement lightweight workflow engine → Enable simple workflow CUJs
3. **Phase 3**: Full agent orchestration → Enable complex enterprise CUJs

### Error Messages for Platform Limitations

**When CUJ is Not Supported on Current Platform**:

```
❌ ERROR: CUJ Not Supported on This Platform

CUJ: CUJ-010 (API Endpoint Development)
Reason: Requires 'api-contract-generator' skill (Claude-only)
Current Platform: Cursor

Workaround:
1. Use Swagger Editor (https://editor.swagger.io/) for API contract generation
2. Define endpoints, request/response schemas manually
3. Use Developer agent for implementation

Alternative CUJs that work on Cursor:
- CUJ-011 (Bug Fix Workflow)
- CUJ-012 (Feature Implementation)
- CUJ-013 (Code Review)
- CUJ-019 (Performance Optimization)
```

**When Recovery Skill is Not Available**:

```
⚠️ WARNING: Recovery Skill Not Available

CUJ: CUJ-027 (Workflow Recovery After Context Loss)
Required Skill: 'recovery' (Claude-only)
Current Platform: Cursor

Fallback Procedure:
1. Load checkpoint: .claude/context/runs/<run_id>/checkpoint.json
2. Identify last successful step
3. Check artifact registry for available artifacts
4. Resume from last artifact using manual agent coordination
5. Use Cursor Plan Mode to track recovery progress

Recovery Steps:
- List available checkpoints: ls .claude/context/runs/<run_id>/checkpoint*.json
- Inspect checkpoint: cat .claude/context/runs/<run_id>/checkpoint.json
- Identify missing artifacts: grep -E "^status: (missing|pending)" artifact-registry.json
- Regenerate missing artifacts via agent calls
- Resume workflow from next step
```

## Performance Guidance

Execution time varies significantly based on CUJ type and complexity. Understanding these ranges helps with workflow planning and timeout configuration.

### Expected Performance Ranges

**Skill-Only CUJs** (Fastest - Direct Execution):
- **Range**: 2-60 seconds
- **Average**: 10-30 seconds
- **Examples**:
  - CUJ-002 (Rule Configuration): 2-5 seconds
  - CUJ-013 (Code Review): 10-30 seconds
  - CUJ-015 (Test Generation): 15-30 seconds
  - CUJ-017 (Module Documentation): 5-10 seconds
- **Optimization**: Use for quick, focused tasks; no planning overhead
- **Trigger**: Direct skill invocation without agent orchestration

**Workflow CUJs** (Medium - Multi-Step Execution):
- **Range**: 2-10 minutes
- **Average**: 4-6 minutes
- **Examples**:
  - CUJ-004 (Feature Planning): 3-5 minutes
  - CUJ-011 (Bug Fix Workflow): 2-4 minutes
  - CUJ-019 (Performance Optimization): 5-8 minutes
  - CUJ-034 (Browser UI Testing): 5-10 minutes
- **Optimization**: Use for multi-agent coordination; includes planning and validation gates
- **Trigger**: Workflow YAML execution with agent handoffs

**Complex Workflow CUJs** (Slowest - Enterprise-Scale):
- **Range**: 10-30 minutes
- **Average**: 15-20 minutes
- **Examples**:
  - CUJ-005 (Greenfield Project Planning): 15-25 minutes (9 agents)
  - CUJ-026 (Multi-Phase Project Planning): 20-30 minutes (hierarchical planning)
  - CUJ-050 (End-to-End Workflow Robustness): 15-20 minutes (full test suite)
- **Optimization**: Leverage parallel execution where possible; structure tasks as independent phases
- **Trigger**: Enterprise-scale workflows with full agent orchestration and plan rating

### Performance Optimization Recommendations

1. **Task Selection**:
   - For quick tasks (< 5 minutes): Use skill-only CUJs (CUJ-002, CUJ-013, CUJ-017)
   - For medium tasks (5-10 minutes): Use workflow CUJs (CUJ-004, CUJ-011, CUJ-019)
   - For complex tasks (> 10 minutes): Use enterprise CUJs (CUJ-005, CUJ-026, CUJ-050)

2. **Parallel Execution**:
   - Skill-only CUJs can execute in parallel without contention
   - Workflow steps in same phase can run parallel (e.g., UX design and architecture in CUJ-005)
   - Use `parallel: true` in workflow YAML for compatible steps

3. **Caching & Memoization**:
   - Rule-selector results cached per project (CUJ-002)
   - Architecture decisions reused across phases (CUJ-005)
   - Test cases retained for regression testing

4. **Plan Rating Performance**:
   - Single-provider rating: 30-60 seconds (use for simple plans)
   - Multi-provider consensus: 90-180 seconds (use for critical plans)
   - Cached ratings: < 5 seconds (reuse when plan unchanged)

## Related Documentation

- [Workflow Guide](../../workflows/WORKFLOW-GUIDE.md)
- [Agent Documentation](../../agents/)
- [Skills Documentation](../../skills/)
- [Getting Started Guide](../../../GETTING_STARTED.md)

