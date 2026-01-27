# Learnings Archive - January 2026

> **Archive Date**: 2026-01-25
> **Archived From**: `.claude/context/memory/learnings.md`
> **Reason**: Main file exceeded 40000 tokens, compressed to maintain readability

---

## Archived Integration Details (2026-01-24)

This archive contains detailed integration logs that were compressed in the main learnings.md file. Reference this file for full implementation details.

---

## [2026-01-24] Auto-Claude Integration Complete

**Source**: Auto-Claude autonomous coding framework (https://github.com/cyanheads/Auto-Claude)
**Integration Date**: 2026-01-24
**Scope**: Security validators, specification workflow skills, analysis patterns, recovery patterns

### Files Created

**Security Validators** (6 files in `.claude/hooks/safety/validators/`):

- `shell-validators.cjs` - Bash/sh/zsh command validation (converted from `shell_validators.py`)
- `database-validators.cjs` - PostgreSQL/MySQL/Redis/MongoDB protection (converted from `database_validators.py`)
- `filesystem-validators.cjs` - chmod/rm/file operation validation (converted from `filesystem_validators.py`)
- `git-validators.cjs` - Git config/push protection (converted from `git_validators.py`)
- `process-validators.cjs` - kill/pkill/killall validation (converted from `process_validators.py`)
- `registry.cjs` - Central command registry and validation interface (converted from `validator_registry.py`)

**New Skills** (6 skills in `.claude/skills/`):

- `spec-gathering/SKILL.md` - Requirements gathering workflow (converted from `spec_gatherer.md`)
- `spec-writing/SKILL.md` - Specification document creation (converted from `spec_writer.md`)
- `spec-critique/SKILL.md` - Self-critique using extended thinking (converted from `spec_critic.md`)
- `complexity-assessment/SKILL.md` - Task complexity analysis (converted from `complexity_assessor.md`)
- `insight-extraction/SKILL.md` - Extract insights from coding sessions (converted from `insight_extractor.md`)
- `qa-workflow/SKILL.md` - QA validation and fix loop (converted from `qa_reviewer.md` + `qa_fixer.md`)

**Analysis Pattern References** (4 files in `.claude/skills/project-analyzer/references/`):

- `auto-claude-patterns.md` - Monorepo detection, service indicators, infrastructure detection
- `service-patterns.md` - Service type detection (frontend, backend, library), framework-specific patterns
- `database-patterns.md` - ORM detection (Prisma, SQLAlchemy, TypeORM, Drizzle, Mongoose)
- `route-patterns.md` - API route detection by framework (Express, FastAPI, Flask, Django, Next.js, Go, Rust)

**Recovery Pattern References** (3 files in `.claude/skills/recovery/references/`):

- `failure-types.md` - Failure classification (BROKEN_BUILD, VERIFICATION_FAILED, CIRCULAR_FIX, TIMEOUT, UNRECOVERABLE)
- `recovery-actions.md` - Recovery decision tree (rollback, retry, skip, escalate)
- `merge-strategies.md` - Git merge conflict strategies

### Integration Patterns Used

**Python to CommonJS Conversion**:

- Converted Python validators to JavaScript (`.py` -> `.cjs`)
- Maintained validator function signatures and return types
- Preserved validation logic and error messages
- Used CommonJS (`module.exports`) for Node.js compatibility

**Markdown System Prompts to Skills**:

- Converted Auto-Claude system prompts to SKILL.md format
- Added YAML frontmatter (`name`, `description`)
- Structured content with standard sections (Overview, When to Use, Core Pattern, etc.)
- Removed Auto-Claude-specific references (file paths, framework assumptions)

### Validator System Architecture

**Central Registry Pattern**:

```javascript
const VALIDATOR_REGISTRY = new Map([
  ['bash', shellValidators.validateBashCommand],
  ['rm', filesystemValidators.validateRmCommand],
  // ... more validators
]);
```

**Validation Function Signature**:

```javascript
function validateCommand(commandString) {
  return { valid: boolean, error: string };
}
```

**Allow-by-Default Policy**:

- Commands without registered validators are allowed
- Prevents blocking legitimate commands
- Focused protection on known dangerous operations

### Validation Coverage

**Shell Interpreters**: bash, sh, zsh (blocks eval, destructive flags)

**Databases**:

- PostgreSQL: dropdb, dropuser, psql
- MySQL: mysql, mysqladmin
- Redis: redis-cli (FLUSHDB, FLUSHALL)
- MongoDB: mongosh, mongo (dropDatabase)

**Filesystem**: chmod (777, recursive), rm (recursive critical paths)

**Git**: config (credential.helper), push --force

**Process Management**: kill, pkill, killall (system processes)

---

## [2026-01-24] Superpowers Integration Complete

### Skills Integrated (14 total)

**Foundation Skills (replaced existing):**

- `tdd` - Enhanced with Iron Laws, rationalization tables, testing anti-patterns
- `debugging` - Systematic 4-phase process with root-cause-tracing, defense-in-depth

**New Skills Added:**

- `verification-before-completion` - Gate Function pattern for evidence-based completion
- `brainstorming` - Socratic design refinement before implementation
- `writing-plans` - Bite-sized task creation (2-5 min tasks)
- `executing-plans` - Batch execution with review checkpoints
- `subagent-driven-development` - Two-stage review per task
- `using-git-worktrees` - Isolated workspace creation
- `finishing-a-development-branch` - Structured merge/PR workflow
- `dispatching-parallel-agents` - Concurrent agent coordination
- `requesting-code-review` - Code review dispatch protocol
- `receiving-code-review` - Review feedback processing
- `writing-skills` - TDD for documentation (skill authoring)
- `skill-discovery` - Skill invocation protocol

### Agent Added

- `code-reviewer` - Two-stage review (spec compliance THEN code quality)

### Key Patterns Adopted

1. **Iron Laws** - Inviolable rules ("NO X WITHOUT Y FIRST")
2. **Rationalization Tables** - Pre-emptive excuse countering
3. **Red Flags Lists** - Self-check triggers
4. **Gate Function** - Evidence-before-claims
5. **Two-Stage Review** - Spec compliance before quality review

### Tools Added

- `skills-core.js` - Skill discovery utilities
- `find-polluter.sh/.ps1` - Test pollution bisector
- `render-graphs.js` - Graphviz diagram renderer

---

## [2026-01-24] Language Pro Agent Integration

Successfully integrated 5 high-priority language pro agents from archived agents-main repo:

- `python-pro.md` - Python 3.12+ with modern tooling (uv, ruff, pydantic)
- `rust-pro.md` - Rust 1.75+ with async Tokio patterns
- `golang-pro.md` - Go 1.21+ with generics and workspaces
- `typescript-pro.md` - TypeScript advanced type systems
- `fastapi-pro.md` - FastAPI with async SQLAlchemy 2.0

### Transformations Applied

1. **Frontmatter Schema Compliance**: Added required fields (name, description, tools, model, temperature, priority, skills)
2. **Memory Protocol Section**: Added MANDATORY memory protocol at end of each agent
3. **Skills Integration**: All agents include: tdd, debugging, git-expert
4. **Core Persona Section**: Added structured persona (Identity, Style, Approach, Values)
5. **Workflow Section**: Added step-by-step workflow with skill invocation

---

## [2026-01-24] Conductor Plugin Integration

### Skills Integrated

1. **context-driven-development** - Context-Driven Development methodology
2. **track-management** - Track management (features, bugs, refactors)
3. **workflow-patterns** - TDD task implementation patterns

### Agent Integrated

1. **conductor-validator** - Validates Conductor project artifacts

### Key Patterns from Conductor

1. **Context as Code**: Treat project context as first-class managed artifact
2. **Track-Based Work**: Organize work into semantic units with spec -> plan -> implement flow
3. **Phase Checkpoints**: Verification gates after each phase with user approval
4. **Git Integration**: Commit SHAs in plan.md, git notes for rich summaries
5. **Status Markers**: Consistent [ ], [~], [x] markers for task tracking

---

## [2026-01-24] C4 Architecture Agents Integration

**Agents Created (4 total)**:

- `c4-code` - Code-level documentation specialist (lowest C4 level)
- `c4-component` - Component-level synthesis specialist
- `c4-container` - Container-level deployment mapping specialist
- `c4-context` - Context-level system documentation specialist

**Workflow Created**:

- `c4-architecture-workflow` - Complete C4 documentation workflow (bottom-up 4-phase process)

---

## [2026-01-24] Kubernetes Operations Skills Integration

### Skills Integrated (4 total)

1. **k8s-manifest-generator** - Production-ready Kubernetes manifests
2. **helm-chart-scaffolding** - Helm chart creation and management
3. **gitops-workflow** - GitOps with ArgoCD and Flux CD
4. **k8s-security-policies** - Pod Security Standards, NetworkPolicy, RBAC

### Key Kubernetes Patterns Installed

1. **Kubernetes Manifest Best Practices**: Resource limits, health checks, security contexts
2. **Helm Templating**: Go templating, values hierarchy, multi-environment configs
3. **GitOps Principles**: Declarative, versioned, pulled, continuously reconciled
4. **Defense-in-Depth Security**: NetworkPolicy + Pod Security Standards + RBAC

---

## [2026-01-24] Reverse Engineering Skills Integration

### Skills Integrated (3 total)

1. **binary-analysis-patterns** - x86-64 and ARM assembly patterns, Ghidra/IDA Pro
2. **memory-forensics** - Volatility 3 framework, malware analysis
3. **protocol-reverse-engineering** - Network protocol analysis, Wireshark dissectors

### Agent Created

1. **reverse-engineer** - Elite reverse engineer for binary analysis

**CRITICAL Security Transformations Applied**:

- All skills include explicit security disclaimer (AUTHORIZED USE ONLY)
- Agent includes authorization verification step (Step 0: Verify Authorization)

---

## [2026-01-24] Conductor-Main Integration

### Code Style Guides Created (8 files in `.claude/templates/code-styles/`)

- python.md, typescript.md, javascript.md, go.md, dart.md, csharp.md, html-css.md, general.md

### Skills Created (2 new)

1. **interactive-requirements-gathering** - A/B/C/D/E questionnaire framework
2. **smart-revert** - Git-aware smart revert for tracks, phases, tasks

### Skills Enhanced (1 existing)

1. **project-onboarding** - Added brownfield vs greenfield detection

### Workflow Created (1 new)

1. **conductor-setup-workflow** - 6-phase workflow for full project setup

---

## [2026-01-24] Serena Codebase Integration

### Skills Created (5 total)

1. **project-onboarding** - Guided codebase exploration
2. **thinking-tools** - Three structured thinking patterns
3. **summarize-changes** - Structured workflow for documenting changes
4. **operational-modes** - Four modes: planning, editing, interactive, one-shot
5. **session-handoff** - Prepare context for new conversations

### Key Patterns Adopted from Serena

1. **Mode-Based Tool Exclusion Pattern**: Dynamically exclude tools based on mode
2. **Memory Persistence Pattern**: Markdown-based memories
3. **Onboarding Workflow Pattern**: Check for existing memories before work
4. **Thinking Tool Pattern**: Self-reflection checkpoints at critical phases

---

## [2026-01-24] Creator Skills Enhancement

### skill-creator Enhanced

- Step 6: Update CLAUDE.md Skill Documentation (MANDATORY - BLOCKING)
- Step 7: Assign to Relevant Agents (MANDATORY - BLOCKING)
- Step 8: System Impact Analysis (BLOCKING - VERIFICATION CHECKLIST)

### agent-creator Enhanced

- Step 6: Validate Required Fields (BLOCKING)
- Step 7: Update CLAUDE.md Routing Table (MANDATORY - BLOCKING)
- Skill() Invocation Protocol Fixed

### workflow-creator Created

- ROUTER UPDATE REQUIRED section (CRITICAL - BLOCKING)
- Iron Laws of Workflow Creation (7 rules)

### task-management-protocol Created

- 4-Phase Protocol: Session Start, During Work, Completion, Handoff
- Iron Laws: Never complete without summary, always update on discovery

---

## [2026-01-24] Framework Templates Created

1. **agents/agent-template.md** - Complete agent template
2. **skills/skill-template.md** - Complete skill template
3. **workflows/workflow-template.md** - Complete workflow template
4. **README.md** - Template directory documentation

---

## [2026-01-24] Security Validators Test Results

**Comprehensive test suite: 29/29 tests pass**

- Shell validators: 3 tests
- Database validators: 7 tests
- Filesystem validators: 6 tests
- Git validators: 7 tests
- Process validators: 6 tests

---

## [2026-01-24] Hooks Created

1. **memory-reminder.cjs** - Runs on SessionStart to remind agents to read memory files
2. **enforce-claude-md-update.cjs** - Reminder system for CLAUDE.md updates
3. **extract-workflow-learnings.cjs** - Extracts learnings from completed workflows

---

## [2026-01-24] Documentation Updates

Updated all documentation in `.claude/docs/` to align with current framework state:

1. **USER_GUIDE.md** - Router-First Protocol, Skill() tool usage, domain agents
2. **ARCHITECTURE.md** - Skill Invocation Protocol, complete agent roster
3. **EXTENSIBILITY.md** - Templates section

---

## Schema Validation Audit Summary

- **Total Schemas**: 77 schemas (11 core + 66 skill schemas)
- **Validation Results**: 100% pass rate
- **Schema Standards**: Consistent JSON Schema draft-07 and draft-2020-12

---

## Skills System Audit Summary

- **Catalog-Directory Mismatch**: 92 skills existed but not cataloged (FIXED)
- **Scientific Skills Pattern**: Changed from `rdkit` to `scientific-skills/rdkit` (FIXED)
- **Total Skills**: 426 (284 directories + 139 scientific sub-skills)

---

_End of Archive - January 2026_
