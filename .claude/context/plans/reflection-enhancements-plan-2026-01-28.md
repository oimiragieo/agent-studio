# Plan: 10 Reflection Enhancement Recommendations Implementation

**Date**: 2026-01-28
**Framework Version**: Agent-Studio v2.3.0
**Status**: Phase 0 - Research
**Planner**: Claude Sonnet 4.5 (Task #2)
**Source**: `.claude/context/artifacts/reflections/spec-kit-integration-reflection-2026-01-28.md`

---

## Executive Summary

Implement 10 high-value enhancements identified from the spec-kit integration reflection, organized across 3 sprints (Immediate, Near-Term, Long-Term). Total effort: ~120 hours over 90 days. Focus areas: template system extension, progressive disclosure UX, security infrastructure, and validation patterns.

**Strategic Impact**:

- **UX Improvement**: Progressive disclosure reduces clarifications from 5+ to 3 max (60% reduction)
- **Consistency Boost**: Template system extension to ADRs (80% → 100% decision documentation consistency)
- **Security Hardening**: Security-first design checklist prevents "afterthought" antipattern
- **Quality Standardization**: Hybrid validation extended to all review workflows (code-reviewer, security-architect, architect)

**Success Metrics**:

- All 10 enhancements delivered across 3 sprints
- Zero regressions to existing framework functionality
- 100% test coverage for new features
- Documentation updated (README, CHANGELOG, guides)

---

## Objectives

1. **Improve User Experience**: Activate progressive disclosure to reduce clarification fatigue
2. **Extend Template Infrastructure**: Add ADR template + template catalog for discovery
3. **Harden Security Posture**: Security-first design checklist + reusable control registry
4. **Standardize Quality Validation**: Extend hybrid validation (IEEE + contextual) to all workflows
5. **Optimize Research Process**: Research prioritization matrix for EVOLVE Phase O
6. **Formalize Best Practices**: Commit checkpoint pattern for multi-file projects

---

## Phases

### Phase 0: Research & Planning (FOUNDATION)

**Purpose**: Research unknowns, validate technical approach, assess security implications for all 10 enhancements
**Duration**: 8-12 hours
**Parallel OK**: No (blocking for subsequent phases)

#### Research Requirements (MANDATORY)

Before implementing ANY enhancement:

- [ ] Minimum 3 Exa/WebSearch queries per enhancement category (UX, Templates, Security, Quality)
- [ ] Minimum 3 external sources consulted per category
- [ ] Research report generated covering all 10 enhancements
- [ ] Design decisions documented with rationale (ADRs for major patterns)

**Research Output**: `.claude/context/artifacts/research-reports/reflection-enhancements-research-2026-01-28.md`

#### Constitution Checkpoint

**CRITICAL VALIDATION**: Before proceeding to Phase 1, ALL of the following MUST pass:

1. **Research Completeness**
   - [ ] Research report contains minimum 3 external sources per category (12+ total)
   - [ ] All [NEEDS CLARIFICATION] items resolved for progressive disclosure, template system, security patterns
   - [ ] ADRs created for major decisions (template catalog structure, security control registry schema, research prioritization algorithm)

2. **Technical Feasibility**
   - [ ] Progressive disclosure integration approach validated (spec-gathering Phase 3.5 insertion point)
   - [ ] Template catalog discovery mechanism identified (skill invocation vs file-based)
   - [ ] Security control registry format validated (JSON vs YAML vs Markdown)
   - [ ] Dependencies available (template-renderer, checklist-generator, EVOLVE workflow files)
   - [ ] No blocking technical issues (schema compatibility, hook conflicts)

3. **Security Review**
   - [ ] Security implications assessed for template catalog (path traversal risks)
   - [ ] Security control registry access controls validated (read-only enforcement)
   - [ ] Template injection risks mitigated (whitelist validation in ADR template)
   - [ ] Threat model documented for catalog/registry features

4. **Specification Quality**
   - [ ] Acceptance criteria are measurable (e.g., "progressive disclosure max 3 questions", "template catalog lists all templates")
   - [ ] Success criteria are testable (E2E tests for each enhancement)
   - [ ] Edge cases considered (missing templates, malformed ADRs, circular dependencies)

**If ANY item fails, return to research phase. DO NOT proceed to implementation.**

#### Phase 0 Tasks

- [ ] **0.1** Research progressive disclosure patterns (~2 hours)
  - **Queries**: "progressive disclosure UX patterns", "clarification fatigue research", "form completion rates optimal questions"
  - **Output**: Progressive disclosure best practices (3-5 questions optimal, Miller's Law 7±2 items, HCI research)
  - **Verify**: Research report section on progressive disclosure with citations

- [ ] **0.2** Research template catalog patterns (~2 hours)
  - **Queries**: "artifact registry patterns", "skill discovery mechanisms", "template management systems"
  - **Output**: Template catalog design patterns (file-based vs database, discovery algorithms, usage tracking)
  - **Verify**: Research report section on template catalogs with implementation examples

- [ ] **0.3** Research security control registries (~2 hours)
  - **Queries**: "security control catalogs", "reusable security patterns", "OWASP security controls"
  - **Output**: Security control registry best practices (OWASP ASVS, NIST controls, industry patterns)
  - **Verify**: Research report section on security registries with schema examples

- [ ] **0.4** Research hybrid validation patterns (~2 hours)
  - **Queries**: "automated vs manual testing tradeoffs", "IEEE 1028 implementation patterns", "code review automation"
  - **Output**: Hybrid validation best practices (80/20 split rationale, tool integration patterns)
  - **Verify**: Research report section on hybrid validation with framework examples

- [ ] **0.5** Document design decisions (~2 hours)
  - **ADR-047**: Template Catalog Structure (file-based markdown with YAML frontmatter)
  - **ADR-048**: Security Control Registry Schema (JSON with semantic versioning)
  - **ADR-049**: Research Prioritization Algorithm (Impact × Alignment matrix)
  - **Output**: `.claude/context/memory/decisions.md` with 3 new ADRs
  - **Verify**: All ADRs have Context, Decision, Consequences sections

- [ ] **0.6** Security review of enhancements (~2 hours)
  - **Spawn**: Task({ subagent_type: "security-architect", prompt: "Review 10 enhancements for security implications..." })
  - **Output**: Security assessment with threat model for catalog/registry features
  - **Verify**: All CRITICAL/HIGH risks have mitigations documented

**Success Criteria**: All constitution checkpoint gates passed, research report complete, ADRs documented, security review APPROVED

---

### Phase 1: Immediate Enhancements (Sprint 1: Week 1-2)

**Purpose**: Deliver HIGH-priority, user-facing improvements (progressive disclosure, E2E tests, Task #25b)
**Dependencies**: Phase 0 complete
**Duration**: ~18 hours
**Parallel OK**: Partial (Enhancement #1 and #2 can run in parallel, #3 depends on #1)

#### Tasks

- [ ] **1.1** Enhancement #1: Activate Progressive Disclosure Integration (~6 hours)
  - **Priority**: HIGH
  - **Command**: Invoke spec-gathering skill, insert progressive-disclosure at Phase 3.5
  - **Steps**:
    1. Read `.claude/skills/spec-gathering/SKILL.md` to understand workflow
    2. Identify insertion point (Phase 3.5: after requirements parsed, before template rendering)
    3. Edit spec-gathering to invoke progressive-disclosure skill
    4. Test: Run spec-gathering with incomplete requirements, verify max 3 clarifications
  - **Verify**: `grep -A 10 "Phase 3.5" .claude/skills/spec-gathering/SKILL.md | grep progressive-disclosure`
  - **Rollback**: `git checkout -- .claude/skills/spec-gathering/SKILL.md`
  - **Acceptance Criteria**:
    - [ ] spec-gathering Phase 3.5 invokes progressive-disclosure skill
    - [ ] User receives max 3 clarifications (90th percentile)
    - [ ] Remaining gaps filled with [ASSUMES: X] markers
    - [ ] Integration test passes (spec-gathering E2E with incomplete requirements)

- [ ] **1.2** Enhancement #2: Add Happy-Path E2E Test Suite (~4 hours) [⚡ parallel OK]
  - **Priority**: MEDIUM
  - **Command**: Create `.claude/tests/integration/template-system-e2e-happy.test.cjs`
  - **Steps**:
    1. Copy existing E2E test structure from template-system-e2e.test.cjs
    2. Provide all 46 tokens (comprehensive token set)
    3. Verify 21/21 tests passing (demonstrates ideal user experience)
    4. Add comment explaining difference from validation test (happy path vs detection test)
  - **Verify**: `node .claude/tests/integration/template-system-e2e-happy.test.cjs | grep "21 passing"`
  - **Rollback**: `rm .claude/tests/integration/template-system-e2e-happy.test.cjs`
  - **Acceptance Criteria**:
    - [ ] All 21 tests passing (21/21)
    - [ ] Test provides all tokens (demonstrates happy path)
    - [ ] README updated with test purpose distinction
    - [ ] CI pipeline includes new test

- [ ] **1.3** Enhancement #3: Create Task #25b for Progressive Disclosure (~2 hours)
  - **Priority**: HIGH
  - **Dependencies**: Task 1.1 complete
  - **Command**: `TaskCreate({ subject: "Task #25b: Integrate progressive-disclosure into spec-gathering workflow", ... })`
  - **Steps**:
    1. Create task with detailed integration steps
    2. Link to Task #1.1 completion (addBlockedBy: ['1.1'])
    3. Assign to developer or mark as ready for claiming
    4. Verify task appears in TaskList()
  - **Verify**: `TaskList() | grep "Task #25b"`
  - **Rollback**: `TaskUpdate({ taskId: "25b", status: "deleted" })`
  - **Acceptance Criteria**:
    - [ ] Task #25b created with clear integration steps
    - [ ] Task blocked on Enhancement #1 completion
    - [ ] Task visible in TaskList() for claiming

- [ ] **1.4** Update documentation for Sprint 1 enhancements (~2 hours)
  - **Command**: Update README, CHANGELOG, .claude/docs/SPEC_KIT_INTEGRATION.md
  - **Steps**:
    1. README: Add progressive disclosure section to "Features" list
    2. CHANGELOG: Add Sprint 1 enhancements under v2.3.1
    3. SPEC_KIT_INTEGRATION.md: Update with progressive disclosure integration details
    4. Create example: spec-gathering with progressive disclosure enabled
  - **Verify**: `grep -i "progressive disclosure" README.md CHANGELOG.md .claude/docs/SPEC_KIT_INTEGRATION.md`
  - **Rollback**: `git checkout -- README.md CHANGELOG.md .claude/docs/SPEC_KIT_INTEGRATION.md`

- [ ] **1.5** Memory update for Sprint 1 (~1 hour)
  - **Command**: Append to `.claude/context/memory/learnings.md`
  - **Content**:
    - Pattern: Progressive disclosure integration reduces clarification fatigue
    - Context: Spec-kit integration Sprint 1
    - Impact: UX improvement (5+ → 3 max clarifications)
  - **Verify**: `tail -20 .claude/context/memory/learnings.md | grep "Progressive disclosure"`

- [ ] **1.6** Commit Sprint 1 changes (~30 min)
  - **Command**: `git add . && git commit -m "feat(sprint-1): progressive disclosure + happy-path tests + Task #25b"`
  - **Verify**: `git log --oneline -1 | grep "sprint-1"`

#### Phase 1 Error Handling

If any task fails:

1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 1 failed: [error details]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2 until issue resolved

#### Phase 1 Verification Gate

```bash
# All must pass before proceeding to Phase 2
grep "Phase 3.5" .claude/skills/spec-gathering/SKILL.md | grep progressive-disclosure && \
node .claude/tests/integration/template-system-e2e-happy.test.cjs | grep "21 passing" && \
TaskList | grep "Task #25b" && \
echo "✓ Phase 1 complete"
```

**Success Criteria**: Progressive disclosure activated, happy-path tests passing, Task #25b created, documentation updated, changes committed

---

### Phase 2: Near-Term Enhancements (Sprint 2: Week 3-6)

**Purpose**: Extend template infrastructure and formalize security patterns
**Dependencies**: Phase 1 complete
**Duration**: ~40 hours
**Parallel OK**: Partial (Enhancements #4, #5, #6 can run in parallel)

#### Tasks

- [ ] **2.1** Enhancement #4: Extend Template System to ADRs (~12 hours) [⚡ parallel OK]
  - **Priority**: HIGH
  - **Command**: Invoke skill-creator skill to create ADR template + schema
  - **Steps**:
    1. Design ADR template structure (YAML frontmatter + Markdown body)
    2. Create `.claude/templates/adr-template.md` with tokens (ADR_NUMBER, TITLE, DATE, STATUS, CONTEXT, DECISION, CONSEQUENCES, ALTERNATIVES)
    3. Create `.claude/schemas/adr-template.schema.json` for validation
    4. Update template-renderer to support ADR template
    5. Create example ADR using template (ADR-050: Example Architecture Decision)
    6. Write tests: schema validation, template rendering, token replacement
  - **Verify**:
    - `ls .claude/templates/adr-template.md`
    - `node .claude/schemas/adr-template.test.cjs | grep "passing"`
    - `ls .claude/context/memory/decisions.md | grep "ADR-050"`
  - **Rollback**: `git checkout -- .claude/templates/adr-template.md .claude/schemas/adr-template.schema.json`
  - **Acceptance Criteria**:
    - [ ] ADR template created with 8+ tokens
    - [ ] Schema validation passes (date format, status enum, required fields)
    - [ ] Template-renderer renders ADR template successfully
    - [ ] Example ADR (ADR-050) created using template
    - [ ] All tests passing (schema + integration)
    - [ ] Documentation updated (template guide)

- [ ] **2.2** Enhancement #5: Build Template Catalog Registry (~16 hours) [⚡ parallel OK]
  - **Priority**: MEDIUM
  - **Command**: Create `.claude/context/artifacts/template-catalog.md` with usage tracking
  - **Steps**:
    1. Design catalog structure (YAML frontmatter with metadata + Markdown table)
    2. Create catalog with all templates (specification, plan, tasks, ADR)
    3. Add usage tracking metadata (creation count, last used, usage stats)
    4. Create discovery skill: `template-discovery` (searches catalog by keyword/category)
    5. Update all template-using skills to register usage in catalog
    6. Create catalog update hook: auto-updates when template created/used
    7. Write tests: catalog completeness, discovery skill, usage tracking
  - **Verify**:
    - `ls .claude/context/artifacts/template-catalog.md`
    - `grep "specification-template\|plan-template\|tasks-template\|adr-template" .claude/context/artifacts/template-catalog.md`
    - `node .claude/skills/template-discovery/SKILL.md`
  - **Rollback**: `rm -rf .claude/context/artifacts/template-catalog.md .claude/skills/template-discovery/`
  - **Acceptance Criteria**:
    - [ ] Template catalog lists all 4 templates (spec, plan, tasks, ADR)
    - [ ] Catalog has usage tracking (creation count, last used)
    - [ ] template-discovery skill functional (keyword search works)
    - [ ] Catalog auto-updates when templates used (hook functional)
    - [ ] All tests passing (catalog + discovery + tracking)

- [ ] **2.3** Enhancement #6: Add Security-First Design Checklist to EVOLVE (~12 hours) [⚡ parallel OK]
  - **Priority**: HIGH
  - **Command**: Update `.claude/workflows/core/evolution-workflow.md` Phase E
  - **Steps**:
    1. Design security-first checklist (STRIDE threat model questions)
    2. Insert checklist into EVOLVE Phase E (Evaluate): "What could go wrong?"
    3. Create checklist template: security-design-checklist.md
    4. Update evolution-orchestrator agent to use checklist
    5. Test: Create test artifact via EVOLVE, verify security checklist prompted
    6. Update all creator skills to reference security checklist
  - **Verify**:
    - `grep -A 20 "Phase E" .claude/workflows/core/evolution-workflow.md | grep "security.*checklist"`
    - `ls .claude/templates/security-design-checklist.md`
  - **Rollback**: `git checkout -- .claude/workflows/core/evolution-workflow.md .claude/templates/security-design-checklist.md`
  - **Acceptance Criteria**:
    - [ ] Security checklist added to EVOLVE Phase E
    - [ ] Checklist covers STRIDE threats (6 categories)
    - [ ] Evolution-orchestrator agent prompts security checklist
    - [ ] All creator skills reference checklist
    - [ ] Test artifact creation shows security prompts
    - [ ] Documentation updated (EVOLVE workflow guide)

- [ ] **2.4** Update documentation for Sprint 2 enhancements (~4 hours)
  - **Command**: Update README, CHANGELOG, .claude/docs/
  - **Steps**:
    1. README: Add ADR template + template catalog sections
    2. CHANGELOG: Add Sprint 2 enhancements under v2.3.2
    3. Create template-catalog-guide.md with usage examples
    4. Update EVOLVE workflow documentation with security checklist
  - **Verify**: `grep -i "ADR template\|template catalog\|security-first" README.md CHANGELOG.md`

- [ ] **2.5** Memory update for Sprint 2 (~1 hour)
  - **Command**: Append to `.claude/context/memory/learnings.md`
  - **Content**:
    - Pattern: ADR template improves decision documentation consistency (80% → 100%)
    - Pattern: Template catalog enables discovery and adoption tracking
    - Pattern: Security-first design checklist prevents "afterthought" antipattern
  - **Verify**: `tail -30 .claude/context/memory/learnings.md | grep "ADR template"`

- [ ] **2.6** Commit Sprint 2 changes (~30 min)
  - **Command**: `git add . && git commit -m "feat(sprint-2): ADR template + template catalog + security-first checklist"`
  - **Verify**: `git log --oneline -1 | grep "sprint-2"`

#### Phase 2 Error Handling

If any task fails:

1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 2 failed: [error details]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 3 until issue resolved

#### Phase 2 Verification Gate

```bash
# All must pass before proceeding to Phase 3
ls .claude/templates/adr-template.md && \
ls .claude/context/artifacts/template-catalog.md && \
grep "security.*checklist" .claude/workflows/core/evolution-workflow.md && \
node .claude/schemas/adr-template.test.cjs | grep "passing" && \
echo "✓ Phase 2 complete"
```

**Success Criteria**: ADR template functional, template catalog operational, security-first checklist integrated, documentation updated, changes committed

---

### Phase 3: Long-Term Enhancements (Sprint 3: Week 7-12)

**Purpose**: Build reusable infrastructure (research matrix, security registry, validation patterns)
**Dependencies**: Phase 2 complete
**Duration**: ~62 hours
**Parallel OK**: Partial (Enhancements #7, #8, #10 can run in parallel; #9 is standalone)

#### Tasks

- [ ] **3.1** Enhancement #7: Implement Research Prioritization Matrix (~20 hours) [⚡ parallel OK]
  - **Priority**: MEDIUM
  - **Command**: Create research prioritization algorithm for EVOLVE Phase O
  - **Steps**:
    1. Design Impact × Alignment matrix (2x2 with HIGH/MEDIUM/LOW scoring)
    2. Create prioritization algorithm: score = (impact_score × 0.6) + (alignment_score × 0.4)
    3. Update EVOLVE Phase O workflow with prioritization step
    4. Add research budget enforcement: cap at 20% of project time
    5. Create research-prioritization skill (invoked in EVOLVE Phase O)
    6. Test: Run EVOLVE workflow with 18 opportunities, verify only TOP 5 researched
    7. Write algorithm documentation with examples
  - **Verify**:
    - `grep -A 30 "Phase O" .claude/workflows/core/evolution-workflow.md | grep "prioritization"`
    - `ls .claude/skills/research-prioritization/SKILL.md`
  - **Rollback**: `git checkout -- .claude/workflows/core/evolution-workflow.md .claude/skills/research-prioritization/`
  - **Acceptance Criteria**:
    - [ ] Prioritization algorithm implemented (Impact × Alignment)
    - [ ] EVOLVE Phase O includes prioritization step
    - [ ] Research budget enforcement (20% cap)
    - [ ] research-prioritization skill functional
    - [ ] Test shows TOP 5 of 18 opportunities researched
    - [ ] Documentation includes examples and decision rationale

- [ ] **3.2** Enhancement #8: Build Security Control Registry (~24 hours) [⚡ parallel OK]
  - **Priority**: HIGH
  - **Command**: Create `.claude/context/artifacts/security-controls-catalog.md`
  - **Steps**:
    1. Design registry structure (JSON with semantic versioning)
    2. Extract existing controls from template-renderer (token whitelist, path validation, sanitization)
    3. Extract existing controls from checklist-generator ([AI-GENERATED] prefix transparency)
    4. Create registry with controls: SEC-001 (Token Whitelist), SEC-002 (Path Validation), SEC-003 (Input Sanitization), SEC-004 (Transparency Markers)
    5. Add control metadata: threat mitigated (OWASP mapping), implementation code, test cases
    6. Create security-control-discovery skill (search registry by threat/category)
    7. Update all creator skills to reference registry
    8. Write tests: registry completeness, discovery, control reuse patterns
  - **Verify**:
    - `ls .claude/context/artifacts/security-controls-catalog.md`
    - `grep "SEC-001\|SEC-002\|SEC-003\|SEC-004" .claude/context/artifacts/security-controls-catalog.md`
    - `node .claude/skills/security-control-discovery/SKILL.md`
  - **Rollback**: `rm -rf .claude/context/artifacts/security-controls-catalog.md .claude/skills/security-control-discovery/`
  - **Acceptance Criteria**:
    - [ ] Security control registry with 4+ controls
    - [ ] Each control has threat mapping (OWASP), implementation code, tests
    - [ ] security-control-discovery skill functional
    - [ ] All creator skills reference registry
    - [ ] Test shows control reuse patterns
    - [ ] Documentation includes usage guide and examples

- [ ] **3.3** Enhancement #9: Formalize Commit Checkpoint Pattern (~4 hours)
  - **Priority**: LOW
  - **Command**: Update plan-generator to add commit checkpoints
  - **Steps**:
    1. Design commit checkpoint pattern (after Phase 3 Integration for 10+ file projects)
    2. Update plan-generator skill to detect multi-file projects (>10 files changed)
    3. Auto-insert commit checkpoint subtask in Phase 3
    4. Create example plan showing commit checkpoint
    5. Test: Generate plan with 15 files, verify checkpoint present
  - **Verify**: `grep -A 50 "Phase 3" .claude/templates/plan-template.md | grep "commit checkpoint"`
  - **Rollback**: `git checkout -- .claude/skills/plan-generator/SKILL.md .claude/templates/plan-template.md`
  - **Acceptance Criteria**:
    - [ ] Commit checkpoint pattern formalized (documentation)
    - [ ] plan-generator detects multi-file projects (>10 files)
    - [ ] Commit checkpoint auto-inserted in Phase 3
    - [ ] Example plan includes checkpoint
    - [ ] Test shows checkpoint for 15-file project

- [ ] **3.4** Enhancement #10: Extend Hybrid Validation to All QA Workflows (~32 hours) [⚡ parallel OK]
  - **Priority**: HIGH
  - **Command**: Integrate checklist-generator into code-reviewer, security-architect, architect agents
  - **Steps**:
    1. Update code-reviewer agent to invoke checklist-generator skill
    2. Update security-architect agent to invoke checklist-generator skill
    3. Update architect agent to invoke checklist-generator skill
    4. Create domain-specific IEEE base checklists: Frontend (W3C standards), Backend (REST API best practices), Mobile (Apple/Google HIG), DevOps (12-factor app), AI/ML (responsible AI principles)
    5. Test each agent: verify 80-90% IEEE base + 10-20% contextual items
    6. Write integration tests: code-review with checklist, security-audit with checklist, architecture-review with checklist
    7. Update documentation for all 3 agents
  - **Verify**:
    - `grep "checklist-generator" .claude/agents/specialized/code-reviewer.md`
    - `grep "checklist-generator" .claude/agents/specialized/security-architect.md`
    - `grep "checklist-generator" .claude/agents/core/architect.md`
  - **Rollback**: `git checkout -- .claude/agents/specialized/code-reviewer.md .claude/agents/specialized/security-architect.md .claude/agents/core/architect.md`
  - **Acceptance Criteria**:
    - [ ] code-reviewer agent invokes checklist-generator
    - [ ] security-architect agent invokes checklist-generator
    - [ ] architect agent invokes checklist-generator
    - [ ] Domain-specific checklists created (5 domains)
    - [ ] All agents show 80-90% IEEE + 10-20% contextual split
    - [ ] Integration tests passing (3 agents × checklist usage)
    - [ ] Documentation updated for all 3 agents

- [ ] **3.5** Update documentation for Sprint 3 enhancements (~6 hours)
  - **Command**: Update README, CHANGELOG, .claude/docs/
  - **Steps**:
    1. README: Add research prioritization, security registry, hybrid validation sections
    2. CHANGELOG: Add Sprint 3 enhancements under v2.3.3
    3. Create security-control-registry-guide.md with usage examples
    4. Create research-prioritization-guide.md with matrix examples
    5. Update architecture documentation with hybrid validation patterns
  - **Verify**: `grep -i "research prioritization\|security control registry\|hybrid validation" README.md CHANGELOG.md`

- [ ] **3.6** Memory update for Sprint 3 (~2 hours)
  - **Command**: Append to `.claude/context/memory/learnings.md`
  - **Content**:
    - Pattern: Research prioritization prevents waste (research only HIGH quadrant)
    - Pattern: Security control registry enables reuse (4+ controls reusable)
    - Pattern: Hybrid validation standardizes quality (extended to 3 agents)
    - Pattern: Commit checkpoint reduces lost work risk (formalized for multi-file projects)
  - **Verify**: `tail -40 .claude/context/memory/learnings.md | grep "Research prioritization"`

- [ ] **3.7** Commit Sprint 3 changes (~30 min)
  - **Command**: `git add . && git commit -m "feat(sprint-3): research prioritization + security registry + hybrid validation + commit checkpoints"`
  - **Verify**: `git log --oneline -1 | grep "sprint-3"`

#### Phase 3 Error Handling

If any task fails:

1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 3 failed: [error details]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase FINAL until issue resolved

#### Phase 3 Verification Gate

```bash
# All must pass before proceeding to Phase FINAL
ls .claude/skills/research-prioritization/SKILL.md && \
ls .claude/context/artifacts/security-controls-catalog.md && \
grep "checklist-generator" .claude/agents/specialized/code-reviewer.md && \
grep "commit checkpoint" .claude/templates/plan-template.md && \
echo "✓ Phase 3 complete"
```

**Success Criteria**: Research prioritization operational, security registry complete, hybrid validation extended, commit checkpoints formalized, documentation updated, changes committed

---

### Phase FINAL: Evolution & Reflection Check

**Purpose**: Quality assessment and learning extraction
**Dependencies**: Phase 3 complete
**Duration**: ~4 hours

#### Tasks

1. **Spawn reflection-agent to analyze completed work**
   - **Command**:
     ```javascript
     Task({
       subagent_type: 'reflection-agent',
       description: 'Session reflection and learning extraction for 10-enhancement implementation',
       prompt:
         'You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md. Analyze the completed work from this plan (10 reflection enhancements implementation), extract learnings to memory files, and check for evolution opportunities (patterns that suggest new agents or skills should be created).',
     });
     ```

2. **Extract learnings and update memory files**
   - **Output**: `.claude/context/memory/learnings.md` (new patterns from 3-sprint implementation)
   - **Output**: `.claude/context/memory/decisions.md` (ADRs 047-049+)
   - **Output**: `.claude/context/memory/issues.md` (any blockers encountered)

3. **Check for evolution opportunities**
   - **Analyze**: Are there recurring patterns suggesting new agents? (e.g., template-manager agent)
   - **Analyze**: Are there recurring patterns suggesting new skills? (e.g., catalog-updater skill)
   - **Output**: Evolution recommendations if patterns detected

#### Phase FINAL Spawn Command

```javascript
Task({
  subagent_type: 'reflection-agent',
  model: 'opus',
  description: 'Reflection on 10-enhancement implementation (3 sprints)',
  allowed_tools: ['Read', 'Write', 'Edit', 'Bash', 'TaskUpdate', 'TaskList', 'Skill'],
  prompt: `You are REFLECTION-AGENT. Read .claude/agents/core/reflection-agent.md.

Analyze the completed 10-enhancement implementation across 3 sprints:
- Sprint 1 (Immediate): Progressive disclosure, E2E tests, Task #25b
- Sprint 2 (Near-Term): ADR template, template catalog, security checklist
- Sprint 3 (Long-Term): Research prioritization, security registry, hybrid validation, commit checkpoints

Extract learnings to memory files:
1. What patterns emerged across sprints?
2. What unexpected challenges arose?
3. What evolution opportunities exist? (new agents/skills needed)

Output: Reflection report to .claude/context/artifacts/reflections/10-enhancements-reflection-2026-01-28.md`,
});
```

#### Success Criteria

- [ ] Reflection-agent spawned and completed
- [ ] Learnings extracted to `.claude/context/memory/learnings.md`
- [ ] Evolution opportunities logged if any detected
- [ ] Reflection report generated with RBT analysis (Roses/Buds/Thorns)

---

## Risks

| Risk                                                                    | Impact | Mitigation                                                                      | Rollback                                                   |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Progressive disclosure integration breaks spec-gathering**            | HIGH   | Test with comprehensive E2E suite before merging                                | `git checkout -- .claude/skills/spec-gathering/SKILL.md`   |
| **Template catalog discovery adds significant complexity**              | MEDIUM | Start with file-based approach (no database), defer advanced features           | Remove catalog, revert to direct file access               |
| **Security control registry schema becomes outdated**                   | MEDIUM | Use semantic versioning, document schema evolution process                      | Lock to v1.0.0 schema, migrate on major versions only      |
| **Hybrid validation extension conflicts with existing agent workflows** | HIGH   | Test each agent integration independently, use feature flags                    | Disable checklist-generator invocation, revert agent files |
| **Research prioritization algorithm biases toward high-impact only**    | LOW    | Include alignment score (0.4 weight) to balance feasibility, document rationale | Adjust weights: impact (0.5), alignment (0.5)              |
| **Sprint 3 overruns 90-day timeline**                                   | MEDIUM | Defer low-priority enhancements (#9 commit checkpoints) to Sprint 4 if needed   | De-scope Sprint 3 to only HIGH priority (#7, #8, #10)      |
| **Memory files become too large (>10MB)**                               | LOW    | Implement memory archiving pattern (move old learnings to archive/)             | Split learnings.md by year/quarter                         |

---

## Timeline Summary

| Phase                  | Tasks  | Est. Time      | Parallel?     | Sprint               |
| ---------------------- | ------ | -------------- | ------------- | -------------------- |
| **0 (Research)**       | 6      | 8-12 hours     | No (blocking) | Pre-Sprint           |
| **1 (Immediate)**      | 6      | 18 hours       | Partial       | Sprint 1 (Week 1-2)  |
| **2 (Near-Term)**      | 6      | 40 hours       | Partial       | Sprint 2 (Week 3-6)  |
| **3 (Long-Term)**      | 7      | 62 hours       | Partial       | Sprint 3 (Week 7-12) |
| **FINAL (Reflection)** | 3      | 4 hours        | No            | Post-Sprint          |
| **TOTAL**              | **28** | **~132 hours** |               | **90 days**          |

**Sprint Breakdown**:

- **Sprint 1** (Week 1-2): 18 hours → ~9 hours/week (sustainable pace)
- **Sprint 2** (Week 3-6): 40 hours → ~10 hours/week (sustainable pace)
- **Sprint 3** (Week 7-12): 62 hours → ~10 hours/week (sustainable pace)

**Parallelization Opportunities**:

- Sprint 1: Enhancements #1 and #2 can run in parallel (save 4 hours)
- Sprint 2: Enhancements #4, #5, #6 can run in parallel (save ~20 hours)
- Sprint 3: Enhancements #7, #8, #10 can run in parallel (save ~32 hours)

**Total Time Saved by Parallelization**: ~56 hours (42% reduction)

**Adjusted Timeline**: ~76 hours with parallelization (vs 132 hours sequential)

---

## Dependencies

### Enhancement Dependencies

```
Phase 0 (Research)
    ↓
├─→ Enhancement #1 (Progressive Disclosure) → Enhancement #3 (Task #25b)
├─→ Enhancement #2 (E2E Tests) [INDEPENDENT]
├─→ Enhancement #4 (ADR Template) → Enhancement #5 (Template Catalog)
├─→ Enhancement #6 (Security Checklist) [INDEPENDENT]
├─→ Enhancement #7 (Research Prioritization) [INDEPENDENT]
├─→ Enhancement #8 (Security Registry) [INDEPENDENT]
├─→ Enhancement #9 (Commit Checkpoints) [INDEPENDENT]
└─→ Enhancement #10 (Hybrid Validation) [INDEPENDENT]
```

### Critical Path

```
Phase 0 → Enhancement #1 → Enhancement #3 → Sprint 1 Complete
       → Enhancement #4 → Enhancement #5 → Sprint 2 Complete
       → Enhancement #8 → Sprint 3 Complete
```

**Critical Path Duration**: 8 (Phase 0) + 6 (Enh #1) + 2 (Enh #3) + 12 (Enh #4) + 16 (Enh #5) + 24 (Enh #8) = **68 hours**

---

## Success Criteria

### Overall Project Success

- [ ] All 10 enhancements delivered across 3 sprints
- [ ] Zero regressions (all existing tests passing)
- [ ] 100% test coverage for new features (E2E + unit tests)
- [ ] Documentation updated (README, CHANGELOG, guides)
- [ ] Memory files updated (learnings, decisions, issues)
- [ ] Reflection report completed with RBT analysis

### Sprint-Level Success

**Sprint 1 (Immediate)**:

- [ ] Progressive disclosure reduces clarifications to max 3 (90th percentile)
- [ ] Happy-path E2E test suite passing (21/21 tests)
- [ ] Task #25b created and visible in task tracking

**Sprint 2 (Near-Term)**:

- [ ] ADR template operational (80% → 100% decision consistency)
- [ ] Template catalog lists all 4 templates with usage tracking
- [ ] Security-first checklist integrated into EVOLVE Phase E

**Sprint 3 (Long-Term)**:

- [ ] Research prioritization saves 40-60 hours per project (TOP 5 of 18 pattern)
- [ ] Security control registry has 4+ reusable controls
- [ ] Hybrid validation extended to 3 agents (code-reviewer, security-architect, architect)
- [ ] Commit checkpoint pattern formalized for multi-file projects

---

## Key Deliverables

### Sprint 1 (Week 1-2)

1. **Progressive Disclosure Integration**: spec-gathering Phase 3.5 with 3-question limit
2. **Happy-Path E2E Test**: 21/21 passing test demonstrating ideal UX
3. **Task #25b**: Created and tracked for workflow integration

### Sprint 2 (Week 3-6)

4. **ADR Template**: `.claude/templates/adr-template.md` + schema + renderer support
5. **Template Catalog**: `.claude/context/artifacts/template-catalog.md` with discovery skill
6. **Security-First Checklist**: EVOLVE Phase E with STRIDE threat modeling

### Sprint 3 (Week 7-12)

7. **Research Prioritization Matrix**: EVOLVE Phase O with Impact × Alignment algorithm
8. **Security Control Registry**: `.claude/context/artifacts/security-controls-catalog.md` with 4+ controls
9. **Commit Checkpoint Pattern**: plan-generator auto-insertion for multi-file projects
10. **Hybrid Validation Extension**: code-reviewer + security-architect + architect agents use checklist-generator

---

## Post-Implementation Verification

After all 3 sprints complete, verify:

```bash
# Sprint 1 verification
grep "Phase 3.5.*progressive-disclosure" .claude/skills/spec-gathering/SKILL.md
node .claude/tests/integration/template-system-e2e-happy.test.cjs | grep "21 passing"
TaskList | grep "Task #25b"

# Sprint 2 verification
ls .claude/templates/adr-template.md
ls .claude/context/artifacts/template-catalog.md
grep "security.*checklist" .claude/workflows/core/evolution-workflow.md

# Sprint 3 verification
ls .claude/skills/research-prioritization/SKILL.md
ls .claude/context/artifacts/security-controls-catalog.md
grep "checklist-generator" .claude/agents/specialized/code-reviewer.md
grep "commit checkpoint" .claude/templates/plan-template.md

# Overall health check
echo "✓ All 10 enhancements delivered"
```

---

## Notes

- **Planner Agent**: This plan was created by planner agent (Task #2) following the reflection report analysis
- **Source Reference**: All 10 enhancements extracted from `.claude/context/artifacts/reflections/spec-kit-integration-reflection-2026-01-28.md`
- **ADR References**: New ADRs to be created in Phase 0: ADR-047 (Template Catalog), ADR-048 (Security Registry), ADR-049 (Research Prioritization)
- **Memory Protocol**: All learnings/decisions/issues recorded in `.claude/context/memory/` after each sprint
- **Parallelization Strategy**: 42% time savings by running independent enhancements in parallel
- **Critical Path**: 68 hours (vs 132 hours total) - focus on critical path for time-sensitive delivery
- **Evolution Opportunities**: Reflection agent (Phase FINAL) will identify patterns suggesting new agents/skills

---

**Plan Status**: Ready for Phase 0 (Research) execution
**Next Steps**: Spawn researcher agent to conduct Phase 0 research (12 queries across 4 categories)
**Estimated Total Duration**: 90 days (3 sprints × 30 days) or 76 hours with parallelization
**Framework Impact**: +10 high-value enhancements improving UX, security, templates, and quality validation
