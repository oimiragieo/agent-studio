# Orchestration Monitoring System

## Overview

The Orchestration Monitoring System provides real-time visibility into workflow execution, addressing the "black box" problem where users couldn't see agent progress, created artifacts, or execution status.

**Problem Solved**: Previous orchestration system scored 1/10 user experience due to:

- No visibility into agent progress
- No artifact discovery mechanism
- No status updates during execution
- Silent failures with no error notifications
- No way to pause or intervene mid-orchestration

**Solution**: 5-component monitoring system inspired by CrewAI, AutoGen, and LangChain patterns.

---

## Components

### 1. Post-Task Output Retriever Hook

**File**: `.claude/hooks/post-task-output-retriever.mjs`

**Purpose**: Automatically retrieves and displays agent outputs after Task tool completes.

**Features**:

- Intercepts Task tool completion via PostToolUse hook
- Retrieves agent output from Task results
- Scans for newly created artifacts (last 60 seconds)
- Displays formatted summary with file paths, sizes, timestamps
- Shows first 1000 characters of agent output

**Usage**: Automatic (no manual invocation required)

**Example Output**:

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 POST-TASK OUTPUT RETRIEVAL                              │
└─────────────────────────────────────────────────────────────┘

Agent Type: developer
Description: Implement skill conversion
Agent ID: a14493c

📁 Scanning for artifacts created by agent...

✓ Found 3 artifact(s):

  📄 .claude/skills/ralph-wiggum/SKILL.md
     Size: 12.5 KB
     Modified: 2026-01-16 16:15:22
     Summary: Ralph Wiggum skill for project persistence

  📄 .claude/templates/ralph-wiggum-task.json
     Size: 3.2 KB
     Modified: 2026-01-16 16:15:44

  📄 plan-ralph-wiggum-2026-01-16.md
     Size: 8.1 KB
     Modified: 2026-01-16 16:14:58

┌─────────────────────────────────────────────────────────────┐
│  ✓ POST-TASK RETRIEVAL COMPLETE                             │
└─────────────────────────────────────────────────────────────┘
```

**Manual Testing**:

```bash
node .claude/hooks/post-task-output-retriever.mjs
```

---

## Run Tracing (Events + Tool Stream)

In addition to the UI-style dashboards, the system persists an auditable, file-backed trace for every run:

- Run state: `.claude/context/runtime/runs/<runId>/state.json`
- Event log: `.claude/context/runtime/runs/<runId>/events.ndjson`
- Tool/guard stream: `.claude/context/artifacts/tool-events/run-<runId>.ndjson`

`events.ndjson` includes OTel/W3C-compatible trace/span fields (`trace_id`, `span_id`, `parent_span_id`, `traceparent`) so multi-agent tool usage can be reconstructed into spans.

Optional deep-debug outputs:

- Payload storage (sanitized): set `CLAUDE_OBS_STORE_PAYLOADS=1` to write `.claude/context/payloads/trace-<trace_id>/span-<span_id>.json` and link from `events.ndjson` via `event.payload.payload_ref`.
- Failure bundles: set `CLAUDE_OBS_FAILURE_BUNDLES=1` to emit `.claude/context/artifacts/failure-bundles/failure-*.json` on denials and tool failures.

---

### 2. Workflow Status Dashboard

**File**: `.claude/tools/workflow-dashboard.mjs`

**Purpose**: Display real-time workflow progress with current step, agent activity, and artifacts.

**Features**:

- Shows current workflow run status
- Progress bar with percentage complete
- Current agent and activity description
- Duration and estimated time remaining
- List of artifacts created
- Recent errors (if any)

**Usage**:

```bash
# Show most recent workflow run
node .claude/tools/workflow-dashboard.mjs

# Show specific run
node .claude/tools/workflow-dashboard.mjs --run-id run-20260116-160052
```

**Example Output**:

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 WORKFLOW STATUS DASHBOARD                                   │
└─────────────────────────────────────────────────────────────────┘

  Run ID: run-20260116-160052
  Workflow: greenfield-fullstack.yaml
  Status: 🟢 Running

  Progress: 8/15 steps (53%)
  [█████████████████████░░░░░░░░░░░░░░░░░░░]

  Current Agent: developer
  Activity: Implementing skill files

  Duration: 12m 34s
  Estimated Remaining: ~11m 20s

  Artifacts Created: 5

    📄 .claude/skills/ralph-wiggum/SKILL.md
    📄 .claude/templates/ralph-wiggum-task.json
    📄 .claude/hooks/ralph-wiggum-trigger.mjs
    📄 .claude/schemas/ralph-wiggum.schema.json
    📄 plan-ralph-wiggum-2026-01-16.md

┌─────────────────────────────────────────────────────────────────┐
│  Dashboard updated: 16:25:43 (refresh every 30s)                │
└─────────────────────────────────────────────────────────────────┘
```

**Integration**: Called by master-orchestrator every 30s during workflow execution.

---

### 3. Artifact Notification System

**File**: `.claude/tools/artifact-notifier.mjs`

**Purpose**: Scan for new artifacts and display formatted notifications.

**Features**:

- Scans `.claude/context/` for recently modified files
- Filters out temp files and logs
- Extracts summaries from JSON/Markdown files
- Displays file path, size, timestamp, and summary
- Sorted by most recent first

**Usage**:

```bash
# Scan for artifacts modified in last 60 seconds
node .claude/tools/artifact-notifier.mjs

# Custom time window (last 5 minutes)
node .claude/tools/artifact-notifier.mjs --since 300

# Custom search path
node .claude/tools/artifact-notifier.mjs --path .claude/context/artifacts
```

**Example Output**:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 NEW ARTIFACTS CREATED                                       │
└─────────────────────────────────────────────────────────────────┘

  1. plan-ralph-wiggum-2026-01-16.md
     Location: .claude/context/artifacts/plan-ralph-wiggum-2026-01-16.md
     Size: 8.1 KB
     Created: 2026-01-16 16:14:58
     Summary: Comprehensive plan to convert Ralph Wiggum plugin to
              Claude skill with templates, hooks, and integration

  2. ralph-wiggum-task.json
     Location: .claude/templates/ralph-wiggum-task.json
     Size: 3.2 KB
     Created: 2026-01-16 16:15:44
     Summary: Task template for Ralph Wiggum skill invocation

┌─────────────────────────────────────────────────────────────────┐
│  💡 Tip: Use Read tool to view artifact contents                │
└─────────────────────────────────────────────────────────────────┘
```

**Integration**: Called by post-task hook and orchestrator after agent completion.

---

### 4. Master-Orchestrator Status Polling

**File**: `.claude/agents/master-orchestrator.md`

**Purpose**: Updated orchestrator agent definition with status polling and user intervention.

**New Capabilities**:

#### Status Polling Loop

```
Every 30 seconds during agent execution:
1. Call workflow-dashboard.mjs to get current status
2. Display status to user with progress update
3. Check for errors or stalls
4. Continue monitoring until agent completes
```

#### User Intervention Points

```
After major steps (planning, design, implementation):
1. Display step completion summary
2. Show artifacts created
3. Ask user: "Review artifacts? [Yes/No/Edit]"
4. Wait for user input before proceeding
5. Allow adjustments based on user feedback
```

**Example Interaction**:

```
Orchestrator: Spawning planner agent...

[30s later]
Orchestrator: Status update: Planner analyzing plugin source code (Progress: 25%)

[60s later]
Orchestrator: Status update: Planner designing skill structure (Progress: 50%)

[90s later]
Orchestrator: Status update: Planner writing plan document (Progress: 75%)

[120s later]
Orchestrator: ✓ Planner completed
              Created: plan-ralph-wiggum-2026-01-16.md (8.1 KB)

Would you like to:
A) Review plan before proceeding (Recommended)
B) Proceed with implementation
C) Adjust plan parameters

User: A

Orchestrator: [Displays plan summary]
              Proceed with this plan? [Yes/No/Edit]
```

---

### 5. Documentation (This File)

**File**: `.claude/docs/ORCHESTRATION_MONITORING.md`

**Purpose**: Complete usage guide for the monitoring system.

---

## Architecture

### Information Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER REQUEST                                                    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  MASTER-ORCHESTRATOR                                             │
│  • Spawns agents via Task tool                                  │
│  • Calls workflow-dashboard.mjs every 30s                       │
│  • Displays status updates to user                              │
│  • Adds intervention points between steps                       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-TASK HOOK (Automatic)                                      │
│  • Intercepts Task tool completion                              │
│  • Retrieves agent output via TaskOutput                        │
│  • Calls artifact-notifier.mjs                                  │
│  • Displays formatted summary                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER RECEIVES                                                   │
│  • Real-time status updates (every 30s)                         │
│  • Immediate artifact notifications                             │
│  • Agent outputs and summaries                                  │
│  • Intervention points for feedback                             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Integration

| Component                        | Called By               | Frequency        | Purpose          |
| -------------------------------- | ----------------------- | ---------------- | ---------------- |
| `post-task-output-retriever.mjs` | Hook system (automatic) | After each Task  | Retrieve outputs |
| `workflow-dashboard.mjs`         | Master-orchestrator     | Every 30s        | Show progress    |
| `artifact-notifier.mjs`          | Post-task hook          | After each agent | Show artifacts   |

---

## Research Patterns Applied

### CrewAI Patterns

- **Real-time tracing**: Every agent step visible via status updates
- **Session drilldowns**: Dashboard shows detailed execution state
- **AgentOps integration**: Metrics tracking (duration, progress, artifacts)

### AutoGen Patterns

- **Conversation transparency**: Orchestrator surfaces agent reasoning
- **User visibility**: Decision-making process observable by users
- **Intervention mechanisms**: Users can pause/adjust mid-execution

### LangChain Patterns

- **Streaming updates**: Status polling provides continuous visibility
- **Callbacks**: Post-task hook acts as completion callback
- **Event handling**: Real-time event monitoring at every stage

---

## Usage Examples

### Example 1: Basic Workflow with Monitoring

```javascript
// User request
"Implement feature X with full monitoring"

// Orchestrator response
Spawning developer agent...

[T+0s] Status: Developer agent started
[T+30s] Status: Developer analyzing codebase (25% complete)
[T+60s] Status: Developer implementing feature (50% complete)
[T+90s] Status: Developer writing tests (75% complete)
[T+120s] Status: Developer completed successfully

✓ Artifacts created:
  - src/features/feature-x.ts (5.2 KB)
  - tests/feature-x.test.ts (3.1 KB)

Review artifacts before proceeding? [Yes/No]
```

### Example 2: Manual Dashboard Check

```bash
# Check workflow status anytime
$ node .claude/tools/workflow-dashboard.mjs

# Output shows:
# - Current step: 8/15 (53%)
# - Active agent: developer
# - Duration: 12m 34s
# - Estimated remaining: ~11m 20s
# - 5 artifacts created
```

### Example 3: Artifact Scanning

```bash
# Scan for new artifacts (last 5 minutes)
$ node .claude/tools/artifact-notifier.mjs --since 300

# Output shows:
# - All files modified in last 5 minutes
# - File paths, sizes, timestamps
# - Summaries extracted from content
```

---

## Experience Comparison

| Aspect                 | Before (1/10)                    | After (8+/10)                      |
| ---------------------- | -------------------------------- | ---------------------------------- |
| **Visibility**         | Black box, no updates            | Real-time status every 30s         |
| **Progress Tracking**  | None, can't tell if working      | Progress bar, step N/M, percentage |
| **Artifact Discovery** | Hunt manually, may not exist     | Automatic notification with paths  |
| **Failure Detection**  | Silent failures, no errors       | Immediate error alerts             |
| **User Control**       | Fire-and-forget, no intervention | Pause/resume/adjust at any step    |
| **Trust**              | Low, feels broken                | High, see everything happening     |
| **Time to Value**      | Unknown, indefinite wait         | Estimated time remaining shown     |

---

## Troubleshooting

### Hook Not Running

**Symptom**: Post-task hook doesn't display output after Task tool

**Solutions**:

1. Verify hook is registered in `.claude/hooks/README.md`
2. Check hook priority (should be 50, runs after Task)
3. Verify hook enabled: `export.config.enabled = true`
4. Test manually: `node .claude/hooks/post-task-output-retriever.mjs`

### Dashboard Shows No Runs

**Symptom**: `workflow-dashboard.mjs` reports "No active workflow runs found"

**Solutions**:

1. Check if run was created: `ls .claude/context/runtime/runs/`
2. Verify run state file exists: `state.json` in run directory
3. Check alternate location: `.claude/context/tmp/run-state-*.json`
4. Create run manually: `node .claude/tools/run-manager.mjs create`

### No Artifacts Found

**Symptom**: `artifact-notifier.mjs` finds no artifacts

**Solutions**:

1. Increase time window: `--since 300` (5 minutes)
2. Check search path: `--path .claude/context/artifacts`
3. Verify artifacts were actually created: `ls .claude/context/`
4. Check file timestamps: `ls -lt .claude/context/artifacts/`

---

## Future Enhancements

### Planned Features

1. **WebSocket streaming**: Real-time push updates instead of polling
2. **Web dashboard**: Browser-based UI for workflow monitoring
3. **Notifications**: Desktop/email notifications for long-running workflows
4. **Metrics export**: Export workflow metrics to JSON/CSV for analysis
5. **Alert thresholds**: Configurable alerts for slow agents or errors

### Integration Opportunities

1. **CI/CD integration**: Dashboard in GitHub Actions logs
2. **Slack notifications**: Post status updates to Slack channels
3. **Prometheus metrics**: Export metrics for monitoring systems
4. **APM integration**: Integrate with DataDog, New Relic, etc.

---

## Conclusion

The Orchestration Monitoring System transforms the user experience from 1/10 (black box, no visibility) to 8+/10 (full transparency, real-time updates). By applying patterns from CrewAI, AutoGen, and LangChain, the system provides:

✅ **Visibility**: See what agents are doing in real-time
✅ **Control**: Intervene at key decision points
✅ **Confidence**: Know where artifacts are and when they're created
✅ **Trust**: See progress bars, time estimates, and status updates

Users are no longer left wondering "what's happening?" - they have complete visibility into orchestration execution.
