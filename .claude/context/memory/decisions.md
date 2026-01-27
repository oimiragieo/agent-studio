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

## [ADR-017] Reflection Agent Architecture

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Need metacognitive layer to assess quality, extract patterns, and consolidate learnings from completed work. Research identified RECE loop, VIGIL framework, MARS metacognition, and LLM-Rubric as industry-standard patterns.
- **Decision**: Create reflection-agent as core agent using RECE loop (Reflect-Evaluate-Correct-Execute) with rubric-based scoring, RBT diagnosis (Roses/Buds/Thorns), and memory consolidation. Agent operates as "sibling agent" (VIGIL pattern) - does NOT execute tasks, only evaluates.
- **Consequences**:
  - Systematic quality assessment across all agent outputs
  - Rubric dimensions: completeness (25%), accuracy (25%), clarity (15%), consistency (15%), actionability (20%)
  - Three thresholds: Excellent (0.9+), Pass (0.7+), Critical Fail (<0.4)
  - Continuous learning through memory consolidation (learnings.md, decisions.md, reflection-log.jsonl)
  - Future integration with self-healing system for pattern-based improvements
  - Tools: Read-only + memory file writes (no code modification)
  - Skills: verification-before-completion, code-analyzer, insight-extraction
  - Model: sonnet (balance of cost and reasoning capability)
  - Research-backed: RECE (TowardsAI), VIGIL (arXiv:2512.07094), MARS (arXiv:2601.11974v1), LLM-Rubric (arXiv:2501.00274v1)

## [ADR-017] Developer Workflow Documentation Approach

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Developer agents need comprehensive workflow guidance covering pre-implementation, implementation standards, post-implementation, and error recovery. Research from framework-organization-research.md shows industry best practices converge around TDD workflows, explicit error handling, co-located tests, and memory-based continuity.
- **Decision**: Created `.claude/docs/DEVELOPER_WORKFLOW.md` with 4 main sections:
  1. Pre-Implementation Checklist (memory files, task understanding, code reading, task claiming)
  2. Implementation Standards (TDD Red-Green-Refactor, absolute paths, file placement, code style, error handling, no hardcoded values)
  3. Post-Implementation Checklist (test verification, task updates, memory updates, next tasks)
  4. Error Recovery Procedures (test failures, hook blocks, missing dependencies, blocked tasks)
- **Consequences**:
  - Developer agents have single source of truth for workflow standards
  - TDD discipline enforced through documented gates and verification requirements
  - File placement rules integrated via cross-reference to FILE_PLACEMENT_RULES.md
  - Error recovery procedures reduce context thrashing when problems occur
  - Skill invocation protocol clarified (Skill() tool, not just reading files)
  - Memory protocol reinforced at all critical checkpoints
  - All findings reference CWE IDs for standardization

## [ADR-004] Lazy-Load Skill Discovery

- **Date**: 2026-01-24
- **Status**: Accepted
- **Context**: CLAUDE.md Section 7 listed static skill names (python-pro, rust-pro, etc.) that became stale when actual skill names differed (e.g., python-backend-expert). 7-agent audit identified this as a Priority 1 issue.
- **Decision**: Replace static skill name lists in CLAUDE.md Section 7 with a reference to the dynamically-maintained skill catalog at `.claude/context/artifacts/skill-catalog.md`. Router and agents discover skills by reading the catalog rather than relying on hardcoded names.
- **Consequences**:
  - Skill catalog becomes single source of truth for available skills
  - Slight overhead for catalog lookup (negligible - catalog is ~500 lines)
  - skill-creator must maintain catalog (already has this requirement per Iron Law #6)
  - Router cannot assume skill names; must verify against catalog
  - Prevents stale references when skills are renamed or consolidated

## [ADR-005] Anthropic Tool Use Standards Enforcement

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Agents were violating Anthropic's best practices for tool use: not reading files before editing, not parallelizing independent tool calls, poor error handling, inefficient grep usage without glob filters. These violations led to wasted tokens, slower execution, and file corruption risks.
- **Decision**: Implement enforcement hooks and documentation following Anthropic's official guidelines. Created comprehensive tool use guidelines in `.claude/skills/tool-use-standards/SKILL.md` covering: parallel calls for independent operations, Read-before-Edit requirement, efficient grep with filters, proper error handling, and bash best practices. Added enforcement hooks: edit-safety-check.cjs (blocks Edit without prior Read), parallel-tool-opportunity-detector.cjs (warns on sequential independent calls).
- **Consequences**:
  - Improved tool use efficiency and safety
  - Reduced token waste from sequential calls
  - Prevented file corruption from blind edits
  - Added ~15ms overhead from pre-execution hooks
  - Agents must adapt to stricter tool use discipline
  - False positives possible in edge cases (warnings can be disabled per-project)

## [ADR-006] Router Enforcement - Hybrid Multi-Layer Approach

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Despite documented router protocols (CLAUDE.md, router-decision.md), the Router (Claude) violates the protocol by creating tasks directly and acting as both Router and Planner. Advisory hooks are ignored. The root cause is that LLMs respond to immediate task pressure over abstract rules, even when rules are explicit and comprehensive.
- **Decision**: Implement Hybrid Enforcement with 5 components:
  1. **State Enhancement**: Track complexity, plannerSpawned, securitySpawned in router-state.cjs
  2. **Classification Storage**: router-enforcer.cjs saves complexity classification to state
  3. **Spawn Tracking**: agent-context-tracker.cjs detects when PLANNER/SECURITY agents are spawned
  4. **TaskCreate Guard**: New blocking hook prevents TaskCreate for HIGH/EPIC complexity if PLANNER not spawned
  5. **Documentation**: Explicit decision tree in CLAUDE.md Section 3.5 with STOP gates before task creation
- **Consequences**:
  - Multiple layers of enforcement: prompt → advisory → blocking
  - Configurable via PLANNER_FIRST_ENFORCEMENT environment variable (block|warn|off)
  - May have false positives on complexity detection; default to warn mode for now
  - Adds ~20ms latency from additional hook checks
  - Prevents Router from creating tasks for complex work without planning
  - Forces proper delegation flow: Router → Planner → TaskCreate → Developer
  - Maintains escape hatch (env var) for edge cases or emergencies

## [ADR-007] Router Enforcement Default Mode: Block

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: After ADR-006 implemented hybrid enforcement (PLANNER_FIRST_ENFORCEMENT and ROUTER_WRITE_GUARD), the default was set to "warn" mode. This allowed the Router to continue violating the protocol while providing feedback. Analysis showed that warn mode was insufficiently strict - Router continued to bypass planning and directly modify files despite warnings.
- **Decision**: Change enforcement defaults from "warn" to "block" for both guards:
  1. **PLANNER_FIRST_ENFORCEMENT**: Default changed from 'warn' to 'block' in task-create-guard.cjs
  2. **ROUTER_WRITE_GUARD**: Default changed from 'warn' to 'block' in router-state.cjs and router-write-guard.cjs
  3. **Override Path**: Teams can override with environment variables for development: `PLANNER_FIRST_ENFORCEMENT=warn` or `ROUTER_WRITE_GUARD=warn`
  4. **Documentation**: Updated all three hook files with clear ENFORCEMENT MODES documentation explaining block (default), warn, and off modes
- **Consequences**:
  - Security hardening: Router cannot bypass multi-agent architecture by default
  - Stricter enforcement of Router-First protocol and delegation patterns
  - Development flexibility maintained through environment variable overrides
  - May require teams to explicitly set warn mode during exploratory development
  - Forces Router to spawn agents rather than executing directly
  - Prevents Router from creating implementation tasks without planning phase
  - Clear documentation in hooks makes override path discoverable

## [ADR-008] Memory System Documentation

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Memory system lacked comprehensive documentation. New users and agents needed a complete guide covering session-based memory, JSON files, CLI usage, Memory Protocol, ADR/issue formats, context efficiency, and best practices.
- **Decision**: Created `.claude/docs/MEMORY_SYSTEM.md` as the authoritative reference for the memory system. Documentation covers: why memory matters, file locations, session-based persistence, JSON memory files (gotchas.json, patterns.json, codebase_map.json), Memory Manager CLI, Memory Protocol for agents, SessionEnd hook workflow, ADR/issue formats, context efficiency with read-time truncation, best practices, legacy archive system, integration with tasks and agent spawning, troubleshooting, and advanced usage patterns.
- **Consequences**:
  - Single source of truth for memory system documentation
  - Agents can reference comprehensive guide instead of inferring from code
  - New users have clear onboarding documentation
  - Memory Protocol becomes discoverable and enforceable
  - Reduces cognitive load for understanding memory system
  - Sets precedent for comprehensive system documentation

## [ADR-009] Automated Planner-First Enforcement via task-create-guard

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Router was bypassing PLANNER for HIGH/EPIC complexity tasks, directly using TaskCreate to create implementation tasks. This violated the multi-agent architecture where Router should orchestrate (not plan) and PLANNER should break down complex work. Advisory hooks and documentation were insufficient to prevent this violation due to task pressure overriding abstract rules in LLM behavior.
- **Decision**: Created automated enforcement hook `.claude/hooks/routing/task-create-guard.cjs` that intercepts TaskCreate tool calls. Hook reads complexity level from router-state.cjs (set by router-enforcer.cjs) and blocks TaskCreate for HIGH/EPIC complexity unless PLANNER has been spawned first. Enforcement mode configurable via `PLANNER_FIRST_ENFORCEMENT` environment variable (block, warn, off). Default mode is "block" to strictly enforce the protocol. Hook solves the chicken-egg problem by allowing PLANNER itself to use TaskCreate (since PLANNER spawns break the enforcement cycle).
- **Consequences**:
  - Router cannot bypass planning phase for complex work
  - Forces proper delegation flow: Router → PLANNER → TaskCreate → DEVELOPER
  - Maintains escape hatch via environment variable for edge cases or development
  - Adds ~15ms latency from PreToolUse hook execution
  - Requires router-state.cjs for complexity tracking and plannerSpawned flag
  - May have false positives on complexity detection (can override with PLANNER_FIRST_ENFORCEMENT=warn)
  - PLANNER agent itself is exempt from enforcement (can always create tasks)
  - Complements existing security-review-guard.cjs for defense-in-depth routing enforcement

## [ADR-010] Consensus Voting Workflow with Byzantine Fault Tolerance

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Complex architectural and security decisions benefit from multiple expert perspectives. A single agent may have biased or incomplete analysis. Need a structured way to gather independent opinions, detect conflicts, and synthesize a final decision with quantifiable confidence.
- **Decision**: Created `.claude/workflows/consensus-voting-skill-workflow.md` implementing a 4-phase Byzantine consensus protocol with Queen/Worker topology:
  1. **Phase 1 - Problem Distribution**: Queen (swarm-coordinator) decomposes problem, defines evaluation criteria, spawns 3+ workers in parallel
  2. **Phase 2 - Independent Analysis**: Workers analyze from their domain expertise without cross-reading
  3. **Phase 3 - Vote Collection**: Queen gathers votes, calculates weighted consensus, identifies conflicts
  4. **Phase 4 - Result Synthesis**: Resolve conflicts using tie-breaking hierarchy (Security Priority > Confidence Weighted > Criteria Sum > Queen Decides), synthesize final decision with caveats
- **Consequences**:
  - Reduces single-agent bias on critical decisions
  - Provides quantifiable confidence scores
  - Preserves dissenting opinions as documented caveats
  - Adds latency (parallel workers still take time)
  - Requires session state files in `.claude/context/sessions/`
  - Quorum rules prevent decisions without sufficient input
  - Security concerns automatically receive priority in tie-breaks

## [ADR-011] EVOLVE Workflow - Locked-In Self-Evolution Process

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Ecosystem evolution (creating new agents, skills, workflows, hooks, schemas) was ad-hoc. Artifacts were created without research, validation, or quality gates, leading to inconsistent patterns, duplicates, and poorly integrated components. The evolution-orchestrator agent was created but lacked a documented, enforceable workflow.
- **Decision**: Created `.claude/workflows/core/evolution-workflow.md` as the LOCKED-IN workflow for self-evolution with the following characteristics:
  1. **6-Phase State Machine**: E(valuate)->V(alidate)->O(btain)->L(ock)->V(erify)->E(nable)
  2. **MANDATORY Research Phase**: OBTAIN phase requires 3+ research queries, 3+ external sources, research report - CANNOT be skipped
  3. **Gate-Based Progression**: Each phase has explicit exit conditions that must ALL pass
  4. **Enforcement Hooks**: 6 hooks defined to enforce state machine and block shortcuts (research-enforcement.cjs, evolution-state-guard.cjs, etc.)
  5. **State Persistence**: evolution-state.json tracks current phase, gate results, and evolution history
  6. **Iron Laws**: 6 inviolable rules including "NO ARTIFACT WITHOUT RESEARCH" and "NO ARTIFACT WITHOUT ROUTING"
- **Consequences**:
  - All ecosystem evolution must follow EVOLVE workflow
  - Research-backed artifacts improve quality and consistency
  - Gate enforcement prevents partial or incomplete evolutions
  - State machine enables recovery from interruptions
  - Adds overhead (research, validation) but ensures artifact quality
  - Hooks must be implemented to enforce compliance
  - evolution-state.json becomes critical state file

## [ADR-012] Scientific-Skills Retroactive EVOLVE Compliance

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: K-Dense scientific-skills library (139 sub-skills) was manually integrated without following the EVOLVE workflow. No research report existed, no entry in evolution-state.json, and the standard creation process was bypassed. This was identified during the scientific-skills audit.
- **Decision**: Apply retroactive EVOLVE compliance by:
  1. **Research Report**: Created `.claude/context/artifacts/research-reports/scientific-skills-retroactive-research.md` documenting the research that SHOULD have been conducted (4 research queries, 10 external sources, best practices validation)
  2. **Evolution State Entry**: Added retroactive entry to `.claude/context/evolution-state.json` with all 6 EVOLVE phases marked as completed (retroactive: true flag)
  3. **Pattern Registration**: Added "Retroactive EVOLVE compliance" pattern to evolution-state.json patterns array
  4. **Decision Documentation**: This ADR documenting the decision and establishing precedent
- **Consequences**:
  - scientific-skills now has proper EVOLVE audit trail
  - Precedent established for handling manually-integrated artifacts
  - All future skill integrations MUST use EVOLVE workflow (this is a warning example)
  - Research report validates the K-Dense integration approach
  - Evolution history provides complete audit trail for all ecosystem artifacts
  - Retroactive compliance flag clearly distinguishes from proper EVOLVE flows

## [ADR-013] Skill Registry vs Catalog Design

- **Date**: 2026-01-26
- **Status**: Documented
- **Context**: Audit revealed apparent mismatch between skill-catalog.md (427 skills) and creator-registry.json (284 skills).
- **Decision**: This is intentional - each file serves a different purpose:

| File                    | Purpose                        | Scope                          |
| ----------------------- | ------------------------------ | ------------------------------ |
| `skill-catalog.md`      | Human-readable skill discovery | ALL skills (root + sub-skills) |
| `creator-registry.json` | Programmatic skill lookup      | Root skills only               |

- **Rationale**:
  - Catalog is for browsing/discovery (includes scientific-skills/rdkit, etc.)
  - Registry is for invocation lookup (scientific-skills is one entry, sub-skills accessed via parent)
  - Sub-skills are invoked as `Skill({ skill: "scientific-skills/rdkit" })` not as standalone entries
- **Consequences**:
  - Catalog count will always be higher than registry count
  - New root skills must be added to both files
  - Sub-skills only appear in catalog, not registry
  - Counts are expected to diverge, not a defect

## [ADR-014] Android-Pro Agent Creation via EVOLVE

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: Need for native Android development specialist to provide parity with ios-pro agent. Cross-platform development (Expo) is covered by expo-mobile-developer, but native Android/Kotlin development needs dedicated expertise.
- **Decision**: Create android-pro agent via EVOLVE workflow with following design decisions:
  1. **Template**: Use ios-pro.md as structural template for platform parity
  2. **Architecture**: MVVM + Clean Architecture with 3 layers (Presentation, Domain, Data)
  3. **State Management**: StateFlow/SharedFlow over LiveData (modern Compose approach)
  4. **DI Framework**: Hilt (official Google recommendation over manual Dagger)
  5. **Skills**: android-expert, testing-expert, tdd, debugging, verification-before-completion
  6. **UI Framework**: Jetpack Compose with Material Design 3
  7. **Routing**: Update router-enforcer.cjs to route android/kotlin/jetpack compose keywords to android-pro instead of developer
  8. **Disambiguation**: Add android-pro to mobile disambiguation rules (expo = cross-platform, ios = Apple, android = native Android)
- **Research Findings** (from `.claude/context/artifacts/research-reports/android-pro-research.md`):
  - 4 research queries executed with 15+ external sources
  - MVVM + Clean Architecture is dominant pattern for modern Android development
  - Hilt + Room + Retrofit + Coroutines is the standard stack
  - StateFlow replaces LiveData for Compose-native state management
- **Consequences**:
  - Native Android requests routed to specialized agent
  - Platform parity with ios-pro for mobile development
  - Clear separation from expo-mobile-developer (cross-platform)
  - Router disambiguation handles "mobile" requests with kotlin/jetpack compose context
  - Research report provides rationale for all design decisions

## [ADR-015] Agent-Skill Discovery Architecture

- **Date**: 2026-01-25
- **Status**: Accepted
- **Context**: During framework audit, discovered 85% of agents (34/40) had NO skill guidance. Agents could not discover or use the 427+ available skills, leading to chronic underutilization. The skill ecosystem existed but agents did not know how to find or invoke skills. This was an invisible performance degradation - agents worked but suboptimally.
- **Decision**: Implement a 5-phase remediation with two key architectural components:
  1. **Agent-Skill Matrix** (`.claude/context/config/agent-skill-matrix.json`):
     - Central JSON mapping ALL 45 agents to their skills
     - Three skill categories: primary (always load), secondary (common tasks), contextual (triggered by conditions)
     - Machine-readable format enabling programmatic lookup
     - Single source of truth for agent-to-skill relationships
  2. **Skill Invocation Protocol Template** (`.claude/templates/agent-skill-invocation-section.md`):
     - Standardized markdown section embedded in ALL agent definitions
     - Consistent structure: Primary Skills, Secondary Skills, Contextual Skills table, Discovery instructions
     - Ensures identical skill guidance format across all 45 agents
     - Prevents drift and inconsistency in agent documentation
  3. **Skill Consolidation with Aliases**:
     - Merged duplicate skills: testing-expert -> tdd, writing -> writing-skills
     - Added alias references for backward compatibility
     - Cross-referenced 6 related skill pairs
  4. **New Domain Agents via EVOLVE**:
     - Created 5 new specialized agents: scientific-research-expert, ai-ml-specialist, android-pro, gamedev-pro, web3-blockchain-expert
     - All followed EVOLVE workflow with research phase
  5. **Validation**:
     - 45/45 agents validated
     - 204/204 tests passed
     - All registries updated
- **Consequences**:
  - **Positive**: All agents now have skill discovery guidance; central matrix enables tooling; template ensures consistency
  - **Maintenance**: New agents must be added to matrix + have protocol section
  - **Overhead**: ~50 lines added per agent (protocol section); matrix file grows with agents
  - **Pattern established**: Use central matrix for M:N mappings; use templates for consistent documentation

## [ADR-016] Self-Healing System Security Architecture

- **Date**: 2026-01-25
- **Status**: Approved with Conditions
- **Context**: The framework is implementing self-healing capabilities based on VIGIL architecture and RECE reflection patterns (per research in `framework-organization-research.md`). A reflection agent will monitor the primary agent, identify issues, and propose corrections. The EVOLVE workflow enables self-evolution of agents, skills, and hooks. This introduces security risks around self-modification of security-critical components, infinite loops, privilege escalation, and audit trail integrity.
- **Decision**: Implement defense-in-depth security controls before enabling self-healing:
  1. **Immutable Security Core**: Protected paths list blocks modification of security hooks (`router-write-guard.cjs`, `task-create-guard.cjs`, etc.) without human approval via one-time token
  2. **Circuit Breaker Pattern**: Self-healing limited to 10 attempts/hour, 5 consecutive failures triggers open circuit, 30-minute cooldown
  3. **Human-in-the-Loop Gates**: Mandatory human approval for: elevated agent permissions, hook modifications, CLAUDE.md routing changes
  4. **Tamper-Evident Audit Log**: Append-only JSONL log with integrity chain (each entry hashes previous), verified on session start
  5. **Reflection Agent Sandbox**: Reflection agent can read and propose but cannot directly modify hooks or CLAUDE.md
- **Consequences**:
  - **Security**: Strong controls prevent runaway self-modification and privilege escalation
  - **Overhead**: Human approval gates add friction to legitimate self-evolution (~5 min per approval)
  - **Complexity**: 8 new security controls to implement and maintain
  - **Escape Hatches**: Environment variables provide override for emergencies (`ALLOW_SECURITY_EDIT`, `CIRCUIT_BREAKER_THRESHOLD`)
  - **Implementation**: P0 controls required before any self-healing enabled
- **Full Report**: `.claude/context/artifacts/reports/security-review-self-healing.md`

## [ADR-017] Framework Refactoring v3 - Comprehensive Cleanup and Self-Reflection

- **Date**: 2026-01-25
- **Status**: Approved - Pending Implementation
- **Context**: Framework audit identified structural debt: lib/ contains 31 files of workflow/engine code that should be organized; tools/ has 25 items acting as a "junk drawer" with duplicates of skills; empty directories (commands/, temp/) need deletion; tests are not co-located with source; no standardized file placement rules; no self-reflection capabilities; limited self-healing mechanisms.
- **Decision**: Implement a 7-phase refactoring plan documented in `.claude/context/plans/framework-refactoring-v3-plan.md`:
  1. **Phase 1 - Foundation**: Delete empty directories, reorganize lib/ into workflow/, memory/, integration/ subdirectories, clean up tools/, co-locate tests
  2. **Phase 2 - File Placement**: Create FILE_PLACEMENT_RULES.md, implement file-placement-guard.cjs hook, update CLAUDE.md
  3. **Phase 3 - Context Organization**: Standardize context/ folder, create report templates, define artifact naming conventions
  4. **Phase 4 - Developer Workflow**: Document development best practices, create pre/post implementation hooks
  5. **Phase 5 - Creator Skills Update**: Add file placement rules and output validation to all 7 creator skills
  6. **Phase 6 - Reflection Agent**: Create reflection-agent.md following EVOLVE workflow, implement RECE loop, create reflection hooks
  7. **Phase 7 - Self-Healing**: Implement anomaly detection, loop prevention, automatic rerouting, rollback system
- **Research Basis**: Informed by research report at `.claude/context/artifacts/research-reports/framework-organization-research.md` covering VIGIL, MARS, RECE patterns and industry best practices for agent framework organization
- **Consequences**:
  - **Benefits**: Clean directory structure, enforced file placement, self-reflection for quality assessment, self-healing for robustness
  - **Effort**: 40-60 agent sessions across 7 phases (~9-14 days)
  - **Risk Mitigation**: Each phase can be rolled back independently; git checkpoints before each phase
  - **Breaking Changes**: Import paths in lib/ will change; must update all references
  - **Dependencies**: Phases must execute in order due to cascading dependencies

## [ADR-019] Reflection Queue Consumer Pattern

- **Date**: 2026-01-26
- **Status**: Accepted
- **Context**: The reflection system has three hooks that queue reflection requests to `.claude/context/reflection-queue.jsonl` (task-completion-reflection, session-end-reflection, error-recovery-reflection), but nothing dequeued entries and spawned the reflection-agent. This meant EVOLVE/reflection never triggered at session end despite being documented and implemented.
- **Decision**: Implement a queue processor hook (`reflection-queue-processor.cjs`) that:
  1. **Reads the queue file** at session end (registered for SessionEnd event)
  2. **Processes pending entries** (JSONL format with taskId, trigger, timestamp, priority, processed fields)
  3. **Outputs spawn instructions** to stderr in format: `[REFLECTION-TRIGGER] Spawn reflection-agent for: {reason}` followed by Task() call
  4. **Marks entries as processed** to prevent re-processing
  5. **Handles edge cases** (missing file, empty queue, malformed JSON)
- **Design Choices**:
  - **Consumer hook vs Planner integration**: Consumer hook is simpler and decoupled. Planner integration could be Phase 2 enhancement.
  - **SessionEnd timing**: Processor runs AFTER session-end-reflection (which queues the session_end entry), so it processes all accumulated entries including the final session summary.
  - **Informational hook (exit 0)**: Processor outputs instructions but does not block. The spawn instructions are visible in stderr for human or automated action.
  - **Entry matching by tuple**: Entries matched by (trigger, timestamp, taskId/context) tuple for processing/marking.
- **Consequences**:
  - **Positive**: Reflection queue is now consumed; spawn instructions visible at session end
  - **Limitation**: No automatic spawning - instructions are output, not executed
  - **Future**: Could add auto-spawn via EVOLVE_AUTO_START pattern if needed
  - **Test coverage**: 19 tests covering all scenarios (missing file, malformed JSON, processed entries, etc.)

## [ADR-018] Framework Deep Dive Analysis Plan

- **Date**: 2026-01-26
- **Status**: Accepted
- **Context**: Need comprehensive analysis of .claude framework to identify bugs, security issues, pointer gaps, optimization opportunities, and process enhancements. Framework has grown to 50+ hooks, 25+ lib files, 15+ tools across multiple categories.
- **Decision**: Implement 9-phase analysis plan with clear dependencies:
  1. **Phase 1 - Security Deep Dive** (unblocked): Address 3 OPEN security issues (SEC-008, SEC-009, SEC-010)
  2. **Phase 2 - Hook Code Quality** (blocked by P1): Audit all 50+ hooks across 7 categories
  3. **Phase 3 - Library Code Quality** (blocked by P1): Audit lib/ memory, workflow, integration, utils, self-healing
  4. **Phase 4 - Pointer Gap Analysis** (blocked by P2, P3): Agent-skill-workflow connection analysis
  5. **Phase 5 - Tools/CLI Audit** (blocked by P2, P3): Review all tools and CLI utilities
  6. **Phase 6 - Performance Analysis** (blocked by P2, P3): Identify hotspots and optimization opportunities
  7. **Phase 7 - Process Enhancement** (blocked by P4): Workflow and process improvements
  8. **Phase 8 - Test Infrastructure** (blocked by P1, P2, P3): Fix broken tests, coverage analysis
  9. **Phase 9 - Final Report** (blocked by all): Consolidate findings, create remediation roadmap
- **Agent Assignments**:
  - P1: SECURITY-ARCHITECT + CODE-REVIEWER
  - P2, P3, P5: CODE-REVIEWER (+ DEVELOPER for fixes)
  - P4: ARCHITECT + CODE-REVIEWER
  - P6: DEVELOPER + ARCHITECT
  - P7: PLANNER + ARCHITECT
  - P8: QA + DEVELOPER
  - P9: PLANNER + ARCHITECT
- **Consequences**:
  - Security issues addressed first (P0 priority)
  - Clear dependency chain prevents blocked work
  - Parallel execution possible: P2/P3 after P1; P4/P5/P6 after P2/P3
  - Estimated effort: 9-12 agent sessions across phases
  - All findings consolidated into actionable roadmap
  - Framework health score established as baseline

## [ADR-020] Mandatory Evolution & Reflection Phase in Plans

- **Date**: 2026-01-26
- **Status**: Accepted
- **Context**: The reflection-queue-processor hook outputs spawn instructions to stderr when reflection is needed, but nothing acts on these instructions. Plans generated by the Planner agent did not systematically trigger reflection, leading to missed opportunities for learning extraction and self-evolution. The feedback loop between execution and evolution was broken.
- **Decision**: Hardcode a mandatory "Phase [FINAL]: Evolution & Reflection Check" into every plan generated by the Planner agent. Implementation includes:
  1. **Plan Template Update**: Added explicit template structure in `planner.md` showing Phase [FINAL] as the required last phase
  2. **Enforcement Section**: Created "## Mandatory Final Phase (CANNOT BE OMITTED)" section with strict enforcement language
  3. **Spawn Command**: Phase includes ready-to-execute Task() call for reflection-agent
  4. **Validation Rule**: Plans not ending with this phase are explicitly marked as INVALID
- **Consequences**:
  - **Positive**: Every plan now triggers systematic reflection at completion
  - **Positive**: Learning extraction and evolution opportunities are no longer missed
  - **Positive**: Feedback loop between execution and evolution is closed
  - **Overhead**: Adds one additional phase to every plan (~5-10 min)
  - **Enforcement**: Relies on Planner following its own instructions (soft enforcement)
  - **Future**: Could add validation hook to block plans without the final phase (hard enforcement)

## [ADR-021] Semantic Importance-Based Memory Archival

- **Date**: 2026-01-26
- **Status**: Accepted
- **Context**: The learnings.md memory file grew to 42KB, exceeding the 35KB threshold for efficient context loading. Previous archival strategy used simple line-count truncation (keep last 50 lines), which lost valuable high-importance entries while preserving recent but low-value notes. Memory-manager.cjs lacked semantic understanding of entry importance.
- **Decision**: Implement semantic importance-based archival with two new modules:
  1. **learnings-parser.cjs** - Parses learnings.md into structured entries with importance extraction:
     - Supports both `## [CATEGORY] Title` and `### Title (Date)` header formats
     - Two-tier importance inference: title keywords (strong) then body keywords (weak)
     - Functions: parseEntries(), groupByImportance(), filterByImportance(), serializeEntries()
  2. **semantic-archival.cjs** - Importance-based archival engine:
     - Preservation rules: CRITICAL/HIGH (keep forever), MEDIUM (30 days), LOW (archive immediately)
     - targetSizeKB option archives MEDIUM entries oldest-first to reach size target
     - Creates timestamped archive files in `.claude/context/memory/archive/`
- **Preservation Rules**:
  | Level | Keep | Max Age | Archive |
  |-------|------|---------|---------|
  | CRITICAL | Yes | Infinity | No |
  | HIGH | Yes | Infinity | No |
  | MEDIUM | Yes | 30 days | Yes |
  | LOW | No | 0 days | Yes |
- **Implementation Details**:
  - Title keywords trigger higher importance than body keywords (prevents over-classification)
  - CRITICAL title keywords: "CRITICAL", "Iron Law", "Security Fix", "Fail-Closed", "MUST NEVER/ALWAYS"
  - HIGH title keywords: "IMPORTANT", "Security", "SEC-XXX", "Key Finding/Pattern/Insight"
  - MEDIUM title keywords: "Pattern", "Fix", "Bug", "Integration", "Implementation"
  - Entries without dates treated as recent (conservative approach)
- **Results**:
  - learnings.md reduced from 42KB to 24KB (43% reduction)
  - CRITICAL entries (2, 3KB) preserved
  - HIGH entries (3, 6KB) preserved
  - MEDIUM entries (6, 15KB) preserved (within 30-day window)
  - LOW entries (2, 1.7KB) archived
- **Test Coverage**: 40 tests across both modules (20 each), all passing
- **Consequences**:
  - **Positive**: High-value learnings preserved; low-value notes archived
  - **Positive**: File size managed automatically with semantic understanding
  - **Positive**: Archive provides historical record of archived entries
  - **Maintenance**: New entries should include importance markers when possible
  - **Future**: Could integrate with memory-manager.cjs scheduled archival
  - **Files Created**: `.claude/lib/memory/learnings-parser.cjs`, `.claude/lib/memory/semantic-archival.cjs`
  - **Tests Created**: `.claude/lib/memory/learnings-parser.test.cjs`, `.claude/lib/memory/semantic-archival.test.cjs`

## [ADR-022] Framework Issue Resolution Plan - 5-Phase Approach

- **Date**: 2026-01-26
- **Status**: Accepted
- **Context**: Framework deep dive identified 87 total issues (37 resolved, 50 open). Need a structured approach to resolve remaining issues prioritized by security impact, performance gains, and effort. Open issues span 9 categories: SEC-AUDIT (1), HOOK (12), CRITICAL (3), IMP (7), ARCH (3), POINTER (1), PERF (9), PROC (10), SEC-IMPL (6).
- **Decision**: Implement 5-phase remediation plan with clear dependencies:
  1. **Phase 1 - Critical Security** (4h): Fix SEC-AUDIT-011, HOOK-003, CRITICAL-001/003, HOOK-005 - security and reliability fixes that must come first
  2. **Phase 2 - Performance Quick Wins** (6h): Create hook-input.cjs shared utility, consolidate findProjectRoot(), add state-cache to evolution hooks
  3. **Phase 3 - Code Quality** (12h): Migrate 40+ hooks to shared utilities, standardize audit logging, add tests
  4. **Phase 4 - Hook Consolidation** (16h): Consolidate 15 hooks into 4 unified hooks for 60-80% latency reduction
  5. **Phase 5 - Process Automation** (26h): Create documentation, security lint tool, error handling templates
- **Key Metrics**:
  | Metric | Before | After | Improvement |
  |--------|--------|-------|-------------|
  | Duplicated code | 2300 lines | ~230 lines | 90% reduction |
  | Edit/Write latency | ~1000ms | ~400ms | 60% reduction |
  | Task spawn latency | ~500ms | ~100ms | 80% reduction |
  | Hook test coverage | 44% | >60% | +16% |
- **Consequences**:
  - **Positive**: Structured approach ensures security fixes first, performance second
  - **Positive**: Phase dependencies prevent premature optimization
  - **Positive**: Each phase has clear verification gates and rollback procedures
  - **Effort**: ~64 hours total across 27 tasks
  - **Risk Mitigation**: Independent tasks in Phase 5 allow partial completion
- **Plan Location**: `.claude/context/plans/issue-fix-plan.md`
- **Task IDs**: #4 (Phase 1), #2 (Phase 2), #3 (Phase 3), #6 (Phase 4), #5 (Phase 5)

## ADR-023: Agent Metadata Caching Strategy

**Date**: 2026-01-26
**Status**: Accepted
**Context**: router-enforcer.cjs was reading agent files on every request
**Decision**: Implement TTL-based caching with 5-minute expiry
**Consequences**: 80-95% reduction in file reads, minimal stale data risk

## ADR-024: Regex DoS Protection

**Date**: 2026-01-26
**Status**: Accepted
**Context**: User input processed by regex without length limits
**Decision**: 50,000 character limit on tool input before regex matching
**Consequences**: Prevents exponential backtracking, may truncate very large inputs

## ADR-025: Shared Hook Utilities

**Date**: 2026-01-26
**Status**: Accepted
**Context**: 40+ hooks had duplicated utility functions
**Decision**: Consolidate into shared modules: hook-input.cjs, project-root.cjs, state-cache.cjs
**Consequences**: Reduced duplication, centralized maintenance, consistent behavior
