# Everlasting Agent System

## Overview

The Everlasting Agent System enables orchestrator agents to run indefinitely without hitting context window limits. This is achieved through a sophisticated handoff mechanism that seamlessly transfers project state between orchestrator instances.

## The Problem

Traditional orchestrator agents accumulate context over time:

- Project files grow to 50k+ lines
- Context window fills up (200k token limit)
- Agent fails when context exceeds limits
- Long-running projects become impossible

## The Solution

**Phase-Based Structure + Orchestrator Handoff**

1. **Phase-Based Projects**: Split projects into phases (1-3k lines each)
2. **Token Monitoring**: Monitor context usage continuously
3. **Handoff at 90%**: Transfer state to new orchestrator instance
4. **Seamless Continuity**: New orchestrator picks up exactly where previous left off

## Architecture

### Project Structure

```
.claude/projects/{project-name}/
├── phase-01-planning/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   │   └── [task outputs]
│   └── claude.md (1-3k lines max)
├── phase-02-architecture/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   └── claude.md (1-3k lines max)
├── phase-03-implementation/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   └── claude.md (1-3k lines max)
└── orchestrator-state.json
```

### Orchestrator Sessions

```
.claude/orchestrators/
├── orchestrator-{session-id-1}/
│   ├── session.json
│   ├── memory/
│   │   └── [memory files]
│   └── handoff-package.json
├── orchestrator-{session-id-2}/
│   ├── session.json
│   ├── memory/
│   └── handoff-package.json
└── ...
```

## Token Monitoring

### How It Works

The orchestrator continuously monitors its context usage:

```bash
node .claude/tools/token-monitor.mjs --session-id <id> [--threshold 0.90]
```

**Threshold**: 90% (180k tokens of 200k) triggers handoff

**Monitoring Process**:

1. Check context usage before major operations
2. Update session state with current usage
3. If usage >= 90%, immediately trigger handoff
4. Do NOT start new tasks - complete current task first

### Context Usage Tracking

The token monitor tracks:

- Input tokens (system prompt, context files, messages)
- Output tokens (responses, tool results)
- Total tokens (input + output)
- Percentage of context limit

## Orchestrator Handoff Process

### Step 1: Update All State via Subagents

When handoff is triggered, the orchestrator delegates to subagents:

1. **Planner Subagent**: Updates all plan files
   - Reads current plan files from all phases
   - Updates with latest progress
   - Ensures plans stay under 3k lines
   - Saves to `.claude/projects/{project}/phase-*/plan.md`

2. **Technical Writer Subagent**: Updates all CLAUDE.md files
   - Reads current CLAUDE.md files from all phases
   - Updates with latest context and patterns
   - Ensures files stay under 3k lines
   - Saves to `.claude/projects/{project}/phase-*/claude.md`

3. **Artifact Publisher Subagent**: Updates and organizes artifacts
   - Collects all artifacts from all phases
   - Organizes by phase and task
   - Updates artifact manifests
   - Saves to `.claude/projects/{project}/phase-*/artifacts/`

### Step 2: Create Handoff Package

```bash
node .claude/tools/orchestrator-handoff.mjs --session-id <current-id> --project <project-name>
```

**Handoff Package Contents**:

- Previous session ID
- New session ID
- Project name
- Current phase
- All plan files (phase → path mapping)
- All CLAUDE.md files (array of paths)
- All artifacts (array of paths)
- Memory files (array of paths)
- Project state (current step, completed tasks, pending tasks, context summary)

**Handoff Package Structure**:

```json
{
  "previousSessionId": "orchestrator-abc123",
  "newSessionId": "orchestrator-xyz789",
  "projectName": "my-project",
  "createdAt": "2025-01-20T10:00:00Z",
  "currentPhase": "phase-03-implementation",
  "planFiles": {
    "phase-01-planning": ".claude/projects/my-project/phase-01-planning/plan.md",
    "phase-02-architecture": ".claude/projects/my-project/phase-02-architecture/plan.md",
    "phase-03-implementation": ".claude/projects/my-project/phase-03-implementation/plan.md"
  },
  "claudeMdFiles": [
    ".claude/projects/my-project/phase-01-planning/claude.md",
    ".claude/projects/my-project/phase-02-architecture/claude.md",
    ".claude/projects/my-project/phase-03-implementation/claude.md"
  ],
  "artifacts": [
    ".claude/projects/my-project/phase-01-planning/artifacts/project-brief.json",
    ".claude/projects/my-project/phase-02-architecture/artifacts/system-architecture.json"
  ],
  "memoryFiles": [
    ".claude/orchestrators/orchestrator-abc123/memory/patterns.md",
    ".claude/orchestrators/orchestrator-abc123/memory/preferences.md"
  ],
  "projectState": {
    "currentStep": 15,
    "completedTasks": [
      "Task 1: Project planning",
      "Task 2: Architecture design",
      "Task 3: Database schema"
    ],
    "pendingTasks": [
      "Task 4: API implementation",
      "Task 5: Frontend components",
      "Task 6: Testing"
    ],
    "contextSummary": "Project in implementation phase. Database schema complete. Starting API development."
  }
}
```

### Step 3: Initialize New Orchestrator

The new orchestrator instance:

1. **Loads Handoff Package**: Reads from `.claude/orchestrators/{new-session-id}/handoff-package.json`

2. **Initialization Prompt**:

   ```
   Initialize the codebase and pick up the project where the previous orchestrator left off.

   Previous Session: orchestrator-abc123
   Project: my-project
   Current Phase: phase-03-implementation
   Current Step: 15

   Context Summary:
   Project in implementation phase. Database schema complete. Starting API development.

   Available Resources:
   - Plan files: phase-01-planning, phase-02-architecture, phase-03-implementation
   - CLAUDE.md files: 3 files
   - Artifacts: 2 files
   - Memory files: 2 files

   Completed Tasks:
   - Task 1: Project planning
   - Task 2: Architecture design
   - Task 3: Database schema

   Pending Tasks:
   - Task 4: API implementation
   - Task 5: Frontend components
   - Task 6: Testing

   Your task:
   1. Review the handoff package to understand the current project state
   2. Load relevant plan files and CLAUDE.md files for context
   3. Continue from where the previous orchestrator left off
   4. Update the orchestrator state as you progress
   5. Once initialized, send a shutdown signal to the previous orchestrator (orchestrator-abc123)
   ```

3. **Reviews State**: Reads plan files, CLAUDE.md files, artifacts, and memory files

4. **Continues Seamlessly**: Picks up exactly where previous orchestrator left off

### Step 4: Shutdown Previous Orchestrator

After new orchestrator confirms initialization:

1. **Send Shutdown Signal**: New orchestrator notifies previous orchestrator
2. **Save Final State**: Previous orchestrator saves any final state
3. **Mark as Shutdown**: Session marked as 'shutdown' in session.json
4. **Terminate**: Previous orchestrator terminates cleanly

## Ephemeral Developer Agents

### Lifecycle

Developer agents are **ephemeral** - created fresh for each task and shut down after completion:

1. **Create**: Orchestrator creates new developer agent with task-specific context
2. **Context**: Only relevant phase files loaded (not entire project)
3. **Execute**: Developer completes task
4. **Output**: Saves outputs to phase artifacts
5. **Shutdown**: Agent terminates after completion

### Benefits

- **Fresh Context**: Each task starts with clean context
- **No State Accumulation**: No context buildup across tasks
- **Efficient**: Only loads necessary files
- **Isolated**: Each task is independent

### Orchestrator Management

The orchestrator:

- Creates new developer agent for each task
- Provides only necessary context (current phase files)
- Collects outputs and updates plan
- Shuts down developer agent after task completion

## Phase-Based Project Structure

### Phase Organization

Projects are split into phases, each with:

- **plan.md**: Phase plan (1-3k lines max)
- **claude.md**: Phase-specific context (1-3k lines max)
- **artifacts/**: Task outputs organized by phase

### Naming Convention

Phases follow the pattern: `phase-{number}-{name}/`

Examples:

- `phase-01-planning/`
- `phase-02-architecture/`
- `phase-03-implementation/`
- `phase-04-testing/`
- `phase-05-deployment/`

### File Limits

**Critical**: Each file must stay under 3k lines:

- `plan.md`: Maximum 3,000 lines
- `claude.md`: Maximum 3,000 lines
- If a phase exceeds limits, split into sub-phases

### Orchestrator Responsibilities

- **Only maintain current phase plan** in context
- **Reference previous phases** by reading files when needed
- **Update plan files** to keep them current
- **Enforce file limits** - split phases if they exceed 3k lines

## Benefits

### Unlimited Project Duration

Projects can run indefinitely without context limits:

- Each orchestrator instance has fresh context
- Handoff process maintains perfect continuity
- No information loss between handoffs

### Context Efficiency

Phase-based structure keeps files manageable:

- Each phase file: 1-3k lines (easily digestible by AI)
- Orchestrator only loads current phase
- Previous phases referenced on-demand

### Seamless Continuity

Handoff process ensures perfect continuity:

- All state preserved in handoff package
- New orchestrator picks up exactly where previous left off
- No gaps or missing context

### Resource Efficiency

Ephemeral developer agents:

- Fresh context per task
- No state accumulation
- Efficient resource usage

## Implementation

### Tools

- **Token Monitor**: `.claude/tools/token-monitor.mjs`
- **Orchestrator Handoff**: `.claude/tools/orchestrator-handoff.mjs`

### Schemas

- **Orchestrator State**: `.claude/schemas/orchestrator-state.schema.json`
- **Phase Plan**: `.claude/schemas/phase-plan.schema.json`

### Agent Updates

- **Orchestrator**: Updated with token monitoring and handoff logic
- **Developer**: Updated with ephemeral lifecycle patterns

## Best Practices

1. **Monitor Context Continuously**: Check usage before major operations
2. **Complete Current Task**: Don't start new tasks when approaching 90%
3. **Update State Regularly**: Keep plans and CLAUDE.md files current
4. **Enforce File Limits**: Split phases if they exceed 3k lines
5. **Clean Handoffs**: Ensure all state is saved before handoff
6. **Verify Initialization**: New orchestrator should confirm it has all context

## Troubleshooting

### Handoff Fails

- Check that all subagents completed their updates
- Verify handoff package was created successfully
- Ensure new orchestrator can access handoff package

### Context Still High After Handoff

- Verify new orchestrator loaded handoff package correctly
- Check that only current phase files are in context
- Ensure previous orchestrator shut down cleanly

### Phase Files Exceed 3k Lines

- Split phase into sub-phases
- Move completed tasks to archive
- Summarize old content in plan.md

## Future Enhancements

- Automatic phase splitting when files exceed limits
- Predictive handoff (trigger before 90% if trend indicates)
- Handoff verification and rollback
- Cross-project pattern sharing via memory files
