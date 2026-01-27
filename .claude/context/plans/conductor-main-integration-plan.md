# Conductor-Main Integration Plan

**Date**: 2026-01-24
**Status**: IN PROGRESS
**Source**: C:\dev\projects\agent-studio\.claude.archive\.tmp\conductor-main

---

## Executive Summary

The conductor-main codebase is a Gemini CLI extension implementing Context-Driven Development (CDD) methodology. This plan identifies features to integrate into our existing .claude framework while avoiding duplication with previously integrated skills.

## Already Integrated (Previous Session)

The following Conductor concepts are already in our codebase:

| Conductor Feature | Our Implementation | Location |
|-------------------|-------------------|----------|
| Context artifacts (product.md, tech-stack.md, workflow.md) | `context-driven-development` skill | `.claude/skills/context-driven-development/` |
| Track lifecycle (spec.md, plan.md, metadata.json) | `track-management` skill | `.claude/skills/track-management/` |
| TDD workflow, phase checkpoints, git notes, SHA tracking | `workflow-patterns` skill | `.claude/skills/workflow-patterns/` |
| Conductor validation | `conductor-validator` agent | `.claude/agents/specialized/conductor-validator.md` |

## New Features to Integrate

### Tier 1: High Value, Direct Integration

#### 1. Code Style Guides (8 templates)
**Source**: `templates/code_styleguides/`
**Target**: `.claude/templates/code-styles/`
**Files**:
- `python.md` - Google Python Style Guide Summary
- `typescript.md` - Google TypeScript Style Guide (gts)
- `javascript.md` - Google JavaScript Style Guide
- `go.md` - Effective Go Summary
- `dart.md` - Effective Dart (239 lines, comprehensive)
- `csharp.md` - Google C# Style Guide
- `html-css.md` - Google HTML/CSS Style Guide
- `general.md` - Universal principles

**Value**: Ready-to-inject style context for agents working in specific languages.

#### 2. Interactive Questionnaire Framework
**Source**: `commands/conductor/setup.toml` (Sections 2.1-2.5)
**Target**: `.claude/skills/interactive-requirements-gathering/SKILL.md`
**Key Patterns**:
- A/B/C/D/E multiple choice structure
- "Additive" vs "Exclusive Choice" question classification
- Sequential questioning (one at a time)
- Auto-generate option (Option E)
- User confirmation loops

**Value**: Structured human-in-the-loop requirements gathering.

#### 3. Smart Revert
**Source**: `commands/conductor/revert.toml`
**Target**: `.claude/skills/smart-revert/SKILL.md`
**Key Features**:
- 4-phase revert protocol
- Git reconciliation for rewritten history
- Related commit identification
- Safe rollback with confirmation gates

**Value**: Production-grade revert logic for multi-commit work.

### Tier 2: Enhancement to Existing Skills

#### 4. Brownfield Analysis Protocol
**Source**: `commands/conductor/setup.toml` (Section 2.0)
**Target**: Enhance `.claude/skills/project-onboarding/SKILL.md`
**New Sections**:
- Respect .gitignore/.claudeignore
- Efficient file triage (head/tail for large files)
- Tech stack inference from manifests
- Context-aware questioning

#### 5. Conductor Setup Workflow
**Source**: `commands/conductor/setup.toml`
**Target**: `.claude/workflows/conductor-setup-workflow.md`
**Phases**:
1. Project Discovery (greenfield/brownfield detection)
2. Product Definition (product.md, product-guidelines.md)
3. Tech Stack Configuration
4. Workflow Customization
5. Initial Track Generation

### Tier 3: Already Covered

These features are already in our skills:

| Conductor Feature | Already In |
|-------------------|-----------|
| Git notes pattern | `workflow-patterns` |
| SHA tracking in plan.md | `track-management` |
| Phase checkpoint verification | `workflow-patterns` |
| TDD Red-Green-Refactor | `workflow-patterns`, `tdd` skill |
| Track types (feature/bug/chore/refactor) | `track-management` |

## Integration Checklist

- [ ] Task 1: Create this integration plan
- [ ] Task 2: Import code style guides to `.claude/templates/code-styles/`
- [ ] Task 3: Create `interactive-requirements-gathering` skill
- [ ] Task 4: Create `conductor-setup-workflow` workflow
- [ ] Task 5: Enhance `project-onboarding` with brownfield analysis
- [ ] Task 6: Create `smart-revert` skill
- [ ] Task 7: Run tests and validate
- [ ] Task 8: Update documentation

## Folder Structure After Integration

```
.claude/
├── skills/
│   ├── context-driven-development/     # existing
│   ├── track-management/               # existing
│   ├── workflow-patterns/              # existing
│   ├── project-onboarding/             # ENHANCED
│   ├── interactive-requirements-gathering/  # NEW
│   └── smart-revert/                   # NEW
├── templates/
│   └── code-styles/                    # NEW
│       ├── python.md
│       ├── typescript.md
│       ├── javascript.md
│       ├── go.md
│       ├── dart.md
│       ├── csharp.md
│       ├── html-css.md
│       └── general.md
└── workflows/
    └── conductor-setup-workflow.md     # NEW
```

## Test Criteria

1. All existing tests pass (no regression)
2. New skills have valid YAML frontmatter
3. New skills include Memory Protocol section
4. Code style guides are readable and well-formatted
5. Workflow follows established patterns

## Notes

- The conductor-main uses TOML for commands; we use Markdown for skills/workflows
- Their "commands" map to our "skills" + "workflows"
- State persistence (setup_state.json) pattern is useful but not a separate skill - it's a technique that can be mentioned in skills that need resume capability
