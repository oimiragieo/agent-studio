# File Placement Rules

**Version**: 1.0.0
**Last Updated**: 2026-01-25
**Enforced By**: `file-placement-guard.cjs`

This document defines the MANDATORY rules for where agents must place files they create. These rules ensure consistent organization, predictable artifact locations, and maintainable codebase structure.

---

## Overview

### Purpose

1. **Consistency**: All agents follow the same placement rules
2. **Discoverability**: Files are where developers expect them
3. **Automation**: Hooks can validate and enforce placement
4. **Maintainability**: Clear separation of concerns

### Enforcement

- **Hook**: `.claude/hooks/safety/file-placement-guard.cjs`
- **Trigger**: PreToolUse on Write and Edit operations
- **Default Mode**: Block (prevents writes to invalid locations)
- **Override**: Set `FILE_PLACEMENT_OVERRIDE=true` environment variable

---

## Directory Purposes

### .claude/agents/

**Purpose**: Agent definition files ONLY

| Attribute     | Value                                                |
| ------------- | ---------------------------------------------------- |
| Allowed files | `*.md` agent definitions                             |
| File naming   | `{agent-name}.md` (kebab-case)                       |
| Structure     | `core/`, `domain/`, `specialized/`, `orchestrators/` |

**Subdirectory Categories**:

- `core/` - Essential agents (router, planner, developer, qa, architect)
- `domain/` - Language/framework specialists (python-pro, typescript-pro)
- `specialized/` - Task-specific agents (security-architect, code-reviewer)
- `orchestrators/` - Multi-agent coordinators (master-orchestrator, swarm-coordinator)

**Example**:

```
.claude/agents/domain/my-new-agent.md
```

---

### .claude/skills/

**Purpose**: Skill definitions and associated files

| Attribute     | Value                                              |
| ------------- | -------------------------------------------------- |
| Allowed files | `SKILL.md`, `metadata.json`, `tests/`, `examples/` |
| Structure     | `{skill-name}/SKILL.md`                            |
| Naming        | `{skill-name}/` directory (kebab-case)             |

**Required Structure**:

```
.claude/skills/{skill-name}/
├── SKILL.md           # Main skill definition (REQUIRED)
├── metadata.json      # Skill metadata (optional)
├── tests/             # Skill tests (optional)
└── examples/          # Usage examples (optional)
```

**Example**:

```
.claude/skills/my-new-skill/SKILL.md
```

---

### .claude/hooks/

**Purpose**: Pre/post tool execution hooks

| Attribute     | Value                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Allowed files | `*.cjs`, `*.test.cjs`                                                                                     |
| Structure     | `routing/`, `safety/`, `memory/`, `evolution/`, `session/`, `validation/`, `reflection/`, `self-healing/` |
| Naming        | `{hook-name}.cjs` (kebab-case)                                                                            |

**Subdirectory Categories**:

- `routing/` - Router enforcement hooks
- `safety/` - Safety guardrails (write guards, TDD checks)
- `memory/` - Memory management hooks
- `evolution/` - Self-evolution enforcement
- `session/` - Session management
- `validation/` - Input/output validation
- `reflection/` - Self-reflection triggers
- `self-healing/` - Anomaly detection, recovery

**Example**:

```
.claude/hooks/safety/my-guard.cjs
.claude/hooks/safety/my-guard.test.cjs  # Co-located test
```

---

### .claude/workflows/

**Purpose**: Multi-step workflow definitions

| Attribute     | Value                                           |
| ------------- | ----------------------------------------------- |
| Allowed files | `*.md`, `*.yaml`                                |
| Structure     | `core/`, `enterprise/`, `operations/`, `rapid/` |
| Naming        | `{workflow-name}.md` or `{workflow-name}.yaml`  |

**Subdirectory Categories**:

- `core/` - Fundamental workflows (router-decision, skill-lifecycle)
- `enterprise/` - Complex orchestration patterns
- `operations/` - Operational workflows (incident-response)
- `rapid/` - Quick one-shot workflows

**Example**:

```
.claude/workflows/core/my-workflow.md
```

---

### .claude/context/

**Purpose**: Runtime context, artifacts, and memory

| Subdirectory                  | Purpose                        | Allowed Files                               |
| ----------------------------- | ------------------------------ | ------------------------------------------- |
| `artifacts/`                  | Generated outputs              | `*.md`, `*.json`                            |
| `plans/`                      | Planner outputs                | `*-plan.md`                                 |
| `artifacts/reports/`          | QA, security, audit reports    | `*-report.md`, `*-audit.md`                 |
| `artifacts/research-reports/` | Research synthesis outputs     | `*-research.md`                             |
| `memory/`                     | Persistent memory files        | `learnings.md`, `decisions.md`, `issues.md` |
| `config/`                     | Configuration files            | `*.json`, `*.yaml`                          |
| `runtime/`                    | Temporary runtime state        | `*.json`                                    |
| `checkpoints/`                | Workflow checkpoints           | `*.json`                                    |
| `sessions/`                   | Session data                   | `*.json`                                    |
| `tmp/`                        | Temporary files (auto-cleaned) | Any                                         |
| `backups/`                    | System backups                 | Any                                         |

**Example Paths**:

```
.claude/context/plans/auth-feature-plan.md
.claude/context/artifacts/reports/security-audit.md
.claude/context/artifacts/research-reports/oauth-research.md
.claude/context/memory/learnings.md
.claude/context/config/reflection-rubrics.json
```

---

### .claude/templates/

**Purpose**: Artifact templates

| Attribute     | Value                                          |
| ------------- | ---------------------------------------------- |
| Allowed files | `*.md`, `*.yaml` template files                |
| Structure     | `agents/`, `skills/`, `reports/`, `workflows/` |
| Naming        | `{template-name}-template.md`                  |

**Example**:

```
.claude/templates/reports/plan-template.md
```

---

### .claude/schemas/

**Purpose**: JSON Schema validation files

| Attribute     | Value                  |
| ------------- | ---------------------- |
| Allowed files | `*.schema.json`        |
| Naming        | `{entity}.schema.json` |

**Example**:

```
.claude/schemas/agent.schema.json
```

---

### .claude/docs/

**Purpose**: Framework documentation

| Attribute     | Value                                   |
| ------------- | --------------------------------------- |
| Allowed files | `*.md` documentation files              |
| Naming        | `{TOPIC}.md` (UPPERCASE for major docs) |

**Example**:

```
.claude/docs/FILE_PLACEMENT_RULES.md
```

---

### .claude/lib/

**Purpose**: Shared library code (INTERNAL framework only)

| Attribute     | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Allowed files | `*.cjs`, `*.mjs`, `*.test.cjs`                          |
| Structure     | `workflow/`, `memory/`, `integration/`, `self-healing/` |
| Access        | Framework internals ONLY - agents should NOT write here |

**Note**: This directory is for framework internals. Agent outputs should go to `context/artifacts/` instead.

---

### .claude/tools/

**Purpose**: CLI utilities and integrations

| Attribute | Value                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Structure | `cli/`, `integrations/`, `analysis/`, `visualization/`, `optimization/`, `runtime/`, `utils/`, `mcp/`, `validation/` |
| Note      | For standalone utilities, not agent outputs                                                                          |

---

## File Type Rules

| File Type                    | Allowed Locations                     | Naming Convention                           |
| ---------------------------- | ------------------------------------- | ------------------------------------------- |
| Agent definitions (`*.md`)   | `agents/{category}/`                  | `{agent-name}.md`                           |
| Skill definitions            | `skills/{name}/`                      | `SKILL.md`                                  |
| Hooks (`*.cjs`)              | `hooks/{category}/`                   | `{hook-name}.cjs`                           |
| Hook tests                   | `hooks/{category}/`                   | `{hook-name}.test.cjs`                      |
| Workflows (`*.md`, `*.yaml`) | `workflows/{category}/`               | `{workflow-name}.md`                        |
| Plans                        | `context/plans/`                      | `{feature}-plan.md`                         |
| Reports                      | `context/artifacts/reports/`          | `{task}-report.md`                          |
| Research                     | `context/artifacts/research-reports/` | `{topic}-research.md`                       |
| Memory                       | `context/memory/`                     | `learnings.md`, `decisions.md`, `issues.md` |
| Config                       | `context/config/`                     | `{config-name}.json`                        |
| Schemas                      | `schemas/`                            | `{entity}.schema.json`                      |
| Documentation                | `docs/`                               | `{TOPIC}.md`                                |
| Templates                    | `templates/{category}/`               | `{name}-template.md`                        |

---

## Forbidden Locations

Agents must **NEVER** create files in:

| Location                     | Reason                                    |
| ---------------------------- | ----------------------------------------- |
| Root of `.claude/`           | Only CLAUDE.md and settings files allowed |
| `.claude/lib/`               | Framework internal code only              |
| Outside `.claude/` directory | Project isolation                         |
| Directly in `context/`       | Must use subdirectories                   |
| Directly in `artifacts/`     | Must use category subdirectories          |

---

## Override Mechanism

If a file MUST be placed outside normal rules:

### Method 1: Environment Variable

```bash
FILE_PLACEMENT_OVERRIDE=true claude
```

### Method 2: Task Metadata

```javascript
TaskUpdate({
  taskId: 'X',
  metadata: { filePlacementOverride: true, justification: '...' },
});
```

### Requirements for Override

1. Document justification in commit message
2. If location becomes standard, update this document
3. Log override in `.claude/context/runtime/placement-overrides.log`

---

## Examples

### Creating a New Agent

```
Correct:   .claude/agents/domain/my-agent.md
Incorrect: .claude/my-agent.md
Incorrect: .claude/agents/my-agent.md (missing category)
```

### Creating a Plan

```
Correct:   .claude/context/plans/feature-x-plan.md
Incorrect: .claude/context/plans/feature-x-plan.md (wrong path)
Incorrect: .claude/context/artifacts/feature-x-plan.md (missing plans/)
```

### Creating a Research Report

```
Correct:   .claude/context/artifacts/research-reports/oauth-research.md
Incorrect: .claude/context/research/oauth-research.md (wrong path)
```

### Creating a Hook

```
Correct:   .claude/hooks/safety/my-hook.cjs
Correct:   .claude/hooks/safety/my-hook.test.cjs (co-located test)
Incorrect: .claude/hooks/my-hook.cjs (missing category)
```

### Creating a Skill

```
Correct:   .claude/skills/my-skill/SKILL.md
Incorrect: .claude/skills/my-skill.md (not in directory)
Incorrect: .claude/skills/my-skill/skill.md (wrong filename)
```

### Creating a Workflow

```
Correct:   .claude/workflows/core/my-workflow.md
Incorrect: .claude/workflows/my-workflow.md (missing category)
```

### Creating a Schema

```
Correct:   .claude/schemas/my-entity.schema.json
Incorrect: .claude/schemas/my-entity.json (missing .schema suffix)
```

---

## Validation Rules (Hook Logic)

The `file-placement-guard.cjs` hook validates paths against these patterns:

```javascript
const PLACEMENT_RULES = {
  // Agent definitions
  'agents/core/': /\.md$/,
  'agents/domain/': /\.md$/,
  'agents/specialized/': /\.md$/,
  'agents/orchestrators/': /\.md$/,

  // Skills
  'skills/': /\/SKILL\.md$/,

  // Hooks
  'hooks/routing/': /\.cjs$/,
  'hooks/safety/': /\.cjs$/,
  'hooks/memory/': /\.cjs$/,
  'hooks/evolution/': /\.cjs$/,
  'hooks/session/': /\.cjs$/,
  'hooks/validation/': /\.cjs$/,
  'hooks/reflection/': /\.cjs$/,
  'hooks/self-healing/': /\.cjs$/,

  // Workflows
  'workflows/core/': /\.(md|yaml)$/,
  'workflows/enterprise/': /\.(md|yaml)$/,
  'workflows/operations/': /\.(md|yaml)$/,
  'workflows/rapid/': /\.(md|yaml)$/,

  // Context artifacts
  'context/plans/': /\.md$/,
  'context/artifacts/reports/': /\.md$/,
  'context/artifacts/research-reports/': /\.md$/,
  'context/memory/': /\.md$/,
  'context/config/': /\.(json|yaml)$/,
  'context/runtime/': /\.json$/,
  'context/checkpoints/': /\.json$/,

  // Other
  'schemas/': /\.schema\.json$/,
  'templates/': /\.(md|yaml)$/,
  'docs/': /\.md$/,
};
```

---

## Integration with Creator Skills

All creator skills (`agent-creator`, `skill-creator`, `hook-creator`, etc.) MUST:

1. **Check Placement**: Verify output location before creating
2. **Use Correct Path**: Follow rules in this document
3. **Validate Extension**: Ensure correct file extension
4. **Register Output**: Update relevant indexes (CLAUDE.md routing table, skill-catalog.md)

See each skill's "File Placement Rules" section for skill-specific guidance.

---

## Enforcement

This document is enforced by:

| Mechanism                  | Location                | Trigger                 |
| -------------------------- | ----------------------- | ----------------------- |
| `file-placement-guard.cjs` | `.claude/hooks/safety/` | PreToolUse(Write, Edit) |
| Creator skill validation   | Each creator skill      | Before file creation    |
| CI/CD validation           | `.github/workflows/`    | On pull request         |

### Hook Behavior

- **Block Mode** (default): Prevents write and returns error
- **Warn Mode**: Allows write but prints warning
- **Off Mode**: Disabled (for debugging only)

```bash
# Override for debugging
FILE_PLACEMENT_GUARD=warn claude
FILE_PLACEMENT_GUARD=off claude  # Dangerous
```

---

## Related Documentation

- `.claude/docs/ARTIFACT_NAMING.md` - Naming conventions for artifacts
- `.claude/docs/DEVELOPER_WORKFLOW.md` - Developer workflow guidelines
- `.claude/workflows/core/skill-lifecycle.md` - Artifact lifecycle management
- `.claude/CLAUDE.md` - Main framework documentation

---

_This document is part of the Framework Refactoring initiative (Phase 2)._
