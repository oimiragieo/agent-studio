<workflow_overview>
Workflow Guide - Explains how to use workflows to coordinate multiple agents for complex tasks.
</workflow_overview>

<instructions>
<workflow_selection>
## Available Workflows

**Note**: All workflows now start with the **Planner agent** (Step 0) to create comprehensive plans before execution. The Planner coordinates with specialists and generates validated plans that guide subsequent steps.

- **Quick Flow**: Bugfix/hotfix/small change. Agents: **planner** → developer → qa. Outputs: plan + dev change + basic validation. **Templates**: Uses plan template from `.claude/templates/plan-template.md` for planning phase.
- **Full Stack Flow**: New features/greenfield. Agents: **planner** → analyst → pm → ux → architect → developer → qa. Outputs: plan + brief/PRD/UX/arch/test plan. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - Project Brief: `.claude/templates/project-brief.md`
  - PRD: `.claude/templates/prd.md`
  - UX Spec: `.claude/templates/ui-spec.md`
  - Architecture: `.claude/templates/architecture.md`
  - Test Plan: `.claude/templates/test-plan.md`
- **Code Quality Flow**: Code health/review/refactor. Agents: **planner** → code-reviewer → refactoring-specialist → compliance-auditor → qa. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - Code Review: `.claude/templates/code-review-report.md`
  - Refactoring: `.claude/templates/refactor-plan.md`
  - Compliance: `.claude/templates/compliance-report.md`
- **Performance Flow**: Perf tuning/SLI/SLO. Agents: **planner** → performance-engineer → architect → developer → qa. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - Performance Plan: `.claude/templates/performance-plan.md`
- **AI System Flow**: LLM/AI features. Agents: **planner** → model-orchestrator → llm-architect → api-designer → developer → qa. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - LLM Architecture: `.claude/templates/llm-architecture.md`
- **Mobile Flow**: Mobile feature work. Agents: **planner** → mobile-developer → ux-expert → developer → qa. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - UI Spec: `.claude/templates/ui-spec.md` (reused from Full Stack Flow)
- **UI Perfection Loop**: Iterative UI quality improvement (95%+ target). Agents: **planner** → ux-expert + accessibility-expert (parallel) → model-orchestrator (Gemini validation) → developer + mobile-developer → qa → orchestrator (iteration check). Iterates until score >= 95 or max iterations (5). Outputs: plan + `ui-audit-report.json`, `grading-score.json`, `implementation-manifest.json`, `verification-report.json`, `final-score.json`. **Templates**: Uses plan template and UI spec templates. See `.claude/docs/UI_PERFECTION_TOOLS.md` for tool integration.
- **Incident Flow**: Reliability/incident response. Agents: **planner** → incident-responder → devops → security-architect → qa. **Templates**: 
  - Planning: `.claude/templates/plan-template.md`
  - Incident Report: `.claude/templates/incident-report.md`

## Planner Integration

All workflows now follow a **plan-first** approach:

### Step 0: Planning Phase (NEW)
- **Agent**: planner
- **Purpose**: Create comprehensive plan before execution
- **Process**:
  1. Planner analyzes requirements
  2. Coordinates with relevant specialists (Analyst, PM, Architect, etc.)
  3. Generates structured plan with steps, dependencies, risks
  4. Validates plan completeness and feasibility
- **Outputs**:
  - `plan-<id>.md` - Plan markdown document
  - `plan-<id>.json` - Structured plan data
  - Plan summary

### Subsequent Steps
All workflow steps (1-N) now execute according to the plan created in Step 0:
- Steps reference the plan for context
- Agents follow plan steps
- Progress is tracked against plan
- Plan is updated as work progresses

## Automatic Workflow Selection

Workflows are automatically selected based on user prompt keywords. The system:

1. **Extract Keywords**: System extracts keywords from user prompt
2. **Match Workflows**: Keywords matched against `workflow_selection` in `config.yaml`
3. **Count Matches**: Count how many keywords match each workflow
4. **Priority Selection**: Among matching workflows, select the one with **lowest priority number** (0 = highest priority)
5. **Default Fallback**: If no matches, use `default_workflow` from `intelligent_routing` (typically `fullstack`)
6. **Execute**: Load workflow YAML and execute steps sequentially

**Example**: "Build a new authentication feature from scratch"
- Keywords detected: "new", "from scratch"
- Matches: `fullstack` workflow (keywords: "new project", "from scratch", "greenfield")
- Priority: 2 (medium priority)
- Selected: `fullstack` workflow
- Executes: Planner (Step 0) → Full Stack Flow with all agents (Steps 1-N)

**See Also**: For a detailed visual flow diagram, see `.claude/CLAUDE.md` section "Workflow Execution Flow"
</workflow_selection>

<execution_process>
## Manual Workflow Execution

You can also manually execute workflows using slash commands or by following the execution process.

### Using Slash Commands

```bash
/code-quality    # Execute code quality workflow
/performance     # Execute performance optimization workflow
/ai-system       # Execute AI system development workflow
/mobile          # Execute mobile application workflow
/incident        # Execute incident response workflow
```

### Manual Execution Process

**Step 1: Initialize Workflow Session**

Generate a unique workflow ID and create session directory:
```bash
WORKFLOW_ID=$(date +%s)-$(uuidgen | cut -d'-' -f1)
mkdir -p .claude/context/history/gates/$WORKFLOW_ID
```

**Step 2: Read Workflow YAML**

Load the workflow file to understand the steps:
```bash
# Example: Load fullstack workflow
cat .claude/workflows/greenfield-fullstack.yaml
```

**Step 3: Execute Steps Sequentially**

For each step in the workflow:

1. **Activate Agent**: Load agent definition from `.claude/agents/<agent>.md`
2. **Load Context**: Load agent's context files from `config.yaml`
3. **Prepare Inputs**: Read artifacts from previous steps
4. **Execute Task**: Agent performs work using available tools
5. **Collect Outputs**: Save artifacts to `.claude/context/artifacts/`
6. **Validate**: Run validation if schema is specified

**Example Step Execution**:

```bash
# Step 1: Analyst
# - Loads: .claude/agents/analyst.md
# - Executes: Creates project brief
# - Saves: .claude/context/artifacts/project-brief.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1 --id $WORKFLOW_ID

# Step 2: PM (uses output from Step 1)
# - Loads: .claude/agents/pm.md
# - Inputs: Reads project-brief.json from Step 1
# - Executes: Creates PRD
# - Saves: .claude/context/artifacts/prd.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 2 --id $WORKFLOW_ID
```

**Step 4: Validate Each Step**

After each step, validate the output:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/<workflow-name>.yaml \
  --step <step-number> \
  --id <workflow-id> \
  [--story-id <story-id>] \
  [--epic-id <epic-id>]
```

The validator:
- Loads the step's validation schema
- Validates the output artifact against the schema
- Creates a gate file with validation results
- Returns exit code 0 (success) or 1 (failure)

**Step 5: Handle Failures**

If validation fails:
1. Read the gate file to understand errors
2. Provide feedback to the agent
3. Agent corrects the output
4. Re-validate until passing or max retries (3)

## Workflow Execution Details
</execution_process>

<template_usage>
### Context Passing Between Steps

Each agent's outputs become inputs for subsequent agents:

- **Artifact Storage**: Outputs saved to `.claude/context/artifacts/<artifact-name>.json`
- **Input References**: Steps reference previous outputs: `project_brief.json (from step 1)`
- **Context Loading**: Next agent reads artifacts as context before executing

### Workflow-Level Context Inputs

Some workflows accept context inputs that are provided at workflow start (not as artifact files). These are passed directly to agents as context when the workflow initializes.

**Common Workflow-Level Inputs:**
- `target_files`: List of files/directories to analyze (e.g., `["src/", "lib/", "app/components/"]`)
- `coding_standards`: Coding standards to apply (e.g., `"PEP 8"`, `"Airbnb JavaScript Style Guide"`, `"Google Java Style"`)

**How They Work:**
1. These inputs are specified in the workflow YAML `inputs` section with comments indicating they are "workflow-level context inputs"
2. They are declared in the workflow YAML `workflow_inputs` section (if present) for validation
3. They are provided when the workflow is initialized (by the orchestrator or user)
4. They are passed directly to agents as context, not loaded from artifact files
5. Multiple steps can reference the same workflow-level input

**Example from Code Quality Flow:**
```yaml
# Workflow-level inputs declaration (for validation)
workflow_inputs:
  required:
    - target_files
    - coding_standards
  optional: []

steps:
  - step: 0
    agent: planner
    inputs:
      # Workflow-level context inputs (provided at workflow start, not artifact files)
      - target_files  # List of files/directories to analyze
      - coding_standards  # Coding standards to apply
```

**Providing Workflow-Level Inputs:**
When executing a workflow, these inputs are typically provided:
- Via the orchestrator's context initialization
- As part of the user's initial request (extracted by the orchestrator)
- Through workflow configuration or environment variables
- As explicit parameters when manually executing workflows

**Input Format:**
- `target_files`: Array of strings, e.g., `["src/", "lib/", "app/components/"]`
- `coding_standards`: String or array of strings, e.g., `"PEP 8"` or `["Airbnb JavaScript Style Guide", "Google Java Style"]`

**Validation:**
- Required workflow-level inputs are validated by the orchestrator before workflow execution
- If required inputs are missing, the workflow will fail with a clear error message
- The orchestrator should check the `workflow_inputs.required` section in the workflow YAML

**Agent Access:**
Agents receive workflow-level inputs as part of their execution context, alongside artifact inputs from previous steps. Agents should:
- Check for workflow-level inputs in their context
- Use them to guide their work (e.g., which files to analyze, which standards to apply)
- Document their usage in reasoning files

### Optional Artifact References

Some workflows have conditional steps that may or may not execute. When referencing artifacts from optional steps:

**Pattern Supported**:
- `artifact-name.json (from step X, optional)` - Standard pattern (use this for all optional artifacts)

**Handling**:
- The workflow runner will check if optional artifacts exist but will not fail if they are missing
- Agents receiving optional inputs must check if the artifact exists before using it
- If artifact is missing, agent should proceed without it or use default values
- Optional artifacts are marked with `optional` keyword in the input reference

**Example**:
```yaml
inputs:
  - required-artifact.json (from step 1)
  - optional-artifact.json (from step 2, optional)
  - another-optional.json (from step 3, optional)
```

**Agent Implementation Example**:
```javascript
// Agent should check for optional artifacts
const optionalArtifact = await loadArtifact('optional-artifact.json').catch(() => null);
if (optionalArtifact) {
  // Use optional artifact data
  processWithOptionalData(optionalArtifact);
} else {
  // Proceed without optional data
  processWithDefaults();
}
```

### Output Types

Workflow outputs can be of different types:

**JSON Artifacts** (Structured Data):
- Standard JSON files that can be validated against schemas
- Examples: `project-brief.json`, `prd.json`, `system-architecture.json`
- These are validated using the schema specified in `validation.schema`

**Code Artifacts** (Special Output Type):
- Reference to actual code files/directories created during implementation
- Not a JSON file, but a directory or file collection reference
- Examples: `code-artifacts` (references all code files created in a step)
- These are NOT validated against schemas, but their manifest (if provided) can be validated
- When `code-artifacts` is specified, agents should also create a `dev-manifest.json` that lists all code files created

**Reasoning Files** (Special Output Type):
- JSON files documenting agent decision-making process
- Format: `reasoning: .claude/context/history/reasoning/{{workflow_id}}/{{step_number}}-{{agent_name}}.json`
- Schema: `.claude/schemas/reasoning.schema.json` (recommended structure)
- These files document decisions, rationale, assumptions, and tradeoffs
- While not strictly validated, following the schema ensures consistency and traceability

**Example Output Declaration:**
```yaml
outputs:
  - dev-manifest.json  # JSON artifact (validated)
  - code-artifacts     # Special: code files/directories (not validated)
  - reasoning: .claude/context/history/reasoning/{{workflow_id}}/01-developer.json  # Special: reasoning file
```

### Template Variables
</template_usage>

<examples>
<workflow_example>
**Example Workflow Execution**:

```bash
# Step 1: Analyst
# - Loads: .claude/agents/analyst.md
# - Executes: Creates project brief
# - Saves: .claude/context/artifacts/project-brief.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 1 --id $WORKFLOW_ID

# Step 2: PM (uses output from Step 1)
# - Loads: .claude/agents/pm.md
# - Inputs: Reads project-brief.json from Step 1
# - Executes: Creates PRD
# - Saves: .claude/context/artifacts/prd.json
# - Validates: node .claude/tools/workflow_runner.js --workflow .claude/workflows/greenfield-fullstack.yaml --step 2 --id $WORKFLOW_ID
```
</workflow_example>

<code_example>
**Template Variables**

Workflow artifacts and paths support dynamic template variables that are interpolated at runtime:

**Supported Variables:**
- `{{workflow_id}}`: Unique identifier for the workflow run (required)
- `{{story_id}}`: Story identifier for story loop iterations (optional)
- `{{epic_id}}`: Epic identifier for epic loop iterations (optional)

**Variable Resolution Process:**
1. Variables are extracted from artifact names and paths at workflow execution time
2. Values are provided via command-line arguments to `workflow_runner.js` or set by the orchestrator
3. Variables are replaced with actual values using string substitution
4. If a variable is not provided, it remains as-is in the artifact name (e.g., `story-{{story_id}}.json` without `--story-id` becomes `story-{{story_id}}.json`)
5. Missing required variables (like `{{workflow_id}}`) will cause workflow execution to fail

**Usage Examples:**

In artifact names:
```yaml
outputs:
  - plan-{{workflow_id}}.json
  - story-{{story_id}}-implementation.json
  - epic-{{epic_id}}-summary.json
```

In gate paths:
```yaml
validation:
  gate: .claude/context/history/gates/{{workflow_id}}/01-analyst.json
```

**Passing Variables to workflow_runner.js:**

```bash
# Basic usage (workflow_id only)
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 1 \
  --id my-workflow-123

# With story_id for story loops
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 2 \
  --id my-workflow-123 \
  --story-id story-456

# With epic_id for epic loops
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/greenfield-fullstack.yaml \
  --step 3 \
  --id my-workflow-123 \
  --epic-id epic-789 \
  --story-id story-456
```

**Interpolation Rules:**
- Variables are replaced with actual values when artifacts are created
- **Required Variables**: `{{workflow_id}}` is REQUIRED and will cause execution failure if missing
- **Optional Variables**: `{{story_id}}` and `{{epic_id}}` are OPTIONAL
  - If not provided, they remain as-is in the artifact name (e.g., `story-{{story_id}}.json` without `--story-id` becomes `story-{{story_id}}.json`)
  - Missing optional variables will generate warnings but won't block execution
  - However, un-interpolated variables may cause path resolution issues
- Template variables are case-sensitive: `{{workflow_id}}` ≠ `{{WORKFLOW_ID}}`
- Use double curly braces: `{{variable_name}}`
- Variables must be valid identifiers (alphanumeric and underscores only)

**Error Handling:**
- **Missing Required Variables**: If `{{workflow_id}}` is not provided via `--id` argument, `workflow_runner.js` will fail with an error message and exit code 1
- **Missing Optional Variables**: If `{{story_id}}` or `{{epic_id}}` are not provided, `workflow_runner.js` will generate warnings but continue execution. The un-interpolated variable will remain in artifact names, which may cause path resolution issues
- **Invalid Variable Names**: Variables must use alphanumeric characters and underscores only. Invalid names will cause parsing errors
- **Case Sensitivity Errors**: Using `{{WORKFLOW_ID}}` instead of `{{workflow_id}}` will result in the variable not being replaced, leaving the literal string in artifact names
- **Troubleshooting**: 
  - If artifacts contain literal `{{workflow_id}}` strings, check that `--id` was provided
  - If gate paths fail, verify the workflow_id was correctly interpolated
  - Warnings about un-interpolated variables indicate optional variables were not provided - this is expected if you're not using story/epic loops
  - Check workflow_runner.js error output for specific variable resolution failures
</code_example>

<code_example>
**Optional Artifact Handling Example** (from `ui-perfection-loop.yaml`):

```yaml
inputs:
  - mobile-optimization.json (from step 5, optional)  # Step 5 may be skipped
```

**Agent Implementation**:
```javascript
// Agent should check:
const mobileOpt = await loadArtifact('mobile-optimization.json').catch(() => null);
if (mobileOpt) {
  // Use mobile optimization data
} else {
  // Proceed without mobile-specific optimizations
}
```
</code_example>

<code_example>
**Reasoning Files**

Each workflow step can produce a reasoning file documenting the agent's decision-making process:

```yaml
outputs:
  - reasoning: .claude/context/history/reasoning/{{workflow_id}}/00-planner.json
```

**Reasoning File Structure:**
- Path pattern: `.claude/context/history/reasoning/{{workflow_id}}/{{step_number}}-{{agent_name}}.json`
- Contains: assumptions, decision criteria, tradeoffs, open questions, final decisions
- Purpose: Audit trail, debugging, understanding agent rationale
- Format: JSON with structured reasoning data

**Note**: The reasoning path is explicit in workflows to ensure proper traceability. The workflow runner resolves `{{workflow_id}}` and `{{step_number}}` at runtime.
</code_example>

<code_example>
**Quality Gates**

Each workflow step can specify validation:

```yaml
validation:
  schema: .claude/schemas/project_brief.schema.json  # Optional: for structured artifacts
  gate: .claude/context/history/gates/{{workflow_id}}/01-analyst.json  # Required: validation results
```

**Schema Validation** (optional):
- Used for structured artifacts (PRD, architecture, test plans, etc.)
- Ensures outputs match expected JSON structure
- Required fields are present
- Data types are correct
- Business rules are satisfied

**Gate Validation** (required):
- Always creates a gate file with validation results
- Can validate without schema (for flexible outputs)
- Documents validation status, errors, and warnings
- Used for audit trails and debugging

**When to use schemas:**
- Structured artifacts with well-defined schemas (project_brief, prd, system_architecture, test_plan, artifact_manifest)
- When strict validation is needed

**When schemas are optional:**
- Flexible outputs (reasoning files, documentation, reports)
- Steps that produce multiple artifact types
- Early planning phases where structure may evolve
</code_example>

<code_example>
**Workflow State Management**

Session state is maintained in `.claude/context/session.json`:

```json
{
  "workflow_id": "uuid-here",
  "workflow_name": "greenfield-fullstack",
  "current_step": 3,
  "status": "in_progress",
  "artifacts": {
    "project_brief": ".claude/context/artifacts/project-brief.json",
    "prd": ".claude/context/artifacts/prd.json"
  }
}
```

**Resuming Workflows**:
- Load session state to identify current step
- Continue from where workflow paused
- Re-validate previous steps if needed
</code_example>
</examples>

<instructions>
<execution_process>
## Validation

### Using workflow_runner.js

Validate a workflow step against its schema:

```bash
node .claude/tools/workflow_runner.js \
  --workflow .claude/workflows/<flow>.yaml \
  --step <n> \
  --id <workflow-id>
```

**What It Does**:
1. Loads workflow YAML and finds the specified step
2. Reads validation schema (if specified)
3. Loads output artifact from `.claude/context/artifacts/`
4. Validates JSON structure against schema
5. Creates gate file with validation results
6. Returns exit code 0 (success) or 1 (failure)

### Gate Files

Gate files contain validation results:
- **Location**: Path specified in `validation.gate` (e.g., `.claude/context/history/gates/<workflow_id>/01-analyst.json`)
- **Content**: Validation status, errors, warnings, metadata
- **Format**: JSON with validation results and feedback
</execution_process>

<examples>
<code_example>
**Debugging Workflow Failures**

**Common Issues**:

1. **Schema Validation Failures**:
   - Check gate file for specific field errors
   - Verify artifact structure matches schema
   - Review agent output for missing required fields
   - **Recovery**: Provide feedback to agent with specific field errors, agent corrects and re-validates

2. **Agent Output Issues**:
   - Review agent's reasoning/logs
   - Check if agent understood the task
   - Verify inputs were correctly passed
   - **Recovery**: Re-read agent prompt, clarify requirements, re-execute step

3. **Context Passing Problems**:
   - Verify artifacts exist in `.claude/context/artifacts/`
   - Check artifact file names match references (including template variable resolution)
   - Ensure JSON structure is valid
   - **Recovery**: Manually create missing artifacts or re-run previous step

4. **Workflow Execution Errors**:
   - Check session state for current step
   - Review workflow YAML for syntax errors
   - Verify agent definitions exist
   - **Recovery**: Fix YAML syntax, ensure agents exist, resume from last successful step

5. **Missing Optional Artifacts**:
   - Optional artifacts may be missing if conditional steps didn't execute
   - Agents should handle this gracefully
   - **Recovery**: Verify agent handles optional inputs correctly, proceed without optional artifact

6. **Template Variable Resolution Errors**:
   - Variables not replaced (e.g., `{{workflow_id}}` remains in artifact name)
   - Missing required variables cause execution failure
   - **Recovery**: Ensure workflow_id is provided, check variable names are correct (case-sensitive)

**Error Recovery Process**:

1. **Identify Error Type**: Check gate files and logs to determine error category
2. **Check Error Context**: Review reasoning files and artifact contents
3. **Apply Recovery Strategy**: Use appropriate recovery method from above
4. **Re-validate**: Run validation again after recovery
5. **Document**: Update reasoning files with recovery actions taken
</code_example>
</examples>

<instructions>
<validation>
## Additional Validation

- **Config Validation**: `pnpm validate` - Validates all configuration files
- **Sync Validation**: `pnpm validate:sync` - Validates cross-platform agent/skill parity
</validation>
</instructions>
