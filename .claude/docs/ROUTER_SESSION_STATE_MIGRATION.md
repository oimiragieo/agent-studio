# Router Session State Migration Guide

## Overview

Step 1.5 updates `session-state.mjs` to support router sessions with model tracking, session metrics, and cost persistence.

**Migration Required**: Existing sessions will continue to work, but new fields will be added on next update.

---

## Changes Summary

### New Fields Added

All sessions now include:

```javascript
{
  // Existing fields (unchanged)
  session_id: string,
  agent_role: string,
  read_count: number,
  violations: array,
  files_read: array,
  created_at: string,
  updated_at: string, // NEW: Last update timestamp

  // NEW: Model tracking
  model: string, // Currently active model
  modelHistory: [
    {
      model: string,
      timestamp: string,
      reason: string // 'initial_session' | 'model_switch' | 'escalation_complexity'
    }
  ],

  // NEW: Router-specific metrics
  routingDecisions: {
    total: number,
    simpleHandled: number,
    routedToOrchestrator: number,
    averageComplexity: number, // 0.0-1.0
    averageConfidence: number  // 0.0-1.0
  },

  // NEW: Cost tracking
  costs: {
    haiku: { inputTokens: number, outputTokens: number, costUSD: number },
    sonnet: { inputTokens: number, outputTokens: number, costUSD: number },
    opus: { inputTokens: number, outputTokens: number, costUSD: number },
    total: number
  },

  // NEW: Optional fields
  initial_prompt: string | null, // Router sessions only
  metadata: object // Extensible metadata
}
```

### New Functions Added

**Router-Specific**:

- `recordRoutingDecision(sessionId, decision)` - Track routing decisions
- `updateModelUsage(sessionId, model, inputTokens, outputTokens)` - Track costs
- `getSessionCosts(sessionId)` - Get cost breakdown
- `getRoutingMetrics(sessionId)` - Get routing metrics

**Utility Functions**:

- `listSessions()` - List all active sessions
- `cleanupOldSessions()` - Remove sessions older than 24 hours

### Updated Functions

- `initSession(sessionId, agentRole, metadata)` - Now accepts `metadata` parameter
- `loadSessionState(sessionId)` - Now handles both router and orchestrator sessions
- `updateSessionState(sessionId, updates)` - Now includes `updated_at` timestamp

---

## Migration Steps

### For Existing Orchestrator Sessions

**No migration required**. Existing orchestrator sessions will continue to work.

New fields will be automatically added on first update:

```javascript
// Existing orchestrator session will gain:
// - model (from settings)
// - modelHistory (initialized)
// - routingDecisions (initialized to 0)
// - costs (initialized to 0)
// - updated_at (set on update)
```

### For New Router Sessions

Create router sessions using the new API:

```javascript
import { initSession } from './.claude/tools/session-state.mjs';

// Initialize router session
const session = initSession('router-123', 'router', {
  initialPrompt: 'User initial prompt',
  model: 'claude-3-5-haiku-20241022', // Optional, defaults from settings
});

// Session is ready to use
console.log(session.session_id); // 'router-123'
console.log(session.model); // 'claude-3-5-haiku-20241022'
```

### Backward Compatibility

All existing code continues to work:

```javascript
// Old API (still works)
const state = initSession('orchestrator');

// New API (recommended)
const state = initSession('sess-123', 'router', {
  initialPrompt: 'Build a web app',
});
```

---

## Cost Tracking Integration

### Using with router-session-handler.mjs

The `router-session-handler.mjs` already calls `updateModelUsage()`:

```javascript
import { trackCosts } from './router-session-handler.mjs';

// In router-session-handler.mjs (already implemented):
export async function trackCosts(sessionId, modelUsed, inputTokens, outputTokens) {
  // Calls session-state.mjs internally
  const costSummary = updateModelUsage(sessionId, modelUsed, inputTokens, outputTokens);
  return costSummary;
}
```

### Manual Cost Tracking

For custom integrations:

```javascript
import { updateModelUsage, getSessionCosts } from './.claude/tools/session-state.mjs';

// Track model usage
const costSummary = updateModelUsage(
  'router-123',
  'claude-3-5-haiku-20241022',
  1000, // input tokens
  500 // output tokens
);

console.log(costSummary);
// {
//   inputTokens: 1000,
//   outputTokens: 500,
//   costUSD: 0.0035,
//   model: 'claude-3-5-haiku-20241022',
//   modelCategory: 'haiku'
// }

// Get total costs
const costs = getSessionCosts('router-123');
console.log(costs.costs.total); // 0.0035
```

---

## Routing Metrics Integration

### Recording Routing Decisions

```javascript
import { recordRoutingDecision, getRoutingMetrics } from './.claude/tools/session-state.mjs';

// Record simple routing
recordRoutingDecision('router-123', {
  type: 'simple',
  complexity: 0.3,
  confidence: 0.9,
  workflow: null,
});

// Record orchestrator routing
recordRoutingDecision('router-123', {
  type: 'orchestrator',
  complexity: 0.8,
  confidence: 0.95,
  workflow: '@.claude/workflows/greenfield-fullstack.yaml',
});

// Get metrics
const metrics = getRoutingMetrics('router-123');
console.log(metrics.metrics);
// {
//   total: 2,
//   simpleHandled: 1,
//   routedToOrchestrator: 1,
//   averageComplexity: 0.55,
//   averageConfidence: 0.925
// }
```

---

## File Locking and Concurrency

### Atomic Writes

All session writes use atomic file operations with locking:

```javascript
// Internal implementation (no action required)
// - Acquires file lock before writing
// - Writes to .tmp file
// - Atomically renames to final file
// - Releases lock
// - Handles stale locks (5 second timeout)
```

### Concurrent Access

Safe for concurrent access:

```javascript
// Multiple processes can safely update same session
await updateModelUsage('router-123', 'haiku', 100, 50);
await recordRoutingDecision('router-123', { type: 'simple', complexity: 0.3, confidence: 0.9 });
```

---

## Session Storage Locations

### Orchestrator Sessions

**Location**: `.claude/context/tmp/orchestrator-session-state.json`

**Usage**:

```javascript
// Load orchestrator session (no ID required)
const state = loadSessionState();

// Or use explicit ID
const state = loadSessionState('orchestrator');
```

### Router Sessions

**Location**: `.claude/context/sessions/<session-id>.json`

**Usage**:

```javascript
// Load router session (ID required)
const state = loadSessionState('router-123');
```

---

## CLI Usage

### New Commands

```bash
# Initialize router session
node .claude/tools/session-state.mjs init router-123 router

# Get cost breakdown
node .claude/tools/session-state.mjs costs router-123

# Get routing metrics
node .claude/tools/session-state.mjs metrics router-123

# List all sessions
node .claude/tools/session-state.mjs list

# Clean up old sessions (>24h)
node .claude/tools/session-state.mjs cleanup
```

### Existing Commands (Unchanged)

```bash
# Initialize orchestrator session
node .claude/tools/session-state.mjs init

# Reset read counter
node .claude/tools/session-state.mjs reset

# Get compliance summary
node .claude/tools/session-state.mjs summary

# Clear session
node .claude/tools/session-state.mjs clear router-123
```

---

## Testing

Run tests to verify migration:

```bash
# Run session state tests
node .claude/tools/session-state.test.mjs
```

Expected output:

```
Running Session State Manager Tests...

Test 1: Initialize router session
✅ Test 1 passed

Test 2: Initialize orchestrator session
✅ Test 2 passed

...

✅ All tests passed!
```

---

## Breaking Changes

**None**. All existing APIs are backward compatible.

**Deprecated**: None.

**Recommended**: Use new `metadata` parameter for custom session data instead of extending state directly.

---

## Pricing Reference

Model pricing (per million tokens):

| Model                     | Input  | Output |
| ------------------------- | ------ | ------ |
| claude-3-5-haiku-20241022 | $1.00  | $5.00  |
| claude-sonnet-4-20250514  | $3.00  | $15.00 |
| claude-opus-4-20241113    | $15.00 | $75.00 |

**Example Cost Calculation**:

```javascript
// Haiku: 1000 input + 500 output
// Input cost: (1000 / 1,000,000) * $1.00 = $0.001
// Output cost: (500 / 1,000,000) * $5.00 = $0.0025
// Total: $0.0035
```

---

## Rollback Plan

If issues arise, revert to previous version:

```bash
# Restore old session-state.mjs from git
git checkout HEAD~1 .claude/tools/session-state.mjs
```

**Data Loss**: None. Old sessions will continue to work with new version.

---

## Support

For issues or questions, see:

- **Tests**: `.claude/tools/session-state.test.mjs`
- **Implementation**: `.claude/tools/session-state.mjs`
- **Router Integration**: `.claude/tools/router-session-handler.mjs`
