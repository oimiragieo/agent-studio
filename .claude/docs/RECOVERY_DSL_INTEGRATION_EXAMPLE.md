# Recovery DSL Integration Examples

**Practical integration examples for recovery patterns**

## Table of Contents

1. [Workflow Orchestration Integration](#workflow-orchestration-integration)
2. [Agent Task Integration](#agent-task-integration)
3. [Custom Recovery Pattern Creation](#custom-recovery-pattern-creation)
4. [Testing Custom Patterns](#testing-custom-patterns)
5. [CI/CD Pipeline Integration](#cicd-pipeline-integration)
6. [Real-World Recovery Scenarios](#real-world-recovery-scenarios)

---

## Workflow Orchestration Integration

### Basic Integration

```javascript
// workflow-executor.mjs
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';

class WorkflowExecutor {
  constructor() {
    this.recoveryHandler = new RecoveryHandler();
  }

  async init() {
    await this.recoveryHandler.init();
  }

  async executeWorkflow(workflow) {
    for (const step of workflow.steps) {
      try {
        await this.executeStep(step);
      } catch (error) {
        const recovered = await this.handleFailure(error, step);
        if (!recovered) {
          throw new Error(`Step ${step.id} failed and recovery unsuccessful`);
        }
      }
    }
  }

  async handleFailure(error, step) {
    // Determine failure type from error
    const failure = {
      type: this.determineFailureType(error),
      severity: this.determineSeverity(error),
      metadata: {
        error_message: error.message,
        error_stack: error.stack,
        step_id: step.id,
        agent: step.agent
      }
    };

    // Match failure to recovery pattern
    const pattern = this.recoveryHandler.matchPattern(failure);

    if (!pattern) {
      console.log('No recovery pattern matched');
      return false;
    }

    // Apply recovery pattern
    const context = {
      workflow_id: this.workflowId,
      step_id: step.id,
      retry_count: step.retry_count || 0,
      previous_checkpoint: step.checkpoint
    };

    const result = await this.recoveryHandler.applyPattern(
      pattern,
      failure,
      context
    );

    return this.handleRecoveryResult(result, step);
  }

  determineFailureType(error) {
    // Map error to failure condition
    if (error.code === 'ETIMEDOUT') return 'timeout';
    if (error.message.includes('test failed')) return 'test_failure';
    if (error.message.includes('compilation')) return 'compilation_error';
    if (error.message.includes('ENOTFOUND')) return 'dependency_missing';
    if (error.message.includes('security')) return 'security_violation';
    return 'resource_unavailable';
  }

  determineSeverity(error) {
    // Determine severity based on error characteristics
    if (error.critical) return 'critical';
    if (error.code === 'ETIMEDOUT') return 'medium';
    if (error.message.includes('test failed')) return 'high';
    return 'medium';
  }

  async handleRecoveryResult(result, step) {
    switch (result.action) {
      case 'schedule_retry':
        // Delay and retry
        await this.delay(result.delay_ms);
        step.retry_count = result.retry_count;
        step.timeout *= result.timeout_multiplier;
        return true;

      case 'create_escalation_task':
        // Create new task for escalated agent
        await this.createEscalationTask(result, step);
        return true;

      case 'skip_and_continue':
        // Mark as degraded and continue
        this.markWorkflowDegraded(result.impact);
        return true;

      case 'execute_rollback':
        // Rollback to checkpoint
        await this.rollbackToCheckpoint(result.checkpoint_id);
        return result.halt_after_rollback ? false : true;

      case 'halt_workflow':
        // Halt execution
        await this.haltWorkflow(result);
        return false;

      default:
        return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const executor = new WorkflowExecutor();
await executor.init();
await executor.executeWorkflow(myWorkflow);
```

---

## Agent Task Integration

### Task Wrapper with Recovery

```javascript
// agent-task-runner.mjs
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';

class AgentTaskRunner {
  constructor(agentType) {
    this.agentType = agentType;
    this.recoveryHandler = new RecoveryHandler();
  }

  async init() {
    await this.recoveryHandler.init();
  }

  async runTask(task) {
    const maxRecoveryAttempts = 3;
    let recoveryAttempt = 0;

    while (recoveryAttempt < maxRecoveryAttempts) {
      try {
        const result = await this.executeTask(task);
        return { success: true, result };
      } catch (error) {
        recoveryAttempt++;

        const failure = {
          type: this.classifyError(error),
          severity: this.assessSeverity(error),
          metadata: {
            error_message: error.message,
            task_id: task.task_id,
            agent: this.agentType,
            attempt: recoveryAttempt
          }
        };

        const pattern = this.recoveryHandler.matchPattern(failure);

        if (!pattern) {
          throw new Error(`No recovery pattern for: ${failure.type}`);
        }

        const context = {
          task_id: task.task_id,
          retry_count: recoveryAttempt - 1,
          agent_type: this.agentType
        };

        const recovery = await this.recoveryHandler.applyPattern(
          pattern,
          failure,
          context
        );

        // Handle halt strategy
        if (recovery.strategy === 'halt') {
          throw new Error(`Task halted: ${recovery.reason}`);
        }

        // Handle escalation
        if (recovery.strategy === 'escalate') {
          return {
            success: false,
            escalated: true,
            target_agent: recovery.target_agent,
            recovery
          };
        }

        // Handle skip
        if (recovery.strategy === 'skip') {
          return {
            success: true,
            skipped: true,
            degraded: recovery.mark_degraded,
            recovery
          };
        }

        // Retry strategy - continue loop with delay
        if (recovery.strategy === 'retry') {
          await this.delay(recovery.delay_ms);
          task.timeout_ms *= recovery.timeout_multiplier;
          continue;
        }

        // Rollback strategy
        if (recovery.strategy === 'rollback') {
          await this.performRollback(recovery);
          if (recovery.halt_after_rollback) {
            throw new Error('Task halted after rollback');
          }
          continue;
        }
      }
    }

    throw new Error(`Task failed after ${maxRecoveryAttempts} recovery attempts`);
  }

  classifyError(error) {
    const errorMap = {
      'ETIMEDOUT': 'timeout',
      'ENOTFOUND': 'dependency_missing',
      'ECONNREFUSED': 'resource_unavailable',
      'ERR_ASSERTION': 'test_failure'
    };
    return errorMap[error.code] || 'validation_failure';
  }

  assessSeverity(error) {
    if (error.security) return 'critical';
    if (error.code === 'ETIMEDOUT') return 'medium';
    if (error.name === 'AssertionError') return 'high';
    return 'medium';
  }

  async executeTask(task) {
    // Task execution logic
    throw new Error('Not implemented');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async performRollback(recovery) {
    // Rollback logic
    console.log(`Rolling back to: ${recovery.checkpoint_id}`);
  }
}

// Usage
const runner = new AgentTaskRunner('developer');
await runner.init();

const result = await runner.runTask({
  task_id: 'task-001',
  objective: 'Implement feature X',
  timeout_ms: 120000
});

if (result.escalated) {
  console.log(`Task escalated to: ${result.target_agent}`);
} else if (result.skipped) {
  console.log('Task skipped (degraded workflow)');
} else {
  console.log('Task completed successfully');
}
```

---

## Custom Recovery Pattern Creation

### Example: Database Connection Retry

```json
{
  "pattern_id": "db-connection-retry",
  "name": "Retry Database Connection Failures",
  "description": "Retry database connection failures with exponential backoff. Handles transient network issues and database restarts.",
  "version": "1.0.0",
  "enabled": true,
  "triggers": [
    {
      "condition": "resource_unavailable",
      "severity": "high",
      "threshold": 1,
      "error_pattern": "(ECONNREFUSED|Connection refused|Database unavailable)"
    }
  ],
  "strategy": "retry",
  "priority": 2,
  "tags": ["database", "connection", "retry"],
  "applicable_agents": ["developer", "devops"],
  "retry_policy": {
    "max_attempts": 5,
    "backoff": "exponential",
    "delay_ms": 2000,
    "max_delay_ms": 30000,
    "timeout_multiplier": 1.0,
    "jitter": true,
    "jitter_factor": 0.15
  },
  "conditions": {
    "environment": ["development", "staging", "production"]
  }
}
```

### Example: Deployment Rollback on Validation Failure

```json
{
  "pattern_id": "deploy-validation-rollback",
  "name": "Rollback Deployment on Validation Failure",
  "description": "Rollback deployment if post-deployment validation fails. Prevents broken deployments from staying live.",
  "version": "1.0.0",
  "enabled": true,
  "triggers": [
    {
      "condition": "validation_failure",
      "severity": "high",
      "threshold": 1,
      "error_pattern": "(health check failed|smoke test failed|validation error)"
    }
  ],
  "strategy": "rollback",
  "priority": 1,
  "tags": ["deployment", "rollback", "validation"],
  "applicable_agents": ["devops"],
  "rollback": {
    "target_state": "previous_step",
    "preserve_artifacts": true,
    "cleanup_files": ["dist/*", "build/*"],
    "cleanup_directories": [".cache"],
    "notify_on_rollback": true,
    "halt_workflow_on_rollback": true
  },
  "conditions": {
    "workflow_phase": ["deployment"],
    "environment": ["staging", "production"]
  }
}
```

### Creating Pattern Programmatically

```javascript
// create-recovery-pattern.mjs
import fs from 'fs/promises';
import path from 'path';

async function createRecoveryPattern(config) {
  const pattern = {
    pattern_id: config.id,
    name: config.name,
    description: config.description,
    version: '1.0.0',
    enabled: true,
    triggers: config.triggers,
    strategy: config.strategy,
    priority: config.priority,
    tags: config.tags || [],
    applicable_agents: config.agents || [],
    metadata: {
      created_by: config.creator || 'system',
      created_at: new Date().toISOString(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0
    }
  };

  // Add strategy-specific configuration
  if (config.strategy === 'retry') {
    pattern.retry_policy = config.retry_policy;
  } else if (config.strategy === 'escalate') {
    pattern.escalation = config.escalation;
  } else if (config.strategy === 'skip') {
    pattern.skip = config.skip;
  } else if (config.strategy === 'rollback') {
    pattern.rollback = config.rollback;
  } else if (config.strategy === 'halt') {
    pattern.halt = config.halt;
  }

  // Save pattern
  const patternsDir = '.claude/schemas/recovery-patterns';
  await fs.mkdir(patternsDir, { recursive: true });

  const filename = `${pattern.pattern_id}.json`;
  const filepath = path.join(patternsDir, filename);

  await fs.writeFile(
    filepath,
    JSON.stringify(pattern, null, 2),
    'utf-8'
  );

  console.log(`Created recovery pattern: ${filepath}`);
  return pattern;
}

// Usage
await createRecoveryPattern({
  id: 'custom-api-retry',
  name: 'Retry Custom API Calls',
  description: 'Retry failed API calls with linear backoff',
  triggers: [
    { condition: 'network_error', severity: 'medium' }
  ],
  strategy: 'retry',
  priority: 4,
  retry_policy: {
    max_attempts: 3,
    backoff: 'linear',
    delay_ms: 1000
  }
});
```

---

## Testing Custom Patterns

### Unit Testing Pattern Logic

```javascript
// test-custom-pattern.mjs
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';
import assert from 'assert';

async function testCustomPattern() {
  const handler = new RecoveryHandler();
  await handler.init();

  // Test 1: Pattern loads correctly
  const pattern = handler.patterns.get('custom-api-retry');
  assert(pattern, 'Pattern should be loaded');
  assert.strictEqual(pattern.strategy, 'retry');

  // Test 2: Pattern matches expected failures
  const failure = {
    type: 'network_error',
    severity: 'medium',
    metadata: {}
  };

  const matched = handler.matchPattern(failure);
  assert(matched, 'Pattern should match network_error');
  assert.strictEqual(matched.pattern_id, 'custom-api-retry');

  // Test 3: Recovery executes correctly
  const result = await handler.applyPattern(matched, failure, {});
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.strategy, 'retry');
  assert(result.delay_ms > 0);

  console.log('✓ All pattern tests passed');
}

testCustomPattern().catch(console.error);
```

### Integration Testing

```javascript
// test-pattern-integration.mjs
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';

async function simulateWorkflowWithRecovery() {
  const handler = new RecoveryHandler();
  await handler.init();

  const scenarios = [
    {
      name: 'Timeout Recovery',
      failure: { type: 'timeout', severity: 'medium' },
      expectedStrategy: 'retry'
    },
    {
      name: 'Test Failure Escalation',
      failure: { type: 'test_failure', severity: 'high' },
      expectedStrategy: 'escalate'
    },
    {
      name: 'Security Halt',
      failure: { type: 'security_violation', severity: 'critical' },
      expectedStrategy: 'halt'
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);

    const pattern = handler.matchPattern(scenario.failure);
    assert(pattern, `Should match pattern for ${scenario.name}`);

    const result = await handler.applyPattern(
      pattern,
      scenario.failure,
      {}
    );

    assert.strictEqual(
      result.strategy,
      scenario.expectedStrategy,
      `Should use ${scenario.expectedStrategy} strategy`
    );

    console.log(`✓ ${scenario.name} passed`);
  }
}

simulateWorkflowWithRecovery().catch(console.error);
```

---

## CI/CD Pipeline Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-with-recovery.yml
name: Deploy with Recovery

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: |
          npm install
          node .claude/tools/recovery-handler.mjs --list-patterns

      - name: Run Tests with Recovery
        id: tests
        continue-on-error: true
        run: |
          npm test || {
            echo "Tests failed, attempting recovery..."
            RECOVERY=$(node .claude/tools/recovery-handler.mjs \
              --match --failure test_failure --severity high)
            echo "recovery_result=$RECOVERY" >> $GITHUB_OUTPUT
            exit 1
          }

      - name: Handle Test Recovery
        if: steps.tests.outcome == 'failure'
        run: |
          echo "Recovery pattern matched: ${{ steps.tests.outputs.recovery_result }}"
          # Additional recovery logic here

      - name: Deploy
        run: npm run deploy
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Test with Recovery') {
            steps {
                script {
                    try {
                        sh 'npm test'
                    } catch (Exception e) {
                        def recovery = sh(
                            script: """
                                node .claude/tools/recovery-handler.mjs \
                                  --match --failure test_failure --severity high
                            """,
                            returnStdout: true
                        ).trim()

                        def recoveryResult = readJSON text: recovery

                        if (recoveryResult.strategy == 'escalate') {
                            // Create Jira ticket for developer
                            jiraCreateIssue(
                                site: 'jira',
                                issue: [
                                    summary: 'Test Failure Escalation',
                                    description: recoveryResult.context
                                ]
                            )
                        }

                        throw e
                    }
                }
            }
        }
    }
}
```

---

## Real-World Recovery Scenarios

### Scenario 1: API Rate Limiting

**Problem:** External API returns 429 (rate limit exceeded)

**Solution:** Retry with exponential backoff

```json
{
  "pattern_id": "api-rate-limit-retry",
  "name": "Retry on API Rate Limit",
  "triggers": [
    {
      "condition": "rate_limit_exceeded",
      "severity": "low",
      "error_pattern": "(429|rate limit|too many requests)"
    }
  ],
  "strategy": "retry",
  "priority": 5,
  "retry_policy": {
    "max_attempts": 5,
    "backoff": "exponential",
    "delay_ms": 5000,
    "max_delay_ms": 300000,
    "jitter": true
  }
}
```

### Scenario 2: Flaky E2E Tests

**Problem:** UI tests fail intermittently due to timing issues

**Solution:** Skip flaky tests, mark as degraded

```json
{
  "pattern_id": "skip-flaky-e2e",
  "name": "Skip Known Flaky E2E Tests",
  "triggers": [
    {
      "condition": "test_failure",
      "severity": "low",
      "error_pattern": "(TimeoutError|Element not found|StaleElementReference)"
    }
  ],
  "strategy": "skip",
  "priority": 7,
  "skip": {
    "reason": "Known flaky E2E test - tracked in JIRA-5678",
    "impact": "minor",
    "continue_workflow": true,
    "mark_workflow_degraded": true
  }
}
```

### Scenario 3: Database Migration Failure

**Problem:** Migration script fails, needs rollback

**Solution:** Rollback to previous schema version

```json
{
  "pattern_id": "db-migration-rollback",
  "name": "Rollback Failed Database Migration",
  "triggers": [
    {
      "condition": "validation_failure",
      "severity": "high",
      "error_pattern": "(migration failed|schema error|constraint violation)"
    }
  ],
  "strategy": "rollback",
  "priority": 1,
  "rollback": {
    "target_state": "previous_step",
    "cleanup_files": ["migrations/temp/*"],
    "preserve_artifacts": true,
    "restore_files": [
      {
        "source": ".backups/schema.sql",
        "destination": "db/schema.sql"
      }
    ],
    "notify_on_rollback": true,
    "halt_workflow_on_rollback": true
  }
}
```

### Scenario 4: Build Server Out of Memory

**Problem:** Build fails due to OOM error

**Solution:** Halt workflow, notify ops team

```json
{
  "pattern_id": "build-oom-halt",
  "name": "Halt on Build OOM",
  "triggers": [
    {
      "condition": "memory_exhausted",
      "severity": "critical",
      "error_pattern": "(out of memory|OOM|heap overflow)"
    }
  ],
  "strategy": "halt",
  "priority": 1,
  "halt": {
    "reason": "Build server out of memory - requires infrastructure scaling",
    "cleanup_required": true,
    "preserve_logs": true,
    "notify": ["orchestrator", "on_call"],
    "notification_channels": ["log", "pagerduty"],
    "create_incident": true,
    "incident_severity": "high"
  }
}
```

### Scenario 5: Transient Network Errors

**Problem:** npm install fails due to registry timeout

**Solution:** Retry with linear backoff

```json
{
  "pattern_id": "npm-install-retry",
  "name": "Retry npm Install on Network Error",
  "triggers": [
    {
      "condition": "dependency_missing",
      "severity": "medium",
      "error_pattern": "(ETIMEDOUT|ENOTFOUND|registry error)"
    }
  ],
  "strategy": "retry",
  "priority": 3,
  "retry_policy": {
    "max_attempts": 4,
    "backoff": "linear",
    "delay_ms": 3000,
    "jitter": true
  }
}
```

---

## Summary

Recovery DSL integrates with:

- **Workflow Orchestration**: Automatic failure handling in multi-step workflows
- **Agent Tasks**: Per-agent recovery strategies
- **CI/CD Pipelines**: Resilient deployment pipelines
- **Custom Patterns**: Domain-specific recovery logic

**Key Principles:**

1. **Match failures to patterns**: Use condition, severity, error pattern
2. **Execute recovery strategy**: retry, escalate, skip, rollback, halt
3. **Handle recovery result**: Schedule retry, create escalation, mark degraded
4. **Log all attempts**: Maintain audit trail
5. **Test patterns**: Validate before production

---

**See Also:**
- [Recovery DSL Guide](./RECOVERY_DSL_GUIDE.md)
- [Recovery Quick Reference](./RECOVERY_DSL_QUICK_REFERENCE.md)
- [Recovery Pattern Schema](./../schemas/recovery-pattern.schema.json)
