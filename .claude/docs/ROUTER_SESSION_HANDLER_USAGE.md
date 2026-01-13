# Router Session Handler - Usage Guide

## Overview

The Router Session Handler is the core logic for the Haiku-based routing system. It provides fast, cost-efficient intent classification and orchestrator routing decisions.

## Key Features

- **Fast Classification**: < 100ms intent classification using lightweight heuristics
- **Cost Tracking**: Accurate token and cost tracking across sessions
- **Smart Routing**: Complexity-based routing to orchestrator when needed
- **Workflow Selection**: Automatic workflow selection based on intent
- **Session Management**: Persistent session state with cleanup

## Installation

The module is located at `.claude/tools/router-session-handler.mjs` and can be imported:

```javascript
import RouterSessionHandler from './.claude/tools/router-session-handler.mjs';

// Or import specific functions
import {
  initializeRouterSession,
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  trackCosts
} from './.claude/tools/router-session-handler.mjs';
```

## Core Functions

### 1. `initializeRouterSession(sessionId, initialPrompt)`

Initialize a new router session with Haiku model.

**Parameters**:
- `sessionId` (string): Unique session identifier
- `initialPrompt` (string): User's initial prompt

**Returns**: Session object with settings and state

**Example**:

```javascript
const session = await initializeRouterSession('session-123', 'Build a web app');

console.log(session);
// {
//   session_id: 'session-123',
//   model: 'claude-3-5-haiku-20241022',
//   temperature: 0.1,
//   role: 'router',
//   cost_tracking: { ... },
//   routing_history: [],
//   settings: { ... }
// }
```

### 2. `classifyIntent(userPrompt)`

Classify user intent and determine routing decision.

**Parameters**:
- `userPrompt` (string): User's input prompt

**Returns**: Classification object

**Example**:

```javascript
const classification = await classifyIntent(
  'Build an enterprise web application with Google Cloud integration'
);

console.log(classification);
// {
//   intent: 'web_app',
//   complexity: 'high',
//   complexity_score: 0.8,
//   cloud_provider: 'gcp',
//   should_route: true,
//   confidence: 0.95,
//   reasoning: '...',
//   keywords_detected: ['enterprise', 'web application', 'google cloud'],
//   classification_time_ms: 45
// }
```

**Classification Results**:

| Field | Type | Description |
|-------|------|-------------|
| `intent` | string | Intent type (web_app, script, analysis, etc.) |
| `complexity` | string | Complexity level (low, medium, high) |
| `complexity_score` | number | Numeric complexity score (0-1) |
| `cloud_provider` | string/null | Cloud provider (gcp, aws, azure, null) |
| `should_route` | boolean | Whether to route to orchestrator |
| `confidence` | number | Classification confidence (0-1) |
| `reasoning` | string | Human-readable reasoning |
| `keywords_detected` | string[] | Keywords that matched |
| `classification_time_ms` | number | Time taken to classify |

### 3. `selectWorkflow(intent, complexity)`

Select appropriate workflow based on classification.

**Parameters**:
- `intent` (string): Intent type
- `complexity` (string): Complexity level

**Returns**: Workflow file path

**Example**:

```javascript
const workflow = await selectWorkflow('web_app', 'high');
// '@.claude/workflows/greenfield-fullstack.yaml'

const scriptWorkflow = await selectWorkflow('script', 'low');
// '@.claude/workflows/quick-flow.yaml'
```

**Workflow Mapping**:

| Intent | Workflow |
|--------|----------|
| web_app | greenfield-fullstack.yaml |
| script | quick-flow.yaml |
| analysis | code-quality-flow.yaml |
| infrastructure | automated-enterprise-flow.yaml |
| mobile | mobile-flow.yaml |
| ai_system | ai-system-flow.yaml |

### 4. `routeToOrchestrator(workflow, userPrompt, sessionContext)`

Route request to orchestrator with handoff data.

**Parameters**:
- `workflow` (string): Workflow file path
- `userPrompt` (string): Original user prompt
- `sessionContext` (object): Session context

**Returns**: Handoff data for orchestrator

**Example**:

```javascript
const handoff = await routeToOrchestrator(
  '@.claude/workflows/greenfield-fullstack.yaml',
  'Build a web application',
  {
    session_id: 'session-123',
    classification: { intent: 'web_app', complexity: 'high' }
  }
);

console.log(handoff);
// {
//   success: true,
//   handoff_data: {
//     workflow: '@.claude/workflows/greenfield-fullstack.yaml',
//     user_prompt: 'Build a web application',
//     session_context: { ... },
//     routing_metadata: {
//       routed_at: '2025-01-12T10:00:00Z',
//       router_model: 'claude-3-5-haiku-20241022',
//       skip_redundant_routing: true
//     }
//   },
//   message: 'Routing to orchestrator with workflow: ...'
// }
```

### 5. `trackCosts(sessionId, modelUsed, inputTokens, outputTokens)`

Track costs for model usage.

**Parameters**:
- `sessionId` (string): Session identifier
- `modelUsed` (string): Model identifier
- `inputTokens` (number): Input token count
- `outputTokens` (number): Output token count

**Returns**: Cost summary

**Example**:

```javascript
const cost = await trackCosts(
  'session-123',
  'claude-3-5-haiku-20241022',
  1000, // input tokens
  500   // output tokens
);

console.log(cost);
// {
//   session_cost: 0.0035,
//   this_request: {
//     input_tokens: 1000,
//     output_tokens: 500,
//     cost_usd: 0.0035,
//     model: 'claude-3-5-haiku-20241022'
//   }
// }
```

**Model Pricing** (per million tokens):

| Model | Input | Output |
|-------|-------|--------|
| claude-3-5-haiku-20241022 | $1.00 | $5.00 |
| claude-sonnet-4-20250514 | $3.00 | $15.00 |
| claude-opus-4-20241113 | $15.00 | $75.00 |

### 6. `getCostSummary(sessionId)`

Get cumulative cost summary for session.

**Example**:

```javascript
const summary = await getCostSummary('session-123');

console.log(summary);
// {
//   session_id: 'session-123',
//   total_cost_usd: 0.0125,
//   total_input_tokens: 5000,
//   total_output_tokens: 2500,
//   model_breakdown: [
//     { timestamp: '...', model: 'haiku', input_tokens: 1000, output_tokens: 500, cost_usd: 0.0035 },
//     { timestamp: '...', model: 'haiku', input_tokens: 2000, output_tokens: 1000, cost_usd: 0.007 },
//     // ...
//   ]
// }
```

## Usage Patterns

### Pattern 1: Complete Routing Flow

```javascript
import {
  initializeRouterSession,
  classifyIntent,
  selectWorkflow,
  routeToOrchestrator,
  trackCosts
} from './.claude/tools/router-session-handler.mjs';

async function handleUserRequest(userPrompt) {
  // Step 1: Initialize session
  const sessionId = `session-${Date.now()}`;
  const session = await initializeRouterSession(sessionId, userPrompt);

  // Step 2: Classify intent
  const classification = await classifyIntent(userPrompt);

  // Step 3: Track classification cost
  await trackCosts(sessionId, session.model, 100, 50); // estimated tokens

  // Step 4: Decide routing
  if (classification.should_route) {
    // Route to orchestrator
    const workflow = await selectWorkflow(
      classification.intent,
      classification.complexity
    );

    const handoff = await routeToOrchestrator(workflow, userPrompt, {
      session_id: sessionId,
      classification
    });

    return handoff;
  } else {
    // Handle directly
    return {
      handled_by: 'router',
      classification,
      message: 'Handled directly without orchestrator'
    };
  }
}
```

### Pattern 2: Simple Classification Only

```javascript
import { classifyIntent } from './.claude/tools/router-session-handler.mjs';

async function quickClassify(prompt) {
  const result = await classifyIntent(prompt);

  if (result.confidence < 0.8) {
    console.warn('Low confidence classification:', result.reasoning);
  }

  return result;
}

// Usage
const classification = await quickClassify('Build a mobile app');
console.log(`Intent: ${classification.intent}, Complexity: ${classification.complexity}`);
```

### Pattern 3: Cost Monitoring

```javascript
import { trackCosts, getCostSummary } from './.claude/tools/router-session-handler.mjs';

async function monitorSessionCost(sessionId, threshold = 1.0) {
  const summary = await getCostSummary(sessionId);

  if (summary.total_cost_usd > threshold) {
    console.warn(
      `Session ${sessionId} has exceeded cost threshold: $${summary.total_cost_usd.toFixed(4)}`
    );
  }

  return summary;
}
```

## CLI Usage

The module includes a CLI for testing:

```bash
# Classify a prompt
node .claude/tools/router-session-handler.mjs classify "build a web app"

# Initialize a session
node .claude/tools/router-session-handler.mjs init-session test-123 "create api"

# Select workflow
node .claude/tools/router-session-handler.mjs select-workflow web_app high

# Clean up old sessions
node .claude/tools/router-session-handler.mjs cleanup
```

## Testing

Run the test suite:

```bash
node .claude/tools/router-session-handler.test.mjs
```

**Test Coverage**:
- ✅ Intent classification (all types)
- ✅ Complexity assessment
- ✅ Cloud provider detection
- ✅ Session management
- ✅ Workflow selection
- ✅ Cost tracking accuracy
- ✅ Orchestrator routing
- ✅ Edge cases (empty, long, ambiguous prompts)
- ✅ Performance (< 50ms average)

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Intent Classification | < 100ms | Lightweight heuristics |
| Session Initialization | < 50ms | File I/O |
| Workflow Selection | < 20ms | Simple mapping |
| Cost Tracking | < 10ms | Arithmetic only |

## Error Handling

All functions include comprehensive error handling:

```javascript
try {
  const classification = await classifyIntent(userPrompt);
} catch (error) {
  console.error('Classification failed:', error.message);
  // Fallback to default workflow
}
```

**Common Errors**:
- `Failed to initialize router session` - Settings file missing or invalid
- `Cost tracking failed` - Session not found
- `Workflow selection failed` - Invalid intent type

## Integration with Orchestrator

The router session handler integrates with `orchestrator-entry.mjs`:

```javascript
// In orchestrator-entry.mjs
import { routeToOrchestrator } from './router-session-handler.mjs';

async function handleRouterHandoff(handoffData) {
  // Check if routing was already done by router
  if (handoffData.routing_metadata.skip_redundant_routing) {
    // Use router's workflow selection
    const workflow = handoffData.workflow;
    const userPrompt = handoffData.user_prompt;

    // Execute workflow directly
    return await executeWorkflow(workflow, userPrompt);
  }
}
```

## Best Practices

1. **Always initialize session first** - Session state is required for cost tracking
2. **Check confidence levels** - Use fallback logic for low confidence (<0.7)
3. **Monitor costs** - Set thresholds for session costs
4. **Clean up old sessions** - Run cleanup periodically (cron job)
5. **Validate workflow paths** - Ensure workflow files exist before routing
6. **Handle errors gracefully** - Provide fallback workflows for failures

## Configuration

The router uses settings from `.claude/settings.json`:

```json
{
  "models": {
    "router": "claude-3-5-haiku-20241022",
    "orchestrator": "claude-sonnet-4-20250514"
  },
  "routing": {
    "complexity_threshold": 0.7,
    "cost_optimization_enabled": true
  }
}
```

**Tunable Parameters**:
- `complexity_threshold`: Minimum score to route to orchestrator (default: 0.7)
- `cost_optimization_enabled`: Enable cost-aware model selection (default: true)

## Session State Files

Session states are stored in `.claude/context/tmp/router-session-{id}.json`:

```json
{
  "session_id": "session-123",
  "created_at": "2025-01-12T10:00:00Z",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.1,
  "role": "router",
  "cost_tracking": {
    "total_input_tokens": 5000,
    "total_output_tokens": 2500,
    "total_cost_usd": 0.0125,
    "model_usage": [...]
  },
  "routing_history": [...]
}
```

**Cleanup Policy**: Files older than 24 hours are automatically cleaned up.

## Troubleshooting

### Issue: Classification is slow (>100ms)

**Solution**: Check token estimation logic. Long prompts should be cached.

### Issue: Wrong workflow selected

**Solution**: Review intent keywords in INTENT_KEYWORDS mapping. Add missing keywords.

### Issue: Session state not persisting

**Solution**: Ensure `.claude/context/tmp/` directory exists and is writable.

### Issue: Cost calculations incorrect

**Solution**: Verify MODEL_PRICING matches current Anthropic pricing.

## Future Enhancements

- [ ] Machine learning-based intent classification
- [ ] Historical routing pattern analysis
- [ ] Adaptive complexity thresholds
- [ ] Multi-language support
- [ ] Real-time cost optimization
- [ ] Session clustering for analytics

## Related Documentation

- [Router Agent Definition](./.claude/agents/router.md)
- [Orchestrator Entry Point](./.claude/docs/ORCHESTRATOR_ENTRY_USAGE.md)
- [Workflow Guide](./.claude/workflows/WORKFLOW-GUIDE.md)
- [Settings Schema](./.claude/schemas/settings.schema.json)
