# Router-Orchestrator Handoff Quick Reference

Quick reference guide for using the router-orchestrator handoff functionality.

---

## Basic Usage

### Without Router Session (Legacy)

```javascript
import { processUserPrompt } from './.claude/tools/orchestrator-entry.mjs';

const result = await processUserPrompt('Build a web app', { runId: 'run-001' });

// Uses semantic routing as before
// result.routing.routing_method === 'semantic'
// result.costs === null
```

### With Router Session (New)

```javascript
import { processUserPrompt } from './.claude/tools/orchestrator-entry.mjs';

const result = await processUserPrompt(
  'Build a web app',
  {
    runId: 'run-001',
    sessionContext: {
      session_id: 'router-sess-123',
      router_classification: {
        model: 'claude-3-5-haiku-20241022',
      },
      cost_tracking: {
        total_cost_usd: 0.00045,
        total_input_tokens: 150,
        total_output_tokens: 100,
      },
    },
  },
  {
    intent: 'web_app',
    workflow: '@.claude/workflows/greenfield-fullstack.yaml',
    complexity: 'high',
    confidence: 0.9,
  }
);

// Uses router decision (skips semantic routing)
// result.routing.routing_method === 'router_handoff'
// result.costs.total === router cost + orchestrator cost
```

---

## Function Signature

```javascript
async function processUserPrompt(
  userPrompt,       // string: User's request
  options = {},     // object: { runId?, sessionContext? }
  routingDecision = null  // object: Router's routing decision (optional)
)
```

### Parameters

| Parameter         | Type     | Required | Description                             |
| ----------------- | -------- | -------- | --------------------------------------- |
| `userPrompt`      | `string` | ✅        | User's request text                     |
| `options`         | `object` | ❌        | Options (runId, sessionContext)         |
| `routingDecision` | `object` | ❌        | Router's routing decision (for handoff) |

### `options` Object

```javascript
{
  runId?: string,           // Optional run ID (generated if not provided)
  sessionContext?: {        // Optional session context from router
    session_id: string,
    router_classification?: {
      model: string,
      intent?: string,
      cloud_provider?: string
    },
    cost_tracking?: {
      total_cost_usd: number,
      total_input_tokens: number,
      total_output_tokens: number,
      model_usage?: Array<object>
    }
  }
}
```

### `routingDecision` Object

```javascript
{
  intent: string,                 // e.g., 'web_app', 'script', 'analysis'
  workflow?: string,              // e.g., '@.claude/workflows/greenfield-fullstack.yaml'
  selected_workflow?: string,     // Alternative workflow field
  complexity: string,             // e.g., 'low', 'medium', 'high'
  confidence: number,             // 0-1 confidence score
  routing_method?: string,        // e.g., 'classification'
  cloud_provider?: string,        // e.g., 'gcp', 'aws', 'azure'
  cuj_id?: string                 // e.g., 'CUJ-001'
}
```

---

## Return Value

```javascript
{
  runId: string,                  // Run ID
  routing: {
    selected_workflow: string,
    routing_method: string,       // 'router_handoff', 'semantic', 'cuj_mapping', etc.
    intent: string,
    complexity: string,
    confidence: number,
    router_session_id?: string    // If router handoff
  },
  step0Result?: {                 // If workflow executed
    success: boolean,
    output: string,
    runId: string
  },
  executionMode?: string,         // 'skill_only' if skill-only CUJ
  primarySkill?: string,          // If skill-only
  skillInvocationCommand?: string,  // If skill-only
  runRecord: object,              // Full run record
  costs: {                        // Cost aggregation
    router: {
      total_cost_usd: number,
      total_input_tokens: number,
      total_output_tokens: number,
      model_usage: Array<object>
    } | null,
    orchestrator: {
      total_cost_usd: number,
      total_input_tokens: number,
      total_output_tokens: number,
      model_usage: Array<object>
    },
    total: number                 // Sum of router + orchestrator
  } | null
}
```

---

## Common Patterns

### Pattern 1: Router Classifies, Orchestrator Executes

```javascript
// Step 1: Router session classifies intent
import { classifyIntent, selectWorkflow } from './.claude/tools/router-session-handler.mjs';

const classification = await classifyIntent(userPrompt);
const workflow = await selectWorkflow(classification.intent, classification.complexity);

// Step 2: Orchestrator executes if complexity is high
if (classification.should_route) {
  const result = await processUserPrompt(
    userPrompt,
    {
      sessionContext: {
        session_id: 'router-sess-123',
        cost_tracking: routerCosts,
      },
    },
    {
      intent: classification.intent,
      workflow,
      complexity: classification.complexity,
      confidence: classification.confidence,
    }
  );
}
```

### Pattern 2: Direct Orchestrator Call (No Router)

```javascript
// Skip router, use orchestrator directly
const result = await processUserPrompt('Build a web app', { runId: 'run-001' });

// Orchestrator uses semantic routing
```

### Pattern 3: CUJ Execution with Router

```javascript
// Step 1: Router detects CUJ reference
import { classifyIntent } from './.claude/tools/router-session-handler.mjs';

const classification = await classifyIntent('/cuj-001');

// Step 2: Orchestrator executes CUJ workflow
const result = await processUserPrompt(
  '/cuj-001',
  {
    sessionContext: {
      session_id: 'router-sess-456',
      cost_tracking: routerCosts,
    },
  },
  {
    intent: 'cuj_execution',
    workflow: '@.claude/workflows/cuj-validation-workflow.yaml',
    complexity: 'medium',
    confidence: 1.0,
    cuj_id: 'CUJ-001',
  }
);
```

---

## Cost Aggregation Example

```javascript
// Router session costs
const routerCosts = {
  total_cost_usd: 0.00045,
  total_input_tokens: 150,
  total_output_tokens: 100,
  model_usage: [
    {
      model: 'claude-3-5-haiku-20241022',
      cost_usd: 0.00045,
    },
  ],
};

// Call orchestrator with session context
const result = await processUserPrompt(
  userPrompt,
  {
    sessionContext: {
      session_id: 'router-sess-123',
      cost_tracking: routerCosts,
    },
  },
  routingDecision
);

// Costs are aggregated
console.log(result.costs);
// {
//   router: { total_cost_usd: 0.00045, ... },
//   orchestrator: { total_cost_usd: 0.0012, ... },
//   total: 0.00165
// }
```

---

## Session Context Transfer

```javascript
const result = await processUserPrompt(
  userPrompt,
  {
    sessionContext: {
      session_id: 'router-sess-123',
      router_classification: {
        model: 'claude-3-5-haiku-20241022',
        intent: 'web_app',
      },
      cost_tracking: routerCosts,
    },
  },
  routingDecision
);

// Session context is in run metadata
const runRecord = result.runRecord;
console.log(runRecord.metadata.routerHandoff);
// {
//   timestamp: '2025-01-12T10:00:00Z',
//   sessionId: 'router-sess-123',
//   routerModel: 'claude-3-5-haiku-20241022',
//   routingDecision: { ... },
//   accumulatedCosts: { ... }
// }
```

---

## Troubleshooting

### Issue: Semantic routing not skipped

**Problem:** Orchestrator performs semantic routing despite router decision

**Check:**

1. `routingDecision` parameter is provided
2. `routingDecision.workflow` or `routingDecision.selected_workflow` exists

**Solution:**

```javascript
// Ensure workflow is in routing decision
const routingDecision = {
  workflow: '@.claude/workflows/greenfield-fullstack.yaml',  // Required
  intent: 'web_app',
  complexity: 'high',
};
```

### Issue: Costs not aggregated

**Problem:** `result.costs` is `null`

**Check:**

1. `sessionContext` is provided in options
2. `sessionContext.cost_tracking` exists and has valid data

**Solution:**

```javascript
// Ensure cost tracking in session context
const options = {
  sessionContext: {
    session_id: 'router-sess-123',
    cost_tracking: {  // Required for cost aggregation
      total_cost_usd: 0.00045,
      total_input_tokens: 150,
      total_output_tokens: 100,
    },
  },
};
```

### Issue: Session context not in run metadata

**Problem:** `runRecord.metadata.routerHandoff` is missing

**Check:**

1. `sessionContext` is provided in options
2. `sessionContext.session_id` exists

**Solution:**

```javascript
// Ensure session ID in context
const options = {
  sessionContext: {
    session_id: 'router-sess-123',  // Required
    cost_tracking: { ... },
  },
};
```

---

## Testing

### Run Integration Tests

```bash
node .claude/tools/tests/orchestrator-router-handoff.test.mjs
```

**Expected Output:**

```
============================================================
Orchestrator Router Handoff Integration Tests
============================================================

[Test 1] Router handoff with routing decision
✅ Router handoff test passed

[Test 2] Session context transfer
✅ Session context transfer test passed

[Test 3] Cost aggregation accuracy
✅ Cost aggregation test passed

[Test 4] Backward compatibility (no routing decision)
✅ Backward compatibility test passed

[Test 5] Skip redundant routing
✅ Skip redundant routing test passed

============================================================
Test Results
============================================================
✅ Passed: 5/5
❌ Failed: 0/5
============================================================
```

---

## References

- **Implementation**: `.claude/tools/orchestrator-entry.mjs`
- **Router Session Handler**: `.claude/tools/router-session-handler.mjs`
- **Integration Tests**: `.claude/tools/tests/orchestrator-router-handoff.test.mjs`
- **Examples**: `.claude/docs/router-orchestrator-handoff-examples.md`
- **Summary**: `.claude/context/reports/step-1-6-implementation-summary.md`

---

## Backward Compatibility

**Guaranteed:**

- ✅ Existing calls without `routingDecision` work as before
- ✅ Semantic routing still functions when no router decision
- ✅ No breaking changes to API
- ✅ Cost field is `null` when no router session (not an error)

**Migration:**

No migration needed - router handoff is **opt-in**. Existing code continues to work.
