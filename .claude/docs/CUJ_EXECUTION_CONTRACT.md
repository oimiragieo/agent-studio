# CUJ execution contract specification

This document defines the execution contract structure for Customer User Journeys (CUJs). The execution contract specifies runtime requirements, preflight checks, and side effects for deterministic CUJ execution.

## Overview

The execution contract is a structured definition that enables:

- **Preflight validation**: Verify all requirements before execution starts
- **Platform compatibility**: Determine if a CUJ can run on the current platform
- **Risk assessment**: Understand side effects and rollback capabilities
- **Timeout management**: Configure appropriate execution timeouts
- **Retry policies**: Define failure recovery strategies

## Contract structure

```json
{
  "execution_contract": {
    "mode": "workflow|skill-only|manual-setup",
    "workflow": ".claude/workflows/example.yaml",
    "primary_skill": "skill-name",
    "required_skills": ["skill-1", "skill-2"],
    "required_agents": ["agent-1", "agent-2"],
    "required_clis": ["claude", "node"],
    "required_schemas": ["schema.schema.json"],
    "side_effects": ["file_write", "artifact_creation"],
    "preflight_checks": [
      {
        "type": "workflow_exists",
        "target": ".claude/workflows/example.yaml",
        "blocking": true
      }
    ],
    "timeout_seconds": 600,
    "retry_policy": {
      "max_retries": 3,
      "backoff_strategy": "exponential",
      "initial_delay_ms": 1000
    },
    "rollback_enabled": true,
    "requires_confirmation": false,
    "parallel_execution": false,
    "dependencies": ["CUJ-001", "CUJ-002"],
    "artifact_paths": {
      "plan": ".claude/context/runtime/runs/<run_id>/plans/<plan_id>.json",
      "plan_rating": ".claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json",
      "plan_markdown": ".claude/context/runtime/runs/<run_id>/plans/<plan_id>.md",
      "manifest": ".claude/context/runtime/runs/<run_id>/artifacts/dev-manifest.json",
      "reasoning": ".claude/context/runtime/runs/<run_id>/reasoning/<agent>.json",
      "gate": ".claude/context/runtime/runs/<run_id>/gates/<step>-<agent>.json",
      "checkpoint": ".claude/context/runtime/runs/<run_id>/checkpoint.json",
      "error_log": ".claude/context/runtime/runs/<run_id>/errors.log",
      "recovery_state": ".claude/context/runtime/runs/<run_id>/recovery-state.json",
      "browser_session": ".claude/context/runtime/runs/<run_id>/browser-session.json"
    }
  }
}
```

## Field reference

### mode (required)

Execution mode determining how the CUJ is executed.

| Value          | Description                                   | Example CUJs              |
| -------------- | --------------------------------------------- | ------------------------- |
| `workflow`     | YAML workflow with multi-agent orchestration  | CUJ-004, CUJ-005, CUJ-010 |
| `skill-only`   | Direct skill invocation without orchestration | CUJ-002, CUJ-003, CUJ-017 |
| `manual-setup` | Manual user actions required                  | CUJ-001, CUJ-042          |

### workflow

Path to workflow YAML file. Required when `mode` is `workflow`.

```json
{
  "mode": "workflow",
  "workflow": ".claude/workflows/greenfield-fullstack.yaml"
}
```

**Pattern**: Must match `^\.claude/workflows/[a-z0-9-]+\.yaml$`

### primary_skill

Primary skill for `skill-only` mode execution.

```json
{
  "mode": "skill-only",
  "primary_skill": "rule-selector"
}
```

**Pattern**: Must match `^[a-z][a-z0-9-]*$`

### required_skills

Skills required for successful execution. Used for platform compatibility validation.

```json
{
  "required_skills": ["scaffolder", "diagram-generator", "response-rater"]
}
```

### required_agents

Agents required for workflow execution. Used for fallback planning.

```json
{
  "required_agents": ["planner", "analyst", "pm", "architect", "developer"]
}
```

### required_clis

CLI tools required for execution.

| CLI      | Description          |
| -------- | -------------------- |
| `claude` | Claude Code CLI      |
| `cursor` | Cursor IDE CLI       |
| `gemini` | Google Gemini CLI    |
| `codex`  | OpenAI Codex CLI     |
| `node`   | Node.js runtime      |
| `pnpm`   | pnpm package manager |
| `npm`    | npm package manager  |
| `git`    | Git version control  |

```json
{
  "required_clis": ["claude", "node", "pnpm"]
}
```

### required_schemas

JSON schemas required for artifact validation.

```json
{
  "required_schemas": ["plan.schema.json", "project_brief.schema.json"]
}
```

### side_effects

Side effects that may occur during execution.

| Effect                | Description                  | Risk Level |
| --------------------- | ---------------------------- | ---------- |
| `file_write`          | Creates or modifies files    | Low        |
| `file_delete`         | Deletes files                | Medium     |
| `git_commit`          | Creates git commits          | Medium     |
| `git_push`            | Pushes to remote repository  | High       |
| `git_branch`          | Creates or switches branches | Low        |
| `network_request`     | Makes HTTP requests          | Low        |
| `database_write`      | Writes to database           | High       |
| `cache_invalidation`  | Invalidates caches           | Medium     |
| `external_api_call`   | Calls external APIs          | Medium     |
| `state_mutation`      | Modifies workflow state      | Low        |
| `artifact_creation`   | Creates workflow artifacts   | Low        |
| `artifact_update`     | Updates existing artifacts   | Low        |
| `checkpoint_creation` | Creates recovery checkpoints | Low        |
| `notification`        | Sends notifications          | Low        |

```json
{
  "side_effects": ["file_write", "git_commit", "artifact_creation"]
}
```

### preflight_checks

Ordered list of checks to run before execution.

```json
{
  "preflight_checks": [
    {
      "type": "workflow_exists",
      "target": ".claude/workflows/greenfield-fullstack.yaml",
      "blocking": true,
      "error_message": "Workflow file not found",
      "remediation": "Ensure the workflow file exists at the specified path"
    },
    {
      "type": "agent_exists",
      "target": "planner",
      "blocking": true
    },
    {
      "type": "git_clean",
      "blocking": false,
      "error_message": "Uncommitted changes detected"
    }
  ]
}
```

### timeout_seconds

Maximum execution time in seconds.

| CUJ Type            | Recommended Timeout |
| ------------------- | ------------------- |
| Skill-only          | 60-120 seconds      |
| Simple workflow     | 300-600 seconds     |
| Complex workflow    | 900-1800 seconds    |
| Enterprise workflow | 1800-3600 seconds   |

```json
{
  "timeout_seconds": 600
}
```

### retry_policy

Failure recovery configuration.

```json
{
  "retry_policy": {
    "max_retries": 3,
    "backoff_strategy": "exponential",
    "initial_delay_ms": 1000
  }
}
```

**Backoff strategies**:

- `fixed`: Same delay between retries
- `linear`: Delay increases linearly (1s, 2s, 3s)
- `exponential`: Delay doubles each retry (1s, 2s, 4s)

### rollback_enabled

Whether automatic rollback is enabled on failure.

```json
{
  "rollback_enabled": true
}
```

### requires_confirmation

Whether user confirmation is required before execution.

```json
{
  "requires_confirmation": true
}
```

Set to `true` for:

- Destructive operations (file deletion, database writes)
- High-risk side effects (git push, external API calls)
- Operations that cannot be rolled back

### parallel_execution

Whether this CUJ can run in parallel with other CUJs.

```json
{
  "parallel_execution": false
}
```

Set to `false` for CUJs that:

- Modify shared state
- Have conflicting side effects
- Require exclusive resource access

### dependencies

CUJ IDs that must complete before this CUJ can execute.

```json
{
  "dependencies": ["CUJ-001", "CUJ-002"]
}
```

### artifact_paths

Standardized artifact path templates using `<placeholder>` format. All paths follow the `.claude/context/runtime/runs/<run_id>/` structure for run isolation.

**Purpose**: Provides consistent artifact path conventions across all CUJs, enabling:

- Runtime path generation with actual run/plan IDs
- Template-based documentation in CUJ files
- Validation that artifacts are created in correct locations
- Cross-platform compatibility (handles Windows/Unix paths)

**Available Artifact Types**:

| Artifact Type     | Path Template                                                       | Description                           |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------- |
| `plan`            | `.claude/context/runtime/runs/<run_id>/plans/<plan_id>.json`        | Plan artifact (JSON)                  |
| `plan_rating`     | `.claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json` | Plan rating from response-rater skill |
| `plan_markdown`   | `.claude/context/runtime/runs/<run_id>/plans/<plan_id>.md`          | Plan artifact (Markdown)              |
| `manifest`        | `.claude/context/runtime/runs/<run_id>/artifacts/dev-manifest.json` | Development manifest                  |
| `reasoning`       | `.claude/context/runtime/runs/<run_id>/reasoning/<agent>.json`      | Agent reasoning files                 |
| `gate`            | `.claude/context/runtime/runs/<run_id>/gates/<step>-<agent>.json`   | Validation gate results               |
| `checkpoint`      | `.claude/context/runtime/runs/<run_id>/checkpoint.json`             | Execution checkpoint                  |
| `error_log`       | `.claude/context/runtime/runs/<run_id>/errors.log`                  | Error log                             |
| `recovery_state`  | `.claude/context/runtime/runs/<run_id>/recovery-state.json`         | Recovery state                        |
| `browser_session` | `.claude/context/runtime/runs/<run_id>/browser-session.json`        | Browser testing session               |

**Example**:

```json
{
  "artifact_paths": {
    "plan": ".claude/context/runtime/runs/<run_id>/plans/<plan_id>.json",
    "plan_rating": ".claude/context/runtime/runs/<run_id>/plans/<plan_id>-rating.json",
    "manifest": ".claude/context/runtime/runs/<run_id>/artifacts/dev-manifest.json",
    "checkpoint": ".claude/context/runtime/runs/<run_id>/checkpoint.json"
  }
}
```

**Placeholder Format**:

- **Use**: `<run_id>`, `<plan_id>`, `<agent>`, `<step>`
- **NOT**: `{{run_id}}`, `$run_id`, `${run_id}` (non-standard)

**Programmatic Usage**:

The `cuj-parser.mjs` module provides helper functions for generating artifact paths:

```javascript
import { generateArtifactPath, getAllArtifactPaths } from '.claude/tools/cuj-parser.mjs';

// Generate single artifact path with placeholders
const planPath = generateArtifactPath('plan');
// Returns: '.claude/context/runtime/runs/<run_id>/plans/<plan_id>.json'

// Generate path with actual IDs
const actualPlanPath = generateArtifactPath('plan', 'run-001', 'plan-greenfield');
// Returns: '.claude/context/runtime/runs/run-001/plans/plan-greenfield.json'

// Get all artifact paths for a run
const allPaths = getAllArtifactPaths('run-001', 'plan-greenfield');
// Returns object with all 10 artifact path types
```

**Best Practices**:

1. Always use `<placeholder>` format in CUJ documentation
2. Use `generateArtifactPath()` for runtime path generation
3. Ensure all workflow steps reference artifacts using these standard paths
4. Validate artifact locations using enforcement gates

## Preflight check types

### Resource existence checks

| Type               | Description               | Target          |
| ------------------ | ------------------------- | --------------- |
| `workflow_exists`  | Workflow YAML file exists | File path       |
| `agent_exists`     | Agent definition exists   | Agent name      |
| `skill_exists`     | Skill is available        | Skill name      |
| `schema_exists`    | JSON schema exists        | Schema filename |
| `file_exists`      | File exists               | File path       |
| `directory_exists` | Directory exists          | Directory path  |
| `artifact_exists`  | Workflow artifact exists  | Artifact ID     |

### Environment checks

| Type                   | Description                       | Target        |
| ---------------------- | --------------------------------- | ------------- |
| `cli_available`        | CLI tool is installed             | CLI name      |
| `environment_variable` | Environment variable is set       | Variable name |
| `node_version`         | Node.js version meets requirement | Semver range  |
| `dependency_installed` | npm/pnpm dependency is installed  | Package name  |

### State checks

| Type                  | Description                       | Target        |
| --------------------- | --------------------------------- | ------------- |
| `git_clean`           | Git working directory is clean    | N/A           |
| `git_branch`          | Current branch matches expected   | Branch name   |
| `run_state_valid`     | Run state is valid for resumption | Run ID        |
| `platform_compatible` | Current platform is compatible    | Platform name |

### Resource availability checks

| Type                   | Description                     | Target      |
| ---------------------- | ------------------------------- | ----------- |
| `port_available`       | Network port is available       | Port number |
| `disk_space`           | Sufficient disk space available | Minimum MB  |
| `memory_available`     | Sufficient memory available     | Minimum MB  |
| `network_connectivity` | Network is reachable            | Host/URL    |

### Custom checks

```json
{
  "type": "custom",
  "target": "custom-check-script.js",
  "expected": true,
  "blocking": true,
  "error_message": "Custom validation failed"
}
```

## Examples by execution mode

### Workflow mode example (CUJ-005)

```json
{
  "execution_contract": {
    "mode": "workflow",
    "workflow": ".claude/workflows/greenfield-fullstack.yaml",
    "required_skills": ["scaffolder", "diagram-generator", "response-rater", "test-generator"],
    "required_agents": [
      "planner",
      "analyst",
      "pm",
      "ux-expert",
      "architect",
      "database-architect",
      "qa",
      "developer"
    ],
    "required_clis": ["claude", "node", "pnpm"],
    "required_schemas": [
      "project_brief.schema.json",
      "product_requirements.schema.json",
      "system_architecture.schema.json"
    ],
    "side_effects": ["file_write", "artifact_creation", "checkpoint_creation", "state_mutation"],
    "preflight_checks": [
      {
        "type": "workflow_exists",
        "target": ".claude/workflows/greenfield-fullstack.yaml",
        "blocking": true,
        "error_message": "Greenfield workflow not found"
      },
      {
        "type": "agent_exists",
        "target": "planner",
        "blocking": true
      },
      {
        "type": "agent_exists",
        "target": "architect",
        "blocking": true
      },
      {
        "type": "skill_exists",
        "target": "response-rater",
        "blocking": true,
        "error_message": "Plan rating skill not available",
        "remediation": "Ensure response-rater skill is installed"
      },
      {
        "type": "git_clean",
        "blocking": false,
        "error_message": "Git has uncommitted changes - consider committing first"
      }
    ],
    "timeout_seconds": 1800,
    "retry_policy": {
      "max_retries": 3,
      "backoff_strategy": "exponential",
      "initial_delay_ms": 2000
    },
    "rollback_enabled": true,
    "requires_confirmation": false,
    "parallel_execution": false
  }
}
```

### Skill-only mode example (CUJ-002)

```json
{
  "execution_contract": {
    "mode": "skill-only",
    "workflow": null,
    "primary_skill": "rule-selector",
    "required_skills": ["rule-selector"],
    "required_clis": ["claude"],
    "side_effects": ["file_write", "state_mutation"],
    "preflight_checks": [
      {
        "type": "skill_exists",
        "target": "rule-selector",
        "blocking": true
      },
      {
        "type": "file_exists",
        "target": ".claude/context/rule-index.json",
        "blocking": true,
        "error_message": "Rule index not found",
        "remediation": "Run 'pnpm index-rules' to generate rule index"
      },
      {
        "type": "file_exists",
        "target": "package.json",
        "blocking": false,
        "error_message": "No package.json - limited tech stack detection"
      }
    ],
    "timeout_seconds": 60,
    "retry_policy": {
      "max_retries": 2,
      "backoff_strategy": "fixed",
      "initial_delay_ms": 500
    },
    "rollback_enabled": false,
    "requires_confirmation": false,
    "parallel_execution": true
  }
}
```

### Manual-setup mode example (CUJ-001)

```json
{
  "execution_contract": {
    "mode": "manual-setup",
    "workflow": null,
    "primary_skill": null,
    "required_clis": [],
    "side_effects": ["file_write"],
    "preflight_checks": [],
    "timeout_seconds": 3600,
    "rollback_enabled": false,
    "requires_confirmation": true,
    "parallel_execution": false
  }
}
```

## Preflight enforcement flow

The preflight enforcement function validates all checks before CUJ execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Preflight Enforcement Flow                    │
└─────────────────────────────────────────────────────────────────┘

1. Load execution_contract from CUJ
   │
   ▼
2. Validate contract schema (Zod 4.0+)
   │
   ├── FAIL → Return schema validation error
   │
   ▼
3. Run preflight_checks in order
   │
   ├── For each check:
   │   │
   │   ├── Execute check based on type
   │   │
   │   ├── PASS → Continue to next check
   │   │
   │   └── FAIL:
   │       │
   │       ├── blocking: true → STOP, return error with remediation
   │       │
   │       └── blocking: false → Log warning, continue
   │
   ▼
4. Verify required resources
   │
   ├── Check required_skills availability
   ├── Check required_agents availability
   ├── Check required_clis in PATH
   ├── Check required_schemas exist
   │
   ├── Any required resource missing → FAIL
   │
   ▼
5. Platform compatibility check
   │
   ├── Verify current platform supports CUJ
   │
   ├── FAIL → Return platform incompatibility error
   │
   ▼
6. All checks passed → PROCEED with execution
```

### Check result format

```json
{
  "preflight_result": {
    "passed": true,
    "checks_run": 5,
    "checks_passed": 5,
    "checks_warned": 1,
    "checks_failed": 0,
    "blocking_failures": [],
    "warnings": [
      {
        "type": "git_clean",
        "message": "Git has uncommitted changes"
      }
    ],
    "execution_allowed": true,
    "execution_started": "2025-01-10T14:30:00Z"
  }
}
```

### Blocking vs non-blocking checks

| Check Behavior            | Result                              |
| ------------------------- | ----------------------------------- |
| Blocking check passes     | Continue to next check              |
| Blocking check fails      | STOP execution, return error        |
| Non-blocking check passes | Continue to next check              |
| Non-blocking check fails  | Log warning, continue to next check |

**Blocking checks** (recommended for):

- Workflow file existence
- Required agent availability
- Required skill availability
- Schema existence
- Critical dependencies

**Non-blocking checks** (recommended for):

- Git clean status
- Optional environment variables
- Performance-related checks
- Informational validations

## Migration guide

The `execution_contract` field is OPTIONAL during the migration period. This allows incremental adoption without breaking existing CUJs.

### Migration phases

**Phase 1: Schema addition (current)**

- Add `execution_contract` as optional field
- Existing CUJs continue to work without changes
- New CUJs can optionally include execution contracts

**Phase 2: Gradual migration**

- Add execution contracts to high-priority CUJs first
- Focus on workflow-based CUJs (53 total)
- Validate contracts using schema validation

**Phase 3: Full adoption**

- All 62 CUJs have execution contracts
- Preflight enforcement enabled by default
- `execution_contract` becomes required field

### Migration script

```javascript
// Example migration helper
async function migrateToExecutionContract(cujId, cujData) {
  const contract = {
    mode: cujData.execution_mode,
    workflow: cujData.workflow || null,
    primary_skill: cujData.primary_skill || null,
    required_skills: cujData.skills || [],
    required_agents: cujData.agents || [],
    required_clis: detectRequiredClis(cujData),
    side_effects: inferSideEffects(cujData),
    preflight_checks: generatePreflightChecks(cujData),
    timeout_seconds: estimateTimeout(cujData),
    retry_policy: {
      max_retries: 3,
      backoff_strategy: 'exponential',
      initial_delay_ms: 1000,
    },
    rollback_enabled: cujData.execution_mode === 'workflow',
    requires_confirmation: false,
    parallel_execution: cujData.execution_mode === 'skill-only',
  };

  return { ...cujData, execution_contract: contract };
}
```

### Validation command

```bash
# Validate execution contract schema
node .claude/tools/gates/gate.mjs \
  --schema .claude/schemas/execution-contract.schema.json \
  --input <cuj-with-contract>.json
```

## Related documentation

- [CUJ-INDEX.md](./cujs/CUJ-INDEX.md) - Complete CUJ listing
- [cuj-registry.schema.json](../schemas/cuj-registry.schema.json) - Registry schema
- [execution-contract.schema.json](../schemas/execution-contract.schema.json) - Contract schema
- [WORKFLOW-GUIDE.md](../workflows/WORKFLOW-GUIDE.md) - Workflow execution details
- [AGENT_SKILL_MATRIX.md](./AGENT_SKILL_MATRIX.md) - Agent and skill mappings

## Version history

| Version | Date       | Changes                                        |
| ------- | ---------- | ---------------------------------------------- |
| 1.0.0   | 2025-01-10 | Initial release with execution contract schema |
