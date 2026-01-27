# Workflow Library

This directory contains the core workflow execution engine and related utilities for the multi-agent orchestration system.

## Files

| File | Purpose |
|------|---------|
| `workflow-engine.cjs` | Core workflow execution engine - runs workflow steps, manages state |
| `workflow-validator.cjs` | Validates workflow definitions against schema before execution |
| `workflow-cli.cjs` | CLI interface for running workflows from command line |
| `checkpoint-manager.cjs` | Manages workflow checkpoints for recovery and resumption |
| `saga-coordinator.cjs` | Coordinates saga patterns for distributed transactions |
| `step-validators.cjs` | Validates individual workflow step inputs/outputs |
| `cross-workflow-trigger.cjs` | Handles triggering workflows from other workflows |
| `workflow-integration.test.cjs` | Integration tests for the workflow system |

## Usage

```javascript
const { WorkflowEngine } = require('./workflow-engine.cjs');
const { validateWorkflow } = require('./workflow-validator.cjs');

// Validate workflow definition
const errors = validateWorkflow(workflowDef);
if (errors.length === 0) {
  // Execute workflow
  const engine = new WorkflowEngine(workflowDef);
  await engine.run();
}
```

## Testing

Each module has a corresponding `.test.cjs` file. Run tests with:

```bash
node --test .claude/lib/workflow/*.test.cjs
```

## Related

- Workflow definitions: `.claude/workflows/`
- Workflow schemas: `.claude/schemas/workflow-schema.json`
