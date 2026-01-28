# Plan: Spec-Kit Integration and Upgrade Analysis

## Executive Summary

Comprehensive analysis of the spec-kit codebase (archived at `.claude.archive\.tmp\spec-kit-main`) to identify upgrade opportunities and new spec-driven features for integration into the agent-studio framework. This plan follows the Planning Orchestration Matrix pattern with parallel exploration, research validation, and phased implementation.

## Objectives

- Deep dive spec-kit codebase to understand features, hooks, agents, workflows, tools, skills
- Compare spec-kit capabilities with current agent-studio implementation
- Identify specific upgrade opportunities for existing code
- Identify new feature opportunities following our workflows
- Validate best practices via research before implementation
- Create atomic implementation tasks following EVOLVE workflow for new artifacts

## Phases

### Phase 1: Parallel Exploration (Context Gathering)

**Dependencies**: None
**Parallel OK**: Yes (2 parallel agents)

#### Tasks

- [ ] **1.1** Spawn Explore agent for spec-kit codebase (~45 min)
  - **Command**:
    ```javascript
    Task({
      subagent_type: 'general-purpose',
      model: 'sonnet',
      description: 'Architect exploring spec-kit codebase',
      allowed_tools: ['Read', 'Glob', 'Grep', 'Bash', 'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet', 'Skill'],
      prompt: `You are the ARCHITECT agent in exploration mode.
    ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 2 (created by PLANNER)
Subject: Deep dive spec-kit codebase

## Instructions

1. FIRST: TaskUpdate({ taskId: "2", status: "in_progress" })
2. Read your agent definition: .claude/agents/core/architect.md
3. Invoke skill: Skill({ skill: "repo-rag" }) for thorough exploration
4. Explore: C:\\dev\\projects\\agent-studio\\.claude.archive\\.tmp\\spec-kit-main
5. Focus areas: features, hooks, agents, workflows, tools, skills
6. Document findings in: .claude/context/artifacts/exploration/spec-kit-exploration.md
7. Create structured inventory:
   - Features list with descriptions
   - Hooks list with purposes
   - Agents list with capabilities
   - Workflows list with patterns
   - Tools/utilities list
   - Skills list with focus areas
8. Note interesting patterns, unique approaches, quality metrics
9. LAST: TaskUpdate({ taskId: "2", status: "completed", metadata: { summary: "Spec-kit exploration complete", filesModified: [".claude/context/artifacts/exploration/spec-kit-exploration.md"], discoveries: ["..."] } })
10. THEN: TaskList()

## Thoroughness Requirement

User requested "ULTRATHINK" - be very thorough, not superficial. Read actual code, understand patterns, document specifics.

## Memory Protocol

1. Read: .claude/context/memory/learnings.md first
2. Record discoveries to memory files
   `
   })

   ```

   ```

- **Verify**: `Test-Path .claude/context/artifacts/exploration/spec-kit-exploration.md`
- **Rollback**: N/A (exploration is read-only)

- [ ] **1.2** Spawn Explore agent for current codebase comparison (~45 min) [⚡ parallel OK]
  - **Command**:
    ```javascript
    Task({
      subagent_type: 'general-purpose',
      model: 'sonnet',
      description: 'Architect exploring current codebase for comparison',
      allowed_tools: ['Read', 'Glob', 'Grep', 'Bash', 'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet', 'Skill'],
      prompt: `You are the ARCHITECT agent in exploration mode.
    ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 3 (created by PLANNER)
Subject: Analyze current agent-studio codebase for comparison

## Instructions

1. FIRST: TaskUpdate({ taskId: "3", status: "in_progress" })
2. Read your agent definition: .claude/agents/core/architect.md
3. Invoke skill: Skill({ skill: "repo-rag" }) for thorough exploration
4. Explore current implementation:
   - Features: what capabilities do we have?
   - Hooks: .claude/hooks/\*
   - Agents: .claude/agents/\*
   - Workflows: .claude/workflows/\*
   - Tools: .claude/tools/\*
   - Skills: .claude/skills/\*
5. Document current state in: .claude/context/artifacts/exploration/current-codebase-inventory.md
6. Create structured inventory matching spec-kit format for easy comparison
7. Note strengths, gaps, areas for improvement
8. LAST: TaskUpdate({ taskId: "3", status: "completed", metadata: { summary: "Current codebase inventory complete", filesModified: [".claude/context/artifacts/exploration/current-codebase-inventory.md"], keyFiles: ["..."] } })
9. THEN: TaskList()

## Memory Protocol

1. Read: .claude/context/memory/learnings.md first
2. Record findings to memory files
   `
   })

   ```

   ```

- **Verify**: `Test-Path .claude/context/artifacts/exploration/current-codebase-inventory.md`
- **Rollback**: N/A (exploration is read-only)

#### Phase 1 Error Handling

If any exploration task fails:

1. Check if archived spec-kit path exists: `Test-Path C:\dev\projects\agent-studio\.claude.archive\.tmp\spec-kit-main`
2. Document error: `echo "Phase 1 failed: [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2 until exploration completes

#### Phase 1 Verification Gate

```bash
# Both exploration outputs must exist
Test-Path .claude/context/artifacts/exploration/spec-kit-exploration.md
Test-Path .claude/context/artifacts/exploration/current-codebase-inventory.md
```

### Phase 2: Consolidation & Comparative Analysis

**Dependencies**: Phase 1 (both exploration tasks must complete)
**Parallel OK**: No (PLANNER consolidates sequential findings)

#### Tasks

- [ ] **2.1** Consolidate exploration findings (~30 min)
  - **Command**: PLANNER reads both exploration reports and creates comparison
  - **Verify**: PLANNER completes this task (I am PLANNER)
  - Manual task for PLANNER:
    1. Read `.claude/context/artifacts/exploration/spec-kit-exploration.md`
    2. Read `.claude/context/artifacts/exploration/current-codebase-inventory.md`
    3. Create comparison matrix:
       - What spec-kit has that we don't (new feature opportunities)
       - What we have that spec-kit doesn't (our strengths)
       - What both have but spec-kit does better (upgrade opportunities)
       - What both have but we do better (validation of our approach)
    4. Save to: `.claude/context/artifacts/research-reports/spec-kit-integration-analysis-2026-01-28.md`

- [ ] **2.2** Identify top priority opportunities (~20 min)
  - **Command**: PLANNER analyzes comparison and ranks opportunities
  - **Verify**: Priority list exists in analysis document
  - Manual task for PLANNER:
    1. From comparison matrix, extract concrete opportunities
    2. Rank by:
       - Impact (HIGH/MEDIUM/LOW)
       - Effort (TRIVIAL/LOW/MEDIUM/HIGH/EPIC)
       - Risk (LOW/MEDIUM/HIGH/CRITICAL)
       - Alignment with user's "spec-driven" focus
    3. Identify top 5-10 opportunities for research validation
    4. For each opportunity, classify:
       - **UPGRADE**: Enhance existing code
       - **NEW_FEATURE**: Add new capability
       - **NEW_ARTIFACT**: Create new agent/skill/workflow/hook
    5. Update analysis document with priority ranking

- [ ] **2.3** Create research validation plan (~15 min)
  - **Command**: PLANNER prepares research questions for Phase 3
  - **Verify**: Research questions documented in analysis
  - Manual task for PLANNER:
    1. For each top priority opportunity, formulate research questions:
       - What are industry best practices?
       - What are proven implementation patterns?
       - What are known pitfalls/anti-patterns?
       - How do similar frameworks solve this?
    2. Document research plan in analysis
    3. Identify specific topics for RESEARCHER to investigate

#### Phase 2 Verification Gate

```bash
# Analysis document must exist with:
# - Comparison matrix
# - Priority ranking
# - Research validation plan
Test-Path .claude/context/artifacts/research-reports/spec-kit-integration-analysis-2026-01-28.md
```

### Phase 3: Research Validation

**Dependencies**: Phase 2 (consolidation must complete)
**Parallel OK**: Yes (can research multiple topics in parallel if needed)

#### Tasks

- [ ] **3.1** Spawn RESEARCHER for top priority features (~60 min)
  - **Command**:
    ```javascript
    Task({
      subagent_type: 'general-purpose',
      model: 'opus',
      description: 'Researcher validating best practices for priority features',
      allowed_tools: [
        'Read', 'Write', 'Bash',
        'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet',
        'Skill',
        'mcp__Exa__web_search_exa',
        'mcp__Exa__get_code_context_exa'
      ],
      prompt: `You are the RESEARCHER agent.
    ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 4 (created by PLANNER)
Subject: Research best practices for top priority spec-kit features

## Instructions

1. FIRST: TaskUpdate({ taskId: "4", status: "in_progress" })
2. Read your agent definition: .claude/agents/specialized/researcher.md
3. Read analysis: .claude/context/artifacts/research-reports/spec-kit-integration-analysis-2026-01-28.md
4. For EACH top priority opportunity (identified in Phase 2):
   - Execute minimum 3 Exa searches per opportunity
   - Find industry best practices
   - Find proven implementation patterns
   - Find known pitfalls/anti-patterns
   - Find how similar frameworks solve this
5. Create research report: .claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md
6. For each researched opportunity, provide:
   - Summary of findings
   - Recommended approach
   - Implementation considerations
   - Security considerations
   - Testing requirements
   - Links to sources (minimum 3 per opportunity)
7. LAST: TaskUpdate({ taskId: "4", status: "completed", metadata: { summary: "Research validation complete for top priority features", filesModified: [".claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md"], discoveries: ["..."] } })
8. THEN: TaskList()

## Critical

User explicitly requested: "use a research agent and verify we're doing the best solution as found on the internet"

## Memory Protocol

1. Read: .claude/context/memory/learnings.md first
2. Record research findings to memory
   `
   })

   ```

   ```

- **Verify**: `Test-Path .claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md`
- **Rollback**: N/A (research is read-only)

#### Phase 3 Verification Gate

```bash
# Research report must exist with minimum 3 sources per opportunity
Test-Path .claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md
```

### Phase 4: Implementation Planning

**Dependencies**: Phase 3 (research validation must complete)
**Parallel OK**: No (PLANNER creates atomic tasks sequentially based on research)

#### Tasks

- [ ] **4.1** Create atomic implementation tasks (~45 min)
  - **Command**: PLANNER breaks down each opportunity into atomic tasks
  - **Verify**: Tasks created via TaskCreate for each opportunity
  - Manual task for PLANNER:
    1. Read research report: `.claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md`
    2. For EACH validated opportunity:
       - **If UPGRADE**: Create task(s) for developer agent
       - **If NEW_FEATURE**: Create task(s) following research recommendations
       - **If NEW_ARTIFACT**: Create task for general-purpose agent to invoke creator skill
    3. Each task must include:
       - Clear subject (imperative form)
       - Detailed description with research findings reference
       - Assigned agent type
       - Dependencies (blockedBy) if applicable
       - Success criteria
       - Implementation approach from research
    4. Use TaskCreate for each atomic task
    5. Set up dependency chain (Phase 4 tasks block Phase 5)

- [ ] **4.2** Review implementation plan for security (~20 min)
  - **Command**: Spawn SECURITY-ARCHITECT if any security-critical features identified
  - **Verify**: Security review complete or N/A
  - Conditional task:
    - IF any opportunity involves auth/authz/credentials/external data:
      ```javascript
      Task({
        subagent_type: 'general-purpose',
        model: 'opus',
        description: 'Security reviewing implementation plan',
        allowed_tools: ['Read', 'Write', 'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet', 'Skill'],
        prompt: `You are the SECURITY-ARCHITECT agent.
      ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 5 (created by PLANNER)
Subject: Security review implementation plan for spec-kit integration

## Instructions

1. FIRST: TaskUpdate({ taskId: "5", status: "in_progress" })
2. Read your agent definition: .claude/agents/specialized/security-architect.md
3. Read implementation plan: Check TaskList() for Phase 4.1 tasks
4. Read research: .claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md
5. Review for security concerns:
   - Authentication/authorization implications
   - Data handling risks
   - External integration risks
   - Injection vulnerabilities
6. Save review: .claude/context/reports/security-review-spec-kit-integration.md
7. Update tasks with security requirements if needed
8. LAST: TaskUpdate({ taskId: "5", status: "completed", metadata: { summary: "Security review complete", filesModified: [".claude/context/reports/security-review-spec-kit-integration.md"] } })
9. THEN: TaskList()

## Memory Protocol

1. Record security considerations to .claude/context/memory/decisions.md
   `
   })

   ```- ELSE: Skip this task, mark N/A

   ```

#### Phase 4 Verification Gate

```bash
# All implementation tasks created
# Security review complete (if applicable)
# Tasks have proper dependencies set
```

### Phase 5: Implementation Execution

**Dependencies**: Phase 4 (implementation planning must complete)
**Parallel OK**: Yes (independent tasks can run in parallel)

#### Tasks

- [ ] **5.1** Execute implementation tasks (time varies by task)
  - **Command**: Implementation tasks execute via spawned agents (created in Phase 4.1)
  - **Verify**: All Phase 4 tasks marked completed
  - **Note**: This phase consists of the atomic tasks created in Phase 4.1. Each task will:
    1. Be assigned to appropriate agent (developer, general-purpose for creators, etc.)
    2. Follow EVOLVE workflow if creating new artifacts
    3. Follow TDD workflow if modifying code
    4. Include testing requirements
    5. Update task status on completion
  - **Rollback**: Individual task rollback plans defined per task

#### Phase 5 Error Handling

If any implementation task fails:

1. Document error in task metadata
2. Do NOT proceed with dependent tasks
3. Spawn debugging agent if needed
4. Update `.claude/context/memory/issues.md`

#### Phase 5 Verification Gate

```bash
# All implementation tasks completed
# All tests passing
# No blocking issues
```

### Phase 6: Quality Assurance

**Dependencies**: Phase 5 (implementation must complete)
**Parallel OK**: No (QA reviews all changes holistically)

#### Tasks

- [ ] **6.1** Spawn QA agent for comprehensive testing (~30 min)
  - **Command**:
    ```javascript
    Task({
      subagent_type: 'general-purpose',
      model: 'sonnet',
      description: 'QA testing spec-kit integration',
      allowed_tools: ['Read', 'Bash', 'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet', 'Skill'],
      prompt: `You are the QA agent.
    ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 6 (created by PLANNER)
Subject: Comprehensive QA for spec-kit integration

## Instructions

1. FIRST: TaskUpdate({ taskId: "6", status: "in_progress" })
2. Read your agent definition: .claude/agents/core/qa.md
3. Invoke skill: Skill({ skill: "qa-workflow" })
4. Run full test suite: npm test (or appropriate test command)
5. Verify all new features work as expected
6. Verify no regressions in existing features
7. Document test results: .claude/context/reports/qa-spec-kit-integration-2026-01-28.md
8. If failures found:
   - Document in issues.md
   - Create fix tasks via TaskCreate
9. LAST: TaskUpdate({ taskId: "6", status: "completed", metadata: { summary: "QA complete", filesModified: [".claude/context/reports/qa-spec-kit-integration-2026-01-28.md"], testResults: "..." } })
10. THEN: TaskList()

## Memory Protocol

1. Record test patterns to .claude/context/memory/learnings.md
   `
   })

   ```

   ```

- **Verify**: `Test-Path .claude/context/reports/qa-spec-kit-integration-2026-01-28.md`
- **Rollback**: If QA fails, rollback implementation changes

#### Phase 6 Verification Gate

```bash
# QA report exists
# All tests passing
# No critical issues
```

### Phase 7: Documentation

**Dependencies**: Phase 6 (QA must complete)
**Parallel OK**: No (documentation must reflect final state)

#### Tasks

- [ ] **7.1** Spawn TECHNICAL-WRITER for integration docs (~30 min)
  - **Command**:
    ```javascript
    Task({
      subagent_type: 'general-purpose',
      model: 'sonnet',
      description: 'Technical writer documenting spec-kit integration',
      allowed_tools: ['Read', 'Write', 'Edit', 'TaskUpdate', 'TaskList', 'TaskCreate', 'TaskGet', 'Skill'],
      prompt: `You are the TECHNICAL-WRITER agent.
    ```

## PROJECT CONTEXT

PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task

Task ID: 7 (created by PLANNER)
Subject: Document spec-kit integration features

## Instructions

1. FIRST: TaskUpdate({ taskId: "7", status: "in_progress" })
2. Read your agent definition: .claude/agents/core/technical-writer.md
3. Read all Phase 1-6 artifacts:
   - Exploration reports
   - Analysis documents
   - Research reports
   - Implementation task summaries
   - QA report
4. Create integration summary: .claude/docs/SPEC_KIT_INTEGRATION.md
5. Document:
   - What was integrated from spec-kit
   - Why (based on research)
   - How (implementation approach)
   - New features available
   - Upgrade improvements made
   - Testing performed
   - Known limitations
   - Future opportunities
6. Update relevant existing docs if needed
7. LAST: TaskUpdate({ taskId: "7", status: "completed", metadata: { summary: "Documentation complete", filesModified: [".claude/docs/SPEC_KIT_INTEGRATION.md", "..."] } })
8. THEN: TaskList()

## Memory Protocol

1. Record documentation patterns to .claude/context/memory/learnings.md
   `
   })

   ```

   ```

- **Verify**: `Test-Path .claude/docs/SPEC_KIT_INTEGRATION.md`

#### Phase 7 Verification Gate

```bash
# Integration documentation exists
# All changes documented
```

### Phase [FINAL]: Evolution & Reflection Check

**Dependencies**: Phase 7 (documentation must complete)
**Parallel OK**: No

**Purpose**: Quality assessment and learning extraction

**Tasks**:

1. Spawn reflection-agent to analyze completed work
2. Extract learnings and update memory files
3. Check for evolution opportunities (new agents/skills needed)

**Spawn Command**:

```javascript
Task({
  subagent_type: 'general-purpose',
  model: 'sonnet',
  description: 'Reflection agent analyzing spec-kit integration work',
  allowed_tools: [
    'Read',
    'Write',
    'Edit',
    'TaskUpdate',
    'TaskList',
    'TaskCreate',
    'TaskGet',
    'Skill',
  ],
  prompt: `You are REFLECTION-AGENT.

## PROJECT CONTEXT
PROJECT_ROOT: C:\\dev\\projects\\agent-studio

## Your Assigned Task
Task ID: 8 (created by PLANNER)
Subject: Session reflection and learning extraction for spec-kit integration

## Instructions
1. FIRST: TaskUpdate({ taskId: "8", status: "in_progress" })
2. Read your agent definition: .claude/agents/core/reflection-agent.md
3. Analyze the completed work from this plan:
   - Read all artifacts from Phases 1-7
   - Identify patterns, gotchas, discoveries
   - Extract learnings for future similar work
4. Update memory files:
   - .claude/context/memory/learnings.md (patterns, techniques)
   - .claude/context/memory/decisions.md (key decisions made)
   - .claude/context/memory/issues.md (blockers encountered)
5. Check for evolution opportunities:
   - Do patterns suggest new agents needed?
   - Do patterns suggest new skills needed?
   - Do patterns suggest new workflows needed?
6. If evolution opportunities found, document in evolution-state.json
7. LAST: TaskUpdate({ taskId: "8", status: "completed", metadata: { summary: "Reflection complete, learnings extracted", filesModified: [".claude/context/memory/learnings.md", "..."] } })
8. THEN: TaskList()
`,
});
```

**Success Criteria**:

- Reflection-agent spawned and completed
- Learnings extracted to `.claude/context/memory/learnings.md`
- Evolution opportunities logged if any detected

## Risks

| Risk                                      | Impact | Mitigation                                                       | Rollback                                  |
| ----------------------------------------- | ------ | ---------------------------------------------------------------- | ----------------------------------------- |
| Spec-kit archived files corrupted/missing | HIGH   | Verify path exists in Phase 1, document if missing               | N/A - abort if missing                    |
| Research validation finds anti-patterns   | MEDIUM | Do NOT implement opportunities marked as anti-patterns           | Skip those opportunities                  |
| Integration breaks existing functionality | HIGH   | Comprehensive QA in Phase 6, rollback if critical issues         | Git revert implementation commits         |
| Security vulnerabilities in new features  | HIGH   | Security review in Phase 4.2 (MANDATORY for sensitive features)  | Remove vulnerable features                |
| Implementation time exceeds estimates     | MEDIUM | Break tasks into smaller chunks, prioritize top opportunities    | Complete high-priority items first        |
| Spec-kit patterns incompatible with ours  | MEDIUM | Research validates compatibility, PLANNER decides on integration | Document incompatibilities, don't force   |
| New artifacts not properly registered     | MEDIUM | Follow EVOLVE workflow, use creator skills (Gate 4 enforcement)  | Re-run creator workflow with proper steps |

## Timeline Summary

| Phase     | Tasks  | Est. Time      | Parallel? | Critical Path |
| --------- | ------ | -------------- | --------- | ------------- |
| 1         | 2      | 45 min         | Yes       | Either task   |
| 2         | 3      | 65 min         | No        | Sequential    |
| 3         | 1      | 60 min         | Partial   | Research      |
| 4         | 2      | 65 min         | No        | Sequential    |
| 5         | 1      | Varies         | Yes       | All tasks     |
| 6         | 1      | 30 min         | No        | QA            |
| 7         | 1      | 30 min         | No        | Docs          |
| Final     | 1      | 20 min         | No        | Reflection    |
| **Total** | **12** | **~5-8 hours** | Mixed     | Full chain    |

## Notes

- **Ultrathink**: User explicitly requested deep, thorough analysis - not superficial
- **Research First**: User explicitly requested research validation BEFORE implementation
- **EVOLVE Compliance**: All new artifacts MUST go through creator workflows (Gate 4)
- **Phase Dependencies**: Each phase blocks the next - no skipping
- **Parallel Where Possible**: Phase 1 (exploration), Phase 5 (independent implementations)
- **Task Tracking**: All spawned agents MUST update task status
- **Memory Protocol**: All agents record learnings/decisions/issues to memory files

## Success Criteria

- [ ] Spec-kit codebase thoroughly explored and documented
- [ ] Current codebase inventory complete
- [ ] Comparison matrix created with specific opportunities
- [ ] Top 5-10 opportunities prioritized and ranked
- [ ] Research validation complete with minimum 3 sources per opportunity
- [ ] Implementation plan created with atomic tasks
- [ ] Security review complete (if applicable)
- [ ] All implementation tasks completed and tested
- [ ] QA report shows no critical issues
- [ ] Integration documentation complete
- [ ] Reflection complete with learnings extracted
- [ ] All memory files updated (learnings, decisions, issues)

## Deliverables

1. `.claude/context/artifacts/exploration/spec-kit-exploration.md` - Spec-kit inventory
2. `.claude/context/artifacts/exploration/current-codebase-inventory.md` - Current state
3. `.claude/context/artifacts/research-reports/spec-kit-integration-analysis-2026-01-28.md` - Comparison & priorities
4. `.claude/context/artifacts/research-reports/spec-kit-features-best-practices-2026-01-28.md` - Research findings
5. `.claude/context/reports/security-review-spec-kit-integration.md` - Security review (if applicable)
6. `.claude/context/reports/qa-spec-kit-integration-2026-01-28.md` - QA results
7. `.claude/docs/SPEC_KIT_INTEGRATION.md` - Integration documentation
8. Implementation artifacts (code, tests, new agents/skills/workflows as applicable)
9. Updated memory files (learnings.md, decisions.md, issues.md)
