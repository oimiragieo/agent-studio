# Recovery DSL Guide

**Version:** 1.0.0
**Last Updated:** 2025-01-15

## Table of Contents

1. [Overview](#overview)
2. [Recovery Strategies](#recovery-strategies)
3. [Pattern Structure](#pattern-structure)
4. [Trigger Conditions](#trigger-conditions)
5. [Strategy Implementations](#strategy-implementations)
6. [Testing Recovery Patterns](#testing-recovery-patterns)
7. [CI/CD Integration](#cicd-integration)
8. [Best Practices](#best-practices)
9. [Examples](#examples)

---

## Overview

The Recovery DSL (Domain-Specific Language) provides automated failure recovery for workflow orchestration. When tasks fail, the recovery handler automatically matches failures to recovery patterns and executes appropriate recovery strategies.

### Why Recovery DSL?

- **Automated Recovery**: Reduce manual intervention for common failures
- **Consistent Handling**: Standardized responses to failure conditions
- **Faster Resolution**: Immediate recovery attempts without human delay
- **Better Logging**: Comprehensive audit trail of all recovery attempts
- **Configurable**: Customize recovery behavior per failure type

### Architecture

```
Failure Occurs
    ↓
Recovery Handler
    ↓
Pattern Matching (severity, condition, metadata)
    ↓
Strategy Selection (retry, escalate, skip, rollback, halt)
    ↓
Strategy Execution
    ↓
Logging & State Update
```

---

## Recovery Strategies

The Recovery DSL supports 5 core strategies:

| Strategy     | Use Case                           | Automation Level | Risk Level |
| ------------ | ---------------------------------- | ---------------- | ---------- |
| **Retry**    | Transient failures                 | High             | Low        |
| **Escalate** | Complex issues needing expertise   | Medium           | Low        |
| **Skip**     | Non-critical failures              | Medium           | Medium     |
| **Rollback** | State corruption, breaking changes | Low              | High       |
| **Halt**     | Critical failures, security issues | Low              | Critical   |

### When to Use Each Strategy

#### 1. Retry

**Use When:**

- Network timeouts or transient connectivity issues
- Temporary resource unavailability (API rate limits)
- Dependency installation failures (npm registry issues)
- Slow-responding external services

**Don't Use When:**

- Compilation or syntax errors (code-level issues)
- Authentication failures (credentials invalid)
- Schema validation errors (data structure issues)

**Example:**

```json
{
  "strategy": "retry",
  "retry_policy": {
    "max_attempts": 3,
    "backoff": "exponential",
    "delay_ms": 1000,
    "timeout_multiplier": 1.5
  }
}
```

#### 2. Escalate

**Use When:**

- Test failures indicating code defects
- Compilation errors requiring developer fixes
- Complex issues beyond current agent's capability
- Repeated failures of the same operation

**Don't Use When:**

- Simple transient errors (use retry)
- Issues that can be skipped (use skip)
- Critical security violations (use halt)

**Example:**

```json
{
  "strategy": "escalate",
  "escalation": {
    "to_agent": "developer",
    "context": "Multiple test failures detected",
    "timeout_multiplier": 2.0,
    "include_artifacts": true
  }
}
```

#### 3. Skip

**Use When:**

- Non-critical test failures (e.g., flaky tests)
- Optional validation steps
- Features that can be degraded gracefully
- Steps with alternative workarounds

**Don't Use When:**

- Security validation failures
- Data integrity checks
- Required functionality tests

**Example:**

```json
{
  "strategy": "skip",
  "skip": {
    "reason": "Non-critical UI test flakiness",
    "impact": "minor",
    "continue_workflow": true,
    "mark_workflow_degraded": true
  }
}
```

#### 4. Rollback

**Use When:**

- Breaking changes introduced
- Database migration failures
- Configuration errors causing instability
- State corruption detected

**Don't Use When:**

- Transient failures (use retry)
- Issues that don't affect state
- Forward-only migrations (can't rollback)

**Example:**

```json
{
  "strategy": "rollback",
  "rollback": {
    "target_state": "previous_step",
    "preserve_artifacts": true,
    "cleanup_files": ["dist/*", "*.tmp"],
    "halt_workflow_on_rollback": false
  }
}
```

#### 5. Halt

**Use When:**

- Critical security vulnerabilities detected
- Data corruption or integrity violations
- Infrastructure failures (database down)
- Unrecoverable system errors

**Don't Use When:**

- Recoverable errors (use retry or escalate)
- Non-critical issues (use skip)

**Example:**

```json
{
  "strategy": "halt",
  "halt": {
    "reason": "Critical security violation detected",
    "cleanup_required": true,
    "preserve_state": true,
    "notify": ["orchestrator", "security_team"],
    "create_incident": true
  }
}
```

---

## Pattern Structure

### Required Fields

Every recovery pattern must include:

```json
{
  "pattern_id": "unique-identifier",
  "name": "Human-readable name",
  "triggers": [
    {
      "condition": "failure_type",
      "severity": "low|medium|high|critical"
    }
  ],
  "strategy": "retry|escalate|skip|rollback|halt",
  "priority": 1
}
```

### Optional Fields

- `description`: Detailed explanation of pattern usage
- `version`: Semantic version (default: "1.0.0")
- `enabled`: Enable/disable pattern (default: true)
- `tags`: Categorization tags
- `applicable_agents`: Limit to specific agent types
- `conditions`: Additional activation conditions
- `metrics`: Performance tracking configuration

### Complete Example

```json
{
  "pattern_id": "timeout-retry-exponential",
  "name": "Retry on Timeout with Exponential Backoff",
  "description": "Automatically retry operations that timeout",
  "version": "1.0.0",
  "enabled": true,
  "triggers": [
    {
      "condition": "timeout",
      "severity": "medium",
      "threshold": 1,
      "timeframe_minutes": 60
    }
  ],
  "strategy": "retry",
  "priority": 3,
  "tags": ["timeout", "retry", "network"],
  "retry_policy": {
    "max_attempts": 3,
    "backoff": "exponential",
    "delay_ms": 1000,
    "timeout_multiplier": 1.5
  }
}
```

---

## Trigger Conditions

### Available Conditions

| Condition                | Description                    | Typical Severity |
| ------------------------ | ------------------------------ | ---------------- |
| `timeout`                | Operation exceeded time limit  | Medium           |
| `test_failure`           | Test suite or test case failed | High             |
| `compilation_error`      | Build or compilation failed    | High             |
| `dependency_missing`     | Package/module not found       | Medium           |
| `resource_unavailable`   | Service/API unreachable        | High             |
| `validation_failure`     | Schema/data validation failed  | Medium           |
| `security_violation`     | Security check failed          | Critical         |
| `network_error`          | Network connectivity issue     | Medium           |
| `authentication_failure` | Auth credentials invalid       | High             |
| `rate_limit_exceeded`    | API rate limit hit             | Low              |
| `disk_space_low`         | Insufficient disk space        | High             |
| `memory_exhausted`       | Out of memory                  | Critical         |

### Severity Levels

| Level    | Impact      | Response Time | Example                           |
| -------- | ----------- | ------------- | --------------------------------- |
| Low      | Minimal     | Hours         | Rate limit warning                |
| Medium   | Moderate    | Minutes       | Timeout, dependency missing       |
| High     | Significant | Immediate     | Test failures, compilation errors |
| Critical | Severe      | Immediate     | Security violations, data loss    |

### Threshold and Timeframe

Control when patterns trigger based on occurrence frequency:

```json
{
  "condition": "test_failure",
  "severity": "high",
  "threshold": 3,
  "timeframe_minutes": 30
}
```

**Meaning:** Trigger only if 3+ test failures occur within 30 minutes.

### Error Pattern Matching

Use regex to match specific error messages:

```json
{
  "condition": "dependency_missing",
  "severity": "medium",
  "error_pattern": "(ENOTFOUND|ETIMEDOUT|npm ERR!)"
}
```

---

## Strategy Implementations

### Retry Policy

#### Backoff Strategies

**1. Fixed Backoff**

Same delay between all retry attempts.

```json
{
  "backoff": "fixed",
  "delay_ms": 5000
}
```

Delays: 5s, 5s, 5s

**2. Linear Backoff**

Delay increases linearly with attempt number.

```json
{
  "backoff": "linear",
  "delay_ms": 2000
}
```

Delays: 2s, 4s, 6s

**3. Exponential Backoff** (Recommended)

Delay doubles with each attempt.

```json
{
  "backoff": "exponential",
  "delay_ms": 1000,
  "max_delay_ms": 60000
}
```

Delays: 1s, 2s, 4s (capped at max_delay_ms)

#### Jitter

Add randomness to prevent thundering herd:

```json
{
  "jitter": true,
  "jitter_factor": 0.1
}
```

Delay becomes: `delay ± (delay × jitter_factor × random())`

#### Timeout Multiplier

Increase timeout on each retry:

```json
{
  "timeout_multiplier": 1.5
}
```

If initial timeout = 10s:

- Attempt 1: 10s timeout
- Attempt 2: 15s timeout
- Attempt 3: 22.5s timeout

#### Complete Retry Policy

```json
{
  "retry_policy": {
    "max_attempts": 3,
    "backoff": "exponential",
    "delay_ms": 1000,
    "max_delay_ms": 60000,
    "timeout_multiplier": 1.5,
    "jitter": true,
    "jitter_factor": 0.1,
    "reset_on_success": true
  }
}
```

### Escalation Policy

#### Basic Escalation

```json
{
  "escalation": {
    "to_agent": "developer",
    "context": "Additional context for escalated agent",
    "timeout_multiplier": 2.0
  }
}
```

#### Escalation Chain

Escalate through multiple agents:

```json
{
  "escalation": {
    "escalation_chain": ["developer", "architect", "security-architect"],
    "max_escalations": 3,
    "priority_boost": "high"
  }
}
```

First escalation → developer
Second escalation → architect
Third escalation → security-architect

#### Including Context

```json
{
  "escalation": {
    "to_agent": "developer",
    "include_artifacts": true,
    "include_logs": true
  }
}
```

### Rollback Policy

#### Target States

```json
{
  "rollback": {
    "target_state": "previous_step"
  }
}
```

Options:

- `previous_step`: Roll back to last completed step
- `workflow_start`: Roll back to workflow start
- `last_checkpoint`: Roll back to most recent checkpoint
- `custom`: Roll back to specific checkpoint (requires `custom_checkpoint_id`)

#### Cleanup

```json
{
  "rollback": {
    "cleanup_files": ["dist/*", "build/*", "*.tmp"],
    "cleanup_directories": ["node_modules/.cache"],
    "preserve_artifacts": true
  }
}
```

#### Restore Files

```json
{
  "rollback": {
    "restore_files": [
      {
        "source": ".claude/backups/config.json",
        "destination": "config/config.json"
      }
    ]
  }
}
```

### Skip Policy

#### Basic Skip

```json
{
  "skip": {
    "reason": "Non-critical UI test flakiness",
    "impact": "minor",
    "continue_workflow": true
  }
}
```

#### Alternative Steps

Provide alternative steps to execute:

```json
{
  "skip": {
    "reason": "Main deployment path unavailable",
    "impact": "minor",
    "alternative_steps": [
      {
        "agent": "devops",
        "task": "Deploy using backup method",
        "timeout_minutes": 30
      }
    ]
  }
}
```

#### Require Approval

```json
{
  "skip": {
    "require_approval": true
  }
}
```

### Halt Policy

#### Basic Halt

```json
{
  "halt": {
    "reason": "Critical security violation detected",
    "cleanup_required": true,
    "preserve_state": true
  }
}
```

#### Notifications

```json
{
  "halt": {
    "notify": ["orchestrator", "user", "security_team"],
    "notification_channels": ["log", "email", "slack"],
    "create_incident": true,
    "incident_severity": "critical"
  }
}
```

---

## Testing Recovery Patterns

### Using the Test Command

```bash
node .claude/tools/recovery-handler.mjs --test
```

This runs predefined test scenarios for all loaded patterns.

### Testing Specific Pattern

```bash
node .claude/tools/recovery-handler.mjs --apply \
  --pattern timeout-retry \
  --failure timeout
```

### Matching Failures

```bash
node .claude/tools/recovery-handler.mjs --match \
  --failure test_failure \
  --severity high
```

### Pattern Validation

Validate pattern structure:

```bash
node .claude/tools/validate-schema.mjs \
  --schema .claude/schemas/recovery-pattern.schema.json \
  --input .claude/schemas/recovery-patterns/timeout-retry.json
```

---

## CI/CD Integration

### Pre-Deployment Validation

Add to CI pipeline:

```yaml
# .github/workflows/validate-recovery.yml
name: Validate Recovery Patterns

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Validate Recovery Patterns
        run: |
          node .claude/tools/recovery-handler.mjs --test
          node .claude/tools/recovery-handler.mjs --list-patterns
```

### Runtime Recovery

Integrate with workflow execution:

```javascript
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';

const handler = new RecoveryHandler();
await handler.init();

try {
  await executeTask();
} catch (error) {
  const failure = {
    type: 'timeout',
    severity: 'medium',
    metadata: { error_message: error.message },
  };

  const pattern = handler.matchPattern(failure);
  if (pattern) {
    const result = await handler.applyPattern(pattern, failure);
    // Handle recovery result
  }
}
```

---

## Best Practices

### 1. Priority Ordering

Lower priority number = higher precedence:

```json
{
  "pattern_id": "critical-halt",
  "priority": 1
}
```

```json
{
  "pattern_id": "timeout-retry",
  "priority": 5
}
```

### 2. Conservative Max Attempts

Don't retry forever:

```json
{
  "retry_policy": {
    "max_attempts": 3 // Not 10+
  }
}
```

### 3. Always Use Jitter

Prevent thundering herd with retry jitter:

```json
{
  "retry_policy": {
    "jitter": true,
    "jitter_factor": 0.1
  }
}
```

### 4. Preserve State on Critical Failures

Always preserve state for debugging:

```json
{
  "halt": {
    "preserve_state": true,
    "preserve_artifacts": true,
    "preserve_logs": true
  }
}
```

### 5. Include Context in Escalations

Provide helpful context:

```json
{
  "escalation": {
    "context": "Specific guidance for escalated agent",
    "include_artifacts": true,
    "include_logs": true
  }
}
```

### 6. Tag Patterns

Use tags for discovery and filtering:

```json
{
  "tags": ["timeout", "retry", "network", "transient"]
}
```

### 7. Track Metrics

Enable metrics tracking:

```json
{
  "metrics": {
    "success_rate_threshold": 0.7,
    "track_execution_time": true
  }
}
```

### 8. Version Patterns

Use semantic versioning:

```json
{
  "version": "1.2.0"
}
```

---

## Examples

### Example 1: API Timeout Retry

**Scenario:** External API sometimes times out due to high load.

```json
{
  "pattern_id": "api-timeout-retry",
  "name": "Retry API Timeouts",
  "triggers": [
    {
      "condition": "timeout",
      "severity": "medium",
      "error_pattern": "(ETIMEDOUT|Request timeout)"
    }
  ],
  "strategy": "retry",
  "priority": 4,
  "retry_policy": {
    "max_attempts": 4,
    "backoff": "exponential",
    "delay_ms": 2000,
    "timeout_multiplier": 1.3,
    "jitter": true
  }
}
```

### Example 2: Test Failure Escalation

**Scenario:** Repeated test failures need developer attention.

```json
{
  "pattern_id": "test-escalate-developer",
  "name": "Escalate Test Failures",
  "triggers": [
    {
      "condition": "test_failure",
      "severity": "high",
      "threshold": 2,
      "timeframe_minutes": 15
    }
  ],
  "strategy": "escalate",
  "priority": 2,
  "escalation": {
    "to_agent": "developer",
    "context": "Multiple test failures within 15 minutes",
    "timeout_multiplier": 2.0,
    "include_logs": true
  }
}
```

### Example 3: Skip Flaky UI Tests

**Scenario:** Known flaky UI tests shouldn't block deployment.

```json
{
  "pattern_id": "skip-flaky-ui-tests",
  "name": "Skip Known Flaky UI Tests",
  "triggers": [
    {
      "condition": "test_failure",
      "severity": "low",
      "error_pattern": "(UI test timeout|Selenium timeout)"
    }
  ],
  "strategy": "skip",
  "priority": 6,
  "skip": {
    "reason": "Known flaky UI tests - tracked in JIRA-1234",
    "impact": "minor",
    "continue_workflow": true,
    "mark_workflow_degraded": true
  }
}
```

### Example 4: Database Migration Rollback

**Scenario:** Failed database migration needs rollback.

```json
{
  "pattern_id": "db-migration-rollback",
  "name": "Rollback Failed DB Migration",
  "triggers": [
    {
      "condition": "validation_failure",
      "severity": "high",
      "error_pattern": "(migration failed|schema error)"
    }
  ],
  "strategy": "rollback",
  "priority": 2,
  "rollback": {
    "target_state": "previous_step",
    "cleanup_files": ["migrations/temp/*"],
    "preserve_artifacts": true,
    "notify_on_rollback": true
  }
}
```

### Example 5: Security Violation Halt

**Scenario:** Security vulnerability detected - halt immediately.

```json
{
  "pattern_id": "security-halt",
  "name": "Halt on Security Violation",
  "triggers": [
    {
      "condition": "security_violation",
      "severity": "critical",
      "threshold": 1
    }
  ],
  "strategy": "halt",
  "priority": 1,
  "halt": {
    "reason": "Critical security vulnerability detected",
    "cleanup_required": false,
    "preserve_state": true,
    "notify": ["orchestrator", "security_team", "on_call"],
    "create_incident": true,
    "incident_severity": "critical"
  }
}
```

---

## Troubleshooting

### Pattern Not Triggering

**Check:**

1. Pattern is enabled: `"enabled": true`
2. Trigger condition matches failure type
3. Severity threshold is met
4. Threshold count reached within timeframe
5. Error pattern regex matches (if specified)

### Recovery Failing

**Check:**

1. Recovery logs: `.claude/context/logs/recovery.log`
2. Recovery state: `.claude/context/runtime/recovery/recovery-state.json`
3. Pattern configuration is valid
4. Required resources available (e.g., checkpoints for rollback)

### Too Many Retries

**Adjust:**

```json
{
  "retry_policy": {
    "max_attempts": 2 // Reduce from default 3
  }
}
```

### Pattern Priority Conflicts

**Solution:** Assign distinct priorities:

- Critical halts: 1-2
- Escalations: 2-4
- Retries: 3-6
- Skips: 5-8

---

## Summary

The Recovery DSL provides:

- **5 Recovery Strategies**: retry, escalate, skip, rollback, halt
- **12 Failure Conditions**: timeout, test_failure, compilation_error, etc.
- **4 Severity Levels**: low, medium, high, critical
- **3 Backoff Strategies**: fixed, linear, exponential
- **Flexible Triggering**: thresholds, timeframes, error patterns
- **Comprehensive Logging**: audit trail of all recovery attempts

Use recovery patterns to build resilient, self-healing workflow orchestration.

---

**See Also:**

- [Recovery DSL Quick Reference](./RECOVERY_DSL_QUICK_REFERENCE.md)
- [Recovery Integration Examples](./RECOVERY_DSL_INTEGRATION_EXAMPLE.md)
- [Recovery Pattern Schema](./../schemas/recovery-pattern.schema.json)
