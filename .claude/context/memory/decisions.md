# Architecture Decision Records (ADR)

## Format

```
## [ADR-XXX] Title
- **Date**: YYYY-MM-DD
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Trade-offs and implications
```

---

## [ADR-051] Tool Availability Validation Hook

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Agents were spawned with references to unavailable tools (e.g., `mcp__sequential-thinking__sequentialthinking` without MCP server configured), causing runtime errors "No such tool available". Phase 1 removed unavailable tools from agent definitions; Phase 2 creates prevention.
- **Decision**: Create `.claude/hooks/routing/tool-availability-validator.cjs` that validates tool availability before agent spawning. Hook blocks spawn if required tools (core tools) are unavailable, warns but allows spawn if optional tools (MCP) are missing.
- **Consequences**:
  - **Pros**: Prevents "tool not available" runtime errors; catches tool mismatches at spawn time; provides actionable warnings for MCP tools
  - **Cons**: Adds validation overhead to every Task spawn (minimal - single settings.json read)
  - **Integration**: Hook registered in settings.json PreToolUse(Task) as first hook (runs before pre-task-unified.cjs); uses CORE_TOOLS constant for validation
  - **Rollback**: Can be removed from settings.json Task hooks array
  - **Related**: See tool-availability-audit-2026-01-28.md for background investigation
  - **Registration Date**: 2026-01-28 (Phase 3 completed)

---

## [ADR-053] Write Size Validation Hook

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Devops agent attempted to write 41,350 tokens to environment.cjs (limit: 25,000 tokens), causing Write tool failure. Error occurred AFTER agent generated content, wasting compute. Need prevention at tool invocation.
- **Decision**: Create `.claude/hooks/safety/write-size-validator.cjs` that validates content size before Write/Edit/NotebookEdit operations. Hook estimates tokens (~4 chars/token), warns at 20K tokens (80% limit), blocks at >25K tokens.
- **Consequences**:
  - **Pros**: Prevents oversized writes before they fail; provides early warning at 80% threshold; actionable error messages suggest splitting content
  - **Cons**: Token estimation is approximate (~4 chars/token); adds validation overhead to every write operation (minimal - string length check)
  - **Integration**: Hook registered in settings.json PreToolUse(Write|Edit|NotebookEdit); fails open on error (SEC-008 compliance)
  - **Thresholds**: WARNING_THRESHOLD = 20K tokens, MAX_TOKENS = 25K tokens (blocks > 25K, allows = 25K)
  - **Rollback**: Can be removed from settings.json write tool hooks array
  - **Test Coverage**: 13 unit tests (100% passing); manual testing validated all scenarios
  - **Registration Date**: 2026-01-28 (Phase 3 completed - hook now registered in settings.json as second hook in Edit|Write|NotebookEdit matcher)

---

## [ADR-052] Memory File Rotation Strategy

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Memory files (decisions.md: 3096 lines, issues.md: 1973 lines) were approaching Read tool limits (25000 tokens), risking future context loading failures. Existing smart-pruner.cjs handles JSON files (gotchas, patterns) but not markdown files with structured content (ADRs, issues).
- **Decision**: Create `.claude/lib/memory/memory-rotator.cjs` utility with age-based rotation policies:
  - **decisions.md**: Archive ADRs older than 60 days when file > 1500 lines
  - **issues.md**: Archive RESOLVED issues older than 7 days when file > 1500 lines
  - **Archive Location**: `.claude/context/memory/archive/YYYY-MM/`
  - **Format**: Full content preservation with metadata headers
- **Consequences**:
  - **Benefits**:
    - Prevents memory files from exceeding Read tool limits (25000 tokens)
    - Keeps active files focused on recent/relevant content
    - Full archival (no data loss) - old content remains searchable via grep
    - Dry-run mode for safe testing before execution
    - CLI commands for manual rotation when needed
  - **Trade-offs**:
    - Archived content requires explicit search (not loaded by default)
    - Age-based rotation may archive still-relevant ADRs (mitigated by 60-day threshold)
    - Manual invocation required unless integrated into memory-scheduler.cjs
  - **Implementation**:
    - Parses ADRs by `## [ADR-XXX]` headers, extracts dates
    - Parses issues by `### Title` headers, prioritizes Resolved date over Date field
    - Creates archive files with metadata headers showing archived entry ranges
    - Updates active files with notice of archival
  - **Test Coverage**: 15 unit tests (parsing, selection, rotation, dry-run)
  - **Documentation**: Added to `.claude/docs/MONITORING.md`
- **Integration**: Can be invoked manually or scheduled:
  ```bash
  node .claude/lib/memory/memory-rotator.cjs check      # Check status
  node .claude/lib/memory/memory-rotator.cjs rotate --dry-run  # Preview
  node .claude/lib/memory/memory-rotator.cjs rotate    # Execute
  ```
- **Future Work**: Integrate into memory-scheduler.cjs for automated monthly rotation

---

## [ADR-001] Router-First Protocol

- **Date**: 2026-01-23
- **Status**: Accepted
- **Context**: Need consistent request handling across all agent interactions
- **Decision**: All requests must first go through the Router Agent for classification
- **Consequences**: Adds routing overhead but ensures proper agent selection

## [ADR-002] Memory Persistence Strategy

- **Date**: 2026-01-23
- **Status**: Accepted
- **Context**: Agent context can be reset at any time; need persistent memory
- **Decision**: Use file-based memory in `.claude/context/memory/`
- **Consequences**: Agents must read/write memory files; adds I/O but ensures continuity

## [ADR-003] Serena Integration Scope

- **Date**: 2026-01-24
- **Status**: Accepted
- **Context**: Serena codebase available for integration; need to decide what to port
- **Decision**: Port workflow patterns as skills (onboarding, thinking-tools, modes, summarize-changes, session-handoff). Do NOT port Python runtime dependencies (LSP, dashboard, token counting).
- **Consequences**: Framework gains valuable workflow patterns without adding runtime dependencies. CLI-first approach maintained. Some features (dynamic tool exclusion) rely on agent self-regulation rather than enforcement.

## [ADR-005] Security Architect Workflow

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Need a comprehensive security audit workflow that integrates threat modeling, OWASP Top 10 coverage, dependency auditing, penetration testing, and remediation planning into a structured multi-phase process.
- **Decision**: Create `.claude/workflows/security-architect-skill-workflow.md` with 5 phases: Threat Modeling (STRIDE), Code Review (OWASP Top 10), Dependency Audit (CVE), Penetration Testing, and Remediation Planning. Workflow uses security-architect, code-reviewer, developer, and devops agents with appropriate skills.
- **Consequences**:
  - Standardized security audit process across all projects
  - Clear severity classification (Critical/High/Medium/Low) with SLAs
  - Security gates define what blocks deployment
  - Integration with Task tracking system for multi-phase coordination

## [ADR-041] Feature Flag Infrastructure for Safe Rollout

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Party Mode and Advanced Elicitation are high-value, high-risk features requiring gradual rollout with emergency disable capability. Need infrastructure to control feature activation without code changes.
- **Decision**: Implement FeatureFlagManager (`.claude/lib/utils/feature-flags.cjs`) with 3-tier priority system:
  1. **Environment Variables** (highest priority) - Emergency override: `PARTY_MODE_ENABLED=true|false`, `ELICITATION_ENABLED=true|false`
  2. **Config File** (`.claude/config.yaml`) - Default configuration with nested feature settings
  3. **Runtime API** (in-memory) - Dynamic toggling for development: `enable()`, `disable()`, `isEnabled()`, `getConfig()`
- **Consequences**:
  - **Benefits**:
    - Emergency disable without code changes (<1 minute via env var)
    - Gradual rollout (10% → 50% → 100% of users)
    - A/B testing capability
    - Cost control monitoring before full rollout
    - Rollback procedures documented in `.claude/docs/ROLLBACK_PROCEDURES.md`
  - **Trade-offs**:
    - Code must check flags before executing feature logic (adds complexity)
    - Config drift if env vars and config.yaml diverge
    - Documentation overhead to maintain feature flag lifecycle

## [ADR-042] Party Mode Routing Integration

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Party Mode was fully implemented (151 tests, 23 files, 3000+ lines of docs, party-orchestrator agent created) but Router had NO routing logic to activate it. When users said "Party Mode" or "multi-agent collaboration", Router didn't know to spawn party-orchestrator, making the feature effectively invisible.
- **Decision**: Add Party Mode keyword detection and routing to Router's decision workflow:
  1. **Intent Classification** (router-decision.md Step 2.1): Added "Party Mode" intent with keywords: "party mode", "multi-agent collaboration", "discuss with team", "debate", "consensus"
  2. **Agent Selection** (router-decision.md Step 6): Added party-orchestrator to Orchestrator Agents section with complete spawn example showing Task() call with PROJECT_ROOT, TaskUpdate protocol, and Team coordination instructions
  3. **Routing Table** (CLAUDE.md Section 3): Updated party-orchestrator row to include activation keywords: "(party mode, consensus, debate, team discussion)"
- **Consequences**:
  - **Benefits**:
    - Party Mode now discoverable via natural language ("start Party Mode", "discuss with team")
    - Router automatically spawns party-orchestrator instead of individual agents
    - Consistent with existing orchestrator patterns (master-orchestrator, swarm-coordinator)
    - Maintains post-creation integration checklist pattern (routing → catalog → assignment → validation)
  - **Trade-offs**:
    - Router must distinguish between "multi-agent collaboration" (party-orchestrator) vs. parallel agent spawning (multiple Task() calls)
    - Additional routing complexity for disambiguation
  - **Implementation Notes**:
    - Routing logic follows Orchestrator Spawn Template (CLAUDE.md Section 2)
    - party-orchestrator requires Task() tool to spawn team members
    - Uses opus model for complex multi-agent coordination
- **Related Issues**: Resolves post-creation integration gap identified in learnings.md (artifacts invisible without routing integration)
- **Related ADRs**: ADR-041 (Feature Flags for Party Mode rollout control)

## [ADR-043] MCP Tool Removal from Spawn Templates

- **Date**: 2026-01-28
- **Status**: Accepted
- **Context**: Agent definitions referenced `mcp__sequential-thinking__sequentialthinking` tool but MCP server was not configured in settings.json, causing tool unavailability errors. This affected 12+ agent files and spawn templates in CLAUDE.md.
- **Decision**: Remove `mcp__sequential-thinking__sequentialthinking` from all spawn templates and agent allowed_tools arrays. Add guidance comments directing users to use `Skill({ skill: 'sequential-thinking' })` as fallback when MCP servers are not configured.
- **Consequences**:
  - **Benefits**:
    - Eliminates tool unavailability errors for agents
    - Provides clear fallback mechanism via Skill() tool
    - Maintains sequential thinking capability without MCP dependency
    - Adds Tool Selection Notes documenting MCP vs core tool distinction
  - **Trade-offs**:
    - Users must explicitly configure MCP servers if they want MCP tools
    - Skill-based sequential thinking may have different UX than MCP tool version
  - **Implementation**:
    - Phase 1: Removed MCP tool from 12 agent definition files
    - Phase 2: Updated Universal Spawn Template and Orchestrator Spawn Template in CLAUDE.md
    - Added Tool Selection Notes section explaining MCP requirements
  - **Related Files**:
    - `.claude/CLAUDE.md` (spawn templates updated)
    - `.claude/context/plans/agent-error-fixes-plan-2026-01-28.md` (implementation plan)
