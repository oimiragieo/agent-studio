# A2A Test Framework

Comprehensive test framework for validating Agent-to-Agent (A2A) communication patterns across the orchestration system.

## Overview

This test framework provides isolated, reproducible testing of:

- **Agent Chains**: Sequential agent delegation and artifact flow
- **Template Enforcement**: Task template validation via hooks
- **Security Triggers**: Automatic security keyword detection
- **Verification Protocol**: Post-delegation verification steps
- **Workflow Execution**: Full workflow integration testing
- **Complex Graphs**: Multi-agent parallel patterns

## Architecture

```
.claude/tests/a2a-framework/
├── test-harness.mjs         # Core test harness (A2ATestHarness class)
├── hook-runner.mjs          # Hook subprocess execution
├── test-runner.mjs          # CLI test runner
├── README.md                # This file
│
├── scenarios/               # Test scenario JSON files
│   ├── category-1-agent-chain/
│   ├── category-2-template-enforcement/
│   ├── category-3-security-trigger/
│   ├── category-4-verification-protocol/
│   ├── category-5-workflow-execution/
│   └── category-6-complex-graph/
│
└── fixtures/                # Test fixtures
    ├── mock-agent-responses/
    ├── sample-task-inputs/
    ├── workflow-snapshots/
    └── security-trigger-data/
```

## Quick Start

### Run All Tests

```bash
node .claude/tests/a2a-framework/test-runner.mjs
```

### Run P0 Tests Only (Fast Feedback)

```bash
node .claude/tests/a2a-framework/test-runner.mjs --priority P0
```

### Run Specific Category

```bash
node .claude/tests/a2a-framework/test-runner.mjs --category template-enforcement
```

### Run Single Scenario

```bash
node .claude/tests/a2a-framework/test-runner.mjs --scenario a2a-template-001
```

### Verbose Mode

```bash
node .claude/tests/a2a-framework/test-runner.mjs --verbose
```

### CI Mode (Strict, No Retries)

```bash
node .claude/tests/a2a-framework/test-runner.mjs --ci
```

### Generate Coverage Report

```bash
node .claude/tests/a2a-framework/test-runner.mjs --coverage --format md
```

## CLI Options

| Option                    | Description                   | Example                           |
| ------------------------- | ----------------------------- | --------------------------------- |
| `--scenario <id>`         | Run specific scenario by ID   | `--scenario a2a-template-001`     |
| `--category <name>`       | Run all scenarios in category | `--category template-enforcement` |
| `--priority <P0\|P1\|P2>` | Run scenarios by priority     | `--priority P0`                   |
| `--tags <tag1,tag2>`      | Run scenarios matching tags   | `--tags hook,blocking`            |
| `--verbose`               | Enable verbose logging        | `--verbose`                       |
| `--ci`                    | CI mode (strict, no retries)  | `--ci`                            |
| `--coverage`              | Generate coverage report      | `--coverage`                      |
| `--format <json\|md>`     | Report format                 | `--format markdown`               |
| `--output <path>`         | Output directory for reports  | `--output ./reports`              |
| `--help, -h`              | Show help message             | `--help`                          |

## Test Categories

### 1. Agent Chain (4 scenarios)

Tests sequential agent delegation patterns:

- **a2a-chain-001**: Simple 2-agent chain (developer → code-reviewer)
- **a2a-chain-002**: 3-agent chain (architect → developer → qa)
- **a2a-chain-003**: Chain with rejection and retry
- **a2a-chain-004**: Chain with security agent injection

### 2. Template Enforcement (5 scenarios)

Tests task template validation:

- **a2a-template-001**: Block freeform text prompt (P0)
- **a2a-template-002**: Block partial JSON missing verification (P0)
- **a2a-template-003**: Block invalid JSON syntax (P0)
- **a2a-template-004**: Allow valid complete template (P1)
- **a2a-template-005**: Allow with missing optimization fields (warn) (P1)

### 3. Security Trigger (4 scenarios)

Tests security keyword detection:

- **a2a-security-001**: Detect authentication keywords (P0)
- **a2a-security-002**: Detect multiple security categories (P0)
- **a2a-security-003**: No trigger on non-security task (P1)
- **a2a-security-004**: Security-architect already included (P1)

### 4. Verification Protocol (4 scenarios)

Tests post-delegation verification:

- **a2a-verify-001**: Detect errors in agent output (P0)
- **a2a-verify-002**: Verify deliverables exist (P0)
- **a2a-verify-003**: Extract agent verdict from output (P1)
- **a2a-verify-004**: Handle clean output (no errors/warnings) (P1)

### 5. Workflow Execution (3 scenarios)

Tests full workflow integration:

- **a2a-workflow-001**: Execute code-review workflow (P0)
- **a2a-workflow-002**: Workflow with conditional security step (P1)
- **a2a-workflow-003**: Workflow step failure and retry (P1)

### 6. Complex Graph (2 scenarios)

Tests multi-agent parallel patterns:

- **a2a-graph-001**: Parallel agent execution (P1)
- **a2a-graph-002**: Fan-out and fan-in pattern (P1)

## Scenario Format

Test scenarios are defined in JSON format:

```json
{
  "scenario_id": "a2a-template-001",
  "name": "Block freeform task delegation",
  "description": "Verify that freeform text prompts are blocked",
  "category": "template-enforcement",
  "priority": "P0",
  "tags": ["hook", "blocking", "template"],

  "preconditions": {
    "fixtures": [],
    "state": {},
    "environment": {}
  },

  "steps": [
    {
      "step_id": "invoke-hook",
      "action": "invoke_pretooluse_hook",
      "input": {
        "hook": "agent-task-template-enforcer.mjs",
        "tool_name": "Task",
        "tool_input": {
          "prompt": "implement the login feature"
        }
      },
      "expected": {
        "decision": "block"
      },
      "timeout_ms": 5000
    }
  ],

  "assertions": [
    {
      "type": "hook_decision",
      "target": "steps.invoke-hook.result.decision",
      "operator": "equals",
      "expected": "block"
    }
  ],

  "cleanup": {
    "remove_files": [],
    "restore_state": true
  },

  "metadata": {
    "created_at": "2026-01-16T00:00:00Z",
    "author": "architect",
    "related_hooks": ["agent-task-template-enforcer.mjs"]
  }
}
```

## Action Types

| Action                     | Description                | Input Schema                                 |
| -------------------------- | -------------------------- | -------------------------------------------- |
| `invoke_pretooluse_hook`   | Execute PreToolUse hook    | `{hook, tool_name, tool_input}`              |
| `invoke_posttooluse_hook`  | Execute PostToolUse hook   | `{hook, tool_name, tool_input, tool_result}` |
| `simulate_task_delegation` | Simulate Task tool call    | `agent-task.schema.json` format              |
| `verify_artifact_exists`   | Check artifact creation    | `{path, schema?}`                            |
| `verify_state_change`      | Verify state modification  | `{path, expected}`                           |
| `inject_mock_response`     | Inject mock agent response | `{agent, response}`                          |

## Assertion Operators

| Operator       | Description           | Example                                   |
| -------------- | --------------------- | ----------------------------------------- |
| `equals`       | Exact equality        | `expected: "approve"`                     |
| `contains`     | String/array contains | `expected: "error"`                       |
| `matches`      | Regex match           | `expected: "^BLOCKED:"`                   |
| `exists`       | File/key exists       | `target: ".claude/context/artifacts/..."` |
| `count_equals` | Array length check    | `expected: 3`                             |
| `greater_than` | Numeric comparison    | `expected: 5`                             |
| `less_than`    | Numeric comparison    | `expected: 100`                           |
| `includes_all` | Array contains all    | `expected: ["agent1", "agent2"]`          |

## Programmatic Usage

### Using A2ATestHarness Class

```javascript
import { A2ATestHarness } from '.claude/tests/a2a-framework/test-harness.mjs';

// Initialize harness
const harness = new A2ATestHarness({
  verboseLogging: true,
  timeout: 30000,
});

// Load scenarios
await harness.loadScenarios('.claude/tests/a2a-framework/scenarios');

// Execute all scenarios
const result = await harness.executeAll();

// Or filter by category
const templateResults = await harness.executeFiltered({
  category: 'template-enforcement',
  priority: 'P0',
});

// Get coverage
const coverage = harness.getCoverage();
console.log(`Hooks Coverage: ${coverage.hooks_coverage}%`);

// Generate report
const jsonReport = await harness.generateReport('json');
const mdReport = await harness.generateReport('markdown');

// Cleanup
await harness.cleanup();
```

### Using Hook Runner Directly

```javascript
import { runHook, runPreToolUseHook } from '.claude/tests/a2a-framework/hook-runner.mjs';

// Run hook with raw input
const result = await runHook(
  '.claude/hooks/agent-task-template-enforcer.mjs',
  {
    tool_name: 'Task',
    tool_input: { prompt: 'implement feature' },
  },
  { timeout: 5000 }
);

// Run PreToolUse hook (with parsing)
const decision = await runPreToolUseHook('.claude/hooks/agent-task-template-enforcer.mjs', {
  tool_name: 'Task',
  tool_input: { prompt: 'implement feature' },
});

console.log(`Decision: ${decision.decision}`);
console.log(`Reason: ${decision.reason}`);
```

## Report Formats

### JSON Report

```json
{
  "summary": {
    "total": 18,
    "passed": 16,
    "failed": 2,
    "skipped": 0,
    "duration_ms": 45230,
    "pass_rate": 88.89
  },
  "results": [...],
  "coverage": {
    "hooks_tested": ["agent-task-template-enforcer.mjs", ...],
    "hooks_coverage": 100,
    "categories_tested": ["template-enforcement", ...],
    "scenarios_executed": 18
  }
}
```

### Markdown Report

```markdown
# A2A Test Report

## Summary

| Metric      | Value       |
| ----------- | ----------- |
| Total Tests | 18          |
| Passed      | 16 (88.89%) |
| Failed      | 2           |
| Duration    | 45.23s      |

## Failed Tests

### a2a-template-003: Validate partial JSON handling

**Status**: FAILED
**Category**: template-enforcement
**Duration**: 1.23s

**Failure Details**:

- Step: invoke-with-partial-json
- Expected: decision = "block"
- Actual: decision = "approve"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: A2A Test Suite

on:
  push:
    branches: [main, 'feat/**']
  pull_request:
    branches: [main]

jobs:
  a2a-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run A2A Tests
        run: |
          node .claude/tests/a2a-framework/test-runner.mjs --ci

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: a2a-test-results
          path: .claude/context/reports/a2a-test-results/
```

## Success Metrics

| Metric                 | Target           | Description                      |
| ---------------------- | ---------------- | -------------------------------- |
| P0 pass rate           | 100%             | All critical scenarios must pass |
| P1 pass rate           | >= 95%           | Important scenarios should pass  |
| Total pass rate        | >= 90%           | Overall test suite health        |
| Average execution time | < 500ms/scenario | Performance benchmark            |
| Hook coverage          | 100%             | All hooks tested                 |
| Category coverage      | 100%             | All 6 categories covered         |

## Troubleshooting

### Tests Timeout

Increase timeout in harness config:

```javascript
const harness = new A2ATestHarness({
  timeout: 60000, // 60 seconds
});
```

Or via CLI:

```bash
# Edit test-runner.mjs to increase default timeout
```

### Hook Execution Errors

Enable verbose logging:

```bash
node test-runner.mjs --verbose
```

Check hook stderr output in test results.

### Fixture Loading Fails

Verify fixture paths are correct:

```bash
ls .claude/tests/a2a-framework/fixtures/
```

Ensure fixtures are valid JSON.

## Related Documentation

- **Architecture**: `.claude/docs/TEST_FRAMEWORK_ARCHITECTURE.md`
- **Test Plan**: `.claude/tests/a2a-framework/test-plan.md`
- **Hook Documentation**: `.claude/hooks/README.md`
- **Agent Task Schema**: `.claude/schemas/agent-task.schema.json`

## Contributing

When adding new test scenarios:

1. Create scenario JSON in appropriate category directory
2. Follow scenario schema format
3. Add fixtures if needed
4. Update test plan documentation
5. Run tests to validate
6. Update coverage metrics

## License

Part of LLM-RULES Production Pack. See project LICENSE.
