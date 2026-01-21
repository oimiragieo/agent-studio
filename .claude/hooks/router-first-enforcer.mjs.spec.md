# Router-First Enforcer Hook Specification

**Version**: 1.0.0
**Status**: Specification (Ready for Implementation)
**Author**: Winston (Architect)
**Created**: 2026-01-16

---

## Overview

This document provides the detailed specification for `router-first-enforcer.mjs`, a PreToolUse hook that enforces the router-first architecture by blocking tool calls until the router agent has classified the user request.

---

## Hook Metadata

| Property      | Value                                     |
| ------------- | ----------------------------------------- |
| **File Name** | `router-first-enforcer.mjs`               |
| **Hook Type** | PreToolUse                                |
| **Priority**  | 100 (highest)                             |
| **Timeout**   | 2000ms                                    |
| **Fail-Safe** | Fail-open (ALLOW on errors)               |
| **Location**  | `.claude/hooks/router-first-enforcer.mjs` |

---

## API Specification

### Input (Hook receives from Claude Code)

```typescript
interface HookInput {
  tool_name: string; // Name of tool being called
  tool_input: Record<string, unknown>; // Tool parameters
  context?: {
    agent_name?: string; // Current agent name
    agent_role?: string; // Current agent role
    session_id?: string; // Claude session identifier
  };
}
```

### Output (Hook returns to Claude Code)

```typescript
interface HookOutput {
  decision: 'approve' | 'block';
  reason?: string; // Human-readable reason (required if blocked)
  warning?: string; // Non-blocking warning message
  metadata?: {
    routing_status: 'pending' | 'in_progress' | 'completed' | 'bypassed';
    enforcement_version: string;
    decision_time_ms: number;
  };
}
```

---

## Session State Schema

### File Location

```
.claude/context/tmp/routing-session-state.json
```

### Schema Structure

```typescript
interface RoutingSessionState {
  // Session identification
  session_id: string; // Unique session identifier
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  expires_at: string; // ISO 8601 timestamp

  // Routing status
  routing: {
    completed: boolean; // Has router finished classification?
    started_at: string | null; // When router started (ISO 8601)
    completed_at: string | null; // When router completed (ISO 8601)

    // Router classification result
    decision: {
      intent: string; // web_app, script, analysis, etc.
      complexity: 'low' | 'medium' | 'high';
      cloud_provider: 'gcp' | 'aws' | 'azure' | null;
      workflow_selection: string; // Workflow file path
      confidence: number; // 0.0 to 1.0
      reasoning: string; // Router's reasoning
      keywords_detected: string[]; // Matched keywords
      should_escalate: boolean; // Escalate to orchestrator?
      escalation_target: string | null;
    } | null;
  };

  // Audit trail
  routing_history: Array<{
    timestamp: string;
    decision: RoutingSessionState['routing']['decision'];
    request_summary: string;
  }>;

  // Performance metrics
  metrics: {
    routing_duration_ms: number | null;
    tokens_used: { input: number; output: number } | null;
    model: string | null;
  };

  // State management
  version: number; // Incremented on each write
  last_compact_ms: number; // Last compaction timestamp
}
```

### Initial State (New Session)

```json
{
  "session_id": "sess_1705420800000",
  "created_at": "2026-01-16T12:00:00.000Z",
  "updated_at": "2026-01-16T12:00:00.000Z",
  "expires_at": "2026-01-16T12:30:00.000Z",
  "routing": {
    "completed": false,
    "started_at": null,
    "completed_at": null,
    "decision": null
  },
  "routing_history": [],
  "metrics": {
    "routing_duration_ms": null,
    "tokens_used": null,
    "model": null
  },
  "version": 1,
  "last_compact_ms": 1705420800000
}
```

### State After Routing Completes

```json
{
  "session_id": "sess_1705420800000",
  "created_at": "2026-01-16T12:00:00.000Z",
  "updated_at": "2026-01-16T12:00:00.150Z",
  "expires_at": "2026-01-16T12:30:00.000Z",
  "routing": {
    "completed": true,
    "started_at": "2026-01-16T12:00:00.050Z",
    "completed_at": "2026-01-16T12:00:00.150Z",
    "decision": {
      "intent": "web_app",
      "complexity": "high",
      "cloud_provider": "gcp",
      "workflow_selection": "@.claude/workflows/greenfield-fullstack.yaml",
      "confidence": 0.95,
      "reasoning": "User wants enterprise web application with GCP",
      "keywords_detected": ["enterprise", "web application", "google cloud"],
      "should_escalate": true,
      "escalation_target": "master-orchestrator"
    }
  },
  "routing_history": [
    {
      "timestamp": "2026-01-16T12:00:00.150Z",
      "decision": { "...same as routing.decision..." },
      "request_summary": "Build enterprise web app with GCP"
    }
  ],
  "metrics": {
    "routing_duration_ms": 100,
    "tokens_used": { "input": 250, "output": 150 },
    "model": "haiku"
  },
  "version": 2,
  "last_compact_ms": 1705420800150
}
```

---

## Logic Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ROUTER-FIRST-ENFORCER.MJS                              │
│                          DECISION FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ 1. Read stdin (input) │
                        └───────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ 2. Parse JSON input   │
                        │    - tool_name        │
                        │    - tool_input       │
                        │    - context          │
                        └───────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 3. Check bypass environment   │
                    │    CLAUDE_ROUTER_BYPASS=true? │
                    └───────────────────────────────┘
                            │           │
                       YES ─┘           └─ NO
                            │           │
                            ▼           │
                    ┌───────────────┐   │
                    │ Return ALLOW  │   │
                    │ (bypass mode) │   │
                    └───────────────┘   │
                                        ▼
                    ┌───────────────────────────────┐
                    │ 4. Check if agent IS router   │
                    │    context.agent_name ==      │
                    │    "router" ?                 │
                    └───────────────────────────────┘
                            │           │
                       YES ─┘           └─ NO
                            │           │
                            ▼           │
                    ┌───────────────┐   │
                    │ Return ALLOW  │   │
                    │ (router runs) │   │
                    │ Mark: started │   │
                    └───────────────┘   │
                                        ▼
                    ┌───────────────────────────────┐
                    │ 5. Load session state         │
                    │    .claude/context/tmp/       │
                    │    routing-session-state.json │
                    └───────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     File exists?         File missing
                          │                   │
                          ▼                   ▼
                ┌─────────────────┐  ┌─────────────────────┐
                │ Parse JSON      │  │ Create initial      │
                │ Validate schema │  │ session state       │
                └─────────────────┘  │ routing.completed   │
                          │          │ = false             │
                          │          └─────────────────────┘
                          │                   │
                          └─────────┬─────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 6. Check routing.completed    │
                    └───────────────────────────────┘
                            │           │
                       TRUE ┘           └ FALSE
                            │           │
                            ▼           │
                    ┌───────────────┐   │
                    │ Return ALLOW  │   │
                    │ (routed OK)   │   │
                    └───────────────┘   │
                                        ▼
                    ┌───────────────────────────────┐
                    │ 7. BLOCK: Router not run yet  │
                    │    Return detailed guidance   │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Output:                       │
                    │ {                             │
                    │   "decision": "block",        │
                    │   "reason": "Router must      │
                    │     classify request first.   │
                    │     Please ensure router      │
                    │     agent runs before other   │
                    │     operations."              │
                    │ }                             │
                    └───────────────────────────────┘
```

---

## Error Handling Strategy

### Error Categories and Responses

| Error Type                  | Action      | Response                                                     |
| --------------------------- | ----------- | ------------------------------------------------------------ |
| **stdin read timeout**      | Fail-open   | `{ decision: "approve", warning: "Hook timeout" }`           |
| **Invalid JSON input**      | Fail-open   | `{ decision: "approve", warning: "Invalid input JSON" }`     |
| **State file read error**   | Fail-open   | `{ decision: "approve", warning: "State read error" }`       |
| **State file parse error**  | Reset state | Create new state, allow router                               |
| **State file write error**  | Log warning | Continue, don't block                                        |
| **Schema validation error** | Reset state | Create new state, allow router                               |
| **Unexpected exception**    | Fail-open   | `{ decision: "approve", warning: "Hook error: ${message}" }` |

### Fail-Open Rationale

The hook uses fail-open behavior (ALLOW on errors) because:

1. **User experience**: Blocking on errors would frustrate users
2. **Debugging**: Easier to debug with logs than with broken workflows
3. **Recovery**: System can self-heal on next request
4. **Precedent**: Consistent with orchestrator-enforcement-pre-tool.mjs

### Logging on Errors

All errors are logged to:

- `stderr` (console): Immediate visibility
- `.claude/context/logs/router-enforcement-errors.log`: Audit trail

Log format:

```json
{
  "timestamp": "2026-01-16T12:00:00.000Z",
  "error_type": "STATE_PARSE_ERROR",
  "error_message": "Unexpected token at position 42",
  "tool_name": "Read",
  "decision": "approve",
  "recovery_action": "reset_state"
}
```

---

## Test Scenarios

### Scenario 1: First Request in New Session (Router Needed)

**Setup**: No session state file exists
**Input**:

```json
{
  "tool_name": "Read",
  "tool_input": { "file_path": "/some/file.ts" },
  "context": { "agent_name": "developer" }
}
```

**Expected Output**:

```json
{
  "decision": "block",
  "reason": "╔═══════════════════════════════════════════════════════════════════╗\n║  ROUTER-FIRST ENFORCEMENT - REQUEST MUST BE ROUTED               ║\n╠═══════════════════════════════════════════════════════════════════╣\n║  Your request has not been classified by the router agent yet.   ║\n║  All requests must be routed before processing can begin.        ║\n║                                                                   ║\n║  What to do:                                                      ║\n║  1. Send your request to the system normally                      ║\n║  2. The router will classify it automatically                     ║\n║  3. Then your request will be processed                           ║\n╚═══════════════════════════════════════════════════════════════════╝"
}
```

### Scenario 2: Router Agent Running

**Setup**: Session state exists, routing.completed = false
**Input**:

```json
{
  "tool_name": "Read",
  "tool_input": { "file_path": "/workflow.yaml" },
  "context": { "agent_name": "router" }
}
```

**Expected Output**:

```json
{
  "decision": "approve",
  "metadata": {
    "routing_status": "in_progress",
    "enforcement_version": "1.0.0",
    "decision_time_ms": 5
  }
}
```

**Side Effect**: Update session state with `routing.started_at`

### Scenario 3: Routing Completed (Normal Operation)

**Setup**: Session state exists, routing.completed = true
**Input**:

```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/output.ts", "content": "..." },
  "context": { "agent_name": "developer" }
}
```

**Expected Output**:

```json
{
  "decision": "approve",
  "metadata": {
    "routing_status": "completed",
    "enforcement_version": "1.0.0",
    "decision_time_ms": 3
  }
}
```

### Scenario 4: Bypass Mode Enabled

**Setup**: Environment variable `CLAUDE_ROUTER_BYPASS=true`
**Input**:

```json
{
  "tool_name": "Read",
  "tool_input": { "file_path": "/any/file.ts" },
  "context": { "agent_name": "developer" }
}
```

**Expected Output**:

```json
{
  "decision": "approve",
  "metadata": {
    "routing_status": "bypassed",
    "enforcement_version": "1.0.0",
    "decision_time_ms": 1
  }
}
```

### Scenario 5: Corrupted Session State

**Setup**: Session state file contains invalid JSON
**Input**:

```json
{
  "tool_name": "Read",
  "tool_input": { "file_path": "/file.ts" },
  "context": { "agent_name": "developer" }
}
```

**Expected Output**:

```json
{
  "decision": "block",
  "reason": "Router must classify request first. (State was reset due to corruption.)",
  "warning": "Session state was corrupted and has been reset."
}
```

**Side Effect**: Create fresh session state file

### Scenario 6: Hook Timeout

**Setup**: Hook execution exceeds 2000ms
**Input**: Any valid input
**Expected Output**:

```json
{
  "decision": "approve",
  "warning": "Hook timeout - allowing request"
}
```

### Scenario 7: Task Tool by Orchestrator After Routing

**Setup**: routing.completed = true, agent is master-orchestrator
**Input**:

```json
{
  "tool_name": "Task",
  "tool_input": { "prompt": "...", "subagent_type": "developer" },
  "context": { "agent_name": "master-orchestrator" }
}
```

**Expected Output**:

```json
{
  "decision": "approve",
  "metadata": {
    "routing_status": "completed",
    "enforcement_version": "1.0.0",
    "decision_time_ms": 4
  }
}
```

---

## Implementation Pseudocode

```javascript
#!/usr/bin/env node
/**
 * Router-First Enforcer Hook (PreToolUse)
 *
 * Enforces that all requests must be routed through the router agent
 * before any other agent can operate. This prevents direct agent
 * invocations that bypass the routing architecture.
 *
 * Fail-Safe: Fail-open (ALLOW) on any unexpected error
 * Performance Target: <50ms execution time
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SESSION_STATE_PATH = join(__dirname, '..', 'context', 'tmp', 'routing-session-state.json');
const ENFORCEMENT_VERSION = '1.0.0';
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours (sliding)

// Prevent double-response
let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // Fail-open: do nothing
  }
}

// Timeout protection (2 seconds)
const timeout = setTimeout(() => {
  safeRespond({ decision: 'approve', warning: 'Hook timeout' });
  process.exit(0);
}, 2000);

// Check bypass environment variable
function isBypassEnabled() {
  return process.env.CLAUDE_ROUTER_BYPASS === 'true';
}

// Check if agent is the router
function isRouterAgent(context) {
  const agentName = context?.agent_name?.toLowerCase() || '';
  const agentRole = context?.agent_role?.toLowerCase() || '';
  return agentName === 'router' || agentRole === 'router';
}

// Load session state from disk
function loadSessionState() {
  try {
    if (!existsSync(SESSION_STATE_PATH)) {
      return null;
    }
    const content = readFileSync(SESSION_STATE_PATH, 'utf-8');
    const state = JSON.parse(content);

    // Check expiration
    if (state.expires_at && new Date(state.expires_at) < new Date()) {
      return null; // Expired
    }

    return state;
  } catch {
    return null;
  }
}

// Create initial session state
function createInitialState() {
  const now = new Date();
  return {
    session_id: `sess_${Date.now()}`,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TIMEOUT_MS).toISOString(),
    routing: {
      completed: false,
      started_at: null,
      completed_at: null,
      decision: null,
    },
    routing_history: [],
    metrics: {
      routing_duration_ms: null,
      tokens_used: null,
      model: null,
    },
    version: 1,
    last_compact_ms: Date.now(),
  };
}

// Save session state
function saveSessionState(state) {
  try {
    const dir = dirname(SESSION_STATE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    state.updated_at = new Date().toISOString();
    state.version = (state.version || 0) + 1;
    writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
  } catch {
    // Fail silently - don't block on write errors
  }
}

// Generate block message
function generateBlockMessage() {
  return `
╔═══════════════════════════════════════════════════════════════════╗
║  ROUTER-FIRST ENFORCEMENT - REQUEST MUST BE ROUTED               ║
╠═══════════════════════════════════════════════════════════════════╣
║  Your request has not been classified by the router agent yet.   ║
║  All requests must be routed before processing can begin.        ║
║                                                                   ║
║  What to do:                                                      ║
║  1. Send your request to the system normally                      ║
║  2. The router will classify it automatically                     ║
║  3. Then your request will be processed                           ║
╚═══════════════════════════════════════════════════════════════════╝
  `.trim();
}

// Main execution
async function main() {
  const startTime = Date.now();

  // Read stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf-8');

  // Parse input
  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    safeRespond({ decision: 'approve', warning: 'Invalid input JSON' });
    return;
  }

  const { tool_name, tool_input, context } = hookInput;

  // Check bypass mode
  if (isBypassEnabled()) {
    safeRespond({
      decision: 'approve',
      metadata: {
        routing_status: 'bypassed',
        enforcement_version: ENFORCEMENT_VERSION,
        decision_time_ms: Date.now() - startTime,
      },
    });
    return;
  }

  // Check if this IS the router agent
  if (isRouterAgent(context)) {
    // Load or create state
    let state = loadSessionState() || createInitialState();

    // Mark routing as started
    if (!state.routing.started_at) {
      state.routing.started_at = new Date().toISOString();
      saveSessionState(state);
    }

    safeRespond({
      decision: 'approve',
      metadata: {
        routing_status: 'in_progress',
        enforcement_version: ENFORCEMENT_VERSION,
        decision_time_ms: Date.now() - startTime,
      },
    });
    return;
  }

  // Load session state
  const state = loadSessionState();

  // No state or routing not completed -> BLOCK
  if (!state || !state.routing?.completed) {
    // Create initial state if missing
    if (!state) {
      saveSessionState(createInitialState());
    }

    safeRespond({
      decision: 'block',
      reason: generateBlockMessage(),
      metadata: {
        routing_status: 'pending',
        enforcement_version: ENFORCEMENT_VERSION,
        decision_time_ms: Date.now() - startTime,
      },
    });
    return;
  }

  // Routing completed -> ALLOW
  safeRespond({
    decision: 'approve',
    metadata: {
      routing_status: 'completed',
      enforcement_version: ENFORCEMENT_VERSION,
      decision_time_ms: Date.now() - startTime,
    },
  });
}

// Execute with error handling
main()
  .catch(error => {
    safeRespond({ decision: 'approve', warning: `Hook error: ${error.message}` });
  })
  .finally(() => {
    clearTimeout(timeout);
  });
```

---

## Integration with Router Agent

### Router Output Hook (PostToolUse)

After the router agent completes classification, a PostToolUse hook must capture the routing decision and update session state:

**File**: `router-completion-handler.mjs` (PostToolUse)

```javascript
// Triggered after router agent completes
// Parses router's JSON output and updates session state

async function main() {
  const { tool_name, tool_result, context } = hookInput;

  // Only handle router completions
  if (!isRouterAgent(context)) return;

  // Parse router's classification output
  const decision = parseRouterOutput(tool_result);

  // Update session state
  const state = loadSessionState();
  state.routing.completed = true;
  state.routing.completed_at = new Date().toISOString();
  state.routing.decision = decision;
  state.routing_history.push({
    timestamp: new Date().toISOString(),
    decision,
    request_summary: extractRequestSummary(tool_result),
  });

  saveSessionState(state);
}
```

### Router Agent Configuration

The router agent must be configured to:

1. Output JSON with routing decision
2. Include all required fields (intent, complexity, workflow_selection, confidence)
3. Set `should_escalate: true` for orchestrator delegation

---

## Performance Targets

| Metric               | Target | Maximum | Measurement             |
| -------------------- | ------ | ------- | ----------------------- |
| Total hook execution | <10ms  | 50ms    | `Date.now()` diff       |
| State file read      | <5ms   | 20ms    | `performance.now()`     |
| State file write     | <5ms   | 20ms    | `performance.now()`     |
| JSON parse time      | <1ms   | 5ms     | `performance.now()`     |
| Memory usage         | <10MB  | 20MB    | `process.memoryUsage()` |

### Optimization Strategies

1. **In-memory cache**: Cache state for same-session calls
2. **Async writes**: Write state asynchronously when non-critical
3. **Minimal JSON**: Keep state structure small
4. **Early exits**: Return ALLOW fast for bypass/router cases

---

## Deployment Checklist

- [ ] Create `router-first-enforcer.mjs` in `.claude/hooks/`
- [ ] Create `routing-session-state.schema.json` in `.claude/schemas/`
- [ ] Register hook in `.claude/settings.json` with priority 100
- [ ] Add `routing` section to `.claude/config.yaml`
- [ ] Update router agent to output routing decision JSON
- [ ] Create `router-completion-handler.mjs` PostToolUse hook
- [ ] Add unit tests in `.claude/hooks/router-first-enforcer.test.mjs`
- [ ] Add integration tests
- [ ] Update CLAUDE.md with routing rules
- [ ] Create troubleshooting documentation

---

## Version History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0.0   | 2026-01-16 | Initial specification |
