# Customer User Journey (CUJ) Index

This index maps all 55 Customer User Journeys (CUJs) to agents, skills, workflows, and expected outcomes.

**Note**: CUJ-031, CUJ-032, CUJ-033, and CUJ-056 are reserved for future use and not included in active documentation.

## Implementation Status Summary

**All CUJs Implemented**: ✅ 55/55 CUJs defined and documented
- **Workflow-Based CUJs**: 40 (multi-agent workflows)
- **Skill-Only CUJs**: 12 (direct skill invocation without workflow)
- **Manual CUJs**: 3 (require manual setup/execution)

**Execution Modes**:
- ✅ `workflow`: Direct YAML workflow execution (39 CUJs) - Load and execute full multi-step workflows
- ✅ `skill`: Direct skill invocation (12 CUJs) - Invoke single skill without agents or planning
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

### Category 9: Testing & Validation (18 CUJs)
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
| CUJ-053 | Artifact Registry Migration Test | "Test registry migration" | Planner → QA | Registry migration validation |
| CUJ-054 | Publishing Metadata Persistence Test | "Test publishing persistence" | Planner → QA | Publishing persistence validation |
| CUJ-055 | Cross-Platform Publishing Sync Test | "Test cross-platform sync" | Planner → QA | Cross-platform sync validation |
| CUJ-056 | Publishing Retry Logic Test | "Test publishing retry" | Planner → QA | Retry logic validation |

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
| CUJ-052 | skill-only | null | artifact-publisher |
| CUJ-053 | workflow | `.claude/workflows/legacy-modernization-flow.yaml` | null |
| CUJ-054 | skill-only | null | artifact-publisher |
| CUJ-055 | skill-only | null | context-bridge |
| CUJ-056 | skill-only | null | recovery |

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

## Related Documentation

- [Workflow Guide](../../workflows/WORKFLOW-GUIDE.md)
- [Agent Documentation](../../agents/)
- [Skills Documentation](../../skills/)
- [Getting Started Guide](../../../GETTING_STARTED.md)

