# Router-Orchestrator Handoff Examples

This document provides example scenarios demonstrating how the router session hands off to the orchestrator entry point.

---

## Overview

The router session (Haiku model) performs lightweight intent classification and workflow selection. When complexity is high or routing is needed, it hands off to the orchestrator entry point (Sonnet model) with:

1. **Routing Decision** - Selected workflow, intent, complexity
2. **Session Context** - Session ID, router model, cost tracking
3. **Cost Aggregation** - Router + orchestrator costs combined

---

## Example 1: Web Application Development

### User Prompt

```
Build a full-stack web application with React frontend, Node.js backend, and PostgreSQL database
```

### Router Session Output

```javascript
{
  classification: {
    intent: 'web_app',
    complexity: 'high',
    complexity_score: 0.85,
    should_route: true,
    confidence: 0.9,
    reasoning: 'Detected intent: web_app. Complexity: high (score: 0.85). Routing to orchestrator due to complexity.'
  },
  workflow: '@.claude/workflows/greenfield-fullstack.yaml',
  session_id: 'router-sess-abc123',
  cost_tracking: {
    total_cost_usd: 0.00045,
    total_input_tokens: 150,
    total_output_tokens: 100
  }
}
```

### Orchestrator Entry Invocation

```javascript
import { processUserPrompt } from './.claude/tools/orchestrator-entry.mjs';

const result = await processUserPrompt(
  'Build a full-stack web application with React frontend, Node.js backend, and PostgreSQL database',
  {
    runId: 'run-xyz789',
    sessionContext: {
      session_id: 'router-sess-abc123',
      router_classification: {
        model: 'claude-haiku-4-5',
        intent: 'web_app',
      },
      cost_tracking: {
        total_cost_usd: 0.00045,
        total_input_tokens: 150,
        total_output_tokens: 100,
        model_usage: [
          {
            timestamp: '2025-01-12T10:00:00Z',
            model: 'claude-haiku-4-5',
            input_tokens: 150,
            output_tokens: 100,
            cost_usd: 0.00045,
          },
        ],
      },
    },
  },
  {
    intent: 'web_app',
    workflow: '@.claude/workflows/greenfield-fullstack.yaml',
    selected_workflow: '@.claude/workflows/greenfield-fullstack.yaml',
    complexity: 'high',
    confidence: 0.9,
    routing_method: 'classification',
  }
);
```

### Orchestrator Entry Output

```javascript
{
  runId: 'run-xyz789',
  routing: {
    selected_workflow: '@.claude/workflows/greenfield-fullstack.yaml',
    routing_method: 'router_handoff',
    intent: 'web_app',
    complexity: 'high',
    confidence: 0.9,
    router_session_id: 'router-sess-abc123'
  },
  step0Result: {
    success: true,
    output: '...',
    runId: 'run-xyz789'
  },
  runRecord: {
    id: 'run-xyz789',
    status: 'in_progress',
    metadata: {
      routerHandoff: {
        timestamp: '2025-01-12T10:00:05Z',
        sessionId: 'router-sess-abc123',
        routerModel: 'claude-haiku-4-5',
        routingDecision: { ... },
        accumulatedCosts: { ... }
      }
    }
  },
  costs: {
    router: {
      total_cost_usd: 0.00045,
      total_input_tokens: 150,
      total_output_tokens: 100
    },
    orchestrator: {
      total_cost_usd: 0.0012,
      total_input_tokens: 400,
      total_output_tokens: 300
    },
    total: 0.00165
  }
}
```

**Key Features:**

- ✅ Router costs preserved and aggregated
- ✅ Semantic routing skipped (workflow already selected)
- ✅ Session context transferred to run metadata
- ✅ Total cost = router + orchestrator

---

## Example 2: Simple Script (No Handoff)

### User Prompt

```
Create a script to rename files in a directory
```

### Router Session Output

```javascript
{
  classification: {
    intent: 'script',
    complexity: 'low',
    complexity_score: 0.3,
    should_route: false,
    confidence: 0.95,
    reasoning: 'Detected intent: script. Complexity: low. Handling directly with Haiku router.'
  },
  handled_by: 'router',
  response_type: 'direct',
  session_id: 'router-sess-def456',
  cost_tracking: {
    total_cost_usd: 0.00015,
    total_input_tokens: 50,
    total_output_tokens: 30
  }
}
```

**No orchestrator handoff needed** - router handles directly.

---

## Example 3: Code Analysis

### User Prompt

```
Analyze the codebase for security vulnerabilities and performance issues
```

### Router Session Output

```javascript
{
  classification: {
    intent: 'analysis',
    complexity: 'medium',
    complexity_score: 0.72,
    should_route: true,
    confidence: 0.88
  },
  workflow: '@.claude/workflows/code-quality-flow.yaml',
  session_id: 'router-sess-ghi789'
}
```

### Orchestrator Entry Invocation

```javascript
const result = await processUserPrompt(
  'Analyze the codebase for security vulnerabilities and performance issues',
  {
    runId: 'run-analysis-001',
    sessionContext: {
      session_id: 'router-sess-ghi789',
      cost_tracking: {
        total_cost_usd: 0.0003,
        total_input_tokens: 100,
        total_output_tokens: 80,
      },
    },
  },
  {
    intent: 'analysis',
    workflow: '@.claude/workflows/code-quality-flow.yaml',
    complexity: 'medium',
    confidence: 0.88,
  }
);
```

### Orchestrator Entry Output

```javascript
{
  runId: 'run-analysis-001',
  routing: {
    selected_workflow: '@.claude/workflows/code-quality-flow.yaml',
    routing_method: 'router_handoff',
    intent: 'analysis',
    complexity: 'medium'
  },
  costs: {
    router: { total_cost_usd: 0.0003 },
    orchestrator: { total_cost_usd: 0.0008 },
    total: 0.0011
  }
}
```

---

## Example 4: Infrastructure Deployment

### User Prompt

```
Deploy the application to Google Cloud Run with Cloud SQL and Pub/Sub
```

### Router Session Output

```javascript
{
  classification: {
    intent: 'infrastructure',
    complexity: 'high',
    complexity_score: 0.90,
    cloud_provider: 'gcp',
    should_route: true
  },
  workflow: '@.claude/workflows/automated-enterprise-flow.yaml',
  session_id: 'router-sess-jkl012'
}
```

### Orchestrator Entry Invocation

```javascript
const result = await processUserPrompt(
  'Deploy the application to Google Cloud Run with Cloud SQL and Pub/Sub',
  {
    runId: 'run-deploy-gcp',
    sessionContext: {
      session_id: 'router-sess-jkl012',
      router_classification: {
        model: 'claude-haiku-4-5',
        intent: 'infrastructure',
        cloud_provider: 'gcp',
      },
      cost_tracking: {
        total_cost_usd: 0.0005,
        total_input_tokens: 200,
        total_output_tokens: 150,
      },
    },
  },
  {
    intent: 'infrastructure',
    workflow: '@.claude/workflows/automated-enterprise-flow.yaml',
    complexity: 'high',
    confidence: 0.92,
    cloud_provider: 'gcp',
  }
);
```

**Special Handling:**

- ✅ Cloud provider detected (GCP)
- ✅ High complexity triggers Sonnet model
- ✅ Infrastructure workflow selected
- ✅ Cost tracking across models

---

## Example 5: CUJ Execution with Router Handoff

### User Prompt

```
/cuj-001
```

### Router Session Output

```javascript
{
  classification: {
    intent: 'cuj_execution',
    complexity: 'medium',
    should_route: true,
    cuj_id: 'CUJ-001'
  },
  workflow: '@.claude/workflows/cuj-validation-workflow.yaml',
  session_id: 'router-sess-mno345'
}
```

### Orchestrator Entry Invocation

```javascript
const result = await processUserPrompt(
  '/cuj-001',
  {
    runId: 'run-cuj-001',
    sessionContext: {
      session_id: 'router-sess-mno345',
      cost_tracking: {
        total_cost_usd: 0.00025,
        total_input_tokens: 80,
        total_output_tokens: 60,
      },
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

**CUJ-Specific Behavior:**

- ✅ CUJ reference detected by router
- ✅ CUJ mapping resolved (workflow or skill-only)
- ✅ Router hands off to orchestrator with CUJ context
- ✅ Orchestrator skips redundant CUJ detection

---

## Cost Aggregation Details

### Cost Breakdown

```javascript
{
  costs: {
    router: {
      total_cost_usd: 0.00045,        // Haiku costs
      total_input_tokens: 150,
      total_output_tokens: 100,
      model_usage: [
        {
          timestamp: '2025-01-12T10:00:00Z',
          model: 'claude-haiku-4-5',
          input_tokens: 150,
          output_tokens: 100,
          cost_usd: 0.00045
        }
      ]
    },
    orchestrator: {
      total_cost_usd: 0.0012,         // Sonnet costs
      total_input_tokens: 400,
      total_output_tokens: 300,
      model_usage: [
        {
          timestamp: '2025-01-12T10:00:05Z',
          model: 'claude-sonnet-4-5',
          input_tokens: 400,
          output_tokens: 300,
          cost_usd: 0.0012
        }
      ]
    },
    total: 0.00165                    // Sum of router + orchestrator
  }
}
```

### Cost Savings

**Without Router Session:**

- Sonnet handles all requests: 550 tokens × $3/$15 = $0.00165 + $0.00450 = $0.00615

**With Router Session:**

- Haiku handles simple queries: 250 tokens × $1/$5 = $0.00025 + $0.00050 = $0.00075
- Sonnet handles complex tasks only: 700 tokens × $3/$15 = $0.0021 + $0.0105 = $0.01260

**Total:** $0.01335 (vs $0.00615 for direct Sonnet)

**Key:** Router session adds cost for classification, but saves on avoiding expensive Sonnet calls for simple queries.

---

## Backward Compatibility

### Legacy Call (No Router Decision)

```javascript
// Still works - uses semantic routing as before
const result = await processUserPrompt(
  'Build a web application',
  { runId: 'run-legacy-001' }
  // No routingDecision parameter
);

// Output
{
  runId: 'run-legacy-001',
  routing: {
    routing_method: 'semantic',  // Not 'router_handoff'
    selected_workflow: '@.claude/workflows/greenfield-fullstack.yaml'
  },
  costs: null  // No router costs to aggregate
}
```

**Guarantees:**

- ✅ Existing workflows unaffected
- ✅ Semantic routing still works
- ✅ No breaking changes
- ✅ Opt-in router session integration

---

## Session Context Transfer

### Run Metadata with Router Handoff

```javascript
{
  id: 'run-xyz789',
  status: 'in_progress',
  created_at: '2025-01-12T10:00:05Z',
  selected_workflow: '@.claude/workflows/greenfield-fullstack.yaml',
  metadata: {
    userRequest: 'Build a full-stack web application...',
    sessionId: 'claude-session-123',
    routing_confidence: 0.9,
    routing_method: 'router_handoff',
    intent: 'web_app',
    complexity: 'high',

    // Router handoff context (NEW)
    routerHandoff: {
      timestamp: '2025-01-12T10:00:05Z',
      sessionId: 'router-sess-abc123',
      routerModel: 'claude-haiku-4-5',
      routingDecision: {
        intent: 'web_app',
        workflow: '@.claude/workflows/greenfield-fullstack.yaml',
        complexity: 'high',
        confidence: 0.9
      },
      accumulatedCosts: {
        total_cost_usd: 0.00045,
        total_input_tokens: 150,
        total_output_tokens: 100
      }
    }
  }
}
```

**Use Cases:**

- Audit trail: Track which router session initiated the run
- Cost attribution: See costs from both router and orchestrator
- Debugging: Understand routing decisions and handoff process
- Analytics: Measure router accuracy and cost savings

---

## Integration Checklist

When integrating router session with orchestrator entry:

- [ ] Router session classifies intent and selects workflow
- [ ] Router session tracks costs (Haiku model)
- [ ] Router hands off to orchestrator with routing decision
- [ ] Orchestrator receives routing decision parameter
- [ ] Orchestrator skips redundant semantic routing
- [ ] Orchestrator transfers session context to run metadata
- [ ] Orchestrator aggregates costs from router and orchestrator
- [ ] Backward compatibility maintained (no router decision still works)
- [ ] Cost aggregation accurate (router + orchestrator = total)
- [ ] Logging shows router handoff clearly

---

## Troubleshooting

### Issue: Routing decision ignored

**Symptom:** Orchestrator performs semantic routing despite router decision

**Solution:** Ensure `routingDecision` parameter is provided and contains `workflow` or `selected_workflow` field

### Issue: Session context not transferred

**Symptom:** `runRecord.metadata.routerHandoff` is missing

**Solution:** Ensure `sessionContext` parameter is provided in options

### Issue: Costs not aggregated

**Symptom:** `result.costs` is null or missing router costs

**Solution:** Ensure `sessionContext.cost_tracking` is provided with valid cost data

### Issue: Backward compatibility broken

**Symptom:** Existing calls fail when router integration enabled

**Solution:** Verify `routingDecision` parameter defaults to `null` and existing calls work without it

---

## References

- **Router Session Handler**: `.claude/tools/router-session-handler.mjs`
- **Orchestrator Entry**: `.claude/tools/orchestrator-entry.mjs`
- **Integration Tests**: `.claude/tools/tests/orchestrator-router-handoff.test.mjs`
- **Session State Management**: `.claude/tools/session-state.mjs`
- **Settings**: `.claude/settings.json` (router_session configuration)

---

## Next Steps

1. **Test Integration**: Run integration tests to verify handoff works correctly
2. **Monitor Costs**: Track cost savings from router session vs direct Sonnet
3. **Optimize Thresholds**: Adjust complexity thresholds to maximize cost savings
4. **Extend Classification**: Add more intent types and workflow mappings
5. **Analytics Dashboard**: Visualize router accuracy and cost attribution
