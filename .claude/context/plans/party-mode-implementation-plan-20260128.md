# Plan: Party Mode (Multi-Agent Collaboration)

**Feature ID**: PARTY-MODE
**Planning Date**: 2026-01-28
**Planner**: planner agent (Task #7)
**Priority Score**: 70 (highest value from BMAD analysis)
**Estimated Duration**: 49 hours (6-7 weeks)
**Files Modified**: 25+ (10 new directories, 15+ implementation files)

---

## Executive Summary

Party Mode enables multiple AI agents to collaborate in a single conversation, transforming agent-studio from sequential agent spawning to true multi-agent debate and collaboration. This is the #1 priority feature from BMAD-METHOD analysis with breakthrough value for complex decision-making, brainstorming, and multi-perspective analysis.

**Key Deliverables:**

- Multi-agent conversation protocol supporting 2-4 agents per round
- 3 predefined teams (default, creative, technical)
- Context isolation preventing cross-agent interference
- 6 CRITICAL security controls protecting agent boundaries
- Feature flag integration (PARTY_MODE_ENABLED, default: false)
- TDD implementation with 35+ tests

**Success Criteria:**

- Party Mode conversation with 3+ agents completing successfully
- All 6 CRITICAL security controls validated via penetration tests
- Zero regressions in existing 74 tests
- Performance targets: <100ms agent spawn, <5ms message routing

---

## Overview

### What This Plan Accomplishes

Party Mode brings multiple specialized agents into ONE conversation where they can:

- Respond to user messages in character with distinct perspectives
- Reference and challenge each other's responses
- Build collaboratively on ideas
- Provide multi-perspective analysis in real-time

### Business Value

- **Quality**: Multi-perspective analysis catches blind spots (40% improvement expected)
- **Speed**: Parallel ideation vs sequential consultation (3 sessions → 1 session)
- **UX**: Natural team discussion instead of agent-hopping
- **Innovation**: Agents build on each other's ideas

### Strategic Context

**Completed Foundation (Phase 1A/1B):**

- Knowledge Base: 1,133 artifacts indexed, <50ms search
- Cost Tracking: Hash-chain integrity, <2ms overhead
- Advanced Elicitation: 15 reasoning methods
- Feature Flags: 3-tier priority system
- Test Coverage: 74 tests passing (100% pass rate)
- Staging Environment: Complete isolation, monitoring

**This Feature Enables:**

- True multi-agent collaboration (vs sequential spawning)
- Complex decision-making with team debate
- Real-time consensus building
- Post-mortem analysis with multiple perspectives

---

## Phases

### Phase 0: Research & Planning (FOUNDATION)

**Purpose**: Validate Party Mode approach, assess security risks, document architecture decisions
**Duration**: 8 hours
**Parallel OK**: No (blocking for subsequent phases)

#### Research Requirements (MANDATORY)

Research has been completed via:

- [x] BMAD-METHOD analysis (bmad-method-analysis-20260128-104050.md)
- [x] Security review (security-mitigation-design-20260128.md)
- [x] Architecture review (architecture-review-upgrade-roadmap-20260128.md)
- [x] Party Mode specification (party-mode-spec.md)

**Research Output**: `.claude/context/artifacts/research-reports/` (completed)

#### Constitution Checkpoint

**CRITICAL VALIDATION**: Before proceeding to Phase 1, ALL of the following MUST pass:

1. **Research Completeness**
   - [x] Research report contains minimum 3 external sources (BMAD-METHOD source code, security patterns, multi-agent coordination papers)
   - [x] All [NEEDS CLARIFICATION] items resolved
   - [x] ADRs created for major decisions (ADR-054 through ADR-057)

2. **Technical Feasibility**
   - [x] Technical approach validated (CSV teams, orchestrator, context isolation)
   - [x] Dependencies identified: Node.js CSV parsing (built-in), no external packages
   - [x] No blocking technical issues discovered

3. **Security Review**
   - [x] Security implications assessed (security-mitigation-design-20260128.md)
   - [x] Threat model documented: 8 penetration test scenarios
   - [x] Mitigations identified: 6 CRITICAL controls + 3 cross-cutting patterns

4. **Specification Quality**
   - [x] Acceptance criteria are measurable (agent selection <2s, full round <90s, max 4 agents)
   - [x] Success criteria are clear (40% quality improvement, 80% repeat usage)
   - [x] Edge cases considered (context overflow, agent conflicts, rate limiting)

**Status**: ✅ All gates PASSED - proceed to Phase 1

#### Phase 0 Tasks

- [x] **0.1** Research Party Mode patterns from BMAD-METHOD (~3 hours)
  - **Output**: bmad-method-analysis-20260128-104050.md
  - **Verify**: Contains team definitions, orchestrator logic, interaction flows

- [x] **0.2** Security threat modeling for multi-agent collaboration (~3 hours)
  - **Output**: security-mitigation-design-20260128.md
  - **Verify**: 6 CRITICAL controls designed with implementation details

- [x] **0.3** Document architecture decisions (~2 hours)
  - **ADRs**: ADR-054 (Orchestration), ADR-055 (Identity), ADR-056 (Isolation), ADR-057 (Consensus)
  - **Output**: Architecture decisions in decisions.md
  - **Verify**: Rationale documented for team format, orchestrator design, context isolation

**Success Criteria**: ✅ Constitution checkpoint passed (all 4 gates green)

---

### Phase 1: Foundations (Security Infrastructure)

**Purpose**: Implement 3 cross-cutting security patterns that ALL Party Mode features depend on
**Dependencies**: Phase 0 complete
**Duration**: 8 hours
**Parallel OK**: No (foundation must be solid before building features)

**Rationale**: Security patterns (Agent Identity, Path Validation, Access Control) are used by ALL 6 CRITICAL controls. Implementing these first prevents rework and ensures consistent security enforcement.

#### Tasks

- [ ] **1.1** Implement Agent Identity Management (~3 hours)
  - **Location**: `.claude/lib/security/agent-identity.cjs`
  - **Functions**:
    - `generateAgentIdentityHash(agentPath)` - SHA-256 hash of path + content
    - `setAgentContext(context)` - Set current agent identity
    - `getAgentContext()` - Retrieve current identity
    - `verifyAgentIdentity(expectedName)` - Verify identity matches
  - **Command**: Create agent-identity.cjs with 5 exported functions
  - **Verify**: `node -e "const ai = require('./.claude/lib/security/agent-identity.cjs'); console.log(ai.generateAgentIdentityHash('.claude/agents/core/developer.md'))"`
  - **Tests**: Unit tests for hash generation, context set/get/clear (8 tests)
  - **Rollback**: `rm .claude/lib/security/agent-identity.cjs`

- [ ] **1.2** Implement Path Validation Utility (~2 hours)
  - **Location**: `.claude/lib/utils/path-validator.cjs`
  - **Functions**:
    - `validatePathSafety(filePath)` - Check dangerous patterns
    - `validatePathContext(filePath, contextName)` - Verify allowlist
    - `validateSidecarOwnership(filePath, agentName)` - Verify ownership
  - **Command**: Create path-validator.cjs with PATH_CONTEXTS config
  - **Verify**: Test with dangerous paths: `../../etc/passwd`, `C:\Windows\System32`
  - **Tests**: Unit tests for all dangerous patterns (12 tests)
  - **Rollback**: `rm .claude/lib/utils/path-validator.cjs`

- [ ] **1.3** Implement Access Control Framework (~3 hours)
  - **Location**: `.claude/lib/security/access-control.cjs`
  - **Functions**:
    - `canWrite(filePath)` - Check write permissions
    - `canRead(filePath)` - Check read permissions
    - `enforceWriteAccess(hookInput)` - Hook integration
    - `enforceReadAccess(hookInput)` - Hook integration
  - **Dependencies**: 1.1 (agent-identity.cjs), 1.2 (path-validator.cjs)
  - **Command**: Create access-control.cjs with read/write enforcement
  - **Verify**: Test sidecar access scenarios (own vs other agent)
  - **Tests**: Unit tests for all access scenarios (10 tests)
  - **Rollback**: `rm .claude/lib/security/access-control.cjs`

#### Phase 1 Verification Gate

```bash
# All must pass before proceeding to Phase 2
node --test .claude/lib/__tests__/security/agent-identity.test.cjs
node --test .claude/lib/__tests__/utils/path-validator.test.cjs
node --test .claude/lib/__tests__/security/access-control.test.cjs
```

**Success Criteria**:

- 30 tests passing (8 + 12 + 10)
- Agent identity hash generates consistently
- Path validation blocks all dangerous patterns
- Access control enforces sidecar ownership

---

### Phase 2: CRITICAL Security Controls

**Purpose**: Implement 2 CRITICAL security controls that BLOCK Party Mode deployment
**Dependencies**: Phase 1 complete
**Duration**: 10 hours
**Parallel OK**: Partial (2.1 and 2.2 can be developed in parallel, but 2.3 integration testing is sequential)

**Rationale**: SEC-PM-004 (Context Isolation) and SEC-PM-006 (Memory Boundaries) are the ONLY controls blocking Party Mode feature release. Without these, agents can interfere with each other's context and memory.

#### Tasks

- [ ] **2.1** Implement Context Isolation (SEC-PM-004) (~5 hours)
  - **Location**: `.claude/lib/security/context-isolator.cjs`
  - **Functions**:
    - `createIsolatedContext(sharedContext, agentConfig)` - Deep clone + filter
    - `verifyContextIsolation(context)` - Verify no leaks
    - `mergeAgentResponse(sharedContext, agentResponse)` - Merge safely
  - **Command**: Create context-isolator.cjs with isolation logic
  - **Verify**: Verify isolated context has no orchestrator metadata
  - **Tests**: Unit tests for clone, filter, merge (8 tests)
  - **Rollback**: `rm .claude/lib/security/context-isolator.cjs`
  - **Attack Tests**:
    - Agent tries to access `_orchestratorState` → Expected: Key not present
    - Agent modifies context → Expected: Other agents unaffected

- [ ] **2.2** Implement Memory Boundary Hook (SEC-PM-006) (~3 hours) [⚡ parallel with 2.1]
  - **Location**: `.claude/hooks/safety/sidecar-access-guard.cjs`
  - **Hook Type**: PreToolUse (Read, Write, Edit)
  - **Enforcement**:
    - Block sidecar access if no agent context
    - Verify ownership for all sidecar operations
    - Use access-control.cjs for decisions
  - **Command**: Create sidecar-access-guard.cjs + register in settings.json
  - **Verify**: Test cross-agent sidecar access (should block)
  - **Tests**: Integration tests with mock tool calls (6 tests)
  - **Rollback**: Remove hook from settings.json, `rm .claude/hooks/safety/sidecar-access-guard.cjs`
  - **Attack Tests**:
    - Developer reads security-architect sidecar → Expected: BLOCKED
    - Path traversal `../security-architect/patterns.md` → Expected: BLOCKED

- [ ] **2.3** Integration Testing (Isolation + Memory Boundaries) (~2 hours)
  - **Location**: `.claude/hooks/__tests__/security/party-mode-security.test.cjs`
  - **Scenarios**:
    - Full Party Mode session with 3 agents
    - Context isolation verification (no cross-contamination)
    - Memory boundary enforcement (cross-agent access blocked)
    - Agent identity verification throughout session
  - **Command**: Create integration test suite
  - **Verify**: All 8 penetration test scenarios pass
  - **Tests**: 8 integration tests
  - **Rollback**: N/A (tests only)

#### Phase 2 Verification Gate

```bash
# Critical security controls MUST pass
node --test .claude/lib/__tests__/security/context-isolator.test.cjs
node --test .claude/hooks/__tests__/safety/sidecar-access-guard.test.cjs
node --test .claude/hooks/__tests__/security/party-mode-security.test.cjs
```

**Success Criteria**:

- 22 tests passing (8 + 6 + 8)
- Context isolation prevents cross-contamination
- Memory boundaries block unauthorized access
- All penetration test scenarios pass

---

### Phase 3: Team Infrastructure

**Purpose**: Build team definition system (CSV format, predefined teams, parser)
**Dependencies**: Phase 2 complete
**Duration**: 6 hours
**Parallel OK**: Yes (all tasks can be done in parallel)

**Rationale**: Team infrastructure is independent of orchestrator logic. Creating teams in parallel allows faster iteration.

#### Tasks

- [ ] **3.1** Create `.claude/teams/` directory structure (~0.5 hours) [⚡ parallel OK]
  - **Command**: `mkdir -p .claude/teams/custom`
  - **Verify**: `ls -d .claude/teams`
  - **Rollback**: `rm -rf .claude/teams`

- [ ] **3.2** Design Team CSV Schema (~1 hour) [⚡ parallel OK]
  - **Fields**: name, displayName, icon, role, identity, communicationStyle, agentPath
  - **Documentation**: Add schema to `.claude/docs/PARTY_MODE_TEAMS.md`
  - **Command**: Document schema with examples
  - **Verify**: Schema documented with 7 required fields
  - **Rollback**: N/A (documentation only)

- [ ] **3.3** Create default.csv team definition (~1.5 hours) [⚡ parallel OK]
  - **Location**: `.claude/teams/default.csv`
  - **Members**: Developer (Dev Lead), Architect (System Architect), PM (Product Manager), QA (QA Lead), Security Architect (Security Lead)
  - **Command**: Create CSV with 5 team members
  - **Verify**: `cat .claude/teams/default.csv | wc -l` (6 lines: header + 5 agents)
  - **Rollback**: `rm .claude/teams/default.csv`

- [ ] **3.4** Create creative.csv team definition (~1 hour) [⚡ parallel OK]
  - **Location**: `.claude/teams/creative.csv`
  - **Members**: UX Designer, Technical Writer, PM, Innovation Strategist (TBD - may need new agent)
  - **Command**: Create CSV with 4 team members
  - **Verify**: `cat .claude/teams/creative.csv | wc -l` (5 lines: header + 4 agents)
  - **Rollback**: `rm .claude/teams/creative.csv`

- [ ] **3.5** Create technical.csv team definition (~1 hour) [⚡ parallel OK]
  - **Location**: `.claude/teams/technical.csv`
  - **Members**: Architect, DevOps, Database Architect, Developer
  - **Command**: Create CSV with 4 team members
  - **Verify**: `cat .claude/teams/technical.csv | wc -l` (5 lines: header + 4 agents)
  - **Rollback**: `rm .claude/teams/technical.csv`

- [ ] **3.6** Implement team-loader.cjs (~2 hours) [⚡ parallel with 3.3-3.5]
  - **Location**: `.claude/skills/party-mode/team-loader.cjs`
  - **Functions**:
    - `loadTeam(teamName)` - Load and parse CSV
    - `validateTeamMember(member)` - Validate required fields
    - `listAvailableTeams()` - List all teams in directory
  - **Command**: Create team-loader.cjs with CSV parsing
  - **Verify**: `node -e "const tl = require('./.claude/skills/party-mode/team-loader.cjs'); console.log(tl.loadTeam('default'))"`
  - **Tests**: Unit tests for CSV parsing, validation (5 tests)
  - **Rollback**: `rm .claude/skills/party-mode/team-loader.cjs`

#### Phase 3 Verification Gate

```bash
# Verify team infrastructure
ls -la .claude/teams/*.csv
node --test .claude/skills/party-mode/__tests__/team-loader.test.cjs
node -e "const tl = require('./.claude/skills/party-mode/team-loader.cjs'); console.log(JSON.stringify(tl.loadTeam('default'), null, 2))"
```

**Success Criteria**:

- 3 team CSV files created (default, creative, technical)
- Team schema documented with 7 fields
- team-loader.cjs parses all teams successfully
- 5 tests passing

---

### Phase 4: Orchestrator Core

**Purpose**: Implement orchestrator logic (agent selection, message classification, prompt building)
**Dependencies**: Phase 3 complete
**Duration**: 10 hours
**Parallel OK**: No (orchestrator logic is sequential - selection → classification → prompting)

**Rationale**: Orchestrator is the brain of Party Mode. Careful implementation required to ensure agents are selected correctly and receive proper context.

#### Tasks

- [ ] **4.1** Implement message classification (~2 hours)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `classifyMessage(message)` - Pattern matching for topic detection
  - **Patterns**: architecture, security, feature, testing, performance, design, database, deployment
  - **Command**: Create orchestrator.cjs with classification function
  - **Verify**: Test with sample messages ("Should we use microservices?" → architecture)
  - **Tests**: Unit tests for all 8 patterns (8 tests)
  - **Rollback**: `rm .claude/skills/party-mode/orchestrator.cjs`

- [ ] **4.2** Implement agent selection logic (~4 hours)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `selectAgents(message, team, history)` - Select 2-4 relevant agents
  - **Selection Rules**:
    - architecture: [architect, developer, security-architect]
    - security: [security-architect, architect, devops]
    - feature: [pm, developer, ux]
    - testing: [qa, developer, security-architect]
    - performance: [architect, devops, developer]
    - design: [ux, pm, developer]
    - database: [database-architect, architect, developer]
    - deployment: [devops, architect, security-architect]
    - general: [pm, architect, developer]
  - **Command**: Implement selection function with rules engine
  - **Verify**: Test with different message types
  - **Tests**: Unit tests for all 9 scenarios (9 tests)
  - **Rollback**: Revert function in orchestrator.cjs

- [ ] **4.3** Implement context threading (~3 hours)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `buildAgentPrompt(agent, userMessage, previousResponses)` - Build agent prompt with context
  - **Context Includes**:
    - Agent identity and communication style
    - User message
    - Previous agent responses (formatted: **[Icon] [Name]:** content)
  - **Command**: Implement prompt builder
  - **Verify**: Test prompt includes previous responses
  - **Tests**: Unit tests for prompt structure (4 tests)
  - **Rollback**: Revert function in orchestrator.cjs

- [ ] **4.4** Implement response formatting (~1 hour)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `formatAgentResponse(agent, content)` - Format response with icon and name
  - **Format**: `**[Icon] [Display Name]:** [content]`
  - **Command**: Implement formatter
  - **Verify**: Test response format matches spec
  - **Tests**: Unit tests for formatting (2 tests)
  - **Rollback**: Revert function in orchestrator.cjs

#### Phase 4 Verification Gate

```bash
# Verify orchestrator functions
node --test .claude/skills/party-mode/__tests__/orchestrator.test.cjs
node -e "const orc = require('./.claude/skills/party-mode/orchestrator.cjs'); console.log(orc.classifyMessage('Should we use microservices?'))"
```

**Success Criteria**:

- 23 tests passing (8 + 9 + 4 + 2)
- Message classification covers all 8 topics
- Agent selection returns 2-4 agents for any message
- Prompt includes previous responses for context threading

---

### Phase 5: Party Mode Skill Integration

**Purpose**: Create party-mode skill that ties everything together and integrates with router
**Dependencies**: Phase 4 complete
**Duration**: 8 hours
**Parallel OK**: Partial (5.1-5.3 sequential, 5.4-5.6 can be parallel with 5.3)

**Rationale**: This phase makes Party Mode accessible to users via `/party-mode` command. Careful integration with router and Task tool is critical.

#### Tasks

- [ ] **5.1** Create party-mode SKILL.md (~2 hours)
  - **Location**: `.claude/skills/party-mode/SKILL.md`
  - **Sections**:
    - Identity (Party Mode Orchestrator)
    - Capabilities (multi-agent collaboration)
    - Instructions (invocation, team selection, exit)
    - Examples (sample conversation)
    - Integration (router routing, Task tool usage)
  - **Command**: Create SKILL.md with complete skill definition
  - **Verify**: SKILL.md follows skill template structure
  - **Rollback**: `rm .claude/skills/party-mode/SKILL.md`

- [ ] **5.2** Implement @name direct addressing (~2 hours)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `parseDirectAddress(message)` - Extract @name mentions
  - **Logic**: If message contains `@agent-name`, route only to that agent
  - **Command**: Add direct addressing logic to orchestrator
  - **Verify**: Test "@security What about auth?" → routes only to security-architect
  - **Tests**: Unit tests for @name parsing (4 tests)
  - **Rollback**: Revert function in orchestrator.cjs

- [ ] **5.3** Implement /team switching (~1 hour)
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `switchTeam(teamName)` - Load different team CSV
  - **Logic**: Reload team via team-loader.cjs, reset session context
  - **Command**: Add team switching logic
  - **Verify**: Test "/team creative" → loads creative.csv
  - **Tests**: Unit tests for team switching (2 tests)
  - **Rollback**: Revert function in orchestrator.cjs

- [ ] **5.4** Implement /exit with session summary (~1 hour) [⚡ parallel with 5.3]
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Function**: `exitPartyMode(sessionHistory)` - Generate summary and save
  - **Summary Includes**:
    - Key decisions made
    - Participants
    - Next steps identified
  - **Output**: `.claude/context/sessions/party-mode-YYYYMMDD-HHMMSS.md`
  - **Command**: Add exit logic with summary generation
  - **Verify**: Exit creates session file with summary
  - **Tests**: Unit tests for summary generation (3 tests)
  - **Rollback**: Revert function in orchestrator.cjs

- [ ] **5.5** Implement session audit logging (SEC-PM-003) (~1 hour) [⚡ parallel with 5.3]
  - **Location**: `.claude/hooks/session/party-mode-audit.cjs`
  - **Hook Type**: PostToolUse (Task)
  - **Log Entry**: timestamp, sessionId, agentId, responseHash, contentLength
  - **Output**: `.claude/context/metrics/party-mode-audit.jsonl`
  - **Command**: Create audit hook + register in settings.json
  - **Verify**: Party Mode session creates audit log
  - **Tests**: Integration test for audit logging (2 tests)
  - **Rollback**: Remove hook from settings.json, `rm .claude/hooks/session/party-mode-audit.cjs`

- [ ] **5.6** Implement agent rate limiting (SEC-PM-005) (~1 hour) [⚡ parallel with 5.3]
  - **Location**: `.claude/skills/party-mode/orchestrator.cjs`
  - **Limits**: MAX_AGENTS_PER_ROUND: 4, MAX_ROUNDS: 10
  - **Enforcement**: Trim agent list if > 4, throw error if rounds >= 10
  - **Command**: Add rate limiting checks to orchestrator
  - **Verify**: Test with 11 rounds → error thrown
  - **Tests**: Unit tests for rate limiting (3 tests)
  - **Rollback**: Revert function in orchestrator.cjs

#### Phase 5 Verification Gate

```bash
# Verify party-mode skill integration
node --test .claude/skills/party-mode/__tests__/integration.test.cjs
ls -la .claude/skills/party-mode/SKILL.md
grep -c "SEC-PM-003\|SEC-PM-005" .claude/skills/party-mode/orchestrator.cjs
```

**Success Criteria**:

- 14 tests passing (4 + 2 + 3 + 2 + 3)
- SKILL.md complete with examples
- Direct addressing (@name) routes to specific agent
- Team switching loads different CSV
- Exit generates session summary
- Audit logging captures all responses
- Rate limiting enforces max agents and rounds

---

### Phase 6: Testing & Validation

**Purpose**: Comprehensive testing (unit, integration, E2E, penetration tests)
**Dependencies**: Phase 5 complete
**Duration**: 6 hours
**Parallel OK**: Yes (test suites are independent)

**Rationale**: Party Mode introduces complex multi-agent interactions. Comprehensive testing is essential to validate security controls and feature correctness.

#### Tasks

- [ ] **6.1** Write E2E tests for Party Mode (~2 hours) [⚡ parallel OK]
  - **Location**: `.claude/__tests__/e2e/party-mode-e2e.test.mjs`
  - **Scenarios**:
    - Complete Party Mode session (enter → question → responses → exit)
    - Team switching during session
    - Direct addressing with @name
    - Multi-round conversation (5+ rounds)
  - **Command**: Create E2E test suite
  - **Verify**: All scenarios pass
  - **Tests**: 5 E2E tests
  - **Rollback**: N/A (tests only)

- [ ] **6.2** Penetration testing for security controls (~2 hours) [⚡ parallel OK]
  - **Location**: `.claude/hooks/__tests__/security/penetration-tests.test.cjs`
  - **Scenarios** (from security-mitigation-design):
    - PEN-001: Agent impersonation (fake identity)
    - PEN-002: Sidecar privilege escalation (read other agent's patterns)
    - PEN-005: Context leakage (Agent A reads Agent B's context)
    - PEN-007: Response tampering (modify previous response)
    - PEN-008: Memory boundary bypass (write to other sidecar)
  - **Command**: Create penetration test suite
  - **Verify**: All attacks blocked as expected
  - **Tests**: 5 penetration tests
  - **Rollback**: N/A (tests only)

- [ ] **6.3** Performance benchmarking (~1 hour) [⚡ parallel OK]
  - **Location**: `.claude/__tests__/performance/party-mode-perf.test.mjs`
  - **Benchmarks**:
    - Agent selection time (target: <2s)
    - Agent spawn time (target: <100ms per agent)
    - Message routing (target: <5ms)
    - Full round time (target: <90s for 4 agents)
  - **Command**: Create performance benchmark suite
  - **Verify**: All targets met
  - **Tests**: 4 performance tests
  - **Rollback**: N/A (tests only)

- [ ] **6.4** Regression testing (existing test suite) (~1 hour) [⚡ parallel OK]
  - **Command**: `npm test`
  - **Verify**: All 74 existing tests still pass (zero regressions)
  - **Expected**: 74 + 35 new Party Mode tests = 109 total tests passing
  - **Rollback**: N/A (validation only)

#### Phase 6 Verification Gate

```bash
# Run complete test suite
npm test
node --test .claude/__tests__/e2e/party-mode-e2e.test.mjs
node --test .claude/hooks/__tests__/security/penetration-tests.test.cjs
node --test .claude/__tests__/performance/party-mode-perf.test.mjs
```

**Success Criteria**:

- 109 total tests passing (74 existing + 35 new)
- All E2E scenarios complete successfully
- All penetration tests block attacks as expected
- All performance benchmarks meet targets
- Zero regressions in existing tests

---

### Phase 7: Documentation & Feature Flag

**Purpose**: Complete documentation, enable feature flag, update routing
**Dependencies**: Phase 6 complete
**Duration**: 3 hours
**Parallel OK**: Yes (all documentation tasks are independent)

**Rationale**: Documentation is critical for user adoption. Feature flag ensures safe rollout.

#### Tasks

- [ ] **7.1** Write Party Mode user guide (~1 hour) [⚡ parallel OK]
  - **Location**: `.claude/docs/PARTY_MODE.md`
  - **Sections**:
    - Overview (what is Party Mode)
    - Getting Started (how to invoke `/party-mode`)
    - Teams (default, creative, technical)
    - Commands (@name, /team, /exit)
    - Examples (sample conversations)
    - Troubleshooting
    - Security (what controls are in place)
  - **Command**: Create user guide
  - **Verify**: Guide covers all user-facing features
  - **Rollback**: `rm .claude/docs/PARTY_MODE.md`

- [ ] **7.2** Update CLAUDE.md routing table (~0.5 hours) [⚡ parallel OK]
  - **Location**: `.claude/CLAUDE.md`
  - **Update**: Add Party Mode to routing table and workflows section
  - **Entry**: "Multi-agent collaboration, Party Mode → party-mode skill"
  - **Command**: Edit CLAUDE.md
  - **Verify**: Router recognizes "party mode" keyword
  - **Rollback**: Revert changes to CLAUDE.md

- [ ] **7.3** Update feature flags configuration (~0.5 hours) [⚡ parallel OK]
  - **Location**: `.claude/config.yaml` (production), `.claude/config.staging.yaml` (staging)
  - **Flag**: `partyMode.enabled: false` (production), `partyMode.enabled: true` (staging)
  - **Command**: Update config files
  - **Verify**: Feature flag checked before Party Mode invocation
  - **Rollback**: Revert config changes

- [ ] **7.4** Create Party Mode examples (~1 hour) [⚡ parallel OK]
  - **Location**: `.claude/docs/examples/party-mode-examples.md`
  - **Examples**:
    - Architecture decision (microservices vs monolith)
    - Security review (authentication approach)
    - Feature brainstorming (new feature ideas)
    - Post-mortem analysis (incident review)
  - **Command**: Create examples document
  - **Verify**: Each example shows multi-agent interaction
  - **Rollback**: `rm .claude/docs/examples/party-mode-examples.md`

#### Phase 7 Verification Gate

```bash
# Verify documentation
ls -la .claude/docs/PARTY_MODE.md .claude/docs/examples/party-mode-examples.md
grep "party-mode" .claude/CLAUDE.md
grep "partyMode.enabled" .claude/config.yaml .claude/config.staging.yaml
```

**Success Criteria**:

- User guide complete with examples and troubleshooting
- CLAUDE.md updated with party-mode routing
- Feature flag configured (false in production, true in staging)
- 4 example conversations documented

---

### Phase [FINAL]: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction

**Tasks**:

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities (new agents/skills needed)

**Spawn Command**:

```javascript
Task({
  subagent_type: 'reflection-agent',
  description: 'Session reflection and learning extraction',
  prompt:
    'You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed Party Mode implementation, extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created).',
});
```

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

---

## Security Controls Summary

### 6 CRITICAL Controls Implemented

| Control ID | Severity | Phase   | Description                                                 |
| ---------- | -------- | ------- | ----------------------------------------------------------- |
| SEC-PM-004 | CRITICAL | Phase 2 | Context Isolation (copy-on-spawn, no shared references)     |
| SEC-PM-006 | CRITICAL | Phase 2 | Memory Boundaries (sidecar ownership enforcement)           |
| SEC-PM-001 | HIGH     | Phase 1 | Agent Identity Verification (hash-based)                    |
| SEC-PM-002 | HIGH     | Phase 4 | Response Integrity (hash-chain)                             |
| SEC-PM-003 | MEDIUM   | Phase 5 | Session Audit Log (all responses logged)                    |
| SEC-PM-005 | MEDIUM   | Phase 5 | Agent Rate Limiting (max 4 agents/round, 10 rounds/session) |

### 3 Cross-Cutting Patterns

| Pattern                   | Phase   | Purpose                                                          |
| ------------------------- | ------- | ---------------------------------------------------------------- |
| Agent Identity Management | Phase 1 | Hash-based agent identity for all controls                       |
| Path Validation Utility   | Phase 1 | Validate all file paths (sidecar, knowledge base, cost tracking) |
| Access Control Framework  | Phase 1 | Unified read/write permissions for all agents                    |

---

## Testing Strategy

### Test Coverage Targets

| Component           | Target | Tests | Phase   |
| ------------------- | ------ | ----- | ------- |
| Agent Identity      | 90%    | 8     | Phase 1 |
| Path Validation     | 100%   | 12    | Phase 1 |
| Access Control      | 95%    | 10    | Phase 1 |
| Context Isolation   | 90%    | 8     | Phase 2 |
| Memory Boundaries   | 90%    | 6     | Phase 2 |
| Team Infrastructure | 80%    | 5     | Phase 3 |
| Orchestrator Core   | 85%    | 23    | Phase 4 |
| Skill Integration   | 80%    | 14    | Phase 5 |
| E2E Tests           | N/A    | 5     | Phase 6 |
| Penetration Tests   | N/A    | 5     | Phase 6 |
| Performance Tests   | N/A    | 4     | Phase 6 |

**Total Tests**: 109 (74 existing + 35 new)

### Penetration Testing Scenarios

| ID      | Scenario                     | Attack Vector                   | Expected Mitigation                                       | Phase   |
| ------- | ---------------------------- | ------------------------------- | --------------------------------------------------------- | ------- |
| PEN-001 | Agent Impersonation          | Fake agent identity             | SEC-PM-001 identity hash verification → Response rejected | Phase 6 |
| PEN-002 | Sidecar Privilege Escalation | Read other agent's patterns     | SEC-SM-005 read restrictions → Access denied              | Phase 6 |
| PEN-005 | Context Leakage              | Agent A reads Agent B's context | SEC-PM-004 isolation → Keys not present                   | Phase 6 |
| PEN-007 | Response Tampering           | Modify previous response        | SEC-PM-002 hash chain → Chain broken, detected            | Phase 6 |
| PEN-008 | Memory Boundary Bypass       | Write to other sidecar          | SEC-PM-006 hook → Write blocked                           | Phase 6 |

---

## Performance Targets

| Metric                     | Target  | Phase   | Measurement Method              |
| -------------------------- | ------- | ------- | ------------------------------- |
| Agent Selection Time       | < 2s    | Phase 4 | Benchmark in orchestrator.cjs   |
| Agent Spawn Time           | < 100ms | Phase 5 | Benchmark Task tool spawn       |
| Message Routing            | < 5ms   | Phase 5 | Benchmark orchestrator routing  |
| Full Round (4 agents)      | < 90s   | Phase 5 | E2E test measurement            |
| Context Isolation Overhead | < 10ms  | Phase 2 | Benchmark createIsolatedContext |
| Memory Boundary Check      | < 1ms   | Phase 2 | Benchmark canRead/canWrite      |

---

## Rollback Strategy

### Per-Phase Rollback

| Phase   | Rollback Command                                                                                                              | Data Loss Risk | Recovery Time |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| Phase 1 | `rm .claude/lib/security/*.cjs .claude/lib/utils/path-validator.cjs`                                                          | None           | Immediate     |
| Phase 2 | `rm .claude/lib/security/context-isolator.cjs .claude/hooks/safety/sidecar-access-guard.cjs` + remove hook from settings.json | None           | Immediate     |
| Phase 3 | `rm -rf .claude/teams .claude/skills/party-mode/team-loader.cjs`                                                              | None           | Immediate     |
| Phase 4 | `rm .claude/skills/party-mode/orchestrator.cjs`                                                                               | None           | Immediate     |
| Phase 5 | `rm -rf .claude/skills/party-mode` + remove from CLAUDE.md                                                                    | None           | 5 minutes     |
| Phase 6 | N/A (tests only)                                                                                                              | None           | N/A           |
| Phase 7 | Revert documentation changes, disable feature flag                                                                            | None           | 2 minutes     |

### Complete Rollback

If Party Mode needs to be completely removed:

```bash
# 1. Disable feature flag
sed -i 's/partyMode.enabled: true/partyMode.enabled: false/' .claude/config.yaml

# 2. Remove all Party Mode files
rm -rf .claude/teams
rm -rf .claude/skills/party-mode
rm .claude/lib/security/agent-identity.cjs
rm .claude/lib/security/context-isolator.cjs
rm .claude/lib/security/access-control.cjs
rm .claude/lib/utils/path-validator.cjs
rm .claude/hooks/safety/sidecar-access-guard.cjs
rm .claude/hooks/session/party-mode-audit.cjs

# 3. Remove hook registrations from settings.json
# (Manual edit: remove sidecar-access-guard and party-mode-audit entries)

# 4. Revert CLAUDE.md changes
git checkout .claude/CLAUDE.md

# 5. Remove documentation
rm .claude/docs/PARTY_MODE.md
rm .claude/docs/examples/party-mode-examples.md

# 6. Run tests to verify clean state
npm test
```

**Recovery Time**: 10 minutes
**Data Loss**: None (all Party Mode data is in dedicated directories)

---

## File Inventory

### New Directories (10)

```
.claude/teams/
.claude/teams/custom/
.claude/skills/party-mode/
.claude/skills/party-mode/__tests__/
.claude/lib/security/
.claude/lib/__tests__/security/
.claude/lib/__tests__/utils/
.claude/hooks/safety/
.claude/hooks/__tests__/security/
.claude/docs/examples/
```

### New Files (25+)

**Phase 1 (Foundations):**

- `.claude/lib/security/agent-identity.cjs` (150 lines)
- `.claude/lib/utils/path-validator.cjs` (300 lines)
- `.claude/lib/security/access-control.cjs` (250 lines)
- `.claude/lib/__tests__/security/agent-identity.test.cjs` (200 lines)
- `.claude/lib/__tests__/utils/path-validator.test.cjs` (300 lines)
- `.claude/lib/__tests__/security/access-control.test.cjs` (250 lines)

**Phase 2 (Security):**

- `.claude/lib/security/context-isolator.cjs` (250 lines)
- `.claude/hooks/safety/sidecar-access-guard.cjs` (100 lines)
- `.claude/hooks/__tests__/security/party-mode-security.test.cjs` (300 lines)
- `.claude/lib/__tests__/security/context-isolator.test.cjs` (200 lines)

**Phase 3 (Teams):**

- `.claude/teams/default.csv` (6 lines)
- `.claude/teams/creative.csv` (5 lines)
- `.claude/teams/technical.csv` (5 lines)
- `.claude/skills/party-mode/team-loader.cjs` (150 lines)
- `.claude/skills/party-mode/__tests__/team-loader.test.cjs` (150 lines)
- `.claude/docs/PARTY_MODE_TEAMS.md` (100 lines)

**Phase 4 (Orchestrator):**

- `.claude/skills/party-mode/orchestrator.cjs` (500 lines)
- `.claude/skills/party-mode/__tests__/orchestrator.test.cjs` (500 lines)

**Phase 5 (Integration):**

- `.claude/skills/party-mode/SKILL.md` (300 lines)
- `.claude/hooks/session/party-mode-audit.cjs` (100 lines)
- `.claude/skills/party-mode/__tests__/integration.test.cjs` (300 lines)

**Phase 6 (Testing):**

- `.claude/__tests__/e2e/party-mode-e2e.test.mjs` (400 lines)
- `.claude/hooks/__tests__/security/penetration-tests.test.cjs` (400 lines)
- `.claude/__tests__/performance/party-mode-perf.test.mjs` (200 lines)

**Phase 7 (Documentation):**

- `.claude/docs/PARTY_MODE.md` (500 lines)
- `.claude/docs/examples/party-mode-examples.md` (400 lines)

**Total Lines of Code**: ~6,000 lines (implementation + tests + documentation)

---

## Dependencies

### Internal Dependencies

- Knowledge Base Indexing (Phase 1A - already completed)
- Feature Flags (Phase 1A - already completed)
- Task tool (existing)
- Router (existing - requires routing table update)

### External Dependencies

**NONE** - Party Mode uses only Node.js built-in modules:

- `fs` (file operations)
- `path` (path manipulation)
- `crypto` (hash generation)
- `readline` (CSV parsing - built-in)

---

## Success Metrics

| Metric             | Baseline    | Target           | Measurement Period          |
| ------------------ | ----------- | ---------------- | --------------------------- |
| Decision Quality   | -           | +40% improvement | 30 days post-launch         |
| Time to Decision   | ~3 sessions | 1 session        | 30 days post-launch         |
| User Engagement    | -           | 80% repeat usage | 90 days post-launch         |
| Agent Coherence    | -           | 90% in-character | Manual review (20 sessions) |
| Security Incidents | 0           | 0                | Continuous monitoring       |
| Performance SLA    | -           | 95% meet targets | Continuous monitoring       |

---

## Timeline Summary

| Phase     | Duration     | Dependencies | Parallel? | Checkpoint                                              |
| --------- | ------------ | ------------ | --------- | ------------------------------------------------------- |
| Phase 0   | COMPLETE     | None         | No        | ✅ All gates passed                                     |
| Phase 1   | 8 hours      | Phase 0      | No        | 30 tests passing                                        |
| Phase 2   | 10 hours     | Phase 1      | Partial   | 22 tests passing, penetration tests pass                |
| Phase 3   | 6 hours      | Phase 2      | Yes       | 3 CSVs created, 5 tests passing                         |
| Phase 4   | 10 hours     | Phase 3      | No        | 23 tests passing                                        |
| Phase 5   | 8 hours      | Phase 4      | Partial   | 14 tests passing, feature integrated                    |
| Phase 6   | 6 hours      | Phase 5      | Yes       | 109 total tests passing, zero regressions               |
| Phase 7   | 3 hours      | Phase 6      | Yes       | Documentation complete, feature flag enabled in staging |
| **Total** | **49 hours** |              |           | **~6-7 weeks**                                          |

---

## Risk Assessment

| Risk                                     | Impact   | Probability | Mitigation                                                 | Owner      |
| ---------------------------------------- | -------- | ----------- | ---------------------------------------------------------- | ---------- |
| Context window overflow in long sessions | HIGH     | MEDIUM      | Implement session history summarization after 5 rounds     | Phase 5    |
| Agent responses inconsistent             | MEDIUM   | MEDIUM      | Strict prompt templates + identity definitions in CSV      | Phase 3, 4 |
| Performance degradation with 4 agents    | MEDIUM   | MEDIUM      | Benchmark early (Phase 6), optimize orchestrator if needed | Phase 6    |
| Security control bypass                  | CRITICAL | LOW         | Comprehensive penetration testing (Phase 6)                | Phase 6    |
| Feature flag misconfiguration            | MEDIUM   | LOW         | Default to false, document clearly                         | Phase 7    |
| Team CSV format errors                   | LOW      | MEDIUM      | Validation in team-loader.cjs                              | Phase 3    |

---

## Next Steps After Plan Approval

1. **Immediate**: Create Phase 1 tasks in TaskCreate
2. **Week 1**: Complete Phase 1 (Foundations) - 8 hours
3. **Week 2**: Complete Phase 2 (CRITICAL Security Controls) - 10 hours
4. **Week 3**: Complete Phase 3 (Team Infrastructure) - 6 hours
5. **Week 4**: Complete Phase 4 (Orchestrator Core) - 10 hours
6. **Week 5**: Complete Phase 5 (Skill Integration) - 8 hours
7. **Week 6**: Complete Phase 6 (Testing) - 6 hours
8. **Week 7**: Complete Phase 7 (Documentation) + deploy to staging

---

**Plan Status**: ✅ Ready for Implementation
**Constitution Checkpoint**: ✅ All 4 gates PASSED
**Total Effort**: 49 hours (~6-7 weeks)
**Risk Level**: MEDIUM (mitigated with TDD + comprehensive testing)
**Confidence**: HIGH (clear requirements, security-first approach, proven patterns from BMAD-METHOD)
