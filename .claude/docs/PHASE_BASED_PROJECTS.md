# Phase-Based Project Structure

## Overview

Phase-based project structure organizes large projects into manageable phases, each capped at 1-3k lines. This enables AI agents to work effectively on projects of any size without hitting context limits.

## The Problem

Traditional project files grow unbounded:
- Single plan files reach 50k+ lines
- CLAUDE.md files become massive
- AI agents cannot ingest such large files
- Context windows fill up quickly

## The Solution

**Phase-Based Organization**: Split projects into phases, each with manageable file sizes (1-3k lines max).

## Structure

### Directory Layout

```
.claude/projects/{project-name}/
├── phase-01-planning/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   │   ├── project-brief.json
│   │   ├── requirements.json
│   │   └── ...
│   └── claude.md (1-3k lines max)
├── phase-02-architecture/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   │   ├── system-architecture.json
│   │   ├── database-schema.json
│   │   └── ...
│   └── claude.md (1-3k lines max)
├── phase-03-implementation/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
│   │   ├── api-endpoints.json
│   │   ├── component-list.json
│   │   └── ...
│   └── claude.md (1-3k lines max)
└── orchestrator-state.json
```

### File Limits

**Critical**: Each file must stay under 3,000 lines:

- **plan.md**: Maximum 3,000 lines
  - If exceeded, split phase into sub-phases
  - Archive completed tasks
  - Summarize old content

- **claude.md**: Maximum 3,000 lines
  - If exceeded, split into multiple files
  - Reference parent CLAUDE.md
  - Archive old patterns

- **Artifacts**: No strict limit, but organize by task
  - Keep artifacts relevant to current phase
  - Archive completed phase artifacts

## Phase Naming Convention

Phases follow the pattern: `phase-{number}-{name}/`

### Standard Phases

1. **phase-01-planning/**
   - Project discovery
   - Requirements gathering
   - Feasibility analysis
   - Stakeholder alignment

2. **phase-02-architecture/**
   - System design
   - Technology selection
   - Database schema
   - API design

3. **phase-03-implementation/**
   - Code development
   - Feature implementation
   - Integration
   - Testing

4. **phase-04-testing/**
   - Test development
   - Quality assurance
   - Bug fixing
   - Performance testing

5. **phase-05-deployment/**
   - Deployment planning
   - Infrastructure setup
   - CI/CD configuration
   - Production rollout

### Custom Phases

Projects may have custom phases based on needs:
- `phase-02-research/` - Research and prototyping
- `phase-03-migration/` - Legacy system migration
- `phase-04-optimization/` - Performance optimization

## Phase Plan Structure

Each `plan.md` file follows this structure:

```markdown
# Phase {Number}: {Phase Name}

## Overview
Brief description of what this phase accomplishes.

## Objectives
- Objective 1
- Objective 2
- Objective 3

## Tasks

### Task 1: {Task Name}
- **Status**: pending | in_progress | completed | blocked
- **Assigned Agent**: developer
- **Dependencies**: [Task IDs]
- **Artifacts**: [artifact files]
- **Description**: Task details

### Task 2: {Task Name}
...

## Dependencies
- Depends on: phase-01-planning
- Blocks: phase-03-implementation

## Progress
- Completed: 5/10 tasks
- In Progress: 2/10 tasks
- Pending: 3/10 tasks

## Notes
Any phase-specific notes or decisions.
```

## Phase CLAUDE.md Structure

Each `claude.md` file contains phase-specific context:

```markdown
# {Phase Name} - Project Context

## Phase Overview
Context specific to this phase.

## Patterns and Conventions
Phase-specific coding patterns and conventions.

## Dependencies
References to previous phases and their outputs.

## Current State
What has been completed in this phase.

## Next Steps
What needs to be done next.
```

## Orchestrator State

The `orchestrator-state.json` file tracks overall project state:

```json
{
  "projectName": "my-project",
  "currentPhase": "phase-03-implementation",
  "currentStep": 15,
  "phases": {
    "phase-01-planning": {
      "status": "completed",
      "completedAt": "2025-01-15T10:00:00Z"
    },
    "phase-02-architecture": {
      "status": "completed",
      "completedAt": "2025-01-18T14:00:00Z"
    },
    "phase-03-implementation": {
      "status": "in_progress",
      "startedAt": "2025-01-20T09:00:00Z"
    }
  },
  "completedTasks": [
    "Task 1: Project planning",
    "Task 2: Architecture design"
  ],
  "pendingTasks": [
    "Task 3: API implementation",
    "Task 4: Frontend components"
  ]
}
```

## Working with Phases

### Creating a New Phase

1. **Create Phase Directory**:
   ```bash
   mkdir -p .claude/projects/{project}/phase-{number}-{name}
   ```

2. **Create plan.md**:
   - Start with phase overview and objectives
   - List initial tasks
   - Set dependencies on previous phases

3. **Create claude.md**:
   - Document phase-specific context
   - Reference previous phases
   - Include patterns and conventions

4. **Create artifacts/ Directory**:
   ```bash
   mkdir -p .claude/projects/{project}/phase-{number}-{name}/artifacts
   ```

### Updating a Phase

1. **Update plan.md**:
   - Mark tasks as completed
   - Add new tasks as needed
   - Update progress tracking

2. **Update claude.md**:
   - Add new patterns discovered
   - Document decisions made
   - Update current state

3. **Add Artifacts**:
   - Save task outputs to artifacts/
   - Reference artifacts in plan.md

### Enforcing File Limits

**If plan.md exceeds 3k lines**:

1. **Split Phase**:
   - Create sub-phases: `phase-03-implementation-part1/`, `phase-03-implementation-part2/`
   - Move completed tasks to part1
   - Continue new tasks in part2

2. **Archive Completed Tasks**:
   - Move completed tasks to `phase-{number}-{name}-archive/`
   - Summarize archived tasks in plan.md
   - Keep only active tasks in main plan.md

3. **Summarize Old Content**:
   - Replace detailed old content with summaries
   - Reference archived files for details
   - Keep plan.md focused on current work

**If claude.md exceeds 3k lines**:

1. **Split into Multiple Files**:
   - `claude.md` - Main context
   - `claude-patterns.md` - Patterns and conventions
   - `claude-decisions.md` - Decisions and rationale

2. **Reference Parent CLAUDE.md**:
   - Use `@.claude/CLAUDE.md` to reference parent
   - Keep phase-specific content in phase claude.md

## Orchestrator Responsibilities

The orchestrator:

1. **Maintains Current Phase Plan**:
   - Only loads current phase plan.md into context
   - Updates plan.md as tasks progress
   - Ensures plan.md stays under 3k lines

2. **References Previous Phases**:
   - Reads previous phase files when needed
   - Doesn't keep previous phases in context
   - References artifacts from previous phases

3. **Enforces File Limits**:
   - Monitors file sizes
   - Triggers phase splitting if needed
   - Archives completed content

4. **Updates Orchestrator State**:
   - Tracks current phase
   - Records completed tasks
   - Maintains project progress

## Developer Agent Usage

Developer agents:

1. **Load Only Current Phase**:
   - Only relevant phase files loaded
   - Previous phases referenced on-demand
   - No accumulation of old context

2. **Save to Phase Artifacts**:
   - All outputs saved to current phase artifacts/
   - Artifacts referenced in plan.md
   - Organized by task

3. **Ephemeral Lifecycle**:
   - Created fresh for each task
   - Shut down after completion
   - No state accumulation

## Benefits

### Context Efficiency

- Each phase file: 1-3k lines (easily digestible)
- Orchestrator only loads current phase
- Previous phases referenced on-demand

### Scalability

- Projects can have unlimited phases
- No context limit concerns
- Each phase is manageable

### Organization

- Clear project structure
- Easy to navigate
- Logical progression

### Maintainability

- Easy to update individual phases
- Clear dependencies
- Isolated changes

## Best Practices

1. **Keep Files Under 3k Lines**: Split phases if needed
2. **Clear Phase Boundaries**: Each phase should have clear objectives
3. **Document Dependencies**: Explicitly state phase dependencies
4. **Update Regularly**: Keep plans and CLAUDE.md files current
5. **Archive Completed Work**: Move completed tasks to archive
6. **Reference, Don't Duplicate**: Reference previous phases, don't copy content

## Migration from Monolithic Structure

To migrate an existing project:

1. **Analyze Current Structure**: Identify logical phases
2. **Create Phase Directories**: Set up phase structure
3. **Split Plan File**: Distribute content across phases
4. **Split CLAUDE.md**: Organize context by phase
5. **Move Artifacts**: Organize artifacts by phase
6. **Update Orchestrator State**: Initialize state file

## Examples

### Example: E-Commerce Platform

```
.claude/projects/ecommerce-platform/
├── phase-01-planning/
│   ├── plan.md (2,500 lines)
│   ├── artifacts/
│   │   ├── market-research.json
│   │   └── requirements.json
│   └── claude.md (1,800 lines)
├── phase-02-architecture/
│   ├── plan.md (2,200 lines)
│   ├── artifacts/
│   │   ├── system-architecture.json
│   │   └── database-schema.json
│   └── claude.md (2,000 lines)
├── phase-03-implementation/
│   ├── plan.md (2,800 lines)
│   ├── artifacts/
│   │   ├── api-endpoints.json
│   │   └── components.json
│   └── claude.md (2,500 lines)
└── orchestrator-state.json
```

### Example: API Migration

```
.claude/projects/api-migration/
├── phase-01-planning/
│   ├── plan.md (1,500 lines)
│   └── claude.md (1,200 lines)
├── phase-02-analysis/
│   ├── plan.md (2,000 lines)
│   └── claude.md (1,800 lines)
├── phase-03-migration/
│   ├── plan.md (2,900 lines)
│   └── claude.md (2,700 lines)
└── orchestrator-state.json
```

