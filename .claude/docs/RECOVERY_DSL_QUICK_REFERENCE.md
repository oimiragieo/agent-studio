# Recovery DSL Quick Reference

**Quick lookup guide for recovery patterns**

## Strategy Decision Tree

```
Failure Occurs
    ↓
Is it transient/temporary?
    YES → RETRY (exponential backoff)
    NO → ↓

Is it fixable by another agent?
    YES → ESCALATE (to appropriate agent)
    NO → ↓

Is it critical/security-related?
    YES → HALT (preserve state, notify)
    NO → ↓

Can we continue without this step?
    YES → SKIP (mark degraded, continue)
    NO → ↓

Can we revert to previous state?
    YES → ROLLBACK (cleanup, restore)
    NO → HALT (cannot recover)
```

---

## Trigger Conditions Quick Reference

| Condition                | Typical Cause                 | Severity | Recommended Strategy |
| ------------------------ | ----------------------------- | -------- | -------------------- |
| `timeout`                | Network delay, slow service   | Medium   | Retry                |
| `test_failure`           | Code defects, environment     | High     | Escalate             |
| `compilation_error`      | Syntax errors, type errors    | High     | Escalate             |
| `dependency_missing`     | npm registry, network         | Medium   | Retry                |
| `resource_unavailable`   | Service down, API unreachable | High     | Retry → Escalate     |
| `validation_failure`     | Schema errors, data issues    | Medium   | Escalate             |
| `security_violation`     | Vuln detected, auth failure   | Critical | Halt                 |
| `network_error`          | Connectivity issues           | Medium   | Retry                |
| `authentication_failure` | Invalid credentials           | High     | Halt                 |
| `rate_limit_exceeded`    | API quota exceeded            | Low      | Retry (long delay)   |
| `disk_space_low`         | Storage full                  | High     | Halt                 |
| `memory_exhausted`       | OOM condition                 | Critical | Halt                 |

---

## Severity Levels

| Level    | Priority | Response  | Example Use Cases                    |
| -------- | -------- | --------- | ------------------------------------ |
| Low      | 4        | Hours     | Rate limit warnings, deprecation     |
| Medium   | 3        | Minutes   | Timeouts, missing dependencies       |
| High     | 2        | Immediate | Test failures, compilation errors    |
| Critical | 1        | Immediate | Security violations, data corruption |

---

## Backoff Strategies Comparison

| Strategy    | Formula               | Example Delays (1s base) | Best For                          |
| ----------- | --------------------- | ------------------------ | --------------------------------- |
| Fixed       | delay                 | 1s, 1s, 1s               | Predictable retry timing          |
| Linear      | delay × attempt       | 1s, 2s, 3s               | Gradual backoff                   |
| Exponential | delay × 2^(attempt-1) | 1s, 2s, 4s, 8s           | Network/API retries (recommended) |

**Add Jitter:** Always enable to prevent thundering herd:

```json
{
  "jitter": true,
  "jitter_factor": 0.1
}
```

---

## Common Failure → Recovery Mappings

### Network/API Failures

```json
{
  "pattern_id": "network-retry",
  "triggers": [
    { "condition": "timeout", "severity": "medium" },
    { "condition": "network_error", "severity": "medium" }
  ],
  "strategy": "retry",
  "retry_policy": {
    "max_attempts": 3,
    "backoff": "exponential",
    "delay_ms": 1000
  }
}
```

### Code/Build Failures

```json
{
  "pattern_id": "code-escalate",
  "triggers": [
    { "condition": "compilation_error", "severity": "high" },
    { "condition": "test_failure", "severity": "high", "threshold": 2 }
  ],
  "strategy": "escalate",
  "escalation": {
    "to_agent": "developer",
    "timeout_multiplier": 2.0
  }
}
```

### Security Failures

```json
{
  "pattern_id": "security-halt",
  "triggers": [{ "condition": "security_violation", "severity": "critical" }],
  "strategy": "halt",
  "halt": {
    "notify": ["orchestrator", "security_team"],
    "create_incident": true
  }
}
```

### Dependency Failures

```json
{
  "pattern_id": "dependency-retry",
  "triggers": [{ "condition": "dependency_missing", "severity": "medium" }],
  "strategy": "retry",
  "retry_policy": {
    "max_attempts": 4,
    "backoff": "linear",
    "delay_ms": 2000
  }
}
```

### Non-Critical Test Failures

```json
{
  "pattern_id": "flaky-test-skip",
  "triggers": [{ "condition": "test_failure", "severity": "low" }],
  "strategy": "skip",
  "skip": {
    "reason": "Known flaky test",
    "impact": "minor",
    "continue_workflow": true
  }
}
```

---

## CLI Commands Cheat Sheet

### Test All Patterns

```bash
node .claude/tools/recovery-handler.mjs --test
```

### List Loaded Patterns

```bash
node .claude/tools/recovery-handler.mjs --list-patterns
```

### Apply Specific Pattern

```bash
node .claude/tools/recovery-handler.mjs --apply \
  --pattern <pattern-id> \
  --failure <condition>
```

### Match Failure to Pattern

```bash
node .claude/tools/recovery-handler.mjs --match \
  --failure <condition> \
  --severity <level>
```

### View Statistics

```bash
node .claude/tools/recovery-handler.mjs --stats
```

### Validate Pattern Schema

```bash
node .claude/tools/validate-schema.mjs \
  --schema .claude/schemas/recovery-pattern.schema.json \
  --input .claude/schemas/recovery-patterns/<pattern>.json
```

---

## Pattern Priority Guidelines

| Priority | Strategy Type          | Example                              |
| -------- | ---------------------- | ------------------------------------ |
| 1        | Critical Halt          | Security violations, data corruption |
| 2        | High Priority Escalate | Compilation errors, test failures    |
| 3-4      | Standard Retry         | Timeouts, network errors             |
| 5-6      | Low Priority Skip      | Flaky tests, optional validations    |
| 7-8      | Informational          | Warnings, deprecations               |

---

## Required vs Optional Fields

### Minimal Pattern (Required Only)

```json
{
  "pattern_id": "simple-retry",
  "name": "Simple Retry Pattern",
  "triggers": [{ "condition": "timeout", "severity": "medium" }],
  "strategy": "retry",
  "priority": 5,
  "retry_policy": {
    "max_attempts": 3
  }
}
```

### Full-Featured Pattern (All Fields)

```json
{
  "pattern_id": "advanced-escalate",
  "name": "Advanced Escalation Pattern",
  "description": "Detailed description",
  "version": "1.0.0",
  "enabled": true,
  "triggers": [
    {
      "condition": "test_failure",
      "severity": "high",
      "threshold": 2,
      "timeframe_minutes": 30,
      "error_pattern": "(AssertionError|Test failed)"
    }
  ],
  "strategy": "escalate",
  "priority": 2,
  "tags": ["testing", "escalation"],
  "applicable_agents": ["qa"],
  "escalation": {
    "to_agent": "developer",
    "context": "Multiple test failures detected",
    "timeout_multiplier": 2.0,
    "priority_boost": "high",
    "include_artifacts": true,
    "include_logs": true,
    "max_escalations": 2
  },
  "conditions": {
    "workflow_phase": ["testing"]
  },
  "metrics": {
    "success_rate_threshold": 0.8,
    "track_execution_time": true
  }
}
```

---

## Troubleshooting Quick Fixes

### Pattern Not Triggering

**Check List:**

- [ ] Pattern enabled: `"enabled": true`
- [ ] Condition matches failure type
- [ ] Severity level correct
- [ ] Threshold reached (if specified)
- [ ] Error pattern matches (if specified)

**Debug Command:**

```bash
node .claude/tools/recovery-handler.mjs --match \
  --failure <your-failure-type> \
  --severity <level>
```

### Too Many Retries

**Quick Fix:** Reduce max_attempts

```json
{
  "retry_policy": {
    "max_attempts": 2 // Down from 3+
  }
}
```

### Recovery Not Working

**Check Logs:**

```bash
cat .claude/context/logs/recovery.log
```

**Check State:**

```bash
cat .claude/context/runtime/recovery/recovery-state.json
```

### Pattern Priority Conflicts

**Solution:** Ensure unique priorities for critical patterns

```json
// Critical patterns
{ "pattern_id": "security-halt", "priority": 1 }
{ "pattern_id": "data-corruption-halt", "priority": 1 }  // ❌ CONFLICT

// Fixed
{ "pattern_id": "security-halt", "priority": 1 }
{ "pattern_id": "data-corruption-halt", "priority": 2 }  // ✅ UNIQUE
```

---

## Strategy-Specific Quick Reference

### Retry Strategy

**Minimal:**

```json
{
  "strategy": "retry",
  "retry_policy": {
    "max_attempts": 3
  }
}
```

**Recommended:**

```json
{
  "strategy": "retry",
  "retry_policy": {
    "max_attempts": 3,
    "backoff": "exponential",
    "delay_ms": 1000,
    "max_delay_ms": 60000,
    "jitter": true
  }
}
```

### Escalate Strategy

**Minimal:**

```json
{
  "strategy": "escalate",
  "escalation": {
    "to_agent": "developer"
  }
}
```

**Recommended:**

```json
{
  "strategy": "escalate",
  "escalation": {
    "to_agent": "developer",
    "context": "Helpful context here",
    "include_artifacts": true,
    "include_logs": true
  }
}
```

### Skip Strategy

**Minimal:**

```json
{
  "strategy": "skip",
  "skip": {
    "reason": "Skip reason",
    "impact": "minor"
  }
}
```

**Recommended:**

```json
{
  "strategy": "skip",
  "skip": {
    "reason": "Detailed reason with ticket reference",
    "impact": "minor",
    "continue_workflow": true,
    "mark_workflow_degraded": true
  }
}
```

### Rollback Strategy

**Minimal:**

```json
{
  "strategy": "rollback",
  "rollback": {
    "target_state": "previous_step"
  }
}
```

**Recommended:**

```json
{
  "strategy": "rollback",
  "rollback": {
    "target_state": "previous_step",
    "preserve_artifacts": true,
    "cleanup_files": ["dist/*", "*.tmp"],
    "notify_on_rollback": true
  }
}
```

### Halt Strategy

**Minimal:**

```json
{
  "strategy": "halt",
  "halt": {
    "reason": "Halt reason"
  }
}
```

**Recommended:**

```json
{
  "strategy": "halt",
  "halt": {
    "reason": "Detailed halt reason",
    "preserve_state": true,
    "notify": ["orchestrator", "user"],
    "create_incident": true
  }
}
```

---

## Integration Patterns

### In Workflow Orchestration

```javascript
import RecoveryHandler from './.claude/tools/recovery-handler.mjs';

const handler = new RecoveryHandler();
await handler.init();

try {
  await task.execute();
} catch (error) {
  const failure = {
    type: determineFailureType(error),
    severity: determineSeverity(error),
    metadata: { error_message: error.message },
  };

  const pattern = handler.matchPattern(failure);
  if (pattern) {
    const recovery = await handler.applyPattern(pattern, failure);
    handleRecoveryResult(recovery);
  }
}
```

### In CI/CD Pipeline

```yaml
# .github/workflows/test-with-recovery.yml
- name: Run Tests with Recovery
  run: |
    if ! npm test; then
      node .claude/tools/recovery-handler.mjs --match \
        --failure test_failure --severity high
    fi
```

---

## Default Patterns Reference

| Pattern ID                   | Strategy | Condition          | Max Attempts/Agent |
| ---------------------------- | -------- | ------------------ | ------------------ |
| `timeout-retry`              | Retry    | timeout            | 3 (exponential)    |
| `test-failure-escalate`      | Escalate | test_failure       | → developer        |
| `dependency-missing-retry`   | Retry    | dependency_missing | 4 (linear)         |
| `compilation-error-escalate` | Escalate | compilation_error  | → developer        |
| `critical-failure-halt`      | Halt     | security_violation | N/A (halt)         |

---

## Quick Validation Checklist

Before deploying a new pattern:

- [ ] Pattern ID is unique
- [ ] All required fields present
- [ ] Strategy matches configuration (retry has retry_policy, etc.)
- [ ] Priority set appropriately (1-10)
- [ ] Triggers have valid conditions and severity
- [ ] Error patterns are valid regex (if used)
- [ ] Max attempts reasonable (≤5 for retry)
- [ ] Backoff strategy appropriate for use case
- [ ] Jitter enabled for retry strategies
- [ ] Notifications configured for halt/critical
- [ ] Tags added for discoverability
- [ ] Pattern tested with `--test` command

---

**See Also:**

- [Recovery DSL Guide](./RECOVERY_DSL_GUIDE.md) - Comprehensive guide
- [Recovery Integration Examples](./RECOVERY_DSL_INTEGRATION_EXAMPLE.md) - Integration examples
- [Recovery Pattern Schema](./../schemas/recovery-pattern.schema.json) - JSON schema
