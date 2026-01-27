# Auto-Claude Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Integrate high-value artifacts from Auto-Claude codebase into agent-studio framework to enhance security validation, spec creation workflows, and project analysis capabilities.

**Architecture:** Convert Python validators and prompts to JavaScript CJS hooks and markdown skills. Preserve analysis patterns as skill enhancements. Security validators become safety hooks. System prompts become workflow skills.

**Tech Stack:** JavaScript/CJS for hooks, Markdown for skills, JSON for configuration

---

## Executive Summary

This plan integrates 4 tiers of artifacts from the Auto-Claude autonomous coding framework:
1. **Security Validators** - Python validators converted to CJS hooks for command safety
2. **System Prompts** - High-value prompts converted to workflow skills
3. **Analysis Framework** - Enhancement of existing project-analyzer skill
4. **Recovery Manager** - Enhancement of existing recovery skill with failure classification

---

## Review Required

- [ ] **Architect Review**: Required - Security hooks affect system-wide command execution
- [ ] **Security Review**: Required - Security validators are critical safety infrastructure

### Review Focus Areas

- Architect: Hook integration patterns, skill structure, naming conventions
- Security: Validator completeness, bypass prevention, command allowlist accuracy

---

## Phase 1: Security Validators to Hooks

**Dependencies**: None
**Parallel OK**: No (sequential for safety)
**Estimated Time**: ~90 minutes

### Source Files

| File | Purpose | Lines |
|------|---------|-------|
| `shell_validators.py` | Bash -c command validation | 154 |
| `database_validators.py` | SQL injection prevention | ~200 |
| `filesystem_validators.py` | Path traversal prevention | ~150 |
| `git_validators.py` | Git command safety | ~100 |
| `process_validators.py` | Process execution safety | ~100 |
| `validator_registry.py` | Pluggable validator system | 78 |

### Target Location

`.claude/hooks/safety/` (existing directory)

### Conversion Steps

#### Tasks

- [ ] **1.1** Create command-validator hook scaffold (~10 min)
  - **Command**: `echo "Creating hook directory and base files"`
  - **Files**:
    - Create: `.claude/hooks/safety/command-validator.cjs`
    - Create: `.claude/hooks/safety/validators/index.cjs`
  - **Verify**: `ls -la .claude/hooks/safety/command-validator.cjs`
  - **Rollback**: `rm -rf .claude/hooks/safety/command-validator.cjs`

- [ ] **1.2** Convert shell_validators.py to shell-validators.cjs (~20 min)
  - **Command**: Read Python source, translate to CJS
  - **Key Logic**:
    - `_extract_c_argument()` - Extract command after bash -c
    - `validate_shell_c_command()` - Validate nested commands
    - SHELL_INTERPRETERS list: bash, sh, zsh
  - **Files**:
    - Create: `.claude/hooks/safety/validators/shell-validators.cjs`
  - **Verify**: `node -c .claude/hooks/safety/validators/shell-validators.cjs`

- [ ] **1.3** Convert database_validators.py to database-validators.cjs (~15 min)
  - **Command**: Read Python source, translate to CJS
  - **Key Logic**:
    - SQL injection patterns
    - DROP DATABASE/USER detection
    - psql, mysql, redis-cli validation
  - **Files**:
    - Create: `.claude/hooks/safety/validators/database-validators.cjs`
  - **Verify**: `node -c .claude/hooks/safety/validators/database-validators.cjs`

- [ ] **1.4** Convert filesystem_validators.py to filesystem-validators.cjs (~15 min)
  - **Command**: Read Python source, translate to CJS
  - **Key Logic**:
    - Path traversal detection (../)
    - rm -rf protection
    - chmod validation
  - **Files**:
    - Create: `.claude/hooks/safety/validators/filesystem-validators.cjs`
  - **Verify**: `node -c .claude/hooks/safety/validators/filesystem-validators.cjs`

- [ ] **1.5** Convert git_validators.py to git-validators.cjs (~10 min)
  - **Command**: Read Python source, translate to CJS
  - **Key Logic**:
    - git commit validation
    - Prevent force push
    - Branch protection
  - **Files**:
    - Create: `.claude/hooks/safety/validators/git-validators.cjs`
  - **Verify**: `node -c .claude/hooks/safety/validators/git-validators.cjs`

- [ ] **1.6** Convert process_validators.py to process-validators.cjs (~10 min)
  - **Command**: Read Python source, translate to CJS
  - **Key Logic**:
    - kill/pkill/killall validation
    - Prevent killing system processes
  - **Files**:
    - Create: `.claude/hooks/safety/validators/process-validators.cjs`
  - **Verify**: `node -c .claude/hooks/safety/validators/process-validators.cjs`

- [ ] **1.7** Create validator registry (~10 min)
  - **Command**: Create central registry mapping commands to validators
  - **Files**:
    - Create: `.claude/hooks/safety/validators/registry.cjs`
  - **Pattern**:
    ```javascript
    const VALIDATORS = {
      'bash': require('./shell-validators').validateBashCommand,
      'rm': require('./filesystem-validators').validateRmCommand,
      // ... etc
    };
    ```
  - **Verify**: `node -c .claude/hooks/safety/validators/registry.cjs`

- [ ] **1.8** Integrate with existing hook system (~15 min)
  - **Command**: Wire validators into command-validator.cjs hook
  - **Hook Type**: PreToolUse (intercept before Bash tool execution)
  - **Files**:
    - Edit: `.claude/hooks/safety/command-validator.cjs`
  - **Verify**: `node .claude/hooks/safety/command-validator.cjs --test`

#### Phase 1 Error Handling

If any task fails:
1. Run rollback commands for completed tasks (reverse order)
2. Document error: `echo "Phase 1 failed: [error]" >> .claude/context/memory/issues.md`
3. Do NOT proceed to Phase 2

#### Phase 1 Verification Gate

```bash
# All validators must pass syntax check
node -c .claude/hooks/safety/validators/*.cjs
# Registry must export getValidator function
node -e "const r = require('./.claude/hooks/safety/validators/registry.cjs'); console.log(typeof r.getValidator)"
```

---

## Phase 2: System Prompts to Skills

**Dependencies**: None (parallel with Phase 1 possible)
**Parallel OK**: Yes (prompts are independent)
**Estimated Time**: ~120 minutes

### Source Files (High Value)

| File | Purpose | Target Skill |
|------|---------|--------------|
| `spec_gatherer.md` | Requirements gathering | `spec-gathering` (new) |
| `spec_writer.md` | Spec document creation | `spec-writing` (new) |
| `spec_critic.md` | Self-critique with extended thinking | `spec-critique` (new) |
| `qa_reviewer.md` | QA validation | Enhance existing `qa` agent |
| `qa_fixer.md` | Issue fixing loop | Enhance existing `qa` agent |
| `coder_recovery.md` | Recovery from stuck states | Enhance `recovery` skill |
| `complexity_assessor.md` | AI complexity assessment | `complexity-assessment` (new) |
| `insight_extractor.md` | Extract actionable insights | `insight-extraction` (new) |

### Naming Conflict Check

| Proposed Name | Existing? | Resolution |
|---------------|-----------|------------|
| `spec-gathering` | No | Create new |
| `spec-writing` | No | Create new |
| `spec-critique` | No | Create new |
| `complexity-assessment` | No | Create new |
| `insight-extraction` | No | Create new |

### Conversion Steps

#### Tasks

- [ ] **2.1** Create spec-gathering skill (~20 min)
  - **Source**: `apps/backend/prompts/spec_gatherer.md`
  - **Target**: `.claude/skills/spec-gathering/SKILL.md`
  - **Transformations**:
    - Add YAML frontmatter (name, description, version, model, tools)
    - Add Memory Protocol section
    - Convert bash commands to framework paths
    - Replace `requirements.json` with `.claude/context/artifacts/requirements.json`
  - **Verify**: `grep "Memory Protocol" .claude/skills/spec-gathering/SKILL.md`

- [ ] **2.2** Create spec-writing skill (~20 min)
  - **Source**: `apps/backend/prompts/spec_writer.md`
  - **Target**: `.claude/skills/spec-writing/SKILL.md`
  - **Transformations**:
    - Add YAML frontmatter
    - Add Memory Protocol section
    - Update file paths for framework
    - Reference `spec-gathering` skill output
  - **Verify**: `grep "Memory Protocol" .claude/skills/spec-writing/SKILL.md`

- [ ] **2.3** Create spec-critique skill (~20 min)
  - **Source**: `apps/backend/prompts/spec_critic.md`
  - **Target**: `.claude/skills/spec-critique/SKILL.md`
  - **Key Feature**: Extended thinking (ultrathink) for deep analysis
  - **Transformations**:
    - Add YAML frontmatter with `extended_thinking: true`
    - Add Memory Protocol section
    - Update Context7 MCP tool references
  - **Verify**: `grep "extended_thinking" .claude/skills/spec-critique/SKILL.md`

- [ ] **2.4** Create complexity-assessment skill (~15 min)
  - **Source**: `apps/backend/prompts/complexity_assessor.md`
  - **Target**: `.claude/skills/complexity-assessment/SKILL.md`
  - **Output**: Complexity level (simple, standard, complex)
  - **Verify**: `grep "Memory Protocol" .claude/skills/complexity-assessment/SKILL.md`

- [ ] **2.5** Create insight-extraction skill (~15 min)
  - **Source**: `apps/backend/prompts/insight_extractor.md`
  - **Target**: `.claude/skills/insight-extraction/SKILL.md`
  - **Purpose**: Extract actionable insights from agent sessions
  - **Verify**: `grep "Memory Protocol" .claude/skills/insight-extraction/SKILL.md`

- [ ] **2.6** Enhance recovery skill with coder_recovery patterns (~15 min)
  - **Source**: `apps/backend/prompts/coder_recovery.md`
  - **Target**: `.claude/skills/recovery/SKILL.md` (enhance existing)
  - **Additions**:
    - Stuck state detection patterns
    - Different approach suggestions
    - Loop prevention
  - **Verify**: `grep "stuck" .claude/skills/recovery/SKILL.md`

- [ ] **2.7** Create QA enhancement document (~15 min)
  - **Source**: `apps/backend/prompts/qa_reviewer.md`, `qa_fixer.md`
  - **Target**: `.claude/skills/qa-workflow/SKILL.md` (new)
  - **Contents**:
    - QA validation phases
    - Fix request format
    - Context7 third-party API validation
    - Validation loop behavior
  - **Verify**: `grep "Memory Protocol" .claude/skills/qa-workflow/SKILL.md`

#### Phase 2 Error Handling

If any task fails:
1. Complete skills created successfully remain valid
2. Document error in `.claude/context/memory/issues.md`
3. Continue with remaining skills

#### Phase 2 Verification Gate

```bash
# All new skills must have YAML frontmatter
for skill in spec-gathering spec-writing spec-critique complexity-assessment insight-extraction qa-workflow; do
  grep -q "^---" .claude/skills/$skill/SKILL.md && echo "$skill: OK" || echo "$skill: MISSING FRONTMATTER"
done

# All must have Memory Protocol
for skill in spec-gathering spec-writing spec-critique complexity-assessment insight-extraction qa-workflow; do
  grep -q "Memory Protocol" .claude/skills/$skill/SKILL.md && echo "$skill: OK" || echo "$skill: MISSING MEMORY PROTOCOL"
done
```

---

## Phase 3: Analysis Framework Enhancement

**Dependencies**: None
**Parallel OK**: Yes
**Estimated Time**: ~60 minutes

### Source Files

| File | Purpose |
|------|---------|
| `project_analyzer_module.py` | Project structure detection |
| `service_analyzer.py` | Service/package analysis |
| `framework_analyzer.py` | Tech stack detection |
| `database_detector.py` | Database config detection |
| `route_detector.py` | API endpoint discovery |
| `port_detector.py` | Service port detection |

### Target: Enhance Existing project-analyzer Skill

The existing `project-analyzer` skill at `.claude/skills/project-analyzer/SKILL.md` is comprehensive (555 lines). Auto-Claude provides complementary detection patterns.

### Enhancement Strategy

Rather than replacing, add supplementary references:

#### Tasks

- [ ] **3.1** Create analysis patterns reference document (~20 min)
  - **Target**: `.claude/skills/project-analyzer/references/auto-claude-patterns.md`
  - **Contents**:
    - Monorepo indicators from `project_analyzer_module.py`
    - SERVICE_INDICATORS and SERVICE_ROOT_FILES lists
    - Infrastructure detection patterns
    - Conventions detection patterns
  - **Verify**: `ls .claude/skills/project-analyzer/references/auto-claude-patterns.md`

- [ ] **3.2** Create service detection patterns (~15 min)
  - **Source**: `service_analyzer.py`
  - **Target**: `.claude/skills/project-analyzer/references/service-patterns.md`
  - **Contents**:
    - Service type detection (frontend, backend, library)
    - Framework-specific patterns
    - Entry point detection
  - **Verify**: `ls .claude/skills/project-analyzer/references/service-patterns.md`

- [ ] **3.3** Create database detection patterns (~10 min)
  - **Source**: `database_detector.py`
  - **Target**: `.claude/skills/project-analyzer/references/database-patterns.md`
  - **Contents**:
    - Database configuration file patterns
    - ORM detection (Prisma, SQLAlchemy, TypeORM)
    - Connection string patterns
  - **Verify**: `ls .claude/skills/project-analyzer/references/database-patterns.md`

- [ ] **3.4** Create API route detection patterns (~10 min)
  - **Source**: `route_detector.py`
  - **Target**: `.claude/skills/project-analyzer/references/route-patterns.md`
  - **Contents**:
    - Express route patterns
    - FastAPI route patterns
    - Next.js API route patterns
  - **Verify**: `ls .claude/skills/project-analyzer/references/route-patterns.md`

- [ ] **3.5** Update project-analyzer SKILL.md to reference new patterns (~5 min)
  - **Target**: `.claude/skills/project-analyzer/SKILL.md`
  - **Edit**: Add references section pointing to new pattern files
  - **Verify**: `grep "auto-claude-patterns" .claude/skills/project-analyzer/SKILL.md`

#### Phase 3 Verification Gate

```bash
# All reference files exist
ls .claude/skills/project-analyzer/references/*.md | wc -l
# Should be >= 4 new files
```

---

## Phase 4: Recovery Manager Enhancement

**Dependencies**: Phase 2 (recovery skill enhancement)
**Parallel OK**: No
**Estimated Time**: ~45 minutes

### Source Files

| File | Purpose |
|------|---------|
| `recovery.py` | Smart rollback and recovery system |

### Target: Enhance Existing recovery Skill

Key patterns to integrate:
1. **FailureType classification** (BROKEN_BUILD, VERIFICATION_FAILED, CIRCULAR_FIX, CONTEXT_EXHAUSTED, UNKNOWN)
2. **RecoveryAction patterns** (rollback, retry, skip, escalate)
3. **Circular fix detection** (same approach tried multiple times)
4. **Attempt history tracking**

#### Tasks

- [ ] **4.1** Create failure classification reference (~15 min)
  - **Target**: `.claude/skills/recovery/references/failure-types.md`
  - **Contents**:
    - FailureType enum with descriptions
    - Error pattern matching rules
    - Classification algorithm
  - **Verify**: `ls .claude/skills/recovery/references/failure-types.md`

- [ ] **4.2** Create recovery actions reference (~15 min)
  - **Target**: `.claude/skills/recovery/references/recovery-actions.md`
  - **Contents**:
    - RecoveryAction types (rollback, retry, skip, escalate)
    - Decision tree for action selection
    - Attempt count thresholds
  - **Verify**: `ls .claude/skills/recovery/references/recovery-actions.md`

- [ ] **4.3** Enhance recovery SKILL.md with new patterns (~15 min)
  - **Target**: `.claude/skills/recovery/SKILL.md`
  - **Additions**:
    - Failure classification section
    - Circular fix detection algorithm
    - Recovery hints generation
    - Reference to new pattern files
  - **Verify**: `grep "FailureType" .claude/skills/recovery/SKILL.md`

#### Phase 4 Verification Gate

```bash
# Recovery skill enhanced
grep -q "BROKEN_BUILD\|CIRCULAR_FIX" .claude/skills/recovery/SKILL.md && echo "OK" || echo "FAIL"
# Reference files exist
ls .claude/skills/recovery/references/*.md | wc -l
```

---

## Phase 5: CLAUDE.md Router Update

**Dependencies**: Phases 1-4
**Parallel OK**: No
**Estimated Time**: ~15 minutes

**IRON LAW**: NO INTEGRATION WITHOUT CLAUDE.MD UPDATE

#### Tasks

- [ ] **5.1** Update CLAUDE.md Section 8.5 with new skills (~10 min)
  - **Add entries for**:
    - spec-gathering - Requirements gathering workflow
    - spec-writing - Spec document creation
    - spec-critique - Self-critique with extended thinking
    - complexity-assessment - AI complexity assessment
    - insight-extraction - Actionable insight extraction
    - qa-workflow - QA validation and fix loop
  - **Verify**: `grep "spec-gathering" .claude/CLAUDE.md`

- [ ] **5.2** Document security hooks in config.yaml (~5 min)
  - **Target**: `.claude/config.yaml`
  - **Add**: Hook registration for command-validator
  - **Verify**: `grep "command-validator" .claude/config.yaml`

#### Phase 5 Verification Gate

```bash
# All new skills in CLAUDE.md
for skill in spec-gathering spec-writing spec-critique complexity-assessment insight-extraction qa-workflow; do
  grep -q "$skill" .claude/CLAUDE.md && echo "$skill: REGISTERED" || echo "$skill: MISSING"
done
```

---

## Phase 6: Documentation and Memory Update

**Dependencies**: Phases 1-5
**Parallel OK**: No
**Estimated Time**: ~15 minutes

#### Tasks

- [ ] **6.1** Update learnings.md with integration summary (~10 min)
  - **Target**: `.claude/context/memory/learnings.md`
  - **Add**:
    - Auto-Claude integration summary
    - List of new skills created
    - List of hooks added
    - Pattern references added
  - **Verify**: `grep "Auto-Claude" .claude/context/memory/learnings.md`

- [ ] **6.2** Create integration report (~5 min)
  - **Target**: `.claude/context/reports/auto-claude-integration-report.md`
  - **Contents**:
    - Summary of artifacts integrated
    - Verification results
    - Any issues encountered
  - **Verify**: `ls .claude/context/reports/auto-claude-integration-report.md`

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| Hook breaks Bash execution | High | Test thoroughly before enabling | `git checkout .claude/hooks/safety/` |
| Skill naming conflict | Medium | Check existing 273 skills first | Rename skill |
| Python to CJS translation error | Medium | Test each validator individually | Fix specific validator |
| Router not updated | High | Verify CLAUDE.md changes | Edit CLAUDE.md manually |

---

## Testing Strategy

### Unit Tests

For each validator hook:
```bash
# Test command validation
echo "Testing shell validator..."
node -e "const v = require('./.claude/hooks/safety/validators/shell-validators.cjs'); console.log(v.validateBashCommand('bash -c \"npm test\"'))"
```

### Integration Tests

```bash
# Test hook registration
claude hooks list | grep command-validator

# Test skill discovery
claude skills list | grep spec-gathering
```

### Smoke Test

```bash
# Verify no breaking changes
npm test
```

---

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? |
|-------|-------|-----------|-----------|
| 1 | 8 | 90 min | No |
| 2 | 7 | 120 min | Yes |
| 3 | 5 | 60 min | Yes |
| 4 | 3 | 45 min | No |
| 5 | 2 | 15 min | No |
| 6 | 2 | 15 min | No |
| **Total** | **27** | **~345 min (~6 hours)** | |

---

## Acceptance Criteria

- [ ] All 6 security validators converted to CJS and passing syntax checks
- [ ] Validator registry exports `getValidator(commandName)` function
- [ ] All 6 new skills created with proper YAML frontmatter and Memory Protocol
- [ ] project-analyzer skill has 4 new reference documents
- [ ] recovery skill enhanced with failure classification
- [ ] CLAUDE.md updated with all new skills
- [ ] learnings.md updated with integration summary
- [ ] `npm test` passes (no regressions)

---

## What NOT to Integrate (and why)

| Artifact | Reason |
|----------|--------|
| `orchestrator.py` | Framework already has master-orchestrator agent |
| `context.py` | Framework uses different context management |
| `merge/` directory | Complex Python AST manipulation, not portable |
| `tools_pkg/permissions.py` | Framework uses different permission model |
| GitHub prompts (`pr_*.md`) | Framework has dedicated code-reviewer agent |
| MCP validation prompts | Too specific to Auto-Claude MCP setup |

---

## Post-Integration Checklist

After implementation:

1. [ ] Run `npm test` - no regressions
2. [ ] Test one security validator manually
3. [ ] Invoke one new skill via Skill() tool
4. [ ] Verify CLAUDE.md routes correctly
5. [ ] Archive source files to `.claude.archive/integrated/auto-claude/`
