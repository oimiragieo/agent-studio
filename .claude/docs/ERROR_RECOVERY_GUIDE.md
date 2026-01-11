# Error Recovery Guide

**Version**: 1.0.0
**Last Updated**: 2026-01-10
**Purpose**: Comprehensive error classification and recovery strategies for LLM-RULES workflows

---

## Overview

This guide defines error categories and automatic recovery strategies for workflow execution. It enables intelligent error handling that minimizes manual intervention while maintaining system reliability.

---

## Error Categories

### 1. Transient Errors (Retry Safe)

**Characteristics**: Temporary failures that resolve with retries

**Examples**:

- Network timeouts (ETIMEDOUT, ECONNREFUSED)
- Rate limiting (HTTP 429)
- Temporary file locks (EBUSY)
- Service unavailable (HTTP 503)
- Temporary authentication failures
- Resource temporarily unavailable

**Recovery Strategy**: Exponential backoff retry

- **Max attempts**: 3
- **Base delay**: 1000ms
- **Max delay**: 10000ms
- **Multiplier**: 2x
- **Jitter**: ±200ms

**Implementation**:

```javascript
async function retryWithBackoff(fn, maxAttempts = 3) {
  let attempt = 1;
  let delay = 1000; // Base delay 1s

  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      // Check if error is transient
      if (!isTransientError(error)) throw error;

      // Exponential backoff with jitter
      const jitter = Math.random() * 400 - 200;
      const actualDelay = Math.min(delay + jitter, 10000);

      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      console.warn(`Retrying in ${actualDelay}ms...`);

      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay *= 2;
      attempt++;
    }
  }
}

function isTransientError(error) {
  const transientCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'EBUSY', 'ENOTFOUND'];
  const transientMessages = /timeout|rate limit|temporarily unavailable|service unavailable/i;

  return (
    transientCodes.includes(error.code) ||
    error.statusCode === 429 ||
    error.statusCode === 503 ||
    transientMessages.test(error.message)
  );
}
```

---

### 2. Permanent Errors (No Retry)

**Characteristics**: Errors that will not resolve with retries

**Examples**:

- File not found (ENOENT, HTTP 404)
- Permission denied (EACCES, HTTP 403)
- Invalid syntax errors
- Schema validation failures
- Resource deleted permanently
- Authentication invalid (HTTP 401 with invalid credentials)

**Recovery Strategy**: Fail fast with clear error message

- **No retries**: Error is permanent
- **Action**: Log error, report to user with actionable feedback
- **Workflow**: Mark step as failed, halt execution

**Implementation**:

```javascript
function isPermanentError(error) {
  const permanentCodes = ['ENOENT', 'EACCES', 'EPERM'];
  const permanentStatuses = [401, 403, 404, 410];
  const permanentMessages = /not found|permission denied|invalid syntax|schema validation failed/i;

  return (
    permanentCodes.includes(error.code) ||
    permanentStatuses.includes(error.statusCode) ||
    permanentMessages.test(error.message)
  );
}

function handlePermanentError(error, context) {
  console.error(`Permanent error in ${context.operation}: ${error.message}`);

  return {
    success: false,
    error: 'permanent',
    message: error.message,
    suggestion: generateSuggestion(error),
    context: context,
    canRetry: false,
  };
}

function generateSuggestion(error) {
  if (error.code === 'ENOENT') {
    return 'Check that the file exists and the path is correct';
  } else if (error.code === 'EACCES') {
    return 'Verify file permissions or run with appropriate privileges';
  } else if (error.statusCode === 401) {
    return 'Check authentication credentials or refresh access token';
  } else if (error.message.includes('schema validation')) {
    return 'Review the artifact against the schema and fix validation errors';
  }
  return 'Review the error details and correct the issue before retrying';
}
```

---

### 3. Recoverable Errors (Need Intervention)

**Characteristics**: Errors that require user input or configuration changes

**Examples**:

- Missing dependencies (MODULE_NOT_FOUND)
- Configuration errors (invalid config values)
- Invalid credentials (need refresh/re-authentication)
- Environment variable not set
- Insufficient resources (disk space, memory)

**Recovery Strategy**: Prompt user with specific fix instructions

- **Action**: Generate detailed fix instructions
- **Wait**: Pause workflow for user intervention
- **Verify**: Check if issue resolved before continuing
- **Fallback**: Offer alternative approaches

**Implementation**:

```javascript
async function handleRecoverableError(error, context) {
  const fixInstructions = generateFixInstructions(error);

  console.error(`Recoverable error in ${context.operation}:`);
  console.error(`  Error: ${error.message}`);
  console.error(`  Fix: ${fixInstructions.primary}`);

  if (fixInstructions.alternatives) {
    console.error(`  Alternatives:`);
    fixInstructions.alternatives.forEach((alt, i) => {
      console.error(`    ${i + 1}. ${alt}`);
    });
  }

  // Wait for user to acknowledge or fix
  if (context.interactive) {
    const fixed = await promptUserFix(fixInstructions);
    if (fixed) {
      // Retry operation
      return await retryOperation(context);
    }
  }

  return {
    success: false,
    error: 'recoverable',
    message: error.message,
    fixInstructions: fixInstructions,
    context: context,
    canRetry: true,
    requiresUserAction: true,
  };
}

function generateFixInstructions(error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    const moduleName = extractModuleName(error.message);
    return {
      primary: `Install missing dependency: pnpm add ${moduleName}`,
      alternatives: [`npm install ${moduleName}`, `yarn add ${moduleName}`],
    };
  } else if (error.message.includes('Environment variable')) {
    const varName = extractVariableName(error.message);
    return {
      primary: `Set environment variable: export ${varName}=<value>`,
      alternatives: [
        `Add ${varName} to .env file`,
        `Set ${varName} in system environment variables`,
      ],
    };
  } else if (error.message.includes('configuration')) {
    return {
      primary: 'Review and fix configuration in .claude/config.yaml',
      alternatives: [
        'Use default configuration: cp .claude/config.default.yaml .claude/config.yaml',
        'Validate configuration: node .claude/tools/validate-config.mjs',
      ],
    };
  }

  return {
    primary: 'Review error details and correct the issue',
    alternatives: [],
  };
}
```

---

### 4. Critical Errors (Stop Workflow)

**Characteristics**: Errors that indicate system-level failures or security issues

**Examples**:

- Security violations (unauthorized access attempts)
- Data corruption detected
- System resource exhaustion (out of memory, disk full)
- Circuit breaker tripped
- Unrecoverable provider failures
- Process crashes or segmentation faults

**Recovery Strategy**: Stop immediately, rollback if possible

- **Action**: Halt workflow, prevent further damage
- **Rollback**: Undo changes if transaction support available
- **Alert**: Notify user with critical severity
- **Log**: Detailed error context for debugging

**Implementation**:

```javascript
async function handleCriticalError(error, context) {
  console.error(`CRITICAL ERROR in ${context.operation}:`);
  console.error(`  Error: ${error.message}`);
  console.error(`  Context: ${JSON.stringify(context)}`);

  // Log to critical error log
  await logCriticalError(error, context);

  // Attempt rollback if supported
  if (context.rollbackSupported) {
    console.error(`  Attempting rollback...`);
    try {
      await rollbackChanges(context);
      console.error(`  Rollback successful`);
    } catch (rollbackError) {
      console.error(`  Rollback failed: ${rollbackError.message}`);
    }
  }

  // Alert user
  await alertCriticalError(error, context);

  return {
    success: false,
    error: 'critical',
    message: error.message,
    severity: 'critical',
    context: context,
    canRetry: false,
    rollbackAttempted: context.rollbackSupported,
    recommendation: 'System requires manual inspection and recovery',
  };
}

function isCriticalError(error) {
  const criticalMessages =
    /security violation|data corruption|out of memory|disk full|circuit.*open/i;
  const criticalCodes = ['ENOMEM', 'ENOSPC'];

  return (
    error.severity === 'critical' ||
    error.security === true ||
    criticalCodes.includes(error.code) ||
    criticalMessages.test(error.message)
  );
}

async function logCriticalError(error, context) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    context,
  };

  // Write to critical error log
  await appendToLog('.claude/context/logs/critical-errors.log', logEntry);
}
```

---

## Error Classification Decision Tree

```
Error Occurred
│
├─ Is it a security violation or data corruption?
│  └─ YES → CRITICAL ERROR (Stop, Rollback, Alert)
│
├─ Is it a network/timeout/rate-limit error?
│  └─ YES → TRANSIENT ERROR (Retry with backoff)
│
├─ Is it a file not found or permission denied?
│  └─ YES → PERMANENT ERROR (Fail fast)
│
├─ Is it a missing dependency or config error?
│  └─ YES → RECOVERABLE ERROR (Prompt user)
│
└─ Unknown error type → Default to PERMANENT ERROR (Fail fast)
```

---

## Integration with Workflows

### Workflow Runner Integration

```javascript
// In workflow_runner.js
import { ErrorRecovery } from './error-recovery.mjs';

async function executeStep(step, context) {
  try {
    return await step.execute(context);
  } catch (error) {
    // Classify and recover
    const recoveryResult = await ErrorRecovery.recover(error, {
      operation: step.name,
      stepNumber: step.number,
      workflowId: context.workflowId,
      runId: context.runId,
      interactive: context.interactive || false,
      rollbackSupported: step.rollbackSupported || false,
    });

    if (recoveryResult.success) {
      // Recovery successful, continue
      return recoveryResult;
    } else if (recoveryResult.canRetry && recoveryResult.requiresUserAction) {
      // Wait for user to fix, then retry
      throw new Error(
        `Step ${step.number} requires user action: ${recoveryResult.fixInstructions.primary}`
      );
    } else {
      // Unrecoverable, fail workflow
      throw error;
    }
  }
}
```

---

## Error Recovery Logging

All recovery attempts are logged to `.claude/context/logs/error-recovery.log`:

**Log Format**:

```
[timestamp] [workflow-id] [step] [error-category] [recovery-status] [error-message]
```

**Example**:

```
[2026-01-10T12:34:56.789Z] [run-001] [step-3] [transient] [retry-success] ETIMEDOUT after 3 attempts
[2026-01-10T12:35:12.456Z] [run-002] [step-1] [permanent] [fail-fast] File not found: plan.json
[2026-01-10T12:36:45.123Z] [run-003] [step-5] [recoverable] [user-action-required] Missing dependency: js-yaml
[2026-01-10T12:37:22.789Z] [run-004] [step-2] [critical] [rollback-success] Circuit breaker open for skill-injection
```

---

## Best Practices

1. **Always Classify**: Classify every error before attempting recovery
2. **Log Everything**: Log all recovery attempts for debugging
3. **User-Friendly Messages**: Provide clear, actionable error messages
4. **Rollback Support**: Implement rollback for critical operations
5. **Circuit Breakers**: Use circuit breakers for external services
6. **Timeout Protection**: Always set timeouts for network operations
7. **Idempotency**: Design operations to be safely retryable
8. **State Persistence**: Save workflow state before risky operations

---

## Testing Error Recovery

### Test Cases

1. **Transient Error Recovery**:
   - Simulate network timeout
   - Verify exponential backoff
   - Confirm successful retry

2. **Permanent Error Handling**:
   - Simulate file not found
   - Verify fail-fast behavior
   - Check error message clarity

3. **Recoverable Error Flow**:
   - Simulate missing dependency
   - Verify fix instructions
   - Test retry after fix

4. **Critical Error Handling**:
   - Simulate out of memory
   - Verify rollback execution
   - Check alert delivery

---

## Error Recovery Metrics

Track these metrics to improve recovery strategies:

- **Recovery Success Rate**: % of errors successfully recovered
- **Retry Attempts**: Average attempts before success
- **User Interventions**: Number of recoverable errors requiring user action
- **Critical Error Frequency**: Rate of critical errors
- **Rollback Success Rate**: % of successful rollbacks

---

## See Also

- `.claude/tools/error-recovery.mjs` - Error recovery implementation
- `.claude/context/logs/error-recovery.log` - Recovery attempt log
- `.claude/docs/CIRCUIT_BREAKER.md` - Circuit breaker patterns
- `.claude/docs/TIMEOUT_MANAGEMENT.md` - Timeout handling strategies
