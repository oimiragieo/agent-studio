<protocol_description>
Advanced Context Management System - Protocols for persistent context between agent handoffs, structured data passing, context validation, versioning, phase-based project structure, and orchestrator handoff for unlimited project duration.
</protocol_description>

<instructions>
<protocol_steps>
## Current Problems
1. **No persistent context between agent handoffs**
2. **No structured data passing mechanism** 
3. **No context validation or error recovery**
4. **No context versioning or rollback capability**
5. **Project files grow to 50k+ lines** - exceeding AI context limits
6. **Orchestrator accumulates context** - eventually hits 200k token limit
7. **No mechanism for unlimited project duration** - long-running projects fail

## Proposed Context Management Architecture

### Context Store Structure

```json
{
  "session_id": "uuid-here",
  "project_name": "task-management-app",
  "workflow_type": "greenfield-fullstack",
  "current_step": 3,
  "context_version": "1.0.2",
  "agents": {
    "analyst": {
      "status": "completed",
      "outputs": {
        "project_brief": {
          "file_path": "artifacts/project-brief.md",
          "structured_data": {
            "target_users": ["team_leads", "team_members"],
            "core_features": ["task_creation", "assignment", "tracking"],
            "complexity_score": 7,
            "technical_requirements": ["real_time", "collaboration"]
          },
          "execution_time": "2024-01-01T10:00:00Z",
          "quality_score": 8.5
        }
      }
    },
    "pm": {
      "status": "in_progress",
      "inputs": {
        "project_brief": "@agents.analyst.outputs.project_brief",
        "derived_context": {
          "user_personas": "extracted from project_brief.target_users",
          "feature_priorities": "derived from complexity_score"
        }
      }
    }
  },
  "global_context": {
    "project_constraints": {
      "budget": "startup",
      "timeline": "3_months",
      "team_size": "2_developers"
    },
    "technical_stack": {
      "preferences": ["React", "Node.js", "PostgreSQL"],
      "constraints": ["no_microservices", "single_deployment"]
    }
  }
}
```

### Context Passing Mechanisms

```yaml
# Enhanced workflow with context management
- step: 2
  name: 'Requirements Documentation'
  agent: pm
  context_inputs:
    - source: 'agents.analyst.outputs.project_brief'
      extract: ['target_users', 'core_features', 'constraints']
    - source: 'global_context.technical_stack'
      as: 'tech_preferences'
  context_validation:
    required: ['target_users', 'core_features']
    optional: ['constraints', 'tech_preferences']
  context_transformation:
    - transform: 'target_users'
      to: 'user_personas'
      method: 'expand_with_demographics'
```

## Phase-Based Project Structure

### Overview

Projects are organized into phases, each capped at 1-3k lines, enabling unlimited project duration without context limits.

### Structure

```
.claude/projects/{project-name}/
├── phase-01-planning/
│   ├── plan.md (1-3k lines max)
│   ├── artifacts/
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

### File Limits

**Critical**: Each file must stay under 3,000 lines:

- `plan.md`: Maximum 3,000 lines
- `claude.md`: Maximum 3,000 lines
- If exceeded, split phase into sub-phases

### Orchestrator Responsibilities

- **Only maintain current phase plan** in context
- **Reference previous phases** by reading files when needed
- **Update plan files** to keep them current
- **Enforce file limits** - split phases if they exceed 3k lines

## Orchestrator Handoff Process

### Token Monitoring

**Monitor Context Usage Continuously**:

- Track context usage: `node .claude/tools/token-monitor.mjs --session-id <id>`
- Threshold: 90% (180k tokens of 200k) triggers handoff
- Check context usage before major operations
- Update session state with current usage

### Handoff at 90% Context

When context usage reaches 90%:

1. **Update All State via Subagents**:
   - Delegate to **planner** subagent: Update all plan files
   - Delegate to **technical-writer** subagent: Update all CLAUDE.md files
   - Delegate to **artifact-publisher** subagent: Update and organize artifacts
   - Save orchestrator state to handoff package

2. **Create Handoff Package**:

   ```bash
   node .claude/tools/orchestrator-handoff.mjs --session-id <current-id> --project <project-name>
   ```

   Package includes: plan files, CLAUDE.md files, artifacts, memory files, project state

3. **Initialize New Orchestrator**:
   - New orchestrator loads handoff package
   - Initialization prompt: "Initialize codebase and pick up project where previous orchestrator left off"
   - New orchestrator reviews state and continues seamlessly

4. **Shutdown Previous Orchestrator**:
   - After new orchestrator confirms initialization
   - Previous orchestrator saves final state and terminates
   - Session marked as 'shutdown'

### Handoff Package Structure

```json
{
  "previousSessionId": "orchestrator-abc123",
  "newSessionId": "orchestrator-xyz789",
  "projectName": "my-project",
  "currentPhase": "phase-03-implementation",
  "planFiles": {
    "phase-01": ".claude/projects/{project}/phase-01-planning/plan.md",
    "phase-02": ".claude/projects/{project}/phase-02-architecture/plan.md",
    "phase-03": ".claude/projects/{project}/phase-03-implementation/plan.md"
  },
  "claudeMdFiles": [
    ".claude/projects/{project}/phase-*/claude.md"
  ],
  "artifacts": [
    ".claude/projects/{project}/phase-*/artifacts/*"
  ],
  "memoryFiles": [
    ".claude/orchestrators/orchestrator-abc123/memory/*.md"
  ],
  "projectState": {
    "currentStep": 15,
    "completedTasks": [...],
    "pendingTasks": [...],
    "contextSummary": "..."
  }
}
```

## Ephemeral Developer Agents

### Lifecycle

Developer agents are **ephemeral** - created fresh for each task:

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

## Dual Persistence: CLAUDE.md + Memory Tool

### Overview

Agents use **BOTH** CLAUDE.md files and memory tool for redundancy:

- **CLAUDE.md Files**: Static, version-controlled context (rules, structure, standards)
- **Memory Tool**: Dynamic, learned patterns (cross-conversation learning)

### How They Work Together

1. **CLAUDE.md**: Provides foundational context (loaded automatically)
2. **Memory Tool**: Captures learned patterns (on-demand)
3. **Redundancy**: If one fails, the other provides backup
4. **Synergy**: Memory tool references CLAUDE.md patterns, CLAUDE.md references memory insights

### Implementation

- Memory tool enabled for all agents in `.claude/config.yaml`
- Memory files stored in `.claude/orchestrators/{session-id}/memory/`
- Sync mechanism between CLAUDE.md and memory tool
- Both systems maintain knowledge for redundancy

## Context Editing

### Automatic Context Compaction

- **Tool Use Clearing** (`clear_tool_uses_20250919`): Clears old tool results when context grows large
- **Thinking Management** (`clear_thinking_20251015`): Manages extended thinking blocks
- **Configurable Triggers**: Token-based triggers (30-40k tokens recommended)
- **Retention Policies**: Keep recent context, clear old context

### Configuration

Add to `.claude/config.yaml`:

```yaml
context_editing:
  clear_tool_uses:
    enabled: true
    trigger_tokens: 40000
    retention_policy: 'keep_recent'
  clear_thinking:
    enabled: true
    trigger_tokens: 50000
    retention_policy: 'keep_recent'
```

</protocol_steps>
</instructions>

<examples>
<code_example>
**Context Store Structure**:

```json

```
