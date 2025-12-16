# Command to Workflow Mapping

This document maps all slash commands to their corresponding workflows and execution patterns.

## Direct Workflow Commands

These commands directly invoke specific workflows:

| Command | Workflow File | Workflow Type | Description |
|---------|---------------|---------------|-------------|
| `/code-quality` | `.claude/workflows/code-quality-flow.yaml` | code-quality | Systematic code quality improvement |
| `/performance` | `.claude/workflows/performance-flow.yaml` | performance | Performance optimization workflow |
| `/ai-system` | `.claude/workflows/ai-system-flow.yaml` | ai-system | AI/LLM system development |
| `/mobile` | `.claude/workflows/mobile-flow.yaml` | mobile | Mobile application development |
| `/incident` | `.claude/workflows/incident-flow.yaml` | incident | Incident response and crisis management |
| `/ui-perfection` | `.claude/workflows/ui-perfection-loop.yaml` | ui-perfection | Iterative UI quality improvement |

## Quick Workflow Commands

| Command | Workflow File | Workflow Type | Description |
|---------|---------------|---------------|-------------|
| `/quick-ship` | `.claude/workflows/quick-flow.yaml` | quick | Fast-track bug fixes and small features |

## Skill-Based Commands

These commands invoke skills rather than workflows:

| Command | Skill | Description |
|---------|-------|-------------|
| `/review` | code-reviewer agent (direct) | Comprehensive code review (no workflow) |
| `/audit` | rule-auditor | Validate code against rules |
| `/scaffold` | scaffolder | Generate rule-compliant boilerplate |
| `/select-rules` | rule-selector | Auto-configure rules for tech stack |

## Workflow Execution Commands

| Command | Purpose | Description |
|---------|---------|-------------|
| `/run-workflow` | Validation | Validate a workflow step output |

## Automatic Workflow Selection

Workflows can also be automatically selected based on user prompt keywords (see `.claude/config.yaml`):

- **Quick Flow**: Triggered by keywords like "bug fix", "hotfix", "small feature"
- **Full Stack Flow**: Triggered by keywords like "new project", "greenfield", "from scratch"
- **Code Quality Flow**: Triggered by keywords like "code quality", "refactor", "tech debt"
- **Performance Flow**: Triggered by keywords like "performance", "optimize", "slow"
- **AI System Flow**: Triggered by keywords like "ai system", "llm", "rag", "chatbot"
- **Mobile Flow**: Triggered by keywords like "mobile app", "ios", "android"
- **UI Perfection Loop**: Triggered by keywords like "ui perfection", "visual perfection"
- **Incident Flow**: Triggered by keywords like "incident", "outage", "production issue" (highest priority)

## Command Execution Flow

### Workflow-Based Commands

When a user invokes a workflow command (e.g., `/code-quality`), the system:

1. **Command Recognition**: System identifies the command and maps it to a workflow file
   - Example: `/code-quality` → `.claude/workflows/code-quality-flow.yaml`
   - Example: `/quick-ship` → `.claude/workflows/quick-flow.yaml`

2. **Workflow Loading**: System loads the workflow YAML file from `.claude/workflows/`

3. **Session Initialization**: Creates unique workflow ID and session directory
   - Workflow ID: Generated UUID or timestamp-based identifier
   - Session directory: `.claude/context/history/gates/<workflow_id>/`

4. **Step Execution**: Workflow executes steps sequentially:
   - **Step 0**: Planner agent creates comprehensive plan
     - Outputs: `plan-<workflow_id>.md`, `plan-<workflow_id>.json`
     - Validation: Gate file created at specified path
   - **Steps 1-N**: Agents execute according to plan
     - Each agent loads from `.claude/agents/<agent>.md`
     - Inputs: Artifacts from previous steps (from `.claude/context/artifacts/`)
     - Outputs: Saved to `.claude/context/artifacts/`
     - Validation: Schema validation (if specified) + gate file creation

5. **Artifact Passing**: Each step's outputs become inputs for subsequent steps
   - Artifacts stored in `.claude/context/artifacts/`
   - Referenced using pattern: `artifact-name.json (from step N)`

6. **Validation**: After each step:
   - Run: `node .claude/tools/workflow_runner.js --workflow <yaml> --step <N> --id <workflow_id>`
   - Validates JSON structure against schema (if provided)
   - Creates gate file with validation results
   - Fails if validation errors (with retry mechanism)

7. **Completion**: Workflow completes when all steps pass validation

### Skill-Based Commands

1. User invokes command (e.g., `/review`)
2. System activates corresponding agent or skill
3. Agent/skill executes task directly
4. Output returned to user
5. No workflow orchestration

## Workflow Priority

When multiple workflows match keywords, priority determines selection (lower number = higher priority):

- **Priority 0**: Incident Flow (critical)
- **Priority 1**: Quick Flow
- **Priority 2**: Full Stack Flow, UI Perfection Loop
- **Priority 3**: Code Quality, Performance, AI System, Mobile

## See Also

- `.claude/config.yaml` - Workflow selection configuration
- `.claude/workflows/WORKFLOW-GUIDE.md` - Detailed workflow execution guide
- `.claude/commands/` - Individual command documentation

