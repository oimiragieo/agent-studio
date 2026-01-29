# Agent-Studio Upgrade Roadmap

**Version**: 1.0.0
**Date**: 2026-01-28
**Author**: SYNTHESIS & PLANNING Agent
**Framework Version**: v2.2.1
**Status**: Phase 0 - Research Complete

---

## Executive Summary

This roadmap synthesizes findings from three research reports to create a 6-month upgrade plan delivering 16 high-value features across 3 phases. The plan prioritizes features by Value × Feasibility scoring, addresses capability gaps, and preserves our existing strengths (router-first, EVOLVE, security-first architecture).

**Total Estimated Effort**: 76 hours (sequential), ~52 hours (with parallelization)
**Features Delivered**: 16
**Risk Level**: MEDIUM (phased approach, no breaking changes)

---

## Phase 0: Research & Planning (FOUNDATION) ✓ COMPLETE

**Purpose**: Research unknowns, validate technical approach, assess security
**Duration**: 8 hours
**Parallel OK**: No (blocking for subsequent phases)

### Research Requirements ✓ COMPLETE

- [x] BMAD-METHOD analysis (3+ research queries)
- [x] Current capabilities inventory (comprehensive audit)
- [x] SOTA best practices research (industry trends)
- [x] Synthesis report generated and saved
- [x] Design decisions documented with rationale

**Research Output**:

- `.claude/context/artifacts/research-reports/bmad-method-analysis-20260128-104050.md`
- `.claude/context/artifacts/research-reports/current-capabilities-20260128-103709.md`
- `.claude/context/artifacts/research-reports/upgrade-roadmap-synthesis-20260128.md`

### Constitution Checkpoint ✓ PASSED

1. **Research Completeness** ✓
   - [x] Research report contains 3+ external sources (BMAD, VIGIL, MARS, RECE, LLM-Rubric)
   - [x] All unknowns resolved (BMAD capabilities mapped, gaps identified)
   - [x] ADRs created for major decisions (preserve existing strengths, avoid Workflow Engine)

2. **Technical Feasibility** ✓
   - [x] Technical approach validated (additive features, no breaking changes)
   - [x] Dependencies identified (KB Indexing → Party Mode → Menu System)
   - [x] No blocking technical issues (BMAD features compatible with our architecture)

3. **Security Review** ✓
   - [x] Security implications assessed (Party Mode needs agent sandboxing)
   - [x] Threat model documented (multi-agent STRIDE analysis required for Party Mode)
   - [x] Mitigations identified (leverage existing security-architect review)

4. **Specification Quality** ✓
   - [x] Acceptance criteria are measurable (see success metrics)
   - [x] Success criteria are clear (per-phase checkpoints)
   - [x] Edge cases considered (parallel execution races, memory conflicts)

---

## Phase 1: Foundation (Weeks 1-8)

**Purpose**: Deliver highest-value features with lowest complexity
**Dependencies**: Phase 0 complete
**Parallel OK**: Partial (KB Indexing, Advanced Elicitation, Legacy Cleanup can run in parallel)

### Feature 1.1: Knowledge Base Indexing

- **Value**: 8/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: RAG patterns (2/2)
- **Estimated Effort**: 2 weeks (16 hours)

**Implementation Tasks**:

| Task ID | Description                                     | Command                             | Verify                           | Effort |
| ------- | ----------------------------------------------- | ----------------------------------- | -------------------------------- | ------ |
| KB-1.1  | Create `.claude/knowledge/` directory structure | `mkdir -p .claude/knowledge`        | `ls .claude/knowledge`           | 0.5h   |
| KB-1.2  | Create skill-index.csv with all 431 skills      | `Skill({ skill: "skill-creator" })` | CSV exists with 431 rows         | 4h     |
| KB-1.3  | Add tags: domain, complexity, use-case, tools   | Edit skill-index.csv                | Tags present in all rows         | 4h     |
| KB-1.4  | Create `knowledge-search.cjs` utility           | Write to `.claude/lib/utils/`       | `node knowledge-search.cjs test` | 4h     |
| KB-1.5  | Update agent prompts to use index               | Edit 10 core agents                 | Agents reference index           | 3h     |
| KB-1.6  | Write tests for knowledge search                | Create test file                    | 10+ tests passing                | 0.5h   |

**Success Criteria**:

- 90% of skills indexed with tags
- knowledge-search utility operational
- 10 core agents using index for discovery

---

### Feature 1.2: Advanced Elicitation (Meta-Cognitive Reasoning)

- **Value**: 9/10
- **Complexity**: LOW-MEDIUM
- **Dependencies**: None
- **SOTA Alignment**: Chain-of-Thought, RECE (2/2)
- **Estimated Effort**: 2 weeks (16 hours)

**Implementation Tasks**:

| Task ID | Description                                   | Command                              | Verify                      | Effort |
| ------- | --------------------------------------------- | ------------------------------------ | --------------------------- | ------ |
| AE-1.1  | Create `.claude/reasoning-methods/` directory | `mkdir -p .claude/reasoning-methods` | Dir exists                  | 0.5h   |
| AE-1.2  | Port 15 reasoning methods from BMAD           | Write 15 markdown files              | 15 files exist              | 6h     |
| AE-1.3  | Create `advanced-elicitation` skill           | `Skill({ skill: "skill-creator" })`  | Skill invocable             | 4h     |
| AE-1.4  | Create method-selector component              | Write selector logic                 | Suggests 5 relevant methods | 2h     |
| AE-1.5  | Integrate with spec-critique workflow         | Edit workflow                        | Elicitation available       | 2h     |
| AE-1.6  | Write tests and documentation                 | Create tests + docs                  | 10+ tests, docs complete    | 1.5h   |

**Reasoning Methods to Port**:

1. First Principles
2. Red Team vs Blue Team
3. Pre-mortem Analysis
4. Socratic Questioning
5. SWOT Analysis
6. Devil's Advocate
7. Six Thinking Hats
8. Second-Order Thinking
9. Inversion
10. Mental Models
11. Analogical Reasoning
12. Opportunity Cost Analysis
13. Failure Modes Analysis
14. Bias Check
15. Constraint Relaxation

**Success Criteria**:

- 15 reasoning methods operational
- Method selector suggests relevant methods
- Integration with spec-critique working

---

### Feature 1.3: Party Mode (Multi-Agent Collaboration)

- **Value**: 10/10
- **Complexity**: MEDIUM
- **Dependencies**: KB Indexing (Feature 1.1)
- **SOTA Alignment**: Multi-perspective AI (2/2)
- **Estimated Effort**: 3 weeks (24 hours)

**Implementation Tasks**:

| Task ID | Description                                           | Command                               | Verify                   | Effort |
| ------- | ----------------------------------------------------- | ------------------------------------- | ------------------------ | ------ |
| PM-1.1  | Create `.claude/teams/` directory                     | `mkdir -p .claude/teams`              | Dir exists               | 0.5h   |
| PM-1.2  | Create default.csv team definition                    | Write CSV with 5 agents               | CSV valid                | 2h     |
| PM-1.3  | Create creative.csv team definition                   | Write CSV with 3 agents               | CSV valid                | 1h     |
| PM-1.4  | Create technical.csv team definition                  | Write CSV with 4 agents               | CSV valid                | 1h     |
| PM-1.5  | Create `party-mode` skill                             | `Skill({ skill: "skill-creator" })`   | Skill invocable          | 8h     |
| PM-1.6  | Implement orchestrator-prompt.md                      | Write orchestrator logic              | Message routing works    | 4h     |
| PM-1.7  | Implement agent response formatting                   | Format as `**[Icon] Name:** response` | Formatting correct       | 2h     |
| PM-1.8  | Add context threading (agents see previous responses) | Implement in skill                    | Threading works          | 3h     |
| PM-1.9  | Write tests and documentation                         | Create tests + docs                   | 15+ tests, docs complete | 2.5h   |

**Team CSV Format**:

```csv
name,displayName,icon,role,communicationStyle,agentPath
developer,Dev Lead,💻,Senior Developer,"Direct and technical",".claude/agents/core/developer.md"
architect,System Architect,🏗️,Technical Architect,"Pragmatic and patterns-focused",".claude/agents/core/architect.md"
```

**Success Criteria**:

- 3 predefined teams (default, creative, technical)
- Party mode skill invocable via `/party-mode`
- Agents respond in character with context threading
- User can conduct multi-agent conversation

---

### Feature 1.4: Legacy Cleanup

- **Value**: 7/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: Engineering excellence (0/2)
- **Estimated Effort**: 1 week (8 hours)

**Implementation Tasks**:

| Task ID | Description                             | Command                                 | Verify               | Effort |
| ------- | --------------------------------------- | --------------------------------------- | -------------------- | ------ |
| LC-1.1  | Audit `_legacy/` directories            | `find . -name "_legacy" -type d`        | List all legacy dirs | 0.5h   |
| LC-1.2  | Verify no active imports from legacy    | `grep -r "_legacy" --include="*.cjs"`   | No active imports    | 1h     |
| LC-1.3  | Create backup of legacy files           | `cp -r _legacy .claude.archive/`        | Backup exists        | 0.5h   |
| LC-1.4  | Remove legacy routing hooks             | `rm -rf .claude/hooks/routing/_legacy/` | Dir removed          | 0.5h   |
| LC-1.5  | Remove deprecated skill directories     | Clean up deprecated skills              | Dirs removed         | 1h     |
| LC-1.6  | Update any broken references            | Fix imports                             | All imports resolve  | 2h     |
| LC-1.7  | Run full test suite                     | `npm test`                              | All tests pass       | 1h     |
| LC-1.8  | Update decisions.md with cleanup record | Append ADR                              | ADR documented       | 1h     |

**Success Criteria**:

- All `_legacy/` directories removed
- No broken imports
- All tests passing
- Cleanup documented in decisions.md

---

### Feature 1.5: Cost Tracking Hook

- **Value**: 8/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: FinOps for AI (1/2)
- **Estimated Effort**: 1 week (8 hours)

**Implementation Tasks**:

| Task ID | Description                        | Command                            | Verify           | Effort |
| ------- | ---------------------------------- | ---------------------------------- | ---------------- | ------ |
| CT-1.1  | Create `cost-tracking.cjs` hook    | Write to `.claude/hooks/session/`  | Hook exists      | 4h     |
| CT-1.2  | Implement token counting per model | Track haiku/sonnet/opus separately | Counts accurate  | 2h     |
| CT-1.3  | Create session cost summary        | Output at session end              | Summary visible  | 1h     |
| CT-1.4  | Write tests                        | Create test file                   | 8+ tests passing | 1h     |

**Hook Logic**:

```javascript
// Track token usage per model tier
const PRICING = {
  haiku: { input: 0.00025, output: 0.00125 }, // per 1K tokens
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 },
};
```

**Success Criteria**:

- Token usage tracked per model
- Session cost summary displayed at end
- Cost visible in session logs

---

### Phase 1 Verification Gate

```bash
# All must pass before proceeding to Phase 2
ls .claude/knowledge/skill-index.csv && echo "✓ KB Indexing"
ls .claude/skills/advanced-elicitation/SKILL.md && echo "✓ Advanced Elicitation"
ls .claude/skills/party-mode/SKILL.md && echo "✓ Party Mode"
ls .claude/hooks/routing/_legacy 2>/dev/null || echo "✓ Legacy Cleanup"
ls .claude/hooks/session/cost-tracking.cjs && echo "✓ Cost Tracking"
npm test && echo "✓ All tests passing"
```

---

## Phase 2: Enhancement (Weeks 9-16)

**Purpose**: Build on foundation with productivity and infrastructure improvements
**Dependencies**: Phase 1 complete
**Parallel OK**: Yes (all features can run in parallel)

### Feature 2.1: Agent Sidecar Memory

- **Value**: 7/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: VIGIL pattern (1/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                                                 | Command                                                                         | Verify                    | Effort |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- | ------ |
| SM-2.1  | Create `.claude/memory/agents/` structure                   | `mkdir -p .claude/memory/agents/{developer,architect,qa,security-architect,pm}` | Dirs exist                | 0.5h   |
| SM-2.2  | Create developer sidecar with coding-standards.md           | Write file                                                                      | File exists               | 1.5h   |
| SM-2.3  | Create architect sidecar with architecture-patterns.md      | Write file                                                                      | File exists               | 1.5h   |
| SM-2.4  | Create qa sidecar with testing-standards.md                 | Write file                                                                      | File exists               | 1.5h   |
| SM-2.5  | Create security-architect sidecar with security-controls.md | Write file                                                                      | File exists               | 1.5h   |
| SM-2.6  | Create pm sidecar with product-standards.md                 | Write file                                                                      | File exists               | 1.5h   |
| SM-2.7  | Update agent prompts to reference sidecars                  | Edit 5 agents                                                                   | Prompts reference sidecar | 2h     |
| SM-2.8  | Add "update memory" action to agents                        | Document action                                                                 | Agents can update         | 1h     |
| SM-2.9  | Write tests                                                 | Create tests                                                                    | 6+ tests passing          | 1h     |

**Success Criteria**:

- 5 key agents have dedicated sidecar directories
- Agents reference their sidecar in prompts
- Agents can update their own memory

---

### Feature 2.2: Agent Menu System

- **Value**: 7/10
- **Complexity**: MEDIUM
- **Dependencies**: KB Indexing (Phase 1)
- **SOTA Alignment**: UX shortcuts (1/2)
- **Estimated Effort**: 3 weeks (20 hours)

**Implementation Tasks**:

| Task ID | Description                            | Command                     | Verify                   | Effort |
| ------- | -------------------------------------- | --------------------------- | ------------------------ | ------ |
| MS-2.1  | Design menu frontmatter format         | Document format             | Format documented        | 1h     |
| MS-2.2  | Add menu to 10 core agent frontmatters | Edit 10 agents              | Menus present            | 4h     |
| MS-2.3  | Implement menu parser in router        | Update router-enforcer.cjs  | Parser works             | 4h     |
| MS-2.4  | Add fuzzy matching (fuse.js or custom) | Implement matching          | "devstory" → "dev-story" | 4h     |
| MS-2.5  | Create menu discovery command          | `/menu` lists all shortcuts | Command works            | 2h     |
| MS-2.6  | Document all shortcuts                 | Update docs                 | Shortcuts documented     | 2h     |
| MS-2.7  | Write tests                            | Create tests                | 12+ tests passing        | 3h     |

**Menu Frontmatter Format**:

```yaml
---
name: Developer
menu:
  - trigger: 'DS, dev-story'
    description: 'Start a development story'
    workflow: 'feature-development'
  - trigger: 'FIX, bug-fix'
    description: 'Fix a bug with TDD'
    skill: 'tdd'
---
```

**Success Criteria**:

- 20+ workflow shortcuts defined
- Fuzzy matching works ("devstory" → "dev-story")
- `/menu` command lists all available shortcuts

---

### Feature 2.3: Sprint Tracking

- **Value**: 6/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: Agile tooling (1/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                                | Command                   | Verify           | Effort |
| ------- | ------------------------------------------ | ------------------------- | ---------------- | ------ |
| ST-2.1  | Create sprint-status.yaml template         | Write template            | Template exists  | 1h     |
| ST-2.2  | Define story status enum                   | Document statuses         | Enum documented  | 0.5h   |
| ST-2.3  | Create sprint-manager.cjs utility          | Write utility             | Utility works    | 4h     |
| ST-2.4  | Update developer workflow to read status   | Edit workflow             | Status read      | 2h     |
| ST-2.5  | Update developer workflow to update status | Edit workflow             | Status updated   | 2h     |
| ST-2.6  | Create CLI visualization                   | Implement `sprint status` | Viz works        | 2h     |
| ST-2.7  | Write tests                                | Create tests              | 8+ tests passing | 0.5h   |

**Sprint Status YAML**:

```yaml
sprint:
  number: 1
  start: 2026-01-28
  end: 2026-02-11

epics:
  - id: EPIC-1
    title: 'Knowledge Base Implementation'
    stories:
      - id: STORY-1.1
        title: 'Create skill index'
        status: done
      - id: STORY-1.2
        title: 'Implement search utility'
        status: in-progress

development_status:
  STORY-1.1: done
  STORY-1.2: in-progress
  STORY-1.3: ready-for-dev
```

**Success Criteria**:

- Story status visible in real-time
- Agents can read/update sprint status
- CLI visualization shows sprint progress

---

### Feature 2.4: Performance Engineering Agent

- **Value**: 7/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: SRE/Platform engineering (1/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                               | Command                             | Verify           | Effort |
| ------- | ----------------------------------------- | ----------------------------------- | ---------------- | ------ |
| PA-2.1  | Research performance engineering patterns | Use research-synthesis              | Report generated | 2h     |
| PA-2.2  | Create performance-pro agent via EVOLVE   | `Skill({ skill: "agent-creator" })` | Agent created    | 4h     |
| PA-2.3  | Define agent skills and capabilities      | Document in agent file              | Skills defined   | 2h     |
| PA-2.4  | Update router-enforcer.cjs for routing    | Add performance keywords            | Routing works    | 2h     |
| PA-2.5  | Add to CLAUDE.md routing table            | Edit CLAUDE.md                      | Table updated    | 0.5h   |
| PA-2.6  | Write tests                               | Create tests                        | 6+ tests passing | 1.5h   |

**Performance-Pro Agent Capabilities**:

- Performance profiling and analysis
- Bottleneck identification
- Optimization recommendations
- Load testing guidance
- Memory leak detection
- Database query optimization

**Success Criteria**:

- performance-pro agent created via EVOLVE
- Routing keywords work (performance, profiling, optimization)
- Agent has 5+ specialized skills

---

### Feature 2.5: Self-Healing Dashboard Stabilization

- **Value**: 6/10
- **Complexity**: MEDIUM
- **Dependencies**: None
- **SOTA Alignment**: Observability (1/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                    | Command         | Verify            | Effort |
| ------- | ------------------------------ | --------------- | ----------------- | ------ |
| SH-2.1  | Audit current BETA components  | List all BETA   | Audit complete    | 1h     |
| SH-2.2  | Fix dashboard.cjs bugs         | Debug and fix   | Bugs fixed        | 4h     |
| SH-2.3  | Add missing tests              | Create tests    | 15+ tests passing | 3h     |
| SH-2.4  | Stabilize memory-dashboard.cjs | Debug and fix   | Dashboard stable  | 2h     |
| SH-2.5  | Promote to STABLE status       | Update maturity | STABLE documented | 1h     |
| SH-2.6  | Document usage                 | Write docs      | Docs complete     | 1h     |

**Success Criteria**:

- All dashboard bugs fixed
- 15+ tests passing
- BETA promoted to STABLE
- Documentation complete

---

### Phase 2 Verification Gate

```bash
# All must pass before proceeding to Phase 3
ls .claude/memory/agents/developer && echo "✓ Agent Sidecar Memory"
grep -q "menu:" .claude/agents/core/developer.md && echo "✓ Agent Menu System"
ls .claude/context/sprint-status.yaml 2>/dev/null && echo "✓ Sprint Tracking (optional)"
ls .claude/agents/domain/performance-pro.md && echo "✓ Performance Agent"
grep -q "STABLE" .claude/lib/self-healing/dashboard.cjs && echo "✓ Self-Healing Stable"
npm test && echo "✓ All tests passing"
```

---

## Phase 3: Advanced (Weeks 17-24)

**Purpose**: Advanced features requiring Phase 1-2 infrastructure
**Dependencies**: Phase 1 + Phase 2 complete
**Parallel OK**: Partial (TestArch, Parallel Exec, Accessibility can run in parallel)

### Feature 3.1: TestArch Module

- **Value**: 8/10
- **Complexity**: MEDIUM-HIGH
- **Dependencies**: KB Indexing, Sprint Tracking
- **SOTA Alignment**: Testing architectures (1/2)
- **Estimated Effort**: 4 weeks (24 hours)

**Implementation Tasks**:

| Task ID | Description                          | Command                             | Verify              | Effort |
| ------- | ------------------------------------ | ----------------------------------- | ------------------- | ------ |
| TA-3.1  | Port test-design workflow from BMAD  | Create workflow                     | Workflow works      | 4h     |
| TA-3.2  | Port nfr-assess workflow from BMAD   | Create workflow                     | Workflow works      | 4h     |
| TA-3.3  | Port test-review workflow from BMAD  | Create workflow                     | Workflow works      | 4h     |
| TA-3.4  | Import TEA knowledge base index      | Create tea-index.csv                | Index exists        | 2h     |
| TA-3.5  | Import 10+ TEA knowledge fragments   | Write fragments                     | Fragments exist     | 4h     |
| TA-3.6  | Create test-architect agent          | `Skill({ skill: "agent-creator" })` | Agent created       | 3h     |
| TA-3.7  | Enhance tdd skill with BMAD patterns | Update skill                        | Patterns integrated | 2h     |
| TA-3.8  | Write tests                          | Create tests                        | 12+ tests passing   | 1h     |

**TestArch Workflows to Port**:

1. test-design - Design test strategies
2. nfr-assess - Non-functional requirements assessment
3. test-review - Review test coverage and quality

**Success Criteria**:

- 3 testing workflows operational
- test-architect agent created
- TEA knowledge base (10+ fragments) available

---

### Feature 3.2: Parallel Execution Enhancement

- **Value**: 7/10
- **Complexity**: MEDIUM-HIGH
- **Dependencies**: Party Mode
- **SOTA Alignment**: Concurrent AI (2/2)
- **Estimated Effort**: 3 weeks (20 hours)

**Implementation Tasks**:

| Task ID | Description                         | Command                     | Verify               | Effort |
| ------- | ----------------------------------- | --------------------------- | -------------------- | ------ |
| PE-3.1  | Audit swarm-coordinator agent       | Review current capabilities | Audit complete       | 2h     |
| PE-3.2  | Enhance parallel spawn capabilities | Update swarm-coordinator    | 5+ concurrent agents | 6h     |
| PE-3.3  | Implement result collection         | Add result collector        | Results collected    | 4h     |
| PE-3.4  | Add timeout handling                | Implement timeouts          | Timeouts work        | 2h     |
| PE-3.5  | Add race condition prevention       | Implement locks             | No races             | 3h     |
| PE-3.6  | Write tests                         | Create tests                | 15+ tests passing    | 3h     |

**Success Criteria**:

- 5+ agents running concurrently
- Results collected from all agents
- No race conditions in parallel execution

---

### Feature 3.3: Result Aggregation

- **Value**: 6/10
- **Complexity**: MEDIUM
- **Dependencies**: Parallel Execution
- **SOTA Alignment**: Ensemble methods (1/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                     | Command           | Verify              | Effort |
| ------- | ------------------------------- | ----------------- | ------------------- | ------ |
| RA-3.1  | Design aggregation patterns     | Document patterns | Patterns documented | 2h     |
| RA-3.2  | Implement consensus aggregation | Create aggregator | Consensus works     | 4h     |
| RA-3.3  | Implement weighted voting       | Add voting logic  | Voting works        | 2h     |
| RA-3.4  | Implement conflict resolution   | Add resolver      | Conflicts resolved  | 2h     |
| RA-3.5  | Write tests                     | Create tests      | 10+ tests passing   | 2h     |

**Aggregation Patterns**:

- Consensus (majority vote)
- Weighted (by agent expertise)
- Confidence-based (by certainty score)
- Union (combine all unique insights)

**Success Criteria**:

- Multi-agent outputs merged correctly
- 4 aggregation patterns implemented
- Conflict resolution working

---

### Feature 3.4: Accessibility Agent

- **Value**: 5/10
- **Complexity**: LOW
- **Dependencies**: None
- **SOTA Alignment**: WCAG compliance (0/2)
- **Estimated Effort**: 2 weeks (12 hours)

**Implementation Tasks**:

| Task ID | Description                         | Command                             | Verify               | Effort |
| ------- | ----------------------------------- | ----------------------------------- | -------------------- | ------ |
| AA-3.1  | Research accessibility patterns     | Use research-synthesis              | Report generated     | 2h     |
| AA-3.2  | Create accessibility-pro agent      | `Skill({ skill: "agent-creator" })` | Agent created        | 4h     |
| AA-3.3  | Define WCAG compliance capabilities | Document in agent                   | Capabilities defined | 2h     |
| AA-3.4  | Update router for routing           | Add accessibility keywords          | Routing works        | 2h     |
| AA-3.5  | Write tests                         | Create tests                        | 6+ tests passing     | 2h     |

**Accessibility-Pro Agent Capabilities**:

- WCAG 2.1 AA/AAA compliance checking
- Screen reader compatibility review
- Color contrast analysis
- Keyboard navigation audit
- ARIA attribute recommendations

**Success Criteria**:

- accessibility-pro agent created
- WCAG compliance capabilities defined
- Routing keywords work (accessibility, WCAG, a11y)

---

### Phase 3 Verification Gate

```bash
# All must pass before Phase FINAL
ls .claude/workflows/test-design.md && echo "✓ TestArch Module"
grep -q "parallel" .claude/agents/orchestrators/swarm-coordinator.md && echo "✓ Parallel Execution"
ls .claude/lib/workflow/result-aggregator.cjs && echo "✓ Result Aggregation"
ls .claude/agents/specialized/accessibility-pro.md && echo "✓ Accessibility Agent"
npm test && echo "✓ All tests passing"
```

---

## Phase FINAL: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction
**Dependencies**: All previous phases complete
**Estimated Effort**: 4 hours

### Tasks

1. **Spawn reflection-agent to analyze completed work**

   ```javascript
   Task({
     subagent_type: 'reflection-agent',
     description: 'Session reflection and learning extraction',
     prompt:
       'You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan, extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created).',
   });
   ```

2. **Extract learnings and update memory files**
   - Append patterns to `.claude/context/memory/learnings.md`
   - Document decisions in `.claude/context/memory/decisions.md`
   - Record issues in `.claude/context/memory/issues.md`

3. **Check for evolution opportunities**
   - Patterns suggesting new agents
   - Patterns suggesting new skills
   - Patterns suggesting workflow improvements

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to memory files
- Evolution opportunities logged if detected

---

## Timeline Summary

| Phase     | Features                                       | Est. Hours | Parallel Hours | Duration     |
| --------- | ---------------------------------------------- | ---------- | -------------- | ------------ |
| 0         | Research (complete)                            | 8          | 8              | 1 week       |
| 1         | KB Index, Adv Elicit, Party Mode, Legacy, Cost | 72         | 48             | 8 weeks      |
| 2         | Sidecar, Menu, Sprint, Performance, Self-Heal  | 68         | 44             | 8 weeks      |
| 3         | TestArch, Parallel, Aggregation, Accessibility | 68         | 48             | 8 weeks      |
| FINAL     | Reflection                                     | 4          | 4              | 1 week       |
| **Total** | **16 features**                                | **220h**   | **152h**       | **26 weeks** |

**With Parallelization**: ~152 hours over 26 weeks (6 months)

---

## Risk Management

### High Risk Features

| Feature            | Risk                         | Mitigation                           |
| ------------------ | ---------------------------- | ------------------------------------ |
| Party Mode         | Context threading complexity | Start with 3-agent team, scale up    |
| Parallel Execution | Race conditions              | Implement locking, extensive testing |
| Result Aggregation | Conflict resolution          | Default to security-first tie-breaks |

### Rollback Procedures

Each phase has a rollback checkpoint:

- **Phase 1**: `git checkout HEAD~10 -- .claude/skills/ .claude/knowledge/`
- **Phase 2**: `git checkout HEAD~8 -- .claude/memory/ .claude/agents/`
- **Phase 3**: `git checkout HEAD~6 -- .claude/workflows/ .claude/lib/`

### Quality Gates

Every feature must pass:

1. Unit tests (10+ per feature)
2. Integration tests (3+ per feature)
3. Documentation review
4. Security review (if applicable)

---

## Appendix: Feature Specifications Required

The following features require formal specs (Top 5 by priority score):

1. **Knowledge Base Indexing** (Score: 7.9)
   - Spec: `.claude/context/artifacts/specs/knowledge-base-indexing-spec.md`

2. **Advanced Elicitation** (Score: 7.7)
   - Spec: `.claude/context/artifacts/specs/advanced-elicitation-spec.md`

3. **Party Mode** (Score: 7.5)
   - Spec: `.claude/context/artifacts/specs/party-mode-spec.md`

4. **Agent Sidecar Memory** (Score: 7.0)
   - Spec: `.claude/context/artifacts/specs/agent-sidecar-memory-spec.md`

5. **Cost Tracking** (Score: 6.6)
   - Spec: `.claude/context/artifacts/specs/cost-tracking-spec.md`

---

**End of Roadmap**

Generated by: SYNTHESIS & PLANNING Agent
Date: 2026-01-28
Location: C:\dev\projects\agent-studio\.claude\context\plans\upgrade-roadmap-20260128.md
