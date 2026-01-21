# Track System Architecture

## Metadata

- **Version**: 1.0.0
- **Created**: 2025-01-15
- **Author**: Winston (System Architect)
- **Status**: Draft
- **Related Documents**: track.schema.json, WORKFLOW-GUIDE.md, run-manager.mjs

---

## Executive Summary

The Track System provides higher-level work organization above individual workflows, enabling isolation of related work streams, context management across sessions, and intelligent workflow coordination. A track represents a named, bounded work context that groups related workflows while maintaining isolated state.

**Key Innovation**: Tracks solve the "scattered context" problem where related work across multiple sessions loses cohesion. By providing an explicit organizational layer, tracks enable:

- Resumable work streams across agent sessions
- Isolated context that prevents cross-contamination
- Coordinated multi-workflow execution toward a unified goal
- Progress tracking with checkpointing for long-running initiatives

---

## 1. Track Concept Definition

### 1.1 What is a Track?

A **track** is a named, bounded work context that:

1. **Groups related workflows** - Multiple workflows working toward a shared goal
2. **Maintains isolated context** - Artifacts, decisions, and state scoped to the track
3. **Persists across sessions** - Resumable work that survives context window limits
4. **Tracks progress** - Percentage completion, step status, and outcomes

**Track vs Workflow vs Run**:

| Concept      | Scope            | Lifetime         | Purpose                               |
| ------------ | ---------------- | ---------------- | ------------------------------------- |
| **Run**      | Single execution | Minutes to hours | Execute one workflow instance         |
| **Workflow** | Step sequence    | Defined by steps | Define agent coordination pattern     |
| **Track**    | Work initiative  | Days to weeks    | Group related workflows toward a goal |

### 1.2 Track Types

Based on schema definition, tracks support these categories:

| Type            | Description                           | Typical Duration | Example                        |
| --------------- | ------------------------------------- | ---------------- | ------------------------------ |
| `onboarding`    | New project setup and familiarization | 1-3 days         | Set up development environment |
| `feature`       | New feature implementation            | 3-14 days        | Add authentication system      |
| `bugfix`        | Bug investigation and resolution      | 1-5 days         | Fix login flow timeout         |
| `refactor`      | Code restructuring                    | 2-7 days         | Migrate to TypeScript          |
| `migration`     | System migration or upgrade           | 5-21 days        | Upgrade to Next.js 15          |
| `testing`       | Testing campaign                      | 2-7 days         | Integration test coverage      |
| `documentation` | Documentation effort                  | 1-5 days         | API documentation refresh      |
| `security`      | Security audit and fixes              | 3-14 days        | OWASP compliance remediation   |
| `performance`   | Performance optimization              | 3-10 days        | Core Web Vitals optimization   |
| `maintenance`   | Routine maintenance                   | 1-3 days         | Dependency updates             |
| `learning`      | Exploration and learning              | 1-7 days         | Evaluate new framework         |
| `exploration`   | Research and prototyping              | 1-14 days        | Spike on microservices         |
| `custom`        | User-defined category                 | Variable         | Custom workflow                |

### 1.3 Track Anatomy

```
track-authentication-feature
├── track.json              # Track definition and state
├── spec.md                 # Track specification (goals, criteria)
├── plan.md                 # Implementation plan with steps
├── metadata.json           # Track metadata (created, status)
├── index.md                # Navigation/entry point
├── context/
│   ├── decisions.json      # Key decisions made
│   ├── assumptions.json    # Working assumptions
│   └── learnings.json      # Lessons captured
├── workflows/
│   ├── run-001/           # First workflow run
│   ├── run-002/           # Second workflow run
│   └── ...
├── artifacts/
│   ├── project-brief.json
│   ├── prd.json
│   └── ...
└── checkpoints/
    ├── checkpoint-001.json
    └── ...
```

---

## 2. Track Lifecycle

### 2.1 Lifecycle State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
    ┌────────┐      │      ┌────────┐      ┌────────┐      ┌────────────┐
    │ draft  │──────┼─────▶│ ready  │─────▶│ active │─────▶│ completed  │
    └────────┘      │      └────────┘      └────────┘      └────────────┘
         │          │           │              │ │               │
         │          │           │              │ │               │
         ▼          │           ▼              ▼ │               ▼
    ┌────────────┐  │      ┌────────┐      ┌────────┐      ┌──────────┐
    │ cancelled  │◀─┼──────│ failed │◀─────│ paused │      │ archived │
    └────────────┘  │      └────────┘      └────────┘      └──────────┘
                    │                           │
                    │                           │ resume
                    │                           ▼
                    │                      ┌────────┐
                    └──────────────────────│ active │
                                           └────────┘
```

### 2.2 Lifecycle Stages

| Stage       | Description                              | Entry Condition            | Exit Transitions             |
| ----------- | ---------------------------------------- | -------------------------- | ---------------------------- |
| `draft`     | Track being defined                      | User creates track         | → ready, cancelled           |
| `ready`     | Specification complete, ready to execute | Spec validated             | → active, cancelled          |
| `active`    | Track actively executing workflows       | User starts track          | → paused, completed, failed  |
| `paused`    | Temporarily suspended                    | User pauses or timeout     | → active (resume), cancelled |
| `completed` | All success criteria met                 | All workflows done         | → archived                   |
| `failed`    | Unrecoverable error occurred             | Critical failure           | → draft (retry), cancelled   |
| `cancelled` | User cancelled track                     | User action                | → archived                   |
| `archived`  | Track archived for history               | Completion or cancellation | (terminal)                   |

### 2.3 Lifecycle Operations

#### 2.3.1 Create Track

```javascript
// track-manager.mjs create operation
async function createTrack(options) {
  const trackId = generateTrackId(options.name);

  // Validate track doesn't already exist with same name
  const existing = await findTrackByName(options.name);
  if (existing) {
    throw new TrackExistsError(`Track "${options.name}" already exists`);
  }

  const track = {
    track_id: trackId,
    name: options.name,
    type: options.type || 'feature',
    status: 'draft',
    priority: options.priority || 'P2',
    created_at: new Date().toISOString(),
    context: {
      goal: options.goal,
      success_criteria: options.successCriteria || [],
      target_files: options.targetFiles || [],
      prerequisites: options.prerequisites || [],
    },
    steps: [], // Populated from plan
    progress: {
      current_step: 0,
      completed_steps: 0,
      total_steps: 0,
      percentage: 0,
    },
    execution: {
      mode: options.mode || 'interactive',
      auto_advance: false,
      pause_on_failure: true,
    },
  };

  // Save track definition
  await saveTrack(track);

  // Initialize track directory structure
  await initializeTrackDirectory(trackId);

  return track;
}
```

#### 2.3.2 Activate Track

```javascript
// Activate track transitions from ready → active
async function activateTrack(trackId) {
  const track = await loadTrack(trackId);

  // Validate can activate
  if (track.status !== 'ready') {
    throw new InvalidStateError(`Cannot activate track in ${track.status} status`);
  }

  // Check prerequisites
  await validatePrerequisites(track.context.prerequisites);

  // Check if another track is active (single active track constraint)
  const activeTrack = await getActiveTrack();
  if (activeTrack && !options.force) {
    throw new ActiveTrackExistsError(
      `Track "${activeTrack.name}" is active. Use --force to override.`
    );
  }

  // Suspend other active track if force
  if (activeTrack && options.force) {
    await suspendTrack(activeTrack.track_id, 'Suspended for new track activation');
  }

  // Transition to active
  track.status = 'active';
  track.started_at = new Date().toISOString();

  // Update track registry
  await updateTrackRegistry(trackId, { status: 'active', started_at: track.started_at });

  // Save updated track
  await saveTrack(track);

  return track;
}
```

#### 2.3.3 Suspend/Resume Track

```javascript
// Suspend track (active → paused)
async function suspendTrack(trackId, reason) {
  const track = await loadTrack(trackId);

  if (track.status !== 'active') {
    throw new InvalidStateError(`Cannot suspend track in ${track.status} status`);
  }

  // Create checkpoint before suspending
  const checkpoint = await createCheckpoint(track);

  track.status = 'paused';
  track.paused_at = new Date().toISOString();
  track.pause_reason = reason;
  track.last_checkpoint = checkpoint.id;

  await saveTrack(track);
  await updateTrackRegistry(trackId, { status: 'paused' });

  return { track, checkpoint };
}

// Resume track (paused → active)
async function resumeTrack(trackId) {
  const track = await loadTrack(trackId);

  if (track.status !== 'paused') {
    throw new InvalidStateError(`Cannot resume track in ${track.status} status`);
  }

  // Check if another track is active
  const activeTrack = await getActiveTrack();
  if (activeTrack) {
    throw new ActiveTrackExistsError(`Track "${activeTrack.name}" is active. Suspend it first.`);
  }

  // Load checkpoint if available
  if (track.last_checkpoint) {
    await restoreFromCheckpoint(track.last_checkpoint);
  }

  track.status = 'active';
  track.resumed_at = new Date().toISOString();
  delete track.paused_at;
  delete track.pause_reason;

  await saveTrack(track);
  await updateTrackRegistry(trackId, { status: 'active' });

  return track;
}
```

#### 2.3.4 Complete Track

```javascript
// Complete track (active → completed)
async function completeTrack(trackId, outcomes) {
  const track = await loadTrack(trackId);

  if (track.status !== 'active') {
    throw new InvalidStateError(`Cannot complete track in ${track.status} status`);
  }

  // Validate success criteria
  const criteriaResults = await validateSuccessCriteria(track.context.success_criteria);
  const allMet = criteriaResults.every(r => r.met);

  if (!allMet && !options.force) {
    throw new CriteriaNotMetError('Not all success criteria met', criteriaResults);
  }

  track.status = 'completed';
  track.completed_at = new Date().toISOString();
  track.outcomes = {
    result: allMet ? 'success' : 'partial',
    artifacts_created: outcomes.artifactsCreated || [],
    files_modified: outcomes.filesModified || [],
    suggestions_generated: outcomes.suggestionsGenerated || [],
    next_tracks: outcomes.nextTracks || [],
    summary: outcomes.summary || '',
    lessons_learned: outcomes.lessonsLearned || [],
  };

  // Calculate metrics
  track.metrics = await calculateTrackMetrics(track);

  await saveTrack(track);
  await updateTrackRegistry(trackId, {
    status: 'completed',
    completed_at: track.completed_at,
    result: track.outcomes.result,
  });

  return track;
}
```

---

## 3. Context Isolation Strategy

### 3.1 Isolation Boundaries

Track context isolation ensures that:

1. **Artifacts are scoped** - Track artifacts don't pollute global space
2. **Decisions are preserved** - Track-specific decisions don't leak
3. **State is recoverable** - Track can resume without global context

```
Project Root
├── .claude/
│   ├── context/
│   │   ├── artifacts/          # Global artifacts (rare)
│   │   └── runtime/
│   │       └── runs/           # Global runs (track-less)
│   │
│   └── conductor/
│       └── tracks/
│           ├── track-registry.json    # Track index
│           │
│           ├── track-auth-feature/    # Track-scoped context
│           │   ├── track.json
│           │   ├── context/
│           │   │   ├── decisions.json
│           │   │   └── artifacts/
│           │   │       ├── project-brief.json
│           │   │       └── prd.json
│           │   └── workflows/
│           │       └── run-001/
│           │
│           └── track-perf-opt/        # Another track
│               ├── track.json
│               └── ...
```

### 3.2 Context Inheritance Model

Tracks inherit from project context but can override:

```
Project Context (CLAUDE.md, rules, config)
         │
         ▼
   Track Context (track.json, decisions, assumptions)
         │
         ▼
   Workflow Context (run.json, artifacts)
         │
         ▼
   Step Context (agent state, reasoning)
```

**Inheritance Rules**:

| Context Type         | Inheritance   | Override Allowed   |
| -------------------- | ------------- | ------------------ |
| Project rules        | Inherited     | No                 |
| Technology stack     | Inherited     | Track can extend   |
| Agent configurations | Inherited     | Track can override |
| Artifacts            | Not inherited | Track creates own  |
| Decisions            | Not inherited | Track-scoped       |

### 3.3 Context Isolation Implementation

```javascript
// Track context resolver
class TrackContextResolver {
  constructor(trackId) {
    this.trackId = trackId;
    this.trackDir = join(TRACKS_DIR, trackId);
  }

  // Resolve artifact path within track scope
  resolveArtifactPath(artifactName) {
    return join(this.trackDir, 'context', 'artifacts', artifactName);
  }

  // Resolve workflow run path within track
  resolveWorkflowPath(runId) {
    return join(this.trackDir, 'workflows', runId);
  }

  // Get track-scoped decisions
  async getDecisions() {
    const decisionsPath = join(this.trackDir, 'context', 'decisions.json');
    if (existsSync(decisionsPath)) {
      return JSON.parse(await readFile(decisionsPath, 'utf8'));
    }
    return [];
  }

  // Add decision to track context
  async addDecision(decision) {
    const decisions = await this.getDecisions();
    decisions.push({
      id: `decision-${decisions.length + 1}`,
      timestamp: new Date().toISOString(),
      ...decision,
    });

    const decisionsPath = join(this.trackDir, 'context', 'decisions.json');
    await writeFile(decisionsPath, JSON.stringify(decisions, null, 2));

    return decisions;
  }

  // Create isolated artifact registry for track
  async createTrackArtifactRegistry() {
    const registryPath = join(this.trackDir, 'artifact-registry.json');
    const registry = {
      track_id: this.trackId,
      artifacts: {},
      created_at: new Date().toISOString(),
    };

    await writeFile(registryPath, JSON.stringify(registry, null, 2));
    return registry;
  }
}
```

### 3.4 Cross-Track Artifact Sharing

When tracks need to share artifacts (rare but supported):

```javascript
// Share artifact from source track to target track
async function shareArtifact(sourceTrackId, targetTrackId, artifactName) {
  const sourceResolver = new TrackContextResolver(sourceTrackId);
  const targetResolver = new TrackContextResolver(targetTrackId);

  const sourcePath = sourceResolver.resolveArtifactPath(artifactName);
  const targetPath = targetResolver.resolveArtifactPath(`shared-${sourceTrackId}-${artifactName}`);

  // Create symlink or copy based on policy
  if (SHARING_POLICY === 'symlink') {
    await symlink(sourcePath, targetPath);
  } else {
    await copyFile(sourcePath, targetPath);
  }

  // Record sharing in both track registries
  await sourceResolver.recordArtifactShare(artifactName, targetTrackId);
  await targetResolver.recordArtifactReceived(artifactName, sourceTrackId);
}
```

---

## 4. Track-to-Workflow Mapping

### 4.1 Mapping Model

A track can contain multiple workflow executions:

```
Track (1) ─────────────▶ Workflow Definition (N)
    │                           │
    │                           │ instantiates
    │                           ▼
    └──────────────────▶ Workflow Run (N)
```

**Mapping Rules**:

1. **One track, multiple workflow types** - A feature track might use `greenfield-fullstack.yaml` for implementation and `code-quality-flow.yaml` for cleanup
2. **One track, multiple runs of same workflow** - Retry failed workflow or iterate on implementation
3. **Sequential or parallel runs** - Runs can execute sequentially or in parallel (with proper isolation)

### 4.2 Workflow Selection for Track Steps

Track steps map to workflow executions:

```yaml
# track-auth-feature/plan.md (excerpt)
steps:
  - step_id: step-001
    name: 'Design authentication architecture'
    type: action
    action:
      type: run-workflow
      workflow: .claude/workflows/greenfield-fullstack.yaml
      steps_to_run: [4] # Only System Architecture step

  - step_id: step-002
    name: 'Implement authentication'
    type: action
    action:
      type: run-workflow
      workflow: .claude/workflows/greenfield-fullstack.yaml
      steps_to_run: [7] # Only Implementation step

  - step_id: step-003
    name: 'Security review'
    type: action
    action:
      type: run-workflow
      workflow: .claude/workflows/greenfield-fullstack.yaml
      steps_to_run: [4.1] # Security Architecture Review
```

### 4.3 Track Step Executor

```javascript
// Execute a track step
async function executeTrackStep(trackId, stepId) {
  const track = await loadTrack(trackId);
  const step = track.steps.find(s => s.step_id === stepId);

  if (!step) {
    throw new StepNotFoundError(`Step ${stepId} not found in track ${trackId}`);
  }

  // Validate step can execute
  if (step.status !== 'pending' && step.status !== 'ready') {
    throw new InvalidStateError(`Step ${stepId} is ${step.status}, cannot execute`);
  }

  // Check dependencies
  await validateStepDependencies(track, step);

  // Update step status
  step.status = 'in-progress';
  step.timing = step.timing || {};
  step.timing.started_at = new Date().toISOString();
  await saveTrack(track);

  try {
    let result;

    switch (step.action.type) {
      case 'run-workflow':
        result = await executeWorkflowForTrack(track, step);
        break;

      case 'spawn-agent':
        result = await spawnAgentForTrack(track, step);
        break;

      case 'manual':
        result = await waitForManualCompletion(track, step);
        break;

      default:
        throw new Error(`Unknown action type: ${step.action.type}`);
    }

    // Update step with result
    step.status = 'completed';
    step.timing.completed_at = new Date().toISOString();
    step.outputs = result.outputs;

    // Update track progress
    await updateTrackProgress(track);

    await saveTrack(track);

    return { track, step, result };
  } catch (error) {
    // Handle step failure
    step.status = 'failed';
    step.timing.completed_at = new Date().toISOString();
    step.error = {
      message: error.message,
      code: error.code,
      occurred_at: new Date().toISOString(),
      recoverable: isRecoverableError(error),
    };

    if (track.execution.pause_on_failure) {
      track.status = 'paused';
      track.pause_reason = `Step ${stepId} failed: ${error.message}`;
    }

    await saveTrack(track);

    throw error;
  }
}

// Execute workflow within track context
async function executeWorkflowForTrack(track, step) {
  const trackResolver = new TrackContextResolver(track.track_id);

  // Create run within track
  const runId = await generateRunId(`${track.track_id}-${step.step_id}`);
  const runDir = trackResolver.resolveWorkflowPath(runId);

  // Initialize run with track context
  const run = await createRun(runId, {
    workflowId: track.track_id,
    selectedWorkflow: step.action.workflow,
    trackId: track.track_id,
    stepId: step.step_id,
  });

  // Execute workflow step(s)
  const workflowResult = await executeWorkflow(step.action.workflow, step.action.steps_to_run, {
    runId,
    trackContext: await trackResolver.getContext(),
    artifactDir: join(runDir, 'artifacts'),
  });

  // Register artifacts in track registry
  for (const artifact of workflowResult.artifacts) {
    await trackResolver.registerArtifact(artifact);
  }

  return workflowResult;
}
```

---

## 5. Track Registry Design

### 5.1 Registry Location

```
.claude/conductor/tracks/track-registry.json
```

### 5.2 Registry Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Track Registry",
  "type": "object",
  "required": ["version", "tracks", "metadata"],
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0"
    },
    "active_track": {
      "type": ["string", "null"],
      "description": "Currently active track ID (only one at a time)"
    },
    "tracks": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["track_id", "name", "type", "status", "created_at", "path"],
        "properties": {
          "track_id": { "type": "string" },
          "name": { "type": "string" },
          "type": { "type": "string" },
          "status": {
            "type": "string",
            "enum": [
              "draft",
              "ready",
              "active",
              "paused",
              "completed",
              "failed",
              "cancelled",
              "archived"
            ]
          },
          "priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
          "created_at": { "type": "string", "format": "date-time" },
          "updated_at": { "type": "string", "format": "date-time" },
          "started_at": { "type": "string", "format": "date-time" },
          "completed_at": { "type": "string", "format": "date-time" },
          "path": { "type": "string", "description": "Relative path to track directory" },
          "progress": {
            "type": "object",
            "properties": {
              "percentage": { "type": "number", "minimum": 0, "maximum": 100 },
              "completed_steps": { "type": "integer" },
              "total_steps": { "type": "integer" }
            }
          },
          "last_checkpoint": { "type": "string" },
          "workflow_runs": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "run_id": { "type": "string" },
                "workflow": { "type": "string" },
                "status": { "type": "string" },
                "started_at": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "total_tracks": { "type": "integer" },
        "active_count": { "type": "integer" },
        "completed_count": { "type": "integer" },
        "last_updated": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### 5.3 Sample Track Registry

```json
{
  "version": "1.0",
  "active_track": "track-auth-feature-20250115",
  "tracks": {
    "track-auth-feature-20250115": {
      "track_id": "track-auth-feature-20250115",
      "name": "Authentication Feature",
      "type": "feature",
      "status": "active",
      "priority": "P1",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T14:30:00Z",
      "started_at": "2025-01-15T10:15:00Z",
      "path": "track-auth-feature-20250115",
      "progress": {
        "percentage": 35,
        "completed_steps": 3,
        "total_steps": 8
      },
      "last_checkpoint": "checkpoint-003",
      "workflow_runs": [
        {
          "run_id": "track-auth-feature-20250115-step-001-abc123",
          "workflow": "greenfield-fullstack.yaml",
          "status": "completed",
          "started_at": "2025-01-15T10:15:00Z"
        }
      ]
    },
    "track-perf-optimization-20250110": {
      "track_id": "track-perf-optimization-20250110",
      "name": "Performance Optimization",
      "type": "performance",
      "status": "paused",
      "priority": "P2",
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2025-01-12T16:00:00Z",
      "started_at": "2025-01-10T09:30:00Z",
      "path": "track-perf-optimization-20250110",
      "progress": {
        "percentage": 60,
        "completed_steps": 5,
        "total_steps": 8
      },
      "last_checkpoint": "checkpoint-005"
    }
  },
  "metadata": {
    "total_tracks": 2,
    "active_count": 1,
    "completed_count": 0,
    "last_updated": "2025-01-15T14:30:00Z"
  }
}
```

### 5.4 Registry Operations

```javascript
class TrackRegistry {
  constructor() {
    this.registryPath = join(TRACKS_DIR, 'track-registry.json');
    this._cache = null;
    this._cacheTTL = 5000; // 5 seconds
    this._cacheTimestamp = 0;
  }

  // Load registry with caching
  async load() {
    const now = Date.now();
    if (this._cache && now - this._cacheTimestamp < this._cacheTTL) {
      return this._cache;
    }

    if (!existsSync(this.registryPath)) {
      return this._initializeRegistry();
    }

    const content = await readFile(this.registryPath, 'utf8');
    this._cache = JSON.parse(content);
    this._cacheTimestamp = now;

    return this._cache;
  }

  // Initialize empty registry
  async _initializeRegistry() {
    const registry = {
      version: '1.0',
      active_track: null,
      tracks: {},
      metadata: {
        total_tracks: 0,
        active_count: 0,
        completed_count: 0,
        last_updated: new Date().toISOString(),
      },
    };

    await this._save(registry);
    return registry;
  }

  // Save registry with atomic write
  async _save(registry) {
    registry.metadata.last_updated = new Date().toISOString();
    await atomicWrite(this.registryPath, JSON.stringify(registry, null, 2));
    this._cache = registry;
    this._cacheTimestamp = Date.now();
  }

  // Register new track
  async registerTrack(track) {
    const registry = await this.load();

    registry.tracks[track.track_id] = {
      track_id: track.track_id,
      name: track.name,
      type: track.type,
      status: track.status,
      priority: track.priority,
      created_at: track.created_at,
      updated_at: track.updated_at || track.created_at,
      path: track.track_id,
      progress: track.progress || { percentage: 0, completed_steps: 0, total_steps: 0 },
    };

    registry.metadata.total_tracks++;

    await this._save(registry);
    return registry;
  }

  // Update track in registry
  async updateTrack(trackId, updates) {
    const registry = await this.load();

    if (!registry.tracks[trackId]) {
      throw new TrackNotFoundError(`Track ${trackId} not found in registry`);
    }

    Object.assign(registry.tracks[trackId], updates);
    registry.tracks[trackId].updated_at = new Date().toISOString();

    // Update active track if status changed to active
    if (updates.status === 'active') {
      registry.active_track = trackId;
      registry.metadata.active_count = 1;
    } else if (updates.status === 'paused' || updates.status === 'completed') {
      if (registry.active_track === trackId) {
        registry.active_track = null;
        registry.metadata.active_count = 0;
      }
      if (updates.status === 'completed') {
        registry.metadata.completed_count++;
      }
    }

    await this._save(registry);
    return registry;
  }

  // Get active track
  async getActiveTrack() {
    const registry = await this.load();

    if (!registry.active_track) {
      return null;
    }

    return registry.tracks[registry.active_track];
  }

  // List tracks with optional filters
  async listTracks(filters = {}) {
    const registry = await this.load();
    let tracks = Object.values(registry.tracks);

    if (filters.status) {
      tracks = tracks.filter(t => t.status === filters.status);
    }

    if (filters.type) {
      tracks = tracks.filter(t => t.type === filters.type);
    }

    if (filters.priority) {
      tracks = tracks.filter(t => t.priority === filters.priority);
    }

    // Sort by updated_at descending
    tracks.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return tracks;
  }
}
```

---

## 6. Track Switching Behavior

### 6.1 Single Active Track Constraint

**Design Decision**: Only one track can be active at a time.

**Rationale**:

1. **Context clarity** - Prevents confusion about which track artifacts belong to
2. **Resource management** - Prevents competing workflows from conflicting
3. **Focus enforcement** - Encourages completion before switching
4. **Simpler state management** - Single source of active context

### 6.2 Track Switching Protocol

```javascript
async function switchTrack(fromTrackId, toTrackId, options = {}) {
  const registry = new TrackRegistry();

  // Step 1: Validate switch is allowed
  const fromTrack = await loadTrack(fromTrackId);
  const toTrack = await loadTrack(toTrackId);

  if (fromTrack.status !== 'active') {
    throw new InvalidStateError(`Cannot switch from track in ${fromTrack.status} status`);
  }

  if (toTrack.status !== 'paused' && toTrack.status !== 'ready') {
    throw new InvalidStateError(`Cannot switch to track in ${toTrack.status} status`);
  }

  // Step 2: Create checkpoint for current track
  const checkpoint = await createCheckpoint(fromTrack, {
    reason: `Switching to track ${toTrackId}`,
    includeWorkflowState: true,
  });

  // Step 3: Suspend current track
  await suspendTrack(fromTrackId, `Switched to ${toTrackId}`);

  // Step 4: Load checkpoint for target track (if resuming)
  if (toTrack.status === 'paused' && toTrack.last_checkpoint) {
    await restoreFromCheckpoint(toTrack.last_checkpoint);
  }

  // Step 5: Activate target track
  await activateTrack(toTrackId);

  // Step 6: Update registry
  await registry.updateTrack(fromTrackId, { status: 'paused' });
  await registry.updateTrack(toTrackId, { status: 'active' });

  return {
    suspended: fromTrackId,
    activated: toTrackId,
    checkpoint: checkpoint.id,
  };
}
```

### 6.3 Track Switching Commands

```bash
# Switch from current active track to another
node .claude/tools/track-manager.mjs switch --to track-perf-optimization

# Force switch (suspend active track without checkpoint)
node .claude/tools/track-manager.mjs switch --to track-perf-optimization --force

# List all tracks and their status
node .claude/tools/track-manager.mjs list

# Show current active track
node .claude/tools/track-manager.mjs current
```

---

## 7. Concurrency Model

### 7.1 Concurrency Constraint: Single Active Track

**Rule**: Only one track can have `status: 'active'` at any time.

**Enforcement**:

```javascript
// In track activation
async function activateTrack(trackId) {
  const registry = new TrackRegistry();

  // Atomic check-and-set using file lock
  const unlock = await acquireRegistryLock();

  try {
    const activeTrack = await registry.getActiveTrack();

    if (activeTrack && activeTrack.track_id !== trackId) {
      throw new ActiveTrackExistsError(
        `Track "${activeTrack.name}" is already active. ` +
          `Use 'track-manager.mjs switch' to switch tracks.`
      );
    }

    // Proceed with activation
    await registry.updateTrack(trackId, { status: 'active' });
  } finally {
    await unlock();
  }
}
```

### 7.2 Concurrent Workflow Runs Within Track

While only one track is active, a track can have multiple concurrent workflow runs:

```javascript
// Track execution configuration
const track = {
  execution: {
    mode: 'semi-autonomous',
    parallel_limit: 2, // Max 2 concurrent workflow runs
    auto_advance: true,
  },
};

// Parallel step execution
async function executeParallelSteps(track, steps) {
  const parallelLimit = track.execution.parallel_limit || 1;

  // Group steps that can run in parallel
  const parallelGroups = groupStepsByDependencies(steps);

  for (const group of parallelGroups) {
    // Execute group with parallelism limit
    await pLimit(parallelLimit)(
      group.map(step => () => executeTrackStep(track.track_id, step.step_id))
    );
  }
}
```

### 7.3 Race Condition Prevention

```javascript
// Registry lock for atomic operations
async function acquireRegistryLock(timeout = 5000) {
  const lockPath = join(TRACKS_DIR, 'track-registry.lock');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Exclusive create - fails if lock exists
      await writeFile(
        lockPath,
        JSON.stringify({
          pid: process.pid,
          timestamp: new Date().toISOString(),
        }),
        { flag: 'wx' }
      );

      // Lock acquired - return unlock function
      return async () => {
        try {
          await unlink(lockPath);
        } catch (e) {
          // Ignore unlock errors
        }
      };
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Lock exists - check if stale
        const lockStat = await stat(lockPath);
        if (Date.now() - lockStat.mtimeMs > 30000) {
          // Stale lock (>30s) - remove and retry
          await unlink(lockPath);
        } else {
          // Wait and retry
          await new Promise(r => setTimeout(r, 100));
        }
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to acquire registry lock within timeout');
}
```

---

## 8. Track Integration with Existing Systems

### 8.1 Integration with Run Manager

Tracks integrate with the existing `run-manager.mjs` by:

1. **Creating runs within track scope** - Runs are created in `track/workflows/` instead of global `runtime/runs/`
2. **Tracking run metadata** - Track registry records workflow runs
3. **Artifact registration** - Artifacts registered in track-scoped registry

```javascript
// Modified createRun to support track scope
export async function createRunForTrack(trackId, runId, options = {}) {
  const trackResolver = new TrackContextResolver(trackId);
  const runDir = trackResolver.resolveWorkflowPath(runId);

  // Create run directories within track
  await mkdir(runDir, { recursive: true });
  await mkdir(join(runDir, 'artifacts'), { recursive: true });
  await mkdir(join(runDir, 'reasoning'), { recursive: true });
  await mkdir(join(runDir, 'gates'), { recursive: true });

  const runRecord = {
    run_id: runId,
    track_id: trackId, // NEW: Track association
    workflow_id: options.workflowId || runId,
    selected_workflow: options.selectedWorkflow || '',
    current_step: 0,
    status: 'pending',
    created_at: new Date().toISOString(),
    // ... rest of run record
  };

  await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2));

  // Update track registry with new run
  const registry = new TrackRegistry();
  await registry.updateTrack(trackId, {
    workflow_runs: [
      ...(options.existingRuns || []),
      {
        run_id: runId,
        workflow: options.selectedWorkflow,
        status: 'pending',
        started_at: new Date().toISOString(),
      },
    ],
  });

  return runRecord;
}
```

### 8.2 Integration with State Manager

Tracks use state manager for context compression within track scope:

```javascript
// Track-scoped state manager
class TrackStateManager extends StateManager {
  constructor(trackId, runId) {
    super(runId);
    this.trackId = trackId;
    this.stateDir = join(TRACKS_DIR, trackId, 'workflows', runId);
  }

  // Override to include track context in handoffs
  handoff(fromAgent, toAgent, summary) {
    const state = super.handoff(fromAgent, toAgent, summary);

    // Add track context
    state.track_context = {
      track_id: this.trackId,
      track_decisions: this.getTrackDecisions(),
      track_progress: this.getTrackProgress(),
    };

    return state;
  }

  getTrackDecisions() {
    const trackResolver = new TrackContextResolver(this.trackId);
    return trackResolver.getDecisions();
  }

  getTrackProgress() {
    const track = loadTrackSync(this.trackId);
    return track.progress;
  }
}
```

### 8.3 Integration with Workflows

Workflows gain track awareness:

```yaml
# Modified workflow step with track support
- step: 1
  agent: developer
  inputs:
    - system-architecture.json (from step 4)
    - track-context.json (from track, if available) # NEW
  outputs:
    - dev-manifest.json
  track_aware: true # NEW: Agent receives track context
```

### 8.4 Integration with Orchestrator

Orchestrator uses tracks for work organization:

```javascript
// Orchestrator track-aware routing
async function routeUserRequest(request) {
  const registry = new TrackRegistry();

  // Check for active track
  const activeTrack = await registry.getActiveTrack();

  if (activeTrack) {
    // Route within active track context
    return {
      trackId: activeTrack.track_id,
      trackContext: await loadTrackContext(activeTrack.track_id),
      workflow: determineWorkflowForTrack(activeTrack, request),
    };
  }

  // No active track - determine if new track needed
  const needsTrack = analyzeRequestComplexity(request);

  if (needsTrack) {
    // Create new track for complex work
    const track = await createTrackFromRequest(request);
    return {
      trackId: track.track_id,
      trackContext: {},
      workflow: determineWorkflowForTrack(track, request),
    };
  }

  // Simple request - execute without track
  return {
    trackId: null,
    trackContext: null,
    workflow: determineStandaloneWorkflow(request),
  };
}
```

---

## 9. Checkpoint and Recovery

### 9.1 Checkpoint Structure

```json
{
  "checkpoint_id": "checkpoint-003",
  "track_id": "track-auth-feature-20250115",
  "created_at": "2025-01-15T14:30:00Z",
  "reason": "Manual checkpoint before risky refactor",

  "track_state": {
    "status": "active",
    "current_step": 4,
    "progress": {
      "percentage": 50,
      "completed_steps": 4,
      "total_steps": 8
    }
  },

  "workflow_states": [
    {
      "run_id": "run-001-abc123",
      "workflow": "greenfield-fullstack.yaml",
      "current_step": 7,
      "status": "completed"
    }
  ],

  "artifacts_snapshot": {
    "project-brief.json": {
      "path": "context/artifacts/project-brief.json",
      "checksum": "sha256:abc123..."
    },
    "prd.json": {
      "path": "context/artifacts/prd.json",
      "checksum": "sha256:def456..."
    }
  },

  "decisions": [
    { "id": "decision-1", "summary": "Use OAuth 2.0 for auth" },
    { "id": "decision-2", "summary": "PostgreSQL for user data" }
  ],

  "metadata": {
    "checkpoint_size_bytes": 15234,
    "artifact_count": 4,
    "created_by": "orchestrator"
  }
}
```

### 9.2 Checkpoint Operations

```javascript
// Create checkpoint
async function createCheckpoint(track, options = {}) {
  const checkpointId = `checkpoint-${String(Date.now()).slice(-6)}`;
  const checkpointDir = join(TRACKS_DIR, track.track_id, 'checkpoints');

  await mkdir(checkpointDir, { recursive: true });

  const checkpoint = {
    checkpoint_id: checkpointId,
    track_id: track.track_id,
    created_at: new Date().toISOString(),
    reason: options.reason || 'Manual checkpoint',

    track_state: {
      status: track.status,
      current_step: track.progress.current_step,
      progress: track.progress,
    },

    workflow_states: await captureWorkflowStates(track),
    artifacts_snapshot: await createArtifactsSnapshot(track),
    decisions: await getTrackDecisions(track.track_id),

    metadata: {
      created_by: options.createdBy || 'system',
    },
  };

  // Save checkpoint
  const checkpointPath = join(checkpointDir, `${checkpointId}.json`);
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

  // Update track with checkpoint reference
  track.last_checkpoint = checkpointId;
  await saveTrack(track);

  return checkpoint;
}

// Restore from checkpoint
async function restoreFromCheckpoint(checkpointId, trackId) {
  const checkpointPath = join(TRACKS_DIR, trackId, 'checkpoints', `${checkpointId}.json`);
  const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));

  // Validate checkpoint matches track
  if (checkpoint.track_id !== trackId) {
    throw new Error('Checkpoint track_id mismatch');
  }

  // Restore track state
  const track = await loadTrack(trackId);
  track.progress = checkpoint.track_state.progress;

  // Verify artifact integrity
  for (const [name, snapshot] of Object.entries(checkpoint.artifacts_snapshot)) {
    const artifactPath = join(TRACKS_DIR, trackId, snapshot.path);
    if (existsSync(artifactPath)) {
      const currentChecksum = await calculateChecksum(artifactPath);
      if (currentChecksum !== snapshot.checksum) {
        console.warn(`Artifact ${name} has changed since checkpoint`);
      }
    }
  }

  // Update step statuses based on checkpoint
  for (const step of track.steps) {
    if (step.order <= checkpoint.track_state.current_step) {
      step.status = 'completed';
    } else {
      step.status = 'pending';
    }
  }

  await saveTrack(track);

  return { track, checkpoint };
}
```

---

## 10. Track Manager CLI

### 10.1 Command Reference

```bash
# Track lifecycle commands
track-manager.mjs create --name "Auth Feature" --type feature --goal "Add OAuth"
track-manager.mjs ready --track-id track-auth-feature-20250115
track-manager.mjs activate --track-id track-auth-feature-20250115
track-manager.mjs pause --track-id track-auth-feature-20250115 --reason "Waiting for API"
track-manager.mjs resume --track-id track-auth-feature-20250115
track-manager.mjs complete --track-id track-auth-feature-20250115
track-manager.mjs cancel --track-id track-auth-feature-20250115

# Track navigation
track-manager.mjs list [--status active|paused|completed] [--type feature|bugfix]
track-manager.mjs current
track-manager.mjs show --track-id track-auth-feature-20250115
track-manager.mjs switch --to track-perf-optimization

# Track execution
track-manager.mjs step --track-id track-auth-feature-20250115 --step step-001
track-manager.mjs next --track-id track-auth-feature-20250115
track-manager.mjs retry --track-id track-auth-feature-20250115 --step step-003

# Checkpoints
track-manager.mjs checkpoint --track-id track-auth-feature-20250115 --reason "Pre-refactor"
track-manager.mjs restore --track-id track-auth-feature-20250115 --checkpoint checkpoint-003
track-manager.mjs list-checkpoints --track-id track-auth-feature-20250115

# Registry management
track-manager.mjs registry-sync
track-manager.mjs registry-validate
track-manager.mjs registry-stats
```

### 10.2 Example Usage Flows

**Flow 1: New Feature Track**

```bash
# 1. Create track
$ track-manager.mjs create --name "User Authentication" --type feature \
    --goal "Add OAuth 2.0 authentication with Google and GitHub providers"
Created track: track-user-authentication-20250115 (status: draft)

# 2. Review and mark ready
$ track-manager.mjs ready --track-id track-user-authentication-20250115
Track marked as ready for execution.

# 3. Activate track
$ track-manager.mjs activate --track-id track-user-authentication-20250115
Track activated. You are now working on: User Authentication

# 4. Execute steps
$ track-manager.mjs next
Executing step: Design authentication architecture
Running workflow: greenfield-fullstack.yaml (step 4)
...
Step completed. Progress: 1/8 (12.5%)

# 5. Continue work...
$ track-manager.mjs next
...
```

**Flow 2: Track Switching**

```bash
# 1. Check current track
$ track-manager.mjs current
Active track: User Authentication (12.5% complete)

# 2. View available tracks
$ track-manager.mjs list --status paused
TRACK_ID                         NAME                    STATUS   PROGRESS
track-perf-opt-20250110         Performance Optimization paused   60%
track-docs-update-20250108      Documentation Update     paused   80%

# 3. Switch to paused track
$ track-manager.mjs switch --to track-perf-opt-20250110
Created checkpoint for current track: checkpoint-004
Suspended: User Authentication
Restored checkpoint-005 for: Performance Optimization
Activated: Performance Optimization

# 4. Continue work on resumed track
$ track-manager.mjs next
Resuming step: Implement caching layer
...
```

---

## 11. Architecture Diagrams

### 11.1 Track System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Track System Architecture                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │  Track Manager  │────▶│  Track Registry │◀────│   Conductor   │ │
│  │    CLI/API      │     │    (JSON)       │     │  Integration  │ │
│  └────────┬────────┘     └────────┬────────┘     └───────────────┘ │
│           │                       │                                 │
│           ▼                       ▼                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │  Track Context  │────▶│  Run Manager    │◀────│   Workflow    │ │
│  │    Resolver     │     │  (Modified)     │     │   Executor    │ │
│  └────────┬────────┘     └────────┬────────┘     └───────────────┘ │
│           │                       │                                 │
│           ▼                       ▼                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │   Checkpoint    │────▶│  State Manager  │◀────│  Orchestrator │ │
│  │    Manager      │     │  (Modified)     │     │   (Enhanced)  │ │
│  └─────────────────┘     └─────────────────┘     └───────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Track Lifecycle Sequence Diagram

```
User        Orchestrator     TrackManager     TrackRegistry     Workflow
  │              │                │                │               │
  │──"new feature"──▶             │                │               │
  │              │                │                │               │
  │              │──createTrack()─▶                │               │
  │              │                │──register()───▶│               │
  │              │                │◀──trackId─────│               │
  │              │◀──track────────│                │               │
  │              │                │                │               │
  │              │──activateTrack()─▶              │               │
  │              │                │──setActive()──▶│               │
  │              │◀──active───────│                │               │
  │              │                │                │               │
  │              │──executeStep()─▶                │               │
  │              │                │────────────────────runWorkflow()─▶
  │              │                │◀───────────────────result───────│
  │              │                │──updateProgress()─▶             │
  │              │◀──stepResult───│                │               │
  │◀──progress───│                │                │               │
  │              │                │                │               │
```

### 11.3 Context Isolation Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       Project Context                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CLAUDE.md  │  .claude/rules/  │  .claude/config.yaml      │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                    │                     │              │
│         └────────────────────┼─────────────────────┘              │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   Track: Auth Feature                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │   │
│  │  │  track.json │  │ decisions   │  │ artifacts/  │        │   │
│  │  │  spec.md    │  │ assumptions │  │ PRD, arch   │        │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │   │
│  │         │                │                  │              │   │
│  │         └────────────────┼──────────────────┘              │   │
│  │                          ▼                                 │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │              Workflow Run: run-001                    │ │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │   │
│  │  │  │ run.json │  │ reasoning│  │ gates/   │           │ │   │
│  │  │  │ registry │  │ files    │  │ results  │           │ │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘           │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   Track: Perf Optimization (paused)        │   │
│  │  [Isolated context - no cross-contamination]               │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 12. Open Questions and Future Considerations

### 12.1 Open Questions

1. **Multi-track parallelism**: Should we ever allow multiple active tracks for independent work streams?
   - Current decision: No, single active track for simplicity
   - Future: Consider "background tracks" for independent automation

2. **Track templates**: Should there be reusable track templates for common patterns?
   - Current: Tracks are created ad-hoc
   - Future: Track templates in `.claude/conductor/track-templates/`

3. **Track dependencies**: How should inter-track dependencies be modeled?
   - Current: Prerequisites are track IDs
   - Future: Formal dependency graph with conflict detection

4. **Track merging**: Can two tracks be merged if work converges?
   - Current: Not supported
   - Future: Consider artifact merging and decision consolidation

5. **Track branching**: Can a track spawn sub-tracks?
   - Current: Not supported
   - Future: Consider hierarchical tracks for complex initiatives

### 12.2 Future Enhancements

1. **Track Analytics**: Metrics on track duration, success rates, common patterns
2. **Track Recommendations**: AI-suggested track types based on request analysis
3. **Track History Browser**: UI for exploring completed tracks and outcomes
4. **Track Import/Export**: Share track definitions between projects
5. **Track Hooks**: Custom pre/post hooks for track lifecycle events

---

## 13. Reasoning Artifact

```json
{
  "assumptions": [
    "Single active track constraint provides clarity over parallelism",
    "Tracks persist across multiple Claude sessions via file-based state",
    "Workflow executions within tracks inherit track context",
    "Checkpoints provide sufficient state for reliable resume",
    "Track registry scales to hundreds of tracks without performance issues"
  ],
  "decision_criteria": [
    "Context isolation prevents cross-contamination between work streams",
    "Lifecycle states cover all meaningful track transitions",
    "Integration with existing run-manager minimizes code changes",
    "CLI provides complete track management without requiring GUI",
    "Checkpoint strategy enables reliable work resume across sessions",
    "Registry design supports efficient queries and updates",
    "Concurrency model prevents race conditions in track operations"
  ],
  "tradeoffs": [
    "Single active track limits parallelism but ensures focus",
    "File-based registry requires locking but avoids database dependency",
    "Comprehensive checkpoints increase storage but improve recoverability"
  ],
  "open_questions": [
    "Should track templates be a first-class concept?",
    "How to handle track dependencies across projects?",
    "What metrics should drive track health scoring?",
    "Should tracks support hierarchical sub-tracks?",
    "How to handle track archival and cleanup policies?"
  ],
  "final_decision": "The track system provides higher-level work organization through isolated contexts, explicit lifecycle management, and coordinated workflow execution. Single active track constraint ensures focus while checkpointing enables reliable resume. Integration with existing run-manager and state-manager minimizes implementation complexity while providing comprehensive track capabilities."
}
```

---

## 14. Version History

| Version | Date       | Author  | Changes                     |
| ------- | ---------- | ------- | --------------------------- |
| 1.0.0   | 2025-01-15 | Winston | Initial architecture design |

---

## Related Documents

- **Schema**: `.claude/schemas/track.schema.json`
- **Workflow Guide**: `.claude/workflows/WORKFLOW-GUIDE.md`
- **Run Manager**: `.claude/tools/run-manager.mjs`
- **State Manager**: `.claude/tools/state-manager.mjs`
- **Conductor Integration**: `.claude/conductor/`
