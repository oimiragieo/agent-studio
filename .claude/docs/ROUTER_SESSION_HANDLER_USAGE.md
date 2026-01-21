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
  trackCosts,
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
//   model: 'claude-haiku-4-5',
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

| Field                    | Type        | Description                                   |
| ------------------------ | ----------- | --------------------------------------------- |
| `intent`                 | string      | Intent type (web_app, script, analysis, etc.) |
| `complexity`             | string      | Complexity level (low, medium, high)          |
| `complexity_score`       | number      | Numeric complexity score (0-1)                |
| `cloud_provider`         | string/null | Cloud provider (gcp, aws, azure, null)        |
| `should_route`           | boolean     | Whether to route to orchestrator              |
| `confidence`             | number      | Classification confidence (0-1)               |
| `reasoning`              | string      | Human-readable reasoning                      |
| `keywords_detected`      | string[]    | Keywords that matched                         |
| `classification_time_ms` | number      | Time taken to classify                        |

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

| Intent         | Workflow                       |
| -------------- | ------------------------------ |
| web_app        | greenfield-fullstack.yaml      |
| script         | quick-flow.yaml                |
| analysis       | code-quality-flow.yaml         |
| infrastructure | automated-enterprise-flow.yaml |
| mobile         | mobile-flow.yaml               |
| ai_system      | ai-system-flow.yaml            |

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
    classification: { intent: 'web_app', complexity: 'high' },
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
//       router_model: 'claude-haiku-4-5',
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
  'claude-haiku-4-5',
  1000, // input tokens
  500 // output tokens
);

console.log(cost);
// {
//   session_cost: 0.0035,
//   this_request: {
//     input_tokens: 1000,
//     output_tokens: 500,
//     cost_usd: 0.0035,
//     model: 'claude-haiku-4-5'
//   }
// }
```

**Model Pricing** (per million tokens):

| Model                    | Input | Output |
| ------------------------ | ----- | ------ |
| claude-haiku-4-5         | $1.00 | $5.00  |
| claude-sonnet-4-5        | $3.00 | $15.00 |
| claude-opus-4-5-20251101 | $5.00 | $25.00 |

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
  trackCosts,
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
    const workflow = await selectWorkflow(classification.intent, classification.complexity);

    const handoff = await routeToOrchestrator(workflow, userPrompt, {
      session_id: sessionId,
      classification,
    });

    return handoff;
  } else {
    // Handle directly
    return {
      handled_by: 'router',
      classification,
      message: 'Handled directly without orchestrator',
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

| Operation              | Time    | Notes                  |
| ---------------------- | ------- | ---------------------- |
| Intent Classification  | < 100ms | Lightweight heuristics |
| Session Initialization | < 50ms  | File I/O               |
| Workflow Selection     | < 20ms  | Simple mapping         |
| Cost Tracking          | < 10ms  | Arithmetic only        |

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

## Hook Integration

### Router-First Hooks (Claude Code)

Claude Code does not provide a stable "UserPromptSubmit" hook in all environments, so this repo uses a **router-first** hook stack instead. The key behavior: tools are blocked until the request is routed through the `router` agent, then the session is handed off to the required coordinator (usually `orchestrator`) before work proceeds.

**Authoritative wiring**: `.claude/settings.json` → `hooks.PreToolUse` / `hooks.PostToolUse`

Core scripts:

- `.claude/hooks/router-first-enforcer.mjs` (PreToolUse): blocks tool use until routed; instructs spawning `router`
- `.claude/hooks/router-completion-handler.mjs` (PostToolUse): marks routing as complete after router finishes
- `.claude/hooks/no-reroute-after-routing.mjs` (PreToolUse): prevents spawning `router` again after routing starts (OOM guard)

### How the Hook Works

Current (router-first enforcement):

```
User prompt
  -> router-first-enforcer.mjs (blocks tools until routed)
  -> Task spawn router
  -> router selects workflow + escalation target
  -> router-completion-handler.mjs marks routing.completed=true
  -> routing-handoff-target-guard.mjs enforces handoff to orchestrator
```

Legacy diagram (kept for historical context; do not wire `router-session-entry.mjs` into Claude Code hooks):

```
User Prompt
    ↓
[router-first-enforcer.mjs Gate]
    ├─ Initialize router session (Haiku model)
    ├─ Classify intent & complexity
    ├─ Decision: Simple or Complex?
    │
    ├─ SIMPLE PROMPT (complexity < 0.7)
    │   └─ Return: Handle directly with Haiku
    │       (Cost: ~$0.003 per request)
    │
    └─ COMPLEX PROMPT (complexity >= 0.7)
        └─ Select workflow
        └─ Route to orchestrator
        └─ Execute selected workflow
```

### Hook Configuration

Claude Code hook wiring is configured in `.claude/settings.json`. The `.claude/hooks/hook-registry.json` file is kept for legacy tooling and human reference, but it is not the authoritative runtime configuration for Claude Code.

### Hook Settings in settings.json

Configure routing behavior in `.claude/settings.json`:

```json
{
  "models": {
    "router": "claude-haiku-4-5",
    "orchestrator": "claude-sonnet-4-5"
  },
  "routing": {
    "complexity_threshold": 0.7,
    "cost_optimization_enabled": true,
    "simple_prompt_timeout_ms": 5000,
    "allow_direct_haiku_handling": true
  },
  "session_management": {
    "session_cleanup_interval_hours": 24,
    "session_state_dir": ".claude/context/tmp"
  }
}
```

### Hook Error Handling

If the hook encounters an error during classification:

1. **Fail-Open Strategy**: Always routes to orchestrator (safe fallback)
2. **Error Logging**: Logs classification failures to console
3. **Session State**: Creates session with fallback status
4. **No Data Loss**: Original prompt is preserved for orchestrator

```javascript
// Example: Router hook encounters error
try {
  const classification = await classifyIntent(userPrompt);
  // ... routing logic
} catch (error) {
  console.error(`[Router Hook] Classification failed: ${error.message}`);
  // Fails open - returns { proceed: true } to route to orchestrator
}
```

### Enabling/Disabling the Router Hook

The hook can be managed via `.claude/hooks/hook-registry.json`:

**To disable**: Set `enabled: false`

```json
{
  "router-session-entry": {
    "enabled": false
  }
}
```

**To adjust complexity threshold**:

```json
{
  "router-session-entry": {
    "config": {
      "complexity_threshold": 0.8
    }
  }
}
```

## Integration with Orchestrator

The router session handler integrates seamlessly with `orchestrator-entry.mjs`. When the router hook detects a complex prompt:

1. **Hook prepares routing decision** with intent, complexity, workflow selection
2. **Hook invokes orchestrator** with `routeToOrchestrator()` function
3. **Orchestrator receives context** including router classification and cost tracking
4. **Orchestrator executes workflow** without redundant classification

```javascript
// In orchestrator-entry.mjs
import { routeToOrchestrator } from './router-session-handler.mjs';

async function handleRouterHandoff(handoffData) {
  // Router already classified - use its decision
  const { workflow, selected_workflow, router_session_id } = handoffData;

  // Execute workflow directly (no re-routing needed)
  return await executeWorkflow(workflow, handoffData.user_prompt, {
    router_session_id,
    skip_redundant_routing: true,
  });
}
```

**Key Benefits**:

- Router handles <100 tokens with Haiku (cheaper, faster)
- Complex prompts get full orchestrator treatment
- Cost savings: 70-80% reduction for simple prompts
- No redundant classification

## Cost Savings Analysis

The router provides significant cost savings by using lightweight Haiku classification before routing to expensive Sonnet/Opus models.

### Scenario 1: Simple Python Script Request

**Prompt**: "Write a Python script to process CSV files"

```
Router Classification:
  Intent: script
  Complexity: 0.3 (low)
  Confidence: 0.92
  Decision: HANDLE DIRECTLY

Cost Breakdown:
  Haiku classification:    ~$0.0008  (100 input + 50 output tokens)
  No orchestrator routing
  ────────────────────────
  Total cost:              $0.0008

Without Router (Direct Orchestrator):
  Sonnet full request:     ~$0.02 (higher token count)
  ────────────────────────
  Total cost:              $0.02

Savings: 96% reduction ($0.0192 saved per request)
```

### Scenario 2: Enterprise Web Application

**Prompt**: "Build an enterprise web application with Google Cloud integration, auth, database, etc."

```
Router Classification:
  Intent: web_app
  Complexity: 0.85 (high)
  Confidence: 0.94
  Decision: ROUTE TO ORCHESTRATOR

Cost Breakdown:
  Haiku classification:    ~$0.0008
  Sonnet orchestrator:     ~$0.02
  ────────────────────────
  Total cost:              ~$0.0208

Without Router (Direct Orchestrator):
  Sonnet classification:   ~$0.005 (redundant)
  Sonnet orchestrator:     ~$0.02
  ────────────────────────
  Total cost:              ~$0.025

Savings: 17% reduction ($0.0042 saved per request)
```

### Average Cost Savings Across Workloads

```
Workload Distribution (typical):
  50% Simple/Script tasks:        96% savings each = 48% average
  30% Medium tasks:               60% savings each = 18% average
  20% Complex tasks:              15% savings each = 3% average
  ────────────────────────────────────────────────
  Overall average savings:        69% cost reduction
```

### Monthly Cost Example

**100 monthly requests to orchestrator**:

```
Without Router:
  100 requests × $0.02 average = $2.00/month

With Router:
  50 simple  × $0.0008 = $0.04   (Haiku only)
  30 medium  × $0.0088 = $0.26   (Haiku + Sonnet)
  20 complex × $0.0208 = $0.42   (Haiku + Sonnet)
  ──────────────────────────────
  Total: $0.72/month

Savings: $1.28/month (64% reduction)
```

## Best Practices

1. **Always initialize session first** - Session state is required for cost tracking
2. **Check confidence levels** - Use fallback logic for low confidence (<0.7)
3. **Monitor costs** - Use `getCostSummary()` to track monthly expenses
4. **Clean up old sessions** - Run cleanup periodically: `node .claude/tools/router-session-handler.mjs cleanup`
5. **Validate workflow paths** - Ensure workflow files exist before routing
6. **Handle errors gracefully** - Provide fallback workflows for failures
7. **Adjust complexity threshold** - Tune to your workload (higher = more Haiku, lower = more Sonnet)
8. **Track classification performance** - Monitor confidence levels and misclassifications

## Configuration

The router uses settings from `.claude/settings.json`:

```json
{
  "models": {
    "router": "claude-haiku-4-5",
    "orchestrator": "claude-sonnet-4-5"
  },
  "routing": {
    "complexity_threshold": 0.7,
    "cost_optimization_enabled": true,
    "simple_prompt_timeout_ms": 5000
  }
}
```

**Tunable Parameters**:

- `complexity_threshold`: Minimum score to route to orchestrator (default: 0.7, range: 0.5-0.9)
  - Lower value: More requests handled by Haiku (cheaper but may miss complex cases)
  - Higher value: More requests to orchestrator (expensive but ensures complex handling)
- `cost_optimization_enabled`: Enable cost-aware model selection (default: true)
- `simple_prompt_timeout_ms`: Timeout for simple prompt handling (default: 5000ms)

## Session State Files

Session states are stored in `.claude/context/tmp/router-session-{id}.json`:

```json
{
  "session_id": "session-123",
  "created_at": "2025-01-12T10:00:00Z",
  "model": "claude-haiku-4-5",
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

### Issue: Router hook not executing

**Diagnosis**: Hook should run on every prompt but isn't
**Possible Causes**:

- Hook not registered in `.claude/hooks/hook-registry.json`
- Hook disabled (`enabled: false`)
- Settings file invalid or missing

**Solution**:

1. Check hook registry: `cat .claude/hooks/hook-registry.json | grep router-session-entry`
2. Verify enabled: `"enabled": true`
3. Verify settings.json exists: `ls .claude/settings.json`
4. Check hook logs: `tail .claude/context/logs/hooks.log`

### Issue: All requests routing to orchestrator (expensive)

**Diagnosis**: Router always classifies prompts as "complex"
**Possible Causes**:

- Complexity threshold too low (default 0.7 too high for your workload)
- Intent keywords not matching your use cases
- Classification logic too conservative

**Solution**:

1. Lower complexity threshold in `.claude/settings.json`:

```json
{
  "routing": {
    "complexity_threshold": 0.5
  }
}
```

2. Add missing keywords to INTENT_KEYWORDS in router-session-handler.mjs
3. Review classification logs: `node .claude/tools/router-session-handler.mjs classify "your prompt"`

### Issue: Classification is slow (>100ms)

**Diagnosis**: Router hook adds noticeable latency
**Possible Causes**:

- Session initialization slow (file I/O)
- Intent classification timeout
- Workflow selection delay

**Solution**:

1. Check system load: `top` or `Task Manager`
2. Increase timeout: `simple_prompt_timeout_ms: 10000`
3. Profile with: `node .claude/tools/router-session-handler.mjs classify "test" --profile`

### Issue: Wrong workflow selected

**Diagnosis**: Simple prompts classified as complex, or vice versa
**Possible Causes**:

- Intent keywords don't match your domain
- Complexity scoring weights need adjustment
- Ambiguous prompts misclassified

**Solution**:

1. Test classification: `node .claude/tools/router-session-handler.mjs classify "your prompt"`
2. Review classification result for intent and complexity score
3. Adjust COMPLEXITY_THRESHOLDS in router-session-handler.mjs:

```javascript
const COMPLEXITY_THRESHOLDS = {
  TOKEN_WEIGHT: 0.3, // Increase to weight token count more
  ACTION_WEIGHT: 0.4, // Increase to weight action keywords more
  QUESTION_WEIGHT: 0.2,
  FILE_WEIGHT: 0.3,
  ROUTE_THRESHOLD: 0.7,
};
```

### Issue: Session state not persisting

**Diagnosis**: Session files created but not found later
**Possible Causes**:

- `.claude/context/tmp/` directory doesn't exist
- Directory not writable
- Session cleanup deleting recent files

**Solution**:

1. Create directory: `mkdir -p .claude/context/tmp`
2. Check permissions: `ls -la .claude/context/tmp`
3. Disable auto-cleanup temporarily: `SKIP_SESSION_CLEANUP=true npm run test`
4. Check file creation: `ls -la .claude/context/tmp/router-session-*`

### Issue: Cost calculations incorrect

**Diagnosis**: Reported costs don't match expected values
**Possible Causes**:

- MODEL_PRICING outdated or wrong
- Token estimation incorrect
- Cost tracking logic has bugs

**Solution**:

1. Verify pricing: Compare MODEL_PRICING with Anthropic docs
2. Log token counts: Add console.log in trackCosts()
3. Test cost tracking:

```bash
node .claude/tools/router-session-handler.mjs track-costs session-123 claude-haiku-4-5 1000 500
```

4. Check session cost summary: `getCostSummary('session-123')`

### Issue: Router hook interferes with orchestrator

**Diagnosis**: Orchestrator receives duplicate routing information
**Possible Causes**:

- Hook creates routing decision, orchestrator creates another
- Skip_redundant_routing flag not respected

**Solution**:

1. Review hook code: `cat .claude/hooks/router-session-entry.mjs | grep skip_redundant`
2. Verify orchestrator respects the flag:

```javascript
// In orchestrator-entry.mjs
if (sessionContext?.router_classification?.routing_method === 'router_classification') {
  // Use router's workflow, skip re-classification
}
```

3. Check logs for duplicate routing: `grep -i "route.*orchestrator" .claude/context/logs/*.log`

### Issue: Hook crashes with error

**Diagnosis**: [Router Hook] Classification failed in logs
**Possible Causes**:

- Invalid user prompt
- Settings file corrupted
- Missing dependencies

**Solution**:

1. Check the error message: `tail -20 .claude/context/logs/hooks.log`
2. Verify router-first hooks run: `pnpm test:hooks --hook router-first-enforcer.mjs`
3. Test with simple prompt: `node .claude/tools/router-session-handler.mjs classify "hello"`
4. Check dependencies: `npm ls` and verify all modules resolve
5. If corrupted settings: Restore from backup or recreate

## Future Enhancements

- [ ] Machine learning-based intent classification
- [ ] Historical routing pattern analysis
- [ ] Adaptive complexity thresholds
- [ ] Multi-language support
- [ ] Real-time cost optimization
- [ ] Session clustering for analytics

## Related Documentation

- [Router Agent Definition](../agents/router.md)
- [Orchestrator Quick Reference](./ORCHESTRATOR_QUICK_REFERENCE.md)
- [Workflow Guide](../workflows/WORKFLOW-GUIDE.md)
- [Settings Schema](../schemas/settings.schema.json)
